# Fase 1 — Firebase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir NextAuth e o login artesanal por Firebase Auth, com `groupId` e `groupRole` em custom claims, eliminando a senha em texto puro no fonte.

**Architecture:** O Flutter autentica no Firebase e envia o ID token no header `Authorization: Bearer`. O Next verifica o token com o Admin SDK e lê `groupId`/`groupRole` das custom claims — sem consultar banco. Como `getSessionUser()` mantém a mesma assinatura, as 18 rotas que a consomem não mudam.

**Tech Stack:** Next.js 16, `firebase-admin` 13, Vitest 3, Flutter com `firebase_auth` e `firebase_core`.

## Global Constraints

- Projeto Firebase: `globalconsultorias`. Projeto GCP do Cloud Run: `opus-sec`. São distintos — a service account precisa ser de `globalconsultorias`.
- Esta fase **não** depende de banco de dados. O Postgres está inacessível e deve continuar assim; nenhum passo pode introduzir consulta a Prisma.
- `getSessionUser(): Promise<SessionUser | null>` é contrato público: assinatura e formato de retorno não mudam, senão as 18 rotas consumidoras quebram.
- Código em inglês, labels em português, commits em inglês (Conventional Commits).
- A `apiKey` do Firebase é identificador público e pode ir para `NEXT_PUBLIC_*`. A **service account** é segredo e nunca entra no repositório.

---

### Task 1: Base de testes e verificação de token

**Files:**
- Create: `vitest.config.ts`
- Create: `core/lib/firebase-admin.ts`
- Create: `core/lib/auth-token.ts`
- Test: `core/lib/auth-token.test.ts`
- Modify: `package.json` (script `test`, dependência `firebase-admin`, devDependency `vitest`)

**Interfaces:**
- Produces: `bearerToken(header: string | null): string | null`
- Produces: `sessionUserFromClaims(claims: Record<string, unknown>): SessionUser | null`
- Produces: `firebaseAuth(): Auth` (do `firebase-admin/auth`)
- Produces: `interface SessionUser { id: string; name: string; email: string; groupId: string; groupRole: GroupRole }`

> **Nota de design de teste:** a lógica testável é separada da I/O de propósito.
> `bearerToken` e `sessionUserFromClaims` são funções puras — testam-se sem
> mockar o Firebase. Só `getSessionUser` (Task 2) toca a rede, e ali o teste
> cobre apenas o caminho "sem token".

- [ ] **Step 1: Instalar dependências**

```bash
npm install firebase-admin
npm install --save-dev vitest
```

- [ ] **Step 2: Criar a config do Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "sync_flutter/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 3: Adicionar o script de teste ao `package.json`**

No objeto `"scripts"`, logo após `"lint": "eslint",`, inserir:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 4: Escrever o teste que falha**

Create `core/lib/auth-token.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bearerToken, sessionUserFromClaims } from "./auth-token";

describe("bearerToken", () => {
  it("extrai o token de um header Bearer bem formado", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("aceita o esquema em qualquer caixa", () => {
    expect(bearerToken("bearer abc")).toBe("abc");
    expect(bearerToken("BEARER abc")).toBe("abc");
  });

  it("devolve null para header ausente, vazio ou de outro esquema", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer   ")).toBeNull();
  });
});

describe("sessionUserFromClaims", () => {
  const claims = {
    uid: "uid-1",
    email: "consultor@rochaprime.com.br",
    name: "Consultor",
    groupId: "grupo-1",
    groupRole: "admin",
  };

  it("monta o SessionUser a partir das claims", () => {
    expect(sessionUserFromClaims(claims)).toEqual({
      id: "uid-1",
      name: "Consultor",
      email: "consultor@rochaprime.com.br",
      groupId: "grupo-1",
      groupRole: "admin",
    });
  });

  it("usa o email como nome quando name esta ausente", () => {
    const { name: _omitido, ...semNome } = claims;
    expect(sessionUserFromClaims(semNome)?.name).toBe("consultor@rochaprime.com.br");
  });

  it("rebaixa groupRole desconhecido para member", () => {
    expect(sessionUserFromClaims({ ...claims, groupRole: "superuser" })?.groupRole).toBe("member");
  });

  it("rebaixa groupRole ausente para member", () => {
    const { groupRole: _omitido, ...semRole } = claims;
    expect(sessionUserFromClaims(semRole)?.groupRole).toBe("member");
  });

  it("devolve null sem uid, sem email ou sem groupId", () => {
    const { uid: _u, ...semUid } = claims;
    const { email: _e, ...semEmail } = claims;
    const { groupId: _g, ...semGrupo } = claims;
    expect(sessionUserFromClaims(semUid)).toBeNull();
    expect(sessionUserFromClaims(semEmail)).toBeNull();
    expect(sessionUserFromClaims(semGrupo)).toBeNull();
  });
});
```

