// Quick script to list all folders in a Drive folder recursively
// Usage: node list-drive-folders.mjs <FOLDER_ID>

import { google } from 'googleapis';
import * as dotenv from 'dotenv';
dotenv.config();

const FOLDER_ID = process.argv[2] || '17xtNwqSdVViNd3fwC5yEhvzfa4arzaL9';

// Build auth from env
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function listFoldersRecursive(parentId, path = '', depth = 0) {
    const indent = '  '.repeat(depth);

    const res = await drive.files.list({
        q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name)',
        orderBy: 'name',
        pageSize: 100,
    });

    const folders = res.data.files || [];

    for (const folder of folders) {
        const folderPath = path ? `${path}/${folder.name}` : folder.name;
        console.log(`${indent}📁 ${folder.name}`);
        console.log(`${indent}   Path: ${folderPath}`);
        console.log(`${indent}   ID: ${folder.id}`);

        // Recurse into children
        await listFoldersRecursive(folder.id, folderPath, depth + 1);
    }
}

console.log(`\n🔍 Scanning folder: ${FOLDER_ID}\n`);
console.log('='.repeat(60));

try {
    await listFoldersRecursive(FOLDER_ID);
    console.log('\n' + '='.repeat(60));
    console.log('✅ Done!');
} catch (err) {
    console.error('❌ Error:', err.message);
}
