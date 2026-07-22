# Auditoria Comercial FUNDEB - Rodada 3

Data: 17/03/2026

## Objetivo

Adicionar variáveis de rede escolar para testar se a lógica comercial dos relatórios legados responde mais à intensidade de atendimento da rede municipal do que ao tamanho bruto da cidade.

## Fontes oficiais usadas

- INEP / Sinopse Estatística da Educação Básica 2023
- FNDE / VAAT 2026
- FNDE / habilitação VAAT 2026
- IBGE / Cidades e Estados

## Variáveis cruzadas

Para o conjunto de municípios auditados foram extraídos:

- matrículas totais da educação básica na rede municipal
- matrículas municipais de educação infantil
- matrículas municipais de creche
- população estimada IBGE 2025
- `FUNDEB per capita`
- razão comercial do PDF legado

## Achado central

O melhor sinal desta rodada foi:

- `matrículas municipais por habitante`
- `educação infantil municipal por habitante`
- `creche municipal por habitante`

Comparando grupos:

### Grupo de razão comercial baixa (`< 1,40`)

- média de matrículas municipais por habitante: `7,10%`
- média de educação infantil municipal por habitante: `1,67%`
- média de creche municipal por habitante: `0,60%`
- média de `FUNDEB per capita`: `R$ 588,93`

Municípios:

- Belford Roxo
- São João de Meriti

### Grupo de razão comercial alta (`>= 1,70`)

- média de matrículas municipais por habitante: `13,38%`
- média de educação infantil municipal por habitante: `3,08%`
- média de creche municipal por habitante: `1,13%`
- média de `FUNDEB per capita`: `R$ 1.023,80`

## Leitura

Isso sugere que o comercial antigo parece premiar municípios onde a rede municipal:

1. atende proporcionalmente mais alunos
2. tem peso maior de educação infantil
3. especialmente creche
4. já apresenta `FUNDEB per capita` mais alto

## Exceções relevantes

Há outliers importantes:

- `Nova Iguaçu`
- `Duque de Caxias`

Esses dois mantêm razão comercial alta mesmo sem intensidade proporcional tão forte quanto pequenos e médios municípios do grupo alto.

Leitura provável:

- existe uma segunda variável de escala/oportunidade comercial
- ou existe uma regra adicional para grandes redes metropolitanas

## Hipótese mais forte até aqui

O comercial legado parece usar pelo menos dois eixos:

1. `intensidade da rede municipal por habitante`
2. `potencial financeiro/oportunidade` do ente

Em termos práticos, o melhor denominador comum encontrado até agora não é:

- população isolada
- VAAT isolado

E sim uma combinação de:

- `FUNDEB per capita`
- `matrículas municipais / população`
- `educação infantil municipal / população`
- `creche municipal / população`
- `VAAT % do total`
- `habilitação / regularização`

## Tabela-resumo

| Município | Razão comercial | Matrículas municipais / população | Educação infantil municipal / população | Creche municipal / população | FUNDEB per capita |
|---|---:|---:|---:|---:|---:|
| Belford Roxo | 1,2518 | 8,09% | 1,75% | 0,66% | R$ 687,71 |
| São João de Meriti | 1,2862 | 6,11% | 1,58% | 0,55% | R$ 490,15 |
| Petrópolis | 1,6832 | 11,77% | 2,91% | 1,25% | R$ 876,74 |
| Seropédica | 1,7088 | 15,49% | 2,90% | 0,64% | R$ 1.173,80 |
| Tanguá | 1,7149 | 16,13% | 3,97% | 1,61% | R$ 1.334,04 |
| Itaguaí | 1,7232 | 16,31% | 3,96% | 1,57% | R$ 1.155,62 |
| Guapimirim | 1,7483 | 15,18% | 3,91% | 1,85% | R$ 1.126,03 |
| Cabo Frio | 1,7668 | 13,56% | 3,61% | 1,54% | R$ 922,43 |
| Teresópolis | 1,7777 | 11,91% | 2,94% | 1,06% | R$ 883,68 |
| Nova Iguaçu | 1,7800 | 7,45% | 1,08% | 0,07% | R$ 625,03 |
| Magé | 1,8211 | 15,79% | 3,80% | 1,44% | R$ 1.335,05 |
| Duque de Caxias | 1,8700 | 8,63% | 1,57% | 0,42% | R$ 658,55 |

## Conclusão desta rodada

Se a meta é aproximar o sistema do comercial legado, a melhor direção encontrada até agora é modelar o multiplicador comercial com base em:

1. `FUNDEB per capita`
2. `matrículas municipais por habitante`
3. `educação infantil municipal por habitante`
4. `creche municipal por habitante`
5. `VAAT % do total`
6. `status de habilitação/regularização`

## Próximo passo recomendado

Em vez de uma fórmula única, faz mais sentido criar:

- um `score comercial`
- e depois mapear esse score para faixas de multiplicador

Exemplo conceitual:

- perfil conservador: `1,25 - 1,35`
- perfil padrão: `1,68 - 1,78`
- perfil agressivo: `1,80 - 1,90`

Essa abordagem tem muito mais chance de reproduzir o comportamento dos PDFs antigos do que insistir em uma única regra fixa.
