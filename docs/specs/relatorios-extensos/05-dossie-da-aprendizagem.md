# Dossiê da Aprendizagem

> Unidade de análise: **a série histórica e o grupo de proficiência**. Volume:
> 4 séries do Saeb × N anos, mais o IDEB e a alfabetização. 12 a 20 folhas.

---

## 1. O que ele prova

O IDEB é um número só, e um número só esconde duas coisas ao mesmo tempo: a
distância entre as escolas da rede (isso é o dossiê 1) e a **distribuição dos
alunos dentro de cada escola** — que é isto aqui.

Uma rede com média 5,1 pode ter 30% dos alunos no nível insuficiente ou 8%. A
média não distingue, a política pública sim: 30% insuficiente é recomposição em
massa; 8% é reforço focalizado. O dado existe, é público, e praticamente
nenhuma secretaria o usa.

Some-se a alfabetização no 2º ano — **a única meta que o próprio município
assinou**, no CNCA. Todo o resto do dossiê compara com referências; aqui a
régua é o compromisso do próprio ente, ano a ano até 2030.

---

## 2. Fontes e granularidade

| Fonte | Lib | Granularidade |
|---|---|---|
| Saeb — distribuição de proficiência | `saeb-distribuicao.ts` | **por série e grupo** |
| Alfabetização (CNCA) | `alfabetizacao-municipal.ts` | **por ano**, com meta |
| IDEB municipal | `ideb-municipal.ts` | por ano e etapa |
| IDEB por escola | `ideb-escolas.ts` | por escola (aprofundado no dossiê 1) |
| ENEM — abstenção | `enem-abstencao.ts` | por ano |
| Rendimento (aprovação, reprovação, abandono) | `data/inep-rendimento-municipal-2023.json` | por etapa |
| QEdu | `qedu-indicators.ts` | indicadores complementares |

---

## 3. Campos disponíveis

### 3.1 `SaebDistribuicaoMunicipio`

Quatro séries: `lp5`, `mt5`, `lp9`, `mt9` (Língua Portuguesa e Matemática, 5º e
9º ano). Cada uma com:

| Campo | Observação |
|---|---|
| `media` | proficiência média da rede |
| `grupos.insuficiente` | % dos alunos |
| `grupos.basico` | % |
| `grupos.proficiente` | % |
| `grupos.avancado` | % |

**São 16 números que contam uma história que a média não conta.** A folha
central do dossiê é a barra empilhada das quatro séries lado a lado.

### 3.2 `AlfabetizacaoMunicipal`

| Campo | Observação |
|---|---|
| `serie[]` | `{ ano, valor, meta, cumpriu }` — a série completa |
| `ultimo` | último ano com dado |
| `variacaoPontos` | evolução |
| `proximaMeta` | `{ ano, target, gapPoints }` — a distância |
| `metaFinal` | `{ ano, target, requiredPace }` — o ritmo necessário até 2030 |
| `ritmoObservado` | o ritmo real |
| `nivel` / `nivelRotulo` | posição no Compromisso |
| `participacao` / `participacaoFragil` | validade do dado |
| `uf` | régua estadual |

O cruzamento que importa: **ritmo observado × ritmo necessário**. Se o
observado é menor, a meta de 2030 já está perdida em ritmo constante, e isso é
dizível hoje com número.

### 3.3 `EnemAbstencaoMunicipio`

`ano`, `inscritos`, `ausentes`, `pctAbstencao`, `uf`. É rede estadual, não
municipal — entra como sinal de desengajamento no fim da básica, com a ressalva
de que o recorte é por município de prova e inclui candidatos de vizinhos.

---

## 4. Estrutura do documento

1. **Capa e sumário** — IDEB das duas etapas, % insuficiente nas quatro séries,
   alfabetização contra a meta assinada.
2. **A distribuição, série a série** — quatro folhas, uma por série, com a
   barra empilhada, a média, e o que cada grupo significa em número de alunos
   (não só em %). "18% insuficiente" é abstrato; "1.284 alunos no nível
   insuficiente em Matemática do 9º ano" não é.
