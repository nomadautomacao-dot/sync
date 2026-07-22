# Validacao Dos Modelos De Relatorio FUNDEB

Data da analise: 17/03/2026

## Escopo

Foram analisados 16 PDFs modelo no formato `relatorio_*.pdf` da pasta `Downloads`, comparando:

- `total atual` do FUNDEB presente no PDF
- `total projetado` exibido no PDF
- resultado da formula hoje implementada no modulo
- resultado do fator global `1.7209`

Script utilizado:

```bash
npm run fundeb:analyze-models -- "C:\Users\Adrie\Downloads"
```

Arquivo do script:

- `scripts/pdf/analyze-fundeb-pdf-models.mjs`

## Formula Atual Do Modulo

Formula implementada hoje em `modules/levantamento-fundeb/utils/calculos.ts`:

```text
Se ha complementacao:
  totalProjetado = receitaMunicipal + VAAF*1.40 + VAAT*1.30 + VAAR*1.25

Se nao ha complementacao:
  totalProjetado = totalAtual * 1.7209
```

## Resultado Consolidado

- PDFs analisados: `16`
- erro medio absoluto da formula atual do modulo: `33,24%`
- erro medio absoluto do fator global `1.7209`: `6,87%`

Aderencia por faixa:

- ate `1%`: formula atual `1/16`, fator `1.7209` `5/16`
- ate `3%`: formula atual `2/16`, fator `1.7209` `9/16`
- ate `5%`: formula atual `2/16`, fator `1.7209` `11/16`
- ate `10%`: formula atual `2/16`, fator `1.7209` `14/16`

## Conclusoes

1. A formula atual do modulo nao reproduz os PDFs modelo.
2. O fator global `1.7209` aproxima muito melhor os relatorios legados do que a formula por componentes.
3. Mesmo assim, os PDFs modelo nao seguem um unico padrao consistente.
4. Existem relatorios em que os valores da tabela de componentes entram em conflito com o `total projetado` mostrado no proprio PDF.

## Casos Com Boa Aderencia Ao Fator 1.7209

- `MIRADOURO`: erro `+0,01%`
- `ITAGUAI`: erro `-0,14%`
- `BOM CONSELHO`: erro `+0,24%`
- `TANGUA`: erro `+0,35%`
- `SEROPEDICA`: erro `+0,71%`
- `GUAPIMIRIM`: erro `-1,57%`
- `BALNEARIO CAMBORIU`: erro `+2,40%`
- `PETROPOLIS`: erro `+2,24%`
- `CABO FRIO`: erro `-2,60%`

## Casos Que Fogem Do Fator 1.7209

- `BELFORD ROXO`: erro `+37,47%`
- `SAO JOAO DE MERITI`: erro `+33,80%`
- `CAMBORIU`: erro `+8,48%`
- `DUQUE DE CAXIAS`: erro `-7,97%`
- `MAGE`: erro `-5,50%`

## Inconsistencia Interna Dos PDFs Modelo

Exemplo critico: `BELFORD ROXO`

- total atual no PDF: `R$ 356.496.121,55`
- componentes projetados no PDF:
  - VAAF: `R$ 1.687.442,20`
  - VAAT: `R$ 75.598.335,10`
  - VAAR: `R$ 0,00`
  - receita municipal sem alteracao: `R$ 297.138.240,23`
- soma matematica desses componentes: `R$ 374.424.017,53`
- total projetado exibido no PDF: `R$ 446.261.557,22`

Ou seja: o proprio PDF mostra um `total projetado` que nao bate com a soma da tabela por componentes.

O mesmo comportamento aparece em outros municipios, especialmente nos casos com `VAAT` mais relevante.

## Leitura Tecnica

Hoje existem dois mundos diferentes:

- `formula tecnica documentada`: a que esta no `.md` e no modulo
- `modelo comercial legado`: o que os PDFs antigos efetivamente exibem

Esses dois mundos nao sao equivalentes.

## Recomendacao

1. Nao ajustar a formula do modulo apenas para “copiar” os PDFs antigos sem antes definir a regra oficial.
2. Separar explicitamente:
   - `modo tecnico`
   - `modo legado/comercial`
3. Se a meta for reproduzir os PDFs antigos, sera necessario descobrir a regra adicional usada nesses casos, porque ela nao esta explicita na tabela de componentes.
