# CLAUDE.md — Sync

> Fonte única de verdade para qualquer agente de IA trabalhando neste projeto.
> Atualizado: 2026-07-22.

---

## 1. Visão Geral

**Sync** é uma plataforma de gestão e automação para a **Global Company**
(razão social GLOBAL SERVICES COMPANY LTDA, CNPJ 26.137.996/0001-75, Santa
Maria da Vitória/BA), consultoria que atende municípios brasileiros em toda a
área da educação. O FUNDEB é o serviço mais desenvolvido no sistema, não o
único — a identidade da empresa vive em `core/domain/empresa.ts`, com espelho
em `kit_padrao_pdf/empresa.py` para os geradores ReportLab.

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

**Prisma/PostgreSQL foram removidos.** O Firestore é a única persistência.
Não há `prisma/schema.prisma`, nem `@prisma/client`, nem `prisma generate` no
build; `DATABASE_URL`/`DIRECT_URL` não são mais lidas por nada. As rotas de API
que liam o Postgres eram todas código morto — nenhuma tela as chamava, porque a
interface já lê o Firestore direto — e foram apagadas junto com os
`core/lib/*-data-access.ts`. O schema antigo está no histórico do git, caso
alguém precise consultar o formato dos dados legados.

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
│   │   └── rbac.ts               # GroupRole
│   ├── lib/                      # Utilitários server-side (ver seção 3.3)
│   │                             #   tipos do Firestore: city-types.ts,
│   │                             #   company-types.ts, people-types.ts
│   └── providers/app-providers.tsx
│
├── modules/                      # Lógica de negócio consumida pelas rotas
│   ├── levantamento-fundeb/      # types + utils (cálculos, ptbr, relatório)
│   ├── contrato-fundeb/          # services (agent, docx, collectors) + types
│   └── propostas/                # types + utils de cálculo
│
├── scripts/                      # Ferramentas — ver seção 8
│   ├── deploy/                   # Cloud Run (Linux e Windows)
│   ├── firebase/                 # set-claims.mjs (custom claims)
│   ├── dados/                    # Pipelines INEP / IDEB / TSE
│   └── pdf/                      # Comparação e análise de PDFs, templates DOCX
├── data/                         # JSONs derivados (IDEB, INEP, TSE) + fnde/*.csv
│                                 #   Entram por `import from "@/data/..."` → bundlados
│                                 #   no build. Fontes brutas ficam em Sync-Arquivos/.
├── kit_padrao_pdf/   # Módulo Python de geração de PDFs FUNDEB
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
| `/api/companies/upload-logo` | POST | Upload de logo da empresa (Supabase Storage) |

> Empresas, funcionários, colaboradores, auditoria, dashboard executivo e
> configurações do workspace **não têm rota de API**. A interface lê e escreve
> essas coleções direto no Firestore (`companies`, `employees`, `collaborators`,
> `audit`, `workspace_settings`), com as regras em `firestore.rules`. As rotas
> equivalentes existiam sobre o Postgres, nunca tiveram consumidor e foram
> removidas.

**Municípios:**
| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/municipios/buscar` | GET | Busca de municípios por nome |
| `/api/municipios/carteira` | GET | Carteira de municípios |
| `/api/municipios/recentes` | GET | Municípios acessados recentemente |
| `/api/municipio/completo` | GET | Levantamento completo de município |

> A carteira de cidades do pipeline vive na coleção `cities` do Firestore
> (`core/lib/cities-firestore.ts`), não numa rota de API.

**Módulos de negócio:**
| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/modulos/levantamento-fundeb/[codigoIbge]` | GET | Dados FUNDEB por código IBGE |
| `/api/modulos/levantamento-fundeb/autonomo` | GET | Levantamento autônomo |
| `/api/modulos/levantamento-fundeb/censo-inep` | GET | Dados do Censo INEP |
| `/api/modulos/levantamento-fundeb/pdf` | POST | Geração de PDF (Python/ReportLab) |
| `/api/modulos/levantamento-fundeb/raio-x` | POST | Raio-X municipal em PDF (42 páginas) |
| `/api/modulos/levantamento-fundeb/dever-de-casa` | GET/POST | Dever de Casa — veredito interno item a item, com nota de 0 a 10 (GET é a prévia) |
| `/api/modulos/levantamento-fundeb/oficio-documentos` | POST | Ofício à prefeitura + questionário (4 páginas) |
| `/api/modulos/dossies/escolas` | GET/POST | Dossiê das Escolas — um bloco por unidade da rede |
| `/api/modulos/dossies/conformidade` | GET/POST | Dossiê da Conformidade — CAUC, SIOPE, DCA, VAAR, piso |
| `/api/modulos/dossies/matricula` | GET/POST | Dossiê da Matrícula Ponderada — segmento a segmento |
| `/api/modulos/dossies/dinheiro` | GET/POST | Dossiê do Dinheiro Federal — obras, emendas, convênios, sanções |
| `/api/modulos/dossies/aprendizagem` | GET/POST | Dossiê da Aprendizagem — distribuição do Saeb, IDEB, alfabetização, fluxo |
| `/api/modulos/dossies/demanda` | GET/POST | Dossiê da Demanda — coortes do Registro Civil, cobertura por faixa, creche |
| `/api/modulos/dossies/equidade` | GET/POST | Dossiê da Equidade — cor/raça em série, corrente de três elos, territórios |
| `/api/modulos/dossies/comparativo` | GET/POST | Dossiê Comparativo — cada indicador contra a coorte de porte semelhante |
| `/api/modulos/contrato-fundeb` | POST | Monta contrato a partir do levantamento |
| `/api/modulos/slides` | GET | Templates de apresentação |
| `/api/modulos/slides/gerar` | POST | Gera o deck em PDF |
| `/api/contratos-fundeb/agent` | POST | Agent de coleta de dados do contrato |
| `/api/contratos-fundeb/generate-kit` | POST | Kit documental (rota legada) |
| `/api/modulos/contrato-fundeb/gerar-kit` | POST | Kit documental parcial |
| `/api/modulos/contrato-fundeb/gerar-kit-completo` | POST | Kit completo (15 anexos) |
| `/api/modulos/contrato-fundeb/gerar-proposta` | POST | Proposta comercial |

