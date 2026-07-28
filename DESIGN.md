---
name: Global Sync
description: Console operacional para consultoria FUNDEB. Direção "Console Soft" — glassmorphism, neutros lavanda, accent quase-preto. Hierarquia por duas famílias tipográficas, cards glass flutuantes, pills suaves, gradientes pastel para pipeline.
colors:
  scaffold-from: "#F0EEF5"
  scaffold-via: "#E9E6F0"
  scaffold-to: "#ECEAF1"
  glass-bg: "rgba(255,255,255,.85)"
  glass-bg-strong: "rgba(255,255,255,.88)"
  glass-border: "rgba(255,255,255,.95)"
  surface-subtle: "#F7F6FA"
  surface-alt: "#F2F1F7"
  surface-hover: "#ECEBF2"
  line: "#F0F1F5"
  line-strong: "#ECEDF2"
  line-stronger: "#D6D7DE"
  text-title: "#16181D"
  text-body: "#3B3F4A"
  text-soft: "#5A5E6A"
  text-muted: "#767A86"
  text-dim: "#A2A6B2"
  primary: "#16181D"
  primary-hover: "#2C2F38"
  primary-softer: "#3B3F4A"
  primary-dim: "#4A4E5A"
  primary-light: "#F2F1F7"
  success: "#34C388"
  success-light: "#DFF2E7"
  success-dark: "#1F6A47"
  warning: "#F0913F"
  warning-light: "#FBF0D9"
  warning-dark: "#8A5A00"
  error: "#E5484D"
  error-light: "#FFE5E5"
  error-dark: "#991B1B"
  stage-contrato: "#F5A3B5"
  stage-proposta: "#F7C77E"
  stage-estudo: "#8FD3B6"
  stage-contato: "#93B8F2"
  stage-modulo: "#C9A6EF"
typography:
  ui-family: "InstrumentSans"
  data-family: "IBMPlexMono"
---

# Global Sync — Console Soft

Fonte de verdade da implementação: `app/globals.css` (tokens CSS) + este arquivo.
Referência visual: `UI_Kit_fundacoes_atomos/Console Soft.dc.html`.

## A ideia em uma frase

Interface glassmorphism com painéis flutuantes sobre fundo lavanda, accent único
quase-preto `#16181D`, hierarquia por **duas famílias tipográficas** — `InstrumentSans`
para interface, `IBMPlexMono` para dados — e pipeline representado por
**gradientes pastel suaves** (rosa, amarelo, verde, azul, lilás).

## O que mudou da versão Console Técnico

| Área | Console Técnico | Console Soft |
|---|---|---|
| Accent | Teal `#049598` / `#036B69` | Quase-preto `#16181D` / `#2C2F38` |
| Fundo | Cinza frio sólido `#EEF1F6` | Gradiente lavanda `#F0EEF5 → #E9E6F0` |
| Cards | Brancos, borda `1px solid #E2E8F0`, planos | Glass `rgba(255,255,255,.88)`, blur, sombra |
| Bordas | `1px solid` visível | Quase invisíveis `rgba(255,255,255,.95)` |
| Raios | 10px botão, 14px card, 6px chip | 20px botão (pill), 16-18px card, 14px chip |
| Sombras | Nenhuma | Suaves `rgba(22,24,29,.05--.18)` |
| Sidebar | Branca, colada, borda direita | Glass flutuante, `backdrop-blur`, raio 18px |
| Header | Branco, borda inferior | Glass flutuante, raio 18px |
| Status pipeline | Teal/âmbar/cinza semântico | Gradientes pastel (rosa/amarelo/verde/azul) |
| Avatares | Teal, raio 11px | Gradiente escuro, circular |
| Efeitos | Nenhum | Glows difusos, backdrop-filter, transições |

## Tipografia

Mesma estrutura de papéis do Console Técnico — `GsText` no Flutter,
tokens CSS na web.

### Interface — `InstrumentSans`

| Papel | Spec | Uso |
|---|---|---|
| `pageTitle` | 21/700/-0.7 | Saudação "Olá, Marcos Rocha!" |
| `panelTitle` | 15-16/700/-0.3 | Título de card/seção |
| `cardTitle` | 14.5/700/-0.3 | "Receita no ano", "Radar executivo" |
| `navItem` | 13.5/600/-0.2 | Item da barra lateral |
| `bodyStrong` | 13.5/600 | Nome na linha de tabela |
| `body` | 13/400 | Texto mais comum |
| `bodySm` | 12/400 | Descrição secundária |
| `caption` | 11/400 | Legenda |
| `button` | 13.5/600 | Rótulo de botão |

### Dados — `IBMPlexMono`

| Papel | Spec | Uso |
|---|---|---|
| `kpiXl` | 34/600/-1.8 | KPI de destaque: "34", "R$ 4,82M" |
| `kpiLg` | 24/600/-1.2 | KPI secundário |
| `data` | 12.5/400 | Célula de tabela |
| `dataStrong` | 12.5/600 | Valor importante |
| `label` | 9.5/600/+1.3 CAPS | WORKSPACE, MÓDULO ATIVO, rótulos |
| `chip` | 10.5/600 | Texto de chip de status |
| `kbd` | 9.5/600 | Atalho de teclado (⌘K, ⌘N) |

