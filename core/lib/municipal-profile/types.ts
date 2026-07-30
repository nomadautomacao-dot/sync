/**
 * Contrato do Perfil Municipal — a camada que o Raio-X consome antes do
 * levantamento FUNDEB.
 *
 * A lição do relatório artesanal de Senhor do Bonfim é que um raio-X só é
 * defensável se cada número disser de onde veio e de quando é. Comparar um
 * fechamento de 2025 com uma estimativa de 2026 sem avisar produz conclusão
 * errada com aparência de rigor. Por isso nenhum indicador aqui é um número
 * solto: todo valor viaja com `ano`, `status` e `fonte`.
 */

/**
 * Maturidade do dado. Determina se dois números podem ser comparados entre si
 * e como a página de metodologia os rotula.
 */
export type StatusDado =
  /** Exercício encerrado e homologado. Base sólida para comparação. */
  | "fechado"
  /** Exercício corrente, ainda parcial. Não equivale a realizado. */
  | "em_execucao"
  /** Projeção ou estimativa oficial. Não é execução. */
  | "estimativa"
  /** Dado estrutural de baixa frequência (Censo, MUNIC). Defasagem natural. */
  | "estrutural";

export const ROTULOS_STATUS: Record<StatusDado, string> = {
  fechado: "Fechado",
  em_execucao: "Em execução",
  estimativa: "Estimativa",
  estrutural: "Estrutural",
};

/**
 * Um número com procedência. `valor` nulo significa que a fonte respondeu mas
 * não tinha o dado — diferente de a fonte ter falhado, que é registrado em
 * `FalhaColeta`.
 */
export interface Indicador<T = number> {
  valor: T | null;
  /** Ano de referência do dado, não o da coleta. */
  ano: number | null;
  status: StatusDado;
  /** Nome legível da fonte, como aparece no rodapé da página. */
  fonte: string;
  /** Endereço público para conferência. O relatório artesanal citava URL. */
  url: string | null;
}

export function indicador<T>(
  valor: T | null,
  meta: { ano: number | null; status: StatusDado; fonte: string; url?: string | null },
): Indicador<T> {
  return { valor, ano: meta.ano, status: meta.status, fonte: meta.fonte, url: meta.url ?? null };
}

/** Indicador ausente por falta de dado na fonte (a fonte respondeu). */
export function semDado<T>(meta: { status: StatusDado; fonte: string; url?: string | null }): Indicador<T> {
  return { valor: null, ano: null, status: meta.status, fonte: meta.fonte, url: meta.url ?? null };
}

/** Fatia percentual de um total, usada em água, esgoto, lixo e moradia. */
export interface Fatia {
  rotulo: string;
  domicilios: number | null;
  percentual: number | null;
}

// ---------------------------------------------------------------------------
// Blocos temáticos
// ---------------------------------------------------------------------------

/** Censo 2022 (IBGE) — cobertura física de saneamento por domicílio. */
export interface BlocoSaneamento {
  domiciliosTotal: Indicador;
  agua: {
    redeGeral: Indicador;
    semRede: Indicador;
    detalhe: Fatia[];
  };
  esgoto: {
    redeGeral: Indicador;
    fossaRudimentar: Indicador;
    semBanheiro: Indicador;
    detalhe: Fatia[];
  };
  residuos: {
    coletado: Indicador;
    queimadoEnterrado: Indicador;
    detalhe: Fatia[];
    /** SNIS: existência de lixão a céu aberto. */
    lixaoDeclarado: Indicador<boolean>;
  };
}

/** IBGE MUNIC — capacidade institucional e instrumentos de planejamento. */
export interface InstrumentoUrbanistico {
  nome: string;
  possui: boolean;
  /** Ano da lei, quando a MUNIC informa. */
  ano: number | null;
}

export interface BlocoInstitucional {
  planoDiretor: Indicador<"possui" | "elaborando" | "nao_possui">;
  planoDiretorAno: Indicador;
  instrumentos: InstrumentoUrbanistico[];
  habitacao: {
    politicaHabitacional: Indicador<boolean>;
    conselho: Indicador<boolean>;
    fundo: Indicador<boolean>;
    cadastroDeficit: Indicador<boolean>;
    regularizacaoFundiaria: Indicador<boolean>;
  };
  mobilidade: {
    planoMobilidade: Indicador<boolean>;
    transportePublico: Indicador<boolean>;
  };
  saneamentoInstitucional: {
    planoSaneamento: Indicador<boolean>;
    conselho: Indicador<boolean>;
  };
}

/** IPEADATA (fluxo mensal) + IBGE CEMPRE (estoque anual). */
export interface SaldoMensalEmprego {
  competencia: string;
  admissoes: number;
  desligamentos: number;
  saldo: number;
}

export interface BlocoEmprego {
  saldoAcumuladoAtual: Indicador;
  saldoAcumuladoAnterior: Indicador;
  janela: string;
  serie: SaldoMensalEmprego[];
  estoqueVinculos: Indicador;
  setores: Array<{ nome: string; vinculos: number | null }>;
  salarioMedioSalariosMinimos: Indicador;
}

/**
 * Governança educacional — MUNIC, módulo educação.
 *
 * Responde a categoria 5 do checklist de diagnóstico (conselhos, PME) e o
 * item de plano de carreira da categoria 2. São perguntas que antes só se
 * respondia em visita.
 */
