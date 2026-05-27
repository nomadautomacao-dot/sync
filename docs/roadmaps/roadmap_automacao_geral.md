# Roadmap Geral de Autonomia Estrategica: Ecossistema Rocha Prime / Sync

Este documento expande a visao de automacao para alem do FUNDEB, mapeando os modulos necessarios para transformar o sistema em uma plataforma de inteligencia governamental autonoma.

---

## Status Consolidado

### Ja concluido nesta fase
- **[x] Geracao autonoma do Levantamento FUNDEB por codigo IBGE**: fluxo server-side fechado para montar o municipio, consolidar o relatorio e exportar PDF diretamente no Sync (`levantamento`, `executiva` e `comparativa`) sem depender de preview manual.
- **[x] Entrega autonoma inicial no modulo FUNDEB**: geracao on-demand de relatorio tecnico e pacote completo de PDFs a partir de codigo IBGE ou nome/UF.
- **[x] Historico financeiro oficial FUNDEB 2024-2026 para analise comparativa**: integracao das receitas oficiais de 2024, 2025 e 2026, com `historico_repasses` e `comparativo_fundeb` no payload.
- **[x] Comparativa automatica dentro do PDF**: o gerador `comparativa` agora recebe receitas comparativas, matriculas comparativas e textos automaticos a partir da serie oficial.
- **[x] Infraestrutura Escolar via microdados INEP (2023-2025)**: o dataset municipal consolidou agua potavel, esgoto, cozinha, internet, banda larga, laboratorios, quadra, alimentacao e acessibilidade da rede publica, com contagens e percentuais no payload do levantamento.
- **[x] Camada QEdu/INEP concluida com fallback oficial**: o Sync agora entrega `IDEB`, `taxa de aprovacao`, `notas de Portugues/Matematica` e `distorcao idade-serie` via divulgacao oficial do INEP 2023, sem depender do scraping direto do QEdu.
- **[x] SICONFI e fiscal completo na camada principal**: o payload agora integra `DCA`, `RGF` e `RREO`, com `situacao_lrf`, `RCL ajustada`, `despesa com pessoal`, `receita total realizada`, bloco patrimonial e metadados das entregas mais recentes do Tesouro.
- **[x] SIMEC / Obras Publicas na camada publica**: o levantamento passou a expor `simec_obras_publicas` com total de obras, valores estimados e fontes publicas do FNDE.
- **[x] Camada socioeconomica IBGE parcialmente ampliada**: integracao de `PIB per capita`, `IDHM`, `mortalidade infantil` e `area territorial` no enriquecimento municipal.

### Parcial / em aberto
- **[ ] SIMEC autenticado / detalhado**: a leitura publica de obras e repactuacao ja esta integrada; falta apenas a camada dependente de credencial do ente, se isso continuar fazendo sentido.
- **[ ] Historico Censo INEP com refresh autonomo**: os datasets `2023-2025` ja estao consolidados no Sync, mas ainda falta a CLI de download e regeneracao automatica.
- **[ ] Capacidade de endividamento**: o bloco fiscal ja traz base patrimonial e LRF, mas a leitura final de margem para operacao de credito ainda nao foi modelada como diagnostico fechado.

### Fora do escopo atual
- **[ ] Pilar 3 (Saude e Assistencia Social)**: removido da prioridade atual.
- **[ ] Pulse / historico de 5 anos**: retirado deste roadmap operacional.
- **[ ] Melissa / WhatsApp / Email**: retirados deste roadmap operacional.

---

## Pilar 1: Educacao
Finalizacao da camada de dados educacionais para relatorios de clique unico.

- **[x] Geracao autonoma do Levantamento FUNDEB por codigo IBGE**
- **[x] Historico financeiro FUNDEB 2024-2026 para comparativo**
- **[x] Infraestrutura Escolar**
- **[x] SIMEC Obras Publicas (camada publica)**: captura automatica de obras publicas, repactuacao e repasses de infraestrutura via fontes abertas do FNDE, exposta em `payload.simec_obras_publicas`.
  Status atual: concluido na camada publica; permanece opcional apenas a camada autenticada do SIMEC.
- **[x] QEdu Performance via INEP oficial**: extracao de `IDEB`, `aprovacao`, `proficiencia` e `distorcao idade-serie` por municipio.
  Status atual: concluido com fallback oficial do INEP 2023 em `core/lib/qedu-indicators.ts`, evitando dependencia do scraping fragil do portal QEdu.
- **[ ] Historico Censo INEP (refresh autonomo)**: os datasets `2023`, `2024` e `2025` ja estao carregados localmente e expostos em `core/lib/inep-censo.ts`, mas ainda falta a CLI de download e refresh.

## Pilar 2: Financas Globais
Automacao da saude fiscal completa do municipio, nao apenas educacao.

- **[x] Integracao SICONFI (Tesouro Nacional)**: extracao automatica de `DCA`, `RGF` e `RREO` na camada principal.
  Status atual: concluido em `core/lib/siconfi-fiscal.ts` e integrado ao `govia-compat.ts`.
- **[x] Limite de Gastos com Pessoal (LRF)**: calculo automatico da situacao de pessoal com base em `RCL ajustada`, `DTP` e limites de alerta/prudencial/maximo.
  Status atual: concluido no payload fiscal com `situacao_lrf` e espaco fiscal de pessoal.
- **[ ] Capacidade de Endividamento**: identificar automaticamente se a cidade tem margem para tomar emprestimos para grandes obras.
  Status atual: nao iniciado como diagnostico fechado, embora a base patrimonial oficial ja esteja integrada.

---

## Proximo Foco

1. **Historico Censo INEP (refresh autonomo)**: criar a CLI/download automatizado dos microdados e regeneracao dos datasets locais.
2. **Capacidade de Endividamento**: transformar a base patrimonial/SICONFI em diagnostico de margem para operacao de credito.
3. **SIMEC autenticado**: so subir se houver ganho real com credencial do ente alem da camada publica ja entregue.
4. **Pilar 2 fiscal expandido**: aprofundar anexos e indicadores fiscais complementares apos fechar o refresh do Core 01.

## Arquitetura Sugerida
- **Scrapers/Fetchers**: `core/lib/[servico].ts`
- **Agregador**: `core/lib/govia-compat.ts`
- **Storage**: SQL (Prisma) para dados historicos e JSON para caches rapidos
