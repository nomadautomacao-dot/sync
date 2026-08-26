/**
 * Trilha da tela de Acessos — quem concedeu, editou, desativou ou reenviou
 * link para quem.
 *
 * Mesma coleção `audit` e mesma forma de documento da trilha do console
 * (core/lib/sistemas-registro.ts); muda só a `origem`, que é como a leitura
 * distingue de quem é o evento. As rules já barram escrita pelo cliente — só
 * chega aqui pelo Admin SDK, que é o caminho destas rotas.
 *
 * O `detalhe` nunca guarda senha, token ou link de definição de senha — um
 * link desses no log é uma conta tomada.
 */

import { getFirestore } from "firebase-admin/firestore";

import { firebaseApp } from "@/core/lib/firebase-admin";

export type AcaoDeAcesso =
  | "acesso.concedido"
  | "acesso.editado"
  | "acesso.desativado"
  | "acesso.reativado"
  | "acesso.link_de_senha_reenviado";

export interface EventoDeAcesso {
  /** Grupo do operador — as rules de `audit` filtram a leitura por ele. */
  groupId: string;
  atorUid: string;
  atorEmail: string;
  acao: AcaoDeAcesso;
  /** uid da usuária mexida. */
  alvo: string;
  /** Frase curta, legível, do que mudou. */
  detalhe: string;
}

const colecao = () => getFirestore(firebaseApp()).collection("audit");

/**
 * Grava o evento. **Nunca lança**, pelo mesmo motivo de `registrarNoConsole`:
 * auditoria que derruba a operação auditada transforma um log indisponível em
 * recurso indisponível. O erro vai para o Error Reporting e quem chamou segue.
 */
export async function registrarAcesso(evento: EventoDeAcesso): Promise<void> {
  try {
    await colecao().add({ ...evento, origem: "acessos", at: new Date().toISOString() });
  } catch (erro) {
    const { registrarErro } = await import("@/core/lib/structured-log");
    registrarErro("Trilha de acessos", erro, { acao: evento.acao, alvo: evento.alvo });
  }
}
