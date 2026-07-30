import {
  getCatalogoSegmentos,
  getPonderacaoMunicipal,
  type OportunidadePonderacao,
  type SegmentoPonderado,
} from "./fundeb-ponderacao";
import { getValorAlunoAno } from "./fundeb-valor-aluno";
import { getEstimativaPnae, type EstimativaPnae } from "./fundeb-pnae";
import { getEquidadeMunicipal, type EquidadeMunicipal } from "./inep-equidade";
import {
  getInepCensoMunicipalHistory,
  getInepCensoMunicipalRecord,
  type InepCensoMunicipalRecord,
} from "./inep-censo";

/**
 * Dossiê da Matrícula Ponderada — de onde vem cada real do fundo.
 *
 * ## A tese
 *
 * O FUNDEB não paga por matrícula: paga por **matrícula ponderada**. O fator
 * vai de 1,00 (anos iniciais urbanos, a referência do art. 7º, §1º da Lei
 * 14.113/2020) a 2,17 (creche integral indígena ou quilombola). Duas redes com
 * o mesmo número de alunos recebem valores diferentes, e a diferença inteira
 * está na composição **declarada** no Censo.
 *
 * O Raio-X mostra o fator médio e os doze segmentos de maior peso. Aqui entram
 * todos, com a conta aberta, mais quatro cortes transversais do mesmo total,
 * a conciliação com o Censo e a série que mostra para onde a composição está
 * indo.
 *
 * ## A regra de dinheiro deste documento
 *
 * Nos demais relatórios vale "só imprime R$ quando a fonte publicou aquele R$".
 * Aqui há uma exceção, e ela é declarada em cada tabela onde aparece: o valor
 * por matrícula-equivalente da UF é publicado na Portaria Interministerial —
 * é literalmente o VAAF do segmento de fator 1,00 —, então
 * `equivalentes × valor` reproduz a aritmética da própria Portaria. O que sai
 * daí é **derivado**, não repassado, e todo campo assim se chama
 * `valorDerivado`. Nenhum número derivado entra em afirmação de perda.
 */

/** Etapa do segmento, na taxonomia da Portaria. */
export type EtapaSegmento =
  | "creche"
  | "pre-escola"
  | "fundamental"
  | "medio"
  | "eja"
  | "profissional"
  | "aee"
  | "demais";

export type JornadaSegmento = "integral" | "parcial" | null;
export type LocalizacaoSegmento = "urbano" | "campo" | "indigena" | "quilombola" | null;
export type DependenciaSegmento = "publica" | "conveniada";
export type ModalidadeSegmento = "regular" | "especial" | "bilingue" | "aee" | "profissional";

export interface SegmentoDossie extends SegmentoPonderado {
  etapa: EtapaSegmento;
  jornada: JornadaSegmento;
  localizacao: LocalizacaoSegmento;
  dependencia: DependenciaSegmento;
  modalidade: ModalidadeSegmento;
  /** `equivalentes × valorPorEquivalente` da UF. Derivado — ver o doc do módulo. */
  valorDerivado: number | null;
  /** Quanto o fator acrescenta sobre a referência 1,00, em R$/ano. Derivado. */
  valorAcimaDaReferencia: number | null;
}

/** Uma fatia de qualquer um dos cortes transversais. */
export interface Fatia {
  chave: string;
  rotulo: string;
  segmentos: number;
  matriculas: number;
  equivalentes: number;
  /** Participação no total ponderado (VAAF), em %. */
  participacao: number;
  /** Participação na matrícula bruta, em %. */
  participacaoBruta: number;
  /** Equivalentes ÷ matrículas da fatia. */
  fatorMedio: number | null;
  valorDerivado: number | null;
}

export interface Corte {
  chave: "etapa" | "jornada" | "localizacao" | "dependencia" | "modalidade";
  titulo: string;
  /** Por que este corte existe — a frase que o dossiê imprime sob o título. */
  nota: string;
  fatias: Fatia[];
}

