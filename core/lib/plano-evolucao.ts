import { valorDosEquivalentes, type MecanismoDoFundo } from "@/core/lib/fundeb-cenario-metas";
import { evolucaoDoFundo, evolucaoEm, type EvolucaoDoFundo } from "@/core/lib/fundeb-evolucao-do-fundo";
import { vaatInabilitado } from "@/core/lib/fundeb-fnde";
import { padraoGlobal } from "@/core/lib/fundeb-padrao-global";
import { distanciaAoPiso } from "@/core/lib/fundeb-prospeccao-vaat";
import { getValorAlunoAno } from "@/core/lib/fundeb-valor-aluno";
import { getInepCensoMunicipalHistory, type InepCensoMunicipalRecord } from "@/core/lib/inep-censo";
import type { JanelaDoCenso } from "@/core/lib/calendario-fundeb";
import type { RelatorioSnapshot } from "@/core/lib/relatorio-snapshot";

/**
 * O plano de evolução FUNDEB — o que transforma o levantamento em proposta de
 * trabalho. Duas folhas: o que a rede ganha no próximo Censo, frente a frente,
 * e o calendário que decide quando o dinheiro chega.
 *
 * Tudo sai da mesma coleta do levantamento (`buildRelatorioSnapshot`) e das
 * mesmas regras, para os dois documentos nunca dizerem números diferentes:
 *
 * - o ritmo é o Padrão Global (`fundeb-padrao-global.ts`), com o primeiro ciclo
 *   proporcional ao tempo até a data de referência do Censo;
 * - cada matrícula-equivalente vale pelo mecanismo do fundo
 *   (`valorDosEquivalentes`): fundo do estado, VAAT-MIN para quem está na
 *   faixa, ou a entrada na faixa para quem cruza o piso;
 * - VAAR e lacunas de declaração vêm das parcelas do próprio levantamento;
 * - a receita projetada soma a evolução do fundo (`fundeb-evolucao-do-fundo.ts`).
 *
 * ## As frentes
 *
 * Os equivalentes do ritmo se repartem em frentes que a base mostra: o
 * crescimento que a rede já tem, o AEE que falta registrar, o tempo integral
 * até 35% da rede e a creche declarada parcial. **A EJA fecha a conta** — é a
 * frente que soma matrícula inteira mais depressa, por busca ativa. Por isso é
 * também a meta mais puxada do plano, e a primeira a validar com a secretaria.
 *
 * No próximo Censo o AEE entra inteiro (é registro, não expansão); o resto do
 * primeiro ciclo se reparte entre as demais frentes na proporção de cada uma.
 */

export type PosicaoNoVaat = "na-faixa" | "perto" | "fundo";

export interface FrenteDoPlano {
  chave: "crescimento" | "aee" | "integral" | "creche" | "eja";
  nome: string;
  hoje: string;
  meta: string;
  conta: string;
  /** Equivalentes até o terceiro Censo. */
  equivalentes: number;
  /** Equivalentes que cabem no próximo Censo. */
  noProximoCenso: number;
}

export interface CicloDoPlano {
  censo: number;
  receita: number;
  /** Equivalentes acumulados até este Censo. */
  equivalentes: number;
  matriculas: number;
  via: "vaat" | "fundo" | "entra";
  /** VAAR e lacunas — não esticam com o ritmo. */
  fixas: number;
  evolucaoDoFundo: number;
  receitaProjetada: number;
}

