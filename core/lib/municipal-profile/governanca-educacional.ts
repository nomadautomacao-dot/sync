/**
 * Bloco de Governança Educacional — IBGE MUNIC (Pesquisa de Informações Básicas
 * Municipais), módulo Educação, lido pela API SIDRA no nível territorial N6.
 *
 * Responde a categoria 5 do checklist de diagnóstico (conselhos, PME, fórum) e
 * o item de plano de carreira da categoria 2 — perguntas que antes só se
 * respondia em visita à secretaria.
 *
 * O módulo Educação inteiro é da edição 2021: a MUNIC roda cada tema numa
 * edição diferente e educação não voltou desde então. Mesmo assim o `ano` de
 * cada indicador vem da resposta, nunca fixado em código, para o bloco
 * acompanhar sozinho a próxima edição.
 */

import {
  fetchJson,
  indicador,
  semDado,
  type BlocoGovernancaEducacional,
  type FalhaColeta,
  type Indicador,
} from "./types";

const BLOCO = "governanca_educacional";

/** Tabelas SIDRA da MUNIC usadas aqui. */
const T = {
  /**
   * Existência dos quatro conselhos. É a ÚNICA das três tabelas de conselho que
   * publica o par completo "Com X" / "Sem X" — ver `triEstado` para o motivo de
   * isso ser decisivo.
   */
  conselhos: 7340,
  /** Reserva para CME, CAE e Transporte quando a 7340 não responde. */
  conselhosSituacao: 7341,
  /** Reserva para o CACS-FUNDEB, que não existe na 7341. */
  conselhosFundeb: 7393,
  /** Plano Municipal de Educação (junto com cultura e saúde). */
  planosMunicipais: 7308,
  /** Fórum Permanente de Educação e Plano de Carreira do Magistério. */
  forumECarreira: 7310,
  /** Limite de 2/3 da carga horária em interação com os educandos. */
  limiteHoraAtividade: 7312,
  /** Caracterização do órgão gestor da educação no organograma. */
  orgaoGestor: 7282,
} as const;

/**
 * Variáveis fixadas por ID em vez de `v/all`.
 *
 * ARMADILHA: 7282, 7341 e 7393 têm mais de uma variável e o SIDRA repete cada
 * categoria uma vez por variável. Em Serra do Ramalho a 7282 devolve
 * "Secretaria municipal exclusiva" = 1 para a variável de EDUCAÇÃO e = "-" para
 * a de ESPORTE, na mesma categoria — quem lê só pela classificação sobrescreve
 * uma resposta com a outra e imprime a área errada. Fixar o ID elimina a
 * colisão na origem e ainda encolhe a resposta.
 */
const V = {
  /** "Número de municípios" — a variável genérica das tabelas de contagem. */
  numeroDeMunicipios: 603,
  conselhoEducacao: 12815,
  conselhoAlimentacao: 12816,
  conselhoFundeb: 12817,
  conselhoTransporte: 12818,
  estruturaEducacao: 12729,
  planoCarreiraMagisterio: 12733,
} as const;

/**
 * Rótulos das classificações exatamente como o SIDRA os devolve no cabeçalho.
 * Lemos por RÓTULO e nunca por posição (`D5N`, `D6N`): a ordem no cabeçalho não
 * é a da URL nem a dos metadados. Na 7341, pedida como c1510/c1165/c1164, o
 * SIDRA devolve D5N=Representação, D6N=Caráter e D7N=Situação — a ordem exata
 * ao contrário. Ler por índice pegaria a coluna errada em silêncio.
 */
const DIM = {
  ano: "Ano",
  valor: "Valor",
  variavel: "Variável",
  conselho: "Existência de Conselho Municipal na área de educação",
  planoMunicipal: "Existência de Plano Municipal",
  forum: "Instituição de Fórum Permanente de Educação",
  planoCarreira: "Existência de Plano de Carreira para o Magistério",
  limite2Tercos:
    "Existência de previsão expressa do limite de 2/3 (dois terços) da carga horária para o desempenho das atividades de interação com os educandos na lei do plano",
  orgaoGestor: "Caracterização do órgão gestor",
} as const;

