/**
 * Regras de avaliação do smoke test pós-deploy.
 *
 * ## Por que existe um arquivo só de regras
 *
 * O smoke test roda contra uma URL: ele emite um relatório de verdade e olha o
 * resultado. Isso é I/O — rede, Playwright, PDF — e não dá para exercitar na
 * suíte. Mas o *julgamento* ("isto passou ou não?") é decisão de negócio e
 * merece teste: separando as regras puras daqui do runner em `run.ts`, o
 * `npm test` cobre a parte que decide, e o runner fica sendo só encanamento.
 *
 * O smoke test cobre a classe de erro que a suíte de unidade é cega para: o
 * dado. As fontes são APIs públicas de governo, vivas e fora do nosso
 * controle. Uma delas mudar de layout, passar a responder 200 com corpo vazio
 * ou sair do ar não quebra nenhum teste — o relatório simplesmente sai com
 * "N/D" onde havia número, e vai para a mesa de um gestor municipal assim.
 */

export type Situacao = "ok" | "alerta" | "falha";

export interface Verificacao {
  /** Nome curto, para a linha do relatório no terminal. */
  nome: string;
  situacao: Situacao;
  /** O que foi observado, com números — não "falhou", mas "veio 39, esperava 41". */
  detalhe: string;
}

/**
 * Valores que o pipeline usa como "não sei". Zero **não** entra nesta lista de
 * propósito: em campo numérico zero costuma ser afirmação ("nenhum aluno
 * abandonou"), e cada sonda decide se zero é aceitável no seu caso. Já as
 * strings-sentinela abaixo são inequivocamente ausência: `govia-compat.ts`
 * escreve "Não informado" exatamente quando a fonte não respondeu.
 */
const SENTINELAS_DE_AUSENCIA = new Set([
  "",
  "nao informado",
  "não informado",
  "indisponivel",
  "indisponível",
  "consultar tse/divulgacand",
]);

/** Lê `a.b.c` num objeto desconhecido, sem estourar no meio do caminho. */
export function valorEmCaminho(raiz: unknown, caminho: string): unknown {
  return caminho.split(".").reduce<unknown>((atual, chave) => {
    if (atual === null || typeof atual !== "object") return undefined;
    return (atual as Record<string, unknown>)[chave];
  }, raiz);
}

/** Ausência de dado: null, undefined, array/objeto vazio ou string-sentinela. */
export function estaVazio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "string") {
    return SENTINELAS_DE_AUSENCIA.has(valor.trim().toLowerCase());
  }
  if (Array.isArray(valor)) return valor.length === 0;
  if (typeof valor === "number") return !Number.isFinite(valor);
  if (typeof valor === "object") return Object.keys(valor).length === 0;
  return false;
}

export interface SondaDeFonte {
  /** Nome da fonte viva, como o operador a conhece. */
  fonte: string;
  /** Caminho dentro do payload do levantamento. */
  caminho: string;
  /**
   * `true` quando o relatório perde o sentido sem este dado. Fonte essencial
   * vazia é falha; fonte acessória vazia é alerta — governo cai, e derrubar o
   * deploy porque o SICONFI está em manutenção seria alarme falso.
   */
  essencial: boolean;
  /** Sonda numérica que também recusa zero (matrícula zero não existe). */
  recusaZero?: boolean;
}

/**
 * As fontes que o Raio-X consome, uma sonda cada.
 *
 * Não é a lista completa das dezenas de chamadas que a geração dispara: é uma
 * por família de fonte, escolhida no campo que só existe se aquela fonte
 * respondeu de verdade. Sonda demais transforma o smoke test em teste de
 * disponibilidade do governo brasileiro.
 */
