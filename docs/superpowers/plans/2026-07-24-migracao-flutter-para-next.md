# Migração Flutter → Next.js (web-only) — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para rastreio.

**Objetivo:** Substituir a interface Flutter (`sync_flutter/`, ~45k linhas de Dart) por uma interface React sob o Next.js já existente, de forma incremental (strangler), sem tocar no backend (Firestore/Auth/Storage + BFF em `app/api`), até remover o Flutter por completo.

**Arquitetura:** Padrão *strangler fig*. Telas React nascem como rotas explícitas sob `app/(sync)/**` e, por precedência de roteamento do Next, vencem o catch-all `app/[[...path]]/page.tsx` — que continua redirecionando toda rota ainda **não** portada para o bundle Flutter em `public/flutter-web/`. Autenticação e dados reaproveitam o mesmo contrato que o Flutter usa hoje: Firebase Auth no cliente emite um ID token, enviado como `Authorization: Bearer` para o BFF `app/api/**`, que resolve `groupId`/`groupRole` a partir das *custom claims*. Nada de reescrever acesso a dados onde já existe rota BFF.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · `@tanstack/react-query` v5 · `sonner` · Firebase Web SDK (cliente) + `firebase-admin` (BFF) · Vitest.

## Restrições Globais

- **Web-only.** Android deixa de ser alvo. Nenhuma tarefa deste plano adiciona alvo mobile; se mobile voltar a ser necessário, é PWA/Capacitor num plano à parte.
- **Projeto Firebase:** `globalconsultorias`. Config web pública já em `NEXT_PUBLIC_FIREBASE_*` (`.env.local`). Service account no BFF via `FIREBASE_SERVICE_ACCOUNT`.
- **Contrato de auth (verbatim do código):** cliente faz `signInWithEmailAndPassword` → `getIdToken()` → header `Authorization: Bearer <token>`. O BFF (`core/lib/auth.ts::getSessionUser`) lê o token do header, verifica com `firebase-admin`, e monta `SessionUser { id, name, email, groupId, groupRole }` a partir das claims. `groupId` é **obrigatório**: sem ele, o cliente DEVE deslogar e recusar (espelha `remote_sync_repository.dart::signIn`). `groupRole ∈ { "owner", "admin", "member", "viewer" }` (default `"member"`).
- **Escopo de dados:** toda leitura/escrita é escopada por `groupId`. Onde houver rota BFF, consumir a rota (não reimplementar Firestore). Onde ler Firestore direto pelo SDK cliente, filtrar `where('groupId', '==', groupId)` e respeitar `firestore.rules`.
- **PDFs ficam no servidor.** NÃO portar os ~11k linhas de builders Dart `pw.*` (`fundeb_levantamento_pdf_builder.dart` 5028 ln, `contrato_premium_pdf_builder.dart` 2021 ln, etc.). Toda geração de documento passa a chamar as rotas BFF existentes (`app/api/modulos/**/pdf`, `.../gerar-kit`, Python/Playwright em `core/lib/fundeb-*.ts`), que retornam bytes.
- **Coexistência:** rotas explícitas sob `app/(sync)/**` têm precedência sobre o catch-all opcional `app/[[...path]]/page.tsx`. Rota ainda não portada cai no catch-all → Flutter. Só na Fase 7 o catch-all e o Flutter são removidos.
- **Fundação já pronta (não recriar):** `core/providers/app-providers.tsx` já provê React Query + Sonner; `app/layout.tsx` já provê fontes e `AppProviders`; Tailwind v4 e `app/globals.css` ativos; `core/lib/firebase-admin.ts` verifica tokens no BFF.
- **Idioma:** UI e cópias em pt-BR.
- **Design:** seguir `DESIGN.md` / linguagem "Console Técnico" (tipografia técnica, mono para números). Para as fases de UI usar as skills `frontend-design` / `impeccable`.
- **Testes:** Vitest para lógica pura (mapeamento de claims, injeção de token, cálculos reaproveitados). UI verifica-se por *smoke* no browser (skill/ferramenta `browser`), não por teste unitário de render. NÃO adicionar testes Flutter/Dart.
- **Pré-requisito de verificação:** existe uma conta de teste no Firebase Auth do projeto com `groupId` nas claims. Se não existir, criar via `npm run firebase:claims` (script `scripts/firebase/set-claims.mjs`) antes das tarefas de smoke.

---

## Estratégia de coexistência (como Flutter e React convivem)

