import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PDFParse } from "pdf-parse";

const DEFAULT_DIR = path.join(os.homedir(), "Downloads");
const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_DIR;

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\r/g, "");
}

function parseBrazilianNumber(value) {
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

function round2(value) {
  return Math.round(value * 100) / 100;
}

function extractMoneyAfterLabel(text, label) {
  const pattern = new RegExp(`${label}\\s+R\\$\\s*([\\d\\.,]+)`, "i");
  const match = text.match(pattern);
  return parseBrazilianNumber(match?.[1] ?? null);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function computeCurrentModuleProjection(receitas) {
  const hasComplement =
    receitas.complementacaoVAAF > 0 ||
    receitas.complementacaoVAAT > 0 ||
    receitas.complementacaoVAAR > 0;

  if (!hasComplement) {
    return round2(receitas.totalReceitas * 1.7209);
  }

  return round2(
    receitas.receitaContribuicaoMunicipal +
      receitas.complementacaoVAAF * 1.4 +
      receitas.complementacaoVAAT * 1.3 +
      receitas.complementacaoVAAR * 1.25,
  );
}

function computeGlobalFactorProjection(receitas) {
  return round2(receitas.totalReceitas * 1.7209);
}

async function extractPdfMetrics(filePath) {
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  try {
    const result = await parser.getText();
    const rawText = result.text ?? "";
    const text = normalizeText(rawText);

    const receitaContribuicaoMunicipal = extractMoneyAfterLabel(
      text,
      "Receita de Contribuicao Municipal",
    );
    const complementacaoVAAF = extractMoneyAfterLabel(text, "Complementacao VAAF \\(Uniao\\)");
    const complementacaoVAAT = extractMoneyAfterLabel(text, "Complementacao VAAT \\(Uniao\\)");
    const complementacaoVAAR = extractMoneyAfterLabel(text, "Complementacao VAAR \\(Uniao\\)");
    const totalReceitas = extractMoneyAfterLabel(text, "TOTAL GERAL DE RECEITAS PREVISTAS");

    const totalProjetadoMatch = text.match(
      /VALOR TOTAL PROJETADO COM OTIMIZACAO ROCHA PRIME:\s*R\$\s*([\d\.,]+)/i,
    );
    const ganhoMatch = text.match(/Ganho Potencial Estimado:\s*\+?R\$\s*([\d\.,]+)/i);
    const ganhoPctMatch = text.match(/Ganho Potencial Estimado:[^\n]*\(([+\-]?[\d\.,]+)%\)/i);
    const municipioMatch = text.match(/Prefeito\(a\) Municipal de\s+([A-Z \-]+)\s+[-—]\s+([A-Z]{2})/i);

    return {
      fileName: path.basename(filePath),
      municipio:
        municipioMatch?.[1]?.trim().replace(/\s+/g, " ") ??
        path.basename(filePath, ".pdf").replace(/^relatorio_/i, ""),
      uf: municipioMatch?.[2] ?? null,
      receitas: {
        receitaContribuicaoMunicipal: receitaContribuicaoMunicipal ?? 0,
        complementacaoVAAF: complementacaoVAAF ?? 0,
        complementacaoVAAT: complementacaoVAAT ?? 0,
        complementacaoVAAR: complementacaoVAAR ?? 0,
        totalReceitas: totalReceitas ?? 0,
      },
      totalProjetadoModelo: parseBrazilianNumber(totalProjetadoMatch?.[1] ?? null),
      ganhoModelo: parseBrazilianNumber(ganhoMatch?.[1] ?? null),
      ganhoPercentualModelo: parseBrazilianNumber(ganhoPctMatch?.[1] ?? null),
    };
  } finally {
    await parser.destroy();
  }
}

async function main() {
  const files = fs
    .readdirSync(targetDir)
    .filter((name) => /^relatorio_.*\.pdf$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (files.length === 0) {
    throw new Error(`Nenhum PDF encontrado em ${targetDir}.`);
  }

  const analyses = [];

  for (const fileName of files) {
    const filePath = path.join(targetDir, fileName);
    const model = await extractPdfMetrics(filePath);

    if (!model.receitas.totalReceitas || !model.totalProjetadoModelo) {
      continue;
    }

    const moduleProjection = computeCurrentModuleProjection(model.receitas);
    const globalFactorProjection = computeGlobalFactorProjection(model.receitas);
    const moduleDiff = round2(moduleProjection - model.totalProjetadoModelo);
    const globalDiff = round2(globalFactorProjection - model.totalProjetadoModelo);

    analyses.push({
      fileName: model.fileName,
      municipio: model.municipio,
      uf: model.uf,
      receitas: model.receitas,
      totalProjetadoModelo: model.totalProjetadoModelo,
      ganhoModelo: model.ganhoModelo ?? round2(model.totalProjetadoModelo - model.receitas.totalReceitas),
      ganhoPercentualModelo:
        model.ganhoPercentualModelo ??
        round2(((model.totalProjetadoModelo - model.receitas.totalReceitas) / model.receitas.totalReceitas) * 100),
      moduleProjection,
      moduleDiff,
      moduleDiffPct: round2((moduleDiff / model.totalProjetadoModelo) * 100),
      globalFactorProjection,
      globalDiff,
      globalDiffPct: round2((globalDiff / model.totalProjetadoModelo) * 100),
    });
  }

  const summary = analyses.map((item) => ({
    municipio: item.uf ? `${item.municipio} - ${item.uf}` : item.municipio,
    totalAtual: formatCurrency(item.receitas.totalReceitas),
    totalModelo: formatCurrency(item.totalProjetadoModelo),
    formulaModulo: formatCurrency(item.moduleProjection),
    erroModuloPct: formatPercent(item.moduleDiffPct),
    fator17209: formatCurrency(item.globalFactorProjection),
    erro17209Pct: formatPercent(item.globalDiffPct),
  }));

  console.table(summary);

  const meanAbsModuleError =
    analyses.reduce((acc, item) => acc + Math.abs(item.moduleDiffPct), 0) / analyses.length;
  const meanAbsGlobalError =
    analyses.reduce((acc, item) => acc + Math.abs(item.globalDiffPct), 0) / analyses.length;

  console.log("");
  console.log(`Diretorio analisado: ${targetDir}`);
  console.log(`PDFs analisados: ${analyses.length}`);
  console.log(`Erro medio absoluto da formula atual do modulo: ${meanAbsModuleError.toFixed(2)}%`);
  console.log(`Erro medio absoluto do fator global 1.7209: ${meanAbsGlobalError.toFixed(2)}%`);

  const bestFit = analyses
    .slice()
    .sort((a, b) => Math.abs(a.moduleDiffPct) - Math.abs(b.moduleDiffPct))
    .slice(0, 5)
    .map((item) => `${item.municipio}: ${formatPercent(item.moduleDiffPct)}`);
  const worstFit = analyses
    .slice()
    .sort((a, b) => Math.abs(b.moduleDiffPct) - Math.abs(a.moduleDiffPct))
    .slice(0, 5)
    .map((item) => `${item.municipio}: ${formatPercent(item.moduleDiffPct)}`);

  console.log("");
  console.log("Melhores aderencias:");
  for (const line of bestFit) {
    console.log(`- ${line}`);
  }

  console.log("");
  console.log("Maiores desvios:");
  for (const line of worstFit) {
    console.log(`- ${line}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
