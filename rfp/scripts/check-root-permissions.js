/**
 * Check Root Folder Permissions for PRJ-019 and PRJ-020
 * 
 * Purpose: Find why HSE-Team inherits different roles in the two projects
 * Hypothesis: Root folders have different permissions set
 */

import { google } from 'googleapis';
import fs from 'fs';

// Manual Drive file IDs - you'll need to get these from the database
const projects = {
    'PRJ-019': {
        rootFolderId: 'PASTE_PRJ019_ROOT_FOLDER_ID_HERE',
        biddingFolderId: 'PASTE_PRJ019_BIDDING_FOLDER_ID_HERE'
    },
    'PRJ-020': {
        rootFolderId: 'PASTE_PRJ020_ROOT_FOLDER_ID_HERE',
        biddingFolderId: 'PASTE_PRJ020_BIDDING_FOLDER_ID_HERE'
    }
};

async function getDrivePermissions(auth, fileId, folderName) {
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.permissions.list({
        fileId,
        fields: 'permissions(id,type,role,emailAddress,domain,inherited,inheritedFrom,permissionDetails)',
        supportsAllDrives: true
    });

    console.log(`\n${folderName} (${fileId}):`);
    console.log('='.repeat(80));

    response.data.permissions.forEach(p => {
        const inherited = p.inherited || p.permissionDetails?.some(d => d.inherited);
        const email = p.emailAddress || p.domain || p.type;
        const flag = inherited ? ' [INHERITED]' : ' [DIRECT]';
        console.log(`  ${email} => ${p.role}${flag}`);

        if (email.toLowerCase().includes('hse-team')) {
            console.log(`    ⚠️  HSE-TEAM FOUND WITH ROLE: ${p.role}`);
        }
    });
}

async function main() {
    console.log('ROOT FOLDER PERMISSION COMPARISON');
    console.log('='.repeat(80));

    // Note: You would need to set up OAuth2 credentials here
    // For now, this is a template showing what to check

    console.log('\n⚠️  This script requires:');
    console.log('1. Get root_drive_folder_id from database for both projects');
    console.log('2. Set up Google OAuth2 credentials');
    console.log('3. Call Drive API to list permissions on root folders');
    console.log('\n📋 MANUAL STEPS:');
    console.log('1. Run this SQL in Supabase:');
    console.log(`
    SELECT 
      pr_number,
      root_drive_folder_id,
      (SELECT folder_drive_id FROM rfp.folder_instances 
       WHERE project_id = p.id AND folder_name = 'Bidding' LIMIT 1) AS bidding_folder_id
    FROM rfp.projects p
    WHERE pr_number IN ('PRJ-019', 'PRJ-020');
  `);
    console.log('\n2. Use those IDs in Google Drive API Explorer:');
    console.log('   https://developers.google.com/drive/api/v3/reference/permissions/list');
    console.log('\n3. Compare HSE-Team role in root folders');
}

main().catch(console.error);
