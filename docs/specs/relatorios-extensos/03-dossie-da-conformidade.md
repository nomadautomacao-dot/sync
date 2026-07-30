# Dossiê da Conformidade e Prestação de Contas

> Unidade de análise: **o requisito / o indicador**. Volume: ~40 requisitos do
> CAUC, 14 indicadores do SIOPE, N entregas de DCA, 5 condicionalidades do
> VAAR. 15 a 25 folhas.

---

## 1. O que ele prova

É o dossiê que a secretaria usa **no dia seguinte**. Os outros mostram o
retrato; este mostra a lista de coisas a fazer, cada uma com o artigo de lei, o
prazo e o que trava se não for feita.

O Raio-X dedica duas folhas a isto e nomeia só as pendências. Aqui entram
**todos** os requisitos — inclusive os comprovados, com a data de validade de
cada comprovação. Item comprovado não é notícia velha: ele vence, e vira
pendência sozinho quando o prazo passa. A rotina que protege a carteira de
convênios é olhar o extrato antes do vencimento, não depois da recusa, e este
documento é essa rotina impressa.

---

## 2. Fontes e granularidade

| Fonte | Lib | Granularidade |
|---|---|---|
| CAUC — extrato de requisitos fiscais | `cauc-requisitos.ts` | **por requisito** |
| SIOPE — vinculações da educação | `siope-indicadores.ts` | **por indicador** |
| Siconfi — entregas da DCA | `siconfi-entregas.ts` | **por entrega/exercício** |
| VAAR — condicionalidades | `fundeb-vaar.ts` | por condicionalidade |
| Remuneração e piso | `remuneracao-docente.ts` | agregado, com amostra |
| Sistemas MEC/FNDE | `simec-obras.ts`, `fnde-public.ts` | por sistema |

---

## 3. Campos disponíveis

### 3.1 `RequisitoCauc` — uma linha por requisito (~40)

| Campo | Observação |
|---|---|
| `codigo` | ex.: `3.2.3` |
| `rotulo` | descrição oficial |
| `situacao` | `comprovado` \| `pendente` \| `desabilitado` |
| `validadeAte` | ISO, quando comprovado — **é o que gera a agenda** |

E no agregado: `pendencias`, `pendenciasEducacao`, `comprovados`,
`desabilitados`, `proximoVencimento`, `panorama` (comparação nacional),
`dataPesquisa`.

> `desabilitado` significa item indisponível na consulta, **igual para todos os
> entes do país** — nunca é falha local. O dossiê precisa dizer isso toda vez,
> porque a leitura errada gera pânico desnecessário.

### 3.2 `IndicadorSiope` — uma linha por indicador (14)

| Campo | Observação |
|---|---|
| `cod`, `chave`, `rotulo` | identificação |
| `valor`, `unidade` | apurado |
| `limite`, `sentido` | o parâmetro legal e se é mínimo ou máximo |
| `conforme` | booleano; `null` quando não há parâmetro |
| `folga` | distância até o limite — **é a margem de manobra** |
| `base` | base de cálculo |

Mais `ano`, `defasado` (declaração do exercício anterior), `descumpridas[]`.

### 3.3 `EntregaDca` — uma linha por exercício

| Campo | Observação |
|---|---|
| `exercicio` | |
| `entregueEm` | data real |
| `homologada` | |
| `diasAlemDoPrazo` | contra 30/4 da LRF |
| `estourouCorteVaat` | contra 31/8 — **este é o que inabilita** |

Mais `rreoEntregues`, `rgfEntregues`, `risco` (alto/médio/baixo).

### 3.4 `SituacaoVaar` — as cinco condicionalidades

`condicionalidades` (todas, com status), `reprovadas[]`, `condIVEstadual`
(reprovação do estado, que nenhuma ação municipal reverte), `pendencia` (o
texto oficial do FNDE), `habilitadoSemRepasse`, `coeficiente`, e a referência
com mediana nacional, mediana da UF, habilitadas e avaliadas.

---

## 4. Estrutura do documento

1. **Capa e sumário** — o placar: X de Y requisitos comprovados, Z pendências,
   quantas são de educação, próximo vencimento, e o risco do VAAT.
2. **Agenda por data** (fluxo) — **a seção mais útil do dossiê inteiro.** Todos
   os requisitos comprovados ordenados por `validadeAte`, com quantos dias
   faltam. É a lista que a secretaria imprime e cola na parede.
3. **Requisito a requisito** (fluxo) — todos os ~40, com código, rótulo,
   situação, validade, e o que cada um trava quando pende. Os cinco de educação
   destacados, porque travam duas coisas ao mesmo tempo: a transferência
   voluntária e a habilitação ao VAAT.
4. **SIOPE indicador a indicador** — os 14, com apurado, parâmetro, folga e
   conformidade. Os que não têm parâmetro legal aparecem como informativos, e o
   documento diz isso — hoje é comum lerem 6,76% de "FUNDEB em MDE que não
   remuneração" como descumprimento, e não é.
5. **Pontualidade** — a série de DCAs com data real contra os dois prazos, e a
   previsão: com este padrão, o VAAT do exercício seguinte está em risco?
6. **VAAR condicionalidade a condicionalidade** — as cinco, com o texto oficial
   do FNDE quando há pendência, e a separação entre o que é ato de gestão
   municipal e o que é aferido no estado.
7. **Piso do magistério** — declarado, mediana, abaixo do piso, cobertura da
   amostra e a ressalva de confiabilidade (`confiavel`).
8. **Calendário do exercício** (fluxo) — todos os prazos do ano numa folha:
   DCA 30/4, SIOPE bimestral +30 dias, Siconfi e SIOPE 31/8, Censo maio–31/7,
   retificação 30 dias, envio ao FNDE em dezembro.

---

## 5. Regras específicas

1. **Comprovado também é notícia.** O dossiê não lista só o que falta — a
   metade do valor está em mostrar o que vence e quando.
2. **`desabilitado` nunca é falha do ente.** Repetir isso onde aparecer.
3. **Descumprimento do SIOPE não bloqueia o FUNDEB.** O art. 21 manda repassar
   automaticamente. O que trava é convênio (CAUC) e a aprovação de contas no
   tribunal. Confundir os dois é o erro mais comum do setor e o dossiê existe
   em parte para desfazê-lo.
4. **A reprovação estadual na Cond. IV** zera o VAAR de todos os municípios da
   UF. Cobrar gestão local por isso é diagnóstico errado.
