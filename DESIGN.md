---
name: Global Sync
description: Console operacional para consultoria FUNDEB — claro e denso em dados no dia a dia, com um portal de entrada escuro que sinaliza escala institucional.
colors:
  scaffold: "#EEF1F6"
  card-white: "#FFFFFF"
  border-light: "#E2E8F0"
  text-title: "#111827"
  text-body: "#374151"
  text-muted: "#6B7280"
  text-dim: "#9CA3AF"
  teal-institucional: "#049598"
  teal-institucional-light: "#DCF2F0"
  teal-institucional-dim: "#5FA3A0"
  success: "#10B981"
  warning: "#F59E0B"
  error: "#EF4444"
  gold-premium: "#D4A853"
  gold-premium-light: "#FAF3E3"
  gold-premium-dim: "#B8943F"
  navy-profundo: "#0E3B3A"
  navy-profundo-light: "#1F5350"
  navy-profundo-deep: "#07211F"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-1.4px"
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.6px"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.3px"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-dense:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.05px"
  eyebrow:
    fontFamily: "Inter, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.8px"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  hero-card: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.teal-institucional}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "48px"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.text-title}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "48px"
  card:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.text-title}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
    height: "48px"
---

# Design System: Global Sync

## Overview

**Creative North Star: "The Global Console"**

Global Sync é o console operacional da consultoria FUNDEB: claro, denso em dados, sem enfeite, feito para um consultor executar rápido em campo — não para admirar a interface. A maior parte do produto (dashboard, cidades, pipeline, empresas, módulos) vive nesse registro claro, com fundo neutro `#EEF1F6`, cards brancos de borda fina e um único accent teal (`#049598`) reservado para ação e estado ativo.

O ponto de entrada — a tela de login — quebra deliberadamente esse registro: um hero em gradiente navy profundo, formas geométricas sutis, um badge de logo com sombra suave e um card branco flutuando no centro. É a única superfície do produto com essa dramaticidade; ela existe para sinalizar escala e seriedade institucional antes do usuário entrar no trabalho do dia a dia. Ela não define o resto do sistema, e o resto do sistema não deve importar a dramaticidade dela.

O rebrand de "Rocha Prime" para "Global Sync" está em andamento: o ícone e o nome já trocaram amplamente (login, sidebar, título da aba), e a paleta operacional já migrou de navy/azul para o teal institucional atual (`SaaSTokens.primary`, comentado no código como "Global Sync Teal"). Esta é uma foto do estado real implementado — não do estado final planejado. Áreas fora do escopo do rebrand documentado (geradores de PDF/relatórios, alguns literais de cor legados em telas mais antigas) ainda podem citar a marca ou paleta antiga; tratar como dívida a migrar, não como padrão a seguir.

**Key Characteristics:**
- Dois registros deliberados: console claro no dia a dia, hero escuro só no portal de entrada
- Um único accent (teal institucional) reservado para ação — a regridez do resto é o que o faz notar
- Flat-by-default: bordas finas fazem o trabalho que sombra faria em outro sistema
- Tipografia Inter única, hierarquia por peso e tamanho, nunca por família

## Colors

Paleta de dois registros: neutros técnicos para o console operacional, teal como único accent, navy profundo reservado ao hero de entrada.

### Primary
- **Teal Institucional** (`#049598`): accent único do console — botões primários, links, ícones/labels ativos em navegação, borda de foco em inputs. Confiança técnica sem frieza, quase uma cor de instrumento de precisão. Usado com moderação: sua raridade no fundo neutro é o que dá peso à ação.
- **Teal Institucional Claro** (`#DCF2F0`): fundo de estado selecionado (chips, indicador de navegação) — nunca como fundo de superfície geral.

### Secondary
- **Ouro Premium** (`#D4A853`): accent secundário reservado para contexto de destaque/premium (ainda pouco usado no código atual — tratar como reserva, não introduzir sem necessidade real).

### Tertiary
- **Navy Profundo** (`#0E3B3A`): exclusivo do hero de login — grave, quase oceano-noturno, sinaliza solidez institucional no ponto de entrada. Não usar em superfícies do console operacional.