> **As rotas `dossies/*` são de outra família.** Nos demais PDFs a contagem de
> folhas é contrato (`PAGINAS_ESPERADAS`) e o conteúdo é cortado por
> `overflow:hidden` — `pdf-corte.ts` existe para isso. Nos dossiês o volume é
> função do município, a paginação é por fluxo (`section.flow`,
> `break-inside:avoid`, cabeçalho por `@page`) e o contrato é de **completude**:
> o gerador confere que o número de blocos impressos bate com o número de linhas
> da fonte. `pdf-corte.ts` não roda neles. O `GET` de cada rota é a prévia que a
> tela usa para anunciar o tamanho antes de disparar a geração.
> Especificações em `docs/specs/relatorios-extensos/`.

**Outros:**
| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/acessos` | GET/POST | Usuárias do grupo e concessão de acesso (seção 11) |
| `/api/acessos/[uid]` | PATCH/POST | Papel e permissões; link de definição de senha |
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

> Contexto da transição: `docs/superpowers/specs/2026-07-22-migracao-firebase-design.md`.
> Auth e **dados** já estão no Firebase; o Postgres saiu do código.

### 3.3 core/lib/ — Arquivos e funções

| Arquivo | Descrição |
|---------|-----------|
| `auth.ts` | `getSessionUser()` — verifica o ID token do Firebase |
| `auth-token.ts` | `bearerToken()`, `sessionUserFromClaims()` — parsing puro, testável |
| `firebase-admin.ts` | Cliente do Admin SDK (lê `FIREBASE_SERVICE_ACCOUNT`) |
| `assets-paths.ts` | Resolve `CONTRATOS_ASSETS_DIR` |
| `firebase-client.ts` | Web SDK do Firebase (`getFirebaseDb`, `getFirebaseAuth`) |
| `cities-firestore.ts` | CRUD da coleção `cities` (carteira e pipeline) |
| `companies-firestore.ts` | CRUD da coleção `companies` |
| `collaborators-firestore.ts` | CRUD da coleção `collaborators` |
| `city-types.ts`, `company-types.ts`, `people-types.ts` | Tipos e conversores dos documentos do Firestore |
| `govia-compat.ts` (48KB) | Camada de compatibilidade com sistema legado GovIA |
| `fundeb-fnde.ts` (12KB) | Integração com dados FNDE (repasses FUNDEB) |
| `fundeb-estimate.ts` (10KB) | Cálculos de estimativa FUNDEB |
| `fundeb-comparative.ts` (19KB) | Análise comparativa entre municípios |
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
| `structured-log.ts` | `registrarErro/registrarAlerta/registrarInfo` — log JSON que o Cloud Error Reporting agrupa (seção 7.2) |

### 3.4 Persistência (Firestore)

Projeto `globalconsultorias`. Não há banco relacional: as coleções abaixo são a
fonte de verdade, e `firestore.rules` é o controle de acesso. A interface lê e
escreve pelo Web SDK; as Cloud Functions em `functions/` escrevem pelo Admin SDK.

| Coleção | Conteúdo |
|---------|----------|
| `companies` | Empresas do grupo |
| `employees` | Vínculo pessoa ↔ empresa |
| `collaborators` | Parceiros e articuladores |
| `collaboratorDocuments` | Documentos do colaborador |
| `cities` | Carteira e pipeline de municípios |
| `cities/{id}/profitSnapshots` | Receita/custo/lucro por competência |
| `cityDocuments`, `cityReports` | Kit documental e relatórios arquivados |
| `commissionRules`, `commissionAccruals`, `commissionPayouts` | Comissionamento |
| `workspace_settings` | Configurações do workspace, por `groupId` |
| `audit` | Log de auditoria |

Os índices ficam em `firestore.indexes.json`. Para criar uma coleção nova, some
a regra correspondente em `firestore.rules` — sem regra, o acesso é negado.

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
- **Componentes: Ant Design.** Não há biblioteca de componentes própria. O que
  o Ant resolve, o Ant resolve — `core/components/` guarda só o que é do
  domínio (visualizador de PDF, wizard, painel do CAGED).
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
| `/ajustes` | `app/(sync)/ajustes/page.tsx` | Configurações do workspace + aba **Acessos** (seção 11), visível só para owner/admin |

### 4.3 Interface — Ant Design

**A interface roda sobre Ant Design 6.** Shadcn/ui, Tailwind e lucide-react
saíram do projeto inteiro em 2026-08-01, com as dependências desinstaladas.

- **Tema:** `core/design/tema-ant.ts` — parte do padrão do Ant e sobrescreve
  pouco (quase-preto da marca, as duas famílias tipográficas, raio de 8px,
  tabela com cabeçalho claro). Cada valor sobrescrito é aparência que volta a
  ser nossa para manter, e a razão de adotar o Ant foi parar de manter
  aparência. **Nunca escrever hexadecimal em componente**: use os tokens de
  `theme.useToken()`.
- **Regras de interface:** `.claude/skills/interface-ant/SKILL.md`. Ela carrega
  sozinha em qualquer pedido visual e é a fonte de verdade de qual componente
  usar para quê, dos cinco estados obrigatórios (incluindo *dado parcial*) e da
  separação entre os dois perfis de usuário.
- **Tabela é `ProTable`** (`@ant-design/pro-components`), padrão em
  `app/(sync)/cidades/page.tsx`.

> **Sobre a versão:** o Pro Components estável exige antd 5; a versão para a 6
> é beta (`3.1.14-6`). O projeto está na 6 por decisão do dono, ciente disso.
>
> `DESIGN.md` descreve a direção anterior ("Console Soft") e vale só como
> registro histórico. `DESIGNER.md`, na raiz, é o brief para redesenhar sobre o
> Ant.

---

## 5. Módulos de Negócio

### Módulos ativos

| Módulo | Key | Descrição |
|--------|-----|-----------|
| **Consultoria** | `consultoria` | Gestão de projetos, contratos e entregas |
| **Consultoria FUNDEB** | `fundeb` | Pipeline de municípios, projeção de faturamento |
| **Levantamento FUNDEB** | `levantamento-fundeb` | Diagnóstico automático por código IBGE |
| **Contrato FUNDEB** | `contrato-fundeb` | Processo administrativo com 15 anexos (Lei 14.133/21) |
| **Propostas** | `propostas` | Propostas comerciais padronizadas |

> **Case de Sucesso** (`case-de-sucesso`) continua no `moduleCatalog`, mas não
> tem rota nem tela: as duas rotas que existiam liam a tabela `CaseSucessoFundeb`
> do Postgres, não tinham consumidor e saíram junto com o Prisma. Reimplementar
> significa escolher uma fonte no Firestore.

> `modules/` guarda apenas lógica server-side consumida pelas rotas de API.
> A interface de cada módulo é uma página em `app/(sync)/modulos/<nome>/`.

### Registrar novo módulo
1. Adicionar a key ao `moduleCatalog` em `core/domain/module.ts` — a tela
   `/modulos` lê esse catálogo via `/api/modules`
2. Criar as rotas em `app/api/modulos/<nome>/`
3. Se houver lógica de domínio reaproveitável, criar `modules/<nome>/`
4. Criar a página em `app/(sync)/modulos/<nome>/page.tsx`
5. Se precisar persistir: coleção no Firestore + regra em `firestore.rules`
   (o Firestore é a única persistência — ver seção 3.4)

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

### ⚠️ O deploy contínuo NÃO está ligado (conferido em 2026-08-05)

Esta seção descrevia, no presente, um gatilho que **não existe**:

```
$ gcloud builds triggers list
Listed 0 items.
```

O último build do Cloud Build é de **2026-07-24**. A revisão no ar,
`sync-app-00113-bfp`, foi criada em **2026-07-31** — por deploy manual. Nenhum
push desde então chegou à produção, e ninguém foi avisado, porque o único sinal
de que o deploy aconteceu era a crença de que ele acontecia.

**Enquanto o gatilho não for recriado, `git push` publica no GitHub e nada
mais.** Subir ao ar exige rodar o deploy manual:

```bash
bash scripts/deploy/deploy-cloudrun-linux.sh
```

Para religar o contínuo, o gatilho precisa ser recriado no Cloud Build,
apontando para `nomadautomacao-dot/sync`, branch `main`, arquivo
`cloudbuild.yaml`. O `cloudbuild.yaml` em si está intacto — o que sumiu foi só
o gatilho que o chamava.

O que segue é como o pipeline funciona **quando o gatilho existe**, e continua
valendo como descrição do `cloudbuild.yaml`:

1. **`test`** — `npm ci` + `npm test`. **É o gate:** se a
   suíte falha, o build aborta e a produção continua na revisão anterior.
2. **`build`** — imagem Docker (`gcr.io/opus-sec/sync-app:$BUILD_ID`).
3. **`push`** — envia a imagem ao registry.
4. **`deploy`** — `gcloud run deploy` no serviço `sync-app`. Troca só a imagem;
   **as variáveis de ambiente já configuradas no serviço são preservadas**.
5. **`smoke`** — `npm run smoke` contra a revisão recém-publicada (seção 7.1).

Consequência prática, **com o gatilho ligado**: commit quebrado não derruba o
ar, mas commit que passa nos testes vai direto para os usuários. Não existe
staging.

Consequência prática **hoje, com o gatilho ausente**: commit nenhum vai para os
usuários, e o `npm test` local passa a ser o único gate que roda de verdade.

### 7.1 Smoke test pós-deploy

O `npm test` é gate de código e cego para erro de **dado** — que aqui é a falha
mais provável, porque o produto são PDFs montados de uma dúzia de APIs públicas
vivas. Fonte que muda de layout, endpoint que passa a devolver 200 com corpo
vazio, coletor que engole a exceção e devolve `null`: nada disso quebra teste de
unidade, e tudo isso vira relatório entregue com "N/D" onde havia número.

O smoke test emite um **Raio-X de verdade** (município-canário: Igaci/AL,
`2703106`) e confere `/api/health`, a geração ponta a ponta, as 41 folhas no PDF
**entregue**, as páginas que só couberam encolhidas e se as fontes vivas
responderam com dado dentro.

```bash
npm run smoke -- http://localhost:3100          # local
npm run smoke -- <url> --municipio 2704302      # outro canário
npm run smoke -- <url> --salvar-pdf /tmp/x.pdf  # guarda o PDF para inspeção
```

Contra produção o script se recusa a rodar sem `--producao`: cada execução
dispara dezenas de chamadas a APIs públicas de governo.

**O passo `smoke` NÃO é gate** — roda *depois* do deploy, então quando falha a
revisão nova já está no ar. Ele dá aviso rápido; a reversão é manual (comando
logo abaixo, e o próprio script o imprime ao falhar). Alerta não derruba o
build; só falha sai com código 1.

As regras de julgamento ficam em `scripts/smoke/verificacoes.ts`, puras e
cobertas pela suíte; `scripts/smoke/run.ts` é só o encanamento de rede.

Acompanhar um deploy: console do Cloud Build, ou `gcloud builds list --limit=5`.
Reverter: `gcloud run services update-traffic sync-app --to-revisions=<revisão-anterior>=100 --region=us-central1`.

### Cloud Run

- **Serviço:** `sync-app` | **Projeto GCP:** `opus-sec`
- **Região:** `us-central1`
- **Recursos:** 2 vCPU, 2GB RAM, timeout 900s, 0-10 instâncias
- **URL:** `https://sync-app-n7cfomhaaq-uc.a.run.app`

