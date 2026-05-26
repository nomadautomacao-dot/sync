import type {
  RelatorioDirigidoFonte,
  RelatorioDirigidoMunicipio,
  RelatorioDirigidoProntidaoStatus,
  RelatorioDirigidoStatus,
} from "../types";
import { formatCurrency, formatInteger } from "./calculos";
import { normalizePtBrText } from "./ptbr";

export function getDirectedReportReadinessLabel(status: RelatorioDirigidoProntidaoStatus) {
  if (status === "aprovado_gestor") {
    return "Aprovado para gestor";
  }
  if (status === "revisao_assistida") {
    return "RevisÃ£o assistida";
  }
  return "Bloqueado";
}

export function countDirectedReportStatuses(report: RelatorioDirigidoMunicipio) {
  return report.itens.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    {
      confirmado: 0,
      sinalizado: 0,
      pendente_manual: 0,
      nao_encontrado: 0,
    } satisfies Record<RelatorioDirigidoStatus, number>,
  );
}

function findItem(report: RelatorioDirigidoMunicipio, itemId: string) {
  return report.itens.find((item) => item.id === itemId) ?? null;
}

function cleanText(value: string | null | undefined) {
  return normalizePtBrText(value)
    .replace(/Evid[eÃª]ncia Objetiva:/gi, "")
    .replace(/Leitura T[eÃ©]cnica:/gi, "")
    .replace(/Pend[eÃª]ncia Documental:/gi, "")
    .replace(/\.?\s*Nenhuma,\s*status\s*[a-z_]+\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatNullableInteger(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? formatInteger(value) : "NÃ£o informado";
}

function formatNullableCurrency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? formatCurrency(value) : "NÃ£o informado";
}

function formatNullableDecimal(value: number | null | undefined, digits = 3) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits).replace(".", ",") : "NÃ£o informado";
}

function getHistoricalRangeLabel(report: RelatorioDirigidoMunicipio) {
  const years = report.historico.anos
    .map((item) => item.ano)
    .filter((value): value is number => typeof value === "number");
  if (!years.length) {
    return "Histórico recente";
  }

  return `${Math.min(...years)}-${Math.max(...years)}`;
}

function buildFonteLines(fontes: RelatorioDirigidoFonte[]) {
  const filtered = fontes.filter((fonte) => fonte.tipo !== "base_interna").slice(0, 4);
  return filtered.map((fonte) => (fonte.url ? `- [${fonte.titulo || fonte.url}](${fonte.url})` : `- ${fonte.titulo}`));
}

function buildItemSection(lines: string[], title: string, text: string, fontes: RelatorioDirigidoFonte[] = []) {
  lines.push(`## ${title}`);
  lines.push("");
  lines.push(text || "Sem fechamento nesta rodada.");
  lines.push("");

  const fonteLines = buildFonteLines(fontes);
  if (fonteLines.length) {
    lines.push("Fontes principais:");
    lines.push(...fonteLines);
    lines.push("");
  }
}

function buildExecutiveView(report: RelatorioDirigidoMunicipio) {
  const arranjo = findItem(report, "arranjo_educacional");
  const fundeb = findItem(report, "perda_ou_nao_captura_recursos_fundeb");
  const transporte = findItem(report, "transporte_escolar");
  const parts = [
    `${normalizePtBrText(report.municipio)}/${normalizePtBrText(report.uf)} apresenta rede com ${formatNullableInteger(report.diagnosticoEducacao.totalEscolas)} escolas e ${formatNullableInteger(report.diagnosticoEducacao.totalMatriculas)} matrÃ­culas no Censo ${report.diagnosticoEducacao.censoAno ?? "mais recente"}.`,
    cleanText(arranjo?.resposta),
    cleanText(fundeb?.resposta),
    cleanText(transporte?.resposta),
    cleanText(report.propostaEmpresa.descricao),
  ];

  return parts.filter(Boolean).slice(0, 4).join(" ");
}

function buildFundebSummary(report: RelatorioDirigidoMunicipio) {
  const principal = findItem(report, "perda_ou_nao_captura_recursos_fundeb");
  const vaaf = findItem(report, "motivos_nao_captura_vaaf");
  const vaat = findItem(report, "motivos_nao_captura_vaat");
  const vaar = findItem(report, "motivos_nao_captura_vaar");

  return [
    cleanText(principal?.resposta) || "A anÃ¡lise central do FUNDEB ainda precisa de consolidaÃ§Ã£o.",
    "",
    `- VAAF: ${cleanText(vaaf?.resposta) || "Sem fechamento nesta rodada."}`,
    `- VAAT: ${cleanText(vaat?.resposta) || "Sem fechamento nesta rodada."}`,
    `- VAAR: ${cleanText(vaar?.resposta) || "Sem fechamento nesta rodada."}`,
  ];
}

