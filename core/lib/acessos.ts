import {
  CLAIM_PERMISSOES,
  GROUP_ROLES,
  ajustesDaClaim,
  ajustesParaClaim,
  permissoesEfetivas,
  type GroupRole,
  type Permissoes,
} from "@/core/domain/rbac";

/**
 * Regras de provisionamento de acesso, sem Firebase por perto.
 *
 * A rota faz rede: procura por e-mail, cria conta, grava claim, gera link de
 * senha. Aqui fica o que decide — e o que decide errado custa caro: uma claim
 * mal montada apaga o acesso de alguém, e um limite estourado falha calado.
 */

/** Teto de custom claims por usuária no Firebase Auth. */
export const LIMITE_CLAIMS_BYTES = 1000;

export interface UsuariaDeAcesso {
  uid: string;
  email: string;
  nome: string;
  groupRole: GroupRole;
  permissoes: Permissoes;
  desativada: boolean;
  criadaEm?: string;
  ultimoAcessoEm?: string;
  /** Como ela entra: "Senha", "Google". Vazio significa que nunca entrou. */
  metodos: string[];
}

/**
 * O registro de usuária do Firebase, no mínimo que interessa aqui.
 *
 * Declarado à mão em vez de importar `UserRecord` do Admin SDK para que este
 * arquivo — e o teste dele — não precisem de credencial nenhuma.
 */
export interface RegistroFirebase {
  uid: string;
  email?: string;
  displayName?: string;
  disabled?: boolean;
  customClaims?: Record<string, unknown>;
  metadata?: { creationTime?: string; lastSignInTime?: string };
  providerData?: { providerId?: string }[];
}

const NOME_DO_PROVEDOR: Record<string, string> = {
  password: "Senha",
  "google.com": "Google",
};

/**
 * Como a pessoa entra no sistema.
 *
 * Lista **vazia** é informação, não falha: a conta foi criada pela
 * administradora, o link de senha foi gerado e ninguém entrou ainda. Distinguir
 * isso de "entra com senha" é o que permite a tela dizer se falta a pessoa
 * fazer a parte dela.
 *
 * Provedor desconhecido entra com o identificador cru em vez de sumir — a lista
 * é para saber a verdade, e um método que não sabemos nomear ainda é um método
 * pelo qual alguém entra.
 */
