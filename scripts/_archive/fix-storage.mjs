import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filepath) {
    if (!existsSync(filepath)) return;
    const content = readFileSync(filepath, "utf8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex < 0) continue;
        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
    }
}

async function checkStorage() {
    loadEnvFile(resolve(process.cwd(), ".env.local"));

    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const bucket = "company-logos";

    if (!supabaseUrl || !serviceRoleKey) {
        console.error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configurados.");
        return;
    }

    console.log(`Checking bucket "${bucket}" at ${supabaseUrl}...`);

    try {
        const response = await fetch(`${supabaseUrl}/storage/v1/bucket/${bucket}`, {
            headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                apikey: serviceRoleKey,
            },
        });

        if (response.ok) {
            console.log(`✅ Bucket "${bucket}" existe.`);
        } else {
            const errorText = await response.text();
            console.log(`❌ Bucket "${bucket}" nao encontrado ou erro: ${response.status}`);
            console.log(`Detalhes: ${errorText}`);

            if (response.status === 404 || errorText.includes("not found")) {
                console.log(`Tentando criar bucket "${bucket}"...`);
                const createResponse = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${serviceRoleKey}`,
                        apikey: serviceRoleKey,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        id: bucket,
                        name: bucket,
                        public: true,
                    }),
                });

                if (createResponse.ok) {
                    console.log(`✅ Bucket "${bucket}" criado com sucesso.`);
                } else {
                    console.error(`❌ Falha ao criar bucket: ${createResponse.status}`);
                    console.error(await createResponse.text());
                }
            }
        }
    } catch (error) {
        console.error("Erro ao verificar storage:", error);
    }
}

checkStorage();