3. **A série do IDEB** — todos os anos, as duas etapas, contra a referência.
   Com a leitura de trajetória: rede que subiu, estacionou ou caiu.
4. **Alfabetização, ano a ano** — a série com meta e cumprimento, o ritmo
   observado contra o necessário, e a projeção até 2030 em ritmo constante.
5. **Fluxo escolar** — aprovação, reprovação, abandono e distorção idade-série
   por etapa. Fluxo é metade do IDEB e é onde a gestão age mais rápido.
6. **A ponte com o VAAR** — a Cond. I mede **evolução**, não nível. Uma folha
   mostrando o que a rede precisa evoluir, com o número de partida.
7. **ENEM** — abstenção, com as ressalvas.

---

## 5. Regras específicas

1. **Converter % em alunos.** Todo percentual de distribuição precisa aparecer
   também em número de crianças. É o que muda a conversa.
2. **Participação frágil invalida leitura.** Quando `participacaoFragil` é
   verdadeiro, o dado descreve quem fez a prova, não a rede — e o dossiê diz
   isso antes do número.
3. **Não há meta do INEP após 2021.** O parâmetro exibido é referência
   nacional; chamar de "meta" afirma compromisso que o INEP não publicou.
4. **ENEM é rede estadual.** Nunca apresentar como resultado da rede municipal.

---

## 6. O que não existe

- **Saeb por escola com distribuição de grupos.** A divulgação por escola traz
  proficiência média (no dossiê 1), não a distribuição.
- **Série histórica da distribuição.** O dataset traz a edição corrente.
- **Alfabetização por escola.** A avaliação do 2º ano é divulgada por rede.

---

## 7. Como ficou — implementado em 2026-07-30

`core/lib/dossie-aprendizagem.ts` · `-template.ts` · `-pdf.ts` ·
`core/lib/rendimento-municipal.ts` (novo) ·
`app/api/modulos/dossies/aprendizagem/` · 22 testes. 8 folhas.

**O que entrou além do previsto na spec:**

- **A régua nacional, por prova.** `saeb-distribuicao.ts` ganhou
  `getReferenciaNacionalSaeb()`: mediana e percentil 99 de cada série, medidos
  sobre as próprias 5.397 redes municipais avaliadas. Toda folha de prova mostra
  a mediana nacional ao lado do percentual do município e a posição dele na
  distribuição.
- **O aviso de distribuição atípica.** Ibateguara/AL declara 96,3% dos alunos no
  nível avançado em LP do 5º ano, contra mediana de 20% — acima do percentil 99.
  É a mesma rede que aparece com IDEB 9,6 e 100% de aprovação no Dossiê das
  Escolas. Entregar isso como conquista, sem contexto, derrubaria o documento
  inteiro na primeira conferência. A prova sai marcada, com a mediana ao lado e
  o pedido de conferir participação e número de respondentes.
- **`rendimento-municipal.ts`.** O dataset `inep-rendimento-municipal-2023.json`
  não tinha lib própria — só `qedu-indicators.ts` o lia de passagem. A lib nova
  expõe aprovação, reprovação, abandono e distorção por etapa, os componentes do
  IDEB abertos, e **declara qual recorte de rede usou**: onde não há municipal
  nem pública, o número descreve o território, não a rede.
- **A folha do VAAR como portão e régua.** As cinco condicionalidades são o
  portão (reprovar em uma zera a parcela); o valor é proporcional ao **avanço**
  em atendimento e aprendizagem. São Paulo tem a Cond. III reprovada — redução
  das desigualdades de aprendizagem —, que é exatamente a cauda que as barras
  das folhas anteriores mostram.

**A limitação que não deu para resolver.** A planilha de resultados do Saeb 2023
tem 113 colunas e **nenhuma contagem de participantes** — só percentuais. O
Censo publica matrícula por etapa, não por série. A conversão de percentual em
crianças supõe distribuição uniforme entre as séries da etapa, o campo se chama
`alunosAproximados`, todo número sai com `≈` e a suposição está impressa em cada
folha onde ele aparece.
