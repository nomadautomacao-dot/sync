import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/prisma";

export async function GET() {
    try {
        const municipios = await prisma.caseSucessoFundeb.findMany({
            select: {
                municipio: true,
            },
            distinct: ["municipio"],
            orderBy: {
                municipio: "asc",
            },
        });

        return NextResponse.json(municipios.map((m: { municipio: string }) => m.municipio));
    } catch (error) {
        console.error("Error fetching municipios:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
