/**
 * Bloco Institucional — IBGE MUNIC (Pesquisa de Informações Básicas Municipais)
 * lida pela API SIDRA de agregados, nível territorial N6 (município).
 *
 * A MUNIC é declaratória e cada tema roda numa edição diferente: urbanismo e
 * Plano Diretor só existem em 2021, habitação e transporte em 2020. O bloco sai
 * portanto com vintages MISTOS de propósito — por isso o `ano` de cada
 * indicador vem da própria resposta, nunca fixado em código.
 */

import {
  fetchJson,
  indicador,
  semDado,
  type BlocoInstitucional,
  type FalhaColeta,
  type Indicador,
  type InstrumentoUrbanistico,
} from "./types";

const BLOCO = "institucional";

/**
 * Derivado do contrato em vez de redigitado: a união mora inline dentro de
 * `BlocoInstitucional` e, se o types.ts ganhar um estado novo, este alias
 * acompanha sozinho.
 */
type EstadoPlanoDiretor = NonNullable<BlocoInstitucional["planoDiretor"]["valor"]>;

/** Tabelas SIDRA da pesquisa MUNIC usadas aqui. */
const T = {
  planoDiretor: 5882,
  instrumentos: 5883,
  anoInstrumentos: 5884,
  planosSetoriais: 8431,
  conselhos: 8435,
  fundos: 8442,
  cadastroFamilias: 8439,
  acoesHabitacao: 8477,
  onibusIntramunicipal: 8444,
} as const;

/**
 * Rótulos das classificações, exatamente como o SIDRA os devolve no cabeçalho.
 * Lemos os campos por RÓTULO e nunca por posição (`D4N`, `D5N`): o índice da
 * dimensão muda conforme a ordem das classificações na URL — acrescentar
 * `c12446` empurra "Existência de Plano Diretor" de `D4N` para `D5N`.
 */
const DIM = {
  ano: "Ano",
  valor: "Valor",
  planoDiretor: "Existência de Plano Diretor",
  existenciaLegislacao: "Existência de legislação",
  instrumento: "Instrumentos de Planejamento",
  anoLegislacao: "Ano de criação da legislação",
  planoMunicipal: "Existência de Plano Municipal",
  conselhoMunicipal: "Existência de Conselho Municipal",
  fundoMunicipal: "Existência de Fundo Municipal",
  cadastroFamilias:
    "Existência de cadastro ou levantamento de famílias interessadas em programas habitacionais",
  acoesPrefeitura:
    "Existência de programas ou ações realizados pela prefeitura, nos dois anos anteriores ao de referência da pesquisa",
  onibus: "Existência de transporte coletivo por ônibus intramunicipal",
} as const;

/**
 * Fixa "Classe de tamanho da população do município" em Total. Sem isso o SIDRA
 * devolve a mesma pergunta repetida nas 8 faixas de porte e a leitura por
 * categoria passaria a depender de em qual faixa o município cai.
 */
const CLASSE_TAMANHO_TOTAL = "c12446/47692";

/** Separador de chave composta; " | " não ocorre em nenhum rótulo do SIDRA. */
const SEP = " | ";

/**
 * Rótulo da fonte no rodapé do PDF. Precisa sair idêntico nos indicadores e nas
 * falhas do mesmo agregado, senão o leitor vê duas procedências onde há uma.
 */
function fonteMunic(tabela: number, ano: number | null): string {
  return ano === null ? `IBGE — MUNIC (SIDRA ${tabela})` : `IBGE — MUNIC ${ano} (SIDRA ${tabela})`;
}

/**
 * ARMADILHA CENTRAL DA MUNIC NO SIDRA: a variável publicada é "Número de
 * municípios". Como a consulta N6 tem exatamente 1 município, o valor é um
 * booleano disfarçado de contagem.
 *
 * Mas são TRÊS estados, não dois: `"1"` = a característica existe, `"-"` = zero
 * municípios nesta linha, e `".."`/`"..."`/`"X"` = o IBGE não publicou. Município
 * que recusou responder a MUNIC também sai com tudo em `"-"`. Por isso a leitura
 * de existência é sempre feita em PAR (`lerPar`): só a linha "Sem X" marcada
 * autoriza afirmar ausência. Ler apenas "Com X" faria silêncio virar negativa.
 */
