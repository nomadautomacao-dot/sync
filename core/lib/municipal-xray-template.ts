import type {
  Indicador,
  MunicipalProfile,
} from "./municipal-profile/types";
import { ROTULOS_STATUS } from "./municipal-profile/types";

type JsonRecord = Record<string, unknown>;

interface MunicipalXrayModel {
  municipality: string;
  uf: string;
  ibgeCode: string;
  region: string;
  baseYear: number;
  currentYear: number;
  generatedAt: Date;
  population: number | null;
  populationYear: string;
  area: number | null;
  pibPerCapita: number | null;
  mayor: string;
  party: string;
  fundebBase: number | null;
  fundebCurrent: number | null;
  revenueBase: number | null;
  revenueCurrent: number | null;
  rcl: number | null;
  personnelExpense: number | null;
  personnelPercent: number | null;
  personnelLimit: number | null;
  fiscalStatus: string;
  enrollments: number | null;
  enrollmentYear: number | null;
  schools: number | null;
  fullTime: number | null;
  specialEducation: number | null;
  eja: number | null;
  idebInitial: number | null;
  idebInitialTarget: number | null;
  idebFinal: number | null;
  idebFinalTarget: number | null;
  infrastructure: Array<{ name: string; percent: number | null; total: number | null }>;
  sources: string[];
  notes: string[];
  /** Perfil da cidade inteira: saneamento, saúde, emprego, assistência e gestão. */
  profile: MunicipalProfile | null;
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function at(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => asRecord(current)?.[key], value);
}

function text(value: unknown, fallback = "Não informado") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function findHistoricalYear(payload: unknown, year: number) {
  return array(at(payload, "relatorio_dirigido_base.historico.anos"))
    .map(asRecord)
    .find((item) => number(item?.ano) === year) ?? null;
}

function latestHistoricalYear(payload: unknown) {
  return array(at(payload, "relatorio_dirigido_base.historico.anos"))
    .map(asRecord)
    .filter((item): item is JsonRecord => Boolean(item))
    .sort((a, b) => (number(b.ano) ?? 0) - (number(a.ano) ?? 0))[0] ?? null;
}

function latestEnrollmentYear(payload: unknown) {
  return array(at(payload, "relatorio_dirigido_base.historico.anos"))
    .map(asRecord)
    .filter((item): item is JsonRecord => item !== null && number(item.totalMatriculasMunicipais) !== null)
    .sort((a, b) => (number(b.anoBaseCenso) ?? number(b.ano) ?? 0) - (number(a.anoBaseCenso) ?? number(a.ano) ?? 0))[0] ?? null;
}

function latestIdeb(rows: unknown) {
  return array(rows)
    .map(asRecord)
    .filter((row): row is JsonRecord => row !== null && number(row.idebVerificado) !== null)
    .sort((a, b) => (number(b.ano) ?? 0) - (number(a.ano) ?? 0))[0] ?? null;
}

export function mapMunicipalXrayModel(params: {
  basePayload: unknown;
  currentPayload: unknown;
  baseYear: number;
  currentYear: number;
  generatedAt?: Date;
  profile?: MunicipalProfile | null;
}): MunicipalXrayModel {
  const { basePayload, currentPayload, baseYear, currentYear } = params;
  const baseHistory = findHistoricalYear(currentPayload, baseYear) ?? findHistoricalYear(basePayload, baseYear);
  const currentHistory = findHistoricalYear(currentPayload, currentYear) ?? latestHistoricalYear(currentPayload);
  const enrollmentHistory = latestEnrollmentYear(currentPayload);
  const latestInitial = latestIdeb(at(currentPayload, "relatorio_fundeb.idebAnosIniciais"));
  const latestFinal = latestIdeb(at(currentPayload, "relatorio_fundeb.idebAnosFinais"));
  const infra = array(at(currentPayload, "relatorio_dirigido_base.infraestruturaEscolar.indicadores"))
    .map(asRecord)
    .filter((item): item is JsonRecord => Boolean(item))
    .map((item) => ({
      name: text(item.nome),
      percent: number(item.percentual),
      total: number(item.total),
    }));
  const metadataSources = array(at(currentPayload, "metadata.fontes"))
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  const operationalNotes = array(at(currentPayload, "relatorio_fundeb.observacoesOperacionais"))
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()));

  return {
    municipality: text(at(currentPayload, "dados_basicos.nome"), "Município"),
    uf: text(at(currentPayload, "dados_basicos.uf"), "UF"),
    ibgeCode: text(at(currentPayload, "dados_basicos.codigo_ibge"), "Não informado"),
    region: text(at(currentPayload, "dados_basicos.regiao")),
    baseYear,
    currentYear,
    generatedAt: params.generatedAt ?? new Date(),
    population: number(at(currentPayload, "relatorio_dirigido_base.perfilIBGE.populacaoEstimada"))
      ?? number(at(currentPayload, "demografia.populacao")),
    populationYear: text(
      at(currentPayload, "relatorio_dirigido_base.perfilIBGE.populacaoAnoReferencia")
        ?? at(currentPayload, "demografia.populacao_ano_referencia"),
    ),
    area: number(at(currentPayload, "relatorio_dirigido_base.perfilIBGE.areaTerritorial")),
    pibPerCapita: number(at(currentPayload, "relatorio_dirigido_base.perfilIBGE.pibPerCapita")),
    mayor: text(at(currentPayload, "prefeito")),
    party: text(at(currentPayload, "partido"), ""),
    fundebBase: number(baseHistory?.totalReceitasFundeb)
      ?? number(at(basePayload, "relatorio_fundeb.receitas.totalReceitas")),
    fundebCurrent: number(currentHistory?.totalReceitasFundeb)
      ?? number(at(currentPayload, "relatorio_fundeb.receitas.totalReceitas")),
    revenueBase: number(at(basePayload, "relatorio_dirigido_base.saudeFiscal.receitaTotalRealizada")),
    revenueCurrent: number(at(currentPayload, "relatorio_dirigido_base.saudeFiscal.receitaTotalRealizada")),
    rcl: number(at(currentPayload, "relatorio_dirigido_base.saudeFiscal.rclAjustada"))
      ?? number(at(currentPayload, "relatorio_dirigido_base.saudeFiscal.rcl")),
    personnelExpense: number(at(currentPayload, "relatorio_dirigido_base.saudeFiscal.despesaPessoalTotal")),
    personnelPercent: number(at(currentPayload, "relatorio_dirigido_base.saudeFiscal.percentualDespesaPessoal")),
    personnelLimit: number(at(currentPayload, "relatorio_dirigido_base.saudeFiscal.limiteMaximoPessoal")),
    fiscalStatus: text(at(currentPayload, "relatorio_dirigido_base.saudeFiscal.situacaoLrf")),
    enrollments: number(enrollmentHistory?.totalMatriculasMunicipais)
      ?? number(at(currentPayload, "relatorio_fundeb.censoEscolar.totalMatriculas")),
    enrollmentYear: number(enrollmentHistory?.anoBaseCenso)
      ?? number(at(currentPayload, "relatorio_fundeb.censoEscolar.anoReferencia")),
    schools: number(enrollmentHistory?.totalEscolas)
      ?? number(at(currentPayload, "relatorio_fundeb.censoEscolar.totalEscolas")),
    fullTime: number(enrollmentHistory?.tempoIntegral),
    specialEducation: number(enrollmentHistory?.educacaoEspecial),
    eja: number(enrollmentHistory?.eja),
    idebInitial: number(latestInitial?.idebVerificado),
    idebInitialTarget: number(latestInitial?.metaProjetada),
    idebFinal: number(latestFinal?.idebVerificado),
    idebFinalTarget: number(latestFinal?.metaProjetada),
    infrastructure: infra,
    sources: Array.from(new Set(metadataSources)),
    notes: operationalNotes,
    profile: params.profile ?? null,
  };
}

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function money(value: number | null) {
  return value === null ? "Não disponível" : brl.format(value);
}

function compactMoney(value: number | null) {
  if (value === null) return "N/D";
  if (Math.abs(value) >= 1_000_000_000) return `R$ ${decimal.format(value / 1_000_000_000)} bi`;
  if (Math.abs(value) >= 1_000_000) return `R$ ${decimal.format(value / 1_000_000)} mi`;
  return brl.format(value);
}

function int(value: number | null) {
  return value === null ? "N/D" : integer.format(value);
}

function pct(value: number | null) {
  return value === null ? "N/D" : `${decimal.format(value)}%`;
}

function change(base: number | null, current: number | null) {
  if (base === null || current === null || base === 0) return null;
  return ((current - base) / Math.abs(base)) * 100;
}

function deltaText(base: number | null, current: number | null) {
  const delta = change(base, current);
  return delta === null ? "comparação indisponível" : `${delta >= 0 ? "+" : ""}${decimal.format(delta)}%`;
}

function statusClass(value: number | null, target: number | null) {
  if (value === null || target === null) return "neutral";
  return value >= target ? "good" : "warn";
}

function metric(value: string, label: string) {
  return `<div class="metric"><div class="metric-value">${esc(value)}</div><div class="metric-label">${esc(label)}</div></div>`;
}

