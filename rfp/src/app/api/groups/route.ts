import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncGroupsToDatabase } from '@/server/google-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/groups
 * Get all groups from database (cached from Google Workspace)
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();

        // Query from rfp schema
        const { data: groups, error } = await supabase
            .schema('rfp')
            .from('group_directory')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching groups:', error);
            return NextResponse.json({
                success: false,
                groups: [],
                error: `Database error: ${error.message}`,
            });
        }

        return NextResponse.json({
            success: true,
            groups: groups || [],
            count: groups?.length || 0,
        });
    } catch (error: any) {
        console.error('Groups API error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch groups',
            groups: [],
        }, { status: 500 });
    }
}

/**
 * POST /api/groups
 * Sync groups from Google Workspace to database
 */
export async function POST(request: NextRequest) {
    try {
        console.log('=== Starting group sync from Google Workspace ===');

        const result = await syncGroupsToDatabase();
        console.log('Sync result:', result);

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: `Successfully synced ${result.syncedCount} groups from Google Workspace`,
                syncedCount: result.syncedCount,
            });
        } else {
            return NextResponse.json({
                success: false,
                error: result.error || 'Failed to sync groups - check server logs',
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Groups sync error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to sync groups',
        }, { status: 500 });
    }
}
