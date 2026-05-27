# Migration Map

## Shell principal

- `app/(workspace)/layout.tsx` -> `lib/src/features/shell/presentation/sync_shell.dart`
- `components/layout/sidebar.tsx` -> sidebar/drawer adaptativo no shell Flutter
- `components/layout/header.tsx` -> header superior com busca, contexto e conta
- `components/layout/context-panel.tsx` -> painel lateral direito no desktop largo

## Telas auditadas do workspace

- `app/(workspace)/dashboard/page.tsx` + `modules/dashboard/dashboard-page.tsx`
  -> `dashboard_screen.dart`
- `app/(workspace)/companies/page.tsx`
  -> `companies_screen.dart`
- `app/(workspace)/companies/new/page.tsx`
  -> fluxo planejado como wizard Flutter no proximo ciclo
- `app/(workspace)/companies/[companyId]/page.tsx`
  -> detalhe mapeado, ainda nao portado
- `app/(workspace)/people/page.tsx`
  -> `people_screen.dart`
- `app/(workspace)/inbox/page.tsx`
  -> `inbox_screen.dart`
- `app/(workspace)/modules/page.tsx`
  -> `modules_screen.dart`
- `app/(workspace)/settings/page.tsx` + `settings-form.tsx`
  -> `settings_screen.dart`

## Tema

- `styles/design-tokens.css`
  -> `lib/src/core/theme/app_theme.dart`

## Dominio e dados

- `core/domain/module.ts`
  -> `module catalog` em `sync_models.dart`
- `core/hooks/use-executive-dashboard.ts`
  -> contrato espelhado em `DashboardOverview`
- `expo-app/hooks/queries.ts`
  -> referencia para futura camada real de API

## Decisoes de arquitetura

- estado local com `ChangeNotifier` para a primeira base
- repositorio fake para preservar ritmo de migracao sem bloquear no backend
- shell responsivo: drawer em largura pequena, sidebar fixa em desktop
- sem dependencia externa nesta fase, para manter a base enxuta e facil de compilar depois

## Fase 2 concluida

- autenticacao real por cookie via `/api/auth/login`
- persistencia local de sessao
- fluxo real de empresas:
  - listagem
  - detalhe
  - funcionarios vinculados
  - atualizacao de modulos

## Fase 3 iniciada

- `modules/levantamento-fundeb/levantamento-fundeb-page.tsx`
  -> `lib/src/features/modules/presentation/levantamento_fundeb_screen.dart`
- `app/api/municipio/completo/route.ts`
  -> `getLevantamentoFundeb()` em `remote_sync_repository.dart`
- `app/api/municipios/buscar/route.ts`
  -> `searchMunicipios()` em `remote_sync_repository.dart`
- `app/api/modulos/levantamento-fundeb/relatorio-dirigido/route.ts`
  -> `refreshRelatorioDirigido()` em `remote_sync_repository.dart`
- `modules/levantamento-fundeb/types.ts`
  -> `lib/src/core/models/levantamento_fundeb_models.dart`
