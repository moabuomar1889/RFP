// Clean a folder + ALL children recursively:
//   - Remove all direct permissions (keep only drive members)
//   - Remove limited access on all folders
// Usage: npx tsx scripts/clean-folder.ts <folderId>

import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const PROTECTED = ['mo.abuomar@dtgsa.com', 'admin@dtgsa.com'];

async function getDrive() {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const impersonateEmail = process.env.GOOGLE_ADMIN_EMAIL || 'mo.abuomar@dtgsa.com';
    if (!serviceAccountEmail || !privateKey) { console.error('Missing env vars'); process.exit(1); }

    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: serviceAccountEmail, private_key: privateKey },
        scopes: ['https://www.googleapis.com/auth/drive'],
        clientOptions: { subject: impersonateEmail },
    });
    return google.drive({ version: 'v3', auth });
}

// Recursively collect all child folder IDs
async function getAllChildFolders(drive: any, parentId: string, folderPath: string = ''): Promise<{ id: string, name: string, path: string }[]> {
    const results: { id: string, name: string, path: string }[] = [];
    const res = await drive.files.list({
        q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'files(id,name)',
        pageSize: 100,
    });
    for (const f of res.data.files || []) {
        const p = folderPath ? `${folderPath}/${f.name}` : f.name;
        results.push({ id: f.id!, name: f.name!, path: p });
        const children = await getAllChildFolders(drive, f.id!, p);
        results.push(...children);
    }
    return results;
}

async function cleanFolder(drive: any, folderId: string, folderName: string) {
    console.log(`\n─── Cleaning: ${folderName} (${folderId}) ───`);

    // 1. Remove limited access
    try {
        const meta = await drive.files.get({
            fileId: folderId, supportsAllDrives: true,
            fields: 'inheritedPermissionsDisabled'
        });
        if (meta.data.inheritedPermissionsDisabled) {
            await drive.files.update({
                fileId: folderId,
                requestBody: { inheritedPermissionsDisabled: false } as any,
                supportsAllDrives: true, fields: 'id'
            });
            console.log(`  ✓ Limited Access REMOVED`);
        } else {
            console.log(`  · Limited Access already off`);
        }
    } catch (err: any) {
        console.log(`  ✗ Limited Access error: ${err.message}`);
    }

    // 2. List & remove direct permissions
    const res = await drive.permissions.list({
        fileId: folderId, supportsAllDrives: true,
        fields: 'permissions(id,type,role,emailAddress,domain,displayName,permissionDetails)',
    });
    const perms = res.data.permissions || [];
    let removed = 0, skipped = 0;

    for (const p of perms) {
        const email = (p.emailAddress || p.domain || '').toLowerCase();
        const isInherited = p.permissionDetails?.some((d: any) => d.inherited) ?? false;

        if (isInherited) { skipped++; continue; }
        if (PROTECTED.includes(email)) { skipped++; continue; }

        try {
            await drive.permissions.delete({
                fileId: folderId, permissionId: p.id!, supportsAllDrives: true,
            });
            console.log(`  ✗ Removed: ${email || p.type} [${p.role}] (${p.displayName})`);
            removed++;
        } catch (err: any) {
            console.log(`  ✗ Error removing ${email}: ${err.message}`);
        }
    }
    console.log(`  Result: removed=${removed}, skipped=${skipped}`);
}

async function main() {
    const folderId = process.argv[2] || '1uCbE6SVo-3CRQiwGLOWLr3NgF7YMcP3y';
    const drive = await getDrive();

    // Get root folder name
    const rootMeta = await drive.files.get({
        fileId: folderId, supportsAllDrives: true, fields: 'id,name'
    });
    console.log(`\n========== RECURSIVE CLEAN ==========`);
    console.log(`Root: ${rootMeta.data.name}`);

    // Collect all children
    console.log(`\nScanning for child folders...`);
    const children = await getAllChildFolders(drive, folderId, rootMeta.data.name!);
    console.log(`Found ${children.length} child folders + 1 root = ${children.length + 1} total\n`);

    // Clean root first
    await cleanFolder(drive, folderId, rootMeta.data.name!);

    // Clean all children
    for (const child of children) {
        await cleanFolder(drive, child.id, child.path);
    }

    console.log(`\n========== DONE ==========`);
    console.log(`Cleaned ${children.length + 1} folders total.`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
