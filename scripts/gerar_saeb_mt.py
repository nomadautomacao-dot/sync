#!/usr/bin/env python3
"""
Gera PDF consolidado de IDEB + SAEB (Português/Matemática) para todos os municípios de Mato Grosso.
Combina:
  - ideb-municipal-2023.json (IDEB histórico)
  - saeb_2021_municipios.xlsx (Proficiências + Níveis de Aprendizagem)
"""
import json
import os
from pathlib import Path
from datetime import datetime

import openpyxl
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# ============ CONFIGURAÇÃO ============
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "relatorios_saeb"
OUTPUT_DIR.mkdir(exist_ok=True)

SAEB_FILE = Path("/tmp/saeb_2021_municipios.xlsx")
IDEB_FILE = DATA_DIR / "ideb-municipal-2023.json"
CENSO_FILE = DATA_DIR / "inep-censo-municipal-2025.json"

# Código UF do Mato Grosso
CO_UF_MT = 51

# ============ LEITURA DE DADOS ============

def load_saeb_municipios():
    """Lê planilha SAEB e retorna dict: cod_municipio -> {dependencia -> dados}"""
    wb = openpyxl.load_workbook(str(SAEB_FILE), read_only=True, data_only=True)
    ws = wb['Municípios']
    
    # Lê cabeçalho
    rows = list(ws.iter_rows(values_only=True))
    headers = rows[0]  # linha 0: nomes técnicos (ANO_SAEB, CO_UF, etc.)
    
    data = {}
    for row in rows[2:]:  # Pula header + descrição
        if row is None or len(row) < 14:
            continue
        
        ano = row[0]
        cod_uf = row[1]
        uf = row[2]
        cod_mun = row[3]
        nome_mun = row[4]
        dep = row[5]  # 'Municipal', 'Estadual', 'Total - ...'
        loc = row[6]  # 'Total', 'Urbana', 'Rural'
        
        # Só interessa MT + rede Municipal + localização Total
        if cod_uf != CO_UF_MT or dep != 'Municipal' or loc != 'Total':
            continue
        
        # Colunas de interesse para Anos Iniciais (5º ano)
        media_5_lp = row[7] if len(row) > 7 else None  # MEDIA_5_LP
        media_5_mt = row[8] if len(row) > 8 else None  # MEDIA_5_MT
        
        # Colunas de interesse para Anos Finais (9º ano)
        media_9_lp = row[9] if len(row) > 9 else None  # MEDIA_9_LP
        media_9_mt = row[10] if len(row) > 10 else None  # MEDIA_9_MT
        
        # Níveis de Aprendizagem Português 5º ano (colunas 13..22 = nivel_0_LP5 a nivel_9_LP5)
        # Níveis Matemática 5º ano (colunas 23..33)
        # Níveis Português 9º ano (colunas 34..43)
        # Níveis Matemática 9º ano (colunas 44..53)
        
        nivel_lp5_start = 13
        nivel_mt5_start = 23
        nivel_lp9_start = 34
        nivel_mt9_start = 44
        
        # % de alunos nos níveis suficientes (nível 5+) - indicador de aprendizagem adequada
        # Para Anos Iniciais (5º ano): nível 5+ em LP e MT
        niveis_lp5 = [row[nivel_lp5_start + i] if len(row) > nivel_lp5_start + i else 0 for i in range(10)]
        niveis_mt5 = [row[nivel_mt5_start + i] if len(row) > nivel_mt5_start + i else 0 for i in range(11)]
        
        niveis_lp9 = [row[nivel_lp9_start + i] if len(row) > nivel_lp9_start + i else 0 for i in range(9)]
        niveis_mt9 = [row[nivel_mt9_start + i] if len(row) > nivel_mt9_start + i else 0 for i in range(10)]
        
        # Calcula percentual de alunos em nível SUFICIENTE de aprendizagem
        # Para SAEB: nível 5+ = adequado, nível 8+ = avançado
        # Anos Iniciais - LP: nível 0-4 insuficiente; nível 5+ adequado; nível 8+ avançado
        lp5_total = sum(x for x in niveis_lp5 if x is not None)
        lp5_avancado = sum(x for x in niveis_lp5[8:] if x is not None)
        lp5_suficiente = sum(x for x in niveis_lp5[5:] if x is not None)
        
        mt5_total = sum(x for x in niveis_mt5 if x is not None)
        mt5_avancado = sum(x for x in niveis_mt5[9:] if x is not None)
        mt5_suficiente = sum(x for x in niveis_mt5[6:] if x is not None)
        
        lp9_total = sum(x for x in niveis_lp9 if x is not None)
        lp9_avancado = sum(x for x in niveis_lp9[8:] if x is not None)
        lp9_suficiente = sum(x for x in niveis_lp9[5:] if x is not None)
        
        mt9_total = sum(x for x in niveis_mt9 if x is not None)
        mt9_avancado = sum(x for x in niveis_mt9[9:] if x is not None)
        mt9_suficiente = sum(x for x in niveis_mt9[6:] if x is not None)
        
        def safe_pct(num, den):
            if not den or den == 0 or num is None:
                return None
            return round(num * 100.0 / den, 1)
        
        cod_key = str(cod_mun).zfill(7) if cod_mun else None
        if not cod_key:
            continue
        
        data[cod_key] = {
            'nome': nome_mun,
            'ano_saeb': int(ano) if ano else None,
            'media_5_lp': media_5_lp,
            'media_5_mt': media_5_mt,
            'media_9_lp': media_9_lp,
            'media_9_mt': media_9_mt,
            # Percentuais
            'lp5_avancado': safe_pct(lp5_avancado, lp5_total),
            'lp5_suficiente': safe_pct(lp5_suficiente, lp5_total),
            'mt5_avancado': safe_pct(mt5_avancado, mt5_total),
            'mt5_suficiente': safe_pct(mt5_suficiente, mt5_total),
            'lp9_avancado': safe_pct(lp9_avancado, lp9_total),
            'lp9_suficiente': safe_pct(lp9_suficiente, lp9_total),
            'mt9_avancado': safe_pct(mt9_avancado, mt9_total),
            'mt9_suficiente': safe_pct(mt9_suficiente, mt9_total),
        }
    
    wb.close()
    return data


