---
name: Global Sync
description: Console operacional para consultoria FUNDEB. Direcao "Console Tecnico" — claro, denso e instrumental, com hierarquia construida por duas familias tipograficas em vez de cor.
colors:
  scaffold: "#EEF1F6"
  card-white: "#FFFFFF"
  surface-subtle: "#F7F9FB"
  surface-alt: "#F1F3F7"
  border-light: "#E2E8F0"
  border-strong: "#D8DEE6"
  border-stronger: "#C9D0DB"
  text-title: "#111827"
  text-body: "#374151"
  text-soft: "#4B5563"
  text-muted: "#6B7280"
  text-dim: "#9CA3AF"
  primary: "#049598"
  primary-hover: "#036B69"
  primary-light: "#DCF2F0"
  primary-dim: "#5FA3A0"
  success: "#10B981"
  success-light: "#E7F7F1"
  success-dark: "#065F46"
  warning: "#F59E0B"
  warning-light: "#FEF6E7"
  warning-border: "#FDE9C8"
  warning-dark: "#B45309"
  error: "#EF4444"
  error-light: "#FEF2F2"
  error-dark: "#991B1B"
typography:
  ui-family: "InstrumentSans"
  data-family: "IBMPlexMono"
---

# Global Sync — Console Tecnico

Fonte de verdade da implementacao: `sync_flutter/lib/src/core/theme/app_theme.dart`
(`SaaSTokens` + `GsText`). Referencia visual original: `docs/design/global-sync-redesign.dc.html`,
recortada por tela em `docs/design/screens/`.

## A ideia em uma frase

O produto e um instrumento de trabalho de campo, nao um dashboard de SaaS. A hierarquia
nasce de **duas familias tipograficas** — nao de uma segunda cor, nao de sombra, nao de
gradiente. Texto de interface em `InstrumentSans`; **todo numero, codigo, data, sigla e
rotulo tecnico em `IBMPlexMono`**, com figuras tabulares para que colunas de dinheiro
alinhem na virgula e o olho compare linha a linha.

## O que mudou em relacao a versao anterior

A paleta permanece **identica** — teal `#049598` continua sendo o accent unico, cards
continuam brancos e planos com borda de 1px, o alvo de toque continua 48dp. O que mudou:

| Area | Antes | Agora |
|---|---|---|
| Familia | Inter, sozinha | InstrumentSans (UI) + IBMPlexMono (dados) |
| Numeros | mesma fonte do texto | mono tabular, alinhados |
| Rotulos | sentence case, sans | mono, CAIXA ALTA, 10px, tracking 0.9–1.2px |
| Login | hero navy escuro | fundo claro com leve tinta teal |
| Gold premium | token de destaque | **removido** — quebrava a regra de um accent so |
| Marca | Rocha Prime | Global Services Consultorias |

## Tipografia

Use sempre os papeis de `GsText`; nunca escreva `TextStyle(fontFamily: ...)` na tela.

### Interface — `InstrumentSans`

| Papel | Spec | Uso |
|---|---|---|
| `pageTitle` | 23 / 700 / -0.7 | "Visao executiva", "Empresas do grupo" |
| `panelTitle` | 20 / 700 / -0.6 | titulo de painel e dialogo |
| `cardTitle` | 16 / 600 / -0.3 | "Receita no ano", "Radar executivo" |
| `cardTitleSm` | 15 / 600 / -0.3 | subsecao dentro de card |
| `navItem` | 15 / 600 / -0.25 | item da barra lateral |
| `bodyStrong` | 14 / 600 | nome na linha de tabela |
| `bodyMedium` | 14 / 500 | texto de apoio com peso |
| `body` | 13 / 400 | **o texto mais comum da interface** |
| `bodySm` | 12 / 400 | descricao secundaria |
| `caption` | 11 / 400 | legenda |
| `button` | 14 / 600 / -0.1 | rotulo de botao |

### Dados — `IBMPlexMono`

| Papel | Spec | Uso |
|---|---|---|
| `kpiXl` | 32 / 600 / -1.6 | KPI de destaque: "R$ 4,82M" |
| `kpiLg` | 26 / 600 / -1.2 | KPI padrao |
| `dataLg` | 15 / 600 | numero de apoio: "de 26" |
| `data` | 13 / 400 | celula de tabela |
| `dataStrong` | 13 / 600 | o valor que importa na linha |
| `dataSm` | 12 / 400 | dado secundario |
| `dataXs` / `dataXsStrong` | 11 / 400 · 600 | metadado, horario, lote, versao |
| `label` | 10 / 600 / +1.1 CAPS | **cabecalho de coluna, sobretitulo de secao** |
| `fieldLabel` | 10 / 600 / +0.9 CAPS | rotulo de campo de formulario |
| `chip` | 11 / 500 | texto de chip de status |
| `kbd` | 10 / 600 / +0.5 | atalho de teclado (⌘K, ⌘N) |