```mermaid
graph TD
  U[Browser] --> R{Rota casa em app/(sync)/** ?}
  R -->|sim| N[Tela React nova]
  R -->|não| C[app/[[...path]]/page.tsx]
  C --> F[redirect /flutter-web/ → bundle Flutter]
  N --> API[app/api/** BFF]
  F --> API
  API --> FS[(Firestore / Storage)]
```

- **Hoje:** `app/[[...path]]/page.tsx` redireciona *tudo* para `/flutter-web/`; `app/flutter-web/route.ts` serve o `index.html`; `next.config.ts` reescreve `/flutter-web/:path+` → `index.html`.
- **Durante a migração:** cada tela portada adiciona uma rota real (ex.: `app/(sync)/painel/page.tsx`). Como o Next dá precedência a segmentos explícitos sobre o catch-all opcional, a tela React "rouba" a rota; o resto continua no Flutter. Zero big-bang.
- **Guarda de sessão:** o layout de `app/(sync)/` bloqueia acesso não autenticado e redireciona para `/entrar`. **`/entrar` vive FORA desse grupo** (`app/(auth)/entrar/`), senão a própria tela de login herdaria a guarda e entraria em loop de redirect.

## Estrutura de arquivos (a criar / tocar)

| Arquivo | Responsabilidade |
| --- | --- |
| `core/lib/firebase-client.ts` | **Criar.** Singletons do Firebase Web SDK (`app`, `auth`, `firestore`) a partir de `NEXT_PUBLIC_*`. |
| `core/lib/api-client.ts` | **Criar.** `apiFetch(path, init)` que injeta `Authorization: Bearer <idToken>` e trata 401. |
| `core/lib/client-session.ts` | **Criar.** `clientUserFromClaims(claims, fallback)` → `ClientUser`, **reusando** `sessionUserFromClaims` de `core/lib/auth-token.ts` (isomórfico). |
| `core/providers/auth-provider.tsx` | **Criar.** Context de auth (`user`, `loading`, `signIn`, `signOut`) sobre `onAuthStateChanged`. |
| `core/providers/app-providers.tsx` | **Tocar.** Envolver a árvore com `AuthProvider`. |
| `app/(sync)/layout.tsx` | **Criar.** Guarda de sessão + shell (sidebar/header/outlet). |
| `app/(auth)/entrar/page.tsx` | **Criar.** Tela de login (email/senha). Fora do grupo `(sync)` — sem guarda. |
| `app/(sync)/painel/page.tsx` | **Criar.** Dashboard read-only (prova de ponta a ponta). |
| `core/components/sync-shell/*` | **Criar.** Sidebar, header e navegação (espelha `AppSection`). |
| `app/[[...path]]/page.tsx` | **Tocar (Fase 1, mínimo):** `/` → `/entrar`; resto → Flutter. **Remover na Fase 7.** |
| `package.json` | **Tocar.** Adicionar dependência `firebase`. |

---

## Fases (visão geral)

Cada fase é entregável e testável isoladamente. **Só a Fase 1 está detalhada em passos abaixo**; Fases 2–7 estão especificadas o suficiente para virar um plano próprio quando alcançadas (expandir com `writing-plans` na hora).

| Fase | Escopo | Telas Flutter substituídas |
| --- | --- | --- |
| **1** | Fundação React + Auth + Coexistência + Dashboard (prova) | `login_screen`, `sync_shell` (esqueleto), `dashboard_screen` (read-only) |
| **2** | Cidades + Pipeline (Kanban) | `cities_screen`, `city_detail_screen`, `new_city_dialog`, `pipeline_screen`, `fundeb_diagnostico_tab` |
| **3** | Empresas + Pessoas | `companies_screen`, `company_detail_screen`, `new_company_dialog`, `people_screen`, `collaborator_detail_screen`, `new_collaborator_dialog` |
| **4** | Módulos FUNDEB (levantamento/lite/case) | `modules_screen`, `levantamento_fundeb_screen`, `levantamento_fundeb_lite_screen`, `case_sucesso_screen` |
| **5** | Contratos + PDFs (consolidar no BFF) | `contrato_capa_capa_screen`, `slides_screen`, `kit_documental_screen` + todos os `*_pdf_builder.dart` |
| **6** | Dashboard completo + Ajustes + Caixa de entrada | `dashboard_screen` (completo), `settings_screen`, `inbox_screen` |
| **7** | Teardown | Remoção de `sync_flutter/`, serving Flutter e scripts |

---

# FASE 1 — Fundação React + Auth + Dashboard (prova de conceito)

