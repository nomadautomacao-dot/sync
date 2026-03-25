import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const groupSlug = process.env.SYNC_GROUP_SLUG?.trim() || "sync-default";
const groupName = process.env.SYNC_GROUP_NAME?.trim() || "Sync Holdings";
const adminEmail = process.env.SYNC_ADMIN_EMAIL?.trim() || "admin@sync.local";
const adminName = process.env.SYNC_ADMIN_NAME?.trim() || "Admin Sync";

async function main() {
  const group = await prisma.group.upsert({
    where: { slug: groupSlug },
    update: { name: groupName },
    create: {
      name: groupName,
      slug: groupSlug,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      groupId: group.id,
      groupRole: "owner",
    },
    create: {
      email: adminEmail,
      name: adminName,
      groupId: group.id,
      groupRole: "owner",
    },
  });

  await prisma.auditLog.deleteMany({
    where: {
      action: "workspace.initialized",
      userId: admin.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "workspace.initialized",
      userId: admin.id,
      metadata: { seeded: true },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
