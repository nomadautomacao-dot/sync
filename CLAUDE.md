# CLAUDE.md — Sync

> Fonte única de verdade para qualquer agente de IA trabalhando neste projeto.
> Atualizado: 2026-05-27.

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
- NextAuth v4 (JWT, Google OAuth) + login customizado por cookie (Flutter)
- Python 3 + ReportLab/Pillow para geração de PDFs FUNDEB
- Zod 4 para validação de schemas

**Frontend Web (Next.js):**
- Tailwind CSS 4 + design tokens customizados
- TanStack Query 5 + Zustand 5 (estado)
- Radix UI (avatar, dialog, dropdown, popover, separator, slot, scroll-area)
- cmdk (command palette), Sonner (toasts), Recharts (gráficos)
- Framer Motion (animações), Lucide React (ícones)
- docx/docxtemplater + jsPDF/jspdf-autotable (geração de documentos)

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
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (Inter + JetBrains Mono, AppProviders)
│   ├── globals.css               # Design tokens CSS
│   ├── [[...path]]/              # Catch-all → redireciona para /flutter-web/
│   ├── flutter-web/              # Serve Flutter Web build
│   └── api/                      # API Routes (BFF) — ver seção 3
│
├── core/                         # Código compartilhado
│   ├── config/navigation.ts      # Itens da sidebar
│   ├── domain/                   # Modelos de domínio (Zod schemas + interfaces)
│   │   ├── module.ts             # ModuleKey, ModuleDefinition, moduleCatalog
│   │   ├── organization.ts       # Company, Employee schemas + validação CNPJ
│   │   ├── collaboration.ts      # Collaborator, Municipality, Commission schemas
│   │   ├── fundeb-consulting.ts  # FundebConsultingProject schemas
│   │   └── rbac.ts               # GroupRole, CompanyRole, ModulePermission
│   ├── hooks/                    # React hooks (TanStack Query)
│   ├── lib/                      # Utilitários server-side (ver seção 3.3)
│   ├── providers/app-providers.tsx
│   └── stores/                   # Zustand (sidebar-store, workspace-store)
│
├── components/                   # UI reutilizáveis
│   ├── ui/                       # Primitivos Radix: button, input, badge, avatar, card, etc.
│   ├── layout/                   # sidebar, header, three-pane-layout
│   ├── shared/                   # data-table, stat-card, status-badge, etc.
│   └── forms/                    # company-form, employee-form, module-config-form
│
├── modules/                      # Módulos de negócio isolados
│   ├── dashboard/                # Dashboard consolidado do grupo
│   ├── consultoria/              # Projetos de consultoria
│   ├── fundeb/                   # Consultoria FUNDEB (municípios, comissões)
│   ├── levantamento-fundeb/      # Diagnóstico automático por código IBGE
│   ├── contrato-fundeb/          # Geração de processo administrativo (15 anexos)
│   ├── case-de-sucesso/          # Análise evolução FUNDEB 2024-2025
│   └── propostas/                # Propostas comerciais
│
├── lib/auth.ts                   # Login customizado por email/senha (Flutter)
├── prisma/schema.prisma          # Schema completo (ver seção 3.4)
├── scripts/                      # Scripts auxiliares (ver seção 8)
├── data/                         # Dados estáticos (IDEB, INEP, TSE)
├── kit_padrao_pdf_rocha_prime/   # Módulo Python de geração de PDFs FUNDEB
├── docs/                         # Specs de negócio e roadmaps
│   ├── specs/                    # Specs de produto (colaboradores, case sucesso)
│   ├── roadmaps/                 # Roadmaps de automação
│   └── flutter/                  # Docs específicos do Flutter
│
├── sync_flutter/                 # App Flutter (ver seção 4)
│   └── lib/src/
│       ├── core/                 # Models, repositories, services, theme
│       └── features/             # auth, dashboard, cities, modules, people, shell
│
├── contratos/                    # Templates DOCX de contratos
├── apresentacao/                 # Scripts de geração de apresentações
├── complementacao/               # PDFs de complementação FUNDEB (fonte)
├── documents/                    # Documentos corporativos
│
├── CLAUDE.md                     # ← ESTE ARQUIVO
├── README.md                     # Setup rápido
├── Dockerfile                    # Multi-stage build
├── cloudbuild.yaml               # Pipeline Cloud Build
├── cloudrun.env.yaml.example     # Template de variáveis
├── run-local.sh                  # Inicia Next.js + Flutter Linux juntos
└── package.json                  # Dependências e scripts npm
```

---

## 3. Backend (Next.js)

### 3.1 API Routes — Mapa completo

Todas as rotas estão em `app/api/`. Autenticação obrigatória via `getSessionUser()`.

**Autenticação:**
| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth (Google OAuth, JWT) |
| `/api/auth/login` | POST | Login por email/senha (Flutter) — gera session_token cookie |
| `/api/auth/logout` | POST | Invalida sessão customizada |
| `/api/auth/session` | GET | Retorna sessão atual |

**Organizacional:**
| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/companies` | GET/POST | Listar/criar empresas do grupo |
| `/api/companies/[companyId]` | GET/PUT/DELETE | CRUD empresa específica |
| `/api/employees` | GET/POST | Listar/criar funcionários |
| `/api/audit` | GET | Logs de auditoria |
| `/api/dashboard/executive` | GET | KPIs executivos cross-empresa |
| `/api/workspace/settings` | GET/PUT | Configurações do workspace |

