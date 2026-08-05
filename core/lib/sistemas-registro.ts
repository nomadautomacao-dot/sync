/**
 * Trilha do console — quem mexeu no quê, em qual produto.
 *
 * Fica na coleção `audit` do banco `(default)`, o do próprio Sync: o registro é
 * do console, não do produto administrado, e precisa sobreviver mesmo que o
 * banco do produto seja apagado. As rules já barram escrita pelo cliente
 * (`allow write: if false`) — só chega aqui pelo Admin SDK, que é o caminho
 * destas rotas.
 *
 * Auditoria é para ser lida por gente depois de algo dar errado. Por isso o
 * `detalhe` guarda o que mudou em texto legível, e nunca senha, token ou link
 * de definição de senha — um link desses no log é uma conta tomada.
 */

import { getFirestore } from "firebase-admin/firestore";

import { firebaseApp } from "@/core/lib/firebase-admin";

export type AcaoDoConsole =
  | "prefeitura.criada"
  | "prefeitura.alterada"
  | "usuario.provisionado"
  | "usuario.alterado"
  | "usuario.claims_ressincronizadas"
  | "usuario.acesso_revogado"
  | "usuario.link_de_senha_gerado";

export interface EventoDoConsole {
  /** Grupo do operador — as rules de `audit` filtram a leitura por ele. */
  groupId: string;
  atorUid: string;
  atorEmail: string;
  sistemaId: string;
  acao: AcaoDoConsole;
  /** Identificador do que foi mexido: slug da prefeitura ou uid do usuário. */
  alvo: string;
  /** Frase curta, legível, do que mudou. */
  detalhe: string;
}

export interface RegistroDoConsole extends EventoDoConsole {
  id: string;
  at: string;
}

const colecao = () => getFirestore(firebaseApp()).collection("audit");

/**
 * Grava o evento. **Nunca lança**: auditoria que derruba a operação auditada
 * transforma um log indisponível em recurso indisponível. Falhar aqui é grave,
 * então o erro vai para o Error Reporting — mas quem chamou segue em frente.
 */
export async function registrarNoConsole(evento: EventoDoConsole): Promise<void> {
  try {
    await colecao().add({ ...evento, origem: "console", at: new Date().toISOString() });
  } catch (erro) {
    const { registrarErro } = await import("@/core/lib/structured-log");
    registrarErro("Trilha do console", erro, { acao: evento.acao, alvo: evento.alvo });
  }
}

const texto = (valor: unknown): string => (typeof valor === "string" ? valor : "");

/** A coleção `audit` é compartilhada e antiga: nada garante a forma do documento. */
function lerEvento(id: string, dado: Record<string, unknown>): RegistroDoConsole & { origem: string } {
  return {
    id,
    at: texto(dado.at),
    groupId: texto(dado.groupId),
    atorUid: texto(dado.atorUid),
    atorEmail: texto(dado.atorEmail),
    sistemaId: texto(dado.sistemaId),
    acao: texto(dado.acao) as AcaoDoConsole,
    alvo: texto(dado.alvo),
    detalhe: texto(dado.detalhe),
    origem: texto(dado.origem),
  };
}

export async function listarRegistro(
  groupId: string,
  opcoes: { sistemaId?: string; limite?: number } = {},
): Promise<RegistroDoConsole[]> {
  const limite = Math.min(opcoes.limite ?? 100, 300);

  // Ordena e corta aqui, não na consulta: combinar `orderBy` com filtro por
  // `origem` e por `sistemaId` pediria um índice composto para cada
  // combinação, e o volume é de dezenas de eventos por grupo.
  const snap = await colecao().where("groupId", "==", groupId).limit(500).get();

  return snap.docs
    .map((d) => lerEvento(d.id, d.data()))
    .filter((e) => e.origem === "console")
    .filter((e) => !opcoes.sistemaId || e.sistemaId === opcoes.sistemaId)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limite);
}