/** Categorias lidas, no texto literal do SIDRA. */
const CAT = {
  conselhoEducacaoSim: "Com Conselho Municipal de Educação",
  conselhoEducacaoNao: "Sem Conselho Municipal de Educação",
  conselhoAlimentacaoSim: "Com Conselho Municipal de Alimentação Escolar",
  conselhoAlimentacaoNao: "Sem Conselho Municipal de Alimentação Escolar",
  conselhoFundebSim: "Com Conselho Municipal de Controle e Acompanhamento Social do FUNDEB",
  conselhoFundebNao: "Sem Conselho Municipal de Controle e Acompanhamento Social do FUNDEB",
  conselhoTransporteSim: "Com Conselho Municipal de Transporte Escolar",
  conselhoTransporteNao: "Sem Conselho Municipal de Transporte Escolar",
  pmeSim: "Com Plano Municipal de Educação",
  pmeNao: "Sem Plano Municipal de Educação",
  forumSim: "Com fórum instituído",
  forumNao: "Sem fórum instituído",
  planoCarreiraSim: "Com plano",
  planoCarreiraNao: "Sem plano",
  limiteSim: "Com previsão",
  limiteNao: "Sem previsão",
} as const;

/** Nomes das variáveis das tabelas de reserva, que ali fazem papel de categoria. */
const VAR_CONSELHO = {
  educacao: "Municípios com Conselho Municipal de Educação",
  alimentacao: "Municípios com Conselho Municipal de Alimentação Escolar",
  fundeb: "Municípios com Conselho Municipal de Acompanhamento Social do FUNDEB",
  transporte: "Municípios com Conselho Municipal de Transporte Escolar",
} as const;

/**
 * Fixa "Classe de tamanho da população do município" em Total. Sem isso o SIDRA
 * repete a mesma pergunta nas 8 faixas de porte e a leitura por categoria
 * passaria a depender de em qual faixa o município cai.
 */
const CLASSE_TAMANHO_TOTAL = "c12446/47692";

/** Separador de chave composta; " | " não ocorre em nenhum rótulo do SIDRA. */
const SEP = " | ";

/** Categoria-soma que o SIDRA cria em toda classificação. */
const TOTAL = "Total";

/**
 * Rótulo da fonte no rodapé do PDF. Precisa sair idêntico nos indicadores e nas
 * falhas do mesmo agregado, senão o leitor vê duas procedências onde há uma.
 */
function fonteMunic(tabela: number, ano: number | null): string {
  return ano === null ? `IBGE — MUNIC (SIDRA ${tabela})` : `IBGE — MUNIC ${ano} (SIDRA ${tabela})`;
}

