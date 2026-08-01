import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";

import { updateCityPipeline } from "@/core/lib/cities-firestore";
import type { CityAccount } from "@/core/lib/city-types";
import { uploadCityDocument } from "@/modules/documentos/documentos-firestore";

import {
  createCityReport,
  cityReportSnapshotFromUnknown,
  generatedReportBundleFromUnknown,
} from "./city-reports-firestore";
import type { CityReportSnapshot, CityReportType } from "./reports-types";

/**
 * Emitir e arquivar um documento, num lugar só.
 *
 * Esta lógica nasceu dentro da tela de relatórios, onde só havia um caminho:
 * o consultor clicava e esperava. Com a fila de emissão passou a haver dois
 * chamadores — a tela e o processador de segundo plano —, e duplicar isso seria
 * duplicar o trecho mais delicado do produto: a conferência de que o PDF
 * recebido é do município pedido, e o arquivamento em três passos (binário,
 * JSON e pipeline) em que cada passo pode falhar sozinho.
 */

export interface MunicipioAlvo {
  codigoIbge: string;
  nome: string;
  uf: string;
  regiao?: string;
}

/** O mínimo do catálogo que a emissão precisa — o resto é interface. */
export interface DocumentoEmissivel {
  id: string;
  nome: string;
  endpoint: string;
  reportType: CityReportType;
}

export interface PdfEmitido {
  blob: Blob;
  fileName: string;
  contentType: string;
  snapshot: CityReportSnapshot;
  generationId: string;
  exercicio: number;
}

function pdfBlobFromBase64(base64: string): Blob {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: "application/pdf" });
}

/**
 * Chama a rota do documento e devolve o PDF já conferido.
 *
 * Lança com a mensagem do servidor quando ela existe: "falhou" genérico não
 * diz o que corrigir, e essas rotas devolvem `{ error }` explicando.
 */
export async function emitirPdf(
  documento: DocumentoEmissivel,
  municipio: MunicipioAlvo,
): Promise<PdfEmitido> {
  const resposta = await fetch(documento.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      codigo_ibge: municipio.codigoIbge,
      nome: municipio.nome,
      uf: municipio.uf,
      response_format: "bundle",
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.json().catch(() => null);
    throw new Error(
      detalhe?.error ?? `Falha na geração (HTTP ${resposta.status}).`,
    );
  }

  const bundle = generatedReportBundleFromUnknown(
    await resposta.json().catch(() => null),
  );
  if (!bundle) {
    throw new Error(
      "O servidor gerou uma resposta incompleta: o PDF veio sem o JSON de arquivamento.",
    );
  }

  /* Um PDF do município errado arquivado na ficha certa é pior que nenhum PDF:
     vira número de outra cidade dentro de uma proposta assinada. */
  const codigoPedido = municipio.codigoIbge.replace(/\D/g, "");
  const codigoRecebido = bundle.archive.municipality.codigoIbge.replace(
    /\D/g,
    "",
  );
  if (codigoPedido !== codigoRecebido) {
    throw new Error(
      `O relatório retornou o IBGE ${codigoRecebido}, mas a cidade pedida é ${codigoPedido}. Nada foi arquivado.`,
    );
  }

  const snapshot = cityReportSnapshotFromUnknown(bundle.archive);
  if (!snapshot) {
    throw new Error(
      "O JSON do relatório não pôde ser normalizado para arquivamento.",
    );
  }

  return {
    blob: pdfBlobFromBase64(bundle.pdfBase64),
    fileName: bundle.fileName,
    contentType: resposta.headers.get("Content-Type") || "application/pdf",
    snapshot,
    generationId: bundle.archive.generationId,
    exercicio: Number(bundle.archive.exercise) || new Date().getFullYear(),
  };
}

export interface ResultadoArquivamento {
  /** O binário chegou ao Storage. Falha aqui não invalida o JSON. */
  pdfArquivado: boolean;
  documentId?: string;
  downloadUrl?: string;
}

/**
 * Guarda o PDF na pasta da cidade, o JSON na coleção de relatórios e empurra o
 * pipeline. O upload do binário é o passo que mais falha (rede, tamanho), e por
 * isso ele não derruba o arquivamento do JSON — o dado do levantamento é o que
 * a proposta usa; o PDF se regera.
 */
export async function arquivarEmissao({
  db,
  storage,
  cidade,
  documento,
  emitido,
  usuario,
  receitaFundeb,
}: {
  db: Firestore;
  storage: FirebaseStorage;
  cidade: CityAccount;
  documento: DocumentoEmissivel;
  emitido: PdfEmitido;
  usuario: { id: string; name: string; groupId: string };
  receitaFundeb?: number;
}): Promise<ResultadoArquivamento> {
  const arquivo = new File([emitido.blob], emitido.fileName, {
    type: emitido.contentType,
  });

  let documentoArquivado:
    | Awaited<ReturnType<typeof uploadCityDocument>>
    | undefined;
  try {
    documentoArquivado = await uploadCityDocument(db, storage, arquivo, {
      groupId: usuario.groupId,
      cityId: cidade.id,
      cityName: cidade.name,
      cityUf: cidade.uf,
      category: "relatorio",
      title: `${documento.nome} ${emitido.exercicio}`,
      description:
        "Relatório gerado pela Central de Relatórios e Levantamentos FUNDEB.",
      createdBy: usuario.id,
      createdByName: usuario.name,
      source: "generated",
    });
  } catch (erro) {
    console.warn("PDF gerado, mas a cópia binária não foi arquivada:", erro);
  }

  await createCityReport(db, {
    groupId: usuario.groupId,
    cityId: cidade.id,
    cityName: cidade.name,
    cityUf: cidade.uf,
    codigoIbge: cidade.codigoIbge,
    type: documento.reportType,
    title: documento.nome,
    exercise: emitido.exercicio,
    snapshot: emitido.snapshot,
    generationId: emitido.generationId,
    documentId: documentoArquivado?.id,
    downloadUrl: documentoArquivado?.downloadUrl,
    fileName: documentoArquivado?.fileName,
    generatedBy: usuario.id,
    generatedByName: usuario.name,
  });

  const patch: Record<string, unknown> = {
    lastActivityAt: new Date().toISOString(),
  };
  if (cidade.stage === "mapping" || cidade.stage === "first_contact") {
    patch.stage = "technical_diagnostic";
  }
  if (Number.isFinite(receitaFundeb) && Number(receitaFundeb) > 0) {
    patch.estimatedAnnualRevenue = receitaFundeb;
  }
  await updateCityPipeline(db, cidade.id, patch).catch((erro) => {
    console.warn("Relatório arquivado, mas o pipeline não avançou:", erro);
  });

  return {
    pdfArquivado: Boolean(documentoArquivado),
    documentId: documentoArquivado?.id,
    downloadUrl: documentoArquivado?.downloadUrl,
  };
}

/** Salva o PDF no disco do usuário. Só a tela usa; a fila não baixa nada. */
export function baixarPdf(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
