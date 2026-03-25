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

function validateDatabaseUrl(databaseUrl) {
  const issues = [];
  const warnings = [];

  if (/\[YOUR-PASSWORD\]|<[^>]+>/i.test(databaseUrl)) {
    issues.push(
      "DATABASE_URL ainda contem placeholders. Substitua [YOUR-PASSWORD] e valores entre <...>.",
    );
    return { issues, warnings };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    issues.push("DATABASE_URL invalida. Verifique o formato da URI do Supabase.");
    return { issues, warnings };
  }

  const host = parsedUrl.hostname.toLowerCase();
  const username = decodeURIComponent(parsedUrl.username || "");

  if (host.includes("pooler.supabase.com") && !username.startsWith("postgres.")) {
    issues.push(
      "Para host pooler.supabase.com, use usuario no formato postgres.<project-ref>.",
    );
  }

  if (host.startsWith("db.") && username.startsWith("postgres.")) {
    warnings.push(
      "Para host db.<project-ref>.supabase.co, normalmente o usuario eh apenas postgres.",
    );
  }

  return { issues, warnings };
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env"));
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL nao encontrado em .env.local");
    process.exit(1);
  }

  const { issues, warnings } = validateDatabaseUrl(process.env.DATABASE_URL.trim());
  if (issues.length > 0) {
    console.error("DATABASE_URL invalida:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    console.error(
      "\nNo modal Connect do Supabase, copie novamente a URI e substitua apenas a senha.",
    );
    process.exit(1);
  }

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`Aviso: ${warning}`);
    }
  }

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: ["error"],
  });

  try {
    const result = await prisma.$queryRaw`SELECT current_database()::text as db, current_user::text as usr`;
    const row = Array.isArray(result) ? result[0] : null;
    console.log("Conexao OK com Supabase.");
    if (row && typeof row === "object") {
      const db = "db" in row ? row.db : "postgres";
      const usr = "usr" in row ? row.usr : "postgres";
      console.log(`Database: ${db} | User: ${usr}`);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido ao conectar no Supabase";
    console.error("Falha de conexao com Supabase:");
    console.error(message);

    if (message.includes("Tenant or user not found")) {
      console.error(
        "\nSugestao: credencial de banco invalida (usuario/senha) ou URL antiga.",
      );
      console.error(
        "1) No Supabase: Settings > Database > Reset database password",
      );
      console.error(
        "2) Copie novamente a connection string (pooler) e atualize DATABASE_URL/DIRECT_URL no .env.local",
      );
      console.error("3) Rode: npm run supabase:check");
    }

    if (message.includes("Can't reach database server")) {
      console.error(
        "\nSugestao: problema de rede/firewall com host/porta. Tente usar pooler 6543.",
      );
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
