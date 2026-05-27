import fs from 'fs';
import { PDFParse } from 'pdf-parse';

async function extractData(filePath, year) {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();

    // Pattern based on sample:
    // AC 1200054 BRASILEIA 26.722.509,51 3.232.546,15 314.898,10 3.547.444,25 30.269.953,76
    // UF PODER_IBGE MUNICIPIO VAAF VAAT VAAR TOTAL

    const lines = result.text.split('\n');
    const records = [];

    // Refined regex: UF(2) ID(7) NAME(anything but numbers) (4 or 5 numbers)
    // Sometimes there's an extra value. Let's look for exactly 4 or 5 sequences of dots/commas at the end.
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
        console.log("Sample 1:", JSON.stringify(records[0], null, 2));
        console.log("Sample 2:", JSON.stringify(records[records.length - 1], null, 2));
    }

    return records;
}

function parseValue(valStr) {
    if (valStr === '-' || !valStr) return 0;
    const clean = valStr.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

const path2024 = 'c:/Users/Adrie/Desktop/Sync/complementacao/2024.pdf';
extractData(path2024, 2024);