export const SONDAS_RAIO_X: SondaDeFonte[] = [
  { fonte: "IBGE — identificação", caminho: "dados_basicos.codigo_ibge", essencial: true },
  { fonte: "IBGE — população", caminho: "demografia.populacao", essencial: true, recusaZero: true },
  { fonte: "INEP — matrículas", caminho: "educacao.total_matriculas", essencial: true, recusaZero: true },
  { fonte: "INEP — escolas", caminho: "educacao.total_escolas", essencial: true, recusaZero: true },
  {
    fonte: "FNDE — receita FUNDEB",
    caminho: "fiscal.fundeb.receita.receita_total_prevista",
    essencial: true,
    recusaZero: true,
  },
  { fonte: "Catálogo de fontes", caminho: "metadata.fontes", essencial: true },
  {
    fonte: "FNDE — complementação da União",
    caminho: "fiscal.fundeb.resumo.complementacao_uniao_total",
    essencial: false,
  },
  { fonte: "SICONFI — RCL", caminho: "fiscal.siconfi.rcl", essencial: false, recusaZero: true },
  { fonte: "QEdu/INEP — IDEB anos iniciais", caminho: "educacao.ideb_anos_iniciais", essencial: false },
  { fonte: "TSE — prefeito", caminho: "prefeito", essencial: false },
  { fonte: "SICONFI — situação LRF", caminho: "fiscal.situacao_lrf", essencial: false },
];

/**
 * Fração de fontes acessórias vazias a partir da qual o alerta vira falha.
 *
 * Uma fonte fora do ar é rotina. Metade delas ao mesmo tempo não é: ou o
 * ambiente perdeu saída para a internet, ou o coletor quebrou de um jeito que
 * engole erro e devolve null. Nos dois casos o PDF sai bonito e vazio — que é
 * exatamente o que este smoke test existe para não deixar passar.
 */
export const LIMITE_DE_FONTES_VAZIAS = 0.5;

export function avaliarFontesVivas(
  payload: unknown,
  sondas: SondaDeFonte[] = SONDAS_RAIO_X,
): Verificacao[] {
  const resultados: Verificacao[] = sondas.map((sonda) => {
    const valor = valorEmCaminho(payload, sonda.caminho);
    const vazio = estaVazio(valor) || (sonda.recusaZero === true && valor === 0);
    if (!vazio) {
      return {
        nome: `fonte: ${sonda.fonte}`,
        situacao: "ok" as const,
        detalhe: `${sonda.caminho} = ${descrever(valor)}`,
      };
    }
    return {
      nome: `fonte: ${sonda.fonte}`,
      situacao: sonda.essencial ? ("falha" as const) : ("alerta" as const),
      detalhe: `${sonda.caminho} veio ${descrever(valor)} — a fonte não respondeu com dado utilizável.`,
    };
  });

  const acessorias = sondas.filter((s) => !s.essencial);
  const acessoriasVazias = resultados.filter(
    (r, i) => !sondas[i].essencial && r.situacao !== "ok",
  ).length;
  if (acessorias.length > 0 && acessoriasVazias / acessorias.length > LIMITE_DE_FONTES_VAZIAS) {
    resultados.push({
      nome: "fontes vivas: panorama",
      situacao: "falha",
      detalhe:
        `${acessoriasVazias} de ${acessorias.length} fontes acessórias vieram vazias ` +
        `(limite: ${Math.round(LIMITE_DE_FONTES_VAZIAS * 100)}%). ` +
        "Isso é queda de rede ou coletor engolindo erro, não fonte em manutenção.",
    });
  }
  return resultados;
}

function descrever(valor: unknown): string {
  if (valor === undefined) return "ausente";
  if (valor === null) return "null";
  if (Array.isArray(valor)) return `[${valor.length} item(ns)]`;
  if (typeof valor === "object") return JSON.stringify(valor).slice(0, 60);
  return String(valor);
}

export function avaliarSaude(status: number, corpo: unknown): Verificacao {
  if (status !== 200) {
    return { nome: "/api/health", situacao: "falha", detalhe: `respondeu HTTP ${status}.` };
  }
  const situacaoRelatada = valorEmCaminho(corpo, "status");
  if (situacaoRelatada !== "ok") {
    return {
      nome: "/api/health",
      situacao: "falha",
      detalhe: `respondeu 200 mas com status=${descrever(situacaoRelatada)}.`,
    };
  }
  const uptime = valorEmCaminho(corpo, "uptime");
  return {
    nome: "/api/health",
    situacao: "ok",
    detalhe: typeof uptime === "number" ? `ok, uptime ${Math.round(uptime)}s.` : "ok.",
  };
}

/**
 * Confere a contagem de folhas **no PDF entregue**, não no HTML.
 *
 * O gerador já conta `section.page` antes de imprimir e falha se o número não
 * bate. Repetir a conta aqui não é redundância: o que o gerador conta são
 * seções do DOM, e o que chega ao gestor são folhas de papel. Uma seção que
 * estoure a altura da folha vira duas páginas no PDF sem mudar a contagem de
 * seções — é a diferença entre "o template tem 41 blocos" e "o arquivo tem 41
 * páginas", e só a segunda é o que foi prometido.
 */
