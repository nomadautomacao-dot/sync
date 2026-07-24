# Especificação de Implementação

## Relatório

Análise Comparativa Fundeb 2025-2026 por município.

Arquivo de referência visual:
- `Analise_Fundeb_Pocoes_2025_2026.pdf`

Gerador de referência:
- `build_pocoes_fundeb_comparison.py`

## Objetivo

Gerar um PDF técnico-executivo curto, com leitura comparativa entre dois exercícios, para demonstrar:
- evolução de receita Fundeb
- mudança no perfil das matrículas
- leitura da rede educacional
- espaço de atuação técnica da Global Sync

## Saída esperada

- PDF em `A4 retrato`
- Estilo visual Global Sync
- Arquivo final com `3 páginas`

## Entradas obrigatórias

### Identificação

- `municipio_nome`
- `uf`
- `ano_base_1`
- `ano_base_2`

### Receitas Fundeb comparativas

Lista com:
- `componente`
- `valor_ano_1`
- `valor_ano_2`

Campos mínimos esperados:
- contribuição ao Fundeb
- VAAF
- VAAT
- VAAR
- total

### Matrículas comparativas

Lista com:
- `etapa_modalidade`
- `valor_ano_1`
- `valor_ano_2`

Campos mínimos esperados:
- creche integral
- creche parcial
- pré-escola integral
- pré-escola parcial
- fundamental integral
- anos iniciais parcial
- anos finais parcial
- EJA
- educação especial
- AEE
- matrícula total

### Snapshot QEdu / Censo Escolar

Lista com:
- `indicador`
- `valor`

Campos mínimos esperados:
- escolas
- docentes
- creche
- pré-escola
- anos iniciais
- anos finais
- ensino médio
- EJA
- educação especial
- total QEdu

### Textos analíticos

- `texto_sintese`
- `texto_qedu`
- `texto_bloco_prova`
- `texto_movimentos_relevantes`
- `texto_como_rocha_prime_entra`
- `texto_conclusao`

## Campos derivados

O sistema deve calcular:
- `variacao_percentual_receita`
- `variacao_absoluta_receita_total`
- `delta_matriculas`
- destaque de variação positiva com `+`

Regras:
- se o valor base for `0`, a variação percentual deve virar `-`
- valores monetários devem sair formatados em padrão brasileiro
- total de receita deve alimentar o box principal da página 2

## Estrutura de páginas

### Página 1

Capa:
- análise comparativa
- Fundeb 2025-2026
- município e UF
- subtítulo com base oficial / QEdu

### Página 2

Síntese do levantamento:
- texto introdutório
- box de destaque do ganho total no período
- tabela de receitas comparativas
- seção QEdu / Censo Escolar
- tabela QEdu
- pequeno box de interpretação

### Página 3

Matrículas consideradas:
- tabela comparativa 2025 x 2026

Leitura geral:
- card “Movimentos relevantes”
- card “Como a Global Sync entra”
- conclusão final

## Componentes visuais necessários

O outro sistema deve conseguir reutilizar ou reproduzir:
- `draw_cover`
- `draw_header`
- `draw_footer`
- `draw_section_title`
- `draw_kv_table`
- `draw_highlight_box`
- `draw_paragraph`
- `round_rect`

Base atual de estilo:
- `kit_padrao_pdf_rocha_prime/report_style_pdf.py`

## Regras de negócio

- A narrativa deve falar apenas do município atual.
- Não pode haver menção fixa a outro município em texto padrão.
- A linha `TOTAL` deve receber destaque visual.
- Colunas numéricas devem ficar centralizadas quando o layout pedir leitura comparativa.
- Variações positivas devem aparecer em verde.
- O box de ganho total deve usar a diferença entre total do ano 2 e total do ano 1.

## Regras visuais

- formato A4 retrato
- header institucional fixo
- espaçamento consistente entre seções
- destaque verde claro para ganho de receita
- cards azul claro / verde claro na página final
- tabelas com linhas alternadas suaves
- primeira coluna textual alinhada à esquerda
- colunas numéricas comparativas centralizadas

## Dependências técnicas

- `reportlab`
- `Pillow`

## Checklist de implementação no outro sistema

1. Incluir a pasta `kit_padrao_pdf_rocha_prime`.
2. Mapear as tabelas de receita e matrículas para os campos obrigatórios.
3. Implementar cálculos de variação antes de desenhar o PDF.
4. Injetar os textos analíticos por município.
5. Validar se a tabela cabe sem quebra em A4.
6. Testar município com `VAAR = 0`.
7. Testar município com crescimento e com queda em matrícula.

## Observação prática

Esse relatório é mais técnico do que a apresentação executiva. Ele precisa sustentar a conversa comercial com base objetiva, então os cálculos e a coerência entre tabelas são prioridade.
