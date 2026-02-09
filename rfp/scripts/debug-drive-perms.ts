// Standalone script: Dump raw Drive API permission details for a folder
// Usage: npx tsx scripts/debug-drive-perms.ts <folderId>
//
// Investigates "Access removed" vs "People with access" on limited-access folders
// by inspecting the 'view' field in permissionDetails

import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function main() {
    const folderId = process.argv[2] || '1_W30XeBmrJFI6xslYDuSByZNwQK2JRBN'; // Vendors Quotations

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const impersonateEmail = process.env.GOOGLE_ADMIN_EMAIL || 'mo.abuomar@dtgsa.com';

    if (!serviceAccountEmail || !privateKey) {
        console.error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
        process.exit(1);
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: serviceAccountEmail,
            private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
        clientOptions: { subject: impersonateEmail },
    });

    const drive = google.drive({ version: 'v3', auth });

    // 1. Get folder metadata
    console.log(`\n========== FOLDER METADATA ==========`);
    const folderMeta = await drive.files.get({
        fileId: folderId,
        supportsAllDrives: true,
        fields: 'id,name,driveId,inheritedPermissionsDisabled,parents'
    });
    console.log(JSON.stringify(folderMeta.data, null, 2));

    // 2. List all permissions with FULL fields including 'view'
    console.log(`\n========== PERMISSIONS LIST ==========`);
    const permsResponse = await drive.permissions.list({
        fileId: folderId,
        supportsAllDrives: true,
        fields: 'permissions(id,type,role,emailAddress,domain,displayName,deleted,view,permissionDetails,expirationTime,pendingOwner)',
    });

    const permissions = permsResponse.data.permissions || [];
    console.log(`Total permissions: ${permissions.length}\n`);

    for (const p of permissions) {
        console.log(`--- ${p.emailAddress || p.domain || p.type} ---`);
        console.log(`  id: ${p.id}`);
        console.log(`  type: ${p.type}`);
        console.log(`  role: ${p.role}`);
        console.log(`  displayName: ${p.displayName}`);
        console.log(`  deleted: ${p.deleted}`);
        console.log(`  view: ${p.view || 'NONE'}`);  // <--- KEY FIELD
        console.log(`  permissionDetails:`);
        if (p.permissionDetails) {
            for (const d of p.permissionDetails) {
                console.log(`    - permissionType: ${d.permissionType}`);
                console.log(`      role: ${d.role}`);
                console.log(`      inherited: ${d.inherited}`);
                console.log(`      inheritedFrom: ${d.inheritedFrom || 'N/A'}`);
                // Check for 'view' inside permissionDetails too
                console.log(`      view: ${(d as any).view || 'NONE'}`);
            }
        } else {
            console.log(`    (none)`);
        }
        console.log('');
    }

    // 3. For the key identifiers, also do permissions.get with fields=*
    const keyEmails = [
        'hse-team@dtgsa.com',
        'technical-team@dtgsa.com',
        'projects-control@dtgsa.com'
    ];

    console.log(`\n========== DETAILED GET (fields=*) ==========`);
    for (const email of keyEmails) {
        const perm = permissions.find(p => p.emailAddress?.toLowerCase() === email);
        if (!perm) {
            console.log(`${email}: NOT FOUND in list`);
            continue;
        }

        try {
            const res = await drive.permissions.get({
                fileId: folderId,
                permissionId: perm.id!,
                supportsAllDrives: true,
                fields: '*'  // Get EVERYTHING
            });
            console.log(`\n--- ${email} (GET /*) ---`);
            console.log(JSON.stringify(res.data, null, 2));
        } catch (err: any) {
            console.log(`${email}: GET error: ${err.message}`);
        }
    }
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
