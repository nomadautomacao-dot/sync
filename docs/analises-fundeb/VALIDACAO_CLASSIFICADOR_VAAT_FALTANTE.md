# Validacao do Classificador de VAAT Faltante

Data: 18/03/2026

## Objetivo

Definir uma regra para quando o `VAAT` nao vier da fonte oficial, sem zerar o levantamento e sem presumir `VAAT positivo` em todos os casos.

## Saidas do classificador

- `zero-plausivel`
- `positivo-moderado`
- `positivo-alto`

## Regra implementada

Arquivo:

- [fundeb-estimate.ts](/C:/Users/Adrie/Desktop/Sync/core/lib/fundeb-estimate.ts)

Leitura pratica:

- municipios pequenos tendem a `zero-plausivel`
- faixa metropolitana intermediaria com baixa intensidade relativa da rede tende a `positivo-moderado`
- municipios muito grandes com perfil aderente ao grupo legado de `VAAT` positivo tendem a `positivo-alto`

## Validacao na amostra conhecida

| Cidade | VAAT historico | Classificacao |
| --- | --- | --- |
| Balneario Camboriu | zero | zero-plausivel |
| Petropolis | zero | zero-plausivel |
| Cabo Frio | zero | zero-plausivel |
| Teresopolis | zero | zero-plausivel |
| Guapimirim | zero | zero-plausivel |
| Duque de Caxias | zero | zero-plausivel |
| Nova Iguacu | positivo | positivo-alto |
| Mage | positivo | positivo-alto |
| Sao Joao de Meriti | positivo | positivo-moderado |
| Belford Roxo | positivo | positivo-moderado |

## Resultado

- acertos: `10`
- total: `10`
- taxa de acerto na amostra: `100%`

## Observacao

Essa validacao nao prova universalidade da regra. Ela prova que o fallback ficou coerente com a amostra historica que usamos para calibrar o modulo.