### 7.2 Observabilidade de erro

Sem SDK e sem serviço de terceiro: o Cloud Error Reporting já vem ligado no
projeto e só precisa que o erro saia em **JSON numa linha só** no stderr, com
`severity: "ERROR"` e o marcador `@type` de `ReportedErrorEvent`. É o que
`core/lib/structured-log.ts` monta.

```ts
import { registrarErro } from "@/core/lib/structured-log";
// ...
} catch (error) {
  registrarErro("Raio-X municipal", error, { codigoIbge, uf });
}
```

O que muda: o erro passa a ser **agrupado por assinatura de stack, contado e
alertável**, em vez de virar uma linha de texto com severidade `DEFAULT` que
só se acha quem souber a string exata. O `contexto` vira campo próprio,
pesquisável no Logs Explorer (`jsonPayload.codigoIbge="2703106"`).

Fora de produção a saída é legível, não JSON. Segredos em query string
(`token=`, `api_key=`, …) são redigidos antes de escrever — `qedu-api.ts` monta
URL com `QEDU_TOKEN`, e um `fetch` que falha traz a URL inteira na mensagem.

**Não coloque dado pessoal nem segredo no contexto**: log é lugar de onde a
informação não sai mais.

### Variáveis obrigatórias

```yaml
FIREBASE_SERVICE_ACCOUNT: '{...}'    # JSON da service account (globalconsultorias) — verifica o ID token
NODE_ENV: "production"
```

