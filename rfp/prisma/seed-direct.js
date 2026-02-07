/**
 * Direct Node.js script to seed database
 * Bypasses tsx compilation issues
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting direct seed...');

    // Read template JSON
    const templatePath = path.join(__dirname, '..', 'template-backup.json');

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found at ${templatePath}`);
    }

    const templateJson = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
    console.log(`📄 Loaded template with ${templateJson.children?.length || 0} top-level folders`);

    // Insert or update template
    const template = await prisma.folderTemplate.upsert({
        where: { version_number: 1 },
        update: {
            template_json: templateJson,
            is_active: true
        },
        create: {
            version_number: 1,
            template_json: templateJson,
            is_active: true,
            created_by: 'system_seed',
            notes: 'Template from template_output.json'
        }
    });

    console.log(`✅ Template seeded: version ${template.version_number}`);
    console.log(`✅ ID: ${template.id}`);
    console.log(`✅ Active: ${template.is_active}`);
}

main()
    .then(async () => {
        await prisma.$disconnect();
        console.log('\n🎉 Seed complete!');
        process.exit(0);
    })
    .catch(async (e) => {
        console.error('❌ Seed failed:', e.message);
        await prisma.$disconnect();
        process.exit(1);
    });
