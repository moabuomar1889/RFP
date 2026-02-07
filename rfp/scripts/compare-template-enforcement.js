/**
 * Compare Template Enforcement Between Two Projects
 * 
 * Purpose: Find why two projects with the same template
 * have different actual permissions after enforcement
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function main() {
    console.log('='.repeat(80));
    console.log('TEMPLATE ENFORCEMENT COMPARISON');
    console.log('='.repeat(80));
    console.log();

    // Get two projects to compare
    const projects = await prisma.projects.findMany({
        take: 10,
        orderBy: { created_at: 'desc' }
    });

    console.log('Available Projects:');
    projects.forEach((p, idx) => {
        console.log(`${idx + 1}. ${p.pr_number} - ${p.name}`);
    });
    console.log();

    // For now, let's compare the first two projects
    // User can modify this to specify exact project IDs
    const project1Number = process.argv[2] || projects[0]?.pr_number;
    const project2Number = process.argv[3] || projects[1]?.pr_number;

    if (!project1Number || !project2Number) {
        console.error('Usage: node compare-template-enforcement.js PROJECT1 PROJECT2');
        console.error('Example: node compare-template-enforcement.js PRJ-020 PRJ-021');
        process.exit(1);
    }

    console.log(`Comparing: ${project1Number} vs ${project2Number}`);
    console.log('-'.repeat(80));
    console.log();

    const [proj1, proj2] = await Promise.all([
        prisma.projects.findFirst({ where: { pr_number: project1Number } }),
        prisma.projects.findFirst({ where: { pr_number: project2Number } })
    ]);

    if (!proj1 || !proj2) {
        console.error('One or both projects not found!');
        process.exit(1);
    }

    // Get Bidding folders for both projects
    const [bidding1, bidding2] = await Promise.all([
        prisma.folder_instances.findFirst({
            where: {
                project_id: proj1.id,
                folder_name: 'Bidding'
            },
            include: {
                expected_permissions: true
            }
        }),
        prisma.folder_instances.findFirst({
            where: {
                project_id: proj2.id,
                folder_name: 'Bidding'
            },
            include: {
                expected_permissions: true
            }
        })
    ]);

    if (!bidding1 || !bidding2) {
        console.error('Bidding folder not found in one or both projects!');
        process.exit(1);
    }

    console.log('BIDDING FOLDER COMPARISON');
    console.log('='.repeat(80));
    console.log();

    console.log(`Project 1 (${project1Number}):`);
    console.log(`  Limited Access: ${bidding1.limited_access}`);
    console.log(`  Expected Permissions Count: ${bidding1.expected_permissions.length}`);
    console.log();

    console.log(`Project 2 (${project2Number}):`);
    console.log(`  Limited Access: ${bidding2.limited_access}`);
    console.log(`  Expected Permissions Count: ${bidding2.expected_permissions.length}`);
    console.log();

    // Compare expected permissions
    console.log('EXPECTED PERMISSIONS COMPARISON');
    console.log('-'.repeat(80));
    console.log();

    const perms1 = bidding1.expected_permissions.map(p => ({
        email: p.email_or_domain?.toLowerCase(),
        role: p.permission_role
    })).sort((a, b) => (a.email || '').localeCompare(b.email || ''));

    const perms2 = bidding2.expected_permissions.map(p => ({
        email: p.email_or_domain?.toLowerCase(),
        role: p.permission_role
    })).sort((a, b) => (a.email || '').localeCompare(b.email || ''));

    console.log(`${project1Number} Expected Permissions (${perms1.length}):`);
    perms1.forEach(p => console.log(`  - ${p.email}: ${p.role}`));
    console.log();

    console.log(`${project2Number} Expected Permissions (${perms2.length}):`);
    perms2.forEach(p => console.log(`  - ${p.email}: ${p.role}`));
    console.log();

    // Find differences
    console.log('DIFFERENCES');
    console.log('-'.repeat(80));
    console.log();

    const perms1Map = new Map(perms1.map(p => [p.email, p.role]));
    const perms2Map = new Map(perms2.map(p => [p.email, p.role]));

    const allEmails = new Set([...perms1Map.keys(), ...perms2Map.keys()]);

    let differencesFound = false;

    for (const email of allEmails) {
        const role1 = perms1Map.get(email);
        const role2 = perms2Map.get(email);

        if (role1 !== role2) {
            differencesFound = true;
            console.log(`❌ ${email}:`);
            console.log(`   ${project1Number}: ${role1 || 'MISSING'}`);
            console.log(`   ${project2Number}: ${role2 || 'MISSING'}`);
            console.log();
        }
    }

    if (!differencesFound) {
        console.log('✅ Expected permissions are IDENTICAL');
        console.log();
        console.log('⚠️  If enforcement produced different results,');
        console.log('    the bug is in the ENFORCEMENT LOGIC, not the expected permissions!');
    } else {
        console.log('⚠️  Expected permissions are DIFFERENT');
        console.log('    This explains why enforcement produced different results.');
    }

    console.log();
    console.log('='.repeat(80));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