`DATABASE_URL` e `DIRECT_URL` não são mais usadas — podem ser removidas do
serviço no Cloud Run. Se o Supabase for desligado de vez, note que
`/api/companies/upload-logo` ainda usa o **Storage** dele (`SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`); é outro serviço, não o Postgres, e essa rota
também não tem consumidor hoje.

### Comandos

```bash
# Publicar no GitHub. NÃO vai ao ar sozinho — o gatilho não existe (seção 7)
git push

# Subir de fato para produção, hoje: deploy manual
bash scripts/deploy/deploy-cloudrun-linux.sh

# Dev local (Next na porta 3100)
npm run dev

# Rodar o gate localmente antes de dar push
npm test

# Smoke test contra um alvo (seção 7.1) — emite um Raio-X de verdade
npm run smoke -- http://localhost:3100

# Docker local
docker build -t sync-app . && docker run -p 3000:3000 sync-app
```

Os scripts `scripts/deploy/deploy-cloudrun-{linux.sh,.ps1}` continuam no repo
como **saída de emergência** (deploy manual quando o trigger está fora do ar).
No fluxo normal não se usa nenhum dos dois.

---

## 8. Scripts Úteis

### Firebase
| Script | Comando npm | Descrição |
|--------|------------|-----------|
| `firebase/set-claims.mjs` | `firebase:claims` | Concede `groupId`/`groupRole` a um usuário |

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
| `dados/gerar-terras-indigenas.mjs` | `npm run dados:terras-indigenas` — aldeias e terras indígenas por município (FUNAI, WFS aberto). A FUNAI atualiza mensalmente |
| `dados/gerar-cobertura-vacinal.mjs` | `npm run dados:vacinacao` — cobertura vacinal infantil por município (PNI/DATASUS, TabNet). Série pública encerrada em 2022 |
| `dados/gerar-violencia-infantil.mjs` | `npm run dados:violencia-infantil` — notificações de violência contra criança de 5 a 14 anos (SINAN). Notificação ≠ ocorrência |
| `dados/gerar-matriculas-ponderadas.mjs` | `npm run dados:ponderadas` — matrícula ponderada e fatores oficiais do FUNDEB, derivados da planilha do FNDE |
| `dados/gerar-vaar-municipios.mjs` | `npm run dados:vaar` — status das 5 condicionalidades do VAAR e valores por município (FNDE). Regerar a cada portaria quadrimestral |
| `dados/gerar-trabalho-infantil.mjs` | `npm run dados:trabalho-infantil` — pessoas de 10 a 17 anos ocupadas na semana de referência, por município (IBGE, Censo 2022, SIDRA 10268). Censo é decenal: regerar só quando sair a divulgação **definitiva** da amostra — nesse dia a ressalva de "resultados preliminares" muda e o texto do módulo tem de mudar junto |
| `pdf/prepare-docx-templates.mjs` | Templates DOCX contratos |

