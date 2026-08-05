import { getCaucMunicipio, type CaucMunicipio } from "./cauc-requisitos";
import { getConformidadeSiope, type ConformidadeSiope } from "./siope-indicadores";
import { getPontualidadeFiscal, type PontualidadeFiscal } from "./siconfi-entregas";
import {
  getSituacaoVaar,
  DESCRICAO_CONDICIONALIDADE,
  type Condicionalidade,
  type SituacaoVaar,
} from "./fundeb-vaar";
import { getRemuneracaoMunicipal, type RemuneracaoMunicipal } from "./remuneracao-docente";
import { montarDossieMatricula, type Conciliacao } from "./dossie-matricula";
import { getAlfabetizacaoMunicipal, type AlfabetizacaoMunicipal } from "./alfabetizacao-municipal";
import { montarSerieIdeb, type AnoIdeb } from "./dossie-aprendizagem";
import { getDemografiaEducacional } from "./demografia-educacional";
import { getInepCensoMunicipalRecord } from "./inep-censo";
import {
  montarFaixas,
  montarContaDaCreche,
  type FaixaCobertura,
  type ContaDaCreche,
} from "./dossie-demanda";

/**
 * Dever de Casa — o veredito, item a item, de uso interno.
 *
 * ## O que este relatório é — e o que ele não é
 *
 * Os dossiês descrevem; este **julga**. Cada item é uma obrigação ou meta que
 * o município controla por ato de gestão, com o parâmetro legal de um lado e
 * o dado apurado do outro, e o veredito no meio. É a ferramenta com que o
 * consultor decide, antes da reunião, se a cidade faz o dever de casa — e
 * qual argumento levar.
 *
 * É documento **interno**: o tom é de nota de auditoria, não de diagnóstico
 * construtivo. Não vai à mesa do gestor — para a prefeitura existem o Ofício
 * e os dossiês.
 *
 * ## As três regras dos vereditos
 *
 * 1. **Só entra item com dono.** Tudo aqui o município reverte por gestão
 *    própria. O que não depende dele (Cond. IV do VAAR reprovada no estado
 *    inteiro) aparece como `fora_do_alcance` e **sai do denominador** — nota
 *    baixa por culpa alheia mandaria o consultor brigar com o alvo errado.
 * 2. **Sem dado não é descumprimento.** Fonte que não respondeu vira
 *    `sem_dado`, sai do denominador e é listada por nome. A nota mede o que
 *    foi verificável, e o placar diz quantos itens ficaram de fora.
 * 3. **Estimativa é sempre nomeada.** O VAAR perdido é estimado pela mediana
 *    dos beneficiados da UF — nunca apresentado como valor apurado.
 */

export type Veredito = "cumpre" | "parcial" | "descumpre" | "sem_dado" | "fora_do_alcance";

export type BlocoId = "contas" | "vaar" | "cadastro" | "resultado";

export interface ItemDever {
  id: string;
  titulo: string;
  /** O que a lei ou o programa exige, com o dispositivo. */
  criterio: string;
  /** O que o dado apurado mostra, em uma frase. */
  medida: string;
  veredito: Veredito;
  fonte: string;
}

export interface BlocoDever {
  id: BlocoId;
  titulo: string;
  sub: string;
  itens: ItemDever[];
}

export interface ParcelaDinheiro {
  rotulo: string;
  valor: number;
  estimativa: boolean;
  nota: string;
}

export interface PlacarDever {
  total: number;
  /** Itens com veredito de mérito — o denominador da nota. */
  avaliados: number;
  cumpre: number;
  parcial: number;
  descumpre: number;
  semDado: number;
  foraDoAlcance: number;
  /** 0 a 10, uma casa. `null` quando nada foi verificável. */
  nota: number | null;
  rotulo: string;
}

export interface FonteDever {
  rotulo: string;
  ok: boolean;
  detalhe: string;
}

export interface DeverDeCasa {
  exercicio: number;
  blocos: BlocoDever[];
  placar: PlacarDever;
  /** O que o descumprimento já custa por exercício. */
  naMesa: ParcelaDinheiro[];
  /** O que ação nova traria — potencial, não perda. */
  potencial: ParcelaDinheiro[];
  fontes: FonteDever[];
}

