/**
 * Bloco Conformidade Educacional — os dois pisos legais que reprovam as contas
 * do prefeito no TCM:
 *
 *  - MDE: mínimo de 25% da receita resultante de impostos aplicado em
 *    Manutenção e Desenvolvimento do Ensino (CF, art. 212);
 *  - FUNDEB: mínimo de 70% em remuneração dos profissionais da educação
 *    básica (CF, art. 212-A, XI; Lei 14.113/2020).
 *
 * De onde NÃO vem o dado
 * ----------------------
 * O caminho óbvio seria o RREO Anexo 8 no SICONFI. Ele não existe lá. A API
 * `apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo` devolve lista vazia para
 * `no_anexo=RREO-Anexo 08` em qualquer exercício e bimestre; consultando sem
 * filtro de anexo (resposta completa, `hasMore:false`) os anexos entregues são
 * 01, 02, 03, 04, 06, 07, 09, 10, 11, 13 e 14 — nunca o 08 (MDE) nem o 12
 * (Saúde). Não é lacuna do município: São Paulo e Salvador têm o mesmo
 * conjunto. MDE e Saúde são declarados a SIOPE e SIOPS, não ao SICONFI.
 *
 * Derivar MDE da DCA também foi descartado: a função 12 do orçamento não é a
 * base constitucional (exclui inativos, merenda e programas suplementares, e
 * inclui o resultado líquido das transferências ao FUNDEB e as deduções de
 * superávit). O número sairia errado com aparência de rigor.
 *
 * De onde vem
 * -----------
 * 1. `relatorioGerencialIndicador.do` — backend JSON dos Relatórios Gerenciais
 *    do SIOPE. É o único endpoint público do SIOPE sem reCAPTCHA (todos os
 *    relatórios em HTML exigem token). Devolve os indicadores já apurados pelo
 *    FNDE, que são os mesmos que o TCM lê. Fonte primária deste bloco.
 * 2. RREO Anexo 8 gerado pelo próprio SIOPE, publicado em PDF no FTP anônimo do
 *    FNDE. Enriquecimento opcional: só ele traz as parcelas monetárias do
 *    FUNDEB, que nenhum indicador da API expõe (o catálogo de indicadores foi
 *    enumerado por força bruta, códigos 1..130).
 *
 * Toda parcela vinda do PDF é conferida contra o percentual publicado antes de
 * entrar no bloco. Parcela que não reproduz o percentual é descartada: um
 * número que não fecha na frente do cliente é pior que ausência.
 */

import net from "node:net";

import {
  FUNDEB_MINIMO_REMUNERACAO,
  MDE_MINIMO_CONSTITUCIONAL,
  fetchJson,
  ibge6,
  indicador,
  percentual,
  semDado,
  type BlocoConformidadeEducacional,
  type FalhaColeta,
  type Indicador,
  type StatusDado,
} from "./types";

const BLOCO = "conformidadeEducacional";

const FONTE_INDICADORES = "SIOPE/FNDE — Indicadores Financeiros e Educacionais";
const URL_INDICADORES = "https://www.fnde.gov.br/siope/indicadoresFinanceirosEEducacionais.do";
const ENDPOINT_INDICADORES = "https://www.fnde.gov.br/siope/relatorioGerencialIndicador.do?metodo=relatorio";

const FONTE_RREO = "SIOPE/FNDE — RREO Anexo 8 (MDE), 6º bimestre";
const URL_RREO = "https://www.fnde.gov.br/siope/relatorioRREOMunicipal2006.do";
const FTP_HOST = "ftp.fnde.gov.br";

const TIMEOUT_API_MS = 15_000;
const TIMEOUT_FTP_MS = 20_000;

/** Quantos exercícios voltar procurando o último 6º bimestre declarado. */
const EXERCICIOS_RETROATIVOS = 3;

/**
 * Só o 6º bimestre fecha o exercício. Os parciais não servem: em 2025 o 1º
 * bimestre de Serra do Ramalho apurava -33,05% de MDE, porque o numerador
 * acumula despesa enquanto o denominador já contabilizou a transferência ao
 * FUNDEB.
 */
const BIMESTRE_FECHAMENTO = 6;

/** `coEsferaAdm` do SIOPE: 1 = estado/DF, 2 = município. */
const ESFERA_MUNICIPAL = 2;