function flag(v: string | undefined): boolean {
  return v === "1";
}

/**
 * Existência a partir do par "Com X" / "Sem X". Devolve `null` quando nenhuma
 * das duas linhas está marcada — o caso da recusa, em que negar seria mentir.
 */
function lerPar(t: Tabela, com: string, sem: string): boolean | null {
  if (flag(t.valores.get(com))) return true;
  if (flag(t.valores.get(sem))) return false;
  return null;
}

interface Tabela {
  /** Ano de referência da edição MUNIC que respondeu, lido da própria resposta. */
  ano: number | null;
  /**
   * Chave = categorias das dimensões pedidas, unidas por SEP; valor = campo "V".
   * Map e não Record porque as chaves vêm do corpo da resposta do SIDRA, e
   * gravar rótulo externo em objeto literal expõe `__proto__`/`constructor`.
   */
  valores: Map<string, string>;
  /**
   * Categorias distintas por dimensão. A ORDEM importa: `anoDoInstrumento`
   * varre as faixas na sequência em que o SIDRA as devolveu, da mais antiga
   * para a mais recente.
   */
  categorias: Map<string, string[]>;
}

function motivoDoErro(erro: unknown): string {
  if (erro instanceof Error) {
    // O AbortController de `fetchJson` estoura com DOMException/AbortError, cuja
    // mensagem padrão não diz que foi timeout.
    if (erro.name === "AbortError") return "tempo esgotado ao consultar o SIDRA";
    return erro.message;
  }
  return String(erro);
}

async function carregar(
  tabela: number,
  codigoIbge: string,
  classificacoes: string[],
  dimensoes: string[],
): Promise<Tabela> {
  // `p/last` em vez de `p/all`: a MUNIC não é anual e ganha edições novas: pedir
  // todos os períodos faria uma edição futura acrescentar linhas de outro ano à
  // mesma consulta, e a leitura por categoria colidiria entre anos.
  const url = `https://apisidra.ibge.gov.br/values/t/${tabela}/n6/${codigoIbge}/v/all/p/last/${CLASSE_TAMANHO_TOTAL}/${classificacoes.join("/")}`;
  const bruto = await fetchJson<unknown>(url, { timeoutMs: 20_000 });

  // O SIDRA responde HTTP 200 com texto puro quando o município não existe
  // ("Unidade territorial ... inexistente ou extinta") — aí `fetchJson` já
  // estoura no parse. Mas também pode devolver JSON fora do formato esperado,
  // então validamos a linha de cabeçalho antes de confiar nos rótulos.
  if (!Array.isArray(bruto) || bruto.length < 2) {
    throw new Error("resposta do SIDRA vazia ou fora do formato esperado");
  }
  const linhas = bruto as Array<Record<string, string>>;
  const cabecalho = linhas[0];
  if (cabecalho?.V !== "Valor") {
    throw new Error("primeira linha da resposta não é o cabeçalho do SIDRA");
  }

  // O cabeçalho mapeia código -> rótulo ("D5N" -> "Existência de Plano Diretor").
  // Invertemos para conseguir ler cada linha pelo rótulo humano.
  const codigoDoRotulo = new Map<string, string>();
  for (const [codigo, rotulo] of Object.entries(cabecalho)) codigoDoRotulo.set(rotulo, codigo);

  const valores = new Map<string, string>();
  const categorias = new Map<string, string[]>();
  for (const dim of dimensoes) categorias.set(dim, []);

  const codigoValor = codigoDoRotulo.get(DIM.valor);
  const codigoAno = codigoDoRotulo.get(DIM.ano);
  const codigosDim = dimensoes.map((dim) => codigoDoRotulo.get(dim));
  const faltando = dimensoes.filter((_, i) => codigosDim[i] === undefined);
  if (codigoValor === undefined || faltando.length > 0) {
    throw new Error(`o SIDRA não devolveu as dimensões esperadas: ${faltando.join(", ") || DIM.valor}`);
  }

  let ano: number | null = null;
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (ano === null && codigoAno !== undefined) {
      const anoBruto = Number.parseInt(linha[codigoAno] ?? "", 10);
      if (Number.isFinite(anoBruto)) ano = anoBruto;
    }
    const partes: string[] = [];
    for (let d = 0; d < dimensoes.length; d++) {
      const categoria = linha[codigosDim[d] as string] ?? "";
      partes.push(categoria);
      const vistas = categorias.get(dimensoes[d]) as string[];
      // Lista pequena (no máximo 21 categorias): `includes` preserva a ordem do
      // SIDRA sem alocar um Set por dimensão.
      if (categoria !== "" && !vistas.includes(categoria)) vistas.push(categoria);
    }
    valores.set(partes.join(SEP), linha[codigoValor] ?? "");
  }

  return { ano, valores, categorias };
}

