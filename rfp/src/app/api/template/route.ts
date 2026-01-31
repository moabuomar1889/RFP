import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/template
 * Get the active template
 */
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase.rpc('get_active_template');

        if (error) {
            throw error;
        }

        return NextResponse.json({
            success: true,
            template: data,
        });
    } catch (error) {
        console.error('Error fetching template:', error);
        return NextResponse.json(
            { error: 'Failed to fetch template' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/template
 * Save a new template version
 */
export async function POST(request: NextRequest) {
    try {
        const session = request.cookies.get('rfp_session');
        const createdBy = session?.value || 'admin';

        const body = await request.json();
        const { template_json } = body;

        if (!template_json) {
            return NextResponse.json({ error: 'template_json required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase.rpc('save_template', {
            p_template_json: template_json,
            p_created_by: createdBy,
        });

        if (error) {
            console.error('Error saving template:', error);
            throw error;
        }

        // data is the version number directly
        const version = data;

        return NextResponse.json({
            success: true,
            version: version,
        });
    } catch (error) {
        console.error('Error saving template:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to save template' },
            { status: 500 }
        );
    }
}
