import { NextRequest, NextResponse } from "next/server";
import { gerarKitContratoZip } from "@/modules/contrato-fundeb/services/contrato-docx-generator";
import { ContratosFundebData } from "@/modules/contrato-fundeb/types";
import { registrarErro } from "@/core/lib/structured-log";

export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as ContratosFundebData;

    /* Só o município é obrigatório. A razão social da contratada saiu da
       exigência porque ela não vem de quem pede: é constante da Global, em
       `core/domain/empresa.ts`, e o gerador a preenche sozinho — cobrá-la aqui
       barrava o kit por um campo que o próprio servidor conhece. */
    if (!data.municipioNome) {
      return NextResponse.json(
        { success: false, error: "Nome do município é obrigatório." },
        { status: 400 },
      );
    }

    // Gerar o buffer binário do ZIP contendo os 14 anexos modularizados
    const { buffer: zipBuffer } = await gerarKitContratoZip(data);

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
    registrarErro("Erro ao gerar o kit de documentos FUNDEB", error);
    return NextResponse.json(
      { success: false, error: "Falha ao gerar o lote de documentos. Verifique os dados informados." },
      { status: 500 },
    );
  }
}