## Geometria

- **Raio:** `rControl` 10 (botao, input, item de nav) · `rCard` 14 · `rChip` 6 · `rPill` 20 · 50% em avatar.
- **Borda:** sempre 1px. `border-light` no padrao, `border-strong`/`border-stronger` quando
  precisa de mais peso, `primary` 1.5px no foco.
- **Elevacao:** nenhuma. A separacao vem de borda e de degrau de superficie.
- **Superficies:** `scaffold` (fundo) → `surface-subtle` (cabecalho de tabela, faixa) →
  `card-white` (card, sidebar, header).

## Componentes

### Barra lateral
Branca, 292px em desktop / drawer de 304px abaixo de 1120px. Marca no topo, seletor de
grupo, botao primario de acao com atalho. Secoes rotuladas em `label` (WORKSPACE, MODULO
ATIVO). Item ativo: barra indicadora lateral + fundo `primary-light` + icone e texto em
`primary`; inativo em `text-dim`. Rodape com "Ajuda e atalhos" e o cartao do usuario.

### Cabecalho
Migalha em `label` sobre o titulo da secao, campo de busca com atalho `⌘K`, pilula de
status de sincronizacao, notificacoes e avatar.

### Cartao de KPI
`label` em caixa alta no topo, numero em `kpiLg`/`kpiXl`, e **uma** linha de apoio:
delta com seta (verde sobe, ambar/vermelho desce), barra de progresso fina, ou contagem
em `dataXs`. Nunca as tres.

### Tabela
Cabecalho em `label` sobre `surface-subtle`. Numeros em mono tabular alinhados a direita;
texto a esquerda. Status como **unica cor semantica da linha**. Linha inteira clicavel,
terminando em chevron — sem botao "Abrir". Registro inativo perde peso (texto em cinza),
nao ganha badge. Densidade alternavel: confortavel `14px 10px` / compacta `9px 10px`.

### Chip de status
Fundo do par claro da semantica, texto no par escuro, raio 6, `chip` em mono.
`ativo` verde · `pendencia` ambar · `inativo` cinza · `contrato`/`proposta` teal.

## Do's and Don'ts

### Do
- **Do** mandar todo numero, CNPJ, data, sigla de UF e duracao para um papel `mono` — e o
  que faz a tabela virar instrumento.
- **Do** usar `label` (mono, caixa alta) para cabecalho de coluna e sobretitulo. E ele que
  separa "dado" de "rotulo" sem gastar uma segunda cor.
- **Do** manter o teal como accent unico: botao primario, link, nav ativa, foco de input.
- **Do** separar os dois teais por contraste, nao por gosto. Branco sobre `primary`
  (`#049598`) rende **3,65:1** e reprova na WCAG AA para texto; sobre `primary-strong`
  (`#036B69`), 6,34:1. Entao `primary` e superficie e traco (barra do item ativo, borda de
  foco) e `primary-strong` e tudo que carrega texto (fundo de botao, link, rotulo). O
  `ElevatedButton` do tema Flutter ja e pintado com `primaryStrong` — a web so estava fora
  de linha.
- **Do** usar `text-soft` (`#4B5563`) nos rotulos `label`/`fieldLabel` de 10-11px. O
  `text-dim` (`#9CA3AF`) da 2,54:1 no branco e 2,21:1 no fundo tintado do login: reprova em
  toda superficie do produto. `text-dim` so serve a estado desabilitado, isento pela norma.
- **Do** deixar cards planos com borda de 1px.
- **Do** manter 48dp de alvo minimo em botao e input.

### Don't
- **Don't** introduzir uma segunda cor de accent. Se algo precisa se destacar mais, o
  problema e hierarquia — resolva com peso, tamanho ou familia.
- **Don't** adicionar sombra em card, lista ou tabela.
- **Don't** escrever numero em `InstrumentSans` dentro de tabela ou KPI: sem tabular, a
  coluna desalinha.
- **Don't** ressuscitar o gold `#D4A853` nem o navy profundo `#0E3B3A` do login antigo —
  ambos foram removidos nesta direcao.
- **Don't** reintroduzir "Rocha Prime", navy `#1B2A4A` ou azul `#2F6BFF`. Onde ainda
  aparecem (PDFs, telas legadas) e divida a migrar, nao referencia a seguir.
- **Don't** dar 13 cores a 13 estagios de pipeline. Cor volta a ser semantica: teal =
  negocio quente, ambar = inatividade/prazo.
