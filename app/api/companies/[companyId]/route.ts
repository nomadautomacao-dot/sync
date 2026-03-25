import { NextRequest, NextResponse } from "next/server";
import { companyUpdateSchema } from "@/core/domain/organization";
import { getSessionUser } from "@/core/lib/auth";
import { deleteCompany, getCompanyById, updateCompany } from "@/core/lib/data-access";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return NextResponse.json(
      { error: "Company not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json(company);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const body = await request.json();
  const payload = companyUpdateSchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json(
      {
        error: "Invalid update payload",
        details: payload.error.flatten(),
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const { companyId } = await params;
  const result = await updateCompany(companyId, payload.data, sessionUser.id);

  if ("error" in result) {
    return NextResponse.json(
      { error: "Update failed", details: result.error, code: "UPDATE_ERROR" },
      { status: 400 },
    );
  }

  return NextResponse.json(result.data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { companyId } = await params;
  const deleted = await deleteCompany(companyId, sessionUser.id);

  if (!deleted) {
    return NextResponse.json(
      { error: "Company not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
