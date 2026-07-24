# Kit Padrão PDF Global Sync

Esta pasta contém apenas a parte reutilizável do padrão visual dos PDFs.

## Conteúdo

- `report_style_pdf.py`
  Núcleo visual reutilizável com:
  - paleta de cores
  - fontes
  - cabeçalho
  - rodapé
  - títulos de seção
  - tabelas
  - caixas de destaque
  - helpers de texto e formatação

- `assets/`
  Arquivos visuais usados pelo módulo.

- `requirements.txt`
  Dependências mínimas para o gerador.

## Como usar no outro projeto

1. Copie a pasta `kit_padrao_pdf_rocha_prime` para dentro do outro sistema.
2. Instale as dependências de `requirements.txt`.
3. Importe o módulo:

```python
from kit_padrao_pdf_rocha_prime.report_style_pdf import (
    PAGE_W,
    PAGE_H,
    MARGIN_X,
    draw_header,
    draw_footer,
    draw_section_title,
    draw_kv_table,
    draw_highlight_box,
    draw_paragraph,
    draw_cover,
    fmt_money,
    fmt_int,
    register_fonts,
)
```

4. Monte o PDF usando apenas o conteúdo específico do projeto.

## Observação

Esse kit foi separado para reaproveitamento. Os geradores específicos de Poções continuam fora desta pasta.
