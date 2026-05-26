import { NextResponse } from "next/server";
import { getSessionUser } from "@/core/lib/auth";
import { moduleCatalog } from "@/core/domain/module";

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    return NextResponse.json(moduleCatalog);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Falha ao carregar catalogo de modulos.",
        details,
        code: "MODULES_LIST_ERROR",
      },
      { status: 500 },
    );
  }
}
