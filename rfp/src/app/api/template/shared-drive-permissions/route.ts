import { NextRequest, NextResponse } from 'next/server';
import {
    getSharedDrivePermissionState,
    setSharedDriveMemberRole,
    syncSharedDriveVisibilityMembers,
    type SharedDrivePrincipalType,
    type SharedDriveRole,
} from '@/server/shared-drive-members';

export const dynamic = 'force-dynamic';

const EDITABLE_ROLES: SharedDriveRole[] = ['reader', 'commenter', 'writer', 'fileOrganizer'];

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}
function isEditableRole(value: unknown): value is SharedDriveRole {
    return typeof value === 'string' && EDITABLE_ROLES.includes(value as SharedDriveRole);
}

function isPrincipalType(value: unknown): value is SharedDrivePrincipalType {
    return value === 'group' || value === 'user';
}

export async function GET() {
    try {
        const state = await getSharedDrivePermissionState();
        return NextResponse.json({ success: true, ...state });
    } catch (error) {
        console.error('Shared Drive permission state error:', error);
        return NextResponse.json(
            { success: false, error: errorMessage(error, 'Failed to load shared drive permissions') },
            { status: 500 }
        );
    }
}

export async function POST() {
    try {
        const result = await syncSharedDriveVisibilityMembers();
        const state = await getSharedDrivePermissionState();
        return NextResponse.json({ success: true, result, state });
    } catch (error) {
        console.error('Shared Drive permission sync error:', error);
        return NextResponse.json(
            { success: false, error: errorMessage(error, 'Failed to sync shared drive permissions') },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, email, role } = body || {};

        if (!isPrincipalType(type)) {
            return NextResponse.json({ success: false, error: 'type must be group or user' }, { status: 400 });
        }
        if (typeof email !== 'string' || !email.trim()) {
            return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 });
        }
        if (!isEditableRole(role)) {
            return NextResponse.json(
                { success: false, error: 'role must be reader, commenter, writer, or fileOrganizer' },
                { status: 400 }
            );
        }

        const result = await setSharedDriveMemberRole({ type, email, role });
        const state = await getSharedDrivePermissionState();
        return NextResponse.json({ success: true, result, state });
    } catch (error) {
        console.error('Shared Drive permission edit error:', error);
        return NextResponse.json(
            { success: false, error: errorMessage(error, 'Failed to update shared drive permission') },
            { status: 500 }
        );
    }
}