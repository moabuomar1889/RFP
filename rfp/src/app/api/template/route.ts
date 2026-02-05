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
            console.error('Template RPC error:', error);
            throw error;
        }

        // RPC returns TABLE (array of rows), get first row
        const template = Array.isArray(data) ? data[0] : data;

        console.log('Template data:', template ? 'found' : 'not found');

        return NextResponse.json({
            success: true,
            template: template || null,
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
            console.error('Error details:', JSON.stringify(error, null, 2));
            return NextResponse.json(
                { success: false, error: error.message || 'Database error saving template' },
                { status: 500 }
            );
        }

        // data is the version number directly
        const version = data;

        return NextResponse.json({
            success: true,
            version: version,
        });
    } catch (error: any) {
        console.error('Error saving template:', error);
        console.error('Error stack:', error.stack);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to save template' },
            { status: 500 }
        );
    }
}
