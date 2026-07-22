# Auditoria de Denominador Comum - FUNDEB Comercial

Data: 18/03/2026

## Amostra analisada

- Balneário Camboriú
- Petrópolis
- Cabo Frio
- Teresópolis

Os quatro casos foram comparados entre:

- total atual do FUNDEB 2026
- total projetado legado
- ganho legado
- base educacional atual disponível no Sync

## Achado principal

Entre os denominadores testados, o melhor sinal não foi `escolas`. O padrão mais estável apareceu em `alunos`.

### Coeficiente de variação por métrica

- `ganho por matrícula municipal`: média `R$ 5.565,54`, CV `8%`
- `ganho por matrícula total`: média `R$ 3.206,57`, CV `9%`
- `valor projetado por matrícula municipal`: média `R$ 13.256,06`, CV `9%`
- `valor projetado por matrícula total`: média `R$ 7.628,11`, CV `9%`
- `ganho por escola municipal`: média `R$ 1.634.634,51`, CV `31%`
- `ganho por escola total`: média `R$ 923.655,18`, CV `23%`

Leitura:

- `matrículas` são muito mais promissoras que `escolas`
- `escolas` isoladamente têm dispersão alta demais para servir como denominador comum

## Multiplicadores legados observados

- Balneário Camboriú: `1,680552x`
- Petrópolis: `1,683154x`
- Cabo Frio: `1,766821x`
- Teresópolis: `1,777689x`

Média: `1,727054x`

## Hipóteses mais úteis

### Hipótese 1: multiplicador-base comercial

Usar um multiplicador-base em torno de `1,72x`, com ajuste fino por perfil da rede.

Faixas observadas nesta amostra:

- grupo mais baixo: `1,68x`
- grupo mais alto: `1,77x`

### Hipótese 2: ganho por aluno

Usar o ganho legado como função das matrículas:

- aproximação por matrícula municipal: cerca de `R$ 5,6 mil` por aluno
- aproximação por matrícula total: cerca de `R$ 3,2 mil` por aluno

## Observação importante sobre o legado

O bloco de Censo Escolar do legado não é consistente:

- Balneário Camboriú exibe números no PDF legado
- Petrópolis, Cabo Frio e Teresópolis exibem "Dados do Censo Escolar não disponíveis"

Isso significa que a melhor pista hoje vem do comportamento financeiro legado, não do bloco de escolas/docentes do PDF antigo.

## Direção recomendada

Para calibrar o comercial, o caminho mais promissor é:

1. ancorar o módulo em um multiplicador-base perto de `1,72x`
2. usar `matrículas` como principal variável de ajuste
3. manter `escolas` apenas como variável secundária
4. tratar o censo legado como referência fraca, porque ele não é consistente entre os PDFs

## Rodada ampliada para 7 cidades

Casos adicionados:

- Nova Iguaçu
- Guapimirim
- Magé

### Multiplicadores legados observados

- Balneário Camboriú: `1,680552x`
- Petrópolis: `1,683154x`
- Cabo Frio: `1,766821x`
- Teresópolis: `1,777689x`
- Nova Iguaçu: `1,780006x`
- Guapimirim: `1,748342x`
- Magé: `1,821113x`

### Leitura da rodada ampliada

Os 7 casos reforçam que `matrículas` continuam sendo a melhor variável estrutural, mas sugerem que o comercial não opera em uma única faixa.

Sinais observados:

- grupo baixo/médio: `1,68x` a `1,78x`
- grupo alto: `1,80x+`

Os novos outliers foram:

- `Nova Iguaçu`
- `Magé`

Esses casos indicam um segundo regime comercial associado a redes maiores ou a uma escala financeira mais alta.

### Implicação prática

O modelo comercial provavelmente precisa de:

1. uma âncora principal por matrículas
2. uma segunda camada de ajuste para municípios de grande porte
3. teto superior mais flexível para não achatar casos como Nova Iguaçu e Magé
