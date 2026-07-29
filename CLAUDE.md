# CLAUDE.md — Sync

> Fonte única de verdade para qualquer agente de IA trabalhando neste projeto.
> Atualizado: 2026-07-22.

---

## 1. Visão Geral

**Sync** é uma plataforma de gestão e automação para a **Rocha Prime Consultorias**, focada em consultoria educacional FUNDEB para municípios brasileiros.

### O que faz
1. Gera levantamentos financeiros automáticos de municípios (dados IBGE, FNDE, INEP, TSE, SICONFI, QEdu, IDEB)
2. Produz relatórios técnicos/comerciais para prospecção B2G
3. Automatiza geração de kits documentais de inexigibilidade (Lei 14.133/21)
4. Gerencia pipeline de cidades, contratos, colaboradores e comissões

### Para quem
| Persona | Descrição |
|---------|-----------|
| **Consultor de campo** | Usa o app em tablets/notebooks durante reuniões com gestores municipais |
| **Gestor municipal** | Recebe relatórios e propostas gerados pelo sistema |
| **Admin do grupo** | Visão completa de todas as empresas, módulos e funcionários |
| **Coordenador de módulo** | Opera dentro de módulo específico (FUNDEB, Consultoria) |

### Stack tecnológico

**Backend (BFF):**
- Next.js 16 (App Router) + TypeScript — `output: "standalone"`
- Prisma 6 + PostgreSQL (Supabase) — dual URL (pooler + direct)
- Firebase Auth (verificação de ID token via `firebase-admin`) — ver seção 3.2
- Python 3 + ReportLab/Pillow para geração de PDFs FUNDEB
- Zod 4 para validação de schemas

**O Next não tem interface própria.** O único `page.tsx` é o catch-all que
redireciona para `/flutter-web/`; toda a UI é o app Flutter. O papel do Next é
servir as rotas de API, gerar documentos (docx/docxtemplater, jsPDF, ReportLab
via Python) e entregar o build web do Flutter em `public/flutter-web/`.

**Frontend Mobile (Flutter):**
- Flutter SDK ^3.10.7, Dart
- Material Design 3 (em redesign)
- Plataforma-alvo: Android (smartphones), Linux (dev)
- Dependências: fl_chart, pdf, printing, http, shared_preferences, lucide_icons_flutter, intl, file_picker, archive, share_plus, url_launcher, flutter_svg, path_provider
- Assets embarcados: `censo_matriculas.json`, `ideb_historico.json`, branding SVGs

**Infraestrutura:**
- Google Cloud Run (us-central1) — 2 vCPU, 2GB RAM, timeout 900s
- Google Cloud Build (CI/CD via `cloudbuild.yaml`)
- Docker multi-stage (node:20-alpine + Python)

---

## 2. Estrutura do Projeto

