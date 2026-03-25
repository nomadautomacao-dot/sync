import fs from "node:fs";
import path from "node:path";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { compareFundebPdfPair, formatCurrency, round2 } from "./compare-fundeb-pdf-pair.mjs";

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

function setIfNewer(map, slug, filePath) {
  const stats = fs.statSync(filePath);
  const current = map.get(slug);
  if (!current || stats.mtimeMs > current.mtimeMs) {
    map.set(slug, { filePath, mtimeMs: stats.mtimeMs });
  }
}

function addHeader(doc, title, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 72, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 40, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, 40, 48);
}

function addFooter(doc) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageNumber = doc.getCurrentPageInfo().pageNumber;
  doc.setDrawColor(226, 232, 240);
  doc.line(40, pageHeight - 24, pageWidth - 40, pageHeight - 24);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.text("Sync | Relatorio executivo de calibracao FUNDEB", 40, pageHeight - 10);
  doc.text(`Pagina ${pageNumber}`, pageWidth - 74, pageHeight - 10);
}

function addSectionTitle(doc, text, y) {
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(text, 40, y);
}

function addParagraph(doc, text, y, width = 515, lineHeight = 15) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, 40, y);
  return y + lines.length * lineHeight;
}

async function collectRows(inputDir) {
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
      nossoProjetado: result.generated.totalProjetado,
      legadoProjetado: result.legacy.totalProjetado,
      erroPct: result.projectedGapPct ?? 0,
      multiplicadorNosso: result.generatedMultiplier ?? result.generated.multiplicador ?? null,
      multiplicadorLegado: result.legacyMultiplier,
      score: result.generated.score,
    });
  }

  rows.sort((a, b) => Math.abs(b.erroPct) - Math.abs(a.erroPct));
  return rows;
}

function buildMetrics(rows) {
  const absErrors = rows.map((row) => Math.abs(row.erroPct));
  const mae = absErrors.length ? absErrors.reduce((sum, item) => sum + item, 0) / absErrors.length : 0;
  const max = absErrors.length ? Math.max(...absErrors) : 0;
  const withinPointFive = rows.filter((row) => Math.abs(row.erroPct) <= 0.5).length;
  const withinOne = rows.filter((row) => Math.abs(row.erroPct) <= 1).length;
  const aboveOne = rows.filter((row) => Math.abs(row.erroPct) > 1);
  const approximation = 100 - mae;

  return {
    total: rows.length,
    mae: round2(mae),
    max: round2(max),
    withinPointFive,
    withinOne,
    approximation: round2(approximation),
    aboveOne,
  };
}

