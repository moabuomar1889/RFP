import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/roles
 * Get all permission roles from database
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();

        const { data: roles, error } = await supabase
            .schema('rfp')
            .from('permission_directory')
            .select('*')
            .order('role_name', { ascending: true });

        if (error) {
            console.error('Error fetching roles:', error);
            return NextResponse.json({
                success: true,
                roles: [],
                message: 'No roles found.',
            });
        }

        return NextResponse.json({
            success: true,
            roles: roles || [],
            count: roles?.length || 0,
        });
    } catch (error) {
        console.error('Roles API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch roles',
            roles: [],
        }, { status: 500 });
    }
}

/**
 * POST /api/roles
 * Create a new permission role
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { roleName, description, driveRole, principals } = body;

        if (!roleName || !driveRole) {
            return NextResponse.json({
                success: false,
                error: 'Role name and drive role are required',
            }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .schema('rfp')
            .from('permission_directory')
            .insert({
                role_name: roleName,
                description: description || '',
                drive_role: driveRole,
                principals: principals || [],
                is_system: false,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating role:', error);
            return NextResponse.json({
                success: false,
                error: 'Failed to create role',
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            role: data,
            message: 'Role created successfully',
        });
    } catch (error) {
        console.error('Create role error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to create role',
        }, { status: 500 });
    }
}