// Códigos dos indicadores no catálogo do SIOPE (campo `codIndi`).
const INDI_MDE_PERCENTUAL = 24; // codExib 1.1
const INDI_FUNDEB_REMUNERACAO_PERCENTUAL = 67; // codExib 1.2
const INDI_MDE_VALOR_EXIGIDO = 93; // codExib 8.1
const INDI_MDE_VALOR_APLICADO = 94; // codExib 8.2

interface ItemIndicador {
  codIndi?: number;
  codExib?: string;
  numAno?: number;
  valIndi?: number;
}

interface RespostaIndicadores {
  status?: boolean;
  message?: string;
  content?: ItemIndicador[];
}

// ---------------------------------------------------------------------------
// SIOPE — API dos Relatórios Gerenciais
// ---------------------------------------------------------------------------

/**
 * O endpoint agrega o que o filtro selecionar. `codMuni` vazio devolve a média
 * da UF (Bahia inteira apurou 27,18% de MDE em 2024, contra 25,02% de Serra do
 * Ramalho) — passar um município inexistente por engano não cai nesse
 * agregado, devolve lista vazia, mas montar o filtro errado cairia. Por isso
 * `codMuni` é sempre preenchido e sempre com 6 dígitos: o código de 7 dígitos
 * não casa com nada e devolve `[]` silenciosamente.
 */
async function lerIndicadores(codigoIbge6: string, exercicio: number, codigos: number[]) {
  const filtro = {
    sgRegiao: [],
    codUF: [Number(codigoIbge6.slice(0, 2))],
    coMesoregiaoIbge: [],
    coMicroregiaoIbge: [],
    codMuni: [Number(codigoIbge6)],
    codFaixaPopulacao: 0,
    tpPeriodo: "B",
    numAno: [exercicio],
    numPeri: [BIMESTRE_FECHAMENTO],
    codGrupIndi: 1,
    indicadores: codigos,
    coEsferaAdm: ESFERA_MUNICIPAL,
    gerarGraficoComMedia: false,
  };

  const resposta = await fetchJson<RespostaIndicadores>(ENDPOINT_INDICADORES, {
    timeoutMs: TIMEOUT_API_MS,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(filtro),
    },
  });

  // O ORDS do FNDE responde 200 mesmo quando recusa o filtro; a recusa vem em
  // `status: false`. Sem isso, filtro malformado viraria "exercício sem dado".
  if (resposta.status === false) {
    throw new Error(resposta.message?.trim() || "SIOPE recusou a consulta sem detalhar o motivo");
  }

  const valores = new Map<number, number>();
  for (const item of resposta.content ?? []) {
    if (typeof item.codIndi === "number" && typeof item.valIndi === "number") {
      valores.set(item.codIndi, item.valIndi);
    }
  }
  return valores;
}

// ---------------------------------------------------------------------------
// FTP anônimo do FNDE
// ---------------------------------------------------------------------------

/**
 * O PDF do RREO Anexo 8 só é servido por FTP. Em HTTP o mesmo host responde
 * 401 (realm "SIOPE") e o `www.fnde.gov.br` responde 404 em todos os prefixos
 * testados. Como não há cliente FTP no projeto e a dependência não se
 * justifica para um único arquivo, o mínimo do RFC 959 (login anônimo, modo
 * passivo, transferência binária) está aqui.
 */
class ControleFtp {
  private texto = "";
  private readonly prontas: string[] = [];
  private readonly pendentes: Array<{ resolve: (v: string) => void; reject: (e: Error) => void }> = [];

  constructor(private readonly socket: net.Socket) {
    socket.setEncoding("latin1");
    socket.on("data", (pedaco: string) => {
      this.texto += pedaco;
      // Resposta termina na primeira linha "NNN <texto>"; "NNN-" é continuação
      // (o FNDE manda saudação multilinha).
      for (;;) {
        const fim = /^\d{3} [^\r\n]*\r\n/m.exec(this.texto);
        if (!fim) return;
        const corte = fim.index + fim[0].length;
        const resposta = this.texto.slice(0, corte);
        this.texto = this.texto.slice(corte);
        const pendente = this.pendentes.shift();
        // O 226 de fim de transferência costuma chegar antes de alguém
        // esperá-lo; enfileirar evita travar o RETR.
        if (pendente) pendente.resolve(resposta);
        else this.prontas.push(resposta);
      }
    });
    const abortar = (erro: Error) => {
      while (this.pendentes.length) this.pendentes.shift()?.reject(erro);
    };
    socket.on("error", abortar);
    socket.on("timeout", () => abortar(new Error("tempo esgotado na conexão de controle FTP")));
    socket.on("close", () => abortar(new Error("conexão de controle FTP fechada pelo servidor")));
  }

