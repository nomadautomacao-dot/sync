import { NextRequest, NextResponse } from "next/server";
import { companyCreateSchema } from "@/core/domain/organization";
import { getSessionUser } from "@/core/lib/auth";
import { createCompany, listCompanies } from "@/core/lib/data-access";

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const search = request.nextUrl.searchParams.get("search") ?? undefined;
    const status = request.nextUrl.searchParams.get("status") ?? undefined;

    const companies = await listCompanies({ search, status });
    return NextResponse.json(companies);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Falha ao listar empresas. Verifique se o banco esta sincronizado.",
        details,
        code: "LIST_COMPANIES_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const payload = companyCreateSchema.safeParse(body);
    if (!payload.success) {
      return NextResponse.json(
        {
          error: "Invalid company payload",
          details: payload.error.flatten(),
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const result = await createCompany(payload.data, sessionUser.id);

    if ("error" in result) {
      return NextResponse.json(
        {
          error: "Invalid company payload",
          details: result.error,
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Falha ao criar empresa. Verifique configuracao do banco.",
        details,
        code: "CREATE_COMPANY_ERROR",
      },
      { status: 500 },
    );
  }
}
