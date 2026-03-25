import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/prisma";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ municipio: string }> }
) {
    const { municipio } = await params;
    const decodedMunicipio = decodeURIComponent(municipio);

    try {
        const data = await prisma.caseSucessoFundeb.findMany({
            where: {
                municipio: decodedMunicipio,
            },
            orderBy: {
                ano: "asc",
            },
        });

        const PRE_BASE_YEAR = 2024;
        const IMPLEMENTATION_YEAR = 2025;
        const RESULT_START_YEAR = 2026;

        const dataPreBase = data.find((d: any) => d.ano === PRE_BASE_YEAR) || null;
        const dataBase = data.find((d: any) => d.ano === IMPLEMENTATION_YEAR) || null;
        const targetCandidates = data.filter((d: any) => d.ano >= RESULT_START_YEAR);
        const dataTarget = targetCandidates.length > 0 ? targetCandidates[targetCandidates.length - 1] : null;

        const calculateDelta = (v24: number, v25: number) => {
            if (!v24) return 0;
            return ((v25 - v24) / v24) * 100;
        };

        const response = {
            municipio: decodedMunicipio,
            preBaseYear: dataPreBase?.ano ?? PRE_BASE_YEAR,
            baseYear: dataBase?.ano ?? IMPLEMENTATION_YEAR,
            targetYear: dataTarget?.ano ?? RESULT_START_YEAR,
            dataPreBase,
            dataBase,
            dataTarget,
            preDeltas: {
                vaaf: calculateDelta(dataPreBase?.vaaf || 0, dataBase?.vaaf || 0),
                vaat: calculateDelta(dataPreBase?.vaat || 0, dataBase?.vaat || 0),
                vaar: calculateDelta(dataPreBase?.vaar || 0, dataBase?.vaar || 0),
                total: calculateDelta(dataPreBase?.total || 0, dataBase?.total || 0),
            },
            deltas: {
                vaaf: calculateDelta(dataBase?.vaaf || 0, dataTarget?.vaaf || 0),
                vaat: calculateDelta(dataBase?.vaat || 0, dataTarget?.vaat || 0),
                vaar: calculateDelta(dataBase?.vaar || 0, dataTarget?.vaar || 0),
                total: calculateDelta(dataBase?.total || 0, dataTarget?.total || 0),
            },
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error(`Error fetching data for ${decodedMunicipio}:`, error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