### Neutral
- **Scaffold** (`#EEF1F6`): fundo padrão de todas as telas do console.
- **Card White** (`#FFFFFF`): superfície de cards, painéis, sidebar, inputs.
- **Border Light** (`#E2E8F0`): única cor de borda do sistema — separa card de fundo, divide seções, contorna inputs no estado padrão.
- **Text Title** (`#111827`): títulos e texto de maior ênfase.
- **Text Body** (`#374151`): corpo de texto padrão.
- **Text Muted** (`#6B7280`): texto secundário, labels de campo, legendas.
- **Text Dim** (`#9CA3AF`): texto terciário — placeholders, ícones inativos, texto sobre navy no hero de login com opacidade reduzida.

### Named Rules
**The One Accent Rule.** O teal institucional é a única cor não-neutra usada para ação no console operacional. Success/warning/error existem só para estado semântico (nunca para ação); ouro é reserva. Se uma tela precisa de uma segunda cor "de destaque" para chamar atenção, o problema é hierarquia, não paleta.

**The Hero Exception Rule.** Navy profundo e o gradiente escuro existem só na tela de login. Nenhuma outra superfície do produto herda esse registro — é o único lugar onde o sistema é deliberadamente dramático.

## Typography

**Body Font:** Inter (variable weight, `InterVariable.ttf` embarcada — sem fallback de sistema necessário)

**Character:** Uma família só, hierarquia construída por peso e tamanho — nunca por segunda família. Pesos 700/600 para tudo que precisa ser lido rápido (títulos, labels, botões); 400 para leitura corrida.

### Hierarchy
- **Display** (700, 36px, height 1, -1.4px): KPIs e números de destaque no dashboard executivo.
- **Headline** (700, 22px, height 1.15, -0.6px): títulos de tela/seção.
- **Title** (600, 18px, height 1.2, -0.3px): títulos de card, cabeçalhos de bloco.
- **Body** (400, 15px, height 1.5): texto corrido, descrições longas.
- **Body Dense** (400, 14px, height 1.45): texto padrão de UI — tabelas, listas, corpo de card. É o tamanho mais usado no sistema.
- **Label** (600, 13px, +0.05px): rótulos de campo, texto de botão.
- **Eyebrow** (600, 11px, +0.8px, geralmente `text-dim`): microcopy secundária — badges de estágio, contadores.

O hero de login usa a mesma lógica de peso (700 para o nome do produto e título do card, 600 para labels e botão, 400 para texto de apoio) mas com tamanhos próprios (26px / 20px / 14px / 13px / 16px) fora da escala do tema — é a única superfície que não passa pelo `TextTheme` central.

### Named Rules
**The Weight-Over-Family Rule.** Hierarquia nunca introduz uma segunda família tipográfica. Se um elemento precisa se destacar mais, sobe de peso ou tamanho — não muda de fonte.

## Layout

Shell responsivo com dois breakpoints: `< 900px` é o registro mobile (drawer de 304px sobrepondo o conteúdo, painel de contexto lateral fecha automaticamente); `≥ 1120px` é desktop, com sidebar fixa de 292px à esquerda e um painel de contexto opcional à direita. Entre 900 e 1120px o layout intermediário mantém a navegação em drawer.

Espaçamento em base 4dp: `4 / 8 / 16 / 24 / 32`. Cards operacionais usam 20dp de padding interno; o card do hero de login usa 36dp (maior respiro por ser uma superfície única e central, não repetida). Inputs e botões têm 48dp de altura mínima em todo o sistema — é o alvo de toque padrão, inclusive em telas de mouse/teclado.

## Elevation & Depth

Flat-by-default: cards, listas e painéis do console operacional não têm sombra — a separação vem inteiramente de `border: 1px solid #E2E8F0` sobre o fundo `#EEF1F6`. Sombra é reservada para poucos elementos isolados que precisam se destacar do plano do console: o badge do logo (login e sidebar), dialogs/modais, e o hero card de login sobre o gradiente navy.

### Shadow Vocabulary
- **Logo Badge** (`box-shadow: 0 8px 30px rgba(0,0,0,0.25)`): sombra suave sob o ícone Global Sync, tanto no login quanto na sidebar — o único elemento com sombra fora de contexto modal.

### Named Rules
**The Flat-By-Default Rule.** Superfícies do console são sempre planas com borda. Sombra aparece só em elementos isolados de destaque (badges, dialogs, floating panels) — nunca em cards ou listas do dia a dia.