/** Uma linha da ponte entre o Censo declarado e a filtragem do FNDE. */
export interface LinhaConciliacao {
  rotulo: string;
  censo: number | null;
  fnde: number;
  diferenca: number | null;
  /** `true` quando a diferença passa de 0,5% do lado do Censo, nunca menos que 5. */
  divergente: boolean;
  nota: string;
}

export interface Conciliacao {
  anoCenso: number;
  linhas: LinhaConciliacao[];
  /** Soma das linhas com contraparte no Censo. */
  censoTotal: number;
  fndeTotal: number;
  /** Matrículas do FNDE sem contraparte na rede municipal do Censo. */
  aee: number;
  conveniadas: number;
  /** O que sobra depois de somar tudo. Zero é o resultado esperado. */
  residuo: number;
  /**
   * `true` só quando o total **e** cada bloco fecham dentro da tolerância.
   *
   * As duas condições são necessárias porque diferenças de sinal contrário se
   * cancelam no total: São Paulo tem 2.620 matrículas de ensino médio municipal
   * no Censo que a Portaria não pondera, e um `fecha` que olhasse só o total
   * declararia conciliação fechada na mesma folha em que a linha aparece
   * marcada como divergente.
   */
  fecha: boolean;
}

/** Um ano da série de composição. */
export interface AnoComposicao {
  ano: number;
  matriculas: number;
  creche: number;
  crecheIntegral: number;
  preEscola: number;
  preEscolaIntegral: number;
  fundamental: number;
  fundamentalIntegral: number;
  eja: number;
  especial: number;
  /** Creche integral ÷ creche, em %. */
  crecheIntegralPct: number | null;
  fundamentalIntegralPct: number | null;
}

export type SituacaoConferencia = "divergencia" | "coerente" | "sem-base";

/**
 * Um confronto entre duas bases que descrevem a mesma coisa.
 *
 * Divergência aqui não é acusação: as duas bases têm recortes e filtragens
 * diferentes por construção. É o pedido de conferência que a rede pode fazer
 * antes da próxima coleta — que é a única janela em que o número ainda muda.
 */
export interface Conferencia {
  chave: string;
  titulo: string;
  situacao: SituacaoConferencia;
  censo: string;
  fnde: string;
  /** Matrículas de diferença, quando as duas bases são comparáveis. */
  diferenca: number | null;
  ganhoEquivalentes: number | null;
  valorDerivado: number | null;
  leitura: string;
}

export interface SegmentoAusente {
  nome: string;
  fatorVaaf: number | null;
  fatorVaat: number | null;
}

export interface DossieMatricula {
  exercicio: number;
  fonte: string;
  uf: string;
  ente: string;
  matriculas: number;
  matriculasConveniadas: number;
  ponderadaVaaf: number;
  ponderadaVaat: number;
  fatorMedio: number | null;
  fatorMedioVaat: number | null;
  /** VAAF do segmento de fator 1,00 na UF. `null` sem a Portaria da UF. */
  valorPorEquivalente: number | null;
  /** `ponderadaVaaf × valorPorEquivalente`. Derivado. */
  receitaDerivada: number | null;
  /** `(ponderada − bruta) × valorPorEquivalente`: o que a composição acrescenta. */
  receitaDoPeso: number | null;
  segmentos: SegmentoDossie[];
  cortes: Corte[];
  conciliacao: Conciliacao | null;
  serie: AnoComposicao[];
  oportunidades: OportunidadePonderacao[];
  conferencias: Conferencia[];
  ausentes: SegmentoAusente[];
  pnae: EstimativaPnae | null;
  equidade: EquidadeMunicipal | null;
  censo: InepCensoMunicipalRecord | null;
  resumo: {
    segmentosComMatricula: number;
    segmentosNoCatalogo: number;
    /** Participação, no total ponderado, dos segmentos de fator acima de 1,00. */
    participacaoAcimaDaReferencia: number;
    /** Matrículas em segmentos de fator acima de 1,00. */
    matriculasAcimaDaReferencia: number;
    divergencias: number;
  };
}

