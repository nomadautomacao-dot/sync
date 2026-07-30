import { redirect } from "next/navigation";

/**
 * Fundo do roteamento: qualquer caminho que não exista vai para a entrada do
 * app React.
 *
 * Antes este arquivo mandava tudo para o bundle Flutter — o Flutter era o
 * produto e o React era a exceção. Isso se inverteu e se encerrou: o React é o
 * produto e o Flutter foi removido do repositório.
 *
 * Quem vence este catch-all são os segmentos estáticos, que o App Router sempre
 * prefere a um catch-all opcional:
 *   - `app/(auth)/**`  → `/entrar`
 *   - `app/(sync)/**`  → `/painel` e as seções ainda não migradas
 * Portar uma tela é editar a pasta dela sob `(sync)`; nada de roteamento manual
 * aqui.
 *
 * Manda para `/entrar` e não para `/painel` porque este é um Server Component e
 * a sessão do Firebase Web SDK vive no IndexedDB do browser — o servidor não a
 * enxerga. Quem já tem sessão é devolvido para `/painel` pelo bounce de
 * `/entrar`; quem não tem já está na tela certa.
 */
export default function CatchAllRedirectPage() {
  redirect("/entrar");
}
