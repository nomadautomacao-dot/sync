import type { MunicipalXrayModel } from "./municipal-xray-template";

/**
 * A camada de síntese do Raio-X: o que este município está perdendo, em ordem.
 *
 * ## Por que isto existe
 *
 * O dossiê tinha 38 páginas de achado quantificado e um resumo executivo que
 * terminava em "o município precisa ligar orçamento, execução e resultado em
 * uma mesma rotina de gestão" — frase idêntica para os 5.570 municípios. O
 * plano de ação enxergava quatro sinais (variação do FUNDEB, os dois IDEBs e o
 * pior item de infraestrutura) e completava com um item fixo. O documento
 * pedia que o gestor lesse tudo para descobrir o que estava em jogo.
 *
 * Aqui o modelo é varrido uma vez e cada achado sai com o número que o
 * sustenta, o mecanismo pelo qual custa dinheiro e a seção que o prova.
 *
 * ## A regra que governa o valor em reais
 *
 * **Só imprime R$ quando a fonte publicou aquele R$.** O valor da obra parada
 * vem do painel do FNDE; a complementação do VAAT vem da portaria; a mediana
 * dos habilitados do VAAR vem da lista do FNDE. Nada aqui multiplica matrícula
 * por fator para "estimar quanto se ganharia" — essa conta depende do
 * VAAF/VAAT do exercício seguinte, que ninguém conhece na emissão, e um número
 * inventado na página 2 contamina as 38 que vêm depois.
 *
 * Quando não há R$ publicado, o achado sai na **grandeza física** que a fonte
 * dá (946 matrículas, 37 escolas, 12,4 pontos) e o mecanismo explica por onde
 * ela vira dinheiro. É honesto e, na frente do gestor, costuma ser mais forte:
 * ele sabe quanto vale a própria matrícula.
 */

/** Tiers de urgência. Ordenam a lista antes de qualquer critério de valor. */
export const TIERS = {
  /** Dinheiro que já não entrou neste exercício. */
  perdido: 1,
  /** Perda com data marcada no exercício seguinte, ainda evitável. */
  datado: 2,
  /** Base do fundo declarada abaixo do que a rede de fato atende. */
  base: 3,
  /** Resultado que as condicionalidades observam. */
  resultado: 4,
} as const;

export type Tier = (typeof TIERS)[keyof typeof TIERS];

export interface Achado {
  tier: Tier;
  /** Frase de manchete, com o número dentro. */
  titulo: string;
  /** R$ publicado pela fonte. `null` quando não existe — nunca estimado. */
  valor: number | null;
  /** Grandeza física quando não há R$ (ex.: "946 matrículas"). */
  medida: string | null;
  /** Por onde isso vira dinheiro. Uma frase. */
  mecanismo: string;
  /** O movimento concreto que destrava. Vira linha do plano de ação. */
  acao: string;
  /**
   * Janela em que o movimento ainda tem efeito. Não é estimativa de esforço:
   * é o prazo que a norma ou o calendário da fonte impõe.
   */
  prazo: string;
  /** Nome da seção que prova o achado, como aparece no cabeçalho da página. */
  onde: string;
}

const int = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v));
const dec = (v: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);

/**
 * Matrículas declaradas indígenas que não estão em escola classificada como
 * indígena — o vão que vira dinheiro.
 *
 * A ponderação do FUNDEB segue a classificação da **escola**, não a cor/raça
 * do aluno. Aluno declarado indígena numa escola comum pondera como urbano
 * comum. Só existe achado quando as duas contagens vêm da mesma emissão.
 */
function foraDoSegmentoIndigena(model: MunicipalXrayModel): number | null {
  const declarados = model.schoolMap?.raceTotals?.indigenous ?? null;
  const noSegmento = model.peoples?.indigenous.enrolled ?? null;
  if (declarados === null || noSegmento === null) return null;
  return declarados > noSegmento ? declarados - noSegmento : null;
}

/**
 * Varre o modelo e devolve os achados em ordem de urgência.
 *
 * Ordenação: tier primeiro; dentro do tier, quem tem R$ publicado vem antes
 * (e o maior R$ primeiro), porque valor nomeado é o que sustenta a conversa.
 */