- [ ] **Step 5: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./auth-token"`

- [ ] **Step 6: Implementar o mínimo para passar**

Create `core/lib/auth-token.ts`:

```ts
import type { GroupRole } from "@/core/domain/rbac";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  groupId: string;
  groupRole: GroupRole;
}

const groupRoles: GroupRole[] = ["owner", "admin", "member", "viewer"];

/** Extrai o token de `Authorization: Bearer <token>`. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer") return null;
  const token = rest.join("").trim();
  return token || null;
}

function normalizeGroupRole(value: unknown): GroupRole {
  return groupRoles.includes(value as GroupRole) ? (value as GroupRole) : "member";
}

/**
 * Monta o SessionUser a partir das claims de um ID token ja verificado.
 *
 * groupId e groupRole vivem em custom claims justamente para que a
 * autenticacao nao dependa de banco — ver a spec da migracao.
 */
export function sessionUserFromClaims(claims: Record<string, unknown>): SessionUser | null {
  const id = typeof claims.uid === "string" ? claims.uid : null;
  const email = typeof claims.email === "string" ? claims.email : null;
  const groupId = typeof claims.groupId === "string" ? claims.groupId : null;

  if (!id || !email || !groupId) return null;

  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name : email;

  return { id, name, email, groupId, groupRole: normalizeGroupRole(claims.groupRole) };
}
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS — 8 testes

- [ ] **Step 8: Criar o cliente do Admin SDK**

Create `core/lib/firebase-admin.ts`:

```ts
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Credencial da service account do projeto `globalconsultorias`, em JSON.
 *
 * O Cloud Run roda no projeto `opus-sec`, entao o acesso e cross-project e a
 * credencial precisa ser explicita — nao ha Application Default util aqui.
 */
function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT nao definida. Gere a chave em " +
        "Firebase Console > Configuracoes do projeto > Contas de servico e " +
        "cole o JSON inteiro na variavel.",
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT nao e um JSON valido.");
  }
}

let cached: App | undefined;

export function firebaseApp(): App {
  if (!cached) {
    cached = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount()) });
  }
  return cached;
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}
```

- [ ] **Step 9: Confirmar que o build continua verde**

Run: `npm run build`
Expected: `✓ Compiled successfully`, exit 0

- [ ] **Step 10: Commit**

```bash
git add vitest.config.ts core/lib/auth-token.ts core/lib/auth-token.test.ts core/lib/firebase-admin.ts package.json package-lock.json
git commit -m "feat: add firebase admin client and token claim parsing

Introduz Vitest — o projeto nao tinha suite de testes. As funcoes puras
bearerToken e sessionUserFromClaims ficam separadas da I/O para serem
testaveis sem mockar o Firebase."
```

---

### Task 2: `getSessionUser()` passa a ler o ID token

**Files:**
- Modify: `core/lib/auth.ts` (substituição integral)
- Test: `core/lib/auth.test.ts`

**Interfaces:**
- Consumes: `bearerToken`, `sessionUserFromClaims`, `SessionUser` (Task 1); `firebaseAuth()` (Task 1)
- Produces: `getSessionUser(): Promise<SessionUser | null>` — mesma assinatura de hoje, consumida por 18 rotas
- Produces: re-export de `SessionUser`, para que os imports existentes de `@/core/lib/auth` continuem válidos

- [ ] **Step 1: Escrever o teste que falha**

Create `core/lib/auth.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const getHeader = vi.fn();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: getHeader }),
}));

