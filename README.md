# Sync

Plataforma de gestão e automação para consultoria educacional FUNDEB — **Rocha Prime Consultorias**.

> 📖 **Documentação completa:** [CLAUDE.md](./CLAUDE.md)

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
| Backend | Next.js 16, Prisma 6, Supabase (PostgreSQL) |
| Frontend | Flutter 3.38 (Linux, Web, Android) |
| Infra | Google Cloud Run, Cloud Build, Docker |

## Deploy

```bash
./scripts/deploy/deploy-cloudrun-linux.sh
```

## Estrutura

```
app/api/        → API Routes (20 endpoints)
core/           → Domínio, hooks, libs, stores
modules/        → Módulos de negócio (FUNDEB, contratos, propostas)
components/     → UI reutilizáveis (Radix + Tailwind)
sync_flutter/   → App Flutter multiplataforma
docs/           → Specs de negócio e roadmaps
scripts/        → Scripts de deploy, dados e manutenção
```
