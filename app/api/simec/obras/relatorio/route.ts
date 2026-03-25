import { NextRequest, NextResponse } from "next/server";
import { getFndeObrasEnrichment } from "@/core/lib/fnde-obras";

export async function GET(request: NextRequest) {
  const municipio = request.nextUrl.searchParams.get("municipio") ?? "";
  const uf = request.nextUrl.searchParams.get("uf") ?? "";

  if (!municipio.trim() || uf.trim().length !== 2) {
    return NextResponse.json({
      success: true,
      data: null,
    });
  }

  const data = await getFndeObrasEnrichment({ municipio, uf }).catch(() => null);

  return NextResponse.json({
    success: true,
    data,
  });
}
