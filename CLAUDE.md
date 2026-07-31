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
| `/api/modulos/levantamento-fundeb/batch` | POST | Levantamento em lote |
| `/api/modulos/levantamento-fundeb/censo-inep` | GET | Dados do Censo INEP |
| `/api/modulos/levantamento-fundeb/pdf` | POST | Geração de PDF (Python/ReportLab) |
| `/api/modulos/levantamento-fundeb/relatorio-dirigido` | POST | Relatório dirigido com IA |
| `/api/modulos/levantamento-fundeb/raio-x` | POST | Raio-X municipal em PDF (41 páginas) |
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

### Deploy contínuo (push na main → produção)

Um trigger do Cloud Build observa a `main` no GitHub. A cada push ele roda o
`cloudbuild.yaml`, em sequência:

1. **`test`** — `npm ci` + `npm test`. **É o gate:** se a
   suíte falha, o build aborta e a produção continua na revisão anterior.
2. **`build`** — imagem Docker (`gcr.io/opus-sec/sync-app:$BUILD_ID`).
3. **`push`** — envia a imagem ao registry.
4. **`deploy`** — `gcloud run deploy` no serviço `sync-app`. Troca só a imagem;
   **as variáveis de ambiente já configuradas no serviço são preservadas**.
5. **`smoke`** — `npm run smoke` contra a revisão recém-publicada (seção 7.1).

Consequência prática: **commit quebrado não derruba o ar, mas commit que passa
nos testes vai direto para os usuários.** Não existe staging.

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
# Subir para produção — é isto e mais nada
git push

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
- Testes de ponta a ponta na suíte (ela é de unidade/integração: 694 testes,
  Vitest). O caminho ponta a ponta existe fora dela, no smoke test — seção 7.1
- **Staging separado de produção** — o deploy da `main` vai direto ao ar
- Monitoramento de APM / tracing (Sentry, Axiom). O que existe é erro
  agrupado no Cloud Error Reporting — seção 7.2. Falta: alerta configurado
  (o Error Reporting captura, mas ninguém é notificado), métrica de latência,
  e o log estruturado nas rotas que não são de geração de relatório

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
