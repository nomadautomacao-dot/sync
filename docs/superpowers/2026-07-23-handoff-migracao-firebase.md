# Handoff — Migração Firebase + Estado do Projeto (2026-07-23)

> Documento de passagem de bastão para a próxima conversa. Cobre tudo que foi
> feito na sessão de 2026-07-23, o estado atual, as pendências e o contexto
> técnico crítico. Se você é um agente começando do zero, **leia isto primeiro**.

---

## 1. Resumo executivo

O app **Sync** (Next.js BFF + Flutter, consultoria FUNDEB da Rocha Prime) estava
com o backend Postgres/Supabase **morto** (projeto `pbjlpcqdrbypufleoxnm` apagado)
— todas as telas davam 500. A estratégia adotada foi **migrar os dados para o
Firestore em fatias (strangler fig)**, mantendo o Next como motor de _compute_
(PDFs, levantamento FUNDEB, APIs externas IBGE/FNDE/INEP). O Postgres será
aposentado no fim.

Nesta sessão foram concluídas e mergeadas na `main` **3 fatias** (2.1, 2.2, 2.3)
= a "Frente A" (tirar o app do estado quebrado). Falta a "Frente B" (dinheiro:
comissões/lucro via Cloud Functions) e a aposentadoria do Postgres.

**Branch:** `feat/firestore-collaborators` == `main` (HEAD `81db583`). 33 commits
desde `896bb8e`. Merges foram fast-forward puros (sem conflito, sem force-push).

---

## 2. O que foi feito (fatias concluídas, na main)

### Fase 2.1 — Colaboradores → Firestore (feita em sessão anterior, revisada aqui)
- Coleção `collaborators`, mapper + service + wire no Hybrid, rules + índice.
- Fix visual: card de colaborador usava paleta dark legada (`SyncPalette`) → trocado por `SaaSTokens` (commit `ca771a9`).

### Fase 2.2 — Empresas + Funcionários + logo → Firestore/Storage
- Coleções `companies`, `employees`. Logo no **Firebase Storage** (`company-logos/{groupId}/{companyId}`).
- `estimatedAnnualRevenue` não existe aqui; sem dinheiro nesta fatia.
- Fix do review final: logo era "write-only" → adicionado `CompanyDetails.logo` + render no avatar (commit `ebfa328`).
- Auditoria **adiada** (decisão do usuário).
- Arquivos: `company_firestore_mapper.dart`, `company_firestore_service.dart`, `company_logo_storage.dart`, `new_company_dialog.dart`.

### Fase 2.3 — "Frente A": matar as telas de erro
- **Cidades/Pipeline** (`cities`): CRUD, `estimatedAnnualRevenue` gravado como **`estimatedAnnualRevenueCents` (int)**. Arquivos `city_firestore_mapper.dart`, `city_firestore_service.dart`.
- **Settings** (`workspace_settings/{groupId}`): doc singleton por grupo.
- **Audit/Inbox** (`audit`): leitura só; coleção começa vazia → Inbox degrada vazio (sem escrita de auditoria ainda).
- **Dashboard**: agrega **contagens** do Firestore (cidades/colaboradores/empresas); KPIs de **dinheiro ficam R$ 0** (Frente B fará via Cloud Functions).
- Fix do `setState() após dispose()` no `pipeline_screen.dart` (guardas `mounted`).

### Ferramenta de apoio
- **code-review-graph (CRG) 2.3.7** instalado via `uv tool install` (Python 3.12 isolado). Grafo construído: **12.055 nós, 143.478 arestas, 306 arquivos**. Integração Claude Code (MCP + skills em `.claude/`). Footprint de outras ferramentas foi limpo. **MCP só ativa após restart do Claude Code.**

---

## 3. Estado atual — o que funciona / o que não

| Tela / recurso | Fonte | Estado |
|---|---|---|
| Login | Firebase Auth | ✅ |
| Colaboradores | Firestore | ✅ |
| Minha Empresa (empresas/funcionários/logo) | Firestore + Storage | ✅ |
| Cidades/Pipeline | Firestore | ✅ |
| Configurações | Firestore | ✅ |
| Inbox | Firestore (audit) | ✅ vazio, sem erro |
| Dashboard | Firestore (contagens) | ✅ contagens reais; **dinheiro = R$ 0 de propósito** |
| Levantamento FUNDEB (relatório 25pg) | compute (Next) | ✅ (testado: Inhapi/AL, 25 páginas) |
| Comissões / Lucro / ProfitSnapshot | Postgres | ❌ **não migrado** (Frente B) |
| Documentos (colaborador/empresa) | Supabase Storage (morto) | ❌ **não migrado** |

---

## 4. Pendências do usuário (fazer antes de testar)

