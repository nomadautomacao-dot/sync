/**
 * CAUC — Sistema de Informações sobre Requisitos Fiscais (Tesouro Nacional).
 *
 * O CAUC é a lista de checagem que a União roda antes de assinar qualquer
 * transferência voluntária: convênio, emenda, termo de compromisso. Cada item
 * do extrato é um requisito fiscal, e a célula publicada é a **data de
 * validade** da comprovação. Três leituras possíveis, e só uma é problema do
 * município:
 *
 * - **data** — requisito comprovado, válido até aquele dia;
 * - **`!`** — o CAUC não conseguiu obter a comprovação: é a pendência que
 *   trava a transferência, e a única leitura que acusa o ente;
 * - **`Desabilitado`** — o item não está disponível na data da consulta,
 *   situação idêntica para todos os entes do país. Nunca é falha local, e
 *   apresentá-la como pendência seria inventar um problema.
 *
 * Cinco itens são de educação e falam direto com o FUNDEB (5.1, 5.5, 5.6, 5.7
 * e o Anexo 8 do RREO ao SIOPE, 3.2.3) — é o único lugar onde o Tesouro diz,
 * em tempo real, se a aplicação mínima do fundo está comprovada.
 *
 * O dado é atualizado em dias úteis, então a consulta é viva: versionar um
 * retrato diário no repositório entregaria um CAUC velho a cada relatório.
 */

const CSV_URL =
  "https://www.tesourotransparente.gov.br/ckan/dataset/72b5f371-0c35-4613-8076-c99c821a6410/resource/07af297a-5e59-494a-a88a-55ddfd2f4b01/download/relatorio-situacao-de-varios-entes---municipios---uf-todas---abrangencia-1.csv";

/** Rótulos oficiais do extrato, do PDF de metadados do Tesouro. */
export const ITENS_CAUC: Record<string, string> = {
  "1.1": "Regularidade quanto a tributos, contribuições previdenciárias federais e dívida ativa da União",
  "1.2": "Regularidade no pagamento de precatórios judiciais",
  "1.3": "Regularidade quanto a contribuições para o FGTS",
  "1.4": "Adimplência financeira em empréstimos e financiamentos concedidos pela União",
  "1.5": "Regularidade perante o Poder Público Federal",
  "2.1.1": "Prestação de contas de recursos federais recebidos (SIAFI/Transferências)",
  "2.1.2": "Prestação de contas de recursos federais recebidos (Transferegov)",
  "3.1.1": "Publicação do Relatório de Gestão Fiscal (RGF)",
  "3.1.2": "Encaminhamento do RGF ao Siconfi",
  "3.2.1": "Publicação do Relatório Resumido de Execução Orçamentária (RREO)",
  "3.2.2": "Encaminhamento do RREO ao Siconfi",
  "3.2.3": "Encaminhamento do Anexo 8 do RREO ao Siope",
  "3.2.4": "Encaminhamento do Anexo 12 do RREO ao Siops",
  "3.3": "Encaminhamento das contas anuais",
  "3.4.1": "Matriz de Saldos Contábeis mensal",
  "3.4.2": "Matriz de Saldos Contábeis de encerramento",
  "3.5": "Informações para o Cadastro da Dívida Pública (CDP)",
  "3.6": "Transparência da execução orçamentária e financeira em meio eletrônico",
  "3.7": "Adoção de Sistema Integrado de Administração Financeira e Controle (Siafic)",
  "4.1": "Exercício da plena competência tributária",
  "4.2": "Regularidade previdenciária",
  "5.1": "Aplicação mínima de recursos em educação",
  "5.2": "Aplicação mínima de recursos em saúde",
  "5.3": "Limite de despesas com parcerias público-privadas (PPP)",
  "5.4": "Limite de operações de crédito, inclusive por antecipação de receita",
  "5.5": "Aplicação mínima do Fundeb no pagamento de profissionais da educação básica",
  "5.6": "Aplicação mínima da complementação da União ao Fundeb em despesas de capital",
  "5.7": "Aplicação de 50% da complementação VAAT do Fundeb na educação infantil",
};

/** Itens que a equipe de FUNDEB precisa ver nomeados, na ordem de leitura. */
export const ITENS_EDUCACAO = ["5.1", "5.5", "5.6", "5.7", "3.2.3"] as const;

export interface RequisitoCauc {
  codigo: string;
  rotulo: string;
  situacao: "comprovado" | "pendente" | "desabilitado";
  /** Data de validade da comprovação, ISO, quando comprovado. */
  validadeAte: string | null;
}

export interface CaucMunicipio {
  dataPesquisa: string | null;
  /** Todos os requisitos, na ordem do extrato. */
  requisitos: RequisitoCauc[];
  pendencias: RequisitoCauc[];
  /** Pendências entre os cinco itens de educação/FUNDEB. */
  pendenciasEducacao: RequisitoCauc[];
  comprovados: number;
  desabilitados: number;
  /** Requisito comprovado que vence primeiro — o próximo prazo real. */
  proximoVencimento: { codigo: string; rotulo: string; validadeAte: string } | null;
  /** Quantos municípios do país têm ao menos uma pendência, e de quantos. */
  panorama: { comPendencia: number; total: number } | null;
}

interface LinhaCauc {
  codigoIBGE: string;
  valores: Record<string, string>;
}

interface ExtratoCauc {
  dataPesquisa: string | null;
  linhas: Map<string, LinhaCauc>;
  comPendencia: number;
  total: number;
}

