import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Company } from "@/core/domain/organization";
import type { EmpresaConfig, PropostaFormData } from "../types";
import {
  buildCompanyAddress,
  buildEmitterConfig,
  formatCurrency,
  formatDateLong,
  sanitizeFileName,
} from "./document-helpers";
import { calculateHonorarios } from "./proposta-calculos";

function textBlock(doc: jsPDF, text: string, x: number, y: number, maxWidth: number) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y, { maxWidth, lineHeightFactor: 1.5, align: "justify" });
  return y + lines.length * 15;
}

export async function generatePropostaPdf(
  data: PropostaFormData,
  config?: EmpresaConfig,
  company?: Company | null,
) {
  const empresa = buildEmitterConfig(config, company);
  const { incremento, honorarios } = calculateHonorarios(data);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 60;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(empresa.nome, width / 2, y, { align: "center" });
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`CNPJ: ${empresa.cnpj} | ${buildCompanyAddress(empresa)}`, width / 2, y, {
    align: "center",
  });
  y += 32;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PROPOSTA COMERCIAL", width / 2, y, { align: "center" });
  y += 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    `À PREFEITURA MUNICIPAL DE ${data.municipioNome.toUpperCase()}/${data.municipioUf.toUpperCase()}`,
    margin,
    y,
  );
  y += 18;
  doc.text(
    `${data.pronomeTratamento} ${data.cargoAutoridade} ${data.tituloSocialAutoridade} ${data.nomeAutoridade}`,
    margin,
    y,
  );
  y += 26;

  doc.setFont("helvetica", "normal");
  y = textBlock(
    doc,
    `${data.saudacaoInicial} A ${empresa.nome} encaminha proposta para prestação de serviços técnicos especializados de assessoria em gestão educacional, regularização de sistemas MEC/FNDE, reestruturação do Censo Escolar/FUNDEB e incremento de repasses para o Município.`,
    margin,
    y,
    width - margin * 2,
  );
  y += 18;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Descrição", "Valor"]],
    body: [
      [`Receita atual (${data.anoBase})`, formatCurrency(data.receitaAtual)],
      [`Receita projetada (${data.anoProjetado})`, formatCurrency(data.receitaProjetada)],
      ["Incremento estimado", formatCurrency(incremento)],
      ["Honorários estimados", formatCurrency(honorarios)],
      ["Salário mínimo base", formatCurrency(data.escalonamento.salarioMinimo)],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 64, 175] },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 24;
  y = textBlock(
    doc,
    `Escalonamento utilizado: até ${data.escalonamento.nivel1LimiteSm} salários-mínimos com ${data.escalonamento.nivel1Percentual}%, de ${data.escalonamento.nivel1LimiteSm} a ${data.escalonamento.nivel2LimiteSm} salários-mínimos com ${data.escalonamento.nivel2Percentual}% e acima disso ${data.escalonamento.nivel3Percentual}%.`,
    margin,
    y,
    width - margin * 2,
  );
  y += 22;
  y = textBlock(
    doc,
    `Validade da proposta: ${data.prazoValidadePropostaDias} dias. Vigência sugerida: ${data.prazoVigenciaMeses} meses. Documento emitido em ${formatDateLong(data.dataDocumento)}.`,
    margin,
    y,
    width - margin * 2,
  );

  doc.setFont("helvetica", "bold");
  doc.text(`${empresa.cidade}/${empresa.uf}, ${formatDateLong(data.dataDocumento)}.`, width / 2, 760, {
    align: "center",
  });
  doc.text(empresa.nome, width / 2, 800, { align: "center" });

  return {
    blob: doc.output("blob"),
    fileName: `proposta-comercial-${sanitizeFileName(data.municipioNome)}.pdf`,
  };
}
