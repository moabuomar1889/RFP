import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/requests
 * List project requests (admin only)
 * Query params: status (pending|approved|rejected|all)
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    try {
        const supabase = getSupabaseAdmin();

        let query = supabase
            .schema('rfp')
            .from('project_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ requests: data });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
}

/**
 * POST /api/requests
 * Create a new project request
 * Body: { requestType: 'new_project' | 'upgrade_to_pd', projectName: string, projectId?: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { requestType, projectName, projectId } = body;

        // Get session from cookie
        const session = request.cookies.get('rfp_session');
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const requestedBy = session.value;

        const supabase = getSupabaseAdmin();

        // Validate request type
        if (!['new_project', 'upgrade_to_pd'].includes(requestType)) {
            return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
        }

        // For new projects, generate PR number
        let prNumber = null;
        if (requestType === 'new_project') {
            if (!projectName) {
                return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
            }

            // Get next PR number using database function
            const { data: prData, error: prError } = await supabase
                .schema('rfp')
                .rpc('get_next_pr_number');

            if (prError) {
                // Fallback: query manually
                const { data: projects } = await supabase
                    .schema('rfp')
                    .from('projects')
                    .select('pr_number')
                    .order('pr_number', { ascending: false })
                    .limit(1);

                const lastNum = projects?.[0]?.pr_number
                    ? parseInt(projects[0].pr_number.replace(/\D/g, ''))
                    : 0;
                prNumber = `PR-${String(lastNum + 1).padStart(3, '0')}`;
            } else {
                prNumber = prData;
            }
        }

        // For upgrade requests, validate project exists and is in bidding phase
        if (requestType === 'upgrade_to_pd') {
            if (!projectId) {
                return NextResponse.json({ error: 'Project ID is required for upgrade' }, { status: 400 });
            }

            const { data: project, error: projectError } = await supabase
                .schema('rfp')
                .from('projects')
                .select('id, pr_number, name, phase')
                .eq('id', projectId)
                .single();

            if (projectError || !project) {
                return NextResponse.json({ error: 'Project not found' }, { status: 404 });
            }

            if (project.phase === 'execution') {
                return NextResponse.json({ error: 'Project is already in execution phase' }, { status: 400 });
            }

            // Check for existing pending upgrade request
            const { data: existingRequest } = await supabase
                .schema('rfp')
                .from('project_requests')
                .select('id')
                .eq('project_id', projectId)
                .eq('request_type', 'upgrade_to_pd')
                .eq('status', 'pending')
                .single();

            if (existingRequest) {
                return NextResponse.json({ error: 'Upgrade request already pending' }, { status: 400 });
            }
        }

        // Create the request
        const { data: newRequest, error: insertError } = await supabase
            .schema('rfp')
            .from('project_requests')
            .insert({
                request_type: requestType,
                project_name: projectName,
                pr_number: prNumber,
                project_id: projectId || null,
                requested_by: requestedBy,
            })
            .select()
            .single();

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // Log audit
        await supabase
            .schema('rfp')
            .from('audit_log')
            .insert({
                action: requestType === 'new_project' ? 'project_request_created' : 'upgrade_request_created',
                entity_type: 'project_request',
                entity_id: newRequest.id,
                details: { projectName, prNumber, requestType },
                performed_by: requestedBy,
            });

        return NextResponse.json({
            success: true,
            request: newRequest,
            message: `Request submitted. PR Number: ${prNumber || 'N/A'}`
        });
    } catch (error) {
        console.error('Create request error:', error);
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }
}