### Smoke test
| Script | Comando npm | Descrição |
|--------|------------|-----------|
| `smoke/run.ts` | `smoke` | Emite um Raio-X real contra uma URL e audita saúde, folhas, corte e fontes vivas (seção 7.1) |
| `smoke/verificacoes.ts` | — | Regras de julgamento, puras e cobertas por `npm test` |

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
- **O compilador é gate.** `next.config.ts` tem `ignoreBuildErrors: false`, e
  build vermelho não sobe. Isso já esteve desligado: acumularam-se 59 erros, um
  deles uma variável lida antes de existir (`ReferenceError` em execução) e um
  recurso inteiro quebrado por um refactor sem que nada avisasse. Se voltar a
  ficar vermelho, o conserto é o erro
- Validação: Zod schemas em `core/domain/`
- API routes: `getSessionUser()` obrigatório, Zod parse, audit log em writes
- Estado de servidor: TanStack Query (`staleTime: 5min`). Estado de UI: `useState`
  local — não há store global no projeto.
- Imports: `@/core/`, `@/modules/`, `@/data/`

### RBAC — duas camadas

Tudo em `core/domain/rbac.ts`, com teste em `rbac.test.ts`.

- **GroupRole** (`owner > admin > member > viewer`) — que tipo de pessoa é no
  grupo. Viaja na custom claim `groupRole`.
- **Área × nível** — a camada fina. Nove áreas (`AREAS`, espelhando a barra
  lateral) e três níveis (`nenhum`/`ver`/`editar`). O papel define o padrão;
  a claim `perm` carrega **só os desvios**, porque custom claim tem teto de
  1000 bytes por usuária.

Duas travas não se configuram, e as duas existem para o mesmo fim — que sempre
haja alguém capaz de destravar o sistema:

1. `owner` alcança tudo, sempre. Qualquer ajuste em contrário é ignorado.
2. Ninguém abaixo de `admin` chega a `editar` em Ajustes — editar Ajustes é
   conceder acesso, e conceder acesso a si mesma é escalar privilégio.

`SessionUser.permissoes` já vem resolvido (padrão + desvios + travas): quem
consome não sabe que existe claim, e não há um segundo lugar onde alguém possa
esquecer de aplicar a trava.

A barra lateral é **derivada** de `AREAS` — área nova sem ícone não compila, e
item de menu sem regra de permissão deixou de ser possível. Esconder o item é
conveniência; a guarda que vale é a de `app/(sync)/layout.tsx`, que confere
`areaDaRota(pathname)` contra as permissões.

> **CompanyRole** (`director > manager > coordinator > analyst > operator`) e
> **ModulePermission** aparecem em documento antigo e **não existem no código**.
> Não há tela nem rota que os leia.

### O que NÃO está implementado
- Módulos: Terceirização, Formação, Atas, Tecnologia, RH, Financeiro — existem
  como chaves no `moduleCatalog` (a tela `/modulos` as exibe), sem rota nem tela
- Testes de ponta a ponta na suíte (ela é de unidade/integração: 717 testes,
  Vitest). O caminho ponta a ponta existe fora dela, no smoke test — seção 7.1