export interface BlocoGovernancaEducacional {
  conselhos: {
    /** CME — Conselho Municipal de Educação. */
    educacao: Indicador<boolean>;
    /** CAE — Conselho de Alimentação Escolar. Condição do PNAE. */
    alimentacaoEscolar: Indicador<boolean>;
    transporteEscolar: Indicador<boolean>;
    /** CACS-FUNDEB — Conselho de Acompanhamento e Controle Social. */
    acompanhamentoFundeb: Indicador<boolean>;
  };
  planoMunicipalEducacao: Indicador<boolean>;
  forumPermanenteEducacao: Indicador<boolean>;
  planoCarreiraMagisterio: Indicador<boolean>;
  /** Plano de carreira com previsão expressa do piso nacional. */
  pisoSalarialPrevisto: Indicador<boolean>;
  /** Previsão do limite de 2/3 da jornada em sala — a lei do 1/3 de hora-atividade. */
  limiteHoraAtividade: Indicador<boolean>;
  /** Como a educação está posicionada no organograma (secretaria exclusiva etc.). */
  estruturaOrgaoGestor: Indicador<string>;
  /**
   * Escolaridade do titular do órgão gestor da educação — de "Fundamental
   * incompleto" a "Doutorado".
   */
  titularNivelInstrucao: Indicador<string>;
  /**
   * Área de formação do titular (Pedagogia, Direito, Administração, "Outra"…).
   * A pergunta que interessa: quem dirige a educação tem formação na área?
   */
  titularAreaFormacao: Indicador<string>;
}

/**
 * Conformidade legal do gasto em educação — os dois pisos que o TCM cobra.
 *
 * Descumprir qualquer um deles reprova as contas do prefeito, então este bloco
 * é o de maior peso jurídico do relatório inteiro.
 */
export interface BlocoConformidadeEducacional {
  exercicio: number | null;
  /** Aplicação em MDE sobre a receita de impostos. Mínimo constitucional: 25%. */
  mdeAplicado: Indicador;
  /** Parcela do FUNDEB em remuneração do magistério. Mínimo legal: 70%. */
  fundebRemuneracao: Indicador;
  /** Base de cálculo, para o consultor conferir a conta. */
  receitaImpostos: Indicador;
  despesaMde: Indicador;
  fundebRecebido: Indicador;
  fundebRemuneracaoValor: Indicador;
}

export const MDE_MINIMO_CONSTITUCIONAL = 25;
export const FUNDEB_MINIMO_REMUNERACAO = 70;


/** CNES + e-Gestor APS + indicadores IBGE. */
export interface BlocoSaude {
  estabelecimentosTotal: Indicador;
  porTipo: Array<{ tipo: string; quantidade: number }>;
  atencaoBasica: Indicador;
  caps: Indicador;
  hospitalGeral: Indicador;
  coberturaAps: Indicador;
  coberturaAcs: Indicador;
  mortalidadeInfantil: Indicador;
}

/** CECAD 2.0 (MDS) + Censo 2022. */
export interface BlocoAssistencia {
  familiasCadastradas: Indicador;
  pessoasCadastradas: Indicador;
  extremaPobreza: Indicador;
  responsavelFemininoPct: Indicador;
  rendaMediaFamiliar: Indicador;
}

// ---------------------------------------------------------------------------
// Agregado
// ---------------------------------------------------------------------------

/**
 * Fonte que falhou na coleta. É diferente de dado ausente: aqui a rede ou o
 * provedor caiu, e o relatório precisa dizer isso em vez de imprimir zero.
 */
export interface FalhaColeta {
  bloco: string;
  fonte: string;
  motivo: string;
}

export interface MunicipalProfile {
  codigoIbge: string;
  municipio: string;
  uf: string;
  coletadoEm: Date;
  saneamento: BlocoSaneamento | null;
  institucional: BlocoInstitucional | null;
  emprego: BlocoEmprego | null;
  saude: BlocoSaude | null;
  assistencia: BlocoAssistencia | null;
  governancaEducacional: BlocoGovernancaEducacional | null;
  conformidadeEducacional: BlocoConformidadeEducacional | null;
  falhas: FalhaColeta[];
}

// ---------------------------------------------------------------------------
// Utilidades compartilhadas pelos coletores
// ---------------------------------------------------------------------------

/**
 * O DATASUS/Ministério da Saúde filtra município por código IBGE de 6 dígitos.
 * Passar os 7 dígitos devolve lista vazia com HTTP 200 — falha silenciosa que
 * parece município sem rede instalada. O IBGE (SIDRA, servicodados) usa 7.
 */
export function ibge6(codigoIbge: string): string {
  return codigoIbge.replace(/\D/g, "").slice(0, 6);
}

/** Divisão protegida para percentuais; devolve null em vez de NaN/Infinity. */
export function percentual(parte: number | null, total: number | null): number | null {
  if (parte === null || total === null || total === 0) return null;
  const p = (parte / total) * 100;
  return Number.isFinite(p) ? Math.round(p * 100) / 100 : null;
}

/** Fetch com timeout — nenhuma fonte externa pode pendurar a geração do PDF. */
export async function fetchJson<T>(url: string, opts: { timeoutMs?: number; init?: RequestInit } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, {
      ...opts.init,
      signal: controller.signal,
      headers: { accept: "application/json", ...(opts.init?.headers ?? {}) },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