```
Sync/
├── app/                          # Next.js App Router — só API + redirect
│   ├── layout.tsx                # Root layout (Inter + JetBrains Mono, AppProviders)
│   ├── globals.css               # Base tipográfica mínima
│   ├── [[...path]]/              # Catch-all → redireciona para /flutter-web/
│   ├── flutter-web/              # Serve o Flutter Web build
│   └── api/                      # API Routes (BFF) — ver seção 3
│
├── core/                         # Código compartilhado (server-side)
│   ├── domain/                   # Modelos de domínio (Zod schemas + interfaces)
│   │   ├── module.ts             # moduleCatalog
│   │   ├── organization.ts       # Company, Employee + validação CNPJ
│   │   ├── collaboration.ts      # Collaborator, Municipality, Commission
│   │   ├── fundeb-consulting.ts  # FundebConsultingProject
│   │   └── rbac.ts               # GroupRole
│   ├── lib/                      # Utilitários server-side (ver seção 3.3)
│   └── providers/app-providers.tsx
│
├── modules/                      # Lógica de negócio consumida pelas rotas
│   ├── levantamento-fundeb/      # types + utils (cálculos, ptbr, relatório)
│   ├── contrato-fundeb/          # services (agent, docx, collectors) + types
│   └── propostas/                # types + utils de cálculo
│
├── prisma/schema.prisma          # Schema completo (ver seção 3.4)
├── scripts/                      # Ferramentas — ver seção 8
│   ├── deploy/                   # Cloud Run (Linux e Windows)
│   ├── db/                       # Supabase (check, bootstrap, clean)
│   ├── dados/                    # Pipelines INEP / IDEB / TSE
│   └── pdf/                      # Comparação e análise de PDFs, templates DOCX
├── data/                         # JSONs derivados (IDEB, INEP, TSE) + fnde/*.csv
│                                 #   Entram por `import from "@/data/..."` → bundlados
│                                 #   no build. Fontes brutas ficam em Sync-Arquivos/.
├── kit_padrao_pdf_rocha_prime/   # Módulo Python de geração de PDFs FUNDEB
├── docs/                         # Specs, roadmaps e análises (kebab-case)
│   ├── specs/                    # Specs de produto
│   ├── roadmaps/                 # Roadmaps de automação
│   ├── analises-fundeb/          # Auditorias e validações de modelo FUNDEB
│   ├── flutter/                  # Docs do app Flutter
│   └── superpowers/specs/        # Design docs de refatorações
│
├── sync_flutter/                 # App Flutter — a interface do produto
│   └── lib/src/
│       ├── core/                 # Models, repositories, services, theme
│       └── features/             # auth, dashboard, cities, modules, people, shell
│
├── CLAUDE.md                     # ← ESTE ARQUIVO
├── README.md                     # Setup rápido
├── Dockerfile                    # Multi-stage build
├── cloudbuild.yaml               # Pipeline Cloud Build
├── cloudrun.env.yaml.example     # Template de variáveis
├── run-local.sh                  # Inicia Next.js + Flutter Linux juntos
└── package.json                  # Dependências e scripts npm
```

### O que NÃO fica no repositório

Vale a regra: fica no git só o que o Next importa ou executa, o que o Flutter
compila, ou o que o build precisa. Documentos de negócio, saídas geradas e
fontes brutas vivem em `../Sync-Arquivos/`, pasta irmã fora do git.

```
Sync-Arquivos/
├── assets-contratos/     Anexos_DOCX, Anexos_TXT, Habilitacao_PRIME  → CONTRATOS_ASSETS_DIR
├── dados-brutos/         XLSX do INEP, sinopses, payloads            → DADOS_BRUTOS_DIR
├── kits-entregues/       kits de inexigibilidade por município
├── relatorios-gerados/   saída dos geradores de PDF
├── modelos-processo/     modelos .doc de processo administrativo
├── documentos-empresa/   contratos sociais, alterações, propostas
├── habilitacao/          certidões avulsas
├── apresentacoes/        PDFs de apresentação
├── ferramentas/          toolkit Python de slides, geradores .dart ad-hoc, scripts arquivados
├── fontes-fundeb/        portarias de complementação FUNDEB
└── inbox/                material ainda sem classificação
```

Duas variáveis de ambiente ligam o código a essa pasta, ambas com fallback para
o caminho antigo (`./contratos` e `./data`) — ver `.env.example` e
`core/lib/assets-paths.ts`. Ao adicionar um PDF, ZIP ou DOCX ao projeto,
o destino é `Sync-Arquivos/`, não o repositório.

Contexto completo da separação:
`docs/superpowers/specs/2026-07-22-reorganizacao-estrutura-design.md`

---

## 3. Backend (Next.js)

### 3.1 API Routes — Mapa completo

Todas as rotas estão em `app/api/`. Autenticação obrigatória via `getSessionUser()`.

**Autenticação:** não há rotas de login no Next. O Firebase Auth cuida disso no
cliente; as rotas apenas verificam o ID token. Ver seção 3.2.

