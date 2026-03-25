# Sync

Plataforma centralizada de gestao multi-empresa baseada no documento [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + Design Tokens Sync Dark
- TanStack Query + Zustand
- Radix UI + cmdk + Sonner
- Prisma (schema inicial)
- API BFF em `app/api/*`

## Rodando localmente

```bash
npm install
npm run dev
```

App: `http://localhost:3000`

## Banco de dados (Supabase automatico)

As APIs agora funcionam apenas com banco real (Supabase/Postgres via Prisma).
Nao ha mais fallback para dados mockados.

### Bootstrap em 1 comando

1. Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

2. No Supabase, clique em `Connect` (topo da tela) e abra a aba `Connection String`:
- `DATABASE_URL`: use `Method = Transaction pooler` (porta `6543`).
- `DIRECT_URL`: use `Method = Direct connection` (host `db.<project-ref>.supabase.co`, porta `5432`).
- Se sua rede bloquear `db.<project-ref>.supabase.co:5432` (`P1001`), use `Session pooler` na `DIRECT_URL` (porta `5432` no host `aws-...pooler.supabase.com`).

3. Substitua `[YOUR-PASSWORD]` pela senha real do banco (de preferencia URL-encoded).
No PowerShell:

```powershell
[uri]::EscapeDataString("SUA_SENHA_AQUI")
```

4. Rode:

```bash
npm run supabase:bootstrap
```

Esse comando executa:
- `prisma generate`
- `supabase:check` (valida conexao)
- `prisma db push --accept-data-loss`
- `prisma db seed`

Para testar apenas conexao antes:

```bash
npm run supabase:check
```

Depois disso, ao iniciar com `npm run dev`, o sistema ja le e grava no Supabase.

## Autenticacao Google (NextAuth)

1. No Google Cloud Console, crie um OAuth Client ID (tipo `Web application`).
2. Em `Authorized redirect URIs`, adicione:
- `http://localhost:3000/api/auth/callback/google`
- `http://localhost:3001/api/auth/callback/google` (opcional se a porta 3000 estiver ocupada)
3. Preencha no `.env.local`:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL` (ex.: `http://localhost:3000`)
- `NEXTAUTH_SECRET` (texto aleatorio longo)
4. Reinicie o servidor (`npm run dev`) e acesse `http://localhost:3000/login`.

### Limpar tudo e comecar do zero (sem SQL)

```bash
npm run supabase:clean
```

Esse comando remove empresas, funcionarios, logs e recria apenas o contexto minimo:
- 1 grupo (`SYNC_GROUP_*`)
- 1 usuario admin (`SYNC_ADMIN_*`)

Opcional (schema + limpeza):

```bash
npm run supabase:reset
```

## Estrutura principal

- `app/(workspace)` layout three-pane + rotas operacionais
- `app/api` camada BFF inicial
- `core` dominio, hooks, stores, libs
- `components` UI core, layout e formularios
- `modules` modulos de negocio isolados
- `prisma/schema.prisma` modelos de persistencia
