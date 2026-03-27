/**
 * enforce-engine.test.ts
 *
 * 10 test scenarios for the strict reset-and-reapply enforcement engine.
 * All Drive API calls are mocked via DriveEnforceAPI — no real API calls made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enforceFolder, type DriveEnforceAPI } from '@/server/enforce-engine';
import { type FolderPermissions } from '@/server/audit-helpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeApi(overrides: Partial<DriveEnforceAPI> = {}): DriveEnforceAPI {
    return {
        listPermissions: vi.fn(async () => []),
        addPermission: vi.fn(async () => {}),
        removePermission: vi.fn(async () => true),
        setLimitedAccess: vi.fn(async () => {}),
        getLimitedAccessState: vi.fn(async () => false),
        isProtectedPrincipal: vi.fn(() => false),
        ...overrides,
    };
}

const FOLDER_ID = 'folder-abc-123';
const TEMPLATE_PATH = 'Project Delivery/Document Control';
const DRIVE_ID = '0ADrive123Shared';

const basePerms: FolderPermissions = {
    groups: [{ email: 'team-a@example.com', role: 'writer' }],
    users: [],
    limitedAccess: false,
};

const laPerms: FolderPermissions = {
    groups: [{ email: 'team-b@example.com', role: 'reader' }],
    users: [],
    limitedAccess: true,
};

// ─── Test 1: Stale direct permissions are fully removed in reset ──────────────
describe('Test 1: stale direct permissions removed in reset', () => {
    it('removes all removable direct permissions before applying', async () => {
        const api = makeApi({
            listPermissions: vi.fn()
                .mockResolvedValueOnce([
                    // First call (reset): two stale permissions
                    { emailAddress: 'old-a@example.com', role: 'reader', id: 'perm-1', permissionDetails: [{ inherited: false }] },
                    { emailAddress: 'old-b@example.com', role: 'writer', id: 'perm-2', permissionDetails: [{ inherited: false }] },
                ])
                .mockResolvedValueOnce([
                    // Second call (verify): template result already applied
                    { emailAddress: 'team-a@example.com', role: 'writer', id: 'perm-3', permissionDetails: [{ inherited: false }] },
                ]),
        });

        const result = await enforceFolder(FOLDER_ID, TEMPLATE_PATH, basePerms, new Map(), DRIVE_ID, api);

        expect(api.removePermission).toHaveBeenCalledTimes(2);
        expect(result.reset.removed).toBe(2);
        expect(result.verify.compliant).toBe(true);
    });
});

// ─── Test 2: LA disabled before removal, re-enabled after apply ───────────────
describe('Test 2: limited access disable/enable cycle', () => {
    it('disables LA in reset phase and re-enables in apply phase when template requires it', async () => {
        const setLimitedAccess = vi.fn(async () => {});
        const api = makeApi({
            setLimitedAccess,
            listPermissions: vi.fn()
                .mockResolvedValueOnce([]) // reset: no stale perms
                .mockResolvedValueOnce([ // verify: LA correctly applied
                    { emailAddress: 'team-b@example.com', role: 'reader', id: 'p1', permissionDetails: [{ inherited: false }] },
                ]),
            getLimitedAccessState: vi.fn(async () => true),
        });

        await enforceFolder(FOLDER_ID, TEMPLATE_PATH, laPerms, new Map(), DRIVE_ID, api);

        const calls = setLimitedAccess.mock.calls;
        // First call: disable (false), Second call: enable (true)
        expect(calls[0][1]).toBe(false);  // reset: disable
        expect(calls[1][1]).toBe(true);   // apply: enable
    });
});

// ─── Test 3: Exact reapply from template → all EXACT_MATCH ───────────────────
describe('Test 3: exact reapply → EXACT_MATCH', () => {
    it('reports EXACT_MATCH for every principal when Drive matches template exactly', async () => {
        const api = makeApi({
            listPermissions: vi.fn()
                .mockResolvedValueOnce([]) // reset
                .mockResolvedValueOnce([   // verify
                    { emailAddress: 'team-a@example.com', role: 'writer', id: 'p1', permissionDetails: [{ inherited: false }] },
                ]),
        });

        const result = await enforceFolder(FOLDER_ID, TEMPLATE_PATH, basePerms, new Map(), DRIVE_ID, api);

        expect(result.verify.compliant).toBe(true);
        const matches = result.verify.comparisons.filter(c => c.status === 'EXACT_MATCH');
        expect(matches.length).toBeGreaterThan(0);
        expect(matches[0].principal).toBe('team-a@example.com');
    });
});

// ─── Test 4: Transient add failure retried and eventually succeeds ─────────────
describe('Test 4: transient add failure retried', () => {
    it('retries on transient error and records correct attempt count', async () => {
        let callCount = 0;
        const api = makeApi({
            addPermission: vi.fn(async () => {
                callCount++;
                if (callCount < 3) throw Object.assign(new Error('rate limit exceeded'), { code: 429 });
            }),
            listPermissions: vi.fn()
                .mockResolvedValueOnce([]) // reset
                .mockResolvedValueOnce([   // verify — matches after eventual success
                    { emailAddress: 'team-a@example.com', role: 'writer', id: 'p1', permissionDetails: [{ inherited: false }] },
                ]),
        });

        const result = await enforceFolder(FOLDER_ID, TEMPLATE_PATH, basePerms, new Map(), DRIVE_ID, api);

        // Should have retried at least 3 times total (1 initial + 2 retries)
        expect(api.addPermission).toHaveBeenCalledTimes(3);
        expect(result.apply.addErrors).toHaveLength(0);
        expect(result.apply.added).toBe(1);
    }, 15000); // allow for retry delays
});

// ─── Test 5: Persistent add failure surfaced clearly ──────────────────────────
describe('Test 5: persistent add failure → persistent_failure', () => {
    it('surfaces persistent failure after exhausting retries', async () => {
        const api = makeApi({
            addPermission: vi.fn(async () => {
                throw Object.assign(new Error('permanent Drive API rejection'), { code: 403 });
            }),
            listPermissions: vi.fn()
                .mockResolvedValueOnce([]) // reset
                .mockResolvedValueOnce([]), // verify: permission missing
        });

        const result = await enforceFolder(FOLDER_ID, TEMPLATE_PATH, basePerms, new Map(), DRIVE_ID, api);

        expect(result.apply.addErrors.length).toBeGreaterThan(0);
        expect(result.apply.addErrors[0].persistent).toBe(true);
        expect(result.apply.addErrors[0].email).toBe('team-a@example.com');
        // Verify should report MISSING since the add failed
        const missing = result.verify.comparisons.filter(c => c.status === 'MISSING');
        expect(missing.length).toBeGreaterThan(0);
    });
});

// ─── Test 6: Stronger-than-template classified correctly ──────────────────────
describe('Test 6: stronger-than-template → STRONGER_THAN_TEMPLATE', () => {
    it('reports STRONGER_THAN_TEMPLATE when actual role exceeds expected role', async () => {
        const api = makeApi({
            listPermissions: vi.fn()
                .mockResolvedValueOnce([]) // reset
                .mockResolvedValueOnce([   // verify: organizer instead of writer
                    {
                        emailAddress: 'team-a@example.com',
                        role: 'organizer', // STRONGER than writer
                        id: 'p1',
                        permissionDetails: [{ inherited: false }],
                    },
                ]),
        });

        const result = await enforceFolder(FOLDER_ID, TEMPLATE_PATH, basePerms, new Map(), DRIVE_ID, api);

        const stronger = result.verify.comparisons.filter(c => c.status === 'STRONGER_THAN_TEMPLATE');
        expect(stronger.length).toBeGreaterThan(0);
        expect(stronger[0].principal).toBe('team-a@example.com');
        expect(result.verify.compliant).toBe(false);
    });
});

// ─── Test 7: Weaker-than-template classified correctly ────────────────────────
describe('Test 7: weaker-than-template → WEAKER_THAN_TEMPLATE', () => {
    it('reports WEAKER_THAN_TEMPLATE when actual role is below expected', async () => {
        const api = makeApi({
            listPermissions: vi.fn()
                .mockResolvedValueOnce([]) // reset
                .mockResolvedValueOnce([   // verify: reader instead of writer
                    {
                        emailAddress: 'team-a@example.com',
                        role: 'reader', // WEAKER than writer
                        id: 'p1',
                        permissionDetails: [{ inherited: false }],
                    },
                ]),
        });

        const result = await enforceFolder(FOLDER_ID, TEMPLATE_PATH, basePerms, new Map(), DRIVE_ID, api);

        const weaker = result.verify.comparisons.filter(c => c.status === 'WEAKER_THAN_TEMPLATE');
        expect(weaker.length).toBeGreaterThan(0);
        expect(weaker[0].principal).toBe('team-a@example.com');
        expect(result.verify.compliant).toBe(false);
    });
});

// ─── Test 8: Non-removable drive membership classified separately ─────────────
describe('Test 8: non-removable drive membership', () => {
    it('classifies drive-level inherited permission as NON_REMOVABLE_MEMBERSHIP', async () => {
        const api = makeApi({
            listPermissions: vi.fn()
                .mockResolvedValueOnce([
                    // reset: drive membership — inherited from drive root (0A...), NOT NOT_INHERITED
                    {
                        emailAddress: 'drive-member@example.com',
                        role: 'fileOrganizer',
                        id: 'p-drive-1',
                        permissionDetails: [{ inherited: true, inheritedFrom: DRIVE_ID }],
                    },
                ])
                .mockResolvedValueOnce([
                    // verify: drive membership still present (non-removable) + expected
                    {
                        emailAddress: 'drive-member@example.com',
                        role: 'fileOrganizer',
                        id: 'p-drive-1',
                        permissionDetails: [{ inherited: true, inheritedFrom: DRIVE_ID }],
                    },
                    {
                        emailAddress: 'team-a@example.com',
                        role: 'writer',
                        id: 'p1',
                        permissionDetails: [{ inherited: false }],
                    },
                ]),
        });

        const result = await enforceFolder(FOLDER_ID, TEMPLATE_PATH, basePerms, new Map(), DRIVE_ID, api);

        // Drive membership should NOT have been removed
        expect(api.removePermission).not.toHaveBeenCalledWith(FOLDER_ID, 'p-drive-1');
        expect(result.reset.nonRemovable).toBe(1);

        // Verify should classify drive membership as NON_REMOVABLE, not a violation
        const nonRemovable = result.verify.comparisons.filter(c => c.status === 'NON_REMOVABLE_MEMBERSHIP');
        expect(nonRemovable.length).toBeGreaterThan(0);
        expect(result.verify.compliant).toBe(true); // NON_REMOVABLE doesn't make it non-compliant
    });
});

// ─── Test 9: Override (remove) applied correctly ──────────────────────────────
describe('Test 9: override remove applied correctly', () => {
    it('does not add a principal that is in template overrides.remove', async () => {
        const permsWithOverride: FolderPermissions = {
            groups: [
                { email: 'team-a@example.com', role: 'writer' },
                { email: 'blocked@example.com', role: 'reader' },
            ],
            users: [],
            limitedAccess: false,
            overrides: {
                remove: [{ type: 'group', identifier: 'blocked@example.com' }],
            },
        };

        const api = makeApi({
            listPermissions: vi.fn()
                .mockResolvedValueOnce([]) // reset
                .mockResolvedValueOnce([   // verify
                    { emailAddress: 'team-a@example.com', role: 'writer', id: 'p1', permissionDetails: [{ inherited: false }] },
                ]),
        });

        await enforceFolder(FOLDER_ID, TEMPLATE_PATH, permsWithOverride, new Map(), DRIVE_ID, api);

        // blocked@example.com must NOT be added
        const addCalls = (api.addPermission as ReturnType<typeof vi.fn>).mock.calls;
        const blockedCalls = addCalls.filter((c: any[]) => c[3] === 'blocked@example.com');
        expect(blockedCalls).toHaveLength(0);
    });
});

// ─── Test 10: Override (downgrade) applied correctly ─────────────────────────
describe('Test 10: override downgrade applied correctly', () => {
    it('applies downgraded role for a principal with override.downgrade', async () => {
        const permsWithDowngrade: FolderPermissions = {
            groups: [
                { email: 'team-a@example.com', role: 'organizer' },
            ],
            users: [],
            limitedAccess: false,
            overrides: {
                downgrade: [{ type: 'group', identifier: 'team-a@example.com', role: 'reader' }],
            },
        };

        const api = makeApi({
            listPermissions: vi.fn()
                .mockResolvedValueOnce([]) // reset
                .mockResolvedValueOnce([   // verify
                    { emailAddress: 'team-a@example.com', role: 'reader', id: 'p1', permissionDetails: [{ inherited: false }] },
                ]),
        });

        await enforceFolder(FOLDER_ID, TEMPLATE_PATH, permsWithDowngrade, new Map(), DRIVE_ID, api);

        const addCalls = (api.addPermission as ReturnType<typeof vi.fn>).mock.calls;
        const teamACalls = addCalls.filter((c: any[]) => c[3] === 'team-a@example.com');
        expect(teamACalls.length).toBeGreaterThan(0);
        // Role should be 'reader' (downgraded), not 'organizer'
        expect(teamACalls[0][2]).toBe('reader');
    });
});

// —— Test 11: skipped removal must not count as removed —— 
describe('Test 11: skipped inherited-only removal is not counted as removed', () => {
    it('treats removePermission=false as non-removable instead of successful removal', async () => {
        const api = makeApi({
            listPermissions: vi.fn()
                .mockResolvedValueOnce([
                    {
                        emailAddress: 'team-a@example.com',
                        role: 'fileOrganizer',
                        id: 'perm-composite',
                        permissionDetails: [
                            { inherited: false },
                            { inherited: true, inheritedFrom: DRIVE_ID },
                        ],
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        emailAddress: 'team-a@example.com',
                        role: 'fileOrganizer',
                        id: 'perm-composite',
                        permissionDetails: [
                            { inherited: false },
                            { inherited: true, inheritedFrom: DRIVE_ID },
                        ],
                    },
                ]),
            removePermission: vi.fn(async () => false),
        });

        const result = await enforceFolder(FOLDER_ID, TEMPLATE_PATH, basePerms, new Map(), DRIVE_ID, api);

        expect(result.reset.removed).toBe(0);
        expect(result.reset.nonRemovable).toBe(1);
        expect(result.verify.compliant).toBe(false);
    });
});
