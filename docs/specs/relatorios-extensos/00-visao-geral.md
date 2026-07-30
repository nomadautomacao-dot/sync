# Relatórios extensos — visão geral

> Escrito em **2026-07-30**. Fonte de verdade para a construção dos oito
> dossiês temáticos. Cada um tem seu próprio `.md` nesta pasta.

---

## 1. O que são, e o que não são

O Raio-X é **um** documento de 40 páginas que percorre tudo em largura: cada
tópico ganha uma folha, o município inteiro cabe numa leitura de reunião. Ele
responde *"o que está acontecendo aqui?"*.

Os relatórios extensos são o oposto em profundidade. Cada um pega **um** tópico
do Raio-X e desce até a última linha de dado que a fonte sustenta. Se a rede tem
400 escolas, as 400 aparecem nomeadas, com todos os campos que existem para
cada uma. Eles respondem *"me mostre tudo o que você sabe sobre isto"*.

**A contagem de páginas deixa de ser contrato.** No Raio-X e no Levantamento,
`PAGINAS_ESPERADAS` é uma trava proposital: página a mais significa seção que
duplicou. Aqui é o contrário — o volume é função do município, e um dossiê de
escolas de Manaus tem legitimamente dez vezes o tamanho do de Ibateguara. O
contrato passa a ser sobre **completude**: nenhuma linha da fonte pode ficar de
fora sem que o documento diga que ficou, e por quê.

### Por que isso é o produto

O Raio-X abre a porta; ele é curto de propósito, porque é peça de prospecção. O
que justifica o preço da consultoria é o que vem depois: o material que a
secretaria passa a ter e não tinha, organizado de um jeito que nenhum sistema
público entrega. O INEP publica microdado; ninguém devolve ao município a sua
própria rede escola a escola, com resultado, contexto socioeconômico e fator de
ponderação lado a lado.

---

## 2. Os oito dossiês

A divisão é por **unidade de análise**, não por tema — é o que impede dois
dossiês de contarem a mesma coisa com palavras diferentes.

| # | Dossiê | Unidade de análise | Volume típico |
|---|--------|--------------------|---------------|
| 1 | [Escolas](01-dossie-das-escolas.md) | a escola | 1 bloco por escola — 30 a 500+ |
| 2 | [Matrícula ponderada](02-dossie-da-matricula.md) | o segmento ponderado | 15 a 40 segmentos |
| 3 | [Conformidade](03-dossie-da-conformidade.md) | o requisito / indicador | ~40 requisitos + 14 indicadores |
| 4 | [Dinheiro federal](04-dossie-do-dinheiro-federal.md) | a transferência / obra | dezenas a centenas de linhas |
| 5 | [Aprendizagem](05-dossie-da-aprendizagem.md) | a série histórica / grupo de proficiência | 4 séries × N anos |
| 6 | [Demanda](06-dossie-da-demanda.md) | a coorte de nascimento | ~10 coortes + faixas |
| 7 | [Equidade](07-dossie-da-equidade.md) | o grupo de cor/raça e o território | 6 grupos × N anos |
| 8 | [Comparativo](08-dossie-comparativo.md) | o indicador contra os pares | ~12 indicadores |

O dossiê 1 é o carro-chefe: é o único que só existe porque alguém juntou três
datasets por código de escola, e é o que a secretaria não consegue montar
sozinha.

---

## 3. Arquitetura

Mesma que a do Raio-X, porque ela já resolveu os problemas difíceis:

```
core/lib/dossie-<nome>-template.ts   → HTML (CSS de impressão embutido)
core/lib/dossie-<nome>-pdf.ts        → Chromium → PDF
app/api/modulos/dossies/<nome>/      → rota POST, autenticada
```

**O que muda em relação aos relatórios existentes:**

1. **Sem `PAGINAS_ESPERADAS`.** No lugar, o gerador confere que a contagem de
   linhas impressas bate com a contagem de linhas da fonte — o contrato de
   completude da seção 1.
