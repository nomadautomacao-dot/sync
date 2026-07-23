<div align="center">
  <img src="sync_flutter/assets/branding/global-sync-icon.png" alt="Global Sync" width="88" />

  # Global Sync

  **Plataforma de gestão e automação para consultoria educacional FUNDEB**
  <br />
  Rocha Prime Consultorias

  [![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
  [![Flutter](https://img.shields.io/badge/Flutter-3.38-02569B?logo=flutter&logoColor=white)](https://flutter.dev/)
  [![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
  [![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?logo=firebase&logoColor=white)](https://firebase.google.com/)
  [![Cloud Run](https://img.shields.io/badge/Cloud%20Run-us--central1-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)

  📖 **Documentação completa:** [CLAUDE.md](./CLAUDE.md)
</div>

---

## O que faz

- Gera levantamentos financeiros automáticos de municípios (IBGE, FNDE, INEP, TSE, SICONFI, QEdu, IDEB)
- Produz relatórios técnicos e comerciais para prospecção B2G
- Automatiza a geração de kits documentais de inexigibilidade (Lei 14.133/21)
- Gerencia o pipeline de cidades, contratos, colaboradores e comissões

## Quick Start

```bash
# 1. Instalar dependências
npm install

# 2. Configurar banco
cp .env.example .env    # preencher com credenciais reais
npm run supabase:bootstrap

# 3. Rodar localmente (Next.js + Flutter Linux)
./run-local.sh
```

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Next.js 16 (App Router), Prisma 6, Supabase (PostgreSQL) |
| Autenticação | Firebase Auth (`firebase-admin`) |
| Frontend | Flutter 3.38 (Linux, Web, Android) |
| Documentos | Python 3 + ReportLab/Pillow, docxtemplater, jsPDF |
| Infra | Google Cloud Run, Cloud Build, Docker multi-stage |

> O Next.js não tem interface própria — toda a UI é o app Flutter. O papel do
> Next é servir as rotas de API, gerar documentos e entregar o build web do
> Flutter em `public/flutter-web/`.

## Estrutura

```
app/api/        → API Routes (BFF)
core/            → Domínio, libs server-side, providers
modules/         → Lógica de negócio (FUNDEB, contratos, propostas)
sync_flutter/    → App Flutter multiplataforma (a interface do produto)
docs/            → Specs de negócio e roadmaps
scripts/         → Scripts de deploy, dados e manutenção
```

## Deploy

```bash
./scripts/deploy/deploy-cloudrun-linux.sh
```

**Serviço:** `sync-app` · **Projeto GCP:** `opus-sec` · **Região:** `us-central1`
