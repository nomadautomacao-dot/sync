const CHAVE = "sync:ultimo-email";

/**
 * Último e-mail que entrou com sucesso, para a tela de login vir preenchida.
 *
 * Só o e-mail — senha não passa pelo sistema (seção 11 do CLAUDE.md), e aqui
 * seria pior ainda: `localStorage` é legível por qualquer script da origem.
 * Sobrevive ao logout de propósito: quem sai e volta é a mesma pessoa na mesma
 * máquina, e é justamente aí que o campo vazio custa digitação.
 *
 * Todo acesso é protegido: no servidor não há `window`, e um browser com
 * armazenamento bloqueado (modo privado estrito, política de empresa) lança em
 * vez de devolver vazio. Lembrar e-mail é conveniência — nunca motivo de erro.
 */
export function lerUltimoEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(CHAVE) ?? "";
  } catch {
    return "";
  }
}

export function gravarUltimoEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, email.trim());
  } catch {
    // Sem armazenamento o login segue igual, só não vem preenchido da próxima.
  }
}
