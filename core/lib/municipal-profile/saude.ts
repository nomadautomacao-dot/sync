/**
 * Bloco Saúde do Perfil Municipal.
 *
 * Três fontes independentes, todas GET público sem chave:
 *
 * 1. CNES / API de Dados Abertos do MS — a rede instalada (estabelecimentos,
 *    CAPS, hospitais, atenção básica). Base viva, por isso `em_execucao`.
 * 2. e-Gestor Atenção Básica (relatorioaps-prd) — cobertura de APS e de ACS.
 *    Competência mensal, também `em_execucao`.
 * 3. IBGE / servicodados — mortalidade infantil. É média de triênio do Censo
 *    e afins, defasada por natureza, por isso `estrutural`.
 *
 * As três rodam em paralelo e falham em separado: uma indisponibilidade do
 * DATASUS não pode zerar a cobertura de APS nem derrubar a geração do PDF.
 */

import type { BlocoSaude, FalhaColeta, Indicador } from "./types";
import { fetchJson, ibge6, indicador, semDado } from "./types";

const BLOCO = "saude";

const FONTE_CNES = "CNES/DATASUS — API de Dados Abertos do Ministério da Saúde";
const FONTE_APS = "e-Gestor Atenção Básica — Ministério da Saúde";
const FONTE_IBGE = "IBGE — Panorama das Cidades (pesquisa 10058)";

const CNES_ESTABELECIMENTOS = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos";
const CNES_TIPOS_UNIDADE = "https://apidadosabertos.saude.gov.br/cnes/tipounidades";
const APS_COBERTURA = "https://relatorioaps-prd.saude.gov.br/cobertura";
const IBGE_INDICADORES = "https://servicodados.ibge.gov.br/api/v1/pesquisas/indicadores";

/**
 * `limit` é silenciosamente truncado em 20 pela API (pedir 100 devolve 20).
 * Não adianta aumentar: o valor abaixo é o teto real do provedor.
 */
const CNES_LIMITE = 20;

/**
 * Trava de segurança da paginação. Sem ela, qualquer mudança de contrato que
 * faça a API devolver sempre uma página cheia vira laço infinito no meio da
 * geração do relatório. 200 páginas cobrem 4.000 estabelecimentos — folgado
 * para o porte de município que o Raio-X atende; se estourar, o bloco sai
 * marcado como parcial em `falhas` em vez de mentir um total truncado.
 */
const CNES_MAX_PAGINAS = 200;

/** Códigos de `codigo_tipo_unidade` que o bloco precisa nomear. */
const TIPO_POSTO_SAUDE = 1;
const TIPO_CENTRO_SAUDE_UBS = 2;
const TIPO_HOSPITAL_GERAL = 5;
const TIPO_CAPS = 70;

/**
 * Janela de competências consultada no e-Gestor. Pedimos um intervalo largo e
 * ficamos com a competência mais recente que voltar, em vez de adivinhar qual
 * mês já foi publicado: a API aceita competências futuras inexistentes no
 * intervalo sem erro (devolve só o que existe), então a janela larga dispensa
 * a consulta prévia a /data/competencias-cnes e remove um ponto de falha.
 */
const APS_JANELA_MESES = 36;

const TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Utilidades locais
// ---------------------------------------------------------------------------

/**
 * As fontes misturam convenções numéricas dentro do MESMO objeto JSON: o
 * e-Gestor devolve `pcCoberturaAcsAb: "99.93"` (ponto decimal) ao lado de
 * `qtPopulacao: "78,090"` (vírgula de milhar), e o IBGE usa "-" e "..." como
 * ausência de dado. `parseFloat` direto leria "78,090" como 78 e "-" como NaN.
 */
