# Dossiê da Demanda

> Unidade de análise: **a coorte de nascimento e a faixa etária**. Volume: ~10
> coortes, 4 faixas, mais o cruzamento com a rede. 10 a 16 folhas.

---

## 1. O que ele prova

A matrícula segue o nascimento com **atraso fixo e conhecido**. A criança
nascida em 2024 chega à pré-escola em 2028 e ao 1º ano em 2030. O Registro
Civil já contou todas elas. Não há incerteza demográfica de curto prazo em
educação básica — há só gente que não olhou.

Este é o dossiê que transforma isso em planejamento: quantas vagas, em que ano,
em que etapa. E, do outro lado, quantas crianças da idade obrigatória **não
estão na rede**, que é receita não capturada e, antes disso, é criança fora da
escola.

O laço com o FUNDEB é direto: creche pública integral pondera **1,55**, o maior
fator disponível sem mudar o público que o município já atende.

---

## 2. Fontes e granularidade

| Fonte | Lib | Granularidade |
|---|---|---|
| Registro Civil (IBGE, agregado 2612) | `demografia-educacional.ts` | **por ano de nascimento** |
| Censo Demográfico 2022 (agregado 9514) | `demografia-educacional.ts` | por faixa etária |
| Censo Escolar | `inep-censo.ts` | matrícula por etapa e rede |
| População rural (SIDRA 10211) | `densidade-rede.ts` | urbana × rural |
| CadÚnico / Bolsa Família | `bolsa-familia-frequencia.ts` | público de educação |

---

## 3. Campos disponíveis

### 3.1 `DemografiaEducacional`

| Campo | Observação |
|---|---|
| `faixas` | população 0–3, 4–5, 6–10, 11–14 (Censo 2022) |
| `nascimentos[]` | `CoorteNascimento` — ver abaixo |
| `tendenciaNascimentosPct` | variação entre a primeira e a última coorte |
| `maesAdolescentes` | `{ ano, births, sharePct }` |
| `crecheEnrollment` / `preEnrollment` | matrícula municipal nas faixas |
| `totalEnrollment` | matrícula de **todas as redes**, para a foto completa |

### 3.2 `CoorteNascimento` — uma linha por ano

| Campo | Observação |
|---|---|
| `anoNascimento` | |
| `nascidos` | contagem do Registro Civil, por residência da mãe |
| `chegaPreEscolaEm` | ano em que a coorte faz 4 anos |
| `chegaPrimeiroAnoEm` | ano em que faz 6 |

### 3.3 `FrequenciaBolsaFamilia`

`competencia`, `publicoEducacao`, `acompanhados`, `percAcompanhados`,
`naoLocalizados`, `percNaoLocalizados`, `semInformacaoFrequencia`,
`percFrequenciaAcima`, `sancoes`.

**`naoLocalizados` é o achado.** É criança do público obrigatório de
acompanhamento que a rede não encontrou — cada uma é matrícula potencial e,
antes disso, é um caso de busca ativa.

---

## 4. Estrutura do documento

1. **Capa e sumário** — a coorte que chega ao 1º ano no último ano projetado, a
   tendência, e a cobertura de creche contra a meta 1 do PNE (50%).
2. **Calendário das coortes** (fluxo) — todos os anos de nascimento, com quantos
   nasceram e em que ano cada coorte chega à pré e ao fundamental. Uma tabela
   que vale por um plano decenal.
3. **Cobertura por faixa** — creche, pré, anos iniciais e finais, com dois
   denominadores lado a lado: **piso municipal** (matrícula da rede municipal ÷
   população) e **foto completa** (todas as redes ÷ mesma população). A
   diferença entre os dois é o que o município **não** atende mas alguém atende;
   o que falta para 100% na foto completa é criança fora da escola.
4. **A conta da creche** — quantas crianças de 0–3 fora da rede, quanto pondera
   cada matrícula em integral (1,55), e o que a distância até a meta do PNE
   representa em matrículas.
5. **Busca ativa** — o público do Bolsa Família não localizado, com a
   competência e as sanções. Cruza com a folha 3.
6. **Maternidade adolescente** — como contexto de rede: cada mãe adolescente é
   demanda de creche batendo na porta da mesma rede que ela precisaria
   frequentar. Nunca como rótulo individual.
7. **Distribuição urbano × rural** — onde a demanda futura está no território,
   cruzando com o dossiê 1.

---

## 5. Regras específicas

1. **Denominadores declarados.** População é do Censo 2022 e matrícula é mais
   recente. Leia como ordem de grandeza; acima de 100% indica atração de alunos
   de municípios vizinhos, não erro.
2. **Maternidade adolescente é contexto de rede.** A resposta é oferta noturna,
   contraturno e prioridade de vaga — nunca cobrança individual.
3. **Projeção de coorte não é projeção de matrícula.** A criança pode ir para a
   rede privada ou estadual. O dossiê projeta **demanda**, e diz isso.

---

## 6. O que não existe

- **Nascimentos por bairro ou distrito.** O Registro Civil agrega por município.
- **Projeção populacional oficial por faixa etária** para os anos futuros — o
  que existe é a coorte já nascida, que é mais confiável que projeção.
- **Fila de creche.** É dado municipal, não público. Vai para o ofício de
  solicitação de documentos.
