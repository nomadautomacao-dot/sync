import type {
  Indicador,
  MunicipalProfile,
} from "./municipal-profile/types";
import { ROTULOS_STATUS } from "./municipal-profile/types";
import { levantarAchados, varreduraLimpa, TIERS } from "./municipal-xray-achados";
import { analisarDispersao } from "./densidade-rede";
import { getTerrasIndigenas } from "./terras-indigenas";
import { getCoberturaVacinal, getViolenciaInfantil } from "./saude-escolar";
import { getTrabalhoInfantil } from "./trabalho-infantil";
import { projectToBoundary, type MunicipalBoundaryMap } from "./ibge-municipal-boundary";

type JsonRecord = Record<string, unknown>;

export interface MunicipalXrayModel {
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
  /** Ano da observação do IDEB. Sem ele o leitor não sabe de quando é o dado. */
  idebYear: number | null;
  /**
   * `true` quando o parâmetro exibido é a referência **nacional**. O INEP
   * projetou metas por rede apenas até 2021, então a partir de 2023 não existe
   * "meta do município" — chamar a referência nacional de meta afirma um
   * compromisso que o INEP não publicou.
   */
  idebTargetIsNational: boolean;
  /**
   * A série do IDEB da rede, mais antiga primeiro. O número isolado do último
   * ano não distingue rede que subiu de rede que caiu para o mesmo lugar — e é
   * a trajetória que a Condicionalidade I do VAAR observa.
   */
  idebSeries: Array<{ year: number; initial: number | null; final: number | null }>;
  /** Ano de referência do PIB per capita, como o IBGE devolve (texto). */
  pibYear: string;
  /**
   * Composição da rede por cor/raça e condições que a portaria do FUNDEB
   * pondera acima da matrícula urbana comum (campo, indígena, quilombola).
   */
  equity: {
    censusYear: number | null;
    total: number;
    black: number;
    blackShare: number | null;
    indigenous: number;
    undeclaredShare: number | null;
    fragileRegistry: boolean;
    ruralSchools: number;
    indigenousSchools: number;
    quilomboSchools: number;
    settlementSchools: number;
  } | null;
  /**
   * Situação na complementação VAAR. É a única parcela do FUNDEB perdida por
   * inteiro quando o município reprova numa condicionalidade — e por isso a
   * única cuja ausência tem causa nomeável e agenda de correção.
   */
  vaar: {
    year: number | null;
    qualified: boolean;
    beneficiary: boolean;
    amount: number;
    failed: string[];
    stateWideFailure: boolean;
    stateMedian: number | null;
    stateQualified: number;
    stateAssessed: number;
    /**
     * Texto de pendência publicado pelo FNDE, verbatim. É a resposta oficial
     * para "por que perdemos o VAAR" — e nenhum dos 22 textos publicados em
     * 2026 é fiscal: todos citam condicionalidades do art. 14, §1º ou ausência
     * de evolução nos indicadores.
     */
    pendency: string | null;
  } | null;
  /**
   * Habilitação ao VAAT. A condição é uma só e é **fiscal** (art. 13, §4º):
   * dados contábeis no Siconfi e no SIOPE até 31 de agosto. É a parcela que
   * uma pendência fiscal realmente derruba — quem atribui ao VAAR uma perda
   * fiscal está falando do VAAT sem saber.
   */
  vaat: {
    year: number | null;
    status: string;
    /** Pendência fiscal registrada pelo FNDE quando a habilitação falhou. */
    pendency: string | null;
    perStudent: number | null;
    minimum: number | null;
    complement: number | null;
    distancePct: number | null;
    revenueBaseYear: number | null;
  } | null;
  /** Matrícula ponderada — o denominador real da receita do fundo. */
  weighting: {
    enrollment: number;
    weighted: number;
    avgFactor: number | null;
  } | null;
  /**
   * Ganho apurado — fator legal × valor aluno/ano da UF × matrícula declarada,
   * ancorado na mediana nacional. Ver `core/lib/fundeb-ganho-apurado.ts`.
   */
  gain: {
    total: number;
    perEquivalent: number;
    components: Array<{ key: string; title: string; value: number; origin: string; verify: string }>;
    references: Array<{ key: string; title: string; value: number; origin: string; verify: string }>;
  } | null;
  /** As vinculações da educação como o SIOPE as apura — as 14, não só MDE e 70%. */
  siope: {
    year: number | null;
    stale: boolean;
    indicators: Array<{
      label: string;
      value: number;
      unit: "percentual" | "reais";
      limit: number | null;
      direction: "min" | "max" | null;
      compliant: boolean | null;
      slack: number | null;
      basis: string | null;
    }>;
    /** O que o catálogo prevê e o município não declarou — ver `siope-indicadores.ts`. */
    undeclared: Array<{ cod: string; label: string }>;
  } | null;
  /**
   * Gêmeos estatísticos — percentil entre municípios de rede do mesmo porte.
   * Ver `core/lib/municipios-gemeos.ts`.
   */
  twins: {
    enrollment: number;
    rangeMin: number;
    rangeMax: number;
    cohortSize: number;
    vaarCohortPct: number | null;
    vaarQualified: boolean | null;
    indicators: Array<{
      key: string;
      label: string;
      unit: "percentual" | "reais" | "fator" | "indice";
      value: number;
      cohortMedian: number;
      stateMedian: number | null;
      percentile: number;
      direction: "maior-melhor" | "menor-melhor" | "neutro";
    }>;
  } | null;
  /**
   * Pontualidade das entregas no Siconfi — preditor da habilitação VAAT.
   * Ver `core/lib/siconfi-entregas.ts`.
   */
  fiscalTimeliness: {
    risk: "alto" | "medio" | "baixo";
    dca: Array<{
      year: number;
      deliveredAt: string | null;
      daysPastDue: number | null;
      missedVaatCutoff: boolean | null;
    }>;
  } | null;
  /**
   * Saeb/IDEB por escola — via identificada do INEP. `nd` = resultado retido
   * por participação abaixo de 80%, o rastro da Cond. II do VAAR.
   */
  schoolResults: {
    year: number;
    list: Array<{
      code: string;
      name: string;
      idebAi: number | null;
      saebAi: number | null;
      idebAf: number | null;
      saebAf: number | null;
      nd: boolean;
    }>;
    total: number;
    ndCount: number;
    worstAi: number | null;
    bestAi: number | null;
    rangeAi: number | null;
  } | null;
  /**
   * Contexto por escola — INSE, complexidade de gestão, distorção, abandono
   * e adequação docente (INEP), com o cruzamento contexto × resultado.
   * Ver `core/lib/indicadores-escolas.ts`.
   */
  schoolContext: {
    years: { inse: number; icg: number; tdi: number; rendimento: number; afd: number };
    /** Média INSE da rede, ponderada pelos respondentes. */
    networkInse: number | null;
    schools: Array<{
      code: string;
      name: string;
      inseLevel: number | null;
      icg: number | null;
      tdi: number | null;
      approval: number | null;
      dropout: number | null;
      adequateTeachers: number | null;
    }>;
    total: number;
    dropoutCount: number;
    worstDropout: { name: string; value: number } | null;
    worstTdi: { name: string; value: number } | null;
    avgAdequateTeachers: number | null;
    crossover: {
      evaluated: number;
      medianInse: number;
      medianIdeb: number;
      resilient: { name: string; inse: number; ideb: number } | null;
      alert: { name: string; inse: number; ideb: number } | null;
    } | null;
  } | null;
  /**
   * Distribuição de proficiência do Saeb (rede municipal) — % por grupo
   * qualitativo em LP/MT, 5º e 9º ano. Ver `core/lib/saeb-distribuicao.ts`.
   */
  proficiency: {
    year: number;
    series: Array<{
      key: string;
      label: string;
      media: number;
      insufficient: number;
      basic: number;
      proficient: number;
      advanced: number;
    }>;
  } | null;
  /**
   * Violência letal no território (Atlas da Violência) — contexto explicativo
   * do que as páginas educacionais mostram. Ver `core/lib/violencia-municipal.ts`.
   */
  violence: {
    national: { year: number; rate: number } | null;
    series: Array<{ year: number; total: number | null; youth: number | null; rate: number | null }>;
    latest: { year: number; total: number | null; youth: number | null; rate: number | null };
    youthSharePct: number | null;
    rateTrendPct: number | null;
    aboveNational: boolean | null;
  } | null;
  /**
   * Escolas no território — coordenadas e localização diferenciada, para o
   * mapa da rede. Ver `core/lib/escolas-territorio.ts`.
   */
  schoolMap: {
    year: number;
    schools: Array<{
      codigo: string;
      lat: number | null;
      lng: number | null;
      rural: boolean;
      dif: number;
      matriculas: number | null;
    }>;
    total: number;
    withCoords: number;
    ruralCount: number;
    byDiferenciada: Record<string, number>;
    transportStudents: number;
    transportPct: number | null;
    /** Cor/raça em números absolutos na rede inteira — o elo do meio entre a
     * população do Censo Demográfico e o segmento ponderado do FUNDEB. */
    raceTotals: {
      enrolled: number;
      indigenous: number;
      black: number;
      undeclared: number;
    } | null;
    /** Cor/raça por zona — % negra (preta+parda), indígena e não declarada. */
    race: {
      urban: { enrolled: number; blackPct: number | null; indigenousPct: number | null; undeclaredPct: number | null };
      rural: { enrolled: number; blackPct: number | null; indigenousPct: number | null; undeclaredPct: number | null };
    } | null;
  } | null;
  /**
   * População urbana × rural do Censo 2022 — o denominador da dispersão.
   * Ver `core/lib/densidade-rede.ts`.
   */
  ruralPopulation: {
    year: number;
    urban: number;
    rural: number;
    total: number;
    ruralPct: number;
  } | null;
  /**
   * Estado nutricional das crianças de 5 a 10 anos (SISVAN) — o resultado
   * medido da política de merenda. Ver `core/lib/sisvan-nutricional.ts`.
   */
  nutrition: {
    year: number;
    followed: number;
    thinPct: number | null;
    healthyPct: number | null;
    excessPct: number | null;
    overweight: number;
    obese: number;
    severelyObese: number;
    statePct: number | null;
    countryPct: number | null;
  } | null;
  /**
   * Abstenção no ENEM (município de prova × UF) — termômetro de custo de
   * oportunidade. Ver `core/lib/enem-abstencao.ts`.
   */
  enem: {
    year: number;
    enrolled: number;
    absentPct: number;
    state: { code: string; absentPct: number } | null;
  } | null;
  /**
   * Obras FNDE em situação crítica (Pacto de Retomada) — dinheiro federal
   * contratado que não virou escola. Ver `core/lib/fnde-obras.ts`.
   */
  stalledWorks: {
    total: number;
    stalled: number;
    unfinished: number;
    resuming: number;
    stalledValue: number;
    repactValue: number | null;
    works: Array<{
      year: number | null;
      type: string;
      classification: string;
      status: string;
      estimate: number;
      executed: number;
    }>;
  } | null;
  /**
   * Dinheiro federal além do FUNDEB — emendas com aplicação carimbada no
   * município (dataset do Portal da Transparência), convênios com o ente e
   * sanções CEIS/CNEP (consulta viva). Roadmap #28, #29 (parcial), #31.
   */
  federalMoney: {
    emendas: {
      dataAsOf: string;
      years: Array<{
        year: number;
        count: number;
        committed: number;
        paid: number;
        eduCount: number;
        eduCommitted: number;
      }>;
      eduAuthors: Array<{ name: string; committed: number }>;
    } | null;
    convenios: {
      total: number;
      truncated: boolean;
      active: number;
      activeValue: number;
      activeReleased: number;
      eduActive: number;
      eduActiveValue: number;
      noRelease: number;
      top: Array<{ objeto: string; orgao: string; valor: number; fimVigencia: string | null }>;
    } | null;
    sanctions: {
      entity: Array<{ cadastro: string; sancionado: string; orgao: string; tipo: string; fimSancao: string | null }>;
      appliedByCity: number;
    } | null;
  } | null;
  /**
   * Precatório do FUNDEF — o que a União pagou por decisão judicial e o que a
   * EC nº 114/2021 amarrou a esse dinheiro. Roadmap #27.
   * Ver `core/lib/precatorio-fundef.ts`.
   */
  /**
   * Cobertura vacinal infantil (PNI) e violência notificada contra criança de
   * 5 a 14 anos (SINAN). Roadmap #37 e #9. Ver `core/lib/saude-escolar.ts`.
   */
  childHealth: {
    vaccination: {
      year: number;
      shots: Array<{ label: string; value: number; median: number | null; unreadable: boolean; belowMedian: boolean }>;
      belowMedian: number;
      unreadable: number;
    } | null;
    violence: {
      ageRange: string;
      series: Array<{ year: number; count: number }>;
      latest: { year: number; count: number } | null;
      total: number;
      totalSilence: boolean;
      reportingCities: number;
      citiesInCountry: number;
    } | null;
  } | null;
  /**
   * Crianças e adolescentes ocupados na semana de referência (Censo 2022),
   * nas duas faixas que o direito trata de forma diferente. Roadmap #15.
   * Ver `core/lib/trabalho-infantil.ts` — as faixas nunca são somadas.
   */
  childLabor: {
    censusYear: number;
    table: number;
    caveat: string;
    bands: Array<{
      label: string;
      population: number;
      occupied: number;
      ratePct: number | null;
      stateRatePct: number | null;
      countryRatePct: number | null;
      aboveState: boolean;
      aboveCountry: boolean;
      weakComparison: boolean;
      /** Falso na faixa de 10 a 13: não há hipótese legal de trabalho. */
      legalWorkPossible: boolean;
    }>;
    /** Nenhuma ocupação estimada em nenhuma faixa. */
    noneEstimated: boolean;
  } | null;
  /**
   * Aldeias registradas pela FUNAI e a distância delas até a rede. Roadmap #35.
   * Ver `core/lib/terras-indigenas.ts`.
   */
  indigenousLands: {
    villages: Array<{
      name: string;
      land: string;
      ethnicity: string;
      phase: string;
      kmToSchool: number | null;
      kmToIndigenousSchool: number | null;
    }>;
    lands: number;
    indigenousSchools: number;
    villagesWithoutIndigenousSchool: number;
    villagesWithoutAnySchool: number;
    radiusKm: number;
    registeredButUndeclared: boolean;
    villagesWithCoords: number;
  } | null;
  fundefWrit: {
    window: number[];
    missingYears: number[];
    received: boolean;
    years: Array<{ year: number; value: number; account: string; underEc114: boolean }>;
    total: number;
    underEc114: number;
    beforeEc114: number;
    /** 60% do que entrou sob a EC — o que a lei destina, não o que foi pago. */
    minimumBonus: number;
    remainderMde: number;
    firstYear: number | null;
    lastYear: number | null;
    notes: string[];
  } | null;
  /**
   * Indicador Criança Alfabetizada — resultado, meta pactuada do município e
   * participação. Ver `core/lib/alfabetizacao-municipal.ts`.
   */
  literacy: {
    series: Array<{ year: number; value: number; target: number | null; met: boolean | null }>;
    latest: { year: number; value: number; target: number | null; met: boolean | null };
    changePoints: number | null;
    nextTarget: { year: number; target: number; gapPoints: number } | null;
    finalTarget: { year: number; target: number; requiredPace: number } | null;
    observedPace: number | null;
    levelLabel: string | null;
    participation: number | null;
    fragileParticipation: boolean | null;
    state: { uf: string; value: number; year: number } | null;
  } | null;
  /**
   * Ciclo político — alternância na última eleição e posição do mandato no
   * calendário. Ver `core/lib/alternancia-politica.ts`.
   */
  politics: {
    current: { mayor: string; party: string; election: number };
    previous: { mayor: string; party: string; election: number } | null;
    status: "reeleicao" | "sucessao_mesmo_partido" | "alternancia" | "indeterminado";
    term: { start: number; end: number };
    nextElection: number;
    nationwide: { reelected: number; successions: number; alternations: number; total: number } | null;
  } | null;
  /**
   * CAUC — requisitos fiscais que a União checa antes de qualquer
   * transferência voluntária. Ver `core/lib/cauc-requisitos.ts`.
   */
  cauc: {
    queriedAt: string | null;
    pending: Array<{ code: string; label: string }>;
    pendingEducation: Array<{ code: string; label: string }>;
    proven: number;
    disabled: number;
    nextExpiry: { code: string; label: string; until: string } | null;
    nationwide: { withPending: number; total: number } | null;
  } | null;
  /**
   * Demografia educacional — população por faixa (Censo 2022) e coortes de
   * nascimento (Registro Civil). Ver `core/lib/demografia-educacional.ts`.
   */
  demographics: {
    crechePop: number;
    prePop: number;
    aiPop: number;
    afPop: number;
    births: Array<{ year: number; count: number; preYear: number; firstGradeYear: number }>;
    trendPct: number | null;
    /** Matrículas municipais de creche e pré, para a cobertura (piso). */
    crecheEnrollment: number | null;
    preEnrollment: number | null;
    /** Matrículas de todas as redes por faixa — a taxa de atendimento real. */
    totalEnrollment: {
      year: number;
      creche: number | null;
      pre: number | null;
      ai: number | null;
      af: number | null;
    } | null;
    /** Nascimentos de mães de até 19 anos no último ano da série. */
    teenMothers: { year: number; births: number; sharePct: number } | null;
  } | null;
  /**
   * População quilombola/indígena (Censo 2022) × matrículas nos segmentos do
   * FUNDEB. Ver `core/lib/equidade-territorial.ts`.
   */
  peoples: {
    quilombola: { pop: number; schoolAge: number; enrolled: number; ratio: number | null; flag: boolean };
    indigenous: { pop: number; schoolAge: number; enrolled: number; ratio: number | null; flag: boolean };
    factorMin: number;
    factorMax: number;
  } | null;
  /** Assentamentos INCRA — famílias e área, cruzados com as escolas declaradas. */
  settlements: {
    count: number;
    families: number;
    areaHa: number;
  } | null;
  /**
   * Frequência do PBF — o censo mensal da evasão (SICON/MDS).
   * Ver `core/lib/bolsa-familia-frequencia.ts`.
   */
  pbf: {
    period: string;
    audience: number;
    monitored: number;
    monitoredPct: number | null;
    notFound: number;
    notFoundPct: number | null;
    noInfo: number;
    attendanceOkPct: number | null;
    warnings: number;
    blocks: number;
    suspensions: number;
    familiesInSuspension: number;
  } | null;
  /**
   * VAB setorial + alfabetização — a economia que explica a evasão.
   * Ver `core/lib/economia-local.ts`.
   */
  economy: {
    pibYearRef: number | null;
    agro: number | null;
    industry: number | null;
    services: number | null;
    publicAdmin: number | null;
    dominant: "agropecuaria" | "industria" | "servicos" | "administracao" | null;
    /** Cultura de maior valor na PAM — a safra que compete com a aula. */
    crop: { name: string; sharePct: number | null; year: number | null } | null;
    literacyRate: number | null;
  } | null;
  /** Piso do magistério — adimplência apurada da declaração ao SIOPE. */
  teacherPay: {
    year: number | null;
    floor: number | null;
    median: number | null;
    ratio: number | null;
    belowPct: number | null;
    below: number | null;
    sampled: number | null;
    declared: number | null;
    reliable: boolean;
    coverage: number | null;
  } | null;
  /**
   * Escolas da rede **pública** — é o universo dos percentuais de
   * infraestrutura, que não coincide com `schools` (rede municipal).
   */
  publicSchools: number | null;
  infrastructure: Array<{ name: string; percent: number | null; total: number | null }>;
  sources: string[];
  notes: string[];
  /** Perfil da cidade inteira: saneamento, saúde, emprego, assistência e gestão. */
  profile: MunicipalProfile | null;
  /** Silhueta oficial do território usada na capa; ausente quando o IBGE falha. */
  boundary: MunicipalBoundaryMap | null;
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

/**
 * Casa as duas séries do IDEB (anos iniciais e finais) por ano.
 *
 * As edições não coincidem sempre — uma etapa pode ter resultado num ano em
 * que a outra não teve —, então a união dos anos é a chave, e a etapa que
 * faltou entra como `null` em vez de sumir a linha inteira.
 */
function serieIdeb(payload: unknown) {
  const ler = (caminho: string) =>
    new Map(
      array(at(payload, caminho))
        .map(asRecord)
        .filter((row): row is JsonRecord => row !== null && number(row.ano) !== null)
        .map((row) => [number(row.ano) as number, number(row.idebVerificado)] as const),
    );

  const iniciais = ler("relatorio_fundeb.idebAnosIniciais");
  const finais = ler("relatorio_fundeb.idebAnosFinais");
  const anos = [...new Set([...iniciais.keys(), ...finais.keys()])].sort((a, b) => a - b);

  return anos
    .map((year) => ({
      year,
      initial: iniciais.get(year) ?? null,
      final: finais.get(year) ?? null,
    }))
    .filter((linha) => linha.initial !== null || linha.final !== null);
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
  boundary?: MunicipalBoundaryMap | null;
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
    idebYear: number(latestInitial?.ano) ?? number(latestFinal?.ano),
    idebTargetIsNational:
      latestInitial?.metaOrigem === "nacional" || latestFinal?.metaOrigem === "nacional",
    idebSeries: serieIdeb(currentPayload),
    pibYear: text(at(currentPayload, "relatorio_dirigido_base.perfilIBGE.pibAnoReferencia"), ""),
    vaar: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.vaar"));
      if (!bruto) return null;

      const referencia = asRecord(bruto.referencia);
      const medianaUf = number(referencia?.medianaUf);
      return {
        year: number(bruto.exercicio),
        qualified: bruto.habilitado === true,
        beneficiary: bruto.beneficiario === true,
        amount: number(bruto.complementacao) ?? 0,
        failed: array(bruto.reprovadas).map((n) => String(n)),
        stateWideFailure: bruto.condIVEstadual === true,
        // Mediana zero significa "nenhum habilitado na UF", não "recebem zero".
        stateMedian: medianaUf && medianaUf > 0 ? medianaUf : null,
        stateQualified: number(referencia?.ufBeneficiadas) ?? 0,
        stateAssessed: number(referencia?.ufAvaliadas) ?? 0,
        pendency: typeof bruto.pendencia === "string" && bruto.pendencia.trim() ? bruto.pendencia : null,
      };
    })(),
    vaat: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.vaat"));
      const statusPerfil = text(at(currentPayload, "relatorio_fundeb.perfilComercial.habilitacaoVaat"), "");
      if (!bruto && !statusPerfil) return null;
      return {
        year: number(bruto?.exercicio),
        status: text(bruto?.habilitacao, statusPerfil || "Não informado"),
        pendency: typeof bruto?.pendencia === "string" && bruto.pendencia.trim() ? bruto.pendencia : null,
        perStudent: number(bruto?.proprio),
        minimum: number(bruto?.minimo),
        complement: number(bruto?.complementacao),
        distancePct: number(bruto?.distanciaPercentual),
        revenueBaseYear: number(bruto?.exercicioBaseReceita),
      };
    })(),
    weighting: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.ponderacao"));
      const enrollment = number(bruto?.matriculas) ?? 0;
      if (!bruto || enrollment === 0) return null;
      return {
        enrollment,
        weighted: number(bruto.ponderadaVaaf) ?? 0,
        avgFactor: number(bruto.fatorMedio),
      };
    })(),
    gain: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.ganho"));
      if (!bruto) return null;
      const item = (raw: JsonRecord) => ({
        key: text(raw.chave, ""),
        title: text(raw.titulo, ""),
        value: number(raw.valor) ?? 0,
        origin: text(raw.origem, ""),
        verify: text(raw.conferir, ""),
      });
      return {
        total: number(bruto.total) ?? 0,
        perEquivalent: number(bruto.valorPorEquivalente) ?? 0,
        components: array(bruto.componentes).map(asRecord).filter((r): r is JsonRecord => Boolean(r)).map(item),
        references: array(bruto.referencias).map(asRecord).filter((r): r is JsonRecord => Boolean(r)).map(item),
      };
    })(),
    siope: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.conformidade"));
      if (!bruto) return null;
      const indicators = array(bruto.indicadores)
        .map(asRecord)
        .filter((r): r is JsonRecord => r !== null && number(r.valor) !== null)
        .map((r) => ({
          label: text(r.rotulo, ""),
          value: number(r.valor) ?? 0,
          unit: r.unidade === "reais" ? ("reais" as const) : ("percentual" as const),
          limit: number(r.limite),
          direction: r.sentido === "min" ? ("min" as const) : r.sentido === "max" ? ("max" as const) : null,
          compliant: typeof r.conforme === "boolean" ? r.conforme : null,
          slack: number(r.folga),
          basis: typeof r.base === "string" && r.base ? r.base : null,
        }));
      if (indicators.length === 0) return null;
      const undeclared = array(bruto.naoDeclarados)
        .map(asRecord)
        .filter((r): r is JsonRecord => r !== null)
        .map((r) => ({ cod: text(r.cod, ""), label: text(r.rotulo, "") }))
        .filter((r) => r.label);
      return { year: number(bruto.ano), stale: bruto.defasado === true, indicators, undeclared };
    })(),
    twins: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.gemeos"));
      if (!bruto) return null;
      const faixa = asRecord(bruto.faixaPorte);
      const vaar = asRecord(bruto.vaar);
      return {
        enrollment: number(bruto.matriculas) ?? 0,
        rangeMin: number(faixa?.minimo) ?? 0,
        rangeMax: number(faixa?.maximo) ?? 0,
        cohortSize: number(faixa?.tamanho) ?? 0,
        vaarCohortPct: number(vaar?.habilitadoCoortePct),
        vaarQualified: typeof vaar?.municipioHabilitado === "boolean" ? vaar.municipioHabilitado : null,
        indicators: array(bruto.indicadores)
          .map(asRecord)
          .filter((r): r is JsonRecord => r !== null && number(r.valor) !== null)
          .map((r) => ({
            key: text(r.chave, ""),
            label: text(r.rotulo, ""),
            unit: r.unidade === "reais" ? ("reais" as const) : r.unidade === "fator" ? ("fator" as const) : ("percentual" as const),
            value: number(r.valor) ?? 0,
            cohortMedian: number(r.medianaPorte) ?? 0,
            stateMedian: number(r.medianaUf),
            percentile: number(r.percentil) ?? 0,
            direction:
              r.sentido === "menor-melhor"
                ? ("menor-melhor" as const)
                : r.sentido === "neutro"
                  ? ("neutro" as const)
                  : ("maior-melhor" as const),
          })),
      };
    })(),
    fiscalTimeliness: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.pontualidadeFiscal"));
      if (!bruto) return null;
      const risco = text(bruto.risco, "");
      if (risco !== "alto" && risco !== "medio" && risco !== "baixo") return null;
      return {
        risk: risco,
        dca: array(bruto.dca)
          .map(asRecord)
          .filter((r): r is JsonRecord => Boolean(r))
          .map((r) => ({
            year: number(r.exercicio) ?? 0,
            deliveredAt: typeof r.entregueEm === "string" ? r.entregueEm : null,
            daysPastDue: number(r.diasAlemDoPrazo),
            missedVaatCutoff: typeof r.estourouCorteVaat === "boolean" ? r.estourouCorteVaat : null,
          })),
      };
    })(),
    schoolResults: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.idebEscolas"));
      const resumo = asRecord(bruto?.resumo);
      if (!bruto || !resumo) return null;
      return {
        year: number(bruto.ano) ?? 0,
        list: array(bruto.escolas)
          .map(asRecord)
          .filter((r): r is JsonRecord => Boolean(r))
          .map((r) => {
            const ai = asRecord(r.ai);
            const af = asRecord(r.af);
            return {
              code: text(r.codigo, ""),
              name: text(r.nome, ""),
              idebAi: number(ai?.ideb),
              saebAi: number(ai?.media),
              idebAf: number(af?.ideb),
              saebAf: number(af?.media),
              nd: ai?.nd === true || af?.nd === true,
            };
          }),
        total: number(resumo.total) ?? 0,
        ndCount: number(resumo.semResultadoPorParticipacao) ?? 0,
        worstAi: number(resumo.piorIdebAi),
        bestAi: number(resumo.melhorIdebAi),
        rangeAi: number(resumo.amplitudeAi),
      };
    })(),
    schoolContext: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.indicadoresEscolas"));
      const resumo = asRecord(bruto?.resumo);
      const anos = asRecord(bruto?.anos);
      if (!bruto || !resumo || !anos) return null;
      const nomeValor = (registro: unknown): { name: string; value: number } | null => {
        const r = asRecord(registro);
        return r ? { name: text(r.nome, ""), value: number(r.valor) ?? 0 } : null;
      };
      const escolaCruzada = (registro: unknown): { name: string; inse: number; ideb: number } | null => {
        const r = asRecord(registro);
        return r
          ? { name: text(r.nome, ""), inse: number(r.inse) ?? 0, ideb: number(r.ideb) ?? 0 }
          : null;
      };
      const cruzamento = asRecord(bruto.cruzamento);
      return {
        years: {
          inse: number(anos.inse) ?? 0,
          icg: number(anos.icg) ?? 0,
          tdi: number(anos.tdi) ?? 0,
          rendimento: number(anos.rendimento) ?? 0,
          afd: number(anos.afd) ?? 0,
        },
        networkInse: number(resumo.inseMedioRede),
        schools: array(bruto.escolas)
          .map(asRecord)
          .filter((r): r is JsonRecord => Boolean(r))
          .map((r) => ({
            code: text(r.codigo, ""),
            name: text(r.nome, ""),
            inseLevel: number(r.inseNivel),
            icg: number(r.icg),
            tdi: number(r.tdiFund),
            approval: number(r.aprovacaoFund),
            dropout: number(r.abandonoFund),
            adequateTeachers: number(r.docentesAdequadosFund),
          })),
        total: number(resumo.total) ?? 0,
        dropoutCount: number(resumo.comAbandono) ?? 0,
        worstDropout: nomeValor(resumo.piorAbandono),
        worstTdi: nomeValor(resumo.piorDistorcao),
        avgAdequateTeachers: number(resumo.mediaDocentesAdequados),
        crossover: cruzamento
          ? {
              evaluated: number(cruzamento.avaliadas) ?? 0,
              medianInse: number(cruzamento.medianaInse) ?? 0,
              medianIdeb: number(cruzamento.medianaIdeb) ?? 0,
              resilient: escolaCruzada(cruzamento.resiliente),
              alert: escolaCruzada(cruzamento.alerta),
            }
          : null,
      };
    })(),
    proficiency: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.saebDistribuicao"));
      const seriesBruto = asRecord(bruto?.series);
      if (!bruto || !seriesBruto) return null;
      const ROTULOS: Record<string, string> = {
        lp5: "Língua Portuguesa — 5º ano",
        mt5: "Matemática — 5º ano",
        lp9: "Língua Portuguesa — 9º ano",
        mt9: "Matemática — 9º ano",
      };
      const series = (["lp5", "mt5", "lp9", "mt9"] as const)
        .map((key) => {
          const serie = asRecord(seriesBruto[key]);
          const grupos = asRecord(serie?.grupos);
          if (!serie || !grupos) return null;
          return {
            key,
            label: ROTULOS[key],
            media: number(serie.media) ?? 0,
            insufficient: number(grupos.insuficiente) ?? 0,
            basic: number(grupos.basico) ?? 0,
            proficient: number(grupos.proficiente) ?? 0,
            advanced: number(grupos.avancado) ?? 0,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);
      if (series.length === 0) return null;
      return { year: number(bruto.ano) ?? 0, series };
    })(),
    violence: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.violencia"));
      const ultimo = asRecord(bruto?.ultimo);
      if (!bruto || !ultimo) return null;
      const ponto = (r: JsonRecord) => ({
        year: number(r.ano) ?? 0,
        total: number(r.total),
        youth: number(r.jovens),
        rate: number(r.taxa),
      });
      const brasil = asRecord(bruto.brasil);
      return {
        national: brasil ? { year: number(brasil.ano) ?? 0, rate: number(brasil.taxa) ?? 0 } : null,
        series: array(bruto.serie)
          .map(asRecord)
          .filter((r): r is JsonRecord => Boolean(r))
          .map(ponto),
        latest: ponto(ultimo),
        youthSharePct: number(bruto.participacaoJovensPct),
        rateTrendPct: number(bruto.tendenciaTaxaPct),
        aboveNational: typeof bruto.acimaDaNacional === "boolean" ? bruto.acimaDaNacional : null,
      };
    })(),
    schoolMap: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.escolasTerritorio"));
      const resumo = asRecord(bruto?.resumo);
      if (!bruto || !resumo) return null;
      const porDif = asRecord(resumo.porDiferenciada) ?? {};
      const byDiferenciada: Record<string, number> = {};
      for (const [k, v] of Object.entries(porDif)) {
        const n = number(v);
        if (n !== null) byDiferenciada[k] = n;
      }
      return {
        year: number(bruto.ano) ?? 0,
        schools: array(bruto.escolas)
          .map(asRecord)
          .filter((r): r is JsonRecord => Boolean(r))
          .map((r) => ({
            codigo: typeof r.codigo === "string" ? r.codigo : "",
            lat: number(r.lat),
            lng: number(r.lng),
            rural: r.rural === true,
            dif: number(r.dif) ?? 0,
            matriculas: number(r.matriculas),
          })),
        total: number(resumo.total) ?? 0,
        withCoords: number(resumo.comCoordenada) ?? 0,
        ruralCount: number(resumo.rurais) ?? 0,
        byDiferenciada,
        transportStudents: number(resumo.alunosTransporte) ?? 0,
        transportPct: number(resumo.pctTransporte),
        raceTotals: (() => {
          const t = asRecord(resumo.corRacaTotais);
          const enrolled = number(t?.matriculas);
          if (!t || enrolled === null || enrolled <= 0) return null;
          return {
            enrolled,
            indigenous: number(t.indigena) ?? 0,
            black: number(t.negra) ?? 0,
            undeclared: number(t.naoDeclarada) ?? 0,
          };
        })(),
        race: (() => {
          const corRaca = asRecord(resumo.corRaca);
          if (!corRaca) return null;
          const zona = (registro: unknown) => {
            const r = asRecord(registro);
            return {
              enrolled: number(r?.matriculas) ?? 0,
              blackPct: number(r?.negraPct),
              indigenousPct: number(r?.indigenaPct),
              undeclaredPct: number(r?.naoDeclaradaPct),
            };
          };
          return { urban: zona(corRaca.urbana), rural: zona(corRaca.rural) };
        })(),
      };
    })(),
    ruralPopulation: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.populacaoRural"));
      if (!bruto) return null;
      const urbana = number(bruto.urbana);
      const rural = number(bruto.rural);
      const pct = number(bruto.pctRural);
      if (urbana === null || rural === null || pct === null) return null;
      return {
        year: number(bruto.ano) ?? 0,
        urban: urbana,
        rural,
        total: number(bruto.total) ?? urbana + rural,
        ruralPct: pct,
      };
    })(),
    nutrition: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.estadoNutricional"));
      const mun = asRecord(bruto?.municipio);
      const total = number(mun?.total);
      if (!bruto || !mun || total === null || total <= 0) return null;
      return {
        year: number(bruto.ano) ?? 0,
        followed: total,
        thinPct: number(mun.magrezaPct),
        healthyPct: number(mun.eutrofiaPct),
        excessPct: number(mun.excessoPesoPct),
        overweight: number(mun.sobrepeso) ?? 0,
        obese: number(mun.obesidade) ?? 0,
        severelyObese: number(mun.obesidadeGrave) ?? 0,
        statePct: number(asRecord(bruto.estado)?.excessoPesoPct),
        countryPct: number(asRecord(bruto.brasil)?.excessoPesoPct),
      };
    })(),
    childHealth: (() => {
      const ibge = text(at(currentPayload, "dados_basicos.codigo_ibge"), "");
      const vac = getCoberturaVacinal(ibge);
      const vio = getViolenciaInfantil(ibge);
      if (!vac && !vio) return null;
      return {
        vaccination: vac
          ? {
              year: vac.ano,
              shots: vac.vacinas.map((v) => ({
                label: v.rotulo,
                value: v.valor,
                median: v.medianaNacional,
                unreadable: v.semLeitura,
                belowMedian: v.abaixoDaMediana,
              })),
              belowMedian: vac.abaixoDaMediana,
              unreadable: vac.semLeitura,
            }
          : null,
        violence: vio
          ? {
              ageRange: vio.faixaEtaria,
              series: vio.serie.map((x) => ({ year: x.ano, count: x.notificacoes })),
              latest: vio.ultimo ? { year: vio.ultimo.ano, count: vio.ultimo.notificacoes } : null,
              total: vio.total,
              totalSilence: vio.silencioTotal,
              reportingCities: vio.municipiosNotificantes,
              citiesInCountry: vio.municipiosNoPais,
            }
          : null,
      };
    })(),
    childLabor: (() => {
      const t = getTrabalhoInfantil(text(at(currentPayload, "dados_basicos.codigo_ibge"), ""));
      if (!t) return null;
      return {
        censusYear: t.anoCenso,
        table: t.tabela,
        caveat: t.ressalva,
        bands: t.faixas.map((f) => ({
          label: f.rotulo,
          population: f.populacao,
          occupied: f.ocupadas,
          ratePct: f.taxaPct,
          stateRatePct: f.taxaUfPct,
          countryRatePct: f.taxaBrasilPct,
          aboveState: f.acimaDaUf,
          aboveCountry: f.acimaDoBrasil,
          weakComparison: f.comparacaoFragil,
          legalWorkPossible: f.admiteTrabalhoLegal,
        })),
        noneEstimated: t.semOcupacaoEstimada,
      };
    })(),
    indigenousLands: (() => {
      const t = getTerrasIndigenas(text(at(currentPayload, "dados_basicos.codigo_ibge"), ""));
      if (!t) return null;
      return {
        villages: t.aldeias.map((a) => ({
          name: a.nome,
          land: a.terra?.nome ?? "",
          ethnicity: a.terra?.etnia ?? "",
          phase: a.terra?.fase ?? "",
          kmToSchool: a.kmAteEscola,
          kmToIndigenousSchool: a.kmAteEscolaIndigena,
        })),
        lands: t.terras.length,
        indigenousSchools: t.escolasIndigenas,
        villagesWithoutIndigenousSchool: t.aldeiasSemEscolaIndigena,
        villagesWithoutAnySchool: t.aldeiasSemEscolaAlguma,
        radiusKm: t.raioKm,
        registeredButUndeclared: t.registroSemDeclaracao,
        villagesWithCoords: t.aldeiasComCoordenada,
      };
    })(),
    fundefWrit: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.precatorioFundef"));
      if (!bruto) return null;
      const janela = array(bruto.janela)
        .map((v) => number(v))
        .filter((v): v is number => v !== null);
      if (janela.length === 0) return null;
      return {
        window: janela,
        missingYears: array(bruto.semDeclaracao)
          .map((v) => number(v))
          .filter((v): v is number => v !== null),
        received: Boolean(bruto.recebeu),
        years: array(bruto.exercicios)
          .map(asRecord)
          .filter((r): r is JsonRecord => Boolean(r))
          .map((r) => ({
            year: number(r.exercicio) ?? 0,
            value: number(r.valor) ?? 0,
            account: text(r.codigoConta, ""),
            underEc114: Boolean(r.sobEc114),
          }))
          .filter((e) => e.year > 0),
        total: number(bruto.total) ?? 0,
        underEc114: number(bruto.totalSobEc114) ?? 0,
        beforeEc114: number(bruto.totalAnterior) ?? 0,
        minimumBonus: number(bruto.minimoAbono) ?? 0,
        remainderMde: number(bruto.saldoMde) ?? 0,
        firstYear: number(bruto.primeiroExercicio),
        lastYear: number(bruto.ultimoExercicio),
        notes: array(bruto.observacoes)
          .map((v) => text(v, ""))
          .filter(Boolean),
      };
    })(),
    enem: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.enemAbstencao"));
      if (!bruto) return null;
      const inscritos = number(bruto.inscritos);
      const pctAbstencao = number(bruto.pctAbstencao);
      if (inscritos === null || pctAbstencao === null) return null;
      const uf = asRecord(bruto.uf);
      return {
        year: number(bruto.ano) ?? 0,
        enrolled: inscritos,
        absentPct: pctAbstencao,
        state: uf ? { code: text(uf.sigla, ""), absentPct: number(uf.pctAbstencao) ?? 0 } : null,
      };
    })(),
    stalledWorks: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.obrasFnde"));
      if (!bruto) return null;
      return {
        total: number(bruto.totalObras) ?? 0,
        stalled: number(bruto.paralisadas) ?? 0,
        unfinished: number(bruto.inacabadas) ?? 0,
        resuming: number(bruto.emRetomada) ?? 0,
        stalledValue: number(bruto.valorParadoEstimado) ?? 0,
        repactValue: number(bruto.valorEstimadoRepactuacao),
        works: array(bruto.obrasCriticas)
          .map(asRecord)
          .filter((r): r is JsonRecord => Boolean(r))
          .map((r) => ({
            year: number(r.ano),
            type: text(r.tipo, ""),
            classification: text(r.classificacao, ""),
            status: text(r.situacao, ""),
            estimate: number(r.estimativaRepasse) ?? 0,
            executed: number(r.execucao) ?? 0,
          })),
      };
    })(),
    federalMoney: (() => {
      const emendasBruto = asRecord(at(currentPayload, "relatorio_dirigido_base.emendas"));
      const conveniosBruto = asRecord(at(currentPayload, "relatorio_dirigido_base.conveniosFederais"));
      const sancoesBruto = asRecord(at(currentPayload, "relatorio_dirigido_base.sancoesFederais"));
      if (!emendasBruto && !conveniosBruto && !sancoesBruto) return null;
      return {
        emendas: emendasBruto
          ? {
              dataAsOf: text(emendasBruto.geradoEm, ""),
              years: array(emendasBruto.anos)
                .map(asRecord)
                .filter((r): r is JsonRecord => Boolean(r))
                .map((r) => ({
                  year: number(r.ano) ?? 0,
                  count: number(r.quantidade) ?? 0,
                  committed: number(r.empenhado) ?? 0,
                  paid: number(r.pago) ?? 0,
                  eduCount: number(r.quantidadeEducacao) ?? 0,
                  eduCommitted: number(r.empenhadoEducacao) ?? 0,
                })),
              eduAuthors: array(emendasBruto.autoresEducacao)
                .map(asRecord)
                .filter((r): r is JsonRecord => Boolean(r))
                .map((r) => ({ name: text(r.nome, ""), committed: number(r.empenhado) ?? 0 })),
            }
          : null,
        convenios: conveniosBruto
          ? {
              total: number(conveniosBruto.total) ?? 0,
              truncated: conveniosBruto.truncado === true,
              active: number(conveniosBruto.vigentes) ?? 0,
              activeValue: number(conveniosBruto.valorVigentes) ?? 0,
              activeReleased: number(conveniosBruto.liberadoVigentes) ?? 0,
              eduActive: number(conveniosBruto.educacaoVigentes) ?? 0,
              eduActiveValue: number(conveniosBruto.valorEducacaoVigentes) ?? 0,
              noRelease: number(conveniosBruto.semLiberacao) ?? 0,
              top: array(conveniosBruto.topVigentes)
                .map(asRecord)
                .filter((r): r is JsonRecord => Boolean(r))
                .slice(0, 3)
                .map((r) => ({
                  objeto: text(r.objeto, ""),
                  orgao: text(r.orgao, ""),
                  valor: number(r.valor) ?? 0,
                  fimVigencia: typeof r.fimVigencia === "string" ? r.fimVigencia : null,
                })),
            }
          : null,
        sanctions: sancoesBruto
          ? {
              entity: array(sancoesBruto.enteSancionado)
                .map(asRecord)
                .filter((r): r is JsonRecord => Boolean(r))
                .map((r) => ({
                  cadastro: text(r.cadastro, ""),
                  sancionado: text(r.sancionado, ""),
                  orgao: text(r.orgaoSancionador, ""),
                  tipo: text(r.tipo, ""),
                  fimSancao: typeof r.fimSancao === "string" ? r.fimSancao : null,
                })),
              appliedByCity: number(sancoesBruto.aplicadasPeloEnte) ?? 0,
            }
          : null,
      };
    })(),
    literacy: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.alfabetizacao"));
      const serie = array(bruto?.serie)
        .map(asRecord)
        .filter((r): r is JsonRecord => Boolean(r) && number(r?.valor) !== null)
        .map((r) => ({
          year: number(r.ano) ?? 0,
          value: number(r.valor) as number,
          target: number(r.meta),
          met: typeof r.cumpriu === "boolean" ? r.cumpriu : null,
        }));
      if (!bruto || !serie.length) return null;
      const proxima = asRecord(bruto.proximaMeta);
      const final = asRecord(bruto.metaFinal);
      const uf = asRecord(bruto.uf);
      return {
        series: serie,
        latest: serie[serie.length - 1],
        changePoints: number(bruto.variacaoPontos),
        nextTarget:
          proxima && number(proxima.meta) !== null
            ? {
                year: number(proxima.ano) ?? 0,
                target: number(proxima.meta) as number,
                gapPoints: number(proxima.faltamPontos) ?? 0,
              }
            : null,
        finalTarget:
          final && number(final.meta) !== null
            ? {
                year: number(final.ano) ?? 0,
                target: number(final.meta) as number,
                requiredPace: number(final.ritmoNecessario) ?? 0,
              }
            : null,
        observedPace: number(bruto.ritmoObservado),
        levelLabel: typeof bruto.nivelRotulo === "string" ? bruto.nivelRotulo : null,
        participation: number(bruto.participacao),
        fragileParticipation:
          typeof bruto.participacaoFragil === "boolean" ? bruto.participacaoFragil : null,
        state:
          uf && number(uf.valor) !== null
            ? { uf: text(uf.sigla, ""), value: number(uf.valor) as number, year: number(uf.ano) ?? 0 }
            : null,
      };
    })(),
    politics: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.cicloPolitico"));
      const atual = asRecord(bruto?.atual);
      const mandato = asRecord(bruto?.mandato);
      if (!bruto || !atual || !mandato) return null;
      const anterior = asRecord(bruto.anterior);
      const panorama = asRecord(bruto.panorama);
      const situacao = text(bruto.situacao, "indeterminado");
      return {
        current: {
          mayor: text(atual.prefeito, ""),
          party: text(atual.partido, ""),
          election: number(atual.eleicao) ?? 0,
        },
        previous: anterior
          ? {
              mayor: text(anterior.prefeito, ""),
              party: text(anterior.partido, ""),
              election: number(anterior.eleicao) ?? 0,
            }
          : null,
        status: (["reeleicao", "sucessao_mesmo_partido", "alternancia"].includes(situacao)
          ? situacao
          : "indeterminado") as "reeleicao" | "sucessao_mesmo_partido" | "alternancia" | "indeterminado",
        term: { start: number(mandato.inicio) ?? 0, end: number(mandato.fim) ?? 0 },
        nextElection: number(bruto.proximaEleicao) ?? 0,
        nationwide:
          panorama && number(panorama.total) !== null
            ? {
                reelected: number(panorama.reeleitos) ?? 0,
                successions: number(panorama.sucessoes) ?? 0,
                alternations: number(panorama.alternancias) ?? 0,
                total: number(panorama.total) as number,
              }
            : null,
      };
    })(),
    cauc: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.caucRequisitos"));
      if (!bruto) return null;
      const requisito = (valor: unknown) => {
        const r = asRecord(valor);
        return r ? { code: text(r.codigo, ""), label: text(r.rotulo, "") } : null;
      };
      const proximo = asRecord(bruto.proximoVencimento);
      const panorama = asRecord(bruto.panorama);
      return {
        queriedAt: typeof bruto.dataPesquisa === "string" ? bruto.dataPesquisa : null,
        pending: array(bruto.pendencias)
          .map(requisito)
          .filter((r): r is { code: string; label: string } => Boolean(r)),
        pendingEducation: array(bruto.pendenciasEducacao)
          .map(requisito)
          .filter((r): r is { code: string; label: string } => Boolean(r)),
        proven: number(bruto.comprovados) ?? 0,
        disabled: number(bruto.desabilitados) ?? 0,
        nextExpiry:
          proximo && typeof proximo.validadeAte === "string"
            ? {
                code: text(proximo.codigo, ""),
                label: text(proximo.rotulo, ""),
                until: proximo.validadeAte,
              }
            : null,
        nationwide:
          panorama && number(panorama.total) !== null
            ? {
                withPending: number(panorama.comPendencia) ?? 0,
                total: number(panorama.total) as number,
              }
            : null,
      };
    })(),
    demographics: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.demografiaEducacional"));
      const faixas = asRecord(bruto?.faixas);
      if (!bruto || !faixas) return null;
      return {
        crechePop: number(faixas.creche) ?? 0,
        prePop: number(faixas.preEscola) ?? 0,
        aiPop: number(faixas.anosIniciais) ?? 0,
        afPop: number(faixas.anosFinais) ?? 0,
        births: array(bruto.nascimentos)
          .map(asRecord)
          .filter((r): r is JsonRecord => r !== null && number(r.nascidos) !== null)
          .map((r) => ({
            year: number(r.anoNascimento) ?? 0,
            count: number(r.nascidos) ?? 0,
            preYear: number(r.chegaPreEscolaEm) ?? 0,
            firstGradeYear: number(r.chegaPrimeiroAnoEm) ?? 0,
          })),
        trendPct: number(bruto.tendenciaNascimentosPct),
        crecheEnrollment: number(at(currentPayload, "educacao.matriculas_creche")),
        preEnrollment: number(at(currentPayload, "educacao.matriculas_pre_escola")),
        totalEnrollment: (() => {
          const total = asRecord(at(currentPayload, "relatorio_dirigido_base.atendimentoTotal"));
          if (!total) return null;
          return {
            year: number(total.ano) ?? 0,
            creche: number(total.creche),
            pre: number(total.preEscola),
            ai: number(total.anosIniciais),
            af: number(total.anosFinais),
          };
        })(),
        teenMothers: (() => {
          const maes = asRecord(bruto.maesAdolescentes);
          if (!maes) return null;
          return {
            year: number(maes.ano) ?? 0,
            births: number(maes.nascimentos) ?? 0,
            sharePct: number(maes.percentualDoTotal) ?? 0,
          };
        })(),
      };
    })(),
    peoples: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.equidadeTerritorial"));
      if (!bruto) return null;
      const povo = (chave: string) => {
        const p = asRecord(bruto[chave]);
        return {
          pop: number(p?.populacao) ?? 0,
          schoolAge: number(p?.emIdadeEscolar) ?? 0,
          enrolled: number(p?.matriculasNosSegmentos) ?? 0,
          ratio: number(p?.razaoAtendimento),
          flag: p?.sinalConferencia === true,
        };
      };
      const faixa = asRecord(bruto.fatorFaixa);
      return {
        quilombola: povo("quilombola"),
        indigenous: povo("indigena"),
        factorMin: number(faixa?.minimo) ?? 1.4,
        factorMax: number(faixa?.maximo) ?? 2.17,
      };
    })(),
    economy: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.economiaLocal"));
      const setores = asRecord(bruto?.setores);
      if (!bruto) return null;
      const dominante = text(bruto.setorDominante, "");
      return {
        pibYearRef: number(bruto.anoPib),
        agro: number(setores?.agropecuaria),
        industry: number(setores?.industria),
        services: number(setores?.servicos),
        publicAdmin: number(setores?.administracao),
        dominant:
          dominante === "agropecuaria" || dominante === "industria" || dominante === "servicos" || dominante === "administracao"
            ? dominante
            : null,
        crop: (() => {
          const cultura = asRecord(bruto.culturaDominante);
          if (!cultura) return null;
          const nome = text(cultura.nome, "");
          if (!nome) return null;
          return { name: nome, sharePct: number(cultura.participacaoPct), year: number(cultura.anoPam) };
        })(),
        literacyRate: number(bruto.taxaAlfabetizacao),
      };
    })(),
    settlements: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.assentamentos"));
      if (!bruto) return null;
      return {
        count: number(bruto.qtd) ?? 0,
        families: number(bruto.familias) ?? 0,
        areaHa: number(bruto.areaHa) ?? 0,
      };
    })(),
    pbf: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.frequenciaBolsaFamilia"));
      if (!bruto) return null;
      const sancoes = asRecord(bruto.sancoes);
      return {
        period: text(bruto.competencia, ""),
        audience: number(bruto.publicoEducacao) ?? 0,
        monitored: number(bruto.acompanhados) ?? 0,
        monitoredPct: number(bruto.percAcompanhados),
        notFound: number(bruto.naoLocalizados) ?? 0,
        notFoundPct: number(bruto.percNaoLocalizados),
        noInfo: number(bruto.semInformacaoFrequencia) ?? 0,
        attendanceOkPct: number(bruto.percFrequenciaAcima),
        warnings: number(sancoes?.advertencias) ?? 0,
        blocks: number(sancoes?.bloqueios) ?? 0,
        suspensions: number(sancoes?.suspensoes) ?? 0,
        familiesInSuspension: number(sancoes?.familiasEmFaseDeSuspensao) ?? 0,
      };
    })(),
    teacherPay: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.remuneracao"));
      if (!bruto || (number(bruto.magisterio) ?? 0) === 0) return null;
      return {
        year: number(bruto.ano),
        floor: number(bruto.piso),
        median: number(bruto.medianaMagisterio),
        ratio: number(bruto.razaoMedianaPiso),
        belowPct: number(bruto.abaixoDoPisoPct),
        below: number(bruto.abaixoDoPiso),
        sampled: number(bruto.magisterio),
        declared: number(bruto.magisterioDeclarado),
        reliable: bruto.confiavel !== false,
        coverage: number(bruto.cobertura),
      };
    })(),
    equity: (() => {
      const bruto = asRecord(at(currentPayload, "relatorio_dirigido_base.equidade"));
      const municipal = asRecord(bruto?.municipal);
      const escolas = asRecord(bruto?.escolas);
      const total = number(municipal?.total) ?? 0;
      if (!bruto || total === 0) return null;

      const negra = number(bruto.negraMunicipal) ?? 0;
      return {
        censusYear: number(bruto.anoCenso),
        total,
        black: negra,
        blackShare: (negra / total) * 100,
        indigenous: number(municipal?.indigena) ?? 0,
        undeclaredShare: number(bruto.naoDeclaradaPct),
        fragileRegistry: bruto.cadastroFragil === true,
        ruralSchools: number(escolas?.municipaisRurais) ?? 0,
        indigenousSchools: number(escolas?.municipaisEducacaoIndigena) ?? 0,
        quilomboSchools: number(escolas?.municipaisQuilombolas) ?? 0,
        settlementSchools: number(escolas?.municipaisAssentamento) ?? 0,
      };
    })(),
    publicSchools: number(
      at(currentPayload, "relatorio_dirigido_base.infraestruturaEscolar.totalEscolasPublicas"),
    ),
    infrastructure: infra,
    sources: Array.from(new Set(metadataSources)),
    notes: operationalNotes,
    profile: params.profile ?? null,
    boundary: params.boundary ?? null,
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
/** Duas casas para o INSE: na escala do Saeb, 4,79 e 4,83 são redes diferentes. */
const decimal2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

