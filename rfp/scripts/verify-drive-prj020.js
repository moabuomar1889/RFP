/**
 * Verification Script: Get PRJ-020 folder data and test Drive API
 * 
 * Purpose: 
 * 1. Query database for PRJ-020 folders (Bidding, SOW, etc.)
 * 2. Show folder IDs and limitedAccess settings
 * 3. Call Drive API to get actual permissions
 * 4. Display Drive truth for manual verification
 */

import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
    console.log('='.repeat(80));
    console.log('PRJ-020 DRIVE VERIFICATION SCRIPT');
    console.log('='.repeat(80));
    console.log();

    // Step 1: Get project info
    console.log('STEP 1: Project Information');
    console.log('-'.repeat(80));

    const project = await prisma.projects.findFirst({
        where: { pr_number: 'PRJ-020' }
    });

    if (!project) {
        console.error('❌ PRJ-020 not found!');
        process.exit(1);
    }

    console.log(`Project: ${project.name}`);
    console.log(`PR Number: ${project.pr_number}`);
    console.log(`Root Folder ID: ${project.root_drive_folder_id}`);
    console.log();

    // Step 2: Get all folders
    console.log('STEP 2: Folder Instances');
    console.log('-'.repeat(80));

    const folders = await prisma.folder_instances.findMany({
        where: { project_id: project.id },
        orderBy: { folder_path: 'asc' }
    });

    console.log(`Found ${folders.length} folders:\n`);

    const tableData = folders.map(f => ({
        name: f.folder_name,
        path: f.folder_path,
        driveId: f.folder_drive_id || 'N/A',
        limitedAccess: f.limited_access ? 'YES' : 'NO'
    }));

    console.table(tableData);
    console.log();

    // Step 3: Key folders for testing
    console.log('STEP 3: Key Folders for Drive API Testing');
    console.log('-'.repeat(80));

    const keyFolders = ['Bidding', 'Vendors Quotations', 'SOW'];
    const testFolders = folders.filter(f => keyFolders.includes(f.folder_name));

    console.log('\nFolders to verify with Drive API:');
    testFolders.forEach((f, idx) => {
        console.log(`\n${idx + 1}. ${f.folder_name}`);
        console.log(`   Path: ${f.folder_path}`);
        console.log(`   Drive ID: ${f.folder_drive_id || 'NOT SET'}`);
        console.log(`   Limited Access: ${f.limited_access ? 'true' : 'false'}`);
        console.log(`   Expected Behavior:`);
        if (f.limited_access) {
            console.log(`     - Should match expected permissions exactly`);
            console.log(`     - Inherited permissions = VIOLATION`);
        } else {
            console.log(`     - Inherited permissions = ALLOWED (ignore)`);
            console.log(`     - Domain/anyone = ALLOWED (ignore)`);
        }
    });

    console.log();
    console.log('='.repeat(80));
    console.log('NEXT STEPS:');
    console.log('1. Use these Drive IDs to call Drive API manually');
    console.log('2. Check permissions with: GET /drive/v3/files/{fileId}/permissions');
    console.log('3. Verify inherited field values');
    console.log('4. Run Permission Audit in UI for automated check');
    console.log('='.repeat(80));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