/**
 * Indicador booleano lido em par. `sem` é opcional porque nem toda tabela
 * publica a linha negativa; sem ela, ausência de marca vira `null` — nunca
 * `false`, porque não dá para distinguir "não tem" de "não respondeu".
 */
function flagIndicador(
  t: Tabela | null,
  tabela: number,
  categoria: string,
  categoriaNegativa?: string,
): Indicador<boolean> {
  const meta = {
    status: "estrutural" as const,
    fonte: fonteMunic(tabela, t?.ano ?? null),
    url: `https://sidra.ibge.gov.br/tabela/${tabela}`,
  };
  if (!t) return semDado<boolean>(meta);
  const valor = categoriaNegativa
    ? lerPar(t, categoria, categoriaNegativa)
    : flag(t.valores.get(categoria))
      ? true
      : null;
  return indicador<boolean>(valor, { ano: t.ano, ...meta });
}

function lerPlanoDiretor(t: Tabela | null): Indicador<EstadoPlanoDiretor> {
  const meta = {
    status: "estrutural" as const,
    fonte: fonteMunic(T.planoDiretor, t?.ano ?? null),
    url: `https://sidra.ibge.gov.br/tabela/${T.planoDiretor}`,
  };
  if (!t) return semDado<EstadoPlanoDiretor>(meta);

  // As categorias da tabela 5882 são HIERÁRQUICAS e um município marca mais de
  // uma linha: quem não tem plano mas está redigindo marca "Sem Plano Diretor"
  // E "Está elaborando o Plano Diretor". Daí a ordem dos testes — "elaborando"
  // precisa ser avaliado antes de "Sem Plano Diretor", senão vira "nao_possui".
  const valor = flag(t.valores.get("Com Plano Diretor"))
    ? "possui"
    : flag(t.valores.get("Está elaborando o Plano Diretor"))
      ? "elaborando"
      : flag(t.valores.get("Sem Plano Diretor"))
        ? "nao_possui"
        : // "Recusa" é resposta válida na MUNIC: o município não respondeu até o
          // fim da coleta e nenhuma linha vem marcada. Null diz isso; "nao_possui"
          // mentiria.
          null;

  return indicador(valor, { ano: t.ano, ...meta });
}

/**
 * A tabela 5884 só classifica a lei por FAIXA ("1980 a 1990", "Após 2020"); o
 * ano cheio existe apenas na planilha MUNIC 2021 (variáveis MLEG0x1), que está
 * fora do SIDRA. Faixa não é ano, então devolvemos null em vez de chutar o meio
 * do intervalo. O regex aceita um rótulo de 4 dígitos caso o IBGE passe a
 * publicar o ano exato numa edição futura.
 */
function anoCheio(rotuloDaFaixa: string): number | null {
  const m = /^\s*(\d{4})\s*$/.exec(rotuloDaFaixa);
  return m ? Number(m[1]) : null;
}

function anoDoInstrumento(t: Tabela | null, instrumento: string): number | null {
  if (!t) return null;
  for (const faixa of t.categorias.get(DIM.anoLegislacao) ?? []) {
    if (flag(t.valores.get(`${faixa}${SEP}${instrumento}`))) return anoCheio(faixa);
  }
  return null;
}