/**
 * Equidade da rede e condições de ponderação do FUNDEB.
 *
 * Campo, terra indígena e remanescente de quilombo valem mais por matrícula na
 * portaria do fundo. Quem não declara a condição no Censo perde receita no
 * exercício seguinte, e a correção só entra no levantamento seguinte.
 *
 * O percentual de cor/raça não declarada vem junto de propósito: sem ele, uma
 * rede que simplesmente não preencheu o campo aparece como rede sem alunos
 * negros ou indígenas.
 */
/**
 * Situação no VAAR, na página do FUNDEB.
 *
 * Ocupa o lugar de um par "alavanca / risco" que era genérico — valia para
 * qualquer município do país e portanto não informava nenhum. Com o dataset do
 * FNDE dá para dizer se **este** município recebe a parcela, e quando não
 * recebe, qual condicionalidade a bloqueou.
 *
 * Sem dado, o texto genérico volta: é melhor do que uma lacuna na página.
 */
function vaarBlock(model: MunicipalXrayModel): string {
  const v = model.vaar;
  const generico = `<div class="grid-2 mt-3"><div class="insight"><b>Alavanca:</b> transformar o novo volume em plano anual com metas, responsáveis, evidências e revisão mensal.</div><div class="risk"><b>Risco:</b> expansão de despesa sem vínculo verificável com aprendizagem, acesso, permanência e infraestrutura.</div></div>`;

  if (!v) return generico;

  const ano = v.year ? ` ${v.year}` : "";

  if (v.stateWideFailure) {
    return `<div class="grid-2 mt-3"><div class="risk"><b>VAAR${ano}: R$ 0 por reprovação do estado.</b> A condicionalidade IV é avaliada na esfera estadual e seu resultado é aplicado a todos os municípios da UF — os ${integer.format(v.stateAssessed)} municípios do estado ficaram sem a parcela pelo mesmo motivo. <b>Nenhuma ação municipal reverte isso</b>; a agenda é de articulação com o governo estadual.</div><div class="note"><b>Leitura:</b> não trate a ausência do VAAR como falha de gestão local neste caso. As demais condicionalidades seguem valendo para o ciclo seguinte e devem ser mantidas em dia.</div></div>`;
  }

  if (!v.qualified && v.failed.length) {
    const quais = v.failed.join(", ");
    const referencia =
      v.stateMedian !== null
        ? ` Os ${integer.format(v.stateQualified)} municípios habilitados do estado receberam, na mediana, <b>${esc(compactMoney(v.stateMedian))}</b> — ordem de grandeza, não previsão: o rateio é proporcional à evolução dos indicadores.`
        : "";
    return `<div class="grid-2 mt-3"><div class="risk"><b>VAAR${ano}: R$ 0.</b> O município reprovou ${v.failed.length === 1 ? "na condicionalidade" : "nas condicionalidades"} <b>${esc(quais)}</b> do art. 14 da Lei nº 14.113/2020, e a complementação vinculada a resultados é perdida por inteiro quando uma delas falha.${referencia}</div><div class="insight"><b>Alavanca:</b> ${v.failed.length === 1 ? "a reprovação é isolada, então a habilitação depende de corrigir um único item." : "cada condicionalidade recuperada aproxima a rede da habilitação, mas só a última destrava a parcela — todas precisam fechar no mesmo ciclo."} A aferição é anual e recomeça do zero a cada exercício.</div></div>`;
  }

  if (v.qualified && !v.beneficiary) {
    return `<div class="grid-2 mt-3"><div class="note"><b>VAAR${ano}: habilitado, sem repasse.</b> As cinco condicionalidades foram cumpridas, mas não houve evolução nos indicadores de atendimento e aprendizagem no período — e o rateio entre habilitados é proporcional ao avanço.</div><div class="insight"><b>Alavanca:</b> a parte difícil já está feita. Com a habilitação preservada, qualquer evolução mensurável nos indicadores passa a converter em receita.</div></div>`;
  }

  return `<div class="grid-2 mt-3"><div class="insight"><b>VAAR${ano}: ${esc(compactMoney(v.amount))} recebidos.</b> O município está habilitado nas cinco condicionalidades e é beneficiário do rateio.${v.stateMedian !== null ? ` A mediana dos habilitados do estado é ${esc(compactMoney(v.stateMedian))}.` : ""} O art. 26 exclui o VAAR da base dos 70%, o que o torna o recurso do fundo com aplicação mais livre.</div><div class="risk"><b>Risco:</b> a habilitação <b>não se acumula</b> — é reavaliada a cada exercício, e perder uma única condicionalidade zera a parcela inteira no ano seguinte. Manter é uma rotina anual, não uma conquista definitiva.</div></div>`;
}

/**
 * Porte da rede e o resultado agregado — a foto que o gestor já conhece.
 *
 * Nasceu da fusão de duas folhas da geração antiga do template ("Rede de
 * ensino" e "Aprendizagem"), que juntas ocupavam duas páginas para entregar
 * pouco mais de uma. Saíram no caminho: a tabela que repetia as próprias
 * métricas da folha, os cards de conselho genérico ("perguntas para
 * auditoria", "agenda de resultado") e o bloco de equidade — este último
 * porque a declaração étnica e a composição por cor/raça por zona ganharam
 * páginas próprias, com dado melhor.
 *
 * O que sobra tem uma função clara: é o número que o prefeito reconhece. O
 * IDEB municipal contra a meta é a única linha do dossiê que ele já viu em
 * jornal — e é a âncora para as páginas que a desmontam escola a escola.
 */
function paginaRedeEResultado(model: MunicipalXrayModel, pagina: number): string {
  const abaixoAi =
    model.idebInitial !== null &&
    model.idebInitialTarget !== null &&
    model.idebInitial < model.idebInitialTarget;
  const abaixoAf =
    model.idebFinal !== null &&
    model.idebFinalTarget !== null &&
    model.idebFinal < model.idebFinalTarget;

  const rotuloMeta = model.idebTargetIsNational ? "referência nacional" : "meta";
  const titulo =
    abaixoAi && abaixoAf
      ? "As duas etapas estão abaixo da régua"
      : abaixoAi || abaixoAf
        ? `${abaixoAi ? "Os anos iniciais estão" : "Os anos finais estão"} abaixo da régua`
        : "A rede está na régua — e a régua é o piso, não a ambição";

  // A trajetória, não a foto: o número isolado não distingue rede que subiu
  // de rede que caiu para o mesmo lugar — e é a evolução que a Cond. I do VAAR
  // observa. Com uma edição só não há trajetória, e o bloco não aparece.
  const s = model.idebSeries;
  const variacao = (pegar: (l: (typeof s)[number]) => number | null) => {
    const comDado = s.filter((l) => pegar(l) !== null);
    if (comDado.length < 2) return null;
    const primeiro = comDado[0];
    const ultimo = comDado[comDado.length - 1];
    return {
      delta: Math.round(((pegar(ultimo) as number) - (pegar(primeiro) as number)) * 100) / 100,
      de: primeiro.year,
      ate: ultimo.year,
    };
  };
  const varAi = variacao((l) => l.initial);
  const varAf = variacao((l) => l.final);

  const frase = (rotulo: string, v: ReturnType<typeof variacao>) =>
    v === null
      ? ""
      : `<b>${rotulo}:</b> ${
          v.delta === 0
            ? "parado"
            : `${v.delta > 0 ? "+" : "−"}${decimal.format(Math.abs(v.delta))}`
        } de ${v.de} a ${v.ate}.`;

  const serie =
    s.length < 2
      ? ""
      : `<div class="card mt-3"><h3>A trajetória, edição a edição</h3><table><thead><tr><th>Edição</th>${s
          .map((l) => `<th class="num">${l.year}</th>`)
          .join("")}</tr></thead><tbody><tr><td>Anos iniciais</td>${s
          .map((l) => `<td class="num">${l.initial === null ? "—" : decimal.format(l.initial)}</td>`)
          .join("")}</tr><tr><td>Anos finais</td>${s
          .map((l) => `<td class="num">${l.final === null ? "—" : decimal.format(l.final)}</td>`)
          .join("")}</tr></tbody></table><p class="small" style="margin-top:.06in">${frase(
          "Anos iniciais",
          varAi,
        )} ${frase("Anos finais", varAf)} A <b>Condicionalidade I do VAAR</b> mede evolução, não nível: rede que parte de baixo e sobe é premiada, rede que estaciona no alto não é.</p></div>`;

  const cardIdeb = (
    titulo: string,
    observado: number | null,
    meta: number | null,
    leitura: string,
  ) =>
    `<div class="card ${statusClass(observado, meta)}"><h3>${titulo}</h3><div class="grid-2">${metric(
      observado === null ? "N/D" : decimal.format(observado),
      "IDEB observado",
    )}${metric(meta === null ? "N/D" : decimal.format(meta), rotuloMeta)}</div><div class="divider"></div><p class="small">${leitura}</p></div>`;

  return `<section class="page content-page">${header("Porte e resultado")}<main class="page-body"><div class="kicker">A rede em números e o índice que a mede</div><h2>${titulo}</h2><p class="lede">O porte da rede sai do Censo Escolar${
    model.enrollmentYear ? ` ${esc(model.enrollmentYear)}` : ""
  } — matrícula não é projetada para ${model.currentYear} enquanto o INEP não publica a base. O IDEB${
    model.idebYear ? ` ${model.idebYear}` : ""
  } é a linha de resultado agregada; as páginas seguintes a desmontam escola a escola, que é onde a decisão acontece.</p><div class="grid-4 mt-3">${metric(
    int(model.enrollments),
    "matrículas municipais",
  )}${metric(int(model.schools), "escolas")}${metric(int(model.fullTime), "em tempo integral")}${metric(
    int(model.specialEducation),
    "em educação especial",
  )}</div><div class="grid-2 mt-3">${cardIdeb(
    "Anos iniciais",
    model.idebInitial,
    model.idebInitialTarget,
    abaixoAi
      ? "A recomposição precisa ser priorizada por habilidade e por escola — a média da rede não diz onde intervir."
      : "Manter o resultado e olhar a distância entre a melhor e a pior escola, que a média esconde.",
  )}${cardIdeb(
    "Anos finais",
    model.idebFinal,
    model.idebFinalTarget,
    abaixoAf
      ? "Transição e fluxo pedem intervenção focalizada e monitoramento curto — abandono aqui vira distorção adiante."
      : "Preservar a trajetória e monitorar abandono, aprovação e proficiência por escola.",
  )}</div><div class="${abaixoAi || abaixoAf ? "insight" : "note"} mt-3"><b>Como esta página conversa com as próximas:</b> o IDEB combina fluxo e proficiência num número só, então rede que aprova todo mundo sobe o índice sem aprender mais. ${
    model.idebTargetIsNational
      ? "E a régua ao lado é a <b>referência nacional</b>, não um compromisso deste município: o INEP projetou metas por rede só até 2021."
      : "A régua ao lado é a meta que o INEP projetou para esta rede."
  } Matrícula em tempo integral e em educação especial não são só atendimento — são <b>fator de ponderação</b> no FUNDEB, e aparecem de novo na página da matrícula ponderada.${
    model.eja !== null && model.eja > 0
      ? ` A rede também mantém ${int(model.eja)} matrículas de EJA, que ponderam abaixo da urbana comum.`
      : ""
  }</div>${serie}<p class="micro mt-1">Fontes: INEP — Censo Escolar${
    model.enrollmentYear ? ` ${esc(model.enrollmentYear)}` : ""
  } (porte da rede) e divulgação do IDEB${
    model.idebSeries.length > 1
      ? `, edições de ${model.idebSeries[0].year} a ${model.idebSeries[model.idebSeries.length - 1].year}`
      : model.idebYear
        ? ` ${model.idebYear}`
        : ""
  }, para a rede municipal.</p></main>${footer(pagina, "INEP — Censo Escolar e IDEB")}</section>`;
}

/**
 * Resumo executivo — o que este município está perdendo, em ordem.
 *
 * Substituiu uma folha que terminava em "o município precisa ligar orçamento,
 * execução e resultado em uma mesma rotina de gestão" — frase idêntica para os
 * 5.570 municípios — e que repetia, como manchete, números que as páginas
 * seguintes trazem de novo. Ela pedia que o gestor lesse 40 páginas para
 * descobrir o que estava em jogo.
 *
 * Agora a página 2 diz e as 38 seguintes provam: cada linha aponta a seção que
 * a sustenta, pelo nome que está no cabeçalho da página.
 *
 * A regra do R$ mora em `municipal-xray-achados.ts` e vale aqui: só imprime
 * valor quando a fonte publicou aquele valor. Não há estimativa de "quanto se
 * ganharia" — um número inventado na página 2 contamina o dossiê inteiro.
 */
function paginaResumoExecutivo(model: MunicipalXrayModel, pagina: number): string {
  const achados = levantarAchados(model);
  const limpos = varreduraLimpa(model);
  const comValor = achados.filter((a) => a.valor !== null);

  // O contraponto da lista. Uma folha com dois achados parece varredura rasa
  // até o leitor ver quantos pontos foram conferidos — e nenhum desses itens
  // se acumula: habilitação e extrato são reavaliados todo exercício.
  const blocoLimpo =
    limpos.length === 0
      ? ""
      : `<div class="note mt-3"><b>Conferido e sem achado (${limpos.length}):</b> ${limpos
          .map((x) => esc(x))
          .join("; ")}. Nenhum destes se acumula — habilitação, extrato e meta são reavaliados a cada exercício.</div>`;
  const somaNomeada = comValor.reduce((t, a) => t + (a.valor ?? 0), 0);

  // Sintagmas nominais de propósito: o rótulo vem sempre precedido de contagem
  // ("2 em dinheiro já perdido"), e forma verbal concordaria errado no plural.
  const ROTULO_TIER: Record<number, string> = {
    [TIERS.perdido]: "em dinheiro já perdido neste exercício",
    [TIERS.datado]: "em perda com data marcada, ainda evitável",
    [TIERS.base]: "em base do fundo declarada abaixo da rede",
    [TIERS.resultado]: "em resultado que as condicionalidades observam",
  };

  // A régua da página, e o motivo de ela não somar tudo: só entra na soma o
  // que a fonte publicou em reais. Achado sem R$ publicado não vira zero — ele
  // aparece na grandeza que a fonte dá.
  const cabecalho =
    achados.length === 0
      ? `<div class="grid-4 mt-3">${metric(
          compactMoney(model.fundebCurrent),
          `FUNDEB ${model.currentYear}`,
        )}${metric(compactMoney(model.revenueCurrent), "receita realizada · parcial")}${metric(
          int(model.enrollments),
          `matrículas ${model.enrollmentYear ?? ""}`,
        )}${metric(int(model.schools), "escolas municipais")}</div>`
      : `<div class="grid-4 mt-3">${metric(String(achados.length), "achados nomeados")}${metric(
          // "nenhum", e não "—". O traço aparecia entre três números e lia-se
          // como campo que falhou; o fato é o oposto — nós sabemos a resposta,
          // e ela é que fonte nenhuma publicou valor. O template já usa
          // "nenhum" com esse sentido no bloco do piso do magistério.
          comValor.length > 0 ? compactMoney(somaNomeada) : "nenhum",
          "com valor publicado na fonte",
        )}${metric(
          String(achados.filter((a) => a.tier <= TIERS.datado).length),
          "em dinheiro perdido ou datado",
        )}${metric(compactMoney(model.fundebCurrent), `FUNDEB ${model.currentYear}`)}</div>`;

  if (achados.length === 0) {
    return `<section class="page content-page">${header("Resumo executivo")}<main class="page-body"><div class="kicker">Leitura central</div><h2>Nenhuma perda nomeável nas bases consultadas</h2><p class="lede">A varredura das fontes públicas não encontrou complementação zerada, pendência fiscal de educação, obra parada nem meta descumprida neste município. Isso não é atestado de gestão: significa que o achado, se existir, está em documento que não é público — e é isso que o Ofício de solicitação de documentos vai buscar.</p>${cabecalho}<div class="note mt-3"><b>O que isso muda na visita:</b> a conversa deixa de ser sobre corrigir perda e passa a ser sobre <b>ampliar base</b> — cobertura de creche, jornada integral e condição declarada na coleta, que são os três fatores de ponderação sob controle direto da secretaria.</div>${blocoLimpo}</main>${footer(pagina, "Síntese das fontes integradas ao Sync")}</section>`;
  }

  const linhas = achados
    .map((a) => {
      const cifra =
        a.valor !== null
          ? `<b>${esc(compactMoney(a.valor))}</b>`
          : a.medida
            ? `<b>${esc(a.medida)}</b>`
            : "—";
      return `<tr><td><b>${esc(a.titulo)}</b><div class="micro" style="margin-top:.02in">${a.mecanismo}</div></td><td class="num">${cifra}</td><td class="num micro">${esc(a.onde)}</td></tr>`;
    })
    .join("");

  const topo = achados[0];
  const grupos = [...new Set(achados.map((a) => a.tier))]
    .map((t) => `${achados.filter((a) => a.tier === t).length} ${ROTULO_TIER[t]}`)
    .join(" · ");

  return `<section class="page content-page">${header("Resumo executivo")}<main class="page-body"><div class="kicker">O que este município está perdendo</div><h2>${esc(topo.titulo)}</h2><p class="lede">${
    achados.length === 1
      ? "Um achado nomeado nas bases públicas, com a seção que o prova."
      : `${achados.length} achados nomeados nas bases públicas, em ordem de urgência: ${grupos}.`
  } ${
    comValor.length > 0
      ? `Só ${comValor.length === 1 ? "um deles tem" : `${comValor.length} deles têm`} valor publicado pela fonte — os demais saem na grandeza que a fonte dá, porque estimar reais aqui seria inventar.`
      : "Nenhum tem valor em reais publicado pela fonte, então todos saem na grandeza que a fonte dá — estimar aqui seria inventar."
  }</p>${cabecalho}<table class="mt-3"><thead><tr><th>Achado</th><th class="num">Tamanho</th><th class="num">Onde se prova</th></tr></thead><tbody>${linhas}</tbody></table>${blocoLimpo}<p class="micro mt-1"><b>Onde se prova</b> nomeia a seção que traz o dado, a fonte e o ano. Valor em reais só aparece quando a fonte o publicou: estimar ganho futuro dependeria do VAAF e do VAAT do exercício seguinte, que não existem na data desta emissão.</p></main>${footer(pagina, "Síntese das fontes integradas ao Sync")}</section>`;
}

function header(section: string) {
  return `<header class="page-header"><strong>Raio-X municipal</strong><span>${esc(section)}</span></header>`;
}

/**
 * Fontes efetivamente usadas nesta emissão, recolhidas do rodapé de cada folha.
 *
 * ## Por que existe
 *
 * A página de rastreabilidade listava só `metadata.fontes`, que vem do payload
 * legado. Todo módulo acrescentado depois — SIOPE, Portal da Transparência,
 * TSE, FUNAI, PNI, SINAN, SIDRA, QEdu, CAGED — lê a fonte direto e se credita
 * apenas no rodapé da própria página, sem nunca chegar naquela lista. Numa
 * emissão do Recife a folha 42 declarava 17 fontes enquanto o corpo do
 * documento usava pelo menos nove além delas.
 *
 * Numa página cujo título é "Rastreabilidade", subdeclarar é o pior defeito
 * possível: ela existe para dizer de onde veio cada número.
 *
 * ## Por que estado de módulo é seguro aqui
 *
 * `generateMunicipalXrayHtml` monta o HTML inteiro de forma **síncrona** — é
 * concatenação de string, sem `await` no meio. Duas emissões simultâneas no
 * mesmo processo não conseguem intercalar, e o array é zerado no começo de
 * cada uma. A folha de fontes é a última, então quando ela é avaliada todos os
 * rodapés anteriores já se registraram.
 */