export function avaliarContratoDeFolhas(paginasNoPdf: number, esperadas: number): Verificacao {
  if (paginasNoPdf === esperadas) {
    return {
      nome: "contrato de folhas",
      situacao: "ok",
      detalhe: `o PDF entregue tem ${paginasNoPdf} páginas, como contratado.`,
    };
  }
  return {
    nome: "contrato de folhas",
    situacao: "falha",
    detalhe:
      `o PDF entregue tem ${paginasNoPdf} páginas; o contrato é ${esperadas}. ` +
      "O gerador conta seções do DOM, então divergência aqui significa que uma seção " +
      "estourou a folha e o navegador quebrou a página sozinho.",
  };
}

export interface PaginaAjustada {
  pagina: number;
  escala: number;
}

/**
 * Páginas que só couberam porque o auto-ajuste as encolheu.
 *
 * `assertSemCorte` roda no servidor e é o que impede conteúdo de sumir — mas
 * ele roda *depois* de `ajustarParaCaber`, que reduz o zoom até 88% para
 * salvar a página. Quem foi salvo assim não gera erro, não gera aviso e não
 * aparece em lugar nenhum: só num `console.info` que ninguém lê. É alerta, não
 * falha, porque o conteúdo está lá — mas é o aviso de que a folha está no
 * limite e o próximo município maior perde texto.
 */
export function avaliarAjusteDeEscala(ajustadas: PaginaAjustada[]): Verificacao {
  if (ajustadas.length === 0) {
    return {
      nome: "folgas do template",
      situacao: "ok",
      detalhe: "nenhuma página precisou ser encolhida para caber.",
    };
  }
  const detalhe = ajustadas
    .map((a) => `p${a.pagina} a ${Math.round(a.escala * 100)}%`)
    .join(", ");
  return {
    nome: "folgas do template",
    situacao: "alerta",
    detalhe:
      `${ajustadas.length} página(s) só couberam encolhidas (${detalhe}). ` +
      "O conteúdo está no PDF, mas a folha está no limite: num município maior o excesso some.",
  };
}

export interface Resumo {
  situacao: Situacao;
  oks: number;
  alertas: number;
  falhas: number;
  /** 0 quando passou (mesmo com alerta), 1 quando alguma verificação falhou. */
  codigoDeSaida: number;
}

/**
 * Alerta não derruba o deploy. A decisão é deliberada: o smoke test roda depois
 * do deploy, e reverter produção porque o TSE está lento seria pior que o
 * problema. Só falha — relatório que não gerou, folha que não bate, fonte
 * essencial muda — vale a reversão.
 */
export function resumir(verificacoes: Verificacao[]): Resumo {
  const falhas = verificacoes.filter((v) => v.situacao === "falha").length;
  const alertas = verificacoes.filter((v) => v.situacao === "alerta").length;
  const oks = verificacoes.filter((v) => v.situacao === "ok").length;
  const situacao: Situacao = falhas > 0 ? "falha" : alertas > 0 ? "alerta" : "ok";
  return { situacao, oks, alertas, falhas, codigoDeSaida: falhas > 0 ? 1 : 0 };
}

/** URL do serviço em produção — o smoke test se recusa a tocá-la sem consentimento. */
export const URL_DE_PRODUCAO = "https://sync-app-n7cfomhaaq-uc.a.run.app";

/**
 * Gerar um Raio-X dispara dezenas de chamadas a APIs públicas de governo. Fazer
 * isso contra produção por engano — num loop de CI, digamos — é abusar de fonte
 * alheia e ainda poluir a carteira de municípios acessados. Por isso é opt-in
 * explícito.
 */
export function exigeConsentimentoDeProducao(url: string, permitido: boolean): string | null {
  const alvo = url.replace(/\/+$/, "").toLowerCase();
  if (!alvo.startsWith(URL_DE_PRODUCAO.toLowerCase())) return null;
  if (permitido) return null;
  return (
    `Recusando rodar contra produção (${URL_DE_PRODUCAO}) sem consentimento explícito. ` +
    "A geração de um Raio-X dispara dezenas de chamadas a APIs públicas de governo. " +
    "Se é mesmo isso que você quer, repita com --producao."
  );
}