export interface PlanoEvolucao {
  municipio: string;
  uf: string;
  codigoIbge: string;
  exercicio: number;
  geradoEm: string;
  snapshotId: string;
  receita: number;
  calendario: JanelaDoCenso;
  posicao: PosicaoNoVaat;
  vaat: { proprio: number; minimo: number; complementacao: number; habilitado: boolean };
  /** Valor de uma matrícula-equivalente no fundo do estado. */
  valorNoFundo: number;
  /** Equivalentes que faltam para o VAAT próprio cruzar o piso (só `perto`). */
  distanciaAoPiso: number | null;
  /** Padrão Global, em fração da rede ao ano. */
  ritmo: number;
  frentes: FrenteDoPlano[];
  ciclos: [CicloDoPlano, CicloDoPlano, CicloDoPlano];
  /** Censo em que a rede cruza o piso, quando cruza. */
  censoDoCruzamento: number | null;
  vaar: number;
  lacunas: number;
  reprovadas: string[];
  vaarRecebido: { valor: number; exercicio: number } | null;
  evolucao: EvolucaoDoFundo | null;
  serie: Array<{ ano: number; rede: number; eja: number; especial: number; integral: number }>;
  resumoDosCensos: string;
  escolasEspeciais: string[];
  condicionalidadeIII: { ppi2019: number; ppi2023: number; baixo2019: number; baixo2023: number } | null;
  riscos: string[];
}

const integral = (x: InepCensoMunicipalRecord) =>
  (x.tempoIntegralEnsinoFundamentalMunicipal ?? 0) + (x.tempoIntegralEducacaoInfantilMunicipal ?? 0);

