import { NextRequest, NextResponse } from "next/server";
import { collaboratorCreateSchema, collaboratorQuerySchema } from "@/core/domain/collaboration";
import { getSessionUser } from "@/core/lib/auth";
import { createCollaborator, listCollaborators } from "@/core/lib/collaboration-data-access";

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const query = collaboratorQuerySchema.safeParse({
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      type: request.nextUrl.searchParams.get("type") ?? undefined,
      year: request.nextUrl.searchParams.get("year") ?? undefined,
    });

    if (!query.success) {
      return NextResponse.json(
        { error: "Invalid query params", details: query.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const collaborators = await listCollaborators(sessionUser.groupId, query.data);
    return NextResponse.json(collaborators);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Falha ao listar colaboradores. Verifique se o banco esta sincronizado.", details, code: "LIST_COLLABORATORS_ERROR" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const payload = collaboratorCreateSchema.safeParse(body);
    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid collaborator payload", details: payload.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const collaborator = await createCollaborator(sessionUser.groupId, sessionUser.id, payload.data);
    return NextResponse.json(collaborator, { status: 201 });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Falha ao criar colaborador. Verifique se o banco esta sincronizado.", details, code: "CREATE_COLLABORATOR_ERROR" },
      { status: 500 },
    );
  }
}

