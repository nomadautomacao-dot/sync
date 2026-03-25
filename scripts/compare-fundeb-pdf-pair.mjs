import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";

export function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\r/g, "");
}

export function parseBrazilianNumber(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseLooseDecimal(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function round2(value) {
  return Math.round(value * 100) / 100;
}

export function round6(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function extractFirst(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] ?? match[0];
    }
  }

  return null;
}

export function extractGeneratedMetrics(text) {
  const totalAtual = parseBrazilianNumber(
    extractFirst(text, [/TOTAL\s+R\$\s*([\d\.,]+)\s+R\$\s*[\d\.,]+\s+R\$\s*[\d\.,]+/i]),
  );
  const totalProjetado = parseBrazilianNumber(
    extractFirst(text, [/TOTAL\s+R\$\s*[\d\.,]+\s+R\$\s*([\d\.,]+)\s+R\$\s*[\d\.,]+/i]),
  );
  const totalGanho = parseBrazilianNumber(
    extractFirst(text, [/TOTAL\s+R\$\s*[\d\.,]+\s+R\$\s*[\d\.,]+\s+R\$\s*([\d\.,]+)/i]),
  );
  const score = parseLooseDecimal(extractFirst(text, [/Score comercial\s+([\d\.,]+)/i]));
  const multiplicador = parseBrazilianNumber(extractFirst(text, [/Multiplicador\s+([\d\.,]+)x/i]));
  const matriculas = parseBrazilianNumber(extractFirst(text, [/Matriculas\s+([\d\.,]+)/i]));
  const docentes = parseBrazilianNumber(extractFirst(text, [/Docentes\s+([\d\.,]+)/i]));
  const escolas = parseBrazilianNumber(extractFirst(text, [/Escolas\s+([\d\.,]+)/i]));

  return { totalAtual, totalProjetado, totalGanho, score, multiplicador, escolas, matriculas, docentes };
}

export function extractLegacyMetrics(text) {
  const censoBlock = text.match(
    /Fonte: QEdu[\s\S]*?\n([\d\.,]+)\s+Escolas\s+([\d\.,]+)\s+Total de Matriculas\s+([\d\.,]+)\s+Total de Docentes/i,
  );
  const totalAtualParsed = parseBrazilianNumber(
    extractFirst(text, [/TOTAL GERAL\s+R\$\s*([\d\.,]+)\s+R\$\s*[\d\.,]+\+?R\$\s*[\d\.,]+/i]),
  );
  const totalProjetado = parseBrazilianNumber(
    extractFirst(text, [/VALOR TOTAL PROJETADO COM OTIMIZACAO ROCHA PRIME:\s*R\$\s*([\d\.,]+)/i]),
  );
  const totalGanho = parseBrazilianNumber(
    extractFirst(text, [/Ganho Potencial Estimado:\s*\+?R\$\s*([\d\.,]+)/i]),
  );
  const totalAtual =
    totalAtualParsed ?? (totalProjetado !== null && totalGanho !== null ? round2(totalProjetado - totalGanho) : null);
  const escolas = parseBrazilianNumber(censoBlock?.[1] ?? null);
  const matriculas = parseBrazilianNumber(censoBlock?.[2] ?? null);
  const docentes = parseBrazilianNumber(censoBlock?.[3] ?? null);

  return { totalAtual, totalProjetado, totalGanho, escolas, matriculas, docentes };
}

export async function extractText(filePath) {
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  try {
    const result = await parser.getText();
    return normalizeText(result.text ?? "");
  } finally {
    await parser.destroy();
  }
}

export async function compareFundebPdfPair(generatedPath, legacyPath) {
  const [generatedText, legacyText] = await Promise.all([
    extractText(path.resolve(generatedPath)),
    extractText(path.resolve(legacyPath)),
  ]);

  const generated = extractGeneratedMetrics(generatedText);
  const legacy = extractLegacyMetrics(legacyText);

  const generatedMultiplier =
    generated.totalAtual && generated.totalProjetado
      ? round6(generated.totalProjetado / generated.totalAtual)
      : null;
  const legacyMultiplier =
    legacy.totalAtual && legacy.totalProjetado ? round6(legacy.totalProjetado / legacy.totalAtual) : null;
  const multiplierGapPct =
    generatedMultiplier && legacyMultiplier
      ? round2(((generatedMultiplier - legacyMultiplier) / legacyMultiplier) * 100)
      : null;
  const projectedGapPct =
    generated.totalProjetado && legacy.totalProjetado
      ? round2(((generated.totalProjetado - legacy.totalProjetado) / legacy.totalProjetado) * 100)
      : null;

  return {
    generated,
    legacy,
    generatedMultiplier,
    legacyMultiplier,
    multiplierGapPct,
    projectedGapPct,
  };
}

export function printComparison(result) {
  const { generated, legacy, generatedMultiplier, legacyMultiplier, multiplierGapPct, projectedGapPct } = result;

  console.log("");
  console.log("Comparativo FUNDEB - PDF gerado x PDF legado");
  console.log("");
  console.table([
    {
      base: "gerado",
      totalAtual: formatCurrency(generated.totalAtual),
      totalProjetado: formatCurrency(generated.totalProjetado),
      ganho: formatCurrency(generated.totalGanho),
      multiplicador: generatedMultiplier ?? generated.multiplicador ?? "-",
      escolas: generated.escolas ?? "-",
      matriculas: generated.matriculas ?? "-",
      docentes: generated.docentes ?? "-",
    },
    {
      base: "legado",
      totalAtual: formatCurrency(legacy.totalAtual),
      totalProjetado: formatCurrency(legacy.totalProjetado),
      ganho: formatCurrency(legacy.totalGanho),
      multiplicador: legacyMultiplier ?? "-",
      escolas: legacy.escolas ?? "-",
      matriculas: legacy.matriculas ?? "-",
      docentes: legacy.docentes ?? "-",
    },
  ]);

  console.log(`Multiplicador implicito legado: ${legacyMultiplier ?? "-"}`);
  console.log(`Multiplicador do PDF gerado: ${generatedMultiplier ?? "-"}`);
  console.log(`Desvio percentual do multiplicador: ${multiplierGapPct !== null ? `${multiplierGapPct}%` : "-"}`);
  console.log(`Desvio percentual do total projetado: ${projectedGapPct !== null ? `${projectedGapPct}%` : "-"}`);

  if (generated.score !== null) {
    console.log(`Score comercial atual: ${generated.score}`);
  }
}

async function main() {
  const [generatedPath, legacyPath] = process.argv.slice(2);

  if (!generatedPath || !legacyPath) {
    throw new Error("Uso: node scripts/compare-fundeb-pdf-pair.mjs <pdf-gerado> <pdf-legado>");
  }

  const result = await compareFundebPdfPair(generatedPath, legacyPath);
  printComparison(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
