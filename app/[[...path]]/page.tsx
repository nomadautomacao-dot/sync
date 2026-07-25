import { redirect } from "next/navigation";

/**
 * Contrato de coexistência React ↔ Flutter (Fase 1 da migração).
 *
 * O produto ainda é o app Flutter. Este catch-all é a rota de menor precedência
 * do App Router: tudo que não casa com um segmento explícito cai aqui e vai
 * para o bundle Flutter em `/flutter-web/`.
 *
 * Quem vence este arquivo:
 *   - `app/(auth)/**`  → hoje `/entrar`
 *   - `app/(sync)/**`  → hoje `/painel`
 * São segmentos estáticos, e o Next sempre prefere um segmento estático a um
 * catch-all opcional. Não há roteamento manual aqui: portar uma tela é criar a
 * pasta sob um desses grupos, e ela passa a ser servida pelo React sozinha.
 *
 * Por que a decisão não olha a sessão: este é um Server Component, e a sessão
 * do Firebase Web SDK vive no IndexedDB do browser. O servidor não a enxerga —
 * o BFF só recebe o token pelo header `Authorization`, nunca por cookie. Quem
 * decide para onde um usuário logado vai é o cliente (`app/(sync)/layout.tsx` e
 * o bounce de `/entrar`).
 *
 * ⚠️ Cruzar a fronteira derruba a sessão do React. Carregar `/flutter-web`
 * limpa o `firebaseLocalStorage` (IndexedDB) da origem: os dois apps
 * compartilham origem e projeto Firebase, mas cada um inicializa o SDK do seu
 * jeito e o Flutter zera o estado persistido. Depois de visitar o Flutter,
 * voltar para `/painel` cai na guarda e vai para `/entrar`. Unificar sessão
 * exigiria mexer no app Flutter e está fora da Fase 1.
 *
 * Este arquivo morre na Fase 7 (teardown), junto com `app/flutter-web/route.ts`
 * e as reescritas de `/flutter-web/**` no `next.config.ts`.
 */
export default function CatchAllRedirectPage() {
  redirect("/flutter-web/");
}