def load_ideb():
    """Lê dataset IDEB 2023"""
    with open(IDEB_FILE) as f:
        return json.load(f)


def load_censo():
    """Lê dados do Censo (matrículas, escolas)"""
    try:
        with open(CENSO_FILE) as f:
            return json.load(f)
    except:
        return {}


# ============ GERAÇÃO PDF ============

def fmt_num(v, decimals=1):
    if v is None:
        return '-'
    try:
        return f"{float(v):.{decimals}f}"
    except:
        return '-'

def fmt_pct(v):
    if v is None:
        return '-'
    return f"{v:.1f}%"

def build_pdf(mt_data):
    output_file = OUTPUT_DIR / "IDEB_SAEB_MATO_GROSSO_2023.pdf"
    
    doc = SimpleDocTemplate(
        str(output_file),
        pagesize=landscape(A4),
        leftMargin=1*cm, rightMargin=1*cm,
        topMargin=1.5*cm, bottomMargin=1.5*cm
    )
    
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        'TitleCustom', parent=styles['Title'],
        fontSize=18, spaceAfter=6, textColor=colors.HexColor('#004D61'),
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        'SubtitleCustom', parent=styles['Normal'],
        fontSize=10, spaceAfter=12, textColor=colors.HexColor('#555555'),
        alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        'SmallHeader', parent=styles['Normal'],
        fontSize=7, textColor=colors.white, alignment=TA_CENTER,
        fontName='Helvetica-Bold', leading=8
    ))
    styles.add(ParagraphStyle(
        'SmallCell', parent=styles['Normal'],
        fontSize=7, alignment=TA_CENTER, leading=9
    ))
    styles.add(ParagraphStyle(
        'SmallCellLeft', parent=styles['Normal'],
        fontSize=7, alignment=TA_LEFT, leading=9
    ))
    
    elements = []
    
    # ============ CAPA ============
    elements.append(Spacer(1, 4*cm))
    elements.append(Paragraph(
        'Resultados IDEB & SAEB<br/>Mato Grosso — Todos os Municípios',
        styles['TitleCustom']
    ))
    elements.append(Paragraph(
        f'Análise consolidada • Dados IDEB 2023 (série histórica) • Proficiências SAEB 2021 • Níveis de Aprendizagem',
        styles['SubtitleCustom']
    ))
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph(
        'Gerado por Rocha Prime Consultorias em ' + datetime.now().strftime('%d/%m/%Y %H:%M'),
        styles['SubtitleCustom']
    ))
    elements.append(Spacer(1, 0.5*cm))
    
    # Info box
    info_data = [
        ['UF', 'Mato Grosso'],
        ['Região', 'Centro-Oeste'],
        ['Municípios', str(len(mt_data))],
        ['IDEB', 'Série histórica 2005-2023 (Anos Iniciais e Finais)'],
        ['SAEB', 'Edição 2021 - Proficiências em Língua Portuguesa e Matemática'],
        ['Rede', 'Municipal (todos os municípios)'],
    ]
    info_table = Table(info_data, colWidths=[4*cm, 12*cm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#004D61')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F0F8FF')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#B0C4DE')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)
    elements.append(PageBreak())
    
    # ============ CABEÇALHO PRINCIPAL ============
    elements.append(Paragraph(
        'Panorama Geral: IDEB 2023 + Proficiências SAEB 2021 (Rede Municipal)',
        styles['Heading2']
    ))
    elements.append(Spacer(1, 0.2*cm))
    
    # Header com 2 linhas
    header = [
        [
            Paragraph('Município', styles['SmallHeader']),
            Paragraph('IDEB 2023<br/>Iniciais', styles['SmallHeader']),
            Paragraph('IDEB 2023<br/>Finais', styles['SmallHeader']),
            Paragraph('IDEB 2021<br/>Iniciais', styles['SmallHeader']),
            Paragraph('IDEB 2021<br/>Finais', styles['SmallHeader']),
            Paragraph('Port. 5º ano<br/>(média)', styles['SmallHeader']),
            Paragraph('Mat. 5º ano<br/>(média)', styles['SmallHeader']),
            Paragraph('Port. 9º ano<br/>(média)', styles['SmallHeader']),
            Paragraph('Mat. 9º ano<br/>(média)', styles['SmallHeader']),
            Paragraph('Port. 5º<br/>Adequado', styles['SmallHeader']),
            Paragraph('Mat. 5º<br/>Adequado', styles['SmallHeader']),
            Paragraph('Port. 9º<br/>Adequado', styles['SmallHeader']),
            Paragraph('Mat. 9º<br/>Adequado', styles['SmallHeader']),
        ]
    ]
    
    col_widths = [4.5*cm, 2*cm, 2*cm, 2*cm, 2*cm, 2.2*cm, 2.2*cm, 2.2*cm, 2.2*cm, 2*cm, 2*cm, 2*cm, 2*cm]
    
    rows = []
    # Ordena por município
    mt_sorted = sorted(mt_data.items(), key=lambda x: x[1]['nome'])
    
    for idx, (cod, m) in enumerate(mt_sorted):
        ideb_entry = m.get('ideb') or {}
        saeb_entry = m.get('saeb') or {}
        
        # IDEB 2023
        hist_ai = ideb_entry.get('historicoAnosIniciais', [])
        hist_af = ideb_entry.get('historicoAnosFinais', [])
        ideb_2023_ai = None
        ideb_2023_af = None
        ideb_2021_ai = None
        ideb_2021_af = None
        for h in hist_ai:
            if h.get('ano') == 2023:
                ideb_2023_ai = h.get('idebObservado')
            if h.get('ano') == 2021:
                ideb_2021_ai = h.get('idebObservado')
        for h in hist_af:
            if h.get('ano') == 2023:
                ideb_2023_af = h.get('idebObservado')
            if h.get('ano') == 2021:
                ideb_2021_af = h.get('idebObservado')
        
        row = [
            Paragraph(m['nome'], styles['SmallCellLeft']),
            Paragraph(fmt_num(ideb_2023_ai), styles['SmallCell']),
            Paragraph(fmt_num(ideb_2023_af), styles['SmallCell']),
            Paragraph(fmt_num(ideb_2021_ai), styles['SmallCell']),
            Paragraph(fmt_num(ideb_2021_af), styles['SmallCell']),
            Paragraph(fmt_num(saeb_entry.get('media_5_lp')), styles['SmallCell']),
            Paragraph(fmt_num(saeb_entry.get('media_5_mt')), styles['SmallCell']),
            Paragraph(fmt_num(saeb_entry.get('media_9_lp')), styles['SmallCell']),
            Paragraph(fmt_num(saeb_entry.get('media_9_mt')), styles['SmallCell']),
            Paragraph(fmt_pct(saeb_entry.get('lp5_suficiente')), styles['SmallCell']),
            Paragraph(fmt_pct(saeb_entry.get('mt5_suficiente')), styles['SmallCell']),
            Paragraph(fmt_pct(saeb_entry.get('lp9_suficiente')), styles['SmallCell']),
            Paragraph(fmt_pct(saeb_entry.get('mt9_suficiente')), styles['SmallCell']),
        ]
        rows.append(row)
    
    all_rows = header + rows
    
    tbl = Table(all_rows, colWidths=col_widths, repeatRows=1)
    
    style_commands = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#004D61')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#CCCCCC')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]
    # Zebra stripes
    for i in range(1, len(all_rows)):
        if i % 2 == 0:
            style_commands.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#F5F9FC')))
    
    tbl.setStyle(TableStyle(style_commands))
    elements.append(tbl)
    
    elements.append(Spacer(1, 0.4*cm))
    elements.append(Paragraph(
        '<i><b>Fontes:</b> IDEB 2023 - INEP/MEC; Proficiências SAEB 2021 - INEP. '
        '"Adequado" = percentual de alunos em nível 5+ na escala SAEB (considerado aprendizagem adequada para o ano). '
        'Dados referentes à rede municipal de ensino, localização total.</i>',
        ParagraphStyle('Legend', parent=styles['Normal'], fontSize=7, textColor=colors.grey)
    ))
    
    doc.build(elements)
    
    print(f'\n✅ PDF gerado: {output_file}')
    print(f'   Tamanho: {output_file.stat().st_size / 1024:.1f} KB')
    print(f'   Municípios incluídos: {len(mt_sorted)}')
    return output_file


# ============ MAIN ============

def main():
    print('📊 Carregando dados IDEB...')
    ideb_data = load_ideb()
    
    print('📊 Carregando dados Censo Escolar 2025...')
    censo_data = load_censo()
    
    print('📊 Carregando dados SAEB 2021 (planilha INEP)...')
    saeb_data = load_saeb_municipios()
    print(f'   {len(saeb_data)} registros de SAEB encontrados para MT (rede municipal)')
    
    # Combina em estrutura única (usa o Censo como referência de municípios)
    mt_municipios = {}
    for cod, info in censo_data.items():
        if info.get('uf') == 'Mato Grosso' and not cod.startswith('5105'):  # exclui entradas inválidas se houver
            mt_municipios[cod] = {
                'nome': info.get('municipio', cod),
                'ideb': ideb_data.get(cod, {}),
                'saeb': saeb_data.get(cod, {}),
                'escolas_publicas': info.get('escolasPublicasTotal', 0),
            }
    
    print(f'   {len(mt_municipios)} municípios de MT no dataset Censo')
    
    print('📄 Gerando PDF consolidado...')
    output = build_pdf(mt_municipios)
    
    # Estatísticas rápidas
    print('\n📈 Resumo MT:')
    saeb_lp5_validos = [m for m in mt_municipios.values() if m['saeb'].get('media_5_lp')]
    if saeb_lp5_validos:
        avg_lp5 = sum(m['saeb']['media_5_lp'] for m in saeb_lp5_validos) / len(saeb_lp5_validos)
        print(f'   Média LP 5º ano (SAEB): {avg_lp5:.1f}')

if __name__ == '__main__':
    main()