**Meta:** provar o padrão de coexistência de ponta a ponta: login via Firebase Auth → ID token → BFF → dashboard renderizado em React, convivendo com o Flutter.

**Precondições:** conta de teste com `groupId` nas claims (ver Restrições Globais). BFF rodável em `:3100` (`npm run dev:next`).

### Task 1: Firebase Web SDK + init do cliente

**Files:**
- Modify: `package.json` (dependências)
- Create: `core/lib/firebase-client.ts`
- Test: `core/lib/firebase-client.test.ts`

**Interfaces:**
- Produz: `firebaseClientConfig(): FirebaseOptions`, `getFirebaseAuth(): Auth`, `getFirebaseDb(): Firestore`.

- [ ] **Passo 1: adicionar dependência**

```bash
npm install firebase@^12
```
Esperado: `firebase` aparece em `dependencies` no `package.json`. (Hoje só existe `firebase-admin`.)

- [ ] **Passo 2: escrever o teste que falha**

```ts
// core/lib/firebase-client.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { firebaseClientConfig } from "./firebase-client";

describe("firebaseClientConfig", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "k";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "d";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "p";
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "b";
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "s";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "a";
  });

  it("mapeia as variáveis NEXT_PUBLIC_* para FirebaseOptions", () => {
    expect(firebaseClientConfig()).toEqual({
      apiKey: "k", authDomain: "d", projectId: "p",
      storageBucket: "b", messagingSenderId: "s", appId: "a",
    });
  });

  it("lança se uma variável obrigatória faltar", () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    expect(() => firebaseClientConfig()).toThrow(/NEXT_PUBLIC_FIREBASE_API_KEY/);
  });
});
```

- [ ] **Passo 3: rodar e ver falhar**

Run: `npx vitest run core/lib/firebase-client.test.ts`
Esperado: FAIL (módulo/função inexistente).

- [ ] **Passo 4: implementar**

```ts
// core/lib/firebase-client.ts
import { getApps, getApp, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export function firebaseClientConfig(): FirebaseOptions {
  const env = (k: string): string => {
    const v = process.env[k];
    if (!v) throw new Error(`${k} não definida. Preencha em .env.local.`);
    return v;
  };
  return {
    apiKey: env("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: env("NEXT_PUBLIC_FIREBASE_APP_ID"),
  };
}

const app = () => (getApps().length ? getApp() : initializeApp(firebaseClientConfig()));
export const getFirebaseAuth = (): Auth => getAuth(app());
export const getFirebaseDb = (): Firestore => getFirestore(app());
```

- [ ] **Passo 5: rodar e ver passar**

Run: `npx vitest run core/lib/firebase-client.test.ts`
Esperado: PASS.

- [ ] **Passo 6: commit**

```bash
git add package.json package-lock.json core/lib/firebase-client.ts core/lib/firebase-client.test.ts
git commit -m "feat(web): firebase web sdk client init"
```

### Task 2: sessão no cliente (reusar o mapeador de claims do BFF)

**Files:**
- Create: `core/lib/client-session.ts`
- Test: `core/lib/client-session.test.ts`

**Interfaces:**
- Consome: `sessionUserFromClaims` e `type SessionUser` de `@/core/lib/auth-token`.
- Produz: `type ClientUser = SessionUser` (alias) e `clientUserFromClaims(claims, fallback: { uid, email }): ClientUser | null`.

> **Por que reusar e NÃO duplicar:** `core/lib/auth-token.ts` importa apenas `type { GroupRole }` de `@/core/domain/rbac` — nenhum `next/headers`, nenhum `firebase-admin`. É isomórfico e já roda no cliente. Reimplementar a mesma lógica criaria duas fontes de verdade para a regra de sessão: se o BFF mudar o default de `groupRole` ou a exigência de `groupId`, o cliente diverge silenciosamente. A única coisa que o cliente precisa a mais é preencher `uid`/`email` a partir do objeto `User` do Firebase, porque essas duas chaves nem sempre vêm nas custom claims.

- [ ] **Passo 1: escrever o teste que falha**

