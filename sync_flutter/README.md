# Sync Flutter

Frontend multiplataforma do **PrimeOS / Sync** — consultoria FUNDEB.

## Plataformas

| Plataforma | Comando | Uso |
|-----------|---------|-----|
| **Linux** | `flutter run -d linux` | Desenvolvimento local |
| **Web** | `flutter build web --release --base-href /flutter-web/` | Produção (embutido no Next.js) |
| **Android** | `flutter run -d <device>` | App mobile |

## Executar localmente

```bash
# Da raiz do projeto (sobe Next.js + Flutter Linux juntos)
./run-local.sh
```

## Arquitetura

```
lib/
  main.dart                       # Entry point
  src/
    core/
      models/                     # Data models (Levantamento, Company, etc.)
      repositories/               # Data access (remote, local, hybrid, mock)
      services/                   # API client, auth service
      theme/                      # Material 3 design tokens
      utils/                      # File saver, helpers
    features/
      auth/                       # Login screen
      dashboard/                  # Home dashboard
      cities/                     # Municipality management
      modules/                    # FUNDEB modules (levantamento, contratos)
      people/                     # Collaborator management
      shared/                     # Shared widgets
      shell/                      # App shell (sidebar, navigation)
```

## Design System

- **Material 3** com seed color `#2F6BFF`
- Sidebar escura (`#1B2A4A`) + conteúdo claro
- Font: Inter Variable
- Ícones: Lucide Icons
