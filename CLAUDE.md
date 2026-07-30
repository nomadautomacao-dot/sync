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

**Aplicação — Next.js, interface e API no mesmo projeto:**
- Next.js 16 (App Router) + TypeScript — `output: "standalone"`
- React 19 — a interface fica em `app/(auth)/` e `app/(sync)/`
- Firebase Auth + Firestore + Storage — autenticação e dados
- Python 3 + ReportLab/Pillow para geração de PDFs FUNDEB
- Playwright/Chromium para os relatórios em HTML → PDF
- Zod 4 para validação de schemas

**Havia um app Flutter; não há mais.** Ele foi a interface do produto até a
migração para o React e **foi removido do repositório**. Se precisar consultar
como uma tela antiga funcionava, o código está no histórico do git (a remoção é
o último commit que menciona `sync_flutter/`). Não recriar.

**Legado em desativação:**
- Prisma 6 + PostgreSQL (Supabase) — ainda importado por 4 rotas de API
  (`workspace/settings`, `municipalities/[id]`, `case-de-sucesso` ×2) e pelos
  `core/lib/*-data-access.ts`. O build do Next depende de `prisma generate`
  enquanto esses imports existirem. Migrar para o Firestore e então remover.

**Infraestrutura:**
- Google Cloud Run (us-central1) — 2 vCPU, 2GB RAM, timeout 900s
- Google Cloud Build — **deploy contínuo: push na `main` → produção** (seção 7)
- Docker multi-stage (node:22-slim + Python)

---

## 2. Estrutura do Projeto

```
Sync/
├── app/                          # Next.js App Router — interface + API
│   ├── layout.tsx                # Root layout (Inter + JetBrains Mono, AppProviders)
│   ├── globals.css               # Base tipográfica mínima
│   ├── (auth)/                   # Login — /entrar
│   ├── (sync)/                   # A aplicação: painel, cidades, empresas,
│   │                             #   pessoas, modulos, documentos, caixa,
│   │                             #   pipeline, ajustes (ver seção 4)
│   ├── [[...path]]/              # Catch-all → /entrar
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
│   └── superpowers/specs/        # Design docs de refatorações
│
├── functions/                    # Cloud Functions (comissões, lucro)
├── firestore.rules               # Regras do Firestore + firestore.indexes.json
├── CLAUDE.md                     # ← ESTE ARQUIVO
├── README.md                     # Setup rápido
├── Dockerfile                    # Multi-stage build
├── cloudbuild.yaml               # Pipeline de deploy contínuo (seção 7)
├── cloudrun.env.yaml.example     # Template de variáveis
└── package.json                  # Dependências e scripts npm
```

### O que NÃO fica no repositório

Vale a regra: fica no git só o que o Next importa ou executa, ou o que o build
precisa. Documentos de negócio, saídas geradas e
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

Firebase Auth (projeto `globalconsultorias`). O cliente React autentica pelo Web
SDK (`signInWithEmailAndPassword`) e envia o ID token em `Authorization: Bearer`
a cada requisição. `getSessionUser()` em `core/lib/auth.ts` verifica o token com o
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
| `Session` | Sessão customizada legada — token único, expiresAt (hoje a sessão é do Firebase Auth) |
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

## 4. Frontend (React / App Router)

### 4.1 Arquitetura

- React 19 + App Router. A interface e a API são o mesmo projeto Next.
- **Dois grupos de rota:** `app/(auth)/` (público) e `app/(sync)/` (autenticado).
- **Guarda de sessão:** `app/(sync)/layout.tsx` é client component; lê
  `useAuth()` e manda para `/entrar` quem não tem sessão. Enquanto carrega,
  mostra esqueleto do shell — nunca conteúdo.
- **Sessão no browser:** Firebase Web SDK, no IndexedDB. Server Components não
  a enxergam — por isso o catch-all manda para `/entrar`, não para `/painel`.
- **Shell:** `core/components/sync-shell/{header,sidebar}.tsx`, sidebar fixa em
  desktop e gaveta no mobile.
- **Componentes:** `core/components/ui/` (base), `velora/`, `ajustes/`.
- **Providers:** `core/providers/{app-providers,auth-provider}.tsx`.

