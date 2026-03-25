const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const data = [
        { municipio: "SAO PAULO", uf: "SP", ano: 2024, vaaf: 5200.45, vaat: 1200.30, vaar: 850.20, total: 7250.95 },
        { municipio: "SAO PAULO", uf: "SP", ano: 2025, vaaf: 5850.12, vaat: 1450.50, vaar: 920.80, total: 8221.42 },
        { municipio: "RIO DE JANEIRO", uf: "RJ", ano: 2024, vaaf: 4100.00, vaat: 1100.00, vaar: 700.00, total: 5900.00 },
        { municipio: "RIO DE JANEIRO", uf: "RJ", ano: 2025, vaaf: 4350.50, vaat: 1250.25, vaar: 780.15, total: 6380.90 },
        { municipio: "BELO HORIZONTE", uf: "MG", ano: 2024, vaaf: 3200.00, vaat: 950.00, vaar: 620.00, total: 4770.00 },
        { municipio: "BELO HORIZONTE", uf: "MG", ano: 2025, vaaf: 3100.00, vaat: 1050.00, vaar: 680.00, total: 4830.00 },
        { municipio: "FORTALEZA", uf: "CE", ano: 2024, vaaf: 2800.00, vaat: 800.00, vaar: 500.00, total: 4100.00 },
        { municipio: "FORTALEZA", uf: "CE", ano: 2025, vaaf: 3200.00, vaat: 950.00, vaar: 600.00, total: 4750.00 },
        { municipio: "MANAUS", uf: "AM", ano: 2024, vaaf: 2500.00, vaat: 700.00, vaar: 450.00, total: 3650.00 },
        { municipio: "MANAUS", uf: "AM", ano: 2025, vaaf: 2900.00, vaat: 850.00, vaar: 550.00, total: 4300.00 },
    ];

    console.log("Iniciando seed de Case Sucesso Fundeb...");

    for (const item of data) {
        await prisma.caseSucessoFundeb.upsert({
            where: {
                municipio_ano: {
                    municipio: item.municipio,
                    ano: item.ano,
                },
            },
            update: item,
            create: item,
        });
    }

    console.log("Seed finalizado com sucesso!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