function header(section: string) {
  return `<header class="page-header"><strong>Raio-X municipal</strong><span>${esc(section)}</span></header>`;
}

function footer(page: number, source = "Bases oficiais integradas ao Sync") {
  return `<footer class="page-footer"><span>${esc(source)}</span><span>${page}</span></footer>`;
}

function priorityList(model: MunicipalXrayModel) {
  const priorities: Array<{ title: string; reason: string; horizon: string }> = [];
  const fundebDelta = change(model.fundebBase, model.fundebCurrent);
  if (fundebDelta !== null && fundebDelta > 15) {
    priorities.push({ title: "Governança do novo volume FUNDEB", reason: "A expansão exige metas, trilhas de evidência e monitoramento mensal.", horizon: "0–90 dias" });
  }
  if (model.idebInitial !== null && model.idebInitialTarget !== null && model.idebInitial < model.idebInitialTarget) {
    priorities.push({ title: "Recuperação dos anos iniciais", reason: "O IDEB observado está abaixo da meta mais recente disponível.", horizon: "Ano letivo" });
  }
  if (model.idebFinal !== null && model.idebFinalTarget !== null && model.idebFinal < model.idebFinalTarget) {
    priorities.push({ title: "Intervenção nos anos finais", reason: "A transição e a aprendizagem demandam plano focalizado por escola.", horizon: "Ano letivo" });
  }
  const weakestInfra = [...model.infrastructure]
    .filter((item) => item.percent !== null)
    .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0];
  if (weakestInfra) {
    priorities.push({ title: `Infraestrutura: ${weakestInfra.name}`, reason: `Cobertura informada de ${pct(weakestInfra.percent)} na base escolar.`, horizon: "6–18 meses" });
  }
  priorities.push({ title: "Sala de situação municipal", reason: "Unificar finanças, matrículas, aprendizagem e infraestrutura em indicadores auditáveis.", horizon: "30 dias" });
  return priorities.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Perfil Municipal — páginas da cidade inteira
// ---------------------------------------------------------------------------

/**
 * Linha de procedência. É o que separa este raio-X de um painel bonito: cada
 * número diz de quando é e de onde veio, para ninguém comparar um Censo de
 * 2022 com uma execução de 2026 sem perceber.
 */
function proveniencia(ind: Indicador<unknown> | undefined): string {
  if (!ind) return "";
  const ano = ind.ano ? ` ${ind.ano}` : "";
  return `<span class="micro">${esc(ind.fonte)}${esc(ano)} · ${esc(ROTULOS_STATUS[ind.status])}</span>`;
}

/** Métrica com procedência embaixo. `valor` já vem formatado. */
function metricaFonte(valor: string, rotulo: string, ind: Indicador<unknown> | undefined): string {
  return `<div class="metric"><div class="metric-value">${esc(valor)}</div><div class="metric-label">${esc(rotulo)}</div>${proveniencia(ind)}</div>`;
}

function pctInd(ind: Indicador | undefined): string {
  return ind && ind.valor !== null ? pct(ind.valor) : "N/D";
}

function intInd(ind: Indicador | undefined): string {
  return ind && ind.valor !== null ? int(ind.valor) : "N/D";
}

/** Barra de cobertura reaproveitando o estilo já usado na infraestrutura escolar. */
function barra(rotulo: string, percentual: number | null): string {
  const largura = Math.max(0, Math.min(100, percentual ?? 0));
  return `<div class="bar-row"><span>${esc(rotulo)}</span><div class="bar-track"><div class="bar" style="width:${largura}%"></div></div><b>${esc(pct(percentual))}</b></div>`;
}

function paginaSaneamento(model: MunicipalXrayModel, pagina: number): string {
  const s = model.profile?.saneamento;
  if (!s) {
    return `<section class="page content-page">${header("Saneamento")}<main class="page-body"><div class="kicker">Domicílios</div><h2>Saneamento indisponível</h2><p class="lede">O Censo 2022 não retornou a leitura de domicílios para este município no momento da emissão.</p></main>${footer(pagina, "IBGE — Censo Demográfico 2022")}</section>`;
  }
  const esgotoCritico = (s.esgoto.fossaRudimentar.valor ?? 0) + (s.esgoto.semBanheiro.valor ?? 0);
  return `<section class="page content-page">${header("Saneamento e domicílios")}<main class="page-body"><div class="kicker">Condições de moradia</div><h2>Saneamento é o piso do desenvolvimento municipal</h2><p class="lede">A cobertura domiciliar vem do Censo 2022 e descreve a cidade inteira, não apenas a rede escolar. É a base física sobre a qual saúde, permanência escolar e atração de investimento se apoiam.</p><div class="grid-4 mt-3">${metricaFonte(pctInd(s.agua.redeGeral), "água pela rede geral", s.agua.redeGeral)}${metricaFonte(pctInd(s.esgoto.redeGeral), "esgoto pela rede", s.esgoto.redeGeral)}${metricaFonte(pctInd(s.residuos.coletado), "lixo coletado", s.residuos.coletado)}${metricaFonte(intInd(s.domiciliosTotal), "domicílios", s.domiciliosTotal)}</div><div class="grid-2 mt-3"><div class="card accent"><h3>Esgotamento sanitário</h3>${s.esgoto.detalhe.map((f) => barra(f.rotulo, f.percentual)).join("")}</div><div class="card"><h3>Destino do lixo</h3>${s.residuos.detalhe.map((f) => barra(f.rotulo, f.percentual)).join("")}</div></div><div class="grid-2 mt-3"><div class="${esgotoCritico > 25 ? "insight" : "note"}"><b>Leitura:</b> ${esc(pct(esgotoCritico))} dos domicílios dependem de fossa rudimentar ou não têm banheiro. É o indicador que mais pesa em doença evitável e em custo futuro de rede.</div><div class="note"><b>Resíduos:</b> ${esc(pct(s.residuos.queimadoEnterrado.valor))} dos domicílios queimam ou enterram o lixo no próprio terreno.</div></div></main>${footer(pagina, "IBGE — Censo Demográfico 2022")}</section>`;
}

function paginaSaude(model: MunicipalXrayModel, pagina: number): string {
  const s = model.profile?.saude;
  if (!s) {
    return `<section class="page content-page">${header("Saúde")}<main class="page-body"><div class="kicker">Rede assistencial</div><h2>Rede de saúde indisponível</h2><p class="lede">O CNES não respondeu para este município no momento da emissão.</p></main>${footer(pagina, "CNES / Ministério da Saúde")}</section>`;
  }
  const tipos = s.porTipo.slice(0, 8);
  return `<section class="page content-page">${header("Saúde e rede assistencial")}<main class="page-body"><div class="kicker">Capacidade instalada</div><h2>O que a cidade tem para atender quem vive nela</h2><p class="lede">A rede vem do CNES, cadastro nacional atualizado continuamente. Cobertura de atenção básica e de agentes comunitários vem do e-Gestor e mede alcance populacional, não qualidade do atendimento.</p><div class="grid-4 mt-3">${metricaFonte(intInd(s.estabelecimentosTotal), "estabelecimentos", s.estabelecimentosTotal)}${metricaFonte(intInd(s.atencaoBasica), "unidades de atenção básica", s.atencaoBasica)}${metricaFonte(pctInd(s.coberturaAps), "cobertura de atenção básica", s.coberturaAps)}${metricaFonte(pctInd(s.coberturaAcs), "cobertura de agentes", s.coberturaAcs)}</div><div class="grid-2 mt-3"><div class="card accent"><h3>Composição da rede</h3><table><tbody>${tipos.map((t) => `<tr><td>${esc(t.tipo)}</td><td class="num"><b>${esc(int(t.quantidade))}</b></td></tr>`).join("")}</tbody></table></div><div class="card"><h3>Rede especializada e referência</h3><table><tbody><tr><td>CAPS (saúde mental)</td><td class="num"><b>${esc(intInd(s.caps))}</b></td></tr><tr><td>Hospital geral</td><td class="num"><b>${esc(intInd(s.hospitalGeral))}</b></td></tr><tr><td>Mortalidade infantil</td><td class="num"><b>${esc(s.mortalidadeInfantil.valor === null ? "N/D" : decimal.format(s.mortalidadeInfantil.valor))}</b></td></tr></tbody></table><div class="divider"></div><p class="small">Mortalidade infantil por mil nascidos vivos. ${esc(proveniencia(s.mortalidadeInfantil).replace(/<[^>]+>/g, ""))}</p></div></div><div class="note mt-3"><b>Como usar:</b> a rede instalada indica capacidade, não desempenho. Cruze com fila, produção ambulatorial e cobertura efetiva antes de concluir sobre acesso.</div></main>${footer(pagina, "CNES e e-Gestor AB / Ministério da Saúde")}</section>`;
}

