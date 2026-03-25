# 🔺 SYNC — Architecture Document

> **Sync** é a plataforma centralizada de gestão multi-empresa.
> Um único sistema integrado para orquestrar empresas, funcionários e módulos operacionais — sem separação por menu, sem silos, sem fricção.

---

## Sumário

1. [Visão do Produto](#1-visão-do-produto)
2. [Princípios Fundamentais](#2-princípios-fundamentais)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Design System — "Sync Dark"](#4-design-system--sync-dark)
5. [Arquitetura de Layout (Three-Pane)](#5-arquitetura-de-layout-three-pane)
6. [Navegação & Sidebar](#6-navegação--sidebar)
7. [Sistema Multi-Empresa (Tenant Integrado)](#7-sistema-multi-empresa-tenant-integrado)
8. [Modelo de Domínio](#8-modelo-de-domínio)
9. [Sistema Modular](#9-sistema-modular)
10. [Catálogo de Módulos](#10-catálogo-de-módulos)
11. [Estrutura de Diretórios](#11-estrutura-de-diretórios)
12. [Componentes UI Core](#12-componentes-ui-core)
13. [Camada de API (BFF)](#13-camada-de-api-bff)
14. [Autenticação & Permissões (RBAC)](#14-autenticação--permissões-rbac)
15. [Estado Global & Data Fetching](#15-estado-global--data-fetching)
16. [Persistência & Banco de Dados](#16-persistência--banco-de-dados)
17. [Command Palette (⌘K)](#17-command-palette-k)
18. [Notificações & Inbox](#18-notificações--inbox)
19. [Auditoria & Logs](#19-auditoria--logs)
20. [Deploy & Infraestrutura](#20-deploy--infraestrutura)
21. [Testes & Qualidade](#21-testes--qualidade)
22. [Roadmap Detalhado](#22-roadmap-detalhado)
23. [Convenções de Código](#23-convenções-de-código)
24. [Glossário](#24-glossário)

---

## 1. Visão do Produto

### O que é o Sync?

O **Sync** é uma plataforma de gestão empresarial integrada, projetada para **grupos empresariais** que precisam orquestrar múltiplas empresas a partir de um único painel de controle. Inspirado visualmente e estruturalmente no [Linear.app](https://linear.app), o Sync adota um tema dark opaco, navegação por sidebar hierárquica e arquitetura de três painéis.

### Para quem?

| Persona | Descrição |
|---------|-----------|
| **Administrador do Grupo** | Visão completa de todas as empresas, módulos e funcionários |
| **Gestor de Empresa** | Acessa apenas a(s) empresa(s) sob sua responsabilidade |
| **Coordenador de Módulo** | Opera dentro de um módulo específico (ex: Consultoria, FUNDEB) |
| **Funcionário** | Acessa funções self-service e tarefas atribuídas |

### Problema que resolve

Grupos empresariais que gerenciam múltiplas empresas com serviços distintos (consultoria, terceirização, formação, tecnologia) sofrem com:

- Dados espalhados em planilhas e sistemas isolados
- Falta de visibilidade centralizada
- Duplicação de processos entre empresas
- Dificuldade de escalar novos serviços

O Sync elimina esses problemas com uma **experiência única e integrada**.

---

## 2. Princípios Fundamentais

| # | Princípio | Descrição |
|---|-----------|-----------|
| 1 | **Integrado, não fragmentado** | Todas as empresas convivem no mesmo workspace — sem trocar de "conta" |
| 2 | **Modular por natureza** | Cada serviço é um módulo independente que pode ser ativado/desativado por empresa |
| 3 | **Dark & Produtivo** | Interface escura, limpa, sem distrações — inspirada no Linear |
| 4 | **Escalável sem reescrita** | Adicionar um módulo novo não exige alterar o core |
| 5 | **Permissões granulares** | RBAC por empresa + módulo + função |
| 6 | **Keyboard-first** | Command Palette (⌘K) para navegação rápida |
| 7 | **Audit-ready** | Toda ação gera log rastreável |

---

## 3. Stack Tecnológico

### Frontend

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| **Framework** | Next.js 14+ (App Router) | SSR, layouts aninhados, Server Components |
| **Linguagem** | TypeScript (strict) | Segurança de tipos em todo o codebase |
| **Estilização** | Tailwind CSS 3+ | Utility-first, design tokens via config |
| **Componentes** | Radix UI Primitives | Acessibilidade nativa, sem estilo imposto |
| **Ícones** | Lucide React | Consistência visual, tree-shakeable |
| **Animações** | Framer Motion | Micro-animações e transições de layout |
| **Formulários** | React Hook Form + Zod | Validação type-safe com schema |
| **Data Fetching** | TanStack Query (React Query) | Cache, revalidação, estado de servidor |
| **Estado Global** | Zustand | Leve, sem boilerplate, TypeScript nativo |
| **Tabelas** | TanStack Table | Virtualização, sorting, filtering |
| **Gráficos** | Recharts ou Tremor | Dashboards e analytics |
| **Datas** | date-fns | Imutável, tree-shakeable |
| **Toast/Feedback** | Sonner | Notificações elegantes no estilo Linear |

### Backend (BFF)

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| **API Routes** | Next.js Route Handlers | Colocação com frontend, API tipada |
| **ORM** | Prisma | Type-safe, migrations, multi-schema |
| **Autenticação** | NextAuth.js v5 (Auth.js) | Sessões, providers, callbacks |
| **Validação** | Zod | Schemas compartilhados front/back |

### Infraestrutura

| Camada | Tecnologia |
|--------|------------|
| **Banco** | PostgreSQL (Supabase ou Neon) |
| **Object Storage** | Supabase Storage ou S3 |
| **Deploy** | Vercel ou Docker + Cloud Run |
| **CI/CD** | GitHub Actions |
| **Monitoramento** | Sentry (erros) + Axiom (logs) |

---

## 4. Design System — "Sync Dark"

> Inspirado diretamente no Linear.app: fundo escuro matte, painéis com bordas sutis, tipografia clara e hierárquica, cores funcionais mínimas.

### 4.1 Paleta de Cores

```
┌─────────────────────────────────────────────────────┐
│  SYNC DARK PALETTE                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Backgrounds                                        │
│  ├── --sync-bg-primary     #0A0A0B   (app bg)      │
│  ├── --sync-bg-secondary   #111113   (sidebar bg)  │
│  ├── --sync-bg-elevated    #18181B   (cards/panels) │
│  ├── --sync-bg-surface     #1E1E22   (inputs/hover) │
│  └── --sync-bg-overlay     #27272Acc (modais/blur)  │
│                                                     │
│  Borders                                            │
│  ├── --sync-border-subtle  #262629   (padrão)       │
│  ├── --sync-border-medium  #333338   (hover)        │
│  └── --sync-border-strong  #4A4A52   (focus)        │
│                                                     │
│  Text                                               │
│  ├── --sync-text-primary   #EDEDEF   (títulos)      │
│  ├── --sync-text-secondary #A0A0A8   (corpo)        │
│  ├── --sync-text-tertiary  #6B6B76   (placeholders) │
│  └── --sync-text-disabled  #444450   (desabilitado) │
│                                                     │
│  Accent (Brand)                                     │
│  ├── --sync-accent         #6366F1   (indigo)       │
│  ├── --sync-accent-hover   #818CF8   (hover)        │
│  └── --sync-accent-muted   #6366F120 (bg tint)      │
│                                                     │
│  Status (Funcional)                                 │
│  ├── --sync-status-active  #22C55E   (verde)        │
│  ├── --sync-status-warning #F59E0B   (amarelo)      │
│  ├── --sync-status-error   #EF4444   (vermelho)     │
│  ├── --sync-status-info    #3B82F6   (azul)         │
│  └── --sync-status-purple  #A855F7   (roxo)         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.2 Tipografia

| Uso | Font | Peso | Tamanho | Line-height |
|-----|------|------|---------|-------------|
| **Títulos H1** | Inter | 600 (SemiBold) | 24px | 32px |
| **Títulos H2** | Inter | 600 | 20px | 28px |
| **Títulos H3** | Inter | 500 (Medium) | 16px | 24px |
| **Corpo** | Inter | 400 (Regular) | 14px | 20px |
| **Caption/Meta** | Inter | 400 | 12px | 16px |
| **Monospace/IDs** | JetBrains Mono | 400 | 12px | 16px |
| **Sidebar items** | Inter | 500 | 13px | 18px |

### 4.3 Espaçamento

Sistema baseado em múltiplos de **4px**:

```
--sync-space-1:   4px
--sync-space-2:   8px
--sync-space-3:  12px
--sync-space-4:  16px
--sync-space-5:  20px
--sync-space-6:  24px
--sync-space-8:  32px
--sync-space-10: 40px
--sync-space-12: 48px
--sync-space-16: 64px
```

### 4.4 Border Radius

```
--sync-radius-sm:   4px   (badges, tags)
--sync-radius-md:   6px   (inputs, botões pequenos)
--sync-radius-lg:   8px   (cards, painéis)
--sync-radius-xl:  12px   (modais, dropdowns)
--sync-radius-full: 9999px (avatares, pills)
```

### 4.5 Sombras & Elevação

```
--sync-shadow-sm:   0 1px 2px rgba(0, 0, 0, 0.3)
--sync-shadow-md:   0 4px 8px rgba(0, 0, 0, 0.4)
--sync-shadow-lg:   0 8px 24px rgba(0, 0, 0, 0.5)
--sync-shadow-glow: 0 0 20px rgba(99, 102, 241, 0.15)  (accent glow)
```

### 4.6 Transições

```
--sync-transition-fast:   150ms cubic-bezier(0.4, 0, 0.2, 1)
--sync-transition-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1)
--sync-transition-slow:   300ms cubic-bezier(0.4, 0, 0.2, 1)
```

---

## 5. Arquitetura de Layout (Three-Pane)

> Mesma arquitetura do Linear: Sidebar | Conteúdo Principal | Painel de Contexto

```
┌──────────────────────────────────────────────────────────────────┐
│  SYNC - Three Pane Layout                                        │
├────────────┬───────────────────────────────┬─────────────────────┤
│            │                               │                     │
│  SIDEBAR   │     MAIN CONTENT AREA         │  CONTEXT PANEL      │
│  (240px)   │     (flex-1)                  │  (320px, toggle)    │
│            │                               │                     │
│ ┌────────┐ │  ┌─────────────────────────┐  │  ┌───────────────┐  │
│ │ Logo   │ │  │ Breadcrumb / Header     │  │  │ Detail Meta   │  │
│ │ SYNC ▸ │ │  │ [Empresa > Módulo > ...]│  │  │               │  │
│ ├────────┤ │  ├─────────────────────────┤  │  │ Status: ●     │  │
│ │        │ │  │                         │  │  │ Prioridade: ▲ │  │
│ │ 📥 Inbox│ │  │  Toolbar                │  │  │ Responsável:  │  │
│ │ 📋 Minhas│ │  │  [Filtros] [Busca] [+] │  │  │ Labels: [  ]  │  │
│ │        │ │  ├─────────────────────────┤  │  │ Empresa: ABC  │  │
│ ├────────┤ │  │                         │  │  │ Módulo: FUNDEB│  │
│ │WORKSPACE│ │  │  Content body           │  │  │               │  │
│ │ Dashboard│ │  │                         │  │  ├───────────────┤  │
│ │ Empresas│ │  │  (list / detail /       │  │  │ Atividade     │  │
│ │ Pessoas │ │  │   kanban / table /      │  │  │ ┌───────────┐ │  │
│ │ Módulos │ │  │   calendar / chart)     │  │  │ │ Timeline  │ │  │
│ │ Relatór.│ │  │                         │  │  │ │ de ações  │ │  │
│ ├────────┤ │  │                         │  │  │ └───────────┘ │  │
│ │EMPRESAS │ │  │                         │  │  │               │  │
│ │ ★ Alpha │ │  │                         │  │  │ [Comentário]  │  │
│ │   ├ Fun.│ │  │                         │  │  └───────────────┘  │
│ │   ├ Mód.│ │  │                         │  │                     │
│ │ ★ Beta  │ │  │                         │  │                     │
│ │   ├ Fun.│ │  │                         │  │                     │
│ │   ├ Mód.│ │  └─────────────────────────┘  │                     │
│ ├────────┤ │                               │                     │
│ │⚙ Config│ │                               │                     │
│ │👤 Perfil│ │                               │                     │
│ └────────┘ │                               │                     │
├────────────┴───────────────────────────────┴─────────────────────┤
│  ⌘K Command Palette (overlay global)                             │
└──────────────────────────────────────────────────────────────────┘
```

### Regras de Layout

| Regra | Detalhe |
|-------|---------|
| **Sidebar** | Fixa à esquerda, 240px de largura, colapsável para 64px (ícones only) |
| **Main Content** | flex-1, scroll independente, padding interno de 24px |
| **Context Panel** | 320px, toggle via botão — aparece ao selecionar um item |
| **Breakpoints** | < 768px: sidebar vira overlay; panel é fullscreen |
| **Transições** | Sidebar collapse: 200ms ease; Panel slide: 250ms ease |

---

## 6. Navegação & Sidebar

### 6.1 Estrutura da Sidebar (Top to Bottom)

```
┌─────────────────────────┐
│ 🔺 SYNC        [◀ ▸]   │  ← Logo + collapse toggle
├─────────────────────────┤
│                         │
│ 📥  Inbox          (3)  │  ← Notificações/tarefas pendentes
│ 📋  Minhas Tarefas      │  ← Tarefas atribuídas ao usuário
│                         │
├─── Workspace ───────────┤
│ 📊  Dashboard           │  ← Visão consolidada do grupo
│ 🏢  Empresas            │  ← CRUD + listagem de empresas
│ 👥  Pessoas             │  ← Todos os funcionários cross-empresa
│ 📦  Módulos             │  ← Catálogo + ativação de módulos
│ 📄  Relatórios          │  ← Analytics e exports
│ 📅  Agenda              │  ← Calendário unificado
│ ⚡  Atividade           │  ← Feed de atividades recentes
│ ...  Mais               │  ← Overflow menu
│                         │
├─── Empresas ────────────┤
│ ★ Alpha Consultoria  ▸  │  ← Empresa com sub-navegação
│    ├ 📋 Visão Geral     │
│    ├ 👥 Funcionários    │
│    ├ 📦 Módulos Ativos  │
│    └ ⚙  Configurações  │
│ ★ Beta Terceirização  ▸ │
│    ├ 📋 Visão Geral     │
│    ├ 👥 Funcionários    │
│    └ 📦 Módulos Ativos  │
│ ★ Gamma Formação     ▸  │
│    └ ...                │
│                         │
├─────────────────────────┤
│ ⚙  Configurações       │  ← Settings do workspace
│ 👤  Meu Perfil          │  ← Perfil + preferências
│ 🔺  v1.0.0              │  ← Versão do sistema
└─────────────────────────┘
```

### 6.2 Regras de Navegação

1. **As empresas NÃO são menus separados** — elas aparecem dentro da sidebar como sub-items expansíveis (igual "Your teams" no Linear)
2. **Clicar em uma empresa** expande seus sub-items (Visão Geral, Funcionários, Módulos)
3. **O contexto de empresa é inferido pela rota** — `/empresas/alpha-123/funcionarios`
4. **Workspace views** (Dashboard, Relatórios) são cross-empresa por padrão
5. **Command Palette (⌘K)** permite navegar para qualquer empresa/módulo/pessoa instantaneamente

---

## 7. Sistema Multi-Empresa (Tenant Integrado)

> Diferente de SaaS multi-tenant clássico, o Sync usa **tenant integrado**: todas as empresas vivem na mesma instância e todos os dados coexistem no mesmo banco, filtrados por `companyId`.

### 7.1 Modelo de Dados — Entidades Core

```
┌────────────────────────────────────────────────────────────┐
│                      GROUP (Grupo)                          │
│  O contêiner raiz que representa o grupo empresarial        │
│  - id, name, slug, plan, settings                          │
├────────────────────────────────────────────────────────────┤
│         │                                                   │
│    ┌────▼─────┐    ┌────▼─────┐    ┌────▼─────┐           │
│    │ COMPANY  │    │ COMPANY  │    │ COMPANY  │           │
│    │ Alpha    │    │ Beta     │    │ Gamma    │           │
│    │ id       │    │ id       │    │ id       │           │
│    │ groupId  │    │ groupId  │    │ groupId  │           │
│    │ name     │    │ name     │    │ name     │           │
│    │ cnpj     │    │ cnpj     │    │ cnpj     │           │
│    │ segment  │    │ segment  │    │ segment  │           │
│    │ status   │    │ status   │    │ status   │           │
│    │ modules[]│    │ modules[]│    │ modules[]│           │
│    └────┬─────┘    └────┬─────┘    └────┬─────┘           │
│         │               │               │                  │
│    ┌────▼─────┐    ┌────▼─────┐    ┌────▼─────┐          │
│    │EMPLOYEES │    │EMPLOYEES │    │EMPLOYEES │          │
│    │ id       │    │ id       │    │ id       │          │
│    │ companyId│    │ companyId│    │ companyId│          │
│    │ userId   │    │ userId   │    │ userId   │          │
│    │ role     │    │ role     │    │ role     │          │
│    │ position │    │ position │    │ position │          │
│    └──────────┘    └──────────┘    └──────────┘          │
└────────────────────────────────────────────────────────────┘
```

### 7.2 Regras Multi-Empresa

| Regra | Implementação |
|-------|---------------|
| **Isolamento** | Todo registro possui `companyId` — queries sempre filtram |
| **Cross-company** | Dashboard e Relatórios agregam dados de todas as empresas do grupo |
| **Acesso** | Um usuário pode pertencer a N empresas com roles diferentes |
| **Ativação de módulo** | Cada empresa ativa os módulos que precisa independentemente |
| **Sidebar** | Lista empresas do grupo como sub-items; não é um "seletor" — é navegação |

---

## 8. Modelo de Domínio

### 8.1 Entidades Principais

```typescript
// === GROUP ===
interface Group {
  id: string
  name: string               // "Grupo Sync"
  slug: string               // "grupo-sync"
  plan: 'starter' | 'pro' | 'enterprise'
  settings: GroupSettings
  createdAt: Date
  updatedAt: Date
}

// === COMPANY ===
interface Company {
  id: string
  groupId: string
  name: string               // "Alpha Consultoria"
  tradingName: string        // "Alpha"
  cnpj: string
  segment: CompanySegment
  status: 'active' | 'inactive' | 'suspended'
  enabledModules: ModuleId[]
  address: Address
  contact: ContactInfo
  logo?: string
  color?: string             // Cor identificadora na sidebar
  createdAt: Date
  updatedAt: Date
}

type CompanySegment =
  | 'consultoria'
  | 'terceirizacao'
  | 'formacao'
  | 'tecnologia'
  | 'assessoria'
  | 'outro'

// === USER ===
interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  phone?: string
  status: 'active' | 'inactive'
  groupRole: GroupRole        // Papel no nível do grupo
  createdAt: Date
}

type GroupRole = 'owner' | 'admin' | 'member' | 'viewer'

// === EMPLOYEE (vínculo user↔company) ===
interface Employee {
  id: string
  userId: string
  companyId: string
  position: string            // "Consultor Sênior"
  department?: string
  role: CompanyRole           // Papel dentro da empresa
  modulePermissions: ModulePermission[]
  hireDate: Date
  status: 'active' | 'on_leave' | 'terminated'
}

type CompanyRole = 'director' | 'manager' | 'coordinator' | 'analyst' | 'operator'

// === MODULE PERMISSION ===
interface ModulePermission {
  moduleId: ModuleId
  level: 'read' | 'write' | 'admin'
}
```

### 8.2 Diagrama de Relacionamentos

```
Group 1──────N Company
Company 1────N Employee
User 1───────N Employee  (mesmo usuário em N empresas)
Company 1────N CompanyModule (módulos ativados)
Employee 1───N ModulePermission
Module 1─────N ModuleRecord (dados do módulo)
```

---

## 9. Sistema Modular

### 9.1 Contrato de Módulo

Todo módulo no Sync segue um **contrato padronizado** que permite plug-and-play:

```typescript
// core/domain/module-types.ts

interface SyncModuleDefinition {
  /** Identificador único do módulo */
  id: ModuleId

  /** Nome de exibição no menu/sidebar */
  label: string

  /** Descrição curta do módulo */
  description: string

  /** Ícone Lucide para sidebar e cards */
  icon: LucideIconName

  /** Cor tema do módulo para badges e headers */
  color: string

  /** Rota base dentro de /empresas/:id/modulos/ */
  basePath: string

  /** Permissões necessárias para acessar */
  requiredRole: CompanyRole[]

  /** Se o módulo está em beta/preview */
  status: 'stable' | 'beta' | 'coming_soon'

  /** Segmentos de empresa compatíveis (vazio = todos) */
  compatibleSegments: CompanySegment[]

  /** Sub-páginas do módulo */
  pages: ModulePage[]

  /** Versão do módulo */
  version: string
}

interface ModulePage {
  id: string
  label: string
  path: string            // Relativo ao basePath
  icon?: LucideIconName
  description?: string
}

type ModuleId =
  | 'consultoria'
  | 'fundeb'
  | 'terceirizacao'
  | 'formacao'
  | 'atas-registro-preco'
  | 'tecnologia'
  // Futuros:
  | 'rh'
  | 'financeiro'
  | 'contratos'
  | 'documentos'
  | 'projetos'
```

### 9.2 Checklist para Criar Novo Módulo

```
☐ 1. Adicionar ModuleId ao union type em core/domain/module-types.ts
☐ 2. Registrar definição completa em core/config/module-catalog.ts
☐ 3. Criar pasta modules/<nome-do-modulo>/
☐ 4.   ├── components/         (componentes visuais do módulo)
☐ 5.   ├── services/           (lógica de negócio + chamadas API)
☐ 6.   ├── hooks/              (React hooks do módulo)
☐ 7.   ├── types/              (tipos TypeScript do módulo)
☐ 8.   ├── data/               (mock data e seeds)
☐ 9.   └── <modulo>-page.tsx   (entry point principal)
☐ 10. Criar rota em app/(dashboard)/empresas/[companyId]/modulos/<modulo>/
☐ 11. Adicionar migration Prisma para tabelas do módulo
☐ 12. Criar API routes em app/api/modulos/<modulo>/
☐ 13. Adicionar testes unitários e de integração
☐ 14. Documentar no README do módulo
```

---

## 10. Catálogo de Módulos

### Módulos Planejados

| # | Módulo | ID | Ícone | Descrição | Status |
|---|--------|----|-------|-----------|--------|
| 1 | **Consultoria** | `consultoria` | 💼 Briefcase | Gestão de projetos de consultoria, contratos, entregas e pareceres | `v1` |
| 2 | **Assessoria FUNDEB** | `fundeb` | 📊 BarChart3 | Acompanhamento do FUNDEB, prestação de contas, indicadores | `v1` |
| 3 | **Terceirização e Mão de Obra** | `terceirizacao` | 👷 HardHat | Gestão de contratos de terceirização, alocação de pessoal, custos | `v1` |
| 4 | **Formação e Capacitação** | `formacao` | 🎓 GraduationCap | Treinamentos, certificações, trilhas de aprendizado, presença | `v1` |
| 5 | **Atas de Registro de Preço** | `atas-registro-preco` | 📝 FileText | Controle de atas, itens, validade, adesões e saldo | `v1` |
| 6 | **Tecnologia** | `tecnologia` | 💻 Monitor | Inventário de ativos de TI, suporte técnico, projetos de software | `v1` |
| 7 | **RH / Pessoas** | `rh` | 👥 Users | Folha, benefícios, férias, admissão/demissão | `v2` |
| 8 | **Financeiro** | `financeiro` | 💰 Wallet | Contas a pagar/receber, fluxo de caixa, DRE | `v2` |
| 9 | **Contratos** | `contratos` | 📑 ScrollText | Lifecycle de contratos, alertas de vencimento, aditivos | `v2` |
| 10 | **Documentos** | `documentos` | 📁 FolderOpen | GED, versionamento, assinaturas digitais | `v3` |
| 11 | **Projetos** | `projetos` | 🎯 Target | Gestão de projetos Kanban/Timeline, similar ao Linear Issues | `v3` |

---

## 11. Estrutura de Diretórios

```
apps/web/
├── public/
│   ├── logo-sync.svg                    # Logo vetorial
│   ├── logo-sync-icon.svg              # Ícone isolado (favicon)
│   └── fonts/                           # Inter, JetBrains Mono
│
├── src/
│   ├── app/                             # Next.js App Router
│   │   ├── globals.css                  # Design tokens + base styles
│   │   ├── layout.tsx                   # Root layout (providers, fonts)
│   │   ├── page.tsx                     # Landing / redirect to dashboard
│   │   │
│   │   ├── (auth)/                      # Grupo de rotas de autenticação
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── layout.tsx               # Layout sem sidebar
│   │   │
│   │   ├── (dashboard)/                 # Grupo de rotas autenticadas
│   │   │   ├── layout.tsx               # Layout com Sidebar + Header
│   │   │   ├── dashboard/page.tsx       # Visão consolidada
│   │   │   │
│   │   │   ├── inbox/page.tsx           # Notificações e tarefas
│   │   │   ├── minhas-tarefas/page.tsx  # Tarefas do usuário
│   │   │   │
│   │   │   ├── empresas/
│   │   │   │   ├── page.tsx             # Lista de todas as empresas
│   │   │   │   ├── nova/page.tsx        # Criar empresa
│   │   │   │   └── [companyId]/
│   │   │   │       ├── page.tsx         # Visão geral da empresa
│   │   │   │       ├── funcionarios/
│   │   │   │       │   ├── page.tsx     # Lista de funcionários
│   │   │   │       │   ├── novo/page.tsx
│   │   │   │       │   └── [employeeId]/page.tsx
│   │   │   │       ├── modulos/
│   │   │   │       │   ├── page.tsx     # Módulos ativos da empresa
│   │   │   │       │   ├── consultoria/
│   │   │   │       │   │   ├── page.tsx
│   │   │   │       │   │   └── [projectId]/page.tsx
│   │   │   │       │   ├── fundeb/
│   │   │   │       │   │   └── page.tsx
│   │   │   │       │   ├── terceirizacao/
│   │   │   │       │   │   └── page.tsx
│   │   │   │       │   ├── formacao/
│   │   │   │       │   │   └── page.tsx
│   │   │   │       │   ├── atas-registro-preco/
│   │   │   │       │   │   └── page.tsx
│   │   │   │       │   └── tecnologia/
│   │   │   │       │       └── page.tsx
│   │   │   │       └── configuracoes/
│   │   │   │           └── page.tsx
│   │   │   │
│   │   │   ├── pessoas/page.tsx         # Todas as pessoas cross-empresa
│   │   │   ├── relatorios/page.tsx      # Analytics e exports
│   │   │   ├── agenda/page.tsx          # Calendário unificado
│   │   │   ├── atividade/page.tsx       # Feed de ações
│   │   │   │
│   │   │   └── configuracoes/
│   │   │       ├── page.tsx             # Settings gerais
│   │   │       ├── workspace/page.tsx   # Config do grupo
│   │   │       ├── membros/page.tsx     # Gestão de usuários
│   │   │       ├── modulos/page.tsx     # Catálogo de módulos
│   │   │       └── integrações/page.tsx
│   │   │
│   │   └── api/                         # API Routes (BFF)
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── empresas/
│   │       │   ├── route.ts             # GET (list), POST (create)
│   │       │   └── [companyId]/
│   │       │       ├── route.ts         # GET, PUT, DELETE
│   │       │       └── funcionarios/route.ts
│   │       ├── pessoas/route.ts
│   │       ├── modulos/
│   │       │   ├── consultoria/route.ts
│   │       │   ├── fundeb/route.ts
│   │       │   └── .../route.ts
│   │       └── audit/route.ts
│   │
│   ├── core/                            # Código compartilhado do sistema
│   │   ├── config/
│   │   │   ├── module-catalog.ts        # Registry de todos os módulos
│   │   │   ├── navigation.ts            # Definição da sidebar
│   │   │   ├── routes.ts               # Mapa de rotas tipadas
│   │   │   └── constants.ts            # Constantes globais
│   │   ├── domain/
│   │   │   ├── module-types.ts          # Contratos de módulo
│   │   │   ├── organization.ts          # Group, Company, Employee
│   │   │   ├── user.ts                 # User, Auth types
│   │   │   └── permissions.ts          # RBAC types
│   │   ├── hooks/
│   │   │   ├── use-company.ts           # Contexto de empresa ativa
│   │   │   ├── use-module.ts            # Contexto de módulo ativo
│   │   │   ├── use-permissions.ts       # Verificação de permissões
│   │   │   ├── use-command-palette.ts   # ⌘K handler
│   │   │   └── use-sidebar.ts          # Estado da sidebar
│   │   ├── lib/
│   │   │   ├── api-client.ts            # Fetch wrapper tipado
│   │   │   ├── prisma.ts               # Cliente Prisma singleton
│   │   │   ├── auth.ts                 # Config NextAuth
│   │   │   ├── utils.ts                # cn(), formatters, helpers
│   │   │   └── audit.ts               # Logger de auditoria
│   │   └── providers/
│   │       ├── theme-provider.tsx       # Dark mode (forçado)
│   │       ├── query-provider.tsx       # TanStack Query
│   │       └── auth-provider.tsx        # Sessão
│   │
│   ├── components/                      # Componentes UI reutilizáveis
│   │   ├── ui/                          # Primitivos (Design System)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── separator.tsx
│   │   │   └── command.tsx              # Command Palette base
│   │   ├── layout/
│   │   │   ├── sidebar.tsx              # Sidebar principal
│   │   │   ├── sidebar-item.tsx         # Item de navegação
│   │   │   ├── sidebar-company.tsx      # Sub-item de empresa
│   │   │   ├── header.tsx               # Breadcrumb + ações
│   │   │   ├── context-panel.tsx        # Painel lateral direito
│   │   │   └── three-pane-layout.tsx    # Orquestrador do layout
│   │   ├── shared/
│   │   │   ├── command-palette.tsx      # ⌘K global
│   │   │   ├── data-table.tsx           # Tabela genérica
│   │   │   ├── empty-state.tsx          # Estado vazio elegante
│   │   │   ├── loading-state.tsx        # Skeleton loading
│   │   │   ├── page-header.tsx          # Header padrão de páginas
│   │   │   ├── stat-card.tsx            # Card de métrica
│   │   │   ├── status-badge.tsx         # Badge de status com cor
│   │   │   ├── company-avatar.tsx       # Avatar com cor da empresa
│   │   │   └── module-icon.tsx          # Ícone de módulo
│   │   └── forms/
│   │       ├── company-form.tsx
│   │       ├── employee-form.tsx
│   │       └── module-config-form.tsx
│   │
│   ├── modules/                         # Módulos de negócio isolados
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   │   ├── group-overview.tsx   # Métricas do grupo
│   │   │   │   ├── company-cards.tsx    # Grid de empresas
│   │   │   │   ├── activity-feed.tsx    # Últimas ações
│   │   │   │   └── module-status.tsx    # Status dos módulos
│   │   │   └── dashboard-page.tsx
│   │   │
│   │   ├── consultoria/
│   │   │   ├── components/
│   │   │   │   ├── project-list.tsx
│   │   │   │   ├── project-detail.tsx
│   │   │   │   ├── deliverable-tracker.tsx
│   │   │   │   └── contract-summary.tsx
│   │   │   ├── services/
│   │   │   │   └── consultoria-service.ts
│   │   │   ├── hooks/
│   │   │   │   └── use-consultoria.ts
│   │   │   ├── types/
│   │   │   │   └── consultoria.ts
│   │   │   └── consultoria-page.tsx
│   │   │
│   │   ├── fundeb/
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   ├── types/
│   │   │   └── fundeb-page.tsx
│   │   │
│   │   ├── terceirizacao/
│   │   │   └── ... (mesma estrutura)
│   │   │
│   │   ├── formacao/
│   │   │   └── ...
│   │   │
│   │   ├── atas-registro-preco/
│   │   │   └── ...
│   │   │
│   │   └── tecnologia/
│   │       └── ...
│   │
│   └── styles/
│       └── design-tokens.css            # CSS custom properties
│
├── prisma/
│   ├── schema.prisma                    # Schema principal
│   └── migrations/                      # Histórico de migrations
│
├── tailwind.config.ts                   # Tokens mapeados do Design System
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.local                           # Variáveis de ambiente
```

---

## 12. Componentes UI Core

### 12.1 Catálogo de Componentes

| Componente | Arquivo | Baseado em | Notas |
|-----------|---------|------------|-------|
| `Button` | `ui/button.tsx` | Radix Slot | Variantes: default, ghost, outline, danger |
| `Input` | `ui/input.tsx` | nativo | Borda sutil, foco com accent-glow |
| `Badge` | `ui/badge.tsx` | Radix | Status badges com cores do Design System |
| `Avatar` | `ui/avatar.tsx` | Radix | Fallback com iniciais + cor |
| `Card` | `ui/card.tsx` | — | Panel translúcido com borda sutil |
| `Dialog` | `ui/dialog.tsx` | Radix | Overlay com backdrop-blur |
| `DropdownMenu` | `ui/dropdown-menu.tsx` | Radix | Menus contextuais |
| `Command` | `ui/command.tsx` | cmdk | Base da Command Palette |
| `DataTable` | `shared/data-table.tsx` | TanStack Table | Sorting, filtering, pagination |
| `Sidebar` | `layout/sidebar.tsx` | custom | Colapsável, com sub-items |
| `CommandPalette` | `shared/command-palette.tsx` | cmdk | ⌘K global, busca fuzzy |

### 12.2 Padrão Visual de Componentes

```css
/* Estilo base de Card/Panel (inspirado LINEAR) */
.sync-panel {
  background: var(--sync-bg-elevated);
  border: 1px solid var(--sync-border-subtle);
  border-radius: var(--sync-radius-lg);
  transition: border-color var(--sync-transition-fast);
}
.sync-panel:hover {
  border-color: var(--sync-border-medium);
}

/* Estilo base de Botão primário */
.sync-button-primary {
  background: var(--sync-accent);
  color: white;
  border-radius: var(--sync-radius-md);
  font-weight: 500;
  font-size: 13px;
  padding: 6px 12px;
  transition: all var(--sync-transition-fast);
}
.sync-button-primary:hover {
  background: var(--sync-accent-hover);
  box-shadow: var(--sync-shadow-glow);
}

/* Input field */
.sync-input {
  background: var(--sync-bg-surface);
  border: 1px solid var(--sync-border-subtle);
  border-radius: var(--sync-radius-md);
  color: var(--sync-text-primary);
  font-size: 14px;
  padding: 8px 12px;
}
.sync-input:focus {
  border-color: var(--sync-accent);
  outline: none;
  box-shadow: 0 0 0 2px var(--sync-accent-muted);
}
```

---

## 13. Camada de API (BFF)

### 13.1 Estrutura das API Routes

Cada rota segue o padrão:

```typescript
// app/api/empresas/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/core/lib/prisma'
import { companySchema } from '@/core/domain/organization'
import { audit } from '@/core/lib/audit'

// GET /api/empresas — Lista empresas do grupo
export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companies = await prisma.company.findMany({
    where: { groupId: session.user.groupId },
    include: { _count: { select: { employees: true } } },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(companies)
}

// POST /api/empresas — Cria nova empresa
export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = companySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const company = await prisma.company.create({
    data: { ...parsed.data, groupId: session.user.groupId },
  })

  await audit.log({
    action: 'company.created',
    userId: session.user.id,
    targetId: company.id,
    metadata: { name: company.name },
  })

  return NextResponse.json(company, { status: 201 })
}
```

### 13.2 Convenções de API

| Convenção | Detalhe |
|-----------|---------|
| **Autenticação** | Toda rota verifica sessão via `getServerSession()` |
| **Validação** | Request body validado com Zod antes de processar |
| **Auditoria** | Toda ação de escrita (POST/PUT/DELETE) gera log de auditoria |
| **Paginação** | `?page=1&limit=20` com resposta `{ data, total, page, totalPages }` |
| **Filtragem** | `?search=texto&status=active&companyId=xxx` |
| **Ordenação** | `?sort=name&order=asc` |
| **Erros** | Formato padrão `{ error: string, details?: object, code?: string }` |

---

## 14. Autenticação & Permissões (RBAC)

### 14.1 Modelo de Permissões

```
Grupo (Group)
  └── GroupRole: owner | admin | member | viewer
       │
       └── Empresa (Company)
            └── CompanyRole: director | manager | coordinator | analyst | operator
                 │
                 └── Módulo (Module)
                      └── ModulePermission: read | write | admin
```

### 14.2 Matriz de Permissões

| Ação | Owner | Admin | Director | Manager | Coordinator | Analyst | Operator |
|------|:-----:|:-----:|:--------:|:-------:|:-----------:|:-------:|:--------:|
| Ver Dashboard do grupo | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Criar empresa | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gerenciar funcionários | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ativar módulos | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Operar módulo (write) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Visualizar módulo (read) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Config. do workspace | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 15. Estado Global & Data Fetching

### 15.1 TanStack Query — Padrões

```typescript
// hooks/use-companies.ts
export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: () => apiClient.get<Company[]>('/api/empresas'),
    staleTime: 5 * 60 * 1000, // 5 minutos
  })
}

// hooks/use-company.ts
export function useCompany(companyId: string) {
  return useQuery({
    queryKey: ['companies', companyId],
    queryFn: () => apiClient.get<Company>(`/api/empresas/${companyId}`),
    enabled: !!companyId,
  })
}
```

### 15.2 Zustand — Estado de UI

```typescript
// stores/sidebar-store.ts
interface SidebarStore {
  isCollapsed: boolean
  expandedCompanies: string[]
  toggleCollapse: () => void
  toggleCompany: (id: string) => void
}
```

---

## 16. Persistência & Banco de Dados

### 16.1 Schema Prisma (resumo)

```prisma
model Group {
  id        String    @id @default(cuid())
  name      String
  slug      String    @unique
  companies Company[]
  users     User[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Company {
  id             String          @id @default(cuid())
  groupId        String
  group          Group           @relation(fields: [groupId], references: [id])
  name           String
  tradingName    String
  cnpj           String          @unique
  segment        String
  status         String          @default("active")
  enabledModules String[]
  employees      Employee[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}

model User {
  id        String     @id @default(cuid())
  email     String     @unique
  name      String
  groupId   String
  group     Group      @relation(fields: [groupId], references: [id])
  groupRole String     @default("member")
  employees Employee[]
  createdAt DateTime   @default(now())
}

model Employee {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  position  String
  role      String
  status    String   @default("active")
  hireDate  DateTime
  createdAt DateTime @default(now())

  @@unique([userId, companyId])
}

model AuditLog {
  id        String   @id @default(cuid())
  action    String
  userId    String
  targetId  String?
  metadata  Json?
  createdAt DateTime @default(now())
}
```

---

## 17. Command Palette (⌘K)

> Assim como no Linear, o Sync oferece `Ctrl+K` / `⌘K` para navegação instantânea.

### Comandos disponíveis

| Comando | Ação |
|---------|------|
| `> Alpha Consultoria` | Navega para a empresa |
| `> João Silva` | Abre perfil do funcionário |
| `> FUNDEB` | Abre módulo FUNDEB da empresa no contexto |
| `> Nova empresa` | Abre formulário de criação |
| `> Configurações` | Vai para settings |
| `> Tema` | Alterna preferências visuais |

---

## 18. Notificações & Inbox

O Inbox centraliza todas as notificações e tarefas pendentes do usuário, cross-empresa:

| Tipo | Exemplo |
|------|---------|
| **Tarefa atribuída** | "Parecer sobre contrato XYZ — Alpha Consultoria" |
| **Prazo próximo** | "Ata de registro #42 vence em 3 dias" |
| **Menção** | "@você foi mencionado em um comentário" |
| **Sistema** | "Módulo Formação ativado para Beta Ltda." |

---

## 19. Auditoria & Logs

Toda ação relevante é registrada automaticamente:

```typescript
interface AuditEntry {
  id: string
  action: string        // "company.created" | "employee.updated" | ...
  userId: string        // Quem executou
  companyId?: string    // Em qual empresa (quando aplicável)
  targetId?: string     // ID do recurso afetado
  metadata?: Record<string, unknown>
  ip?: string
  userAgent?: string
  createdAt: Date
}
```

---

## 20. Deploy & Infraestrutura

| Ambiente | URL | Descrição |
|----------|-----|-----------|
| **Development** | `localhost:3000` | Desenvolvimento local |
| **Staging** | `staging.sync.app` | Testes e QA |
| **Production** | `app.sync.app` | Produção |

### CI/CD Pipeline

```
Push to main
  └─→ GitHub Actions
       ├─→ Lint + Type Check
       ├─→ Unit Tests
       ├─→ Build
       └─→ Deploy Vercel (staging auto / production manual)
```

---

## 21. Testes & Qualidade

| Tipo | Ferramenta | Cobertura alvo |
|------|------------|----------------|
| **Unit** | Vitest | Hooks, services, utils — 80%+ |
| **Component** | Testing Library | Componentes UI — 70%+ |
| **E2E** | Playwright | Fluxos críticos — 100% |
| **Lint** | ESLint + Prettier | Automático em CI |
| **Type** | tsc --noEmit | Sem erros em CI |

---

## 22. Roadmap Detalhado

### Fase 1 — Fundação (Semanas 1–4)

- [x] Setup Next.js + TypeScript + Tailwind
- [ ] Design System tokens implementados em CSS
- [ ] Layout Three-Pane (Sidebar + Content + Panel)
- [ ] Sidebar com navegação hierárquica de empresas
- [ ] Command Palette (⌘K)
- [ ] CRUD de Empresas
- [ ] CRUD de Funcionários (vínculo empresa)
- [ ] Dashboard consolidado do grupo
- [ ] Sistema de autenticação (NextAuth)
- [ ] Schema Prisma + migrations iniciais

### Fase 2 — Módulos Core (Semanas 5–10)

- [ ] Módulo **Consultoria**: projetos, entregas, pareceres
- [ ] Módulo **Assessoria FUNDEB**: indicadores, prestação de contas
- [ ] Módulo **Terceirização**: contratos, alocação, custos
- [ ] Módulo **Formação**: treinamentos, certificações, presença
- [ ] Módulo **Atas de Registro de Preço**: itens, saldos, adesões
- [ ] Módulo **Tecnologia**: inventário, suporte, projetos
- [ ] RBAC granular por empresa + módulo
- [ ] Inbox de notificações

### Fase 3 — Maturidade (Semanas 11–16)

- [ ] Relatórios e Analytics com gráficos
- [ ] Auditoria completa com timeline
- [ ] API pública documentada
- [ ] Módulos RH e Financeiro
- [ ] Export PDF/Excel
- [ ] Agenda/Calendário unificado
- [ ] Integrações externas (WhatsApp, Email)

### Fase 4 — Escala (Semanas 17+)

- [ ] Módulos Contratos e Documentos (GED)
- [ ] Módulo Projetos (Kanban nativo)
- [ ] Automações e workflows
- [ ] App mobile (React Native ou PWA)
- [ ] Multi-idioma (i18n)
- [ ] Observabilidade (APM, métricas)

---

## 23. Convenções de Código

| Área | Convenção |
|------|-----------|
| **Nomes de arquivo** | `kebab-case.tsx` para componentes, `camelCase.ts` para utils |
| **Componentes** | `PascalCase`, um componente por arquivo |
| **Hooks** | `use-<nome>.ts`, retorna objeto tipado |
| **Types** | Interfaces para objetos públicos, types para unions |
| **API** | `route.ts` com GET/POST/PUT/DELETE exportados |
| **Imports** | Path aliases: `@/core/`, `@/components/`, `@/modules/` |
| **Commits** | Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:` |
| **Branches** | `feat/<nome>`, `fix/<nome>`, `chore/<nome>` |

---

## 24. Glossário

| Termo | Definição |
|-------|-----------|
| **Grupo** | Entidade raiz que contém todas as empresas |
| **Empresa** | Uma organização dentro do grupo (ex: Alpha Consultoria) |
| **Funcionário** | Vínculo de um usuário com uma empresa — inclui cargo e permissões |
| **Módulo** | Funcionalidade de negócio ativável por empresa (ex: FUNDEB) |
| **Workspace** | Visão cross-empresa — dashboard, relatórios, pessoas |
| **Tenant** | Sinônimo de empresa no contexto de isolamento de dados |
| **BFF** | Backend-for-Frontend — API routes do Next.js |
| **RBAC** | Role-Based Access Control — permissões por papel |
| **Command Palette** | Overlay ⌘K para navegação e ações rápidas |
| **Three-Pane** | Layout de 3 painéis: Sidebar + Content + Context Panel |
| **Design Token** | Variável CSS que define cor, espaçamento, tipografia etc. |

---

> **SYNC** — Um sistema. Todas as empresas. Todos os módulos. Sem fricção.
