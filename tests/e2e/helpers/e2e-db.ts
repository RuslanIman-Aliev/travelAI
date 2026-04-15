import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function cleanupE2EData(testEmail: string) {
  await prisma.user.deleteMany({
    where: {
      email: testEmail,
    },
  });
}

export async function disconnectE2EDatabase() {
  await prisma.$disconnect();
}
