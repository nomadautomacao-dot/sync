# Dossiê do Dinheiro Federal

> Unidade de análise: **a transferência / a obra**. Volume: dezenas a centenas
> de linhas. 12 a 30 folhas.

---

## 1. O que ele prova

O FUNDEB é o maior fluxo, mas está longe de ser o único. Emenda parlamentar,
convênio, PDDE, PNAE, PNATE, salário-educação e obra do FNDE somam um segundo
orçamento — e ele é **descontínuo, disputado e perecível**. Obra parada perde
valor a cada mês; emenda não empenhada volta; convênio sem prestação de contas
fecha a porta do próximo.

O Raio-X dá duas folhas a isto. Aqui cada obra aparece nomeada com valor e
situação, cada ano de emenda com quanto foi empenhado e quanto foi pago, cada
convênio vigente com vigência e liberação. É o inventário que a prefeitura não
tem consolidado em lugar nenhum, porque cada pedaço mora num sistema diferente.

---

## 2. Fontes e granularidade

| Fonte | Lib | Granularidade |
|---|---|---|
| Painel do Pacto de Retomada de Obras (FNDE) | `fnde-obras.ts` | **por obra** |
| Emendas parlamentares (Portal da Transparência) | `emendas-municipais.ts` | por ano e por autor |
| Convênios federais | `portal-transparencia.ts` | **por convênio** |
| Sanções | `portal-transparencia.ts` | **por sanção** |
| PDDE, SIGARPWEB, SIGPC, PAR | `fnde-public.ts` | por sistema |
| SIMEC | `simec-obras.ts` | por obra vinculada |
| PNAE | `fundeb-pnae.ts` | por faixa do Anexo V |

---

## 3. Campos disponíveis

### 3.1 `ObraCritica` — uma linha por obra

`ano`, `tipo`, `classificacao`, `situacao`, `estimativaRepasse`, `execucao`,
`saldoBancario`.

No agregado: `total`, `paralisadas`, `inacabadas`, `emRetomada`,
`valorParadoEstimado`, `valorEstimadoRepactuacao`.

### 3.2 `EmendasAno` — uma linha por ano

`ano`, `quantidade`, `empenhado`, `pago`, `quantidadeEducacao`,
`empenhadoEducacao`, `pagoEducacao`.

Mais `autoresEducacao[]` — **os parlamentares que já destinaram emenda de
educação a este município, com o valor empenhado de cada um**. Comercialmente é
um dos dados mais úteis do dossiê inteiro: é a lista de quem já provou ter
interesse no município.

### 3.3 `ConvenioResumo` — uma linha por convênio vigente

`objeto`, `orgao`, `situacao`, `fimVigencia`, `valor`, `valorLiberado`,
`educacao` (booleano).

No agregado: `total`, `truncado`, `vigentes`, `valorVigentes`,
`liberadoVigentes`, `educacaoVigentes`, `valorEducacaoVigentes`,
`semLiberacao`.

> `truncado` é campo de honestidade: quando a consulta limita o retorno, o
> dossiê **imprime quantos ficaram de fora**. Ver a regra 6 da visão geral.

### 3.4 `SancaoResumo`

`cadastro`, `sancionado`, `orgaoSancionador`, `tipo`, `fimSancao` — separando
sanções **aplicadas ao ente** de sanções **aplicadas pelo ente** a
fornecedores. As duas coisas dizem algo diferente e são confundidas.

---

## 4. Estrutura do documento

1. **Capa e sumário** — o total de dinheiro federal fora do FUNDEB, quanto está
   parado e quanto vence.
2. **Obra a obra** (fluxo) — todas, ordenadas por valor parado. Cada uma com
   ano, tipo, classificação, situação, estimativa de repasse, execução e saldo
   bancário. Bloco de leitura para as paradas: há edital de retomada, e a
   janela dele.
3. **Emendas, ano a ano** — a série com quantidade, empenhado e pago, separando
   educação do total. A diferença entre empenhado e pago é a linha que ninguém
   olha e que diz se o recurso chegou.
4. **Quem já destinou emenda a este município** — os autores, com valor. Uma
   folha, e é a que o gestor fotografa.
5. **Convênio a convênio** (fluxo) — vigentes, com objeto, órgão, vigência,
   valor e liberado. Destaque para os sem liberação e para os que vencem no
   exercício.
6. **PDDE, PNAE, PNATE e salário-educação** — as transferências automáticas,
   com o que condiciona cada uma (adesão, CAE constituído, prestação de contas
   no SIGPC).
7. **Sanções** — as duas listas, separadas e explicadas.
8. **Situação cadastral nos sistemas** — SIMEC, Habilita, SIGARPWEB, SIGPC,
   PDDE Info, PAR: o que a consulta pública alcança e o que exige credencial do
   ente. Esta folha é também a lista do que a consultoria precisa receber.

---

## 5. O que não existe

- **Detalhe operacional de obra** exige credencial do ente no SIMEC. A consulta
  pública dá a existência e a estimativa, não o cronograma físico-financeiro.
- **Emenda por objeto.** A fonte agrega por ano e função; o objeto individual
  não vem no dataset consolidado.
- **Histórico de sanções encerradas** — a consulta traz as vigentes.
