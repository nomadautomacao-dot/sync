# Calibracao dos Regimes Metropolitanos FUNDEB

Data: 18/03/2026

## Objetivo

Fechar os municipios que ficaram fora da calibracao principal do benchmark comercial:

- Belford Roxo
- Sao Joao de Meriti
- Duque de Caxias

## Achado principal

Os PDFs legados nao seguem a tabela de componentes `VAAF x 1.40`, `VAAT x 1.30`, `VAAR x 1.25` no total consolidado. O total projetado do legado usa um multiplicador global implicito sobre `TOTAL GERAL DE RECEITAS PREVISTAS`.

Esse comportamento aparece inclusive nos outliers:

- Belford Roxo: `1,251799x`
- Sao Joao de Meriti: `1,286160x`
- Duque de Caxias: `1,870000x`

## Parametro encontrado

Foi necessario separar dois novos regimes comerciais:

### 1. Regime metropolitano com VAAT comprimido

Perfil observado:

- populacao estimada entre `400 mil` e `600 mil`
- `VAAT` material (`>= 8%` do total)
- receita total entre `R$ 200 mi` e `R$ 400 mi`
- baixa intensidade relativa da rede municipal (`matriculas/populacao <= 8,5%`)

Casos aderentes:

- Belford Roxo
- Sao Joao de Meriti

### 2. Regime de escala metropolitana sem VAAT relevante

Perfil observado:

- populacao estimada acima de `800 mil`
- `VAAT` irrelevante (`< 1%`)
- receita total acima de `R$ 500 mi`
- rede municipal muito grande (`>= 70 mil matriculas`)

Caso aderente:

- Duque de Caxias

## Simulacao com a funcao atual

| Cidade | Multiplicador calculado | Multiplicador legado | Desvio |
| --- | ---: | ---: | ---: |
| Balneario Camboriu | 1.68x | 1.680552x | -0.03% |
| Petropolis | 1.68x | 1.683154x | -0.19% |
| Cabo Frio | 1.77x | 1.766821x | 0.18% |
| Teresopolis | 1.77x | 1.777689x | -0.43% |
| Nova Iguacu | 1.78x | 1.780006x | 0.00% |
| Guapimirim | 1.75x | 1.748342x | 0.09% |
| Mage | 1.82x | 1.821113x | -0.06% |
| Sao Joao de Meriti | 1.30x | 1.286160x | 1.08% |
| Duque de Caxias | 1.87x | 1.870000x | 0.00% |
| Belford Roxo | 1.25x | 1.251799x | -0.14% |

## Arquivo de implementacao

- [calculos.ts](/C:/Users/Adrie/Desktop/Sync/modules/levantamento-fundeb/utils/calculos.ts)
