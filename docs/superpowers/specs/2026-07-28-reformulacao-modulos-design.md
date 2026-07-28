# Reformulação da área de Módulos — design

> Data: 2026-07-28 · Branch: `migracao-flutter-para-next`

## Problema

A tela `/modulos` não parece do mesmo aplicativo que o resto do console. São dois
defeitos sobrepostos.

**Defeito visual.** A página foi escrita antes da direção "Console Soft" e nunca
foi portada. Ela usa cards brancos sólidos, botões `rounded-xl` de 12px, um botão
`bg-emerald-700` (cor que o `DESIGN.md` proíbe explicitamente), chips `blue-50`,
`font-extrabold` no título e `text-xs font-bold` em praticamente todo texto — o
que apaga qualquer hierarquia. O Painel e a Pipeline já seguem o Console Soft;
Módulos ficou para trás.

**Defeito de produto.** A rota se chama `/modulos` e o item da barra lateral diz
"Módulos", mas a página é um gerador de dois PDFs para um município. O
`moduleCatalog` tem treze chaves; a tela mostra zero delas como módulo. O nome
promete uma coisa e a tela entrega outra.

## Decisões

Quatro escolhas fecharam o escopo:

1. **`/modulos` vira um hub de módulos de verdade.** Cada módulo abre a própria
   tela. O gerador atual passa a ser `/modulos/levantamento-fundeb`.
2. **Nada morto na grade.** Terceirização, Formação, Atas e Tecnologia existem só
   como chave no catálogo — ficam fora do hub. Consultoria e Consultoria FUNDEB
   também saem: na prática são a Pipeline, que já tem item próprio na navegação.
3. **Um módulo por vez.** Dos oito candidatos com API viva, só o Levantamento
   FUNDEB tem interface React. Os outros seis (Contrato FUNDEB, Case de Sucesso,
   Propostas, Slides, Kit Documental, Levantamento Lite) perderam a tela junto com
   o Flutter e entram em ciclos próprios. O hub nasce desenhado para crescer.
4. **O hub é porta de entrada, não menu.** Como o hub nasce com um card só, ele
   ganha corpo com dado vivo: uma faixa das últimas cidades da carteira, que leva
   direto à bancada com o município já carregado.

Raio-X e Diagnóstico **não** são dois módulos. Nascem da mesma carga de dados
(`/api/modulos/levantamento-fundeb/[codigoIbge]`, uma chamada) e da mesma busca.
Separá-los em duas telas faria o usuário buscar a mesma cidade duas vezes.

## Arquitetura

```
app/(sync)/modulos/
  page.tsx                          hub (reescrito)
  _components/
    module-card.tsx                 card de módulo
    retomar-strip.tsx               faixa "retomar de onde parou"
  levantamento-fundeb/
    page.tsx                        bancada (a tela de hoje, portada)
    _components/
      busca-municipio.tsx           busca + autocomplete IBGE
      cabecalho-municipio.tsx       identificação da cidade + ação de pipeline
      documento-card.tsx            Raio-X / Diagnóstico, com ação de gerar
      painel-projecao.tsx           tabela VAAF/VAAT/VAAR + cards de receita
      painel-censo.tsx              Censo INEP + metodologia
```

A página atual tem 475 linhas fazendo cinco coisas. A quebra segue o padrão de
`_components/` que empresas, pessoas e pipeline já usam no repositório.

### Hub `/modulos`

Três blocos:

**Cabeçalho.** "Módulos" em `pageTitle`. O nome comercial "Central de Relatórios
& Levantamentos FUNDEB" pertence ao módulo, não à área — desce para a bancada.

**Grade de módulos.** `lg:grid-cols-2`. Hoje um card: Levantamento FUNDEB. O card
tem peso de card, não de tile — ícone em chip lavanda, nome, descrição, e no
rodapé, separado por borda suave, os dois documentos que o módulo produz com a
contagem de páginas em mono.

