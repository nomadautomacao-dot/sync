# Especificação de Implementação

## Relatório

Apresentação Executiva Global Sync para município Fundeb.

Arquivo de referência visual:
- `Apresentacao_Rocha_Prime_Pocoes_2026.pdf`

Gerador de referência:
- `build_presentation_pdf.py`

## Objetivo

Gerar um PDF em formato apresentação executiva para reunião com gestor, com foco comercial e técnico ao mesmo tempo.

O documento precisa responder:
- o que a Global Sync faz
- por que o município é relevante
- qual a oportunidade financeira/técnica
- como funciona a metodologia
- quais os próximos passos

## Saída esperada

- PDF em formato `16:9`
- Dimensão de página usada no gerador atual: `960 x 540`
- Estilo visual Global Sync
- Arquivo final com `7 páginas`

## Entradas obrigatórias

### Identificação

- `municipio_nome`
- `uf`
- `exercicio`
- `data_material`

### Dados da rede educacional

- `qedu_escolas`
- `qedu_matriculas_totais`
- `qedu_docentes`
- `qedu_creche`
- `qedu_pre_escola`
- `qedu_anos_iniciais`
- `qedu_anos_finais`
- `qedu_ensino_medio`
- `qedu_eja`
- `qedu_educacao_especial`

### Situação operacional / sistemas

Lista com:
- `instituicao`
- `sistema`
- `situacao`

### Receita Fundeb 2026

Lista com:
- `componente`
- `valor_previsto`
- `percentual_total`

Campos mínimos esperados:
- contribuição municipal
- VAAF
- VAAT
- VAAR
- total geral

### Projeção Global Sync

Lista com:
- `componente`
- `valor_atual`
- `valor_projetado`
- `ganho`

Campos mínimos esperados:
- VAAF
- VAAT
- VAAR
- total geral

### Texto institucional

- `carta_apresentacao`
- `texto_importancia_municipio`
- `texto_leitura_rocha_prime`
- `texto_oportunidade_final`

### Contato / branding

- `empresa_nome`
- `cnpj`
- `telefone`
- `email`
- `logo_principal`

## Entradas opcionais

- `status_confidencial`
- `fonte_dados`
- `subtitulo_personalizado`
- `rodape_personalizado`

## Estrutura de páginas

### Página 1

Capa com:
- título principal
- subtítulo
- município
- exercício
- identidade Global Sync

### Página 2

Carta de apresentação:
- bloco grande de introdução
- foco em narrativa executiva

### Página 3

Nossa atuação:
- 4 cards
- levantamento
- cruzamento técnico
- correções e saneamento
- monitoramento estratégico

Bloco final:
- por que isso importa no município

### Página 4

Base técnica do caso:
- tabela QEdu
- tabela de sistemas/habilitação
- box “Leitura Global Sync”

### Página 5

Análise financeira:
- tabela de receitas previstas
- tabela de projeção Global Sync
- box final de ganho potencial total

### Página 6

Metodologia e diferenciais:
- 4 passos metodológicos
- lista de diferenciais

### Página 7

Encaminhamento:
- 3 próximos passos
- card de contato
- mensagem final executiva

## Componentes visuais necessários

O outro sistema deve conseguir reutilizar ou reproduzir:
- `header`
- `footer`
- `cover_page`
- `section_title`
- `simple_table`
- `round_rect`
- `paragraph helper`

Base atual de estilo:
- `kit_padrao_pdf/report_style_pdf.py`

## Regras de negócio

- Linha de total deve receber destaque visual.
- Ganhos positivos devem aparecer em verde.
- Se `VAAR = 0`, manter exibição explícita como `R$ 0,00`.
- O valor total projetado deve ser destacado em bloco próprio.
- O texto precisa poder ser parametrizado por município.
- O relatório não pode depender de Poções fixo em código.

## Regras visuais

- manter identidade Global Sync
- fundo branco
- cabeçalho com logo, nome da empresa, contato e selo confidencial
- linha horizontal forte abaixo do header
- azul institucional como cor principal
- verde apenas para ganhos e destaques positivos
- tabelas com cabeçalho navy e linhas alternadas suaves
- cards com bordas arredondadas

## Dependências técnicas

- `reportlab`
- `Pillow`
- opcional para otimização/render de preview: `PyMuPDF`

## Checklist de implementação no outro sistema

1. Incluir a pasta `kit_padrao_pdf`.
2. Mapear os dados do município para o payload acima.
3. Criar um gerador específico do relatório consumindo o kit visual.
4. Parametrizar textos e listas em vez de fixar conteúdo em código.
5. Validar paginação para municípios com textos maiores.
6. Testar geração com município sem VAAR e com valores zerados.

## Observação prática

Esse relatório é mais comercial do que técnico. O layout pode ser o mesmo, mas os textos precisam ser curtos, diretos e orientados a decisão.