function paginaEmprego(model: MunicipalXrayModel, pagina: number): string {
  const e = model.profile?.emprego;
  if (!e) {
    return `<section class="page content-page">${header("Emprego")}<main class="page-body"><div class="kicker">Economia</div><h2>Emprego formal indisponível</h2><p class="lede">As séries do Novo CAGED não foram recuperadas no momento da emissão.</p></main>${footer(pagina, "Novo CAGED / MTE via Ipeadata")}</section>`;
  }
  const atual = e.saldoAcumuladoAtual.valor;
  const anterior = e.saldoAcumuladoAnterior.valor;
  const sinal = (v: number | null) => (v === null ? "N/D" : `${v >= 0 ? "+" : "−"}${integer.format(Math.abs(v))}`);
  const setores = e.setores.filter((s) => s.vinculos !== null).slice(0, 8);
  return `<section class="page content-page">${header("Emprego e economia")}<main class="page-body"><div class="kicker">Mercado de trabalho</div><h2>Onde a economia local cria e destrói vaga formal</h2><p class="lede">O saldo compara a mesma janela de meses nos dois anos — ${esc(e.janela)} contra ${esc(e.janela)} — porque confrontar meses publicados com um ano cheio inverteria a leitura do município.</p><div class="grid-3 mt-3">${metricaFonte(sinal(atual), `saldo ${esc(e.janela)} (atual)`, e.saldoAcumuladoAtual)}${metricaFonte(sinal(anterior), `mesma janela no ano anterior`, e.saldoAcumuladoAnterior)}${metricaFonte(intInd(e.estoqueVinculos), "vínculos formais", e.estoqueVinculos)}</div><div class="grid-2 mt-3"><div class="card accent"><h3>Estoque por setor</h3><table><tbody>${setores.length ? setores.map((s) => `<tr><td>${esc(s.nome)}</td><td class="num"><b>${esc(int(s.vinculos))}</b></td></tr>`).join("") : `<tr><td class="small">Categorias sob sigilo estatístico para este porte de município.</td></tr>`}</tbody></table></div><div class="card"><h3>Leitura</h3><p>${atual !== null && anterior !== null ? (atual > anterior ? "O mercado formal acelerou frente à mesma janela do ano anterior." : "O mercado formal desacelerou frente à mesma janela do ano anterior.") : "Série parcial: leitura comparativa indisponível."}</p><div class="divider"></div><p class="small">Salário médio: ${esc(e.salarioMedioSalariosMinimos.valor === null ? "N/D" : `${decimal.format(e.salarioMedioSalariosMinimos.valor)} salários mínimos`)}.</p><p class="small">Série de ${e.serie.length} meses recuperada.</p></div></div><div class="note mt-3"><b>Cuidado metodológico:</b> saldo é fluxo, não estoque. Um saldo positivo pequeno sobre um estoque grande muda pouco a estrutura econômica da cidade.</div></main>${footer(pagina, "Novo CAGED / MTE via Ipeadata e IBGE CEMPRE")}</section>`;
}

function paginaAssistencia(model: MunicipalXrayModel, pagina: number): string {
  const a = model.profile?.assistencia;
  if (!a) {
    return `<section class="page content-page">${header("Assistência social")}<main class="page-body"><div class="kicker">Proteção social</div><h2>CadÚnico indisponível</h2><p class="lede">A base do Cadastro Único não respondeu no momento da emissão.</p></main>${footer(pagina, "CadÚnico / MDS")}</section>`;
  }
  const pessoas = a.pessoasCadastradas.valor;
  const extrema = a.extremaPobreza.valor;
  const parcelaExtrema = pessoas && extrema ? (extrema / pessoas) * 100 : null;
  return `<section class="page content-page">${header("Assistência e vulnerabilidade")}<main class="page-body"><div class="kicker">Proteção social</div><h2>O tamanho real da população que depende do poder público</h2><p class="lede">O Cadastro Único é atualizado mensalmente e mostra quantas famílias o município já conhece pelo nome. É o melhor termômetro disponível de vulnerabilidade local.</p><div class="grid-4 mt-3">${metricaFonte(intInd(a.familiasCadastradas), "famílias cadastradas", a.familiasCadastradas)}${metricaFonte(intInd(a.pessoasCadastradas), "pessoas cadastradas", a.pessoasCadastradas)}${metricaFonte(intInd(a.extremaPobreza), "em extrema pobreza", a.extremaPobreza)}${metricaFonte(pctInd(a.responsavelFemininoPct), "responsável familiar mulher", a.responsavelFemininoPct)}</div><div class="grid-2 mt-3"><div class="card accent"><h3>Renda</h3><table><tbody><tr><td>Rendimento médio mensal domiciliar por pessoa</td><td class="num"><b>${esc(money(a.rendaMediaFamiliar.valor))}</b></td></tr></tbody></table><div class="divider"></div><p class="small">É renda <b>per capita</b>, não renda total da família. ${esc(a.rendaMediaFamiliar.fonte)}.</p></div><div class="card"><h3>Concentração da vulnerabilidade</h3><p>${parcelaExtrema !== null ? `${esc(pct(parcelaExtrema))} das pessoas cadastradas estão na faixa de extrema pobreza.` : "Proporção indisponível."}</p><div class="divider"></div><p class="small">Chefia feminina elevada indica desenho de política que precisa considerar creche, contraturno e jornada — sem isso a renda não sobe.</p></div></div></main>${footer(pagina, "Cadastro Único / MDS e IBGE Censo 2022")}</section>`;
}

function paginaInstitucional(model: MunicipalXrayModel, pagina: number): string {
  const i = model.profile?.institucional;
  if (!i) {
    return `<section class="page content-page">${header("Capacidade institucional")}<main class="page-body"><div class="kicker">Gestão</div><h2>Perfil institucional indisponível</h2><p class="lede">A pesquisa MUNIC não retornou dados para este município.</p></main>${footer(pagina, "IBGE — MUNIC")}</section>`;
  }
  const possui = i.instrumentos.filter((x) => x.possui);
  const faltam = i.instrumentos.filter((x) => !x.possui);
  const rotuloPlano: Record<string, string> = {
    possui: "Possui Plano Diretor",
    elaborando: "Em elaboração",
    nao_possui: "Não possui",
  };
  const sim = (ind: Indicador<boolean>) => (ind.valor === null ? "N/D" : ind.valor ? "Sim" : "Não");
  return `<section class="page content-page">${header("Capacidade institucional")}<main class="page-body"><div class="kicker">Gestão e planejamento</div><h2>Sem instrumento legal, recurso não vira política</h2><p class="lede">A MUNIC registra quais instrumentos de planejamento o município tem em lei. É o que determina se uma prefeitura consegue ordenar o solo, captar recurso habitacional e executar obra sem judicialização.</p><div class="grid-3 mt-3">${metricaFonte(rotuloPlano[String(i.planoDiretor.valor)] ?? "N/D", "plano diretor", i.planoDiretor)}${metricaFonte(`${possui.length} de ${i.instrumentos.length}`, "instrumentos urbanísticos", i.instrumentos.length ? i.planoDiretor : undefined)}${metricaFonte(sim(i.habitacao.politicaHabitacional), "política habitacional", i.habitacao.politicaHabitacional)}</div><div class="grid-2 mt-3"><div class="card accent"><h3>Instrumentos existentes</h3>${possui.length ? `<ul class="source-list">${possui.map((x) => `<li>${esc(x.nome)}${x.ano ? ` <span class="micro">(${x.ano})</span>` : ""}</li>`).join("")}</ul>` : `<p class="small">Nenhum instrumento urbanístico registrado.</p>`}</div><div class="card warn"><h3>Lacunas legais</h3>${faltam.length ? `<ul class="source-list">${faltam.slice(0, 12).map((x) => `<li>${esc(x.nome)}</li>`).join("")}</ul>` : `<p class="small">Nenhuma lacuna registrada.</p>`}</div></div><div class="grid-2 mt-3"><div class="card"><h3>Habitação</h3><table><tbody><tr><td>Conselho</td><td class="num">${esc(sim(i.habitacao.conselho))}</td></tr><tr><td>Fundo</td><td class="num">${esc(sim(i.habitacao.fundo))}</td></tr><tr><td>Cadastro de déficit</td><td class="num">${esc(sim(i.habitacao.cadastroDeficit))}</td></tr><tr><td>Regularização fundiária</td><td class="num">${esc(sim(i.habitacao.regularizacaoFundiaria))}</td></tr></tbody></table></div><div class="card"><h3>Mobilidade e saneamento</h3><table><tbody><tr><td>Plano de mobilidade</td><td class="num">${esc(sim(i.mobilidade.planoMobilidade))}</td></tr><tr><td>Transporte público coletivo</td><td class="num">${esc(sim(i.mobilidade.transportePublico))}</td></tr><tr><td>Plano de saneamento</td><td class="num">${esc(sim(i.saneamentoInstitucional.planoSaneamento))}</td></tr></tbody></table></div></div></main>${footer(pagina, "IBGE — Pesquisa de Informações Básicas Municipais")}</section>`;
}