// ── classificação dos segmentos ────────────────────────────────────────────
//
// A Portaria nomeia cada segmento por concatenação — etapa, jornada, rede e
// localização no mesmo string. Não há campo estruturado: o nome é a estrutura,
// e é dele que saem os cinco cortes.

function classificarEtapa(nome: string): EtapaSegmento {
  if (/^Atendimento Educacional Especializado/i.test(nome)) return "aee";
  if (/^Educação Profissional/i.test(nome)) return "profissional";
  if (/Creche/i.test(nome)) return "creche";
  if (/Pré-Escola/i.test(nome)) return "pre-escola";
  if (/Fundamental/i.test(nome)) return "fundamental";
  if (/Médio/i.test(nome)) return "medio";
  if (/^EJA/i.test(nome)) return "eja";
  return "demais";
}

function classificarJornada(nome: string): JornadaSegmento {
  if (/Integral/i.test(nome)) return "integral";
  if (/Parcial/i.test(nome)) return "parcial";
  // A Portaria separa "Ensino Fundamental Integral" dos anos iniciais e finais;
  // estes últimos são, por construção, a jornada parcial do fundamental.
  if (/^Anos (Iniciais|Finais) Fundamental/i.test(nome)) return "parcial";
  return null;
}

function classificarLocalizacao(nome: string): LocalizacaoSegmento {
  if (/Quilombola$/i.test(nome)) return "quilombola";
  if (/Indígena$/i.test(nome)) return "indigena";
  if (/Campo$/i.test(nome)) return "campo";
  if (/Urbano$/i.test(nome)) return "urbano";
  return null;
}

function classificarModalidade(nome: string): ModalidadeSegmento {
  if (/^Atendimento Educacional Especializado/i.test(nome)) return "aee";
  if (/^Educação Especial/i.test(nome)) return "especial";
  if (/^Educação Bilingue/i.test(nome)) return "bilingue";
  if (/^Educação Profissional/i.test(nome)) return "profissional";
  return "regular";
}

const ROTULO_ETAPA: Record<EtapaSegmento, string> = {
  creche: "Creche",
  "pre-escola": "Pré-escola",
  fundamental: "Ensino fundamental",
  medio: "Ensino médio",
  eja: "Educação de jovens e adultos",
  profissional: "Educação profissional e técnica",
  aee: "Atendimento educacional especializado",
  demais: "Especial e bilíngue — demais etapas",
};

const ROTULO_JORNADA: Record<string, string> = {
  integral: "Tempo integral",
  parcial: "Tempo parcial",
  "nao-segmentado": "Sem distinção de jornada na Portaria",
};

const ROTULO_LOCALIZACAO: Record<string, string> = {
  urbano: "Urbano",
  campo: "Campo",
  indigena: "Terra indígena",
  quilombola: "Remanescente de quilombo",
  "nao-segmentado": "Sem distinção de localização na Portaria",
};

const ROTULO_DEPENDENCIA: Record<DependenciaSegmento, string> = {
  publica: "Rede pública própria",
  conveniada: "Conveniada (art. 7º, §2º)",
};

const ROTULO_MODALIDADE: Record<ModalidadeSegmento, string> = {
  regular: "Ensino regular",
  especial: "Educação especial",
  bilingue: "Educação bilíngue de surdos e escolar indígena",
  aee: "Atendimento educacional especializado",
  profissional: "Educação profissional e técnica",
};

