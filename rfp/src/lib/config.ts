// Google OAuth and API configuration
export const GOOGLE_CONFIG = {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!,
    scopes: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/admin.directory.user.readonly',
        'https://www.googleapis.com/auth/admin.directory.group.readonly',
        'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
    ],
};

// Supabase configuration
export const SUPABASE_CONFIG = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};

// App configuration
export const APP_CONFIG = {
    sharedDriveId: process.env.SHARED_DRIVE_ID!,
    adminEmail: process.env.ADMIN_EMAIL || 'mo.abuomar@dtgsa.com',
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY!,
};

// Shared Drive roles mapping
export const DRIVE_ROLES = {
    ORGANIZER: 'organizer',
    FILE_ORGANIZER: 'fileOrganizer',
    WRITER: 'writer',
    COMMENTER: 'commenter',
    READER: 'reader',
} as const;

export type DriveRole = typeof DRIVE_ROLES[keyof typeof DRIVE_ROLES];

// Permission types
export const PERMISSION_TYPES = {
    USER: 'user',
    GROUP: 'group',
    DOMAIN: 'domain',
    ANYONE: 'anyone',
} as const;

export type PermissionType = typeof PERMISSION_TYPES[keyof typeof PERMISSION_TYPES];

// Project status
export const PROJECT_STATUS = {
    BIDDING: 'bidding',
    EXECUTION: 'execution',
    CLOSED: 'closed',
} as const;

export type ProjectStatus = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];

// Job types
export const JOB_TYPES = {
    TEMPLATE_SYNC_ALL: 'template_sync_all',
    TEMPLATE_SYNC_CHANGES: 'template_sync_changes',
    SYNC_PROJECT: 'sync_project',
    ENFORCE_PERMISSIONS: 'enforce_permissions',
    BUILD_FOLDER_INDEX: 'build_folder_index',
    RECONCILE_INDEX: 'reconcile_index',
} as const;

export type JobType = typeof JOB_TYPES[keyof typeof JOB_TYPES];

// Job status
export const JOB_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
} as const;

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];

// Task status
export const TASK_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

// Template change types
export const CHANGE_TYPES = {
    CREATE_FOLDER: 'create_folder',
    RENAME_FOLDER: 'rename_folder',
    DELETE_FOLDER: 'delete_folder',
    ADD_PERMISSION: 'add_permission',
    REMOVE_PERMISSION: 'remove_permission',
    CHANGE_ROLE: 'change_role',
    ENABLE_LIMITED_ACCESS: 'enable_limited_access',
    DISABLE_LIMITED_ACCESS: 'disable_limited_access',
} as const;

export type ChangeType = typeof CHANGE_TYPES[keyof typeof CHANGE_TYPES];

// Violation types  
export const VIOLATION_TYPES = {
    UNEXPECTED_USER: 'unexpected_user',
    UNEXPECTED_GROUP: 'unexpected_group',
    WRONG_ROLE: 'wrong_role',
    MISSING_PERMISSION: 'missing_permission',
} as const;

export type ViolationType = typeof VIOLATION_TYPES[keyof typeof VIOLATION_TYPES];
