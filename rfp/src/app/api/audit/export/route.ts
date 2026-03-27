import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDriveClient } from '@/server/google-drive';
import {
    buildNodeMap,
    buildEffectivePermissionsMap,
    comparePermissions as sharedComparePermissions,
    computeDesiredEffectivePolicy,
    classifyInheritedPermission,
    isFullyCompliant,
    type PermComparison,
} from '@/server/audit-helpers';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EnhancedPermission {
    permissionId: string;
    type: string;
    identifier: string; // email, domain, or "anyone"
    role: string;
    view?: string;
    displayName?: string;
    isInherited: boolean;
    inheritedFrom?: string;
    deleted: boolean;
    allowFileDiscovery?: boolean;
}

interface ExportFolder {
    project_code: string;
    project_name: string;
    folder_path: string;
    drive_folder_id: string;
    drive_url: string;
    expected_limited_access: boolean;
    actual_limited_access: boolean | null;
    limited_access_mismatch: boolean;
    status: string;
    expected_count: number;
    actual_total_count: number;
    actual_direct_count: number;
    actual_inherited_count: number;
    missing_count: number;
    stronger_count: number;
    weaker_count: number;
    extra_count: number;
    non_removable_count: number;
    domain_count: number;
    anyone_count: number;
    protected_present: boolean;
    protected_list: string;
    missing_list: string;
    stronger_list: string;
    weaker_list: string;
    extra_list: string;
    non_removable_list: string;
    domain_list: string;
    anyone_list: string;
    recommended_action: string;
    expected_principals: Array<{ type: string; identifier: string; role: string }>;
    actual_permissions: EnhancedPermission[];
}

// NOTE: The legacy path-based buildPermissionsMap is no longer the primary source of truth.
// It is kept here only as a diagnostic/display aid.
// The PRIMARY lookup is now: folder_index.template_node_id → nodeMap.get(nodeId)

// Enhanced permissions fetcher with all required fields
async function getEnhancedPermissions(folderId: string): Promise<{
    permissions: EnhancedPermission[];
    actualLimitedAccess: boolean | null;
    driveId: string | null;  // Live Shared Drive ID from Google metadata — primary source for NON_REMOVABLE classification
}> {
    const drive = await getDriveClient();

    // Get folder metadata to check inheritedPermissionsDisabled (Limited Access status)
    // and driveId (needed for NON_REMOVABLE_MEMBERSHIP classification)
    let actualLimitedAccess: boolean | null = null;
    let driveId: string | null = null;
    try {
        const folderRes = await drive.files.get({
            fileId: folderId,
            supportsAllDrives: true,
            fields: 'id,name,inheritedPermissionsDisabled,parents,driveId'
        });

        // inheritedPermissionsDisabled is a direct field on the file resource
        // When true, it means Limited Access is enabled (inheritance blocked)
        actualLimitedAccess = folderRes.data.inheritedPermissionsDisabled ?? false;
        // driveId identifies the Shared Drive this folder belongs to.
        // Used by classifyInheritedPermission to distinguish NON_REMOVABLE_MEMBERSHIP
        // (inherited from Shared Drive root, cannot be removed) from EXTRA (direct, removable).
        driveId = (folderRes.data as any).driveId ?? null;
    } catch (err) {
        console.error(`Failed to get folder metadata for ${folderId}:`, err);
        // CRITICAL: Keep null to indicate unreadable, not false
        // This triggers status="unknown" and recommendedAction="verify_drive_truth"
        actualLimitedAccess = null;
        driveId = null;
    }

    // Get permissions with all fields
    const response = await drive.permissions.list({
        fileId: folderId,
        supportsAllDrives: true,
        fields: 'permissions(id,type,role,emailAddress,domain,displayName,deleted,allowFileDiscovery,view,permissionDetails)',
    });

    const permissions = (response.data.permissions || []).map((p: any) => {
        const isInherited = p.inherited === true || p.permissionDetails?.some((d: any) => d.inherited) || false;
        const inheritedFrom = p.inheritedFrom || p.permissionDetails?.find((d: any) => d.inherited)?.inheritedFrom;

        let identifier = '';
        if (p.emailAddress) identifier = p.emailAddress.toLowerCase();
        else if (p.domain) identifier = p.domain.toLowerCase();
        else if (p.type === 'anyone') identifier = 'anyone';

        return {
            permissionId: p.id,
            type: p.type,
            identifier,
            role: p.role,
            view: p.view,
            displayName: p.displayName,
            isInherited,
            inheritedFrom,
            deleted: p.deleted || false,
            allowFileDiscovery: p.allowFileDiscovery
        };
    });

    return { permissions, actualLimitedAccess, driveId };
}