function agrupar(
  segmentos: SegmentoDossie[],
  chave: (s: SegmentoDossie) => string,
  rotulo: (c: string) => string,
  ponderada: number,
  bruta: number,
  valorPorEquivalente: number | null,
): Fatia[] {
  const mapa = new Map<string, Fatia>();

  for (const s of segmentos) {
    const c = chave(s);
    const atual = mapa.get(c) ?? {
      chave: c,
      rotulo: rotulo(c),
      segmentos: 0,
      matriculas: 0,
      equivalentes: 0,
      participacao: 0,
      participacaoBruta: 0,
      fatorMedio: null,
      valorDerivado: null,
    };
    atual.segmentos += 1;
    atual.matriculas += s.matriculas;
    atual.equivalentes += s.equivalentes;
    mapa.set(c, atual);
  }

  return [...mapa.values()]
    .map((f) => ({
      ...f,
      participacao: ponderada > 0 ? (f.equivalentes / ponderada) * 100 : 0,
      participacaoBruta: bruta > 0 ? (f.matriculas / bruta) * 100 : 0,
      fatorMedio: f.matriculas > 0 ? f.equivalentes / f.matriculas : null,
      valorDerivado: valorPorEquivalente === null ? null : f.equivalentes * valorPorEquivalente,
    }))
    .sort((a, b) => b.equivalentes - a.equivalentes);
}

// ── conciliação com o Censo ────────────────────────────────────────────────

/**
 * A ponte entre o que o município declarou no Censo e o que o FNDE contou.
 *
 * Os dois números nunca são iguais, e a diferença assusta quem vê pela primeira
 * vez. Ela tem três causas, todas conhecidas: o AEE gera **dupla matrícula**
 * (art. 8º, §3º, I), as conveniadas de educação infantil entram no fundo sem
 * estar na rede municipal do Censo, e a educação especial é recorte transversal
 * — no Censo ela está dentro da etapa, na Portaria ela é segmento próprio.
 *
 * Feita a ponte, o resíduo é zero na maioria dos municípios — e quando não é,
 * o resíduo é a informação.
 */
function conciliar(
  segmentos: SegmentoDossie[],
  censo: InepCensoMunicipalRecord | null,
  fndeTotal: number,
): Conciliacao | null {
  if (!censo) return null;

  const somaSe = (p: (s: SegmentoDossie) => boolean) =>
    segmentos.reduce((t, s) => (p(s) ? t + s.matriculas : t), 0);

  const publica = (s: SegmentoDossie) => s.dependencia === "publica";

  const crecheFnde = somaSe((s) => publica(s) && s.etapa === "creche");
  const preFnde = somaSe((s) => publica(s) && s.etapa === "pre-escola");
  const demaisFnde = somaSe(
    (s) =>
      publica(s) &&
      (s.etapa === "fundamental" ||
        s.etapa === "medio" ||
        s.etapa === "eja" ||
        s.etapa === "profissional" ||
        s.etapa === "demais"),
  );

  const aee = somaSe((s) => s.etapa === "aee");
  const conveniadas = somaSe((s) => s.dependencia === "conveniada");

  const crecheCenso = censo.crecheMunicipal;
  const preCenso = censo.preEscolaMunicipal;
  const demaisCenso =
    (censo.ensinoFundamentalMunicipal ?? 0) +
    (censo.ensinoMedioMunicipal ?? 0) +
    (censo.ejaMunicipal ?? 0);

  const par = (rotulo: string, censoValor: number, fndeValor: number, nota: string): LinhaConciliacao => {
    const diferenca = fndeValor - censoValor;
    return {
      rotulo,
      censo: censoValor,
      fnde: fndeValor,
      diferenca,
      divergente: Math.abs(diferenca) > Math.max(5, censoValor * 0.005),
      nota,
    };
  };

  const linhas: LinhaConciliacao[] = [
    par(
      "Creche",
      crecheCenso,
      crecheFnde,
      "Inclui os segmentos de educação especial e bilíngue em creche, que no Censo estão dentro da própria etapa.",
    ),
    par(
      "Pré-escola",
      preCenso,
      preFnde,
      "Mesma regra: a educação especial de pré-escola é segmento próprio na Portaria e etapa comum no Censo.",
    ),
    par(
      "Fundamental, médio, EJA e profissional",
      demaisCenso,
      demaisFnde,
      'Reunidos porque o segmento "Educação Especial — demais segmentos" atravessa as quatro etapas e não se deixa repartir entre elas.',
    ),
    {
      rotulo: "Conveniadas de educação infantil",
      censo: null,
      fnde: conveniadas,
      diferenca: null,
      divergente: false,
      nota: "Entram no fundo pelo art. 7º, §2º da Lei 14.113/2020 sem pertencer à rede municipal — por isso não têm contraparte no Censo da dependência municipal.",
    },
    {
      rotulo: "Atendimento educacional especializado",
      censo: null,
      fnde: aee,
      diferenca: null,
      divergente: false,
      nota: "Dupla matrícula do art. 8º, §3º, I: o mesmo aluno conta na escolarização e no AEE. É a maior parcela da diferença entre os dois totais.",
    },
  ];

  const censoTotal = crecheCenso + preCenso + demaisCenso;
  const residuo = fndeTotal - (censoTotal + aee + conveniadas);

  return {
    anoCenso: censo.anoReferencia,
    linhas,
    censoTotal,
    fndeTotal,
    aee,
    conveniadas,
    residuo,
    fecha:
      Math.abs(residuo) <= Math.max(5, censoTotal * 0.005) && !linhas.some((l) => l.divergente),
  };
}