1. **Deploy das rules da 2.3** — o guardrail bloqueia deploy pelo agente; o usuário roda:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project globalconsultorias
   ```
   As rules da 2.1 e 2.2 já foram deployadas. **Sem o deploy da 2.3, Cidades/Settings/Inbox falham** (produção nega escrita/leitura nessas coleções).
2. **E2E** — `npm run dev` (porta 3100), aba anônima, confirmar que nenhuma tela dá erro.
3. **Restart do Claude Code** — ativa o MCP do grafo CRG.

---

## 5. Próximas frentes (não feitas, combinadas)

1. **Frente B — dinheiro:** motor de comissões/lucro. O design manda **Cloud Functions** com aritmética inteira em centavos (nunca double no cliente). É a fatia mais arriscada; entidades: `CommissionRule`, `CommissionAccrual`, `CommissionPayout`, `ProfitSnapshot`. Depois disso o Dashboard mostra dinheiro real.
2. **Documentos → Firebase Storage** (colaborador + empresa; hoje apontam pro Supabase morto).
3. **Aposentar Prisma/Postgres** (fase 5 do design) — remover `core/lib/*-data-access.ts`, `@prisma/client`, as rotas CRUD do Next. Irreversível; só depois de tudo migrado e estável.
4. **Ajustes nos relatórios FUNDEB** — o usuário quer mexer no visual/conteúdo dos relatórios (o de 25 páginas do `FundebLevantamentoPdfBuilder`).

---

## 6. Contexto técnico crítico (não óbvio — leia)

### Ambiente / execução
- **Porta dedicada 3100.** A porta 3000 (default do Next) colide com **outro projeto local do usuário, `tick3`** (Next 14), que a ocupa. Todo o dev do Sync foi movido pra **3100** (`run_local.sh` `BACKEND_PORT=3100`, `dev:next -p 3100`, dart-defines). Nunca voltar pra 3000.
- **SDK Flutter pinado:** `~/sync_tooling/flutter/bin/flutter` (3.38.7). O `flutter` do PATH (3.44+) quebra `lucide_icons_flutter` (IconData virou `final class`). Sempre usar o binário pinado.
- **CORS:** `middleware.ts` (Next 16 chama de "proxy") injeta `Access-Control-Allow-Origin: *` — necessário porque o `flutter run -d chrome` serve numa origem diferente da API.
- `run_local.sh` foi endurecido: mata todos os listeners da porta + limpa `.next/dev/lock` preso.

### Padrão de migração (repetir para cada entidade)
1. **Mapper puro** (`*_firestore_mapper.dart`): doc↔modelo, testado com `flutter_test`. `groupId` injetado (nunca do cliente), `deletedAt: null`.
2. **Service** (`*_firestore_service.dart`): CRUD escopado por `groupId` (das claims via `groupIdLoader`), soft delete. Testado com `fake_cloud_firestore`.
3. **Wire** no `HybridSyncRepository` (campo + param no construtor) + `app.dart` (usa `_loadGroupIdFromClaims`). O `widget_test.dart` é o **gate de regressão** do construtor.
4. **Rules** em `firestore.rules` + índice em `firestore.indexes.json` + teste em `firestore-rules-test/*.rules.test.mjs` (emulador). Deploy pelo usuário.

### Regras de ouro
- **Dinheiro é inteiro em centavos, nunca double.** `reaisToCents(r)=(r*100).round()`, `centsToReais(c)=c/100.0`. Ver `city_firestore_mapper.dart`.
- **Isolamento por grupo:** `where('groupId', isEqualTo: groupId)`. As rules dobram a checagem no servidor (o cliente não re-checa em reads/writes por doc-id — decisão aceita, mitigada pelas rules).
- **Soft delete:** filtrar `where('deletedAt', isNull: true)` — **`isNull: true`, NUNCA `isEqualTo: null`** (o SDK e o fake não suportam). Rules negam `delete` real.
- **Cores de `SaaSTokens`** (tema claro), nunca `SyncPalette` (paleta dark legada).

### Gotchas de teste
- **`flutter test` sem path descarta silenciosamente os arquivos Firestore** no Flutter 3.38.7 (reporta verde omitindo-os). **Sempre rodar por PATH EXPLÍCITO** as suites Firestore.
- **Testes de rules no emulador:** rodar com **`node --test --test-concurrency=1`** (multi-arquivo concorrente corre risco de flake no emulador compartilhado). Todos os testes leem `firestore.rules` do **cwd da raiz** (normalizado). Confirmação determinística mais recente: **49/49**.

### Firebase
- Projeto: **`globalconsultorias`**. Service account em `.env.local` (`FIREBASE_SERVICE_ACCOUNT`, gitignored). **A chave foi colada no chat numa sessão antiga — precisa ser rotacionada antes de produção.**
- Custom claims (`groupId`, `groupRole`) via `npm run firebase:claims -- <email> <groupId> <groupRole>`. Grupo de teste: `grupo-1`.
- Firestore Storage foi habilitado no projeto (logo de empresa funciona).

### code-review-graph
- Grafo em `.code-review-graph/` (SQLite, gitignored). Comandos: `code-review-graph status|build|update|impact|architecture|dead-code|query|search`. Binário em `~/.local/bin` (via uv). Skills do Claude Code em `.claude/skills/`. Hook de auto-update em `.claude/settings.json`.

---

## 7. Arquivos-chave

- **Planos:** `docs/superpowers/plans/2026-07-23-fase2-{1,2,3}-*.md`
- **Design da migração:** `docs/superpowers/specs/2026-07-22-migracao-firebase-design.md`
- **Ledger de execução:** `.superpowers/sdd/progress.md` (gitignored — histórico task-a-task)
- **Firestore services/mappers:** `sync_flutter/lib/src/core/data/*_firestore_*.dart`
- **Composição:** `sync_flutter/lib/src/core/repositories/hybrid_sync_repository.dart`, `sync_flutter/lib/src/app/app.dart`
- **Rules:** `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `firestore-rules-test/*.mjs`

---

## 8. Estado do working tree (não commitar sem querer)

- `public/flutter-web/*` — build local (localhost), **nunca commitar**.
- `CLAUDE.md` + `.gitignore` — modificados pelo install do CRG (append de docs do grafo + ignore de `.code-review-graph/`). **Não commitados** — decidir depois se versiona.
- `.claude/skills/`, `.claude/settings.json` — integração CRG, untracked.
- `sync_flutter/test/generate_inhapi_pdf_test.dart` + `test/fixtures/inhapi_payload.json` — harness ad-hoc do relatório, untracked, inofensivo.
- `firestore-debug.log`, `sync_flutter/.backend.pid` — lixo de runtime, gitignorável.
