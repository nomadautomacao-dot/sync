/**
 * Log estruturado para o Cloud Logging / Error Reporting.
 *
 * ## Por que
 *
 * O serviço roda no Cloud Run, e o Cloud Run captura stdout/stderr. Uma linha
 * solta de `console.error("[Raio-X] Erro:", error)` chega lá como texto: vira
 * uma entrada de log com severidade `DEFAULT`, sem stack navegável, sem
 * agrupamento, sem contador. Ninguém é avisado, ninguém sabe quantas vezes
 * aconteceu, e achar o evento depois exige saber a string exata para procurar.
 *
 * O Error Reporting já está ligado por padrão em todo projeto GCP — não precisa
 * de conta em serviço de terceiro, nem de chave, nem de SDK. Ele só precisa que
 * o log saia em **JSON numa linha só** com dois atributos: `severity: "ERROR"`
 * e o marcador `@type` de `ReportedErrorEvent`. Com isso o evento passa a ser
 * agrupado por assinatura de stack, contado, e alertável.
 *
 * É o mínimo que funciona, e é de propósito: a alternativa era instrumentar o
 * projeto com um SDK e mais uma dependência para obter o mesmo agrupamento que
 * a plataforma já dá de graça.
 */

export type Severidade = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

/**
 * Marcador que faz o Cloud Logging encaminhar a entrada ao Error Reporting.
 * Sem ele, um log de severidade ERROR fica só no Logging.
 */
const TIPO_ERRO_REPORTADO =
  "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent";

export interface ContextoDeLog {
  [chave: string]: unknown;
}

/**
 * Parâmetros de URL cujo valor nunca deve ir para o log.
 *
 * Não é paranoia genérica: `qedu-api.ts` monta URL com `QEDU_TOKEN`, e um
 * `fetch` que falha costuma trazer a URL inteira na mensagem do erro. Sem esta
 * limpeza, o token vaza para o Cloud Logging na primeira instabilidade do QEdu
 * — e log é justamente o lugar de onde segredo não sai mais.
 */