// ── conferências entre bases ───────────────────────────────────────────────

/** Tolerância de uma comparação: 2% do lado do Censo, nunca menos que 5. */
function tolerancia(base: number): number {
  return Math.max(5, base * 0.02);
}

function conferenciaJornada(
  chave: string,
  titulo: string,
  censoValor: number | null | undefined,
  fndeValor: number,
  deltaFator: number,
  valorPorEquivalente: number | null,
  leituraDivergente: string,
  leituraCoerente: string,
): Conferencia {
  if (censoValor == null) {
    return {
      chave,
      titulo,
      situacao: "sem-base",
      censo: "—",
      fnde: fndeValor.toLocaleString("pt-BR"),
      diferenca: null,
      ganhoEquivalentes: null,
      valorDerivado: null,
      leitura: "O Censo do ano de referência não trouxe este indicador para o município.",
    };
  }

  const diferenca = censoValor - fndeValor;
  const divergente = diferenca > tolerancia(censoValor);
  const ganho = divergente ? diferenca * deltaFator : null;

  return {
    chave,
    titulo,
    situacao: divergente ? "divergencia" : "coerente",
    censo: censoValor.toLocaleString("pt-BR"),
    fnde: fndeValor.toLocaleString("pt-BR"),
    diferenca,
    ganhoEquivalentes: ganho,
    valorDerivado: ganho !== null && valorPorEquivalente !== null ? ganho * valorPorEquivalente : null,
    leitura: divergente ? leituraDivergente : leituraCoerente,
  };
}

function conferenciaTerritorio(
  chave: string,
  titulo: string,
  escolas: number | null,
  matriculas: number,
  leitura: string,
): Conferencia | null {
  if (escolas == null || escolas === 0) return null;

  const divergente = matriculas === 0;
  return {
    chave,
    titulo,
    situacao: divergente ? "divergencia" : "coerente",
    censo: `${escolas.toLocaleString("pt-BR")} escola(s)`,
    fnde: `${matriculas.toLocaleString("pt-BR")} matrícula(s)`,
    diferenca: null,
    ganhoEquivalentes: null,
    valorDerivado: null,
    leitura: divergente
      ? leitura
      : "As duas bases concordam: a condição declarada nas escolas aparece na ponderação do fundo.",
  };
}

