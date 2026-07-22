import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(filepath) {
  if (!existsSync(filepath)) {
    return;
  }

  const content = readFileSync(filepath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env"));
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "DATABASE_URL nao encontrado. Configure .env.local com sua connection string do Supabase.",
    );
    process.exit(1);
  }

  const groupSlug = process.env.SYNC_GROUP_SLUG?.trim() || "sync-default";
  const groupName = process.env.SYNC_GROUP_NAME?.trim() || "Sync Holdings";
  const adminEmail = process.env.SYNC_ADMIN_EMAIL?.trim() || "admin@sync.local";
  const adminName = process.env.SYNC_ADMIN_NAME?.trim() || "Admin Sync";

  const prisma = new PrismaClient({ log: ["error"] });

  try {
    console.log("Limpando dados operacionais (empresas, funcionarios e auditoria)...");
    await prisma.auditLog.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.company.deleteMany();

    console.log("Limpando usuarios e grupos antigos...");
    await prisma.user.deleteMany();
    await prisma.group.deleteMany();

    console.log("Recriando contexto minimo do workspace...");
    const group = await prisma.group.create({
      data: {
        slug: groupSlug,
        name: groupName,
      },
    });

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        groupId: group.id,
        groupRole: "owner",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "workspace.cleaned",
        userId: admin.id,
        metadata: { cleanedAt: new Date().toISOString() },
      },
    });

    console.log("Supabase limpo. Workspace pronto para seus dados.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