## Shapes

Dois vocabulários de raio coexistem por região: o console operacional usa cantos generosos (12px em cards, 10px em botões/inputs/chips) — o padrão Material 3 do `AppTheme`. O hero de login usa cantos quase retos (4px no card e no badge do logo, 3px nos inputs) — uma escolha deliberada de rigor geométrico para o portal de entrada, distinta do resto do sistema. Bordas são sempre 1px, cor `border-light` no estado padrão, `teal-institucional` (1.5-2px) em foco.

## Components

### Buttons
- **Shape:** 10px de raio no console; sem raio real (retangular) no botão de submit do login.
- **Primary:** fundo `teal-institucional`, texto branco, 48px de altura, `elevation: 0`. No login, o botão primário usa navy profundo em vez do teal — única exceção de cor no sistema de botões.
- **Hover / Focus:** sem estado de hover visual documentado além do padrão Material ripple (`InkSparkle`); foco em inputs usa borda teal de 1.5-2px.
- **Outlined / Text:** borda `border-light`, texto `text-title`; ambos com a mesma altura mínima de 48px dos primários.

### Chips
- **Style:** fundo `scaffold` no estado padrão, `teal-institucional-light` quando selecionado, borda `border-light`, raio 8px.

### Cards / Containers
- **Corner Style:** 12px no console; 4px no card único do hero de login.
- **Background:** sempre `card-white`.
- **Shadow Strategy:** nenhuma no console (ver Elevation); o card do login usa fundo branco liso, sem sombra própria — a sombra fica só no badge do logo acima dele.
- **Border:** 1px `border-light` no console; o card do login não tem borda (se destaca por contraste com o fundo escuro, não por borda).
- **Internal Padding:** 20dp no console, 36dp no card do login.

### Inputs / Fields
- **Style:** sem preenchimento (`filled: false`), borda 1px `border-light`, raio 10px no console / 3px no login.
- **Focus:** borda muda para `teal-institucional`, 1.5-2px.
- **Error:** borda `error` (#EF4444), 1.5px; mensagens de erro em bloco com fundo `#FEF2F2` e borda `#FECACA`.

### Navigation
- **Sidebar:** fundo branco (não mais navy escuro), 292px fixa em desktop / drawer de 304px abaixo de 1120px. Item ativo: ícone e label em `teal-institucional`, com uma barra indicadora lateral; item inativo em `text-dim`.

### Login Hero (componente de assinatura)
Superfície única do sistema com identidade própria: fundo em gradiente diagonal navy profundo (`#0E3B3A → #07211F → #0C2E2B`), três formas geométricas translúcidas (círculos e um quadrado rotacionado, opacidade 2-4%) como textura de fundo, badge de logo com sombra, e um card branco central de cantos quase retos. Existe para dar ao produto um momento de entrada com peso institucional antes do registro utilitário do console assumir.

## Do's and Don'ts

### Do:
- **Do** usar teal institucional (`#049598`) como o único accent de ação no console — botões primários, links, estado ativo de navegação, foco de input.
- **Do** manter cards e listas do console flat, só com borda de 1px — sombra é exceção, não regra.
- **Do** manter o hero de login como a única superfície dramática/escura do produto.
- **Do** manter a hierarquia tipográfica só por peso e tamanho da família Inter, nunca introduzindo segunda família.
- **Do** usar 48dp como altura mínima de alvo de toque em botões e inputs, em toda superfície.

### Don't:
- **Don't** levar o gradiente navy ou os cantos quase retos (3-4px) do hero de login para telas do console operacional — são uma exceção de superfície única, não um segundo tema.
- **Don't** introduzir uma segunda cor de accent para "chamar atenção" — se algo precisa se destacar mais, o problema é hierarquia, não uma nova cor.
- **Don't** adicionar sombra em cards, listas ou tabelas do dia a dia — a separação vem de borda, não de elevação.
- **Don't** reintroduzir referências à marca antiga ("Rocha Prime", navy `#1B2A4A`/azul `#2F6BFF`) em superfícies novas — essa paleta foi substituída; onde ainda aparece (PDFs, telas legadas) é dívida a migrar, não referência a seguir.
