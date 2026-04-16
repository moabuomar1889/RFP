import { APP_CONFIG } from '@/lib/config';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getDriveClient } from '@/server/google-drive';

const DEFAULT_ALLOWED_DOMAIN = 'dtgsa.com';
const PROJECTS_FOLDER_NAME = 'Projects';
const SHARED_DRIVE_ROLE_RANK: Record<SharedDriveRole, number> = {
    reader: 0,
    commenter: 1,
    writer: 2,
    fileOrganizer: 3,
    organizer: 4,
};

export type SharedDriveRole = 'reader' | 'commenter' | 'writer' | 'fileOrganizer' | 'organizer';
export type SharedDrivePrincipalType = 'group' | 'user';

export interface SharedDriveDesiredMember {
    type: SharedDrivePrincipalType;
    email: string;
    role: SharedDriveRole;
    sources: string[];
}

export interface SharedDriveActualMember {
    id: string;
    type: SharedDrivePrincipalType | 'domain' | 'anyone';
    email: string | null;
    domain?: string | null;
    displayName?: string | null;
    role: SharedDriveRole;
    deleted?: boolean | null;
}

export interface SharedDrivePermissionRow {
    key: string;
    type: SharedDrivePrincipalType | 'domain' | 'anyone';
    email: string | null;
    displayName?: string | null;
    actualRole: SharedDriveRole | null;
    desiredRole: SharedDriveRole | null;
    status: 'match' | 'missing' | 'weaker' | 'stronger' | 'unmanaged';
    sources: string[];
    permissionId?: string;
}

export interface SharedDrivePermissionState {
    driveId: string;
    driveName: string | null;
    desired: SharedDriveDesiredMember[];
    actual: SharedDriveActualMember[];
    rows: SharedDrivePermissionRow[];
    summary: {
        totalDesired: number;
        match: number;
        missing: number;
        weaker: number;
        stronger: number;
        unmanaged: number;
    };
}

interface TemplatePrincipalLike {
    email?: string | null;
    name?: string | null;
    role?: string | null;
}

interface TemplateNodeLike {
    groups?: TemplatePrincipalLike[];
    users?: TemplatePrincipalLike[];
    nodes?: TemplateNodeLike[];
    children?: TemplateNodeLike[];
    folders?: TemplateNodeLike[];
}

interface TemplatePhaseLike {
    folders?: TemplateNodeLike[];
    nodes?: TemplateNodeLike[];
    children?: TemplateNodeLike[];
}

interface TemplateRootLike {
    phases?: {
        bidding?: TemplatePhaseLike;
        project_delivery?: TemplatePhaseLike;
    };
    folders?: TemplateNodeLike[];
}

function normalizeEmail(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase();
}

function normalizeDomain(value: string | null | undefined): string {
    return (value || '').replace(/^@/, '').trim().toLowerCase();
}

function normalizeSharedDriveRole(value: string | null | undefined): SharedDriveRole {
    switch ((value || '').trim()) {
        case 'organizer':
            return 'organizer';
        case 'fileOrganizer':
        case 'contentManager':
            return 'fileOrganizer';
        case 'writer':
        case 'contributor':
            return 'writer';
        case 'commenter':
            return 'commenter';
        case 'reader':
        case 'viewer':
        default:
            return 'reader';
    }
}

export function sharedDriveRoleLabel(role: string | null | undefined): string {
    switch (normalizeSharedDriveRole(role)) {
        case 'organizer':
            return 'Manager';
        case 'fileOrganizer':
            return 'Content Manager';
        case 'writer':
            return 'Contributor';
        case 'commenter':
            return 'Commenter';
        case 'reader':
        default:
            return 'Viewer';
    }
}

export function compareSharedDriveRoles(actual: string | null | undefined, desired: string | null | undefined) {
    const actualRole = normalizeSharedDriveRole(actual);
    const desiredRole = normalizeSharedDriveRole(desired);
    const actualRank = SHARED_DRIVE_ROLE_RANK[actualRole];
    const desiredRank = SHARED_DRIVE_ROLE_RANK[desiredRole];
    if (actualRank === desiredRank) return 'match' as const;
    return actualRank < desiredRank ? 'weaker' as const : 'stronger' as const;
}

function normalizeTemplateSharedDriveRole(value: string | null | undefined): SharedDriveRole {
    // Legacy templates used organizer on folders. On Shared Drive membership that
    // would mean Manager, so we cap it to Content Manager for safety.
    if ((value || '').trim() === 'organizer') return 'fileOrganizer';
    return normalizeSharedDriveRole(value);
}

