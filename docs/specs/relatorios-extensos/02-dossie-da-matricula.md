# Dossiê da Matrícula Ponderada

> Unidade de análise: **o segmento ponderado**. Volume: 15 a 40 segmentos,
> mais as etapas do Censo e as faixas do PNAE. 12 a 25 folhas.

---

## 1. O que ele prova

Este é o dossiê que explica **de onde vem cada real** do fundo. O FUNDEB não
paga por matrícula: paga por **matrícula ponderada**, e o fator vai de 1,00
(anos iniciais urbanos) a 2,17 (creche integral indígena ou quilombola). Duas
redes com o mesmo número de alunos recebem valores diferentes, e a diferença
está inteiramente na composição declarada.

O Raio-X mostra o fator médio e os 12 segmentos de maior peso. Aqui entram
**todos**, com a conta aberta: matrículas × fator = equivalentes, e a
participação de cada um no total ponderado. O gestor vê, linha a linha, qual
segmento sustenta a receita e qual está declarado abaixo do que a rede atende.

---

## 2. Fontes e granularidade

| Fonte | Lib | Granularidade |
|---|---|---|
| Planilha de matrículas ponderadas do FNDE | `fundeb-ponderacao.ts` | **por segmento** |
| Censo Escolar municipal | `inep-censo.ts` | por etapa, ~30 campos de matrícula |
| Estimativa PNAE | `fundeb-pnae.ts` | **por faixa do Anexo V** |
| Matrícula por cor/raça | `inep-equidade.ts` | por grupo |
| Escolas por condição | `inep-equidade.ts` | por condição de território |

---

## 3. Campos disponíveis

### 3.1 `PonderacaoMunicipal` — o núcleo

| Campo | Observação |
|---|---|
| `exercicio`, `fonte`, `uf`, `ente` | procedência |
| `matriculas` | total na filtragem do FNDE |
| `ponderadaVaaf` / `ponderadaVaat` | os dois denominadores, que **não são o mesmo número** |
| `fatorMedio` | referência legal = 1,000 |
| `segmentos[]` | ver abaixo |
| `oportunidades[]` | ver 3.3 |

### 3.2 `SegmentoPonderado` — uma linha por segmento

| Campo | Observação |
|---|---|
| `nome` | ex.: "Creche Integral Pública Urbano" |
| `matriculas` | declaradas no segmento |
| `fatorVaaf` | o multiplicador legal |
| `equivalentes` | `matriculas × fator` — a contribuição real à receita |
| `participacao` | % do total ponderado da rede |

### 3.3 `OportunidadePonderacao` — onde há distância até a mediana

Duas chaves hoje: `creche-integral` e `aee`.

| Campo | Observação |
|---|---|
| `matriculas` | matrículas na condição de **menor** fator — é o teto, não a meta |
| `ganhoEquivalentes` | ganho se **toda** a matrícula migrasse — cifra que a base não sustenta |
| `indicador` / `mediana` | o município contra a mediana nacional das redes municipais |
| `matriculasAteMediana` | **o número que o dossiê monetiza** |
| `ganhoEquivalentesMediana` | ganho em equivalentes até a mediana |
| `detalhe` | texto de procedência |

> **Regra dura, já embutida no código.** O teto (`matriculas` /
> `ganhoEquivalentes`) supõe que toda creche parcial vire integral e que todo
> aluno de educação especial tenha AEE — em São Paulo isso dava R$ 173,9
> milhões de "oportunidade". O dossiê usa a **distância até a mediana**, que é
> o que a experiência de outras redes mostra ser alcançável. O teto pode
> aparecer, mas rotulado como teto.

---

## 4. Estrutura do documento

1. **Capa e sumário** — total de matrículas, ponderadas VAAF e VAAT, fator
   médio, e a frase que resume: quantos por cento da receita vêm dos segmentos
   de fator acima de 1,00.
2. **A tabela completa dos segmentos** (fluxo) — todos, ordenados por
   `equivalentes`. Colunas: segmento, matrículas, fator, equivalentes,
   participação, e uma barra proporcional. Rodapé com a soma, que tem de bater
   com `ponderadaVaaf`.
3. **VAAF × VAAT lado a lado** — os dois denominadores diferem, e quase ninguém
   na secretaria sabe disso. Uma folha explicando por quê, com a conta dos dois.
4. **Etapas do Censo × segmentos do FNDE** — a conciliação. O Censo conta por
   etapa; o FNDE por segmento ponderado. Os totais não batem por construção
   (educação especial é recorte transversal, dupla matrícula do AEE), e o
   dossiê mostra a ponte em vez de esconder a diferença.
5. **Oportunidades, uma folha cada** — creche integral e AEE, com indicador do
   município, mediana nacional, distância, e a conferência que valida.
6. **PNAE** (fluxo) — as faixas do Anexo V com per capita, matrículas e valor
   anual estimado. É a segunda receita que a mesma matrícula gera.
7. **Localização diferenciada** — as escolas em campo, terra indígena,
   quilombola e assentamento, com o fator que cada condição vale. Cruza com o
   dossiê 1 e com o 7.

---

## 5. O que não existe

- **Fator por escola.** A planilha do FNDE agrega por segmento, não por
  unidade. Distribuir o fator entre escolas exigiria supor a composição de cada
  uma — não se faz.
- **Histórico de ponderação.** A lib traz o exercício corrente. Série
  plurianual exigiria guardar as planilhas anteriores do FNDE.
- **Valor em reais por segmento.** O que existe é `valorPorEquivalente` no
  `fundeb-ganho-apurado`, para a UF. Multiplicar segmento a segmento produz
  número que a portaria não publica — só entra com rótulo de derivação
  explícito, ou não entra.