**Faixa "Retomar".** Últimas cidades da carteira ordenadas por `lastActivityAt`,
com chip de estágio em gradiente pastel e receita estimada. O clique leva a
`/modulos/levantamento-fundeb?ibge=<codigoIbge>`. Vem de `listCities(db, groupId)`
— o mesmo dado que a barra lateral e o painel já leem, sem API nova. Carteira
vazia: a faixa não é renderizada (some, não vira placeholder).

### Bancada `/modulos/levantamento-fundeb`

A lógica de negócio não muda. Muda o arranjo:

- Aceita `?ibge=` e carrega o município direto — é o que faz a faixa valer.
- Sem cidade, a busca ocupa o palco. Com cidade, ela encolhe para uma linha de
  "trocar município" e o diagnóstico assume.
- Os dois documentos deixam de ser botões espremidos e viram dois cards de saída
  lado a lado, cada um com nome, conteúdo e botão de gerar com estado próprio.
- "Enviar p/ Pipeline Comercial" sai da fileira de geração — não é documento — e
  vai para o cabeçalho da cidade.

## Especificação visual

Correções do Console Soft, tal como definidas em `DESIGN.md` e `app/globals.css`:

| Hoje | Console Soft |
|---|---|
| `bg-emerald-700` no botão de pipeline | Pill `#16181D`; verde só como pastel `#DFF2E7`/`#1F6A47` em ganho |
| Botões `rounded-xl` 12px, `h-10` | Pill `rounded-[20px]`, `h-[38px]`, sombra `0 6px 16px rgba(22,24,29,.14)` |
| `text-2xl font-extrabold` | `pageTitle` — 21px/700/`-0.7px` |
| `text-xs font-bold` em tudo | `panelTitle` 15/700/-0.3 · `body` 13/400 · `bodySm` 12/400 · `caption` 11/400 |
| Cards `bg-white` + `shadow-2xs` | Glass `bg-white/88`, borda `white/95`, raio 16px, sombra `0 10px 26px rgba(22,24,29,.05)` |
| Chip `bg-blue-50 text-blue-700` | Gradiente lavanda `#EEE7F9 → #E2EDFA`, ícone `#16181D` |
| Header de tabela `bg-[#F7F6FA]` | Sem fundo — `#A2A6B2` 9.5px mono caps + `border-b #F0F1F5` |
| Input `rounded-xl` | Pill `rounded-[24px]`, `bg-[#F2F1F7]`, borda `white/90` |
| Autocomplete `shadow-xl` | `.glass-popover` — blur 14px, `0 24px 60px rgba(22,24,29,.18)` |
| Badge `font-mono text-[10px]` | `chip` 10.5/600, raio 14px |

Três decisões de composição pesam mais que a tabela:

**O ganho projetado vira manchete.** Hoje o número mais importante da tela está
empatado com quinze outros `text-xs font-bold`. Passa a `kpiXl` — mono 34px/600,
`-1.8px`. Tudo em volta desce de peso.

**Os cards de saída são assimétricos de propósito.** O Raio-X é o passo anterior
(a cidade inteira); o Diagnóstico é o aprofundamento. O Diagnóstico leva o botão
primário escuro, o Raio-X o secundário `#F2F1F7`. A hierarquia que hoje só existe
num comentário do código passa a ser visível.

**O card de módulo lista o que produz.** É o que impede um card sozinho de
parecer um botão inflado: ele carrega conteúdo.

Acessibilidade: contraste AA nos textos, grade colapsa para uma coluna abaixo de
`sm`, foco visível pelo `:focus-visible` global, `aria-busy` nos botões durante a
geração.

## Fora de escopo

- **As seis telas de módulo faltantes.** Cada uma é ciclo próprio. O Contrato
  FUNDEB sozinho tem quinze anexos e uma tela de 99KB no Flutter.
- **O wizard "Novo levantamento" (⌘N) da barra lateral.** Ele roda sobre uma lista
  de municípios embutida no código (`novo-levantamento-wizard.tsx:36`) em vez de
  buscar o IBGE. É defeito real e vizinho desta área, mas não é este trabalho.
- **Qualquer mudança na lógica de negócio ou nas rotas de API.** A reformulação é
  de interface; os geradores continuam idênticos.