2. **Paginação por fluxo, não por seção fixa.** As folhas do Raio-X são
   `section.page` de altura fixa com `overflow:hidden`. Aqui, blocos que se
   repetem (uma escola, um requisito) precisam quebrar naturalmente entre
   páginas. Isso exige CSS diferente: `break-inside: avoid` no bloco e
   cabeçalho/rodapé por `@page`, em vez de `<header>` dentro de cada seção.
3. **`pdf-corte.ts` continua valendo**, mas só nas seções de altura fixa (capa,
   sumário, fechamento). Nas seções de fluxo ele não se aplica — lá o conteúdo
   deve transbordar para a próxima folha, que é justamente o que o
   `overflow:hidden` do Raio-X impede.

### A tela de emissão

Aba nova em `/modulos/levantamento-fundeb` (ou seção própria em `/documentos`,
a decidir): um card por dossiê, cada um emitindo individualmente, com o mesmo
padrão dos quatro relatórios atuais — baixa o PDF **e** arquiva o JSON na ficha
da cidade (`cityReports`, tipos novos `dossie_escolas`, `dossie_matricula`, …).

Como o volume é alto, cada card precisa mostrar **antes de gerar** quantas
linhas o município tem naquele dossiê (ex.: "Paulo Afonso · 66 escolas"). Emitir
um PDF de 400 páginas sem avisar é hostil.

---

## 4. Regras que valem para todos

Herdadas do Raio-X, e não são negociáveis:

1. **Todo número imprime fonte e ano.** Sem exceção.
2. **Ausência ≠ zero.** Campo que a fonte não trouxe sai como `—`, nunca como 0.
3. **Nada é estimado em silêncio.** Onde falta dado, o documento diz que falta.
4. **Indicador sensível** (cor/raça, INSE, violência) entra como contexto
   explicativo, nunca como rótulo de escola ou de aluno.
5. **Sem alegação de histórico da Global Company** — empresa nova, sem contrato
   executado. Vale a mesma trava do Levantamento, com teste que falha.
6. **Truncamento é declarado.** Se um dossiê limitar linhas por qualquer razão,
   ele imprime quantas ficaram de fora. Silêncio aqui destrói a premissa do
   produto.

---

## 5. Onde os dados estão hoje

Todos os datasets já existem no repositório ou são consultados na emissão.
Nenhum dossiê depende de fonte nova.

| Dataset | Arquivo / lib | Granularidade |
|---|---|---|
| Escolas no território | `data/inep/escolas-territorio.json` · `escolas-territorio.ts` | **por escola** |
| IDEB por escola | `data/inep/ideb-escolas-2023.json` · `ideb-escolas.ts` | **por escola** |
| Indicadores por escola | `data/inep/indicadores-escolas.json` · `indicadores-escolas.ts` | **por escola** |
| Saeb — distribuição | `data/inep/saeb-distribuicao.json` | por série e grupo |
| Cor/raça histórico | `data/inep/cor-raca-historico.json` | por ano e grupo |
| Alfabetização (CNCA) | `data/inep/alfabetizacao-municipios.json` | por ano |
| ENEM — abstenção | `data/inep/enem-abstencao.json` | por ano |
| Censo municipal | `data/inep-censo-municipal-<ano>.json` | agregado, ~90 campos |
| Matrícula ponderada | `fundeb-ponderacao.ts` | **por segmento** |
| CAUC | `cauc-requisitos.ts` (rede, na emissão) | **por requisito** |
| SIOPE | `siope-indicadores.ts` | **por indicador** |
| DCA / pontualidade | `siconfi-entregas.ts` | **por entrega** |
| VAAR | `fundeb-vaar.ts` | por condicionalidade |
| Obras FNDE | `fnde-obras.ts` | **por obra** |
| Emendas | `emendas-municipais.ts` | por ano e autor |
| Convênios e sanções | `portal-transparencia.ts` | **por convênio** |
| Demografia | `demografia-educacional.ts` | **por coorte** |
| Gêmeos estatísticos | `municipios-gemeos.ts` | **por indicador** |

### A limitação que sobrou, medida

