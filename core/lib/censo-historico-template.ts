import type { InepCensoMunicipalRecord } from "./inep-censo";
import type { CorRacaHistorico } from "./cor-raca-historico";

/**
 * Relatório Histórico do Censo Escolar — a série dos últimos três Censos lida
 * lado a lado, com o FUNDEB como chave de leitura: matrícula é o denominador
 * da receita do fundo, então toda variação aqui vira dinheiro no exercício
 * seguinte.
 *
 * O relatório é 100% dados locais (sinopses do Censo já versionadas em
 * `data/inep-censo-municipal-*.json`) — não depende de nenhuma API viva.
 */
export interface CensoHistoricoModel {
  municipality: string;
  uf: string;
  ibgeCode: string;
  generatedAt: Date;
  /** Até três Censos, em ordem crescente de ano. Nunca menos de dois. */
  years: InepCensoMunicipalRecord[];
  /**
   * Cor/raça da rede municipal em série (microdados 2023–2025), alinhada aos
   * anos exibidos. `null` quando o dataset não cobre o município.
   */
  race: CorRacaHistorico | null;
}

export function mapCensoHistoricoModel(params: {
  records: InepCensoMunicipalRecord[];
  corRaca?: CorRacaHistorico | null;
  generatedAt?: Date;
}): CensoHistoricoModel {
  const ordered = [...params.records].sort((a, b) => a.anoReferencia - b.anoReferencia);
  const years = ordered.slice(-3);
  if (years.length < 2) {
    throw new Error(
      "O Histórico do Censo precisa de pelo menos dois anos de Censo Escolar para comparar.",
    );
  }
  const last = years[years.length - 1];
  const anosExibidos = new Set(years.map((r) => r.anoReferencia));
  const corRaca = params.corRaca ?? null;
  return {
    municipality: last.municipio,
    uf: last.uf,
    ibgeCode: last.codigoIBGE,
    generatedAt: params.generatedAt ?? new Date(),
    years,
    // A série de cor/raça só entra nos anos que o relatório de fato exibe —
    // coluna de ano sem par nas outras páginas confundiria a leitura.
    race: corRaca
      ? {
          ...corRaca,
          municipal: corRaca.municipal.filter((a) => anosExibidos.has(a.ano)),
          publica: corRaca.publica.filter((a) => anosExibidos.has(a.ano)),
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function int(value: number | null) {
  return value === null ? "N/D" : integer.format(value);
}

function pct(value: number | null) {
  return value === null ? "N/D" : `${decimal.format(value)}%`;
}

function variacaoPercentual(base: number | null, atual: number | null) {
  if (base === null || atual === null || base === 0) return null;
  return ((atual - base) / Math.abs(base)) * 100;
}

type Valor = number | null;

/** Extrai a série de um campo numérico ao longo dos anos do modelo. */
function serie(
  model: CensoHistoricoModel,
  pick: (r: InepCensoMunicipalRecord) => number | null | undefined,
): Valor[] {
  return model.years.map((r) => {
    const v = pick(r);
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  });
}

/** Razão percentual null-graciosa (participação municipal, alunos/docente etc.). */
function razaoPct(numerador: Valor, denominador: Valor): Valor {
  if (numerador === null || denominador === null || denominador === 0) return null;
  return (numerador / denominador) * 100;
}

function razao(numerador: Valor, denominador: Valor): Valor {
  if (numerador === null || denominador === null || denominador === 0) return null;
  return numerador / denominador;
}

function classeDelta(delta: number | null) {
  if (delta === null) return "neutral";
  if (delta > 0) return "good";
  if (delta < 0) return "warn-text";
  return "neutral";
}

function sinal(valor: number) {
  return valor >= 0 ? "+" : "";
}

/**
 * Linha de tabela com um valor por ano e a variação primeiro→último.
 * Contagens ganham Δ absoluto + Δ%; percentuais ganham Δ em pontos.
 */
function linhaSerie(
  rotulo: string,
  valores: Valor[],
  formato: "int" | "pct" = "int",
  destaque = false,
): string {
  const primeiro = valores[0];
  const ultimo = valores[valores.length - 1];
  let deltaHtml = `<span class="neutral">—</span>`;
  if (primeiro !== null && ultimo !== null) {
    if (formato === "pct") {
      // Abaixo da resolução de uma casa, a variação é zero — "-0,0 p.p."
      // sugeriria queda onde não há.
      const d = Math.abs(ultimo - primeiro) < 0.05 ? 0 : ultimo - primeiro;
      deltaHtml = `<span class="${classeDelta(d)}">${sinal(d)}${decimal.format(d)} p.p.</span>`;
    } else {
      const d = ultimo - primeiro;
      const dPct = variacaoPercentual(primeiro, ultimo);
      deltaHtml = `<span class="${classeDelta(d)}">${sinal(d)}${integer.format(d)}${
        dPct === null ? "" : ` (${sinal(dPct)}${decimal.format(dPct)}%)`
      }</span>`;
    }
  }
  const celulas = valores
    .map((v) => `<td class="num">${esc(formato === "pct" ? pct(v) : int(v))}</td>`)
    .join("");
  const nome = destaque ? `<b>${esc(rotulo)}</b>` : esc(rotulo);
  return `<tr><td>${nome}</td>${celulas}<td class="num">${deltaHtml}</td></tr>`;
}

/** Cabeçalho padrão das tabelas: um ano por coluna + Δ primeiro→último. */
function cabecalhoSerie(model: CensoHistoricoModel, rotulo = "Indicador"): string {
  const anos = model.years.map((r) => `<th class="num">${r.anoReferencia}</th>`).join("");
  const primeiro = model.years[0].anoReferencia;
  const ultimo = model.years[model.years.length - 1].anoReferencia;
  return `<thead><tr><th>${esc(rotulo)}</th>${anos}<th class="num">Δ ${primeiro}→${ultimo}</th></tr></thead>`;
}

function metric(value: string, label: string) {
  return `<div class="metric"><div class="metric-value">${esc(value)}</div><div class="metric-label">${esc(label)}</div></div>`;
}

function header(section: string) {
  return `<header class="page-header"><strong>Histórico do Censo Escolar</strong><span>${esc(section)}</span></header>`;
}

function footer(model: CensoHistoricoModel, page: number, fonte?: string) {
  const anos = model.years.map((r) => r.anoReferencia).join(", ");
  const texto = fonte ?? `Censo Escolar da Educação Básica/INEP — sinopses estatísticas ${anos}`;
  return `<footer class="page-footer"><span>${esc(texto)}</span><span>${page}</span></footer>`;
}

// ---------------------------------------------------------------------------
// Sinais automáticos — a leitura FUNDEB da trajetória
// ---------------------------------------------------------------------------

interface Sinal {
  classe: "insight" | "risk" | "note";
  html: string;
}

interface Movimento {
  rotulo: string;
  primeiro: number;
  ultimo: number;
  variacao: number;
}

/** Séries municipais candidatas ao ranking de maiores movimentos. */
function movimentosMunicipais(model: CensoHistoricoModel): Movimento[] {
  const candidatas: Array<{ rotulo: string; pick: (r: InepCensoMunicipalRecord) => number | null | undefined }> = [
    { rotulo: "Creche municipal", pick: (r) => r.crecheMunicipal },
    { rotulo: "Pré-escola municipal", pick: (r) => r.preEscolaMunicipal },
    { rotulo: "Anos iniciais municipais", pick: (r) => r.anosIniciaisFundamentalMunicipal },
    { rotulo: "Anos finais municipais", pick: (r) => r.anosFinaisFundamentalMunicipal },
    { rotulo: "EJA municipal", pick: (r) => r.ejaMunicipal },
    { rotulo: "Educação especial municipal", pick: (r) => r.educacaoEspecialMunicipal },
    { rotulo: "Tempo integral municipal", pick: (r) => r.tempoIntegralBasicaMunicipal },
  ];
  const movimentos: Movimento[] = [];
  for (const { rotulo, pick } of candidatas) {
    const valores = serie(model, pick);
    const primeiro = valores[0];
    const ultimo = valores[valores.length - 1];
    // Base mínima de 30 matrículas: variação percentual sobre base ínfima
    // grita sem significar nada.
    if (primeiro === null || ultimo === null || primeiro < 30) continue;
    const variacao = variacaoPercentual(primeiro, ultimo);
    if (variacao === null) continue;
    movimentos.push({ rotulo, primeiro, ultimo, variacao });
  }
  return movimentos.sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao));
}

function sinaisDaTrajetoria(model: CensoHistoricoModel): Sinal[] {
  const sinais: Sinal[] = [];
  const primeiro = model.years[0].anoReferencia;
  const ultimo = model.years[model.years.length - 1].anoReferencia;

  const municipais = serie(model, (r) => r.matriculasMunicipaisTotal);
  const varMunicipal = variacaoPercentual(municipais[0], municipais[municipais.length - 1]);
  if (varMunicipal !== null && varMunicipal <= -3) {
    sinais.push({
      classe: "risk",
      html: `<b>A rede municipal encolheu ${decimal.format(Math.abs(varMunicipal))}% entre ${primeiro} e ${ultimo}.</b> A matrícula do último Censo é o denominador da receita do FUNDEB no exercício seguinte: rede menor recebe menos, mesmo sem mudar nenhuma alíquota. A queda precisa de causa nomeada — demografia, migração para outra rede ou subdeclaração — porque cada causa tem um remédio diferente.`,
    });
  } else if (varMunicipal !== null && varMunicipal >= 3) {
    sinais.push({
      classe: "insight",
      html: `<b>A rede municipal cresceu ${decimal.format(varMunicipal)}% entre ${primeiro} e ${ultimo}.</b> O crescimento entra na receita do FUNDEB com um ano de defasagem — o que o Censo de ${ultimo} declarou é o que o fundo paga em ${ultimo + 1}. Conferir se toda a expansão foi de fato declarada é conferir a própria receita.`,
    });
  }

  const creches = serie(model, (r) => r.crecheMunicipal);
  const varCreche = variacaoPercentual(creches[0], creches[creches.length - 1]);
  if (varCreche !== null && (creches[0] ?? 0) >= 30) {
    if (varCreche <= -5) {
      sinais.push({
        classe: "risk",
        html: `<b>A creche municipal caiu ${decimal.format(Math.abs(varCreche))}% no período.</b> Creche é a matrícula de maior fator de ponderação do FUNDEB (até 1,55 em tempo integral) e a lei manda aplicar no mínimo 50% do VAAT na educação infantil — perder matrícula aqui é perder a matrícula mais valiosa da rede.`,
      });
    } else if (varCreche >= 5) {
      sinais.push({
        classe: "insight",
        html: `<b>A creche municipal cresceu ${decimal.format(varCreche)}% no período.</b> É a matrícula de maior fator de ponderação do fundo (até 1,55 em tempo integral): cada vaga nova de creche vale mais receita por aluno que qualquer outra etapa.`,
      });
    }
  }

  const integral = serie(model, (r) => r.tempoIntegralBasicaMunicipal);
  const varIntegral = variacaoPercentual(integral[0], integral[integral.length - 1]);
  if (varIntegral !== null && (integral[0] ?? 0) >= 30 && varIntegral <= -5) {
    sinais.push({
      classe: "risk",
      html: `<b>O tempo integral municipal recuou ${decimal.format(Math.abs(varIntegral))}%.</b> Matrícula integral pondera acima da parcial na portaria do FUNDEB (fundamental integral 1,50; creche integral 1,55) — cada aluno que volta ao turno parcial deixa a diferença de fator na mesa no exercício seguinte.`,
    });
  }

  const participacao = model.years.map((r) =>
    razaoPct(r.matriculasMunicipaisTotal ?? null, r.matriculasBasicaTotal ?? null),
  );
  const dParticipacao =
    participacao[0] !== null && participacao[participacao.length - 1] !== null
      ? (participacao[participacao.length - 1] as number) - (participacao[0] as number)
      : null;
  if (dParticipacao !== null && Math.abs(dParticipacao) >= 2) {
    sinais.push({
      classe: "note",
      html: `<b>A participação municipal na matrícula total do território ${
        dParticipacao > 0 ? "subiu" : "caiu"
      } ${decimal.format(Math.abs(dParticipacao))} p.p.</b> — o município ${
        dParticipacao > 0 ? "está absorvendo alunos de outras redes" : "está cedendo alunos a outras redes (estadual, privada ou conveniada)"
      }. Vale mapear a fronteira: transferência entre redes muda a divisão do fundo dentro do próprio território.`,
    });
  }

  if (!sinais.length) {
    sinais.push({
      classe: "note",
      html: `<b>A rede municipal atravessou o período sem movimento brusco</b> — nenhuma série central variou além dos limiares de alerta. Estabilidade também é informação: a receita do FUNDEB derivada da matrícula tende a se manter previsível no curto prazo.`,
    });
  }
  return sinais.slice(0, 5);
}

/** Perguntas de campo geradas a partir do que a série mostrou. */
function perguntasDeCampo(model: CensoHistoricoModel): string[] {
  const perguntas: string[] = [];
  const primeiro = model.years[0].anoReferencia;
  const ultimo = model.years[model.years.length - 1].anoReferencia;

  const municipais = serie(model, (r) => r.matriculasMunicipaisTotal);
  const dMunicipal =
    municipais[0] !== null && municipais[municipais.length - 1] !== null
      ? (municipais[municipais.length - 1] as number) - (municipais[0] as number)
      : null;
  if (dMunicipal !== null && dMunicipal < 0) {
    perguntas.push(
      `A rede municipal perdeu ${integer.format(Math.abs(dMunicipal))} matrículas entre ${primeiro} e ${ultimo}. Quanto disso é queda de nascimentos, quanto é migração para outra rede e quanto é aluno que existe mas não foi declarado no Educacenso?`,
    );
  }

  const eja = serie(model, (r) => r.ejaMunicipal);
  const dEja = eja[0] !== null && eja[eja.length - 1] !== null ? (eja[eja.length - 1] as number) - (eja[0] as number) : null;
  if (dEja !== null && dEja < 0) {
    perguntas.push(
      `A EJA municipal caiu ${integer.format(Math.abs(dEja))} matrículas no período. A demanda acabou ou a oferta fechou? Onde estão hoje os adultos sem escolaridade que a rede atendia em ${primeiro}?`,
    );
  }

  const integral = serie(model, (r) => r.tempoIntegralBasicaMunicipal);
  const dIntegral =
    integral[0] !== null && integral[integral.length - 1] !== null
      ? (integral[integral.length - 1] as number) - (integral[0] as number)
      : null;
  if (dIntegral !== null && dIntegral < 0) {
    perguntas.push(
      `O tempo integral municipal perdeu ${integer.format(Math.abs(dIntegral))} matrículas. A jornada encolheu de fato ou a escola segue integral e a declaração no Censo é que regrediu? Os dois casos custam o fator — só o segundo se corrige sem custo.`,
    );
  }

  perguntas.push(
    `O responsável pelo Educacenso na secretaria confere, escola a escola, o espelho da declaração antes do fechamento? Quem valida os campos que definem fator de ponderação — localização, tempo integral, modalidade?`,
    `Os totais deste relatório batem com o sistema de gestão escolar do município no mesmo mês de referência? Divergência entre sistema local e Censo é receita declarada errada.`,
  );
  return perguntas.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------------

function paginaComoLer(model: CensoHistoricoModel, pagina: number): string {
  const primeiro = model.years[0].anoReferencia;
  const ultimo = model.years[model.years.length - 1].anoReferencia;
  const movimentos = movimentosMunicipais(model).slice(0, 4);
  const cartoes = movimentos.length
    ? movimentos
        .map(
          (m) =>
            `<div class="card ${m.variacao < 0 ? "warn" : "accent"}"><h3>${esc(m.rotulo)}</h3><div class="metric"><div class="metric-value">${esc(
              `${sinal(m.variacao)}${decimal.format(m.variacao)}%`,
            )}</div><div class="metric-label">${esc(`${int(m.primeiro)} → ${int(m.ultimo)} matrículas · ${primeiro}→${ultimo}`)}</div></div></div>`,
        )
        .join("")
    : `<div class="empty">Nenhuma série municipal com base mínima para ranquear movimentos.</div>`;
  return `<section class="page content-page">${header("Como ler")}<main class="page-body"><div class="kicker">Método</div><h2>Três Censos lado a lado, sem projeção no meio</h2><p class="lede">Cada coluna é um Censo Escolar fechado e publicado pelo INEP — ano de referência ${model.years
    .map((r) => r.anoReferencia)
    .join(", ")}. O relatório compara apenas o que o INEP publicou: nenhum valor é projetado, interpolado ou estimado. "N/D" significa que a sinopse daquele ano não trouxe o dado.</p><div class="grid-2 mt-3"><div class="card accent"><h3>Por que a série importa para o FUNDEB</h3><p>A matrícula declarada em cada Censo é o denominador da receita do fundo no exercício seguinte: o Censo de ${ultimo} define o FUNDEB de ${ultimo + 1}. Ler a série é ler a trajetória da receita antes de ela acontecer.</p></div><div class="card warn"><h3>O que a comparação não faz</h3><p>Anos de referência diferentes têm datas de coleta diferentes — o Censo fotografa a última quarta-feira de maio. Mudança de metodologia entre edições, quando existe, é do INEP e vale para o país inteiro; a comparação entre municípios permanece justa.</p></div></div><div class="kicker mt-3">Maiores movimentos da rede municipal</div><div class="grid-4 mt-1">${cartoes}</div><div class="note mt-3"><b>Regra de integridade:</b> variações são calculadas apenas entre valores publicados, sempre do primeiro ao último ano da série. Séries com base menor que 30 matrículas ficam fora do ranking acima — percentual sobre base ínfima não é movimento, é ruído.</div></main>${footer(model, pagina)}</section>`;
}

function paginaRedes(model: CensoHistoricoModel, pagina: number): string {
  const ultimo = model.years[model.years.length - 1];
  const participacao = model.years.map((r) =>
    razaoPct(r.matriculasMunicipaisTotal ?? null, r.matriculasBasicaTotal ?? null),
  );
  const rows = [
    linhaSerie("Todas as redes (básica)", serie(model, (r) => r.matriculasBasicaTotal)),
    linhaSerie("Rede pública (todas as esferas)", serie(model, (r) => r.matriculasPublicasTotal)),
    linhaSerie("Rede municipal", serie(model, (r) => r.matriculasMunicipaisTotal), "int", true),
    linhaSerie("Participação municipal no total", participacao, "pct"),
  ].join("");
  return `<section class="page content-page">${header("Matrículas por rede")}<main class="page-body"><div class="kicker">O denominador da receita</div><h2>Quem atende os alunos do território</h2><p class="lede">A matrícula municipal é a que entra na conta do FUNDEB do município. As demais redes contextualizam: aluno que muda de rede não some do território — muda de quem recebe por ele.</p><div class="grid-3 mt-3">${metric(int(ultimo.matriculasMunicipaisTotal), `rede municipal · ${ultimo.anoReferencia}`)}${metric(int(ultimo.matriculasBasicaTotal), `todas as redes · ${ultimo.anoReferencia}`)}${metric(pct(participacao[participacao.length - 1]), "participação municipal")}</div><table class="mt-3">${cabecalhoSerie(model, "Matrículas")}<tbody>${rows}</tbody></table><div class="grid-2 mt-3"><div class="insight"><b>Leitura FUNDEB:</b> a variação da rede municipal antecipa a variação da receita — o fundo paga no exercício seguinte a matrícula que o Censo declarou neste. Variação de rede sem variação de receita prevista é sinal de erro em alguma das duas pontas.</div><div class="note"><b>Leitura de fronteira:</b> quando a participação municipal muda e o total do território não, a explicação é migração entre redes — estadual, privada ou conveniada — e não demografia.</div></div></main>${footer(model, pagina)}</section>`;
}

function paginaInfantil(model: CensoHistoricoModel, pagina: number): string {
  const ultimo = model.years[model.years.length - 1];
  const rows = [
    linhaSerie("Creche · rede municipal", serie(model, (r) => r.crecheMunicipal), "int", true),
    linhaSerie("Creche · todas as redes", serie(model, (r) => r.crecheTotal)),
    linhaSerie("Pré-escola · rede municipal", serie(model, (r) => r.preEscolaMunicipal), "int", true),
    linhaSerie("Pré-escola · todas as redes", serie(model, (r) => r.preEscolaTotal)),
    linhaSerie("Educação infantil · rede municipal", serie(model, (r) => r.educacaoInfantilMunicipal)),
    linhaSerie("Creche integral · rede municipal", serie(model, (r) => r.tempoIntegralCrecheMunicipal)),
    linhaSerie("Pré-escola integral · rede municipal", serie(model, (r) => r.tempoIntegralPreEscolaMunicipal)),
  ].join("");
  return `<section class="page content-page">${header("Educação infantil")}<main class="page-body"><div class="kicker">A etapa que vale mais</div><h2>Creche e pré-escola: a matrícula de maior fator</h2><p class="lede">A educação infantil é responsabilidade constitucional prioritária do município — e a portaria do FUNDEB reconhece isso no fator: creche em tempo integral chega a 1,55, o maior peso entre as etapas urbanas comuns. A lei do fundo ainda manda aplicar no mínimo 50% do VAAT na etapa.</p><div class="grid-3 mt-3">${metric(int(ultimo.crecheMunicipal ?? null), `creche municipal · ${ultimo.anoReferencia}`)}${metric(int(ultimo.preEscolaMunicipal ?? null), `pré-escola municipal · ${ultimo.anoReferencia}`)}${metric(int(ultimo.tempoIntegralCrecheMunicipal ?? null), `creche integral · ${ultimo.anoReferencia}`)}</div><table class="mt-3">${cabecalhoSerie(model, "Educação infantil")}<tbody>${rows}</tbody></table><div class="grid-2 mt-3"><div class="insight"><b>Leitura FUNDEB:</b> expandir creche é a expansão mais bem paga da rede — e a fila de creche costuma ser a judicialização mais comum contra o município. A série mostra se a oferta está acompanhando a obrigação.</div><div class="note"><b>Leitura de declaração:</b> creche parcial e integral têm fatores diferentes. Turma integral declarada como parcial rende menos fundo pelo mesmo custo — a linha de creche integral acima é a que merece auditoria escola a escola.</div></div></main>${footer(model, pagina)}</section>`;
}

function paginaFundamental(model: CensoHistoricoModel, pagina: number): string {
  const ultimo = model.years[model.years.length - 1];
  const participacaoAf = model.years.map((r) =>
    razaoPct(r.anosFinaisFundamentalMunicipal ?? null, r.anosFinaisFundamentalTotal ?? null),
  );
  const rows = [
    linhaSerie("Anos iniciais · rede municipal", serie(model, (r) => r.anosIniciaisFundamentalMunicipal), "int", true),
    linhaSerie("Anos iniciais · todas as redes", serie(model, (r) => r.anosIniciaisFundamentalTotal)),
    linhaSerie("Anos finais · rede municipal", serie(model, (r) => r.anosFinaisFundamentalMunicipal), "int", true),
    linhaSerie("Anos finais · todas as redes", serie(model, (r) => r.anosFinaisFundamentalTotal)),
    linhaSerie("Participação municipal nos anos finais", participacaoAf, "pct"),
    linhaSerie("Fundamental · rede municipal", serie(model, (r) => r.ensinoFundamentalMunicipal)),
  ].join("");
  return `<section class="page content-page">${header("Ensino fundamental")}<main class="page-body"><div class="kicker">O corpo da rede</div><h2>Anos iniciais e finais: onde a rede ganha e perde alunos</h2><p class="lede">Os anos iniciais são tipicamente municipais; nos anos finais a rede divide o atendimento com o estado. A série mostra se essa fronteira está se movendo — e cada aluno que cruza a fronteira leva o repasse junto.</p><div class="grid-3 mt-3">${metric(int(ultimo.anosIniciaisFundamentalMunicipal ?? null), `anos iniciais municipais · ${ultimo.anoReferencia}`)}${metric(int(ultimo.anosFinaisFundamentalMunicipal ?? null), `anos finais municipais · ${ultimo.anoReferencia}`)}${metric(pct(participacaoAf[participacaoAf.length - 1]), "participação municipal nos anos finais")}</div><table class="mt-3">${cabecalhoSerie(model, "Ensino fundamental")}<tbody>${rows}</tbody></table><div class="grid-2 mt-3"><div class="insight"><b>Leitura de coorte:</b> a queda dos anos iniciais de hoje é a queda dos anos finais daqui a quatro anos — e a da receita junto. Comparar a série das duas etapas antecipa o tamanho da rede na próxima gestão.</div><div class="note"><b>Leitura de partilha:</b> a participação municipal nos anos finais diz quem está absorvendo a etapa no território. Municipalização e estadualização aparecem aqui antes de aparecer em qualquer convênio assinado.</div></div></main>${footer(model, pagina)}</section>`;
}

function paginaEjaEspecial(model: CensoHistoricoModel, pagina: number): string {
  const ultimo = model.years[model.years.length - 1];
  const rows = [
    linhaSerie("EJA · rede municipal", serie(model, (r) => r.ejaMunicipal), "int", true),
    linhaSerie("EJA · todas as redes", serie(model, (r) => r.ejaTotal)),
    linhaSerie("Educação especial · rede municipal", serie(model, (r) => r.educacaoEspecialMunicipal), "int", true),
    linhaSerie("Educação especial · todas as redes", serie(model, (r) => r.educacaoEspecialTotal)),
    linhaSerie("Educação especial integral · municipal", serie(model, (r) => r.tempoIntegralEducacaoEspecialMunicipal)),
  ].join("");
  return `<section class="page content-page">${header("EJA e educação especial")}<main class="page-body"><div class="kicker">As matrículas que medem inclusão</div><h2>Quem a rede alcança além do fluxo regular</h2><p class="lede">EJA e educação especial são as matrículas que dizem se a rede busca quem ficou para trás — e ambas contam no FUNDEB com fatores próprios da portaria. Queda aqui raramente é demanda que acabou; costuma ser oferta que fechou.</p><div class="grid-3 mt-3">${metric(int(ultimo.ejaMunicipal ?? null), `EJA municipal · ${ultimo.anoReferencia}`)}${metric(int(ultimo.educacaoEspecialMunicipal ?? null), `educação especial municipal · ${ultimo.anoReferencia}`)}${metric(int(ultimo.educacaoEspecialTotal ?? null), `educação especial no território · ${ultimo.anoReferencia}`)}</div><table class="mt-3">${cabecalhoSerie(model, "Modalidade")}<tbody>${rows}</tbody></table><div class="grid-2 mt-3"><div class="insight"><b>Leitura de demanda:</b> o Censo Demográfico registra a população sem instrução do município — enquanto ela existir, EJA em queda é demanda reprimida, não demanda resolvida. A comparação direta está no Raio-X municipal.</div><div class="note"><b>Leitura de inclusão:</b> a matrícula de educação especial cresce no país inteiro desde a política de educação inclusiva. Série municipal estagnada contra tendência nacional de alta sugere subidentificação, não ausência de alunos.</div></div></main>${footer(model, pagina)}</section>`;
}

function paginaCorRaca(model: CensoHistoricoModel, pagina: number): string {
  const fonteMicrodados = `INEP — microdados do Censo Escolar ${
    model.race ? model.race.municipal.map((a) => a.ano).join(", ") : model.years.map((r) => r.anoReferencia).join(", ")
  } (rede municipal, escolas em atividade)`;
  const serie = model.race?.municipal ?? [];
  if (serie.length < 2) {
    return `<section class="page content-page">${header("Cor/raça em série")}<main class="page-body"><div class="kicker">Equidade</div><h2>Série de cor/raça indisponível para este município</h2><p class="lede">O dataset de microdados não trouxe a composição por cor/raça da rede municipal nos anos comparados. Nenhum valor é estimado no lugar do dado.</p></main>${footer(model, pagina, fonteMicrodados)}</section>`;
  }

  const pctDe = (a: (typeof serie)[number], valor: number) => (a.total > 0 ? (valor / a.total) * 100 : null);
  const linha = (rotulo: string, pick: (a: (typeof serie)[number]) => number, destaque = false) =>
    linhaSerie(rotulo, serie.map((a) => pctDe(a, pick(a))), "pct", destaque);

  const ultimo = serie[serie.length - 1];
  const primeiro = serie[0];
  const negraUltimo = pctDe(ultimo, ultimo.preta + ultimo.parda);
  const ndUltimo = pctDe(ultimo, ultimo.naoDeclarada);
  const ndPrimeiro = pctDe(primeiro, primeiro.naoDeclarada);
  const deltaNd = ndUltimo !== null && ndPrimeiro !== null ? ndUltimo - ndPrimeiro : null;

  const rows = [
    linha("Negra (preta + parda)", (a) => a.preta + a.parda, true),
    linha("Parda", (a) => a.parda),
    linha("Preta", (a) => a.preta),
    linha("Branca", (a) => a.branca),
    linha("Indígena", (a) => a.indigena),
    linha("Amarela", (a) => a.amarela),
    linha("Não declarada", (a) => a.naoDeclarada, true),
  ].join("");

  const leituraNd =
    ndUltimo !== null && ndUltimo >= 15
      ? `<div class="risk"><b>${pct(ndUltimo)} da rede sem declaração de cor/raça em ${ultimo.ano}${
          deltaNd !== null ? ` (${sinal(deltaNd)}${decimal.format(deltaNd)} p.p. na série)` : ""
        }.</b> Campo em branco na coleta suja exatamente o indicador que a Condicionalidade III do VAAR observa: com um sexto da rede sem declaração, qualquer leitura de desigualdade racial de aprendizagem começa distorcida. Corrigir o cadastro no Educacenso é a ação de menor custo desta página.</div>`
      : `<div class="insight"><b>Não declarada em ${pct(ndUltimo)} em ${ultimo.ano}${
          deltaNd !== null ? ` (${sinal(deltaNd)}${decimal.format(deltaNd)} p.p. na série)` : ""
        }.</b> ${deltaNd !== null && deltaNd < 0 ? "A queda indica coleta melhorando — a leitura de equidade fica mais confiável a cada Censo." : "Manter o campo preenchido na coleta é o que sustenta a leitura de equidade das próximas páginas."}</div>`;

  return `<section class="page content-page">${header("Cor/raça em série")}<main class="page-body"><div class="kicker">Equidade e Condicionalidade III</div><h2>Para quem a rede ensina — e como isso mudou</h2><p class="lede">Composição da matrícula da rede municipal por cor/raça, declarada ao Censo pelos responsáveis. A série importa duas vezes: o VAAR passou a premiar redução de desigualdade <b>racial</b> de aprendizagem (Cond. III), e a qualidade da própria declaração define se essa leitura é possível.</p><div class="grid-3 mt-3">${metric(
    negraUltimo === null ? "N/D" : pct(negraUltimo),
    `matrícula negra (preta + parda) · ${ultimo.ano}`,
  )}${metric(int(ultimo.indigena), `matrículas indígenas · ${ultimo.ano}`)}${metric(
    ndUltimo === null ? "N/D" : pct(ndUltimo),
    `cor/raça não declarada · ${ultimo.ano}`,
  )}</div><table class="mt-3">${cabecalhoSerie(model, "% da matrícula municipal")}<tbody>${rows}</tbody></table><div class="grid-2 mt-3">${leituraNd}<div class="note"><b>Leitura de equidade:</b> a composição estável com resultado desigual é o que a Cond. III mede. Cruzar esta série com a distribuição de proficiência do Raio-X responde a pergunta que o FNDE fará: a rede reduz a distância entre grupos ou só a média?</div></div><p class="small mt-1">Percentuais sobre o total de matrículas da rede municipal informado nos microdados de cada ano — a declaração é do responsável pelo aluno, e a ausência dela é registrada como "não declarada", nunca imputada.</p></main>${footer(model, pagina, fonteMicrodados)}</section>`;
}

function paginaIntegral(model: CensoHistoricoModel, pagina: number): string {
  const ultimo = model.years[model.years.length - 1];
  const cobertura = model.years.map((r) =>
    razaoPct(r.tempoIntegralBasicaMunicipal ?? null, r.matriculasMunicipaisTotal ?? null),
  );
  const rows = [
    linhaSerie("Tempo integral · rede municipal", serie(model, (r) => r.tempoIntegralBasicaMunicipal), "int", true),
    linhaSerie("Cobertura integral da rede municipal", cobertura, "pct"),
    linhaSerie("Creche integral", serie(model, (r) => r.tempoIntegralCrecheMunicipal)),
    linhaSerie("Pré-escola integral", serie(model, (r) => r.tempoIntegralPreEscolaMunicipal)),
    linhaSerie("Anos iniciais integrais", serie(model, (r) => r.tempoIntegralAnosIniciaisMunicipal)),
    linhaSerie("Anos finais integrais", serie(model, (r) => r.tempoIntegralAnosFinaisMunicipal)),
    linhaSerie("EJA integral", serie(model, (r) => r.tempoIntegralEjaMunicipal)),
  ].join("");
  return `<section class="page content-page">${header("Tempo integral")}<main class="page-body"><div class="kicker">Jornada é fator</div><h2>A matrícula integral vale mais no fundo — e no aluno</h2><p class="lede">A portaria do FUNDEB pondera a jornada: fundamental em tempo integral fator 1,50, creche integral 1,55. A mesma criança, na mesma escola, vale até 50% mais receita quando a jornada se estende — e o programa federal Escola em Tempo Integral paga a expansão.</p><div class="grid-3 mt-3">${metric(int(ultimo.tempoIntegralBasicaMunicipal ?? null), `matrículas integrais · ${ultimo.anoReferencia}`)}${metric(pct(cobertura[cobertura.length - 1]), "cobertura integral da rede")}${metric(int(ultimo.tempoIntegralCrecheMunicipal ?? null), `creche integral · ${ultimo.anoReferencia}`)}</div><table class="mt-3">${cabecalhoSerie(model, "Tempo integral")}<tbody>${rows}</tbody></table><div class="grid-2 mt-3"><div class="insight"><b>Leitura FUNDEB:</b> a série da cobertura integral é a série do fator médio da rede. Expandir jornada é a única forma de aumentar a receita por aluno sem abrir uma vaga nova.</div><div class="note"><b>Leitura de declaração:</b> jornada de 7 horas ou mais é o corte do Censo para tempo integral. Escola que oferta 6h50 não conta — e escola que oferta 7h e declara errado também não. O corte fica a minutos da receita.</div></div></main>${footer(model, pagina)}</section>`;
}

function paginaDocentesEscolas(model: CensoHistoricoModel, pagina: number): string {
  const ultimo = model.years[model.years.length - 1];
  const alunosPorDocente = model.years.map((r) =>
    razao(r.matriculasMunicipaisTotal ?? null, r.docentesMunicipaisTotal ?? null),
  );
  const alunosPorEscola = model.years.map((r) =>
    razao(r.matriculasMunicipaisTotal ?? null, r.escolasMunicipaisTotal ?? null),
  );
  const fmtRazao = (v: Valor) => (v === null ? null : Math.round(v * 10) / 10);
  const rows = [
    linhaSerie("Docentes · rede municipal", serie(model, (r) => r.docentesMunicipaisTotal), "int", true),
    linhaSerie("Escolas · rede municipal", serie(model, (r) => r.escolasMunicipaisTotal), "int", true),
    linhaSerie("Docentes · todas as redes", serie(model, (r) => r.docentesTotal)),
    linhaSerie("Escolas · todas as redes", serie(model, (r) => r.escolasTotal)),
    linhaSerie("Alunos por docente · municipal", alunosPorDocente.map(fmtRazao)),
    linhaSerie("Alunos por escola · municipal", alunosPorEscola.map(fmtRazao)),
  ].join("");
  const razaoAtual = alunosPorDocente[alunosPorDocente.length - 1];
  return `<section class="page content-page">${header("Docentes e rede física")}<main class="page-body"><div class="kicker">Quem ensina e onde</div><h2>A rede física e o corpo docente acompanharam a matrícula?</h2><p class="lede">Docentes e escolas são o custo fixo da rede. Quando a matrícula cai e a estrutura não, o custo por aluno sobe em silêncio; quando a matrícula sobe e a estrutura não, a razão aluno/docente denuncia a sobrecarga.</p><div class="grid-3 mt-3">${metric(int(ultimo.docentesMunicipaisTotal), `docentes municipais · ${ultimo.anoReferencia}`)}${metric(int(ultimo.escolasMunicipaisTotal), `escolas municipais · ${ultimo.anoReferencia}`)}${metric(razaoAtual === null ? "N/D" : decimal.format(razaoAtual), "alunos por docente")}</div><table class="mt-3">${cabecalhoSerie(model, "Estrutura")}<tbody>${rows}</tbody></table><div class="grid-2 mt-3"><div class="insight"><b>Leitura de custo:</b> os 70% do FUNDEB vão para a remuneração dos profissionais. A razão aluno/docente é o elo entre a série de matrículas desta página e a folha — ela diz se a receita por aluno está pagando mais ou menos estrutura por aluno.</div><div class="note"><b>Contagem do INEP:</b> docente que atua em duas redes conta em ambas; escola é contada pela existência, não pelo porte. As razões acima comparam o município com ele mesmo ao longo do tempo — para isso, a régua é estável.</div></div></main>${footer(model, pagina)}</section>`;
}

function paginaInfraestrutura(model: CensoHistoricoModel, pagina: number): string {
  const itens: Array<{ rotulo: string; pick: (r: InepCensoMunicipalRecord) => number | null | undefined }> = [
    { rotulo: "Água potável", pick: (r) => r.escolasComAguaPotavelPct },
    { rotulo: "Esgoto sanitário", pick: (r) => r.escolasComEsgotoPct },
    { rotulo: "Cozinha", pick: (r) => r.escolasComCozinhaPct },
    { rotulo: "Alimentação ofertada", pick: (r) => r.escolasComAlimentacaoPct },
    { rotulo: "Internet", pick: (r) => r.escolasComInternetPct },
    { rotulo: "Banda larga", pick: (r) => r.escolasComBandaLargaPct },
    { rotulo: "Laboratório de informática", pick: (r) => r.escolasComLaboratorioInformaticaPct },
    { rotulo: "Laboratório de ciências", pick: (r) => r.escolasComLaboratorioCienciasPct },
    { rotulo: "Quadra de esportes", pick: (r) => r.escolasComQuadraPct },
    { rotulo: "Acessibilidade", pick: (r) => r.escolasComAcessibilidadePct },
  ];
  const rows = itens.map((item) => linhaSerie(item.rotulo, serie(model, item.pick), "pct")).join("");
  const ultimo = model.years[model.years.length - 1];
  return `<section class="page content-page">${header("Infraestrutura escolar")}<main class="page-body"><div class="kicker">Condições de oferta</div><h2>O prédio acompanhou a rede?</h2><p class="lede">Cobertura sobre as ${
    ultimo.escolasInfraPublicasTotal ? `${int(ultimo.escolasInfraPublicasTotal)} escolas` : "escolas"
  } da rede <b>pública</b> do território — o Censo avalia a infraestrutura de todas as escolas públicas, não só as municipais. A série mostra o que melhorou de fato e o que só mudou de declaração.</p><table class="mt-3">${cabecalhoSerie(model, "Cobertura (% das escolas públicas)")}<tbody>${rows}</tbody></table><div class="grid-2 mt-3"><div class="insight"><b>Leitura de investimento:</b> infraestrutura é onde os 30% do fundo e os 15% de capital do VAAT aparecem fisicamente. Cobertura estagnada com receita crescente é investimento que não chegou ao prédio.</div><div class="note"><b>Leitura de declaração:</b> queda brusca de um item de um ano para o outro raramente é demolição — costuma ser correção (ou erro) de declaração. Vale conferir na escola antes de virar obra no plano.</div></div></main>${footer(model, pagina)}</section>`;
}

function paginaLeitura(model: CensoHistoricoModel, pagina: number): string {
  const sinais = sinaisDaTrajetoria(model)
    .map((s) => `<div class="${s.classe}">${s.html}</div>`)
    .join(`<div style="height:.1in"></div>`);
  const perguntas = perguntasDeCampo(model)
    .map((p) => `<li>${esc(p)}</li>`)
    .join("");
  const shortDate = new Intl.DateTimeFormat("pt-BR").format(model.generatedAt);
  return `<section class="page content-page">${header("Leitura da trajetória")}<main class="page-body"><div class="kicker">O que a série diz</div><h2>Sinais da trajetória e o que verificar em campo</h2><p class="lede">Os sinais abaixo são gerados dos próprios números das páginas anteriores — nenhum vem de opinião. O que a série não explica vira pergunta de campo, com o dado embutido na pergunta.</p><div class="mt-3">${sinais}</div><div class="card mt-3"><h3>Perguntas para a visita técnica</h3><ul>${perguntas}</ul></div><div class="note mt-3"><b>Aviso técnico:</b> relatório informativo gerado em ${esc(shortDate)} a partir das sinopses estatísticas do Censo Escolar/INEP. Não substitui o espelho do Educacenso nem os sistemas oficiais de matrícula.</div></main>${footer(model, pagina)}</section>`;
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

export function generateCensoHistoricoHtml(model: CensoHistoricoModel): string {
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(model.generatedAt);
  const shortDate = new Intl.DateTimeFormat("pt-BR").format(model.generatedAt);
  const primeiro = model.years[0];
  const ultimo = model.years[model.years.length - 1];
  const municipais = serie(model, (r) => r.matriculasMunicipaisTotal);
  const varMunicipal = variacaoPercentual(municipais[0], municipais[municipais.length - 1]);
  const maiorMatricula = Math.max(...municipais.map((v) => v ?? 0), 1);
  const barras = model.years
    .map((r, index) => {
      const valor = municipais[index];
      const altura = valor === null ? 4 : Math.max(8, Math.round((valor / maiorMatricula) * 100));
      return `<div class="cover-bar"><b>${esc(int(valor))}</b><div class="cover-bar-col" style="height:${altura}%"></div><span>${r.anoReferencia}</span></div>`;
    })
    .join("");
  const cityLengthClass = model.municipality.length > 34
    ? " is-very-long"
    : model.municipality.length > 24
      ? " is-long"
      : "";

  let paginaAtual = 1;
  const prox = () => (paginaAtual += 1);

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Histórico do Censo Escolar | ${esc(model.municipality)}</title>
<style>
@page{size:letter;margin:0}*{box-sizing:border-box}:root{--navy:#10263f;--blue:#176b87;--teal:#27a69a;--gold:#e6a23c;--red:#c75050;--ink:#19242e;--muted:#647380;--line:#d9e1e5;--paper:#fbfcfc;--wash:#eef4f5;--good:#22856f;--warn:#a66a10;--page-x:.64in;--page-header-h:.56in;--page-footer-h:.44in}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0;background:#dfe6e9;color:var(--ink)}body{font-family:Arial,"Noto Sans",sans-serif;font-size:9pt;line-height:1.38}
.page{width:8.5in;height:11in;margin:0 auto;background:var(--paper);overflow:hidden;page-break-after:always;position:relative}.page:last-child{page-break-after:auto}
.content-page{display:grid;grid-template-rows:auto 1fr auto}
.page-header{height:var(--page-header-h);min-height:var(--page-header-h);padding:.2in var(--page-x) .1in;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:end;color:var(--muted);font-size:7.4pt;letter-spacing:.07em;text-transform:uppercase}.page-header strong{color:var(--navy);font-weight:800}
.page-body{padding:.3in var(--page-x) .22in;overflow:hidden}
.page-footer{height:var(--page-footer-h);min-height:var(--page-footer-h);padding:.1in var(--page-x) .16in;border-top:1px solid var(--line);color:var(--muted);font-size:7pt;display:flex;justify-content:space-between;align-items:start}
h1,h2,h3,p{margin:0}h2{color:var(--navy);font-size:23pt;line-height:1.04;letter-spacing:-.025em;max-width:7.05in}h2:after{content:"";display:block;width:.9in;height:.06in;margin-top:.12in;background:var(--teal)}h3{color:var(--navy);font-size:11pt;line-height:1.15;margin-bottom:.07in}p+p{margin-top:.09in}
.kicker{color:var(--teal);font-size:8pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.09in}
.lede{margin-top:.15in;max-width:6.65in;color:#344551;font-size:10.2pt;line-height:1.45}
.small{font-size:7.7pt;color:var(--muted)}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:.18in}.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:.13in}.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:.11in}
.grid-2,.grid-3,.grid-4{align-items:stretch}.grid-2>*,.grid-3>*,.grid-4>*{min-width:0}
.mt-1{margin-top:.12in}.mt-2{margin-top:.2in}.mt-3{margin-top:.28in}
.card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:.17in;break-inside:avoid}.card.accent{border-top:4px solid var(--teal)}.card.warn{border-top:4px solid var(--gold)}
.metric{border-left:4px solid var(--teal);padding:.035in 0 .045in .13in;min-height:.76in;break-inside:avoid}.metric-value{font-size:19pt;font-weight:800;color:var(--navy);line-height:.98;letter-spacing:-.025em;overflow-wrap:anywhere}.metric-label{margin-top:.07in;color:var(--muted);font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.045em}
.note{background:#fff8e7;border-left:4px solid var(--gold);padding:.12in .14in;color:#584416;break-inside:avoid}.insight{background:#e8f4f2;border-left:4px solid var(--teal);padding:.12in .14in;break-inside:avoid}.risk{background:#f9eaea;border-left:4px solid var(--red);padding:.12in .14in;break-inside:avoid}
ul{margin:.07in 0 0 .17in;padding:0}li{margin-bottom:.045in}
table{width:100%;border-collapse:collapse;font-size:7.8pt;break-inside:avoid}th{background:var(--navy);color:#fff;text-align:left;font-weight:700;padding:.07in .08in}td{padding:.065in .08in;border-bottom:1px solid var(--line);vertical-align:top}tbody tr:nth-child(even){background:#f3f6f7}td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.good{color:var(--good);font-weight:800}.warn-text{color:var(--warn);font-weight:800}.neutral{color:var(--muted);font-weight:800}
.empty{padding:.28in;background:var(--wash);border:1px dashed #b8c6cc;border-radius:7px;color:var(--muted);text-align:center}
.brand{font-size:8pt;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
/* Capa — série de barras no lugar do mapa: o relatório é a linha do tempo. */
.cover{background:#f4f6f4;color:var(--ink);display:grid;grid-template-rows:.08in .76in 1fr 1.72in}
.cover-topline{background:linear-gradient(90deg,var(--teal) 0 72%,var(--gold) 72% 100%)}
.cover-header{padding:0 var(--page-x);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #d8e1df}
.cover-header .brand{color:var(--navy);font-size:7.5pt;letter-spacing:.16em}.brand span{color:var(--muted);font-weight:700;letter-spacing:.08em}
.cover-edition{border:1px solid #cbd7d5;border-radius:99px;padding:.07in .13in;color:var(--navy);font-size:6.8pt;font-weight:800;letter-spacing:.1em}
.cover-body{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(0,.98fr);gap:.3in;padding:.46in var(--page-x) .38in;overflow:hidden}
.cover-copy{display:flex;min-width:0;flex-direction:column;align-items:flex-start}
.cover-eyebrow{color:var(--teal);font-size:7.5pt;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
.cover-title{margin-top:.42in;color:var(--navy);font-size:44pt;line-height:.84;letter-spacing:-.05em}
.cover-title small{display:block;margin-top:.14in;color:var(--muted);font-size:12pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.cover-city{margin-top:.42in;color:var(--navy);font-size:31pt;font-weight:800;line-height:.96;letter-spacing:-.04em;text-wrap:balance;overflow-wrap:anywhere}
.cover-city.is-long{font-size:27pt}.cover-city.is-very-long{font-size:23pt}
.cover-place{margin-top:.15in;display:flex;align-items:center;gap:.08in;color:var(--teal);font-size:8pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
.cover-place:before{content:"";width:.28in;height:2px;background:var(--gold)}
.cover-sub{margin-top:.3in;max-width:3.25in;color:#42535d;font-size:10pt;line-height:1.5}
.cover-meta{margin-top:auto;padding-top:.3in;color:var(--muted);font-size:7.5pt;line-height:1.55}.cover-meta b{color:var(--navy)}
.cover-visual{display:flex;min-width:0;align-items:flex-start;justify-content:flex-end;padding-top:.08in}
.cover-chart-frame{width:100%;background:#e7efed;border:1px solid #cfddda;border-radius:18px;padding:.18in;box-shadow:0 .16in .42in rgba(16,38,63,.08)}
.cover-chart{height:4.7in;border-radius:12px;background:#edf3f1;display:grid;grid-template-columns:repeat(${model.years.length},1fr);gap:.3in;align-items:end;padding:.35in .4in .3in}
.cover-bar{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:.08in}
.cover-bar b{color:var(--navy);font-size:9.5pt;letter-spacing:-.02em}
.cover-bar-col{width:100%;max-width:1.05in;background:linear-gradient(180deg,#69c2b8,var(--teal));border-radius:8px 8px 3px 3px;border:1px solid rgba(16,38,63,.18)}
.cover-bar span{color:var(--muted);font-size:8pt;font-weight:800;letter-spacing:.06em}
.cover-chart-caption{padding:.13in .03in .02in;display:flex;justify-content:space-between;gap:.12in;color:var(--muted);font-size:6.7pt;text-transform:uppercase;letter-spacing:.06em}.cover-chart-caption b{color:var(--navy)}
.cover-bottom{padding:.27in var(--page-x) .3in;background:var(--navy);color:#fff}
.cover-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.22in}
.cover-stat{border-left:3px solid var(--teal);padding:.02in 0 .02in .14in;min-width:0}
.cover-stat b{display:block;color:#fff;font-size:18pt;line-height:1;letter-spacing:-.025em;overflow-wrap:anywhere}
.cover-stat span{display:block;margin-top:.07in;color:#aec2cb;font-size:6.4pt;line-height:1.3;text-transform:uppercase;letter-spacing:.055em}
.cover-date{display:flex;justify-content:space-between;align-items:flex-end;margin-top:.26in;padding-top:.14in;border-top:1px solid rgba(255,255,255,.13);color:#aec2cb;font-size:7pt}.cover-date b{color:#fff;font-weight:700}
</style></head><body>

<section class="page cover"><div class="cover-topline"></div><header class="cover-header"><div class="brand">Global Company <span>• consultorias</span></div><div class="cover-edition">CENSO ${primeiro.anoReferencia}–${ultimo.anoReferencia}</div></header><main class="cover-body"><div class="cover-copy"><div class="cover-eyebrow">Série histórica</div><h1 class="cover-title">Histórico<small>do Censo Escolar</small></h1><div class="cover-city${cityLengthClass}">${esc(model.municipality)}</div><div class="cover-place">${esc(model.uf)}</div><p class="cover-sub">Os últimos ${model.years.length} Censos da rede lidos lado a lado: matrícula por etapa e rede, jornada, docentes, rede física e infraestrutura — e o que a trajetória significa para a receita do FUNDEB.</p><div class="cover-meta"><b>Código IBGE ${esc(model.ibgeCode)}</b><br>Anos de referência ${esc(model.years.map((r) => r.anoReferencia).join(" · "))}<br>Documento técnico executivo · ${esc(date)}</div></div><div class="cover-visual"><div class="cover-chart-frame"><div class="cover-chart">${barras}</div><div class="cover-chart-caption"><b>Matrículas da rede municipal por Censo</b><span>Censo Escolar/INEP</span></div></div></div></main><footer class="cover-bottom"><div class="cover-stats"><div class="cover-stat"><b>${esc(int(ultimo.matriculasMunicipaisTotal))}</b><span>matrículas municipais · Censo ${ultimo.anoReferencia}</span></div><div class="cover-stat"><b>${esc(
    varMunicipal === null ? "N/D" : `${sinal(varMunicipal)}${decimal.format(varMunicipal)}%`,
  )}</b><span>variação ${primeiro.anoReferencia}→${ultimo.anoReferencia}</span></div><div class="cover-stat"><b>${esc(int(ultimo.escolasMunicipaisTotal))}</b><span>escolas municipais · Censo ${ultimo.anoReferencia}</span></div></div><div class="cover-date"><span><b>Relatório técnico executivo</b> · tecnologia Global Sync</span><span>${esc(shortDate)}</span></div></footer></section>

${paginaComoLer(model, prox())}

${paginaRedes(model, prox())}

${paginaInfantil(model, prox())}

${paginaFundamental(model, prox())}

${paginaEjaEspecial(model, prox())}

${paginaCorRaca(model, prox())}

${paginaIntegral(model, prox())}

${paginaDocentesEscolas(model, prox())}

${paginaInfraestrutura(model, prox())}

${paginaLeitura(model, prox())}
</body></html>`;
}