```ts
// core/lib/client-session.test.ts
import { describe, it, expect } from "vitest";
import { clientUserFromClaims } from "./client-session";

describe("clientUserFromClaims", () => {
  const fallback = { uid: "u1", email: "a@b.com" };

  it("monta ClientUser a partir de claims válidas", () => {
    expect(clientUserFromClaims({ groupId: "g1", name: "Ana", groupRole: "admin" }, fallback))
      .toEqual({ id: "u1", name: "Ana", email: "a@b.com", groupId: "g1", groupRole: "admin" });
  });

  it("retorna null sem groupId", () => {
    expect(clientUserFromClaims({}, fallback)).toBeNull();
  });

  it("preenche uid/email a partir do fallback quando ausentes nas claims", () => {
    expect(clientUserFromClaims({ groupId: "g1" }, fallback)).toEqual({
      id: "u1", name: "a@b.com", email: "a@b.com", groupId: "g1", groupRole: "member",
    });
  });

  it("faz fallback de role inválida para member (regra herdada do BFF)", () => {
    expect(clientUserFromClaims({ groupId: "g1", groupRole: "hacker" }, fallback)?.groupRole).toBe("member");
  });

  it("claims têm precedência sobre o fallback", () => {
    expect(clientUserFromClaims({ groupId: "g1", uid: "claim-uid" }, fallback)?.id).toBe("claim-uid");
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run core/lib/client-session.test.ts`
Esperado: FAIL.

- [ ] **Passo 3: implementar** — delegar a regra ao helper do BFF, sem recopiar a lógica

```ts
// core/lib/client-session.ts
import { sessionUserFromClaims, type SessionUser } from "@/core/lib/auth-token";

/** Sessão no cliente. Mesma forma do SessionUser do BFF — de propósito. */
export type ClientUser = SessionUser;

/**
 * Mapeia as claims do ID token para ClientUser reusando a regra do BFF.
 *
 * `uid`/`email` nem sempre aparecem nas custom claims; o objeto `User` do
 * Firebase é a fonte deles no cliente. Claims têm precedência.
 */
export function clientUserFromClaims(
  claims: Record<string, unknown>,
  fallback: { uid: string; email: string | null },
): ClientUser | null {
  return sessionUserFromClaims({ uid: fallback.uid, email: fallback.email ?? undefined, ...claims });
}
```

- [ ] **Passo 4: rodar e ver passar** — `npx vitest run core/lib/client-session.test.ts` → PASS.
- [ ] **Passo 5: commit** — `git commit -m "feat(web): sessão no cliente reusando o mapeador de claims do BFF"`

### Task 3: cliente HTTP com token bearer

**Files:**
- Create: `core/lib/api-client.ts`
- Test: `core/lib/api-client.test.ts`

**Interfaces:**
- Consome: `getFirebaseAuth()` (Task 1).
- Produz: `apiFetch<T>(path: string, init?: RequestInit): Promise<T>` — anexa `Authorization: Bearer <idToken>` do usuário atual, faz `fetch`, lança `ApiError { status, code, message }` em resposta não-ok, parseia JSON. `withAuthHeader(init: RequestInit, token: string): RequestInit` (helper puro, testável).

- [ ] **Passo 1: teste que falha (helper puro)**

```ts
// core/lib/api-client.test.ts
import { describe, it, expect } from "vitest";
import { withAuthHeader } from "./api-client";

describe("withAuthHeader", () => {
  it("injeta Authorization Bearer preservando headers existentes", () => {
    const out = withAuthHeader({ headers: { "Content-Type": "application/json" } }, "tok");
    const h = new Headers(out.headers);
    expect(h.get("Authorization")).toBe("Bearer tok");
    expect(h.get("Content-Type")).toBe("application/json");
  });
});
```

- [ ] **Passo 2: rodar e ver falhar** — `npx vitest run core/lib/api-client.test.ts` → FAIL.
- [ ] **Passo 3: implementar**

```ts
// core/lib/api-client.ts
import { getFirebaseAuth } from "./firebase-client";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export function withAuthHeader(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new ApiError(401, "NO_SESSION", "Sessão ausente.");
  const token = await user.getIdToken();
  const res = await fetch(path, withAuthHeader(init, token));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.code ?? "HTTP_ERROR", body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Passo 4: rodar e ver passar** — PASS.
- [ ] **Passo 5: commit** — `git commit -m "feat(web): apiFetch com token bearer"`

### Task 4: AuthProvider (context de sessão)

**Files:**
- Create: `core/providers/auth-provider.tsx`
- Modify: `core/providers/app-providers.tsx`

**Interfaces:**
- Consome: `getFirebaseAuth` (Task 1), `clientUserFromClaims` (Task 2).
- Produz: `useAuth(): { user: ClientUser | null; loading: boolean; signIn(email, password): Promise<void>; signOut(): Promise<void> }`.

- [ ] **Passo 1: implementar o provider**

```tsx
// core/providers/auth-provider.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut } from "firebase/auth";
import { getFirebaseAuth } from "@/core/lib/firebase-client";
import { clientUserFromClaims, type ClientUser } from "@/core/lib/client-session";