function metaDe(tabela: number, ano: number | null) {
  return {
    status: "estrutural" as const,
    fonte: fonteMunic(tabela, ano),
    url: `https://sidra.ibge.gov.br/tabela/${tabela}`,
  };
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
  /** Categorias distintas por dimensão, na ordem em que o SIDRA as devolveu. */
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
  variaveis: readonly number[],
  codigoIbge: string,
  classificacoes: readonly string[],
  dimensoes: readonly string[],
): Promise<Tabela> {
  // `p/last` em vez de `p/all`: a MUNIC não é anual e ganha edições novas. Pedir
  // todos os períodos faria uma edição futura acrescentar linhas de outro ano à
  // mesma consulta, e a leitura por categoria colidiria entre anos.
  //
  // Classificação omitida vira linha Total sozinha — é de propósito nas
  // dimensões que não usamos (a 7310 tem "plano dos não docentes" e a 7312 tem
  // "critérios de progressão", ambas sem campo no contrato).
  const partes = [
    `t/${tabela}`,
    `n6/${codigoIbge}`,
    `v/${variaveis.join(",")}`,
    "p/last",
    CLASSE_TAMANHO_TOTAL,
    ...classificacoes,
  ];
  const url = `https://apisidra.ibge.gov.br/values/${partes.join("/")}`;
  const bruto = await fetchJson<unknown>(url, { timeoutMs: 20_000 });

  // Código inexistente devolve HTTP 400 com TEXTO PURO ("Unidade territorial
  // 9999999 ... inexistente ou extinta"), e `fetchJson` já estoura ali. Mas
  // tabela inexistente devolve HTTP 200 com um JSON só de cabeçalho, então
  // validamos o formato antes de confiar nos rótulos.
  if (!Array.isArray(bruto) || bruto.length < 2) {
    throw new Error("resposta do SIDRA vazia ou fora do formato esperado");
  }
  const linhas = bruto as Array<Record<string, string>>;
  const cabecalho = linhas[0];
  if (cabecalho?.V !== DIM.valor) {
    throw new Error("primeira linha da resposta não é o cabeçalho do SIDRA");
  }

  // O cabeçalho mapeia código -> rótulo ("D5N" -> "Existência de Plano Municipal").
  // Invertemos para conseguir ler cada linha pelo rótulo humano.
  const codigoDoRotulo = new Map<string, string>();
  for (const [codigo, rotulo] of Object.entries(cabecalho)) codigoDoRotulo.set(rotulo, codigo);

  const codigoValor = codigoDoRotulo.get(DIM.valor);
  const codigoAno = codigoDoRotulo.get(DIM.ano);
  const codigosDim = dimensoes.map((dim) => codigoDoRotulo.get(dim));
  const faltando = dimensoes.filter((_, i) => codigosDim[i] === undefined);
  if (codigoValor === undefined || faltando.length > 0) {
    throw new Error(`o SIDRA não devolveu as dimensões esperadas: ${faltando.join(", ") || DIM.valor}`);
  }

  const valores = new Map<string, string>();
  const categorias = new Map<string, string[]>();
  for (const dim of dimensoes) categorias.set(dim, []);

  let ano: number | null = null;
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (ano === null && codigoAno !== undefined) {
      const anoBruto = Number.parseInt(linha[codigoAno] ?? "", 10);
      if (Number.isFinite(anoBruto)) ano = anoBruto;
    }
    const chave: string[] = [];
    for (let d = 0; d < dimensoes.length; d++) {
      const categoria = linha[codigosDim[d] as string] ?? "";
      chave.push(categoria);
      const vistas = categorias.get(dimensoes[d]) as string[];
      // Lista curta (no máximo 13 categorias): `includes` preserva a ordem do
      // SIDRA sem alocar um Set por dimensão.
      if (categoria !== "" && !vistas.includes(categoria)) vistas.push(categoria);
    }
    valores.set(chave.join(SEP), linha[codigoValor] ?? "");
  }

  return { ano, valores, categorias };
}

/**
 * ARMADILHA CENTRAL DA MUNIC NO SIDRA: a variável publicada é uma CONTAGEM de
 * municípios. Como a consulta N6 traz exatamente 1 município, "1" é um booleano
 * disfarçado — mas os outros códigos NÃO são intercambiáveis:
 *
 *   "1"   → a característica existe
 *   "-"   → zero municípios nesta categoria
 *   "..." → dado não disponível (o município recusou a pesquisa, ou está fora
 *           do universo daquela tabela)
 *
 * Tratar "..." como falso faria o relatório afirmar ausência onde só houve
 * silêncio. Daí a leitura ser sempre em PAR "Com X" / "Sem X": só uma das duas
 * pontas marcada em 1 autoriza uma afirmação, e nenhuma delas marcada devolve
 * null — "não sabemos", que é diferente de "não tem".
 *
 * Verificado ao vivo: Porto de Moz/PA (1505908) recusou a MUNIC 2021 e sai com
 * "Com Conselho de Educação" = "-" E "Sem Conselho de Educação" = "-";
 * Alta Floresta d'Oeste/RO (1100015) não tem plano de carreira e por isso fica
 * fora do universo da 7312, que devolve "..." nas três categorias.
 */
