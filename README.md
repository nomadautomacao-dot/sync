<div align="center">
  <img src="sync_flutter/assets/branding/global-sync-icon.png" alt="Global Sync" width="88" />

  # Global Sync

  **Plataforma de gestão e automação para consultoria educacional FUNDEB**
  <br />
  Rocha Prime Consultorias

  [![Next.js](https://img.shields.io/badge/Next.js-16.2-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
  [![Flutter](https://img.shields.io/badge/Flutter-3.44-02569B?logo=flutter&logoColor=white)](https://flutter.dev/)
  [![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%C2%B7%20Auth%20%C2%B7%20Functions-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
  [![Node](https://img.shields.io/badge/Node-22-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
  [![Cloud Run](https://img.shields.io/badge/Cloud%20Run-us--central1-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)

  📖 **Documentação completa:** [CLAUDE.md](./CLAUDE.md)
</div>

---

## O que faz

- Gera levantamentos financeiros automáticos de municípios (IBGE, FNDE, INEP, TSE, SICONFI, QEdu, IDEB)
- Produz relatórios técnicos e comerciais para prospecção B2G
- Automatiza a geração de kits documentais de inexigibilidade (Lei 14.133/21)
- Gerencia o pipeline de cidades, contratos, colaboradores e comissões

## Arquitetura em uma frase

O produto **é o app Flutter**. Ele lê e escreve direto no **Firestore/Storage**, e chama o
**Next.js apenas como BFF** para dados públicos de FUNDEB e geração de documentos. O Next
não tem interface própria — só rotas de API em `app/api/**` e a entrega do build web do
Flutter em `public/flutter-web/`.

```mermaid
graph LR
  A[App Flutter<br/>Web · Android] -->|CRUD· auth| B[(Firestore<br/>+ Storage)]
  A -->|dados FUNDEB<br/>e PDFs| C[Next.js BFF<br/>app/api]
  C -->|APIs públicas| D[IBGE · FNDE · INEP<br/>TSE · SICONFI · QEdu]
  C -->|ReportLab · Playwright| E[PDF / DOCX]
  B --> F[Cloud Functions v2<br/>motor de comissões]
```

## Quick Start

```bash
# 1. Instalar dependências
npm install

# 2. Configurar credenciais
cp .env.example .env.local   # preencher com as credenciais reais

# 3. Rodar backend + Flutter Web
npm run dev
```

Outros modos: `npm run dev:next` (só a API, porta 3100),
`bash sync_flutter/run_local.sh --no-flutter` (só backend), `--rebuild-web` (reconstrói o
bundle em `public/flutter-web/`) e `--kill` (encerra tudo).

> **Linux desktop não é um alvo suportado.** O app depende de Firebase Auth, Firestore e
> Storage, e o FlutterFire não tem implementação para Linux — nenhum plugin `firebase_*`
> registra para essa plataforma, então o binário compila mas morre no
> `Firebase.initializeApp` antes de abrir a janela. Use Web ou Android.

> `.env.example` cobre apenas a configuração do Firebase. As integrações opcionais
> (`QEDU_TOKEN`, `SUPABASE_*`, e `DATABASE_URL`/`DIRECT_URL` do Postgres legado) precisam ser
> adicionadas manualmente ao `.env.local`.

> As telas React (`/entrar`, `/painel`) leem a config do Firebase em tempo de build do
> bundle: as seis `NEXT_PUBLIC_FIREBASE_*` do `.env.example` precisam estar no `.env.local`,
> senão o SDK web falha no boot e a tela não carrega. As rotas de API não dependem delas.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend (o produto) | Flutter 3.44 / Dart 3.12 — Web e Android |
| Persistência | Cloud Firestore + Firebase Storage (fonte de verdade) |
| Autenticação | Firebase Auth + custom claims (`groupId`, `groupRole`) |
| Backend (BFF) | Next.js 16.2 App Router, React 19, Node 22 |
| Serverless | Cloud Functions v2 (`functions/`) — motor de comissões |
| Documentos | Python 3 + ReportLab 5/Pillow 12, Playwright, docxtemplater, pacote `pdf` (Dart) |
| Infra | Google Cloud Run, Cloud Build, Docker multi-stage |
| Legado | Prisma 6 + Supabase/PostgreSQL — em desativação (Fase 5) |

> **Migração em andamento:** o CRUD operacional (cidades, empresas, colaboradores,
> documentos, auditoria, settings) já roda no Firestore. As rotas Next que ainda usam Prisma
> são legadas, estão marcadas como `DEPRECATED` no código e serão removidas junto com
> `core/lib/data-access.ts` e `collaboration-data-access.ts`.

## Estrutura

```
app/api/                      → Rotas de API (BFF) + geradores PDF em Python
core/                         → Domínio, libs server-side, auth, integrações
modules/                      → Lógica de negócio (FUNDEB, contratos, propostas)
sync_flutter/                 → App Flutter multiplataforma (a interface do produto)
functions/                    → Cloud Functions v2 (comissões sobre Firestore)
kit_padrao_pdf_rocha_prime/   → Estilo compartilhado dos PDFs (ReportLab)
firestore.rules               → Regras de acesso (escopo por grupo via claims)
storage.rules                 → Regras do Firebase Storage
docs/                         → Specs de negócio e roadmaps
scripts/                      → Deploy, dados, manutenção
```

## Testes

```bash
npm test                          # Vitest (core/, modules/)
npm --prefix functions test       # node:test (Cloud Functions)
cd sync_flutter && flutter test   # Testes do app
```

## Deploy

```bash
./scripts/deploy/deploy-cloudrun-linux.sh   # Next.js + geradores → Cloud Run
firebase deploy --only functions            # Cloud Functions
```

**Serviço:** `sync-app` · **Projeto GCP:** `opus-sec` · **Região:** `us-central1`
