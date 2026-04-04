import { APP_CONFIG } from '@/lib/config';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getDriveClient } from '@/server/google-drive';

const DEFAULT_ALLOWED_DOMAIN = 'dtgsa.com';
const PROJECTS_FOLDER_NAME = 'Projects';

function normalizeEmail(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase();
}

function normalizeDomain(value: string | null | undefined): string {
    return (value || '').replace(/^@/, '').trim().toLowerCase();
}

function parseSettingObject(raw: unknown): Record<string, unknown> | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

export function parseSharedDriveVisibilityGroups(raw: unknown): string[] {
    if (!raw) return [];

    let emails: unknown = raw;
    if (typeof raw === 'string') {
        try {
            emails = JSON.parse(raw);
        } catch {
            emails = raw.split(',').map((part) => part.trim()).filter(Boolean);
        }
    }

    if (Array.isArray(emails)) {
        return Array.from(
            new Set(
                emails
                    .map((value) => normalizeEmail(String(value)))
                    .filter(Boolean)
            )
        );
    }

    const asObject = parseSettingObject(emails);
    const objectEmails = asObject?.emails;
    if (Array.isArray(objectEmails)) {
        return Array.from(
            new Set(
                objectEmails
                    .map((value) => normalizeEmail(String(value)))
                    .filter(Boolean)
            )
        );
    }

    return [];
}

function collectTemplateGroupEmails(nodes: any[] | undefined, set: Set<string>) {
    if (!Array.isArray(nodes)) return;

    for (const node of nodes) {
        for (const group of node?.groups || []) {
            const email = normalizeEmail(group?.email || group?.name);
            if (email) set.add(email);
        }

        collectTemplateGroupEmails(node?.nodes || node?.children || node?.folders, set);
    }
}

export function extractTemplateGroupEmails(templateJson: unknown): string[] {
    const emails = new Set<string>();

    if (Array.isArray(templateJson)) {
        collectTemplateGroupEmails(templateJson, emails);
        return Array.from(emails).sort();
    }

    if (!templateJson || typeof templateJson !== 'object') {
        return [];
    }

    const template = templateJson as Record<string, any>;

    if (template.phases?.bidding) {
        collectTemplateGroupEmails(
            template.phases.bidding.folders || template.phases.bidding.nodes || template.phases.bidding.children,
            emails
        );
    }

    if (template.phases?.project_delivery) {
        collectTemplateGroupEmails(
            template.phases.project_delivery.folders || template.phases.project_delivery.nodes || template.phases.project_delivery.children,
            emails
        );
    }

    if (template.folders) {
        collectTemplateGroupEmails(template.folders, emails);
    }

    return Array.from(emails).sort();
}

