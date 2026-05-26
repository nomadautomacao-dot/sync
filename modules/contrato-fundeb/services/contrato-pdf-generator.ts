import jsPDF from "jspdf";
import "jspdf-autotable";
import type { ContratoFundebDados } from "../types";
import { formatCurrency } from "./contrato-fundeb-service";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
  }
}

const PAGE_WIDTH = 210;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

function addPage(doc: jsPDF): number {
  doc.addPage();
  return 10;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 280) {
    return addPage(doc);
  }
  return y;
}

export async function generateContratoFundebPdf(dados: ContratoFundebDados): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica");

  let y = 20;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", PAGE_WIDTH / 2, y, { align: "center" });
  y += 12;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const headerLines = [
    `CONTRATO: ${dados.identificacao.contratoNumero}`,
    `DATA: ${dados.identificacao.dataAssinatura}`,
    `VIGÊNCIA: ${dados.identificacao.vigenciaFim}`,
    `PROCESSO: ${dados.identificacao.processoNumero}`,
  ];
  for (const line of headerLines) {
    doc.text(line, PAGE_WIDTH / 2, y, { align: "center" });
    y += 5;
  }
  y += 5;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const tituloContrato = `CONTRATO ADMINISTRATIVO DE PRESTAÇÃO DE SERVIÇOS QUE FAZEM ENTRE SI O MUNICÍPIO DE ${dados.contratante.municipioNome.toUpperCase()} E A EMPRESA ${dados.contratado.empresaRazaoSocial.toUpperCase()}.`;
  const tituloLines = doc.splitTextToSize(tituloContrato, CONTENT_WIDTH);
  doc.text(tituloLines, MARGIN_LEFT, y);
  y += tituloLines.length * 5 + 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const preambulo = `O MUNICÍPIO DE ${dados.contratante.municipioNome.toUpperCase()}, entidade de Direito Público interno, com sede à ${dados.contratante.municipioEndereco}, ${dados.contratante.municipioCidade} - ${dados.contratante.municipioEstado}, inscrita no CNPJ sob o nº ${dados.contratante.municipioCNPJ}, neste ato representado pelo Prefeito Municipal, o Sr. ${dados.contratante.prefeitoNome}, ${dados.contratante.prefeitoNacionalidade}, portador da Cédula de Identidade R.G. nº ${dados.contratante.prefeitoRG} e inscrito no CPF nº ${dados.contratante.prefeitoCPF}, residente e domiciliado na ${dados.contratante.prefeitoEndereco}, CEP: ${dados.contratante.prefeitoCEP}, por intermédio do ${dados.contratante.fundoMunicipalNome}, entidade de Direito Público interno, com sede à ${dados.contratante.fundoMunicipalEndereco}, inscrita no CNPJ sob o nº ${dados.contratante.fundoMunicipalCNPJ}, doravante denominado CONTRATANTE, e a empresa ${dados.contratado.empresaRazaoSocial.toUpperCase()}, inscrita no CNPJ sob o nº ${dados.contratado.empresaCNPJ}, sediada à ${dados.contratado.empresaEndereco}, ${dados.contratado.empresaCidade}, neste ato representada pelo ${dados.contratado.representanteQualificacao}, o Sr. ${dados.contratado.representanteNome}, inscrito no CPF sob o nº ${dados.contratado.representanteCPF}, doravante designado CONTRATADO, resolvem celebrar o presente Termo de Contrato, decorrente do Termo de Inexigibilidade nº ${dados.identificacao.processoNumero}, mediante as cláusulas e condições a seguir enunciadas.`;
  const preambuloLines = doc.splitTextToSize(preambulo, CONTENT_WIDTH);

  for (const line of preambuloLines) {
    y = checkPageBreak(doc, y, 5);
    doc.text(line, MARGIN_LEFT, y);
    y += 4.5;
  }
  y += 6;

  const clausulas: Array<{ titulo: string; texto: string }> = [
    {
      titulo: "CLÁUSULA PRIMEIRA – OBJETO (art. 92, I e II)",
      texto: `1.1. O objeto do presente instrumento é: Item 01 – ${dados.valor.descricaoServico}\n\n1.2. Vinculam esta contratação, independentemente de transcrição:\n1.2.1. O Termo de Referência;\n1.2.2. A Proposta do contratado;\n1.2.3. Eventuais anexos dos documentos supracitados.`,
    },
    {
      titulo: "CLÁUSULA SEGUNDA – VIGÊNCIA E PRORROGAÇÃO",
      texto: `2.1. O prazo de vigência da contratação é: iniciando em ${dados.identificacao.vigenciaInicio} e término em ${dados.identificacao.vigenciaFim}, podendo ser prorrogado conforme Art. 107 da Lei 14.133/21.`,
    },
    {
      titulo: "CLÁUSULA TERCEIRA – MODELOS DE EXECUÇÃO E GESTÃO CONTRATUAIS",
      texto: "3.1. O regime de execução contratual, os modelos de gestão e de execução constam no Termo de Referência, anexo a este Contrato.",
    },
    {
      titulo: "CLÁUSULA QUARTA – SUBCONTRATAÇÃO",
      texto: "4.1. Não será admitida a subcontratação do objeto contratual.",
    },
    {
      titulo: "CLÁUSULA QUINTA – PREÇO (art. 92, V)",
      texto: `5.1. O valor total da contratação é de ${formatCurrency(dados.valor.valorTotal)}, para execução dos serviços, conforme especificação abaixo:`,
    },
    {
      titulo: "CLÁUSULA SEXTA - PAGAMENTO",
      texto: `6.1. O pagamento será efetuado de forma mensal em ${dados.valor.quantidadeMeses} parcelas no valor de ${formatCurrency(dados.valor.valorMensal)}.`,
    },
    {
      titulo: "CLÁUSULA SÉTIMA - REAJUSTE",
      texto: "7.1. Os preços inicialmente contratados são fixos e irreajustáveis.",
    },
    {
      titulo: "CLÁUSULA OITAVA - OBRIGAÇÕES DO CONTRATANTE",
      texto: "8.1. São obrigações do Contratante:\n8.2. Exigir o cumprimento de todas as obrigações assumidas pelo Contratado;\n8.3. Receber o objeto no prazo e condições estabelecidas;\n8.4. Notificar o Contratado, por escrito, sobre vícios ou incorreções;\n8.5. Acompanhar e fiscalizar a execução do contrato;\n8.6. Efetuar o pagamento ao Contratado;\n8.7. Aplicar ao Contratado as sanções previstas na lei e neste Contrato.",
    },
    {
      titulo: "CLÁUSULA NONA - OBRIGAÇÕES DO CONTRATADO",
      texto: "9.1. O Contratado deve cumprir todas as obrigações constantes deste Contrato, assumindo como exclusivamente seus os riscos e as despesas decorrentes da boa e perfeita execução do objeto.",
    },
    {
      titulo: "CLÁUSULA DÉCIMA – GARANTIA DE EXECUÇÃO",
      texto: "10.1. Não haverá exigência de garantia de execução contratual.",
    },
    {
      titulo: "CLÁUSULA DÉCIMA PRIMEIRA – INFRAÇÕES E SANÇÕES",
      texto: "11.1. Comete infração administrativa, nos termos da Lei nº 14.133/2021, o contratado que:\na) der causa à inexecução parcial do contrato;\nb) der causa à inexecução total do contrato;\nc) ensejar retardamento da execução;\nd) apresentar documentação falsa;\ne) praticar ato fraudulento;\nf) comportar-se de modo inidôneo.",
    },
    {
      titulo: "CLÁUSULA DÉCIMA SEGUNDA – EXTINÇÃO CONTRATUAL",
      texto: "12.1. O contrato poderá ser extinto conforme artigo 137 da Lei nº 14.133/21.",
    },
    {
      titulo: "CLÁUSULA DÉCIMA TERCEIRA – DOTAÇÃO ORÇAMENTÁRIA",
      texto: "13.1. As despesas decorrentes da presente contratação correrão à conta de recursos específicos consignados no Orçamento Municipal.",
    },
    {
      titulo: "CLÁUSULA DÉCIMA QUARTA – CASOS OMISSOS",
      texto: "14.1. Os casos omissos serão decididos pelo contratante, segundo a Lei nº 14.133/2021.",
    },
    {
      titulo: "CLÁUSULA DÉCIMA QUINTA – ALTERAÇÕES",
      texto: "15.1. Eventuais alterações reger-se-ão pela disciplina dos arts. 124 e seguintes da Lei nº 14.133/2021.",
    },
    {
      titulo: "CLÁUSULA DÉCIMA SEXTA – PUBLICAÇÃO",
      texto: "16.1. Incumbirá ao contratante divulgar o presente instrumento no Portal Nacional de Contratações Públicas (PNCP).",
    },
    {
      titulo: "CLÁUSULA DÉCIMA SÉTIMA – FORO",
      texto: `17.1. Fica eleita a Comarca de ${dados.foro.comarca} - ${dados.foro.estado} para dirimir os litígios decorrentes deste Contrato.`,
    },
  ];

  for (const clausula of clausulas) {
    y = checkPageBreak(doc, y, 20);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(clausula.titulo, MARGIN_LEFT, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const textoLines = doc.splitTextToSize(clausula.texto, CONTENT_WIDTH);
    for (const line of textoLines) {
      y = checkPageBreak(doc, y, 5);
      doc.text(line, MARGIN_LEFT, y);
      y += 4.2;
    }
    y += 4;

    if (clausula.titulo.includes("QUINTA")) {
      y = checkPageBreak(doc, y, 35);
      doc.autoTable({
        startY: y,
        margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        head: [["Item", "Descrição", "Unid.", "Quant.", "V. Unit.", "V. Total"]],
        body: [
          [
            "1",
            dados.valor.descricaoServico.substring(0, 60) + "...",
            "Mês",
            String(dados.valor.quantidadeMeses),
            formatCurrency(dados.valor.valorMensal),
            formatCurrency(dados.valor.valorTotal),
          ],
        ],
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      doc.setFont("helvetica", "bold");
      doc.text(`Valor Global: ${formatCurrency(dados.valor.valorTotal)}`, MARGIN_LEFT, y);
      y += 8;
    }
  }

  y = checkPageBreak(doc, y, 60);

  y += 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRATANTE", MARGIN_LEFT, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`MUNICÍPIO DE ${dados.contratante.municipioNome.toUpperCase()}`, MARGIN_LEFT, y);
  y += 4;
  doc.text(`CNPJ: ${dados.contratante.municipioCNPJ}`, MARGIN_LEFT, y);
  y += 4;
  doc.text(dados.contratante.prefeitoNome, MARGIN_LEFT, y);
  y += 4;
  doc.text("Prefeito", MARGIN_LEFT, y);
  y += 15;

  doc.setFont("helvetica", "bold");
  doc.text("CONTRATADO", MARGIN_LEFT, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(dados.contratado.empresaRazaoSocial.toUpperCase(), MARGIN_LEFT, y);
  y += 4;
  doc.text(`CNPJ: ${dados.contratado.empresaCNPJ}`, MARGIN_LEFT, y);
  y += 4;
  doc.text(dados.contratado.representanteNome, MARGIN_LEFT, y);
  y += 4;
  doc.text(dados.contratado.representanteQualificacao, MARGIN_LEFT, y);
  y += 15;

  doc.text("TESTEMUNHAS:", MARGIN_LEFT, y);
  y += 6;
  doc.text("1- _____________________________", MARGIN_LEFT, y);
  y += 5;
  doc.text("2- _____________________________", MARGIN_LEFT, y);

  const slug = dados.contratante.municipioNome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `Contrato_FUNDEB_${slug}_${dados.identificacao.contratoNumero.replace(/\//g, "-")}.pdf`;
  doc.save(filename);
}
