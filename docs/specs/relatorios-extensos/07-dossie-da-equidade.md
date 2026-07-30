# Dossiê da Equidade e dos Territórios

> Unidade de análise: **o grupo de cor/raça e o território**. Volume: 6 grupos
> × N anos, mais os territórios. 10 a 18 folhas.

---

## 1. O que ele prova

Duas coisas que quase nunca aparecem juntas.

A primeira é **desigualdade de aprendizagem entre grupos**, que a
Condicionalidade III do VAAR passou a premiar. O fundo deixou de pagar só por
média e passou a pagar por redução de distância — e para reduzir distância é
preciso primeiro medi-la, o que exige o cadastro de cor/raça preenchido.

A segunda é **subdeclaração de território**, que é dinheiro direto. A escola em
território indígena ou quilombola pondera de 1,40 a 2,17 contra 1,00 da urbana
comum. A ponderação segue a classificação da **escola**, não a cor/raça do
aluno — então a criança declarada indígena numa escola comum pondera como
urbano comum, e essa distância é invisível em qualquer análise que olhe só duas
das três pontas.

**Regra que governa o dossiê inteiro:** pertencimento étnico é
**autodeclaração**. Este documento aponta lacuna de **registro** e jamais afirma
que alguém "é" indígena ou quilombola, nem estima quantos "deveriam" se
declarar. O que ele faz é mostrar a distância entre contagens oficiais e
transformar isso em pergunta.

---

## 2. Fontes e granularidade

| Fonte | Lib | Granularidade |
|---|---|---|
| Cor/raça histórico | `cor-raca-historico.ts` | **por ano e grupo** |
| Equidade municipal | `inep-equidade.ts` | por grupo e por condição de escola |
| Equidade territorial | `equidade-territorial.ts` | por povo (quilombola, indígena) |
| Cor/raça por escola | `escolas-territorio.ts` | **por escola** (aprofundado no dossiê 1) |
| Assentamentos | `assentamentos-incra.ts` | agregado municipal |
| Censo Demográfico 2022 | agregados 8175/8176 | população por povo |
| Distribuição Saeb | `saeb-distribuicao.ts` | grupos de proficiência |

---

## 3. Campos disponíveis

### 3.1 `CorRacaHistoricoAno` — uma linha por ano, duas séries

`ano`, `total`, `naoDeclarada`, `branca`, `preta`, `parda`, `amarela`,
`indigena` — em duas séries: `municipal` e `publica`.

**A série histórica é o achado.** Uma queda súbita de "não declarada" entre dois
anos não é mudança demográfica: é a rede tendo preenchido o campo. E uma alta
súbita de "indígena" idem. O dossiê lê a série como **qualidade de cadastro**
antes de ler como composição.

### 3.2 `EquidadeMunicipal`

`municipal` e `publica` (`MatriculaPorCorRaca`: total, branca, preta, parda,
amarela, indígena, não declarada), `escolas` (`EscolasPorCondicao`:
municipaisTotal, rurais, terra indígena, quilombolas, assentamento, educação
indígena), `negraMunicipal`, `naoDeclaradaPct`, `cadastroFragil`.

> `cadastroFragil` dispara quando a não declaração passa de um terço. Aí a
> distribuição por cor/raça **descreve o preenchimento do Censo, não a
> composição dos alunos**, e o dossiê precisa dizer isso antes de qualquer
> leitura de equidade.

### 3.3 `PovoTerritorial` — a corrente de três elos

Por povo (quilombola e indígena):

| Campo | Observação |
|---|---|
| `populacao` | Censo 2022 |
| `emIdadeEscolar` | recorte 0–14 |
| `matriculasNosSegmentos` | matrícula no segmento **ponderado** do FUNDEB |
| `razaoAtendimento` | |
| `sinalConferencia` | dispara a pergunta |

Somado à declaração de cor/raça do Censo Escolar, fecha a corrente:

```
população do povo (IBGE)
  → matrícula com cor/raça declarada (Censo Escolar)
    → matrícula no segmento ponderado (FNDE, fator 1,40–2,17)
```

Cada seta é uma perda possível, com causas distintas. **A segunda é a que vira
dinheiro**, e é a que nenhuma análise de duas pontas enxerga.

### 3.4 `AssentamentosMunicipio`

