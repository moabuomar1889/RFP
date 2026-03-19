/**
 * Enforcement Engine — Strict Reset-and-Reapply
 *
 * This module contains the per-folder enforcement logic extracted from jobs.ts.
 * It is fully testable (all Drive API calls are injected as dependencies).
 *
 * Contract:
 *   enforceFolder(ctx) → FolderEnforceResult
 *
 * Phases:
 *   Phase 1 — Reset: disable LA, remove all removable direct permissions
 *   Phase 2 — Apply: re-add template principals at exact roles, enable LA if required
 *   Phase 3 — Verify: re-fetch Drive state, strict compare vs expected → FolderVerifyResult
 */

import {
    classifyInheritedPermission,
    computeDesiredEffectivePolicy,
    comparePermissions,
    isFullyCompliant,
    type FolderPermissions,
    type PermComparison,
    type ActualPermission,
    normalizeRole,
} from '@/server/audit-helpers';
import { CANONICAL_RANK } from '@/lib/template-engine/types';

// ─── Retry Config ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1500, 4000];

/** Map canonical role names back to Drive API role strings for addPermission calls. */
const CANONICAL_TO_DRIVE: Record<string, string> = {
    viewer: 'reader',
    contributor: 'writer',
    contentManager: 'fileOrganizer',
    manager: 'organizer',
    // pass-through (already Drive-native roles)
    reader: 'reader',
    writer: 'writer',
    fileOrganizer: 'fileOrganizer',
    organizer: 'organizer',
};

function toDriveRole(canonicalRole: string): string {
    return CANONICAL_TO_DRIVE[canonicalRole] ?? canonicalRole;
}

function isTransientError(err: any): boolean {
    const msg: string = err?.message ?? '';
    const code: number = err?.code ?? err?.status ?? 0;
    return (
        code === 429 ||
        code === 500 ||
        code === 502 ||
        code === 503 ||
        code === 504 ||
        msg.includes('ECONNRESET') ||
        msg.includes('socket hang up') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('rate limit') ||
        msg.includes('quota')
    );
}

async function withRetry<T>(
    fn: () => Promise<T>,
    label: string
): Promise<{ result?: T; error?: Error; attempts: number; isTransient: boolean }> {
    let lastErr: Error | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await fn();
            return { result, attempts: attempt + 1, isTransient: false };
        } catch (err: any) {
            lastErr = err;
            if (!isTransientError(err) || attempt === MAX_RETRIES) {
                return { error: err, attempts: attempt + 1, isTransient: isTransientError(err) };
            }
            await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt] ?? 4000));
        }
    }
    return { error: lastErr, attempts: MAX_RETRIES + 1, isTransient: true };
}

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface ResetResult {
    laDisabled: boolean;
    laDisableError?: string;
    removed: number;
    nonRemovable: number;
    removeErrors: Array<{ email: string; error: string; attempts: number; persistent: boolean }>;
}

export interface ApplyResult {
    laEnabled: boolean;
    laEnableError?: string;
    laVerified: boolean;
    added: number;
    skipped: number;
    addErrors: Array<{ email: string; role: string; error: string; attempts: number; persistent: boolean }>;
}

export interface VerifyResult {
    compliant: boolean;
    comparisons: PermComparison[];
    limitedAccessMatch: boolean;
}

export interface FolderEnforceResult {
    folderId: string;
    templatePath: string;
    reset: ResetResult;
    apply: ApplyResult;
    verify: VerifyResult;
    success: boolean; // true if verify is fully compliant
}

// ─── Drive API Interface (injected for testability) ───────────────────────────

export interface DriveEnforceAPI {
    listPermissions(folderId: string): Promise<ActualPermission[]>;
    addPermission(folderId: string, type: string, role: string, email: string): Promise<void>;
    removePermission(folderId: string, permissionId: string): Promise<void>;
    setLimitedAccess(folderId: string, enabled: boolean): Promise<void>;
    getLimitedAccessState(folderId: string): Promise<boolean>;
    isProtectedPrincipal(email: string): boolean;
}

// ─── Per-Folder Enforcement ───────────────────────────────────────────────────

/**
 * Enforce a single managed folder strictly:
 *   Phase 1 — Reset
 *   Phase 2 — Apply
 *   Phase 3 — Verify
 */
