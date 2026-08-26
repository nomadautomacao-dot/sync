/**
 * API Route: POST /api/contratos-fundeb/generate-kit
 *
 * Gera o kit completo de 14 documentos DOCX em formato ZIP.
 * Aceita dois modos:
 *   1. Dados completos (ContratosFundebData) → gera o ZIP imediatamente
 *   2. Município + UF → executa o agente IA + gera o ZIP
 *
 * Body modo 1 (dados diretos):
 *   { "contrato": { ...ContratosFundebData } }
 *
 * Body modo 2 (agente + geração):
 *   { "municipioNome": "Barreiras", "uf": "BA", ... }
 *
 * Response: application/zip (download do arquivo)
 */

import { NextRequest, NextResponse } from "next/server";
import { executeContratoAgent } from "@/modules/contrato-fundeb/services/contrato-agent";
import {
  gerarKitContratoZip,
  rotuloDoCampo,
  type AnexoDeHabilitacao,
} from "@/modules/contrato-fundeb/services/contrato-docx-generator";
import type { ContratosFundebData } from "@/modules/contrato-fundeb/types";
import { registrarErro } from "@/core/lib/structured-log";
import { codificarResumoDoKit } from "@/core/domain/kit-resumo";

/**
 * A habilitação chega do cliente já resolvida (caminho + URL do Storage), e
 * não é lida aqui do Firestore: quem tem sessão é o browser, e esta rota
 * atende também o smoke test, sem login. Só aceitamos URLs do Storage do
 * projeto — um `caminho`/`url` arbitrário viraria o servidor num buscador de
 * qualquer endereço que alguém mandasse.
 */
function anexosDeHabilitacao(valor: unknown): AnexoDeHabilitacao[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { caminho, url } = item as Record<string, unknown>;
    if (typeof caminho !== "string" || typeof url !== "string") return [];
    if (!caminho.startsWith("Habilitacao/") || caminho.includes("..")) return [];
    if (
      !/^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com)\//.test(url)
    ) {
      return [];
    }
    return [{ caminho, url }];
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let contratoData: ContratosFundebData;

    if (body.contrato) {
      // Modo 1: Dados diretos fornecidos
      contratoData = body.contrato as ContratosFundebData;
    } else if (body.municipioNome && body.uf) {
      // Modo 2: Executar o agente primeiro
      const agentResult = await executeContratoAgent({
        municipioNome: body.municipioNome,
        uf: body.uf,
        codigoIBGE: body.codigoIBGE,
        exercicio: body.exercicio,
        valorMensal: body.valorMensal,
        quantidadeMeses: body.quantidadeMeses,
        skipGemini: body.skipGemini ?? false,
      });

      if (!agentResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Agente não conseguiu resolver o município.",
            warnings: agentResult.warnings,
          },
          { status: 404 },
        );
      }

      contratoData = agentResult.contrato;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Forneça 'contrato' (dados diretos) ou 'municipioNome' + 'uf' (modo agente).",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    // Gerar o ZIP com 14 DOCXs + a habilitação anexada da empresa
    const { buffer: zipBuffer, pendencias, avisos } = await gerarKitContratoZip(
      contratoData,
      anexosDeHabilitacao(body.habilitacao),
    );

    // O nome do arquivo acompanha a via: um processo de dispensa entregue num
    // ZIP chamado "Kit_Inexigibilidade" começa contradizendo a própria capa.
    const nomeDaVia = contratoData.via === "inexigibilidade" ? "Inexigibilidade" : "Dispensa";
    const nomeArquivo = `Kit_${nomeDaVia}_FUNDEB_${(contratoData.municipioNome || "municipio")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .toLowerCase()}.zip`;

    /* O corpo é o ZIP, então o que a tela precisa saber viaja em cabeçalho.
       Os dois vão em Base64 porque cabeçalho HTTP é ASCII e nome de campo com
       acento ("Secretário") derrubaria a resposta inteira — a mesma armadilha
       do Content-Disposition com nome de município acentuado.

       `Access-Control-Expose-Headers` não é decoração: sem ele o `fetch` do
       browser esconde qualquer cabeçalho fora da lista padrão, e a tela leria
       `null` achando que não há pendência nenhuma. */
    const resumo = codificarResumoDoKit({
      pendencias: pendencias.map(rotuloDoCampo),
      avisos,
    });

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Content-Length": String(zipBuffer.length),
        "X-Kit-Resumo": resumo,
        "Access-Control-Expose-Headers": "X-Kit-Resumo, Content-Disposition",
      },
    });
  } catch (error) {
    registrarErro("api/contratos-fundeb/generate-kit", error);
    return NextResponse.json(
      {
        success: false,
        error: "Falha ao gerar o kit de contratos.",
        details: error instanceof Error ? error.message : "Erro desconhecido",
        code: "KIT_GENERATION_ERROR",
      },
      { status: 500 },
    );
  }
}