function triEstado(t: Tabela, chaveSim: string, chaveNao: string): boolean | null {
  if (t.valores.get(chaveSim) === "1") return true;
  if (t.valores.get(chaveNao) === "1") return false;
  return null;
}

/**
 * Um conselho, com a 7340 na frente e a tabela de reserva atrás.
 *
 * Se a 7340 respondeu, a resposta dela é final — inclusive quando é null. A
 * reserva não sabe mais do que ela sobre o mesmo município; só entra quando a
 * 7340 falhou na rede, e aí carrega a própria procedência para o rodapé não
 * citar uma tabela que não foi consultada.
 */
function conselho(
  primaria: Tabela | null,
  chaveSim: string,
  chaveNao: string,
  reserva: { tabela: number; t: Tabela | null; variavel: string },
): Indicador<boolean> {
  if (primaria) {
    return indicador(triEstado(primaria, chaveSim, chaveNao), {
      ano: primaria.ano,
      ...metaDe(T.conselhos, primaria.ano),
    });
  }
  if (reserva.t) {
    // Aqui "-" NÃO vira falso. As tabelas de reserva só publicam o lado "Com X"
    // da pergunta e, sem a ponta "Sem X" para confirmar, "-" cobre dois casos
    // que o relatório precisa distinguir: o município respondeu "não tem" e o
    // município não respondeu. Verificado ao vivo em Buriti dos Lopes/PI
    // (2104628), que declarou "Não informou" para o Conselho de Educação e sai
    // como "-" na 7341 — o mesmo código que Serra do Ramalho recebe por
    // realmente não ter Conselho de Transporte Escolar. Só a 7340 separa os
    // dois, então a reserva confirma existência e nunca a nega.
    return indicador<boolean>(reserva.t.valores.get(reserva.variavel) === "1" ? true : null, {
      ano: reserva.t.ano,
      ...metaDe(reserva.tabela, reserva.t.ano),
    });
  }
  return semDado<boolean>(metaDe(T.conselhos, null));
}

/** Indicador booleano de um par "Com X" / "Sem X"; tabela que falhou vira `semDado`. */
function parIndicador(
  t: Tabela | null,
  tabela: number,
  chaveSim: string,
  chaveNao: string,
): Indicador<boolean> {
  if (!t) return semDado<boolean>(metaDe(tabela, null));
  return indicador(triEstado(t, chaveSim, chaveNao), { ano: t.ano, ...metaDe(tabela, t.ano) });
}

/**
 * Posição da educação no organograma, na 7282: das cinco caracterizações
 * possíveis o município marca exatamente uma (é pergunta de resposta única na
 * MUNIC — variável MEDU01). A lista sai da resposta e não de um array fixo,
 * para acompanhar o IBGE se ele acrescentar um arranjo novo.
 *
 * "Total" é ignorada: ela marca 1 para todo município que TEM alguma estrutura
 * de educação, sem dizer qual — devolvê-la imprimiria "Total" no PDF. Município
 * com estrutura mas sem caracterização declarada sai null, não "Total".
 */
function lerOrgaoGestor(t: Tabela | null): Indicador<string> {
  const meta = metaDe(T.orgaoGestor, t?.ano ?? null);
  if (!t) return semDado<string>(meta);
  for (const categoria of t.categorias.get(DIM.orgaoGestor) ?? []) {
    if (categoria !== TOTAL && t.valores.get(categoria) === "1") {
      return indicador(categoria, { ano: t.ano, ...meta });
    }
  }
  return indicador<string>(null, { ano: t.ano, ...meta });
}

