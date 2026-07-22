# Roadmap de Autonomia: Relatorios FUNDEB Rocha Prime

Este documento detalha o que faltava para atingir autonomia operacional no levantamento FUNDEB e o estado atual do modulo.

---

## 1. Modulo SIMEC: Monitoramento de Obras Publicas
**Objetivo:** integrar a camada de obras e repactuacao do MEC/FNDE para diagnostico comercial e tecnico.

**Status atual:** **Concluido na camada publica.**
- `core/lib/fnde-obras.ts` consolida fontes abertas do FNDE para pacto de retomada e infraestrutura.
- `core/lib/simec-obras.ts` expone `getSimecObrasRecord(codigoIBGE)`.
- `core/lib/govia-compat.ts` passou a publicar `payload.simec_obras_publicas` com `situacao`, `total_obras`, `valor_estimado_repactuacao`, `valor_pago_infraestrutura`, `obras_pac2`, `fontes` e `observacoes`.

**Pendente:** apenas a camada autenticada do SIMEC, se houver necessidade real de ir alem da leitura publica.

## 2. Modulo QEdu: Indicadores de Proficiencia e Qualidade
**Objetivo:** expor indicadores de aprendizagem, IDEB e distorcao idade-serie sem depender de preenchimento manual.

**Status atual:** **Concluido com fallback oficial do INEP.**
- `core/lib/qedu-indicators.ts` foi criado.
- O modulo usa a divulgacao municipal oficial do INEP 2023 para anos iniciais e finais.
- O Sync agora entrega:
  - `IDEB observado`
  - `taxa de aprovacao`
  - `nota de Portugues`
  - `nota de Matematica`
  - `nota media`
  - `distorcao idade-serie`
- A integracao entrou no `govia-compat.ts` e no `fundeb-comparative.ts`, inclusive no `qeduSnapshot` do PDF comparativo.

**Observacao:** o scraping direto do portal QEdu continua dispensavel enquanto a fonte oficial do INEP cobrir o recorte necessario.

## 3. Modulo Historico Financeiro: 2024, 2025 e 2026
**Objetivo:** suportar comparacao real entre receitas e matriculas do FUNDEB.

**Status atual:** **Concluido no Sync para analise comparativa.**
- Receitas oficiais de 2024 integradas a partir do PDF publico do FNDE.
- Receitas oficiais de 2025 integradas a partir da publicacao oficial do FNDE.
- Receitas oficiais de 2026 integradas a partir do CSV oficial.
- `govia-compat.ts` expone `historico_repasses` e `comparativo_fundeb`.
- O PDF `comparativa` recebe automaticamente `receitasComparativas`, `matriculasComparativas` e textos dinamicos.

## 4. Modulo Infraestrutura Escolar
**Objetivo:** mostrar gargalos fisicos da rede publica municipal no diagnostico.

**Status atual:** **Concluido no Sync para a rede publica consolidada.**
- `scripts/dados/build-inep-censo-municipal-dataset.py` funde sinopse municipal e microdados de escola `2023`, `2024` e `2025`.
- Os datasets `data/inep-censo-municipal-2023.json`, `2024` e `2025` incluem contagens e percentuais de:
  - agua potavel
  - esgoto
  - cozinha
  - internet
  - banda larga
  - laboratorios
  - quadra
  - alimentacao
  - acessibilidade
- `govia-compat.ts` expone essa camada em `payload.educacao.infraestrutura_rede_publica`.

## 5. Modulo Fiscal Complementar (SICONFI)
**Objetivo:** integrar saude fiscal oficial ao lado do diagnostico educacional.

**Status atual:** **Concluido na camada principal.**
- `core/lib/siconfi-fiscal.ts` foi criado.
- O modulo consome `DCA`, `RGF`, `RREO` e `extrato_entregas` diretamente do Tesouro Nacional.
- O payload agora entrega:
  - `situacao_lrf`
  - `RCL ajustada`
  - `despesa com pessoal`
  - `receita total realizada`
  - `receitas correntes realizadas`
  - `caixa e equivalentes`
  - `divida ativa tributaria`
  - `passivo circulante`
  - `passivo nao circulante`
  - `patrimonio liquido`
  - `resultado do exercicio`
  - metadados das entregas mais recentes

---

## O que ainda falta no modulo FUNDEB

- **[ ] Refresh autonomo do Historico Censo INEP**: falta uma CLI para baixar e regenerar os datasets `2023-2025` sem intervencao manual.
- **[ ] SIMEC autenticado**: opcional, apenas se o ganho pratico justificar sair da camada publica ja integrada.
- **[ ] Diagnostico de capacidade de endividamento**: a base fiscal oficial ja existe, mas ainda falta transformar isso em leitura automatica de margem para operacao de credito.

## Arquivos-Chave
- **Agregacao principal:** `core/lib/govia-compat.ts`
- **Comparativo/PDF:** `core/lib/fundeb-comparative.ts`
- **QEdu/INEP oficial:** `core/lib/qedu-indicators.ts`
- **Fiscal SICONFI:** `core/lib/siconfi-fiscal.ts`
- **SIMEC/FNDE publico:** `core/lib/simec-obras.ts`
- **Infraestrutura INEP:** `scripts/dados/build-inep-censo-municipal-dataset.py`