function numero(bruto: unknown): number | null {
  if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : null;
  if (typeof bruto !== "string") return null;

  const texto = bruto.trim();
  if (texto === "") return null;

  let normalizado = texto;
  if (texto.includes(".") && texto.includes(",")) {
    normalizado = texto.replace(/\./g, "").replace(",", "."); // pt-BR completo: 1.234,56
  } else if (texto.includes(",")) {
    // Grupos de exatamente três dígitos caracterizam separador de milhar
    // ("78,090"); qualquer outro arranjo é vírgula decimal ("99,93").
    normalizado = /^\d{1,3}(,\d{3})+$/.test(texto) ? texto.replace(/,/g, "") : texto.replace(",", ".");
  }

  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Normaliza competência para AAAAMM comparável. Necessário porque os dois
 * endpoints do e-Gestor divergem no formato: /cobertura/aps devolve "05/2026"
 * e /cobertura/acs devolve "202605".
 */
function competenciaParaNumero(bruto: unknown): number | null {
  const texto = String(bruto ?? "").trim();

  const mesAno = /^(\d{2})\/(\d{4})$/.exec(texto);
  if (mesAno) return Number(`${mesAno[2]}${mesAno[1]}`);

  return /^\d{4}(0[1-9]|1[0-2])$/.test(texto) ? Number(texto) : null;
}

/** Intervalo AAAAMM cobrindo os últimos `meses` meses até o mês corrente. */
function janelaCompetencias(meses: number): { inicio: string; fim: string } {
  const hoje = new Date();
  const anoFim = hoje.getUTCFullYear();
  const mesFim = hoje.getUTCMonth();
  // Date.UTC normaliza mês negativo virando o ano para trás sozinho.
  const inicio = new Date(Date.UTC(anoFim, mesFim - (meses - 1), 1));

  return {
    inicio: `${inicio.getUTCFullYear()}${String(inicio.getUTCMonth() + 1).padStart(2, "0")}`,
    fim: `${anoFim}${String(mesFim + 1).padStart(2, "0")}`,
  };
}

/** Valor de uma promessa cumprida; rejeição vira `FalhaColeta` e `null`. */
function valorOuFalha<T>(
  resultado: PromiseSettledResult<T>,
  fonte: string,
  falhas: FalhaColeta[],
): T | null {
  if (resultado.status === "fulfilled") return resultado.value;
  falhas.push({
    bloco: BLOCO,
    fonte,
    motivo: resultado.reason instanceof Error ? resultado.reason.message : String(resultado.reason),
  });
  return null;
}

// ---------------------------------------------------------------------------
// Fonte 1 — CNES (rede instalada)
// ---------------------------------------------------------------------------

interface EstabelecimentoCnes {
  codigo_cnes?: number | string | null;
  codigo_tipo_unidade?: number | null;
  data_atualizacao?: string | null;
}

interface RedeCnes {
  /** Estabelecimentos únicos por `codigo_cnes`. */
  total: number;
  /** Contagem por `codigo_tipo_unidade`; chave `null` = tipo não informado. */
  porCodigo: Map<number | null, number>;
  /** Ano do registro mais recente — a vintage real da base. */
  anoBase: number | null;
  /** Paginação parou no teto: as contagens estão subestimadas. */
  truncado: boolean;
}

function urlEstabelecimentos(codigo6: string, offset: number, tipoUnidade?: number): string {
  const filtroTipo = tipoUnidade === undefined ? "" : `&codigo_tipo_unidade=${tipoUnidade}`;
  return `${CNES_ESTABELECIMENTOS}?codigo_municipio=${codigo6}&limit=${CNES_LIMITE}&offset=${offset}${filtroTipo}`;
}

/**
 * Varre todos os estabelecimentos do município.
 *
 * ARMADILHA: o swagger documenta `offset` como "número da página" — é mentira.
 * `offset` é deslocamento em REGISTROS (offset=0 e offset=1 se sobrepõem em
 * 19 dos 20 itens). Paginar somando 1 colhe ~1.220 registros com 80 únicos.
 * Daí o `offset += CNES_LIMITE` e a deduplicação por `codigo_cnes`, que é
 * cinto e suspensório: se o provedor voltar a escorregar, o total continua
 * correto em vez de inflar.
 */
async function buscarRedeCnes(codigo6: string): Promise<RedeCnes> {
  const unicos = new Set<string>();
  const porCodigo = new Map<number | null, number>();
  let anoBase: number | null = null;
  let offset = 0;
  let paginas = 0;
  let completo = false;

  while (paginas < CNES_MAX_PAGINAS) {
    const resposta = await fetchJson<{ estabelecimentos?: EstabelecimentoCnes[] | null }>(
      urlEstabelecimentos(codigo6, offset),
      { timeoutMs: TIMEOUT_MS },
    );
    paginas += 1;

    const lote = resposta?.estabelecimentos ?? [];
    for (const estabelecimento of lote) {
      // Registro sem CNES é anomalia; recebe chave sintética para ser contado
      // uma vez em vez de colidir com os demais e sumir do total.
      const chave =
        estabelecimento.codigo_cnes == null
          ? `sem-cnes:${unicos.size}`
          : String(estabelecimento.codigo_cnes);
      if (unicos.has(chave)) continue;
      unicos.add(chave);

      const tipo = typeof estabelecimento.codigo_tipo_unidade === "number" ? estabelecimento.codigo_tipo_unidade : null;
      porCodigo.set(tipo, (porCodigo.get(tipo) ?? 0) + 1);

      // Ano lido direto da string ISO: `new Date` aplicaria fuso e poderia
      // recuar o carimbo um dia — e com ele o ano, na virada de 1º de janeiro.
      const carimbo = /^(\d{4})-/.exec(String(estabelecimento.data_atualizacao ?? ""));
      const ano = carimbo ? Number(carimbo[1]) : null;
      if (ano !== null && (anoBase === null || ano > anoBase)) anoBase = ano;
    }

    // A API não informa total; página incompleta é o único sinal de fim.
    if (lote.length < CNES_LIMITE) {
      completo = true;
      break;
    }
    offset += CNES_LIMITE;
  }

  return { total: unicos.size, porCodigo, anoBase, truncado: !completo };
}

interface TipoUnidade {
  codigo_tipo_unidade?: number | null;
  descricao_tipo_unidade?: string | null;
}

/**
 * Tabela de tipos de unidade. Precisa ser buscada à parte porque
 * `descricao_tipo_unidade` vem SEMPRE null dentro de /cnes/estabelecimentos —
 * lá só existe o código. Este endpoint ignora `limit`/`offset` e devolve os
 * 39 tipos de uma vez, então não há paginação a fazer.
 */
async function buscarTiposUnidade(): Promise<Map<number, string>> {
  const resposta = await fetchJson<{ tipos_unidade?: TipoUnidade[] | null }>(CNES_TIPOS_UNIDADE, {
    timeoutMs: TIMEOUT_MS,
  });

  const tabela = new Map<number, string>();
  for (const tipo of resposta?.tipos_unidade ?? []) {
    const codigo = tipo.codigo_tipo_unidade;
    const descricao = tipo.descricao_tipo_unidade;
    if (typeof codigo === "number" && typeof descricao === "string" && descricao.trim() !== "") {
      tabela.set(codigo, descricao.trim());
    }
  }
  return tabela;
}

// ---------------------------------------------------------------------------
// Fonte 2 — e-Gestor APS (cobertura)
// ---------------------------------------------------------------------------

/**
 * Cobertura mais recente publicada para o município, já embalada como
 * `Indicador`.
 *
 * O e-Gestor repete competências dentro do mesmo intervalo (202602 apareceu
 * duas vezes em ACS na verificação) e diverge de formato entre endpoints, por
 * isso não dá para confiar na ordem nem no último elemento: a escolha tem de
 * ser pelo máximo de competência normalizada.
 */
async function buscarCobertura(
  caminho: string,
  coUf: string,
  codigo6: string,
  campoValor: string,
): Promise<Indicador> {
  const { inicio, fim } = janelaCompetencias(APS_JANELA_MESES);
  const url =
    `${APS_COBERTURA}/${caminho}?unidadeGeografica=MUNICIPIO&coUf=${coUf}` +
    `&coMunicipio=${codigo6}&nuCompInicio=${inicio}&nuCompFim=${fim}`;

  const registros = await fetchJson<Array<Record<string, unknown>> | null>(url, { timeoutMs: TIMEOUT_MS });

  let melhorCompetencia: number | null = null;
  let melhorValor: number | null = null;
  for (const registro of Array.isArray(registros) ? registros : []) {
    const competencia = competenciaParaNumero(registro.nuComp);
    const valor = numero(registro[campoValor]);
    if (competencia === null || valor === null) continue;
    if (melhorCompetencia === null || competencia > melhorCompetencia) {
      melhorCompetencia = competencia;
      melhorValor = valor;
    }
  }

  // Competência mensal de base viva: nunca é exercício fechado.
  return melhorCompetencia === null
    ? semDado({ status: "em_execucao", fonte: FONTE_APS, url })
    : indicador(melhorValor, {
        ano: Math.floor(melhorCompetencia / 100),
        status: "em_execucao",
        fonte: FONTE_APS,
        url,
      });
}

// ---------------------------------------------------------------------------
// Fonte 3 — IBGE (mortalidade infantil)
// ---------------------------------------------------------------------------

interface IndicadorIbge {
  id?: number | null;
  res?: Array<{ localidade?: string | null; res?: Record<string, string | null> | null }> | null;
}

/** Média do triênio de mortalidade infantil, por mil nascidos vivos. */
const IBGE_MORTALIDADE_INFANTIL = 60033;
/**
 * Internações por diarreia. Não tem campo em `BlocoSaude`, mas viaja de graça
 * na mesma requisição por ser o outro indicador de saúde da pesquisa 10058 —
 * e serve de prova de que o município existe na pesquisa quando 60033 vem
 * vazio, o que separa "sem dado" de "código inexistente".
 */
const IBGE_INTERNACOES_DIARREIA = 60032;

interface MortalidadeIbge {
  valor: number | null;
  ano: number | null;
  url: string;
}

/**
 * Mortalidade infantil pela API JSON de indicadores do IBGE.
 *
 * Esta API usa o código de 7 DÍGITOS — o oposto do DATASUS. Nunca usar o
 * scraper de ibge.gov.br/cidades-e-estados: ele responde 403 a robôs.
 */
async function buscarMortalidadeInfantil(codigoIbge: string): Promise<MortalidadeIbge> {
  const ids = `${IBGE_MORTALIDADE_INFANTIL}%7C${IBGE_INTERNACOES_DIARREIA}`;
  const url = `${IBGE_INDICADORES}/${ids}/resultados/${codigoIbge}`;

  const payload = await fetchJson<IndicadorIbge[] | null>(url, { timeoutMs: TIMEOUT_MS });
  const indicadores = Array.isArray(payload) ? payload : [];

  const conheceMunicipio = indicadores.some((item) =>
    (item.res ?? []).some((entrada) => entrada.localidade != null),
  );
  if (!conheceMunicipio) throw new Error("município ausente na pesquisa 10058 do IBGE");

  const alvo = indicadores.find((item) => item.id === IBGE_MORTALIDADE_INFANTIL);
  let valor: number | null = null;
  let ano: number | null = null;

  for (const entrada of alvo?.res ?? []) {
    for (const [periodo, bruto] of Object.entries(entrada.res ?? {})) {
      // A chave pode ser um ano ("2024") ou um triênio ("2012-2014"); o ano de
      // referência do indicador é o último do período.
      const fim = /(\d{4})\s*$/.exec(periodo);
      const candidato = numero(bruto); // "-" e "..." caem fora aqui
      if (!fim || candidato === null) continue;

      const anoFim = Number(fim[1]);
      if (ano === null || anoFim > ano) {
        ano = anoFim;
        valor = candidato;
      }
    }
  }

  return { valor, ano, url };
}

// ---------------------------------------------------------------------------
// Coletor
// ---------------------------------------------------------------------------

export async function coletarSaude(params: {
  codigoIbge: string;
  uf: string;
  municipio: string;
}): Promise<{ bloco: BlocoSaude | null; falhas: FalhaColeta[] }> {
  const { codigoIbge } = params;

  // 6 dígitos para DATASUS/MS: com os 7 a API devolve [] e HTTP 200, o que
  // pareceria um município sem nenhuma rede de saúde instalada.
  const codigo6 = ibge6(codigoIbge);
  // A UF do e-Gestor é o código IBGE numérico (29), não a sigla — e ele são
  // justamente os dois primeiros dígitos do código do município, então sai
  // daqui sem tabela de/para de sigla.
  const coUf = codigo6.slice(0, 2);

  const falhas: FalhaColeta[] = [];

  const [resRede, resTipos, resAps, resAcs, resMortalidade] = await Promise.allSettled([
    buscarRedeCnes(codigo6),
    buscarTiposUnidade(),
    buscarCobertura("aps", coUf, codigo6, "qtCobertura"),
    buscarCobertura("acs", coUf, codigo6, "pcCoberturaAcsAb"),
    buscarMortalidadeInfantil(codigoIbge),
  ]);

  const redeBruta = valorOuFalha(resRede, `${FONTE_CNES} — estabelecimentos`, falhas);

  // Lista vazia com HTTP 200 é o modo de falha clássico desta API (filtro
  // errado, competência em migração). Nenhum município brasileiro tem rede
  // instalada zero, então isso é fonte sem resposta útil — não o achado
  // "cidade sem saúde", que é justamente o que um 0 impresso no PDF diria.
  if (redeBruta !== null && redeBruta.total === 0) {
    falhas.push({
      bloco: BLOCO,
      fonte: `${FONTE_CNES} — estabelecimentos`,
      motivo: `consulta ao município ${codigo6} respondeu sem nenhum estabelecimento; rede instalada não apurada`,
    });
  }
  const rede = redeBruta !== null && redeBruta.total > 0 ? redeBruta : null;
  const tipos = valorOuFalha(resTipos, `${FONTE_CNES} — tipos de unidade`, falhas) ?? new Map<number, string>();
  const aps = valorOuFalha(resAps, `${FONTE_APS} — cobertura APS`, falhas);
  const acs = valorOuFalha(resAcs, `${FONTE_APS} — cobertura ACS`, falhas);
  const mortalidade = valorOuFalha(resMortalidade, FONTE_IBGE, falhas);

  // Nada de útil chegou: devolver um bloco só de nulos faria o relatório
  // imprimir uma seção de saúde vazia como se fosse achado.
  if (rede === null && aps === null && acs === null && mortalidade === null) {
    return { bloco: null, falhas };
  }

  if (rede?.truncado) {
    falhas.push({
      bloco: BLOCO,
      fonte: `${FONTE_CNES} — estabelecimentos`,
      motivo: `paginação interrompida no teto de ${CNES_MAX_PAGINAS} páginas (${CNES_MAX_PAGINAS * CNES_LIMITE} registros); contagens subestimadas`,
    });
  }

  const contarTipos = (...codigos: number[]): number | null =>
    rede === null ? null : codigos.reduce((soma, codigo) => soma + (rede.porCodigo.get(codigo) ?? 0), 0);

  // A rede instalada é base viva, atualizada continuamente: nunca é exercício
  // fechado, então o status é "em_execucao" e o ano é o do registro mais
  // recente que a própria API carimbou em `data_atualizacao`.
  const indicadorCnes = (valor: number | null, tipoUnidade?: number): Indicador => {
    const url = urlEstabelecimentos(codigo6, 0, tipoUnidade);
    return rede === null || valor === null
      ? semDado({ status: "em_execucao", fonte: FONTE_CNES, url })
      : indicador(valor, { ano: rede.anoBase, status: "em_execucao", fonte: FONTE_CNES, url });
  };

  const porTipo =
    rede === null
      ? []
      : [...rede.porCodigo.entries()]
          .map(([codigo, quantidade]) => ({
            // Tipo fora da tabela vira rótulo com o código cru em vez de sumir
            // do quadro: a soma das linhas tem de bater com o total.
            tipo: codigo === null ? "NÃO INFORMADO" : (tipos.get(codigo) ?? `TIPO ${codigo}`),
            quantidade,
          }))
          // Empate resolvido pelo rótulo para o PDF sair estável entre gerações.
          .sort((a, b) => b.quantidade - a.quantidade || a.tipo.localeCompare(b.tipo, "pt-BR"));

  const bloco: BlocoSaude = {
    estabelecimentosTotal: indicadorCnes(rede?.total ?? null),
    porTipo,
    // Atenção básica é a soma das duas portas de entrada da APS: centro de
    // saúde/UBS (2) e posto de saúde (1). Não cabe URL única porque nenhum
    // filtro do CNES expressa a união de dois tipos.
    atencaoBasica: indicadorCnes(contarTipos(TIPO_CENTRO_SAUDE_UBS, TIPO_POSTO_SAUDE)),
    caps: indicadorCnes(contarTipos(TIPO_CAPS), TIPO_CAPS),
    hospitalGeral: indicadorCnes(contarTipos(TIPO_HOSPITAL_GERAL), TIPO_HOSPITAL_GERAL),
    coberturaAps: aps ?? semDado({ status: "em_execucao", fonte: FONTE_APS, url: `${APS_COBERTURA}/aps` }),
    coberturaAcs: acs ?? semDado({ status: "em_execucao", fonte: FONTE_APS, url: `${APS_COBERTURA}/acs` }),
    // Média de triênio do IBGE: baixa frequência e defasagem natural.
    mortalidadeInfantil:
      mortalidade === null || mortalidade.valor === null
        ? semDado({ status: "estrutural", fonte: FONTE_IBGE, url: mortalidade?.url ?? IBGE_INDICADORES })
        : indicador(mortalidade.valor, {
            ano: mortalidade.ano,
            status: "estrutural",
            fonte: FONTE_IBGE,
            url: mortalidade.url,
          }),
  };

  return { bloco, falhas };
}