  esperar(): Promise<string> {
    const pronta = this.prontas.shift();
    if (pronta !== undefined) return Promise.resolve(pronta);
    const { promise, resolve, reject } = Promise.withResolvers<string>();
    this.pendentes.push({ resolve, reject });
    return promise;
  }

  enviar(comando: string): Promise<string> {
    this.socket.write(`${comando}\r\n`, "latin1");
    return this.esperar();
  }
}

function conectar(host: string, porta: number, timeoutMs: number): Promise<net.Socket> {
  const { promise, resolve, reject } = Promise.withResolvers<net.Socket>();
  const socket = net.createConnection({ host, port: porta });
  socket.setTimeout(timeoutMs);
  socket.once("connect", () => resolve(socket));
  socket.once("timeout", () => {
    socket.destroy();
    reject(new Error(`tempo esgotado conectando ${host}:${porta}`));
  });
  socket.once("error", reject);
  return promise;
}

async function baixarPorFtpAnonimo(caminho: string, timeoutMs: number): Promise<Buffer> {
  const controleSocket = await conectar(FTP_HOST, 21, timeoutMs);
  const controle = new ControleFtp(controleSocket);

  try {
    let resposta = await controle.esperar();
    if (!resposta.startsWith("220")) throw new Error(`saudação FTP inesperada: ${resposta.trim()}`);

    resposta = await controle.enviar("USER anonymous");
    if (resposta.startsWith("331")) resposta = await controle.enviar("PASS anonymous@");
    if (!resposta.startsWith("230")) throw new Error(`login anônimo recusado: ${resposta.trim()}`);

    resposta = await controle.enviar("TYPE I");
    if (!resposta.startsWith("200")) throw new Error(`TYPE I recusado: ${resposta.trim()}`);

    resposta = await controle.enviar("PASV");
    const pasv = /\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/.exec(resposta);
    if (!pasv) throw new Error(`PASV recusado: ${resposta.trim()}`);

    const dados = await conectar(
      `${pasv[1]}.${pasv[2]}.${pasv[3]}.${pasv[4]}`,
      Number(pasv[5]) * 256 + Number(pasv[6]),
      timeoutMs,
    );

    // O canal de dados precisa estar escutando ANTES do RETR: o servidor
    // começa a enviar junto com o 150.
    const { promise: transferido, resolve: concluir, reject: abortar } = Promise.withResolvers<void>();
    const pedacos: Buffer[] = [];
    dados.on("data", (pedaco: Buffer) => pedacos.push(pedaco));
    dados.once("end", () => concluir());
    dados.once("timeout", () => {
      dados.destroy();
      abortar(new Error("tempo esgotado no canal de dados FTP"));
    });
    dados.once("error", abortar);
    // Um RETR recusado (550) sai por exceção sem ninguém aguardar `transferido`.
    // Sem este handler, o destroy subsequente viraria unhandled rejection.
    transferido.catch(() => {});

    try {
      resposta = await controle.enviar(`RETR ${caminho}`);
      if (!resposta.startsWith("150") && !resposta.startsWith("125")) {
        throw new Error(`RETR recusado: ${resposta.trim()}`);
      }
      await transferido;
    } finally {
      dados.destroy();
    }

    const conclusao = await controle.esperar();
    if (!conclusao.startsWith("226") && !conclusao.startsWith("250")) {
      throw new Error(`transferência incompleta: ${conclusao.trim()}`);
    }

    return Buffer.concat(pedacos);
  } finally {
    controleSocket.destroy();
  }
}

// ---------------------------------------------------------------------------
// RREO Anexo 8 — extração das parcelas
// ---------------------------------------------------------------------------

/** Valor monetário do demonstrativo: `1.234.567,89`, eventualmente negativo. */
const MOEDA = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;