const verifyIdToken = vi.fn();
vi.mock("./firebase-admin", () => ({
  firebaseAuth: () => ({ verifyIdToken }),
}));

const { getSessionUser } = await import("./auth");

describe("getSessionUser", () => {
  beforeEach(() => {
    getHeader.mockReset();
    verifyIdToken.mockReset();
  });

  it("devolve null quando nao ha header Authorization", async () => {
    getHeader.mockReturnValue(null);
    expect(await getSessionUser()).toBeNull();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("devolve o usuario quando o token e valido", async () => {
    getHeader.mockReturnValue("Bearer token-valido");
    verifyIdToken.mockResolvedValue({
      uid: "uid-1",
      email: "consultor@rochaprime.com.br",
      name: "Consultor",
      groupId: "grupo-1",
      groupRole: "owner",
    });

    expect(await getSessionUser()).toEqual({
      id: "uid-1",
      name: "Consultor",
      email: "consultor@rochaprime.com.br",
      groupId: "grupo-1",
      groupRole: "owner",
    });
  });

  it("devolve null quando o token e rejeitado", async () => {
    getHeader.mockReturnValue("Bearer token-expirado");
    verifyIdToken.mockRejectedValue(new Error("token expirado"));
    expect(await getSessionUser()).toBeNull();
  });

  it("devolve null quando o token e valido mas nao tem groupId", async () => {
    getHeader.mockReturnValue("Bearer sem-grupo");
    verifyIdToken.mockResolvedValue({ uid: "uid-1", email: "a@b.com" });
    expect(await getSessionUser()).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `getSessionUser` ainda usa NextAuth e ignora os mocks

- [ ] **Step 3: Substituir `core/lib/auth.ts` por inteiro**

Replace the entire contents of `core/lib/auth.ts` with:

```ts
import { headers } from "next/headers";
import { bearerToken, sessionUserFromClaims, type SessionUser } from "@/core/lib/auth-token";
import { firebaseAuth } from "@/core/lib/firebase-admin";

export type { SessionUser };

/**
 * Usuario da requisicao, a partir do ID token do Firebase.
 *
 * Nao consulta banco: groupId e groupRole vem das custom claims. Devolve null
 * em qualquer falha — token ausente, invalido, expirado ou sem as claims
 * necessarias. As rotas tratam null como 401.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = bearerToken((await headers()).get("authorization"));
  if (!token) return null;

  try {
    const decoded = await firebaseAuth().verifyIdToken(token);
    return sessionUserFromClaims(decoded);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS — 12 testes no total

- [ ] **Step 5: Confirmar que nenhuma rota quebrou**

Run: `npm run build`
Expected: `✓ Compiled successfully`, exit 0. As 18 rotas que importam `getSessionUser` compilam sem alteração, porque a assinatura não mudou.

- [ ] **Step 6: Commit**

```bash
git add core/lib/auth.ts core/lib/auth.test.ts
git commit -m "feat: authenticate requests with firebase id token

getSessionUser passa a verificar o ID token e ler groupId/groupRole das
custom claims. Sem consulta a banco — o que torna esta fase independente do
Postgres, hoje inacessivel. A assinatura nao muda, entao as 18 rotas
consumidoras seguem intactas."
```

---

### Task 3: Script para conceder as claims

**Files:**
- Create: `scripts/firebase/set-claims.mjs`
- Modify: `package.json` (script `firebase:claims`)
- Modify: `.env.example`

**Interfaces:**
- Consumes: `FIREBASE_SERVICE_ACCOUNT` (Task 1)
- Produces: comando `npm run firebase:claims -- <email> <groupId> <groupRole>`

> Sem este passo nenhum usuário tem `groupId`, e portanto `getSessionUser()`
> devolve null para todo mundo. É o bootstrap da fase.
>
> A spec lista uma Cloud Function `onUserCreate` que faria isso automaticamente,
> mas ela grava em `users/{uid}` no Firestore, que só existe na fase 2. Este
> script é o substituto desta fase — e mantém a fase 1 sem nenhuma dependência
> de banco, que é o ponto.

- [ ] **Step 1: Escrever o script**

Create `scripts/firebase/set-claims.mjs`:

```js
/**
 * Concede groupId e groupRole a um usuario do Firebase Auth.
 *
 * Uso: npm run firebase:claims -- <email> <groupId> <groupRole>
 * Ex.: npm run firebase:claims -- adriel@rochaprime.com.br grupo-1 owner
 *
 * As claims so entram em vigor no proximo ID token: o cliente precisa chamar
 * getIdToken(true) ou refazer login.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";

const GROUP_ROLES = ["owner", "admin", "member", "viewer"];

function loadEnvFile(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // arquivo ausente e aceitavel
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const [email, groupId, groupRole] = process.argv.slice(2);

if (!email || !groupId || !groupRole) {
  console.error("Uso: npm run firebase:claims -- <email> <groupId> <groupRole>");
  process.exit(1);
}

if (!GROUP_ROLES.includes(groupRole)) {
  console.error(`groupRole invalido: ${groupRole}. Use um de: ${GROUP_ROLES.join(", ")}`);
  process.exit(1);
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
if (!raw) {
  console.error("FIREBASE_SERVICE_ACCOUNT nao definida no .env ou .env.local.");
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(raw)) });
const auth = getAuth();

const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { groupId, groupRole });

console.log(`OK: ${email} (${user.uid}) -> groupId=${groupId} groupRole=${groupRole}`);
console.log("O usuario precisa refazer login ou chamar getIdToken(true) para o token novo valer.");
```

- [ ] **Step 2: Registrar o script no `package.json`**

No objeto `"scripts"`, após `"test:watch": "vitest",`, inserir:

```json
    "firebase:claims": "node scripts/firebase/set-claims.mjs",
```

- [ ] **Step 3: Documentar as variáveis no `.env.example`**

Append to `.env.example`:

```
# ── Firebase (projeto globalconsultorias) ──
# Config web: identificadores publicos, vao no bundle do cliente.
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyAO3eVUe0xlLQFKWZAsCFCipQkwyrxKSuY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="globalconsultorias.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="globalconsultorias"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="globalconsultorias.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="404922154941"
NEXT_PUBLIC_FIREBASE_APP_ID="1:404922154941:web:8abc91370b9718ff26dcd4"
#
# SEGREDO. JSON inteiro da service account, em uma linha.
# Firebase Console > Configuracoes do projeto > Contas de servico > Gerar chave.
# Nunca commitar.
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"globalconsultorias",...}'
```

- [ ] **Step 4: Verificar que o script valida a entrada sem credencial**

Run: `npm run firebase:claims -- fulano@x.com grupo-1 chefe`
Expected: `groupRole invalido: chefe. Use um de: owner, admin, member, viewer`, exit 1

- [ ] **Step 5: Commit**

```bash
git add scripts/firebase/set-claims.mjs package.json .env.example
git commit -m "feat: add script to grant group claims to a firebase user

Bootstrap da fase: sem groupId nas claims, getSessionUser devolve null para
todos."
```

---

### Task 4: Flutter autentica no Firebase

**Files:**
- Modify: `sync_flutter/pubspec.yaml`
- Create: `sync_flutter/lib/firebase_options.dart` (gerado por `flutterfire configure`)
- Modify: `sync_flutter/lib/main.dart`
- Modify: `sync_flutter/lib/src/core/network/sync_api_client.dart:116,131,133,216,235,241,244,246`
- Modify: `sync_flutter/lib/src/features/auth/presentation/login_screen.dart`

**Interfaces:**
- Consumes: `getSessionUser()` no servidor, que agora exige `Authorization: Bearer <idToken>` (Task 2)
- Produces: `SyncApiClient` enviando o header `Authorization` em toda requisição, no lugar de `Cookie`

> O `middleware.ts` já permite o header `Authorization` no CORS
> (`Access-Control-Allow-Headers`), então não precisa mudar.

- [ ] **Step 1: Adicionar as dependências do Firebase**

Run:

```bash
cd sync_flutter
/home/AdrielT87/sync_tooling/flutter/bin/flutter pub add firebase_core firebase_auth
```

> Use o SDK de `~/sync_tooling/flutter` (3.38.7). O `flutter` do PATH é a 3.44.6,
> onde `lucide_icons_flutter` não compila porque `IconData` virou `final class`.

- [ ] **Step 2: Gerar a configuração por plataforma**

Run:

```bash
cd sync_flutter
dart pub global activate flutterfire_cli
flutterfire configure --project=globalconsultorias
```

Expected: cria `lib/firebase_options.dart` e `android/app/google-services.json`.

- [ ] **Step 3: Inicializar o Firebase no boot do app**

Em `sync_flutter/lib/main.dart`, no topo dos imports:

```dart
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
```

E na `main()`, antes de `runApp(...)`:

```dart
WidgetsFlutterBinding.ensureInitialized();
await Firebase.initializeApp(
  options: DefaultFirebaseOptions.currentPlatform,
);
```

Se a `main()` ainda não for `async`, torne-a `Future<void> main() async`.

- [ ] **Step 4: Trocar o cookie pelo Bearer no cliente de API**

Em `sync_flutter/lib/src/core/network/sync_api_client.dart`, adicione o import:

```dart
import 'package:firebase_auth/firebase_auth.dart';
```

Substitua o bloco que lê o cookie (linhas 131-134) por:

```dart
final user = FirebaseAuth.instance.currentUser;
if (user != null) {
  final idToken = await user.getIdToken();
  headers['Authorization'] = 'Bearer $idToken';
}
```

Faça a mesma substituição no método de headers para requisições externas
(linhas 244-247). `getIdToken()` já renova sozinho quando o token expira.

- [ ] **Step 5: Trocar o login da tela**

Em `sync_flutter/lib/src/features/auth/presentation/login_screen.dart`, o
handler que hoje chama `POST /api/auth/login` passa a chamar:

```dart
try {
  await FirebaseAuth.instance.signInWithEmailAndPassword(
    email: emailController.text.trim(),
    password: passwordController.text,
  );
  // navegacao existente para a home
} on FirebaseAuthException catch (e) {
  final mensagem = switch (e.code) {
    'invalid-credential' || 'wrong-password' || 'user-not-found' => 'Email ou senha incorretos.',
    'too-many-requests' => 'Muitas tentativas. Aguarde alguns minutos.',
    'network-request-failed' => 'Sem conexao com a internet.',
    _ => 'Nao foi possivel entrar. Tente novamente.',
  };
  // exibir `mensagem` no lugar do erro atual
}
```

> A mensagem genérica "Erro interno do servidor" some. Cada falha passa a dizer
> ao consultor o que fazer.

- [ ] **Step 6: Criar o usuário no Console e conceder as claims**

1. Firebase Console > Authentication > Sign-in method > habilitar **Email/senha**
2. Users > Add user > criar com o email do Adriel
3. Rodar, na raiz do repositório:

```bash
npm run firebase:claims -- <email-criado> grupo-1 owner
```

Expected: `OK: <email> (<uid>) -> groupId=grupo-1 groupRole=owner`

- [ ] **Step 7: Verificar ponta a ponta**

Terminal 1: `npm run dev`
Terminal 2: `npm run dev:flutter:linux`

Faça login no app. Expected: entra sem erro, e uma chamada a `/api/modules`
retorna 200 em vez de 401.

Confirme também pelo terminal que o token é aceito:

```bash
# cole um ID token valido (o app pode imprimi-lo em debug)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/modules \
  -H "Authorization: Bearer <id-token>"
```

Expected: `200`. Sem o header: `401`.

- [ ] **Step 8: Commit**

```bash
git add sync_flutter/pubspec.yaml sync_flutter/pubspec.lock sync_flutter/lib/main.dart \
        sync_flutter/lib/firebase_options.dart \
        sync_flutter/lib/src/core/network/sync_api_client.dart \
        sync_flutter/lib/src/features/auth/presentation/login_screen.dart \
        sync_flutter/android/app/google-services.json
git commit -m "feat: authenticate flutter app with firebase auth

Troca o cookie de sessao pelo ID token no header Authorization e substitui a
mensagem generica de erro por diagnostico util ao consultor em campo."
```

---

### Task 5: Remover o login artesanal e o NextAuth

**Files:**
- Delete: `core/lib/session-auth.ts`, `core/lib/user-provisioning.ts`
- Delete: `app/api/auth/login/`, `app/api/auth/logout/`, `app/api/auth/[...nextauth]/`
- Delete: `types/next-auth.d.ts`
- Modify: `core/providers/app-providers.tsx`
- Modify: `app/layout.tsx` (se `AppProviders` ficar vazio)
- Modify: `package.json` (remover `next-auth`)
- Modify: `CLAUDE.md` (seções 3.1 e 3.2)

**Interfaces:**
- Consumes: `getSessionUser()` já migrado (Task 2) e o Flutter já autenticando por Bearer (Task 4)

> Esta task é a única irreversível da fase e vem por último de propósito: só
> execute depois da verificação ponta a ponta da Task 4 passar.

- [ ] **Step 1: Confirmar que nada mais referencia o legado**

Run:

```bash
grep -rn "session-auth\|user-provisioning\|next-auth\|session_token" \
  --include='*.ts' --include='*.tsx' --include='*.dart' \
  app core modules sync_flutter/lib types
```

Expected: apenas ocorrências dentro dos arquivos que serão apagados. Se aparecer
qualquer outra, corrija antes de seguir.

- [ ] **Step 2: Apagar os arquivos**

```bash
rm -rf core/lib/session-auth.ts core/lib/user-provisioning.ts \
       app/api/auth/login app/api/auth/logout "app/api/auth/[...nextauth]" \
       types/next-auth.d.ts
```

- [ ] **Step 3: Simplificar o provider**

Replace the entire contents of `core/providers/app-providers.tsx` with:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Remover a dependência**

```bash
npm uninstall next-auth
```

- [ ] **Step 5: Rodar testes e build**

Run: `npm test && npm run build`
Expected: 12 testes PASS; `✓ Compiled successfully`, exit 0

- [ ] **Step 6: Atualizar o `CLAUDE.md`**

Na seção 3.1, remover as três linhas de `/api/auth/login`, `/api/auth/logout` e
`/api/auth/[...nextauth]`. Substituir a seção 3.2 inteira por:

```markdown
### 3.2 Sistema de autenticação

Firebase Auth (projeto `globalconsultorias`). O Flutter autentica pelo SDK e
envia o ID token em `Authorization: Bearer`. O Next verifica com o Admin SDK em
`getSessionUser()` (`core/lib/auth.ts`) e lê `groupId` e `groupRole` das custom
claims — sem consultar banco.

Para conceder acesso a um usuário novo:

    npm run firebase:claims -- <email> <groupId> <groupRole>

As claims valem a partir do próximo token: o usuário precisa refazer login.
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove handcrafted session login and nextauth

Some a credencial de desenvolvimento em texto puro que estava no fonte e
entrou no historico do git. A partir daqui, identidade e do Firebase Auth."
```

---

## Verificação final da fase

- [ ] `npm test` — 12 testes passando
- [ ] `npm run build` — exit 0
- [ ] `grep -rn "SYNC_LOGIN_PASSWORD\|91991589" app core modules scripts` — sem resultado
- [ ] Login no app Flutter funciona e uma rota autenticada devolve 200
- [ ] Requisição sem header `Authorization` devolve 401

> **Rotação de credencial:** a senha de desenvolvimento está no histórico do git
> e o force-push da limpeza anterior não a remove — ela foi commitada antes.
> Se aquele valor for reutilizado em qualquer outro sistema, troque-o.