O dataset por escola (`escolas-territorio.json`) foi gerado guardando **oito
colunas** dos microdados do Censo: código, rural, localização diferenciada,
lat/lng, matrículas, transporte e cor/raça. Os microdados têm muito mais por
escola — infraestrutura item a item (`IN_AGUA_POTAVEL`, `IN_INTERNET`,
`IN_BIBLIOTECA`, `IN_QUADRA_ESPORTES`, `IN_LABORATORIO_*`, `IN_BANHEIRO_PNE`…),
etapas ofertadas, docentes, salas, e o nome da entidade.

**O nome não é o problema que já foi.** Ele chega por `indicadores-escolas.json`,
que cobre muito mais que a divulgação do IDEB — medido em 30/07/2026 sobre cinco
redes (2.311 escolas), a lacuna é de **6,4%**, concentrada em São Paulo (8,0%).
Paulo Afonso e Ibateguara não têm nenhuma escola sem nome. A escola sem nome sai
identificada pelo código, com a razão dita no bloco.

**O que ainda falta é a infraestrutura por escola.** Hoje ela só existe agregada
por município, no Censo municipal — não dá para dizer *quais* escolas estão sem
água, sem esgoto ou sem quadra, que é a pergunta que vira obra.

**O que trava:** o INEP moveu os microdados de `/microdados/` para
`/dados_abertos/`, e **o zip de 2025 não está publicado em nenhum dos dois** —
em 30/07/2026 só 2023 (32 MB) e 2024 (34 MB) respondem. Regerar a partir de 2024
rebaixaria o dataset em um ano, o que é pior que a lacuna. O arquivo de 2025 que
gerou o dataset atual veio de download manual; regerar com mais colunas depende
de ter esse zip em mãos de novo. O script já aceita o caminho local como
argumento e agora explica isso quando o download falha.

Isso está detalhado no dossiê 1, que é o que mais ganha com a regeneração.

---

## 6. Ordem de construção

1. ✅ **Dossiê das Escolas** — maior valor percebido, e é o que validou a
   arquitetura de paginação por fluxo, que os outros herdaram.
2. ✅ **Conformidade** — segundo maior valor prático (é o que a secretaria usa
   no dia seguinte), e todos os dados já estavam prontos.
3. ✅ **Matrícula ponderada** — é onde mora o dinheiro.
4. ✅ **Dinheiro federal** — o segundo orçamento, fora do fundo.
5. ✅ **Aprendizagem** — a distribuição que a média esconde.
6. ✅ **Demanda** — a coorte que já nasceu contra a vaga que existe.
7. ✅ **Equidade e territórios** — três contagens da mesma criança.
8. ✅ **Comparativo** — quanto, comparado a quem.

**Os oito estão no ar.** Todos emitem individualmente pela tela de relatórios,
com prévia de volume antes da geração, e arquivam o JSON na ficha da cidade.

### O que a construção dos oito ensinou

- **A armadilha do campo de data.** No CAUC, parte dos requisitos repete a
  *data da consulta* no campo de validade. Lido como vencimento, o documento
  anunciava doze vencimentos para hoje em qualquer município, todo dia. Antes
  de tratar campo de data como prazo, conferir se ele varia entre municípios.
- **Zero não é achado.** Rede que já está acima da mediana nacional não pode
  render um bloco com `R$ 0,00` — precisa de variante própria que registre o
  resultado. Uma linha assim contamina a leitura do documento inteiro.
- **Conciliação vale mais que volume.** A folha que prova que o número do FNDE
  é o número que a própria secretaria declarou no Censo (fecha na unidade em
  Paulo Afonso, Ibateguara e Manaus) é a que mais converte — porque torna todo
  o resto rastreável.
- **Cifra derivada precisa de marca visual.** O Dossiê da Matrícula abre uma
  exceção à regra 3 e monetiza equivalentes pelo valor aluno/ano da UF. Só é
  aceitável porque toda cifra assim leva `ᵈ` e a nota de rodapé, e porque há
  teste que conta as marcas.