interface ParcelasRreo {
  /** Linha 3 — TOTAL DA RECEITA RESULTANTE DE IMPOSTOS, realizada. */
  receitaImpostos: number;
  /** Linha 6 menos linha 6.4 — base do mínimo de 70%. */
  fundebBase70: number;
  /** Linha 15, coluna "valor exigido" — exatamente 70% da base, à vista. */
  fundebValorExigido: number;
  /** Linha 15, coluna "valor considerado após deduções". */
  fundebRemuneracao: number;
  /** Linha 15, coluna "% aplicado" — usado para conferir as duas parcelas. */
  percentualRemuneracao: number;
}

function extrairParcelasRreo(texto: string): ParcelasRreo {
  const linhas = texto
    .split(/\r?\n/)
    .map((linha) => linha.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const numeros = (linha: string | undefined) =>
    (linha?.match(MOEDA) ?? []).map((token) => Number(token.replace(/\./g, "").replace(",", ".")));

  // Colunas: previsão atualizada, realizada até o bimestre. Sempre a última.
  const linha3 = numeros(linhas.find((linha) => linha.startsWith("3- TOTAL DA RECEITA RESULTANTE DE IMPOSTOS")));
  const linha6 = numeros(linhas.find((linha) => linha.startsWith("6- TOTAL DAS RECEITAS DO FUNDEB RECEBIDAS")));
  const linha64 = numeros(linhas.find((linha) => linha.startsWith("6.4- FUNDEB")));

  /*
   * A linha 15 quebra em duas no PDF: o rótulo "15- MÍNIMO DE 70% ..." fica
   * sozinho e os quatro números caem na continuação "DOS PROFISSIONAIS DA
   * EDUCAÇÃO BÁSICA <exigido> <aplicado> <considerado> <%>".
   */
  const linha15 = numeros(
    linhas.find((linha) => /^DOS PROFISSIONAIS DA EDUCA[ÇC][ÃA]O B[ÁA]SICA /.test(linha)),
  );

  if (linha3.length < 2) throw new Error("linha 3 (receita resultante de impostos) não localizada");
  if (linha6.length < 2) throw new Error("linha 6 (receitas do FUNDEB recebidas) não localizada");
  if (linha64.length < 2) throw new Error("linha 6.4 (complementação VAAR) não localizada");
  if (linha15.length !== 4) throw new Error("linha 15 (mínimo de 70% na remuneração) não localizada");

  /*
   * A complementação VAAR é premiação condicionada a resultado e fica fora da
   * base dos 70% (Lei 14.113/2020, art. 27). Em Senhor do Bonfim/2024 os
   * R$ 804.099,28 de VAAR são exatamente a diferença entre a linha 6
   * (R$ 92.904.557,34) e a base que o FNDE usou (R$ 92.100.458,06): dividir
   * pela linha 6 daria 72,04% no lugar dos 72,67% publicados.
   */
  return {
    receitaImpostos: linha3[linha3.length - 1],
    fundebBase70: linha6[linha6.length - 1] - linha64[linha64.length - 1],
    fundebValorExigido: linha15[0],
    fundebRemuneracao: linha15[2],
    percentualRemuneracao: linha15[3],
  };
}

async function lerRreoAnexo8(codigoIbge6: string, exercicio: number): Promise<ParcelasRreo> {
  const caminho = `/web/siope/RREO/RREO_Municipal_${codigoIbge6}_${BIMESTRE_FECHAMENTO}_${exercicio}.pdf`;
  const pdf = await baixarPorFtpAnonimo(caminho, TIMEOUT_FTP_MS);
  if (!pdf.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
    throw new Error(`resposta do FTP não é PDF (${pdf.length} bytes)`);
  }

  /*
   * `pdf-parse` puxa `DOMMatrix` e quebra a análise estática do Next.js em
   * runtime serverless; o projeto já contorna isso em `fundeb-fnde.ts` com o
   * mesmo require tardio.
   */
  const requireTardio = eval("require") as NodeRequire;
  const modulo: unknown = requireTardio("pdf-parse");
  const { PDFParse } = modulo as {
    PDFParse: new (opcoes: { data: Buffer }) => {
      getText(): Promise<{ text: string }>;
      destroy(): Promise<void>;
    };
  };

  const leitor = new PDFParse({ data: pdf });
  try {
    const { text } = await leitor.getText();
    return extrairParcelasRreo(text);
  } finally {
    await leitor.destroy();
  }
}

// ---------------------------------------------------------------------------
// Montagem do bloco
// ---------------------------------------------------------------------------

function descreverErro(erro: unknown): string {
  if (!(erro instanceof Error)) return String(erro);
  if (erro.name === "AbortError" || erro.name === "TimeoutError") {
    return `tempo esgotado após ${TIMEOUT_API_MS} ms`;
  }
  // O undici resume qualquer queda de rede como "fetch failed" e esconde a
  // razão real em `cause`.
  const causa: unknown = erro.cause;
  if (causa instanceof Error && causa.message) return `${erro.message}: ${causa.message}`;
  return erro.message || erro.name;
}

export async function coletarConformidadeEducacional(params: {
  codigoIbge: string;
  uf: string;
  municipio: string;
}): Promise<{ bloco: BlocoConformidadeEducacional | null; falhas: FalhaColeta[] }> {
  const falhas: FalhaColeta[] = [];
  const codigo = ibge6(params.codigoIbge);

  if (codigo.length !== 6) {
    falhas.push({
      bloco: BLOCO,
      fonte: FONTE_INDICADORES,
      motivo: `código IBGE inválido: "${params.codigoIbge}" (esperado ao menos 6 dígitos)`,
    });
    return { bloco: null, falhas };
  }

  const anoCorrente = new Date().getFullYear();
  const candidatos = Array.from({ length: EXERCICIOS_RETROATIVOS + 1 }, (_, i) => anoCorrente - i);
  const codigos = [
    INDI_MDE_PERCENTUAL,
    INDI_FUNDEB_REMUNERACAO_PERCENTUAL,
    INDI_MDE_VALOR_EXIGIDO,
    INDI_MDE_VALOR_APLICADO,
  ];

  const tentativas = await Promise.allSettled(
    candidatos.map((ano) => lerIndicadores(codigo, ano, codigos)),
  );

  /*
   * Vale o exercício mais recente já declarado. Exercício não transmitido
   * devolve lista vazia — e um MDE de 0,00% seria declaração em branco, não
   * município que aplicou nada: a própria transferência ao FUNDEB (20% dos
   * impostos) já entra no numerador do art. 212, então zero é impossível.
   */
  let exercicio: number | null = null;
  let valores = new Map<number, number>();
  for (let i = 0; i < candidatos.length; i += 1) {
    const tentativa = tentativas[i];
    if (tentativa.status === "rejected") {
      falhas.push({
        bloco: BLOCO,
        fonte: `${FONTE_INDICADORES} (${candidatos[i]})`,
        motivo: descreverErro(tentativa.reason),
      });
      continue;
    }
    const mde = tentativa.value.get(INDI_MDE_PERCENTUAL);
    if (exercicio === null && typeof mde === "number" && mde !== 0) {
      exercicio = candidatos[i];
      valores = tentativa.value;
    }
  }

  if (exercicio === null) {
    falhas.push({
      bloco: BLOCO,
      fonte: FONTE_INDICADORES,
      motivo: `SIOPE não tem 6º bimestre apurado para ${params.municipio}/${params.uf} entre ${candidatos[candidatos.length - 1]} e ${anoCorrente}`,
    });
    return { bloco: null, falhas };
  }

  // O 6º bimestre só é apurado depois do encerramento do exercício; enquanto o
  // ano de referência é o corrente, o que existe é execução em curso.
  const status: StatusDado = exercicio < anoCorrente ? "fechado" : "em_execucao";
  const metaIndicadores = { ano: exercicio, status, fonte: FONTE_INDICADORES, url: URL_INDICADORES };

  const mdePercentual = valores.get(INDI_MDE_PERCENTUAL) ?? null;
  const fundebPercentual = valores.get(INDI_FUNDEB_REMUNERACAO_PERCENTUAL) ?? null;
  const mdeValorExigido = valores.get(INDI_MDE_VALOR_EXIGIDO) ?? null;
  const mdeValorAplicado = valores.get(INDI_MDE_VALOR_APLICADO) ?? null;

  if (fundebPercentual === null || fundebPercentual === 0) {
    falhas.push({
      bloco: BLOCO,
      fonte: FONTE_INDICADORES,
      motivo: `indicador 1.2 (FUNDEB em remuneração) ausente ou zerado no 6º bimestre/${exercicio}`,
    });
  }

  /*
   * O indicador 8.1 é o valor exigido pelo art. 212, ou seja, 25% da receita
   * resultante de impostos. Multiplicar de volta recupera a base — conferido
   * contra a linha 3 do RREO Anexo 8 mais abaixo.
   */
  const receitaImpostos =
    mdeValorExigido === null ? null : (mdeValorExigido * 100) / MDE_MINIMO_CONSTITUCIONAL;

  // As parcelas do FUNDEB não existem em nenhum indicador da API; só no PDF.
  let parcelas: ParcelasRreo | null = null;
  try {
    parcelas = await lerRreoAnexo8(codigo, exercicio);
  } catch (erro) {
    falhas.push({
      bloco: BLOCO,
      fonte: FONTE_RREO,
      motivo: `parcelas do FUNDEB indisponíveis: ${descreverErro(erro)}`,
    });
  }

  if (parcelas) {
    /*
     * A parcela só entra se refizer a conta publicada. Três travas: o
     * percentual reconstruído bate com o do SIOPE, a linha 15 imprime esse
     * mesmo percentual, e a base sustenta o valor exigido — este último é o
     * teste real da exclusão do VAAR, porque o "valor exigido" impresso é 70%
     * da base ao centavo, sem o arredondamento de duas casas do percentual.
     */
    const reconstruido =
      fundebPercentual === null ? null : percentual(parcelas.fundebRemuneracao, parcelas.fundebBase70);
    const exigidoEsperado = (parcelas.fundebBase70 * FUNDEB_MINIMO_REMUNERACAO) / 100;
    const diverge =
      fundebPercentual === null ||
      reconstruido === null ||
      Math.abs(reconstruido - fundebPercentual) > 0.01 ||
      Math.abs(parcelas.percentualRemuneracao - fundebPercentual) > 0.01 ||
      Math.abs(parcelas.fundebValorExigido - exigidoEsperado) > 0.01;

    if (diverge) {
      falhas.push({
        bloco: BLOCO,
        fonte: FONTE_RREO,
        motivo: `parcelas do FUNDEB descartadas: ${parcelas.fundebRemuneracao.toFixed(2)} / ${parcelas.fundebBase70.toFixed(2)} = ${reconstruido ?? "—"}%, contra ${fundebPercentual ?? "—"}% publicado e valor exigido de ${parcelas.fundebValorExigido.toFixed(2)} (esperado ${exigidoEsperado.toFixed(2)})`,
      });
      parcelas = null;
    }
  }

  if (parcelas && receitaImpostos !== null && Math.abs(parcelas.receitaImpostos - receitaImpostos) > 1) {
    // Divergência acima de R$ 1,00 entre o indicador 8.1 e a linha 3 significa
    // que os dois relatórios do FNDE saíram de declarações diferentes.
    falhas.push({
      bloco: BLOCO,
      fonte: FONTE_RREO,
      motivo: `receita de impostos diverge: indicador 8.1 aponta ${receitaImpostos.toFixed(2)} e a linha 3 do RREO ${parcelas.receitaImpostos.toFixed(2)}`,
    });
  }

  const metaRreo = { ano: exercicio, status, fonte: FONTE_RREO, url: URL_RREO };
  const semParcelaFundeb: Indicador = semDado({ status, fonte: FONTE_RREO, url: URL_RREO });

  const bloco: BlocoConformidadeEducacional = {
    exercicio,
    mdeAplicado:
      mdePercentual === null
        ? semDado({ status, fonte: FONTE_INDICADORES, url: URL_INDICADORES })
        : indicador(mdePercentual, metaIndicadores),
    fundebRemuneracao:
      fundebPercentual === null || fundebPercentual === 0
        ? semDado({ status, fonte: FONTE_INDICADORES, url: URL_INDICADORES })
        : indicador(fundebPercentual, metaIndicadores),
    receitaImpostos:
      receitaImpostos === null
        ? semDado({ status, fonte: FONTE_INDICADORES, url: URL_INDICADORES })
        : indicador(Math.round(receitaImpostos * 100) / 100, metaIndicadores),
    despesaMde:
      mdeValorAplicado === null
        ? semDado({ status, fonte: FONTE_INDICADORES, url: URL_INDICADORES })
        : indicador(mdeValorAplicado, metaIndicadores),
    fundebRecebido: parcelas ? indicador(parcelas.fundebBase70, metaRreo) : semParcelaFundeb,
    fundebRemuneracaoValor: parcelas ? indicador(parcelas.fundebRemuneracao, metaRreo) : semParcelaFundeb,
  };

  return { bloco, falhas };
}