**Organizacional:**
| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/companies` | GET/POST | Listar/criar empresas do grupo |
| `/api/companies/[companyId]` | GET/PUT/DELETE | CRUD empresa específica |
| `/api/companies/upload-logo` | POST | Upload de logo da empresa |
| `/api/employees` | GET/POST | Listar/criar funcionários |
| `/api/audit` | GET | Logs de auditoria |
| `/api/dashboard/executive` | GET | KPIs executivos cross-empresa |
| `/api/workspace/settings` | GET/PUT | Configurações do workspace |

**Colaboradores e Municípios:**
| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/collaborators` | GET/POST | CRUD colaboradores (parceiros, articuladores) |
| `/api/collaborators/[id]` | GET/PUT/DELETE | Colaborador específico |
| `/api/collaborators/[id]/dashboard` | GET | Indicadores do colaborador |
| `/api/collaborators/[id]/documents` | GET/POST | Documentos do colaborador |
| `/api/collaborators/[id]/documents/[docId]` | GET/DELETE | Documento específico |
| `/api/municipalities` | GET/POST | CRUD contas municipais |
| `/api/municipalities/[id]` | PUT/DELETE | Conta municipal específica |
| `/api/municipios/buscar` | GET | Busca de municípios por nome |
| `/api/municipios/carteira` | GET | Carteira de municípios |
| `/api/municipios/recentes` | GET | Municípios acessados recentemente |
| `/api/municipio/completo` | GET | Levantamento completo de município |
| `/api/fundeb-consulting` | GET/POST | Projetos de consultoria FUNDEB |

**Módulos de negócio:**
| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/modulos/levantamento-fundeb/[codigoIbge]` | GET | Dados FUNDEB por código IBGE |
| `/api/modulos/levantamento-fundeb/autonomo` | GET | Levantamento autônomo |
| `/api/modulos/levantamento-fundeb/batch` | POST | Levantamento em lote |
| `/api/modulos/levantamento-fundeb/censo-inep` | GET | Dados do Censo INEP |
| `/api/modulos/levantamento-fundeb/pdf` | POST | Geração de PDF (Python/ReportLab) |
| `/api/modulos/levantamento-fundeb/relatorio-dirigido` | POST | Relatório dirigido com IA |
| `/api/modulos/levantamento-fundeb/raio-x` | POST | Raio-X municipal em PDF |
| `/api/modulos/contrato-fundeb` | POST | Monta contrato a partir do levantamento |
| `/api/modulos/case-de-sucesso` | GET | Lista de cases |
| `/api/modulos/case-de-sucesso/[municipio]` | GET | Case de um município |
| `/api/modulos/slides` | GET | Templates de apresentação |
| `/api/modulos/slides/gerar` | POST | Gera o deck em PDF |
| `/api/contratos-fundeb/agent` | POST | Agent de coleta de dados do contrato |
| `/api/contratos-fundeb/generate-kit` | POST | Kit documental (rota legada) |
| `/api/modulos/contrato-fundeb/gerar-kit` | POST | Kit documental parcial |
| `/api/modulos/contrato-fundeb/gerar-kit-completo` | POST | Kit completo (15 anexos) |
| `/api/modulos/contrato-fundeb/gerar-proposta` | POST | Proposta comercial |

**Outros:**
| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/health` | GET | Health check (status, timestamp, uptime) |
| `/api/modules` | GET | Catálogo de módulos disponíveis |
| `/api/propostas/prefill` | GET | Pre-fill de propostas com dados públicos |
| `/api/propostas/validate-public-data` | POST | Valida dados públicos da proposta |
| `/api/reference/brazil-minimum-wage` | GET | Salário mínimo vigente |

### 3.2 Sistema de autenticação

Firebase Auth (projeto `globalconsultorias`). O Flutter autentica pelo SDK
(`signInWithEmailAndPassword`) e envia o ID token em `Authorization: Bearer` a
cada requisição. `getSessionUser()` em `core/lib/auth.ts` verifica o token com o
Admin SDK (`firebase-admin`) e lê `groupId` e `groupRole` das custom claims —
sem consultar banco. Devolve `null` em qualquer falha; as rotas tratam como 401.

Para conceder acesso a um usuário:

    npm run firebase:claims -- <email> <groupId> <groupRole>

As claims valem a partir do próximo token: o usuário refaz login. A service
account fica em `FIREBASE_SERVICE_ACCOUNT` (`.env.local`), nunca versionada.

> A migração é fase 1 de uma transição maior para Firebase — ver
> `docs/superpowers/specs/2026-07-22-migracao-firebase-design.md`. Os **dados**
> ainda vivem no Postgres/Prisma (fase 2 os move para o Firestore).