let fontesDaEmissao: string[] = [];

/**
 * Rodapés que são legenda, não procedência. "Gerado pelo Sync em 31/07/2026"
 * não é fonte de dado nenhum.
 */
const RODAPES_SEM_PROCEDENCIA = [
  "Bases oficiais integradas ao Sync",
  "Síntese das fontes integradas ao Sync",
  "Síntese técnica gerada pelo Sync",
  "Metodologia Global Sync para leitura municipal",
];

function footer(page: number, source = "Bases oficiais integradas ao Sync") {
  if (!RODAPES_SEM_PROCEDENCIA.includes(source) && !source.startsWith("Gerado pelo Sync")) {
    fontesDaEmissao.push(source);
  }
  return `<footer class="page-footer"><span>${esc(source)}</span><span>${page}</span></footer>`;
}

/**
 * Instituição de origem de cada rodapé. Sem isto a lista viraria trinta e tantas
 * linhas quase iguais — "SIOPE / FNDE", "SIOPE / FNDE — RREO Anexo 8", "SIOPE /
 * FNDE — indicadores municipais" —, o que não cabe na folha e não informa mais.
 * Agrupar por origem e somar os detalhes cabe, e diz mais.
 */
const ORIGENS: Array<[RegExp, string]> = [
  [/SIOPE/i, "SIOPE / FNDE"],
  [/Portal da Transparência|\bCGU\b/i, "Portal da Transparência / CGU"],
  [/SICONFI|Tesouro Nacional|Siconfi/i, "SICONFI / Tesouro Nacional"],
  [/CNES|e-Gestor|DATASUS|\bPNI\b|SINAN|Ministério da Saúde/i, "Ministério da Saúde / DATASUS"],
  [/CadÚnico|Cadastro Único|\bMDS\b|SICON\b/i, "Cadastro Único / MDS"],
  [/Atlas da Violência|IPEA\/FBSP|\bFBSP\b/i, "IPEA / FBSP"],
  [/CAGED|Ipeadata/i, "Novo CAGED / MTE"],
  [/\bINEP\b|Censo Escolar|\bIDEB\b|Saeb|Inep/i, "INEP"],
  [/\bFNDE\b|PDDE|SIGARPWEB|SIGPC|Pacto de Retomada|VAAR|VAAT|FUNDEB/i, "FNDE"],
  [/\bIBGE\b|Censo 2022|MUNIC|Registro Civil|malhas/i, "IBGE"],
  [/\bTSE\b/i, "TSE"],
  [/FUNAI/i, "FUNAI"],
  [/QEdu/i, "QEdu"],
];

/**
 * A origem é a que aparece **primeiro no texto**, não a primeira que casa na
 * lista.
 *
 * A versão anterior percorria `ORIGENS` na ordem e devolvia o primeiro acerto.
 * Como um rodapé costuma citar duas instituições — "IBGE — Censo 2022 × FNDE",
 * "TSE — resultados das eleições" —, o resultado dependia da ordem em que eu
 * escrevi a lista, não do que o rodapé diz: o TSE foi arquivado dentro do IBGE
 * e cruzamentos IBGE×FNDE apareceram sob FNDE. Quem escreveu o rodapé pôs na
 * frente a fonte principal; é essa que manda.
 */
function origemDe(fonte: string): string | null {
  let melhor: { nome: string; posicao: number } | null = null;
  for (const [padrao, nome] of ORIGENS) {
    const encontro = fonte.match(padrao);
    if (encontro?.index === undefined) continue;
    if (!melhor || encontro.index < melhor.posicao) melhor = { nome, posicao: encontro.index };
  }
  return melhor?.nome ?? null;
}

/**
 * Tira só o **prefixo** com o nome da instituição, deixando o que distingue
 * aquela consulta: "SICONFI / Tesouro Nacional - DCA 2025" vira "DCA 2025".
 *
 * Antes isto apagava o token em qualquer posição, o que estraçalhava rodapés
 * que citam a instituição no meio da frase — sobravam pedaços como
 * "— e IBGE Censo 2022" e "— / , até 2022". Se a string não começa pela
 * origem, ela fica inteira: é mais longo e é legível, que é o que a folha
 * precisa ser.
 */
function detalheDe(fonte: string, origem: string): string | null {
  const tokens = origem.split(/\s*\/\s*/).map((t) => t.trim()).filter(Boolean);
  const escapado = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const prefixo = new RegExp(`^(?:${escapado})(?:\\s*[/e]\\s*(?:${escapado}))*[\\s/\\-–—·,:]*`, "i");

  const resto = fonte.replace(prefixo, "").replace(/^[\s/\-–—·,:]+|[\s/\-–—·,:]+$/g, "").replace(/\s{2,}/g, " ");
  if (resto.length <= 2) return null;
  // Nada foi retirado: o rodapé não começa pela origem. Devolve inteiro em vez
  // de fingir que o texto é um detalhe daquela instituição.
  return resto;
}

function linhasFontes(model: MunicipalXrayModel): string {
  const agrupado = new Map<string, Set<string>>();
  const soltas: string[] = [];

  // `model.sources` (o `metadata.fontes` legado) e os rodapés entram no mesmo
  // saco: são a mesma coisa vista de dois lugares, e a folha precisa da união.
  for (const fonte of [...model.sources, ...fontesDaEmissao]) {
    const limpa = fonte.trim();
    if (!limpa) continue;
    const origem = origemDe(limpa);
    if (!origem) {
      // Fonte que ainda não tem origem catalogada entra inteira, em vez de
      // sumir. Perder uma linha aqui é o defeito que esta função conserta.
      if (!soltas.includes(limpa)) soltas.push(limpa);
      continue;
    }
    const detalhe = detalheDe(limpa, origem);
    const conjunto = agrupado.get(origem) ?? new Set<string>();
    if (detalhe) conjunto.add(detalhe);
    agrupado.set(origem, conjunto);
  }

  if (agrupado.size === 0 && soltas.length === 0) {
    return `<li>Fontes públicas integradas ao Sync, consultadas na data de geração.</li>`;
  }

  const linhas = [...agrupado.entries()]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([origem, detalhes]) => {
      const lista = [...detalhes].sort((a, b) => a.localeCompare(b, "pt-BR"));
      return `<li><b>${esc(origem)}</b>${lista.length ? ` — ${esc(lista.join(" · "))}` : ""}</li>`;
    });

  return [...linhas, ...soltas.map((f) => `<li>${esc(f)}</li>`)].join("");
}

/**
 * O plano de ação sai dos mesmos achados do resumo executivo.
 *
 * Antes esta função enxergava quatro sinais — variação do FUNDEB, os dois
 * IDEBs e o item de infraestrutura com pior cobertura — e completava com um
 * item fixo ("sala de situação municipal") que entrava para qualquer
 * município, tivesse ele problema ou não. As 38 páginas de achado no meio do
 * dossiê não chegavam aqui.
 *
 * Agora a ordem é a mesma da página 2, então a última folha responde à
 * primeira: o que se perde, e o que fazer a respeito, com o prazo que a norma
 * ou o calendário da fonte impõe — não uma estimativa de esforço.
 *
 * Os dois itens genéricos sobreviveram como **preenchimento**, e só entram
 * quando a varredura devolve menos de três achados. Município sem perda
 * nomeável ainda merece uma próxima ação; o que não pode é conselho genérico
 * empurrando achado real para fora da lista.
 */
function priorityList(model: MunicipalXrayModel) {
  const priorities = levantarAchados(model).map((a) => ({
    title: a.acao,
    reason: a.titulo,
    horizon: a.prazo,
  }));

  if (priorities.length < 3) {
    const weakestInfra = [...model.infrastructure]
      .filter((item) => item.percent !== null)
      .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0];
    if (weakestInfra) {
      priorities.push({
        title: `Atacar a menor cobertura de infraestrutura: ${weakestInfra.name}`,
        reason: `Cobertura informada de ${pct(weakestInfra.percent)} na base escolar.`,
        horizon: "6–18 meses",
      });
    }
    priorities.push({
      title: "Montar a sala de situação municipal",
      reason: "Finanças, matrículas, aprendizagem e infraestrutura em indicadores auditáveis, num painel só.",
      horizon: "30 dias",
    });
  }

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

/**
 * Licenciaturas da lista da MUNIC — quem chegou à secretaria pela sala de aula.
 * Pedagogia fica fora porque é o caso mais forte e tem leitura própria.
 */
const LICENCIATURAS = new Set([
  "Geografia",
  "História",
  "Matemática",
  "Biologia",
  "Letras",
  "Educação Física",
]);

/**
 * Quem dirige a educação — qualificação do titular e posição no organograma.
 *
 * A MUNIC publica a escolaridade e a área de formação do titular do órgão
 * gestor (tabela 7296). Para quem vai sentar na mesa, isso muda o registro da
 * conversa: um secretário formado em Pedagogia discute ponderação e coleta em
 * outro nível que um formado em Direito, e nenhum dos dois é demérito — é
 * calibragem de linguagem técnica.
 *
 * Duas coisas a MUNIC **não** pergunta, e por isso viram pergunta de campo com
 * o contexto dentro: **há quanto tempo** o titular está no cargo (não existe
 * variável de posse ou rotatividade em nenhum dos 187 agregados nem nas 200
 * colunas da planilha 2021) e a participação em **consórcio intermunicipal de
 * educação** — conferido em 2026-07-29, o único agregado de consórcio em todo o
 * SIDRA é de saneamento, e o cadastro de entes do SICONFI só tem municípios,
 * estados, União e DF.
 */
function paginaQuemDirige(model: MunicipalXrayModel, pagina: number): string {
  const g = model.profile?.governancaEducacional;
  const FONTE = "IBGE — MUNIC, módulo educação (SIDRA 7282 e 7296)";

  if (!g) {
    return `<section class="page content-page">${header("Quem dirige a educação")}<main class="page-body"><div class="kicker">Comando e qualificação</div><h2>Perfil do órgão gestor indisponível</h2><p class="lede">A MUNIC não retornou o módulo de educação para este município.</p></main>${footer(pagina, FONTE)}</section>`;
  }

  const instrucao = g.titularNivelInstrucao.valor;
  const formacao = g.titularAreaFormacao.valor;
  const estrutura = g.estruturaOrgaoGestor.valor;
  const anoMunic = g.titularAreaFormacao.ano ?? g.estruturaOrgaoGestor.ano;

  const nd = (v: string | null) => (v === null ? `<span class="neutral">N/D</span>` : `<b>${esc(v)}</b>`);

  // "Outra" é a categoria residual da MUNIC — quer dizer "fora das onze áreas
  // listadas", não o nome de um curso. Imprimir "formado em Outra" seria ler o
  // rótulo como se fosse resposta.
  const formacaoResidual = formacao === "Outra";
  const formacaoNomeavel = formacao !== null && !formacaoResidual;

  let leituraFormacao: string;
  if (formacao === null) {
    leituraFormacao = `A MUNIC não registrou a área de formação do titular nesta edição. <b>Pergunta de campo:</b> qual a formação e a trajetória de quem hoje dirige a secretaria?`;
  } else if (formacaoResidual) {
    leituraFormacao = `A MUNIC classifica a formação do titular como <b>"Outra"</b> — fora das dez áreas que a pesquisa nomeia (Pedagogia, Letras, História, Geografia, Matemática, Biologia, Educação Física, Direito, Administração e Psicologia). Qual é, a pesquisa não diz, e por isso não dá para inferir se o titular vem da educação. <b>Pergunta de campo:</b> qual a formação e a trajetória de quem dirige a secretaria?`;
  } else if (formacao === "Pedagogia") {
    leituraFormacao = `Formação em <b>Pedagogia</b> — a área que estuda gestão educacional, currículo e avaliação. A conversa técnica sobre ponderação, coleta do Censo e condicionalidades do VAAR pode ir direto ao ponto, sem tradução.`;
  } else if (LICENCIATURAS.has(formacao)) {
    leituraFormacao = `Formação em <b>${esc(formacao)}</b> — licenciatura: o titular provavelmente chegou à gestão pela sala de aula. Conhece a escola por dentro; a ponte a construir é entre a experiência docente e a mecânica financeira do fundo, que é outro vocabulário.`;
  } else {
    leituraFormacao = `Formação em <b>${esc(formacao)}</b>, fora da área de educação. Não é demérito — secretarias são cargos políticos e administrativos —, mas muda o registro: os conceitos de ponderação, VAAT e coleta do Censo provavelmente precisam ser apresentados desde a base, e a equipe técnica da secretaria passa a ser o interlocutor da conversa fina.`;
  }

  const superior =
    instrucao !== null &&
    ["Superior completo", "Especialização", "Mestrado", "Doutorado"].includes(instrucao);

  const exclusiva = estrutura !== null && estrutura.startsWith("Secretaria municipal exclusiva");
  const subordinado = estrutura !== null && estrutura.startsWith("Setor subordinado");

  return `<section class="page content-page">${header("Quem dirige a educação")}<main class="page-body"><div class="kicker">Comando e qualificação</div><h2>${
    formacaoNomeavel
      ? `A secretaria é dirigida por alguém formado em ${esc(formacao as string)}`
      : formacaoResidual
        ? "A formação de quem dirige a educação está fora da lista da MUNIC"
        : "O comando da educação no organograma"
  }</h2><p class="lede">Quem decide, com que formação e em que posição do organograma. Não é curiosidade: define com quem se negocia, em que vocabulário, e quanto poder de decisão a pessoa tem sem passar por outra pasta. Dados da MUNIC${anoMunic ? ` ${anoMunic}` : ""}, a pesquisa de estrutura municipal do IBGE.</p><div class="grid-4 mt-3">${metric(
    instrucao === null ? "N/D" : esc(instrucao),
    "escolaridade do titular",
  )}${metric(
    formacao === null ? "N/D" : formacaoResidual ? "Outra área" : esc(formacao),
    "área de formação",
  )}${metric(
    estrutura === null ? "N/D" : esc(estrutura.startsWith("Secretaria municipal") ? "Secretaria" : "Setor subordinado"),
    "posição no organograma",
  )}${metric(anoMunic === null ? "N/D" : String(anoMunic), "edição da MUNIC")}</div><div class="grid-2 mt-3"><div class="card accent"><h3>A qualificação de quem decide</h3><table><tbody><tr><td>Escolaridade</td><td class="num">${nd(instrucao)}</td></tr><tr><td>Área de formação</td><td class="num">${nd(formacao)}</td></tr><tr><td>Posição da educação no organograma</td><td class="num">${nd(estrutura)}</td></tr></tbody></table><div class="divider"></div><p class="small">${leituraFormacao}</p>${
    superior
      ? ""
      : instrucao === null
        ? ""
        : `<p class="small" style="margin-top:.05in">Escolaridade declarada abaixo do superior completo. A lei não exige diploma para o cargo, mas a interlocução técnica tende a acontecer com a equipe da secretaria — vale identificar quem é, logo na primeira visita.</p>`
  }</div><div class="card ${subordinado ? "warn" : ""}"><h3>Quanto a pasta decide sozinha</h3><p class="small">${
    exclusiva
      ? `A educação tem <b>secretaria exclusiva</b>: orçamento, equipe e agenda próprios, e o titular responde direto ao prefeito. É o arranjo com menos atrito para executar o que for pactuado.`
      : subordinado
        ? `A educação é <b>setor subordinado</b>, não secretaria própria. Consequência prática: decisão de gasto, contratação e assinatura passam por outra autoridade — o cronograma de qualquer entrega precisa contar com esse passo a mais, e a reunião de fechamento precisa da pessoa que assina, não só da que opera.`
        : estrutura !== null
          ? `Arranjo declarado: <b>${esc(estrutura)}</b>. Confirmar quem tem ordenação de despesa e quem assina convênio — é isso que determina o caminho de aprovação.`
          : `A MUNIC não registrou a caracterização do órgão gestor. <b>Confirmar na visita:</b> a educação é secretaria exclusiva, divide pasta com outra política, ou é setor subordinado?`
  }</p><div class="divider"></div><p class="small"><b>Vale lembrar:</b> a MUNIC é pesquisa estrutural e a edição de educação é de ${anoMunic ?? "2021"}. Eleição municipal troca secretário — o dado abaixo pode ter mudado, e confirmar isso é a primeira pergunta da visita.</p></div></div><div class="note mt-3"><b>O que a fonte não sustenta — e por isso é pergunta de campo:</b> a MUNIC <b>não</b> pergunta há quanto tempo o titular está no cargo, nem quantos secretários passaram pela pasta no mandato. Rotatividade alta é o maior preditor de projeto interrompido, e não existe base pública dela. <b>Perguntar:</b> quantos secretários de educação o município teve nos últimos quatro anos, e há quanto tempo o atual assumiu? Quem é o quadro técnico que permanece entre uma troca e outra?</div><div class="note mt-2"><b>Consórcio intermunicipal de educação:</b> também sem fonte pública. Em 2026-07-29 varremos o catálogo inteiro do SIDRA — o único agregado de consórcio é de saneamento — e o cadastro de entes do SICONFI só registra municípios, estados, União e DF. <b>Perguntar:</b> o município participa de consórcio intermunicipal para compra de merenda, transporte escolar ou formação de professores? Consórcio muda escala de compra e é caminho conhecido para baratear rota longa${
    model.schoolMap && model.schoolMap.ruralCount > 0 ? ` — e esta rede tem ${int(model.schoolMap.ruralCount)} escolas rurais` : ""
  }.</div><p class="small mt-1">Fonte: IBGE, Pesquisa de Informações Básicas Municipais (MUNIC)${anoMunic ? ` ${anoMunic}` : ""} — tabelas SIDRA 7282 (caracterização do órgão gestor) e 7296 (instrução e área de formação do titular). A MUNIC é declaratória: responde a prefeitura.</p></main>${footer(pagina, FONTE)}</section>`;
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
  return `<section class="page content-page">${header("Conformidade legal")}<main class="page-body"><div class="kicker">Pisos constitucionais e legais</div><h2>Os dois números que reprovam a prestação de contas</h2><p class="lede">Descumprir qualquer um dos dois pisos abre parecer prévio contrário no Tribunal de Contas. Exercício de referência: ${c.exercicio ?? "N/D"}.</p><div class="grid-2 mt-3"><div class="${mde.classe}"><h3>MDE — Manutenção e Desenvolvimento do Ensino</h3><div class="metric-value ${mde.chip}">${esc(pct(c.mdeAplicado.valor))}</div><p class="small">${esc(mde.texto)} · art. 212 da Constituição</p><div class="divider"></div><table><tbody><tr><td>Receita de impostos</td><td class="num">${esc(money(c.receitaImpostos.valor))}</td></tr><tr><td>Despesa em MDE</td><td class="num">${esc(money(c.despesaMde.valor))}</td></tr></tbody></table></div><div class="${fundeb.classe}"><h3>FUNDEB — remuneração dos profissionais</h3><div class="metric-value ${fundeb.chip}">${esc(pct(c.fundebRemuneracao.valor))}</div><p class="small">${esc(fundeb.texto)} · art. 26 da Lei 14.113/2020</p><p class="micro">Os 70% alcançam <b>todos os profissionais da educação básica em efetivo exercício</b> — inclusive apoio técnico, administrativo e operacional —, não apenas o magistério. Os 60% restritos ao magistério eram a regra do FUNDEB anterior (Lei 11.494/2007), já revogada.</p><div class="divider"></div><table><tbody><tr><td>Base do FUNDEB<div class="micro">exclui a complementação VAAR</div></td><td class="num">${esc(money(c.fundebRecebido.valor))}</td></tr><tr><td>Aplicado em remuneração</td><td class="num">${esc(money(c.fundebRemuneracaoValor.valor))}</td></tr></tbody></table></div></div><div class="insight mt-3"><b>Como conferir:</b> os quatro valores acima são as parcelas exatas das duas contas. Divida despesa por receita e remuneração por base para reproduzir os percentuais na frente do cliente.</div><div class="note mt-3"><b>Procedência:</b> ${esc(c.mdeAplicado.fonte)}. O RREO Anexo 8 não trafega no SICONFI — MDE é declarado ao SIOPE, e é de lá que estes números vêm.</div></main>${footer(pagina, "SIOPE / FNDE — RREO Anexo 8")}</section>`;
}

// ---------------------------------------------------------------------------
// FUNDEB profundo — complementações, ponderação, ganho e vinculações
// ---------------------------------------------------------------------------

/**
 * Por que cada complementação se perde.
 *
 * A página nasceu de uma reunião real: um prefeito atribuiu a perda do VAAR a
 * "uma questão fiscal". Não existe essa hipótese — os 22 textos de pendência
 * publicados pelo FNDE em 2026 citam apenas condicionalidades do art. 14, §1º
 * ou ausência de evolução nos indicadores. Questão fiscal derruba **outra**
 * parcela, o VAAT (art. 13, §4º). Quem mistura as duas corrige o que não está
 * quebrado e deixa quebrado o que trava — e esta página existe para desfazer a
 * confusão na frente do gestor, com o texto oficial do FNDE impresso.
 */
/**
 * Pontualidade fiscal — a previsão, não a autópsia.
 *
 * As datas reais das últimas DCAs contra os dois prazos que importam (30/4 da
 * LRF e o corte de 31/8 do VAAT), cruzadas com o lado SIOPE
 * (`model.siope.stale`). É a resposta a "vamos perder o VAAT?".
 *
 * Mora na página do CAUC, não na das complementações: as duas falam de
 * requisito fiscal que trava repasse, e a das complementações não tinha altura
 * para as duas coisas — estourava a folha em todo município de porte médio
 * para cima.
 */
function blocoPontualidadeFiscal(model: MunicipalXrayModel): string {
  const f = model.fiscalTimeliness;
  if (!f) return "";

  const dataCurta = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("pt-BR").format(new Date(iso)) : "não entregue";
  const rotuloRisco = { alto: "ALTO", medio: "MÉDIO", baixo: "BAIXO" } as const;
  const siopeAtrasado = model.siope?.stale === true;

  return `<div class="grid-2 mt-3"><div class="card ${f.risk === "alto" ? "bad" : f.risk === "medio" ? "warn" : "accent"}"><h3>Risco de perder o VAAT — lado Siconfi: ${rotuloRisco[f.risk]}</h3><table><tbody>${f.dca
        .map(
          (d) => `<tr><td>DCA ${d.year}</td><td class="num">${esc(dataCurta(d.deliveredAt))}</td><td class="num">${
            d.missedVaatCutoff === true
              ? `<b class="warn-text">após o corte de 31/8</b>`
              : d.daysPastDue !== null && d.daysPastDue > 0
                ? `<b class="warn-text">+${integer.format(d.daysPastDue)}d além de 30/4</b>`
                : d.deliveredAt
                  ? `<b class="good">no prazo</b>`
                  : `<span class="neutral">prazo em aberto</span>`
          }</td></tr>`,
        )
        .join("")}</tbody></table><p class="small" style="margin-top:.06in">${
        f.risk === "alto"
          ? "Uma DCA além de 31/8 é exatamente o cenário que inabilita ao VAAT. O padrão precisa mudar neste exercício."
          : f.risk === "medio"
            ? "A DCA tem saído após 30/4 (LRF, art. 51). Ainda dentro do corte do VAAT — mas o hábito do atraso é o aviso: no ano apertado ele vira estouro."
            : "As DCAs recentes saíram no prazo. O risco de inabilitação pelo lado Siconfi está controlado — manter a rotina."
      }</p></div><div class="card ${siopeAtrasado ? "warn" : ""}"><h3>O outro lado do corte: SIOPE</h3><p class="small">A trava do art. 13, §4º exige os dados <b>no Siconfi e no SIOPE</b>. ${
        siopeAtrasado
          ? "E aqui há sinal amarelo: o município <b>não consta com declaração no exercício de referência</b> do SIOPE — os indicadores desta edição vieram do ano anterior. Siconfi em dia não salva a habilitação se o SIOPE não fechar."
          : model.siope
            ? "A declaração ao SIOPE consta no exercício de referência — os dois lados do corte estão cobertos até aqui."
            : "Não foi possível ler a situação da declaração ao SIOPE nesta emissão; conferir diretamente no sistema."
      }</p><p class="micro" style="margin-top:.05in">Prazos: DCA até 30/4 (LRF, art. 51, §1º, I); Siconfi e SIOPE até 31/8 para habilitar ao VAAT do exercício seguinte (Lei nº 14.113/2020, art. 13, §4º). Datas lidas do extrato de entregas do Tesouro na emissão.</p></div></div>`;
}

function paginaComplementacoes(model: MunicipalXrayModel, pagina: number): string {
  const v = model.vaar;
  const t = model.vaat;

  const statusVaar = !v
    ? "Sem dado nas bases consultadas"
    : v.stateWideFailure
      ? "R$ 0 — reprovação do estado (Cond. IV)"
      : !v.qualified
        ? `R$ 0 — reprovado em ${v.failed.length} condicionalidade${v.failed.length === 1 ? "" : "s"}`
        : v.beneficiary
          ? `${compactMoney(v.amount)} recebidos`
          : "Habilitado, sem repasse (sem evolução)";

  const vaatInabilitado = /inabilit|n[aã]o habilit/i.test(t?.status ?? "");
  const statusVaat = t ? t.status : "Sem dado nas bases consultadas";

  const cardPendencia = v?.pendency
    ? `<div class="card warn mt-3"><h3>O motivo oficial, nas palavras do FNDE</h3><p>&ldquo;${esc(v.pendency)}&rdquo;</p><div class="divider"></div><p class="small">Texto publicado pelo FNDE na lista de habilitação do VAAR${v.year ? ` ${v.year}` : ""}. Os incisos são as condicionalidades do art. 14, §1º: I — gestão escolar por mérito; II — 80% no Saeb; III — redução das desigualdades de aprendizagem; IV — ICMS educacional (aferido no estado); V — currículo alinhado à BNCC. <b>Nenhum é fiscal.</b></p></div>`
    : "";

  const numerosVaat = t && t.minimum !== null && t.minimum > 0
    ? `<div class="grid-3 mt-3">${metric(money(t.perStudent), "VAAT próprio por aluno")}${metric(money(t.minimum), `VAAT-MIN${t.year ? ` ${t.year}` : ""}`)}${metric(
        t.distancePct !== null && t.distancePct > 0 ? pct(t.distancePct) : "N/D",
        "distância até o mínimo",
      )}</div><p class="small mt-1">O cálculo usa a arrecadação do <b>penúltimo exercício</b> (art. 15, II)${t.revenueBaseYear ? ` — a base atual é ${t.revenueBaseYear}` : ""}, então a saída da faixa é previsível com dois anos de antecedência.</p>`
    : "";

  return `<section class="page content-page">${header("Complementações da União")}<main class="page-body"><div class="kicker">FUNDEB · onde a receita se perde</div><h2>Cada complementação se perde por um motivo diferente</h2><p class="lede">VAAF é fórmula e não se perde. VAAT se perde por <b>habilitação fiscal</b>. VAAR se perde por <b>condicionalidade de resultado</b>. Diagnosticar a parcela errada é corrigir o que não está quebrado — e deixar quebrado o que trava.</p><div class="grid-3 mt-3"><div class="card accent"><h3>VAAF</h3><p class="small">Equalização por fórmula dentro da UF. Todo ente abaixo do VAAF-MIN recebe automaticamente (art. 21). <b>Não existe perda por pendência</b> — o valor só muda com matrícula ponderada e arrecadação.</p></div><div class="card ${vaatInabilitado ? "bad" : "accent"}"><h3>VAAT</h3><div class="metric-value" style="font-size:11pt">${esc(statusVaat)}</div><p class="small">Condição única e <b>fiscal</b> (art. 13, §4º): dados no Siconfi e no SIOPE até <b>31 de agosto</b>. Inabilitado perde <b>100%</b> da complementação do exercício.${
    t?.pendency ? ` <b>Pendência registrada:</b> <i>${esc(t.pendency)}</i>.` : ""
  }</p></div><div class="card ${v && !v.qualified ? "bad" : "accent"}"><h3>VAAR</h3><div class="metric-value" style="font-size:11pt">${esc(statusVaar)}</div><p class="small">Cinco condicionalidades de resultado (art. 14, §1º), aferidas todo ano. Reprovar em <b>uma</b> zera a parcela inteira. Rateio proporcional à evolução dos indicadores.</p></div></div>${cardPendencia}<div class="insight mt-3"><b>&ldquo;Perdemos o VAAR por questão fiscal&rdquo; — essa frase mistura duas parcelas.</b> Pendência fiscal nunca derruba o VAAR: as causas são só as cinco condicionalidades acima${v?.pendency ? ", e a deste município está impressa ao lado" : ""}. O que ela derruba é a <b>habilitação VAAT</b> do exercício seguinte, os <b>convênios</b> via CAUC e a aprovação das <b>contas</b> no tribunal. O repasse do FUNDEB em si é automático (art. 21).</div>${numerosVaat}</main>${footer(pagina, "FNDE e Tesouro Nacional — habilitação VAAR/VAAT")}</section>`;
}

/**
 * Matrícula ponderada e ganho apurado.
 *
 * A receita do fundo é Σ(matrícula × fator), não matrícula — e as lacunas de
 * declaração têm preço calculável: fator legal × valor aluno/ano da UF ×
 * matrícula que o próprio município declarou, ancorado na mediana nacional
 * (não no teto, que produziria cifras que a base não sustenta).
 */
function paginaGanhoApurado(model: MunicipalXrayModel, pagina: number): string {
  const w = model.weighting;
  const g = model.gain;

  if (!w && !g) {
    return `<section class="page content-page">${header("Matrícula ponderada")}<main class="page-body"><div class="kicker">FUNDEB · o denominador real</div><h2>Ponderação indisponível</h2><p class="lede">A planilha de matrículas ponderadas do FNDE não trouxe este município no exercício consultado. Sem ela não há como monetizar lacuna de declaração — o relatório omite o número em vez de estimá-lo.</p></main>${footer(pagina, "FNDE — matrículas ponderadas do FUNDEB")}</section>`;
  }

  const componentes = (g?.components ?? []).filter((c) => c.value > 0);
  const referencias = g?.references ?? [];

  const cards = componentes.length
    ? componentes
        .map(
          (c) => `<div class="card accent"><h3>${esc(c.title)}</h3><div class="metric-value good" style="font-size:15pt">+${esc(compactMoney(c.value))}/ano</div><div class="divider"></div><p class="small">${esc(c.origin)}</p><p class="small mt-1"><b>Antes de tratar como recuperável:</b> ${esc(c.verify)}</p></div>`,
        )
        .join("")
    : `<div class="card"><h3>Sem lacuna de declaração a monetizar</h3><p class="small">A rede declara na mediana nacional ou acima nos dois pontos verificáveis — jornada da creche e cobertura de AEE. É resultado bom, não falta de dado.</p></div>`;

  const refCards = referencias
    .map(
      (r) => `<div class="card warn"><h3>${esc(r.title)} · referência</h3><div class="metric-value" style="font-size:15pt">${esc(compactMoney(r.value))}</div><div class="divider"></div><p class="small">${esc(r.origin)}</p><p class="small mt-1">${esc(r.verify)}</p></div>`,
    )
    .join("");

  return `<section class="page content-page">${header("Ponderação e ganho apurado")}<main class="page-body"><div class="kicker">FUNDEB · o denominador real</div><h2>A receita segue a matrícula ponderada — e a lacuna de declaração tem preço</h2><p class="lede">O fundo paga Σ(matrícula × fator), com fatores de 1,00 a 2,17. O ganho apurado abaixo é cálculo, não cenário: fator legal × valor aluno/ano da UF × matrícula que o próprio município declarou ao Censo, medindo a distância até a <b>mediana nacional</b> das redes municipais.</p><div class="grid-4 mt-3">${metric(w ? int(w.enrollment) : "N/D", "matrículas · filtragem FNDE")}${metric(w ? int(Math.round(w.weighted)) : "N/D", "matrículas-equivalentes")}${metric(
    w?.avgFactor ? w.avgFactor.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : "N/D",
    "fator médio · referência 1,000",
  )}${metric(g ? (g.total > 0 ? `+${compactMoney(g.total)}` : "sem lacuna") : "N/D", "ganho apurado por ano")}</div><div class="grid-2 mt-3">${cards}${refCards}</div><div class="note mt-3"><b>Por que a mediana, e não o teto:</b> supor toda creche integral e AEE para todo aluno de educação especial produziria cifras que a base não sustenta — só 28% das redes declaram a creche toda em integral e só 17% têm cobertura integral de AEE. O valor por matrícula-equivalente${g && g.perEquivalent > 0 ? ` na sua UF é ${money(g.perEquivalent)}` : " vem da Portaria Interministerial"}: é o valor aluno/ano do segmento de fator 1,00 (art. 7º, §1º).</div></main>${footer(pagina, "FNDE — matrículas ponderadas e Portaria Interministerial")}</section>`;
}

/**
 * As vinculações da educação e o piso do magistério.
 *
 * A página de conformidade do Perfil cobre MDE e os 70% com as parcelas
 * exatas. Esta cobre o resto: as 14 vinculações que o SIOPE apura — capital do
 * VAAT, IEI, teto de 10% não aplicado, destinação de 20% — e a adimplência ao
 * piso, que não existe em painel federal nenhum.
 */
function paginaVinculacoes(model: MunicipalXrayModel, pagina: number): string {
  const s = model.siope;
  const p = model.teacherPay;

  if (!s) {
    return `<section class="page content-page">${header("Vinculações da educação")}<main class="page-body"><div class="kicker">FUNDEB · execução</div><h2>Declaração ao SIOPE não localizada</h2><p class="lede">O SIOPE não devolveu indicadores para este município nos dois últimos exercícios. A ausência é, em si, um achado: o registro é obrigatório em até 30 dias do fim de cada bimestre (art. 38, §1º) e a omissão em 31 de agosto inabilita o município ao VAAT do exercício seguinte.</p></main>${footer(pagina, "SIOPE / FNDE")}</section>`;
  }

  const fmt = (valor: number, unit: "percentual" | "reais") =>
    unit === "reais" ? money(valor) : `${decimal.format(valor)}%`;

  const linhas = s.indicators
    .map((ind) => {
      const marca = ind.compliant === true ? `<b class="good">✓</b>` : ind.compliant === false ? `<b class="warn-text">✕</b>` : `<span class="neutral">·</span>`;
      // "—" dizia duas coisas incompatíveis: "não existe parâmetro legal" e
      // "não conseguimos apurar". São opostos — a primeira é uma propriedade da
      // norma, a segunda é uma falha nossa —, e o leitor não tinha como
      // distinguir. Aqui só a primeira pode ocorrer: indicador não apurado não
      // vira linha nenhuma, ele entra na lista de não declarados abaixo da
      // tabela. Então a célula diz o que de fato é.
      const parametro = ind.limit !== null && ind.direction ? `${ind.direction === "min" ? "mín." : "máx."} ${fmt(ind.limit, ind.unit)}` : `<span class="neutral">descritivo</span>`;
      const folga = ind.slack === null ? `<span class="neutral">—</span>` : `${ind.slack < 0 ? "−" : "+"}${fmt(Math.abs(ind.slack), ind.unit)}`;
      return `<tr><td class="num">${marca}</td><td>${esc(ind.label)}${ind.basis ? `<div class="micro">${esc(ind.basis)}</div>` : ""}</td><td class="num"><b>${esc(fmt(ind.value, ind.unit))}</b></td><td class="num">${parametro}</td><td class="num">${folga}</td></tr>`;
    })
    .join("");

  const descumpridas = s.indicators.filter((ind) => ind.compliant === false).length;
  const descritivos = s.indicators.filter((ind) => ind.limit === null).length;

  /**
   * O que a tabela não mostra — e antes não dizia que não mostrava.
   *
   * Duas ausências convivem nesta página e precisam ficar separadas. Uma é
   * "descritivo": indicador sem parâmetro legal, porque é grandeza em reais ou
   * repartição por etapa — não há dever a cumprir. A outra é o município **não
   * ter declarado** o indicador; aí a linha não existe, e a tabela passava a
   * impressão de estar completa. Numa emissão do Recife faltaram 5 dos 13
   * indicadores municipais sem que nada na folha dissesse isso.
   */
  const blocoLacunas = `${descritivos > 0 ? `<p class="small mt-2"><b>Descritivo</b> marca o indicador que a norma não sujeita a percentual — valor por aluno, saldo em reais, repartição por etapa. Não é dado faltante: toda vinculação com dever legal aparece com ✓ ou ✕.</p>` : ""}${
    s.undeclared.length > 0
      ? `<p class="small mt-1"><b class="warn-text">${int(s.undeclared.length)} indicador${s.undeclared.length === 1 ? "" : "es"} sem declaração:</b> ${s.undeclared.map((u) => esc(u.label)).join(" · ")}. O registro no SIOPE é obrigatório em até 30 dias do fim de cada bimestre (art. 38, §1º) — a lacuna é achado, não silêncio da fonte.</p>`
      : `<p class="small mt-1">Os ${int(s.indicators.length)} indicadores municipais do catálogo foram declarados — não há lacuna de registro neste exercício.</p>`
  }`;

  const blocoPiso = p
    ? `<div class="grid-4 mt-3">${metric(money(p.floor), "piso nacional · 40h")}${metric(
        p.reliable && p.median !== null ? money(p.median) : "N/D",
        p.reliable && p.ratio !== null ? `mediana do magistério · ${decimal.format(p.ratio)}× o piso` : "mediana · jornada não comparável",
      )}${metric(
        !p.reliable ? "N/D" : p.belowPct !== null && p.belowPct > 0 ? pct(p.belowPct) : "nenhum",
        p.reliable ? `abaixo do piso · ${int(p.below)} de ${int(p.sampled)}` : "abaixo do piso · não apurável",
      )}${metric(int(p.declared), `magistério declarado${p.year ? ` · ${p.year}` : ""}`)}</div><p class="small mt-1">Salários proporcionalizados à jornada de 40h (art. 2º, §3º da Lei nº 11.738/2008). A fórmula do piso mudou em 2026 (Lei nº 15.437/2026) e o art. 4º — a complementação da União a quem não tivesse caixa — foi <b>revogado</b>: o custo do piso é integralmente do município.</p>`
    : `<p class="small mt-3"><b>Piso do magistério:</b> declaração de remuneração não localizada no SIOPE para este município.</p>`;

  return `<section class="page content-page">${header("Vinculações da educação")}<main class="page-body"><div class="kicker">FUNDEB · o que precisa ser cumprido para usar o recurso</div><h2>${descumpridas === 0 ? "Vinculações cumpridas na última declaração" : `${descumpridas} vinculaç${descumpridas === 1 ? "ão descumprida" : "ões descumpridas"} na última declaração`}</h2><p class="lede">Percentuais apurados pelo próprio SIOPE${s.year ? ` na declaração de ${s.year}` : ""}${s.stale ? " — o município não declarou o exercício de referência; os números são do anterior" : ""}. Descumprir <b>não trava o FUNDEB</b> (o repasse é automático, art. 21): trava convênio via CAUC e vicia a prestação de contas no tribunal.</p><table class="mt-3"><thead><tr><th></th><th>Vinculação</th><th class="num">Apurado</th><th class="num">Parâmetro</th><th class="num">Folga</th></tr></thead><tbody>${linhas}</tbody></table>${blocoLacunas}${blocoPiso}</main>${footer(pagina, "SIOPE / FNDE — indicadores municipais e remuneração")}</section>`;
}