- **Staging separado de produção** — o deploy da `main` vai direto ao ar
- Monitoramento de APM / tracing (Sentry, Axiom). O que existe é erro
  agrupado no Cloud Error Reporting — seção 7.2. Falta: alerta configurado
  (o Error Reporting captura, mas ninguém é notificado), métrica de latência,
  e o log estruturado nas rotas que não são de geração de relatório

---

## 10. App desktop (Electron)

Uma janela sobre **o mesmo servidor** que roda no Cloud Run. Não há segunda
interface nem segunda API: o `next.config.ts` já emite `output: "standalone"`,
e o que muda é apenas quem hospeda o processo.

### Por que existe

Porque a máquina do consultor emite relatório melhor que o datacenter. Medido
em 2026-07-31, mesmo município e mesmo código: **19 fontes vivas localmente
contra 17 em produção**. O Portal da Transparência devolve 502/504 para o Cloud
Run e responde a uma conexão comum. Somam-se o teto de 900s por requisição e o
cold start de quem abre o app na frente do secretário.

Os dois caminhos convivem: a nuvem continua sendo o deploy da `main`.

### macOS e Windows

O app nasceu no macOS e roda nos dois desde 2026-08-04, com o **mesmo código**:
não há pasta por plataforma nem build condicional. O que existe são quatro
pontos onde o sistema operacional é consultado, todos comentados no lugar:

| Onde | O que muda |
|---|---|
| `desktop/ambiente.js` | Quais variáveis de sistema entram na lista branca |
| `desktop/menu.js` | O primeiro menu — "Global Sync" no macOS, "Arquivo" no Windows — e os papéis `hide`/`unhide`, que só o macOS implementa |
| `scripts/desktop/gerar-icones.mjs` | O `.icns` só sai no macOS; `.ico` e `.png` saem em qualquer lugar |
| `scripts/desktop/credenciais-locais.mjs` | Onde fica o `credenciais.env` |

A lista branca é o ponto que mais custou. Montada com `PATH`, `HOME` e `TMPDIR`,
ela produzia um app que subia no Mac e não subia aqui: `HOME`/`TMPDIR` não
existem no Windows, e **sem `SystemRoot` o Chromium do Playwright não chega a
iniciar**. A regra continua a mesma — o ambiente do filho é montado do zero, e
credencial herdada não passa. `desktop/ambiente.test.ts` cobre as duas
plataformas rodando em qualquer uma das duas.

### Arquitetura do pacote

| Parte | Conteúdo |
|---|---|
| `app.asar` | Só `desktop/*.js` — o processo principal. `node_modules` fica de fora |
| `resources/servidor` | O `.next/standalone` (675 MB), fora do asar: o servidor abre arquivos por caminho real |
| `resources/chromium` | O Chromium do Playwright (685 MB), **nas duas variantes**. Sem ele o app abre e só quebra na primeira emissão |

Sobre as duas variantes: `chromium.executablePath()` devolve o Chromium
completo, mas `chromium.launch({ headless: true })` — o padrão, e o que os 14
geradores usam — executa o `chromium_headless_shell`. Embarcar só o primeiro
produz um app que abre, navega e falha na emissão com *"Executable doesn't
exist"*. É o mesmo conjunto que `npx playwright install chromium` põe na imagem
de produção, e igualar os dois evita diferença de renderização entre o PDF daqui
e o da nuvem.

**Só a versão em uso, e não tudo que o cache guarda.** O Playwright não apaga a
versão antiga ao atualizar, e varrer a pasta por padrão embarcava as duas —
meio giga de Chromium que o app nunca abriria. O número sai do executável que o
Playwright instalado escolhe, então acompanha a atualização sozinho.

| Arquivo | Papel |
|---|---|
| `desktop/main.js` | Janela, downloads, links externos, instância única |
| `desktop/servidor.js` | Sobe o standalone em `127.0.0.1` numa **porta efêmera** e espera `/api/health` |

A espera por `/api/health` é **paciente de propósito**: 15s por tentativa, e não
2s. A primeira requisição custa 0,2s num servidor solto e passa de 2s dentro do
`utilityProcess`, porque concorre com o Electron abrindo a janela e com o Node
carregando 675 MB de módulo pela primeira vez. Pior: a tentativa abortada não
cancela o trabalho do servidor, então sondar de novo a cada 250ms empilhava
requisições disputando a mesma CPU — numa máquina ocupada virava
congestionamento que não saía sozinho, e o app desistia com "o servidor não
subiu" com o servidor no ar o tempo todo.

O servidor sobe por `utilityProcess.fork`, **não** por `child_process.spawn`.
Fazer `spawn(process.execPath, [server])` com `ELECTRON_RUN_AS_NODE=1` funciona,
mas o macOS registra esse filho no LaunchServices e **um segundo ícone aparece
no Dock** — com o nome "Global Sync" e a arte genérica de executável Unix, que
mostra a palavra `exec`. Do lado do usuário parece que o app abriu duas vezes,
uma delas quebrada. `utilityProcess` é a API feita para isso: filho Node, sem
registro no Dock, mesmo V8 da janela, sem runtime separado embarcado.
| `desktop/ambiente.js` | Monta o ambiente do filho a partir de uma **lista branca** |
| `desktop/menu.js` | Menu nativo em português |
| `scripts/desktop/preparar-servidor.mjs` | Completa o standalone e tira os segredos de dentro |
| `scripts/desktop/gerar-icones.mjs` | `.icns`/`.ico` a partir de `public/global-sync-icon.png`. Quem redimensiona é o **Chromium do Playwright** — já é dependência do projeto e reamostra igual nos três sistemas, ao contrário do `sips`, que só existe no macOS e fazia o empacotamento morrer na linha 1 fora dele |
| `scripts/desktop/credenciais-locais.mjs` | Leva as chaves do `.env.local` para o arquivo que o app lê |

