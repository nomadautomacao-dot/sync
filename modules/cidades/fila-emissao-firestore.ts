import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";

/**
 * A fila de emissão vive no Firestore, não na memória da janela.
 *
 * Gerar os quatro relatórios de um município leva entre oito e quinze minutos,
 * e o consultor não fica olhando: ele fecha o app, vai para a reunião, volta.
 * Fila em memória perderia tudo aí. Com os pedidos no banco, reabrir o app é
 * suficiente para o trabalho continuar de onde parou — e a ficha da cidade
 * consegue dizer o que ainda falta, em vez de fingir que a pasta está completa.
 */

const COLECAO = "reportJobs";

export type StatusDaEmissao = "pendente" | "gerando" | "concluido" | "erro";

export interface JobDeEmissao {
  id: string;
  groupId: string;
  cityId: string;
  cityName: string;
  cityUf: string;
  codigoIbge: string;
  regiao?: string;
  documentoId: string;
  documentoNome: string;
  status: StatusDaEmissao;
  erro?: string;
  tentativas: number;
  criadoEm: string;
  atualizadoEm: string;
}

function jobFromDoc(id: string, dados: Record<string, unknown>): JobDeEmissao {
  const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");
  const status = texto(dados.status);
  return {
    id,
    groupId: texto(dados.groupId),
    cityId: texto(dados.cityId),
    cityName: texto(dados.cityName),
    cityUf: texto(dados.cityUf),
    codigoIbge: texto(dados.codigoIbge),
    regiao: texto(dados.regiao) || undefined,
    documentoId: texto(dados.documentoId),
    documentoNome: texto(dados.documentoNome),
    status: (["pendente", "gerando", "concluido", "erro"] as const).includes(
      status as StatusDaEmissao,
    )
      ? (status as StatusDaEmissao)
      : "pendente",
    erro: texto(dados.erro) || undefined,
    tentativas: typeof dados.tentativas === "number" ? dados.tentativas : 0,
    criadoEm: texto(dados.criadoEm),
    atualizadoEm: texto(dados.atualizadoEm),
  };
}

export interface AlvoDaFila {
  cityId: string;
  cityName: string;
  cityUf: string;
  codigoIbge: string;
  regiao?: string;
}

/**
 * Enfileira documentos para um município. Devolve quantos entraram — pedir de
 * novo o que já está na fila não duplica: um relatório repetido custa minutos
 * de API pública e cria segunda versão do mesmo arquivo na pasta da cidade.
 */
export async function enfileirarDocumentos(
  db: Firestore,
  groupId: string,
  alvo: AlvoDaFila,
  documentos: { id: string; nome: string }[],
): Promise<number> {
  const abertos = await listarJobsDaCidade(db, groupId, alvo.cityId);
  const jaNaFila = new Set(
    abertos
      .filter((job) => job.status === "pendente" || job.status === "gerando")
      .map((job) => job.documentoId),
  );

  const agora = new Date().toISOString();
  const novos = documentos.filter((documento) => !jaNaFila.has(documento.id));

  for (const documento of novos) {
    await addDoc(collection(db, COLECAO), {
      groupId,
      cityId: alvo.cityId,
      cityName: alvo.cityName,
      cityUf: alvo.cityUf,
      codigoIbge: alvo.codigoIbge,
      regiao: alvo.regiao ?? "",
      documentoId: documento.id,
      documentoNome: documento.nome,
      status: "pendente" satisfies StatusDaEmissao,
      tentativas: 0,
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }

  return novos.length;
}

/**
 * Pedidos que ainda pedem atenção — os que faltam fazer e os que falharam.
 *
 * O erro entra aqui de propósito: se a listagem trouxesse só o que está por
 * fazer, um relatório que falhou sumiria da tela e o consultor descobriria a
 * ausência na frente do cliente. Concluído sai; erro fica até ser repetido.
 */
export async function listarJobsAbertos(
  db: Firestore,
  groupId: string,
): Promise<JobDeEmissao[]> {
  const consulta = query(
    collection(db, COLECAO),
    where("groupId", "==", groupId),
    where("status", "in", ["pendente", "gerando", "erro"]),
    orderBy("criadoEm", "asc"),
    limit(200),
  );
  const resultado = await getDocs(consulta);
  return resultado.docs.map((documento) =>
    jobFromDoc(documento.id, documento.data()),
  );
}

/** Todos os pedidos de uma cidade, para a ficha mostrar o que falta. */
export async function listarJobsDaCidade(
  db: Firestore,
  groupId: string,
  cityId: string,
): Promise<JobDeEmissao[]> {
  const consulta = query(
    collection(db, COLECAO),
    where("groupId", "==", groupId),
    where("cityId", "==", cityId),
    limit(200),
  );
  const resultado = await getDocs(consulta);
  return resultado.docs
    .map((documento) => jobFromDoc(documento.id, documento.data()))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
}

export async function atualizarJob(
  db: Firestore,
  jobId: string,
  patch: Partial<Pick<JobDeEmissao, "status" | "erro" | "tentativas">>,
): Promise<void> {
  await updateDoc(doc(db, COLECAO, jobId), {
    ...patch,
    erro: patch.erro ?? "",
    atualizadoEm: new Date().toISOString(),
  });
}