interface AuthCtx { user: ClientUser | null; loading: boolean; signIn: (e: string, p: string) => Promise<void>; signOut: () => Promise<void>; }
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
    if (!fbUser) { setUser(null); setLoading(false); return; }
    const { claims } = await fbUser.getIdTokenResult(true);
    setUser(clientUserFromClaims(claims, { uid: fbUser.uid, email: fbUser.email }));
    setLoading(false);
  }), []);

  const signIn = async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const { claims } = await cred.user.getIdTokenResult(true);
    if (!claims.groupId) { await fbSignOut(auth); throw new Error("Sua conta ainda não tem acesso configurado. Contate um administrador."); }
  };
  const signOut = () => fbSignOut(getFirebaseAuth());

  return <Ctx.Provider value={{ user, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fora de AuthProvider");
  return v;
}
```

- [ ] **Passo 2: envolver a árvore** em `core/providers/app-providers.tsx` — aninhar `<AuthProvider>` dentro dos providers existentes (React Query/Sonner). Ler o arquivo atual e inserir sem remover os providers já presentes.
- [ ] **Passo 3: verificar build de tipos** — `npx tsc --noEmit` → sem erros nos arquivos novos.
- [ ] **Passo 4: commit** — `git commit -m "feat(web): AuthProvider sobre onAuthStateChanged"`

### Task 5: tela de login `/entrar`

**Files:**
- Create: `app/(auth)/entrar/page.tsx`

**Interfaces:**
- Consome: `useAuth` (Task 4), `sonner` (toast), `next/navigation` (`useRouter`).

> **Fica fora de `(sync)` de propósito.** A guarda de sessão mora no layout de `app/(sync)/` (Task 6). Se a tela de login vivesse dentro desse grupo, ela herdaria a guarda: usuário deslogado abre `/entrar` → guarda vê `!user` → redireciona para `/entrar` → loop infinito. O grupo `(auth)` não tem guarda.

- [ ] **Passo 1: implementar** o form (client component): campos email/senha, `onSubmit` chama `signIn`; sucesso → `router.replace("/painel")`; erro → `toast.error(err.message)`. Estado de carregando desabilita o botão. Layout segue `DESIGN.md`.
- [ ] **Passo 2: bounce do já-autenticado** — `useEffect`: se `!loading && user`, `router.replace("/painel")`. É isso que faz a raiz (`/` → `/entrar`, Task 8) pousar no painel quando a sessão já existe, sem o servidor precisar conhecer o estado de auth do cliente.
- [ ] **Passo 3: smoke no browser** — subir `npm run dev:next`, abrir `http://localhost:3100/entrar`, logar com a conta de teste.
  Esperado: redireciona para `/painel` (mesmo que ainda vazio nesta task). Credencial errada → toast de erro. Conta sem `groupId` → toast "sem acesso configurado". Recarregar `/entrar` já logado → vai direto para `/painel`.
- [ ] **Passo 4: commit** — `git commit -m "feat(web): tela de login /entrar"`

### Task 6: shell + guarda de sessão (`app/(sync)/layout.tsx`)

**Files:**
- Create: `app/(sync)/layout.tsx`, `core/components/sync-shell/sidebar.tsx`, `core/components/sync-shell/header.tsx`

**Interfaces:**
- Consome: `useAuth` (Task 4).
- Produz: layout que, se `!loading && !user`, redireciona `/entrar`; senão renderiza sidebar + header + `{children}`. Sidebar espelha `AppSection`: Painel (`/painel`), Caixa de entrada (`/caixa`), Empresas (`/empresas`), Pessoas (`/pessoas`), Pipeline (`/pipeline`), Módulos (`/modulos`), Ajustes (`/ajustes`). Itens ainda não portados podem apontar para a rota Flutter correspondente durante a transição.

- [ ] **Passo 1: implementar** layout client-side com guarda (`useEffect` → `router.replace("/entrar")` quando deslogado) e um esqueleto de loading enquanto `loading`.
- [ ] **Passo 2: implementar** sidebar (nav ativa por `usePathname`) e header (nome do usuário + botão sair via `signOut`).
- [ ] **Passo 3: smoke no browser** — abrir `/painel` deslogado → cai em `/entrar`. Logar → shell aparece com nav. Clicar "Sair" → volta a `/entrar`.
- [ ] **Passo 4: commit** — `git commit -m "feat(web): shell + guarda de sessão"`

### Task 7: dashboard read-only `/painel`

**Files:**
- Modify: `app/(sync)/painel/page.tsx` (substitui o placeholder criado na Task 6)
- Referência de contrato: `sync_flutter/lib/src/core/data/dashboard_firestore_service.dart::overview`

**Interfaces:**
- Consome: `getFirebaseDb` (Task 1), `useAuth` (Task 4), `@tanstack/react-query` (`useQuery`).

> **CORREÇÃO DO PLANO (feita na execução).** A versão original mandava consumir `GET /api/dashboard/executive` e tipar a partir de `getExecutiveDashboard`. Isso estava **errado por dois motivos**, descobertos ao inspecionar o código antes de implementar:
> 1. `getExecutiveDashboard` roda em **Prisma/PostgreSQL** — a stack legada que o próprio README marca como `DEPRECATED` e que a Fase 5 remove junto com `core/lib/collaboration-data-access.ts`. Construir a prova da migração sobre o banco que está sendo deletado provaria a coisa errada.
> 2. **O produto não usa essa rota.** O dashboard do Flutter lê do Firestore via `DashboardFirestoreService.overview`, chamado pelo `HybridSyncRepository`. Portar a rota Prisma criaria uma tela que não corresponde ao que o usuário vê hoje.
>
> O contrato real, copiado do serviço Flutter: **três contagens no Firestore**, cada uma filtrando `where('groupId', '==', groupId)` **e** `where('deletedAt', '==', null)` — nas coleções `cities`, `collaborators` e `companies`. Os KPIs de dinheiro (lucro base, comissão prevista) estão **hardcoded em R$ 0** com o texto auxiliar "via motor financeiro (em breve)", porque o motor financeiro é Cloud Functions e ainda não existe. `monthlyTrend`, `alerts`, `portfolioMix` e `topMunicipalities` retornam vazios hoje.
>
> Ler o Firestore direto do cliente é o caminho certo e é o que o Flutter faz: exercita as `firestore.rules` no browser com as claims reais, que é prova muito mais valiosa para a migração do que uma leitura Postgres. Também é o único consumidor de `getFirebaseDb()` (Task 1).

- [ ] **Passo 1: implementar** a página (client component), substituindo o placeholder da Task 6. Três `getCountFromServer` (ou `getDocs` + `size`) sobre as coleções `cities`, `collaborators`, `companies`, cada uma com os dois filtros acima, orquestradas por `useQuery` com `queryKey: ["dashboard", groupId]`. O `groupId` vem de `useAuth().user`.
- [ ] **Passo 2: KPIs de dinheiro** — renderizar "R$ 0" com o texto auxiliar "via motor financeiro (em breve)", exatamente como o Flutter. **Não inventar** números nem esconder os cards: a paridade honesta com a tela atual é o requisito.
- [ ] **Passo 3: estados** — carregando (esqueleto) e erro (mensagem em tela, não só toast: é a tela inteira que falhou, não uma ação pontual).
- [ ] **Passo 4: smoke no browser** — logar → `/painel` renderiza as três contagens reais.
  Esperado: os números batem com o que o mesmo `groupId` tem no Firestore. Conferir no devtools que as queries saem para o Firestore e que nenhuma viola as `firestore.rules` (sem erro `permission-denied` no console).
- [ ] **Passo 5: commit** — `git commit -m "feat(web): dashboard read-only com contagens do Firestore"`

### Task 8: fechar a coexistência

**Files:**
- Modify: `app/[[...path]]/page.tsx`

**Interfaces:** nenhuma nova.

- [ ] **Passo 1:** ajustar o catch-all: raiz (`/`) → `redirect("/entrar")`; todo o resto → `/flutter-web/`. **Não** tentar decidir por sessão aqui: `app/[[...path]]/page.tsx` é Server Component e a sessão do Firebase Web SDK vive no IndexedDB do browser — o servidor não a enxerga (o BFF só recebe o token via header `Authorization`, nunca cookie). Quem faz o bounce para `/painel` é o `useEffect` de `/entrar` (Task 5, Passo 2). Rotas `app/(sync)/**` e `app/(auth)/**` já vencem o catch-all por precedência do Next — confirmar, não recodificar roteamento.
- [ ] **Passo 2: smoke de coexistência** — `/painel`, `/entrar` = React; uma rota antiga qualquer (ex.: `/empresas` ainda não portada, se apontada ao Flutter) = bundle Flutter. Ambos autenticam com o mesmo login.
- [ ] **Passo 3: rodar a suíte** — `npm test` (Vitest) → verde.
- [ ] **Passo 4: commit** — `git commit -m "feat(web): coexistência react+flutter na raiz"`

**Critério de aceite da Fase 1:** login em React → token → BFF → `/painel` com KPIs reais, shell navegável, guarda de sessão funcionando, Flutter intacto para rotas não portadas, `npm test` verde.

---

# FASES 2–7 — Especificação (expandir em plano próprio quando alcançadas)

> Cada fase abaixo deve virar seu próprio arquivo `docs/superpowers/plans/…` via `writing-plans` no momento da execução, herdando as Restrições Globais. O detalhe aqui é o suficiente para escopar, não para codar.

## Fase 2 — Cidades + Pipeline

- **Telas:** `cities_screen`, `city_detail_screen`, `new_city_dialog`, `pipeline_screen` (Kanban, ~1700 ln), `fundeb_diagnostico_tab`.
- **Rotas React:** `app/(sync)/pipeline/**`, `app/(sync)/cidades/[id]/**`.
- **Contrato de dados — DECISÃO A RESOLVER:** o Flutter fala `/api/cities` mas o BFF expõe `/api/municipalities`, `/api/municipios/{recentes,carteira,buscar}` e `/api/municipio/completo`. Reconciliar: (a) consumir as rotas BFF existentes, ou (b) ler a coleção `cities` direto do Firestore pelo SDK cliente (escopo `groupId`). Recomendação: rotas BFF onde existem; Firestore direto só para realtime do Kanban se necessário. Mapear campo a campo contra a coleção `cities` (ver shape no map: `estimatedAnnualRevenueCents`, `stage`, `probability`, `nextStepDueDate` etc.).
- **Integrações client-side a portar como `fetch`:** IBGE (autocomplete de município no `new_city_dialog`), SICONFI DCA (fallback FUNDEB — contas `RO1.7.5.1.00.0.0`, `P4.5.2.2.3.00.00`, `P4.5.2.2.4.00.00`; anexos `DCA-Anexo I-C`, `DCA-Anexo I-HI`), Nominatim (geocoding no `city_detail`).
- **Kanban:** usar lib de drag (ex.: `@dnd-kit`) com validação de transição de `stage`; persistir via `PUT /api/cities/{id}/stage` ou update Firestore conforme a decisão acima.
- **Aceite:** criar cidade, mover no Kanban, ver diagnóstico FUNDEB — paridade com Flutter.

## Fase 3 — Empresas + Pessoas

- **Telas:** `companies_screen`, `company_detail_screen` (~high, storage), `new_company_dialog`, `people_screen`, `collaborator_detail_screen` (5 abas, ~1477 ln), `new_collaborator_dialog`.
- **Rotas React:** `app/(sync)/empresas/**`, `app/(sync)/pessoas/**`.
- **BFF existente:** `/api/companies` (+ `[companyId]`, `upload-logo`), `/api/employees`, `/api/collaborators` (+ `[id]`, `/dashboard`, `/documents`, `/documents/[docId]`).
- **DECISÃO A RESOLVER:** `company_detail`/`kit_documental` no Flutter falam com **Supabase Storage** (`rocha-prime/`), enquanto `collaboratorDocuments` usa **Firebase Storage**. Unificar em Firebase Storage (fonte de verdade do produto) e migrar/replumbar o que estiver no Supabase, OU manter Supabase via rota BFF. Escolher e documentar em ADR.
- **Coleções:** `companies`, `employees`, `collaborators`, `collaboratorDocuments` (shapes no map). `defaultCommissionPercentBps` em basis points; `estimatedAnnualRevenueCents` em centavos — cuidar formatação.
- **Aceite:** CRUD de empresa/funcionário/colaborador + upload/download de documentos + comissões, paridade com Flutter.

## Fase 4 — Módulos FUNDEB (dados)

- **Telas:** `modules_screen` (catálogo), `levantamento_fundeb_screen` (stepper, ~2887 ln), `levantamento_fundeb_lite_screen`, `case_sucesso_screen`.
- **Rotas React:** `app/(sync)/modulos/**`.
- **BFF existente:** `/api/modulos/levantamento-fundeb/{raio-x,autonomo,batch,relatorio-dirigido,censo-inep,[codigoIbge]}`, `/api/modulos/case-de-sucesso/**`, `/api/modules` (catálogo).
- **Reuso TS:** `modules/levantamento-fundeb/types.ts` + `utils/calculos.ts` (algoritmos FUNDEB) — consumir direto no cliente, com testes Vitest para os cálculos reaproveitados.
- **PDF/ZIP:** exports chamam `POST /api/modulos/levantamento-fundeb/pdf` (bytes) e empacotam múltiplos com `jszip` no cliente. NÃO portar `fundeb_levantamento_pdf_builder.dart`.
- **Aceite:** rodar um levantamento completo e baixar os PDFs/ZIP, paridade com Flutter.

## Fase 5 — Contratos + consolidação de PDFs

- **Telas:** `contrato_capa_capa_screen` (wizard 4 passos, ~2308 ln, 45+ campos), `slides_screen`, `kit_documental_screen`.
- **Rotas React:** `app/(sync)/modulos/contrato/**`, `app/(sync)/modulos/slides/**`.
- **BFF existente:** `/api/modulos/contrato-fundeb/{gerar-proposta,gerar-kit,gerar-kit-completo}`, `/api/contratos-fundeb/{generate-kit,agent}`, `/api/modulos/slides/{gerar}`. Reuso: `modules/contrato-fundeb/types.ts`, `modules/contrato-fundeb/services/contrato-fundeb-service.ts`, `modules/propostas/**`.
- **Integração client-side:** BrasilAPI (CNPJ autocomplete no wizard).
- **Consolidação:** aposentar TODOS os `*_pdf_builder.dart` (~11k ln) migrando qualquer layout ainda exclusivo do Dart para os geradores server-side (Python/Playwright em `core/lib/fundeb-*.ts`). Antes de remover, comparar PDF gerado pelo BFF vs pelo Flutter (usar `scripts/pdf/compare-fundeb-pdf-pair.mjs`).
- **Aceite:** gerar contrato + kit + slides pelo BFF, com paridade visual verificada contra os PDFs Dart.

## Fase 6 — Dashboard completo + Ajustes + Caixa de entrada

- **Telas:** `dashboard_screen` (gráficos `fl_chart` → lib React de charts, ex.: Recharts), `settings_screen` (~1239 ln: geral/features/roles/audit), `inbox_screen` (audit agrupado por dia).
- **Rotas React:** `app/(sync)/painel` (completar), `app/(sync)/ajustes/**`, `app/(sync)/caixa/**`.
- **BFF existente:** `/api/dashboard/executive`, `/api/workspace/settings`, `/api/audit`.
- **Coleções:** `workspace_settings` (doc = `groupId`, `rawSettings` = feature flags), `audit`.
- **Aceite:** dashboard com gráficos, edição de settings/feature flags, inbox de auditoria — paridade com Flutter.

## Fase 7 — Teardown

- **Remover:** `sync_flutter/` (todo), `app/[[...path]]/page.tsx`, `app/flutter-web/route.ts`, os blocos de `next.config.ts` que servem/reescrevem `/flutter-web/**` e os headers COEP/COOP do Flutter.
- **package.json:** remover scripts `dev:flutter:*`, `build:flutter:*`, `build:apk*`, `install:apk`; apontar `dev`/`dev:all` para `next dev`. Remover `public/flutter-web/` do deploy.
- **Docs:** atualizar `README.md`, `CLAUDE.md`, `DESIGN.md` — a arquitetura passa a "produto = Next.js; BFF e UI no mesmo app".
- **Infra:** revisar `Dockerfile`/`cloudbuild.yaml` para não buildar Flutter.
- **Aceite:** app roda 100% em React, `sync_flutter/` deletado, build e deploy limpos, `npm test` verde.

---

## Auto-revisão (Fase 1)

- **Cobertura:** login (T5), token/claims (T2/T3/T4), shell+guarda (T6), dashboard e2e (T7), coexistência (T8), SDK (T1) — cobrem a meta da Fase 1. ✓
- **Placeholders:** nenhum "TODO/depois". Onde o shape é externo (DashboardOverview), a tarefa manda LER a função real antes de tipar — não inventar. ✓
- **Consistência de tipos:** `ClientUser` (T2) usado por T3/T4; `apiFetch`/`withAuthHeader` (T3) usados por T7; `useAuth` (T4) por T5/T6. `GroupRole` importado de `@/core/domain/rbac` (mesma fonte do BFF). ✓
- **Contrato de auth** idêntico ao BFF (`Authorization: Bearer`, `groupId` obrigatório). ✓
