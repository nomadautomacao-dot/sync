# Rebrand: Rocha Prime → Global Sync (login, navbar, nome do app)

> Data: 2026-07-23

## Contexto

O produto passa a se chamar **Global Sync**. O usuário forneceu um novo logo
comercial (`public/logo.jpg`): um ícone quadrado com cantos arredondados,
gradiente teal→azul, com um símbolo de bússola em branco, seguido do
wordmark "Global Sync". Hoje o app usa a marca antiga "Rocha Prime" com um
ícone "P" (`prime-icon-extracted.png`) na tela de login e na sidebar.

Este design cobre a troca do ícone e do nome onde o app expõe branding hoje:
tela de login, sidebar/navbar, e o nome do app no SO (título da aba do
navegador, rótulo do Android). Não cobre os geradores de PDF/relatórios
(case de sucesso, contrato FUNDEB, slides, levantamento) — ficam para uma
rodada futura, por pedido explícito do usuário.

## Asset novo

Extração do ícone a partir de `public/logo.jpg`:
- Recorte da região do ícone (bbox ~165,252 a ~455,544 no jpg original)
- Fundo (~#101010) removido via alpha por distância de cor, preservando os
  cantos arredondados do ícone
- Salvo como `sync_flutter/assets/branding/global-sync-icon.png` (RGBA)

O ícone já é um "badge" completo (quadrado + cor + símbolo) — diferente do
`prime-icon-extracted.png` atual, que é só o glifo transparente dentro de um
`Container` branco. Portanto, ao trocar, o container branco de fundo/sombra
vira só sombra (sem `color: cardWhite`), deixando o próprio ícone preencher
o quadrado.

## Mudanças por arquivo

### `sync_flutter/lib/src/features/auth/presentation/login_screen.dart`
- Badge do topo: troca `prime-icon-extracted.png` por `global-sync-icon.png`;
  remove o preenchimento branco do `Container` (mantém `borderRadius` e
  `boxShadow`); remove o `Padding` interno de 16 (o novo ícone já vem com a
  margem do quadrado, não precisa de respiro extra)
- Texto `'Rocha Prime'` → `'Global Sync'`
- Remove o `Text('SERVIÇOS ESPECIALIZADOS', ...)` e o `SizedBox` de espaçamento
  associado
- Rodapé: `'© 2026 Rocha Prime Serviços Especializados Ltda'` →
  `'© 2026 Global Sync'`

### `sync_flutter/lib/src/features/shell/presentation/sync_shell.dart`
- `_ShellSidebar`: ícone 32×32 troca para `global-sync-icon.png`; texto
  `'Rocha Prime'` → `'Global Sync'`; remove o `Text('SERVIÇOS ESPECIALIZADOS', ...)`
- Três strings soltas no mesmo arquivo (notificação mock, texto de ajuda,
  descrição de configurações) que citam "Rocha Prime" → "Global Sync", para
  não deixar o arquivo inconsistente

### `sync_flutter/pubspec.yaml`
- Confirma que `assets/branding/` já está declarado (cobre o novo PNG sem
  mudança adicional)

### `sync_flutter/web/index.html`
- `<title>PrimeOS</title>` → `<title>Global Sync</title>`
- `apple-mobile-web-app-title` → `Global Sync`

### `sync_flutter/android/app/src/main/AndroidManifest.xml`
- `android:label="SYNC"` → `android:label="Global Sync"`

## Fora de escopo (explícito)

- Textos "Rocha Prime" nos PDF builders (`case_sucesso_pdf_builder.dart`,
  `fundeb_comercial_pdf_builder.dart`, `fundeb_levantamento_pdf_builder.dart`,
  `slides_institucional_pdf_builder.dart`, `saeb_ideb_mt_pdf_builder.dart`) e
  nos assets `logo-rocha-prime-*` — mantidos como estão
- Paleta de cores do app (navy `#1B2A4A` etc.) — não muda, só ícone e nome
- Página web pública fora do Flutter (`public/logo.jpg` fica só como fonte
  de referência, não é servido diretamente)

## Verificação

- `flutter analyze` no `sync_flutter/` sem novos erros
- Rodar o app (web ou linux) e visualizar tela de login e sidebar com o
  ícone e nome novos
- Conferir que nenhuma referência a `prime-icon-extracted.png` sobrou nos
  dois arquivos alterados (a menos que outras telas ainda a usem
  legitimamente, fora do escopo deste design)
