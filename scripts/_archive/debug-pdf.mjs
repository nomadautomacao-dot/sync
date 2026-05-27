import fs from 'fs';
import { PDFParse } from 'pdf-parse';

async function debugPDF(filePath) {
    console.log(`Lendo arquivo: ${filePath}`);
    let dataBuffer = fs.readFileSync(filePath);

    try {
        const parser = new PDFParse({ data: dataBuffer });
        const result = await parser.getText();

        // Vamos procurar por padrões de números e nomes
        const lines = result.text.split('\n');
        console.log(`Total de linhas encontradas: ${lines.length}`);

        console.log("Exemplo de 50 linhas do meio do arquivo:");
        const start = Math.floor(lines.length / 2);
        console.log(lines.slice(start, start + 50).join('\n'));

    } catch (error) {
        console.error("Erro ao processar PDF:", error);
    }
}

const path2024 = 'c:/Users/Adrie/Desktop/Sync/complementacao/2024.pdf';
debugPDF(path2024);