### 3.3 core/lib/ — Arquivos e funções

| Arquivo | Descrição |
|---------|-----------|
| `auth.ts` | `getSessionUser()` — verifica o ID token do Firebase |
| `auth-token.ts` | `bearerToken()`, `sessionUserFromClaims()` — parsing puro, testável |
| `firebase-admin.ts` | Cliente do Admin SDK (lê `FIREBASE_SERVICE_ACCOUNT`) |
| `assets-paths.ts` | Resolve `CONTRATOS_ASSETS_DIR` |
| `prisma.ts` | Singleton do Prisma Client |
| `data-access.ts` (19KB) | Acesso a dados organizacionais (empresas, funcionários, audit) |
| `collaboration-data-access.ts` (22KB) | CRUD colaboradores, municípios, comissões |
| `fundeb-consulting-data-access.ts` (7KB) | CRUD projetos FUNDEB |
| `govia-compat.ts` (48KB) | Camada de compatibilidade com sistema legado GovIA |
| `fundeb-fnde.ts` (12KB) | Integração com dados FNDE (repasses FUNDEB) |
| `fundeb-estimate.ts` (10KB) | Cálculos de estimativa FUNDEB |
| `fundeb-comparative.ts` (19KB) | Análise comparativa entre municípios |
| `fundeb-directed-report.ts` (26KB) | Geração de relatório dirigido com IA/Gemini |
| `fnde-public.ts` (20KB) | Dados públicos do FNDE |
| `fnde-obras.ts` (17KB) | Obras FNDE |
| `ibge-cidade-indicators.ts` | Indicadores de cidade via API IBGE |
| `ideb-municipal.ts` | Dados IDEB municipal |
| `inep-censo.ts` | Dados do Censo Escolar INEP |
| `qedu-api.ts` (10KB) | Cliente API QEdu |
| `qedu-indicators.ts` (14KB) | Indicadores QEdu |
| `siconfi-fiscal.ts` (14KB) | Dados fiscais SICONFI (Tesouro Nacional) |
| `tse-prefeitos.ts` | Dados de prefeitos eleitos (TSE) |
| `python-runtime.ts` | Executor de scripts Python (ReportLab) |

### 3.4 Schema do banco (Prisma)

PostgreSQL via Supabase. Dual connection: `DATABASE_URL` (pooler, porta 6543) + `DIRECT_URL` (direct, porta 5432).

**Modelos core:**
| Modelo | Descrição |
|--------|-----------|
| `Group` | Grupo empresarial raiz → Company[], Collaborator[], User[] |
| `Company` | Empresa do grupo → Employee[], enabledModules: String[] |
| `User` | Usuário do sistema (groupRole: owner/admin/member/viewer) |
| `Employee` | Vínculo user↔company, @@unique([userId, companyId]) |
| `Session` | Sessão customizada (Flutter) — token único, expiresAt |
| `AuditLog` | Log de auditoria — action, userId, metadata (Json) |

**Modelos de colaboração:**
| Modelo | Descrição |
|--------|-----------|
| `Collaborator` | Parceiro/articulador com dados de comissão |
| `MunicipalityAccount` | Conta municipal no pipeline (13 estágios) |
| `CollaboratorParticipation` | Participação de colaborador em município |
| `ServiceImplementation` | Implantação de serviço com status de fidelização |

**Modelos financeiros:**
| Modelo | Descrição |
|--------|-----------|
| `ProfitSnapshot` | Snapshot mensal de receita/custo/lucro por município |
| `CommissionRule` | Regra de comissão (%, tipo, gatilho) |
| `CommissionAccrual` | Provisão mensal de comissão |
| `CommissionPayout` | Pagamento de comissão |

**Enums:** `CollaboratorType` (8 tipos), `MunicipalityStage` (13 estágios), `CommissionBaseType` (5), `FidelityStatus` (6), `AccrualStatus` (6), `PayoutStatus` (5).

---

## 4. Frontend (Flutter)

### 4.1 Arquitetura

- Estado: `ChangeNotifier`
- Repositório: `RemoteSyncRepository` (chamadas à API Next.js)
- Shell responsivo: drawer em mobile, sidebar fixa em desktop
- Autenticação: Firebase Auth (ID token em Authorization: Bearer)

