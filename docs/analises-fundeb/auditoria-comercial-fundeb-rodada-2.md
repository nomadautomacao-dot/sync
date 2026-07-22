# Auditoria Comercial FUNDEB - Rodada 2

Data: 17/03/2026

## Objetivo

Verificar se existe um denominador comum mais próximo da lógica comercial dos relatórios legados, cruzando:

- razão comercial do PDF (`total projetado / total atual`)
- `VAAT` oficial 2026
- status de habilitação `VAAT`
- população estimada `IBGE 2025`
- receitas brutas municipais `IBGE 2023`
- participação do `FUNDEB` nas receitas do município

## Fontes oficiais consultadas

- FNDE - VAAT 2026 por ente
- FNDE - habilitados/inabilitados VAAT 2026
- IBGE Cidades e Estados

## Achados

### 1. População isolada não explica o padrão comercial

Não apareceu relação simples entre `população total` e o multiplicador comercial.

Exemplos:

- `Duque de Caxias`: população alta, razão `1,87`
- `Nova Iguaçu`: população alta, razão `1,78`
- `Belford Roxo`: população alta, razão `1,25`
- `São João de Meriti`: população alta, razão `1,29`

Ou seja: municípios grandes podem ter tanto multiplicador alto quanto baixo.

### 2. VAAT também não explica sozinho

Municípios com `VAAT` relevante aparecem em dois extremos:

- `Belford Roxo`: `VAAT 16,31% do total`, razão `1,2518`
- `Magé`: `VAAT 13,03% do total`, razão `1,8211`
- `Nova Iguaçu`: `VAAT 13,71% do total`, razão `1,7800`
- `São João de Meriti`: `VAAT 8,66% do total`, razão `1,2862`

Conclusão: `VAAT` é importante, mas não é a regra completa.

### 3. Habilitação VAAT ajuda, mas não fecha a fórmula

Quase todos os municípios analisados estavam `habilitados para o cálculo do VAAT`.

Caso relevante:

- `Cabo Frio` estava `inabilitado` por pendência no `SIOPE`
- mesmo assim o relatório comercial mostra razão alta: `1,7668`

Isso sugere que o relatório legado trabalha com `potencial projetado após regularização`, e não apenas com a fotografia formal do ente.

### 4. O indicador mais promissor foi FUNDEB per capita

Comparando grupos:

- municípios de razão comercial `baixa` (`< 1,40`) tiveram média de `FUNDEB per capita` de `R$ 588,93`
- municípios de razão comercial `alta` (`>= 1,70`) tiveram média de `FUNDEB per capita` de `R$ 1.023,80`

Isso não prova causalidade, mas é o primeiro sinal quantitativo mais consistente.

### 5. A dependência do FUNDEB sobre a receita municipal também parece influenciar

Médias observadas:

- grupo de razão `baixa`: `FUNDEB = 23,11%` da receita bruta municipal
- grupo de razão `alta`: `FUNDEB = 17,29%` da receita bruta municipal

Leitura possível:

- quando o município já depende muito do FUNDEB, o relatório comercial pode estar usando projeção mais conservadora
- quando o município tem mais base arrecadatória relativa, o comercial parece aceitar alavancas maiores

## Tabela-resumo

| Município | Razão comercial | Habilitação VAAT | VAAT % do total | FUNDEB per capita | FUNDEB / Receita municipal |
|---|---:|---|---:|---:|---:|
| Belford Roxo | 1,2518 | Habilitado | 16,31% | R$ 687,71 | 28,51% |
| São João de Meriti | 1,2862 | Habilitado | 8,66% | R$ 490,15 | 17,71% |
| Cabo Frio | 1,7668 | Inabilitado SIOPE | 0,00% | R$ 922,43 | 14,38% |
| Duque de Caxias | 1,8700 | Habilitado | 0,00% | R$ 658,55 | 10,17% |
| Guapimirim | 1,7483 | Habilitado | 0,00% | R$ 1.126,03 | 12,74% |
| Itaguaí | 1,7232 | Habilitado | 0,00% | R$ 1.155,62 | 13,36% |
| Magé | 1,8211 | Habilitado | 13,03% | R$ 1.335,05 | 27,26% |
| Nova Iguaçu | 1,7800 | Habilitado | 13,71% | R$ 625,03 | 19,40% |
| Petrópolis | 1,6832 | Habilitado | 0,00% | R$ 876,74 | 13,74% |
| Seropédica | 1,7088 | Habilitado | 3,66% | R$ 1.173,80 | 20,65% |
| Tanguá | 1,7149 | Habilitado | 9,38% | R$ 1.334,04 | 19,97% |
| Teresópolis | 1,7777 | Habilitado | 0,00% | R$ 883,68 | 17,65% |

## Conclusão desta rodada

O padrão comercial antigo parece depender de uma combinação de fatores, e não de uma fórmula única:

1. `FUNDEB per capita`
2. `VAAT oficial`
3. `habilitação / pendência SIOPE`
4. `peso do FUNDEB na receita total do município`

## Próxima rodada recomendada

Para aproximar de vez a lógica comercial, falta cruzar:

1. `matrículas totais da rede municipal`
2. `matrículas de creche e pré-escola`
3. `Indicador de Educação Infantil (IEI)` em base estruturada
4. se possível, alguma variável de `rede municipal própria` versus atendimento total

Esses dados são os candidatos mais fortes para explicar por que municípios com VAAT parecido recebem multiplicadores comerciais tão diferentes.