function limpar(campo: string): string {
  return campo.replace(/^"/, "").replace(/"$/, "").trim();
}

/** "29/07/2026" ou "29/07/26" → "2026-07-29". */
function dataIso(valor: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(valor);
  if (!m) return null;
  const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${ano}-${m[2]}-${m[1]}`;
}

/**
 * Parse puro do CSV do Tesouro: latin1, `;`, campos entre aspas, três linhas
 * de preâmbulo antes do cabeçalho.
 */
export function lerExtratoCauc(csv: string): ExtratoCauc {
  const linhas = csv.split(/\r?\n/);
  const dataPesquisa =
    dataIso(limpar(linhas[0] ?? "").replace(/^Data da Pesquisa:\s*/, "")) ?? null;

  const indiceCabecalho = linhas.findIndex((linha) => /"?UF"?;/.test(linha) && /C[óo]digo IBGE/.test(linha));
  if (indiceCabecalho < 0) {
    throw new Error("Cabeçalho do extrato do CAUC não encontrado");
  }
  const cabecalho = linhas[indiceCabecalho].split(";").map(limpar);
  const colunaIbge = cabecalho.findIndex((c) => /C[óo]digo IBGE/.test(c));
  // Os itens do extrato são as colunas cujo nome é um código numérico (1.1,
  // 3.2.3, 5.7…). Ler por nome, e não por posição, sobrevive à inclusão de
  // novos requisitos — o Tesouro já ampliou o extrato em 2025.
  const colunasItens = cabecalho
    .map((nome, indice) => ({ nome, indice }))
    .filter(({ nome }) => /^\d+(\.\d+)+$/.test(nome));

  const mapa = new Map<string, LinhaCauc>();
  let comPendencia = 0;
  let total = 0;
  for (let i = indiceCabecalho + 1; i < linhas.length; i++) {
    if (!linhas[i].trim()) continue;
    const campos = linhas[i].split(";").map(limpar);
    const codigoIBGE = campos[colunaIbge];
    if (!/^\d{7}$/.test(codigoIBGE)) continue;
    total += 1;
    const valores: Record<string, string> = {};
    let pendente = false;
    for (const { nome, indice } of colunasItens) {
      const valor = campos[indice] ?? "";
      valores[nome] = valor;
      if (valor === "!") pendente = true;
    }
    if (pendente) comPendencia += 1;
    mapa.set(codigoIBGE, { codigoIBGE, valores });
  }

  return { dataPesquisa, linhas: mapa, comPendencia, total };
}

export function interpretarCauc(extrato: ExtratoCauc, codigoIBGE: string): CaucMunicipio | null {
  const linha = extrato.linhas.get(codigoIBGE.replace(/\D/g, ""));
  if (!linha) return null;

  const requisitos: RequisitoCauc[] = Object.entries(linha.valores).map(([codigo, valor]) => {
    const validade = dataIso(valor);
    return {
      codigo,
      rotulo: ITENS_CAUC[codigo] ?? `Item ${codigo} do extrato do CAUC`,
      situacao: valor === "!" ? "pendente" : validade ? "comprovado" : "desabilitado",
      validadeAte: validade,
    };
  });

  const pendencias = requisitos.filter((r) => r.situacao === "pendente");
  const comprovados = requisitos.filter((r) => r.situacao === "comprovado");
  const proximo = [...comprovados]
    .filter((r) => r.validadeAte !== null)
    .sort((a, b) => (a.validadeAte as string).localeCompare(b.validadeAte as string))[0];

  return {
    dataPesquisa: extrato.dataPesquisa,
    requisitos,
    pendencias,
    pendenciasEducacao: pendencias.filter((r) => (ITENS_EDUCACAO as readonly string[]).includes(r.codigo)),
    comprovados: comprovados.length,
    desabilitados: requisitos.filter((r) => r.situacao === "desabilitado").length,
    proximoVencimento: proximo
      ? { codigo: proximo.codigo, rotulo: proximo.rotulo, validadeAte: proximo.validadeAte as string }
      : null,
    panorama: extrato.total > 0 ? { comPendencia: extrato.comPendencia, total: extrato.total } : null,
  };
}

/**
 * Cache por instância: o extrato inteiro tem ~2 MB e vale para o país todo, e
 * o Raio-X monta dois exercícios do mesmo município na mesma execução.
 */
let cache: { extrato: ExtratoCauc; buscadoEm: number } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000;

async function carregarExtrato(): Promise<ExtratoCauc | null> {
  if (cache && Date.now() - cache.buscadoEm < TTL_MS) return cache.extrato;
  try {
    const resposta = await fetch(CSV_URL, {
      signal: AbortSignal.timeout(45_000),
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/csv" },
    });
    if (!resposta.ok) return null;
    // O Tesouro publica em latin1; decodificar como UTF-8 corromperia os
    // nomes dos entes (e o cabeçalho que orienta o parse).
    const csv = new TextDecoder("latin1").decode(await resposta.arrayBuffer());
    const extrato = lerExtratoCauc(csv);
    cache = { extrato, buscadoEm: Date.now() };
    return extrato;
  } catch {
    return null;
  }
}

export async function getCaucMunicipio(codigoIBGE: string): Promise<CaucMunicipio | null> {
  const extrato = await carregarExtrato();
  if (!extrato) return null;
  return interpretarCauc(extrato, codigoIBGE);
}