/** Insumos já coletados — separados da rede para o julgamento ser testável. */
export interface FontesDever {
  cauc: CaucMunicipio | null;
  pontualidade: PontualidadeFiscal | null;
  siope: ConformidadeSiope | null;
  vaar: SituacaoVaar | null;
  remuneracao: RemuneracaoMunicipal | null;
  conciliacao: Conciliacao | null;
  faixaCreche: FaixaCobertura | null;
  contaCreche: ContaDaCreche | null;
  alfabetizacao: AlfabetizacaoMunicipal | null;
  ideb: AnoIdeb[];
}

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const umaCasa = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Piso: até esta fração de vínculos abaixo do piso ainda é `cumpre` — folha
 * tem sempre casos de transição (afastados, ingressantes no meio do mês).
 */
const PISO_TOLERANCIA_PCT = 5;
/** Creche: a partir de 70% do caminho até a meta, o veredito sobe a `parcial`. */
const CRECHE_PARCIAL_PCT = 35;
/** IDEB: até esta distância da referência nacional o veredito é `parcial`. */
const IDEB_TOLERANCIA = 0.3;

// ── Bloco A: prestação de contas ───────────────────────────────────────────

function julgarCauc(cauc: CaucMunicipio | null): ItemDever {
  const base = {
    id: "A1",
    titulo: "Manter o CAUC limpo nos itens de educação",
    criterio:
      "Nenhuma pendência nos itens em que o Tesouro confere a aplicação da educação — são eles que travam convênio e derrubam a habilitação ao VAAT.",
    fonte: "Tesouro Nacional — CAUC",
  };
  if (!cauc) return { ...base, medida: "O extrato do CAUC não respondeu nesta emissão.", veredito: "sem_dado" };
  const pend = cauc.pendenciasEducacao.length;
  return {
    ...base,
    medida:
      pend === 0
        ? `Nenhuma pendência de educação nos ${inteiro.format(cauc.requisitos.length)} requisitos do extrato de ${cauc.dataPesquisa}.`
        : `${inteiro.format(pend)} pendência(s) de educação no extrato de ${cauc.dataPesquisa}: ${cauc.pendenciasEducacao
            .map((p) => p.codigo)
            .join(", ")}.`,
    veredito: pend === 0 ? "cumpre" : "descumpre",
  };
}

function julgarDca(pontualidade: PontualidadeFiscal | null): ItemDever {
  const base = {
    id: "A2",
    titulo: "Entregar a DCA no prazo",
    criterio:
      "DCA no Siconfi até 30 de abril (LRF, art. 51, §1º, I) e sempre antes do corte de 31 de agosto que habilita ao VAAT seguinte (Lei nº 14.113/2020, art. 13, §4º).",
    fonte: "Tesouro Nacional — extrato de entregas",
  };
  if (!pontualidade) {
    return { ...base, medida: "O extrato de entregas não respondeu nesta emissão.", veredito: "sem_dado" };
  }
  const ultima = pontualidade.dca.find((e) => e.entregueEm !== null) ?? null;
  const quando = ultima
    ? `Última DCA (${ultima.exercicio}) entregue ${
        ultima.diasAlemDoPrazo != null && ultima.diasAlemDoPrazo > 0
          ? `${inteiro.format(ultima.diasAlemDoPrazo)} dia(s) além de 30/4`
          : "no prazo"
      }${ultima.estourouCorteVaat ? " e depois do corte do VAAT" : ""}.`
    : "Nenhuma DCA transmitida encontrada no extrato.";
  const veredito: Veredito =
    pontualidade.risco === "baixo" ? "cumpre" : pontualidade.risco === "medio" ? "parcial" : "descumpre";
  return { ...base, medida: `${quando} Risco de perder o VAAT pelo lado Siconfi: ${pontualidade.risco}.`, veredito };
}