function maxSharedDriveRole(a: SharedDriveRole, b: SharedDriveRole): SharedDriveRole {
    return SHARED_DRIVE_ROLE_RANK[a] >= SHARED_DRIVE_ROLE_RANK[b] ? a : b;
}

function addDesiredMember(
    members: Map<string, SharedDriveDesiredMember>,
    type: SharedDrivePrincipalType,
    email: string | null | undefined,
    role: string | null | undefined,
    source: string
) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;

    const normalizedRole = normalizeTemplateSharedDriveRole(role);
    const key = `${type}:${normalizedEmail}`;
    const existing = members.get(key);
    if (existing) {
        existing.role = maxSharedDriveRole(existing.role, normalizedRole);
        if (!existing.sources.includes(source)) existing.sources.push(source);
        return;
    }

    members.set(key, { type, email: normalizedEmail, role: normalizedRole, sources: [source] });
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

function collectTemplateGroupEmails(nodes: TemplateNodeLike[] | undefined, set: Set<string>) {
    if (!Array.isArray(nodes)) return;

    for (const node of nodes) {
        for (const group of node?.groups || []) {
            const email = normalizeEmail(group?.email || group?.name);
            if (email) set.add(email);
        }

        collectTemplateGroupEmails(node?.nodes || node?.children || node?.folders, set);
    }
}

