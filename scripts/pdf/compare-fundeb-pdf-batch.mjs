import fs from "node:fs";
import path from "node:path";

import { compareFundebPdfPair, round2, round6 } from "./compare-fundeb-pdf-pair.mjs";

function normalizeSlug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/^levantamento-fundeb-/, "")
    .replace(/^relatorio_tecnico_fundeb_/, "")
    .replace(/^relatorio_/, "")
    .replace(/_2026$/, "")
    .replace(/\s+\(\d+\)$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatMultiplier(value) {
  return value === null ? "-" : `${round6(value)}x`;
}

function formatPercent(value) {
  return value === null ? "-" : `${round2(value)}%`;
}

function setIfNewer(map, slug, filePath) {
  const stats = fs.statSync(filePath);
  const current = map.get(slug);
  if (!current || stats.mtimeMs > current.mtimeMs) {
    map.set(slug, { filePath, mtimeMs: stats.mtimeMs });
  }
}

async function main() {
  const inputDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("c:/Users/Adrie/Downloads");
  const entries = fs.readdirSync(inputDir, { withFileTypes: true });

  const generatedBySlug = new Map();
  const legacyBySlug = new Map();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".pdf")) {
      continue;
    }

    const fullPath = path.join(inputDir, entry.name);
    const slug = normalizeSlug(entry.name);

    if (/^levantamento-fundeb-/i.test(entry.name) || /^relatorio_tecnico_fundeb_/i.test(entry.name)) {
      setIfNewer(generatedBySlug, slug, fullPath);
      continue;
    }

    if (/^relatorio_/i.test(entry.name)) {
      setIfNewer(legacyBySlug, slug, fullPath);
    }
  }

  const rows = [];
  for (const [slug, generatedEntry] of generatedBySlug.entries()) {
    const legacyEntry = legacyBySlug.get(slug);
    if (!legacyEntry) {
      continue;
    }

    const result = await compareFundebPdfPair(generatedEntry.filePath, legacyEntry.filePath);
    rows.push({
      cidade: slug,
      gerado: formatMultiplier(result.generatedMultiplier ?? result.generated.multiplicador),
      legado: formatMultiplier(result.legacyMultiplier),
      desvioMultiplicador: formatPercent(result.multiplierGapPct),
      desvioProjetado: formatPercent(result.projectedGapPct),
      score: result.generated.score === null ? "-" : round2(result.generated.score),
      geradoPath: path.basename(generatedEntry.filePath),
      legadoPath: path.basename(legacyEntry.filePath),
    });
  }

  rows.sort((a, b) => {
    const gapA = Number.parseFloat(String(a.desvioProjetado).replace("%", "")) || 0;
    const gapB = Number.parseFloat(String(b.desvioProjetado).replace("%", "")) || 0;
    return Math.abs(gapB) - Math.abs(gapA);
  });

  console.log("");
  console.log(`Comparativo em lote FUNDEB (${rows.length} pares)`);
  console.log("");
  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