function paginaGovernancaEducacional(model: MunicipalXrayModel, pagina: number): string {
  const g = model.profile?.governancaEducacional;
  if (!g) {
    return `<section class="page content-page">${header("Governança educacional")}<main class="page-body"><div class="kicker">Gestão da educação</div><h2>Governança educacional indisponível</h2><p class="lede">A MUNIC não retornou o módulo de educação para este município.</p></main>${footer(pagina, "IBGE — MUNIC, módulo educação")}</section>`;
  }
  const marca = (ind: Indicador<boolean>) =>
    ind.valor === true ? `<b class="good">Sim</b>` : ind.valor === false ? `<b class="warn-text">Não</b>` : `<span class="neutral">N/D</span>`;
  const linha = (rotulo: string, ind: Indicador<boolean>, nota?: string) =>
    `<tr><td>${esc(rotulo)}${nota ? `<div class="micro">${esc(nota)}</div>` : ""}</td><td class="num">${marca(ind)}</td></tr>`;
  const conselhosAusentes = [
    ["CME", g.conselhos.educacao],
    ["CAE", g.conselhos.alimentacaoEscolar],
    ["CACS-FUNDEB", g.conselhos.acompanhamentoFundeb],
    ["Transporte Escolar", g.conselhos.transporteEscolar],
  ].filter(([, ind]) => (ind as Indicador<boolean>).valor === false).map(([n]) => n as string);
  return `<section class="page content-page">${header("Governança educacional")}<main class="page-body"><div class="kicker">Controle social e carreira</div><h2>Quem fiscaliza, e com que instrumento</h2><p class="lede">Conselho sem existência legal não fiscaliza, e plano de carreira sem previsão de jornada não protege hora-atividade. A MUNIC registra o que está formalizado — funcionamento efetivo é verificação de campo.</p><div class="grid-2 mt-3"><div class="card accent"><h3>Conselhos</h3><table><tbody>${linha("Conselho Municipal de Educação (CME)", g.conselhos.educacao)}${linha("Conselho de Alimentação Escolar (CAE)", g.conselhos.alimentacaoEscolar, "Condição de regularidade do PNAE")}${linha("CACS-FUNDEB", g.conselhos.acompanhamentoFundeb, "Acompanhamento e controle social do fundo")}${linha("Conselho de Transporte Escolar", g.conselhos.transporteEscolar)}</tbody></table></div><div class="card"><h3>Planejamento e carreira</h3><table><tbody>${linha("Plano Municipal de Educação", g.planoMunicipalEducacao)}${linha("Fórum Permanente de Educação", g.forumPermanenteEducacao)}${linha("Plano de Carreira do Magistério", g.planoCarreiraMagisterio)}${linha("Previsão do limite de 2/3 em sala", g.limiteHoraAtividade, "Lei 11.738/2008 — a regra do 1/3 de hora-atividade")}</tbody></table></div></div><div class="grid-2 mt-3"><div class="card"><h3>Órgão gestor</h3><p>${esc(g.estruturaOrgaoGestor.valor ?? "Não informado")}</p><div class="divider"></div><p class="micro">${esc(g.estruturaOrgaoGestor.fonte)}</p></div><div class="${conselhosAusentes.length ? "risk" : "insight"}">${conselhosAusentes.length ? `<b>Lacuna de controle:</b> sem ${esc(conselhosAusentes.join(", "))}. Conselho ausente compromete a fiscalização exigida por lei e pode travar repasse federal.` : `<b>Estrutura formal completa:</b> os quatro conselhos constam na MUNIC. Confirme mandato vigente e periodicidade das reuniões em campo.`}</div></div><div class="note mt-3"><b>Sobre o piso nacional:</b> a MUNIC pergunta se a prefeitura paga o piso, mas o IBGE não publica essa variável no SIDRA. Por isso ela não aparece aqui — e vira pergunta no roteiro de campo.</div></main>${footer(pagina, "IBGE — MUNIC, módulo educação")}</section>`;
}

function paginaConformidade(model: MunicipalXrayModel, pagina: number): string {
  const c = model.profile?.conformidadeEducacional;
  if (!c) {
    return `<section class="page content-page">${header("Conformidade legal")}<main class="page-body"><div class="kicker">Pisos constitucionais</div><h2>Conformidade indisponível</h2><p class="lede">Os percentuais de MDE e de remuneração do FUNDEB não foram recuperados no SIOPE para este município.</p></main>${footer(pagina, "SIOPE / FNDE")}</section>`;
  }
  const veredito = (ind: Indicador, minimo: number) => {
    if (ind.valor === null) return { classe: "card", texto: "N/D", chip: "neutral" };
    const ok = ind.valor >= minimo;
    return {
      classe: ok ? "card accent" : "card bad",
      texto: ok ? `Cumpre o mínimo de ${minimo}%` : `Abaixo do mínimo de ${minimo}%`,
      chip: ok ? "good" : "warn-text",
    };
  };
  const mde = veredito(c.mdeAplicado, 25);
  const fundeb = veredito(c.fundebRemuneracao, 70);
  return `<section class="page content-page">${header("Conformidade legal")}<main class="page-body"><div class="kicker">Pisos constitucionais e legais</div><h2>Os dois números que reprovam a prestação de contas</h2><p class="lede">Descumprir qualquer um dos dois pisos abre parecer prévio contrário no Tribunal de Contas. Exercício de referência: ${c.exercicio ?? "N/D"}.</p><div class="grid-2 mt-3"><div class="${mde.classe}"><h3>MDE — Manutenção e Desenvolvimento do Ensino</h3><div class="metric-value ${mde.chip}">${esc(pct(c.mdeAplicado.valor))}</div><p class="small">${esc(mde.texto)} · art. 212 da Constituição</p><div class="divider"></div><table><tbody><tr><td>Receita de impostos</td><td class="num">${esc(money(c.receitaImpostos.valor))}</td></tr><tr><td>Despesa em MDE</td><td class="num">${esc(money(c.despesaMde.valor))}</td></tr></tbody></table></div><div class="${fundeb.classe}"><h3>FUNDEB — remuneração do magistério</h3><div class="metric-value ${fundeb.chip}">${esc(pct(c.fundebRemuneracao.valor))}</div><p class="small">${esc(fundeb.texto)} · Lei 14.113/2020</p><div class="divider"></div><table><tbody><tr><td>Base do FUNDEB<div class="micro">exclui a complementação VAAR</div></td><td class="num">${esc(money(c.fundebRecebido.valor))}</td></tr><tr><td>Aplicado em remuneração</td><td class="num">${esc(money(c.fundebRemuneracaoValor.valor))}</td></tr></tbody></table></div></div><div class="insight mt-3"><b>Como conferir:</b> os quatro valores acima são as parcelas exatas das duas contas. Divida despesa por receita e remuneração por base para reproduzir os percentuais na frente do cliente.</div><div class="note mt-3"><b>Procedência:</b> ${esc(c.mdeAplicado.fonte)}. O RREO Anexo 8 não trafega no SICONFI — MDE é declarado ao SIOPE, e é de lá que estes números vêm.</div></main>${footer(pagina, "SIOPE / FNDE — RREO Anexo 8")}</section>`;
}

// ---------------------------------------------------------------------------
// Roteiro de campo
// ---------------------------------------------------------------------------

interface PerguntaCampo {
  pergunta: string;
  /** O que a base pública já diz. Transforma pergunta genérica em pergunta afiada. */
  contexto?: string;
}

interface SecaoCampo {
  titulo: string;
  itens: PerguntaCampo[];
}

/**
 * Monta o roteiro da visita.
 *
 * Um terço do diagnóstico educacional municipal não tem fonte pública e nunca
 * terá: formação continuada, absenteísmo, quem opera o SIMEC. Em vez de omitir
 * esses pontos, o relatório os devolve como pergunta dirigida — e usa o que já
 * sabemos para tornar cada pergunta específica. "O município tem CME?" é uma
 * pergunta fraca quando a MUNIC já respondeu; "o CME tem mandato vigente e se
 * reúne?" é a pergunta que sobra.
 */