### Credenciais — fora do pacote, sempre

O caminho é o `app.getPath("userData")` de cada sistema:

    macOS    ~/Library/Application Support/Global Sync/credenciais.env
    Windows  %APPDATA%\Global Sync\credenciais.env

O menu **Credenciais…** (em "Global Sync" no macOS, em "Arquivo" no Windows)
cria o gabarito e abre. `npm run desktop:credenciais` preenche a partir do
`.env.local` — preferível a copiar à mão, porque a service account tem 2.348
caracteres numa linha só e um editor que quebre linha produz 401 em toda rota.

Ficam fora por dois motivos. O `next build` copia todo `.env*` para dentro do
standalone, e um `.app` é um diretório que qualquer um descompacta — sairia com
a service account do Firebase, que é acesso administrativo ao Firestore. E o
`.env` local define `NODE_TLS_REJECT_UNAUTHORIZED=0`, que desliga a verificação
de certificado do processo **inteiro**; o `preparar-servidor.mjs` apaga esses
arquivos e o `ambiente.js` só deixa passar o que está na lista.

### A lista que não pode divergir

`COMPLEMENTOS` em `preparar-servidor.mjs` é **a mesma lista das linhas 68–99 do
`Dockerfile`**: o que o rastreamento do Next não enxerga porque é aberto por
caminho em tempo de execução. Item acrescentado num lugar e esquecido no outro
faz o app divergir da nuvem numa funcionalidade só, em silêncio — foi assim que
o `playwright-core` chegou sem `browsers.json` e nenhum PDF saía.

### Comandos

```bash
npm run desktop:preparar    # build + completa o standalone + embarca o Chromium
npm run desktop             # abre em desenvolvimento (usa o .env.local)
npm run desktop:credenciais # leva as chaves do .env.local para o app instalado
npm run desktop:empacotar   # ícones + preparar + electron-builder → dist-desktop/
```

O `desktop:preparar` chama o `next build` com `--max-old-space-size=8192` em vez
do `npm run build`. É a única diferença em relação ao build da nuvem, e é só
teto de heap: com o padrão de 4 GB a checagem de TypeScript estoura numa máquina
de 16 GB. O `Dockerfile` fixa 4096 e passa porque lá não há mais nada rodando.

No Windows a saída é `dist-desktop/Global-Sync-<versão>-instalador.exe` (436 MB)
— NSIS com escolha de pasta, instalação no perfil do usuário e sem UAC. Para
apenas rodar sem instalar, `dist-desktop/win-unpacked/Global Sync.exe` já é o
app pronto.

### O que falta

- **Assinatura.** Construído e aberto na própria máquina, o app roda sem atrito
  nos dois sistemas. Enviado para outra pessoa, um `.dmg` esbarra no Gatekeeper
  e o `.exe` no SmartScreen ("aplicativo não reconhecido") — o instalador
  funciona depois de "Mais informações → Executar assim mesmo", mas isso é
  atrito na frente de quem recebe
- **Atualização automática.** Hoje uma versão nova exige reinstalar
- **Python.** As 3 rotas que usam ReportLab (`levantamento-fundeb` pdf e
  autônomo, e slides) dependem do Python do sistema; o pacote não o embarca. Não é
  regressão — `reportlab` também não está instalado nesta máquina
- **Ícone em alta.** A fonte tem 298×300. O dock e a barra de tarefas ficam
  nítidos; a variante de 1024 sai interpolada. Um export maior da marca resolve
  sem tocar em código

---

## 11. Acessos (`/ajustes` › aba Acessos)

Quem entra no Sync e até onde vai. Aba visível só para `owner`/`admin`, em
`core/components/ajustes/acessos.tsx`, servida por `app/api/acessos/`.

| Rota | Método | O que faz |
|---|---|---|
| `/api/acessos` | GET | Lista as usuárias do grupo |
| `/api/acessos` | POST | Cria ou vincula por e-mail e devolve o link de senha |
| `/api/acessos/[uid]` | PATCH | Papel, permissões e situação (ativa/desativada) |
| `/api/acessos/[uid]` | POST | Gera novo link de definição de senha |

Regras puras e testadas em `core/lib/acessos.ts`. Três coisas para não quebrar:

1. **`setCustomUserClaims` substitui o objeto inteiro.** O Auth é um só do
   projeto `globalconsultorias`, compartilhado com os outros produtos Global —
   gravar `{groupId, groupRole}` direto apagaria a claim que a mesma pessoa usa
   no outro sistema, e o estrago só apareceria no dia em que ela tentasse
   entrar lá. Toda escrita passa por `mesclarClaims()`.
