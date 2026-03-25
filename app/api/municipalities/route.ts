import { NextRequest, NextResponse } from "next/server";
import { municipalityCreateSchema, municipalityStageSchema } from "@/core/domain/collaboration";
import { getSessionUser } from "@/core/lib/auth";
import { createMunicipality, listMunicipalities } from "@/core/lib/collaboration-data-access";

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const stage = request.nextUrl.searchParams.get("stage") ?? undefined;

  if (stage && !municipalityStageSchema.safeParse(stage).success) {
    return NextResponse.json({ error: "Invalid stage", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  const municipalities = await listMunicipalities(sessionUser.groupId, { search, stage });
  return NextResponse.json(municipalities);
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json();
  const payload = municipalityCreateSchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid municipality payload", details: payload.error.flatten(), code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const municipality = await createMunicipality(sessionUser.groupId, sessionUser.id, payload.data);
  return NextResponse.json(municipality, { status: 201 });
}