export async function enforceFolder(
    folderId: string,
    templatePath: string,
    expectedPerms: FolderPermissions,
    inheritedRoles: Map<string, number>, // email → CANONICAL_RANK from parent (non-LA folders)
    driveId: string | undefined,
    api: DriveEnforceAPI
): Promise<FolderEnforceResult> {

    // ── Phase 1: Reset ──────────────────────────────────────────────────────

    const reset: ResetResult = {
        laDisabled: false,
        removed: 0,
        nonRemovable: 0,
        removeErrors: [],
    };

    // 1a. Disable Limited Access (so parent-inherited perms become removable)
    const laDisableResult = await withRetry(
        () => api.setLimitedAccess(folderId, false),
        `LA disable ${folderId}`
    );
    if (laDisableResult.error) {
        reset.laDisableError = laDisableResult.error.message;
        // Non-fatal: continue — Drive may already have LA off, or it may be unneeded
    } else {
        reset.laDisabled = true;
    }

    // 1b. List current permissions and remove all removable direct permissions
    let currentPerms: ActualPermission[] = [];
    try {
        currentPerms = await api.listPermissions(folderId);
    } catch (err: any) {
        // If we can't list, we can't reset — this is a hard failure for this folder
        return {
            folderId,
            templatePath,
            reset: { ...reset, laDisableError: reset.laDisableError ?? undefined, removeErrors: [{ email: '__list__', error: err.message, attempts: 1, persistent: true }] },
            apply: { laEnabled: false, laVerified: false, added: 0, skipped: 0, addErrors: [] },
            verify: { compliant: false, comparisons: [], limitedAccessMatch: false },
            success: false,
        };
    }

    for (const perm of currentPerms) {
        if (!perm.emailAddress || !perm.id) continue;
        if (api.isProtectedPrincipal(perm.emailAddress)) continue;

        const cls = classifyInheritedPermission(perm, driveId);

        if (cls === 'NON_REMOVABLE_DRIVE_MEMBERSHIP') {
            reset.nonRemovable++;
            continue;
        }

        // For non-LA folders: inherited perms from parent folder can't be removed here
        // (they're on the parent, not this folder). Skip silently — track for ceiling check.
        if (cls === 'REMOVABLE_PARENT_FOLDER' && !expectedPerms.limitedAccess) {
            reset.nonRemovable++;
            const rank = CANONICAL_RANK[normalizeRole(perm.role || 'reader')] ?? 0;
            const existing = inheritedRoles.get(perm.emailAddress.toLowerCase()) ?? 0;
            if (rank > existing) inheritedRoles.set(perm.emailAddress.toLowerCase(), rank);
            continue;
        }

        const removeResult = await withRetry(
            () => api.removePermission(folderId, perm.id!),
            `remove ${perm.emailAddress} from ${folderId}`
        );

        if (removeResult.error) {
            const errorMsg = removeResult.error.message;
            // "not found" = already gone, treat as success
            if (errorMsg.includes('not found')) {
                reset.removed++;
            } else {
                reset.removeErrors.push({
                    email: perm.emailAddress,
                    error: errorMsg,
                    attempts: removeResult.attempts,
                    persistent: !removeResult.isTransient,
                });
            }
        } else {
            reset.removed++;
        }
    }

    // ── Phase 2: Apply ──────────────────────────────────────────────────────

    const apply: ApplyResult = {
        laEnabled: false,
        laVerified: false,
        added: 0,
        skipped: 0,
        addErrors: [],
    };

    // 2a. Enable Limited Access BEFORE adding permissions (Google requirement)
    if (expectedPerms.limitedAccess) {
        const laEnableResult = await withRetry(
            () => api.setLimitedAccess(folderId, true),
            `LA enable ${folderId}`
        );
        if (laEnableResult.error) {
            apply.laEnableError = laEnableResult.error.message;
        } else {
            apply.laEnabled = true;
            // 2b. Verify LA state after enabling
            try {
                const state = await api.getLimitedAccessState(folderId);
                apply.laVerified = state === true;
            } catch {
                apply.laVerified = false;
            }
        }
    }

    // 2c. Add all expected principals
    const desired = computeDesiredEffectivePolicy(expectedPerms);
    for (const principal of desired) {
        if (principal.overrideAction === 'removed') continue;

        // Strict Hierarchy Check for non-LA folders:
        // If the principal already has an inherited role >= target role, skip adding
        // (Google Shared Drive doesn't allow adding below inherited role).
        if (!expectedPerms.limitedAccess) {
            const inheritedRank = inheritedRoles.get(principal.identifier) ?? 0;
            if (inheritedRank > 0) {
                const targetRank = CANONICAL_RANK[principal.role] ?? 0;
                if (targetRank <= inheritedRank) {
                    apply.skipped++;
                    continue; // inherited role already satisfies or exceeds template
                }
                // targetRank > inheritedRank: this is a genuine upgrade attempt
                // We still try to add — if Google rejects it, we'll catch that in verify
            }
        }

        const addResult = await withRetry(
            () => api.addPermission(folderId, principal.type, toDriveRole(principal.role), principal.identifier),
            `add ${principal.identifier} ${principal.role} to ${folderId}`
        );

        if (addResult.error) {
            apply.addErrors.push({
                email: principal.identifier,
                role: principal.role,
                error: addResult.error.message,
                attempts: addResult.attempts,
                persistent: !addResult.isTransient,
            });
        } else {
            apply.added++;
        }
    }

    // ── Phase 3: Verify ──────────────────────────────────────────────────────

    const verify: VerifyResult = {
        compliant: false,
        comparisons: [],
        limitedAccessMatch: false,
    };

    try {
        const finalPerms = await api.listPermissions(folderId);
        let actualLA: boolean | null = null;
        try {
            actualLA = await api.getLimitedAccessState(folderId);
        } catch {
            actualLA = null;
        }

        const comparisons = comparePermissions(
            desired,
            finalPerms,
            expectedPerms.limitedAccess,
            actualLA,
            driveId,
        );

        verify.comparisons = comparisons;
        verify.compliant = isFullyCompliant(comparisons);
        verify.limitedAccessMatch = actualLA === null || actualLA === expectedPerms.limitedAccess;
    } catch (err: any) {
        verify.comparisons = [{
            principal: '__verify__',
            principalType: 'unknown',
            status: 'MISSING',
            reason: `Verify phase failed: ${err.message}`,
        }];
        verify.compliant = false;
    }

    return {
        folderId,
        templatePath,
        reset,
        apply,
        verify,
        success: verify.compliant,
    };
}