- **Antes de somar, perguntar de quem é.** O painel do Pacto lista obra por
  **território**, e a esfera do termo é que diz o dono: a maior obra paralisada
  de Manaus é estadual. Vale para todo dado territorial — presença no município
  não é propriedade do município.
- **Subtração só onde ela significa alguma coisa.** "Estimativa − executado"
  produzia "ainda a receber" em obra concluída anos atrás. Campo derivado
  precisa de uma condição de aplicabilidade tão explícita quanto a fórmula.
- **Rate limit chega como 400.** O Portal da Transparência devolve 400, não
  429, quando a chave gratuita estoura o limite por minuto — e a mesma consulta
  responde 200 segundos depois. Sem repetição com espera, um dossiê que pagina
  dezenas de vezes perde seções por sorte de cronômetro.
- **Régua antes de elogio.** Ibateguara/AL aparece com 96% dos alunos no nível
  avançado do Saeb — contra mediana nacional de 20%. Sem comparar com a
  distribuição das próprias redes municipais do país, o dossiê entregaria isso
  a um prefeito como conquista. Todo indicador de resultado precisa da posição
  no país ao lado, e do aviso quando a rede cai fora do percentil 99.
- **Conversão útil exige suposição impressa.** Percentual não move ninguém;
  "≈ 12.865 crianças" move. Mas o Saeb publica percentual e o Censo publica
  matrícula por etapa — a conversão supõe distribuição uniforme entre as séries,
  e isso vai escrito em cada folha onde o número aparece.
- **Números de naturezas diferentes não se somam.** Criança de 2 anos sem
  creche é demanda não atendida; criança de 7 fora da escola é descumprimento de
  dever constitucional (EC 59/2009). Em Paulo Afonso a soma dá 5.428 e a leitura
  correta é 563 — treze por cento do primeiro. Toda folha que junta populações
  precisa declarar o regime jurídico de cada uma antes de agregar.
- **Marca de rodapé colada em unidade monetária mente.** `R$ 17,40 miᵈ` se lê
  como "R$ 17,40 mil" em corpo de impressão — erro de mil vezes no número
  principal da folha. O `sup` de derivação leva margem, e isso vale para todo
  template que usa a convenção.
- **Série histórica mede o formulário antes de medir a população.** Serra do
  Ramalho sai de 42,1% de cor/raça não declarada em 2023 para 8,0% em 2025, e a
  matrícula preta ou parda "sobe" de 51,9% para 83,1%. Nenhuma rede fica 31
  pontos mais negra em dois anos: a secretaria preencheu o campo. Toda série
  categórica precisa de um detector de mudança de cadastro antes de virar
  tendência.
- **Lacuna dita é melhor que lacuna preenchida.** O campo de cor/raça do Censo
  Escolar não tem categoria quilombola. O elo do meio da corrente sai como
  travessão, com a razão escrita — estimá-lo transformaria pergunta de campo em
  afirmação sem fonte.
- **População de uma pessoa não merece uma folha.** O Censo devolve populações
  de 1 ou 2 habitantes; Paulo Afonso tem população quilombola igual a 1. Piso de
  relevância antes de dedicar seção, ou o documento ensina o leitor a pular.
- **Cor precisa seguir o sentido, não o valor.** Percentil 90 em abandono é
  péssimo; percentil 90 em IDEB é ótimo; percentil 90 em investimento por aluno
  não é nem um nem outro. Todo painel comparativo orienta a escala antes de
  colorir, e indicador sem lado melhor sai em cinza.
- **Comparação não é conformidade.** Estar acima da mediana dos pares não
  significa cumprir a lei — a mediana pode ser ilegal. Onde existe piso legal
  (MDE, remuneração, aplicação do FUNDEB), ele aparece junto e prevalece.
- **Dataset estreito demais some da página.** `autoresEducacao` guardava só os
  três maiores autores de emenda **de educação**, e isso deixava a folha vazia
  em 86% dos municípios. Guardar todos os autores de qualquer função encheu
  2.561 de 2.576 — e o fato de o parlamentar nunca ter emendado educação virou
  o argumento da conversa, em vez de uma lacuna.