## Geometria

- **Raio:** `rPill` 20-24 (botão, CTA) · `rCard` 16-18 (card, sidebar, header) ·
  `rChip` 14 (chip, badge) · `rInput` 22-24 (campo) · 50% em avatar.
- **Borda:** `1px solid rgba(255,255,255,.95)` — quase invisível, define vidro.
  Bordas internas `#F0F1F5` suaves. Sem bordas escuras.
- **Elevação:** `box-shadow` suave. Cards `0 10px 26px rgba(22,24,29,.05)`,
  sidebar/header `0 14px 36px rgba(22,24,29,.07)`, popovers
  `0 24px 60px rgba(22,24,29,.18)`.
- **Glass:** `backdrop-filter: blur(12px)` + `bg rgba(255,255,255,.85)` para
  sidebar/header; `.88` para cards; `.97` para popovers.
- **Superfícies:** gradiente lavanda (fundo) → glass (cards) → `#F7F6FA` (hover)
  → `#F2F1F7` (controles, inputs).

## Pipeline — gradientes pastel

Cada estágio tem um par de cores suaves em gradiente:

| Estágio | Dot | Fundo chip | Gradiente barra |
|---|---|---|---|
| Contrato | `#F5A3B5` | `#FBE0E7` | `#F5A3B5 → #F7B99B` |
| Proposta | `#F7C77E` | `#FBF0D9` | `#F7C77E → #F5D89B` |
| Estudo | `#8FD3B6` | `#DFF2E7` | `#8FD3B6 → #A9DFC6` |
| Contato | `#93B8F2` | `#E2EDFA` | `#93B8F2 → #B5CDF6` |
| Módulo | `#C9A6EF` | `#EEE7F9` | `#C9A6EF → #D9BFF5` |

## Componentes

### Sidebar
Glass flutuante, 240px, `backdrop-blur-xl`, raio 18px, separada do conteúdo por
gap. Marca no topo, seções rotuladas em `label` (`A2A6B2`). Item ativo:
`bg-[#F2F1F7]` + texto `#16181D` 600; inativo em `#767A86`. Contador badge
pill `#16181D`. Módulo ativo com gradiente lavanda `#EEE7F9 → #E2EDFA`.
Botão de ação pill escuro `#16181D`, raio 20px. Rodapé com card do usuário
em `#F7F6FA`, avatar circular com gradiente escuro.

### Header
Glass flutuante, raio 18px, `backdrop-blur-xl`. Busca pill `#F2F1F7` raio 22px,
atalho ⌘K. Status de sync com ponto verde pulsante. Notificações com badge
`#16181D`. Avatar circular.

### KPI card
Label em `#767A86` 12px (sem caixa alta, sem mono), número em mono 34px,
sublinhas em `#A2A6B2`. Card glass com sombra suave. Quando destaque:
gradiente lavanda → lilás sutil no canto.

### Tabela
Container glass. Header quase invisível — apenas `#A2A6B2` 9.5px mono caps
com border-bottom `#F0F1F5`. Linhas com raio 12px no hover, dados mono
tabulares alinhados à direita. Status como chip pill com ponto colorido.
Sem chevron explícito — linha inteira clicável.

### Alertas do radar
Cards com gradientes pastel suaves: rosa-quente (warning de prazo),
azul-lavanda (informação), verde-menta (sucesso). Sem bordas coloridas
fortes — o gradiente é a cor.

### Botões
- **Primário:** pill `#16181D`, raio 20px, sombra `rgba(22,24,29,.16)`.
  Hover: `#2C2F38`.
- **Secundário:** pill `#F2F1F7`, raio 20px. Hover: `#ECEBF2`.
- **Ghost:** sem fundo, texto `#3B3F4A`. Hover: `bg-[#F7F6FA]`.
- **Destrutivo:** pill `bg-[#FFE5E5]`, texto `#991B1B`.

## Do's and Don'ts

### Do
- **Do** usar glass (`backdrop-blur` + bg semitransparente) para sidebar, header,
  cards e popovers.
- **Do** manter `#16181D` como accent único. Tudo que antes era teal agora é
  quase-preto.
- **Do** usar gradientes pastel para representar estágios do pipeline. Nunca
  cores sólidas fortes.
- **Do** manter raios pill (20-24px) em botões e inputs. É o DNA do Console Soft.
- **Do** usar sombras suaves e difusas. Nunca sombra dura.
- **Do** usar avatares circulares com gradiente escuro.
- **Do** mandar todo número, CNPJ, data, sigla para `IBMPlexMono`.

### Don't
- **Don't** reintroduzir o teal `#049598` ou qualquer variante. Foi removido.
- **Don't** usar cards com borda sólida visível. A borda é `rgba(255,255,255,.95)`.
- **Don't** usar raios quadrados (10px) em botões. Sempre pill.
- **Don't** adicionar bordas escuras ou sombras duras.
- **Don't** usar fundo sólido plano. Sempre gradiente lavanda ou glass.
- **Don't** usar chips com raio 6px. Sempre 14px (pill).