2. **Conta preexistente não tem a senha tocada.** Provisionar procura por
   e-mail antes de criar; se acha, vincula.
3. **Senha não passa pelo sistema.** A conta nasce sem senha e a rota devolve
   um link do Firebase para a própria pessoa definir a dela. Não existe rota
   que grave senha — nem a administradora nem o servidor chegam a vê-la.

Claim nova só vale no **próximo token**: a pessoa precisa entrar de novo. A
tela diz isso; sem esse aviso, parece que a mudança não pegou.

---

## 12. Console de sistemas (`/sistemas`)

Administra **os outros produtos Global** a partir do Sync. Chegou no commit
`2c572ea`, vindo da máquina Windows — até então esta seção descrevia um plano
como se fosse código, e nada dela existia no repositório.

**Acessos e Sistemas não são a mesma coisa.** Acessos (seção 11) governa quem
entra **no Sync**; Sistemas governa contas e prefeituras **de outros produtos**,
escrevendo no banco deles pelo Admin SDK. Por isso as duas guardas têm nomes
próprios em `core/domain/rbac.ts` — `podeAdministrarAcessos` e
`podeAdministrarSistemas` — mesmo tendo hoje a mesma régua (`admin`): fundir os
dois faria afrouxar um afrouxar o outro sem ninguém notar.

`sistemas` também é uma **área** do catálogo de permissões, e a mais dura de
todas: abaixo de `admin` ela é forçada a `nenhum`, sem nível intermediário. Não
existe "ver" seguro numa tela que lista contas de outro produto.

### Confirmado ao vivo em 2026-08-05

Sonda somente-leitura com a service account do próprio Sync, contra o projeto
`globalconsultorias`:

| O que | Situação |
|---|---|
| Banco nomeado `globaledu` | **Existe** e é alcançável — `getFirestore(app, "globaledu")` |
| Coleção `users` nele | **Existe**, com `ativo, createdAt, email, nome, role, tenantIds, updatedAt` — bate com o dialeto declarado no catálogo |
| Coleção `tenants` nele | **Vazia, e nem aparece na listagem** — nenhuma prefeitura foi cadastrada ainda |

Consequência: o lado de **usuários** está validado contra dado real; o lado de
**prefeituras** ainda não. O primeiro cadastro pelo console vai criar o primeiro
documento que já existiu em `tenants` — e nada garante ainda que o GlobalEdu lê
essa coleção com esse nome. Conferir do lado dele antes de cadastrar em série.

> **Não confundir com `integra-edu-sr` ("Educa Serra").** É outro produto, de
> outro projeto Firebase (`opus-sec`), cujas rules autorizam por **documento**
> (`get(/users/$(uid)).data.perfil`) e não por claim. Ele **não** está no
> catálogo de sistemas e não é administrável por este console.

### Por que aqui

Todos os produtos Global vivem no projeto Firebase `globalconsultorias`, cada um
no seu **banco nomeado**. O servidor do Sync já tem service account desse
projeto, então alcança qualquer um deles direto — `getFirestore(app, "globaledu")`.
Não há API entre produtos nem troca de token.

E provisionar usuário **exige o Admin SDK**: as rules do GlobalEdu só autorizam
escrita em `users/{uid}` para quem já é `global_admin`, e nenhum Web SDK fura
isso. Um console em SPA precisaria de um backend só para essa parte.

### Cadastro de prefeitura

Digitar o nome basta. A escolha na lista do IBGE traz código, UF e região, e o
dossiê preenche população, prefeito, Censo Escolar da rede municipal e IDEB —
tudo de `data/*.json`, sem chamada de rede. O Censo vai gravado no tenant como
linha de base da implantação. Regra em `core/lib/municipios-dossie.ts`:
indicador que exija API viva não entra no cadastro.

### Somar um produto ao console

Uma entrada em `CATALOGO_DE_SISTEMAS`, em `core/domain/sistemas.ts`. A entrada
declara o *dialeto* do produto — coleções, nomes de campo e chaves de claim — e
as telas e rotas passam a atendê-lo sem mais nenhuma alteração.

### Três coisas para não quebrar

1. **O Auth é um só do projeto**, e `setCustomUserClaims` **substitui** o objeto
   inteiro. Toda escrita de claim passa por `mesclarClaims()`, senão provisionar
   alguém no GlobalEdu apaga o `groupId`/`groupRole` dele aqui. Corolário: as
   chaves de claim não podem colidir entre produtos do catálogo.
2. **Conta preexistente não tem a senha tocada.** Provisionar procura por e-mail
   antes de criar; se acha, vincula.
3. **Documento e claim divergem em silêncio** — as rules leem o token, não o
   Firestore. A listagem cruza os dois e oferece ressincronizar.

### Permissão

`podeAdministrarSistemas()` em `core/domain/rbac.ts` exige `admin` ou `owner`.
A guarda que vale é a das rotas (`core/lib/sistemas-http.ts`); esconder o item
da barra lateral é conveniência.

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
