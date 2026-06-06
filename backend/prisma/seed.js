require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const crypto = require('node:crypto');

const prisma = new PrismaClient();

const SALT = process.env.SALT || 'persediaan-lsp-salt-2026';

function hashPassword(password) {
  return crypto.scryptSync(password, SALT, 64).toString('hex');
}

async function main() {
  console.log('[SEED] Memulai proses seeding database...');

  // ─── Seed Users ───────────────────────────────────────────────────────────────
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    await prisma.user.createMany({
      data: [
        {
          username: 'admin',
          password: hashPassword('admin123'),
          name: 'Administrator',
          role: 'Admin',
        },
        {
          username: 'operator',
          password: hashPassword('operator123'),
          name: 'Operator Staff',
          role: 'Operator',
        },
      ],
    });
    console.log('[SEED] ✓ Default users seeded: admin/admin123, operator/operator123');
  } else {
    console.log('[SEED] Users sudah ada, skip seeding users.');
  }

  // ─── Seed Categories ──────────────────────────────────────────────────────────
  const catCount = await prisma.category.count();
  if (catCount === 0) {
    await prisma.category.createMany({
      data: [
        { name: 'Elektronik',        description: 'Perangkat elektronik dan kelistrikan' },
        { name: 'Alat Tulis Kantor', description: 'Peralatan menulis dan administrasi' },
        { name: 'Bahan Baku',        description: 'Bahan baku produksi utama' },
        { name: 'Aksesoris',         description: 'Peralatan pendukung dan aksesori' },
      ],
    });
    console.log('[SEED] ✓ 4 default categories seeded.');
  } else {
    console.log('[SEED] Categories sudah ada, skip seeding categories.');
  }

  console.log('[SEED] ✓ Seeding selesai!');
}

main()
  .catch((e) => {
    console.error('[SEED] ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