function julgarSiopeEmDia(siope: ConformidadeSiope | null): ItemDever {
  const base = {
    id: "A3",
    titulo: "Declarar o SIOPE do exercício de referência",
    criterio:
      "Declaração transmitida no exercício correto — é o envio que comprova a aplicação e habilita ao VAAT (art. 13, §4º da Lei nº 14.113/2020).",
    fonte: "FNDE — SIOPE",
  };
  if (!siope) return { ...base, medida: "O dataset do SIOPE não cobre este município.", veredito: "sem_dado" };
  return {
    ...base,
    medida: siope.defasado
      ? `A última declaração disponível é de ${siope.ano} — exercício anterior ao de referência.`
      : `Declaração de ${siope.ano} transmitida, com ${inteiro.format(siope.indicadores.length)} indicadores apurados.`,
    veredito: siope.defasado ? "descumpre" : "cumpre",
  };
}

function julgarVinculacao(
  siope: ConformidadeSiope | null,
  chave: string,
  id: string,
  titulo: string,
  criterio: string,
): ItemDever {
  const base = { id, titulo, criterio, fonte: "FNDE — SIOPE" };
  const ind = siope?.indicadores.find((i) => i.chave === chave) ?? null;
  if (!ind || ind.conforme == null) {
    return {
      ...base,
      medida: siope
        ? `O indicador não foi declarado por este município em ${siope.ano} — e o registro é obrigatório.`
        : "O dataset do SIOPE não cobre este município.",
      veredito: "sem_dado",
    };
  }
  const folga =
    ind.folga == null ? "" : ind.folga >= 0 ? ` (folga de ${umaCasa.format(ind.folga)} p.p.)` : ` (faltam ${umaCasa.format(Math.abs(ind.folga))} p.p.)`;
  return {
    ...base,
    medida: `Apurado ${umaCasa.format(ind.valor)}% contra o mínimo de ${inteiro.format(ind.limite ?? 0)}%${folga}, declaração de ${siope!.ano}.`,
    veredito: ind.conforme ? "cumpre" : "descumpre",
  };
}

function julgarDemaisVinculacoes(siope: ConformidadeSiope | null): ItemDever {
  const base = {
    id: "A6",
    titulo: "Cumprir as demais vinculações com parâmetro",
    criterio:
      "As vinculações de execução do fundo: sobra do exercício de até 10% e, para quem recebe VAAT, mínimo de 15% em despesas de capital.",
    fonte: "FNDE — SIOPE",
  };
  if (!siope) return { ...base, medida: "O dataset do SIOPE não cobre este município.", veredito: "sem_dado" };
  const demais = siope.indicadores.filter(
    (i) => i.limite != null && i.chave !== "mde" && i.chave !== "remuneracao",
  );
  const comVeredito = demais.filter((i) => i.conforme != null);
  if (comVeredito.length === 0) {
    return { ...base, medida: "Nenhuma das demais vinculações foi apurada para este município.", veredito: "sem_dado" };
  }
  const ruins = comVeredito.filter((i) => i.conforme === false);
  return {
    ...base,
    medida:
      ruins.length === 0
        ? `As ${inteiro.format(comVeredito.length)} vinculações apuradas estão dentro do parâmetro.`
        : `Descumpridas: ${ruins.map((i) => `${i.cod} (${i.rotulo.toLowerCase()})`).join("; ")}.`,
    veredito: ruins.length === 0 ? "cumpre" : "descumpre",
  };
}

function julgarPiso(remuneracao: RemuneracaoMunicipal | null): ItemDever {
  const base = {
    id: "A7",
    titulo: "Pagar o piso do magistério",
    criterio:
      "Remuneração do magistério igual ou acima do piso nacional, proporcional à jornada (Lei nº 11.738/2008).",
    fonte: "FNDE — SIOPE, remuneração declarada",
  };
  if (!remuneracao || !remuneracao.confiavel || remuneracao.razaoMedianaPiso == null) {
    return {
      ...base,
      medida: remuneracao
        ? "A declaração não cobre vínculos suficientes para a mediana descrever a rede."
        : "O dataset de remuneração não cobre este município.",
      veredito: "sem_dado",
    };
  }
  const veredito: Veredito =
    remuneracao.razaoMedianaPiso < 1
      ? "descumpre"
      : remuneracao.abaixoDoPisoPct > PISO_TOLERANCIA_PCT
        ? "parcial"
        : "cumpre";
  return {
    ...base,
    medida: `Mediana em ${umaCasa.format(remuneracao.razaoMedianaPiso)}× o piso; ${umaCasa.format(
      remuneracao.abaixoDoPisoPct,
    )}% dos vínculos abaixo dele (declaração de ${remuneracao.ano}).`,
    veredito,
  };
}