export function buildDirectedReportMarkdown(report: RelatorioDirigidoMunicipio) {
  const historicalRangeLabel = getHistoricalRangeLabel(report);
  const counts = countDirectedReportStatuses(report);
  const transporte = findItem(report, "transporte_escolar");
  const eja = findItem(report, "incentivo_eja");
  const bonificacao = findItem(report, "bonificacao_boas_praticas");
  const formacao = findItem(report, "formacao_capacitacao");
  const parceriaAssistencia = findItem(report, "parceria_assistencia_eja");
  const parceriaCultura = findItem(report, "parceria_cultura_rua");
  const icms = findItem(report, "icms_28_goias");
  const arranjo = findItem(report, "arranjo_educacional");

  const lines: string[] = [
    `# RelatÃ³rio Executivo FUNDEB - ${normalizePtBrText(report.municipio)}/${normalizePtBrText(report.uf)}`,
    "",
    `Gerado em ${normalizePtBrText(report.geradoEm)}. Documento estruturado para apresentação institucional ao gestor municipal, com base oficial do Sync e validação externa dirigida quando houver evidência pública suficiente.`,
    "",
    "## VisÃ£o Executiva",
    "",
    buildExecutiveView(report),
    "",
    "## Perfil do MunicÃ­pio",
    "",
    `- População estimada: ${formatNullableInteger(report.perfilMunicipio.populacao)}`,
    `- Referência da população: ${normalizePtBrText(String(report.perfilMunicipio.populacaoAnoReferencia ?? "Não informado"))}`,
    `- Último IDHM oficial disponível: ${formatNullableDecimal(report.perfilMunicipio.idh)}`,
    `- Referência do IDHM oficial: ${normalizePtBrText(String(report.perfilMunicipio.idhAnoReferencia ?? "Não informado"))}`,
    `- PIB per capita: ${formatNullableCurrency(report.perfilMunicipio.pibPerCapita)}`,
    `- Referência do PIB per capita: ${normalizePtBrText(String(report.perfilMunicipio.pibAnoReferencia ?? "Não informado"))}`,
    "- Nota metodológica: indicadores estruturais, como IDHM, seguem a última publicação oficial disponível. A leitura gerencial detalhada deste relatório se concentra na série 2024-2026, onde a base financeira e educacional está mais consistente.",
    `- GovernanÃ§a educacional: ${cleanText(arranjo?.resposta) || "Sem fechamento nesta rodada."}`,
    "",
    "## Contexto PolÃ­tico",
    "",
    `- Prefeito atual: ${normalizePtBrText(report.contextoPolitico.prefeitoAtual)}`,
    `- Partido: ${normalizePtBrText(report.contextoPolitico.partidoAtual)}`,
    `- Ciclo atual: ${report.contextoPolitico.inicioMandato}-${report.contextoPolitico.fimMandato}`,
    `- SituaÃ§Ã£o do mandato: ${normalizePtBrText(report.contextoPolitico.classificacaoMandato.replaceAll("_", " "))}`,
    `- Leitura do mandato: ${normalizePtBrText(report.contextoPolitico.detalheMandato)}`,
    `- EstratÃ©gia comercial: ${normalizePtBrText(report.contextoPolitico.estrategiaComercial)}`,
    `- Comparativo de gestÃ£o: ${normalizePtBrText(report.contextoPolitico.resumoComparativoGestao)}`,
    "",
    "## DiagnÃ³stico da EducaÃ§Ã£o",
    "",
    `- Censo Escolar utilizado: ${report.diagnosticoEducacao.censoAno ?? "NÃ£o informado"}`,
    `- Total de escolas: ${formatNullableInteger(report.diagnosticoEducacao.totalEscolas)}`,
    `- Total de matrÃ­culas: ${formatNullableInteger(report.diagnosticoEducacao.totalMatriculas)}`,
    "",
    "Modalidades:",
    ...report.diagnosticoEducacao.modalidades
      .filter((item) => item.valor > 0)
      .map((item) => `- ${normalizePtBrText(item.label)}: ${formatInteger(item.valor)}`),
    "",
    `## Série Histórica ${historicalRangeLabel}`,
    "",
    normalizePtBrText(report.historico.resumo),
    "",
    "Fonte de confiança desta seção: receitas oficiais do FUNDEB, base educacional consolidada no Sync e validação externa apenas quando necessária para fechar contexto.",
    "",
    "| Ano | Base do Censo | Receita Total FUNDEB | ContribuiÃ§Ã£o Municipal | VAAF | VAAT | VAAR | MatrÃ­culas | Escolas | EJA | Integral | EducaÃ§Ã£o Especial |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.historico.anos.map(
      (linha) =>
        `| ${linha.ano} | ${linha.anoBaseCenso ?? "-"} | ${formatNullableCurrency(linha.totalReceitasFundeb)} | ${formatNullableCurrency(linha.contribuicaoMunicipal)} | ${formatNullableCurrency(linha.complementacaoVAAF)} | ${formatNullableCurrency(linha.complementacaoVAAT)} | ${formatNullableCurrency(linha.complementacaoVAAR)} | ${formatNullableInteger(linha.totalMatriculas)} | ${formatNullableInteger(linha.totalEscolas)} | ${formatNullableInteger(linha.eja)} | ${formatNullableInteger(linha.tempoIntegral)} | ${formatNullableInteger(linha.educacaoEspecial)} |`,
    ),
    "",
    "Leitura detalhada por exercÃ­cio:",
    ...report.historico.anos.map((linha, index) => {
      const anterior = index > 0 ? report.historico.anos[index - 1] : null;
      return `- ${linha.ano}: base do Censo ${linha.anoBaseCenso ?? "nÃ£o informada"}, receita total ${formatNullableCurrency(
        linha.totalReceitasFundeb,
      )}, contribuiÃ§Ã£o municipal ${formatNullableCurrency(linha.contribuicaoMunicipal)}, VAAT ${formatNullableCurrency(
        linha.complementacaoVAAT,
      )}, matrÃ­culas ${formatNullableInteger(linha.totalMatriculas)}, escolas ${formatNullableInteger(
        linha.totalEscolas,
      )}, EJA ${formatNullableInteger(linha.eja)}, integral ${formatNullableInteger(
        linha.tempoIntegral,
      )} e educaÃ§Ã£o especial ${formatNullableInteger(linha.educacaoEspecial)}${
        anterior
          ? `. Em relaÃ§Ã£o a ${anterior.ano}, a receita saiu de ${formatNullableCurrency(
              anterior.totalReceitasFundeb,
            )} para ${formatNullableCurrency(linha.totalReceitasFundeb)} e as matrÃ­culas saÃ­ram de ${formatNullableInteger(
              anterior.totalMatriculas,
            )} para ${formatNullableInteger(linha.totalMatriculas)}.`
          : "."
      }`;
    }),
    "",
  ];

  buildItemSection(
    lines,
    "Transporte Escolar",
    cleanText(transporte?.resposta) || "O tema ainda nÃ£o foi fechado com evidÃªncias suficientes nesta rodada.",
    transporte?.fontes ?? [],
  );

  lines.push("## Programas e Incentivos");
  lines.push("");
  lines.push(`- EJA: ${cleanText(eja?.resposta) || "Sem evidÃªncia suficiente nesta rodada."}`);
  lines.push(`- BonificaÃ§Ã£o, boas prÃ¡ticas e PrÃªmio LEIA: ${cleanText(bonificacao?.resposta) || "Sem evidÃªncia suficiente nesta rodada."}`);
  lines.push(
    "- Leitura executiva: programas de alfabetizaÃ§Ã£o, premiaÃ§Ãµes e boas prÃ¡ticas fortalecem a narrativa de desempenho da rede e ajudam a sustentar uma agenda positiva com o gestor.",
  );
  lines.push("");

  const programSourceLines = buildFonteLines([...(eja?.fontes ?? []), ...(bonificacao?.fontes ?? [])]);
  if (programSourceLines.length) {
    lines.push("Fontes principais:");
    lines.push(...programSourceLines);
    lines.push("");
  }

  buildItemSection(
    lines,
    "FormaÃ§Ã£o de Servidores",
    cleanText(formacao?.resposta) || "NÃ£o foram localizadas evidÃªncias pÃºblicas suficientes sobre formaÃ§Ã£o e capacitaÃ§Ã£o do quadro nesta rodada.",
    formacao?.fontes ?? [],
  );

  lines.push("## Parcerias Existentes");
  lines.push("");
  lines.push(`- AssistÃªncia Social x EducaÃ§Ã£o: ${cleanText(parceriaAssistencia?.resposta) || "Sem evidÃªncia suficiente nesta rodada."}`);
  lines.push(`- Cultura x EducaÃ§Ã£o: ${cleanText(parceriaCultura?.resposta) || "Sem evidÃªncia suficiente nesta rodada."}`);
  lines.push("");

  const partnershipSourceLines = buildFonteLines([...(parceriaAssistencia?.fontes ?? []), ...(parceriaCultura?.fontes ?? [])]);
  if (partnershipSourceLines.length) {
    lines.push("Fontes principais:");
    lines.push(...partnershipSourceLines);
    lines.push("");
  }

  lines.push("## ICMS-EducaÃ§Ã£o GoiÃ¡s");
  lines.push("");
  lines.push(cleanText(icms?.resposta) || "O tema ainda precisa de validaÃ§Ã£o jurÃ­dica especÃ­fica nesta rodada.");
  lines.push("");
  lines.push(
    "Leitura executiva: em GoiÃ¡s, a discussÃ£o sobre ICMS-EducaÃ§Ã£o deve ser tratada como oportunidade de melhoria de desempenho e de boas prÃ¡ticas na educaÃ§Ã£o, sem transformar tese jurÃ­dica sensÃ­vel em afirmaÃ§Ã£o fechada antes da validaÃ§Ã£o normativa.",
  );
  lines.push("");

  const icmsSourceLines = buildFonteLines(icms?.fontes ?? []);
  if (icmsSourceLines.length) {
    lines.push("Fontes principais:");
    lines.push(...icmsSourceLines);
    lines.push("");
  }

  lines.push("## AnÃ¡lise do FUNDEB");
  lines.push("");
  lines.push(...buildFundebSummary(report));
  lines.push("");

  lines.push("## Benchmark Regional e MunicÃ­pios ComparÃ¡veis");
  lines.push("");
  lines.push(normalizePtBrText(report.benchmarkRegional.resumo));
  lines.push("");
  lines.push(`CritÃ©rio adotado: ${normalizePtBrText(report.benchmarkRegional.criterio)}`);
  lines.push("");
  if (report.benchmarkRegional.municipios.length) {
    lines.push("| MunicÃ­pio | PopulaÃ§Ã£o | Receita FUNDEB | ComplementaÃ§Ã£o da UniÃ£o | Mesma faixa populacional | Insight |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    lines.push(
      ...report.benchmarkRegional.municipios.map(
        (item) =>
          `| ${normalizePtBrText(item.municipio)}/${normalizePtBrText(item.uf)} | ${formatNullableInteger(item.populacao)} | ${formatNullableCurrency(item.totalReceitasFundeb)} | ${formatNullableCurrency(item.complementacaoUniaoTotal)} | ${item.mesmaFaixaPopulacional ? "Sim" : "NÃ£o"} | ${normalizePtBrText(item.insight)} |`,
      ),
    );
    lines.push("");
  } else {
    lines.push("Nenhum municÃ­pio comparÃ¡vel com superioridade clara foi localizado nesta rodada.");
    lines.push("");
  }

  lines.push("## Proposta da Rocha Prime");
  lines.push("");
  lines.push(normalizePtBrText(report.propostaEmpresa.headline));
  lines.push("");
  lines.push(normalizePtBrText(report.propostaEmpresa.descricao));
  lines.push("");
  lines.push("Entregas:");
  lines.push(...report.propostaEmpresa.entregas.map((item) => `- ${normalizePtBrText(item)}`));
  lines.push("");
  lines.push("Etapas:");
  lines.push(...report.propostaEmpresa.etapas.map((item) => `- ${normalizePtBrText(item)}`));
  lines.push("");
  lines.push("Diferenciais:");
  lines.push(...report.propostaEmpresa.diferenciais.map((item) => `- ${normalizePtBrText(item)}`));
  lines.push("");

  lines.push("## Pontos que exigem validaÃ§Ã£o antes da entrega final");
  lines.push("");
  lines.push(`- ProntidÃ£o atual: ${getDirectedReportReadinessLabel(report.prontidao.status)} (${report.prontidao.score}/100)`);
  lines.push(...report.prontidao.bloqueios.map((item) => `- ${normalizePtBrText(item)}`));
  lines.push(...report.prontidao.avisos.map((item) => `- ${normalizePtBrText(item)}`));
  lines.push("");

  lines.push("## Cobertura do levantamento");
  lines.push("");
  lines.push(`- Confirmados: ${counts.confirmado}`);
  lines.push(`- Sinalizados: ${counts.sinalizado}`);
  lines.push(`- Pendentes manuais: ${counts.pendente_manual}`);
  lines.push(`- NÃ£o encontrados: ${counts.nao_encontrado}`);
  lines.push("");

  if (report.proximosPassos.length) {
    lines.push("## PrÃ³ximos passos recomendados");
    lines.push("");
    lines.push(...report.proximosPassos.map((item) => `- ${normalizePtBrText(item)}`));
    lines.push("");
  }

  if (report.alertasJuridicos.length) {
    lines.push("## Alertas jurÃ­dicos");
    lines.push("");
    lines.push(...report.alertasJuridicos.map((item) => `- ${normalizePtBrText(item)}`));
    lines.push("");
  }

  return `${normalizePtBrText(lines.join("\n").trim())}\n`;
}