/**
 * Gêmeos estatísticos.
 *
 * "Abaixo da média nacional" não convence gestor nenhum — a média nacional
 * inclui São Paulo. O que não tem contra-argumento de contexto é a posição
 * entre os municípios de rede do mesmo porte: mesmo tamanho de máquina, mesmo
 * tipo de problema. O percentil aqui é sempre sobre essa coorte.
 */
function paginaGemeos(model: MunicipalXrayModel, pagina: number): string {
  const t = model.twins;

  if (!t || t.indicators.length === 0) {
    return `<section class="page content-page">${header("Entre os seus iguais")}<main class="page-body"><div class="kicker">Comparação por porte</div><h2>Coorte de comparação indisponível</h2><p class="lede">Os datasets locais não trouxeram este município, então não há coorte de porte para comparar sem misturar apurações diferentes.</p></main>${footer(pagina, "Datasets FNDE/SIOPE integrados ao Sync")}</section>`;
  }

  const fmtValor = (valor: number, unit: "percentual" | "reais" | "fator" | "indice") =>
    unit === "reais"
      ? compactMoney(valor)
      : unit === "fator"
        ? valor.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
        : // O IDEB é escala de uma casa: com o formato de `fator` saía "5,900",
          // que lê como outra grandeza. Auditoria do Raio-X de Fortaleza.
          unit === "indice"
          ? decimal.format(valor)
          : `${decimal.format(valor)}%`;

  // Nota de leitura por direção: percentil alto é bom quando maior é melhor,
  // ruim quando menor é melhor, e só informativo no neutro.
  const posicao = (ind: (typeof t.indicators)[number]) => {
    if (ind.direction === "neutro") return `<span class="neutral">p${ind.percentile}</span>`;
    const bom = ind.direction === "maior-melhor" ? ind.percentile >= 55 : ind.percentile <= 45;
    const ruim = ind.direction === "maior-melhor" ? ind.percentile <= 25 : ind.percentile >= 75;
    const classe = ruim ? "warn-text" : bom ? "good" : "neutral";
    return `<b class="${classe}">p${ind.percentile}</b>`;
  };

  const linhas = t.indicators
    .map(
      (ind) => `<tr><td>${esc(ind.label)}</td><td class="num"><b>${esc(fmtValor(ind.value, ind.unit))}</b></td><td class="num">${esc(fmtValor(ind.cohortMedian, ind.unit))}</td><td class="num">${ind.stateMedian === null ? "—" : esc(fmtValor(ind.stateMedian, ind.unit))}</td><td class="num">${posicao(ind)}</td></tr>`,
    )
    .join("");

  // O achado da página: a pior posição entre os indicadores direcionais.
  const direcionais = t.indicators.filter((ind) => ind.direction !== "neutro");
  const pior = [...direcionais].sort((a, b) => {
    const notaA = a.direction === "maior-melhor" ? a.percentile : 100 - a.percentile;
    const notaB = b.direction === "maior-melhor" ? b.percentile : 100 - b.percentile;
    return notaA - notaB;
  })[0];
  const notaPior = pior ? (pior.direction === "maior-melhor" ? pior.percentile : 100 - pior.percentile) : null;

  const vaarLinha =
    t.vaarCohortPct !== null
      ? `<div class="${t.vaarQualified === false ? "risk" : "insight"} mt-3"><b>VAAR entre os iguais:</b> ${t.vaarCohortPct}% da coorte está habilitada à complementação de resultado — e este município ${
          t.vaarQualified === true ? "<b>está entre os que captam</b>" : t.vaarQualified === false ? "<b>não capta</b>" : "não tem situação informada"
        }.${t.vaarQualified === false && t.vaarCohortPct >= 50 ? " Quando a maioria dos semelhantes consegue, o argumento de contexto acaba: a diferença é gestão da condicionalidade, não porte." : ""}</div>`
      : "";

  return `<section class="page content-page">${header("Entre os seus iguais")}<main class="page-body"><div class="kicker">Comparação por porte de rede</div><h2>Onde este município está entre os ${t.cohortSize} mais parecidos</h2><p class="lede">A coorte são os ${t.cohortSize} municípios do país com rede entre ${int(t.rangeMin)} e ${int(t.rangeMax)} matrículas — o porte de ${esc(model.municipality)} (${int(t.enrollment)}). Comparar com a média nacional é comparar com as capitais; comparar com os iguais elimina a desculpa e o mérito falsos. <b>p75</b> = valor maior ou igual ao de 75% dos semelhantes.</p><table class="mt-3"><thead><tr><th>Indicador</th><th class="num">Município</th><th class="num">Mediana dos iguais</th><th class="num">Mediana ${esc(model.uf)}</th><th class="num">Posição</th></tr></thead><tbody>${linhas}</tbody></table>${vaarLinha}${
    pior && notaPior !== null && notaPior <= 30
      ? `<div class="note mt-3"><b>Onde a distância é maior:</b> em <b>${esc(pior.label.toLowerCase())}</b> o município está atrás de ${100 - notaPior}% dos iguais (${esc(fmtValor(pior.value, pior.unit))} contra mediana de ${esc(fmtValor(pior.cohortMedian, pior.unit))}). É o indicador em que o mesmo porte de rede, em outro lugar, entrega mais — o primeiro candidato a plano de ação.</div>`
      : ""
  }<p class="micro mt-1">Fontes: matrículas ponderadas do FNDE, habilitação VAAR, indicadores SIOPE e remuneração do magistério — os mesmos datasets das demais páginas, apurados igualmente para toda a coorte. Percentis calculados apenas quando ao menos 20 semelhantes têm o dado.</p></main>${footer(pagina, "Datasets FNDE/SIOPE — coorte nacional por porte de rede")}</section>`;
}

/**
 * Saeb e IDEB por escola — onde a média esconde, e onde a Cond. II morre.
 *
 * A Condicionalidade II do VAAR (80% de participação no Saeb) reprova a rede,
 * mas quem falta à prova é a escola. O INEP retém o resultado da escola com
 * participação abaixo de 80% — a marca `ND` da divulgação — então dá para
 * nomear exatamente onde a prova não aconteceu. 356 municípios reprovados na
 * Cond. II em 2026 têm escolas nessa condição.
 */
function paginaEscolas(model: MunicipalXrayModel, pagina: number): string {
  const s = model.schoolResults;
  const v = model.vaar;

  if (!s || s.list.length === 0) {
    return `<section class="page content-page">${header("Saeb e IDEB por escola")}<main class="page-body"><div class="kicker">Resultado escola a escola</div><h2>Resultados por escola indisponíveis</h2><p class="lede">A divulgação do IDEB por escola não trouxe a rede municipal deste município na edição consultada.</p></main>${footer(pagina, "INEP — divulgação do IDEB por escola")}</section>`;
  }

  const nota = (valor: number | null) => (valor === null ? "—" : decimal.format(valor));
  // 12 e não 14: com 14 linhas a página estoura nas redes que também disparam
  // o bloco de participação e o de amplitude — os dois maiores da folha.
  const LIMITE = 11;
  const visiveis = s.list.slice(0, LIMITE);
  const restantes = s.total - visiveis.length;

  const linhas = visiveis
    .map(
      (e) => `<tr>
        <td>${esc(e.name)}${e.nd ? ` <b class="warn-text">●</b>` : ""}</td>
        <td class="num">${nota(e.idebAi)}</td><td class="num">${nota(e.saebAi)}</td>
        <td class="num">${nota(e.idebAf)}</td><td class="num">${nota(e.saebAf)}</td>
      </tr>`,
    )
    .join("");

  const escolasNd = s.list.filter((e) => e.nd);
  const reprovouII = v?.failed.includes("II") === true;

  const blocoNd = escolasNd.length
    ? `<div class="${reprovouII ? "risk" : "note"} mt-3"><b>${
        escolasNd.length === 1 ? "1 escola ficou" : `${escolasNd.length} escolas ficaram`
      } sem resultado divulgado por participação abaixo de 80% no Saeb ${s.year}:</b>
      ${escolasNd.slice(0, 6).map((e) => esc(e.name)).join("; ")}${escolasNd.length > 6 ? "…" : ""}.
      ${
        reprovouII
          ? `E o município <b>reprovou na Condicionalidade II do VAAR</b> — 80% de participação, aferidos por ano escolar da rede. A condicionalidade reprova a rede; a lista acima diz <b>em quais portas bater</b>. Logística de prova, mobilização de família e cobertura do dia de aplicação são gestão, não pedagogia.`
          : `A Condicionalidade II do VAAR cobra 80% de participação da rede por ano escolar: cada escola desta lista puxa a média para baixo no ciclo seguinte.`
      }</div>`
    : reprovouII
      ? `<div class="note mt-3"><b>Atenção:</b> o município reprovou na Condicionalidade II do VAAR, mas nenhuma escola municipal teve resultado retido por participação nesta divulgação — a participação insuficiente pode estar em ano escolar avaliado sem divulgação por escola (2º ano) ou na margem agregada da rede. Conferir os relatórios de aplicação do Saeb.</div>`
      : "";

  return `<section class="page content-page">${header("Saeb e IDEB por escola")}<main class="page-body"><div class="kicker">Resultado escola a escola</div><h2>A média municipal esconde — a decisão é por escola</h2><p class="lede">Resultados identificados da divulgação oficial do INEP para a rede municipal. Ordenados do sinal mais grave para o menos: primeiro quem ficou sem resultado por participação (<b class="warn-text">●</b>), depois do menor IDEB para o maior.</p><div class="grid-4 mt-3">${metric(int(s.total), "escolas municipais na divulgação")}${metric(
    s.ndCount > 0 ? int(s.ndCount) : "0",
    "sem resultado por participação",
  )}${metric(s.worstAi === null ? "N/D" : decimal.format(s.worstAi), "pior IDEB anos iniciais")}${metric(
    s.rangeAi === null ? "N/D" : decimal.format(s.rangeAi),
    "distância entre a melhor e a pior",
  )}</div><table class="mt-3"><thead><tr><th>Escola</th><th class="num">IDEB AI</th><th class="num">Saeb AI</th><th class="num">IDEB AF</th><th class="num">Saeb AF</th></tr></thead><tbody>${linhas}</tbody></table>${
    restantes > 0
      ? `<p class="micro" style="margin-top:.04in">Exibidas as ${LIMITE} escolas de sinal mais grave; outras ${int(restantes)} compõem a rede.</p>`
      : ""
  }${blocoNd}${
    s.rangeAi !== null && s.rangeAi >= 1.5
      ? `<div class="insight mt-2"><b>O que a amplitude diz:</b> ${decimal.format(s.rangeAi)} pontos separam a melhor da pior escola — duas realidades na mesma rede, e a Cond. III do VAAR premia justamente reduzir essa distância, não subir a média.</div>`
      : ""
  }<p class="small mt-1">O INEP não projeta metas por escola desde 2021. "—" = etapa não ofertada ou sem resultado no ciclo.</p></main>${footer(pagina, `INEP — divulgação do IDEB por escola, edição ${s.year}`)}</section>`;
}

const NIVEIS_ROMANOS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/**
 * Contexto por escola — o IDEB sozinho pune a escola errada.
 *
 * INSE (nível socioeconômico dos alunos), complexidade de gestão, distorção
 * idade-série, abandono e adequação da formação docente, escola a escola. O
 * cruzamento INSE × IDEB separa a escola fraca da escola de contexto duro que
 * performa; o abandono por escola é a Condicionalidade I do VAAR (fluxo)
 * sendo fabricada anos antes da portaria.
 */
function paginaContextoEscolas(model: MunicipalXrayModel, pagina: number): string {
  const c = model.schoolContext;

  if (!c || c.schools.length === 0) {
    return `<section class="page content-page">${header("Contexto por escola")}<main class="page-body"><div class="kicker">O que cerca cada resultado</div><h2>Indicadores de contexto indisponíveis</h2><p class="lede">As publicações de INSE, complexidade e rendimento do INEP não trouxeram a rede municipal deste município.</p></main>${footer(pagina, "INEP — indicadores educacionais por escola")}</section>`;
  }

  const nivel = (n: number | null) => (n === null ? "—" : NIVEIS_ROMANOS[n] ?? String(n));
  const valor = (v: number | null) => (v === null ? "—" : decimal.format(v));

  // 8 e não 12: com mais linhas a página estourava a altura e o CSS
  // (overflow:hidden) engolia o pé em silêncio. Ver `pdf-corte.ts`.
  const LIMITE = 8;
  const visiveis = c.schools.slice(0, LIMITE);
  const linhas = visiveis
    .map(
      (e) => `<tr>
        <td>${esc(e.name)}</td>
        <td class="num">${nivel(e.inseLevel)}</td>
        <td class="num">${e.icg === null ? "—" : e.icg}</td>
        <td class="num">${valor(e.tdi)}</td>
        <td class="num">${valor(e.approval)}</td>
        <td class="num">${e.dropout !== null && e.dropout > 0 ? `<b class="warn-text">${decimal.format(e.dropout)}</b>` : valor(e.dropout)}</td>
        <td class="num">${valor(e.adequateTeachers)}</td>
      </tr>`,
    )
    .join("");
  const restantes = c.total - visiveis.length;

  const x = c.crossover;
  const blocoCruzamento = x
    ? `<div class="insight mt-2"><b>Contexto × resultado (${x.evaluated} escolas com INSE e IDEB):</b> ${
        x.resilient
          ? `<b>${esc(x.resilient.name)}</b> prova que o contexto daqui comporta resultado melhor — INSE ${decimal2.format(x.resilient.inse)} (abaixo da mediana de ${decimal2.format(x.medianInse)}) e IDEB ${decimal.format(x.resilient.ideb)} (acima da mediana de ${decimal.format(x.medianIdeb)}). O que essa escola faz é replicável na própria rede, sem consultoria externa.`
          : `nenhuma escola de contexto mais duro que a mediana supera a mediana de resultado — o desempenho segue o INSE em toda a rede.`
      }${
        x.alert
          ? ` Na outra ponta, <b>${esc(x.alert.name)}</b> tem contexto mais favorável (INSE ${decimal2.format(x.alert.inse)}) e resultado abaixo da mediana (IDEB ${decimal.format(x.alert.ideb)}) — é onde a visita pedagógica rende mais rápido.`
          : ""
      }</div>`
    : `<div class="note mt-2"><b>Cruzamento contexto × resultado:</b> menos de 5 escolas têm INSE e IDEB simultaneamente nesta rede — as medianas não significariam nada. A leitura fica escola a escola, na tabela acima.</div>`;

  const blocoAbandono =
    c.worstDropout && c.worstDropout.value > 0
      ? `<div class="${c.worstDropout.value >= 5 ? "risk" : "note"} mt-2"><b>Onde o fluxo vaza:</b> ${
          c.dropoutCount === 1 ? "1 escola registra" : `${int(c.dropoutCount)} escolas registram`
        } abandono no fundamental; a pior é <b>${esc(c.worstDropout.name)}</b>, com ${decimal.format(c.worstDropout.value)}% (${c.years.rendimento}). Abandono por escola é a Condicionalidade I do VAAR — o indicador de fluxo — sendo fabricada agora: cada aluno que sai daqui reprova a rede na portaria de dois anos à frente.</div>`
      : `<div class="insight mt-2"><b>Fluxo sob controle:</b> nenhuma escola municipal registrou abandono no fundamental em ${c.years.rendimento} — a Condicionalidade I do VAAR depende de manter exatamente isso.</div>`;

  return `<section class="page content-page">${header("Contexto por escola")}<main class="page-body"><div class="kicker">O que cerca cada resultado</div><h2>O IDEB sozinho pune a escola errada</h2><p class="lede">A mesma nota vale coisas diferentes em contextos diferentes. Esta página junta, por escola, o nível socioeconômico dos alunos (INSE), a complexidade de gestão, a distorção idade-série, o abandono e a formação docente — o que cerca o número da página anterior.</p><div class="grid-4 mt-3">${metric(
    c.networkInse === null ? "N/D" : decimal.format(c.networkInse),
    `INSE médio da rede (escala Saeb ${c.years.inse})`,
  )}${metric(int(c.dropoutCount), "escolas com abandono no fundamental")}${metric(
    c.worstTdi ? pct(c.worstTdi.value) : "N/D",
    "pior distorção idade-série",
  )}${metric(
    c.avgAdequateTeachers === null ? "N/D" : pct(c.avgAdequateTeachers),
    "docentes com formação adequada (média)",
  )}</div><table class="mt-3"><thead><tr><th>Escola</th><th class="num">INSE (nível)</th><th class="num">Complex.</th><th class="num">Distorção %</th><th class="num">Aprovação %</th><th class="num">Abandono %</th><th class="num">Doc. adequados %</th></tr></thead><tbody>${linhas}</tbody></table>${
    restantes > 0
      ? `<p class="micro" style="margin-top:.04in">Exibidas as ${LIMITE} escolas de fluxo mais grave (abandono, depois distorção); outras ${int(restantes)} compõem a rede.</p>`
      : ""
  }${blocoCruzamento}${blocoAbandono}<p class="small mt-1">INSE em níveis de I (mais vulnerável) a VIII; complexidade de gestão de 1 a 6 (porte, turnos e etapas); "—" = escola fora da publicação daquele indicador. Fontes: INEP — INSE ${c.years.inse}, ICG ${c.years.icg}, TDI e rendimento ${c.years.tdi}, AFD ${c.years.afd}.</p></main>${footer(pagina, "INEP — indicadores educacionais por escola")}</section>`;
}

/**
 * Distribuição de proficiência — a cauda que a média esconde.
 *
 * Duas redes com a mesma média podem ter 10% ou 35% dos alunos abaixo do
 * básico. A Condicionalidade III do VAAR mede redução das desigualdades de
 * aprendizagem — esta é a página que diz quantos alunos, em qual etapa e em
 * qual disciplina.
 */
function paginaProficiencia(model: MunicipalXrayModel, pagina: number): string {
  const p = model.proficiency;

  if (!p || p.series.length === 0) {
    return `<section class="page content-page">${header("Distribuição de proficiência")}<main class="page-body"><div class="kicker">A cauda que a média esconde</div><h2>Distribuição do Saeb indisponível</h2><p class="lede">A planilha de resultados do Saeb não trouxe a rede municipal deste município — rede sem etapa avaliada ou sem participação suficiente.</p></main>${footer(pagina, "INEP — resultados do Saeb, rede municipal")}</section>`;
  }

  const linhas = p.series
    .map(
      (s) => `<tr>
        <td>${esc(s.label)}</td>
        <td class="num">${decimal.format(s.media)}</td>
        <td class="num">${s.insufficient >= 30 ? `<b class="warn-text">${pct(s.insufficient)}</b>` : pct(s.insufficient)}</td>
        <td class="num">${pct(s.basic)}</td>
        <td class="num">${pct(s.proficient)}</td>
        <td class="num">${pct(s.advanced)}</td>
      </tr>`,
    )
    .join("");

  const piorSerie = [...p.series].sort((a, b) => b.insufficient - a.insufficient)[0];
  const aprendizadoAdequado = (s: (typeof p.series)[number]) => s.proficient + s.advanced;
  const melhorAdequado = [...p.series].sort((a, b) => aprendizadoAdequado(b) - aprendizadoAdequado(a))[0];

  return `<section class="page content-page">${header("Distribuição de proficiência")}<main class="page-body"><div class="kicker">A cauda que a média esconde</div><h2>Quantos alunos, em qual etapa, em qual disciplina</h2><p class="lede">A média do Saeb esconde a cauda: duas redes com a mesma nota podem ter frações muito diferentes de alunos abaixo do básico. Esta é a distribuição real da rede municipal no Saeb ${p.year} — o número que transforma "melhorar o IDEB" em meta contável.</p><div class="grid-4 mt-3">${metric(
    pct(piorSerie.insufficient),
    `insuficiente em ${piorSerie.label.toLowerCase()}`,
  )}${metric(
    pct(aprendizadoAdequado(melhorAdequado)),
    `aprendizado adequado em ${melhorAdequado.label.toLowerCase()}`,
  )}${metric(decimal.format(piorSerie.media), `média Saeb — ${piorSerie.label.toLowerCase()}`)}${metric(
    String(p.series.length),
    "séries avaliadas na rede municipal",
  )}</div><table class="mt-3"><thead><tr><th>Série avaliada</th><th class="num">Média</th><th class="num">Insuficiente %</th><th class="num">Básico %</th><th class="num">Proficiente %</th><th class="num">Avançado %</th></tr></thead><tbody>${linhas}</tbody></table><div class="${
    piorSerie.insufficient >= 30 ? "risk" : "insight"
  } mt-3"><b>Onde a cauda é maior:</b> ${pct(piorSerie.insufficient)} dos alunos avaliados em <b>${esc(piorSerie.label.toLowerCase())}</b> estão no grupo insuficiente — não alcançaram o piso da escala. A Condicionalidade III do VAAR mede exatamente a redução das desigualdades de aprendizagem: recuperar esses alunos é ao mesmo tempo a agenda pedagógica e a condição de captar a complementação de resultado.</div><div class="note mt-2"><b>Como ler:</b> "aprendizado adequado" = proficiente + avançado. Reforço dirigido rende mais na fronteira entre o insuficiente e o básico — é onde a mesma hora de intervenção move mais alunos de grupo.</div><p class="small mt-1">Escala oficial do INEP em níveis de 25 pontos; agrupamento qualitativo pela convenção Todos Pela Educação/QEdu (LP 5º: insuficiente &lt; 150, adequado ≥ 200 · MT 5º: &lt; 175 / ≥ 225 · LP 9º: &lt; 200 / ≥ 275 · MT 9º: &lt; 225 / ≥ 300). Rede municipal, todas as localizações.</p></main>${footer(pagina, `INEP — planilha de resultados do Saeb ${p.year}, rede municipal`)}</section>`;
}

/**
 * Demografia educacional — a única página que fala de 2028.
 *
 * A receita do fundo segue a matrícula, e a matrícula segue o nascimento com
 * atraso fixo: quem nasceu em 2024 chega à pré-escola em 2028 e ao 1º ano em
 * 2030. Nascimento em queda é base do FUNDEB encolhendo em data conhecida — e
 * a resposta de gestão é cobertura (capturar quem está fora da rede), porque
 * demografia não se reverte por decreto.
 */
function paginaDemografia(model: MunicipalXrayModel, pagina: number): string {
  const d = model.demographics;

  if (!d) {
    return `<section class="page content-page">${header("Demografia e demanda futura")}<main class="page-body"><div class="kicker">As coortes que vêm aí</div><h2>Demografia indisponível</h2><p class="lede">O IBGE não respondeu às consultas de população por idade e nascimentos no momento da emissão.</p></main>${footer(pagina, "IBGE — Censo 2022 e Registro Civil")}</section>`;
  }

  const cobertura = (matriculas: number | null, populacao: number) =>
    matriculas !== null && populacao > 0 ? (matriculas / populacao) * 100 : null;
  const coberturaCreche = cobertura(d.crecheEnrollment, d.crechePop);
  const coberturaPre = cobertura(d.preEnrollment, d.prePop);
  const atendimentoCreche = cobertura(d.totalEnrollment?.creche ?? null, d.crechePop);
  const atendimentoPre = cobertura(d.totalEnrollment?.pre ?? null, d.prePop);
  const atendimentoAi = cobertura(d.totalEnrollment?.ai ?? null, d.aiPop);
  const atendimentoAf = cobertura(d.totalEnrollment?.af ?? null, d.afPop);
  // Nas faixas de matrícula obrigatória, atendimento total baixo é criança
  // fora da escola — o sinal de busca ativa mais direto do relatório.
  const faixaDescoberta =
    [
      { rotulo: "pré-escola", valor: atendimentoPre },
      { rotulo: "anos iniciais", valor: atendimentoAi },
      { rotulo: "anos finais", valor: atendimentoAf },
    ].find((f) => f.valor !== null && f.valor < 90) ?? null;

  // A tabela mostra as 5 coortes mais recentes: a mais antiga da série já está
  // na escola e não é "a rede que vem aí". A tendência abaixo segue calculada
  // sobre a série inteira. Com 6 linhas a página estourava a altura, e o CSS
  // (overflow:hidden) engolia o pé em silêncio — ver `pdf-corte.ts`.
  const linhas = d.births
    .slice(-5)
    .map(
      (b) => `<tr><td><b>${b.year}</b></td><td class="num">${int(b.count)}</td><td class="num">pré-escola em <b>${b.preYear}</b></td><td class="num">1º ano em <b>${b.firstGradeYear}</b></td></tr>`,
    )
    .join("");

  const primeira = d.births[0];
  const ultima = d.births[d.births.length - 1];
  const encolhendo = d.trendPct !== null && d.trendPct < -3;

  return `<section class="page content-page">${header("Demografia e demanda futura")}<main class="page-body"><div class="kicker">As coortes que vêm aí</div><h2>A rede de ${ultima ? ultima.firstGradeYear : "2030"} já nasceu — e já dá para contá-la</h2><p class="lede">A matrícula segue o nascimento com atraso fixo: o Registro Civil diz quantas crianças chegam à pré e ao 1º ano até ${ultima ? ultima.firstGradeYear : "2030"}; o Censo 2022 diz quantas existem hoje em cada faixa.</p><div class="grid-4 mt-3">${metric(int(d.crechePop), "crianças de 0 a 3 anos no município")}${metric(int(d.prePop), "de 4 e 5 anos")}${metric(ultima ? int(ultima.count) : "N/D", `nascidos em ${ultima ? ultima.year : "—"}`)}${metric(
    d.trendPct === null ? "N/D" : `${d.trendPct > 0 ? "+" : ""}${decimal.format(d.trendPct)}%`,
    primeira && ultima ? `nascimentos ${primeira.year} → ${ultima.year}` : "tendência",
  )}</div><div class="grid-2 mt-2"><div class="card accent"><h3>Calendário das coortes</h3><table><tbody>${linhas}</tbody></table><p class="micro" style="margin-top:.05in">Registro Civil (IBGE); a coorte entra na pré aos 4 anos e no ensino fundamental aos 6.</p></div><div class="card ${encolhendo ? "warn" : ""}"><h3>Atendimento por faixa — piso municipal e foto completa</h3><table><thead><tr><th>Faixa</th><th class="num">Rede municipal</th><th class="num">Todas as redes</th><th class="num"></th></tr></thead><tbody><tr><td>Creche (0–3)</td><td class="num">${coberturaCreche === null ? "N/D" : `<b>${pct(coberturaCreche)}</b>`}</td><td class="num">${atendimentoCreche === null ? "—" : pct(atendimentoCreche)}</td><td class="num micro">meta PNE: 50%</td></tr><tr><td>Pré-escola (4–5)</td><td class="num">${coberturaPre === null ? "N/D" : `<b>${pct(coberturaPre)}</b>`}</td><td class="num">${atendimentoPre === null ? "—" : pct(atendimentoPre)}</td><td class="num micro">universalização</td></tr><tr><td>Anos iniciais (6–10)</td><td class="num micro">—</td><td class="num">${atendimentoAi === null ? "—" : pct(atendimentoAi)}</td><td class="num micro">universalização</td></tr><tr><td>Anos finais (11–14)</td><td class="num micro">—</td><td class="num">${atendimentoAf === null ? "—" : pct(atendimentoAf)}</td><td class="num micro">universalização</td></tr></tbody></table><div class="divider"></div><p class="micro">Piso = matrículas da <b>rede municipal</b> ÷ população da faixa; foto completa = <b>todas as redes</b> (Censo Escolar${d.totalEnrollment ? ` ${d.totalEnrollment.year}` : ""}) ÷ mesma população. ${
    coberturaCreche !== null && coberturaCreche < 50
      ? `Cada criança de 0–3 capturada em creche pública integral pondera <b>1,55</b> no fundo — é a matrícula de maior valor disponível sem mudar o público atendido.`
      : `Manter a cobertura exige repor as coortes que encolhem — a captura é contínua, não conquista.`
  }${
    faixaDescoberta
      ? ` <b>Sinal de busca ativa:</b> o atendimento total de ${faixaDescoberta.rotulo} está em ${pct(faixaDescoberta.valor ?? 0)} — numa faixa de matrícula obrigatória, a diferença é criança fora da escola, em alguma rede.`
      : ""
  } A população é do Censo 2022 e a matrícula é mais recente — ordem de grandeza; acima de 100% é atração de alunos de municípios vizinhos.</p></div></div><div class="${encolhendo ? "risk" : "insight"} mt-2"><b>${
    encolhendo
      ? `A base do fundo encolhe em data conhecida:`
      : `Leitura das coortes:`
  }</b> ${
    d.trendPct !== null && primeira && ultima
      ? `a coorte que chega à pré-escola em ${ultima.preYear} é ${decimal.format(Math.abs(d.trendPct))}% ${d.trendPct < 0 ? "menor" : "maior"} que a de ${primeira.preYear}. ${
          d.trendPct < 0
            ? `Menos criança nascendo significa menos matrícula bruta — e a resposta de gestão não é esperar a demografia: é <b>cobertura</b> (capturar para a rede quem hoje está fora) e <b>fator</b> (jornada integral e condição declarada corretamente), que sustentam a matrícula ponderada mesmo com a coorte menor.`
            : `Coorte crescendo é demanda de vaga em data marcada — planejar obra e equipe agora custa menos que correr atrás em ${ultima.preYear}.`
        }`
      : "Série de nascimentos insuficiente para tendência."
  }</div>${
    d.teenMothers && d.teenMothers.births > 0
      ? `<div class="${d.teenMothers.sharePct >= 15 ? "risk" : "note"} mt-1"><b>Maternidade adolescente:</b> ${int(d.teenMothers.births)} dos nascimentos de ${d.teenMothers.year}
      (${pct(d.teenMothers.sharePct)}) são de mães de até 19 anos — um dos maiores preditores de evasão feminina
      no ensino médio e no EJA. Cada mãe adolescente é também <b>demanda de creche</b> batendo na porta da
      mesma rede que ela precisaria frequentar — sem vaga, a evasão dela é quase certa. Oferta noturna,
      contraturno e prioridade de vaga são resposta de rede, nunca cobrança individual.</div>`
      : ""
  }<p class="micro mt-1">Fontes: IBGE, Censo Demográfico 2022 (agregado 9514) e Estatísticas do Registro Civil (agregado 2612, incluindo idade da mãe), consultadas na emissão. Nascimentos por local de residência da mãe.</p></main>${footer(pagina, "IBGE — Censo 2022 e Registro Civil")}</section>`;
}

/**
 * Território e fator — o povo existe no Censo; a matrícula existe no FUNDEB?
 *
 * Os segmentos quilombolas e indígenas ponderam de 1,40 a 2,17 — os maiores
 * fatores do fundo. O Censo 2022 contou quilombolas pela primeira vez, então
 * agora dá para cruzar: população em idade escolar × matrículas declaradas
 * nos segmentos. O sinal é conferência, não acusação — o fator segue a
 * localização da escola, e criança do povo em escola urbana comum pode ser
 * a única oferta possível.
 */
function paginaTerritorio(model: MunicipalXrayModel, pagina: number): string {
  const p = model.peoples;
  const a = model.settlements;
  const escolasAssentamento = model.equity?.settlementSchools ?? null;

  // Assentamento é o terceiro cruzamento territorial: INCRA diz quantas
  // famílias assentadas existem; o Censo diz quantas escolas municipais estão
  // declaradas em assentamento. Centenas de famílias com zero escolas
  // declaradas = a condição de campo (+15%) pode estar por declarar.
  const sinalAssentamento = a !== null && a.families >= 100 && escolasAssentamento === 0;
  const blocoAssentamentos = a
    ? `<div class="${sinalAssentamento ? "risk" : "note"} mt-3"><b>Assentamentos da reforma agrária:</b> o INCRA registra
       <b>${int(a.count)}</b> assentamento${a.count === 1 ? "" : "s"} no município, com <b>${int(a.families)}</b> famílias
       em ${int(a.areaHa)} hectares${escolasAssentamento !== null ? ` — e a rede municipal declara <b>${int(escolasAssentamento)}</b> escola${escolasAssentamento === 1 ? "" : "s"} em área de assentamento no Censo` : ""}.
       ${
         sinalAssentamento
           ? `<b>Sinal de conferência:</b> famílias assentadas às centenas sem nenhuma escola declarada na condição. Escola que atende assentamento é educação do <b>campo</b> (fator +15% sobre a etapa), e aluno residente em assentamento conta para a regra da escola urbana com metade dos alunos de residência rural — as duas capturas se perdem quando a coleta não declara a condição.`
           : escolasAssentamento !== null && escolasAssentamento > 0
             ? `A declaração de escolas em assentamento é compatível com a presença do INCRA — manter a conferência anual na coleta.`
             : `Conferir na coleta se as escolas que atendem essas famílias declaram a localização diferenciada — é o fator de campo (+15%) que está em jogo.`
       }</div>`
    : "";

  if (!p) {
    return `<section class="page content-page">${header("Território e fator")}<main class="page-body"><div class="kicker">Povos e ponderação</div><h2>Cruzamento territorial indisponível</h2><p class="lede">O IBGE não respondeu às consultas de população quilombola e indígena no momento da emissão.</p>${blocoAssentamentos}</main>${footer(pagina, "IBGE — Censo 2022 × FNDE")}</section>`;
  }

  const semPresenca = p.quilombola.pop === 0 && p.indigenous.pop === 0;
  if (semPresenca) {
    return `<section class="page content-page">${header("Território e fator")}<main class="page-body"><div class="kicker">Povos e ponderação</div><h2>Sem população quilombola ou indígena no Censo 2022</h2><p class="lede">O Censo 2022 não registrou população quilombola nem indígena neste município — não há fator territorial de povos a conferir. Permanecem as condições de <b>campo</b> (fator +15%) e a regra da escola urbana com metade dos alunos de residência rural, tratadas na página de ponderação.</p>${blocoAssentamentos}<div class="note mt-3"><b>Por que a página existe mesmo assim:</b> a ausência é uma informação com fonte — melhor que omitir a verificação e deixar o leitor supor que ela não foi feita.</div></main>${footer(pagina, "IBGE — Censo 2022 (agregados 8176 e 8175)")}</section>`;
  }

  const cartao = (rotulo: string, povo: typeof p.quilombola, segmento: string) => `
    <div class="card ${povo.flag ? "warn" : "accent"}"><h3>${rotulo}</h3>
      <div class="grid-2">${metric(int(povo.pop), "população no Censo 2022")}${metric(int(povo.schoolAge), "em idade escolar (0–14)")}</div>
      <div class="divider"></div>
      <table><tbody>
        <tr><td>Matrículas nos segmentos ${segmento} do FUNDEB</td><td class="num"><b>${int(povo.enrolled)}</b></td></tr>
        <tr><td>Matrículas ÷ população 0–14</td><td class="num"><b>${povo.ratio === null ? "N/D" : pct(povo.ratio)}</b></td></tr>
      </tbody></table>
      ${
        povo.flag
          ? `<p class="small" style="margin-top:.06in"><b>Sinal de conferência:</b> ${
              povo.enrolled === 0
                ? "há população em idade escolar e <b>nenhuma matrícula</b> declarada nos segmentos"
                : "a razão entre matrícula declarada e população da faixa é desproporcional"
            }. Se existe oferta em território sem a localização diferenciada declarada no Censo Escolar, o fator de ${p.factorMin.toLocaleString("pt-BR")} a ${p.factorMax.toLocaleString("pt-BR")} se perde a cada exercício.</p>`
          : povo.pop > 0
            ? `<p class="small" style="margin-top:.06in">A declaração nos segmentos é compatível com a presença do povo no Censo — manter a conferência anual na coleta.</p>`
            : `<p class="small" style="margin-top:.06in">Sem presença registrada no Censo 2022.</p>`
      }
    </div>`;

  return `<section class="page content-page">${header("Território e fator")}<main class="page-body"><div class="kicker">Povos e ponderação — os maiores fatores do fundo</div><h2>O povo existe no Censo. A matrícula existe no FUNDEB?</h2><p class="lede">Os segmentos quilombolas e indígenas ponderam de <b>${p.factorMin.toLocaleString("pt-BR")} a ${p.factorMax.toLocaleString("pt-BR")}</b> — os maiores fatores da planilha do FNDE. O Censo 2022 contou essas populações município a município (quilombolas pela primeira vez na história), o que permite o cruzamento que esta página faz: quem existe no território × o que a rede declara na coleta.</p><div class="grid-2 mt-3">${cartao("População quilombola", p.quilombola, "quilombolas")}${cartao("População indígena", p.indigenous, "indígenas")}</div>${blocoAssentamentos}<div class="insight mt-3"><b>Como ler o sinal:</b> o fator segue a <b>localização diferenciada da escola</b>, não a cor da matrícula — criança quilombola em escola urbana comum pondera como urbana comum, e isso pode ser legítimo quando não há oferta no território. A conferência é escola a escola, na coleta do Censo: escola situada em área remanescente de quilombo, terra indígena ou com oferta de educação escolar indígena <b>declarada como tal</b>. Uma matrícula de creche integral quilombola vale ${p.factorMax.toLocaleString("pt-BR")} equivalentes; a mesma criança declarada como urbana comum vale 1,55 — a diferença é só declaração.</div>${blocoFunai(model)}<p class="small mt-1">Fontes: IBGE, Censo 2022 (população quilombola e indígena por município, agregados 8176 e 8175, consulta na geração) e FNDE, planilha de matrículas ponderadas do FUNDEB (exercício vigente do dataset local).</p></main>${footer(pagina, "IBGE — Censo 2022 × FNDE — matrículas ponderadas")}</section>`;
}

