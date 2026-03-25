import { NextRequest, NextResponse } from "next/server";
import { searchFndeObrasMunicipios } from "@/core/lib/fnde-obras";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const uf = request.nextUrl.searchParams.get("uf") ?? undefined;

  if (query.trim().length < 2) {
    return NextResponse.json({
      success: true,
      data: { total: 0, items: [] },
    });
  }

  const items = await searchFndeObrasMunicipios(query, uf).catch(() => []);

  return NextResponse.json({
    success: true,
    data: { total: items.length, items },
  });
}