const n0 = (v: number) => Math.round(v).toLocaleString("pt-BR");
const pc = (v: number, c = 1) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c })}%`;
const mi = (v: number) => `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/* eslint-disable @typescript-eslint/no-explicit-any -- o payload do levantamento é JSON solto. */
export function montarPlanoEvolucao(snapshot: RelatorioSnapshot): PlanoEvolucao {
  const r = snapshot.current.relatorio;
  const payload = snapshot.current.payload as any;
  const b = payload?.relatorio_dirigido_base ?? {};
  const id = r.identificacao;
  const cal: JanelaDoCenso | undefined = b.cenarioEstruturacao?.calendario;
  if (!cal) throw new Error("O levantamento deste município saiu sem o calendário do Censo; o plano não tem como datar as metas.");
  const codigo = String(id.codigoIBGE);
  const receita = num(r.receitas.totalReceitas);

  const serie = getInepCensoMunicipalHistory(codigo)
    .filter((x) => (x.matriculasMunicipaisTotal ?? 0) > 0)
    .sort((a, z) => a.anoReferencia - z.anoReferencia)
    .slice(-4);
  if (serie.length < 2) throw new Error("Sem ao menos dois Censos da rede municipal na base, não há ritmo para o plano.");
  const primeiro = serie[0];
  const atual = serie[serie.length - 1];
  const rede = atual.matriculasMunicipaisTotal!;

  // ── O mecanismo do fundo ──
  const t = b.vaat ?? {};
  const pond = b.ponderacao ?? {};
  const v = getValorAlunoAno(id.uf)?.fundamentalParcialAnosIniciais ?? 0;
  const habilitado = !vaatInabilitado(t.habilitacao);
  const minimo = num(t.minimo);
  const proprio = num(t.proprio);
  const mecanismo: MecanismoDoFundo = {
    valorPorEquivalente: v,
    vaat: minimo && proprio && pond.ponderadaVaat ? { proprio, minimo, equivalentes: pond.ponderadaVaat, habilitado } : null,
  };
  const naFaixa = num(t.complementacao) > 0 && habilitado;
  const distancia =
    !naFaixa && habilitado && proprio
      ? distanciaAoPiso({ ponderadasVaat: num(pond.ponderadaVaat), vaatProprio: proprio, vaatMinimo: minimo, fundoPorEquivalente: v })
      : null;
  // "Perto" é o piso ao alcance de três anos de trabalho, não qualquer distância.
  const perto = distancia !== null && distancia <= 0.35 * (num(pond.matriculas) || Infinity);
  const posicao: PosicaoNoVaat = naFaixa ? "na-faixa" : perto ? "perto" : "fundo";

  // ── Parcelas que não esticam, as mesmas do levantamento ──
  const parcelas = r.projecao.otimista?.tresAnos?.parcelas ?? r.projecao.parcelas ?? [];
  const vaar = parcelas.find((x) => x.chave === "vaar")?.valor ?? 0;
  const lacunas = parcelas.find((x) => x.chave === "lacunas")?.valor ?? 0;
  const fixas = vaar + lacunas;

  // ── Os três Censos ──
  const ritmo = padraoGlobal()?.porAno ?? 0.1;
  const porAno = ritmo * rede;
  const evolucao = evolucaoDoFundo(
    (payload?.fiscal?.historico_repasses ?? []).map((l: any) => ({ ano: Number(l.ano), contribuicao: num(l.contribuicao_estados_municipios) })),
  );
  const ciclos = [0, 1, 2].map((k): CicloDoPlano => {
    const equivalentes = porAno * (cal.fracaoDoPrimeiroCiclo + k);
    const valor = valorDosEquivalentes(equivalentes, mecanismo);
    const fundo = evolucaoEm(evolucao, cal.receitaDaMatricula + k - id.exercicio);
    return {
      censo: cal.censoDaMatricula + k,
      receita: cal.receitaDaMatricula + k,
      equivalentes,
      matriculas: valor.valor,
      via: valor.via,
      fixas,
      evolucaoDoFundo: fundo,
      receitaProjetada: receita + fundo + valor.valor + fixas,
    };
  }) as [CicloDoPlano, CicloDoPlano, CicloDoPlano];
  const final = ciclos[2];
  const censoDoCruzamento = perto && distancia !== null ? (ciclos.find((c) => c.equivalentes >= distancia)?.censo ?? null) : null;

  // ── As frentes ──
  const segmentos: Array<{ nome: string; matriculas?: number }> = pond.segmentos ?? [];
  const soma = (re: RegExp) => segmentos.filter((x) => re.test(x.nome)).reduce((s, x) => s + num(x.matriculas), 0);
  const especial = soma(/^Educação Especial/);
  const semAee = Math.max(0, especial - soma(/^Atendimento Educacional Especializado/));
  const intHoje = integral(atual);
  const intMeta = Math.round(0.35 * rede);
  const ejaHoje = atual.ejaMunicipal ?? 0;
  const ejaPico = Math.max(...serie.map((x) => x.ejaMunicipal ?? 0));
  const anoPico = serie.find((x) => (x.ejaMunicipal ?? 0) === ejaPico)?.anoReferencia ?? atual.anoReferencia;
  const creche = (pond.oportunidades ?? []).find((o: any) => o.chave === "creche-integral");
  const anos = Math.max(1, atual.anoReferencia - primeiro.anoReferencia);
  const crescimentoAno = Math.max(0, (rede - primeiro.matriculasMunicipaisTotal!) / anos);
  // Vinte matrículas são nada em Fortaleza e 3,5% da rede em Juvenília.
  const limiar = Math.min(20, Math.max(3, rede * 0.01));

  const frentes: FrenteDoPlano[] = [];
  const nova = (f: Omit<FrenteDoPlano, "noProximoCenso">) => frentes.push({ ...f, noProximoCenso: 0 });
  if (crescimentoAno * 3 >= limiar)
    nova({ chave: "crescimento", nome: "Crescimento da rede", hoje: `+${n0(crescimentoAno)} matrículas por ano de ${primeiro.anoReferencia} a ${atual.anoReferencia}`, meta: `manter o ritmo: +${n0(crescimentoAno * 3)}`, conta: "matrícula regular, peso 1,00 em média", equivalentes: crescimentoAno * 3 });
  if (semAee >= limiar)
    nova({ chave: "aee", nome: "AEE registrado", hoje: `${n0(semAee)} alunos de educação especial sem AEE`, meta: `registrar os ${n0(semAee)}`, conta: "segunda matrícula, peso 1,40", equivalentes: semAee * 1.4 });
  if (intMeta - intHoje >= limiar)
    nova({ chave: "integral", nome: "Tempo integral", hoje: `${n0(intHoje)} (${pc((intHoje / rede) * 100)} da rede)`, meta: `${n0(intMeta)} — 35% da rede`, conta: "+0,40 sobre a jornada parcial", equivalentes: (intMeta - intHoje) * 0.4 });
  // A creche parcial já é a lacuna de declaração do levantamento: não conta duas vezes.
  if (creche && num(creche.matriculasAteMediana) >= limiar && lacunas === 0)
    nova({ chave: "creche", nome: "Creche em jornada integral", hoje: `${pc(num(creche.indicador) * 100)} da creche`, meta: `${pc(num(creche.mediana) * 100)}, mediana do país`, conta: "+0,30 sobre a parcial", equivalentes: num(creche.matriculasAteMediana) * 0.3 });
  const semEja = frentes.reduce((s, f) => s + f.equivalentes, 0);
  const ejaEq = Math.max(0, final.equivalentes - semEja);
  if (ejaEq > 0)
    nova({ chave: "eja", nome: "EJA por busca ativa", hoje: `${n0(ejaHoje)} matrículas (pico de ${n0(ejaPico)} em ${anoPico})`, meta: `${n0(ejaHoje + ejaEq)} matrículas`, conta: "peso 1,00; turmas abertas até a data de referência de cada Censo", equivalentes: ejaEq });
  // Se as frentes da base passam do ritmo, cabem nele: o plano não promete mais que o padrão.
  if (semEja > final.equivalentes) frentes.forEach((f) => (f.equivalentes *= final.equivalentes / semEja));

  const orcamento = ciclos[0].equivalentes;
  const aee = frentes.filter((f) => f.chave === "aee");
  const demais = frentes.filter((f) => f.chave !== "aee");
  const somaAee = aee.reduce((s, f) => s + f.equivalentes, 0);
  const noAee = Math.min(orcamento, somaAee);
  const somaDemais = demais.reduce((s, f) => s + f.equivalentes, 0);
  aee.forEach((f) => (f.noProximoCenso = somaAee > 0 ? f.equivalentes * (noAee / somaAee) : 0));
  demais.forEach((f) => (f.noProximoCenso = somaDemais > 0 ? f.equivalentes * ((orcamento - noAee) / somaDemais) : 0));

  // ── O que os Censos mostram, em uma frase ──
  const reprovadas: string[] = b.vaar?.reprovadas ?? [];
  const variacao = (a: number, z: number) => (a > 0 ? `${z >= a ? "+" : "−"}${pc(Math.abs((z / a - 1) * 100), 0)}` : "—");
  const resumoDosCensos =
    `De ${primeiro.anoReferencia} a ${atual.anoReferencia}, a rede municipal foi de ${n0(primeiro.matriculasMunicipaisTotal!)} para ${n0(rede)} matrículas (${variacao(primeiro.matriculasMunicipaisTotal!, rede)}); ` +
    `a EJA, de ${n0(primeiro.ejaMunicipal ?? 0)} para ${n0(ejaHoje)} (${variacao(primeiro.ejaMunicipal ?? 0, ejaHoje)}); ` +
    `a educação especial, de ${n0(primeiro.educacaoEspecialMunicipal ?? 0)} para ${n0(atual.educacaoEspecialMunicipal ?? 0)} (${variacao(primeiro.educacaoEspecialMunicipal ?? 0, atual.educacaoEspecialMunicipal ?? 0)}). ` +
    (semAee >= limiar ? `${pc((semAee / Math.max(1, especial)) * 100, 0)} dos alunos de educação especial seguem sem AEE registrado. ` : "") +
    `Tempo integral em ${pc((intHoje / rede) * 100)} da rede.` +
    (reprovadas.length ? ` E o VAAR está zerado: a rede reprovou ${reprovadas.length === 1 ? "na condicionalidade" : "nas condicionalidades"} ${reprovadas.join(" e ")}.` : "");

  // ── Escolas que já têm o fator maior se declaradas certo ──
  const resumoEscolas = b.escolasTerritorio?.resumo ?? {};
  const campo = num(resumoEscolas.rurais);
  const dif = resumoEscolas.porDiferenciada ?? {};
  const escolasEspeciais = [
    campo ? `${campo} escola${campo > 1 ? "s" : ""} no campo` : "",
    dif["1"] ? `${dif["1"]} em assentamento` : "",
    dif["3"] ? `${dif["3"]} quilombola${dif["3"] > 1 ? "s" : ""}` : "",
    dif["2"] ? `${dif["2"]} indígena${dif["2"] > 1 ? "s" : ""}` : "",
  ].filter(Boolean);

  const c3 = (snapshot.inteligencia as any)?.vaar?.componentes?.find((c: any) => c.tipo === "condicionalidadeIII")?.campos ?? {};
  const condicionalidadeIII =
    reprovadas.includes("III") && typeof c3.Prop_adeq_PPI_2019 === "number"
      ? { ppi2019: c3.Prop_adeq_PPI_2019, ppi2023: num(c3.Prop_adeq_PPI_2023), baixo2019: num(c3.Prop_adeq_baixo_2019), baixo2023: num(c3.Prop_adeq_baixo_2023) }
      : null;

  const pessoal = num(payload?.fiscal?.siconfi?.percentual_despesa_pessoal);
  const rem = b.remuneracao;
  const vaarRecebido = b.vaar?.beneficiario && num(b.vaar?.complementacao) > 0 ? { valor: num(b.vaar.complementacao), exercicio: num(b.vaar.exercicio) } : null;
  const riscos = [
    pessoal > 48.6
      ? `Despesa de pessoal em ${pc(pessoal)} da RCL, ${pessoal > 54 ? "acima do limite máximo" : pessoal > 51.3 ? "acima do limite prudencial" : "acima do limite de alerta"} da LRF. Receita nova do FUNDEB paga a folha da educação dentro da vinculação, sem pressionar esse limite.`
      : "",
    rem && rem.confiavel !== false && num(rem.abaixoDoPisoPct) >= 10
      ? `${pc(num(rem.abaixoDoPisoPct))} do magistério abaixo do piso (${n0(num(rem.abaixoDoPiso))} de ${n0(num(rem.magisterio))}), na declaração de ${rem.ano}.`
      : "",
    vaarRecebido ? `O VAAR já entra (${mi(vaarRecebido.valor)} em ${vaarRecebido.exercicio}): manter as cinco condicionalidades e a evolução de atendimento e aprendizagem a cada aferição.` : "",
    "Remuneração: o mínimo anual é 70% do FUNDEB — conferir o acumulado do ano antes de dezembro.",
  ].filter(Boolean);

  return {
    municipio: id.municipioNome,
    uf: id.uf,
    codigoIbge: codigo,
    exercicio: id.exercicio,
    geradoEm: new Date().toISOString(),
    snapshotId: snapshot.qualidade?.snapshotId ?? "",
    receita,
    calendario: cal,
    posicao,
    vaat: { proprio, minimo, complementacao: num(t.complementacao), habilitado },
    valorNoFundo: v,
    distanciaAoPiso: perto ? distancia : null,
    ritmo,
    frentes,
    ciclos,
    censoDoCruzamento,
    vaar,
    lacunas,
    reprovadas,
    vaarRecebido,
    evolucao,
    serie: serie.map((x) => ({ ano: x.anoReferencia, rede: x.matriculasMunicipaisTotal!, eja: x.ejaMunicipal ?? 0, especial: x.educacaoEspecialMunicipal ?? 0, integral: integral(x) })),
    resumoDosCensos,
    escolasEspeciais,
    condicionalidadeIII,
    riscos,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
