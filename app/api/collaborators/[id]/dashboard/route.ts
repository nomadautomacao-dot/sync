import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/core/lib/auth";
import { getCollaboratorDashboard } from "@/core/lib/collaboration-data-access";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;
    const year = Number(request.nextUrl.searchParams.get("year") ?? new Date().getUTCFullYear());
    const dashboard = await getCollaboratorDashboard(sessionUser.groupId, id, year);

    if (!dashboard) {
      return NextResponse.json({ error: "Collaborator not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(dashboard);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Falha ao carregar dashboard do colaborador. Verifique se o banco esta sincronizado.", details, code: "COLLABORATOR_DASHBOARD_ERROR" },
      { status: 500 },
    );
  }
}

