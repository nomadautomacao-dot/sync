# Fase 3 — Cloud Functions de Comissão/Lucro ("Frente B") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O motor financeiro (lucro por cidade e comissão de colaborador) passa a existir no Firestore, calculado **só** por Cloud Functions — o cliente nunca escreve dinheiro. Ao final, o Dashboard pode parar de mostrar R$ 0 (fatia seguinte, fora deste plano) porque `cities/{id}/profitSnapshots/{yyyy-MM}`, `commissionAccruals/{id}` e `commissionPayouts/{id}` passam a ser alimentados de verdade.

**Architecture:** Diretório novo `functions/` (Node 20, TypeScript, Cloud Functions 2ª geração — `firebase-functions/v2`). Toda a lógica de cálculo vive em funções puras testáveis com `node:test`, sem I/O; os handlers (`onCall`, `onDocumentWritten`, `onSchedule`) são cascas finas que só leem/escrevem Firestore e chamam essas funções puras. Security Rules negam `write` nas 4 coleções financeiras para qualquer usuário autenticado — só o Admin SDK (dentro das Functions) escreve.

**Tech Stack:** Node 20, TypeScript, `firebase-functions@^5` (2ª geração), `firebase-admin@^12`, `node:test` (mesmo padrão de `firestore-rules-test/`), Firebase project `globalconsultorias`.

## Global Constraints

- **Dinheiro é sempre inteiro em centavos** (`*Cents: number`), nunca `double`/float com casas decimais monetárias. Percentual é basis points inteiro (`appliedPercentBps`, percentual × 10.000).
- **Única função autorizada a arredondar dinheiro:** `accrue(profitBaseCents, appliedPercentBps) = Math.round((profitBaseCents * appliedPercentBps) / 1_000_000)`. Nenhum outro lugar do código financeiro chama `Math.round` sobre um valor monetário.
- **O cliente nunca escreve `profitSnapshots`, `commissionAccruals`, `commissionPayouts`, `commissionRules`.** Security Rules: `allow write: if false` nas quatro. Toda escrita passa por uma Cloud Function callable, que roda como Admin SDK (ignora as rules) mas valida `request.auth.token.groupRole in ['owner','admin']` manualmente antes de gravar.
- **Divergência de nome de coleção aceita deliberadamente:** a spec original (`docs/superpowers/specs/2026-07-22-migracao-firebase-design.md`) descreve `municipalityAccounts/{accountId}`; a fase 2.3, já na `main`, implementou uma coleção mais simples chamada `cities/{id}` para o mesmo conceito. Este plano usa `cities` (o que existe de verdade no Firestore hoje) em vez de introduzir uma segunda hierarquia paralela. `accountId` neste plano **é** o id do doc em `cities`.
- **ID determinístico = idempotência.** `cities/{cityId}/profitSnapshots/{yyyy-MM}` e `commissionAccruals/{collaboratorId}_{cityId}_{yyyy-MM}` são sempre `set()` no mesmo doc — rodar `fecharCompetencia` duas vezes produz o mesmo resultado, nunca duplica.
- **Escopo por grupo:** toda função financeira confere que `cities/{cityId}.groupId` (e `collaborators/{id}.groupId`) bate com `request.auth.token.groupId` do chamador antes de ler ou escrever qualquer coisa daquele grupo. Callable lança `HttpsError('permission-denied', ...)` se não bater.
- **Não rodar `firebase deploy` neste plano.** Deploy de Functions/Rules é o usuário que roda (mesmo padrão das fases anteriores).

---

## File Structure

**Criar:**
- `functions/package.json`, `functions/tsconfig.json`, `functions/.gitignore` — bootstrap do projeto de Functions.
- `functions/src/money.ts` — matemática monetária pura (`accrue`, `centavosSubtract`, `percentToBps`).
- `functions/src/money.test.ts` — testes de `money.ts` (`node:test`, roda direto com `tsx` ou compilado, sem emulador).
- `functions/src/registrarProfitSnapshot.ts` — callable: admin grava o snapshot mensal de lucro de uma cidade.
- `functions/src/fecharCompetencia.ts` — callable: recomputa accruals do mês a partir do snapshot + regras ativas.
- `functions/src/fecharCompetencia.core.ts` — a lógica pura de `fecharCompetencia` (recebe snapshot + regras, devolve os accruals a gravar), sem tocar Firestore.
- `functions/src/fecharCompetencia.core.test.ts` — testes da lógica pura.
- `functions/src/onAccrualWrite.ts` — trigger Firestore: recalcula totais do payout quando um accrual muda.
- `functions/src/onAccrualWrite.core.ts` — lógica pura de soma dos totais por status.
- `functions/src/onAccrualWrite.core.test.ts` — testes da lógica pura.
- `functions/src/conferirCompetencia.ts` — função agendada diária: recomputa o mês corrente e compara com o gravado.
- `functions/src/index.ts` — exporta as 4 functions.

