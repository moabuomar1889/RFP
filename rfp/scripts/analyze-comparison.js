/**
 * Comprehensive Line-by-Line Analysis of Permission Discrepancies
 * Between PRJ-019 and PRJ-020
 */

const fs = require('fs');

// Parse the comparison file
const compFile = 'c:\\Users\\Mo.abuomar\\Desktop\\RFP3\\rfp\\supabase\\scripts\\Comp';
const content = fs.readFileSync(compFile, 'utf-8');

const lines = content.split('\n');

const projects = {
    'PRJ-019': [],
    'PRJ-020': []
};

let currentProject = null;

// Parse the data
for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === 'PRJ-019' || line === 'PRJ-020') {
        currentProject = line;
        continue;
    }

    if (line.startsWith('Folder Path')) {
        // Header line, skip
        continue;
    }

    if (line === '' || line.length < 10) {
        continue;
    }

    if (currentProject && line.includes('\t')) {
        const parts = line.split('\t');
        if (parts.length >= 5) {
            projects[currentProject].push({
                path: parts[0],
                status: parts[1],
                expected: parts[2],
                actual: parts[3],
                discrepancies: parts[4] || ''
            });
        }
    }
}

console.log('='.repeat(100));
console.log('COMPREHENSIVE PERMISSION DISCREPANCY ANALYSIS');
console.log('='.repeat(100));
console.log();

// Helper to parse permission list
function parsePermissions(permStr) {
    if (!permStr) return [];

    const perms = [];
    const regex = /([^;()]+)\s*\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(permStr)) !== null) {
        perms.push({
            email: match[1].trim().toLowerCase(),
            role: match[2].trim()
        });
    }

    return perms;
}

// Helper to find extras (in actual but not in expected)
function findExtras(expected, actual) {
    const expectedEmails = new Set(expected.map(p => p.email));
    return actual.filter(p => !expectedEmails.has(p.email));
}

// Compare each folder
console.log('FOLDER-BY-FOLDER COMPARISON');
console.log('='.repeat(100));

for (let idx = 0; idx < Math.max(projects['PRJ-019'].length, projects['PRJ-020'].length); idx++) {
    const folder019 = projects['PRJ-019'][idx];
    const folder020 = projects['PRJ-020'][idx];

    if (!folder019 && !folder020) continue;

    const path = folder019?.path || folder020?.path;

    console.log();
    console.log(`📁 ${path}`);
    console.log('-'.repeat(100));

    // Compare expected permissions
    const expected019 = parsePermissions(folder019?.expected || '');
    const expected020 = parsePermissions(folder020?.expected || '');

    console.log(`Expected Permissions:`);
    if (JSON.stringify(expected019) === JSON.stringify(expected020)) {
        console.log(`  ✅ IDENTICAL (${expected019.length} permissions)`);
    } else {
        console.log(`  ❌ DIFFERENT`);
        console.log(`  PRJ-019: ${expected019.map(p => `${p.email} (${p.role})`).join(', ')}`);
        console.log(`  PRJ-020: ${expected020.map(p => `${p.email} (${p.role})`).join(', ')}`);
    }

    // Compare actual permissions
    const actual019 = parsePermissions(folder019?.actual || '');
    const actual020 = parsePermissions(folder020?.actual || '');

    console.log(`\nActual Permissions:`);
    console.log(`  PRJ-019: ${actual019.length} total`);
    console.log(`  PRJ-020: ${actual020.length} total`);

    // Find extras for each project
    const extras019 = findExtras(expected019, actual019);
    const extras020 = findExtras(expected020, actual020);

    console.log(`\nExtra Permissions (inherited or unexpected):`);
    console.log(`  PRJ-019: ${extras019.length} extras`);
    if (extras019.length > 0) {
        extras019.forEach(p => console.log(`    - ${p.email} (${p.role})`));
    }

    console.log(`  PRJ-020: ${extras020.length} extras`);
    if (extras020.length > 0) {
        extras020.forEach(p => console.log(`    - ${p.email} (${p.role})`));
    }

    // Compare the extras
    if (extras019.length !== extras020.length) {
        console.log(`\n  ⚠️  DIFFERENT NUMBER OF EXTRAS!`);
    }

    // Check for specific differences in extras
    const extras019Map = new Map(extras019.map(p => [p.email, p.role]));
    const extras020Map = new Map(extras020.map(p => [p.email, p.role]));

    // Find emails that differ
    const allExtraEmails = new Set([...extras019Map.keys(), ...extras020Map.keys()]);
    const differing = [];

    for (const email of allExtraEmails) {
        const role019 = extras019Map.get(email);
        const role020 = extras020Map.get(email);

        if (role019 !== role020) {
            differing.push({ email, role019: role019 || 'MISSING', role020: role020 || 'MISSING' });
        }
    }

    if (differing.length > 0) {
        console.log(`\n  ❌ DIFFERENCES IN EXTRAS:`);
        differing.forEach(d => {
            console.log(`    ${d.email}: PRJ-019=${d.role019}, PRJ-020=${d.role020}`);
        });
    }
}

console.log();
console.log('='.repeat(100));
console.log('SUMMARY OF FINDINGS');
console.log('='.repeat(100));
console.log();

// Collect all unique differences
const hseTeamDiff = [];
const vendorsQuotationsDiff = [];
const otherDiff = [];

for (let idx = 0; idx < Math.max(projects['PRJ-019'].length, projects['PRJ-020'].length); idx++) {
    const folder019 = projects['PRJ-019'][idx];
    const folder020 = projects['PRJ-020'][idx];

    if (!folder019 || !folder020) continue;

    const path = folder019.path || folder020.path;
    const actual019 = parsePermissions(folder019.actual);
    const actual020 = parsePermissions(folder020.actual);

    // Check for HSE-Team differences
    const hse019 = actual019.find(p => p.email.includes('hse-team'));
    const hse020 = actual020.find(p => p.email.includes('hse-team'));

    if (hse019 && hse020 && hse019.role !== hse020.role) {
        hseTeamDiff.push({ path, role019: hse019.role, role020: hse020.role });
    }

    // Check Vendors Quotations differences
    if (path.includes('Vendors Quotations')) {
        const expected019 = parsePermissions(folder019.expected);
        const expected020 = parsePermissions(folder020.expected);
        const extras019 = findExtras(expected019, actual019);
        const extras020 = findExtras(expected020, actual020);

        if (extras019.length !== extras020.length) {
            vendorsQuotationsDiff.push({ path, extras019: extras019.length, extras020: extras020.length });
        }
    }
}

console.log('1. HSE-Team Role Differences:');
if (hseTeamDiff.length > 0) {
    hseTeamDiff.forEach(d => {
        console.log(`   ${d.path}: PRJ-019=${d.role019}, PRJ-020=${d.role020}`);
    });
} else {
    console.log('   None found');
}

console.log();
console.log('2. Vendors Quotations Subfolder Differences:');
if (vendorsQuotationsDiff.length > 0) {
    vendorsQuotationsDiff.forEach(d => {
        console.log(`   ${d.path}: PRJ-019 has ${d.extras019} extras, PRJ-020 has ${d.extras020} extras`);
    });
} else {
    console.log('   None found');
}

console.log();
console.log('='.repeat(100));
