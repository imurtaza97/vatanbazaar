import { hashPassword } from '../utils/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedAdmin() {
  try {
    const adminExists = await prisma.admin.findFirst();
    if (adminExists) {
      console.log("Admin already exists — skipping seeding.");
      return;
    }

    const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PHONE, SEED_ADMIN_PASSWORD } = process.env;

    if (!SEED_ADMIN_NAME || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
      throw new Error('Missing admin credentials in environment variables');
    }

    const hashedPassword = await hashPassword(SEED_ADMIN_PASSWORD);

    await prisma.admin.create({
      data: {
        name: SEED_ADMIN_NAME,
        email: SEED_ADMIN_EMAIL,
        phone: SEED_ADMIN_PHONE || '',
        passwordHash: hashedPassword,
        role: 'super_admin',
      },
    });

    console.log(`Admin ${SEED_ADMIN_EMAIL} seeded successfully.`);
  } catch (error) {
    console.error('Error seeding admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}