**Modificar:**
- `firebase.json` — adicionar bloco `"functions"`.
- `firestore.rules` — regras de `commissionRules`, `commissionAccruals`, `commissionPayouts`, `cities/{id}/profitSnapshots/{yyyy-MM}` (todas `write: if false` pro cliente).
- `firestore.indexes.json` — índices de `commissionAccruals` (por `collaboratorId`+`year`+`month` e por `groupId`+`municipalityAccountId`... aqui `cityId`+`year`+`month`).
- `.gitignore` (raiz) — `functions/node_modules/`, `functions/lib/`.

**Modelo de documento Firestore (novo):**

```
cities/{cityId}/profitSnapshots/{yyyy-MM}
  groupId, cityId, year, month,
  recognizedRevenueCents, directCostCents, implementationCostAllocatedCents, taxesCents,
  profitBaseCents,   // = recognizedRevenueCents - directCostCents - implementationCostAllocatedCents - taxesCents
  notes, createdAt, updatedAt

commissionRules/{ruleId}
  groupId, collaboratorId, cityId (nullable — null = nao usado nesta fatia, regra so aplica se setado),
  baseType, triggerType, percentBps (nullable int), flatValueCents (nullable int),
  isActive, createdAt, updatedAt

commissionAccruals/{collaboratorId}_{cityId}_{yyyy-MM}
  groupId, collaboratorId, cityId, commissionRuleId, year, month,
  profitBaseCents, appliedPercentBps (nullable), accruedAmountCents,
  status ('draft'|'calculated'|...), payoutId (nullable),
  createdAt, updatedAt

commissionPayouts/{payoutId}
  groupId, collaboratorId, totalAccruedCents, totalApprovedCents, totalPaidCents,
  status, createdAt, updatedAt
```

---

## Task 1: Bootstrap do diretório `functions/`

**Files:**
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/.gitignore`, `functions/src/index.ts` (placeholder mínimo compilável)
- Modify: `firebase.json`, `.gitignore` (raiz)

**Interfaces:**
- Produces: projeto Node compilável com `npm run build` dentro de `functions/`, alvo de todas as tasks seguintes.

- [ ] **Step 1: Criar `functions/package.json`**

```json
{
  "name": "sync-functions",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "main": "lib/index.js",
  "engines": { "node": "20" },
  "scripts": {
    "build": "tsc",
    "test": "npm run build && node --test lib/**/*.test.js"
  },
  "dependencies": {
    "firebase-admin": "^12.7.0",
    "firebase-functions": "^5.1.1"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Criar `functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "lib",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "compileOnSave": true,
  "include": ["src"]
}
```

- [ ] **Step 3: Criar `functions/.gitignore`**

```
node_modules/
lib/
*.log
```

- [ ] **Step 4: Placeholder mínimo em `functions/src/index.ts`**

```ts
import * as admin from "firebase-admin";

admin.initializeApp();

export {};
```

- [ ] **Step 5: Instalar dependências e compilar**

Run: `cd functions && npm install`
Expected: instala sem erro (usa o npm registry — se a sandbox não tiver rede, rodar isso fora do agente e confirmar antes de prosseguir).

Run: `cd functions && npm run build`
Expected: compila sem erro, gera `functions/lib/index.js`.

- [ ] **Step 6: Ligar ao `firebase.json`**

Em `firebase.json`, adicionar a chave `functions` ao objeto raiz:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": { "rules": "storage.rules" },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git", "*.log"],
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ]
}
```

- [ ] **Step 7: Ignorar artefatos de build no `.gitignore` da raiz**

Adicionar ao final de `.gitignore` (raiz do projeto):

```
functions/node_modules/
functions/lib/
```

- [ ] **Step 8: Commit**

```bash
git add functions/package.json functions/tsconfig.json functions/.gitignore functions/src/index.ts firebase.json .gitignore
git commit -m "feat: bootstrap do projeto Cloud Functions (Node 20 + TypeScript)"
```

---

## Task 2: Matemática monetária pura (`money.ts`)

**Files:**
- Create: `functions/src/money.ts`
- Test: `functions/src/money.test.ts`

**Interfaces:**
- Produces:
  - `function accrue(profitBaseCents: number, appliedPercentBps: number): number` — única função autorizada a arredondar.
  - `function centsSubtract(...values: number[]): number` — subtração exata em centavos (sem arredondamento, é inteiro puro).
  - `function percentToBps(percent: number): number` — `Math.round(percent * 10_000)`, usado só na entrada de dados (o percentual informado pelo admin em `registrarCommissionRule`, fora deste plano — aqui só documenta a convenção).

- [ ] **Step 1: Escrever o teste que falha**

Criar `functions/src/money.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { accrue, centsSubtract, percentToBps } from "./money";

