import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings
 * Fetch all system settings
 */
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase.rpc('get_settings');

        if (error) {
            console.error('Error fetching settings:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch settings' },
                { status: 500 }
            );
        }

        // Convert array to object for easier frontend use
        const settings: Record<string, any> = {};
        for (const row of data || []) {
            settings[row.setting_key] = row.setting_value;
        }

        return NextResponse.json({
            success: true,
            settings,
            raw: data, // Include raw for debugging
        });
    } catch (error: any) {
        console.error('Settings GET error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch settings' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/settings
 * Save all settings at once
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { settings } = body;

        if (!settings || typeof settings !== 'object') {
            return NextResponse.json(
                { success: false, error: 'Invalid settings object' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase.rpc('save_all_settings', {
            p_settings: settings
        });

        if (error) {
            console.error('Error saving settings:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to save settings' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Settings saved successfully',
        });
    } catch (error: any) {
        console.error('Settings POST error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to save settings' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/settings
 * Update a single setting
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { key, value } = body;

        if (!key || value === undefined) {
            return NextResponse.json(
                { success: false, error: 'Key and value are required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase.rpc('update_setting', {
            p_key: key,
            p_value: value,
            p_updated_by: 'admin'
        });

        if (error) {
            console.error('Error updating setting:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to update setting' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Setting '${key}' updated successfully`,
        });
    } catch (error: any) {
        console.error('Settings PATCH error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to update setting' },
            { status: 500 }
        );
    }
}
