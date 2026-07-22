import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/core/lib/auth";
import { getCollaborator, updateCollaborator } from "@/core/lib/collaboration-data-access";
import { collaboratorUpdateSchema } from "@/core/domain/collaboration";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;
    const collaborator = await getCollaborator(sessionUser.groupId, id);

    if (!collaborator) {
      return NextResponse.json({ error: "Collaborator not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(collaborator);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Falha ao obter colaborador.", details, code: "GET_COLLABORATOR_ERROR" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const payload = collaboratorUpdateSchema.safeParse(body);

    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: payload.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const collaborator = await updateCollaborator(sessionUser.groupId, id, sessionUser.id, payload.data);
    return NextResponse.json(collaborator);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Falha ao atualizar colaborador.", details, code: "UPDATE_COLLABORATOR_ERROR" },
      { status: 500 },
    );
  }
}