/**
 * Frequência do Bolsa Família — o censo mensal da evasão.
 *
 * O SICON acompanha, criança a criança e a cada bimestre, a frequência dos
 * beneficiários de 4–17 anos. "Não localizado" é o aluno que a rede não
 * encontrou — evasão com lista nominal pronta na gestão municipal do PBF.
 * A moldura é proteção, não punição: o número aciona busca ativa, nunca
 * culpa a família.
 */
/**
 * Obras FNDE em situação crítica — o exemplo mais literal de dinheiro parado.
 *
 * Obra paralisada é tripla perda: o repasse federal contratado que não entra,
 * a vaga que não abre (matrícula que não vai ao Censo) e a jornada integral
 * que não sobe de fator. O Pacto de Retomada existe exatamente para
 * repactuar — e o painel público diz quanto está em jogo.
 */
function paginaObras(model: MunicipalXrayModel, pagina: number): string {
  const w = model.stalledWorks;

  if (!w || w.total === 0) {
    return `<section class="page content-page">${header("Obras FNDE")}<main class="page-body"><div class="kicker">Dinheiro parado em obra</div><h2>Sem obras no painel público do Pacto</h2><p class="lede">O painel público do Pacto de Retomada não localizou obras vinculadas ao município — o acompanhamento operacional completo no Simec depende de credencial do ente.</p></main>${footer(pagina, "FNDE — Painel do Pacto de Retomada")}</section>`;
  }

  const criticasTotal = w.stalled + w.unfinished;
  const ROTULO_SITUACAO: Record<string, string> = {
    PARALISADA: "paralisada",
    INACABADA: "inacabada",
    "EM RETOMADA": "em retomada",
  };
  const linhas = w.works
    .slice(0, 10)
    .map(
      (o) => `<tr>
        <td>${esc(o.type)}${o.classification ? ` <span class="micro">· ${esc(o.classification)}</span>` : ""}</td>
        <td class="num">${o.year ?? "—"}</td>
        <td>${criticasTotal > 0 && o.status !== "EM RETOMADA" ? `<b class="warn-text">${esc(ROTULO_SITUACAO[o.status] ?? o.status.toLowerCase())}</b>` : esc(ROTULO_SITUACAO[o.status] ?? o.status.toLowerCase())}</td>
        <td class="num">${o.estimate > 0 ? compactMoney(o.estimate) : "—"}</td>
        <td class="num">${o.executed > 0 ? compactMoney(o.executed) : "—"}</td>
      </tr>`,
    )
    .join("");

  return `<section class="page content-page">${header("Obras FNDE")}<main class="page-body"><div class="kicker">Dinheiro parado em obra</div><h2>${
    criticasTotal > 0 ? "Obra parada é perda tripla — e tem edital de volta" : "As obras pactuadas com o FNDE"
  }</h2><p class="lede">Obra paralisada perde três vezes: o repasse federal contratado que não entra, a vaga que não abre (matrícula que não chega ao Censo) e a jornada integral que não sobe de fator. O painel público do Pacto de Retomada diz o que está em jogo — a repactuação é dinheiro federal já aprovado esperando ato do município.</p><div class="grid-4 mt-3">${metric(int(w.total), "obras no painel do Pacto")}${metric(
    int(criticasTotal),
    "paralisadas ou inacabadas",
  )}${metric(int(w.resuming), "em retomada")}${metric(
    w.stalledValue > 0 ? compactMoney(w.stalledValue) : "—",
    "repasse estimado nas críticas",
  )}</div>${
    w.works.length > 0
      ? `<table class="mt-3"><thead><tr><th>Obra</th><th class="num">Termo</th><th>Situação</th><th class="num">Repasse estimado</th><th class="num">Já executado</th></tr></thead><tbody>${linhas}</tbody></table>${
          w.works.length > 10
            ? `<p class="micro" style="margin-top:.04in">Exibidas as 10 obras críticas de maior valor; outras ${int(w.works.length - 10)} constam no painel.</p>`
            : ""
        }`
      : `<div class="insight mt-3"><b>Nenhuma obra crítica:</b> as ${int(w.total)} obras do painel não constam como paralisadas ou inacabadas — o acompanhamento vira rotina de execução, não resgate.</div>`
  }${
    criticasTotal > 0
      ? `<div class="risk mt-3"><b>O caminho de volta:</b> a repactuação pelo Pacto de Retomada devolve o repasse federal — mas exige ato do município (termo validado, projeto atualizado, contrapartida definida). Cada obra parada desta tabela é também demanda futura já paga: creche parada é fator 1,55 que não entra; quadra e cozinha paradas travam a jornada integral que pondera 1,50. Quem acompanha o Simec e o termo de cada obra é a primeira pergunta do roteiro de campo.</div>`
      : ""
  }<p class="small mt-1">Fonte: FNDE — Painel público do Pacto de Retomada de Obras (dados abertos), consultado na geração. Valores são estimativas do próprio painel; o detalhe operacional por obra exige credencial do ente no Simec.</p></main>${footer(pagina, "FNDE — Painel do Pacto de Retomada de Obras")}</section>`;
}

const ROTULOS_DIF: Record<string, string> = {
  "1": "assentamento",
  "2": "terra indígena",
  "3": "quilombola",
  "8": "comunidade ribeirinha",
};

/**
 * Mapa das escolas — a rede plotada sobre o contorno do território.
 *
 * Dispersão territorial é custo de oferta (transporte, merenda, manutenção), e
 * a localização diferenciada declarada é fator de ponderação. O tipo de
 * veículo (embarcação) saiu da divulgação pós-LGPD — a escola ribeirinha e o
 * total em transporte público são o que a fonte sustenta; a embarcação vira
 * pergunta de campo com o dado embutido.
 */
function paginaMapaEscolas(model: MunicipalXrayModel, pagina: number): string {
  const m = model.schoolMap;

  if (!m || m.total === 0) {
    return `<section class="page content-page">${header("Mapa das escolas")}<main class="page-body"><div class="kicker">A rede sobre o território</div><h2>Mapa da rede indisponível</h2><p class="lede">Os microdados do Censo Escolar não trouxeram a rede municipal deste município.</p></main>${footer(pagina, "INEP — microdados do Censo Escolar")}</section>`;
  }

  const b = model.boundary;
  let mapa = "";
  if (b) {
    const pontos = m.schools
      .filter((s) => s.lat !== null && s.lng !== null)
      .map((s) => {
        const { x, y } = projectToBoundary(b, s.lng as number, s.lat as number);
        // Coordenada gravada errada no Censo cai fora do contorno — descartar
        // em vez de esticar o mapa.
        if (x < -30 || x > 750 || y < -30 || y > 750) return "";
        const classe = s.dif > 0 ? "dot-dif" : s.rural ? "dot-rural" : "dot-urbana";
        return `<circle class="${classe}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.dif > 0 ? 8 : 5.5}"></circle>`;
      })
      .join("");
    mapa = `<svg class="map-escolas" viewBox="${esc(b.viewBox)}" role="img" aria-label="Escolas municipais sobre o contorno de ${esc(model.municipality)}"><path class="map-shape" d="${esc(b.path)}"></path>${pontos}</svg><div class="map-legend"><span><i class="li-urbana"></i>urbana</span><span><i class="li-rural"></i>rural</span><span><i class="li-dif"></i>localização diferenciada</span></div>`;
  }

  const difTotal = Object.values(m.byDiferenciada).reduce((t, v) => t + v, 0);
  const linhasDif = Object.entries(m.byDiferenciada)
    .sort(([, a], [, b2]) => b2 - a)
    .map(
      ([codigo, qtd]) =>
        `<tr><td>Escolas em ${esc(ROTULOS_DIF[codigo] ?? `localização diferenciada (código ${codigo})`)}</td><td class="num"><b>${int(qtd)}</b></td></tr>`,
    )
    .join("");
  const ribeirinhas = m.byDiferenciada["8"] ?? 0;

  return `<section class="page content-page">${header("Mapa das escolas")}<main class="page-body"><div class="kicker">A rede sobre o território</div><h2>Onde a rede está — e o que custa alcançá-la</h2><p class="lede">Cada ponto é uma escola municipal ativa, plotada pela coordenada declarada ao Censo ${m.year}. Dispersão é custo de oferta, e a localização diferenciada declarada é o que a ponderação do FUNDEB paga a mais.</p><div class="grid-4 mt-3">${metric(int(m.total), "escolas municipais ativas")}${metric(int(m.ruralCount), "em zona rural")}${metric(int(difTotal), "em localização diferenciada")}${metric(
    `${int(m.transportStudents)}${m.transportPct !== null ? ` (${pct(m.transportPct)})` : ""}`,
    "alunos em transporte público",
  )}</div><div class="grid-2 mt-3"><div class="card accent">${
    mapa || `<div class="empty">Malha territorial indisponível na emissão — as contagens ao lado seguem válidas.</div>`
  }<p class="micro" style="margin-top:.05in">${int(m.withCoords)} de ${int(m.total)} escolas com coordenada declarada no Censo; contorno IBGE.</p></div><div class="card"><h3>Localização declarada — o que pondera</h3><table><tbody><tr><td>Escolas urbanas</td><td class="num">${int(m.total - m.ruralCount)}</td></tr><tr><td>Escolas rurais (campo, +15% no fator)</td><td class="num"><b>${int(m.ruralCount)}</b></td></tr>${linhasDif}</tbody></table><div class="divider"></div><p class="small">Indígena e quilombola ponderam de 1,4 a 2,17 — os maiores fatores da planilha, e valem quando <b>declarados na coleta</b>: escola em território sem a marcação perde a diferença todo exercício.</p></div></div>${
    ribeirinhas > 0
      ? `<div class="insight mt-3"><b>Territórios de rio:</b> ${ribeirinhas === 1 ? "1 escola declarada" : `${int(ribeirinhas)} escolas declaradas`} em comunidade ribeirinha. <b>O transporte dessas escolas é por embarcação?</b> Cheia e vazante mudam rota, calendário e frequência — e frequência é Censo, e Censo é FUNDEB. Conferir PNATE (embarcação tem per capita maior) e calendário adaptado ao regime do rio.</div>`
      : `<div class="note mt-3"><b>Transporte:</b> ${int(m.transportStudents)} alunos da rede usam transporte público${m.transportPct !== null ? ` (${pct(m.transportPct)} das matrículas)` : ""}. Rota, frota própria × terceirizada e estado dos veículos não estão em base pública — seguem no roteiro de campo.</div>`
  }${
    m.race && m.race.rural.enrolled > 0 && m.race.urban.enrolled > 0
      ? `<div class="note mt-2"><b>Cor/raça por zona:</b> a matrícula negra (preta + parda) é ${
          m.race.urban.blackPct !== null ? pct(m.race.urban.blackPct) : "N/D"
        } na zona urbana e <b>${m.race.rural.blackPct !== null ? pct(m.race.rural.blackPct) : "N/D"}</b> na rural${
          m.race.rural.indigenousPct !== null && m.race.rural.indigenousPct >= 1
            ? `; a indígena chega a ${pct(m.race.rural.indigenousPct)} na zona rural`
            : ""
        }. A Condicionalidade III do VAAR mede desigualdade <b>racial</b> de aprendizagem: se a rede rural é mais negra e vai pior, este mapa é o mapa da condicionalidade.${
          m.race.urban.undeclaredPct !== null && m.race.urban.undeclaredPct >= 15
            ? ` <b>${pct(m.race.urban.undeclaredPct)} sem declaração na zona urbana</b> — campo em branco suja o indicador que o VAAR observa.`
            : ""
        }</div>`
      : ""
  }<p class="micro mt-1">Fonte: INEP — microdados do Censo Escolar ${m.year} (Tabela de Escola e de Matrícula, rede municipal ativa); contorno IBGE — Malhas Territoriais. Transporte público = alunos declarados como usuários, todas as etapas.</p></main>${footer(pagina, `INEP — Censo Escolar ${m.year} × IBGE — malhas`)}</section>`;
}

/**
 * Alfabetização — a única meta pactuada município por município.
 *
 * Todo o resto do dossiê compara o município com referências: mediana de
 * pares, referência nacional, régua da UF. Aqui a régua é o compromisso que o
 * próprio ente assumiu no CNCA, ano a ano até 2030 — então a página pode
 * afirmar "cumpriu" ou "não cumpriu" sem nenhuma ressalva metodológica.
 *
 * O laço com o FUNDEB é de fluxo: criança não alfabetizada no 2º ano vira
 * distorção idade-série e abandono adiante, e é isso que a Condicionalidade I
 * do VAAR mede.
 */
function paginaAlfabetizacao(model: MunicipalXrayModel, pagina: number): string {
  const a = model.literacy;
  const fonte = "INEP — Indicador Criança Alfabetizada (CNCA)";

  if (!a) {
    return `<section class="page content-page">${header("Alfabetização")}<main class="page-body"><div class="kicker">A base de tudo</div><h2>Indicador Criança Alfabetizada indisponível</h2><p class="lede">A divulgação do ICA não trouxe resultado para a rede municipal deste município. Municípios sem sistema estadual de avaliação aplicado no 2º ano ficam fora da série — e a ausência não é resultado ruim, é ausência de medição.</p></main>${footer(pagina, fonte)}</section>`;
  }

  const linhas = a.series
    .map(
      (s) =>
        `<tr><td>${s.year}</td><td class="num"><b>${esc(pct(s.value))}</b></td><td class="num">${esc(s.target === null ? "—" : pct(s.target))}</td><td class="num">${
          s.met === null
            ? `<span class="neutral">sem meta</span>`
            : s.met
              ? `<span class="good">cumpriu</span>`
              : `<span class="warn-text">não cumpriu</span>`
        }</td></tr>`,
    )
    .join("");

  const metaTexto = a.latest.target !== null
    ? a.latest.met
      ? `<b class="good">acima da meta</b> de ${esc(pct(a.latest.target))} pactuada para ${a.latest.year}`
      : `<b class="warn-text">${esc(decimal.format(a.latest.target - a.latest.value))} pontos abaixo</b> da meta de ${esc(pct(a.latest.target))} pactuada para ${a.latest.year}`
    : `sem meta pactuada para ${a.latest.year}`;

  const ritmo =
    a.finalTarget && a.observedPace !== null
      ? a.observedPace >= a.finalTarget.requiredPace
        ? `<div class="insight"><b>O ritmo atual chega lá.</b> Para alcançar ${esc(pct(a.finalTarget.target))} em ${a.finalTarget.year}, o município precisa de <b>${esc(decimal.format(a.finalTarget.requiredPace))} pontos por ano</b> — e o último intervalo medido avançou ${esc(decimal.format(a.observedPace))}. Manter é a estratégia; o risco é tratar meta atingida como problema resolvido e desmontar o que funcionou.</div>`
        : `<div class="risk"><b>O ritmo atual não chega lá.</b> Faltam <b>${esc(decimal.format(a.finalTarget.requiredPace))} pontos por ano</b> até ${a.finalTarget.year} para cumprir ${esc(pct(a.finalTarget.target))}, e o último intervalo medido avançou ${esc(decimal.format(a.observedPace))}. A diferença não se fecha com mais do mesmo: exige recomposição focalizada no 1º e 2º ano, com avaliação diagnóstica por turma.</div>`
      : `<div class="note"><b>Ritmo:</b> a série ainda não tem dois pontos comparáveis para medir a velocidade de avanço.</div>`;

  const proxima = a.nextTarget
    ? a.nextTarget.gapPoints > 0
      ? `<div class="card warn"><h3>O próximo compromisso</h3><div class="metric"><div class="metric-value">${esc(pct(a.nextTarget.target))}</div><div class="metric-label">meta de ${a.nextTarget.year}</div></div><div class="divider"></div><p>Faltam <b>${esc(decimal.format(a.nextTarget.gapPoints))} pontos</b> sobre o resultado de ${a.latest.year}. Em turma de alfabetização, isso é um punhado de crianças por escola — o que faz da meta um problema de lista nominal, não de política abstrata.</p></div>`
      : `<div class="card accent"><h3>O próximo compromisso</h3><div class="metric"><div class="metric-value">${esc(pct(a.nextTarget.target))}</div><div class="metric-label">meta de ${a.nextTarget.year}</div></div><div class="divider"></div><p>O resultado de ${a.latest.year} <b>já supera</b> a meta do ano seguinte. O compromisso vira manter o patamar enquanto a meta sobe: em ${a.nextTarget.year} a régua ainda é ${esc(pct(a.nextTarget.target))}, mas segue subindo até ${a.finalTarget ? a.finalTarget.year : 2030}.</p></div>`
    : "";

  const participacao =
    a.participation === null
      ? ""
      : a.fragileParticipation
        ? `<div class="note mt-2"><b>Participação de ${esc(pct(a.participation))} na avaliação.</b> Abaixo de 80%, o resultado descreve quem fez a prova, não a rede: quem falta na avaliação costuma ser exatamente quem tem mais dificuldade, e a ausência empurra o percentual para cima. Antes de celebrar ou de se alarmar com o número, vale conferir a taxa de presença escola a escola.</div>`
        : `<div class="note mt-2"><b>Participação de ${esc(pct(a.participation))}.</b> Acima de 80%, o resultado representa a rede — a leitura acima é confiável no agregado, e a próxima camada é olhar por escola.</div>`;

  const regua = a.state
    ? ` A rede pública do ${esc(a.state.uf)} marcou ${esc(pct(a.state.value))} no mesmo ano — régua estadual, universo mais amplo que a rede municipal.`
    : "";

  return `<section class="page content-page">${header("Alfabetização")}<main class="page-body"><div class="kicker">A única meta que é do próprio município</div><h2>${esc(pct(a.latest.value))} das crianças alfabetizadas no 2º ano</h2><p class="lede">O Indicador Criança Alfabetizada mede o percentual de alunos do 2º ano acima de 743 pontos na escala Saeb — o corte que o Compromisso Nacional Criança Alfabetizada define como "alfabetizado". Em ${a.latest.year} a rede municipal ficou ${metaTexto}.${regua}</p><div class="grid-4 mt-3">${metric(pct(a.latest.value), `alfabetizados · ${a.latest.year}`)}${metric(
    a.latest.target === null ? "N/D" : pct(a.latest.target),
    `meta pactuada · ${a.latest.year}`,
  )}${metric(
    a.changePoints === null ? "N/D" : `${a.changePoints >= 0 ? "+" : ""}${decimal.format(a.changePoints)} p.p.`,
    `variação ${a.series[0].year}–${a.latest.year}`,
  )}${metric(a.levelLabel ? a.levelLabel.replace(/\s*\(.*\)$/, "") : "N/D", "nível no Compromisso")}</div><div class="grid-2 mt-3"><div class="card accent"><h3>Resultado contra a meta, ano a ano</h3><table><thead><tr><th>Ano</th><th class="num">Alfabetizados</th><th class="num">Meta</th><th class="num">Situação</th></tr></thead><tbody>${linhas}</tbody></table><p class="micro" style="margin-top:.06in">Metas do CNCA pactuadas por município, não referência nacional.</p></div>${proxima}</div><div class="mt-2">${ritmo}</div>${participacao}<div class="insight mt-2"><b>Por que isto está num dossiê de FUNDEB:</b> criança que sai do 2º ano sem ler acumula defasagem, vira distorção idade-série e engrossa o abandono nos anos finais — e distorção e abandono são a <b>Condicionalidade I do VAAR</b>, a que mede fluxo. Alfabetização não é só a política mais importante da rede: é a origem do indicador que decide se o município recebe a parcela do fundo vinculada a resultado.</div><p class="small mt-1">Fonte: ${esc(fonte)}, edição ${a.latest.year} — rede municipal, alunos do 2º ano. Metas oficiais do Compromisso por município. ${esc(a.levelLabel ?? "")}</p></main>${footer(pagina, fonte)}</section>`;
}

/**
 * Ciclo político — quem assina e até quando, e o calendário que fecha portas.
 *
 * A página existe porque duas datas mudam o que é possível fazer com o
 * dinheiro: o fim do mandato (LRF, art. 21 e 42) e os três meses antes do
 * pleito (Lei nº 9.504/1997, art. 73, VI, "a", que veda transferência
 * voluntária da União e dos estados aos municípios). Um plano de captação
 * desenhado sem esse calendário perde o exercício inteiro.
 */
function paginaCicloPolitico(model: MunicipalXrayModel, pagina: number): string {
  const p = model.politics;
  const fonte = "TSE — resultados das eleições municipais";

  if (!p) {
    return `<section class="page content-page">${header("Ciclo político")}<main class="page-body"><div class="kicker">Quem assina e até quando</div><h2>Resultado eleitoral não localizado na base</h2><p class="lede">O dataset local do TSE não trouxe o pleito deste município. O calendário legal descrito nas demais páginas continua valendo — o que falta é a identificação do mandato.</p></main>${footer(pagina, fonte)}</section>`;
  }

  const gestor = p.current.party ? `${p.current.mayor} (${p.current.party})` : p.current.mayor;
  const anoEleitoral = p.nextElection;
  const ultimoAnoMandato = p.term.end;

  const leitura = {
    reeleicao: {
      classe: "insight",
      titulo: "Reeleição: continuidade com responsabilidade acumulada",
      texto: `${esc(gestor)} foi reeleito${p.previous ? ` (também eleito em ${p.previous.election})` : ""}. A série histórica deste dossiê é do próprio gestor: não há "herança" para explicar resultado, e a equipe da secretaria provavelmente domina o Educacenso e o SIOPE. <b>Para a consultoria isso muda o argumento</b> — o diagnóstico não apresenta um problema novo, mostra o que oito anos de gestão deixaram em aberto, e a conversa é de aperfeiçoamento, não de reconstrução.`,
    },
    sucessao_mesmo_partido: {
      classe: "note",
      titulo: "Sucessão dentro do mesmo grupo político",
      texto: `${esc(gestor)} sucedeu ${p.previous ? `${esc(p.previous.mayor)}` : "o gestor anterior"} mantendo o partido (${esc(p.current.party)}). Costuma significar continuidade administrativa parcial: parte da equipe técnica permanece, parte muda. <b>Vale mapear quem ficou</b> — se o responsável pelo Censo e pelo SIOPE é o mesmo, a série de declaração é confiável; se mudou, os dois últimos exercícios merecem conferência.`,
    },
    alternancia: {
      classe: "risk",
      titulo: "Alternância: a secretaria começou do zero",
      texto: `${esc(gestor)} substituiu ${p.previous ? `${esc(p.previous.mayor)} (${esc(p.previous.party)})` : "o gestor anterior"} com troca de partido. Alternância troca secretário, equipe técnica e frequentemente o sistema de gestão escolar — e a <b>declaração do Censo do primeiro ano</b> foi feita por gente que acabou de chegar. Erro de declaração no primeiro Censo do mandato custa receita no exercício seguinte, e é o erro mais comum que este dossiê encontra.`,
    },
    indeterminado: {
      classe: "note",
      titulo: "Comparação com o mandato anterior indisponível",
      texto: `${esc(gestor)} foi eleito em ${p.current.election}. O pleito anterior não consta na base local para este município, então não é possível dizer se houve reeleição, sucessão ou alternância — a pergunta entra no roteiro de campo em vez de virar afirmação.`,
    },
  }[p.status];

  const panorama = p.nationwide
    ? `<div class="card"><h3>Régua nacional da última eleição</h3><table><tbody><tr><td>Prefeitos reeleitos</td><td class="num"><b>${int(p.nationwide.reelected)}</b> (${esc(pct((p.nationwide.reelected / p.nationwide.total) * 100))})</td></tr><tr><td>Sucessão no mesmo partido</td><td class="num">${int(p.nationwide.successions)} (${esc(pct((p.nationwide.successions / p.nationwide.total) * 100))})</td></tr><tr><td>Alternância de partido</td><td class="num"><b>${int(p.nationwide.alternations)}</b> (${esc(pct((p.nationwide.alternations / p.nationwide.total) * 100))})</td></tr></tbody></table><div class="divider"></div><p class="small">Base: ${int(p.nationwide.total)} municípios com resultado nos dois pleitos no dataset local. A maioria do país trocou de comando — o que faz da descontinuidade administrativa a regra, não a exceção.</p></div>`
    : "";

  return `<section class="page content-page">${header("Ciclo político")}<main class="page-body"><div class="kicker">Quem assina e até quando</div><h2>O calendário do mandato decide o que ainda cabe neste ciclo</h2><p class="lede">Mandato de <b>${p.term.start} a ${p.term.end}</b>, eleito no pleito de ${p.current.election}. Duas datas do calendário legal restringem o que a gestão pode fazer com dinheiro novo, e as duas caem no fim do ciclo — planejar captação sem elas é perder exercício.</p><div class="grid-4 mt-3">${metric(esc(p.current.mayor), `chefe do Executivo${p.current.party ? ` · ${p.current.party}` : ""}`)}${metric(
    `${p.term.start}–${p.term.end}`,
    "mandato em curso",
  )}${metric(
    {
      reeleicao: "Reeleição",
      sucessao_mesmo_partido: "Sucessão",
      alternancia: "Alternância",
      indeterminado: "N/D",
    }[p.status],
    "última transição",
  )}${metric(String(anoEleitoral), "próximo pleito municipal")}</div><div class="grid-2 mt-3"><div class="${leitura.classe}"><b>${esc(leitura.titulo)}.</b> ${leitura.texto}</div>${panorama}</div><div class="card warn mt-2"><h3>As duas travas legais do fim de mandato</h3><table><thead><tr><th>Quando</th><th>O que trava</th><th>Base legal</th></tr></thead><tbody><tr><td><b>${anoEleitoral}</b>, três meses antes do pleito</td><td>Transferência voluntária da União e do estado ao município fica <b>vedada</b> (salvo obra em andamento e ações de emergência). Emenda e convênio novos não são assinados nesse intervalo.</td><td>Lei nº 9.504/1997, art. 73, VI, "a"</td></tr><tr><td><b>${ultimoAnoMandato}</b>, últimos 180 dias</td><td>Proibido contrair obrigação de despesa que não possa ser paga no exercício, e aumento de despesa de pessoal no último quadrimestre.</td><td>LRF, art. 42 e art. 21, parágrafo único</td></tr></tbody></table><p class="small mt-1">Consequência prática para a educação: projeto que depende de convênio federal precisa estar <b>assinado e com liberação iniciada antes da janela</b>, e obra contratada no fim do mandato sem caixa vira restos a pagar do sucessor — exatamente o mecanismo que produz as obras paralisadas da página do FNDE.</p></div><div class="note mt-1"><b>Perguntas de campo:</b> quem responde hoje pelo Educacenso e pelo SIOPE, e desde quando está no cargo? A secretaria manteve o sistema de gestão escolar do mandato anterior ou migrou? Existe plano de captação com as datas de ${anoEleitoral} marcadas, ou a expectativa é assinar convênio no meio do ano eleitoral?</div><p class="micro mt-1">Fonte: ${esc(fonte)} (dataset local, pleitos de ${p.previous ? `${p.previous.election} e ` : ""}${p.current.election}). Nome de urna e partido conforme a diplomação; eventual mudança de partido no curso do mandato não aparece nesta base.</p></main>${footer(pagina, fonte)}</section>`;
}

/**
 * CAUC — a lista de checagem que decide se o município pode receber.
 *
 * Complemento natural da página de dinheiro federal: lá está quanto pode
 * entrar, aqui está o que impede de entrar. A regra de honestidade é rígida:
 * `Desabilitado` vale para o país inteiro e nunca é apresentado como falha
 * local; só `!` (comprovação não obtida) é pendência do ente.
 */
