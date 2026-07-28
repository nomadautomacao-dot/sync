import type {
  CensoEscolar,
  CronogramaVAAF,
  FonteColetaStatus,
  IDEBDado,
  MunicipioIdentificacao,
  ObraPAC2,
  PerfilComercialFundeb,
  ProjecaoRochaPrime,
  ReceitasFundeb,
  RelatorioFundeb,
  RepassePDDE,
  SistemaHabilitacao,
  UpsideCondicionadoFundeb,
  VeiculoCaminhoEscola,
} from "../types";
import { buildFundebStateLayer } from "@/core/lib/fundeb-state-layer";

const PERCENTUAIS_MENSAIS = [
  { mes: "Janeiro", pct: 0.059 },
  { mes: "Fevereiro", pct: 0.065 },
  { mes: "Março", pct: 0.071 },
  { mes: "Abril", pct: 0.076 },
  { mes: "Maio", pct: 0.082 },
  { mes: "Junho", pct: 0.088 },
  { mes: "Julho", pct: 0.088 },
  { mes: "Agosto", pct: 0.094 },
  { mes: "Setembro", pct: 0.094 },
  { mes: "Outubro", pct: 0.094 },
  { mes: "Novembro", pct: 0.094 },
  { mes: "Dezembro", pct: 0.094 },
] as const;

const IDEB_YEARS = [2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023] as const;

export function validarCodigoIBGE(codigo: string) {
  return /^\d{6,7}$/.test(codigo.replace(/\D/g, ""));
}

export function normalizarIBGE(codigo: string) {
  const digits = codigo.replace(/\D/g, "");
  return digits.length === 7 ? digits.slice(0, 6) : digits;
}