/**
 * Summarize enforce results for a batch of folders.
 */
export function summarizeEnforceResults(results: FolderEnforceResult[]): {
    totalFolders: number;
    compliant: number;
    nonCompliant: number;
    totalAdded: number;
    totalRemoved: number;
    totalErrors: number;
    persistentFailures: Array<{ folder: string; type: string; email: string; error: string }>;
    nonComplianceReasons: Array<{ folder: string; comparisons: PermComparison[] }>;
} {
    let compliant = 0, nonCompliant = 0, totalAdded = 0, totalRemoved = 0, totalErrors = 0;
    const persistentFailures: any[] = [];
    const nonComplianceReasons: any[] = [];

    for (const r of results) {
        if (r.verify.compliant) compliant++; else nonCompliant++;
        totalAdded += r.apply.added;
        totalRemoved += r.reset.removed;
        totalErrors += r.apply.addErrors.length + r.reset.removeErrors.length;

        for (const e of r.apply.addErrors) {
            if (e.persistent) persistentFailures.push({ folder: r.templatePath, type: 'add', email: e.email, error: e.error });
        }
        for (const e of r.reset.removeErrors) {
            if (e.persistent) persistentFailures.push({ folder: r.templatePath, type: 'remove', email: e.email, error: e.error });
        }

        if (!r.verify.compliant) {
            nonComplianceReasons.push({
                folder: r.templatePath,
                comparisons: r.verify.comparisons.filter(c => c.status !== 'EXACT_MATCH' && c.status !== 'NON_REMOVABLE_MEMBERSHIP'),
            });
        }
    }

    return { totalFolders: results.length, compliant, nonCompliant, totalAdded, totalRemoved, totalErrors, persistentFailures, nonComplianceReasons };
}
