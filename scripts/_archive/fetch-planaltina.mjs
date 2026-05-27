import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();

async function main() {
    const data = await prisma.caseSucessoFundeb.findMany({
        where: { municipio: { contains: 'PLANALTINA' } }
    });
    fs.writeFileSync('out2.json', JSON.stringify(data, null, 2), 'utf8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
