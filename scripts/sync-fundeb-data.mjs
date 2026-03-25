import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function extractData(filePath, year) {
    console.log(`Lendo dados de ${year} em ${filePath}...`);
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();

    const lines = result.text.split('\n');
    const records = [];
    const rowRegex = /^([A-Z]{2})\s+(\d{7})\s+(.+?)\s+([\d\.,\s-]+)$/;

    for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(rowRegex);
        if (match) {
            const uf = match[1];
            const rawValues = match[4].trim();
            const values = rawValues.split(/\s+/).map(parseValue);

            if (values.length >= 6) {
                // PDF columns:
                // [0] Receita contribuicao | [1] VAAF | [2] VAAT | [3] VAAR | [4] Complementacao Uniao Total | [5] Total receitas
                // We map VAAF as Base(0)+VAAF(1), and Total as Total Receitas(5)
                const vaaf = values[0] + values[1];
                const vaat = values[2];
                const vaar = values[3];
                const total = values[5];

                records.push({
                    uf: uf,
                    municipio: match[3].trim().toUpperCase(),
                    ano: year,
                    vaaf: vaaf || 0,
                    vaat: vaat || 0,
                    vaar: vaar || 0,
                    total: total || 0
                });
            }
        }
    }
    return records;
}

function parseValue(valStr) {
    if (valStr === '-' || !valStr) return 0;
    const clean = valStr.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

async function run() {
    try {
        const complementacaoDir = 'c:/Users/Adrie/Desktop/Sync/complementacao';
        const sources = fs
            .readdirSync(complementacaoDir)
            .map((name) => {
                const match = name.match(/^(\d{4})\.pdf$/i);
                if (!match) return null;
                return {
                    year: Number(match[1]),
                    path: `${complementacaoDir}/${name}`,
                };
            })
            .filter((item) => item !== null)
            .sort((a, b) => a.year - b.year);

        if (sources.length === 0) {
            throw new Error("Nenhum PDF no formato AAAA.pdf foi encontrado na pasta complementacao.");
        }

        const extractedByYear = [];
        for (const source of sources) {
            const extracted = await extractData(source.path, source.year);
            extractedByYear.push({ year: source.year, data: extracted });
            console.log(`Total extraido ${source.year}: ${extracted.length}`);
        }

        const years = sources.map((s) => s.year);

        console.log(`Limpando dados antigos de ${years.join(", ")}...`);
        await prisma.caseSucessoFundeb.deleteMany({
            where: {
                ano: { in: years }
            }
        });

        console.log("Inserindo novos dados no banco...");

        // Inserir em lotes de 500 para evitar erros de payload imenso
        const allData = extractedByYear.flatMap((item) => item.data);
        const batchSize = 500;
        for (let i = 0; i < allData.length; i += batchSize) {
            const batch = allData.slice(i, i + batchSize);
            await prisma.caseSucessoFundeb.createMany({
                data: batch,
                skipDuplicates: true,
            });
            console.log(`Progresso: ${Math.min(i + batchSize, allData.length)} / ${allData.length}`);
        }

        console.log("Sincronizacao concluida com sucesso!");

    } catch (error) {
        console.error("Erro durante a sincronizacao:", error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
