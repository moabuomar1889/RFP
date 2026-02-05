/**
 * Transform flat folder permissions array into hierarchical template format
 * Run with: node scripts/transform_permissions.js
 */
const fs = require('fs');
const path = require('path');

// Read the flat permissions file
const inputPath = path.join(__dirname, '..', 'folders_permissions.json');
const outputPath = path.join(__dirname, '..', 'template_output.json');

const folders = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

// Build lookup maps
const folderById = new Map();
folders.forEach(f => folderById.set(f.id, f));

// Find root folders (parent is null)
const rootFolders = folders.filter(f => f.parent === null);

// Clean folder name - remove project prefix patterns like "1-PRJ-014-PD-" or "7-PRJ-014-RFP-"
function cleanFolderName(name) {
    // Remove number prefix and project code prefix
    // Pattern: optional "N-" + "PRJ-NNN-PD-" or "PRJ-NNN-RFP-" + actual name
    const cleaned = name
        .replace(/^\d+-PRJ-\d+-(?:PD|RFP)-/, '')  // "1-PRJ-014-PD-" -> ""
        .replace(/^PRJ-\d+-(?:PD|RFP)$/, (match) => match.includes('PD') ? 'Project Delivery' : 'Bidding')  // Phase folders
        .replace(/^PRJ-\d+-.*$/, name); // Keep full name if it's the root project

    return cleaned || name;
}

// Extract group permissions from folder permissions array
function extractGroupPermissions(permissions) {
    const groups = [];

    permissions.forEach(perm => {
        // Only include group permissions (not domain or user)
        if (perm.type === 'group' && perm.email) {
            groups.push({
                email: perm.email.toLowerCase(),
                displayName: perm.displayName,
                role: perm.role // organizer, fileOrganizer, writer, reader
            });
        }
    });

    return groups;
}

// Check if this is a "limited access" folder (not all groups have access)
function isLimitedAccess(permissions) {
    const groupCount = permissions.filter(p => p.type === 'group').length;
    // If less than 7 groups have access, it's limited (we have 7 main groups)
    return groupCount < 7;
}

// Recursively build tree structure
function buildTree(parentId) {
    const children = folders.filter(f => f.parent === parentId);

    if (children.length === 0) {
        return [];
    }

    return children.map(folder => {
        const groupPermissions = extractGroupPermissions(folder.permissions);
        const childNodes = buildTree(folder.id);

        const node = {
            name: cleanFolderName(folder.name),
            originalName: folder.name, // Keep original for reference
            path: folder.path,
            limitedAccess: isLimitedAccess(folder.permissions),
            groups: groupPermissions
        };

        if (childNodes.length > 0) {
            node.children = childNodes;
        }

        return node;
    });
}

// Build template for each root folder
const template = rootFolders.map(root => {
    const rootGroups = extractGroupPermissions(root.permissions);
    const children = buildTree(root.id);

    return {
        name: root.name.replace(/^PRJ-\d+-/, ''), // Project root name
        originalName: root.name,
        path: root.path,
        limitedAccess: false, // Root is typically public
        groups: rootGroups,
        children: children
    };
});

// Extract just the phase folders (PD and RFP) as the template
// The template should be reusable across projects
function extractPhaseTemplate(projectTree) {
    if (!projectTree || !projectTree.children) return [];

    return projectTree.children.map(phase => {
        // Normalize phase name
        let phaseName = phase.name;
        if (phase.originalName.includes('-PD')) {
            phaseName = 'Project Delivery';
        } else if (phase.originalName.includes('-RFP')) {
            phaseName = 'Bidding';
        }

        return {
            ...phase,
            name: phaseName
        };
    });
}

// Get the first project's structure as the template
const projectTemplate = template[0];
const phaseTemplate = extractPhaseTemplate(projectTemplate);

// Output the template
console.log('=== FOLDER TEMPLATE STRUCTURE ===\n');
console.log('Total folders processed:', folders.length);
console.log('Root folders found:', rootFolders.length);
console.log('\n=== PHASE TEMPLATE (for saving to database) ===\n');

// Create a clean template without originalName and path for database storage
function cleanForDatabase(nodes) {
    return nodes.map(node => {
        const clean = {
            name: node.name,
            limitedAccess: node.limitedAccess,
            groups: node.groups.map(g => ({
                email: g.email,
                role: g.role
            }))
        };

        if (node.children && node.children.length > 0) {
            clean.children = cleanForDatabase(node.children);
        }

        return clean;
    });
}

const databaseTemplate = cleanForDatabase(phaseTemplate);

// Write outputs
fs.writeFileSync(outputPath, JSON.stringify(databaseTemplate, null, 2));
console.log(`Template written to: ${outputPath}`);

// Also create a summary
const summaryPath = path.join(__dirname, '..', 'template_summary.txt');
let summary = 'FOLDER TEMPLATE SUMMARY\n';
summary += '========================\n\n';

function printTree(nodes, indent = 0) {
    let output = '';
    nodes.forEach(node => {
        const prefix = '  '.repeat(indent) + '├── ';
        const accessType = node.limitedAccess ? '[LIMITED]' : '[PUBLIC]';
        const groupsStr = node.groups.map(g => `${g.displayName || g.email}:${g.role}`).join(', ');
        output += `${prefix}${node.name} ${accessType}\n`;
        output += `${'  '.repeat(indent)}    Groups: ${groupsStr}\n`;

        if (node.children && node.children.length > 0) {
            output += printTree(node.children, indent + 1);
        }
    });
    return output;
}

summary += printTree(phaseTemplate);
fs.writeFileSync(summaryPath, summary);
console.log(`Summary written to: ${summaryPath}`);

// Print first few nodes to console
console.log(JSON.stringify(databaseTemplate.slice(0, 2), null, 2));
