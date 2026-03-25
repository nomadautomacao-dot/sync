import jsPDF from "jspdf";
import type { Company } from "@/core/domain/organization";
import type { EmpresaConfig, PropostaFormData } from "../types";
import {
  buildEmitterConfig,
  formatCurrency,
  formatDateLong,
  sanitizeFileName,
  toUpper,
} from "./document-helpers";

function addParagraph(doc: jsPDF, text: string, x: number, y: number, maxWidth: number) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y, { maxWidth, lineHeightFactor: 1.45, align: "justify" });
  return y + lines.length * 14;
}

export async function generateMinutaPdf(
  data: PropostaFormData,
  config?: EmpresaConfig,
  company?: Company | null,
) {
  const empresa = buildEmitterConfig(config, company);
  const incremento = Math.max(0, data.receitaProjetada - data.receitaAtual);
  const municipioUpper = `${toUpper(data.municipioNome)}/${toUpper(data.municipioUf)}`;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 42;
  let y = 54;

  const next = (text: string, gap = 12, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    y = addParagraph(doc, text, margin, y, width - margin * 2);
    y += gap;
    if (y > height - 70) {
      doc.addPage();
      y = 54;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS ESPECIALIZADOS", width / 2, y, {
    align: "center",
  });
  y += 24;
  doc.setFontSize(11);
  doc.text(`Nº ${data.contratoNumero}`, width / 2, y, { align: "center" });
  y += 16;
  doc.text(`INEXIGIBILIDADE Nº ${data.inexigibilidadeNumero}`, width / 2, y, { align: "center" });
  y += 16;
  doc.text(`PROCESSO ADMINISTRATIVO Nº ${data.processoAdministrativoNumero}`, width / 2, y, {
    align: "center",
  });
  y += 24;

  next(
    `CONTRATANTE: MUNICÍPIO DE ${municipioUpper}, inscrito no CNPJ nº ${data.cnpjMunicipio}, com sede em ${data.enderecoMunicipio}, CEP ${data.cepMunicipio}, neste ato representado por ${data.cargoAutoridade}, ${data.tituloSocialAutoridade} ${data.nomeAutoridade}, RG nº ${data.rgAutoridade} ${data.orgaoExpedidorAutoridade}, CPF nº ${data.cpfAutoridade}.`,
    18,
    true,
  );
  next(
    `CONTRATADA: ${empresa.nome}, inscrita no CNPJ nº ${empresa.cnpj}, com sede em ${empresa.endereco}, ${empresa.cidade}/${empresa.uf}, CEP ${empresa.cep}, neste ato representada por ${empresa.representanteNome}, ${empresa.representanteCargo}.`,
    18,
    true,
  );

  next("CLÁUSULA PRIMEIRA – DO OBJETO", 8, true);
  next(
    `O presente contrato tem por objeto a prestação de serviços técnicos especializados de consultoria estratégica, administrativa e sistêmica em gestão educacional, voltados à organização, regularização, habilitação e incremento da capacidade do MUNICÍPIO DE ${municipioUpper} na captação, manutenção e ampliação de recursos educacionais oriundos do FNDE, MEC, FUNDEB e sistemas correlatos.`,
  );

  next("CLÁUSULA SEGUNDA – DAS CONDIÇÕES DE EXECUÇÃO", 8, true);
  next(
    "Os serviços serão executados de forma técnica e especializada, mediante intervenções presenciais e remotas, compreendendo atividades de diagnóstico, saneamento de pendências sistêmicas, estruturação técnica e acompanhamento administrativo.",
  );

  next("CLÁUSULA TERCEIRA – DA REMUNERAÇÃO", 8, true);
  next(
    `A remuneração observará escalonamento progressivo baseado no salário mínimo de ${formatCurrency(data.escalonamento.salarioMinimo)}, com as seguintes faixas: até ${data.escalonamento.nivel1LimiteSm} salários-mínimos a ${data.escalonamento.nivel1Percentual}%, de ${data.escalonamento.nivel1LimiteSm} a ${data.escalonamento.nivel2LimiteSm} salários-mínimos a ${data.escalonamento.nivel2Percentual}% e acima disso ${data.escalonamento.nivel3Percentual}%.`,
  );
  next(
    `Para referência de viabilidade econômica, a receita atual considerada é ${formatCurrency(data.receitaAtual)}, a receita projetada é ${formatCurrency(data.receitaProjetada)} e o incremento estimado é ${formatCurrency(incremento)}.`,
  );
  next(
    "O pagamento somente ocorrerá mediante resultado técnico comprovado, vedado o uso de recursos vinculados do FNDE e assegurado o risco integral da CONTRATADA na ausência de proveito econômico mensurável.",
  );

  next("CLÁUSULA QUARTA – DA VIGÊNCIA", 8, true);
  next(
    `O presente contrato terá vigência até ${formatDateLong(data.vigenciaEncerramento)}, podendo ser prorrogado mediante termo aditivo e justificativa administrativa, nos termos da Lei Federal nº 14.133/2021.`,
  );

  next("CLÁUSULA QUINTA – DO ACOMPANHAMENTO E FISCALIZAÇÃO", 8, true);
  next(
    `O acompanhamento caberá a ${data.secretariaAcompanhamento} e a fiscalização caberá a ${data.secretariaFiscalizacao}, por meio de servidor formalmente designado como fiscal do contrato.`,
  );

  next("CLÁUSULA SEXTA – DO FORO", 8, true);
  next(
    `Fica eleito o Foro da Comarca de ${data.comarcaNome || data.municipioNome}, Estado de ${data.estadoNome}, para dirimir quaisquer controvérsias oriundas da execução do presente contrato.`,
  );

  next("ANEXO I – ESTUDO DE VIABILIDADE ECONÔMICA", 8, true);
  next(
    `Cenário atual (${data.anoBase}): ${formatCurrency(data.receitaAtual)}. Cenário projetado (${data.anoProjetado}): ${formatCurrency(data.receitaProjetada)}. Incremento potencial: ${formatCurrency(incremento)}.`,
  );

  doc.setFont("helvetica", "bold");
  doc.text(`${data.municipioNome}/${data.municipioUf}, ${formatDateLong(data.dataDocumento)}.`, width / 2, 760, {
    align: "center",
  });
  doc.text(municipioUpper, width / 2, 796, { align: "center" });
  doc.text(empresa.nome, width / 2, 820, { align: "center" });

  return {
    blob: doc.output("blob"),
    fileName: `minuta-contratual-${sanitizeFileName(data.municipioNome)}.pdf`,
  };
}
