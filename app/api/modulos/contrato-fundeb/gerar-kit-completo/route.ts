/**
 * POST /api/modulos/contrato-fundeb/gerar-kit-completo
 *
 * Gera o Kit Documental completo (14 DOCXs + documentação habilitatória)
 * em formato ZIP, aceitando multipart/form-data com:
 *   - Campo "contrato": JSON stringified dos dados ContratosFundebData
 *   - Campos de arquivo por categoria: "societario", "certidoes", "atestados",
 *     "contratos", "notas_fiscais", "proposta", "documentos_socios"
 *
 * Response: application/zip (download do arquivo)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  gerarKitContratoComAnexosZip,
  type AnexoHabilitacao,
} from "@/modules/contrato-fundeb/services/contrato-docx-generator";
import type { ContratosFundebData } from "@/modules/contrato-fundeb/types";
import { registrarErro } from "@/core/lib/structured-log";

/** Categorias válidas para os arquivos de habilitação */
const CATEGORIAS_VALIDAS = [
  "societario",
  "certidoes",
  "atestados",
  "contratos",
  "notas_fiscais",
  "proposta",
  "documentos_socios",
] as const;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // 1. Extrair dados do contrato (campo JSON)
    const contratoRaw = formData.get("contrato");
    if (!contratoRaw || typeof contratoRaw !== "string") {
      return NextResponse.json(
        {
          success: false,
          error:
            'O campo "contrato" (JSON) é obrigatório no formulário multipart.',
        },
        { status: 400 },
      );
    }

    let contratoData: ContratosFundebData;
    try {
      contratoData = JSON.parse(contratoRaw) as ContratosFundebData;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'O campo "contrato" contém JSON inválido.',
        },
        { status: 400 },
      );
    }

    if (!contratoData.municipioNome || !contratoData.empresaRazaoSocial) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nome do município e Razão Social da empresa contratada são obrigatórios.",
        },
        { status: 400 },
      );
    }

    // 2. Extrair arquivos anexos por categoria
    const anexos: AnexoHabilitacao[] = [];

    for (const categoria of CATEGORIAS_VALIDAS) {
      const files = formData.getAll(categoria);
      for (const file of files) {
        if (file instanceof File) {
          const arrayBuffer = await file.arrayBuffer();
          anexos.push({
            categoria,
            nomeArquivo: file.name,
            buffer: Buffer.from(arrayBuffer),
          });
        }
      }
    }

    console.log(
      `[gerar-kit-completo] Município: ${contratoData.municipioNome}, ` +
        `Anexos habilitatórios: ${anexos.length} arquivo(s) em ` +
        `${new Set(anexos.map((a) => a.categoria)).size} categoria(s)`,
    );

    // 3. Gerar o ZIP completo (14 DOCXs + anexos)
    const zipBuffer = await gerarKitContratoComAnexosZip(
      contratoData,
      anexos,
    );

    // 4. Slugify o nome do município para o nome do arquivo
    const slugMunicipio = contratoData.municipioNome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const zipFilename = `Kit_Inexigibilidade_FUNDEB_${slugMunicipio}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (error) {
    registrarErro("contrato-fundeb/gerar-kit-completo", error);
    return NextResponse.json(
      {
        success: false,
        error:
          "Falha ao gerar o kit completo de documentos. Verifique os dados informados.",
        details:
          error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}