function levantarConferencias(
  segmentos: SegmentoDossie[],
  censo: InepCensoMunicipalRecord | null,
  equidade: EquidadeMunicipal | null,
  valorPorEquivalente: number | null,
): Conferencia[] {
  const conferencias: Conferencia[] = [];
  const somaSe = (p: (s: SegmentoDossie) => boolean) =>
    segmentos.reduce((t, s) => (p(s) ? t + s.matriculas : t), 0);

  if (censo) {
    // Creche: 1,55 integral contra 1,25 parcial, na rede pública urbana.
    conferencias.push(
      conferenciaJornada(
        "integral-creche",
        "Creche em tempo integral",
        censo.tempoIntegralCrecheMunicipal,
        somaSe((s) => s.etapa === "creche" && s.jornada === "integral" && s.dependencia === "publica"),
        0.3,
        valorPorEquivalente,
        "O Censo registra mais creche em tempo integral do que a ponderação do fundo reconhece. As duas bases saem da mesma coleta, então a diferença costuma ser de forma: o fundo lê o tempo declarado por turma, e turma lançada com turno fixo não entra como integral mesmo praticando a jornada.",
        "As duas bases concordam sobre a creche em tempo integral — a jornada declarada está sendo ponderada.",
      ),
    );

    conferencias.push(
      conferenciaJornada(
        "integral-pre",
        "Pré-escola em tempo integral",
        censo.tempoIntegralPreEscolaMunicipal,
        somaSe((s) => s.etapa === "pre-escola" && s.jornada === "integral" && s.dependencia === "publica"),
        0.35,
        valorPorEquivalente,
        "Há pré-escola em tempo integral no Censo que a Portaria não pondera como integral. O salto entre 1,15 e 1,50 é o maior da pré-escola.",
        "As duas bases concordam sobre a pré-escola em tempo integral.",
      ),
    );

    conferencias.push(
      conferenciaJornada(
        "integral-fundamental",
        "Fundamental em tempo integral",
        censo.tempoIntegralEnsinoFundamentalMunicipal,
        somaSe((s) => s.etapa === "fundamental" && s.jornada === "integral"),
        0.5,
        valorPorEquivalente,
        "O Censo tem mais matrícula de fundamental em tempo integral do que o segmento integral da Portaria. É a maior diferença por matrícula do quadro: 1,00 contra 1,50.",
        "As duas bases concordam sobre o fundamental em tempo integral.",
      ),
    );
  }

  const escolas = equidade?.escolas ?? null;
  if (escolas) {
    const territoriais: Array<Conferencia | null> = [
      conferenciaTerritorio(
        "campo",
        "Escolas no campo",
        escolas.municipaisRurais,
        somaSe((s) => s.localizacao === "campo"),
        "A rede tem escola em zona rural no Censo e nenhuma matrícula ponderada como campo. O fator do campo é 15% acima do urbano em toda etapa — vale conferir a localização declarada de cada unidade rural.",
      ),
      conferenciaTerritorio(
        "quilombola",
        "Escolas em remanescente de quilombo",
        escolas.municipaisQuilombolas,
        somaSe((s) => s.localizacao === "quilombola"),
        "Há escola declarada em remanescente de quilombo e nenhuma matrícula ponderada nessa condição. É o maior fator da tabela — creche integral quilombola pondera 2,17 contra 1,55 urbana.",
      ),
      conferenciaTerritorio(
        "indigena",
        "Escolas em terra indígena",
        escolas.municipaisTerraIndigena,
        somaSe((s) => s.localizacao === "indigena"),
        "Há escola declarada em terra indígena e nenhuma matrícula ponderada nessa condição. A localização diferenciada é campo do Censo e precisa estar preenchida por unidade.",
      ),
      conferenciaTerritorio(
        "bilingue",
        "Educação escolar indígena",
        escolas.municipaisEducacaoIndigena,
        somaSe((s) => s.modalidade === "bilingue"),
        "Há escola de educação escolar indígena no Censo e nenhuma matrícula no segmento bilíngue da Portaria. O segmento depende do registro da língua de instrução na turma, não só da condição da escola.",
      ),
    ];
    for (const c of territoriais) if (c) conferencias.push(c);
  }

  // Divergência primeiro: é o que muda alguma coisa antes da próxima coleta.
  const ordem: Record<SituacaoConferencia, number> = { divergencia: 0, coerente: 1, "sem-base": 2 };
  return conferencias.sort((a, b) => {
    if (ordem[a.situacao] !== ordem[b.situacao]) return ordem[a.situacao] - ordem[b.situacao];
    return (b.valorDerivado ?? 0) - (a.valorDerivado ?? 0);
  });
}

