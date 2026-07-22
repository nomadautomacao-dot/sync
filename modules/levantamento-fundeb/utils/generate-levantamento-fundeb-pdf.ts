import type { FundebRelatorioParametros, RelatorioFundeb } from "../types";

export type TipoRelatorio = "levantamento" | "executiva" | "comparativa";
export interface LevantamentoFundebAutonomoParams {
  codigo_ibge?: string;
  nome?: string;
  uf?: string;
  exercicio: number;
  parametros?: FundebRelatorioParametros;
}

const TIPOS_RELATORIO: TipoRelatorio[] = ["levantamento", "executiva", "comparativa"];

const NOMES_ARQUIVO: Record<TipoRelatorio, string> = {
  levantamento: "levantamento-fundeb",
  executiva:    "apresentacao-executiva-fundeb",
  comparativa:  "analise-comparativa-fundeb",
};

function getFilenameFromDisposition(disposition: string | null) {
  if (!disposition) {
    return null;
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = disposition.match(/filename="?([^"]+)"?/i);
  return asciiMatch?.[1] ?? null;
}

async function downloadPdfResponse(response: Response, fallbackName: string) {
  if (!response.ok) {
    let errorMessage = "Falha ao gerar o relatorio PDF.";
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignora erro de parse
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getFilenameFromDisposition(response.headers.get("Content-Disposition")) ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function generateLevantamentoFundebPdf(
  relatorio: RelatorioFundeb,
  tipo: TipoRelatorio = "levantamento"
) {
  const response = await fetch(`/api/modulos/levantamento-fundeb/pdf?tipo=${tipo}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(relatorio),
  });

  const safeName = (relatorio?.identificacao?.municipioNome || relatorio?.identificacao?.municipio || "cidade")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase();

  await downloadPdfResponse(response, `${NOMES_ARQUIVO[tipo]}-${safeName}.pdf`);
}

export async function generateLevantamentoFundebPdfAutonomo(
  params: LevantamentoFundebAutonomoParams,
  tipo: TipoRelatorio = "levantamento",
) {
  const response = await fetch(`/api/modulos/levantamento-fundeb/autonomo?tipo=${tipo}&formato=pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const baseName =
    params.nome ||
    params.codigo_ibge ||
    "municipio";
  const safeName = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase();

  await downloadPdfResponse(response, `${NOMES_ARQUIVO[tipo]}-${safeName}.pdf`);
}

export async function generateLevantamentoFundebPdfPackageAutonomo(
  params: LevantamentoFundebAutonomoParams,
  tipos: TipoRelatorio[] = TIPOS_RELATORIO,
) {
  for (const tipo of tipos) {
    await generateLevantamentoFundebPdfAutonomo(params, tipo);
  }
}

export async function generateMunicipalXrayPdfAutonomo(
  params: LevantamentoFundebAutonomoParams,
) {
  const response = await fetch("/api/modulos/levantamento-fundeb/raio-x", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const baseName = params.nome || params.codigo_ibge || "municipio";
  const safeName = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase();

  await downloadPdfResponse(response, `raio-x-municipal-${safeName}.pdf`);
}
