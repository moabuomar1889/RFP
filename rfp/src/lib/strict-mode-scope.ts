/**
 * STRICT MODE SCOPE CONFIRMATION
 * ===============================
 * 
 * This file documents the EXACT scope of Strict Mode enforcement.
 * 
 * WHAT STRICT MODE DOES:
 * ----------------------
 * ✅ Reads folder/file permissions (permissions.list)
 * ✅ Adds folder/file permissions (permissions.create)
 * ✅ Removes folder/file permissions (permissions.delete)
 * ✅ Detects unauthorized permission changes on folders/files
 * ✅ Reverts unauthorized permission changes on folders/files
 * 
 * WHAT STRICT MODE DOES NOT DO:
 * -----------------------------
 * ❌ Does NOT modify Shared Drive membership/roles
 * ❌ Does NOT call drives.permissions API
 * ❌ Does NOT add/remove members from the Shared Drive root
 * ❌ Does NOT change who can access the Shared Drive itself
 * 
 * API CALLS USED:
 * ---------------
 * - drive.permissions.list   (on folders/files only)
 * - drive.permissions.create (on folders/files only)
 * - drive.permissions.delete (on folders/files only)
 * 
 * PROTECTED PRINCIPALS:
 * ---------------------
 * - Admin email (mo.abuomar@dtgsa.com) - NEVER removed
 * - Admin groups (admins@dtgsa.com) - NEVER removed
 * - Configurable list in /settings
 * 
 * SAFE TEST MODE:
 * ---------------
 * When safe_test_mode is enabled:
 * - Only ONE project can be selected for operations
 * - "Apply to All Projects" is disabled
 * - "Enforce on All" is disabled
 * - Must be explicitly disabled after testing
 */

export const STRICT_MODE_SCOPE = {
    // What we modify
    modifies: {
        folderPermissions: true,
        filePermissions: true,
    },

    // What we DO NOT modify
    doesNotModify: {
        sharedDriveMembership: true,
        sharedDriveRoles: true,
        driveSettings: true,
    },

    // API endpoints used
    apisUsed: [
        'drive.permissions.list',
        'drive.permissions.create',
        'drive.permissions.delete',
    ],

    // API endpoints NOT used
    apisNotUsed: [
        'drive.drives.update',
        'drive.drives.permissions',
        'admin.members.insert',
        'admin.members.delete',
    ],
};

export const SAFE_TEST_MODE = {
    // Default to enabled for safety
    defaultEnabled: true,

    // Restrictions when enabled
    restrictions: {
        maxProjectsPerOperation: 1,
        allowApplyToAll: false,
        allowEnforceAll: false,
        allowBulkSync: false,
    },

    // How to disable (requires explicit action)
    disableRequirements: [
        'Run successful test on 1 project',
        'Verify audit log shows expected behavior',
        'Admin approval in settings',
    ],
};
