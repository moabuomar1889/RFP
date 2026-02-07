/**
 * Seed script for RFP system
 * Re-imports template data after Prisma schema rebuild
 */

import { PrismaClient } from '../node_modules/@prisma/client/index.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting RFP seed...');

  // 1. Import template JSON (user must provide this file)
  const templatePath = join(__dirname, '../template-backup.json');

  if (!existsSync(templatePath)) {
    throw new Error(
      `Template backup not found at ${templatePath}.\n` +
      `Please export your template and save it as template-backup.json in the rfp directory.`
    );
  }

  const templateJson = JSON.parse(readFileSync(templatePath, 'utf-8'));

  // 2. Create initial folder template
  const template = await prisma.folderTemplate.create({
    data: {
      version_number: 1,
      template_json: templateJson,
      is_active: true,
      created_by: 'system_seed',
      notes: 'Initial template imported via Prisma seed after code-first migration'
    }
  });

  console.log(`✅ Created template version ${template.version_number}`);

  // 3. Optional: Create sample project for testing
  if (process.env.CREATE_TEST_PROJECT === 'true') {
    const testProject = await prisma.project.create({
      data: {
        name: 'TEST-000-Prisma Migration Test',
        pr_number: 'TEST-000',
        drive_folder_id: null // Will be set when synced
      }
    });

    console.log(`✅ Created test project: ${testProject.name}`);
  }

  console.log('🌱 Seed completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
