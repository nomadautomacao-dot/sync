import { NextRequest, NextResponse } from "next/server";
import { fundebConsultingProjectCreateSchema } from "@/core/domain/fundeb-consulting";
import { getSessionUser } from "@/core/lib/auth";
import {
  createFundebConsultingProject,
  getFundebConsultingWorkspace,
} from "@/core/lib/fundeb-consulting-data-access";

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const year = Number(request.nextUrl.searchParams.get("year") ?? new Date().getUTCFullYear());
    const workspace = await getFundebConsultingWorkspace(sessionUser.groupId, year);
    return NextResponse.json(workspace);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Falha ao carregar o modulo de consultoria FUNDEB.",
        details,
        code: "FUNDEB_CONSULTING_WORKSPACE_ERROR",
      },
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
    const payload = fundebConsultingProjectCreateSchema.safeParse(body);
    if (!payload.success) {
      return NextResponse.json(
        {
          error: "Invalid FUNDEB consulting payload",
          details: payload.error.flatten(),
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const project = await createFundebConsultingProject(sessionUser.groupId, sessionUser.id, payload.data);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Falha ao criar operacao de consultoria FUNDEB.",
        details,
        code: "CREATE_FUNDEB_CONSULTING_PROJECT_ERROR",
      },
      { status: 500 },
    );
  }
}