async function getFallbackTemplateGroups(): Promise<string[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('get_active_template');
    if (error) {
        throw new Error(`Failed to load active template for shared drive sync: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return extractTemplateGroupEmails(row?.template_json);
}

async function getAllowedVisibilityDomain(): Promise<string> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.rpc('get_setting', { p_key: 'allowed_login_domain' });
    const parsed = parseSettingObject(data);
    const candidate =
        typeof parsed?.domain === 'string'
            ? parsed.domain
            : typeof data === 'string'
                ? data
                : null;

    return normalizeDomain(candidate) || DEFAULT_ALLOWED_DOMAIN;
}

async function resolveProjectsFolderId(
    drive: Awaited<ReturnType<typeof getDriveClient>>
): Promise<string | null> {
    const configuredId = (APP_CONFIG.projectsFolderId || '').trim();
    if (configuredId && configuredId !== APP_CONFIG.sharedDriveId) {
        return configuredId;
    }

    const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${PROJECTS_FOLDER_NAME}' and trashed = false`;

    try {
        const response = await drive.files.list({
            q: query,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            driveId: APP_CONFIG.sharedDriveId,
            corpora: 'drive',
            fields: 'files(id,name,parents)',
            pageSize: 10,
        });

        return response.data.files?.[0]?.id || null;
    } catch {
        const fallback = await drive.files.list({
            q: query,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            corpora: 'allDrives',
            fields: 'files(id,name,parents)',
            pageSize: 10,
        });

        return fallback.data.files?.[0]?.id || null;
    }
}

function hasDomainPermission(
    permissions: Array<{ type?: string | null; role?: string | null; domain?: string | null }>,
    domain: string
): boolean {
    return permissions.some((perm) =>
        perm.type === 'domain' &&
        normalizeDomain(perm.domain) === domain &&
        perm.role === 'reader'
    );
}

async function getTargetSharedDriveVisibilityUsers(
    targetGroups: string[],
    allowedDomain: string
): Promise<string[]> {
    if (targetGroups.length === 0) return [];

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .schema('rfp')
        .from('user_group_membership')
        .select('user_email, group_email')
        .in('group_email', targetGroups);

    if (error) {
        throw new Error(`Failed to load visibility users from memberships: ${error.message}`);
    }

    const users = new Set<string>();
    for (const row of data || []) {
        const email = normalizeEmail((row as any).user_email);
        if (email && email.endsWith(`@${allowedDomain}`)) {
            users.add(email);
        }
    }

    return Array.from(users).sort();
}

async function ensureDomainReaderPermission(
    drive: Awaited<ReturnType<typeof getDriveClient>>,
    fileId: string,
    domain: string,
    options: {
        useDomainAdminAccess?: boolean;
    } = {}
): Promise<boolean> {
    const permissionsRes = await drive.permissions.list({
        fileId,
        supportsAllDrives: true,
        ...(options.useDomainAdminAccess ? { useDomainAdminAccess: true } : {}),
        fields: 'permissions(id,type,role,domain)',
    });

    const permissions = permissionsRes.data.permissions || [];
    if (hasDomainPermission(permissions, domain)) {
        return false;
    }

    await drive.permissions.create({
        fileId,
        supportsAllDrives: true,
        ...(options.useDomainAdminAccess ? { useDomainAdminAccess: true } : {}),
        sendNotificationEmail: false,
        requestBody: {
            type: 'domain',
            role: 'reader',
            domain,
        },
        fields: 'id,type,role,domain',
    });

    return true;
}

export async function getTargetSharedDriveVisibilityGroups(): Promise<string[]> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.rpc('get_setting', { p_key: 'shared_drive_visibility_groups' });
    const configured = parseSharedDriveVisibilityGroups(data);
    if (configured.length > 0) {
        return configured;
    }
    return getFallbackTemplateGroups();
}

export interface SharedDriveVisibilitySyncResult {
    targetGroups: string[];
    targetUsers: string[];
    existingGroups: string[];
    existingUsers: string[];
    addedGroups: string[];
    addedUsers: string[];
    visibilityDomain: string;
    projectsFolderDomainAdded: boolean;
    projectsFolderId: string | null;
}

export async function syncSharedDriveVisibilityMembers(): Promise<SharedDriveVisibilitySyncResult> {
    const drive = await getDriveClient();
    const targetGroups = await getTargetSharedDriveVisibilityGroups();
    const visibilityDomain = await getAllowedVisibilityDomain();
    const targetUsers = await getTargetSharedDriveVisibilityUsers(targetGroups, visibilityDomain);

    if (!APP_CONFIG.sharedDriveId) {
        throw new Error('Shared Drive ID is not configured');
    }

    const permissionsRes = await drive.permissions.list({
        fileId: APP_CONFIG.sharedDriveId,
        supportsAllDrives: true,
        useDomainAdminAccess: true,
        fields: 'permissions(id,type,role,emailAddress,domain,displayName)',
    });

    const existingGroups = new Set(
        (permissionsRes.data.permissions || [])
            .filter((perm) => perm.type === 'group' && perm.emailAddress)
            .map((perm) => normalizeEmail(perm.emailAddress))
            .filter(Boolean)
    );
    const existingUsers = new Set(
        (permissionsRes.data.permissions || [])
            .filter((perm) => perm.type === 'user' && perm.emailAddress)
            .map((perm) => normalizeEmail(perm.emailAddress))
            .filter(Boolean)
    );

    const addedGroups: string[] = [];
    const addedUsers: string[] = [];

    for (const email of targetGroups) {
        if (existingGroups.has(email)) continue;

        await drive.permissions.create({
            fileId: APP_CONFIG.sharedDriveId,
            supportsAllDrives: true,
            useDomainAdminAccess: true,
            sendNotificationEmail: false,
            requestBody: {
                type: 'group',
                role: 'reader',
                emailAddress: email,
            },
            fields: 'id,emailAddress,role',
        });

        existingGroups.add(email);
        addedGroups.push(email);
    }

    // Google does not allow domain-sharing the root of a Shared Drive.
    // To make the drive itself appear reliably for company users, we sync
    // the resolved members of the visibility groups as direct reader members.
    for (const email of targetUsers) {
        if (existingUsers.has(email)) continue;

        await drive.permissions.create({
            fileId: APP_CONFIG.sharedDriveId,
            supportsAllDrives: true,
            useDomainAdminAccess: true,
            sendNotificationEmail: false,
            requestBody: {
                type: 'user',
                role: 'reader',
                emailAddress: email,
            },
            fields: 'id,emailAddress,role',
        });

        existingUsers.add(email);
        addedUsers.push(email);
    }

    const projectsFolderId = await resolveProjectsFolderId(drive);
    let projectsFolderDomainAdded = false;
    if (projectsFolderId) {
        projectsFolderDomainAdded = await ensureDomainReaderPermission(
            drive,
            projectsFolderId,
            visibilityDomain
        );
    }

    return {
        targetGroups,
        targetUsers,
        existingGroups: Array.from(existingGroups).sort(),
        existingUsers: Array.from(existingUsers).sort(),
        addedGroups,
        addedUsers,
        visibilityDomain,
        projectsFolderDomainAdded,
        projectsFolderId,
    };
}