### 4.2 Telas implementadas

| Tela | Arquivo | Descrição |
|------|---------|-----------|
| Dashboard | `dashboard_screen.dart` | Home com KPIs |
| Empresas | `companies_screen.dart` | CRUD com detalhe e funcionários |
| Pessoas | `people_screen.dart` | Lista cross-empresa |
| Cidades | `cities_screen.dart` | Pipeline de municípios |
| Módulos | `modules_screen.dart` | Catálogo de módulos |
| Levantamento FUNDEB | `levantamento_fundeb_screen.dart` (83KB) | Diagnóstico completo |
| Levantamento Lite | `levantamento_fundeb_lite_screen.dart` (29KB) | Infográfico 2 páginas |
| Case de Sucesso | `case_sucesso_screen.dart` (15KB) | Análise FUNDEB |
| Contrato FUNDEB | `contrato_capa_capa_screen.dart` (99KB) | Kit 15 anexos |
| Kit Documental | `kit_documental_screen.dart` (20KB) | Gestão de documentos |
| Settings | `settings_screen.dart` | Configurações |
| Login | `auth/` | Email/senha |

### 4.3 Design System

- Cor primária: `#1B2A4A` (Rocha Prime Navy)
- Cor accent: `#2F6BFF`
- Fundo: `#EEF1F6` (scaffold), `#FFFFFF` (cards)
- Tipografia: Inter (variável), escala 1.125
- Espaçamento: base 4dp, input height 48dp
- Corner radius: cards 12dp, buttons 10dp
- Sem sombras em cards, apenas bordas 1px

---

## 5. Módulos de Negócio

### Módulos ativos

| Módulo | Key | Descrição |
|--------|-----|-----------|
| **Consultoria** | `consultoria` | Gestão de projetos, contratos e entregas |
| **Consultoria FUNDEB** | `fundeb` | Pipeline de municípios, projeção de faturamento |
| **Levantamento FUNDEB** | `levantamento-fundeb` | Diagnóstico automático por código IBGE |
| **Contrato FUNDEB** | `contrato-fundeb` | Processo administrativo com 15 anexos (Lei 14.133/21) |
| **Case de Sucesso** | `case-de-sucesso` | Evolução VAAF/VAAT/VAAR 2024-2025 |
| **Propostas** | `propostas` | Propostas comerciais padronizadas |

> `modules/` guarda apenas lógica server-side consumida pelas rotas de API.
> A interface de cada módulo é uma tela em `sync_flutter/lib/src/features/`.

### Registrar novo módulo
1. Adicionar a key ao `moduleCatalog` em `core/domain/module.ts` — o Flutter lê
   esse catálogo via `/api/modules`
2. Criar as rotas em `app/api/modulos/<nome>/`
3. Se houver lógica de domínio reaproveitável, criar `modules/<nome>/`
4. Criar a tela em `sync_flutter/lib/src/features/modules/presentation/`
5. Migration Prisma se necessário

---

## 6. Dados e Integrações

| Fonte | Arquivo | Dados |
|-------|---------|-------|
| **IBGE** | `ibge-cidade-indicators.ts` | População, PIB, indicadores |
| **FNDE** | `fnde-public.ts`, `fundeb-fnde.ts` | Repasses FUNDEB (VAAF, VAAT, VAAR) |
| **INEP** | `inep-censo.ts` | Censo Escolar (matrículas, escolas) |
| **SICONFI** | `siconfi-fiscal.ts` | Dados fiscais do Tesouro Nacional |
| **QEdu** | `qedu-api.ts` | Indicadores educacionais (requer `QEDU_TOKEN`) |
| **IDEB** | `ideb-municipal.ts` | Índice de Desenvolvimento da Educação |
| **TSE** | `tse-prefeitos.ts` | Prefeitos eleitos |
| **SIMEC** | `simec-obras.ts` | Obras MEC/FNDE |

---

## 7. Deploy

### Cloud Run

