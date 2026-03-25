import { NextResponse } from "next/server";
import { getFndeObrasDatasetStatus } from "@/core/lib/fnde-obras";

export async function GET() {
  const status = await getFndeObrasDatasetStatus().catch(() => null);

  return NextResponse.json({
    success: true,
    data:
      status ?? {
        disponivel: false,
        arquivo: "",
        linhasCarregadas: 0,
        municipiosComObras: 0,
        repassesInfraestrutura: 0,
        carregadoEm: new Date().toISOString(),
      },
  });
}