`qtd`, `familias`, `capacidade`, `areaHa` — cruzando com as escolas em
assentamento declaradas ao Censo.

---

## 4. Estrutura do documento

1. **Capa e sumário** — composição atual, não declaração, e o vão entre
   declaração e segmento ponderado, se houver.
2. **A série histórica, ano a ano** (fluxo) — as duas séries (municipal e
   pública), todos os grupos, todos os anos, com a leitura de qualidade de
   cadastro antes da leitura de composição.
3. **A corrente de três elos**, um povo por folha — população, idade escolar,
   declaração e segmento ponderado, com as duas perdas possíveis nomeadas e a
   pergunta de campo que cada uma gera.
4. **Territórios** — escolas em terra indígena, quilombola, assentamento e
   comunidade ribeirinha, com o fator de cada condição e o que vale por
   matrícula. Cruza com o dossiê 1 (as escolas nomeadas) e o 2 (o fator).
5. **Assentamentos do INCRA** — quantidade, famílias, capacidade e área, contra
   as escolas em assentamento declaradas. Divergência aqui é pergunta de campo.
6. **Cor/raça por zona** — urbana × rural, que o agregado municipal esconde. É
   comum a rede rural ser significativamente mais negra e ter pior resultado —
   e aí o mapa da rede é o mapa da Condicionalidade III.
7. **A ponte com o VAAR** — o que a Cond. III mede, com o número de partida
   deste município.

---

## 5. Regras específicas

1. **Autodeclaração, sempre.** Nunca afirmar pertencimento; nunca estimar
   quantos "deveriam" se declarar.
2. **Cadastro frágil invalida leitura de composição.** Acima de um terço de não
   declaração, corrigir o cadastro é pré-requisito de qualquer análise.
3. **Percentual não substitui contagem.** Derivar contagens de percentuais
   arredondados perde dezenas de matrículas em redes grandes — usar os
   absolutos (`corRacaTotais`).
4. **A ponderação segue a escola, não o aluno.** Repetir onde a distinção
   importa, porque é contraintuitivo e é onde está o dinheiro.

---

## 6. O que não existe

- **Cor/raça cruzada com resultado de aprendizagem por aluno.** O Saeb não
  divulga esse cruzamento por município.
- **População quilombola por comunidade.** O Censo agrega por município.
- **Território indígena georreferenciado** — depende da FUNAI (item #35 do
  roadmap do Raio-X, ainda pendente).

---

## 7. Como ficou — implementado em 2026-07-30

`core/lib/dossie-equidade.ts` · `-template.ts` · `-pdf.ts` ·
`app/api/modulos/dossies/equidade/` · 17 testes. 4 a 7 folhas conforme o
município.

**O detector de mudança de cadastro é o achado da construção.** A spec pedia
"ler a série como qualidade de cadastro antes de composição"; o que faltava era
um critério. Ele existe agora: variação da não declaração acima de 5 pontos
entre dois anos consecutivos marca o ano e imprime a ressalva. Serra do Ramalho
sai de 42,1% para 8,0% em dois anos, e a matrícula preta ou parda "sobe" de
51,9% para 83,1% — nenhuma rede fica 31 pontos mais negra em dois anos. Sem a
marca, o documento afirmaria isso.

**A corrente com o elo vazio.** O campo de cor/raça do Censo Escolar tem seis
categorias e nenhuma é quilombola. O elo do meio sai como travessão, com um
parágrafo explicando por quê — e o vão só é monetizado onde há os três elos, que
na prática é o povo indígena. Manaus: 15.647 crianças indígenas de 0 a 14 no
Censo, 1.088 matrículas declaradas no Censo Escolar, **142** no segmento
ponderado.

**O piso de relevância.** O Censo devolve populações de uma ou duas pessoas —
Paulo Afonso tem população quilombola igual a **1**. Povo abaixo de 30 crianças
em idade escolar só ganha folha se já houver matrícula no segmento; abaixo
disso a folha diria "1 pessoa, 0 matrículas" e ensinaria o leitor a pular a
seção.

**A monetização é conservadora por construção:** usa o **menor** fator do povo
(1,40), não o teto de 2,17, e monetiza só o **acréscimo** sobre a referência
1,00 — a matrícula já pondera hoje, só que como urbana.