/**
 * Os 21 instrumentos urbanísticos da tabela 5883. A lista vem da resposta, não
 * de um array fixo, para acompanhar o IBGE se ele acrescentar instrumentos.
 */
function lerInstrumentos(legislacao: Tabela | null, anos: Tabela | null): InstrumentoUrbanistico[] {
  if (!legislacao) return [];
  const nomes = legislacao.categorias.get(DIM.instrumento) ?? [];
  const instrumentos: InstrumentoUrbanistico[] = [];
  for (const nome of nomes) {
    // Duas formas de existir contam como "possui": lei própria ou capítulo
    // dentro do Plano Diretor. A categoria "Total" da dimensão de existência
    // marca 1 para TODO instrumento (é a linha-soma) e por isso é ignorada.
    const possui =
      flag(legislacao.valores.get(`Com legislação específica${SEP}${nome}`)) ||
      flag(legislacao.valores.get(`Com legislação como parte integrante do Plano Diretor${SEP}${nome}`));
    instrumentos.push({ nome, possui, ano: anoDoInstrumento(anos, nome) });
  }
  return instrumentos;
}

export async function coletarInstitucional(params: {
  codigoIbge: string;
  uf: string;
  municipio: string;
}): Promise<{ bloco: BlocoInstitucional | null; falhas: FalhaColeta[] }> {
  const { codigoIbge } = params;

  // Uma lista declarativa em vez de nove chamadas soltas: os dois `map` abaixo
  // percorrem ESTE array, então o número da tabela usado ao registrar a falha
  // nunca desalinha do pedido que falhou, mesmo se alguém reordenar a lista.
  const consultas: Array<{ tabela: number; classificacoes: string[]; dimensoes: string[] }> = [
    { tabela: T.planoDiretor, classificacoes: ["c1480/all"], dimensoes: [DIM.planoDiretor] },
    {
      tabela: T.instrumentos,
      classificacoes: ["c1672/all", "c1674/all"],
      dimensoes: [DIM.existenciaLegislacao, DIM.instrumento],
    },
    {
      tabela: T.anoInstrumentos,
      classificacoes: ["c1483/all", "c1674/all"],
      dimensoes: [DIM.anoLegislacao, DIM.instrumento],
    },
    { tabela: T.planosSetoriais, classificacoes: ["c1329/all"], dimensoes: [DIM.planoMunicipal] },
    { tabela: T.conselhos, classificacoes: ["c1328/all"], dimensoes: [DIM.conselhoMunicipal] },
    { tabela: T.fundos, classificacoes: ["c1331/all"], dimensoes: [DIM.fundoMunicipal] },
    { tabela: T.cadastroFamilias, classificacoes: ["c1073/all"], dimensoes: [DIM.cadastroFamilias] },
    { tabela: T.acoesHabitacao, classificacoes: ["c1075/all"], dimensoes: [DIM.acoesPrefeitura] },
    { tabela: T.onibusIntramunicipal, classificacoes: ["c1087/all"], dimensoes: [DIM.onibus] },
  ];

  // allSettled e não all: uma tabela fora do ar não pode derrubar as outras oito.
  const resultados = await Promise.allSettled(
    consultas.map((c) => carregar(c.tabela, codigoIbge, c.classificacoes, c.dimensoes)),
  );

  const falhas: FalhaColeta[] = [];
  const tabelas = resultados.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    falhas.push({
      bloco: BLOCO,
      fonte: fonteMunic(consultas[i].tabela, null),
      motivo: motivoDoErro(r.reason),
    });
    return null;
  });

  const [planoDiretor, instrumentos, anosInstrumentos, planos, conselhos, fundos, cadastro, acoes, onibus] =
    tabelas;

  // Nenhuma tabela respondeu: não há bloco a montar, só falhas a reportar.
  if (tabelas.every((t) => t === null)) return { bloco: null, falhas };

  // Procedência única para os dois campos de saneamento; `semDado` copia os
  // campos para um objeto novo a cada chamada, então compartilhar é seguro.
  const suplementoSaneamento = {
    status: "estrutural" as const,
    fonte: "IBGE — MUNIC, Suplemento de Saneamento Básico 2023 (não publicado no SIDRA)",
    url: "https://ftp.ibge.gov.br/Perfil_Municipios/Saneamento_2023/Base_de_Dados/Base_de_Dados_Suplemento_de_Saneamento_2023.xlsx",
  };

  const bloco: BlocoInstitucional = {
    planoDiretor: lerPlanoDiretor(planoDiretor),

    // O SIDRA não publica o ano do Plano Diretor em nenhuma tabela: a 5884 é a
    // única com ano e (a) só tem faixas e (b) sua dimensão de instrumentos traz
    // os 21 itens urbanísticos, sem uma linha "Plano Diretor". O ano exato só
    // existe na planilha MUNIC 2021 (MLEG011 / MLEG013), fora do SIDRA — não
    // inventamos ano nem interpolamos faixa.
    planoDiretorAno: semDado<number>({
      status: "estrutural",
      fonte: "IBGE — MUNIC 2021, planilha 'Legislação e instr de planej' (ano exato não publicado no SIDRA)",
      url: "https://ftp.ibge.gov.br/Perfil_Municipios/2021/Base_de_Dados/Base_MUNIC_2021_20240425.xlsx",
    }),

    instrumentos: lerInstrumentos(instrumentos, anosInstrumentos),

    habitacao: {
      // A MUNIC pergunta pelo Plano Municipal de Habitação, o instrumento que
      // materializa a política habitacional. Atenção à deriva declaratória: a
      // edição 2024 (fora do SIDRA) pode contradizer a de 2020 no mesmo
      // município, porque o respondente da prefeitura muda a cada edição.
      politicaHabitacional: flagIndicador(planos, T.planosSetoriais, "Com Plano Municipal de Habitação", "Sem Plano Municipal de Habitação"),
      conselho: flagIndicador(conselhos, T.conselhos, "Com Conselho Municipal de Habitação", "Sem Conselho Municipal de Habitação"),
      fundo: flagIndicador(fundos, T.fundos, "Com Fundo Municipal de Habitação", "Sem Fundo Municipal de Habitação"),
      cadastroDeficit: flagIndicador(
        cadastro,
        T.cadastroFamilias,
        "Com cadastro ou levantamento de famílias interessadas em programas habitacionais",
      ),
      // Vem da 8477 (programa/ação executado pela prefeitura), não da 5883: a
      // 5883 mede só a EXISTÊNCIA DE LEI de regularização fundiária e já sai
      // exposta em `instrumentos`. Ter lei e não executar — ou executar sem lei
      // — é comum, então as duas leituras se complementam em vez de repetir.
      regularizacaoFundiaria: flagIndicador(acoes, T.acoesHabitacao, "Regularização fundiária"),
    },

    mobilidade: {
      planoMobilidade: flagIndicador(planos, T.planosSetoriais, "Com Plano Municipal de Transporte", "Sem Plano Municipal de Transporte"),
      // Ônibus intramunicipal (8444), e não "serviços regulares de transporte"
      // (8443): a 8443 conta táxi, mototáxi e van como serviço regular, o que
      // marcaria "tem transporte público" em município que só tem mototáxi.
      transportePublico: flagIndicador(
        onibus,
        T.onibusIntramunicipal,
        "Com transporte coletivo por ônibus intramunicipal",
        "Sem transporte coletivo por ônibus intramunicipal",
      ),
    },

    // Saneamento institucional NÃO existe no SIDRA. A MUNIC publica plano,
    // política, fundo e conselho de saneamento apenas no Suplemento de
    // Saneamento 2023 (planilha, variáveis SDG*), que o IBGE não subiu para o
    // SIDRA; na PNSB o SIDRA para em 2017 e só cobre água/esgoto. A tabela 8487
    // tem uma categoria "Sobre saneamento básico", mas ela mede legislação de
    // gestão AMBIENTAL, não o Plano Municipal de Saneamento Básico — usá-la aqui
    // faria o Raio-X afirmar algo que a fonte não afirma.
    saneamentoInstitucional: {
      planoSaneamento: semDado<boolean>(suplementoSaneamento),
      conselho: semDado<boolean>(suplementoSaneamento),
    },
  };

  return { bloco, falhas };
}
