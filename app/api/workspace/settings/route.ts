import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/core/lib/auth";
import { prisma } from "@/core/lib/prisma";

const defaultSettings = {
  empresaPadrao: {
    nome: "ROCHA PRIME SERVICOS ESPECIALIZADOS LTDA",
    cnpj: "29.342.691/0001-93",
    endereco: "Rua PLANALTO n 305, Sandra Regina",
    cep: "47.802-064",
    cidade: "Barreiras",
    uf: "BA",
  },
};

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const group = await prisma.group.findFirst({
      where: { id: sessionUser.groupId },
      select: {
        id: true,
        name: true,
        slug: true,
        settings: true,
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Workspace nao encontrado.", code: "WORKSPACE_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: group.id,
      name: group.name,
      slug: group.slug,
      settings: {
        ...defaultSettings,
        ...((group.settings as Record<string, unknown> | null) ?? {}),
      },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Falha ao carregar configuracoes do workspace.",
        details,
        code: "WORKSPACE_SETTINGS_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      settings?: Record<string, unknown>;
    };

    const name = body.name?.trim();
    const slug = body.slug?.trim();

    if (!name || !slug) {
      return NextResponse.json(
        {
          error: "Nome e slug sao obrigatorios.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const group = await prisma.group.update({
      where: { id: sessionUser.groupId },
      data: {
        name,
        slug,
        settings: (body.settings ?? defaultSettings) as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        settings: true,
      },
    });

    return NextResponse.json({
      id: group.id,
      name: group.name,
      slug: group.slug,
      settings: {
        ...defaultSettings,
        ...((group.settings as Record<string, unknown> | null) ?? {}),
      },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Falha ao salvar configuracoes do workspace.",
        details,
        code: "UPDATE_WORKSPACE_SETTINGS_ERROR",
      },
      { status: 500 },
    );
  }
}