function paginaCauc(model: MunicipalXrayModel, pagina: number): string {
  const c = model.cauc;
  const fonte = "Tesouro Nacional — CAUC, extrato de requisitos fiscais";

  // O bloco de pontualidade vem de outra fonte (extrato de entregas do
  // Tesouro) e sobrevive à ausência do CAUC — repeti-lo aqui evita que ele
  // suma do dossiê junto com um extrato que não respondeu.
  if (!c) {
    return `<section class="page content-page">${header("Requisitos fiscais")}<main class="page-body"><div class="kicker">O que trava uma transferência</div><h2>Extrato do CAUC indisponível nesta emissão</h2><p class="lede">O extrato do Tesouro não respondeu no momento da geração. O CAUC é atualizado em dias úteis e a consulta pode ser repetida — nenhum valor é estimado no lugar do dado.</p>${blocoPontualidadeFiscal(model)}</main>${footer(pagina, fonte)}</section>`;
  }

  const dataPesquisa = c.queriedAt
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${c.queriedAt}T12:00:00Z`))
    : "—";
  const totalItens = c.proven + c.pending.length + c.disabled;
  const panorama = c.nationwide
    ? `${integer.format(c.nationwide.withPending)} dos ${integer.format(c.nationwide.total)} municípios do país (${decimal.format((c.nationwide.withPending / c.nationwide.total) * 100)}%) têm ao menos uma pendência hoje`
    : "";

  const listaPendencias = c.pending.length
    ? `<table><thead><tr><th>Item</th><th>Requisito sem comprovação</th></tr></thead><tbody>${c.pending
        .map(
          (p) =>
            `<tr><td><b>${esc(p.code)}</b></td><td>${esc(p.label)}${
              c.pendingEducation.some((e) => e.code === p.code)
                ? ` <b class="warn-text">· educação/FUNDEB</b>`
                : ""
            }</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "";

  const blocoEducacao = c.pendingEducation.length
    ? `<div class="risk mt-2"><b>${c.pendingEducation.length === 1 ? "Uma pendência é de educação" : `${c.pendingEducation.length} pendências são de educação`}:</b> ${c.pendingEducation
        .map((p) => `${esc(p.code)} — ${esc(p.label)}`)
        .join("; ")}. São os itens em que o Tesouro confere a aplicação mínima do FUNDEB e o envio do Anexo 8 ao SIOPE — <b>o mesmo envio que habilita o município ao VAAT</b> (art. 13, §4º da Lei nº 14.113/2020). Aqui a pendência custa duas coisas ao mesmo tempo: a transferência voluntária que não é assinada e a complementação que não é habilitada.</div>`
    : `<div class="insight mt-2"><b>Nenhuma pendência nos cinco itens de educação</b> (aplicação mínima em educação, os 70% do FUNDEB para profissionais, os 15% de capital da complementação, os 50% do VAAT na infantil e o Anexo 8 ao SIOPE). É o sinal mais direto de que a prestação de contas da educação está em dia — e é ela que sustenta a habilitação ao VAAT.</div>`;

  return `<section class="page content-page">${header("Requisitos fiscais")}<main class="page-body"><div class="kicker">O que trava uma transferência voluntária</div><h2>${
    c.pending.length === 0
      ? "Nenhuma pendência no extrato do CAUC"
      : `${c.pending.length} ${c.pending.length === 1 ? "pendência bloqueia" : "pendências bloqueiam"} novos convênios`
  }</h2><p class="lede">O CAUC é a lista que a União consulta antes de assinar convênio, emenda ou termo de compromisso: cada item é um requisito fiscal, e a célula publicada é a data de validade da comprovação. Consulta de ${esc(dataPesquisa)}${panorama ? ` — ${esc(panorama)}` : ""}.</p><div class="grid-4 mt-3">${metric(int(c.pending.length), "requisitos sem comprovação")}${metric(int(c.proven), "requisitos comprovados")}${metric(
    int(c.pendingEducation.length),
    "pendências de educação/FUNDEB",
  )}${metric(
    c.nextExpiry ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${c.nextExpiry.until}T12:00:00Z`)) : "N/D",
    "próximo vencimento",
  )}</div><div class="grid-2 mt-3"><div class="card ${c.pending.length ? "bad" : "accent"}"><h3>${
    c.pending.length ? "Pendências nomeadas" : "Situação no extrato"
  }</h3>${
    listaPendencias ||
    `<p>Todos os ${int(c.proven)} requisitos verificáveis estão comprovados na consulta de ${esc(dataPesquisa)}. Isso não é permanente: cada comprovação tem prazo, e a próxima a vencer é <b>${esc(c.nextExpiry?.code ?? "—")} — ${esc(c.nextExpiry?.label ?? "sem vencimento informado")}</b>.</p>`
  }</div><div class="card"><h3>Como ler o extrato</h3><ul><li><b>Data</b> = requisito comprovado, válido até aquele dia.</li><li><b>"!"</b> = o CAUC não obteve a comprovação. É a pendência que trava a transferência.</li><li><b>"Desabilitado"</b> = item indisponível na data da consulta, <b>igual para todos os entes do país</b> — nunca é falha local. Foram ${int(c.disabled)} de ${int(totalItens)} itens nesta emissão.</li></ul><div class="divider"></div><p class="small">${
    c.nextExpiry
      ? `O prazo mais próximo é <b>${esc(new Intl.DateTimeFormat("pt-BR").format(new Date(`${c.nextExpiry.until}T12:00:00Z`)))}</b>, do item ${esc(c.nextExpiry.code)}. Requisito comprovado vira pendência sozinho quando o prazo passa: a rotina que protege a carteira de convênios é olhar o extrato antes do vencimento, não depois da recusa.`
      : "Nenhum vencimento informado nesta emissão."
  }</p></div></div>${blocoEducacao}${blocoPontualidadeFiscal(model)}<p class="micro mt-1">Fonte: ${esc(fonte)}, consulta de ${esc(dataPesquisa)} (publicação diária em dias úteis, CNPJ principal do ente). O extrato cobre parte dos requisitos legais das transferências voluntárias — item comprovado no CAUC não substitui a checagem do órgão concedente na assinatura.</p></main>${footer(pagina, `${fonte} · Tesouro Nacional — extrato de entregas`)}</section>`;
}

/**
 * Dinheiro de Brasília além do fundo — emendas, convênios e sanções.
 *
 * O FUNDEB é a maior transferência, mas não é a única: emenda parlamentar e
 * convênio são as vias discricionárias — e sanção no CEIS/CNEP é o que pode
 * fechá-las. As três pontas na mesma página porque se explicam mutuamente.
 */
function paginaDinheiroFederal(model: MunicipalXrayModel, pagina: number): string {
  const f = model.federalMoney;
  if (!f || (!f.emendas && !f.convenios && !f.sanctions)) {
    return `<section class="page content-page">${header("Dinheiro federal")}<main class="page-body"><div class="kicker">Além do fundo</div><h2>Emendas e convênios indisponíveis nesta emissão</h2><p class="lede">O Portal da Transparência não respondeu (ou a chave da API não está configurada). Nenhum valor é estimado no lugar do dado.</p></main>${footer(pagina, "Portal da Transparência/CGU")}</section>`;
  }

  const e = f.emendas;
  const anosRecentes = e ? e.years.slice(-4) : [];
  const totalRecente = anosRecentes.reduce((soma, a) => soma + a.committed, 0);
  const eduRecente = anosRecentes.reduce((soma, a) => soma + a.eduCommitted, 0);
  const linhasEmendas = anosRecentes
    .map(
      (a) =>
        `<tr><td>${a.year}</td><td class="num">${int(a.count)}</td><td class="num">${esc(compactMoney(a.committed))}</td><td class="num">${esc(compactMoney(a.paid))}</td><td class="num">${a.eduCount > 0 ? `<b>${esc(compactMoney(a.eduCommitted))}</b> (${int(a.eduCount)})` : "—"}</td></tr>`,
    )
    .join("");
  const autores = e && e.eduAuthors.length
    ? `<p class="small mt-1"><b>Quem emenda educação aqui:</b> ${e.eduAuthors
        .map((a) => `${esc(a.name)} (${esc(compactMoney(a.committed))})`)
        .join(" · ")} — interlocução natural para qualquer projeto de rede.</p>`
    : "";

  const c = f.convenios;
  // O objeto do convênio é o campo mais longo da folha e o que mais empurra a
  // altura; 68 caracteres bastam para identificar. Cortar *linhas* foi
  // tentado e revertido: `topVigentes` já vem limitado a 5 da origem, então
  // tirar uma só trocava um convênio por uma frase de aviso.
  const linhasTop = c && c.top.length
    ? c.top
        .map(
          (t) =>
            `<tr><td>${esc(t.objeto.length > 68 ? `${t.objeto.slice(0, 68)}…` : t.objeto)}</td><td class="num">${esc(compactMoney(t.valor))}</td><td class="num">${esc(t.fimVigencia ?? "N/D")}</td></tr>`,
        )
        .join("")
    : "";

  const s = f.sanctions;
  const blocoSancoes = !s
    ? `<div class="note"><b>CEIS/CNEP:</b> consulta indisponível nesta emissão.</div>`
    : s.entity.length
      ? `<div class="risk"><b>O ente aparece em cadastro de sanções.</b> ${s.entity
          .map((x) => `${esc(x.sancionado)} — ${esc(x.tipo)} (${esc(x.cadastro)}${x.fimSancao ? `, até ${esc(x.fimSancao)}` : ""})`)
          .join("; ")}. Sanção vigente sobre o ente trava transferência voluntária — emenda e convênio desta página incluídos. Conferir o CNPJ no Portal antes de qualquer pleito.</div>`
      : `<div class="insight"><b>CEIS/CNEP:</b> o ente municipal não aparece como sancionado na consulta nominal desta emissão${
          s.appliedByCity > 0
            ? ` — e a própria prefeitura mantém <b>${int(s.appliedByCity)}</b> ${s.appliedByCity === 1 ? "sanção registrada" : "sanções registradas"} contra fornecedores nos cadastros federais, sinal de que usa o instrumento da Lei 14.133`
            : `. A prefeitura não tem sanção própria registrada nos cadastros federais — ou não sanciona fornecedores, ou sanciona sem registrar: a Lei 14.133 manda registrar, e o registro é o que protege as outras prefeituras`
        }.</div>`;

  return `<section class="page content-page">${header("Dinheiro federal")}<main class="page-body"><div class="kicker">Além do fundo</div><h2>O dinheiro de Brasília que não passa pelo FUNDEB</h2><p class="lede">Emenda parlamentar e convênio são as vias discricionárias de recurso federal — as que dependem de articulação, projeto e adimplência, não de fórmula. A régua desta página: quanto chega, quanto de fato vira pagamento e o que pode fechar a torneira.</p>${
    e
      ? `<div class="grid-3 mt-3">${metric(compactMoney(totalRecente), `emendas empenhadas · ${anosRecentes[0]?.year ?? ""}–${anosRecentes[anosRecentes.length - 1]?.year ?? ""}`)}${metric(
          compactMoney(eduRecente),
          "das quais em educação (função 12)",
        )}${metric(
          c ? int(c.active) : "N/D",
          "convênios municipais vigentes",
        )}</div><table class="mt-2"><thead><tr><th>Ano</th><th class="num">Emendas</th><th class="num">Empenhado</th><th class="num">Pago</th><th class="num">Educação</th></tr></thead><tbody>${linhasEmendas}</tbody></table>${autores}`
      : `<div class="empty mt-3">Nenhuma emenda com aplicação carimbada neste município no dataset do Portal da Transparência${e === null ? "" : ""}.</div>`
  }${
    c
      ? `<div class="grid-2 mt-2"><div class="card accent"><h3>Convênios com o ente municipal</h3><table><tbody><tr><td>Vigentes</td><td class="num"><b>${int(c.active)}</b>${c.truncated ? " (parcial)" : ""}</td></tr><tr><td>Valor da carteira vigente</td><td class="num"><b>${esc(compactMoney(c.activeValue))}</b></td></tr><tr><td>Já liberado</td><td class="num">${esc(compactMoney(c.activeReleased))}</td></tr><tr><td>Vigentes sem nenhuma liberação</td><td class="num"><b>${int(c.noRelease)}</b></td></tr><tr><td>Educação (função 12)</td><td class="num">${int(c.eduActive)}${c.eduActive > 0 ? ` · ${esc(compactMoney(c.eduActiveValue))}` : ""}</td></tr></tbody></table>${
          c.truncated
            ? `<p class="micro" style="margin-top:.05in">Carteira maior que a janela de consulta — os totais são piso, não teto.</p>`
            : ""
        }</div><div class="card"><h3>Maiores convênios vigentes</h3>${
          linhasTop
            ? `<table><thead><tr><th>Objeto</th><th class="num">Valor</th><th class="num">Fim da vigência</th></tr></thead><tbody>${linhasTop}</tbody></table>`
            : `<p class="small">Nenhum convênio vigente com convenente municipal na consulta.</p>`
        }<div class="divider"></div><p class="small">Convênio vigente <b>sem liberação</b> é a pergunta de campo: falta cláusula suspensiva, contrapartida, licença — ou só falta cobrar?</p></div></div>`
      : `<div class="note mt-2"><b>Convênios:</b> consulta indisponível nesta emissão (Portal da Transparência).</div>`
  }<div class="mt-2">${blocoSancoes}</div><p class="small mt-1">Fonte: Portal da Transparência/CGU — emendas parlamentares (download de dados${e?.dataAsOf ? `, extração de ${esc(e.dataAsOf)}` : ""}; somente emendas com município de aplicação identificado — a fatia estadual/nacional que beneficia o município de forma difusa não entra), convênios e CEIS/CNEP (consulta viva na emissão; sanções por busca nominal do ente). Valores nominais.</p></main>${footer(pagina, "Portal da Transparência/CGU — emendas, convênios e sanções")}</section>`;
}

/**
 * Precatório do FUNDEF — o dinheiro que já entrou e a regra que pesa sobre ele.
 *
 * É a única página do Raio-X em que a obrigação legal é aritmética sobre um
 * número que o próprio município declarou: se entraram R$ X sob a EC nº
 * 114/2021, então R$ 0,6·X têm destino carimbado em abono. O relatório não
 * afirma que o abono foi pago — isso não é público em lugar nenhum, nem na DCA
 * nem no SIOPE. Ele imprime o piso legal e transforma o resto em pergunta.
 *
 * Três cuidados que a página tem de manter:
 *
 * 1. **Zero não é achado.** Município que só recebeu antes de 2022 tem mínimo
 *    de abono igual a zero — imprimir "R$ 0,00" como se fosse a obrigação
 *    seria mentir por aritmética. Esse caso tem ramo próprio.
 * 2. **Ausência não é prova.** Não haver receita declarada pode ser precatório
 *    não pago, ação em curso ou classificação em outra conta.
 * 3. **A sanção é real e já está no relatório.** Descumprir a destinação
 *    suspende transferência voluntária (Lei nº 14.325/2022, art. 3º) — a mesma
 *    porta que a página do CAUC e a de convênios tratam.
 */
function paginaPrecatorioFundef(model: MunicipalXrayModel, pagina: number): string {
  const p = model.fundefWrit;
  const rodape = "SICONFI/Tesouro — DCA, Anexo I-C · EC nº 114/2021 e Lei nº 14.325/2022";

  const base = `<div class="kicker">Decisão judicial</div><h2>Precatório do FUNDEF</h2>`;
  const lei = `<div class="card mt-2"><h3>A regra que acompanha o dinheiro</h3><p class="small"><b>EC nº 114/2021, art. 5º</b> — as receitas recebidas “deverão ser aplicadas na manutenção e desenvolvimento do ensino fundamental público e na valorização de seu magistério, conforme destinação originária do Fundo”.</p><p class="small"><b>Parágrafo único</b> — “no mínimo 60% (sessenta por cento) deverão ser repassados aos profissionais do magistério, inclusive aposentados e pensionistas, <b>na forma de abono</b>, vedada a incorporação na remuneração, na aposentadoria ou na pensão”.</p><p class="small"><b>Lei nº 14.325/2022</b> — acrescentou o art. 47-A à Lei nº 14.113/2020: têm direito ao rateio os profissionais em efetivo exercício no período dos repasses a menor, aposentados e herdeiros; cada ente define os critérios <b>em lei específica</b> (art. 2º); e a União <b>suspende transferências voluntárias</b> de quem descumprir (art. 3º).</p></div>`;

  if (!p) {
    return `<section class="page content-page">${header("Precatório do FUNDEF")}<main class="page-body">${base}<p class="lede">O SICONFI não respondeu à consulta da DCA nesta emissão, então o relatório não afirma nem que houve recebimento nem que não houve. A conta a conferir é a de transferências decorrentes de decisão judicial relativas ao FUNDEF.</p>${lei}<div class="note mt-2"><b>Pergunta de campo:</b> o município tem ação judicial de complementação do FUNDEF? Em que fase — trânsito em julgado, precatório expedido, pago? Houve lei municipal de rateio?</div></main>${footer(pagina, rodape)}</section>`;
  }

  const janela = `${p.window[0]}–${p.window[p.window.length - 1]}`;
  // As ressalvas aparecem uma vez só, coladas na tabela que elas qualificam —
  // repeti-las no rodapé de fonte fazia a folha dizer duas vezes a mesma coisa.
  const lacuna = p.notes.length
    ? `<p class="micro mt-1">${p.notes.map((n) => esc(n)).join(" ")}</p>`
    : "";

  if (!p.received) {
    return `<section class="page content-page">${header("Precatório do FUNDEF")}<main class="page-body">${base}<p class="lede">Nenhuma receita de precatório do FUNDEF foi declarada por este município na DCA dos exercícios ${esc(janela)}. <b>Isso não significa ausência de direito.</b> Pode ser precatório ainda não pago, ação em curso, ou receita classificada em outra conta.</p><div class="insight mt-2"><b>Por que a página existe mesmo assim:</b> entre 1998 e 2006 a União calculou a complementação do FUNDEF por um valor mínimo por aluno abaixo do que a Lei nº 9.424/1996 determinava. Centenas de municípios processaram e ganharam; o pagamento só destravou com a EC nº 114/2021. Município que nunca ajuizou não aparece nesta conta — e não aparecer é exatamente o que precisa ser verificado com a procuradoria.</div>${lei}${lacuna}<div class="grid-2 mt-2"><div class="card accent"><h3>Como conferir em uma tarde</h3><ul class="small"><li>Pedir à procuradoria o <b>número do processo</b> de complementação do FUNDEF e a última movimentação.</li><li>Se houver trânsito em julgado, conferir no Tribunal Regional Federal da região se o <b>precatório já foi expedido</b> e em que fila está.</li><li>Conferir na contabilidade se algum ingresso foi classificado fora das duas contas do precatório do FUNDEF — <b>1.7.1.8.13.0.0</b> (até 2021) e <b>1.7.1.9.56.0.0</b> (de 2022 em diante).</li></ul></div><div class="card"><h3>Por que a conferência não pode esperar</h3><p class="small">O recurso, quando entra, já entra amarrado: no mínimo 60% em abono ao magistério e o resto em MDE do ensino fundamental. Descobrir isso <b>depois</b> de o dinheiro ter sido aplicado em outra coisa é o cenário caro — o art. 3º da Lei nº 14.325/2022 suspende transferência voluntária de quem descumpre a destinação, e a devolução é cobrada do ente, não de quem decidiu.</p></div></div><div class="note mt-2"><b>Perguntas de campo:</b> (1) existe ação de complementação do FUNDEF ajuizada pelo município, e em que fase está? (2) se houve recebimento, em que conta contábil ele foi classificado? (3) existe lei municipal de rateio aprovada?</div><p class="small mt-2">Fonte: SICONFI/Tesouro Nacional — DCA, Anexo I-C, exercícios ${esc(janela)}.</p></main>${footer(pagina, rodape)}</section>`;
  }

  const linhas = p.years
    .map(
      (a) =>
        `<tr><td>${a.year}</td><td class="num">${esc(money(a.value))}</td><td class="num">${esc(a.account)}</td><td>${a.underEc114 ? `<b class="good">sim</b>` : `<span class="neutral">não</span>`}</td></tr>`,
    )
    .join("");

  const proporcao =
    model.fundebCurrent !== null && model.fundebCurrent > 0
      ? Math.round((p.total / model.fundebCurrent) * 1000) / 10
      : null;
  const escala =
    proporcao !== null
      ? `<p class="small mt-1">O total recebido equivale a <b>${esc(pct(proporcao))}</b> da receita anual do FUNDEB de ${model.currentYear} — é dinheiro de uma ordem de grandeza que muda orçamento, e por isso a regra de destino é dura.</p>`
      : "";

  // Só quem recebeu a partir de 2022 tem mínimo de abono a apurar. Quem
  // recebeu antes tem outra conversa — e ela não é "R$ 0,00".
  const bloco =
    p.underEc114 > 0
      ? `<div class="grid-3 mt-3">${metric(compactMoney(p.total), `recebido · ${esc(janela)}`)}${metric(
          compactMoney(p.minimumBonus),
          "mínimo em abono ao magistério (60%)",
        )}${metric(compactMoney(p.remainderMde), "restante, carimbado em MDE")}</div>${escala}<div class="risk mt-2"><b>O que a lei destina, e o que o relatório não sabe:</b> dos ${esc(
          money(p.underEc114),
        )} recebidos sob a EC nº 114/2021, <b>${esc(
          money(p.minimumBonus),
        )}</b> têm destino carimbado em abono ao magistério. Se esse pagamento foi feito, <b>nenhuma base pública registra</b> — nem a DCA, que não tem conta de despesa para isso, nem o SIOPE, que não tem indicador. A comprovação está no município.</div>`
      : `<div class="grid-2 mt-3">${metric(compactMoney(p.total), `recebido · ${esc(janela)}`)}${metric(
          `${p.firstYear ?? ""}${p.lastYear && p.lastYear !== p.firstYear ? `–${p.lastYear}` : ""}`,
          "exercícios do recebimento",
        )}</div>${escala}<div class="note mt-2"><b>Todo o valor entrou antes de 2022.</b> A subvinculação de 60% em abono nasceu com a EC nº 114/2021, promulgada em 16/12/2021 — este relatório não a aplica retroativamente, porque isso seria tese jurídica e não leitura de fonte. O que já valia, por decorrência da natureza do Fundo, é a destinação ao ensino fundamental e à valorização do magistério. <b>Se os recursos ainda não foram integralmente aplicados</b>, o alcance da regra sobre o saldo é pergunta para a procuradoria do município.</div>`;

  return `<section class="page content-page">${header("Precatório do FUNDEF")}<main class="page-body">${base}<p class="lede">A União pagou a este município, por decisão judicial, a diferença da complementação do FUNDEF que deixou de repassar entre 1998 e 2006. O valor abaixo é o que a <b>própria prefeitura declarou</b> ter recebido na Declaração de Contas Anuais.</p>${bloco}<table class="mt-2"><thead><tr><th>Exercício</th><th class="num">Recebido</th><th class="num">Conta no SICONFI</th><th>Sob a EC 114/2021</th></tr></thead><tbody>${linhas}</tbody></table>${lacuna}${lei}<div class="note mt-2"><b>Perguntas de campo, com o número na mão:</b> (1) existe lei municipal de rateio, como manda o art. 2º da Lei nº 14.325/2022? (2) o abono foi pago, a quantos profissionais e em que exercício? (3) o pagamento respeitou a vedação de incorporação? (4) há saldo do precatório ainda não aplicado, e onde ele está?</div><p class="small mt-2">Fonte: SICONFI/Tesouro Nacional — DCA, Anexo I-C, exercícios ${esc(janela)}, receita bruta realizada declarada pelo ente. Valores nominais, sem correção.</p></main>${footer(pagina, rodape)}</section>`;
}

/**
 * Densidade e dispersão — o custo geográfico que o valor-aluno não enxerga.
 *
 * O mapa da página anterior mostra onde a rede está; esta mede quão longe ela
 * chega. Duas redes com a mesma matrícula e o mesmo VAAF custam diferente se
 * uma cabe em 40 km² e a outra se espalha por milhares: transporte, merenda,
 * supervisão e reposição de professor são todos função da distância, e o fator
 * do campo (+15%) paga igual para a escola a 6 km e para a que está a 90.
 *
 * O cruzamento é o achado: % da população que é rural × % das escolas rurais ×
 * % das matrículas nelas. Divergência grande entre a primeira e a última é
 * pergunta de campo com o número dentro, nunca acusação.
 */
function paginaDensidadeRede(model: MunicipalXrayModel, pagina: number): string {
  const d = model.schoolMap ? analisarDispersao(model.schoolMap.schools, model.area) : null;
  const pop = model.ruralPopulation;
  const FONTE = "INEP — Censo Escolar (coordenadas) · IBGE — área territorial e Censo 2022";

  if (!d) {
    return `<section class="page content-page">${header("Densidade e dispersão")}<main class="page-body"><div class="kicker">O custo geográfico de ofertar</div><h2>Dispersão da rede indisponível</h2><p class="lede">Os microdados do Censo Escolar não trouxeram a rede municipal deste município — sem as escolas, não há dispersão a medir.</p>${
      pop
        ? `<div class="note mt-3"><b>População rural:</b> ${pct(pop.ruralPct)} dos ${int(pop.total)} residentes moram em área rural (Censo ${pop.year}).</div>`
        : ""
    }</main>${footer(pagina, FONTE)}</section>`;
  }

  // O nome só existe para escolas que aparecem na divulgação do IDEB; sem
  // correspondência, a distância sai sozinha em vez de inventar rótulo.
  const nomeMaisDistante = d.maisDistante
    ? model.schoolResults?.list.find((e) => e.code === d.maisDistante!.codigo)?.name ?? null
    : null;

  const semCoordenada = d.total - d.comCoordenada;

  /**
   * A rede não tem escola rural — fato do município, não falha de coleta.
   *
   * Vale só quando a contagem é conhecida e é zero: `null` continua sendo
   * ausência de informação e segue tratado como tal.
   */
  const semEscolaRural = d.escolasRuraisPct === 0;
  /** Município inteiramente urbano: as duas pontas do cruzamento são zero. */
  const totalmenteUrbano = semEscolaRural && pop !== null && pop.ruralPct === 0;

  // A comparação que gera a pergunta: população rural × matrícula rural.
  //
  // Duas réguas, e as duas precisam concordar antes de o texto afirmar algo.
  // Só a diferença em pontos percentuais engana nos extremos: em Manaus a
  // população rural é 1,0% e a matrícula rural 5,4% — 4,4 pontos, que parecem
  // ruído, mas são cinco vezes a fatia. Só a razão engana no outro extremo,
  // onde 0,2% contra 0,6% também triplica sem significar nada.
  const lacuna =
    pop && d.matriculasRuraisPct !== null ? d.matriculasRuraisPct - pop.ruralPct : null;
  const razao =
    pop && pop.ruralPct > 0 && d.matriculasRuraisPct !== null
      ? d.matriculasRuraisPct / pop.ruralPct
      : null;
  const LIMIAR_PP = 3; // guarda absoluta contra ruído em fatias minúsculas.
  const RAZAO_BAIXA = 0.7;
  const RAZAO_ALTA = 1.4;

  /** "5,4 vezes" quando a razão é grande; "4,4 pontos" quando é modesta. */
  const magnitude = (acima: boolean) =>
    razao !== null && (acima ? razao >= 2 : razao <= 0.5)
      ? `<b>${decimal.format(Math.round((acima ? razao : 1 / razao) * 10) / 10)} vezes</b> ${acima ? "a fatia da" : "menor que a"} população rural`
      : `<b>${decimal.format(Math.abs(lacuna ?? 0))} pontos</b> ${acima ? "acima" : "abaixo"} da população rural`;

  let leitura: string;
  if (totalmenteUrbano) {
    // Dois zeros conhecidos não são o mesmo que duas pontas ausentes. Sem este
    // ramo o município inteiramente urbano caía no texto de baixo — "o
    // cruzamento não se sustenta" — que descreve falta de dado, quando o dado
    // existe e é conclusivo.
    leitura = `O Censo 2022 não registra população em área rural e nenhuma escola da rede está declarada em zona rural — o cruzamento é entre dois zeros, e não há dispersão de campo a medir. O custo geográfico aqui, se houver, é de <b>deslocamento urbano</b>: distância entre bairro e vaga, não entre sítio e sede. E o fator do campo (+15%) não entra na ponderação deste município.`;
  } else if (lacuna === null || razao === null) {
    leitura = `Sem uma das duas pontas (população por situação do domicílio ou matrícula por zona), o cruzamento não se sustenta e não é feito aqui.`;
  } else if (lacuna <= -LIMIAR_PP && razao <= RAZAO_BAIXA) {
    leitura = `A matrícula rural (${pct(d.matriculasRuraisPct)}) está ${magnitude(false)} (${pct(pop!.ruralPct)}). Só o campo separa as duas causas: a criança do campo é <b>transportada para a escola urbana</b> — rota que o valor-aluno não cobre — ou está na <b>rede estadual</b>. <b>Perguntar:</b> quantas rotas levam aluno do campo à sede, e a que custo anual?`;
  } else if (lacuna >= LIMIAR_PP && razao >= RAZAO_ALTA) {
    leitura = `A matrícula rural (${pct(d.matriculasRuraisPct)}) é ${magnitude(true)} (${pct(pop!.ruralPct)}) — a rede é mais rural que o município. Custo unitário alto por definição (turma menor, rota longa) e, ao mesmo tempo, é onde o fator do campo rende. <b>Perguntar:</b> a localização de todas essas escolas está declarada corretamente na coleta?`;
  } else {
    leitura = `A matrícula rural (${pct(d.matriculasRuraisPct)}) acompanha a população rural (${pct(pop!.ruralPct)}) — ${decimal.format(Math.abs(lacuna))} pontos de diferença. A rede segue a proporção do território, sem concentração forçada nem esvaziamento do campo.`;
  }

  const linhaMaisDistante = d.maisDistante
    ? `<tr><td>Escola mais afastada do núcleo${nomeMaisDistante ? ` — ${esc(nomeMaisDistante)}` : ""}</td><td class="num"><b>${decimal.format(d.maisDistante.km)} km</b>${d.maisDistante.matriculas !== null ? ` · ${int(d.maisDistante.matriculas)} alunos` : ""}</td></tr>`
    : "";

  return `<section class="page content-page">${header("Densidade e dispersão")}<main class="page-body"><div class="kicker">O custo geográfico de ofertar</div><h2>${d.envergaduraKm !== null ? `A rede se estende por ${decimal.format(d.envergaduraKm)} km de ponta a ponta` : "O alcance territorial da rede"}</h2><p class="lede">Dispersão é a despesa que não aparece no valor-aluno. O FUNDEB paga por matrícula ponderada, não por quilômetro rodado — e o fator do campo (+15%) é achatado: vale o mesmo para a escola a 6 km da sede e para a que está a ${d.maisDistante ? decimal.format(d.maisDistante.km) : "dezenas de"} km.</p><div class="grid-4 mt-3">${metric(
    d.porCemKm2 === null ? "N/D" : decimal.format(d.porCemKm2),
    "escolas por 100 km²",
  )}${metric(
    d.envergaduraKm === null ? "N/D" : `${decimal.format(d.envergaduraKm)} km`,
    "envergadura da rede",
  )}${metric(
    // Três situações, e antes as três davam "N/D": a rede não tem escola
    // rural; tem, mas nenhuma georreferenciada; ou a coleta falhou. A primeira
    // é um fato sobre o município — e num relatório que existe para nomear o
    // custo da dispersão, "não há escola rural" é resposta, não lacuna.
    semEscolaRural ? "não há" : d.mediaRuralKm === null ? "N/D" : `${decimal.format(d.mediaRuralKm)} km`,
    semEscolaRural ? "escola rural na rede" : "distância média das rurais ao núcleo",
  )}${metric(
    pop === null ? "N/D" : pct(pop.ruralPct),
    `população rural${pop ? ` · Censo ${pop.year}` : ""}`,
  )}</div><div class="grid-2 mt-3"><div class="card accent"><h3>O alcance da rede</h3><table><tbody><tr><td>Área territorial</td><td class="num">${model.area === null ? "N/D" : `${integer.format(model.area)} km²`}</td></tr><tr><td>Escolas municipais</td><td class="num"><b>${int(d.total)}</b></td></tr><tr><td>Com coordenada declarada</td><td class="num">${int(d.comCoordenada)}${semCoordenada > 0 ? ` <span class="micro">(${int(semCoordenada)} sem)</span>` : ""}</td></tr>${linhaMaisDistante}</tbody></table><div class="divider"></div><p class="small">O <b>núcleo</b> é a média das coordenadas das escolas urbanas — proxy da sede, de onde saem as rotas de transporte e a supervisão pedagógica. ${semCoordenada > 0 ? `As ${int(semCoordenada)} escolas sem coordenada não entram nas distâncias, mas contam nos totais e nos percentuais.` : "Todas as escolas da rede têm coordenada declarada."}</p></div><div class="card"><h3>Território × rede × matrícula</h3><table><tbody><tr><td>População em área rural</td><td class="num">${pop === null ? "N/D" : `<b>${pct(pop.ruralPct)}</b>`}</td></tr><tr><td>Escolas em zona rural</td><td class="num"><b>${pct(d.escolasRuraisPct)}</b></td></tr><tr><td>Matrículas em escolas rurais</td><td class="num">${d.matriculasRuraisPct === null ? "N/D" : `<b>${pct(d.matriculasRuraisPct)}</b>`}</td></tr></tbody></table><div class="divider"></div><p class="small">${leitura}</p></div></div>${
    d.mediaRuralKm !== null && d.maisDistante
      ? `<div class="insight mt-3"><b>O que a distância custa:</b> a escola rural média está a ${decimal.format(d.mediaRuralKm)} km do núcleo, e a mais afastada a ${decimal.format(d.maisDistante.km)} km — ida e volta, todo dia letivo, para aluno e para servidor, e também tempo de resposta da manutenção e da merenda. <b>Conferir:</b> o custo do transporte declarado no SIOPE bate com essa geografia? Rota longa com custo baixo costuma ser terceirização mal medida ou aluno em pé.</div>`
      : semEscolaRural
        ? `<div class="insight mt-3"><b>Rede sem escola rural:</b> não há distância de campo a calcular, e o fator de +15% do campo não entra na ponderação deste município. A dispersão que resta é urbana — a envergadura de ${d.envergaduraKm !== null ? `${decimal.format(d.envergaduraKm)} km` : "ponta a ponta"} atravessa bairros, não estradas vicinais. <b>Conferir:</b> a demanda por vaga acompanha onde a escola está? Rede compacta com fila em um bairro e ociosidade em outro é problema de alocação, não de distância.</div>`
        : `<div class="note mt-3"><b>Leitura limitada:</b> a rede tem escola em zona rural, mas nenhuma com coordenada declarada, então a distância ao núcleo não foi calculada. As contagens e percentuais acima seguem válidos.</div>`
  }<p class="micro mt-1">Fonte: coordenadas declaradas ao Censo Escolar${model.schoolMap?.year ? ` ${model.schoolMap.year}` : ""} (INEP, microdados); área territorial do IBGE; população por situação do domicílio no Censo Demográfico 2022 (IBGE, SIDRA tabela 10211), consultada na emissão. Distâncias em linha reta — a rodoviária é maior, nunca menor. Os denominadores diferem de propósito: a fatia da população é sobre todos os residentes, a da matrícula é sobre a rede municipal — a comparação vale como direção, não como identidade contábil.</p></main>${footer(pagina, FONTE)}</section>`;
}

/**
 * Declaração étnica — a corrente de três elos entre o povo e a ponderação.
 *
 * O Censo Demográfico **mede população**; o Censo Escolar **registra
 * declaração**; a planilha do FNDE **paga por segmento**. São três coisas
 * diferentes, e o dinheiro só aparece na terceira:
 *
 *   população indígena 0–14 (IBGE)
 *     → matrícula com cor/raça indígena declarada (Censo Escolar)
 *       → matrícula no segmento indígena do FUNDEB (ponderação 1,4–2,17)
 *
 * Cada seta é uma perda possível, e as duas têm causas distintas. Da primeira
 * para a segunda: a criança pode não estar na rede municipal (rede estadual,
 * fora da escola) **ou** a escola pode não ter preenchido a cor/raça. Da
 * segunda para a terceira: a criança está na rede e está declarada indígena,
 * mas estuda numa escola que **não é classificada como indígena** — e a
 * ponderação do fundo segue a classificação da ESCOLA, não a cor/raça do
 * aluno. Esse segundo vão é o que vira dinheiro, e é invisível em qualquer
 * página que olhe só duas das três pontas.
 *
 * REGRA DURA: pertencimento étnico é **autodeclaração**. Esta página aponta
 * lacuna de REGISTRO e jamais afirma que alguém "é" indígena ou quilombola,
 * nem estima quantos "deveriam" se declarar. O que ela faz é mostrar a
 * distância entre três contagens oficiais e transformar isso em pergunta.
 */
/**
 * O quarto elo da corrente, e o único que não é autodeclaração: a FUNAI
 * **cadastra** onde há aldeia. Só entra na folha quando existe aldeia
 * registrada — em nove de cada dez municípios o bloco simplesmente não aparece,
 * e a página fica como estava.
 *
 * Mora na folha "Território e fator", e não na de "Declaração étnica": a
 * segunda está estruturalmente cheia — media 95% a 98% de escala com dado
 * real, oscilando conforme o payload vivo do IBGE — e as duas tratam dos
 * mesmos povos. Passar raspando numa folha é transbordar na seguinte.
 *
 * O caso que vale a viagem é `registeredButUndeclared`: a FUNAI registra aldeia
 * e o Censo Escolar não declara **nenhuma** escola municipal em terra indígena.
 * Isso não é irregularidade — a escola pode ser estadual, as crianças podem
 * estudar fora da aldeia — mas é a conferência que ninguém faz, e o segmento
 * indígena é o de maior ponderação da tabela do FUNDEB.
 */
function blocoFunai(model: MunicipalXrayModel): string {
  const t = model.indigenousLands;
  if (!t || t.villages.length === 0) return "";

  // Bloco compacto de propósito: a folha da declaração étnica já estava no
  // limite, e uma tabela com cabeçalho custava ~100px — transbordo garantido
  // nos quatro municípios de teste que têm aldeia. A lista em linha cabe.
  // Duas, não três: a folha oscilava entre 95% e 100% conforme o payload vivo
  // do IBGE, e passar raspando num município é transbordar no seguinte.
  const MOSTRADAS = 2;
  const lista = t.villages
    .slice(0, MOSTRADAS)
    .map((a) => {
      // A fase vai como a FUNAI publica: "Encaminhada RI" virava "encaminhada
      // ri" ao passar por toLowerCase, e a sigla é o que identifica a etapa.
      const onde = a.land ? ` (TI ${esc(a.land)}${a.phase ? `, ${esc(a.phase)}` : ""})` : "";
      const perto =
        a.kmToSchool === null
          ? "sem coordenada"
          : `escola a ${decimal.format(a.kmToSchool)} km${
              a.kmToIndigenousSchool === null
                ? ", nenhuma indígena"
                : a.kmToIndigenousSchool > t.radiusKm
                  ? `, indígena a ${decimal.format(a.kmToIndigenousSchool)} km`
                  : ""
            }`;
      return `${esc(a.name)}${onde} — ${perto}`;
    })
    .join(" · ");
  const resto =
    t.villages.length > MOSTRADAS ? ` · e mais ${int(t.villages.length - MOSTRADAS)} no cadastro.` : ".";

  const leitura = t.registeredButUndeclared
    ? `<b>A FUNAI registra ${int(t.villages.length)} ${t.villages.length === 1 ? "aldeia" : "aldeias"} aqui e o Censo não declara nenhuma escola municipal em terra indígena.</b> Não é irregularidade — a escola pode ser estadual, ou as crianças podem estudar fora da aldeia. Mas a ponderação segue a classificação da escola, e é aqui que registro vira ou deixa de virar receita.`
    : t.villagesWithoutIndigenousSchool > 0
      ? `Das ${int(t.villagesWithCoords)} aldeias com coordenada, <b>${int(t.villagesWithoutIndigenousSchool)}</b> não têm escola municipal declarada como indígena num raio de ${t.radiusKm} km, contra ${int(t.indigenousSchools)} ${t.indigenousSchools === 1 ? "declarada" : "declaradas"} na rede. <b>Verificar:</b> quem atende essas aldeias, e a classificação da escola está correta na coleta?`
      : `As ${int(t.villagesWithCoords)} aldeias com coordenada têm escola municipal declarada como indígena a menos de ${t.radiusKm} km. Cadastro da FUNAI e classificação do Censo estão coerentes aqui.`;

  return `<div class="${t.registeredButUndeclared ? "risk" : "insight"} mt-2"><b>O que a FUNAI cadastra:</b> ${leitura}<span class="micro" style="display:block;margin-top:.05in">${lista}${resto} Fonte: FUNAI, cadastro de aldeias e terras indígenas.</span></div>`;
}

function paginaDeclaracaoEtnica(model: MunicipalXrayModel, pagina: number): string {
  const p = model.peoples;
  const totais = model.schoolMap?.raceTotals ?? null;
  const FONTE = "IBGE — Censo 2022 · INEP — Censo Escolar (cor/raça) · FNDE — matrículas ponderadas";

  if (!p) {
    // O cadastro da FUNAI não depende do Censo Demográfico: se o IBGE não
    // respondeu, a aldeia registrada continua sendo o dado mais duro da folha
    // e não pode cair junto.
    return `<section class="page content-page">${header("Declaração étnica")}<main class="page-body"><div class="kicker">População, registro e ponderação</div><h2>Cruzamento de declaração étnica indisponível</h2><p class="lede">O Censo 2022 não retornou a população indígena e quilombola deste município na emissão, então a corrente população → registro → ponderação fica sem o primeiro elo.</p>${blocoFunai(model)}</main>${footer(pagina, FONTE)}</section>`;
  }

  const ind = p.indigenous;
  const declarados = totais?.indigenous ?? null;

  // Elo 1 → 2: da população em idade escolar ao registro de cor/raça.
  const coberturaRegistro =
    declarados !== null && ind.schoolAge > 0
      ? Math.round((declarados / ind.schoolAge) * 1000) / 10
      : null;
  // Elo 2 → 3: do registro de cor/raça ao segmento que pondera.
  const conversaoSegmento =
    declarados !== null && declarados > 0
      ? Math.round((ind.enrolled / declarados) * 1000) / 10
      : null;

  // A diferença que vira dinheiro: alunos declarados indígenas na cor/raça que
  // não estão em escola classificada como indígena.
  const foraDoSegmento =
    declarados !== null && declarados > ind.enrolled ? declarados - ind.enrolled : 0;

  const naoDeclaradaPct =
    totais && totais.enrolled > 0
      ? Math.round((totais.undeclared / totais.enrolled) * 1000) / 10
      : null;
  const cadastroFragil = naoDeclaradaPct !== null && naoDeclaradaPct >= 20;

  let leitura: string;
  if (declarados === null) {
    leitura = `Os microdados do Censo Escolar não trouxeram a cor/raça da matrícula deste município, então o elo do meio da corrente fica em branco e o vão não pode ser localizado. O que segue válido é o par população × segmento, na página de território e fator.`;
  } else if (ind.schoolAge < 30) {
    leitura = `A população indígena de 0 a 14 anos é pequena demais (${int(ind.schoolAge)}) para sustentar leitura de subdeclaração — abaixo de 30 pessoas o Censo tem margem de erro maior que o próprio número. Nada a apurar aqui.`;
  } else if (foraDoSegmento > 0 && conversaoSegmento !== null && conversaoSegmento < 90) {
    leitura = `<b>${int(foraDoSegmento)} matrículas</b> declaradas com cor/raça indígena no Censo Escolar <b>não</b> aparecem no segmento indígena do FUNDEB. A causa provável não é fraude nem erro de cadastro do aluno: a ponderação segue a <b>classificação da escola</b>, não a cor/raça de quem estuda nela. Criança indígena matriculada em escola comum pondera como aluno comum. <b>Verificar:</b> essas matrículas estão concentradas em quais escolas? Alguma delas atende comunidade indígena e poderia estar declarada como escola indígena na coleta?`;
  } else if (coberturaRegistro !== null && coberturaRegistro < 20) {
    leitura = `O registro de cor/raça alcança ${pct(coberturaRegistro)} da população indígena de 0 a 14 anos. A distância pode ser as duas coisas ao mesmo tempo — criança fora da rede municipal (rede estadual, ou fora da escola) e cor/raça não preenchida na coleta —, e só a lista por escola separa. <b>Verificar:</b> quantas dessas crianças estão na rede estadual e quantas simplesmente não têm o campo preenchido?`;
  } else {
    leitura = `A cadeia população → registro → segmento não mostra vão relevante: das ${int(ind.schoolAge)} pessoas de 0 a 14 anos, ${int(declarados)} aparecem declaradas na cor/raça e ${int(ind.enrolled)} no segmento ponderado. Não há sinal de subdeclaração a apurar.`;
  }

  return `<section class="page content-page">${header("Declaração étnica")}<main class="page-body"><div class="kicker">População, registro e ponderação — três contagens, dois vãos</div><h2>${
    foraDoSegmento > 0
      ? `${int(foraDoSegmento)} matrículas indígenas declaradas fora do segmento que pondera`
      : "O que o Censo mede e o que a escola registra"
  }</h2><p class="lede">Três fontes contam a mesma população de formas diferentes, e só a última paga. O Censo Demográfico <b>mede</b> quem vive no território; o Censo Escolar <b>registra</b> a cor/raça de quem está matriculado; a planilha do FNDE <b>pondera</b> por segmento — e o segmento indígena/quilombola vale de ${decimal2.format(p.factorMin)} a ${decimal2.format(p.factorMax)}, os maiores fatores da tabela. A distância entre as três é lacuna de registro, e registro é a única parte que a gestão municipal controla.</p><div class="grid-4 mt-3">${metric(
    int(ind.schoolAge),
    "população indígena 0–14 (Censo 2022)",
  )}${metric(
    declarados === null ? "N/D" : int(declarados),
    "matrículas com cor/raça indígena",
  )}${metric(int(ind.enrolled), "matrículas no segmento ponderado")}${metric(
    conversaoSegmento === null ? "N/D" : pct(conversaoSegmento),
    "do registro que chega à ponderação",
  )}</div><div class="grid-2 mt-3"><div class="card ${foraDoSegmento > 0 ? "warn" : "accent"}"><h3>Onde a corrente se rompe</h3><table><tbody><tr><td>População indígena total</td><td class="num">${int(ind.pop)}</td></tr><tr><td>Em idade escolar (0–14)</td><td class="num"><b>${int(ind.schoolAge)}</b></td></tr><tr><td>Declarados na cor/raça do Censo Escolar</td><td class="num">${declarados === null ? "N/D" : `<b>${int(declarados)}</b>`}</td></tr><tr><td>No segmento indígena do FUNDEB</td><td class="num"><b>${int(ind.enrolled)}</b></td></tr></tbody></table><div class="divider"></div><p class="small">${leitura}</p></div><div class="card"><h3>Por que os três números diferem</h3><p class="small">Não é contradição entre fontes — é o que cada uma pergunta. O <b>Censo Demográfico</b> pergunta à família como ela se identifica. O <b>Censo Escolar</b> pergunta à escola a cor/raça de cada aluno, e o campo pode ficar em branco. O <b>FUNDEB</b> não olha o aluno: pondera pela <b>classificação da escola</b> — indígena, quilombola, campo.</p><p class="small" style="margin-top:.05in">A consequência prática é contraintuitiva e vale dizer na reunião: <b>declarar corretamente a cor/raça do aluno não aumenta o repasse por si só.</b> O que aumenta é a escola que atende comunidade indígena estar declarada como escola indígena na coleta. Os dois registros são obrigatórios, mas só o segundo entra na conta do fundo.</p>${
    cadastroFragil
      ? `<div class="divider"></div><p class="small"><b>Ressalva de cadastro:</b> ${pct(naoDeclaradaPct)} das matrículas estão sem cor/raça preenchida. Com essa fatia em branco, o número de declarados é piso, não retrato — e a primeira correção é o preenchimento, antes de qualquer conclusão sobre subdeclaração.</p>`
      : ""
  }</div></div><div class="insight mt-2"><b>Autodeclaração, sempre:</b> pertencimento étnico não se atribui de fora, e nada aqui estima quem "deveria" se declarar. A página localiza a distância entre três contagens oficiais; o encaminhamento é procedimental — conferir se o <b>campo do aluno</b> foi preenchido e se a <b>escola que atende a comunidade</b> está classificada corretamente, ouvindo a comunidade.</div><p class="small mt-1">Fonte: IBGE, Censo Demográfico 2022 (agregados 8175 e 8176, população indígena por idade) · INEP, microdados do Censo Escolar${model.schoolMap?.year ? ` ${model.schoolMap.year}` : ""} (cor/raça da matrícula, agregada por escola) · FNDE, matrículas ponderadas do exercício (segmentos indígena e quilombola). Nenhum dado nominal é acessado.</p></main>${footer(pagina, FONTE)}</section>`;
}

/**
 * Cobertura vacinal — o termômetro de capilaridade da atenção primária.
 *
 * Mora na folha de contexto de segurança, e não na do SISVAN, por uma razão
 * prosaica: a folha do SISVAN não tinha 33px sobrando, e trocar conteúdo que
 * já estava lá por conteúdo novo seria pior. Aqui o encaixe também é bom — a
 * folha trata do que cerca a criança, e cobertura vacinal mede se a atenção
 * primária alcança o território. É ela que executa o Programa Saúde na Escola:
 * onde não alcança para vacinar, dificilmente alcança a escola.
 *
 * Duas travas de honestidade: a régua é a **mediana nacional do próprio
 * dataset**, não uma meta do PNI que este código não leu na fonte; e cobertura
 * acima de 100% sai como "sem leitura", nunca como excelência — o numerador é
 * dose aplicada e o denominador é população estimada.
 */
function fraseVacinacao(model: MunicipalXrayModel): string {
  const v = model.childHealth?.vaccination;
  if (!v || v.shots.length === 0) return "";

  const MOSTRADAS = 3;
  const lista = v.shots
    .slice(0, MOSTRADAS)
    .map((s) => {
      const marca = s.unreadable
        ? `<span class="neutral">${esc(pct(s.value))}</span>`
        : s.belowMedian
          ? `<b class="warn-text">${esc(pct(s.value))}</b>`
          : `<b class="good">${esc(pct(s.value))}</b>`;
      return `${esc(s.label)} ${marca}`;
    })
    .join(" · ");

  const leitura =
    v.belowMedian === 0 && v.unreadable === v.shots.length
      ? `as ${v.shots.length} coberturas passam de 100%, o que <b>não é excelência</b> — o numerador é dose aplicada e o denominador é população estimada, então não há leitura de déficit aqui`
      : v.belowMedian >= Math.ceil(v.shots.length / 2)
        ? `<b>${v.belowMedian} das ${v.shots.length} coberturas vacinais</b> estão abaixo da mediana nacional. É a mesma equipe que executa o Programa Saúde na Escola: onde não alcança a criança para vacinar, dificilmente alcança a escola`
        : `${v.belowMedian === 0 ? "nenhuma cobertura vacinal está" : `${v.belowMedian} de ${v.shots.length} coberturas estão`} abaixo da mediana nacional — a atenção primária alcança a criança neste território`;

  return `<b>Atenção primária (${v.year}):</b> ${leitura}. <span class="micro">${lista}; régua = mediana nacional do ano (PNI/DATASUS, série encerrada em ${v.year}).</span>`;
}

/**
 * Violência notificada contra criança de 5 a 14 anos — SINAN.
 *
 * A regra vem antes do número, e é o motivo de este bloco existir de forma tão
 * contida: **é contagem de notificação, não de ocorrência.** Notificar mais
 * pode ser vigilância melhor. Notificar zero quase nunca é ausência de
 * violência — é ausência de registro.
 *
 * Por isso o bloco não compara municípios, não calcula taxa por 100 mil e não
 * chama número alto de coisa ruim. Ele responde a uma pergunta só, que é sobre
 * **fluxo** e não sobre crianças: a rede de proteção registra? A Lei nº
 * 13.431/2017 e o ECA (art. 245) obrigam o profissional de educação a notificar
 * suspeita de violência, e é por essa porta que a escola entra na conversa.
 */
function blocoNotificacaoViolencia(model: MunicipalXrayModel): string {
  const n = model.childHealth?.violence;
  if (!n || n.series.length === 0) return "";

  const serie = n.series.map((x) => `${x.year}: ${int(x.count)}`).join(" · ");
  const silenciosos = n.citiesInCountry - n.reportingCities;

  const leitura = n.totalSilence
    ? `<b>Nenhuma notificação de violência contra criança de ${esc(n.ageRange)} em ${n.series.length} ${n.series.length === 1 ? "exercício" : "exercícios"}.</b> Isso quase nunca significa ausência de violência — significa ausência de registro, e ${int(silenciosos)} municípios do país estão nessa situação. <b>A escola é notificante obrigatória</b> (Lei nº 13.431/2017 e ECA, art. 245): a rede tem fluxo definido, e os profissionais sabem acioná-lo?`
    : `A rede registrou notificações de violência contra criança de ${esc(n.ageRange)} nos últimos exercícios. <b>Número maior não significa mais violência</b> — costuma significar vigilância melhor. O bloco sustenta que o fluxo existe; não mede se a escola participa dele.`;

  // Um bloco só para os dois indicadores de saúde: a folha estava cheia, e
  // dois divs com margem e linha de fonte própria custavam ~50px que ela não
  // tinha. Editorialmente também fecha melhor — cobertura vacinal e
  // notificação são o mesmo argumento: o que alcança a criança neste
  // território, e o que fica registrado.
  const vacina = fraseVacinacao(model);
  return `<div class="${n.totalSilence ? "note" : "insight"} mt-2">${vacina ? `${vacina}<br>` : ""}<b>Notificação, não ocorrência:</b> ${leitura}<span class="micro" style="display:block;margin-top:.04in">${serie} notificações (${esc(n.ageRange)}, município de notificação) · ${int(n.reportingCities)} municípios notificaram no último exercício. Fonte: SINAN/SVSA — vale a ressalva de indicador sensível do rodapé.</span></div>`;
}

/**
 * Estado nutricional — o resultado medido da merenda.
 *
 * A merenda é política da secretaria de educação e tem regra dura no PNAE
 * (cardápio com nutricionista, mínimo de 30% da agricultura familiar). O que
 * quase nunca chega à reunião é o **resultado**: ele existe, medido criança a
 * criança pela atenção primária e agregado no SISVAN.
 *
 * Os dois lados apontam para intervenções opostas — magreza é insegurança
 * alimentar, excesso de peso é ultraprocessado. Rede com um quarto das
 * crianças acima do peso não tem problema de quantidade de comida: tem de
 * composição do cardápio, que é decisão de licitação e não de verba.
 *
 * Ressalva obrigatória: o denominador do SISVAN **não é a rede escolar**, são
 * as crianças que passaram pela atenção primária com peso e altura
 * registrados. Por isso a página compara o total acompanhado com a matrícula
 * e diz a cobertura em voz alta, em vez de tratar a amostra como retrato.
 */
function paginaNutricional(model: MunicipalXrayModel, pagina: number): string {
  const n = model.nutrition;
  const FONTE = "Ministério da Saúde — SISVAN (IMC × idade, 5 a 10 anos)";

  if (!n) {
    return `<section class="page content-page">${header("Estado nutricional")}<main class="page-body"><div class="kicker">O resultado medido da merenda</div><h2>Estado nutricional indisponível</h2><p class="lede">O SISVAN não retornou acompanhamento nutricional de crianças de 5 a 10 anos para este município no período consultado. A ausência costuma significar cobertura baixa da atenção primária, não ausência do problema.</p></main>${footer(pagina, FONTE)}</section>`;
  }

  // A cobertura é o que separa amostra de retrato. Sem matrícula não dá para
  // calcular, e aí a página diz isso em vez de fingir representatividade.
  const matriculas = model.enrollments;
  const cobertura =
    matriculas !== null && matriculas > 0
      ? Math.round((n.followed / matriculas) * 1000) / 10
      : null;
  const amostraFina = cobertura !== null && cobertura < 30;

  const acimaDoEstado =
    n.excessPct !== null && n.statePct !== null && n.excessPct > n.statePct + 1;
  const abaixoDoEstado =
    n.excessPct !== null && n.statePct !== null && n.excessPct < n.statePct - 1;

  const leitura = (() => {
    if (n.excessPct === null) return "";
    if (acimaDoEstado) {
      return `O excesso de peso aqui (${pct(n.excessPct)}) está <b>acima do estado</b> (${pct(n.statePct)}). Numa faixa etária que faz pelo menos uma refeição diária na escola, isso é pergunta direta sobre a composição do cardápio.`;
    }
    if (abaixoDoEstado) {
      return `O excesso de peso aqui (${pct(n.excessPct)}) está <b>abaixo do estado</b> (${pct(n.statePct)}) — mas o patamar nacional é ${pct(n.countryPct)}, e nenhum município do país está confortável nesse indicador.`;
    }
    return `O excesso de peso acompanha o estado (${pct(n.excessPct)} contra ${pct(n.statePct)}) — o padrão é regional, não uma característica desta rede.`;
  })();

  return `<section class="page content-page">${header("Estado nutricional")}<main class="page-body"><div class="kicker">O resultado medido da merenda</div><h2>${
    n.excessPct !== null && n.excessPct >= 20
      ? `${pct(n.excessPct)} das crianças acompanhadas estão acima do peso`
      : "O que a merenda produz, medido criança a criança"
  }</h2><p class="lede">A merenda é política da secretaria de educação, e este é o único lugar onde o resultado dela aparece medido. A atenção primária pesa e mede cada criança que atende, e o SISVAN agrega por município. Os dois lados pedem intervenções opostas: magreza é insegurança alimentar; excesso de peso é ultraprocessado. Dados de ${n.year}, crianças de 5 a 10 anos.</p><div class="grid-4 mt-3">${metric(
    int(n.followed),
    "crianças acompanhadas",
  )}${metric(pct(n.thinPct), "magreza")}${metric(pct(n.healthyPct), "eutrofia (peso adequado)")}${metric(
    pct(n.excessPct),
    "excesso de peso",
  )}</div><div class="grid-2 mt-2"><div class="card ${n.excessPct !== null && n.excessPct >= 25 ? "warn" : "accent"}"><h3>As três faixas do excesso</h3><table><tbody><tr><td>Sobrepeso</td><td class="num"><b>${int(n.overweight)}</b></td></tr><tr><td>Obesidade</td><td class="num"><b>${int(n.obese)}</b></td></tr><tr><td>Obesidade grave</td><td class="num"><b>${int(n.severelyObese)}</b></td></tr><tr><td>Total acima do peso</td><td class="num"><b>${int(n.overweight + n.obese + n.severelyObese)}</b></td></tr></tbody></table><div class="divider"></div><p class="small">São três colunas separadas na fonte, e ninguém as soma na hora da reunião — é somando que o tamanho aparece.</p></div><div class="card"><h3>Régua: município, estado e país</h3><table><tbody><tr><td>Excesso de peso no município</td><td class="num"><b>${pct(n.excessPct)}</b></td></tr><tr><td>No estado</td><td class="num">${pct(n.statePct)}</td></tr><tr><td>No Brasil</td><td class="num">${pct(n.countryPct)}</td></tr></tbody></table><div class="divider"></div><p class="small">${leitura}</p></div></div><div class="insight mt-2"><b>A ligação com o PNAE:</b> excesso de peso não se resolve com mais comida, e sim com outra comida — o mínimo legal de 30% da agricultura familiar e a aprovação do cardápio por nutricionista são exatamente as duas alavancas que a secretaria controla. <b>Conferir na visita:</b> qual o percentual efetivo de compra da agricultura familiar, e o cardápio atual passou por nutricionista?${
    n.thinPct !== null && n.thinPct >= 5
      ? ` Atenção ao outro lado: ${pct(n.thinPct)} de magreza numa rede com ${pct(n.excessPct)} de excesso significa <b>as duas carências convivendo</b>, e elas não se resolvem com a mesma medida.`
      : ""
  }</div><div class="${amostraFina ? "note" : "note"} mt-2"><b>O que este número é, e o que não é:</b> o denominador do SISVAN são as <b>crianças acompanhadas pela atenção primária</b> — as ${int(n.followed)} que tiveram peso e altura registrados —, não a rede escolar inteira.${
    cobertura !== null
      ? ` Equivale a ${pct(cobertura)} das ${int(matriculas)} matrículas municipais.${amostraFina ? " Cobertura abaixo de 30%: leia como amostra, não como retrato da rede." : ""}`
      : ""
  } Ampliar a cobertura é conversa com a secretaria de saúde, e é o que torna o indicador utilizável no ano seguinte.</div><p class="small mt-1">Fonte: Ministério da Saúde, SISVAN — relatório público de estado nutricional (IMC por idade, ciclo de vida criança, 5 a 10 anos), competência ${n.year}, consultado na emissão. Percentuais recalculados sobre o total acompanhado para que município, estado e Brasil saiam na mesma régua de arredondamento.</p></main>${footer(pagina, FONTE)}</section>`;
}

function paginaFrequenciaPbf(model: MunicipalXrayModel, pagina: number): string {
  const b = model.pbf;

  if (!b) {
    return `<section class="page content-page">${header("Frequência do Bolsa Família")}<main class="page-body"><div class="kicker">O censo mensal da evasão</div><h2>Acompanhamento do PBF indisponível</h2><p class="lede">A Matriz de Informação Social do MDS não respondeu no momento da emissão.</p></main>${footer(pagina, "MDS — SICON / Matriz de Informação Social")}</section>`;
  }

  const competencia = /^\d{6}$/.test(b.period)
    ? `${b.period.slice(4)}/${b.period.slice(0, 4)}`
    : b.period || "—";
  const sancoesTotal = b.warnings + b.blocks + b.suspensions;
  const sinalForte = (b.notFoundPct ?? 0) >= 10 || (b.monitoredPct !== null && b.monitoredPct < 80);

  return `<section class="page content-page">${header("Frequência do Bolsa Família")}<main class="page-body"><div class="kicker">O censo mensal da evasão — que já existe e quase ninguém usa</div><h2>${int(b.notFound)} crianças beneficiárias que a escola não localizou</h2><p class="lede">A condicionalidade de educação do PBF exige frequência mínima (60% aos 4–5 anos, 75% dos 6 aos 17) e é acompanhada <b>bimestralmente, criança a criança</b>, pelo SICON. O agregado abaixo é da competência ${esc(competencia)} — e a lista nominal por trás dele está disponível ao gestor municipal do programa. Busca ativa não precisa começar do zero: começa dessa lista.</p><div class="grid-4 mt-3">${metric(int(b.audience), "beneficiários de 4–17 anos")}${metric(b.monitoredPct === null ? "N/D" : pct(b.monitoredPct), "acompanhados no bimestre")}${metric(int(b.notFound), "não localizados pela escola")}${metric(b.attendanceOkPct === null ? "N/D" : pct(b.attendanceOkPct), "frequência acima do mínimo (dos acompanhados)")}</div><div class="grid-2 mt-3"><div class="card ${sinalForte ? "warn" : "accent"}"><h3>O que o número diz — e o que fazer com ele</h3><p class="small"><b>${int(b.notFound)} não localizados</b>${b.notFoundPct !== null ? ` (${pct(b.notFoundPct)} do público)` : ""} são crianças que deveriam estar em alguma escola e cuja frequência ninguém conseguiu registrar — o retrato mais próximo de evasão em tempo real que existe no país. Outros <b>${int(b.noInfo)}</b> constam sem informação de frequência.</p><p class="small" style="margin-top:.05in">Cada aluno recuperado vira matrícula no Censo — e o Censo define o FUNDEB do exercício seguinte. A rota: gestor municipal do PBF (lista nominal no SICON) → busca ativa → matrícula → coleta.</p></div><div class="card"><h3>Sanções por descumprimento</h3><table><tbody><tr><td>Advertências</td><td class="num"><b>${int(b.warnings)}</b></td></tr><tr><td>Bloqueios</td><td class="num"><b>${int(b.blocks)}</b></td></tr><tr><td>Suspensões</td><td class="num"><b>${int(b.suspensions)}</b></td></tr><tr><td>Famílias em fase de suspensão</td><td class="num"><b>${int(b.familiesInSuspension)}</b></td></tr></tbody></table><div class="divider"></div><p class="small">${sancoesTotal > 0 ? `${int(sancoesTotal)} famílias já sofreram repercussão no benefício por baixa frequência — renda perdida por falta às aulas, e cada uma é um caso de rede de proteção, não de culpa.` : "Nenhuma sanção registrada na competência — o descumprimento formalizado é zero."}</p></div></div><div class="insight mt-3"><b>Moldura obrigatória:</b> a condicionalidade é <b>proteção, não punição</b>. O descumprimento aciona a rede de assistência (CRAS/CREAS) antes de qualquer sanção, e o acompanhamento baixo é falha da <b>gestão municipal</b> do acompanhamento — não das famílias. ${b.monitoredPct !== null && b.monitoredPct < 80 ? `Com ${pct(b.monitoredPct)} de acompanhamento, a prioridade é o registro: sem ele, o município nem sabe quem procurar.` : "O acompanhamento alto significa que a lista de busca ativa é confiável — o trabalho é usá-la."}</div><p class="small mt-1">Fonte: MDS, Matriz de Informação Social (SICON), competência ${esc(competencia)}, consultada na geração deste relatório. Dados agregados — nenhum dado nominal é acessado ou armazenado.</p></main>${footer(pagina, `MDS — SICON, competência ${esc(competencia)}`)}</section>`;
}

/**
 * Violência letal no território — o exemplo do tráfico que impede a prova.
 *
 * Território conflagrado não aparece em base educacional, mas explica o que
 * elas mostram sem explicar: participação retida no Saeb (Cond. II), abandono
 * nos anos finais, evasão masculina. Os jovens de 15 a 29 anos são a faixa do
 * EJA e do médio. Regra do roadmap: contexto explicativo, nunca rótulo — a
 * análise vira pergunta de campo, não manchete.
 */
function paginaViolencia(model: MunicipalXrayModel, pagina: number): string {
  const v = model.violence;

  if (!v || v.latest.year === 0) {
    return `<section class="page content-page">${header("Contexto de segurança")}<main class="page-body"><div class="kicker">O território que cerca a escola</div><h2>Dados de violência indisponíveis</h2><p class="lede">O Atlas da Violência não trouxe série municipal para este município na janela consultada.</p></main>${footer(pagina, "Atlas da Violência (IPEA/FBSP)")}</section>`;
  }

  const linhas = v.series
    .map(
      (p) => `<tr><td><b>${p.year}</b></td><td class="num">${p.total === null ? "—" : int(p.total)}</td><td class="num">${p.youth === null ? "—" : int(p.youth)}</td><td class="num">${p.rate === null ? "—" : decimal.format(p.rate)}</td></tr>`,
    )
    .join("");

  const nd = model.schoolResults?.ndCount ?? 0;
  const acima = v.aboveNational === true;

  return `<section class="page content-page">${header("Contexto de segurança")}<main class="page-body"><div class="kicker">O território que cerca a escola</div><h2>O que o território faz com a escola — e o que a escola segura</h2><p class="lede">Violência letal não aparece em nenhuma base educacional, mas explica sinais que este relatório já mostrou: participação retida no Saeb, abandono nos anos finais, evasão masculina. Os dados abaixo são do SIM/DataSUS via Atlas da Violência — contexto para calibrar a estratégia de rede, nunca rótulo do município.</p><div class="grid-4 mt-3">${metric(
    v.latest.rate === null ? "N/D" : decimal.format(v.latest.rate),
    `homicídios por 100 mil hab. (${v.latest.year})`,
  )}${metric(
    v.national ? decimal.format(v.national.rate) : "N/D",
    `taxa nacional no mesmo ano`,
  )}${metric(
    v.latest.youth === null ? "N/D" : int(v.latest.youth),
    "vítimas de 15 a 29 anos",
  )}${metric(
    v.youthSharePct === null ? "N/D" : pct(v.youthSharePct),
    "dos homicídios são de jovens",
  )}</div><div class="grid-2 mt-3"><div class="card accent"><h3>Série do Atlas da Violência</h3><table><thead><tr><th>Ano</th><th class="num">Homicídios</th><th class="num">15–29 anos</th><th class="num">Por 100 mil</th></tr></thead><tbody>${linhas}</tbody></table><p class="micro" style="margin-top:.05in">Base SIM/DataSUS; o Atlas publica com ~2 anos de defasagem.</p></div><div class="card ${acima ? "warn" : ""}"><h3>O que isso significa para a rede</h3><p class="small">${
    acima
      ? `A taxa municipal está <b>acima da nacional</b> do mesmo ano${v.rateTrendPct !== null && v.rateTrendPct > 0 ? ` e subiu ${decimal.format(v.rateTrendPct)}% na janela` : ""}. Onde a violência concentra, a escola é o equipamento público que segue funcionando — e cada sinal educacional deste relatório merece a pergunta: é gestão, ou é território?`
      : `A taxa municipal está ${v.aboveNational === false ? "abaixo da" : "sem comparação com a"} nacional. Ainda assim, a distribuição interna importa: violência concentrada num bairro produz os mesmos efeitos escolares que uma taxa alta municipal.`
  }</p><div class="divider"></div><p class="small">${
    nd > 0
      ? `<b>Cruzamento com as páginas anteriores:</b> ${nd === 1 ? "1 escola ficou" : `${int(nd)} escolas ficaram`} sem resultado no Saeb por participação abaixo de 80% — em território conflagrado, dia de prova é dia de risco. Vale sobrepor a lista dessas escolas ao mapa da violência local antes de tratar a participação como desinteresse.`
      : `Nenhuma escola da rede teve resultado retido por participação no Saeb — se a violência pesa, ainda não é no dia da prova.`
  }</p></div></div><div class="insight mt-3"><b>Perguntas de campo que este dado gera:</b> as rotas escolares atravessam áreas de risco e há horário alternativo? A oferta noturna de EJA tem transporte e segurança de acesso — ou o turno da noite é a razão da evasão? Há protocolo com a rede de proteção para aluno ameaçado (transferência emergencial sem perda de matrícula)? A faixa de 15 a 29 anos${v.youthSharePct !== null ? ` — ${pct(v.youthSharePct)} das vítimas —` : ""} é o público do EJA e do médio: permanência na escola é a política de proteção mais barata que o município opera.</div>${blocoNotificacaoViolencia(model)}<p class="small mt-1">Fonte: Atlas da Violência (IPEA/FBSP), base SIM/DataSUS, via IPEADATA — série municipal encerrada em ${v.latest.year}. Indicador sensível: use como contexto de planejamento, não como comparação pública entre municípios.</p></main>${footer(pagina, `Atlas da Violência — IPEA/FBSP, até ${v.latest.year}`)}</section>`;
}

/**
 * Economia local e custo de oportunidade — o exemplo da fazenda que paga bem.
 *
 * A evasão muda de natureza conforme quem paga os salários da cidade: no agro,
 * a safra compete com o calendário escolar; na cidade de prefeitura, concurso
 * e escolaridade são o argumento do EJA; no comércio, o balcão recruta aos 16.
 * O VAB diz qual é o caso antes da primeira visita — e a taxa de alfabetização
 * dimensiona o mercado do EJA que a rede atende ou ignora.
 */
function paginaEconomia(model: MunicipalXrayModel, pagina: number): string {
  const e = model.economy;

  if (!e) {
    return `<section class="page content-page">${header("Economia e custo de oportunidade")}<main class="page-body"><div class="kicker">De onde a cidade ganha a vida</div><h2>Economia local indisponível</h2><p class="lede">O IBGE não respondeu às consultas de PIB municipal e alfabetização no momento da emissão.</p></main>${footer(pagina, "IBGE — PIB dos Municípios e Censo 2022")}</section>`;
  }

  const ROTULOS: Record<string, string> = {
    agropecuaria: "agropecuária",
    industria: "indústria",
    servicos: "serviços",
    administracao: "administração pública",
  };

  const LEITURAS: Record<string, string> = {
    agropecuaria:
      "Economia de <b>safra</b>: o custo de oportunidade do estudo sobe na colheita, quando a diária compete com a aula — e o abandono que parece pedagógico é sazonal. A resposta é calendário adaptado e oferta noturna casada com o ciclo agrícola, não busca ativa genérica.",
    administracao:
      "<b>Cidade de prefeitura</b>: o setor público é o maior empregador, e concurso exige escolaridade — é o argumento mais forte que o EJA tem aqui. Evasão nesse contexto costuma ser de renda imediata (informalidade), não de emprego formal concorrente.",
    servicos:
      "Economia de <b>comércio e serviços</b>: o balcão recruta cedo, tipicamente aos 16–17 — o risco concentra no ensino médio e no EJA jovem, e a resposta é oferta noturna e articulação com os empregadores.",
    industria:
      "Economia <b>industrial</b>: o emprego formal exige escolaridade mínima e tende a segurar o aluno até concluir — a evasão aqui pede leitura caso a caso, não explicação econômica de prateleira.",
  };

  const barras = [
    ["Agropecuária", e.agro],
    ["Indústria", e.industry],
    ["Serviços", e.services],
    ["Administração pública", e.publicAdmin],
  ] as const;

  // Janelas típicas de colheita (calendários Conab/Embrapa) — leitura
  // interpretativa: o calendário local confirma em campo.
  const JANELAS: Record<string, string> = {
    soja: "janeiro a março",
    milho: "fevereiro a julho (1ª e 2ª safras)",
    "cana-de-açúcar": "abril a novembro",
    café: "maio a setembro",
    "algodão herbáceo": "junho a setembro",
    arroz: "fevereiro a maio",
    laranja: "maio a novembro",
    cacau: "outubro a março",
    fumo: "novembro a fevereiro",
    trigo: "setembro a dezembro",
    uva: "dezembro a fevereiro",
  };
  const CONTINUAS = new Set(["banana", "mandioca", "abacaxi", "mamão", "coco-da-baía"]);
  const cultura = e.crop;
  const chaveCultura = cultura ? cultura.name.toLowerCase() : "";
  const janelaCultura = JANELAS[chaveCultura] ?? null;
  const colheitaContinua = CONTINUAS.has(chaveCultura);

  const blocoSafra = cultura
    ? `<div class="${e.agro !== null && e.agro >= 10 ? "note" : "insight"} mt-2"><b>A safra tem nome${cultura.year ? ` (PAM ${cultura.year})` : ""}:</b> a cultura de maior valor aqui é <b>${esc(cultura.name)}</b>${
        cultura.sharePct !== null ? `, com ${pct(cultura.sharePct)} do valor da produção agrícola` : ""
      }. ${
        colheitaContinua
          ? `Colheita contínua ao longo do ano: a pressão sobre a frequência é constante, não sazonal — o sinal a vigiar é o turno, não o mês.`
          : janelaCultura
            ? `Janela típica de colheita: <b>${janelaCultura}</b>. Se o abandono e a infrequência concentram nesses meses, a evasão é calendário, não pedagogia — e a resposta é calendário escolar adaptado e reposição planejada, como a LDB permite (art. 23, §2º e art. 28).`
            : `Confirmar em campo o calendário de colheita e cruzá-lo com a infrequência mês a mês — se coincidem, a evasão é calendário, não pedagogia.`
      } <span class="micro">Pergunta de campo: em que meses a diária compete com a aula, e o calendário escolar local reconhece isso?</span></div>`
    : "";

  const analfabetismo = e.literacyRate !== null ? Math.round((100 - e.literacyRate) * 10) / 10 : null;

  return `<section class="page content-page">${header("Economia e custo de oportunidade")}<main class="page-body"><div class="kicker">De onde a cidade ganha a vida — e o que isso faz com a escola</div><h2>${
    e.dominant ? `Uma economia de ${ROTULOS[e.dominant]}` : "A composição econômica do município"
  }</h2><p class="lede">Fatores que não têm ligação direta com a escola decidem quem fica nela: a safra que paga diária, o comércio que recruta aos 16, o concurso que exige diploma. O valor adicionado por setor diz qual é a economia deste município — e portanto qual evasão esperar e qual resposta preparar.</p><div class="grid-4 mt-3">${metric(
    e.dominant ? ROTULOS[e.dominant] : "N/D",
    `setor dominante do VAB${e.pibYearRef ? ` · ${e.pibYearRef}` : ""}`,
  )}${metric(pct(e.agro), "participação da agropecuária")}${metric(pct(e.literacyRate), "alfabetização 15+ · Censo 2022")}${metric(
    int(model.eja),
    "matrículas de EJA na rede",
  )}</div><div class="grid-2 mt-3"><div class="card accent"><h3>Composição do valor adicionado${e.pibYearRef ? ` · ${e.pibYearRef}` : ""}</h3>${barras
    .map(([nome, valor]) => barra(nome, valor))
    .join("")}<p class="micro" style="margin-top:.05in">IBGE, PIB dos Municípios — o dado municipal sai com ~2 anos de defasagem; este é o último publicado.</p></div><div class="card ${analfabetismo !== null && analfabetismo > 10 ? "warn" : ""}"><h3>O mercado do EJA</h3><p class="small">${
    analfabetismo !== null
      ? `<b>${decimal.format(analfabetismo)}%</b> dos adultos (15+) não são alfabetizados — e a rede municipal oferta <b>${esc(int(model.eja))}</b> matrículas de EJA. ${
          model.eja !== null && analfabetismo > 10 && model.eja < 500
            ? "A distância entre as duas grandezas é o mercado não atendido — cada matrícula de EJA capturada entra no fundo no exercício seguinte."
            : "O EJA disputa exatamente com o custo de oportunidade descrito ao lado — a oferta precisa caber na vida econômica do aluno, não o contrário."
        }`
      : "A taxa de alfabetização não retornou nesta emissão."
  }</p></div></div><div class="insight mt-3"><b>Leitura para o plano:</b> ${
    e.dominant ? LEITURAS[e.dominant] : "Sem setor dominante identificável, a leitura de custo de oportunidade é caso a caso."
  }</div>${blocoSafra}${
    model.enem
      ? `<div class="${model.enem.state && model.enem.absentPct > model.enem.state.absentPct + 2 ? "risk" : "note"} mt-2"><b>O termômetro do ENEM ${model.enem.year}:</b> dos ${int(model.enem.enrolled)} inscritos que provaram aqui, <b>${pct(model.enem.absentPct)}</b> faltaram aos dois dias${
          model.enem.state ? ` — contra ${pct(model.enem.state.absentPct)} na média ${esc(model.enem.state.code)}` : ""
        }. ${
          model.enem.state && model.enem.absentPct > model.enem.state.absentPct + 2
            ? "Abstenção acima da UF é o custo de oportunidade desta página aparecendo no fim da educação básica: o exame não é percebido como porta de entrada. A resposta municipal alcança o 9º ano e o EJA — informação de fluxo (ENEM → universidade/técnico) antes da decisão de sair."
            : "Abstenção na faixa da UF: o desengajamento no fim da básica segue o padrão regional, não um fator local."
        } <span class="micro">Recorte por município de prova — inclui candidatos de municípios vizinhos sem local de aplicação.</span></div>`
      : ""
  }<p class="small mt-1">Fontes: IBGE — PIB dos Municípios (agregado 5938) e Censo 2022 (alfabetização, agregado 9543), consultados na geração${
    model.enem ? `; INEP — microdados do ENEM ${model.enem.year}` : ""
  }. A ligação entre economia e evasão é leitura interpretativa sobre dados oficiais — verificável em campo, nunca determinística.</p></main>${footer(pagina, "IBGE — PIB dos Municípios e Censo 2022")}</section>`;
}

/**
 * Trabalho na idade escolar — o outro lado da conta de frequência.
 *
 * O relatório já mede o efeito por várias fontes: distorção idade-série e
 * abandono por escola (INEP), crianças do PBF que a escola não localizou
 * (SICON), abstenção no ENEM. Faltava a medida da causa candidata, e o Censo
 * a publica por município a partir dos 10 anos.
 *
 * Três disciplinas que o corpo da página respeita, e que valem mais que o
 * número:
 *
 * 1. **As faixas não se somam.** 10 a 13 anos não admite trabalho em nenhuma
 *    hipótese; 14 a 17 admite aprendizagem e emprego regular. Um total único
 *    apagaria a diferença e transformaria dado em acusação.
 * 2. **Não é contagem.** É estimativa expandida da amostra, ainda preliminar
 *    (nota 1 da tabela 10268). A ressalva sai impressa, literal.
 * 3. **Não é causa provada.** As duas medições — ocupação e fluxo escolar —
 *    são independentes. A página as coloca lado a lado e devolve pergunta, não
 *    conclusão.
 */
function paginaTrabalhoInfantil(model: MunicipalXrayModel, pagina: number): string {
  const t = model.childLabor;
  const FONTE = "IBGE — Censo Demográfico 2022 (SIDRA, tabela 10268)";

  if (!t || t.bands.length === 0) {
    return `<section class="page content-page">${header("Trabalho na idade escolar")}<main class="page-body"><div class="kicker">O que compete com a aula</div><h2>Ocupação na idade escolar indisponível</h2><p class="lede">O recorte municipal de pessoas de 10 a 17 anos ocupadas na semana de referência não retornou para este município no Censo 2022.</p></main>${footer(pagina, FONTE)}</section>`;
  }

  const menor = t.bands.find((b) => !b.legalWorkPossible) ?? null;
  const maior = t.bands.find((b) => b.legalWorkPossible) ?? null;
  const taxa2 = (v: number | null) => (v === null ? "N/D" : `${decimal2.format(v)}%`);

  const titulo = (() => {
    if (t.noneEstimated) return "A amostra do Censo não encontrou ocupação nas duas faixas";
    if (menor && menor.occupied > 0) {
      return `${int(menor.occupied)} ${menor.occupied === 1 ? "criança" : "crianças"} de 10 a 13 anos ocupadas na semana de referência`;
    }
    if (maior && maior.occupied > 0) {
      return `${int(maior.occupied)} adolescentes de 14 a 17 anos ocupados na semana de referência`;
    }
    return "Ocupação na idade escolar, faixa a faixa";
  })();

  const linhas = t.bands
    .map(
      (b) =>
        `<tr><td><b>${esc(b.label)}</b></td><td class="num">${int(b.occupied)}</td><td class="num">${taxa2(b.ratePct)}</td><td class="num">${taxa2(b.stateRatePct)}</td><td class="num">${taxa2(b.countryRatePct)}</td></tr>`,
    )
    .join("");

  // A leitura da faixa sem hipótese legal é a única que a página trata como
  // sinal; a de 14 a 17 é contexto, porque ali há trabalho lícito.
  const leituraMenor = (() => {
    if (!menor) return "";
    if (menor.occupied === 0) {
      return "A amostra <b>não estimou</b> nenhuma criança ocupada nesta faixa. Estimativa zero não é prova de ausência — é o que a amostra encontrou —, mas é a melhor notícia que esta página pode dar.";
    }
    if (menor.weakComparison) {
      return `A estimativa é de <b>${int(menor.occupied)}</b>${menor.ratePct !== null ? ` (${taxa2(menor.ratePct)} da faixa)` : ""}. Numa ordem de grandeza destas, a distância para a régua da UF e do país <b>não decide nada</b>: a expansão da amostra move o número mais que a diferença. O que ela sustenta é a pergunta, não o diagnóstico.`;
    }
    // As duas réguas discordam com frequência — Manaus fica acima do país e
    // abaixo do próprio estado. Ler só uma produziria "acima" impresso ao lado
    // de um número estadual maior, que é contradição na cara do leitor.
    const posicao = (() => {
      if (menor.aboveState && menor.aboveCountry) return "Está <b>acima das duas réguas</b>";
      if (menor.aboveCountry) return "Está <b>acima da nacional</b> e abaixo da estadual";
      if (menor.aboveState) return "Está <b>acima da estadual</b> e abaixo da nacional";
      return "Está <b>abaixo das duas réguas</b>";
    })();
    return `A taxa desta faixa é <b>${taxa2(menor.ratePct)}</b>, contra ${taxa2(menor.stateRatePct)} na UF e ${taxa2(menor.countryRatePct)} no país. ${posicao} — e a posição não muda o que a faixa é: até os 14 não existe trabalho lícito, então cada caso é matéria da rede de proteção.`;
  })();

  // Cruzamentos: só com o que o próprio relatório já apurou, e nomeando a
  // página de origem. Nenhum deles é apresentado como causa.
  //
  // O nome de escola é truncado porque a folha é apertada: nomes municipais
  // passam de 90 caracteres e cada um deles empurra uma linha inteira.
  const nomeCurto = (nome: string) => (nome.length > 34 ? `${nome.slice(0, 33)}…` : nome);
  const cruzamentos: string[] = [];
  const ctx = model.schoolContext;
  if (ctx && ctx.dropoutCount > 0 && ctx.worstDropout) {
    cruzamentos.push(
      `<b>${ctx.dropoutCount === 1 ? "1 escola registra" : `${int(ctx.dropoutCount)} escolas registram`}</b> abandono no fundamental — pior: ${esc(nomeCurto(ctx.worstDropout.name))}, ${decimal.format(ctx.worstDropout.value)}% (${ctx.years.rendimento}).`,
    );
  }
  if (ctx?.worstTdi) {
    cruzamentos.push(
      `Maior <b>distorção idade-série</b> da rede: ${decimal.format(ctx.worstTdi.value)}% em ${esc(nomeCurto(ctx.worstTdi.name))} (${ctx.years.tdi}).`,
    );
  }
  if (model.pbf && model.pbf.notFound > 0) {
    cruzamentos.push(
      `<b>${int(model.pbf.notFound)}</b> crianças do Bolsa Família que a escola não localizou — a lista nominal existe, e é por onde a checagem começa.`,
    );
  }
  if (model.economy?.dominant === "agropecuaria" && model.economy.crop) {
    cruzamentos.push(
      `Economia de safra, cultura dominante <b>${esc(model.economy.crop.name)}</b>: aqui a ocupação de adolescente tende a ser sazonal, e o calendário escolar é a alavanca da secretaria.`,
    );
  }

  // Teto de três: a folha comporta três linhas de cruzamento sem apertar, e o
  // quarto item nunca é o que decide a conversa. Medido em 2026-07-31 com
  // `medirCorte` nos quatro municípios de referência.
  const blocoCruzamento = cruzamentos.length
    ? `<ul class="small" style="margin:.03in 0 0 .14in">${cruzamentos
        .slice(0, 3)
        .map((c) => `<li>${c}</li>`)
        .join("")}</ul>`
    : `<p class="small">Nenhum sinal de fluxo (abandono, distorção, busca ativa do PBF) foi apurado nas páginas anteriores para cruzar com esta estimativa.</p>`;

  return `<section class="page content-page">${header("Trabalho na idade escolar")}<main class="page-body"><div class="kicker">O que compete com a aula</div><h2>${titulo}</h2><p class="lede">Criança que trabalha falta, repete e sai — efeitos que este relatório já mede por outras fontes. Esta página traz a outra ponta: quantas pessoas de 10 a 17 anos o Censo ${t.censusYear} encontrou <b>ocupadas na semana de referência</b>. As faixas saem separadas porque o direito as trata de forma diferente, e somá-las trocaria um fato por uma acusação.</p><div class="grid-4 mt-3">${metric(
    menor ? int(menor.occupied) : "N/D",
    "ocupadas de 10 a 13 anos",
  )}${metric(menor ? taxa2(menor.ratePct) : "N/D", "da faixa de 10 a 13 anos")}${metric(
    maior ? int(maior.occupied) : "N/D",
    "ocupados de 14 a 17 anos",
  )}${metric(maior ? taxa2(maior.ratePct) : "N/D", "da faixa de 14 a 17 anos")}</div><div class="grid-2 mt-2"><div class="card ${
    menor && menor.occupied > 0 && menor.aboveCountry ? "warn" : "accent"
  }"><h3>As duas faixas, e a régua</h3><table><thead><tr><th>Faixa</th><th class="num">Ocupadas</th><th class="num">Taxa</th><th class="num">UF</th><th class="num">Brasil</th></tr></thead><tbody>${linhas}</tbody></table><div class="divider"></div><p class="small">${leituraMenor}</p></div><div class="card"><h3>O que a lei separa</h3><p class="small"><b>10 a 13 anos:</b> não há hipótese legal de trabalho. A Constituição proíbe trabalho a menores de 16, salvo como aprendiz <b>a partir dos 14</b> (art. 7º, XXXIII) — abaixo disso nem aprendizagem existe.</p><p class="small" style="margin-top:.05in"><b>14 a 17 anos:</b> há trabalho lícito — aprendiz dos 14 aos 17, emprego regular dos 16 —, vedados o noturno, o perigoso, o insalubre e o que consta da Lista TIP (Decreto nº 6.481/2008). <b>Ocupação nesta faixa não é, por si, irregularidade</b>, e esta página não a trata como tal.</p><div class="divider"></div><p class="small">Suspeita de violação de direito vai ao Conselho Tutelar (ECA, art. 56 e 245) — a apuração não é da rede de ensino.</p></div></div><div class="grid-2 mt-2"><div class="insight"><b>O que isto conversa com o dossiê</b> — medições independentes do mesmo território; a ligação é da literatura, não deste relatório:${blocoCruzamento}</div><div class="note"><b>Perguntas de campo:</b> a infrequência concentra em algum mês, turno ou distrito, e coincide com atividade econômica local? Há fluxo escrito entre escola e Conselho Tutelar para infrequência reiterada, com prazo? O programa de aprendizagem (Lei nº 10.097/2000) tem vaga aberta aqui para os 14 a 17?</div></div><p class="small mt-1">Fonte: ${esc(FONTE)}, variáveis 140 e 696. <b>Ressalva da própria tabela:</b> ${esc(t.caveat)} O trabalho para consumo do próprio domicílio (roça, criação, pesca) o IBGE classifica como <b>não ocupado</b> e fica fora deste número — que por isso é piso, não teto. UF e país entram como escala de grandeza: nenhuma ordenação entre municípios é produzida aqui, e o dado é contexto de planejamento, nunca rótulo do município.</p></main>${footer(pagina, FONTE)}</section>`;
}

function coverTerritory(model: MunicipalXrayModel) {
  if (model.boundary) {
    return `<svg class="territory-svg" viewBox="${esc(model.boundary.viewBox)}" role="img" aria-label="Contorno territorial de ${esc(model.municipality)}"><path class="territory-shadow" d="${esc(model.boundary.path)}"></path><path class="territory-shape" d="${esc(model.boundary.path)}"></path></svg>`;
  }

  return `<svg class="territory-svg territory-fallback" viewBox="0 0 720 720" role="img" aria-label="Representação cartográfica"><path d="M62 195C156 123 253 121 344 176s176 68 310 4"></path><path d="M38 294c116-78 218-78 315-18s188 65 330-18"></path><path d="M49 404c110-72 216-70 312-8s186 65 318-18"></path><path d="M88 518c106-61 206-52 294 6s165 59 267 11"></path><circle cx="360" cy="340" r="50"></circle><path class="territory-pin" d="M360 248c-51 0-92 41-92 92 0 69 92 164 92 164s92-95 92-164c0-51-41-92-92-92Zm0 128a36 36 0 1 1 0-72 36 36 0 0 1 0 72Z"></path></svg>`;
}

export function generateMunicipalXrayHtml(model: MunicipalXrayModel) {
  // Zera o coletor de fontes desta emissão — ver `footer()` e `linhasFontes()`.
  fontesDaEmissao = [];
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(model.generatedAt);
  const shortDate = new Intl.DateTimeFormat("pt-BR").format(model.generatedAt);
  const fundebDelta = change(model.fundebBase, model.fundebCurrent);
  const priorities = priorityList(model);
  const infraRows = model.infrastructure.length
    ? model.infrastructure.map((item) => `<div class="bar-row"><span>${esc(item.name)}</span><div class="bar-track"><div class="bar" style="width:${Math.max(0, Math.min(100, item.percent ?? 0))}%"></div></div><b>${esc(pct(item.percent))}</b></div>`).join("")
    : `<div class="empty">A base de infraestrutura escolar ainda não está disponível para este município.</div>`;
  const noteRows = model.notes.slice(0, 6).map((note) => `<li>${esc(note)}</li>`).join("");
  const fundebClass = fundebDelta !== null && fundebDelta >= 0 ? "good" : "warn";
  const mayor = model.party ? `${model.mayor} (${model.party})` : model.mayor;
  const cityLengthClass = model.municipality.length > 34
    ? " is-very-long"
    : model.municipality.length > 24
      ? " is-long"
      : "";
  const territoryCaption = model.boundary?.source ?? "Malha municipal indisponível";

  // Numeração automática: a capa é a página 1 e cada chamada de `prox()`
  // avança o contador na ordem em que o template literal avalia. Inserir uma
  // página nova deixou de exigir renumerar todas as seguintes à mão — foi
  // exatamente esse retrabalho (e um acidente de encoding no meio dele) que
  // motivou o contador.
  let paginaAtual = 1;
  const prox = () => (paginaAtual += 1);

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Raio-X municipal | ${esc(model.municipality)}</title>
<style>
@page{size:letter;margin:0}*{box-sizing:border-box}:root{--navy:#10263f;--blue:#176b87;--teal:#27a69a;--gold:#e6a23c;--red:#c75050;--ink:#19242e;--muted:#647380;--line:#d9e1e5;--paper:#fbfcfc;--wash:#eef4f5;--good:#22856f;--warn:#a66a10}
html,body{margin:0;padding:0;background:#dfe6e9;color:var(--ink)}body{font-family:Arial,"Noto Sans",sans-serif;font-size:9pt;line-height:1.38}.page{width:8.5in;height:11in;margin:0 auto;background:var(--paper);overflow:hidden;page-break-after:always;position:relative}.page:last-child{page-break-after:auto}.content-page{display:grid;grid-template-rows:auto 1fr auto}.page-header{min-height:.48in;padding:.22in .62in .11in;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:end;color:var(--muted);font-size:7.4pt;letter-spacing:.07em;text-transform:uppercase}.page-header strong{color:var(--navy);font-weight:800}.page-body{padding:.25in .62in .18in;overflow:hidden}.page-footer{min-height:.39in;padding:.1in .62in .2in;border-top:1px solid var(--line);color:var(--muted);font-size:7pt;display:flex;justify-content:space-between;align-items:start}
h1,h2,h3,.metric-value,.big{font-family:Arial,"Noto Sans",sans-serif}h1,h2,h3,p{margin:0}h2{color:var(--navy);font-size:23pt;line-height:1.04;letter-spacing:-.025em}h2:after{content:"";display:block;width:.9in;height:.06in;margin-top:.12in;background:var(--teal)}h3{color:var(--navy);font-size:11pt;line-height:1.15;margin-bottom:.07in}p+p{margin-top:.09in}.kicker{color:var(--teal);font-size:8pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.09in}.lede{margin-top:.15in;max-width:6.65in;color:#344551;font-size:10.2pt;line-height:1.45}.small{font-size:7.7pt;color:var(--muted)}.micro{font-size:6.8pt;color:var(--muted)}.strong{font-weight:800;color:var(--navy)}.divider{height:1px;background:var(--line);margin:.17in 0}.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:.18in}.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:.13in}.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:.11in}.mt-1{margin-top:.12in}.mt-2{margin-top:.2in}.mt-3{margin-top:.28in}.card{background:#fff;border:1px solid var(--line);border-radius:7px;padding:.15in}.card.accent{border-top:4px solid var(--teal)}.card.warn{border-top:4px solid var(--gold)}.card.bad{border-top:4px solid var(--red)}.metric{border-left:4px solid var(--teal);padding:.03in 0 .04in .13in;min-height:.65in}.metric-value{font-size:19pt;font-weight:800;color:var(--navy);line-height:.98;letter-spacing:-.025em}.metric-label{margin-top:.07in;color:var(--muted);font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.045em}.callout{background:var(--navy);color:#fff;padding:.16in .18in;border-radius:7px}.callout h3{color:#fff}.callout p{color:#dce8ee}.note{background:#fff8e7;border-left:4px solid var(--gold);padding:.12in .14in;color:#584416}.insight{background:#e8f4f2;border-left:4px solid var(--teal);padding:.12in .14in}.risk{background:#f9eaea;border-left:4px solid var(--red);padding:.12in .14in}ul{margin:.07in 0 0 .17in;padding:0}li{margin-bottom:.045in}table{width:100%;border-collapse:collapse;font-size:7.8pt}th{background:var(--navy);color:#fff;text-align:left;font-weight:700;padding:.07in .08in}td{padding:.065in .08in;border-bottom:1px solid var(--line);vertical-align:top}tbody tr:nth-child(even){background:#f3f6f7}td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}.good{color:var(--good);font-weight:800}.warn-text{color:var(--warn);font-weight:800}.neutral{color:var(--muted);font-weight:800}.bar-row{display:grid;grid-template-columns:1.45in 1fr .55in;align-items:center;gap:.08in;margin-bottom:.075in;font-size:7.5pt}.bar-track{background:#e4ebee;height:.12in;border-radius:99px;overflow:hidden}.bar{height:100%;background:var(--teal);border-radius:99px}.bar-row b{text-align:right;color:var(--navy)}.score-row{display:grid;grid-template-columns:1.45in 1fr 1fr;gap:.09in;padding:.09in 0;border-bottom:1px solid var(--line)}.score-row .area{font-weight:800;color:var(--navy)}.empty{padding:.28in;background:var(--wash);border:1px dashed #b8c6cc;border-radius:7px;color:var(--muted);text-align:center}.source-list{font-size:7.2pt;line-height:1.35}.source-list--colunas{columns:2;column-gap:.24in}.source-list--colunas li{break-inside:avoid}.brand{font-size:8pt;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
.campo-secao{margin-bottom:.16in}.campo-secao h3{color:var(--teal);font-size:8.4pt;letter-spacing:.09em;text-transform:uppercase;margin-bottom:.08in;border-bottom:1px solid var(--line);padding-bottom:.04in}.campo-item{margin-bottom:.105in;break-inside:avoid}.campo-q{font-size:8.6pt;line-height:1.32;color:var(--ink)}.campo-ctx{font-size:7pt;line-height:1.3;color:var(--muted);font-style:italic;margin-top:.02in;padding-left:.09in;border-left:2px solid var(--wash)}.campo-linha{margin-top:.055in;border-bottom:1px dotted #b9c6cc;height:.13in}

/* Grade editorial única: o mesmo eixo horizontal rege capa, miolo e rodapé. */
:root{--page-x:.64in;--page-header-h:.56in;--page-footer-h:.44in}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page-header{height:var(--page-header-h);min-height:var(--page-header-h);padding:.2in var(--page-x) .1in}
.page-body{padding:.3in var(--page-x) .22in}
.page-footer{height:var(--page-footer-h);min-height:var(--page-footer-h);padding:.1in var(--page-x) .16in}
.grid-2,.grid-3,.grid-4{align-items:stretch}
.grid-2>*,.grid-3>*,.grid-4>*{min-width:0}
.card,.metric,.callout,.note,.insight,.risk,table{break-inside:avoid}
.card{border-radius:8px;padding:.17in}
.metric{min-height:.76in;padding:.035in 0 .045in .13in}
.metric-value{overflow-wrap:anywhere}
h2{max-width:7.05in}

/* Capa territorial — funciona com qualquer município e qualquer comprimento de nome. */
.cover{background:#f4f6f4;color:var(--ink);display:grid;grid-template-rows:.08in .76in 1fr 1.72in}
.cover-topline{background:linear-gradient(90deg,var(--teal) 0 72%,var(--gold) 72% 100%)}
.cover-header{padding:0 var(--page-x);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #d8e1df}
.cover-header .brand{color:var(--navy);font-size:7.5pt;letter-spacing:.16em}
.brand span{color:var(--muted);font-weight:700;letter-spacing:.08em}
.cover-edition{border:1px solid #cbd7d5;border-radius:99px;padding:.07in .13in;color:var(--navy);font-size:6.8pt;font-weight:800;letter-spacing:.1em}
.cover-body{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(0,.98fr);gap:.3in;padding:.46in var(--page-x) .38in;overflow:hidden}
.cover-copy{display:flex;min-width:0;flex-direction:column;align-items:flex-start}
.cover-eyebrow{color:var(--teal);font-size:7.5pt;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
.cover-title{margin-top:.42in;color:var(--navy);font-size:49pt;line-height:.82;letter-spacing:-.055em}
.cover-title small{display:block;margin-top:.14in;color:var(--muted);font-size:13pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.cover-city{margin-top:.42in;color:var(--navy);font-size:31pt;font-weight:800;line-height:.96;letter-spacing:-.04em;text-wrap:balance;overflow-wrap:anywhere}
.cover-city.is-long{font-size:27pt}.cover-city.is-very-long{font-size:23pt}
.cover-place{margin-top:.15in;display:flex;align-items:center;gap:.08in;color:var(--teal);font-size:8pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
.cover-place:before{content:"";width:.28in;height:2px;background:var(--gold)}
.cover-sub{margin-top:.3in;max-width:3.25in;color:#42535d;font-size:10pt;line-height:1.5}
.cover-meta{margin-top:auto;padding-top:.3in;color:var(--muted);font-size:7.5pt;line-height:1.55}
.cover-meta b{color:var(--navy)}
.cover-visual{display:flex;min-width:0;align-items:flex-start;justify-content:flex-end;padding-top:.08in}
.cover-map-frame{width:100%;background:#e7efed;border:1px solid #cfddda;border-radius:18px;padding:.18in;box-shadow:0 .16in .42in rgba(16,38,63,.08)}
.cover-map-canvas{height:5.05in;position:relative;display:grid;place-items:center;overflow:hidden;border-radius:12px;background-color:#edf3f1;background-image:linear-gradient(rgba(16,38,63,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(16,38,63,.055) 1px,transparent 1px);background-size:.38in .38in}
.cover-map-canvas:before,.cover-map-canvas:after{content:"";position:absolute;border:1px solid rgba(39,166,154,.24);border-radius:50%}
.cover-map-canvas:before{width:3.7in;height:3.7in}.cover-map-canvas:after{width:2.6in;height:2.6in}
.territory-svg{position:relative;z-index:1;width:88%;height:88%;overflow:visible;filter:drop-shadow(0 .12in .12in rgba(16,38,63,.13))}
.territory-shadow{fill:rgba(16,38,63,.15);transform:translate(11px,14px)}
.territory-shape{fill:#69c2b8;stroke:var(--navy);stroke-width:7;stroke-linejoin:round;vector-effect:non-scaling-stroke;fill-rule:evenodd}
.territory-fallback{width:92%;height:92%;filter:none}
.territory-fallback>path:not(.territory-pin),.territory-fallback>circle{fill:none;stroke:#9cbcb7;stroke-width:5}
.territory-fallback .territory-pin{fill:var(--teal);stroke:var(--navy);stroke-width:5;fill-rule:evenodd}
.map-escolas{width:3.46in;height:3.46in;display:block;margin:0 auto}.map-escolas .map-shape{fill:var(--wash);stroke:var(--navy);stroke-width:4;vector-effect:non-scaling-stroke;fill-rule:evenodd}.map-escolas .dot-urbana{fill:var(--teal);opacity:.85}.map-escolas .dot-rural{fill:var(--gold);opacity:.9}.map-escolas .dot-dif{fill:var(--red)}.map-legend{display:flex;gap:.16in;justify-content:center;font-size:7.2pt;color:var(--muted);margin-top:.06in}.map-legend i{display:inline-block;width:.09in;height:.09in;border-radius:50%;margin-right:.04in;vertical-align:-1px}.map-legend .li-urbana{background:var(--teal)}.map-legend .li-rural{background:var(--gold)}.map-legend .li-dif{background:var(--red)}
.cover-map-caption{padding:.13in .03in .02in;display:flex;justify-content:space-between;gap:.12in;color:var(--muted);font-size:6.7pt;text-transform:uppercase;letter-spacing:.06em}
.cover-map-caption b{color:var(--navy)}
.cover-bottom{padding:.27in var(--page-x) .3in;background:var(--navy);color:#fff}
.cover-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.22in}
.cover-stat{border-left:3px solid var(--teal);padding:.02in 0 .02in .14in;min-width:0}
.cover-stat b{display:block;color:#fff;font-size:18pt;line-height:1;letter-spacing:-.025em;overflow-wrap:anywhere}
.cover-stat span{display:block;margin-top:.07in;color:#aec2cb;font-size:6.4pt;line-height:1.3;text-transform:uppercase;letter-spacing:.055em}
.cover-date{display:flex;justify-content:space-between;align-items:flex-end;margin-top:.26in;padding-top:.14in;border-top:1px solid rgba(255,255,255,.13);color:#aec2cb;font-size:7pt}
.cover-date b{color:#fff;font-weight:700}
</style></head><body>

<section class="page cover"><div class="cover-topline"></div><header class="cover-header"><div class="brand">Global Company <span>• consultorias</span></div><div class="cover-edition">EDIÇÃO ${model.currentYear}</div></header><main class="cover-body"><div class="cover-copy"><div class="cover-eyebrow">Diagnóstico territorial</div><h1 class="cover-title">Raio-X<small>municipal</small></h1><div class="cover-city${cityLengthClass}">${esc(model.municipality)}</div><div class="cover-place">${esc(model.uf)} · ${esc(model.region)}</div><p class="cover-sub">Uma leitura integrada de finanças, educação, território e capacidade de gestão para orientar o próximo ciclo.</p><div class="cover-meta"><b>Código IBGE ${esc(model.ibgeCode)}</b><br>Comparativo ${model.baseYear} × posição disponível em ${esc(date)}<br>Documento técnico executivo</div></div><div class="cover-visual"><div class="cover-map-frame"><div class="cover-map-canvas">${coverTerritory(model)}</div><div class="cover-map-caption"><b>Território de ${esc(model.municipality)}</b><span>${esc(territoryCaption)}</span></div></div></div></main><footer class="cover-bottom"><div class="cover-stats"><div class="cover-stat"><b>${esc(deltaText(model.fundebBase,model.fundebCurrent))}</b><span>evolução do FUNDEB</span></div><div class="cover-stat"><b>${esc(int(model.population))}</b><span>população ${esc(model.populationYear)}</span></div><div class="cover-stat"><b>${esc(int(model.enrollments))}</b><span>matrículas municipais</span></div></div><div class="cover-date"><span><b>Relatório técnico executivo</b> · tecnologia Global Sync</span><span>${esc(shortDate)}</span></div></footer></section>

${paginaResumoExecutivo(model, prox())}

<section class="page content-page">${header("Metodologia")}<main class="page-body"><div class="kicker">Como ler</div><h2>Comparação honesta começa pela data de corte</h2><p class="lede">${model.baseYear} é tratado como ano-base. ${model.currentYear} representa a posição disponível na data de geração e pode conter entregas parciais.</p><div class="grid-2 mt-3"><div class="card accent"><h3>Ano-base ${model.baseYear}</h3><p>Valores anuais fechados são usados quando existem. Na ausência de encerramento, o relatório identifica a última entrega oficial recuperada.</p></div><div class="card warn"><h3>Posição ${model.currentYear}</h3><p>Estimativas e execuções parciais não são apresentadas como fechamento anual. A data de corte é ${esc(shortDate)}.</p></div></div><table class="mt-3"><thead><tr><th>Camada</th><th>Fonte principal</th><th>Regra de leitura</th></tr></thead><tbody><tr><td>Finanças</td><td>Siconfi / Tesouro</td><td>Última entrega fiscal disponível</td></tr><tr><td>FUNDEB</td><td>FNDE e histórico oficial</td><td>Fechamento ou estimativa vigente</td></tr><tr><td>Rede escolar</td><td>Censo Escolar / Inep</td><td>Ano de referência explicitado</td></tr><tr><td>Aprendizagem</td><td>Inep / QEdu</td><td>Último IDEB observado</td></tr><tr><td>Território</td><td>IBGE Cidades</td><td>Referência informada pela fonte</td></tr></tbody></table><div class="note mt-3"><b>Regra de integridade:</b> “N/D” significa que a fonte não devolveu um valor confiável. O motor não preenche lacunas com estimativas silenciosas.</div></main>${footer(prox(),"Metodologia Global Sync para leitura municipal")}</section>

<section class="page content-page">${header("Perfil do município")}<main class="page-body"><div class="kicker">Território e gestão</div><h2>${esc(model.municipality)}, ${esc(model.uf)}</h2><p class="lede">O perfil territorial contextualiza a escala da administração e ajuda a calibrar prioridades, custos de cobertura e capacidade de entrega.</p><div class="grid-4 mt-3">${metric(int(model.population),"população estimada")}${metric(model.area === null ? "N/D" : `${integer.format(model.area)} km²`,"área territorial")}${metric(compactMoney(model.pibPerCapita),`PIB per capita${model.pibYear ? ` · ${model.pibYear}` : ""}`)}${metric(model.region,"região")}</div><div class="grid-2 mt-3"><div class="card accent"><h3>Identificação institucional</h3><table><tbody><tr><td>Código IBGE</td><td class="num"><b>${esc(model.ibgeCode)}</b></td></tr><tr><td>Chefe do Executivo</td><td class="num"><b>${esc(mayor)}</b></td></tr><tr><td>Exercício analisado</td><td class="num"><b>${model.currentYear}</b></td></tr><tr><td>Data de corte</td><td class="num"><b>${esc(shortDate)}</b></td></tr></tbody></table></div><div class="card"><h3>Leitura de escala</h3><p>População, extensão territorial e porte da rede alteram o custo de universalizar serviços. O raio-X usa esses dados como contexto e evita comparar números absolutos sem considerar cobertura.</p><div class="insight mt-2"><b>Uso recomendado:</b> cruzar os indicadores com metas por habitante, por aluno, por escola e por território atendido.</div></div></div></main>${footer(prox(),"Fonte territorial: IBGE e cadastro municipal integrado")}</section>

<section class="page content-page">${header(`${model.baseYear} em perspectiva`)}<main class="page-body"><div class="kicker">Linha de base</div><h2>O ponto de partida financeiro e educacional</h2><p class="lede">O ano-base serve para medir a direção da mudança e separar crescimento nominal de melhoria efetiva.</p><div class="grid-3 mt-3">${metric(compactMoney(model.fundebBase),`FUNDEB ${model.baseYear}`)}${metric(compactMoney(model.revenueBase),"receita realizada")}${metric(money(model.fundebBase),"valor nominal")}</div><div class="grid-2 mt-3"><div class="card accent"><h3>O que a linha de base responde</h3><ul><li>Qual era o volume de financiamento educacional.</li><li>Qual entrega fiscal estava disponível.</li><li>Qual era o tamanho conhecido da rede.</li><li>Quais metas de aprendizagem ainda estavam abertas.</li></ul></div><div class="card warn"><h3>Limites da comparação</h3><p>Receita realizada só é comparável quando os períodos fiscais possuem cobertura equivalente. Quando a API não informa essa equivalência, o relatório mantém os dois valores e não calcula uma taxa enganosa.</p></div></div><div class="callout mt-3"><h3>Base para decisão</h3><p>O valor do diagnóstico está menos em uma cifra isolada e mais na coerência entre receita, matrículas, infraestrutura e aprendizagem.</p></div></main>${footer(prox(),"Siconfi/Tesouro e FNDE")}</section>

<section class="page content-page">${header(`${model.currentYear} até agora`)}<main class="page-body"><div class="kicker">Situação atual</div><h2>Capacidade fiscal disponível para agir</h2><p class="lede">A fotografia atual mostra a última execução recuperada pelo sistema. Ela não é confundida com o fechamento de ${model.currentYear}.</p><div class="grid-4 mt-3">${metric(compactMoney(model.revenueCurrent),"receita realizada · parcial")}${metric(compactMoney(model.rcl),"RCL ajustada")}${metric(compactMoney(model.personnelExpense),"despesa de pessoal")}${metric(pct(model.personnelPercent),"pessoal sobre RCL")}</div><div class="grid-2 mt-3"><div class="card ${model.personnelPercent !== null && model.personnelLimit !== null && model.personnelPercent > model.personnelLimit ? "bad" : "accent"}"><h3>Lei de Responsabilidade Fiscal</h3><table><tbody><tr><td>Situação</td><td class="num"><b>${esc(model.fiscalStatus)}</b></td></tr><tr><td>Percentual de pessoal</td><td class="num"><b>${esc(pct(model.personnelPercent))}</b></td></tr><tr><td>Limite máximo informado</td><td class="num"><b>${esc(pct(model.personnelLimit))}</b></td></tr></tbody></table></div><div class="card"><h3>Leitura gerencial</h3><p>A margem fiscal deve ser lida em conjunto com obrigações de pessoal, cronograma de repasses, restos a pagar e capacidade de execução das secretarias.</p><div class="note mt-2">A confirmação contábil deve ocorrer nos demonstrativos oficiais e no fechamento do período.</div></div></div></main>${footer(prox(),"Siconfi/Tesouro, última entrega disponível")}</section>

<section class="page content-page">${header("FUNDEB")}<main class="page-body"><div class="kicker">Financiamento da educação</div><h2>O salto de receita precisa ter destino mensurável</h2><p class="lede">A comparação do FUNDEB é o eixo financeiro central do raio-X. O crescimento é oportunidade, mas também amplia a necessidade de governança e prestação de contas.</p><div class="grid-3 mt-3">${metric(compactMoney(model.fundebBase),String(model.baseYear))}${metric(compactMoney(model.fundebCurrent),String(model.currentYear))}${metric(deltaText(model.fundebBase,model.fundebCurrent),"variação")}</div><table class="mt-3"><thead><tr><th>Indicador</th><th class="num">${model.baseYear}</th><th class="num">${model.currentYear}</th><th class="num">Evolução</th></tr></thead><tbody><tr><td>Receita total FUNDEB</td><td class="num">${esc(money(model.fundebBase))}</td><td class="num">${esc(money(model.fundebCurrent))}</td><td class="num ${fundebClass}">${esc(deltaText(model.fundebBase,model.fundebCurrent))}</td></tr><tr><td>Receita por matrícula conhecida</td><td class="num">N/D</td><td class="num">${esc(model.fundebCurrent !== null && model.enrollments ? brl.format(model.fundebCurrent/model.enrollments) : "N/D")}</td><td class="num">referencial</td></tr></tbody></table>${vaarBlock(model)}</main>${footer(prox(),"FNDE — receita do FUNDEB e complementação VAAR")}</section>

${paginaComplementacoes(model, prox())}

${paginaGanhoApurado(model, prox())}

${paginaVinculacoes(model, prox())}

${paginaObras(model, prox())}

${paginaDinheiroFederal(model, prox())}

${paginaPrecatorioFundef(model, prox())}

${paginaCauc(model, prox())}

${paginaCicloPolitico(model, prox())}

${paginaGemeos(model, prox())}

${paginaEscolas(model, prox())}

${paginaContextoEscolas(model, prox())}

${paginaAlfabetizacao(model, prox())}

${paginaProficiencia(model, prox())}

${paginaDemografia(model, prox())}

${paginaTerritorio(model, prox())}

${paginaDeclaracaoEtnica(model, prox())}

${paginaMapaEscolas(model, prox())}

${paginaDensidadeRede(model, prox())}

${paginaNutricional(model, prox())}

${paginaFrequenciaPbf(model, prox())}

${paginaViolencia(model, prox())}

${paginaEconomia(model, prox())}

${paginaTrabalhoInfantil(model, prox())}

${paginaRedeEResultado(model, prox())}

<section class="page content-page">${header("Infraestrutura escolar")}<main class="page-body"><div class="kicker">Condições de oferta</div><h2>Qualidade também depende do ambiente de aprendizagem</h2><p class="lede">A cobertura de infraestrutura escolar ajuda a localizar gargalos concretos. Os percentuais são calculados sobre as ${model.publicSchools === null ? "escolas" : `${int(model.publicSchools)} escolas`} da rede <b>pública</b> do município — universo maior que a rede municipal, porque o Censo avalia a infraestrutura de todas as escolas públicas do território.</p><div class="mt-3">${infraRows}</div><div class="grid-2 mt-3"><div class="insight"><b>Prioridade:</b> atacar primeiro os itens com menor cobertura e maior efeito sobre segurança, permanência e prática pedagógica.</div><div class="note"><b>Validação local:</b> conferir escola por escola, pois reformas recentes podem ainda não aparecer no Censo publicado.</div></div></main>${footer(prox(),"Microdados do Censo Escolar/Inep")}</section>

${paginaSaneamento(model, prox())}

${paginaSaude(model, prox())}

${paginaEmprego(model, prox())}

${paginaAssistencia(model, prox())}

${paginaInstitucional(model, prox())}

${paginaGovernancaEducacional(model, prox())}

${paginaQuemDirige(model, prox())}

${paginaConformidade(model, prox())}

<section class="page content-page">${header("Plano de ação")}<main class="page-body"><div class="kicker">Próximo ciclo</div><h2>${priorities.length === 1 ? "O movimento que converte recurso em entrega" : `${priorities.length} movimentos que convertem recurso em entrega`}</h2><p class="lede">Cada linha responde a um achado da página 2, na mesma ordem de urgência, e traz o prazo que a norma ou o calendário da fonte impõe — não uma estimativa de esforço. A validação com a equipe local é o passo seguinte, não um substituto.</p><table class="mt-3"><thead><tr><th>#</th><th>Movimento</th><th>Responde a</th><th>Prazo</th></tr></thead><tbody>${priorities.map((item,index)=>`<tr><td>${index+1}</td><td><b>${esc(item.title)}</b></td><td>${esc(item.reason)}</td><td>${esc(item.horizon)}</td></tr>`).join("")}</tbody></table><div class="grid-2 mt-3"><div class="card accent"><h3>Ritual de acompanhamento</h3><ul><li>Painel mensal com responsáveis.</li><li>Evidência documental por ação.</li><li>Revisão trimestral de metas.</li><li>Comunicação executiva em uma página.</li></ul></div><div class="card"><h3>Critério de sucesso</h3><p>Cada real adicional deve estar conectado a uma entrega verificável e a um indicador de acesso, qualidade, eficiência ou equidade.</p></div></div></main>${footer(prox(),"Síntese técnica gerada pelo Sync")}</section>

<section class="page content-page">${header("Fontes e conclusão")}<main class="page-body"><div class="kicker">Rastreabilidade</div><h2>Um raio-X útil é atualizado, verificável e acionável</h2><p class="lede">Este documento registra a posição disponível em ${esc(date)}. Novas publicações oficiais podem alterar valores e leituras.</p><div class="mt-3"><div class="card accent"><h3>Fontes consultadas</h3><ul class="source-list source-list--colunas">${linhasFontes(model)}</ul></div><div class="card mt-1"><h3>Observações automáticas</h3>${noteRows ? `<ul class="source-list">${noteRows}</ul>` : `<p class="small">Nenhuma observação operacional adicional foi registrada pelas integrações.</p>`}</div></div><div class="callout mt-3"><h3>Conclusão</h3><p>${esc(model.municipality)} dispõe agora de uma leitura comparativa replicável. O próximo passo é validar os dados com as áreas responsáveis e transformar as prioridades em plano de execução com dono, prazo, evidência e indicador.</p></div><div class="note mt-3"><b>Aviso técnico:</b> o relatório é informativo e não substitui demonstrações contábeis, parecer jurídico, auditoria ou validação dos órgãos oficiais.</div></main>${footer(prox(),`Gerado pelo Sync em ${shortDate}`)}</section>
</body></html>`;
}