export function metodosDeEntrada(registro: RegistroFirebase): string[] {
  const ids = (registro.providerData ?? [])
    .map((p) => p?.providerId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  return [...new Set(ids.map((id) => NOME_DO_PROVEDOR[id] ?? id))];
}

/**
 * Junta claims novas às que já existem, preservando o resto.
 *
 * `setCustomUserClaims` **substitui o objeto inteiro**. O Auth é um só para
 * todos os produtos Global, então gravar `{groupId, groupRole}` direto apagaria
 * qualquer claim de outro produto que a mesma pessoa tenha — e o efeito só
 * apareceria no dia em que ela abrisse o outro sistema e não entrasse mais.
 *
 * Chave com valor `null` ou `undefined` é remoção explícita: é assim que se
 * apaga o ajuste de permissão de quem voltou ao padrão do papel.
 */
export function mesclarClaims(
  existentes: Record<string, unknown> | undefined | null,
  novas: Record<string, unknown>,
): Record<string, unknown> {
  const resultado: Record<string, unknown> = { ...(existentes ?? {}) };
  for (const [chave, valor] of Object.entries(novas)) {
    if (valor === null || valor === undefined) delete resultado[chave];
    else resultado[chave] = valor;
  }
  return resultado;
}

export function tamanhoDasClaims(claims: Record<string, unknown>): number {
  return new TextEncoder().encode(JSON.stringify(claims)).byteLength;
}

export function claimsCabem(claims: Record<string, unknown>): boolean {
  return tamanhoDasClaims(claims) <= LIMITE_CLAIMS_BYTES;
}

/**
 * As claims de acesso ao Sync para uma usuária.
 *
 * Só os desvios do padrão do papel entram em `perm` — e quando não há desvio,
 * a chave vai a `null` para ser **removida**, e não gravada vazia. Claim vazia
 * ocuparia espaço do teto e daria a impressão, na próxima leitura, de que
 * alguém configurou algo.
 */
export function claimsDeAcesso(
  groupId: string,
  papel: GroupRole,
  permissoes: Permissoes,
): Record<string, unknown> {
  return {
    groupId,
    groupRole: papel,
    [CLAIM_PERMISSOES]: ajustesParaClaim(papel, permissoes) ?? null,
  };
}

export function usuariaDoRegistro(registro: RegistroFirebase): UsuariaDeAcesso {
  const claims = registro.customClaims ?? {};
  const papel = normalizarPapel(claims.groupRole);

  return {
    uid: registro.uid,
    email: registro.email ?? "",
    nome: registro.displayName?.trim() || registro.email || registro.uid,
    groupRole: papel,
    permissoes: permissoesEfetivas(papel, ajustesDaClaim(claims[CLAIM_PERMISSOES])),
    desativada: registro.disabled === true,
    criadaEm: registro.metadata?.creationTime,
    ultimoAcessoEm: registro.metadata?.lastSignInTime,
    metodos: metodosDeEntrada(registro),
  };
}

export function normalizarPapel(valor: unknown): GroupRole {
  return GROUP_ROLES.includes(valor as GroupRole)
    ? (valor as GroupRole)
    : "member";
}

/** Quem pertence a este grupo — o Admin SDK não consulta por claim. */
export function doGrupo(
  registros: RegistroFirebase[],
  groupId: string,
): RegistroFirebase[] {
  return registros.filter((r) => r.customClaims?.groupId === groupId);
}

export function normalizarEmail(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().toLowerCase();
  // Suficiente para pegar erro de digitação; quem valida de verdade é o Auth.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo) ? limpo : null;
}

export interface ResultadoDeValidacao {
  erro: string | null;
}

/**
 * As duas coisas que uma administradora não pode fazer consigo mesma.
 *
 * Rebaixar o próprio papel ou desativar a própria conta são caminhos comuns
 * para o grupo ficar sem ninguém que administre — e o conserto exige
 * exatamente o acesso que se acabou de perder.
 */
export function validarAlvo(
  uidDeQuemEdita: string,
  uidAlvo: string,
  mudanca: { papel?: GroupRole; desativar?: boolean },
): ResultadoDeValidacao {
  if (uidDeQuemEdita !== uidAlvo) return { erro: null };

  if (mudanca.desativar === true) {
    return { erro: "Você não pode desativar a própria conta." };
  }
  if (mudanca.papel && mudanca.papel !== "owner" && mudanca.papel !== "admin") {
    return { erro: "Você não pode rebaixar o próprio papel." };
  }
  return { erro: null };
}

/**
 * Se dá para trazer uma conta que já existe para este grupo.
 *
 * O Auth é um só do projeto e o e-mail é único nele, então provisionar por
 * e-mail pode esbarrar em conta de **outro grupo**. Gravar por cima trocaria o
 * `groupId` dela — e a pessoa descobriria ao tentar entrar no grupo antigo e
 * não conseguir mais. Conta sem `groupId` é caso legítimo: é quem só usa outro
 * produto Global e agora ganha acesso ao Sync também.
 */
export function podeVincularAoGrupo(
  claimsExistentes: Record<string, unknown> | undefined | null,
  groupId: string,
): { permitido: boolean; motivo: string | null } {
  const atual = claimsExistentes?.groupId;
  if (typeof atual !== "string" || !atual || atual === groupId) {
    return { permitido: true, motivo: null };
  }
  return {
    permitido: false,
    motivo:
      "Já existe uma conta com esse e-mail em outro grupo. Trazê-la para cá a " +
      "removeria de lá — peça a quem administra aquele grupo para liberá-la antes.",
  };
}

/**
 * Só a dona cria outra dona.
 *
 * Sem esta regra, uma administradora se promove a `owner` — o papel que ignora
 * toda restrição de área — e a hierarquia deixa de existir.
 */
export function podeAtribuirPapel(
  papelDeQuemEdita: GroupRole,
  papelPretendido: GroupRole,
): boolean {
  if (papelPretendido === "owner") return papelDeQuemEdita === "owner";
  return papelDeQuemEdita === "owner" || papelDeQuemEdita === "admin";
}
