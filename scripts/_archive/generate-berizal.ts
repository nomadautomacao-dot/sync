import { buildFundebComparativeSnapshot } from "../core/lib/fundeb-comparative";
import { buildGoviaMunicipioCompleto } from "../core/lib/govia-compat";
import { generateFundebPdfBuffer } from "../core/lib/fundeb-pdf";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log("Iniciando geracao do PDF com dados reais da base (Berizal)...");
    const data = await buildGoviaMunicipioCompleto({
        codigo_ibge: "3106655", // Berizal IBGE code
        exercicio: 2026,
    });

    if (!data) {
        console.error("Município não encontrado.");
        return;
    }

    const comparativeSnapshot = await buildFundebComparativeSnapshot(data.relatorio);
    const pdfPayload = comparativeSnapshot?.comparativaPdfInput ?? data.relatorio;

    const { pdfBuffer, filename } = await generateFundebPdfBuffer(pdfPayload, "comparativa", data.relatorio);

    const dest = path.join(process.cwd(), "outputs", filename);
    fs.writeFileSync(dest, pdfBuffer);
    console.log(`PDF gerado e salvo em: ${dest}`);
}

main().catch((err) => {
    console.error("Erro absoluto:", err);
    process.exit(1);
});
