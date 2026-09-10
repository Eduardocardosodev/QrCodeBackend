import { PrismaClient } from '@prisma/client';

export async function isDatabaseAvailable(): Promise<boolean> {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    await prisma.$disconnect();
    return true;
  } catch {
    await prisma.$disconnect().catch(() => undefined);
    return false;
  }
}
