/**
 * Os contratos das cidades, no Firestore.
 *
 * Coleção raiz `contratos` com `groupId` + `cityId` em cada documento, como
 * `cityDocuments` e `cityReports` — e não subcoleção da cidade — porque as
 * perguntas que este registro responde atravessam a carteira: "quais contratos
 * vencem em 90 dias?", "quantos estão assinados?". Subcoleção obrigaria uma
 * leitura por cidade para responder qualquer uma delas.
 *
 * `delete` não existe: contrato registrado é fato. Negociação que morre vira
 * `cancelado`, que conta a história em vez de apagá-la.
 */

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";

import type {
  ContratoDaCidade,
  EstadoDoContrato,
} from "@/core/domain/contrato-cidade";
import { podeTransicionar } from "@/core/domain/contrato-cidade";

const CONTRATOS = "contratos";

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor : undefined;
}

function numero(valor: unknown, padrao = 0): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : padrao;
}

export function contratoDoDoc(
  id: string,
  dados: Record<string, unknown>,
): ContratoDaCidade {
  return {
    id,
    cityId: texto(dados.cityId) ?? "",
    cityName: texto(dados.cityName) ?? "",
    cityUf: texto(dados.cityUf) ?? "",
    codigoIbge: texto(dados.codigoIbge),
    estado: (texto(dados.estado) ?? "minuta") as EstadoDoContrato,
    numeroContrato: texto(dados.numeroContrato),
    numeroProcesso: texto(dados.numeroProcesso),
    valorMensalCents: numero(dados.valorMensalCents),
    quantidadeMeses: numero(dados.quantidadeMeses, 12),
    vigenciaInicio: texto(dados.vigenciaInicio),
    vigenciaFim: texto(dados.vigenciaFim),
    assinadoEm: texto(dados.assinadoEm),
    dadosGeracao:
      dados.dadosGeracao && typeof dados.dadosGeracao === "object"
        ? (dados.dadosGeracao as Record<string, unknown>)
        : undefined,
    avisosColeta: Array.isArray(dados.avisosColeta)
      ? dados.avisosColeta.filter((a): a is string => typeof a === "string")
      : undefined,
    kitDocumentoId: texto(dados.kitDocumentoId),
    propostaDocumentoId: texto(dados.propostaDocumentoId),
    propostaDownloadUrl: texto(dados.propostaDownloadUrl),
    criadoEm: texto(dados.criadoEm) ?? "",
    atualizadoEm: texto(dados.atualizadoEm),
    criadoPorNome: texto(dados.criadoPorNome),
  };
}

/**
 * Todos os contratos do grupo; `cityId` filtra para a ficha da cidade. O
 * `where` de `groupId` é obrigatório — a regra de leitura o exige na consulta.
 * A ordenação (mais recente primeiro) é no cliente, pela mesma razão dos
 * contatos: `where` + `orderBy` em campos diferentes exigiria índice composto.
 */
export async function listContratos(
  db: Firestore,
  groupId: string,
  cityId?: string,
): Promise<ContratoDaCidade[]> {
  const filtros = [where("groupId", "==", groupId)];
  if (cityId) filtros.push(where("cityId", "==", cityId));
  const snap = await getDocs(query(collection(db, CONTRATOS), ...filtros));
  return snap.docs
    .map((d) => contratoDoDoc(d.id, d.data()))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export interface EntradaDeContrato {
  cityId: string;
  cityName: string;
  cityUf: string;
  codigoIbge?: string;
  numeroContrato?: string;
  numeroProcesso?: string;
  valorMensalCents: number;
  quantidadeMeses: number;
  vigenciaInicio?: string;
  vigenciaFim?: string;
  dadosGeracao?: Record<string, unknown>;
  avisosColeta?: string[];
  kitDocumentoId?: string;
  propostaDocumentoId?: string;
  propostaDownloadUrl?: string;
}

export async function createContrato(
  db: Firestore,
  groupId: string,
  entrada: EntradaDeContrato,
  criadoPorNome?: string,
): Promise<ContratoDaCidade> {
  const documento: Record<string, unknown> = {
    groupId,
    estado: "minuta",
    criadoEm: new Date().toISOString(),
    ...Object.fromEntries(
      Object.entries(entrada).filter(([, valor]) => valor !== undefined),
    ),
    ...(criadoPorNome ? { criadoPorNome } : {}),
  };
  const ref = await addDoc(collection(db, CONTRATOS), documento);
  return contratoDoDoc(ref.id, documento);
}

/**
 * Muda o estado validando a transição — a régua é `podeTransicionar`, e ela
 * vive no domínio para a tela e a escrita nunca discordarem. Assinar carimba
 * `assinadoEm`.
 */
export async function mudarEstadoDoContrato(
  db: Firestore,
  contrato: ContratoDaCidade,
  para: EstadoDoContrato,
): Promise<void> {
  if (!podeTransicionar(contrato.estado, para)) {
    throw new Error(
      `Contrato ${contrato.estado} não pode virar ${para}.`,
    );
  }
  const agora = new Date().toISOString();
  await updateDoc(doc(db, CONTRATOS, contrato.id), {
    estado: para,
    atualizadoEm: agora,
    ...(para === "assinado" ? { assinadoEm: agora } : {}),
  });
}

/** Edições da minuta: números, valores e vigência. Estado não passa por aqui. */
export async function atualizarContrato(
  db: Firestore,
  contratoId: string,
  edicao: Partial<
    Pick<
      ContratoDaCidade,
      | "numeroContrato"
      | "numeroProcesso"
      | "valorMensalCents"
      | "quantidadeMeses"
      | "vigenciaInicio"
      | "vigenciaFim"
      | "kitDocumentoId"
      | "propostaDocumentoId"
      | "propostaDownloadUrl"
      | "dadosGeracao"
      | "avisosColeta"
    >
  >,
): Promise<void> {
  const corpo: Record<string, unknown> = { atualizadoEm: new Date().toISOString() };
  for (const [chave, valor] of Object.entries(edicao)) {
    if (valor !== undefined) corpo[chave] = valor;
  }
  await updateDoc(doc(db, CONTRATOS, contratoId), corpo);
}