export function levantarAchados(model: MunicipalXrayModel): Achado[] {
  const achados: Achado[] = [];
  const add = (a: Achado) => achados.push(a);

  // ── Tier 1 · dinheiro que já não entrou ────────────────────────────────
  const v = model.vaar;
  if (v && !v.qualified) {
    const quais = v.failed.join(", ");
    add({
      tier: TIERS.perdido,
      titulo: v.stateWideFailure
        ? "VAAR zerado pela reprovação do estado na Condicionalidade IV"
        : `VAAR zerado: reprovação ${v.failed.length === 1 ? "na condicionalidade" : "nas condicionalidades"} ${quais}`,
      valor: null,
      medida:
        v.stateMedian !== null
          ? `R$ 0 recebidos · mediana dos habilitados da UF: ${moeda(v.stateMedian)}`
          : "R$ 0 recebidos",
      mecanismo: v.stateWideFailure
        ? "A Cond. IV é aferida no estado (ICMS educacional) e nenhum município da UF recebe — a correção é articulação estadual, não gestão local."
        : "Reprovar em uma condicionalidade zera a parcela inteira. A aferição é anual e recomeça do zero, então o ciclo seguinte é recuperável.",
      acao: "Levantar a condicionalidade reprovada item a item com a equipe pedagógica e montar o plano do ciclo seguinte — a aferição recomeça do zero todo exercício.",
      prazo: "ciclo de aferição em curso",
      onde: "Complementações da União",
    });
  }

  const t = model.vaat;
  if (t && /inabilit|n[aã]o habilit/i.test(t.status)) {
    add({
      tier: TIERS.perdido,
      titulo: "VAAT inabilitado — 100% da complementação do exercício",
      valor: t.complement,
      medida: t.complement === null ? t.status : null,
      mecanismo:
        "A condição é única e fiscal (art. 13, §4º): dados no Siconfi e no SIOPE até 31 de agosto. Inabilitado não tem o VAAT apurado.",
      acao: "Fechar Siconfi e SIOPE antes de 31 de agosto. É a única condição, e ela é de calendário — não de mérito.",
      prazo: "até 31 de agosto",
      onde: "Complementações da União",
    });
  }

  const o = model.stalledWorks;
  if (o && o.stalled > 0 && o.stalledValue > 0) {
    add({
      tier: TIERS.perdido,
      titulo: `${o.stalled === 1 ? "1 obra parada" : `${int(o.stalled)} obras paradas`} com recurso federal já empenhado`,
      valor: o.stalledValue,
      medida: null,
      mecanismo:
        "Obra parada é perda tripla: o recurso não vira vaga, o inacabado se deteriora e o ente fica exposto na prestação de contas. Há edital de retomada.",
      acao: "Aderir ao edital de retomada do Pacto e reprogramar cronograma físico-financeiro obra a obra.",
      prazo: "janela do edital vigente",
      onde: "Obras FNDE",
    });
  }

  // ── Tier 2 · perda com data marcada, ainda evitável ────────────────────
  const f = model.fiscalTimeliness;
  if (f?.risk === "alto") {
    add({
      tier: TIERS.datado,
      titulo: "DCA entregue após o corte de 31/8 — é o cenário que inabilita ao VAAT",
      valor: null,
      medida: null,
      mecanismo:
        "O corte do art. 13, §4º olha a entrega do exercício anterior. O padrão de atraso precisa mudar neste exercício, não no próximo.",
      acao: "Antecipar o fechamento contábil e travar a DCA para abril, não para agosto — o hábito do atraso é o que inabilita no ano apertado.",
      prazo: "DCA até 30 de abril",
      onde: "Requisitos fiscais",
    });
  }

  const c = model.cauc;
  if (c && c.pendingEducation.length > 0) {
    add({
      tier: TIERS.datado,
      titulo: `${c.pendingEducation.length === 1 ? "1 pendência de educação" : `${c.pendingEducation.length} pendências de educação`} no extrato do CAUC`,
      valor: null,
      medida: c.pendingEducation.map((p) => p.code).join(", "),
      mecanismo:
        "São os itens em que o Tesouro confere a aplicação mínima e o Anexo 8 ao SIOPE — o mesmo envio que habilita ao VAAT. Custa a transferência voluntária e a complementação ao mesmo tempo.",
      acao: "Regularizar cada item nomeado com o órgão responsável antes do próximo vencimento do extrato.",
      prazo: "antes do próximo vencimento",
      onde: "Requisitos fiscais",
    });
  }

  if (model.siope?.stale === true) {
    add({
      tier: TIERS.datado,
      titulo: "Declaração ao SIOPE defasada — o outro lado do corte do VAAT",
      valor: null,
      medida: null,
      mecanismo:
        "A trava exige os dados no Siconfi e no SIOPE. Siconfi em dia não salva a habilitação se o SIOPE não fechar.",
      acao: "Transmitir a declaração do exercício de referência ao SIOPE e conferir o Anexo 8.",
      prazo: "até 31 de agosto",
      onde: "Requisitos fiscais",
    });
  }

  // ── Tier 3 · base do fundo declarada abaixo do que a rede atende ───────
  const fora = foraDoSegmentoIndigena(model);
  if (fora !== null && model.peoples) {
    add({
      tier: TIERS.base,
      titulo: `${int(fora)} matrículas indígenas declaradas fora do segmento que pondera`,
      valor: null,
      medida: `${int(fora)} matrículas · fator ${dec(model.peoples.factorMin)}–${dec(model.peoples.factorMax)}`,
      mecanismo:
        "A ponderação segue a classificação da escola, não a cor/raça do aluno: declarado indígena em escola comum pondera como urbano comum. É registro, não autodeclaração alheia.",
      acao: "Conferir, escola a escola, se a classificação declarada ao Censo corresponde ao território — a ponderação segue a escola, não o aluno.",
      prazo: "próxima coleta do Censo Escolar",
      onde: "Declaração étnica",
    });
  }

  const d = model.demographics;
  if (d && d.crechePop > 0 && d.crecheEnrollment !== null) {
    const cobertura = (d.crecheEnrollment / d.crechePop) * 100;
    if (cobertura < 50) {
      add({
        tier: TIERS.base,
        titulo: `Creche em ${dec(cobertura)}% de cobertura — a meta 1 do PNE é 50%`,
        valor: null,
        medida: `${int(d.crechePop - d.crecheEnrollment)} crianças de 0 a 3 fora da rede municipal`,
        mecanismo:
          "Creche pública integral pondera 1,55 no fundo — é a matrícula de maior valor disponível sem mudar o público que o município já atende.",
        acao: "Mapear a demanda de 0 a 3 por bairro e planejar a captura para a rede, priorizando integral.",
      prazo: "próxima coleta do Censo Escolar",
      onde: "Demografia e demanda futura",
      });
    }
  }

  const rp = model.teacherPay;
  if (rp?.reliable && rp.belowPct !== null && rp.belowPct > 0 && rp.below !== null) {
    add({
      tier: TIERS.base,
      titulo: `${dec(rp.belowPct)}% do magistério declarado abaixo do piso`,
      valor: null,
      medida: `${int(rp.below)} de ${int(rp.sampled ?? 0)} vínculos na amostra`,
      mecanismo:
        "O piso é lei (Lei nº 11.738/2008) e a remuneração sai dos 70% do fundo. Adimplência ao piso é o que o TCE e o MP olham primeiro.",
      acao: "Conferir o enquadramento da carreira contra o piso vigente e corrigir na folha antes do fechamento do exercício.",
      prazo: "exercício em curso",
      onde: "Vinculações da educação",
    });
  }

  // ── Tier 4 · resultado, que é o que as condicionalidades observam ──────
  const sr = model.schoolResults;
  if (sr && sr.ndCount > 0) {
    add({
      tier: TIERS.resultado,
      titulo: `${sr.ndCount === 1 ? "1 escola ficou" : `${int(sr.ndCount)} escolas ficaram`} sem resultado por participação abaixo de 80% no Saeb`,
      valor: null,
      medida: `${int(sr.ndCount)} de ${int(sr.total)} escolas da rede`,
      mecanismo:
        "A Condicionalidade II do VAAR cobra 80% de participação por ano escolar. Logística de prova e mobilização de família são gestão, não pedagogia — e a lista diz em quais portas bater.",
      acao: "Montar logística de aplicação e mobilização de família nas escolas nomeadas — é gestão, não pedagogia.",
      prazo: "antes da próxima aplicação do Saeb",
      onde: "Saeb e IDEB por escola",
    });
  }

  const l = model.literacy;
  if (l?.nextTarget && l.nextTarget.gapPoints > 0) {
    add({
      tier: TIERS.resultado,
      titulo: `Alfabetização ${dec(l.nextTarget.gapPoints)} pontos abaixo da meta pactuada para ${l.nextTarget.year}`,
      valor: null,
      medida: `${dec(l.latest.value)}% em ${l.latest.year} · meta ${dec(l.nextTarget.target)}%`,
      mecanismo:
        "É a única meta que o próprio município assinou, no CNCA. Criança não alfabetizada no 2º ano vira distorção idade-série e abandono adiante — que é o que a Cond. I do VAAR mede.",
      acao: "Definir linha de base por turma e rotina de avaliação formativa no 1º e 2º ano, com apoio acionado por evidência.",
      prazo: "ano letivo",
      onde: "Alfabetização",
    });
  }

  const abaixoAi =
    model.idebInitial !== null &&
    model.idebInitialTarget !== null &&
    model.idebInitial < model.idebInitialTarget;
  const abaixoAf =
    model.idebFinal !== null &&
    model.idebFinalTarget !== null &&
    model.idebFinal < model.idebFinalTarget;
  if (abaixoAi || abaixoAf) {
    const etapas = abaixoAi && abaixoAf ? "As duas etapas estão" : abaixoAi ? "Os anos iniciais estão" : "Os anos finais estão";
    add({
      tier: TIERS.resultado,
      titulo: `${etapas} abaixo da ${model.idebTargetIsNational ? "referência nacional" : "meta"} do IDEB`,
      valor: null,
      medida: [
        abaixoAi && model.idebInitial !== null ? `AI ${dec(model.idebInitial)}` : null,
        abaixoAf && model.idebFinal !== null ? `AF ${dec(model.idebFinal)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      mecanismo:
        "A Cond. I do VAAR mede evolução, não nível: rede que parte de baixo e sobe é premiada. A média municipal não diz onde intervir — a decisão é por escola.",
      acao: "Priorizar recomposição por habilidade e por escola, começando pelas de pior resultado na própria rede.",
      prazo: "ano letivo",
      onde: "Porte e resultado",
    });
  }

  return achados.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if ((a.valor === null) !== (b.valor === null)) return a.valor === null ? 1 : -1;
    return (b.valor ?? 0) - (a.valor ?? 0);
  });
}

/**
 * O outro lado da varredura: o que foi conferido e saiu limpo.
 *
 * Serve a dois propósitos e nenhum deles é elogiar o município. O primeiro é
 * de credibilidade — uma página com dois achados parece varredura rasa até o
 * leitor ver os onze pontos que foram checados. O segundo é de defesa: item
 * limpo aqui **não se acumula**, e vários deles (habilitação VAAR, corte do
 * VAAT, extrato do CAUC) são reavaliados todo exercício.
 *
 * Regra de entrada: só lista o que a fonte respondeu. Base que não respondeu
 * não é "limpo" — é desconhecido, e sai de fora nos dois lados.
 */
export function varreduraLimpa(model: MunicipalXrayModel): string[] {
  const limpos: string[] = [];

  const v = model.vaar;
  if (v?.qualified) limpos.push("VAAR habilitado nas cinco condicionalidades");

  const t = model.vaat;
  if (t && t.status && !/inabilit|n[aã]o habilit/i.test(t.status)) {
    limpos.push("VAAT habilitado no exercício");
  }

  const o = model.stalledWorks;
  if (o && o.stalled === 0) limpos.push("nenhuma obra parada no painel do FNDE");

  const f = model.fiscalTimeliness;
  if (f && f.risk !== "alto") limpos.push("DCA entregue dentro do corte de 31/8");

  const c = model.cauc;
  if (c && c.pendingEducation.length === 0) {
    limpos.push("nenhuma pendência de educação no extrato do CAUC");
  }

  if (model.siope && model.siope.stale !== true) {
    limpos.push("declaração ao SIOPE no exercício de referência");
  }

  const d = model.demographics;
  if (d && d.crechePop > 0 && d.crecheEnrollment !== null) {
    if ((d.crecheEnrollment / d.crechePop) * 100 >= 50) {
      limpos.push("creche acima da meta 1 do PNE");
    }
  }

  const rp = model.teacherPay;
  if (rp?.reliable && rp.belowPct === 0) limpos.push("magistério integralmente acima do piso");

  const sr = model.schoolResults;
  if (sr && sr.ndCount === 0) limpos.push("nenhuma escola retida por participação no Saeb");

  const l = model.literacy;
  if (l?.nextTarget && l.nextTarget.gapPoints <= 0) {
    limpos.push("alfabetização dentro da meta pactuada no CNCA");
  }

  const aiOk =
    model.idebInitial !== null &&
    model.idebInitialTarget !== null &&
    model.idebInitial >= model.idebInitialTarget;
  const afOk =
    model.idebFinal !== null &&
    model.idebFinalTarget !== null &&
    model.idebFinal >= model.idebFinalTarget;
  if (aiOk && afOk) limpos.push("IDEB nas duas etapas dentro da régua");

  const fora = foraDoSegmentoIndigena(model);
  if (fora === null && model.peoples && model.schoolMap?.raceTotals) {
    limpos.push("matrícula indígena declarada compatível com o segmento ponderado");
  }

  return limpos;
}

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}