// ── Bloco B: as cinco condicionalidades do VAAR ────────────────────────────

function julgarCondicionalidade(vaar: SituacaoVaar | null, inc: Condicionalidade): ItemDever {
  const base = {
    id: `B-${inc}`,
    titulo: `Condicionalidade ${inc} do VAAR`,
    criterio: DESCRICAO_CONDICIONALIDADE[inc],
    fonte: "FNDE — habilitação ao VAAR",
  };
  if (!vaar) return { ...base, medida: "O dataset do VAAR não cobre este município.", veredito: "sem_dado" };
  const situacao = vaar.condicionalidades[inc];
  if (situacao == null) {
    return { ...base, medida: "O FNDE não informou a aferição desta condicionalidade.", veredito: "sem_dado" };
  }
  if (inc === "IV" && situacao === false && vaar.condIVEstadual) {
    return {
      ...base,
      medida:
        "Reprovada no estado inteiro — a aferição é da UF e nenhuma ação local a reverte. Fora do denominador da nota.",
      veredito: "fora_do_alcance",
    };
  }
  return {
    ...base,
    medida: situacao
      ? `Cumprida na aferição de ${vaar.exercicio}.`
      : `Reprovada na aferição de ${vaar.exercicio}${vaar.pendencia ? ` — motivo oficial: “${vaar.pendencia}”` : ""}.`,
    veredito: situacao ? "cumpre" : "descumpre",
  };
}

// ── Bloco C: matrícula e cadastro ──────────────────────────────────────────

function julgarConciliacao(conciliacao: Conciliacao | null): ItemDever {
  const base = {
    id: "C1",
    titulo: "Censo e Portaria contando as mesmas crianças",
    criterio:
      "O Censo Escolar preenchido pelo município e a Portaria que distribui o FUNDEB devem fechar — divergência é matrícula declarada que não virou ponderação.",
    fonte: "INEP — Censo Escolar × FNDE — Portaria de ponderação",
  };
  if (!conciliacao) {
    return { ...base, medida: "Sem base de conciliação para este município nesta emissão.", veredito: "sem_dado" };
  }
  const divergentes = conciliacao.linhas.filter((l) => l.divergente).length;
  return {
    ...base,
    medida: conciliacao.fecha
      ? `Conciliação fechada: total e blocos dentro da tolerância contra o Censo de ${conciliacao.anoCenso}.`
      : `${inteiro.format(divergentes)} linha(s) divergente(s) contra o Censo de ${conciliacao.anoCenso}, resíduo de ${inteiro.format(
          Math.abs(conciliacao.residuo),
        )} matrícula(s).`,
    veredito: conciliacao.fecha ? "cumpre" : "parcial",
  };
}

function julgarCreche(faixa: FaixaCobertura | null): ItemDever {
  const base = {
    id: "C2",
    titulo: "Cobertura de creche rumo à meta do PNE",
    criterio: "Meta 1 do PNE: 50% da população de 0 a 3 anos atendida em creche, somadas todas as redes.",
    fonte: "IBGE — demografia × INEP — Censo Escolar",
  };
  if (!faixa || faixa.coberturaTotal == null) {
    return { ...base, medida: "A demografia da faixa de 0 a 3 não respondeu nesta emissão.", veredito: "sem_dado" };
  }
  const veredito: Veredito =
    faixa.coberturaTotal >= faixa.metaPne
      ? "cumpre"
      : faixa.coberturaTotal >= CRECHE_PARCIAL_PCT
        ? "parcial"
        : "descumpre";
  return {
    ...base,
    medida: `Cobertura de ${umaCasa.format(faixa.coberturaTotal)}% da faixa (${inteiro.format(
      faixa.populacao,
    )} crianças); faltam ${inteiro.format(faixa.faltamParaMeta)} matrículas para a meta.`,
    veredito,
  };
}

