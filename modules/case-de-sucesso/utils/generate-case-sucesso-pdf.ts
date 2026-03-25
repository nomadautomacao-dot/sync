import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { FundebEvolution } from "../types/case-sucesso";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatPercent(value: number) {
  const signal = value > 0 ? "+" : "";
  return `${signal}${value.toFixed(2)}%`;
}

function sanitizeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateCaseSucessoPdf(data: FundebEvolution) {
  if (!data.dataBase || !data.dataTarget) return;

  // Load Logo
  const logoUrl = "/logo-rocha-prime.png";
  let logoBase64: string | null = null;
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    logoBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Could not load logo", e);
  }

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedAt = format(new Date(), "PPpp", { locale: ptBR });

  const ganhoBrutoTarget = data.dataTarget.total - data.dataBase.total;

  const preBaseExists = !!data.dataPreBase;

  const primaryColor: [number, number, number] = [9, 14, 28]; // Dark bg
  const accentColor: [number, number, number] = [59, 130, 246]; // Blue
  const successColor: [number, number, number] = [16, 185, 129]; // Emerald

  // ==========================================
  // PÁGINA 1: CAPA
  // ==========================================

  // Fundo Azul Escuro/Preto da Capa
  const gradientStops = 100;
  for (let i = 0; i < gradientStops; i++) {
    doc.setFillColor(
      primaryColor[0] + (20 * i) / gradientStops,
      primaryColor[1] + (25 * i) / gradientStops,
      primaryColor[2] + (35 * i) / gradientStops
    );
    doc.rect(0, (pageHeight * i) / gradientStops, pageWidth, pageHeight / gradientStops + 1, "F");
  }

  // Elementos Geométricos Decorativos Base
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
  doc.circle(pageWidth, pageHeight, 300, "F");
  doc.circle(0, 0, 150, "F");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  doc.setTextColor(255, 255, 255);

  // "Logo" / Cabeçalho
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 50, 60, 160, 50);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("ROCHA PRIME", 50, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(200, 210, 230);
    doc.text("CONSULTORIA E ASSESSORIA PÚBLICA", 50, 100);
  }

  // Títulos principais
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize("RELATÓRIO TÉCNICO DE IMPACTO FINANCEIRO", pageWidth - 100);
  doc.text(titleLines, 50, pageHeight / 2 - 40);

  doc.setTextColor(150, 180, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("OTIMIZAÇÃO DE RECEITAS - FUNDEB", 50, pageHeight / 2 + (titleLines.length * 20));

  // Entidade e Local
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(`ENTIDADE: PREFEITURA MUNICIPAL DE ${data.municipio.toUpperCase()}`, 50, pageHeight - 160);
  if (preBaseExists) {
    doc.text(`ANÁLISE COMPARATIVA: ${data.preBaseYear} > ${data.baseYear} > ${data.targetYear}`, 50, pageHeight - 140);
  } else {
    doc.text(`ANÁLISE COMPARATIVA: ${data.baseYear} > ${data.targetYear}`, 50, pageHeight - 140);
  }

  // Assinatura de Geração
  doc.setFontSize(10);
  doc.setTextColor(120, 130, 150);
  doc.text(`Documento gerado eletronicamente em: ${generatedAt}`, 50, pageHeight - 50);

  // Cabeçalho Padrão para Páginas Internas
  function addHeader(title: string) {
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 60, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, 40, 36);
  }

  // Rodapé Padrão para Páginas Internas
  function addFooter(pageStr: string) {
    doc.setDrawColor(220, 220, 220);
    doc.line(40, pageHeight - 40, pageWidth - 40, pageHeight - 40);
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.text(`Município de ${data.municipio}`, 40, pageHeight - 25);
    doc.text(pageStr, pageWidth - 60, pageHeight - 25);
  }

  // Helper para justificar texto grande
  function justifyText(text: string, y: number, fontSize = 11, fontStyle: "normal" | "bold" | "italic" = "normal") {
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(40, 40, 45);
    // Workaround for jsPDF splitTextToSize with justify bug
    doc.text(text, 40, y, { align: "justify", maxWidth: pageWidth - 80, lineHeightFactor: 1.5 });
    return doc.splitTextToSize(text, pageWidth - 80).length * (fontSize * 1.5) + y + 10;
  }

  // ==========================================
  // PÁGINA 2: O CENÁRIO ANTERIOR (2024 -> 2025)
  // ==========================================
  doc.addPage();
  addHeader("1. RESUMO EXECUTIVO E O CENÁRIO ANTERIOR");

  let currentY = 100;
  doc.setTextColor(40, 40, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Considerações Iniciais", 40, currentY);
  currentY += 20;

  let introText = `O presente documento apresenta a evolução das receitas auferidas pelo Município de ${data.municipio} a título de Complementação da União ao Fundo de Manutenção e Desenvolvimento da Educação Básica e de Valorização dos Profissionais da Educação (FUNDEB).`;

  if (preBaseExists) {
    introText += ` Inicialmente, avaliamos o cenário anterior à nossa atuação, refletido na transição do exercício de ${data.preBaseYear} para ${data.baseYear}.`;
  }

  currentY = justifyText(introText, currentY);
  currentY += 10;

  if (preBaseExists) {
    doc.setTextColor(40, 40, 45);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Cenário Pré-Intervenção: ${data.preBaseYear} vs ${data.baseYear}`, 40, currentY);
    currentY += 20;

    const preBaseText = `Na progressão orgânica das receitas entre os anos de ${data.preBaseYear} e ${data.baseYear}, o município apresentava o que chamamos de "crescimento inercial". Muitas vezes, dados cadastrais inconsistentes relativos ao censo escolar, despesas com manutenção e indicadores de desempenho socioeconômico impedem a maximização dos repasses.`;
    currentY = justifyText(preBaseText, currentY);

    autoTable(doc, {
      startY: currentY,
      head: [[
        "Componente Global",
        `Arrecadação (${data.preBaseYear})`,
        `Arrecadação (${data.baseYear})`,
        "Evolução Percentual",
      ]],
      body: [
        [
          "Total Receitas FUNDEB",
          formatCurrency(data.dataPreBase!.total),
          formatCurrency(data.dataBase.total),
          formatPercent(data.preDeltas.total),
        ]
      ],
      theme: "grid",
      styles: { fontSize: 11, cellPadding: 8, textColor: [40, 40, 50] },
      headStyles: { fillColor: [120, 130, 150], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { fontStyle: "bold" },
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "center", fontStyle: "bold", textColor: data.preDeltas.total >= 0 ? successColor : [200, 50, 50] }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentY = ((doc as any).lastAutoTable?.finalY ?? currentY + 100) + 30;

    const preBaseConclusion = `Observa-se que houve uma variação de ${formatPercent(data.preDeltas.total)} no período. Embora exista oscilação natural de arrecadação nacional e do respectivo estado, a ausência de uma estruturação refinada nas declarações municipais normalmente mitiga as alíquotas das fatias VAAT e VAAR.`;
    currentY = justifyText(preBaseConclusion, currentY);
  }

  addFooter(preBaseExists ? "Página 1 de 4" : "Página 1 de 3");

  // ==========================================
  // PÁGINA 3: A INTERVENÇÃO E A VIRADA
  // ==========================================
  doc.addPage();
  addHeader("2. A INTERVENÇÃO E A MÁXIMA OTIMIZAÇÃO");

  currentY = 100;

  const intervText = `Após o ingresso especializado da ROCHA PRIME durante o exercício de ${data.baseYear}, promoveu-se uma auditoria documental rigorosa. Foi realizado o cruzamento da base contábil reportada ao SICONFI e a devida conformação do Censo Escolar para apuração dos fatores multiplicadores que geram o direito aos novos repasses da União para o ano de ${data.targetYear}.`;
  currentY = justifyText(intervText, currentY) + 10;

  // Destaque Financeiro
  doc.setFillColor(245, 248, 252);
  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setLineWidth(1.5);
  doc.rect(40, currentY, pageWidth - 80, 140, "FD");

  doc.setTextColor(40, 45, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("A GRANDE VIRADA FINANCEIRA", pageWidth / 2, currentY + 30, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Incremento entre o Ano Base (${data.baseYear}) e Pós-Gestão (${data.targetYear}):`, pageWidth / 2, currentY + 60, { align: "center" });

  if (ganhoBrutoTarget > 0) {
    doc.setTextColor(successColor[0], successColor[1], successColor[2]);
  } else {
    doc.setTextColor(200, 50, 50);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text(`${ganhoBrutoTarget > 0 ? "+" : ""}${formatCurrency(ganhoBrutoTarget)}`, pageWidth / 2, currentY + 100, { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 110);
  doc.text(`Crescimento técnico garantido de ${data.deltas.total.toFixed(2)}% em relação ao cenário anterior.`, pageWidth / 2, currentY + 125, { align: "center" });

  currentY += 170;

  doc.setTextColor(40, 40, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Impacto Real: O Salto em ${data.targetYear}`, 40, currentY);
  currentY += 20;

  autoTable(doc, {
    startY: currentY,
    head: [[
      "Componente Global",
      `Arrecadação Base (${data.baseYear})`,
      `Arrecadação Gestão Sync (${data.targetYear})`,
      "Evolução Percentual",
    ]],
    body: [
      [
        "Total Receitas FUNDEB",
        formatCurrency(data.dataBase.total),
        formatCurrency(data.dataTarget.total),
        formatPercent(data.deltas.total),
      ]
    ],
    theme: "grid",
    styles: { fontSize: 11, cellPadding: 8, textColor: [40, 40, 50] },
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "center", fontStyle: "bold", textColor: data.deltas.total >= 0 ? successColor : [200, 50, 50] }
    },
  });

  addFooter(preBaseExists ? "Página 2 de 4" : "Página 2 de 3");

  // ==========================================
  // PÁGINA 4: EVOLUÇÃO GRÁFICA (Only if preBase exists)
  // ==========================================
  if (preBaseExists) {
    doc.addPage();
    addHeader("3. EVOLUÇÃO HISTÓRICA DO EXERCÍCIO");

    let gY = 100;
    justifyText("O gráfico a seguir ilustra a quebra de inércia. Observa-se a inclinação acentuada no repasse após a regularização das métricas utilizadas pelo FNDE para o enquadramento do município.", gY);

    gY += 60;

    // A very simple vertical bar chart drawn natively
    const chartHeight = 250;
    const chartWidth = 400;
    const chartX = (pageWidth - chartWidth) / 2;
    const chartY = gY + chartHeight;

    doc.setDrawColor(200, 200, 200);
    // Y-Axis line
    doc.line(chartX, chartY, chartX, chartY - chartHeight);
    // X-Axis line
    doc.line(chartX, chartY, chartX + chartWidth, chartY);

    const values = [data.dataPreBase!.total, data.dataBase.total, data.dataTarget.total];
    const maxVal = Math.max(...values);
    const labels = [String(data.preBaseYear), String(data.baseYear), String(data.targetYear)];
    const barWidth = 60;
    const gap = (chartWidth - (3 * barWidth)) / 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    for (let i = 0; i < 3; i++) {
      const h = (values[i] / maxVal) * (chartHeight - 40); // 40px buffer at top
      const x = chartX + gap + (i * (barWidth + gap));

      // Draw Bar
      if (i === 2) {
        doc.setFillColor(successColor[0], successColor[1], successColor[2]);
      } else {
        doc.setFillColor(150, 160, 180);
      }
      doc.rect(x, chartY - h, barWidth, h, "F");

      // Value text
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(9);
      const valText = (values[i] / 1e6).toFixed(1) + "M";
      doc.text(valText, x + (barWidth / 2), chartY - h - 10, { align: "center" });

      // Label text
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(11);
      doc.text(labels[i], x + (barWidth / 2), chartY + 20, { align: "center" });
    }

    gY += chartHeight + 60;

    justifyText(`Nota-se claramente que o pico de arrecadação ocorreu em ${data.targetYear}, caracterizando o sucesso do re-enquadramento de coeficientes operado pela consultoria.`, gY, 11, "italic");

    addFooter("Página 3 de 4");
  }


  // ==========================================
  // PÁGINA 5: DETALHAMENTO DE COMPONENTES
  // ==========================================
  doc.addPage();
  addHeader(preBaseExists ? "4. DETALHAMENTO POR COMPONENTES" : "3. DETALHAMENTO POR COMPONENTES");

  let currentYPg5 = 100;

  const detailText = "A complementação do FUNDEB é fragmentada em três modalidades principais: VAAF (Valor Anual por Aluno), VAAT (Valor Anual Total por Aluno) e VAAR (Valor Anual por Aluno - Resultado). A atuação rigorosa da assessoria interveio diretamente nas variáveis que compõem esses indicativos, gerando o seguinte panorama evolutivo:";
  currentYPg5 = justifyText(detailText, currentYPg5) + 10;

  class ComponenteRow {
    constructor(
      public nome: string,
      public descricao: string,
      public preBase: number | null,
      public base: number,
      public target: number,
      public deltaTarget: number
    ) { }
  }

  const compData = [
    new ComponenteRow("VAAF", "(Fundo Estadual + Complementação)", data.dataPreBase ? data.dataPreBase.vaaf : null, data.dataBase.vaaf, data.dataTarget.vaaf, data.deltas.vaaf),
    new ComponenteRow("VAAT", "(Educação Infantil/Despesa)", data.dataPreBase ? data.dataPreBase.vaat : null, data.dataBase.vaat, data.dataTarget.vaat, data.deltas.vaat),
    new ComponenteRow("VAAR", "(Condicionalidades de Melhoria)", data.dataPreBase ? data.dataPreBase.vaar : null, data.dataBase.vaar, data.dataTarget.vaar, data.deltas.vaar),
  ];

  const headCols = [
    "Componente",
    preBaseExists ? `Exercício ${data.preBaseYear}` : "",
    `Exercício ${data.baseYear}`,
    `Exercício ${data.targetYear}`,
    "Cresc. Total (%)",
  ].filter(c => c !== "");

  autoTable(doc, {
    startY: currentYPg5,
    head: [headCols],
    body: compData.map(c => {
      const row = [
        `${c.nome}\n${c.descricao}`,
      ];
      if (preBaseExists) row.push(formatCurrency(c.preBase!));
      row.push(formatCurrency(c.base));
      row.push(formatCurrency(c.target));
      row.push(formatPercent(c.deltaTarget));
      return row;
    }),
    theme: "striped",
    styles: { fontSize: 10, cellPadding: 8, textColor: [40, 40, 50] },
    headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: preBaseExists ? {
      0: { fontStyle: "bold", cellWidth: 140 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right", fontStyle: "bold" }
    } : {
      0: { fontStyle: "bold", cellWidth: 150 },
      1: { halign: "right", cellWidth: 120 },
      2: { halign: "right", cellWidth: 120 },
      3: { halign: "right", fontStyle: "bold" }
    },
    didParseCell: function (data) {
      const isDeltaCol = preBaseExists ? data.column.index === 4 : data.column.index === 3;
      if (data.section === 'body' && isDeltaCol) {
        const rawDelta = compData[data.row.index].deltaTarget;
        if (rawDelta > 0) {
          data.cell.styles.textColor = successColor;
        } else if (rawDelta < 0) {
          data.cell.styles.textColor = [200, 50, 50];
        }
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentYpg5Part2 = ((doc as any).lastAutoTable?.finalY ?? currentYPg5 + 150) + 40;

  doc.setTextColor(40, 40, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Conclusão Técnica", 40, currentYpg5Part2);

  currentYpg5Part2 += 20;

  const conclusionText = `Reitera-se que o impacto positivo demonstrado, consubstanciado no salto financeiro global e no aumento excedente de recursos, corrobora a adequação das reestruturações promovidas. Fica atestado que a gestão da ROCHA PRIME no tratamento de dados contábeis, censo escolar da educação infantil - integral e parcial - e declarações federais (SIOPE/SICONFI) resultou na eficiência fiscal requerida, chancelando a efetividade dos serviços especializados prestados.\n\nFicamos inteiramente à disposição para esclarecimentos, revisões e para desenhar o planejamento estratégico focado na continuidade evolutiva do município em exercícios vindouros.`;
  justifyText(conclusionText, currentYpg5Part2);

  addFooter(preBaseExists ? "Página 4 de 4" : "Página 3 de 3");

  // ==========================================
  // SALVAR / EXPORTAR O PDF
  // ==========================================
  const fileName = `RELATORIO_TECNICO_FUNDEB_${sanitizeFilePart(data.municipio)}_${data.targetYear}.pdf`;
  doc.save(fileName);
}
