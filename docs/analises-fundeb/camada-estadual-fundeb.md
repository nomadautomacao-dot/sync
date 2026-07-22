# Camada Estadual do Modelo FUNDEB

Data: 19/03/2026

## Objetivo

Separar no sistema o que e:

- variavel oficial do Fundeb
- proxy analitica interna
- ajuste comercial calibrado

## Implementacao

Arquivos principais:

- [fundeb-state-layer.ts](/C:/Users/Adrie/Desktop/Sync/core/lib/fundeb-state-layer.ts)
- [calculos.ts](/C:/Users/Adrie/Desktop/Sync/modules/levantamento-fundeb/utils/calculos.ts)
- [fundeb-commercial.ts](/C:/Users/Adrie/Desktop/Sync/core/lib/fundeb-commercial.ts)

## Variaveis oficiais consideradas

- fundo estadual da UF (`27 fundos do Fundeb`)
- receita total oficial por ente
- `VAAF` e redistribuicao intraestadual
- `VAAT` oficial do ente
- condicionalidade IV do `VAAR`, ligada ao `ICMS-Educacao` estadual

## Proxies analiticas consideradas

- `FUNDEB per capita`
- matriculas municipais por habitante
- educacao infantil por habitante
- creche por habitante
- dependencia do fundo sobre a receita bruta municipal

## Ajustes comerciais

- regimes municipais calibrados por perfil
- comparacao com amostra historica validada
- ajuste residual por UF apenas quando a amostra estadual for estatisticamente estavel

## Estado atual

- `RJ`: amostra suficiente, mas residuo medio muito baixo; ajuste estadual nao ativado
- `GO`: amostra inicial disponivel, mas dispersao alta; ajuste estadual nao ativado
- `SC`: amostra insuficiente; ajuste estadual nao ativado

## Regra de seguranca

O sistema so aplica correcao automatica por UF quando houver:

- amostra minima razoavel
- residuo medio relevante
- dispersao historica baixa

Enquanto isso nao ocorre, a camada estadual entra como contexto e explicacao, nao como distorcao do multiplicador.