// ── Bloco D: resultado em sala ─────────────────────────────────────────────

function julgarAlfabetizacao(alfabetizacao: AlfabetizacaoMunicipal | null): ItemDever {
  const base = {
    id: "D1",
    titulo: "Cumprir a meta assinada de alfabetização",
    criterio:
      "Percentual de crianças alfabetizadas ao fim do 2º ano igual ou acima da meta pactuada no Compromisso Nacional Criança Alfabetizada.",
    fonte: "MEC/Inep — Compromisso Criança Alfabetizada",
  };
  if (!alfabetizacao) {
    return { ...base, medida: "O dataset de alfabetização não cobre este município.", veredito: "sem_dado" };
  }
  const u = alfabetizacao.ultimo;
  if (u.cumpriu == null || u.meta == null) {
    return {
      ...base,
      medida: `Resultado de ${u.ano}: ${umaCasa.format(u.valor)}% alfabetizadas, sem meta publicada para o ano.`,
      veredito: "sem_dado",
    };
  }
  const fragil = alfabetizacao.participacaoFragil
    ? " Participação abaixo de 80% fragiliza a leitura."
    : "";
  return {
    ...base,
    medida: `Resultado de ${u.ano}: ${umaCasa.format(u.valor)}% contra meta de ${umaCasa.format(u.meta)}%.${fragil}`,
    veredito: u.cumpriu ? "cumpre" : "descumpre",
  };
}

function julgarIdeb(ideb: AnoIdeb[]): ItemDever {
  const base = {
    id: "D2",
    titulo: "Manter o IDEB dos anos iniciais na referência nacional",
    criterio:
      "IDEB dos anos iniciais igual ou acima da referência nacional da edição — o INEP não projeta meta municipal desde 2021, então a régua é a do país.",
    fonte: "INEP — IDEB",
  };
  const ultimo = [...ideb].reverse().find((a) => a.anosIniciais != null) ?? null;
  if (!ultimo || ultimo.anosIniciais == null) {
    return { ...base, medida: "Sem IDEB de anos iniciais publicado para a rede.", veredito: "sem_dado" };
  }
  if (ultimo.referenciaAnosIniciais == null) {
    return {
      ...base,
      medida: `IDEB ${umaCasa.format(ultimo.anosIniciais)} em ${ultimo.ano}, sem referência nacional publicada para a edição.`,
      veredito: "sem_dado",
    };
  }
  const distancia = ultimo.anosIniciais - ultimo.referenciaAnosIniciais;
  const veredito: Veredito =
    distancia >= 0 ? "cumpre" : distancia >= -IDEB_TOLERANCIA ? "parcial" : "descumpre";
  return {
    ...base,
    medida: `IDEB ${umaCasa.format(ultimo.anosIniciais)} em ${ultimo.ano} contra referência nacional de ${umaCasa.format(
      ultimo.referenciaAnosIniciais,
    )} (${distancia >= 0 ? "+" : "−"}${umaCasa.format(Math.abs(distancia))}).`,
    veredito,
  };
}

// ── Montagem ───────────────────────────────────────────────────────────────