// ─── Strict Export Analysis (shared model) ───────────────────────────────────
// Replaces local normalizeRole + analyzeFolder with shared comparePermissions.
// Export, audit, and enforce now all classify using identical semantics.

interface ExportAnalysis {
    status: 'exact_match' | 'compliant_inheritance_allowed' | 'non_compliant';
    // Buckets — strict names matching shared PermComparisonStatus
    missing: string[];              // MISSING
    strongerThanTemplate: string[]; // STRONGER_THAN_TEMPLATE
    weakerThanTemplate: string[];   // WEAKER_THAN_TEMPLATE
    extra: string[];                // EXTRA (removable principals not in template)
    nonRemovable: string[];         // NON_REMOVABLE_MEMBERSHIP (Shared Drive memberships)
    metadataOnly: string[];         // LIMITED_ACCESS_METADATA_ONLY
    limitedAccessMismatch: boolean; // LIMITED_ACCESS_MISMATCH
    domains: string[];
    anyone: string[];
    protected: string[];
    counts: {
        expected: number;
        actualTotal: number;
        actualDirect: number;
        actualInherited: number;
        domain: number;
        anyone: number;
    };
    recommendedAction: string;
    // Raw comparisons for JSON export
    comparisons: PermComparison[];
}

function analyzeFolder(
    expected: { groups: any[]; users: any[]; limitedAccess: boolean; overrides?: any },
    actual: EnhancedPermission[],
    actualLimitedAccess: boolean | null,
    driveId?: string,
): ExportAnalysis {
    const protectedEmails = ['mo.abuomar@dtgsa.com'];

    // Convert EnhancedPermission → ActualPermission (shared type)
    const actualForShared = actual
        .filter(p => !p.deleted)
        .map(p => ({
            emailAddress: p.identifier,
            role: p.role,
            type: p.type,
            id: p.permissionId,
            view: p.view,
            inherited: p.isInherited,
            permissionDetails: p.isInherited
                ? [{ inherited: true, inheritedFrom: p.inheritedFrom }]
                : [{ inherited: false }],
        }));

    // Run shared strict comparison
    const desired = computeDesiredEffectivePolicy(expected);
    const comparisons = sharedComparePermissions(
        desired,
        actualForShared,
        expected.limitedAccess,
        actualLimitedAccess,
        driveId,
    );

    // Bucket the results
    const missing: string[] = [];
    const strongerThanTemplate: string[] = [];
    const weakerThanTemplate: string[] = [];
    const extra: string[] = [];
    const nonRemovable: string[] = [];
    const metadataOnly: string[] = [];
    let limitedAccessMismatch = false;
    const protectedFound: string[] = [];

    for (const c of comparisons) {
        if (c.status === 'LIMITED_ACCESS_MISMATCH') {
            limitedAccessMismatch = true;
            continue;
        }
        if (!c.principal || c.principal === '__limited_access__') continue;
        if (protectedEmails.includes(c.principal)) {
            const act = actual.find(p => p.identifier === c.principal);
            if (act) protectedFound.push(`${c.principal}(${act.role})`);
            continue;
        }

        switch (c.status) {
            case 'MISSING':
                missing.push(`${c.principal}(${c.expectedRole ?? '?'})`);
                break;
            case 'STRONGER_THAN_TEMPLATE':
                strongerThanTemplate.push(`${c.principal}(expected=${c.expectedRole},actual=${c.actualRole})`);
                break;
            case 'WEAKER_THAN_TEMPLATE':
                weakerThanTemplate.push(`${c.principal}(expected=${c.expectedRole},actual=${c.actualRole})`);
                break;
            case 'EXTRA':
                extra.push(`${c.principal}(${c.actualRole ?? '?'})`);
                break;
            case 'NON_REMOVABLE_MEMBERSHIP':
                nonRemovable.push(`${c.principal}(${c.actualRole ?? '?'})`);
                break;
            case 'LIMITED_ACCESS_METADATA_ONLY':
                metadataOnly.push(`${c.principal}(${c.actualRole ?? '?'})`);
                break;
            // EXACT_MATCH: nothing to report
        }
    }

    // Count breakdown using classifyInheritedPermission for direct/inherited split
    const directPerms = actualForShared.filter(p => {
        const cls = classifyInheritedPermission(p, driveId);
        return cls === 'NOT_INHERITED' && !protectedEmails.includes(p.emailAddress ?? '');
    });
    const inheritedPerms = actualForShared.filter(p => {
        const cls = classifyInheritedPermission(p, driveId);
        return cls !== 'NOT_INHERITED' && !protectedEmails.includes(p.emailAddress ?? '');
    });
    const domainPerms = actual.filter(p => p.type === 'domain' && !p.deleted);
    const anyonePerms = actual.filter(p => p.type === 'anyone' && !p.deleted);

    // Status from shared comparisons
    const isNonCompliant = missing.length > 0 || strongerThanTemplate.length > 0 ||
        weakerThanTemplate.length > 0 || extra.length > 0 || limitedAccessMismatch;
    const hasInheritance = inheritedPerms.length > 0 || domainPerms.length > 0;

    let status: ExportAnalysis['status'];
    if (isNonCompliant) {
        status = 'non_compliant';
    } else if (!expected.limitedAccess && hasInheritance) {
        status = 'compliant_inheritance_allowed';
    } else {
        status = 'exact_match';
    }

    // Recommended action
    let recommendedAction = 'none';
    if (actualLimitedAccess === null) {
        recommendedAction = 'verify_drive_truth';
    } else if (limitedAccessMismatch && expected.limitedAccess && !actualLimitedAccess) {
        recommendedAction = 'enable_limited_access';
    } else if (limitedAccessMismatch && !expected.limitedAccess && actualLimitedAccess) {
        recommendedAction = 'fix_template';
    } else if (missing.length > 0 || extra.length > 0 || weakerThanTemplate.length > 0 || strongerThanTemplate.length > 0) {
        recommendedAction = 'reset_to_template';
    }

    return {
        status,
        missing,
        strongerThanTemplate,
        weakerThanTemplate,
        extra,
        nonRemovable,
        metadataOnly,
        limitedAccessMismatch,
        domains: domainPerms.map(p => `${p.identifier}(${p.role})`),
        anyone: anyonePerms.map(p => `${p.identifier}(${p.role})`),
        protected: protectedFound,
        counts: {
            expected: desired.filter(p => p.overrideAction !== 'removed').length,
            actualTotal: actualForShared.filter(p => !protectedEmails.includes(p.emailAddress ?? '')).length,
            actualDirect: directPerms.length,
            actualInherited: inheritedPerms.length,
            domain: domainPerms.length,
            anyone: anyonePerms.length,
        },
        recommendedAction,
        comparisons,
    };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const format = searchParams.get('format') || 'csv'; // csv or json

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }

        // Get project
        const { data: projectsData } = await supabaseAdmin.rpc('get_projects', {
            p_status: null,
            p_phase: null
        });
        const project = projectsData?.find((p: any) => p.id === projectId);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Get template
        const { data: templateData } = await supabaseAdmin.rpc('get_active_template');
        const template = Array.isArray(templateData) ? templateData[0] : templateData;
        if (!template?.template_json) {
            return NextResponse.json({ error: 'No template' }, { status: 404 });
        }

        const templateNodes = Array.isArray(template.template_json)
            ? template.template_json
            : template.template_json.template || [];

        // PRIMARY: Build nodeMap keyed by stable node_id UUID
        const nodeMap = new Map<string, any>();
        // FALLBACK: Build path-based map for folders not yet stamped
        const pathFallbackMap: Record<string, any> = {};
        for (const topNode of templateNodes) {
            const name = topNode.name || topNode.text || '';
            if (!name) continue;
            // Primary: collect all node_id → permissions
            const phaseNodeMap = buildNodeMap([topNode]);
            for (const [nid, perms] of phaseNodeMap) nodeMap.set(nid, perms);
            // Fallback: collect path → permissions
            const phasePerms = buildEffectivePermissionsMap([topNode]);
            Object.assign(pathFallbackMap, phasePerms);
        }

        // Get folders
        const { data: folders } = await supabaseAdmin.rpc('list_project_folders', {
            p_project_id: projectId
        });

        if (!folders || folders.length === 0) {
            if (format === 'json') {
                return NextResponse.json({
                    export_version: 'v3',
                    exported_at: new Date().toISOString(),
                    projects: [{
                        project_code: project.pr_number,
                        project_name: project.name,
                        folders: [],
                        unmapped: [],
                        orphaned: [],
                        summary: { totalFolders: 0, mapped: 0, unmapped: 0, orphaned: 0 }
                    }]
                });
            }
            return NextResponse.json({ error: 'No folders' }, { status: 404 });
        }

        const exportData: ExportFolder[] = [];
        const unmappedFolders: any[] = [];
        const orphanedFolders: any[] = [];

        for (const folder of folders) {
            const templatePath = folder.normalized_template_path || folder.template_path;

            // ── Check for unmapped ──
            if (!folder.template_node_id) {
                unmappedFolders.push({
                    drive_folder_id: folder.drive_folder_id,
                    path: templatePath,
                    status: 'unmapped',
                    hint: 'No template_node_id binding. Use /folder-mapping UI or run stamp-node-ids + rebuild index.',
                });
                continue; // skip enforcement/audit for unmanaged folders
            }

            // ── Primary lookup by node_id ──
            let expectedPerms = nodeMap.get(folder.template_node_id);

            // ── Orphaned check: node_id exists in index but not in current template ──
            if (!expectedPerms) {
                orphanedFolders.push({
                    drive_folder_id: folder.drive_folder_id,
                    path: templatePath,
                    template_node_id: folder.template_node_id,
                    status: 'orphaned_mapping',
                    hint: 'template_node_id found in folder_index but not in active template. Template may have changed.',
                });

                // Fallback: try path-based resolution (shows best-effort data)
                const normPath = templatePath.replace(/^(Bidding|Project Delivery)\//, '');
                expectedPerms = pathFallbackMap[templatePath] || pathFallbackMap[normPath];
                if (!expectedPerms) continue;
            }

            const { permissions, actualLimitedAccess, driveId: liveDriveId } = await getEnhancedPermissions(folder.drive_folder_id);
            // PRIMARY: use live driveId from Google metadata for correct NON_REMOVABLE_MEMBERSHIP classification.
            // If the live fetch failed (liveDriveId=null), fall back to the DB field as a best-effort heuristic.
            // The DB field (shared_drive_id) may be stale — this fallback is documented intentionally.
            const driveId = liveDriveId ?? folder.shared_drive_id ?? undefined;
            const analysis = analyzeFolder(expectedPerms, permissions, actualLimitedAccess, driveId);


            const expectedPrincipals = [
                ...expectedPerms.groups.map((g: any) => ({ type: 'group', identifier: g.email.toLowerCase(), role: g.role || 'reader' })),
                ...expectedPerms.users.map((u: any) => ({ type: 'user', identifier: u.email.toLowerCase(), role: u.role || 'reader' }))
            ];

            exportData.push({
                project_code: project.pr_number,
                project_name: project.name,
                folder_path: templatePath,
                drive_folder_id: folder.drive_folder_id,
                drive_url: `https://drive.google.com/drive/folders/${folder.drive_folder_id}`,
                expected_limited_access: expectedPerms.limitedAccess,
                actual_limited_access: actualLimitedAccess,
                limited_access_mismatch: analysis.limitedAccessMismatch,
                status: analysis.status,
                expected_count: analysis.counts.expected,
                actual_total_count: analysis.counts.actualTotal,
                actual_direct_count: analysis.counts.actualDirect,
                actual_inherited_count: analysis.counts.actualInherited,
                missing_count: analysis.missing.length,
                stronger_count: analysis.strongerThanTemplate.length,
                weaker_count: analysis.weakerThanTemplate.length,
                extra_count: analysis.extra.length,
                non_removable_count: analysis.nonRemovable.length,
                domain_count: analysis.counts.domain,
                anyone_count: analysis.counts.anyone,
                protected_present: analysis.protected.length > 0,
                protected_list: analysis.protected.join('; '),
                missing_list: analysis.missing.join('; '),
                stronger_list: analysis.strongerThanTemplate.join('; '),
                weaker_list: analysis.weakerThanTemplate.join('; '),
                extra_list: analysis.extra.join('; '),
                non_removable_list: analysis.nonRemovable.join('; '),
                domain_list: analysis.domains.join('; '),
                anyone_list: analysis.anyone.join('; '),
                recommended_action: analysis.recommendedAction,
                expected_principals: expectedPrincipals,
                actual_permissions: permissions
            });

        }

        if (format === 'json') {
            // JSON v3 export — uses node_id as primary identity
            const jsonExport = {
                export_version: 'v3',
                exported_at: new Date().toISOString(),
                identity_model: 'template_node_id (UUID) is the primary binding key, not path text',
                policy: {
                    protected_principals: ['mo.abuomar@dtgsa.com'],
                    inheritance_rules: 'limitedAccess=true blocks inheritance; limitedAccess=false allows inheritance'
                },
                projects: [{
                    project_code: project.pr_number,
                    project_name: project.name,
                    folders: exportData.map(f => ({
                        folder_path: f.folder_path,
                        drive_folder_id: f.drive_folder_id,
                        drive_url: f.drive_url,
                        expected: {
                            limitedAccess: f.expected_limited_access,
                            principals: f.expected_principals
                        },
                        actual: {
                            limitedAccess: f.actual_limited_access,
                            permissions: f.actual_permissions,
                            counts: {
                                total: f.actual_total_count,
                                direct: f.actual_direct_count,
                                inherited: f.actual_inherited_count,
                                domain: f.domain_count,
                                anyone: f.anyone_count
                            }
                        },
                        diff: {
                            status: f.status,
                            limited_access_mismatch: f.limited_access_mismatch,
                            missing: f.missing_list.split('; ').filter(Boolean),
                            stronger_than_template: f.stronger_list.split('; ').filter(Boolean),
                            weaker_than_template: f.weaker_list.split('; ').filter(Boolean),
                            extra: f.extra_list.split('; ').filter(Boolean),
                            non_removable: f.non_removable_list.split('; ').filter(Boolean),
                        },
                        recommendedAction: f.recommended_action,
                        notes: []
                    })),
                    summary: {
                        totalFolders: exportData.length,
                        exactMatch: exportData.filter(f => f.status === 'exact_match').length,
                        compliant: exportData.filter(f => f.status === 'compliant_inheritance_allowed').length,
                        nonCompliant: exportData.filter(f => f.status === 'non_compliant').length,
                        unmapped: unmappedFolders.length,
                        orphaned: orphanedFolders.length,
                    },
                    unmapped: unmappedFolders,     // drive folders with no template binding
                    orphaned: orphanedFolders,     // stale bindings pointing to removed template nodes
                }],
                summary: {
                    totalProjects: 1,
                    totalFolders: exportData.length,
                    totalUnmapped: unmappedFolders.length,
                    totalOrphaned: orphanedFolders.length,
                }

            };

            return NextResponse.json(jsonExport);
        } else {
            // CSV v2 export
            const headers = [
                'export_version', 'exported_at', 'project_code', 'project_name',
                'folder_path', 'drive_folder_id', 'drive_url',
                'expected_limited_access', 'actual_limited_access', 'limited_access_mismatch', 'status',
                'expected_count', 'actual_total_count', 'actual_direct_count', 'actual_inherited_count',
                'missing_count', 'stronger_count', 'weaker_count', 'extra_count', 'non_removable_count',
                'domain_count', 'anyone_count',
                'protected_present', 'protected_list',
                'missing_list', 'stronger_list', 'weaker_list', 'extra_list', 'non_removable_list',
                'domain_list', 'anyone_list',
                'recommended_action'
            ];

            const rows = exportData.map(f => [
                'v3',
                new Date().toISOString(),
                f.project_code,
                f.project_name,
                f.folder_path,
                f.drive_folder_id,
                f.drive_url,
                f.expected_limited_access.toString(),
                String(f.actual_limited_access ?? 'null'),
                f.limited_access_mismatch.toString(),
                f.status,
                f.expected_count.toString(),
                f.actual_total_count.toString(),
                f.actual_direct_count.toString(),
                f.actual_inherited_count.toString(),
                f.missing_count.toString(),
                f.stronger_count.toString(),
                f.weaker_count.toString(),
                f.extra_count.toString(),
                f.non_removable_count.toString(),
                f.domain_count.toString(),
                f.anyone_count.toString(),
                f.protected_present.toString(),
                f.protected_list,
                f.missing_list,
                f.stronger_list,
                f.weaker_list,
                f.extra_list,
                f.non_removable_list,
                f.domain_list,
                f.anyone_list,
                f.recommended_action
            ]);

            const csv = [headers, ...rows].map(row =>
                row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
            ).join('\n');

            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="audit_export_v3_${project.pr_number}_${new Date().toISOString().split('T')[0]}.csv"`
                }
            });

        }
    } catch (error: any) {
        console.error('Export error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
