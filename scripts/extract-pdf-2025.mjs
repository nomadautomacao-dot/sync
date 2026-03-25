import fs from 'fs';
import { PDFParse } from 'pdf-parse';

async function extractData(filePath, year) {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();

    const lines = result.text.split('\n');
    const records = [];

    // UF PODER_IBGE MUNICIPIO ...VALORES
    const rowRegex = /^([A-Z]{2})\s+(\d{7})\s+(.+?)\s+([\d\.,\s-]+)$/;

    for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(rowRegex);
        if (match) {
            const uf = match[1];
            const rawValues = match[4].trim();
            const values = rawValues.split(/\s+/).map(parseValue);

            if (values.length >= 6) {
                const vaaf = values[1];
                const vaat = values[2];
                const vaar = values[3];
                const total = values[4];

                records.push({
                    uf: uf,
                    municipio: match[3].trim(),
                    ano: year,
                    vaaf: vaaf || 0,
                    vaat: vaat || 0,
                    vaar: vaar || 0,
                    total: total || 0
                });
            }
        }
    }

    console.log(`Found ${records.length} records in ${year}`);
    if (records.length > 0) {
        console.log(`Sample ${year}:`, JSON.stringify(records[0], null, 2));
    }
    return records;
}

function parseValue(valStr) {
    if (valStr === '-' || !valStr) return 0;
    const clean = valStr.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

const path2025 = 'c:/Users/Adrie/Desktop/Sync/complementacao/2025.pdf';
extractData(path2025, 2025);