function montarRoteiroCampo(model: MunicipalXrayModel): SecaoCampo[] {
  const g = model.profile?.governancaEducacional;
  const i = model.profile?.institucional;
  const c = model.profile?.conformidadeEducacional;

  const seSim = (ind: Indicador<boolean> | undefined, sim: string, nao: string) =>
    ind?.valor === true ? sim : ind?.valor === false ? nao : undefined;

  return [
    {
      titulo: "1 · Gestão pedagógica",
      itens: [
        {
          pergunta: "O referencial curricular do município está alinhado à BNCC e ao documento curricular do estado? Qual a data da última revisão?",
          contexto: "Peça o documento curricular municipal e confira a data de homologação.",
        },
        {
          pergunta: "Existe programa de formação continuada para professores e coordenadores? Qual a periodicidade e como a eficácia é medida?",
        },
        {
          pergunta: "O município aderiu à Busca Ativa Escolar? Quem opera a plataforma e com que frequência?",
        },
        {
          pergunta: "A educação em tempo integral tem projeto aprovado e em execução?",
          contexto: model.fullTime !== null
            ? `O Censo registra ${int(model.fullTime)} matrículas em tempo integral — confirmar se há projeto formalizado ou se é oferta avulsa.`
            : undefined,
        },
        {
          pergunta: "Há protocolo antirracismo, material didático específico e mapeamento de comunidades para a educação quilombola?",
        },
        {
          pergunta: "Existe núcleo ou sala de recursos multifuncionais para atendimento educacional especializado? Como funciona o encaminhamento?",
          contexto: model.specialEducation !== null
            ? `${int(model.specialEducation)} matrículas em educação especial na rede — perguntar quantas têm AEE efetivo.`
            : undefined,
        },
      ],
    },
    {
      titulo: "2 · Pessoas e carreira",
      itens: [
        {
          pergunta: "Quantos servidores são efetivos, temporários e comissionados na educação?",
        },
        {
          pergunta: "O plano de carreira está sendo cumprido? As progressões estão em dia e o piso nacional é pago?",
          contexto: seSim(
            g?.planoCarreiraMagisterio,
            "A MUNIC registra que o plano de carreira existe — verificar aplicação prática, não a existência.",
            "A MUNIC não registra plano de carreira do magistério — confirmar e, se confirmado, é uma pendência legal.",
          ),
        },
        {
          pergunta: "Qual o índice de absenteísmo, licenças médicas e desvios de função que afetam a regência de classe?",
        },
        {
          pergunta: "A lei do 1/3 de hora-atividade é cumprida? Como o planejamento fora de sala é registrado?",
          contexto: seSim(
            g?.limiteHoraAtividade,
            "O plano de carreira prevê o limite de jornada em sala — conferir o cumprimento na prática.",
            "O plano de carreira não prevê expressamente o limite de 2/3 em sala — a hora-atividade fica sem amparo formal.",
          ),
        },
      ],
    },
    {
      titulo: "3 · Infraestrutura e logística",
      itens: [
        {
          pergunta: "Existe equipe fixa de manutenção escolar para reparos, elétrica e hidráulica?",
        },
        {
          pergunta: "Quantas rotas de transporte escolar existem? Qual a divisão entre frota própria e terceirizada, e qual o estado dos veículos?",
          contexto: seSim(
            g?.conselhos.transporteEscolar,
            "Há Conselho de Transporte Escolar — pedir as atas das últimas reuniões.",
            "A MUNIC não registra Conselho de Transporte Escolar. Em município de território extenso, é uma lacuna de controle relevante.",
          ),
        },
        {
          pergunta: "Como é feito o acompanhamento das rotas: roteiro de visitas, controle de combustível, cronograma de manutenção?",
        },
        {
          pergunta: "As cozinhas escolares têm condições adequadas de armazenamento? O cardápio é aprovado por nutricionista? Qual o percentual de compra da agricultura familiar (mínimo legal de 30%)?",
          contexto: seSim(
            g?.conselhos.alimentacaoEscolar,
            "O CAE existe segundo a MUNIC — pedir os pareceres de prestação de contas do PNAE.",
            "A MUNIC não registra CAE. Sem ele o PNAE fica irregular.",
          ),
        },
      ],
    },
    {
      titulo: "4 · Finanças e convênios",
      itens: [
        {
          pergunta: "Quem executa a prestação de contas do PDDE, PNAE e PNATE? Há pendências que possam bloquear repasse?",
        },
        {
          pergunta: "O SIOPE é alimentado com que frequência e por quem?",
        },
        {
          pergunta: "A equipe contábil tem profissionais dedicados à educação? As despesas são apresentadas ao conselho?",
          contexto: c?.mdeAplicado.valor !== null && c?.mdeAplicado.valor !== undefined
            ? `MDE apurado em ${pct(c.mdeAplicado.valor)} — pedir a memória de cálculo e conferir a base de impostos.`
            : undefined,
        },
        {
          pergunta: "Quem faz o acompanhamento jurídico das leis da educação e o encaminhamento à Câmara?",
        },
        {
          pergunta: "Quem acompanha o SIMEC e as obras pactuadas com o FNDE?",
        },
        {
          pergunta: "O município tem adesão vigente à UNDIME e a anuidade está paga?",
        },
      ],
    },
    {
      titulo: "5 · Governança e prazos",
      itens: [
        {
          pergunta: "Quem responde pelo Censo Escolar e como o prazo de 31 de julho é controlado? O Censo define o FUNDEB do ano seguinte.",
          contexto: model.enrollmentYear
            ? `Última base disponível: Censo ${model.enrollmentYear}.`
            : undefined,
        },
        {
          pergunta: "O organograma da secretaria define com clareza inspeção escolar, supervisão e recursos humanos?",
        },
        {
          pergunta: "Os conselhos têm mandato vigente, se reúnem e registram atas?",
          contexto: g
            ? `Registro MUNIC — CME: ${g.conselhos.educacao.valor === true ? "sim" : g.conselhos.educacao.valor === false ? "não" : "N/D"} · CAE: ${g.conselhos.alimentacaoEscolar.valor === true ? "sim" : g.conselhos.alimentacaoEscolar.valor === false ? "não" : "N/D"} · CACS-FUNDEB: ${g.conselhos.acompanhamentoFundeb.valor === true ? "sim" : g.conselhos.acompanhamentoFundeb.valor === false ? "não" : "N/D"}. Existência não é funcionamento.`
            : undefined,
        },
        {
          pergunta: "Qual o percentual de cumprimento das metas do Plano Municipal de Educação? Há monitoramento formal?",
          contexto: seSim(
            g?.planoMunicipalEducacao,
            "O PME existe segundo a MUNIC — pedir o último relatório de monitoramento das metas.",
            "A MUNIC não registra PME vigente — confirmar, pois é exigência legal.",
          ),
        },
        {
          pergunta: "Há instrumentos urbanísticos que travem obra escolar (regularização fundiária de terrenos, licenciamento)?",
          contexto: i
            ? `${i.instrumentos.filter((x) => !x.possui).length} dos ${i.instrumentos.length} instrumentos urbanísticos não existem em lei no município.`
            : undefined,
        },
      ],
    },
  ];
}

function renderSecaoCampo(secao: SecaoCampo): string {
  const itens = secao.itens
    .map(
      (item) => `<div class="campo-item"><div class="campo-q">${esc(item.pergunta)}</div>${
        item.contexto ? `<div class="campo-ctx">${esc(item.contexto)}</div>` : ""
      }<div class="campo-linha"></div></div>`,
    )
    .join("");
  return `<div class="campo-secao"><h3>${esc(secao.titulo)}</h3>${itens}</div>`;
}

function paginaRoteiro(model: MunicipalXrayModel, pagina: number, metade: 0 | 1): string {
  const secoes = montarRoteiroCampo(model);
  const corte = metade === 0 ? secoes.slice(0, 3) : secoes.slice(3);
  const abertura = metade === 0
    ? `<div class="kicker">Roteiro de visita</div><h2>O que nenhuma base pública responde</h2><p class="lede">Os pontos abaixo exigem entrevista e requisição de documento. As bases oficiais já foram consultadas: onde havia dado, ele aparece como contexto para tornar a pergunta específica. Existência registrada em cadastro não é funcionamento verificado.</p>`
    : `<div class="kicker">Roteiro de visita · continuação</div><h2>Finanças, governança e prazos</h2><p class="lede">Os itens desta página têm peso legal. Prestação de contas irregular bloqueia repasse, e conselho sem mandato vigente invalida a fiscalização exigida por lei.</p>`;
  return `<section class="page content-page">${header(`Roteiro de campo ${metade + 1}/2`)}<main class="page-body">${abertura}<div class="mt-3">${corte.map(renderSecaoCampo).join("")}</div></main>${footer(pagina, "Roteiro gerado a partir das lacunas das bases públicas")}</section>`;
}