test("accrue aplica bps sobre cents com arredondamento", () => {
  // 10% de R$ 1.000,00 (100000 cents) = R$ 100,00 (10000 cents)
  assert.equal(accrue(100_000, 100_000), 10_000); // 10% = 100_000 bps (10 * 10_000)
  // arredondamento: 33.33% de 100 cents -> 33 cents (nao 33.3)
  assert.equal(accrue(100, 333_300), 33);
});

test("accrue de zero e sempre zero", () => {
  assert.equal(accrue(0, 500_000), 0);
  assert.equal(accrue(100_000, 0), 0);
});

test("centsSubtract soma exata sem arredondamento", () => {
  assert.equal(centsSubtract(100_000, 30_000, 5_000, 2_000), 63_000);
  assert.equal(centsSubtract(100), 100);
});

test("percentToBps converte percentual em basis points inteiros", () => {
  assert.equal(percentToBps(10), 100_000);
  assert.equal(percentToBps(8.5), 85_000);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd functions && npx tsc --noEmit` (deve falhar: `money.ts` não existe)

- [ ] **Step 3: Implementar `money.ts`**

Criar `functions/src/money.ts`:

```ts
/**
 * Toda a aritmética monetária do sistema fica aqui. `accrue` e a UNICA
 * funcao autorizada a arredondar dinheiro (design doc, secao "Blindagem
 * do calculo de comissao").
 */

/** percentual * 10_000 (Decimal(8,4) do Prisma) aplicado sobre cents,
 * dividido de volta por 1_000_000 (10_000 do bps x 100 do percentual). */
export function accrue(profitBaseCents: number, appliedPercentBps: number): number {
  return Math.round((profitBaseCents * appliedPercentBps) / 1_000_000);
}

/** Subtracao exata em centavos inteiros — nunca precisa arredondar. */
export function centsSubtract(...values: number[]): number {
  return values.reduce((acc, v, i) => (i === 0 ? v : acc - v));
}

/** Converte um percentual (ex.: 8.5) no basis-points inteiro usado nas rules. */
export function percentToBps(percent: number): number {
  return Math.round(percent * 10_000);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd functions && npm run build && node --test lib/money.test.js`
Expected: PASS (4 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add functions/src/money.ts functions/src/money.test.ts
git commit -m "feat: matematica monetaria pura das Cloud Functions (cents/bps)"
```

---

## Task 3: `registrarProfitSnapshot` (callable — grava o lucro mensal de uma cidade)

**Files:**
- Create: `functions/src/registrarProfitSnapshot.ts`

**Interfaces:**
- Consumes: `centsSubtract` (Task 2).
- Produces: `export const registrarProfitSnapshot` — `onCall` handler. Payload: `{ cityId: string, year: number, month: number, recognizedRevenueCents: number, directCostCents: number, implementationCostAllocatedCents: number, taxesCents: number, notes?: string }`. Grava `cities/{cityId}/profitSnapshots/{yyyy-MM}`.

> Este passo não existe na spec original — é necessário porque, com o Postgres morto, não há mais nenhuma fonte de dado real de lucro mensal. Sem um jeito de um admin *entrar* com o número, `fecharCompetencia` não teria o que ler. `registrarProfitSnapshot` é esse ponto de entrada único, guardado por `groupRole in ['owner','admin']`.

- [ ] **Step 1: Implementar**

Criar `functions/src/registrarProfitSnapshot.ts`:

```ts
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { centsSubtract } from "./money";

interface RegistrarProfitSnapshotInput {
  cityId: string;
  year: number;
  month: number;
  recognizedRevenueCents: number;
  directCostCents: number;
  implementationCostAllocatedCents: number;
  taxesCents: number;
  notes?: string;
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

export const registrarProfitSnapshot = onCall<RegistrarProfitSnapshotInput>(
  async (request) => {
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError("unauthenticated", "Login necessario.");
    }
    const groupRole = auth.token.groupRole as string | undefined;
    if (groupRole !== "owner" && groupRole !== "admin") {
      throw new HttpsError("permission-denied", "So owner/admin registram lucro.");
    }
    const groupId = auth.token.groupId as string | undefined;
    if (!groupId) {
      throw new HttpsError("failed-precondition", "Usuario sem groupId nas claims.");
    }

    const d = request.data;
    if (!d?.cityId || typeof d.cityId !== "string") {
      throw new HttpsError("invalid-argument", "cityId obrigatorio.");
    }
    if (!Number.isInteger(d.year) || !Number.isInteger(d.month) || d.month < 1 || d.month > 12) {
      throw new HttpsError("invalid-argument", "year/month invalidos.");
    }
    for (const field of [
      "recognizedRevenueCents",
      "directCostCents",
      "implementationCostAllocatedCents",
      "taxesCents",
    ] as const) {
      if (!isNonNegativeInt(d[field])) {
        throw new HttpsError("invalid-argument", `${field} deve ser inteiro >= 0 (centavos).`);
      }
    }

    const db = admin.firestore();
    const cityRef = db.collection("cities").doc(d.cityId);
    const citySnap = await cityRef.get();
    if (!citySnap.exists) {
      throw new HttpsError("not-found", "Cidade nao encontrada.");
    }
    if (citySnap.data()?.groupId !== groupId) {
      throw new HttpsError("permission-denied", "Cidade de outro grupo.");
    }

    const profitBaseCents = centsSubtract(
      d.recognizedRevenueCents,
      d.directCostCents,
      d.implementationCostAllocatedCents,
      d.taxesCents,
    );

    const competencia = `${d.year}-${String(d.month).padStart(2, "0")}`;
    const snapshotRef = cityRef.collection("profitSnapshots").doc(competencia);
    await snapshotRef.set({
      groupId,
      cityId: d.cityId,
      year: d.year,
      month: d.month,
      recognizedRevenueCents: d.recognizedRevenueCents,
      directCostCents: d.directCostCents,
      implementationCostAllocatedCents: d.implementationCostAllocatedCents,
      taxesCents: d.taxesCents,
      profitBaseCents,
      notes: d.notes ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { cityId: d.cityId, competencia, profitBaseCents };
  },
);
```

- [ ] **Step 2: Compilar**

Run: `cd functions && npx tsc --noEmit`
Expected: sem erro de tipos.

- [ ] **Step 3: Commit**

```bash
git add functions/src/registrarProfitSnapshot.ts
git commit -m "feat: callable registrarProfitSnapshot (unico ponto de entrada de lucro mensal)"
```

---

## Task 4: Lógica pura de `fecharCompetencia`

**Files:**
- Create: `functions/src/fecharCompetencia.core.ts`
- Test: `functions/src/fecharCompetencia.core.test.ts`

**Interfaces:**
- Consumes: `accrue` (Task 2).
- Produces:
  - `interface ProfitSnapshotData { profitBaseCents: number }`
  - `interface CommissionRuleData { id: string; collaboratorId: string; baseType: string; percentBps: number | null; flatValueCents: number | null; isActive: boolean }`
  - `interface AccrualToWrite { id: string; collaboratorId: string; commissionRuleId: string; profitBaseCents: number; appliedPercentBps: number | null; accruedAmountCents: number }`
  - `function computeAccruals(cityId: string, year: number, month: number, snapshot: ProfitSnapshotData, rules: CommissionRuleData[]): AccrualToWrite[]` — para cada regra `isActive`, calcula o valor (percentual via `accrue`, ou `flatValueCents` direto) e monta o id determinístico `${collaboratorId}_${cityId}_${yyyy-MM}`. Ignora regras inativas. Regra sem `percentBps` nem `flatValueCents` é pulada (nada a acumular).

- [ ] **Step 1: Escrever o teste que falha**

Criar `functions/src/fecharCompetencia.core.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAccruals } from "./fecharCompetencia.core";

test("aplica regra percentual sobre o profitBase", () => {
  const result = computeAccruals(
    "city1",
    2026,
    7,
    { profitBaseCents: 100_000 },
    [{ id: "r1", collaboratorId: "colab1", baseType: "operational_profit_pre_commission", percentBps: 100_000, flatValueCents: null, isActive: true }],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "colab1_city1_2026-07");
  assert.equal(result[0].accruedAmountCents, 10_000); // 10%
  assert.equal(result[0].appliedPercentBps, 100_000);
});

test("aplica regra de valor fixo, ignorando profitBase", () => {
  const result = computeAccruals(
    "city1", 2026, 7,
    { profitBaseCents: 0 },
    [{ id: "r1", collaboratorId: "colab1", baseType: "gross_revenue", percentBps: null, flatValueCents: 50_000, isActive: true }],
  );
  assert.equal(result[0].accruedAmountCents, 50_000);
  assert.equal(result[0].appliedPercentBps, null);
});

test("ignora regra inativa", () => {
  const result = computeAccruals(
    "city1", 2026, 7,
    { profitBaseCents: 100_000 },
    [{ id: "r1", collaboratorId: "colab1", baseType: "gross_revenue", percentBps: 100_000, flatValueCents: null, isActive: false }],
  );
  assert.equal(result.length, 0);
});

test("ignora regra sem percentual nem valor fixo", () => {
  const result = computeAccruals(
    "city1", 2026, 7,
    { profitBaseCents: 100_000 },
    [{ id: "r1", collaboratorId: "colab1", baseType: "gross_revenue", percentBps: null, flatValueCents: null, isActive: true }],
  );
  assert.equal(result.length, 0);
});

test("duas regras de colaboradores diferentes geram dois accruals", () => {
  const result = computeAccruals(
    "city1", 2026, 7,
    { profitBaseCents: 200_000 },
    [
      { id: "r1", collaboratorId: "colabA", baseType: "gross_revenue", percentBps: 50_000, flatValueCents: null, isActive: true },
      { id: "r2", collaboratorId: "colabB", baseType: "gross_revenue", percentBps: 100_000, flatValueCents: null, isActive: true },
    ],
  );
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((r) => r.accruedAmountCents).sort((a, b) => a - b), [10_000, 20_000]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd functions && npx tsc --noEmit`
Expected: FAIL — `fecharCompetencia.core.ts` não existe.

- [ ] **Step 3: Implementar**

Criar `functions/src/fecharCompetencia.core.ts`:

```ts
import { accrue } from "./money";

export interface ProfitSnapshotData {
  profitBaseCents: number;
}

export interface CommissionRuleData {
  id: string;
  collaboratorId: string;
  baseType: string;
  percentBps: number | null;
  flatValueCents: number | null;
  isActive: boolean;
}

export interface AccrualToWrite {
  id: string;
  collaboratorId: string;
  commissionRuleId: string;
  cityId: string;
  year: number;
  month: number;
  profitBaseCents: number;
  appliedPercentBps: number | null;
  accruedAmountCents: number;
}

/** Competencia no formato usado no id do documento: "2026-07". */
function competenciaId(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Recomputa os accruals de uma competencia a partir do snapshot de lucro e
 * das regras ativas. Puro — sem I/O. `fecharCompetencia.ts` chama isto e so
 * depois grava no Firestore com set() (idempotente pelo id deterministico).
 */
export function computeAccruals(
  cityId: string,
  year: number,
  month: number,
  snapshot: ProfitSnapshotData,
  rules: CommissionRuleData[],
): AccrualToWrite[] {
  const out: AccrualToWrite[] = [];
  for (const rule of rules) {
    if (!rule.isActive) continue;

    let accruedAmountCents: number;
    let appliedPercentBps: number | null = null;

    if (rule.percentBps != null) {
      appliedPercentBps = rule.percentBps;
      accruedAmountCents = accrue(snapshot.profitBaseCents, rule.percentBps);
    } else if (rule.flatValueCents != null) {
      accruedAmountCents = rule.flatValueCents;
    } else {
      continue; // regra sem base de calculo: nada a acumular
    }

    out.push({
      id: `${rule.collaboratorId}_${cityId}_${competenciaId(year, month)}`,
      collaboratorId: rule.collaboratorId,
      commissionRuleId: rule.id,
      cityId,
      year,
      month,
      profitBaseCents: snapshot.profitBaseCents,
      appliedPercentBps,
      accruedAmountCents,
    });
  }
  return out;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd functions && npm run build && node --test lib/fecharCompetencia.core.test.js`
Expected: PASS (5 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add functions/src/fecharCompetencia.core.ts functions/src/fecharCompetencia.core.test.ts
git commit -m "feat: logica pura de fechamento de competencia (idempotente por id deterministico)"
```

---

## Task 5: `fecharCompetencia` (callable — casca de I/O)

**Files:**
- Create: `functions/src/fecharCompetencia.ts`

**Interfaces:**
- Consumes: `computeAccruals` (Task 4).
- Produces: `export const fecharCompetencia` — `onCall`. Payload: `{ cityId: string, year: number, month: number }`. Lê o snapshot e as regras ativas do grupo/cidade, chama `computeAccruals`, grava cada accrual com `set()` (idempotente).

- [ ] **Step 1: Implementar**

Criar `functions/src/fecharCompetencia.ts`:

```ts
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { computeAccruals, CommissionRuleData, ProfitSnapshotData } from "./fecharCompetencia.core";

interface FecharCompetenciaInput {
  cityId: string;
  year: number;
  month: number;
}

export const fecharCompetencia = onCall<FecharCompetenciaInput>(async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Login necessario.");
  const groupRole = auth.token.groupRole as string | undefined;
  if (groupRole !== "owner" && groupRole !== "admin") {
    throw new HttpsError("permission-denied", "So owner/admin fecham competencia.");
  }
  const groupId = auth.token.groupId as string | undefined;
  if (!groupId) throw new HttpsError("failed-precondition", "Usuario sem groupId nas claims.");

  const { cityId, year, month } = request.data;
  if (!cityId || !Number.isInteger(year) || !Number.isInteger(month)) {
    throw new HttpsError("invalid-argument", "cityId/year/month obrigatorios.");
  }

  const db = admin.firestore();
  const cityRef = db.collection("cities").doc(cityId);
  const citySnap = await cityRef.get();
  if (!citySnap.exists || citySnap.data()?.groupId !== groupId) {
    throw new HttpsError("not-found", "Cidade nao encontrada neste grupo.");
  }

  const competencia = `${year}-${String(month).padStart(2, "0")}`;
  const snapshotSnap = await cityRef.collection("profitSnapshots").doc(competencia).get();
  if (!snapshotSnap.exists) {
    throw new HttpsError("failed-precondition", "Sem profitSnapshot para esta competencia — registre antes com registrarProfitSnapshot.");
  }
  const snapshot = snapshotSnap.data() as ProfitSnapshotData;

  const rulesSnap = await db
    .collection("commissionRules")
    .where("groupId", "==", groupId)
    .where("cityId", "==", cityId)
    .where("isActive", "==", true)
    .get();
  const rules: CommissionRuleData[] = rulesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommissionRuleData, "id">) }));

  const accruals = computeAccruals(cityId, year, month, snapshot, rules);

  const batch = db.batch();
  for (const accrual of accruals) {
    batch.set(db.collection("commissionAccruals").doc(accrual.id), {
      ...accrual,
      groupId,
      status: "calculated",
      payoutId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();

  return { competencia, accrualsCount: accruals.length };
});
```

- [ ] **Step 2: Compilar**

Run: `cd functions && npx tsc --noEmit`
Expected: sem erro de tipos.

- [ ] **Step 3: Commit**

```bash
git add functions/src/fecharCompetencia.ts
git commit -m "feat: callable fecharCompetencia (le snapshot+regras, grava accruals idempotente)"
```

---

## Task 6: Lógica pura + trigger `onAccrualWrite` (totais do payout)

**Files:**
- Create: `functions/src/onAccrualWrite.core.ts`
- Test: `functions/src/onAccrualWrite.core.test.ts`
- Create: `functions/src/onAccrualWrite.ts`

**Interfaces:**
- Produces:
  - `interface AccrualForTotals { accruedAmountCents: number; status: string }`
  - `function computePayoutTotals(accruals: AccrualForTotals[]): { totalAccruedCents: number; totalApprovedCents: number; totalPaidCents: number }` — soma `accruedAmountCents` por bucket: todo accrual entra em `totalAccruedCents`; `status === 'approved' || status === 'paid'` soma em `totalApprovedCents`; `status === 'paid'` soma em `totalPaidCents`.
  - `export const onAccrualWrite` — `onDocumentWritten('commissionAccruals/{id}', ...)`: se o doc (antes ou depois) tem `payoutId`, recalcula os totais daquele payout em `runTransaction`, lendo todos os accruals com aquele `payoutId`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `functions/src/onAccrualWrite.core.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePayoutTotals } from "./onAccrualWrite.core";

test("soma total sempre, aprovado so approved/paid, pago so paid", () => {
  const totals = computePayoutTotals([
    { accruedAmountCents: 10_000, status: "calculated" },
    { accruedAmountCents: 20_000, status: "approved" },
    { accruedAmountCents: 5_000, status: "paid" },
  ]);
  assert.equal(totals.totalAccruedCents, 35_000);
  assert.equal(totals.totalApprovedCents, 25_000); // approved + paid
  assert.equal(totals.totalPaidCents, 5_000);
});

test("lista vazia devolve zeros", () => {
  assert.deepEqual(computePayoutTotals([]), {
    totalAccruedCents: 0,
    totalApprovedCents: 0,
    totalPaidCents: 0,
  });
});

test("status draft/blocked nao entram em aprovado nem pago", () => {
  const totals = computePayoutTotals([
    { accruedAmountCents: 10_000, status: "draft" },
    { accruedAmountCents: 10_000, status: "blocked" },
  ]);
  assert.equal(totals.totalAccruedCents, 20_000);
  assert.equal(totals.totalApprovedCents, 0);
  assert.equal(totals.totalPaidCents, 0);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd functions && npx tsc --noEmit`
Expected: FAIL — `onAccrualWrite.core.ts` não existe.

- [ ] **Step 3: Implementar a lógica pura**

Criar `functions/src/onAccrualWrite.core.ts`:

```ts
export interface AccrualForTotals {
  accruedAmountCents: number;
  status: string;
}

/**
 * Totais do CommissionPayout sao sempre DERIVADOS dos accruals — nenhum
 * caminho de escrita aceita esses campos vindos do cliente (design doc).
 */
export function computePayoutTotals(accruals: AccrualForTotals[]): {
  totalAccruedCents: number;
  totalApprovedCents: number;
  totalPaidCents: number;
} {
  let totalAccruedCents = 0;
  let totalApprovedCents = 0;
  let totalPaidCents = 0;
  for (const a of accruals) {
    totalAccruedCents += a.accruedAmountCents;
    if (a.status === "approved" || a.status === "paid") totalApprovedCents += a.accruedAmountCents;
    if (a.status === "paid") totalPaidCents += a.accruedAmountCents;
  }
  return { totalAccruedCents, totalApprovedCents, totalPaidCents };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd functions && npm run build && node --test lib/onAccrualWrite.core.test.js`
Expected: PASS (3 testes verdes).

- [ ] **Step 5: Implementar o trigger**

Criar `functions/src/onAccrualWrite.ts`:

```ts
import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { computePayoutTotals, AccrualForTotals } from "./onAccrualWrite.core";

export const onAccrualWrite = onDocumentWritten("commissionAccruals/{id}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  const payoutId = (after?.payoutId ?? before?.payoutId) as string | undefined;
  if (!payoutId) return; // accrual sem payout associado ainda: nada a recalcular

  const db = admin.firestore();
  const payoutRef = db.collection("commissionPayouts").doc(payoutId);

  await db.runTransaction(async (tx) => {
    const accrualsSnap = await tx.get(
      db.collection("commissionAccruals").where("payoutId", "==", payoutId),
    );
    const accruals: AccrualForTotals[] = accrualsSnap.docs.map((d) => ({
      accruedAmountCents: d.data().accruedAmountCents as number,
      status: d.data().status as string,
    }));
    const totals = computePayoutTotals(accruals);
    tx.set(payoutRef, {
      ...totals,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
});
```

- [ ] **Step 6: Compilar**

Run: `cd functions && npx tsc --noEmit`
Expected: sem erro de tipos.

- [ ] **Step 7: Commit**

```bash
git add functions/src/onAccrualWrite.core.ts functions/src/onAccrualWrite.core.test.ts functions/src/onAccrualWrite.ts
git commit -m "feat: trigger onAccrualWrite recalcula totais do payout em transacao"
```

---

## Task 7: `conferirCompetencia` (agendada, diária)

**Files:**
- Create: `functions/src/conferirCompetencia.ts`

**Interfaces:**
- Consumes: `computeAccruals` (Task 4).
- Produces: `export const conferirCompetencia` — `onSchedule('every day 03:00')`. Para cada `city` ativa com `profitSnapshot` do mês corrente, recomputa em memória com `computeAccruals` e compara com o `commissionAccruals` gravado; loga divergência via `logger.error` (Cloud Logging — sem alerta externo nesta fatia, é o gancho para um alerta futuro).

- [ ] **Step 1: Implementar**

Criar `functions/src/conferirCompetencia.ts`:

```ts
import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { computeAccruals, CommissionRuleData, ProfitSnapshotData } from "./fecharCompetencia.core";

/**
 * Recomputa em memoria o mes corrente para todas as cidades com snapshot
 * lancado e compara com o gravado em commissionAccruals. Ataca o risco
 * central da secao "Blindagem do calculo de comissao": numero errado
 * silencioso. So loga (Cloud Logging); nao corrige sozinha.
 */
export const conferirCompetencia = onSchedule("every day 03:00", async () => {
  const db = admin.firestore();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const competencia = `${year}-${String(month).padStart(2, "0")}`;

  const citiesSnap = await db.collection("cities").where("deletedAt", "==", null).get();

  for (const cityDoc of citiesSnap.docs) {
    const cityId = cityDoc.id;
    const groupId = cityDoc.data().groupId as string;
    const snapshotSnap = await cityDoc.ref.collection("profitSnapshots").doc(competencia).get();
    if (!snapshotSnap.exists) continue;

    const snapshot = snapshotSnap.data() as ProfitSnapshotData;
    const rulesSnap = await db
      .collection("commissionRules")
      .where("groupId", "==", groupId)
      .where("cityId", "==", cityId)
      .where("isActive", "==", true)
      .get();
    const rules: CommissionRuleData[] = rulesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommissionRuleData, "id">) }));

    const expected = computeAccruals(cityId, year, month, snapshot, rules);
    for (const exp of expected) {
      const storedSnap = await db.collection("commissionAccruals").doc(exp.id).get();
      const storedAmount = storedSnap.data()?.accruedAmountCents as number | undefined;
      if (storedAmount !== exp.accruedAmountCents) {
        logger.error("Divergencia de comissao detectada", {
          accrualId: exp.id, cityId, competencia,
          esperado: exp.accruedAmountCents, gravado: storedAmount ?? null,
        });
      }
    }
  }
});
```

- [ ] **Step 2: Compilar**

Run: `cd functions && npx tsc --noEmit`
Expected: sem erro de tipos.

- [ ] **Step 3: Commit**

```bash
git add functions/src/conferirCompetencia.ts
git commit -m "feat: conferencia diaria de competencia (alerta de divergencia via Cloud Logging)"
```

---

## Task 8: Exportar as functions e regras/índices financeiros

**Files:**
- Modify: `functions/src/index.ts`
- Modify: `firestore.rules`, `firestore.indexes.json`

**Interfaces:** nenhuma nova — fecha a fiação.

- [ ] **Step 1: Exportar tudo em `index.ts`**

Substituir `functions/src/index.ts`:

```ts
import * as admin from "firebase-admin";

admin.initializeApp();

export { registrarProfitSnapshot } from "./registrarProfitSnapshot";
export { fecharCompetencia } from "./fecharCompetencia";
export { onAccrualWrite } from "./onAccrualWrite";
export { conferirCompetencia } from "./conferirCompetencia";
```

- [ ] **Step 2: Regras das 4 coleções financeiras**

Em `firestore.rules`, adicionar dentro do `match /databases/{database}/documents`, depois do bloco `audit`:

```
    match /cities/{cityId}/profitSnapshots/{competencia} {
      allow read:  if isSignedIn() && resource.data.groupId == myGroupId();
      allow write: if false; // so Cloud Functions (Admin SDK) via registrarProfitSnapshot
    }

    match /commissionRules/{id} {
      allow read:  if isSignedIn() && resource.data.groupId == myGroupId();
      allow write: if false; // regras sao criadas por admin via console/Function futura
    }

    match /commissionAccruals/{id} {
      allow read:  if isSignedIn() && resource.data.groupId == myGroupId();
      allow write: if false; // so fecharCompetencia (Admin SDK)
    }

    match /commissionPayouts/{id} {
      allow read:  if isSignedIn() && resource.data.groupId == myGroupId();
      allow write: if false; // totais so via onAccrualWrite (Admin SDK)
    }
```

- [ ] **Step 3: Índices**

Em `firestore.indexes.json`, adicionar:

```json
    {
      "collectionGroup": "commissionRules",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "cityId", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "commissionAccruals",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "payoutId", "order": "ASCENDING" }
      ]
    }
```

- [ ] **Step 4: Compilar tudo e rodar a suíte completa de Functions**

Run: `cd functions && npm run build && node --test lib/**/*.test.js`
Expected: PASS — 12 testes verdes no total (Tasks 2, 4, 6).

- [ ] **Step 5: Commit**

```bash
git add functions/src/index.ts firestore.rules firestore.indexes.json
git commit -m "feat: exporta functions financeiras + rules/indices de comissao/lucro"
```

---

## Verificação manual (usuário, fora do subagent — precisa do CLI autenticado)

1. `firebase deploy --only functions,firestore:rules,firestore:indexes --project globalconsultorias`.
2. Console Firebase → Functions: confirmar as 4 functions no ar (`registrarProfitSnapshot`, `fecharCompetencia`, `onAccrualWrite`, `conferirCompetencia`).
3. Via emulador ou console, chamar `registrarProfitSnapshot` para uma cidade real com um mês de teste, depois `fecharCompetencia` para a mesma competência — confirmar doc em `commissionAccruals` com `accruedAmountCents` correto. Rodar `fecharCompetencia` de novo — confirmar que o doc é sobrescrito (mesmo id), não duplicado.
4. Criar manualmente 1 `commissionRule` de teste (via console, já que a criação por UI fica para uma fatia futura) para validar o cálculo ponta a ponta.

## Self-Review (do autor do plano)

- **Cobertura da spec:** matemática blindada (Task 2), snapshot de lucro (Task 3 — gap da spec original, resolvido explicitamente), `fecharCompetencia` idempotente (Tasks 4-5), totais derivados via `onAccrualWrite` em transação (Task 6), conferência agendada (Task 7). Todas as 5 linhas da tabela "Cloud Functions" do design doc cobertas, exceto `onUserCreate` e `cascataSoftDelete` — fora de escopo deste plano (auth/soft-delete genérico, não financeiro; não pedidos nesta fatia). ✅
- **Regra de ouro "cliente não escreve dinheiro":** as 4 coleções financeiras (`profitSnapshots`, `commissionRules`, `commissionAccruals`, `commissionPayouts`) têm `write: if false` nas rules (Task 8); toda escrita passa por callable com checagem manual de `groupRole`. ✅
- **Idempotência:** IDs determinísticos em `profitSnapshots/{yyyy-MM}` e `commissionAccruals/{collaboratorId}_{cityId}_{yyyy-MM}`; sempre `set()`, nunca `add()`. ✅
- **Sem placeholders:** todo `.ts` tem código completo; a única ressalva documentada é a decisão consciente de usar `cities` em vez de `municipalityAccounts` (Global Constraints), com justificativa. ✅
- **Consistência de tipos:** `ProfitSnapshotData`, `CommissionRuleData`, `AccrualToWrite` definidos na Task 4 são reusados sem alteração nas Tasks 5 e 7; `AccrualForTotals` da Task 6 é local a esse par de arquivos. ✅