export function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) {
    return 0;
  }

  const normalized = value
    .toString()
    .trim()
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number) {
  const signal = value > 0 ? "+" : "";
  return `${signal}${value.toFixed(2)}%`;
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function calcularReceitas(receitas: Partial<ReceitasFundeb>): ReceitasFundeb {
  const receitaContribuicaoMunicipal = toNumber(receitas.receitaContribuicaoMunicipal);
  const complementacaoVAAF = toNumber(receitas.complementacaoVAAF);
  const complementacaoVAAT = toNumber(receitas.complementacaoVAAT);
  const complementacaoVAAR = toNumber(receitas.complementacaoVAAR);

  return {
    receitaContribuicaoMunicipal,
    complementacaoVAAF,
    complementacaoVAAT,
    complementacaoVAAR,
    totalReceitas:
      receitaContribuicaoMunicipal + complementacaoVAAF + complementacaoVAAT + complementacaoVAAR,
  };
}

function calcularProjecao(receitas: ReceitasFundeb): ProjecaoRochaPrime {
  const possuiComplementacao =
    receitas.complementacaoVAAF > 0 || receitas.complementacaoVAAT > 0 || receitas.complementacaoVAAR > 0;

  const vaafProjetado = receitas.complementacaoVAAF > 0 ? receitas.complementacaoVAAF * 1.4 : 0;
  const vaatProjetado = receitas.complementacaoVAAT > 0 ? receitas.complementacaoVAAT * 1.3 : 0;
  const vaarProjetado = receitas.complementacaoVAAR > 0 ? receitas.complementacaoVAAR * 1.25 : 0;
  const totalProjetado =
    receitas.receitaContribuicaoMunicipal + vaafProjetado + vaatProjetado + vaarProjetado;
  const totalGanho = totalProjetado - receitas.totalReceitas;
  const componentesZerados = [
    receitas.complementacaoVAAF <= 0 ? "VAAF" : null,
    receitas.complementacaoVAAT <= 0 ? "VAAT" : null,
  ].filter(Boolean);

  return {
    vaafAtual: receitas.complementacaoVAAF,
    vaafProjetado,
    vaafGanho: vaafProjetado - receitas.complementacaoVAAF,
    vaatAtual: receitas.complementacaoVAAT,
    vaatProjetado,
    vaatGanho: vaatProjetado - receitas.complementacaoVAAT,
    vaarAtual: receitas.complementacaoVAAR,
    vaarProjetado,
    vaarGanho: vaarProjetado - receitas.complementacaoVAAR,
    totalAtual: receitas.totalReceitas,
    totalProjetado,
    totalGanho,
    ganhoPercentual: receitas.totalReceitas > 0 ? (totalGanho / receitas.totalReceitas) * 100 : 0,
    possuiComplementacao,
    metodologia:
      "Projeção recuperável por componentes já evidenciados nas bases oficiais. Componentes zerados não foram monetizados nesta rodada.",
    multiplicadorAplicado: receitas.totalReceitas > 0 ? totalProjetado / receitas.totalReceitas : null,
    natureza: "recuperavel",
    ressalva:
      componentesZerados.length > 0
        ? `${componentesZerados.join(" e ")} zerados foram tratados como potencial condicionado, sem monetizacao direta.`
        : null,
  };
}

export function calcularProjecaoPorMultiplicador(
  receitas: ReceitasFundeb,
  multiplicador: number,
  metodologia = "Benchmark comercial por score de potencial.",
  options?: {
    perfilComercial?: PerfilComercialFundeb | null;
  },
): ProjecaoRochaPrime {
  const totalAtual = receitas.totalReceitas;
  const totalProjetado = totalAtual * multiplicador;
  const totalGanho = totalProjetado - totalAtual;
  const vaafProjetado = receitas.complementacaoVAAF * multiplicador;
  const vaatProjetado = receitas.complementacaoVAAT * multiplicador;
  const vaarProjetado = calcularVaarProjetadoPotencial(
    receitas,
    totalProjetado,
    multiplicador,
    options?.perfilComercial ?? null,
  );
  const possuiVaarPotencial = receitas.complementacaoVAAR <= 0 && vaarProjetado > 0;

  return {
    vaafAtual: receitas.complementacaoVAAF,
    vaafProjetado,
    vaafGanho: receitas.complementacaoVAAF * (multiplicador - 1),
    vaatAtual: receitas.complementacaoVAAT,
    vaatProjetado,
    vaatGanho: receitas.complementacaoVAAT * (multiplicador - 1),
    vaarAtual: receitas.complementacaoVAAR,
    vaarProjetado,
    vaarGanho: vaarProjetado - receitas.complementacaoVAAR,
    totalAtual,
    totalProjetado,
    totalGanho,
    ganhoPercentual: totalAtual > 0 ? (totalGanho / totalAtual) * 100 : 0,
    possuiComplementacao:
      receitas.complementacaoVAAF > 0 || receitas.complementacaoVAAT > 0 || receitas.complementacaoVAAR > 0,
    metodologia: possuiVaarPotencial
      ? `${metodologia} Inclui potencial prospectivo de VAAR condicionado a melhoria de condicionalidades e desempenho.`
      : metodologia,
    multiplicadorAplicado: multiplicador,
    natureza: "benchmark",
    ressalva: "Benchmark interno de teto comercial. Não deve ser tratado como ganho recuperável sem validação documental.",
  };
}

function calcularUpsideCondicionado(
  projecaoRecuperavel: ProjecaoRochaPrime,
  projecaoComercial: ProjecaoRochaPrime | null,
  perfilComercial: PerfilComercialFundeb | null,
  receitas: ReceitasFundeb,
): UpsideCondicionadoFundeb | null {
  if (!projecaoComercial) {
    return null;
  }

  const ganhoAdicional = Math.max(0, projecaoComercial.totalProjetado - projecaoRecuperavel.totalProjetado);
  if (ganhoAdicional <= 0) {
    return null;
  }

  const vetores: string[] = [];
  if (receitas.complementacaoVAAT <= 0 && perfilComercial?.regularizacaoPendente) {
    vetores.push("regularização administrativa de habilitação VAAT e saneamento SIOPE/MSC");
  } else if (receitas.complementacaoVAAT <= 0) {
    vetores.push("reavaliação de elegibilidade VAAT em rodada futura");
  }
  if (receitas.complementacaoVAAF <= 0) {
    vetores.push("conferência de matrículas ponderadas e redistribuição intraestadual do VAAF");
  }
  if (receitas.complementacaoVAAR <= 0 || perfilComercial?.regularizacaoPendente) {
    vetores.push("condicionalidades de desempenho e regularidade informacional para VAAR");
  }

  return {
    totalProjetado: projecaoComercial.totalProjetado,
    ganhoAdicional,
    ganhoPercentual:
      projecaoRecuperavel.totalAtual > 0 ? (ganhoAdicional / projecaoRecuperavel.totalAtual) * 100 : 0,
    metodologia:
      "Upside condicionado derivado do benchmark interno Global Sync. Requer validação documental, regularização sistêmica e eventual recálculo oficial.",
    vetores:
      vetores.length > 0
        ? vetores
        : ["validação documental e auditoria ampliada das bases do FUNDEB"],
  };
}

function calcularVaarProjetadoPotencial(
  receitas: ReceitasFundeb,
  totalProjetado: number,
  multiplicador: number,
  perfil: PerfilComercialFundeb | null,
) {
  if (receitas.complementacaoVAAR > 0) {
    return receitas.complementacaoVAAR * multiplicador;
  }

  if (!perfil || totalProjetado <= 0) {
    return 0;
  }

  const educacaoInfantil = perfil.educacaoInfantilMunicipalPorHabitante ?? 0;
  const creche = perfil.crecheMunicipalPorHabitante ?? 0;
  const iei = perfil.ieiPercentual ?? 0;

  let pct =
    0.0035 +
    normalize(educacaoInfantil, 1, 6) * 0.0035 +
    normalize(creche, 0.3, 2.5) * 0.003 +
    normalize(iei, 0.5, 3.5) * 0.002;

  if (perfil.faixa === "agressivo") {
    pct += 0.001;
  } else if (perfil.faixa === "padrao") {
    pct += 0.0005;
  }

  if (perfil.vaatPercentualTotal >= 8) {
    pct += 0.0005;
  }

  if (perfil.regularizacaoPendente) {
    pct -= 0.0015;
  } else {
    pct += 0.0005;
  }

  pct = clamp(pct, 0.0025, 0.015);
  return round2(totalProjetado * pct);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: number | null, min: number, max: number) {
  if (value === null || !Number.isFinite(value)) {
    return 0;
  }

  if (max <= min) {
    return 0;
  }

  return clamp((value - min) / (max - min), 0, 1);
}

interface PerfilComercialInput {
  uf: string;
  totalReceitas: number;
  complementacaoVAAT: number;
  populacaoEstimada: number | null;
  receitasBrutasMunicipais: number | null;
  matriculasMunicipais: number;
  escolasMunicipais: number;
  educacaoInfantilMunicipal: number;
  crecheMunicipal: number;
  preEscolaMunicipal: number;
  habilitacaoVaat: string;
  pendenciaVaat: string | null;
  ieiPercentual: number | null;
}

export function calcularPerfilComercialFundeb(input: PerfilComercialInput): PerfilComercialFundeb {
  const camadaEstadual = buildFundebStateLayer({
    uf: input.uf,
    totalReceitas: input.totalReceitas,
    complementacaoVAAT: input.complementacaoVAAT,
    populacaoEstimada: input.populacaoEstimada,
    matriculasMunicipais: input.matriculasMunicipais,
  });
  const fundebPerCapita =
    input.populacaoEstimada && input.populacaoEstimada > 0
      ? input.totalReceitas / input.populacaoEstimada
      : null;
  const dependenciaFundebReceita =
    input.receitasBrutasMunicipais && input.receitasBrutasMunicipais > 0
      ? input.totalReceitas / input.receitasBrutasMunicipais
      : null;
  const matriculasMunicipaisPorHabitante =
    input.populacaoEstimada && input.populacaoEstimada > 0
      ? input.matriculasMunicipais / input.populacaoEstimada
      : null;
  const educacaoInfantilMunicipalPorHabitante =
    input.populacaoEstimada && input.populacaoEstimada > 0
      ? input.educacaoInfantilMunicipal / input.populacaoEstimada
      : null;
  const crecheMunicipalPorHabitante =
    input.populacaoEstimada && input.populacaoEstimada > 0
      ? input.crecheMunicipal / input.populacaoEstimada
      : null;
  const vaatPercentualTotal =
    input.totalReceitas > 0 ? (input.complementacaoVAAT / input.totalReceitas) * 100 : 0;
  const regularizacaoPendente =
    Boolean(input.pendenciaVaat) || /inobservancia|inabilitado|nao transmitiu/i.test(input.habilitacaoVaat);
  const currentPerStudent =
    input.matriculasMunicipais > 0 ? input.totalReceitas / input.matriculasMunicipais : null;
  const multiplicadorAncora =
    input.totalReceitas > 0 && input.matriculasMunicipais > 0
      ? (input.totalReceitas + 32_819_561.426 + input.matriculasMunicipais * 4_173.359311) / input.totalReceitas
      : 1.7209;
  const pequenoPorte = input.matriculasMunicipais < 12_000 && input.totalReceitas < 90_000_000 && vaatPercentualTotal < 1;
  const grandePorteVaat = vaatPercentualTotal >= 10 && input.totalReceitas >= 300_000_000 && input.matriculasMunicipais >= 35_000;
  const metropolitanoComprimidoVaat =
    (input.populacaoEstimada ?? 0) >= 400_000 &&
    (input.populacaoEstimada ?? 0) <= 600_000 &&
    vaatPercentualTotal >= 8 &&
    input.totalReceitas >= 200_000_000 &&
    input.totalReceitas <= 400_000_000 &&
    (matriculasMunicipaisPorHabitante ?? 0) <= 0.085;
  const escalaMetropolitanaSemVaat =
    (input.populacaoEstimada ?? 0) >= 800_000 &&
    vaatPercentualTotal < 1 &&
    input.totalReceitas >= 500_000_000 &&
    input.matriculasMunicipais >= 70_000;

  let multiplicador: number;
  let regimeComercial:
    | "pequeno-porte"
    | "matriculas"
    | "grande-porte-vaat"
    | "metropolitano-comprimido-vaat"
    | "escala-metropolitana-sem-vaat";
  if (metropolitanoComprimidoVaat) {
    multiplicador =
      1.305 -
      normalize(vaatPercentualTotal, 8, 18) * 0.045 -
      normalize(input.totalReceitas, 220_000_000, 380_000_000) * 0.01 -
      normalize(input.populacaoEstimada, 430_000, 540_000) * 0.012;
    regimeComercial = "metropolitano-comprimido-vaat";
  } else if (escalaMetropolitanaSemVaat) {
    multiplicador =
      1.84 +
      normalize(input.matriculasMunicipais, 70_000, 80_000) * 0.025 +
      normalize(input.totalReceitas, 500_000_000, 600_000_000) * 0.015 +
      normalize(input.populacaoEstimada, 800_000, 900_000) * 0.005;
    regimeComercial = "escala-metropolitana-sem-vaat";
  } else if (pequenoPorte) {
    multiplicador =
      1.747 +
      normalize(input.matriculasMunicipais, 8_000, 12_000) * 0.009 +
      normalize(input.totalReceitas, 60_000_000, 90_000_000) * 0.006;
    regimeComercial = "pequeno-porte";
  } else if (grandePorteVaat) {
    const totalNorm = normalize(input.totalReceitas, 300_000_000, 550_000_000);
    const studentNorm = normalize(input.matriculasMunicipais, 35_000, 65_000);
    const currentPerStudentNorm = normalize(currentPerStudent, 8_000, 9_000);
    multiplicador =
      1.75 +
      totalNorm * 0.015 +
      studentNorm * 0.01 +
      currentPerStudentNorm * 0.01 +
      (1 - totalNorm) * 0.07;
    regimeComercial = "grande-porte-vaat";
  } else {
    multiplicador = clamp(multiplicadorAncora, 1.68, 1.79);
    regimeComercial = "matriculas";
  }

  const clampMin =
    regimeComercial === "metropolitano-comprimido-vaat"
      ? 1.22
      : 1.68;
  const clampMax =
    regimeComercial === "escala-metropolitana-sem-vaat"
      ? 1.88
      : 1.83;

  multiplicador = clamp(multiplicador, clampMin, clampMax);
  multiplicador += camadaEstadual.ajusteMultiplicadorAplicado;
  multiplicador = clamp(multiplicador, clampMin, clampMax);

  let score =
    normalize(multiplicador, 1.22, 1.88) * 42 +
    normalize(input.matriculasMunicipais, 15_000, 40_000) * 18 +
    normalize(matriculasMunicipaisPorHabitante, 0.06, 0.17) * 14 +
    normalize(educacaoInfantilMunicipalPorHabitante, 0.01, 0.04) * 10 +
    normalize(crecheMunicipalPorHabitante, 0.003, 0.018) * 8 +
    normalize(input.escolasMunicipais, 40, 180) * 4 +
    (1 - normalize(dependenciaFundebReceita, 0.1, 0.3)) * 4;

  if (regularizacaoPendente) {
    score += 4;
  }

  score = clamp(score, 0, 100);

  let faixa: PerfilComercialFundeb["faixa"];
  if (multiplicador < 1.68) {
    faixa = "conservador";
  } else if (multiplicador < 1.75) {
    faixa = "padrao";
  } else {
    faixa = "agressivo";
  }

  const fatores: string[] = [];
  if (regimeComercial === "pequeno-porte") {
    fatores.push("regime comercial de pequeno porte");
  } else if (regimeComercial === "metropolitano-comprimido-vaat") {
    fatores.push("regime comercial metropolitano com VAAT comprimido");
  } else if (regimeComercial === "escala-metropolitana-sem-vaat") {
    fatores.push("regime comercial de escala metropolitana sem VAAT relevante");
  } else if (regimeComercial === "grande-porte-vaat") {
    fatores.push("regime comercial de grande porte com VAAT relevante");
  } else if (input.matriculasMunicipais > 0) {
    fatores.push("ancora comercial baseada em matriculas municipais");
  }
  if ((matriculasMunicipaisPorHabitante ?? 0) >= 0.12) {
    fatores.push("rede municipal intensa para o porte populacional");
  }
  if ((educacaoInfantilMunicipalPorHabitante ?? 0) >= 0.025) {
    fatores.push("peso relevante de educação infantil na rede municipal");
  }
  if ((crecheMunicipalPorHabitante ?? 0) >= 0.01) {
    fatores.push("atendimento expressivo em creche");
  }
  if ((fundebPerCapita ?? 0) >= 900) {
    fatores.push("fundeb per capita acima da media observada");
  }
  if (vaatPercentualTotal >= 8) {
    fatores.push("presenca material de VAAT na composicao do fundo");
  }
  if (regularizacaoPendente) {
    fatores.push("potencial condicionado à regularização de pendências");
  }
  if (fatores.length === 0) {
    fatores.push("benchmark comercial calibrado por faixa estreita de multiplicador");
  }

  const indicadoresDisponiveis = [
    fundebPerCapita,
    dependenciaFundebReceita,
    matriculasMunicipaisPorHabitante,
    educacaoInfantilMunicipalPorHabitante,
    crecheMunicipalPorHabitante,
    input.ieiPercentual,
  ].filter((item) => item !== null).length;

  return {
    score: round2(score),
    faixa,
    multiplicador: round2(multiplicador),
    confianca: round2(clamp(0.55 + indicadoresDisponiveis * 0.06, 0.55, 0.91)),
    metodologia:
      regimeComercial === "metropolitano-comprimido-vaat"
        ? "Benchmark comercial metropolitano com compressao por VAAT, porte populacional e baixa intensidade relativa da rede."
        : regimeComercial === "escala-metropolitana-sem-vaat"
          ? "Benchmark comercial de grande escala sem VAAT relevante, priorizando rede municipal, volume absoluto do fundo e porte populacional."
      : regimeComercial === "grande-porte-vaat"
        ? "Benchmark comercial com faixa ampliada para municípios de grande porte com VAAT relevante."
        : regimeComercial === "pequeno-porte"
          ? "Benchmark comercial ajustado para municípios de pequeno porte, preservando a aderência dos legados."
          : "Benchmark comercial ancorado por matrículas municipais, com multiplicador-base próximo de 1.7209x e ajuste fino por intensidade da rede, educação infantil e contexto VAAT.",
    fatores,
    populacaoEstimada: input.populacaoEstimada,
    receitasBrutasMunicipais: input.receitasBrutasMunicipais,
    fundebPerCapita: fundebPerCapita ? round2(fundebPerCapita) : null,
    dependenciaFundebReceita: dependenciaFundebReceita ? round2(dependenciaFundebReceita * 100) : null,
    matriculasMunicipais: input.matriculasMunicipais,
    escolasMunicipais: input.escolasMunicipais,
    educacaoInfantilMunicipal: input.educacaoInfantilMunicipal,
    crecheMunicipal: input.crecheMunicipal,
    preEscolaMunicipal: input.preEscolaMunicipal,
    matriculasMunicipaisPorHabitante: matriculasMunicipaisPorHabitante
      ? round2(matriculasMunicipaisPorHabitante * 100)
      : null,
    educacaoInfantilMunicipalPorHabitante: educacaoInfantilMunicipalPorHabitante
      ? round2(educacaoInfantilMunicipalPorHabitante * 100)
      : null,
    crecheMunicipalPorHabitante: crecheMunicipalPorHabitante ? round2(crecheMunicipalPorHabitante * 100) : null,
    vaatPercentualTotal: round2(vaatPercentualTotal),
    ieiPercentual: input.ieiPercentual,
    habilitacaoVaat: input.habilitacaoVaat,
    pendenciaVaat: input.pendenciaVaat,
    regularizacaoPendente,
    camadaEstadual,
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function calcularCronogramaVAAF(vaafProjetado: number, totalFundeb: number): CronogramaVAAF[] {
  if (vaafProjetado <= 0 || totalFundeb <= 0) {
    return [];
  }

  const baseVAAF = vaafProjetado;

  return PERCENTUAIS_MENSAIS.map((item) => ({
    mes: item.mes,
    valorProjetado: baseVAAF * item.pct,
    percentual: item.pct * 100,
  }));
}

function createDefaultSistemas(): SistemaHabilitacao[] {
  return [
    { instituicao: "MEC", sistema: "SIMEC", situacao: "Nao informado" },
    { instituicao: "FNDE", sistema: "Habilita", situacao: "Nao informado" },
    { instituicao: "FNDE", sistema: "SIGARPWEB", situacao: "Nao informado" },
    { instituicao: "FNDE", sistema: "SIGPC", situacao: "Nao informado" },
  ];
}

function createDefaultObrasPAC2(): ObraPAC2[] {
  return [
    {
      tipo: "Creches e pre-escolas",
      aprovadas: null,
      execucao: null,
      canceladas: null,
      concluidas: null,
      total: null,
    },
    {
      tipo: "Construcao de quadras esportivas",
      aprovadas: null,
      execucao: null,
      canceladas: null,
      concluidas: null,
      total: null,
    },
  ];
}

function createDefaultCaminhoEscola(): VeiculoCaminhoEscola[] {
  return [
    { tipo: "Onibus escolar", quantidade: null, valor: null },
    { tipo: "Embarcacao escolar", quantidade: null, valor: null },
  ];
}

function createDefaultPdde(): RepassePDDE[] {
  return [2011, 2012, 2013, 2014, 2015].map((ano) => ({ ano, valor: 0 }));
}

function createDefaultIdebSeries(): IDEBDado[] {
  return IDEB_YEARS.map((ano) => ({
    ano,
    metaProjetada: null,
    idebVerificado: null,
  }));
}

export function createEmptyCensoEscolar(): CensoEscolar {
  return {
    totalEscolas: 0,
    totalMatriculas: 0,
    totalDocentes: 0,
    fonte: "INEP Censo Escolar",
    anoReferencia: null,
    recorte: "publica",
    matriculasEtapa: {
      educacaoInfantil: 0,
      ensinoFundamental: 0,
      ensinoMedio: 0,
      eja: 0,
      educacaoEspecial: 0,
    },
    matriculasDetalhadas: {
      creche: 0,
      preEscola: 0,
      anosIniciais: 0,
      anosFinais: 0,
    },
    tempoIntegral: {
      total: null,
      educacaoInfantil: null,
      creche: null,
      preEscola: null,
      anosIniciais: null,
      anosFinais: null,
      ensinoFundamental: null,
      ensinoMedio: null,
      eja: null,
      educacaoEspecial: null,
    },
    docentesCiclo: {
      fundamentalIniciaisFinais: 0,
      ensinoMedio: 0,
    },
  };
}

export function createDefaultFontes(): FonteColetaStatus[] {
  return [
    {
      id: "ibge",
      label: "IBGE",
      status: "automatico",
      descricao: "Municipio, UF e recortes regionais carregados automaticamente.",
    },
    {
      id: "fnde-siconfi",
      label: "FNDE / SICONFI",
      status: "manual",
      descricao: "Receitas FUNDEB preparadas para edicao manual ate integracao da base anual.",
    },
    {
      id: "simec",
      label: "MEC / FNDE Operacional",
      status: "manual",
      descricao: "Sistemas, PAR e blocos operacionais seguem em fallback ate integracao das consultas publicas e acessos restritos.",
    },
    {
      id: "inep-qedu",
      label: "INEP / QEdu",
      status: "manual",
      descricao: "Censo Escolar e IDEB com placeholders estruturados para carga futura.",
    },
    {
      id: "pdde-fnde",
      label: "PDDE / FNDE",
      status: "manual",
      descricao: "PDDE Info ainda não consolidado automaticamente neste município.",
    },
  ];
}

export function hydrateRelatorioFundeb(input: Partial<RelatorioFundeb> & { identificacao: MunicipioIdentificacao }) {
  const receitas = calcularReceitas(input.receitas ?? {});
  const projecao = calcularProjecao(receitas);
  const projecaoRecuperavel = input.projecaoRecuperavel ?? input.projecao ?? projecao;
  const projecaoPrincipal = input.projecaoComercial ?? projecaoRecuperavel;
  const upsideCondicionado =
    input.upsideCondicionado ?? calcularUpsideCondicionado(projecaoRecuperavel, input.projecaoComercial ?? null, input.perfilComercial ?? null, receitas);

  return {
    geradoEm: input.geradoEm ?? formatDateTime(new Date()),
    identificacao: input.identificacao,
    ...(input.parametros ? { parametros: input.parametros } : {}),
    receitas,
    // Espelha `RelatorioFundeb.activeProjection` do Dart:
    // `projecaoComercial ?? projecaoRecuperavel`. A camada comercial (benchmark
    // por score) é a manchete do relatório; a recuperável fica exposta ao lado
    // como "já evidenciada nas bases oficiais".
    projecao: input.projecao ?? projecaoPrincipal,
    projecaoRecuperavel,
    projecaoComercial: input.projecaoComercial ?? null,
    upsideCondicionado,
    perfilComercial: input.perfilComercial ?? null,
    cronogramaVAAF:
      input.cronogramaVAAF ??
      calcularCronogramaVAAF(projecaoPrincipal.vaafProjetado, receitas.totalReceitas),
    sistemas: input.sistemas ?? createDefaultSistemas(),
    obrasPAC2: input.obrasPAC2 ?? createDefaultObrasPAC2(),
    situacaoPAR: input.situacaoPAR ?? "Nao informado",
    caminhoEscola: input.caminhoEscola ?? createDefaultCaminhoEscola(),
    pdde: input.pdde ?? createDefaultPdde(),
    observacoesOperacionais: input.observacoesOperacionais ?? [],
    idebAnosIniciais: input.idebAnosIniciais ?? createDefaultIdebSeries(),
    idebAnosFinais: input.idebAnosFinais ?? createDefaultIdebSeries(),
    idebEnsinoMedio: input.idebEnsinoMedio ?? [],
    censoEscolar: input.censoEscolar ?? createEmptyCensoEscolar(),
  } satisfies RelatorioFundeb;
}
