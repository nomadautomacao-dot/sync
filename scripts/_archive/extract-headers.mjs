import fs from 'fs';
import { PDFParse } from 'pdf-parse';

async function run() {
    const dataBuffer = fs.readFileSync('c:/Users/Adrie/Desktop/Sync/complementacao/2026.pdf');
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    const lines = result.text.split('\n');
    const rowRegex = /^([A-Z]{2})\s+(\d{7})\s+(.+?)\s+([\d\.,\s-]+)$/;

    for (const line of lines) {
        if (line.includes('PLANALTINA ') && line.startsWith('GO')) {
            const trimmed = line.trim();
            const match = trimmed.match(rowRegex);
            console.log("LINE:", line);
            console.log("MATCH:", match[4]);
            const values = match[4].trim().split(/\s+/);
            console.log("VALUES:", values);
        }
    }
}

run().catch(console.error);