### 4.2 Telas implementadas

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/entrar` | `app/(auth)/entrar/page.tsx` | Login email/senha |
| `/painel` | `app/(sync)/painel/page.tsx` | Home com KPIs |
| `/cidades` | `app/(sync)/cidades/page.tsx` | Carteira de municípios |
| `/cidades/[cityId]` | `app/(sync)/cidades/[cityId]/page.tsx` | Ficha da cidade + relatórios arquivados |
| `/pipeline` | `app/(sync)/pipeline/page.tsx` | Pipeline comercial por estágio |
| `/empresas` | `app/(sync)/empresas/page.tsx` | CRUD com detalhe e funcionários |
| `/pessoas` | `app/(sync)/pessoas/page.tsx` | Colaboradores cross-empresa |
| `/modulos` | `app/(sync)/modulos/page.tsx` | Catálogo de módulos |
| `/modulos/levantamento-fundeb` | `app/(sync)/modulos/levantamento-fundeb/page.tsx` | Os três relatórios (seção 5) |
| `/documentos` | `app/(sync)/documentos/page.tsx` | Kit documental |
| `/caixa` | `app/(sync)/caixa/page.tsx` | Inbox / auditoria |
| `/ajustes` | `app/(sync)/ajustes/page.tsx` | Configurações do workspace |

### 4.3 Design System

**A fonte de verdade é `DESIGN.md`, na raiz** — tokens de cor, tipografia e
espaçamento em frontmatter estruturado. Não duplicar valores aqui: ler de lá.

Direção atual: **"Console Soft"** — glassmorphism, neutros lavanda, accent
quase-preto (`#16181D`), cards glass flutuantes, gradientes pastel no pipeline.

O hook de design (`impeccable`) valida aderência e está configurado para
**ignorar `core/lib/*-template.ts`** (`.impeccable/config.json`): templates de
impressão seguem regra de papel, não o design system da web.

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
> A interface de cada módulo é uma página em `app/(sync)/modulos/<nome>/`.

### Registrar novo módulo
1. Adicionar a key ao `moduleCatalog` em `core/domain/module.ts` — a tela
   `/modulos` lê esse catálogo via `/api/modules`
2. Criar as rotas em `app/api/modulos/<nome>/`
3. Se houver lógica de domínio reaproveitável, criar `modules/<nome>/`
4. Criar a página em `app/(sync)/modulos/<nome>/page.tsx`
5. Se precisar persistir: coleção no Firestore + regra em `firestore.rules`
   (**não** criar migration Prisma — é legado em desativação)

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

### Modelo de trabalho: uma branch só

O repositório tem **apenas `main`**. Não se cria branch, não se abre PR: é um
ambiente de um desenvolvedor só. Trabalha-se direto na `main` e **o push é o
deploy**.

### Deploy contínuo (push na main → produção)

Um trigger do Cloud Build observa a `main` no GitHub. A cada push ele roda o
`cloudbuild.yaml`, em sequência:

1. **`test`** — `npm ci` + `prisma generate` + `npm test`. **É o gate:** se a
   suíte falha, o build aborta e a produção continua na revisão anterior.
2. **`build`** — imagem Docker (`gcr.io/opus-sec/sync-app:$BUILD_ID`).
3. **`push`** — envia a imagem ao registry.
4. **`deploy`** — `gcloud run deploy` no serviço `sync-app`. Troca só a imagem;
   **as variáveis de ambiente já configuradas no serviço são preservadas**.

Consequência prática: **commit quebrado não derruba o ar, mas commit que passa
nos testes vai direto para os usuários.** Não existe staging.

Acompanhar um deploy: console do Cloud Build, ou `gcloud builds list --limit=5`.
Reverter: `gcloud run services update-traffic sync-app --to-revisions=<revisão-anterior>=100 --region=us-central1`.

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
# Subir para produção — é isto e mais nada
git push

# Dev local (Next na porta 3100)
npm run dev

# Rodar o gate localmente antes de dar push
npm test

# Docker local
docker build -t sync-app . && docker run -p 3000:3000 sync-app
```

Os scripts `scripts/deploy/deploy-cloudrun-{linux.sh,.ps1}` continuam no repo
como **saída de emergência** (deploy manual quando o trigger está fora do ar).
No fluxo normal não se usa nenhum dos dois.

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
- React: `kebab-case.tsx` | Utils: `kebab-case.ts` | Docs: `kebab-case.md`

### Fluxo de trabalho
- **Só existe a `main`.** Não criar branch, não abrir PR — é um ambiente de um
  desenvolvedor só.
- **Push é deploy.** Rodar `npm test` antes de empurrar; o gate na nuvem repete
  a suíte e barra o que quebrar (seção 7).

### Linguagem
- **Código:** inglês | **Labels/dados:** português | **Docs:** português | **Commits:** inglês (Conventional Commits)

### Padrões
- Validação: Zod schemas em `core/domain/`
- API routes: `getSessionUser()` obrigatório, Zod parse, audit log em writes
- Estado de servidor: TanStack Query (`staleTime: 5min`). Estado de UI: `useState`
  local — não há store global no projeto.
- Imports: `@/core/`, `@/modules/`, `@/data/`

### RBAC
- **GroupRole:** `owner > admin > member > viewer`
- **CompanyRole:** `director > manager > coordinator > analyst > operator`
- **ModulePermission:** `admin > write > read`

### O que NÃO está implementado
- Módulos: Terceirização, Formação, Atas, Tecnologia, RH, Financeiro — existem
  como chaves no `moduleCatalog` (a tela `/modulos` as exibe), sem rota nem tela
- Testes de ponta a ponta (a suíte é de unidade/integração: 343 testes, Vitest)
- **Staging separado de produção** — o deploy da `main` vai direto ao ar
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