- **Serviço:** `sync-app` | **Projeto GCP:** `opus-sec`
- **Região:** `us-central1`
- **Recursos:** 2 vCPU, 2GB RAM, timeout 900s, 0-10 instâncias
- **URL:** `https://sync-app-n7cfomhaaq-uc.a.run.app`

### Variáveis obrigatórias

```yaml
DATABASE_URL: "postgresql://..."     # Supabase pooler (porta 6543) — dados (fase 2 migra p/ Firestore)
DIRECT_URL: "postgresql://..."       # Supabase direct (porta 5432)
FIREBASE_SERVICE_ACCOUNT: '{...}'    # JSON da service account (globalconsultorias) — verifica o ID token
NODE_ENV: "production"
```

### Comandos

```bash
# Deploy completo (Linux)
./scripts/deploy/deploy-cloudrun-linux.sh

# Dev local (Next.js + Flutter Linux)
./run-local.sh

# Build Flutter Web para produção
npm run build:flutter:web

# Docker local
docker build -t sync-app . && docker run -p 3000:3000 sync-app
```

---

## 8. Scripts Úteis

### Banco
| Script | Comando npm | Descrição |
|--------|------------|-----------|
| `db/supabase-check.mjs` | `supabase:check` | Valida conexão |
| `db/supabase-bootstrap.mjs` | `supabase:bootstrap` | Setup completo do banco |
| `db/supabase-clean.mjs` | `supabase:clean` | Limpa e recria mínimo |

### Deploy
| Script | Descrição |
|--------|-----------|
| `deploy/deploy-cloudrun-linux.sh` | Deploy Cloud Run (Linux) |
| `deploy/deploy-cloudrun.ps1` | Deploy Cloud Run (Windows) |

### Dados
| Script | Descrição |
|--------|-----------|
| `dados/build-inep-censo-municipal-dataset.py` | Dataset municipal INEP |
| `dados/gerar-tse-prefeitos.py` | Dados TSE prefeitos |
| `dados/gerar-ideb-municipios.py` | Dados IDEB |
| `dados/gerar-caged-municipios.mjs` | `npm run dados:caged` — snapshot do Novo CAGED (IPEADATA). Regerar mensalmente |
| `dados/gerar-remuneracao-docente.mjs` | `npm run dados:remuneracao` — remuneração do magistério e adimplência ao piso (SIOPE). Agrega na coleta; não persiste dado pessoal |
| `dados/gerar-siope-indicadores.mjs` | `npm run dados:siope` — vinculações da educação por município (SIOPE, API OData sem captcha) |
| `dados/gerar-matriculas-ponderadas.mjs` | `npm run dados:ponderadas` — matrícula ponderada e fatores oficiais do FUNDEB, derivados da planilha do FNDE |
| `dados/gerar-vaar-municipios.mjs` | `npm run dados:vaar` — status das 5 condicionalidades do VAAR e valores por município (FNDE). Regerar a cada portaria quadrimestral |
| `pdf/prepare-docx-templates.mjs` | Templates DOCX contratos |

---

## 9. Convenções

### Nomes
- React: `kebab-case.tsx` | Dart: `snake_case.dart` | Utils: `kebab-case.ts`

### Linguagem
- **Código:** inglês | **Labels/dados:** português | **Docs:** português | **Commits:** inglês (Conventional Commits)

### Padrões
- Validação: Zod schemas em `core/domain/`
- API routes: `getSessionUser()` obrigatório, Zod parse, audit log em writes
- Hooks: TanStack Query com `staleTime: 5min`
- Estado: Zustand (UI) + TanStack Query (server data)
- Imports: `@/core/`, `@/components/`, `@/modules/`, `@/lib/`

### RBAC
- **GroupRole:** `owner > admin > member > viewer`
- **CompanyRole:** `director > manager > coordinator > analyst > operator`
- **ModulePermission:** `admin > write > read`

### O que NÃO está implementado
- Módulos: Terceirização, Formação, Atas, Tecnologia, RH, Financeiro — existem
  como chaves no `moduleCatalog` (o Flutter as exibe), sem rota nem tela
- Testes automatizados (Vitest, Playwright)
- CI/CD via GitHub Actions (usa Cloud Build manual)
- Staging separado de produção
- Monitoramento (Sentry, Axiom)

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.
