/**
 * audit-strict.test.ts
 *
 * Targeted tests for the 3 confirmed enforcement gaps:
 *   A. Audit strict alignment: STRONGER → mismatch, WEAKER → mismatch, NON_REMOVABLE → drive_member
 *   B. Limited Access verification field correctness
 *   C. De-normalization: toDriveRole maps canonical → Drive-native (no silent downgrades)
 */

import { describe, it, expect, vi } from 'vitest';
import {
    comparePermissions,
    computeDesiredEffectivePolicy,
} from '@/server/audit-helpers';
import { enforceFolder, type DriveEnforceAPI } from '@/server/enforce-engine';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const DRIVE_ID = '0ASharedDriveTest';

function makeActual(role: string): any[] {
    return [{
        emailAddress: 'team-a@example.com',
        role,
        type: 'group',
        permissionDetails: [{ inherited: false }],
    }];
}

const writerTemplateFolderPerms = {
    groups: [{ email: 'team-a@example.com', role: 'writer' }],
    users: [] as any[],
    limitedAccess: false,
};

function makeEnforceApi(overrides: Partial<DriveEnforceAPI> = {}): DriveEnforceAPI {
    return {
        listPermissions: vi.fn(async () => []),
        addPermission: vi.fn(async () => {}),
        removePermission: vi.fn(async () => {}),
        setLimitedAccess: vi.fn(async () => {}),
        getLimitedAccessState: vi.fn(async () => false),
        isProtectedPrincipal: vi.fn(() => false),
        ...overrides,
    };
}

// ─── Gap A: Shared strict comparison model ────────────────────────────────────

describe('Gap A — Shared strict comparison model (comparePermissions)', () => {

    it('A1: actual=organizer when template=writer is STRONGER_THAN_TEMPLATE (not EXACT_MATCH)', () => {
        const desired = computeDesiredEffectivePolicy(writerTemplateFolderPerms);
        const actual = makeActual('organizer');  // organizer > writer

        const results = comparePermissions(desired, actual, false, null, DRIVE_ID);
        const c = results.find(r => r.principal === 'team-a@example.com');

        expect(c).toBeDefined();
        expect(c!.status).toBe('STRONGER_THAN_TEMPLATE');
        expect(c!.status).not.toBe('EXACT_MATCH');
    });

    it('A2: actual=reader when template=writer is WEAKER_THAN_TEMPLATE (not EXACT_MATCH)', () => {
        const desired = computeDesiredEffectivePolicy(writerTemplateFolderPerms);
        const actual = makeActual('reader');  // reader < writer

        const results = comparePermissions(desired, actual, false, null, DRIVE_ID);
        const c = results.find(r => r.principal === 'team-a@example.com');

        expect(c).toBeDefined();
        expect(c!.status).toBe('WEAKER_THAN_TEMPLATE');
        expect(c!.status).not.toBe('EXACT_MATCH');
    });

    it('A3: Shared Drive membership is NON_REMOVABLE_MEMBERSHIP (not EXTRA)', () => {
        const desired = computeDesiredEffectivePolicy({ groups: [], users: [], limitedAccess: false });
        const actual = [{
            emailAddress: 'drive-admin@example.com',
            role: 'organizer',
            type: 'user',
            permissionDetails: [{ inherited: true, inheritedFrom: DRIVE_ID }],
        }];

        const results = comparePermissions(desired, actual, false, null, DRIVE_ID);
        const c = results.find(r => r.principal === 'drive-admin@example.com');

        expect(c).toBeDefined();
        expect(c!.status).toBe('NON_REMOVABLE_MEMBERSHIP');
        expect(c!.status).not.toBe('EXTRA');
    });
});

// ─── Gap B: Limited Access verification ──────────────────────────────────────

