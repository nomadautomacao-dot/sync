import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/core/lib/auth";
import { getExecutiveDashboard } from "@/core/lib/collaboration-data-access";

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const year = Number(request.nextUrl.searchParams.get("year") ?? new Date().getUTCFullYear());
    const dashboard = await getExecutiveDashboard(sessionUser.groupId, year);
    return NextResponse.json(dashboard);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Falha ao carregar dashboard executivo. Verifique se o banco esta sincronizado.", details, code: "EXECUTIVE_DASHBOARD_ERROR" },
      { status: 500 },
    );
  }
}

