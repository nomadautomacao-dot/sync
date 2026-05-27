import { NextRequest, NextResponse } from "next/server";
import { gerarKitContratoZip } from "@/modules/contrato-fundeb/services/contrato-docx-generator";
import { ContratosFundebData } from "@/modules/contrato-fundeb/types";

export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as ContratosFundebData;

    if (!data.municipioNome || !data.empresaRazaoSocial) {
      return NextResponse.json(
        { success: false, error: "Nome do município e Razão Social da empresa contratada são obrigatórios." },
        { status: 400 },
      );
    }

    // Gerar o buffer binário do ZIP contendo os 15 anexos modularizados
    const zipBuffer = await gerarKitContratoZip(data);

    // Slugify o nome do município para o nome do arquivo ZIP
    const slugMunicipio = data.municipioNome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const zipFilename = `Kit_Inexigibilidade_FUNDEB_${slugMunicipio}.zip`;

    // Retorna a resposta binária
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (error) {
    console.error("Erro ao gerar o kit de documentos FUNDEB:", error);
    return NextResponse.json(
      { success: false, error: "Falha ao gerar o lote de documentos. Verifique os dados informados." },
      { status: 500 },
    );
  }
}