describe('Gap B — Limited Access field correctness via comparePermissions', () => {

    it('B1: LA mismatch when expectedLA=true but actualLA=false', () => {
        const desired = computeDesiredEffectivePolicy({
            groups: [{ email: 'team-a@example.com', role: 'reader' }],
            users: [],
            limitedAccess: true,
        });
        const actual = makeActual('reader');

        const results = comparePermissions(desired, actual, true, false, DRIVE_ID);
        const laRow = results.find(r => r.status === 'LIMITED_ACCESS_MISMATCH');

        expect(laRow).toBeDefined();
        expect(laRow!.expectedRole).toBe('enabled');
        expect(laRow!.actualRole).toBe('disabled');
    });

    it('B2: no LA mismatch when actual matches expected', () => {
        const desired = computeDesiredEffectivePolicy({
            groups: [{ email: 'team-a@example.com', role: 'reader' }],
            users: [],
            limitedAccess: true,
        });
        const actual = makeActual('reader');

        const results = comparePermissions(desired, actual, true, true, DRIVE_ID);
        const laRow = results.find(r => r.status === 'LIMITED_ACCESS_MISMATCH');

        expect(laRow).toBeUndefined();
    });
});

// ─── Gap C: No silent role downgrades in enforce path ────────────────────────

describe('Gap C — De-normalization: enforce engine passes Drive-native roles to addPermission', () => {

    it('C1: template role writer → addPermission called with Drive-native "writer" not canonical "contributor"', async () => {
        const addRoles: string[] = [];
        const api = makeEnforceApi({
            addPermission: vi.fn(async (_fId: string, _type: string, role: string) => {
                addRoles.push(role);
            }),
            listPermissions: vi.fn()
                .mockResolvedValueOnce([]) // reset
                .mockResolvedValueOnce([
                    { emailAddress: 'team-a@example.com', role: 'writer', id: 'p1', permissionDetails: [{ inherited: false }] },
                ]),
        });

        await enforceFolder(
            'test-folder',
            'Project Delivery/Quality Control',
            writerTemplateFolderPerms,
            new Map(),
            DRIVE_ID,
            api
        );

        expect(addRoles.length).toBeGreaterThan(0);
        expect(addRoles[0]).toBe('writer');    // Drive-native
        expect(addRoles[0]).not.toBe('contributor');  // NOT canonical
    });

    it('C2: Drive rejection of invalid role surfaces as persistent_failure (not silent success)', async () => {
        // Test: enforce-engine must NOT swallow Drive errors — they must persist in addErrors
        // This proves no silent downgrade: if we send 'organizer' and Drive rejects it,
        // the user sees the error instead of a silently weaker permission being granted.
        const api = makeEnforceApi({
            addPermission: vi.fn(async () => {
                // Simulate Drive rejecting the role (400 = non-transient, permanent failure)
                throw Object.assign(new Error('organizer only valid on Shared Drive root'), { code: 400 });
            }),
            listPermissions: vi.fn()
                .mockResolvedValueOnce([])   // reset: nothing to remove
                .mockResolvedValueOnce([]),  // verify: permission missing (add failed)
        });

        const result = await enforceFolder(
            'test-subfolder',
            'Project Delivery/Quality Control',
            { groups: [{ email: 'team-a@example.com', role: 'organizer' }], users: [], limitedAccess: false },
            new Map(),
            DRIVE_ID,
            api
        );

        // Error must be in addErrors — not swallowed
        expect(result.apply.addErrors.length).toBeGreaterThan(0);
        // Must be classified as persistent (code 400 is not transient)
        expect(result.apply.addErrors[0].persistent).toBe(true);
        // Verify phase must detect missing (since add failed)
        const missing = result.verify.comparisons.filter(c => c.status === 'MISSING');
        expect(missing.length).toBeGreaterThan(0);
        // Old silent downgrade behavior would have: addErrors=[], added=1, verify=EXACT_MATCH
        // Strict behavior: addErrors[0].persistent=true, added=0, verify has MISSING
        expect(result.apply.added).toBe(0);
    });

});
