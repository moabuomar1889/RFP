import { APP_CONFIG } from '@/lib/config';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getDriveClient } from '@/server/google-drive';

function normalizeEmail(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase();
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
    existingGroups: string[];
    addedGroups: string[];
}

export async function syncSharedDriveVisibilityMembers(): Promise<SharedDriveVisibilitySyncResult> {
    const drive = await getDriveClient();
    const targetGroups = await getTargetSharedDriveVisibilityGroups();

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

    const addedGroups: string[] = [];

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

    return {
        targetGroups,
        existingGroups: Array.from(existingGroups).sort(),
        addedGroups,
    };
}