const PARAMETROS_SENSIVEIS = /\b(token|key|apikey|api_key|secret|password|senha|access_token|authorization)=([^&\s"']+)/gi;

export function limparSegredos(texto: string): string {
  return texto.replace(PARAMETROS_SENSIVEIS, (_todo, chave: string) => `${chave}=[REDIGIDO]`);
}

/**
 * `JSON.stringify` que não derruba o log.
 *
 * Um logger que estoura ao serializar o contexto é pior que não ter logger:
 * some a mensagem *e* o erro original. Referência circular e `BigInt` são os
 * dois casos que aparecem na prática.
 */
function serializarSeguro(valor: unknown): string {
  const vistos = new WeakSet<object>();
  try {
    return JSON.stringify(valor, (_chave, v: unknown) => {
      if (typeof v === "bigint") return v.toString();
      if (typeof v === "object" && v !== null) {
        if (vistos.has(v)) return "[circular]";
        vistos.add(v);
      }
      return v;
    });
  } catch {
    return JSON.stringify({ severity: "ERROR", message: "Falha ao serializar entrada de log." });
  }
}

/**
 * Extrai nome, mensagem e stack de qualquer coisa lançada. `throw "string"` e
 * `throw { code: 500 }` são legais em JS e acontecem em bibliotecas.
 */
function descreverErro(erro: unknown): { nome: string; mensagem: string; stack: string } {
  if (erro instanceof Error) {
    return {
      nome: erro.name,
      mensagem: erro.message,
      // Sem stack (acontece com erros forjados), a mensagem serve de assinatura
      // — o Error Reporting precisa de *algum* texto para agrupar.
      stack: erro.stack ?? `${erro.name}: ${erro.message}`,
    };
  }
  const texto = typeof erro === "string" ? erro : serializarSeguro(erro);
  return { nome: "NonError", mensagem: texto, stack: `NonError: ${texto}` };
}

export interface EntradaDeLog {
  severity: Severidade;
  message: string;
  escopo: string;
  [chave: string]: unknown;
}

/**
 * Monta a entrada. Separada da escrita para poder ser testada — o formato é o
 * contrato com o Error Reporting, e um campo errado aqui significa erro que
 * não aparece em lugar nenhum, que é o problema que este arquivo resolve.
 */
export function montarEntrada(
  severity: Severidade,
  escopo: string,
  mensagemOuErro: unknown,
  contexto: ContextoDeLog = {},
): EntradaDeLog {
  const ehErro = severity === "ERROR" || severity === "CRITICAL";
  const contextoLimpo = limparContexto(contexto);

  if (!ehErro) {
    return {
      severity,
      message: limparSegredos(
        typeof mensagemOuErro === "string" ? mensagemOuErro : serializarSeguro(mensagemOuErro),
      ),
      escopo,
      ...contextoLimpo,
    };
  }

  const { nome, mensagem, stack } = descreverErro(mensagemOuErro);
  return {
    severity,
    // O Error Reporting agrupa pela stack contida em `message`. Prefixar o
    // escopo faz o evento ser localizável por rota sem abrir o detalhe.
    message: limparSegredos(`[${escopo}] ${stack}`),
    "@type": TIPO_ERRO_REPORTADO,
    escopo,
    erro: { nome, mensagem: limparSegredos(mensagem) },
    ...contextoLimpo,
  };
}

function limparContexto(contexto: ContextoDeLog): ContextoDeLog {
  const saida: ContextoDeLog = {};
  for (const [chave, valor] of Object.entries(contexto)) {
    // `severity`, `message` e `@type` são do protocolo; contexto não os
    // sobrescreve, senão um campo de negócio chamado "message" apaga a stack.
    if (chave === "severity" || chave === "message" || chave === "@type") continue;
    saida[chave] = typeof valor === "string" ? limparSegredos(valor) : valor;
  }
  return saida;
}

/**
 * Em desenvolvimento, JSON numa linha só atrapalha quem está olhando o
 * terminal. O formato estruturado só serve ao Cloud Logging, então só sai
 * quando há Cloud Logging para consumi-lo.
 */
function emProducao(): boolean {
  return process.env.NODE_ENV === "production";
}

function escrever(entrada: EntradaDeLog): void {
  if (emProducao()) {
    // stderr: é o que o Cloud Run encaminha, e mantém o log de erro fora do
    // fluxo normal de stdout.
    console.error(serializarSeguro(entrada));
    return;
  }
  const { severity, escopo, message, ...resto } = entrada;
  const extras = Object.keys(resto).filter((k) => k !== "@type" && k !== "erro");
  console.error(
    `[${severity}] [${escopo}] ${message}` +
      (extras.length > 0 ? `\n  contexto: ${serializarSeguro(pick(resto, extras))}` : ""),
  );
}

function pick(objeto: Record<string, unknown>, chaves: string[]): Record<string, unknown> {
  return Object.fromEntries(chaves.map((c) => [c, objeto[c]]));
}

/**
 * Registra um erro de forma que o Error Reporting o agrupe, conte e permita
 * alertar. `escopo` é o rótulo da origem — use o mesmo prefixo que já estava
 * no `console.error` (ex.: "Raio-X municipal"), para não perder a história.
 *
 * O `contexto` vai para campos próprios da entrada, pesquisáveis no Logs
 * Explorer (`jsonPayload.codigoIbge="2703106"`). Não coloque aqui segredo nem
 * dado pessoal: log é o lugar de onde a informação não sai mais.
 */
export function registrarErro(escopo: string, erro: unknown, contexto?: ContextoDeLog): void {
  escrever(montarEntrada("ERROR", escopo, erro, contexto));
}

/** Situação anômala que não interrompeu a entrega — degradação, fonte fora do ar. */
export function registrarAlerta(escopo: string, mensagem: string, contexto?: ContextoDeLog): void {
  escrever(montarEntrada("WARNING", escopo, mensagem, contexto));
}

/** Evento normal que vale contar em produção (ex.: páginas ajustadas para caber). */
export function registrarInfo(escopo: string, mensagem: string, contexto?: ContextoDeLog): void {
  escrever(montarEntrada("INFO", escopo, mensagem, contexto));
}
