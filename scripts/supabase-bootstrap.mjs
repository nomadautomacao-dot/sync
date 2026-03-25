import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

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

function run(command, envOverrides = {}) {
  console.log(`\n> ${command}`);
  execSync(command, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...envOverrides,
    },
  });
}

function toSessionPoolerUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    if (url.port === "6543") {
      url.port = "5432";
    }
    url.searchParams.delete("pgbouncer");
    url.searchParams.delete("connection_limit");
    return url.toString();
  } catch {
    return null;
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), ".env.local"));

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL nao encontrado. Configure .env.local com a connection string do Supabase.",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL.includes("supabase")) {
  console.warn(
    "Aviso: DATABASE_URL nao parece ser do Supabase. Continuando mesmo assim.",
  );
}

console.log("Iniciando bootstrap automatico do banco Supabase...");
run("npx prisma generate");
run("node scripts/supabase-check.mjs");

try {
  run("npx prisma db push --accept-data-loss");
} catch (error) {
  const sessionPoolerUrl = process.env.DATABASE_URL
    ? toSessionPoolerUrl(process.env.DATABASE_URL)
    : null;

  if (
    sessionPoolerUrl &&
    sessionPoolerUrl !== process.env.DIRECT_URL &&
    sessionPoolerUrl !== process.env.DATABASE_URL
  ) {
    try {
      console.warn(
        "\nFalha ao usar DIRECT_URL atual. Tentando session pooler (porta 5432) derivada do DATABASE_URL...",
      );
      run("npx prisma db push --accept-data-loss", {
        DIRECT_URL: sessionPoolerUrl,
      });
    } catch {
      console.warn(
        "\nFalha com session pooler 5432. Tentando fallback final com DATABASE_URL (pooler/6543)...",
      );
      run("npx prisma db push --accept-data-loss", {
        DIRECT_URL: process.env.DATABASE_URL,
      });
    }
  } else if (process.env.DATABASE_URL && process.env.DIRECT_URL !== process.env.DATABASE_URL) {
    console.warn(
      "\nFalha ao usar DIRECT_URL. Tentando fallback final com DATABASE_URL (pooler/6543)...",
    );
    run("npx prisma db push --accept-data-loss", {
      DIRECT_URL: process.env.DATABASE_URL,
    });
  } else {
    throw error;
  }
}

run("npx prisma db seed");
console.log("\nBootstrap finalizado com sucesso.");