export function montarItens(f: FontesDever): BlocoDever[] {
  return [
    {
      id: "contas",
      titulo: "Prestação de contas",
      sub: "O básico administrativo: o que trava convênio, habilitação e aprovação de contas quando não é feito.",
      itens: [
        julgarCauc(f.cauc),
        julgarDca(f.pontualidade),
        julgarSiopeEmDia(f.siope),
        julgarVinculacao(
          f.siope,
          "mde",
          "A4",
          "Aplicar o mínimo constitucional em MDE",
          "Ao menos 25% da receita de impostos em manutenção e desenvolvimento do ensino (CF, art. 212).",
        ),
        julgarVinculacao(
          f.siope,
          "remuneracao",
          "A5",
          "Aplicar 70% do FUNDEB em remuneração",
          "Ao menos 70% do fundo na remuneração dos profissionais da educação (Lei nº 14.113/2020, art. 26).",
        ),
        julgarDemaisVinculacoes(f.siope),
        julgarPiso(f.remuneracao),
      ],
    },
    {
      id: "vaar",
      titulo: "As cinco condicionalidades do VAAR",
      sub: "A única parcela do FUNDEB que o município reverte por ato de gestão — reprovar em uma zera a parcela inteira.",
      itens: (["I", "II", "III", "IV", "V"] as Condicionalidade[]).map((inc) =>
        julgarCondicionalidade(f.vaar, inc),
      ),
    },
    {
      id: "cadastro",
      titulo: "Matrícula e cadastro",
      sub: "O dinheiro que o preenchimento traz: Censo bem feito é receita; vaga de creche é fator alto e meta legal.",
      itens: [julgarConciliacao(f.conciliacao), julgarCreche(f.faixaCreche)],
    },
    {
      id: "resultado",
      titulo: "Resultado em sala",
      sub: "A prova final do dever de casa — e o que as condicionalidades II e III do VAAR medem por trás.",
      itens: [julgarAlfabetizacao(f.alfabetizacao), julgarIdeb(f.ideb)],
    },
  ];
}

export function calcularPlacar(blocos: BlocoDever[]): PlacarDever {
  const itens = blocos.flatMap((b) => b.itens);
  const conta = (v: Veredito) => itens.filter((i) => i.veredito === v).length;
  const cumpre = conta("cumpre");
  const parcial = conta("parcial");
  const descumpre = conta("descumpre");
  const avaliados = cumpre + parcial + descumpre;
  const nota = avaliados === 0 ? null : Math.round(((cumpre + parcial * 0.5) / avaliados) * 100) / 10;
  return {
    total: itens.length,
    avaliados,
    cumpre,
    parcial,
    descumpre,
    semDado: conta("sem_dado"),
    foraDoAlcance: conta("fora_do_alcance"),
    nota,
    rotulo:
      nota == null
        ? "Sem dados suficientes"
        : nota >= 7.5
          ? "Faz o dever de casa"
          : nota >= 5
            ? "Faz em parte"
            : "Não faz o dever de casa",
  };
}

/**
 * O que o descumprimento já custa por exercício — separado do potencial.
 *
 * `naMesa` só carrega perda causada por item reprovado; `potencial` carrega o
 * que ação nova traria. Misturar os dois transformaria o relatório interno na
 * mesma promessa inflada que ele existe para substituir.
 */
export function montarDinheiro(f: FontesDever): { naMesa: ParcelaDinheiro[]; potencial: ParcelaDinheiro[] } {
  const naMesa: ParcelaDinheiro[] = [];
  const potencial: ParcelaDinheiro[] = [];

  if (f.vaar && f.vaar.complementacao === 0) {
    const reprovadasLocais = f.vaar.reprovadas.filter((inc) => !(inc === "IV" && f.vaar!.condIVEstadual));
    const referencia = f.vaar.referencia.medianaUf ?? f.vaar.referencia.medianaNacional;
    if (reprovadasLocais.length > 0 && referencia > 0) {
      naMesa.push({
        rotulo: `Complementação VAAR não recebida (reprovado em ${reprovadasLocais.join(", ")})`,
        valor: referencia,
        estimativa: true,
        nota: "Estimado pela mediana dos municípios beneficiados da UF (ou do país, sem UF beneficiada). O valor real dependeria do coeficiente.",
      });
    } else if (f.vaar.habilitadoSemRepasse) {
      naMesa.push({
        rotulo: "VAAR habilitado, mas sem repasse: não evoluiu em atendimento nem em aprendizagem",
        valor: referencia,
        estimativa: true,
        nota: "Habilitação sem evolução vale zero — o rateio é proporcional ao avanço nos dois indicadores.",
      });
    }
  }

  if (f.contaCreche?.valorDerivado != null && f.contaCreche.valorDerivado > 0) {
    potencial.push({
      rotulo: `Receita derivada de fechar a meta de creche (${inteiro.format(f.contaCreche.matriculasAteMeta)} matrículas)`,
      valor: f.contaCreche.valorDerivado,
      estimativa: true,
      nota: "Derivado pela aritmética da Portaria; entra no exercício seguinte e não paga sozinho o custo de abrir as vagas.",
    });
  }

  return { naMesa, potencial };
}

