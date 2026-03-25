import { NextRequest, NextResponse } from "next/server";
import { employeeQuerySchema } from "@/core/domain/organization";
import { getSessionUser } from "@/core/lib/auth";
import { createEmployee, listEmployees } from "@/core/lib/data-access";

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const query = employeeQuerySchema.safeParse({
      companyId: request.nextUrl.searchParams.get("companyId") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined,
    });

    if (!query.success) {
      return NextResponse.json(
        {
          error: "Invalid query params",
          details: query.error.flatten(),
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const employees = await listEmployees(query.data);
    return NextResponse.json(employees);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Falha ao listar funcionarios. Verifique se o banco esta sincronizado.",
        details,
        code: "LIST_EMPLOYEES_ERROR",
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
    const result = await createEmployee(body, sessionUser.id);

    if ("error" in result) {
      return NextResponse.json(
        {
          error: "Invalid employee payload",
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
        error: "Falha ao criar funcionario. Verifique configuracao do banco.",
        details,
        code: "CREATE_EMPLOYEE_ERROR",
      },
      { status: 500 },
    );
  }
}