**Colaboradores e Municípios:**
| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/collaborators` | GET/POST | CRUD colaboradores (parceiros, articuladores) |
| `/api/municipalities` | GET/POST | CRUD contas municipais |
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
| `/api/modulos/contrato-fundeb/gerar-kit` | POST | Kit documental parcial |
| `/api/modulos/contrato-fundeb/gerar-kit-completo` | POST | Kit completo (15 anexos) |
| `/api/modulos/contrato-fundeb/gerar-proposta` | POST | Proposta comercial |
| `/api/contratos-fundeb/agent/populate-municipality` | POST | Agent de população de dados |

**Dados educacionais:**
| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/education/diagnostico` | GET | Diagnóstico educacional |
| `/api/education/escolas` | GET | Dados de escolas |
| `/api/education/oportunidades` | GET | Oportunidades educacionais |

**Outros:**
| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/health` | GET | Health check (status, timestamp, uptime) |
| `/api/modules` | GET | Catálogo de módulos disponíveis |
| `/api/propostas/prefill` | GET | Pre-fill de propostas com dados públicos |
| `/api/reference/brazil-minimum-wage` | GET | Salário mínimo vigente |
| `/api/simec/obras` | GET | Obras SIMEC/FNDE |

### 3.2 Sistema de autenticação

Duas estratégias coexistem:

1. **NextAuth (Google OAuth)** — JWT strategy, provider Google. Usado pelo frontend web. Callback `signIn` faz upsert do usuário no banco. Token JWT carrega `appUserId`, `groupId`, `groupRole`.

2. **Login customizado (Flutter)** — `POST /api/auth/login` com email/senha. Valida contra `SYNC_LOGIN_EMAIL`/`SYNC_LOGIN_PASSWORD` (env vars). Gera token aleatório de 32 bytes, salva na tabela `Session`, retorna cookie `session_token` com validade de 7 dias.

`getSessionUser()` em `core/lib/auth.ts` tenta NextAuth primeiro, depois fallback para cookie `session_token`.

### 3.3 core/lib/ — Arquivos e funções

| Arquivo | Descrição |
|---------|-----------|
| `auth.ts` | Config NextAuth, `getSessionUser()`, upsert de usuário |
| `prisma.ts` | Singleton do Prisma Client |
| `api-client.ts` | Wrapper fetch tipado para chamadas client-side |
| `utils.ts` | `cn()` (clsx+tailwind-merge), formatters |
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
- Autenticação: login por cookie via `POST /api/auth/login`

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

### Registrar novo módulo
1. Adicionar key ao array `moduleKeys` em `core/domain/module.ts`
2. Adicionar definição ao `moduleCatalog`
3. Criar pasta em `modules/<nome>/`
4. Criar API routes em `app/api/modulos/<nome>/`
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
DATABASE_URL: "postgresql://..."     # Supabase pooler (porta 6543)
DIRECT_URL: "postgresql://..."       # Supabase direct (porta 5432)
NEXTAUTH_URL: "https://..."          # URL pública do Cloud Run
NEXTAUTH_SECRET: "..."               # Chave aleatória
GOOGLE_CLIENT_ID: "..."
GOOGLE_CLIENT_SECRET: "..."
SYNC_LOGIN_EMAIL: "..."              # Login do app Flutter
SYNC_LOGIN_PASSWORD: "..."           # Senha do app Flutter
SYNC_LOGIN_NAME: "..."
NODE_ENV: "production"
```

### Comandos

```bash
# Deploy completo (Linux)
./scripts/deploy-cloudrun-linux.sh

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
| `supabase-check.mjs` | `supabase:check` | Valida conexão |
| `supabase-bootstrap.mjs` | `supabase:bootstrap` | Setup completo do banco |
| `supabase-clean.mjs` | `supabase:clean` | Limpa e recria mínimo |

### Deploy
| Script | Descrição |
|--------|-----------|
| `deploy-cloudrun-linux.sh` | Deploy Cloud Run (Linux) |
| `deploy-cloudrun.ps1` | Deploy Cloud Run (Windows) |

### Dados
| Script | Descrição |
|--------|-----------|
| `build-inep-censo-municipal-dataset.py` | Dataset municipal INEP |
| `gerar-tse-prefeitos.py` | Dados TSE prefeitos |
| `gerar-ideb-municipios.py` | Dados IDEB |
| `prepare-docx-templates.mjs` | Templates DOCX contratos |

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
- Módulos: Terceirização, Formação, Atas, Tecnologia, RH, Financeiro
- Testes automatizados (Vitest, Playwright)
- CI/CD via GitHub Actions (usa Cloud Build manual)
- Staging separado de produção
- Monitoramento (Sentry, Axiom)