export async function coletarGovernancaEducacional(params: {
  codigoIbge: string;
  uf: string;
  municipio: string;
}): Promise<{ bloco: BlocoGovernancaEducacional | null; falhas: FalhaColeta[] }> {
  const { codigoIbge } = params;

  // Lista declarativa em vez de sete chamadas soltas: os dois `map` abaixo
  // percorrem ESTE array, então o número da tabela usado ao registrar a falha
  // nunca desalinha do pedido que falhou, mesmo se alguém reordenar a lista.
  const consultas: Array<{
    tabela: number;
    variaveis: readonly number[];
    classificacoes: readonly string[];
    dimensoes: readonly string[];
  }> = [
    {
      tabela: T.conselhos,
      variaveis: [V.numeroDeMunicipios],
      classificacoes: ["c1504/all"],
      dimensoes: [DIM.conselho],
    },
    {
      // Reserva: sem classificação extra, todas as dimensões de atributo
      // (situação, caráter, representação) colapsam em Total e sobra a
      // existência pura, uma linha por conselho.
      tabela: T.conselhosSituacao,
      variaveis: [V.conselhoEducacao, V.conselhoAlimentacao, V.conselhoTransporte],
      classificacoes: [],
      dimensoes: [DIM.variavel],
    },
    {
      tabela: T.conselhosFundeb,
      variaveis: [V.conselhoFundeb],
      classificacoes: [],
      dimensoes: [DIM.variavel],
    },
    {
      tabela: T.planosMunicipais,
      variaveis: [V.numeroDeMunicipios],
      classificacoes: ["c1329/all"],
      dimensoes: [DIM.planoMunicipal],
    },
    {
      // Fórum e plano de carreira vêm CRUZADOS numa tabela só, então cada
      // pergunta é lida com a outra dimensão em Total.
      tabela: T.forumECarreira,
      variaveis: [V.numeroDeMunicipios],
      classificacoes: ["c1493/all", "c1494/all"],
      dimensoes: [DIM.forum, DIM.planoCarreira],
    },
    {
      tabela: T.limiteHoraAtividade,
      variaveis: [V.planoCarreiraMagisterio],
      classificacoes: ["c1496/all"],
      dimensoes: [DIM.limite2Tercos],
    },
    {
      tabela: T.orgaoGestor,
      variaveis: [V.estruturaEducacao],
      classificacoes: ["c1048/all"],
      dimensoes: [DIM.orgaoGestor],
    },
  ];

  // allSettled e não all: uma tabela fora do ar não pode derrubar as outras seis.
  const resultados = await Promise.allSettled(
    consultas.map((c) => carregar(c.tabela, c.variaveis, codigoIbge, c.classificacoes, c.dimensoes)),
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

  const [conselhos, conselhosReserva, fundebReserva, planos, forumECarreira, limite, orgaoGestor] = tabelas;

  // Nenhuma tabela respondeu: não há bloco a montar, só falhas a reportar.
  if (tabelas.every((t) => t === null)) return { bloco: null, falhas };

  const reservaCME = { tabela: T.conselhosSituacao, t: conselhosReserva, variavel: VAR_CONSELHO.educacao };

  const bloco: BlocoGovernancaEducacional = {
    conselhos: {
      educacao: conselho(conselhos, CAT.conselhoEducacaoSim, CAT.conselhoEducacaoNao, reservaCME),
      alimentacaoEscolar: conselho(conselhos, CAT.conselhoAlimentacaoSim, CAT.conselhoAlimentacaoNao, {
        tabela: T.conselhosSituacao,
        t: conselhosReserva,
        variavel: VAR_CONSELHO.alimentacao,
      }),
      transporteEscolar: conselho(conselhos, CAT.conselhoTransporteSim, CAT.conselhoTransporteNao, {
        tabela: T.conselhosSituacao,
        t: conselhosReserva,
        variavel: VAR_CONSELHO.transporte,
      }),
      // O CACS-FUNDEB não existe na 7341; a reserva dele é a 7393.
      acompanhamentoFundeb: conselho(conselhos, CAT.conselhoFundebSim, CAT.conselhoFundebNao, {
        tabela: T.conselhosFundeb,
        t: fundebReserva,
        variavel: VAR_CONSELHO.fundeb,
      }),
    },

    // A c1329 tem uma terceira categoria, "Sem informação na área de educação".
    // Quando ela é a marcada, "Com" e "Sem" ficam ambas em "-" e `triEstado` já
    // devolve null — o município não é declarado sem PME por não ter respondido.
    planoMunicipalEducacao: parIndicador(planos, T.planosMunicipais, CAT.pmeSim, CAT.pmeNao),

    forumPermanenteEducacao: parIndicador(
      forumECarreira,
      T.forumECarreira,
      `${CAT.forumSim}${SEP}${TOTAL}`,
      `${CAT.forumNao}${SEP}${TOTAL}`,
    ),

    planoCarreiraMagisterio: parIndicador(
      forumECarreira,
      T.forumECarreira,
      `${TOTAL}${SEP}${CAT.planoCarreiraSim}`,
      `${TOTAL}${SEP}${CAT.planoCarreiraNao}`,
    ),

    // A MUNIC NÃO pergunta se o plano de carreira prevê expressamente o piso
    // nacional. A única pergunta próxima é a MEDU20a — "todos(as) os(as)
    // professores(as) com jornada de 40 horas semanais possuem o vencimento
    // básico inicial igual ou superior a R$ 2.886,24 mensais" (o piso de 2021) —
    // e ela mede PAGAMENTO EFETIVO, não previsão em lei: um município pode pagar
    // o piso sem que o plano de carreira o mencione, e o contrário também.
    // Além disso a MEDU20a não foi publicada no SIDRA em nenhum dos 187
    // agregados da MUNIC, só na planilha. Afirmar "prevê o piso" a partir dela
    // seria dizer o que a fonte não diz, então o campo fica explicitamente sem
    // dado, com o caminho de quem quiser buscar na origem certa.
    pisoSalarialPrevisto: semDado<boolean>({
      status: "estrutural",
      fonte:
        "IBGE — MUNIC 2021, planilha 'Educação' (variável MEDU20a, pagamento do piso; previsão em plano de carreira não é pesquisada)",
      url: "https://ftp.ibge.gov.br/Perfil_Municipios/2021/Base_de_Dados/Base_MUNIC_2021_20240425.xlsx",
    }),

    // A 7312 mede a regra do 1/3 de hora-atividade (Lei 11.738/2008, art. 2º,
    // § 4º): se a LEI DO PLANO DE CARREIRA prevê expressamente o limite de 2/3
    // da carga horária para interação com os educandos. Nada a ver com o piso —
    // são duas perguntas distintas do bloco 4.4 da MUNIC (MEDU18 aqui, MEDU20a
    // no piso). O universo da tabela são os municípios COM plano de carreira:
    // quem não tem plano recebe "..." e sai null, não falso.
    limiteHoraAtividade: parIndicador(limite, T.limiteHoraAtividade, CAT.limiteSim, CAT.limiteNao),

    // Vem da 7282 (c1048 "Caracterização do órgão gestor"), não da 7296 nem da
    // 7299: a 7296 classifica o TITULAR (instrução e área de formação) e a 7299
    // lista ações prioritárias — nenhuma das duas diz onde a educação está no
    // organograma, que é o que este campo promete. Ambas ficam fora da coleta
    // por não terem campo no contrato; buscá-las só somaria dois modos de falha.
    estruturaOrgaoGestor: lerOrgaoGestor(orgaoGestor),
  };

  return { bloco, falhas };
}
