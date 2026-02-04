import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncUsersToDatabase } from '@/server/google-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users
 * Get all users from database (cached from Google Workspace)
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();

        // First try to get from cache
        const { data: users, error } = await supabase
            .schema('rfp')
            .from('user_directory')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching users - TABLE MAY NOT EXIST:', error);
            // Return helpful message
            return NextResponse.json({
                success: false,
                users: [],
                error: `Table error: ${error.message}. Please run the SQL migration to create user_directory table.`,
                tableExists: false,
            });
        }

        return NextResponse.json({
            success: true,
            users: users || [],
            count: users?.length || 0,
            tableExists: true,
        });
    } catch (error: any) {
        console.error('Users API error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch users',
            users: [],
        }, { status: 500 });
    }
}

/**
 * POST /api/users
 * Sync users from Google Workspace to database
 */
export async function POST(request: NextRequest) {
    try {
        console.log('=== Starting user sync from Google Workspace ===');

        // First check if table exists
        const supabase = getSupabaseAdmin();
        const { error: tableCheck } = await supabase
            .schema('rfp')
            .from('user_directory')
            .select('id')
            .limit(1);

        if (tableCheck) {
            console.error('Table check failed:', tableCheck);
            return NextResponse.json({
                success: false,
                error: `Table user_directory does not exist. Please run SQL: CREATE TABLE IF NOT EXISTS rfp.user_directory (...). Error: ${tableCheck.message}`,
            }, { status: 400 });
        }

        const result = await syncUsersToDatabase();
        console.log('Sync result:', result);

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: `Successfully synced ${result.syncedCount} users from Google Workspace`,
                syncedCount: result.syncedCount,
            });
        } else {
            return NextResponse.json({
                success: false,
                error: result.error || 'Failed to sync users - check server logs',
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Users sync error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to sync users',
        }, { status: 500 });
    }
}