export function generateMunicipalXrayHtml(model: MunicipalXrayModel) {
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(model.generatedAt);
  const shortDate = new Intl.DateTimeFormat("pt-BR").format(model.generatedAt);
  const fundebDelta = change(model.fundebBase, model.fundebCurrent);
  const priorities = priorityList(model);
  const infraRows = model.infrastructure.length
    ? model.infrastructure.map((item) => `<div class="bar-row"><span>${esc(item.name)}</span><div class="bar-track"><div class="bar" style="width:${Math.max(0, Math.min(100, item.percent ?? 0))}%"></div></div><b>${esc(pct(item.percent))}</b></div>`).join("")
    : `<div class="empty">A base de infraestrutura escolar ainda não está disponível para este município.</div>`;
  const sourceRows = model.sources.length
    ? model.sources.map((source) => `<li>${esc(source)}</li>`).join("")
    : `<li>Fontes públicas integradas ao Sync, consultadas na data de geração.</li>`;
  const noteRows = model.notes.slice(0, 6).map((note) => `<li>${esc(note)}</li>`).join("");
  const fundebClass = fundebDelta !== null && fundebDelta >= 0 ? "good" : "warn";
  const mayor = model.party ? `${model.mayor} (${model.party})` : model.mayor;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Raio-X municipal | ${esc(model.municipality)}</title>
<style>
@page{size:letter;margin:0}*{box-sizing:border-box}:root{--navy:#10263f;--blue:#176b87;--teal:#27a69a;--gold:#e6a23c;--red:#c75050;--ink:#19242e;--muted:#647380;--line:#d9e1e5;--paper:#fbfcfc;--wash:#eef4f5;--good:#22856f;--warn:#a66a10}
html,body{margin:0;padding:0;background:#dfe6e9;color:var(--ink)}body{font-family:Arial,"Noto Sans",sans-serif;font-size:9pt;line-height:1.38}.page{width:8.5in;height:11in;margin:0 auto;background:var(--paper);overflow:hidden;page-break-after:always;position:relative}.page:last-child{page-break-after:auto}.content-page{display:grid;grid-template-rows:auto 1fr auto}.page-header{min-height:.48in;padding:.22in .62in .11in;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:end;color:var(--muted);font-size:7.4pt;letter-spacing:.07em;text-transform:uppercase}.page-header strong{color:var(--navy);font-weight:800}.page-body{padding:.25in .62in .18in;overflow:hidden}.page-footer{min-height:.39in;padding:.1in .62in .2in;border-top:1px solid var(--line);color:var(--muted);font-size:7pt;display:flex;justify-content:space-between;align-items:start}
h1,h2,h3,.metric-value,.big{font-family:Arial,"Noto Sans",sans-serif}h1,h2,h3,p{margin:0}h2{color:var(--navy);font-size:23pt;line-height:1.04;letter-spacing:-.025em}h2:after{content:"";display:block;width:.9in;height:.06in;margin-top:.12in;background:var(--teal)}h3{color:var(--navy);font-size:11pt;line-height:1.15;margin-bottom:.07in}p+p{margin-top:.09in}.kicker{color:var(--teal);font-size:8pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.09in}.lede{margin-top:.15in;max-width:6.65in;color:#344551;font-size:10.2pt;line-height:1.45}.small{font-size:7.7pt;color:var(--muted)}.micro{font-size:6.8pt;color:var(--muted)}.strong{font-weight:800;color:var(--navy)}.divider{height:1px;background:var(--line);margin:.17in 0}.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:.18in}.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:.13in}.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:.11in}.mt-1{margin-top:.12in}.mt-2{margin-top:.2in}.mt-3{margin-top:.28in}.card{background:#fff;border:1px solid var(--line);border-radius:7px;padding:.15in}.card.accent{border-top:4px solid var(--teal)}.card.warn{border-top:4px solid var(--gold)}.card.bad{border-top:4px solid var(--red)}.metric{border-left:4px solid var(--teal);padding:.03in 0 .04in .13in;min-height:.65in}.metric-value{font-size:19pt;font-weight:800;color:var(--navy);line-height:.98;letter-spacing:-.025em}.metric-label{margin-top:.07in;color:var(--muted);font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.045em}.callout{background:var(--navy);color:#fff;padding:.16in .18in;border-radius:7px}.callout h3{color:#fff}.callout p{color:#dce8ee}.note{background:#fff8e7;border-left:4px solid var(--gold);padding:.12in .14in;color:#584416}.insight{background:#e8f4f2;border-left:4px solid var(--teal);padding:.12in .14in}.risk{background:#f9eaea;border-left:4px solid var(--red);padding:.12in .14in}ul{margin:.07in 0 0 .17in;padding:0}li{margin-bottom:.045in}table{width:100%;border-collapse:collapse;font-size:7.8pt}th{background:var(--navy);color:#fff;text-align:left;font-weight:700;padding:.07in .08in}td{padding:.065in .08in;border-bottom:1px solid var(--line);vertical-align:top}tbody tr:nth-child(even){background:#f3f6f7}td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}.good{color:var(--good);font-weight:800}.warn-text{color:var(--warn);font-weight:800}.neutral{color:var(--muted);font-weight:800}.bar-row{display:grid;grid-template-columns:1.45in 1fr .55in;align-items:center;gap:.08in;margin-bottom:.075in;font-size:7.5pt}.bar-track{background:#e4ebee;height:.12in;border-radius:99px;overflow:hidden}.bar{height:100%;background:var(--teal);border-radius:99px}.bar-row b{text-align:right;color:var(--navy)}.score-row{display:grid;grid-template-columns:1.45in 1fr 1fr;gap:.09in;padding:.09in 0;border-bottom:1px solid var(--line)}.score-row .area{font-weight:800;color:var(--navy)}.empty{padding:.28in;background:var(--wash);border:1px dashed #b8c6cc;border-radius:7px;color:var(--muted);text-align:center}.source-list{font-size:7.2pt;line-height:1.35}.cover{background:var(--navy);color:#fff;display:grid;grid-template-rows:1fr auto}.cover-main{padding:.68in .68in .35in;position:relative}.cover-main:before{content:"";position:absolute;right:-.6in;top:-.55in;width:3.8in;height:3.8in;border-radius:50%;border:.55in solid rgba(39,166,154,.18)}.brand{font-size:8pt;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#bde4df}.cover-title{margin-top:1.05in;max-width:6.7in;font-size:42pt;line-height:.96;letter-spacing:-.045em}.cover-title span{color:#59c4b7}.cover-sub{margin-top:.24in;max-width:5.8in;color:#d3e1e7;font-size:13pt;line-height:1.35}.cover-rule{width:1.1in;height:.07in;background:var(--gold);margin-top:.33in}.cover-meta{margin-top:.34in;font-size:8pt;color:#aebfc8;line-height:1.55}.cover-bottom{padding:.33in .68in .55in;background:rgba(0,0,0,.12)}.cover-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.28in}.cover-stat{border-left:3px solid var(--teal);padding-left:.14in}.cover-stat b{display:block;font-size:20pt;line-height:1}.cover-stat span{display:block;color:#b9cbd3;font-size:7pt;text-transform:uppercase;letter-spacing:.05em;margin-top:.06in}.cover-date{display:flex;justify-content:space-between;margin-top:.28in;color:#b9cbd3;font-size:7.5pt}
.campo-secao{margin-bottom:.16in}.campo-secao h3{color:var(--teal);font-size:8.4pt;letter-spacing:.09em;text-transform:uppercase;margin-bottom:.08in;border-bottom:1px solid var(--line);padding-bottom:.04in}.campo-item{margin-bottom:.105in;break-inside:avoid}.campo-q{font-size:8.6pt;line-height:1.32;color:var(--ink)}.campo-ctx{font-size:7pt;line-height:1.3;color:var(--muted);font-style:italic;margin-top:.02in;padding-left:.09in;border-left:2px solid var(--wash)}.campo-linha{margin-top:.055in;border-bottom:1px dotted #b9c6cc;height:.13in}
</style></head><body>

<section class="page cover"><div class="cover-main"><div class="brand">Global Sync • inteligência municipal</div><h1 class="cover-title">Raio-X de<br><span>${esc(model.municipality)}</span></h1><p class="cover-sub">Como o município encerrou ${model.baseYear}, o que mudou em ${model.currentYear} e onde estão as alavancas e os riscos do próximo ciclo.</p><div class="cover-rule"></div><div class="cover-meta">${esc(model.uf)} • Código IBGE ${esc(model.ibgeCode)}<br>Comparativo ${model.baseYear} × situação disponível em ${esc(date)}<br>Finanças, FUNDEB, educação, aprendizagem e infraestrutura</div></div><div class="cover-bottom"><div class="cover-stats"><div class="cover-stat"><b>${esc(deltaText(model.fundebBase,model.fundebCurrent))}</b><span>evolução FUNDEB</span></div><div class="cover-stat"><b>${esc(int(model.population))}</b><span>população ${esc(model.populationYear)}</span></div><div class="cover-stat"><b>${esc(int(model.enrollments))}</b><span>matrículas municipais</span></div></div><div class="cover-date"><span>Relatório técnico executivo</span><span>${esc(shortDate)}</span></div></div></section>

<section class="page content-page">${header("Resumo executivo")}<main class="page-body"><div class="kicker">Leitura central</div><h2>Mais recursos só se tornam evolução quando chegam ao resultado</h2><p class="lede">O retrato combina bases públicas integradas ao Sync e compara ${model.baseYear} com a informação mais recente de ${model.currentYear}. A leitura prioriza escala fiscal, financiamento educacional, aprendizagem e capacidade de execução.</p><div class="grid-4 mt-3">${metric(compactMoney(model.fundebCurrent),`FUNDEB ${model.currentYear}`)}${metric(compactMoney(model.revenueCurrent),"receita realizada")}${metric(int(model.enrollments),`matrículas ${model.enrollmentYear ?? ""}`)}${metric(int(model.schools),"escolas da rede")}</div><div class="grid-2 mt-3"><div class="card accent"><h3>Sinais de capacidade</h3><ul><li>FUNDEB atual: <b>${esc(money(model.fundebCurrent))}</b>.</li><li>Variação frente a ${model.baseYear}: <b class="${fundebClass}">${esc(deltaText(model.fundebBase,model.fundebCurrent))}</b>.</li><li>Receita pública realizada na entrega fiscal disponível: <b>${esc(money(model.revenueCurrent))}</b>.</li><li>Base municipal de ensino: <b>${esc(int(model.enrollments))}</b> matrículas.</li></ul></div><div class="card warn"><h3>Pontos de atenção</h3><ul><li>IDEB dos anos iniciais: <b>${esc(model.idebInitial === null ? "N/D" : decimal.format(model.idebInitial))}</b>, meta ${esc(model.idebInitialTarget === null ? "N/D" : decimal.format(model.idebInitialTarget))}.</li><li>IDEB dos anos finais: <b>${esc(model.idebFinal === null ? "N/D" : decimal.format(model.idebFinal))}</b>, meta ${esc(model.idebFinalTarget === null ? "N/D" : decimal.format(model.idebFinalTarget))}.</li><li>Situação fiscal: <b>${esc(model.fiscalStatus)}</b>.</li><li>Indicadores sem fonte fechada são marcados como não disponíveis.</li></ul></div></div><div class="callout mt-2"><h3>Diagnóstico em uma frase</h3><p>O município precisa ligar orçamento, execução e resultado em uma mesma rotina de gestão, com metas verificáveis e evidências por escola e por política pública.</p></div></main>${footer(2)}</section>

<section class="page content-page">${header("Metodologia")}<main class="page-body"><div class="kicker">Como ler</div><h2>Comparação honesta começa pela data de corte</h2><p class="lede">${model.baseYear} é tratado como ano-base. ${model.currentYear} representa a posição disponível na data de geração e pode conter entregas parciais.</p><div class="grid-2 mt-3"><div class="card accent"><h3>Ano-base ${model.baseYear}</h3><p>Valores anuais fechados são usados quando existem. Na ausência de encerramento, o relatório identifica a última entrega oficial recuperada.</p></div><div class="card warn"><h3>Posição ${model.currentYear}</h3><p>Estimativas e execuções parciais não são apresentadas como fechamento anual. A data de corte é ${esc(shortDate)}.</p></div></div><table class="mt-3"><thead><tr><th>Camada</th><th>Fonte principal</th><th>Regra de leitura</th></tr></thead><tbody><tr><td>Finanças</td><td>Siconfi / Tesouro</td><td>Última entrega fiscal disponível</td></tr><tr><td>FUNDEB</td><td>FNDE e histórico oficial</td><td>Fechamento ou estimativa vigente</td></tr><tr><td>Rede escolar</td><td>Censo Escolar / Inep</td><td>Ano de referência explicitado</td></tr><tr><td>Aprendizagem</td><td>Inep / QEdu</td><td>Último IDEB observado</td></tr><tr><td>Território</td><td>IBGE Cidades</td><td>Referência informada pela fonte</td></tr></tbody></table><div class="note mt-3"><b>Regra de integridade:</b> “N/D” significa que a fonte não devolveu um valor confiável. O motor não preenche lacunas com estimativas silenciosas.</div></main>${footer(3,"Metodologia Global Sync para leitura municipal")}</section>

<section class="page content-page">${header("Perfil do município")}<main class="page-body"><div class="kicker">Território e gestão</div><h2>${esc(model.municipality)}, ${esc(model.uf)}</h2><p class="lede">O perfil territorial contextualiza a escala da administração e ajuda a calibrar prioridades, custos de cobertura e capacidade de entrega.</p><div class="grid-4 mt-3">${metric(int(model.population),"população estimada")}${metric(model.area === null ? "N/D" : `${integer.format(model.area)} km²`,"área territorial")}${metric(compactMoney(model.pibPerCapita),"PIB per capita")}${metric(model.region,"região")}</div><div class="grid-2 mt-3"><div class="card accent"><h3>Identificação institucional</h3><table><tbody><tr><td>Código IBGE</td><td class="num"><b>${esc(model.ibgeCode)}</b></td></tr><tr><td>Chefe do Executivo</td><td class="num"><b>${esc(mayor)}</b></td></tr><tr><td>Exercício analisado</td><td class="num"><b>${model.currentYear}</b></td></tr><tr><td>Data de corte</td><td class="num"><b>${esc(shortDate)}</b></td></tr></tbody></table></div><div class="card"><h3>Leitura de escala</h3><p>População, extensão territorial e porte da rede alteram o custo de universalizar serviços. O raio-X usa esses dados como contexto e evita comparar números absolutos sem considerar cobertura.</p><div class="insight mt-2"><b>Uso recomendado:</b> cruzar os indicadores com metas por habitante, por aluno, por escola e por território atendido.</div></div></div></main>${footer(4,"Fonte territorial: IBGE e cadastro municipal integrado")}</section>

<section class="page content-page">${header(`${model.baseYear} em perspectiva`)}<main class="page-body"><div class="kicker">Linha de base</div><h2>O ponto de partida financeiro e educacional</h2><p class="lede">O ano-base serve para medir a direção da mudança e separar crescimento nominal de melhoria efetiva.</p><div class="grid-3 mt-3">${metric(compactMoney(model.fundebBase),`FUNDEB ${model.baseYear}`)}${metric(compactMoney(model.revenueBase),"receita realizada")}${metric(money(model.fundebBase),"valor nominal")}</div><div class="grid-2 mt-3"><div class="card accent"><h3>O que a linha de base responde</h3><ul><li>Qual era o volume de financiamento educacional.</li><li>Qual entrega fiscal estava disponível.</li><li>Qual era o tamanho conhecido da rede.</li><li>Quais metas de aprendizagem ainda estavam abertas.</li></ul></div><div class="card warn"><h3>Limites da comparação</h3><p>Receita realizada só é comparável quando os períodos fiscais possuem cobertura equivalente. Quando a API não informa essa equivalência, o relatório mantém os dois valores e não calcula uma taxa enganosa.</p></div></div><div class="callout mt-3"><h3>Base para decisão</h3><p>O valor do diagnóstico está menos em uma cifra isolada e mais na coerência entre receita, matrículas, infraestrutura e aprendizagem.</p></div></main>${footer(5,"Siconfi/Tesouro e FNDE")}</section>

<section class="page content-page">${header(`${model.currentYear} até agora`)}<main class="page-body"><div class="kicker">Situação atual</div><h2>Capacidade fiscal disponível para agir</h2><p class="lede">A fotografia atual mostra a última execução recuperada pelo sistema. Ela não é confundida com o fechamento de ${model.currentYear}.</p><div class="grid-4 mt-3">${metric(compactMoney(model.revenueCurrent),"receita realizada")}${metric(compactMoney(model.rcl),"RCL ajustada")}${metric(compactMoney(model.personnelExpense),"despesa de pessoal")}${metric(pct(model.personnelPercent),"pessoal sobre RCL")}</div><div class="grid-2 mt-3"><div class="card ${model.personnelPercent !== null && model.personnelLimit !== null && model.personnelPercent > model.personnelLimit ? "bad" : "accent"}"><h3>Lei de Responsabilidade Fiscal</h3><table><tbody><tr><td>Situação</td><td class="num"><b>${esc(model.fiscalStatus)}</b></td></tr><tr><td>Percentual de pessoal</td><td class="num"><b>${esc(pct(model.personnelPercent))}</b></td></tr><tr><td>Limite máximo informado</td><td class="num"><b>${esc(pct(model.personnelLimit))}</b></td></tr></tbody></table></div><div class="card"><h3>Leitura gerencial</h3><p>A margem fiscal deve ser lida em conjunto com obrigações de pessoal, cronograma de repasses, restos a pagar e capacidade de execução das secretarias.</p><div class="note mt-2">A confirmação contábil deve ocorrer nos demonstrativos oficiais e no fechamento do período.</div></div></div></main>${footer(6,"Siconfi/Tesouro, última entrega disponível")}</section>

<section class="page content-page">${header("FUNDEB")}<main class="page-body"><div class="kicker">Financiamento da educação</div><h2>O salto de receita precisa ter destino mensurável</h2><p class="lede">A comparação do FUNDEB é o eixo financeiro central do raio-X. O crescimento é oportunidade, mas também amplia a necessidade de governança e prestação de contas.</p><div class="grid-3 mt-3">${metric(compactMoney(model.fundebBase),String(model.baseYear))}${metric(compactMoney(model.fundebCurrent),String(model.currentYear))}${metric(deltaText(model.fundebBase,model.fundebCurrent),"variação")}</div><table class="mt-3"><thead><tr><th>Indicador</th><th class="num">${model.baseYear}</th><th class="num">${model.currentYear}</th><th class="num">Evolução</th></tr></thead><tbody><tr><td>Receita total FUNDEB</td><td class="num">${esc(money(model.fundebBase))}</td><td class="num">${esc(money(model.fundebCurrent))}</td><td class="num ${fundebClass}">${esc(deltaText(model.fundebBase,model.fundebCurrent))}</td></tr><tr><td>Receita por matrícula conhecida</td><td class="num">N/D</td><td class="num">${esc(model.fundebCurrent !== null && model.enrollments ? brl.format(model.fundebCurrent/model.enrollments) : "N/D")}</td><td class="num">referencial</td></tr></tbody></table><div class="grid-2 mt-3"><div class="insight"><b>Alavanca:</b> transformar o novo volume em plano anual com metas, responsáveis, evidências e revisão mensal.</div><div class="risk"><b>Risco:</b> expansão de despesa sem vínculo verificável com aprendizagem, acesso, permanência e infraestrutura.</div></div></main>${footer(7,"FNDE e série histórica integrada ao Sync")}</section>

<section class="page content-page">${header("Rede de ensino")}<main class="page-body"><div class="kicker">Acesso e oferta</div><h2>A rede precisa crescer com qualidade e capacidade física</h2><p class="lede">O Censo Escolar informa o porte da rede no ano de referência disponível. Matrículas não são projetadas para ${model.currentYear} quando o Inep ainda não publicou a base correspondente.</p><div class="grid-4 mt-3">${metric(int(model.enrollments),"matrículas municipais")}${metric(int(model.schools),"escolas")}${metric(int(model.fullTime),"tempo integral")}${metric(int(model.specialEducation),"educação especial")}</div><div class="grid-2 mt-3"><div class="card accent"><h3>Composição disponível</h3><table><tbody><tr><td>Ano-base do Censo</td><td class="num"><b>${esc(model.enrollmentYear ?? "N/D")}</b></td></tr><tr><td>Educação de jovens e adultos</td><td class="num"><b>${esc(int(model.eja))}</b></td></tr><tr><td>Educação especial</td><td class="num"><b>${esc(int(model.specialEducation))}</b></td></tr><tr><td>Tempo integral</td><td class="num"><b>${esc(int(model.fullTime))}</b></td></tr></tbody></table></div><div class="card warn"><h3>Perguntas para auditoria</h3><ul><li>A expansão aparece por escola e etapa?</li><li>A infraestrutura acompanhou o novo atendimento?</li><li>Há coerência entre Censo, sistemas locais e documentação?</li><li>O financiamento por matrícula está evoluindo de forma sustentável?</li></ul></div></div></main>${footer(8,"Censo Escolar/Inep")}</section>

<section class="page content-page">${header("Aprendizagem")}<main class="page-body"><div class="kicker">Resultado educacional</div><h2>A escala financeira deve aparecer na aprendizagem</h2><p class="lede">O IDEB mais recente é usado como linha de resultado. A meta é exibida lado a lado para orientar o tamanho do esforço necessário.</p><div class="grid-2 mt-3"><div class="card ${statusClass(model.idebInitial,model.idebInitialTarget)}"><h3>Anos iniciais</h3><div class="grid-2">${metric(model.idebInitial === null ? "N/D" : decimal.format(model.idebInitial),"IDEB observado")}${metric(model.idebInitialTarget === null ? "N/D" : decimal.format(model.idebInitialTarget),"meta")}</div><div class="divider"></div><p>${model.idebInitial !== null && model.idebInitialTarget !== null && model.idebInitial < model.idebInitialTarget ? "A recomposição de aprendizagem deve ser priorizada por habilidade e escola." : "Acompanhar a manutenção do resultado e as desigualdades entre escolas."}</p></div><div class="card ${statusClass(model.idebFinal,model.idebFinalTarget)}"><h3>Anos finais</h3><div class="grid-2">${metric(model.idebFinal === null ? "N/D" : decimal.format(model.idebFinal),"IDEB observado")}${metric(model.idebFinalTarget === null ? "N/D" : decimal.format(model.idebFinalTarget),"meta")}</div><div class="divider"></div><p>${model.idebFinal !== null && model.idebFinalTarget !== null && model.idebFinal < model.idebFinalTarget ? "A transição e a aprendizagem exigem intervenção focalizada e monitoramento curto." : "Preservar trajetória e monitorar abandono, aprovação e proficiência."}</p></div></div><div class="callout mt-3"><h3>Agenda de resultado</h3><p>Definir linha de base por escola, metas bimestrais, rotina de avaliação formativa e apoio pedagógico acionado por evidência.</p></div></main>${footer(9,"Inep e QEdu, última observação disponível")}</section>

<section class="page content-page">${header("Saúde fiscal")}<main class="page-body"><div class="kicker">Sustentabilidade</div><h2>Espaço fiscal precisa ser protegido durante a aceleração</h2><p class="lede">A capacidade de investir depende do equilíbrio entre receita, pessoal e compromissos recorrentes.</p><table class="mt-3"><thead><tr><th>Indicador</th><th class="num">Valor</th><th>Leitura</th></tr></thead><tbody><tr><td>Receita Corrente Líquida</td><td class="num">${esc(money(model.rcl))}</td><td>Base para limites fiscais</td></tr><tr><td>Despesa total com pessoal</td><td class="num">${esc(money(model.personnelExpense))}</td><td>${esc(pct(model.personnelPercent))} da RCL ajustada</td></tr><tr><td>Limite máximo de pessoal</td><td class="num">${esc(pct(model.personnelLimit))}</td><td>Parâmetro da entrega Siconfi</td></tr><tr><td>Situação LRF</td><td class="num">${esc(model.fiscalStatus)}</td><td>Requer acompanhamento periódico</td></tr></tbody></table><div class="grid-2 mt-3"><div class="card accent"><h3>Controles essenciais</h3><ul><li>Projeção mensal de receita e despesa.</li><li>Pessoal e contratos continuados.</li><li>Cronograma físico-financeiro dos projetos.</li><li>Riscos e contrapartidas por programa.</li></ul></div><div class="card warn"><h3>Sinal de gestão</h3><p>Uma boa situação fiscal é uma janela para corrigir gargalos. Uma situação pressionada exige priorização ainda mais rigorosa e proteção dos serviços essenciais.</p></div></div></main>${footer(10,"Siconfi/Tesouro Nacional")}</section>

<section class="page content-page">${header("Infraestrutura escolar")}<main class="page-body"><div class="kicker">Condições de oferta</div><h2>Qualidade também depende do ambiente de aprendizagem</h2><p class="lede">A cobertura de infraestrutura escolar ajuda a localizar gargalos concretos. Percentuais referem-se ao universo informado na base do Inep.</p><div class="mt-3">${infraRows}</div><div class="grid-2 mt-3"><div class="insight"><b>Prioridade:</b> atacar primeiro os itens com menor cobertura e maior efeito sobre segurança, permanência e prática pedagógica.</div><div class="note"><b>Validação local:</b> conferir escola por escola, pois reformas recentes podem ainda não aparecer no Censo publicado.</div></div></main>${footer(11,"Microdados do Censo Escolar/Inep")}</section>

${paginaSaneamento(model, 12)}

${paginaSaude(model, 13)}

${paginaEmprego(model, 14)}

${paginaAssistencia(model, 15)}

${paginaInstitucional(model, 16)}

${paginaGovernancaEducacional(model, 17)}

${paginaConformidade(model, 18)}

${paginaRoteiro(model, 19, 0)}

${paginaRoteiro(model, 20, 1)}

<section class="page content-page">${header("Plano de ação")}<main class="page-body"><div class="kicker">Próximo ciclo</div><h2>Cinco movimentos para converter recurso em entrega</h2><p class="lede">As prioridades são geradas a partir dos sinais encontrados no município e devem ser validadas com a equipe local.</p><table class="mt-3"><thead><tr><th>#</th><th>Prioridade</th><th>Por quê</th><th>Horizonte</th></tr></thead><tbody>${priorities.map((item,index)=>`<tr><td>${index+1}</td><td><b>${esc(item.title)}</b></td><td>${esc(item.reason)}</td><td>${esc(item.horizon)}</td></tr>`).join("")}</tbody></table><div class="grid-2 mt-3"><div class="card accent"><h3>Ritual de acompanhamento</h3><ul><li>Painel mensal com responsáveis.</li><li>Evidência documental por ação.</li><li>Revisão trimestral de metas.</li><li>Comunicação executiva em uma página.</li></ul></div><div class="card"><h3>Critério de sucesso</h3><p>Cada real adicional deve estar conectado a uma entrega verificável e a um indicador de acesso, qualidade, eficiência ou equidade.</p></div></div></main>${footer(21,"Síntese técnica gerada pelo Sync")}</section>

<section class="page content-page">${header("Fontes e conclusão")}<main class="page-body"><div class="kicker">Rastreabilidade</div><h2>Um raio-X útil é atualizado, verificável e acionável</h2><p class="lede">Este documento registra a posição disponível em ${esc(date)}. Novas publicações oficiais podem alterar valores e leituras.</p><div class="grid-2 mt-3"><div class="card accent"><h3>Fontes consultadas</h3><ul class="source-list">${sourceRows}</ul></div><div class="card"><h3>Observações automáticas</h3>${noteRows ? `<ul class="source-list">${noteRows}</ul>` : `<p class="small">Nenhuma observação operacional adicional foi registrada pelas integrações.</p>`}</div></div><div class="callout mt-3"><h3>Conclusão</h3><p>${esc(model.municipality)} dispõe agora de uma leitura comparativa replicável. O próximo passo é validar os dados com as áreas responsáveis e transformar as prioridades em plano de execução com dono, prazo, evidência e indicador.</p></div><div class="note mt-3"><b>Aviso técnico:</b> o relatório é informativo e não substitui demonstrações contábeis, parecer jurídico, auditoria ou validação dos órgãos oficiais.</div></main>${footer(22,`Gerado pelo Sync em ${shortDate}`)}</section>
</body></html>`;
}