async function main() {
  const inputDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("c:/Users/Adrie/Downloads");
  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.resolve("c:/Users/Adrie/Desktop/Sync/complementacao/RELATORIO_EXECUTIVO_CALIBRACAO_FUNDEB_2026-03-19.pdf");

  const rows = await collectRows(inputDir);
  const metrics = buildMetrics(rows);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  addHeader(
    doc,
    "Relatorio Executivo de Calibracao FUNDEB",
    "Metodologia, criterios de calculo, tratamento de faltas e validacao comparativa contra relatorios legados",
  );
  addFooter(doc);

  let y = 98;
  addSectionTitle(doc, "1. Objetivo", y);
  y = addParagraph(
    doc,
    "Este relatorio consolida a metodologia aplicada no modulo de levantamento FUNDEB do Sync, os criterios usados na projecao comercial, o tratamento de dados faltantes e o resultado da validacao comparativa contra os relatorios legados utilizados como referencia operacional.",
    y + 18,
  );

  addSectionTitle(doc, "2. Fontes e metodologia", y + 10);
  y = addParagraph(
    doc,
    "O calculo combina tres camadas. A primeira usa variaveis oficiais do Fundeb e dados publicos estruturados. A segunda usa proxies analiticas para aproximar comportamento quando o dado oficial falta. A terceira aplica regimes comerciais calibrados sobre a amostra historica de relatorios legados.",
    y + 28,
  );

  autoTable(doc, {
    startY: y + 10,
    head: [["Camada", "Componentes principais"]],
    body: [
      [
        "Variaveis oficiais",
        "Receita total FUNDEB por ente, VAAF, VAAT oficial, contexto do fundo estadual da UF, condicionalidade IV do VAAR, Censo Escolar consolidado e bases territoriais oficiais.",
      ],
      [
        "Proxies analiticas",
        "FUNDEB per capita, matriculas por habitante, educacao infantil por habitante, creche por habitante e dependencia do fundo sobre a receita bruta municipal.",
      ],
      [
        "Ajustes comerciais",
        "Regimes calibrados por perfil municipal, camada estadual controlada e correcoes por familias historicas observadas na amostra legado.",
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9.5, cellPadding: 6, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 380 } },
    margin: { left: 40, right: 40 },
  });

  y = doc.lastAutoTable.finalY + 20;
  addSectionTitle(doc, "3. Criterios de calculo considerados", y);
  y = addParagraph(
    doc,
    "O modelo atual leva em consideracao: receita total do FUNDEB, participacao de VAAT no total, populacao estimada, receitas brutas municipais, matriculas municipais, escolas municipais, educacao infantil municipal, creche municipal, pre-escola municipal, habilitacao e pendencias de VAAT, camada estadual da UF e regime comercial calibrado por perfil.",
    y + 18,
  );

  autoTable(doc, {
    startY: y + 10,
    head: [["Grupo de criterio", "Como impacta"]],
    body: [
      ["Porte financeiro", "Controla o multiplicador-base e ajuda a separar pequenos, medios, grandes e metropolitanos."],
      ["Intensidade da rede", "Matriculas, educacao infantil e creche por habitante alteram a faixa comercial."],
      ["Contexto VAAT", "Pode deslocar o municipio para regimes com VAAT material, moderado ou zero plausivel."],
      ["Camada estadual", "Entra como contexto estrutural da UF e so vira correcao automatica quando a amostra do estado e estatisticamente estavel."],
      ["Fallbacks", "Se a base oficial faltar, o sistema estima a linha de base sem mostrar zeros ao cliente."],
    ],
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 9.5, cellPadding: 6, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 370 } },
    margin: { left: 40, right: 40 },
  });

  doc.addPage();
  addHeader(doc, "Relatorio Executivo de Calibracao FUNDEB", "Tratamento de faltas, validacao e comparativo de resultados");
  addFooter(doc);

  y = 98;
  addSectionTitle(doc, "4. Tratamento de dados faltantes", y);
  y = addParagraph(
    doc,
    "Quando o dado oficial nao vem, o sistema nao mostra zero automaticamente. Primeiro ele distingue zero oficial de dado faltante. Em seguida, usa linha de base estimada calibrada com INEP, IBGE e contexto do VAAT. Para VAAT faltante, foi implementado um classificador com tres saidas: zero-plausivel, positivo-moderado e positivo-alto.",
    y + 18,
  );

  autoTable(doc, {
    startY: y + 10,
    head: [["Campo faltante", "Regra atual"]],
    body: [
      ["Receita FUNDEB ausente", "Estimativa calibrada baseada em populacao, matriculas, receitas municipais e contexto de VAAT."],
      ["VAAT faltante", "Classificacao por perfil municipal: zero-plausivel, positivo-moderado ou positivo-alto."],
      ["VAAF faltante", "Estimativa conservadora como percentual da receita total, respeitando o regime do municipio."],
      ["VAAR faltante", "Estimativa conservadora vinculada ao peso de educacao infantil e creche, ainda sujeita a calibracao adicional."],
    ],
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9.5, cellPadding: 6, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 380 } },
    margin: { left: 40, right: 40 },
  });

  y = doc.lastAutoTable.finalY + 20;
  addSectionTitle(doc, "5. Resultado da validacao atual", y);
  y = addParagraph(
    doc,
    `Na base auditada atual, foram comparados ${metrics.total} pares de PDFs gerados pelo Sync contra relatorios legados. O desvio medio absoluto ficou em ${metrics.mae}%, com aproximacao media de ${metrics.approximation}%. ${metrics.withinPointFive} casos ficaram dentro de 0,50% e ${metrics.withinOne} casos ficaram dentro de 1,00%. O maior desvio atual do lote foi ${metrics.max}%.`,
    y + 18,
  );

  autoTable(doc, {
    startY: y + 10,
    head: [["Indicador", "Valor"]],
    body: [
      ["Pares comparados", String(metrics.total)],
      ["Desvio medio absoluto", `${metrics.mae}%`],
      ["Aproximacao media estimada", `${metrics.approximation}%`],
      ["Casos dentro de 0,50%", `${metrics.withinPointFive} / ${metrics.total}`],
      ["Casos dentro de 1,00%", `${metrics.withinOne} / ${metrics.total}`],
      ["Maior desvio do lote", `${metrics.max}%`],
    ],
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 10, cellPadding: 6 },
    margin: { left: 40, right: 40 },
  });

  y = doc.lastAutoTable.finalY + 20;
  addSectionTitle(doc, "6. Recomendacao executiva", y);
  addParagraph(
    doc,
    "Com a margem atual observada, o modelo ja e defensavel para uso como levantamento medio e aproximacao comercial inicial. A operacao esta especialmente madura no grupo historico ja calibrado. Os principais pontos ainda sob investigacao concentram-se em alguns municipios especificos de Goias, o que sugere refinamento regional adicional e nao falha estrutural do metodo.",
    y + 18,
  );

  doc.addPage();
  addHeader(doc, "Relatorio Executivo de Calibracao FUNDEB", "Comparativo de valores projetados: Sync atual x legado");
  addFooter(doc);

  autoTable(doc, {
    startY: 90,
    head: [["#", "Cidade", "Nosso atual", "Legado", "Erro"]],
    body: rows.map((row, index) => [
      String(index + 1),
      row.cidade,
      formatCurrency(row.nossoProjetado),
      formatCurrency(row.legadoProjetado),
      `${round2(row.erroPct)}%`,
    ]),
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 8.8, cellPadding: 5, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" },
      1: { cellWidth: 130 },
      2: { cellWidth: 120, halign: "right" },
      3: { cellWidth: 120, halign: "right" },
      4: { cellWidth: 70, halign: "right" },
    },
    margin: { left: 30, right: 30 },
  });

  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  doc.save(outputPath);
  console.log(`PDF gerado em: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