function fonteStatus(rotulo: string, ok: boolean, detalhe: string): FonteDever {
  return { rotulo, ok, detalhe };
}

export async function montarDeverDeCasa(
  codigoIBGE: string,
  uf: string,
  referencia = new Date(),
): Promise<DeverDeCasa> {
  // Três consultas vivas, independentes; nenhuma derruba a emissão — item sem
  // fonte vira `sem_dado` e a lista `fontes` registra o que faltou.
  const [caucRes, pontRes, demoRes] = await Promise.allSettled([
    getCaucMunicipio(codigoIBGE),
    getPontualidadeFiscal(codigoIBGE, referencia.getFullYear()),
    getDemografiaEducacional(codigoIBGE),
  ]);

  const cauc = caucRes.status === "fulfilled" ? caucRes.value : null;
  const pontualidade = pontRes.status === "fulfilled" ? pontRes.value : null;
  const demografia = demoRes.status === "fulfilled" ? demoRes.value : null;

  const siope = getConformidadeSiope(codigoIBGE);
  const vaar = getSituacaoVaar(codigoIBGE);
  const remuneracao = getRemuneracaoMunicipal(codigoIBGE);
  const matricula = montarDossieMatricula(codigoIBGE, uf);
  const alfabetizacao = getAlfabetizacaoMunicipal(codigoIBGE);
  const ideb = montarSerieIdeb(codigoIBGE);
  const censo = getInepCensoMunicipalRecord(codigoIBGE);

  const faixas = montarFaixas(demografia, censo);
  const faixaCreche = faixas.find((fx) => fx.chave === "creche") ?? null;
  const contaCreche = montarContaDaCreche(faixaCreche ?? undefined, uf);

  const f: FontesDever = {
    cauc,
    pontualidade,
    siope,
    vaar,
    remuneracao,
    conciliacao: matricula?.conciliacao ?? null,
    faixaCreche,
    contaCreche,
    alfabetizacao,
    ideb,
  };

  const blocos = montarItens(f);
  const { naMesa, potencial } = montarDinheiro(f);

  return {
    exercicio: referencia.getFullYear(),
    blocos,
    placar: calcularPlacar(blocos),
    naMesa,
    potencial,
    fontes: [
      fonteStatus("CAUC (Tesouro Nacional)", cauc !== null, cauc ? `extrato de ${cauc.dataPesquisa}` : "não respondeu"),
      fonteStatus(
        "Extrato de entregas (Siconfi)",
        pontualidade !== null,
        pontualidade ? `consultado em ${pontualidade.consultadoEm.slice(0, 10)}` : "não respondeu",
      ),
      fonteStatus("SIOPE — vinculações", siope !== null, siope ? `declaração de ${siope.ano}` : "sem cobertura"),
      fonteStatus("SIOPE — remuneração", remuneracao !== null, remuneracao ? `declaração de ${remuneracao.ano}` : "sem cobertura"),
      fonteStatus("VAAR (FNDE)", vaar !== null, vaar ? `aferição de ${vaar.exercicio}` : "sem cobertura"),
      fonteStatus(
        "Portaria de ponderação (FNDE)",
        matricula !== null,
        matricula ? `exercício de ${matricula.exercicio}` : "sem cobertura",
      ),
      fonteStatus("Demografia (IBGE)", demografia !== null, demografia ? "coortes por município" : "não respondeu"),
      fonteStatus(
        "Alfabetização (MEC/Inep)",
        alfabetizacao !== null,
        alfabetizacao?.anoAvaliacao ? `avaliação de ${alfabetizacao.anoAvaliacao}` : "sem cobertura",
      ),
      fonteStatus("IDEB (INEP)", ideb.length > 0, ideb.length > 0 ? "série histórica municipal" : "sem cobertura"),
    ],
  };
}