function collectTemplateSharedDriveMembers(
    nodes: TemplateNodeLike[] | undefined,
    members: Map<string, SharedDriveDesiredMember>
) {
    if (!Array.isArray(nodes)) return;

    for (const node of nodes) {
        for (const group of node?.groups || []) {
            addDesiredMember(members, 'group', group?.email || group?.name, group?.role || 'reader', 'template');
        }

        for (const user of node?.users || []) {
            addDesiredMember(members, 'user', user?.email || user?.name, user?.role || 'reader', 'template');
        }

        collectTemplateSharedDriveMembers(node?.nodes || node?.children || node?.folders, members);
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

    const template = templateJson as TemplateRootLike;

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

export function extractTemplateSharedDriveMembers(templateJson: unknown): SharedDriveDesiredMember[] {
    const members = new Map<string, SharedDriveDesiredMember>();

    if (Array.isArray(templateJson)) {
        collectTemplateSharedDriveMembers(templateJson, members);
        return Array.from(members.values()).sort((a, b) => a.email.localeCompare(b.email));
    }

    if (!templateJson || typeof templateJson !== 'object') {
        return [];
    }

    const template = templateJson as TemplateRootLike;

    if (template.phases?.bidding) {
        collectTemplateSharedDriveMembers(
            template.phases.bidding.folders || template.phases.bidding.nodes || template.phases.bidding.children,
            members
        );
    }

    if (template.phases?.project_delivery) {
        collectTemplateSharedDriveMembers(
            template.phases.project_delivery.folders || template.phases.project_delivery.nodes || template.phases.project_delivery.children,
            members
        );
    }

    if (template.folders) {
        collectTemplateSharedDriveMembers(template.folders, members);
    }

    return Array.from(members.values()).sort((a, b) => a.email.localeCompare(b.email));
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

async function getActiveTemplateSharedDriveMembers(): Promise<SharedDriveDesiredMember[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('get_active_template');
    if (error) {
        throw new Error(`Failed to load active template for shared drive permissions: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return extractTemplateSharedDriveMembers(row?.template_json);
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
        const email = normalizeEmail((row as { user_email?: string | null }).user_email);
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

async function buildDesiredSharedDriveMembers(): Promise<SharedDriveDesiredMember[]> {
    const visibilityDomain = await getAllowedVisibilityDomain();
    const visibilityGroups = await getTargetSharedDriveVisibilityGroups();
    const visibilityUsers = await getTargetSharedDriveVisibilityUsers(visibilityGroups, visibilityDomain);
    const templateMembers = await getActiveTemplateSharedDriveMembers();
    const members = new Map<string, SharedDriveDesiredMember>();

    for (const email of visibilityGroups) {
        addDesiredMember(members, 'group', email, 'reader', 'visibility');
    }

    for (const email of visibilityUsers) {
        addDesiredMember(members, 'user', email, 'reader', 'visibility');
    }

    for (const member of templateMembers) {
        addDesiredMember(members, member.type, member.email, member.role, 'template');
    }

    return Array.from(members.values()).sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.email.localeCompare(b.email);
    });
}

async function listSharedDriveActualMembers(
    drive: Awaited<ReturnType<typeof getDriveClient>>
): Promise<SharedDriveActualMember[]> {
    const permissionsRes = await drive.permissions.list({
        fileId: APP_CONFIG.sharedDriveId,
        supportsAllDrives: true,
        useDomainAdminAccess: true,
        fields: 'permissions(id,type,role,emailAddress,domain,displayName,deleted)',
        pageSize: 100,
    });

    return (permissionsRes.data.permissions || []).map((perm) => ({
        id: perm.id || '',
        type: (perm.type || 'user') as SharedDriveActualMember['type'],
        email: perm.emailAddress ? normalizeEmail(perm.emailAddress) : null,
        domain: perm.domain || null,
        displayName: perm.displayName || null,
        role: normalizeSharedDriveRole(perm.role),
        deleted: perm.deleted,
    }));
}

function memberKey(type: string, email: string | null, domain?: string | null): string {
    if (type === 'domain') return `domain:${normalizeDomain(domain || email || '')}`;
    return `${type}:${normalizeEmail(email || '')}`;
}

function buildSharedDriveRows(
    desired: SharedDriveDesiredMember[],
    actual: SharedDriveActualMember[]
): SharedDrivePermissionRow[] {
    const desiredByKey = new Map(desired.map((member) => [memberKey(member.type, member.email), member]));
    const actualByKey = new Map(
        actual
            .filter((member) => member.type === 'group' || member.type === 'user' || member.type === 'domain')
            .map((member) => [memberKey(member.type, member.email, member.domain), member])
    );
    const rows: SharedDrivePermissionRow[] = [];

    for (const member of desired) {
        const key = memberKey(member.type, member.email);
        const actualMember = actualByKey.get(key);
        const status = actualMember
            ? compareSharedDriveRoles(actualMember.role, member.role)
            : 'missing';

        rows.push({
            key,
            type: member.type,
            email: member.email,
            displayName: actualMember?.displayName || null,
            actualRole: actualMember?.role || null,
            desiredRole: member.role,
            status,
            sources: member.sources,
            permissionId: actualMember?.id,
        });
    }

    for (const member of actual) {
        const key = memberKey(member.type, member.email, member.domain);
        if (desiredByKey.has(key)) continue;
        rows.push({
            key,
            type: member.type,
            email: member.email || member.domain || null,
            displayName: member.displayName || null,
            actualRole: member.role,
            desiredRole: null,
            status: 'unmanaged',
            sources: [],
            permissionId: member.id,
        });
    }

    const statusOrder: Record<SharedDrivePermissionRow['status'], number> = {
        weaker: 0,
        missing: 1,
        stronger: 2,
        match: 3,
        unmanaged: 4,
    };

    return rows.sort((a, b) => {
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        return (a.email || '').localeCompare(b.email || '');
    });
}

function summarizeRows(rows: SharedDrivePermissionRow[]): SharedDrivePermissionState['summary'] {
    return rows.reduce(
        (summary, row) => {
            summary[row.status] += 1;
            if (row.desiredRole) summary.totalDesired += 1;
            return summary;
        },
        { totalDesired: 0, match: 0, missing: 0, weaker: 0, stronger: 0, unmanaged: 0 }
    );
}

export async function getSharedDrivePermissionState(): Promise<SharedDrivePermissionState> {
    if (!APP_CONFIG.sharedDriveId) {
        throw new Error('Shared Drive ID is not configured');
    }

    const drive = await getDriveClient();
    const [driveMeta, desired, actual] = await Promise.all([
        drive.drives.get({
            driveId: APP_CONFIG.sharedDriveId,
            useDomainAdminAccess: true,
            fields: 'id,name',
        }),
        buildDesiredSharedDriveMembers(),
        listSharedDriveActualMembers(drive),
    ]);
    const rows = buildSharedDriveRows(desired, actual);

    return {
        driveId: APP_CONFIG.sharedDriveId,
        driveName: driveMeta.data.name || null,
        desired,
        actual,
        rows,
        summary: summarizeRows(rows),
    };
}

async function upsertSharedDriveMemberRole(
    drive: Awaited<ReturnType<typeof getDriveClient>>,
    member: Pick<SharedDriveDesiredMember, 'type' | 'email' | 'role'>,
    options: { allowDowngrade: boolean } = { allowDowngrade: false }
): Promise<'added' | 'updated' | 'unchanged' | 'stronger_skipped'> {
    const role = normalizeSharedDriveRole(member.role);
    if (role === 'organizer') {
        throw new Error('Manager role must be assigned manually in Google Drive');
    }

    const actual = await listSharedDriveActualMembers(drive);
    const existing = actual.find(
        (item) => item.type === member.type && normalizeEmail(item.email) === normalizeEmail(member.email)
    );

    if (!existing) {
        await drive.permissions.create({
            fileId: APP_CONFIG.sharedDriveId,
            supportsAllDrives: true,
            useDomainAdminAccess: true,
            sendNotificationEmail: false,
            requestBody: {
                type: member.type,
                role,
                emailAddress: normalizeEmail(member.email),
            },
            fields: 'id,emailAddress,role',
        });
        return 'added';
    }

    const comparison = compareSharedDriveRoles(existing.role, role);
    if (comparison === 'match') return 'unchanged';
    if (comparison === 'stronger' && !options.allowDowngrade) return 'stronger_skipped';

    await drive.permissions.update({
        fileId: APP_CONFIG.sharedDriveId,
        permissionId: existing.id,
        supportsAllDrives: true,
        useDomainAdminAccess: true,
        requestBody: { role },
        fields: 'id,emailAddress,role',
    });
    return 'updated';
}

export async function setSharedDriveMemberRole(input: {
    type: SharedDrivePrincipalType;
    email: string;
    role: SharedDriveRole;
}) {
    if (!APP_CONFIG.sharedDriveId) {
        throw new Error('Shared Drive ID is not configured');
    }

    const email = normalizeEmail(input.email);
    if (!email) throw new Error('Email is required');
    if (input.type !== 'group' && input.type !== 'user') {
        throw new Error('Only group and user members can be edited here');
    }

    const drive = await getDriveClient();
    return upsertSharedDriveMemberRole(
        drive,
        { type: input.type, email, role: normalizeSharedDriveRole(input.role) },
        { allowDowngrade: true }
    );
}

export interface SharedDriveVisibilitySyncResult {
    targetGroups: string[];
    targetUsers: string[];
    existingGroups: string[];
    existingUsers: string[];
    addedGroups: string[];
    addedUsers: string[];
    updatedGroups: string[];
    updatedUsers: string[];
    skippedStrongerGroups: string[];
    skippedStrongerUsers: string[];
    visibilityDomain: string;
    projectsFolderDomainAdded: boolean;
    projectsFolderId: string | null;
}

export async function syncSharedDriveVisibilityMembers(): Promise<SharedDriveVisibilitySyncResult> {
    const drive = await getDriveClient();
    const visibilityDomain = await getAllowedVisibilityDomain();
    const desiredMembers = await buildDesiredSharedDriveMembers();

    if (!APP_CONFIG.sharedDriveId) {
        throw new Error('Shared Drive ID is not configured');
    }

    const addedGroups: string[] = [];
    const addedUsers: string[] = [];
    const updatedGroups: string[] = [];
    const updatedUsers: string[] = [];
    const skippedStrongerGroups: string[] = [];
    const skippedStrongerUsers: string[] = [];

    for (const member of desiredMembers) {
        const result = await upsertSharedDriveMemberRole(drive, member, { allowDowngrade: false });
        if (result === 'added') {
            if (member.type === 'group') addedGroups.push(member.email);
            else addedUsers.push(member.email);
        } else if (result === 'updated') {
            if (member.type === 'group') updatedGroups.push(member.email);
            else updatedUsers.push(member.email);
        } else if (result === 'stronger_skipped') {
            if (member.type === 'group') skippedStrongerGroups.push(member.email);
            else skippedStrongerUsers.push(member.email);
        }
    }

    const actualAfterSync = await listSharedDriveActualMembers(drive);
    const existingGroups = actualAfterSync
        .filter((member) => member.type === 'group' && member.email)
        .map((member) => member.email!)
        .sort();
    const existingUsers = actualAfterSync
        .filter((member) => member.type === 'user' && member.email)
        .map((member) => member.email!)
        .sort();

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
        targetGroups: desiredMembers.filter((member) => member.type === 'group').map((member) => member.email),
        targetUsers: desiredMembers.filter((member) => member.type === 'user').map((member) => member.email),
        existingGroups,
        existingUsers,
        addedGroups,
        addedUsers,
        updatedGroups,
        updatedUsers,
        skippedStrongerGroups,
        skippedStrongerUsers,
        visibilityDomain,
        projectsFolderDomainAdded,
        projectsFolderId,
    };
}