// ── série de composição ────────────────────────────────────────────────────

function montarSerie(codigoIBGE: string): AnoComposicao[] {
  return getInepCensoMunicipalHistory(codigoIBGE).map((r) => {
    const creche = r.crecheMunicipal;
    const fundamental = r.ensinoFundamentalMunicipal ?? 0;
    const crecheIntegral = r.tempoIntegralCrecheMunicipal ?? 0;
    const fundamentalIntegral = r.tempoIntegralEnsinoFundamentalMunicipal ?? 0;

    return {
      ano: r.anoReferencia,
      matriculas: r.matriculasMunicipaisTotal,
      creche,
      crecheIntegral,
      preEscola: r.preEscolaMunicipal,
      preEscolaIntegral: r.tempoIntegralPreEscolaMunicipal ?? 0,
      fundamental,
      fundamentalIntegral,
      eja: r.ejaMunicipal ?? 0,
      especial: r.educacaoEspecialMunicipal ?? 0,
      crecheIntegralPct: creche > 0 ? (crecheIntegral / creche) * 100 : null,
      fundamentalIntegralPct: fundamental > 0 ? (fundamentalIntegral / fundamental) * 100 : null,
    };
  });
}

// ── montagem ───────────────────────────────────────────────────────────────

export function montarDossieMatricula(codigoIBGE: string, uf?: string): DossieMatricula | null {
  const p = getPonderacaoMunicipal(codigoIBGE);
  if (!p || p.segmentos.length === 0) return null;

  const ufAlvo = (uf ?? p.uf).trim().toUpperCase();
  const valores = getValorAlunoAno(ufAlvo);
  const valorPorEquivalente =
    valores && valores.fundamentalParcialAnosIniciais > 0
      ? valores.fundamentalParcialAnosIniciais
      : null;

  const segmentos: SegmentoDossie[] = p.segmentos.map((s) => {
    const acima = s.fatorVaaf !== null ? Math.max(0, s.fatorVaaf - 1) * s.matriculas : 0;
    return {
      ...s,
      etapa: classificarEtapa(s.nome),
      jornada: classificarJornada(s.nome),
      localizacao: classificarLocalizacao(s.nome),
      dependencia: /Conveniada/i.test(s.nome) ? "conveniada" : "publica",
      modalidade: classificarModalidade(s.nome),
      valorDerivado: valorPorEquivalente === null ? null : s.equivalentes * valorPorEquivalente,
      valorAcimaDaReferencia: valorPorEquivalente === null ? null : acima * valorPorEquivalente,
    };
  });

  const cortes: Corte[] = [
    {
      chave: "etapa",
      titulo: "Por etapa",
      nota: "A leitura mais óbvia e a menos reveladora: mostra onde estão os alunos, não onde está o dinheiro. Compare a coluna de participação bruta com a ponderada — a distância entre as duas é o efeito do fator.",
      fatias: agrupar(
        segmentos,
        (s) => s.etapa,
        (c) => ROTULO_ETAPA[c as EtapaSegmento],
        p.ponderadaVaaf,
        p.matriculas,
        valorPorEquivalente,
      ),
    },
    {
      chave: "jornada",
      titulo: "Por jornada",
      nota: "O corte que mais responde a decisão de gestão. Tempo integral pondera de 20% a 50% acima da mesma etapa em jornada parcial, e a jornada é declarada — não estimada.",
      fatias: agrupar(
        segmentos,
        (s) => s.jornada ?? "nao-segmentado",
        (c) => ROTULO_JORNADA[c] ?? c,
        p.ponderadaVaaf,
        p.matriculas,
        valorPorEquivalente,
      ),
    },
    {
      chave: "localizacao",
      titulo: "Por localização",
      nota: "Campo pondera 15% acima do urbano em toda etapa; terra indígena e remanescente de quilombo, 40%. É condição da escola, declarada uma vez por unidade na coleta.",
      fatias: agrupar(
        segmentos,
        (s) => s.localizacao ?? "nao-segmentado",
        (c) => ROTULO_LOCALIZACAO[c] ?? c,
        p.ponderadaVaaf,
        p.matriculas,
        valorPorEquivalente,
      ),
    },
    {
      chave: "dependencia",
      titulo: "Por rede",
      nota: "Conveniada só existe na educação infantil e na especial, e pondera abaixo da rede própria na mesma etapa e jornada. Quando o volume é grande, é decisão orçamentária de porte.",
      fatias: agrupar(
        segmentos,
        (s) => s.dependencia,
        (c) => ROTULO_DEPENDENCIA[c as DependenciaSegmento],
        p.ponderadaVaaf,
        p.matriculas,
        valorPorEquivalente,
      ),
    },
    {
      chave: "modalidade",
      titulo: "Por modalidade",
      nota: "Educação especial e AEE são recortes transversais: o mesmo aluno pode gerar duas matrículas ponderadas, e é a única duplicidade que a lei autoriza.",
      fatias: agrupar(
        segmentos,
        (s) => s.modalidade,
        (c) => ROTULO_MODALIDADE[c as ModalidadeSegmento],
        p.ponderadaVaaf,
        p.matriculas,
        valorPorEquivalente,
      ),
    },
  ];

  const censo = getInepCensoMunicipalRecord(codigoIBGE);
  const equidade = getEquidadeMunicipal(codigoIBGE);

  const declarados = new Set(segmentos.map((s) => s.nome));
  const ausentes = getCatalogoSegmentos()
    .filter((s) => !declarados.has(s.nome) && s.fatorVaaf !== null)
    .map(({ nome, fatorVaaf, fatorVaat }) => ({ nome, fatorVaaf, fatorVaat }));

  const conferencias = levantarConferencias(segmentos, censo, equidade, valorPorEquivalente);

  const acimaDaReferencia = segmentos.filter((s) => (s.fatorVaaf ?? 0) > 1);

  return {
    exercicio: p.exercicio,
    fonte: p.fonte,
    uf: ufAlvo,
    ente: p.ente,
    matriculas: p.matriculas,
    matriculasConveniadas: segmentos.reduce(
      (t, s) => (s.dependencia === "conveniada" ? t + s.matriculas : t),
      0,
    ),
    ponderadaVaaf: p.ponderadaVaaf,
    ponderadaVaat: p.ponderadaVaat,
    fatorMedio: p.fatorMedio,
    fatorMedioVaat: p.matriculas > 0 ? p.ponderadaVaat / p.matriculas : null,
    valorPorEquivalente,
    receitaDerivada: valorPorEquivalente === null ? null : p.ponderadaVaaf * valorPorEquivalente,
    receitaDoPeso:
      valorPorEquivalente === null ? null : (p.ponderadaVaaf - p.matriculas) * valorPorEquivalente,
    segmentos,
    cortes,
    conciliacao: conciliar(segmentos, censo, p.matriculas),
    serie: montarSerie(codigoIBGE),
    oportunidades: p.oportunidades,
    conferencias,
    ausentes,
    pnae: getEstimativaPnae(codigoIBGE),
    equidade,
    censo,
    resumo: {
      segmentosComMatricula: segmentos.length,
      segmentosNoCatalogo: segmentos.length + ausentes.length,
      participacaoAcimaDaReferencia: acimaDaReferencia.reduce((t, s) => t + s.participacao, 0),
      matriculasAcimaDaReferencia: acimaDaReferencia.reduce((t, s) => t + s.matriculas, 0),
      divergencias: conferencias.filter((c) => c.situacao === "divergencia").length,
    },
  };
}
