#!/usr/bin/env python3
"""
Relatório PREMIUM: IDEB + SAEB + Censo para municípios de Mato Grosso
Formato: Uma página por município com gráficos de evolução e indicadores detalhados.
Identidade visual: Rocha Prime Consultorias
"""
import json
import os
from pathlib import Path
from datetime import datetime
import io

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np

import openpyxl

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm, inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, 
    PageBreak, Image, KeepTogether, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate, Frame

# ============ CONFIGURAÇÃO ============
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "relatorios_saeb"
OUTPUT_DIR.mkdir(exist_ok=True)

SAEB_FILE = Path('/tmp/saeb_2021_municipios.xlsx')
IDEB_FILE = DATA_DIR / 'ideb-municipal-2023.json'
CENSO_FILE = DATA_DIR / 'inep-censo-municipal-2025.json'
CO_UF_MT = 51

# Cores Rocha Prime
COR_PRIMARIA = colors.HexColor('#004D61')  # Azul escuro Rocha
COR_SECUNDARIA = colors.HexColor('#D4A017')  # Dourado
COR_DESTAQUE = colors.HexColor('#00A859')  # Verde sucesso
COR_VERMELHO = colors.HexColor('#DC143C')
COR_CINZA = colors.HexColor('#6B7280')
COR_BG_CLARO = colors.HexColor('#F0F8FF')
COR_BG_AZUL = colors.HexColor('#004D61')
COR_BG_DOURADO = colors.HexColor('#FFF8DC')

# ============ LEITURA DE DADOS ============

def load_censo():
    with open(CENSO_FILE) as f:
        return json.load(f)

def load_ideb():
    with open(IDEB_FILE) as f:
        return json.load(f)

def load_saeb():
    wb = openpyxl.load_workbook(str(SAEB_FILE), read_only=True, data_only=True)
    ws = wb['Municípios']
    rows = list(ws.iter_rows(values_only=True))
    
    data = {}
    for row in rows[2:]:
        if row is None or len(row) < 53:
            continue
        
        cod_uf = row[1]
        dep = row[5]
        loc = row[6]
        
        if cod_uf != CO_UF_MT or dep != 'Municipal' or loc != 'Total':
            continue
        
        cod_mun = str(row[3]).zfill(7) if row[3] else None
        if not cod_mun:
            continue
        
        def safe(val, default=None):
            if val is None or val == '' or val == '-':
                return default
            try:
                return float(val)
            except:
                return default
        
        # Médias
        media_5_lp = safe(row[7])
        media_5_mt = safe(row[8])
        media_9_lp = safe(row[9])
        media_9_mt = safe(row[10])
        
        # Níveis 5º ano LP (10 níveis, col 13..22)
        niveis_lp5 = [safe(row[13+i], 0) for i in range(10)]
        niveis_mt5 = [safe(row[23+i], 0) for i in range(11)]
        niveis_lp9 = [safe(row[34+i], 0) for i in range(9)]
        niveis_mt9 = [safe(row[44+i], 0) for i in range(10)]
        
        def sum_niveis(lista_niveis, inicio):
            """Soma % em níveis >= inicio"""
            total = sum(x for x in lista_niveis if x is not None)
            if total < 1 or total == 0:
                return None
            soma = sum(x for x in lista_niveis[inicio:] if x is not None)
            return round(soma * 100.0 / total, 1)
        
        data[cod_mun] = {
            'nome': row[4],
            'media_5_lp': media_5_lp,
            'media_5_mt': media_5_mt,
            'media_9_lp': media_9_lp,
            'media_9_mt': media_9_mt,
            'niveis_lp5': niveis_lp5,
            'niveis_mt5': niveis_mt5,
            'niveis_lp9': niveis_lp9,
            'niveis_mt9': niveis_mt9,
            # % Adequado (nível 5+)
            'lp5_adequado': sum_niveis(niveis_lp5, 5),
            'mt5_adequado': sum_niveis(niveis_mt5, 6),
            'lp9_adequado': sum_niveis(niveis_lp9, 5),
            'mt9_adequado': sum_niveis(niveis_mt9, 6),
            # % Avançado (nível 8+ LP, 9+ MT)
            'lp5_avancado': sum_niveis(niveis_lp5, 8),
            'mt5_avancado': sum_niveis(niveis_mt5, 9),
            'lp9_avancado': sum_niveis(niveis_lp9, 8),
            'mt9_avancado': sum_niveis(niveis_mt9, 9),
            # % Insuficiente (níveis baixos)
            'lp5_insuficiente': sum_niveis(niveis_lp5, 0) - sum_niveis(niveis_lp5, 5) if sum_niveis(niveis_lp5, 0) else None,
            'mt5_insuficiente': sum_niveis(niveis_mt5, 0) - sum_niveis(niveis_mt5, 6) if sum_niveis(niveis_mt5, 0) else None,
        }
    
    wb.close()
    return data


# ============ GERAÇÃO DE GRÁFICOS ============

def gerar_grafico_ideb(historico_ai, historico_af, output_path):
    """Gera gráfico de evolução IDEB"""
    fig, ax = plt.subplots(figsize=(9, 2.8))
    
    # Cores dos anos
    anos_ai = []
    valores_ai = []
    for h in historico_ai:
        if h.get('idebObservado') is not None:
            try:
                anos_ai.append(int(h.get('ano')))
                valores_ai.append(float(h['idebObservado']))
            except:
                pass
    
    anos_af = []
    valores_af = []
    for h in historico_af:
        if h.get('idebObservado') is not None:
            try:
                anos_af.append(int(h.get('ano')))
                valores_af.append(float(h['idebObservado']))
            except:
                pass
    
    if not anos_ai and not anos_af:
        plt.close(fig)
        return None
    
    # Plot
    if anos_ai:
        ax.plot(anos_ai, valores_ai, 'o-', color='#004D61', linewidth=2.5, 
                markersize=8, label='Anos Iniciais (1º-5º)', zorder=3)
        for x, y in zip(anos_ai, valores_ai):
            ax.annotate(f'{y:.1f}', (x, y), textcoords='offset points', 
                       xytext=(0, 8), ha='center', fontsize=8, color='#004D61', fontweight='bold')
    
    if anos_af:
        ax.plot(anos_af, valores_af, 's-', color='#D4A017', linewidth=2.5, 
                markersize=8, label='Anos Finais (6º-9º)', zorder=3)
        for x, y in zip(anos_af, valores_af):
            ax.annotate(f'{y:.1f}', (x, y), textcoords='offset points', 
                       xytext=(0, -14), ha='center', fontsize=8, color='#D4A017', fontweight='bold')
    
    # Linha de meta 6.0
    all_years = set(anos_ai + anos_af)
    if all_years:
        ax.axhline(y=6.0, color='#00A859', linestyle='--', linewidth=1.2, alpha=0.7, label='Meta PQE (6.0)')
        ax.set_xlim(min(all_years) - 0.5, max(all_years) + 1.5)
        ax.set_xticks(sorted(all_years))
        ax.set_xticklabels([str(y) for y in sorted(all_years)], fontsize=8, rotation=45, ha='right')
    
    # Estilização
    ax.set_ylabel('IDEB', fontsize=10, fontweight='bold', color='#333')
    ax.set_ylim(0, 8)
    ax.set_facecolor('#FAFAFA')
    ax.grid(True, alpha=0.3, linestyle='--')
    ax.legend(loc='upper left', fontsize=8, framealpha=0.95)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=180, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return output_path


def gerar_grafico_niveis(saeb_data, output_path):
    """Gera gráfico de níveis de aprendizagem (barras agrupadas LP + MT)"""
    fig, axes = plt.subplots(1, 2, figsize=(9, 2.8))
    
    # === Gráfico 5º ANO ===
    ax = axes[0]
    
    lp5 = saeb_data.get('niveis_lp5', [])
    mt5 = saeb_data.get('niveis_mt5', [])
    
    if lp5 and sum(x for x in lp5 if x):
        # Categorizar: Muito Baixo (0-1), Baixo (2-3), Intermediário (4), Adequado (5-6), Avançado (7+)
        lp5_cat = {
            'Muito\nBaixo': sum(lp5[:2] or [0, 0]),
            'Baixo': sum(lp5[2:4] or [0, 0]),
            'Interm.': sum(lp5[4:5] or [0]),
            'Adequado': sum(lp5[5:7] or [0, 0]),
            'Avançado': sum(lp5[7:] or [])
        }
        
        cores_barras = ['#DC143C', '#FF8C00', '#DAA520', '#00A859', '#004D61']
        valores = list(lp5_cat.values())
        labels = list(lp5_cat.keys())
        
        bars = ax.barh(labels[::-1], valores[::-1], color=cores_barras[::-1], height=0.6, edgecolor='white')
        ax.set_title('Língua Portuguesa - 5º Ano', fontsize=9, fontweight='bold', color='#004D61', loc='left')
        ax.set_xlim(0, max(valores) * 1.3 if valores else 30)
        ax.set_xlabel('% Alunos', fontsize=7)
        ax.tick_params(labelsize=7)
        
        for bar, val in zip(bars, valores[::-1]):
            if val > 1:
                ax.text(bar.get_width() + 0.3, bar.get_y() + bar.get_height()/2,
                       f'{val:.0f}%', va='center', fontsize=7, fontweight='bold')
    
    # === Gráfico 9º ANO ===
    ax = axes[1]
    
    lp9 = saeb_data.get('niveis_lp9', [])
    mt9 = saeb_data.get('niveis_mt9', [])
    
    if mt9 and sum(x for x in mt9 if x):
        mt9_cat = {
            'Muito\nBaixo': sum(mt9[:2] or [0, 0]),
            'Baixo': sum(mt9[2:4] or [0, 0]),
            'Interm.': sum(mt9[4:6] or [0, 0]),
            'Adequado': sum(mt9[6:8] or [0, 0]),
            'Avançado': sum(mt9[8:] or [])
        }
        
        cores_barras = ['#DC143C', '#FF8C00', '#DAA520', '#00A859', '#004D61']
        valores = list(mt9_cat.values())
        labels = list(mt9_cat.keys())
        
        bars = ax.barh(labels[::-1], valores[::-1], color=cores_barras[::-1], height=0.6, edgecolor='white')
        ax.set_title('Matemática - 9º Ano', fontsize=9, fontweight='bold', color='#004D61', loc='left')
        ax.set_xlim(0, max(valores) * 1.3 if valores else 30)
        ax.set_xlabel('% Alunos', fontsize=7)
        ax.tick_params(labelsize=7)
        
        for bar, val in zip(bars, valores[::-1]):
            if val > 1:
                ax.text(bar.get_width() + 0.3, bar.get_y() + bar.get_height()/2,
                       f'{val:.0f}%', va='center', fontsize=7, fontweight='bold')
    
    for ax in axes:
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['bottom'].set_alpha(0.3)
        ax.set_facecolor('#FAFAFA')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=180, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return output_path


# ============ GERAÇÃO PDF ============

def fmt_num(v, decimals=1):
    if v is None:
        return '-'
    try:
        return f'{float(v):.{decimals}f}'
    except:
        return '-'

def fmt_int(v):
    if v is None:
        return '-'
    try:
        return f'{int(float(v)):,}'.replace(',', '.')
    except:
        return '-'


def build_premium_pdf(mt_municipios, tmp_dir):
    output_file = OUTPUT_DIR / 'IDEB_SAEB_MT_PREMIUM_2023.pdf'
    
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle('MuniTitle', parent=styles['Heading1'],
        fontSize=22, textColor=COR_PRIMARIA, fontName='Helvetica-Bold',
        spaceAfter=2, spaceBefore=0))
    styles.add(ParagraphStyle('MuniSubTitle', parent=styles['Normal'],
        fontSize=10, textColor=COR_CINZA, spaceAfter=8))
    styles.add(ParagraphStyle('KPIValue', parent=styles['Normal'],
        fontSize=22, textColor=COR_PRIMARIA, fontName='Helvetica-Bold',
        alignment=TA_CENTER, spaceAfter=0, spaceBefore=0))
    styles.add(ParagraphStyle('KPILabel', parent=styles['Normal'],
        fontSize=8, textColor=COR_CINZA, alignment=TA_CENTER, leading=10))
    styles.add(ParagraphStyle('SectionTitle', parent=styles['Heading2'],
        fontSize=12, textColor=COR_PRIMARIA, fontName='Helvetica-Bold',
        spaceAfter=4, spaceBefore=6))
    styles.add(ParagraphStyle('BodySmall', parent=styles['Normal'],
        fontSize=8, textColor=colors.HexColor('#333333'), leading=10))
    
    elements = []
    
    # ============ CAPA ============
    elements.append(Spacer(1, 5*cm))
    # Logo box
    logo_box = Table([
        [Paragraph('ROCHA PRIME', ParagraphStyle('Logo', parent=styles['Title'],
            fontSize=32, textColor=COR_PRIMARIA, fontName='Helvetica-Bold', alignment=TA_CENTER))],
        [Paragraph('Consultoria Educacional | FUNDEB', ParagraphStyle('Sub', parent=styles['Normal'],
            fontSize=12, textColor=COR_SECUNDARIA, alignment=TA_CENTER))]
    ], colWidths=[15*cm])
    logo_box.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('LINEABOVE', (0, 0), (-1, 0), 2, COR_PRIMARIA),
        ('LINEBELOW', (0, -1), (-1, -1), 2, COR_PRIMARIA),
    ]))
    elements.append(logo_box)
    elements.append(Spacer(1, 2*cm))
    elements.append(Paragraph(
        'Relatório de Resultados<br/>IDEB &amp; SAEB - Mato Grosso',
        ParagraphStyle('T', parent=styles['Title'], fontSize=28, textColor=COR_PRIMARIA,
            fontName='Helvetica-Bold', leading=34, alignment=TA_CENTER)
    ))
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph(
        'Análise individualizada dos 129 municípios<br/>'
        'Evolution histórica + Níveis de Aprendizagem 2021',
        ParagraphStyle('S', parent=styles['Normal'], fontSize=12, textColor=COR_CINZA,
            alignment=TA_CENTER, leading=16)
    ))
    elements.append(Spacer(1, 1.5*cm))
    # Info box capa
    info_data = [
        ['UF', 'Mato Grosso'],
        ['Região', 'Centro-Oeste'],
        ['Municípios analisados', '129'],
        ['IDEB', 'Série histórica 2005-2023'],
        ['SAEB', 'Edição 2021 - Proficiências + Níveis'],
        ['Censo Escolar', 'Dados 2025'],
        ['Rede', 'Municipal'],
        ['Data de emissão', datetime.now().strftime('%d/%m/%Y')],
    ]
    info_table = Table(info_data, colWidths=[5*cm, 10*cm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), COR_PRIMARIA),
        ('BACKGROUND', (0, 0), (-1, 0), COR_BG_CLARO),
        ('BACKGROUND', (0, -1), (-1, -1), COR_BG_CLARO),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#B0C4DE')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(info_table)
    elements.append(PageBreak())
    
    # ============ ÍNDICE / RESUMO ============
    elements.append(Paragraph('Sumário Executivo - Mato Grosso', styles['Heading1']))
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph(
        'Este relatório consolida os resultados do IDEB (2023) e do SAEB (2021) para os '
        '<b>129 municípios da rede municipal de ensino de Mato Grosso</b>. Cada município possui '
        'uma ficha individualizada contendo:',
        styles['BodySmall']
    ))
    elementos_idx = [
        '• <b>Cartão de indicadores</b>: IDEB (Anos Iniciais e Finais), proficiências SAEB (Português + Matemática, 5º e 9º anos)',
        '• <b>Gráfico de evolução</b>: histórico do IDEB 2005-2023, comparado à meta PQE de 6.0',
        '• <b>Distribuição por nível</b>: % de alunos em cada faixa de aprendizagem SAEB',
        '• <b>Dados do Censo 2025</b>: escolas, matrículas e docentes da rede',
    ]
    for item in elementos_idx:
        elements.append(Paragraph(item, styles['BodySmall']))
        elements.append(Spacer(1, 2))
    
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph('<b>Fontes:</b> INEP/MEC - IDEB 2023, SAEB 2021; Censo Escolar 2025.', styles['BodySmall']))
    elements.append(Paragraph(
        '<b>Interpretação dos níveis SAEB:</b> Muito Baixo (nível 0-1) | Baixo (nível 2-3) | '
        'Intermediário (nível 4) | Adequado (nível 5-6) | Avançado (nível 7+).',
        styles['BodySmall']
    ))
    
    # Stats rápidas
    elements.append(Spacer(1, 0.4*cm))
    stats = []
    ideb_ai_vals = []
    ideb_af_vals = []
    for cod, m in mt_municipios.items():
        for h in (m.get('ideb') or {}).get('historicoAnosIniciais', []):
            if h.get('ano') == 2023 and h.get('idebObservado') is not None:
                ideb_ai_vals.append(float(h['idebObservado']))
        for h in (m.get('ideb') or {}).get('historicoAnosFinais', []):
            if h.get('ano') == 2023 and h.get('idebObservado') is not None:
                ideb_af_vals.append(float(h['idebObservado']))
    
    if ideb_ai_vals:
        stats.append(['IDEB Médio - Anos Iniciais (MT)', f'{sum(ideb_ai_vals)/len(ideb_ai_vals):.2f}'])
    if ideb_af_vals:
        stats.append(['IDEB Médio - Anos Finais (MT)', f'{sum(ideb_af_vals)/len(ideb_af_vals):.2f}'])
    stats.append(['Total de municípios com dados IDEB 2023', str(len(mt_municipios))])
    
    stats_table = Table(stats, colWidths=[10*cm, 5*cm])
    stats_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), COR_PRIMARIA),
        ('BACKGROUND', (0, 0), (-1, -1), COR_BG_CLARO),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#B0C4DE')),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(stats_table)
    elements.append(PageBreak())
    
    # ============ LISTA DE MUNICÍPIOS (SUMÁRIO) ============
    elements.append(Paragraph('Relação de Municípios', styles['Heading1']))
    elements.append(Spacer(1, 0.3*cm))
    
    mun_sorted = sorted(mt_municipios.items(), key=lambda x: x[1]['nome'])
    lista_data = [['#', 'Município', 'Código IBGE']]
    for i, (cod, m) in enumerate(mun_sorted, 1):
        lista_data.append([str(i).zfill(3), m['nome'], cod])
    
    lista_table = Table(lista_data, colWidths=[1.2*cm, 10*cm, 3*cm])
    lstyle = [
        ('BACKGROUND', (0, 0), (-1, 0), COR_PRIMARIA),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#CCCCCC')),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]
    for i in range(1, len(lista_data)):
        if i % 2 == 0:
            lstyle.append(('BACKGROUND', (0, i), (-1, i), COR_BG_CLARO))
    lista_table.setStyle(TableStyle(lstyle))
    elements.append(lista_table)
    elements.append(PageBreak())
    
    # ============ UMA PÁGINA POR MUNICÍPIO ============
    total = len(mun_sorted)
    for idx, (cod, m) in enumerate(mun_sorted, 1):
        _build_municipio_page(elements, styles, cod, m, idx, total, tmp_dir)
    
    doc = SimpleDocTemplate(
        str(output_file),
        pagesize=A4,
        leftMargin=1.5*cm, rightMargin=1.5*cm,
        topMargin=1.5*cm, bottomMargin=1.5*cm
    )
    doc.build(elements)
    
    print(f'\n✅ PDF PREMIUM gerado: {output_file}')
    print(f'   Tamanho: {output_file.stat().st_size / 1024:.0f} KB')
    print(f'   Municípios: {total}')


def _build_municipio_page(elements, styles, cod, m, idx, total, tmp_dir):
    """Constrói uma página premium para um município"""
    nome = m['nome']
    ideb = m.get('ideb') or {}
    saeb = m.get('saeb') or {}
    censo = m.get('censo') or {}
    
    # Extrai IDEB 2023
    hist_ai = ideb.get('historicoAnosIniciais', [])
    hist_af = ideb.get('historicoAnosFinais', [])
    ideb_2023_ai = None
    ideb_2023_af = None
    ideb_2021_ai = None
    ideb_2021_af = None
    for h in hist_ai:
        if h.get('ano') == 2023: ideb_2023_ai = h.get('idebObservado')
        if h.get('ano') == 2021: ideb_2021_ai = h.get('idebObservado')
    for h in hist_af:
        if h.get('ano') == 2023: ideb_2023_af = h.get('idebObservado')
        if h.get('ano') == 2021: ideb_2021_af = h.get('idebObservado')
    
    # === CABEÇALHO DO MUNICÍPIO ===
    header_data = [[
        Paragraph(f'{idx}/{total}', ParagraphStyle('num', parent=styles['Normal'],
            fontSize=10, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph(nome.upper(), ParagraphStyle('nome', parent=styles['Heading1'],
            fontSize=20, textColor=colors.white, fontName='Helvetica-Bold')),
        Paragraph(f'IBGE: {cod}', ParagraphStyle('cod', parent=styles['Normal'],
            fontSize=9, textColor=colors.white, alignment=TA_RIGHT)),
    ]]
    header_tbl = Table(header_data, colWidths=[1.5*cm, 12*cm, 4.5*cm])
    header_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COR_PRIMARIA),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(header_tbl)
    elements.append(Spacer(1, 0.3*cm))
    
    # === CARDS KPI (4 cards em linha) ===
    def kpi_card(valor, label, cor_borda=COR_PRIMARIA, cor_valor=COR_PRIMARIA):
        valor_str = fmt_num(valor)
        if valor_str == '-':
            cor_valor = COR_CINZA
        return [
            Paragraph(f'<font color="{cor_valor.hexval()}" size="20"><b>{valor_str}</b></font>',
                ParagraphStyle('v', parent=styles['Normal'], alignment=TA_CENTER)),
            Paragraph(f'<font color="{COR_CINZA.hexval()}" size="7">{label}</font>',
                ParagraphStyle('l', parent=styles['Normal'], alignment=TA_CENTER, leading=9)),
        ]
    
    kpi_row = Table([[
        kpi_card(ideb_2023_ai, 'IDEB 2023<br/>Anos Iniciais', COR_PRIMARIA),
        kpi_card(ideb_2023_af, 'IDEB 2023<br/>Anos Finais', COR_SECUNDARIA),
        kpi_card(saeb.get('media_5_lp'), 'Prof. Portugues<br/>5 Ano (SAEB 2021)', colors.HexColor('#2D7D9A')),
        kpi_card(saeb.get('media_5_mt'), 'Prof. Matematica<br/>5 Ano (SAEB 2021)', colors.HexColor('#B8860B')),
    ]], colWidths=[4.5*cm]*4)
    kpi_row.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.white),
        ('LINEBELOW', (0, 0), (-1, 0), 2, COR_PRIMARIA),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), COR_BG_CLARO),
    ]))
    elements.append(kpi_row)
    elements.append(Spacer(1, 0.2*cm))
    
    # === GRÁFICO DE EVOLUÇÃO IDEB ===
    elements.append(Paragraph('Evolução Histórica do IDEB', styles['SectionTitle']))
    chart_path = Path(tmp_dir) / f'ideb_{cod}.png'
    chart = gerar_grafico_ideb(hist_ai, hist_af, str(chart_path))
    if chart:
        elements.append(Image(str(chart_path), width=17*cm, height=5*cm))
    else:
        elements.append(Paragraph('<i>Sem dados históricos de IDEB para este município.</i>', styles['BodySmall']))
    elements.append(Spacer(1, 0.2*cm))
    
    # === DADOS SAEB 2021 DETALHADOS ===
    elements.append(Paragraph('Resultados SAEB 2021 - Níveis de Aprendizagem', styles['SectionTitle']))
    
    # Tabela de indicadores resumida (Português + Matemática por ano)
    def pct_badge(valor, label_short):
        if valor is None:
            return Paragraph(f'<font color="#999">— {label_short}</font>',
                ParagraphStyle('b', parent=styles['Normal'], fontSize=7, alignment=TA_CENTER))
        cor = COR_VERMELHO if valor < 30 else (COR_SECUNDARIA if valor < 60 else COR_DESTAQUE)
        return Paragraph(
            f'<font color="{cor.hexval()}" size="14"><b>{valor:.1f}%</b></font><br/>'
            f'<font color="#6B7280" size="6">{label_short}</font>',
            ParagraphStyle('b', parent=styles['Normal'], alignment=TA_CENTER, leading=11)
        )
    
    saeb_tbl = Table([[
        pct_badge(saeb.get('lp5_adequado'), 'LP 5º Adequado'),
        pct_badge(saeb.get('mt5_adequado'), 'MT 5º Adequado'),
        pct_badge(saeb.get('lp5_avancado'), 'LP 5º Avançado'),
        pct_badge(saeb.get('mt5_avancado'), 'MT 5º Avançado'),
        pct_badge(saeb.get('lp9_adequado'), 'LP 9º Adequado'),
        pct_badge(saeb.get('mt9_adequado'), 'MT 9º Adequado'),
        pct_badge(saeb.get('lp9_avancado'), 'LP 9º Avançado'),
        pct_badge(saeb.get('mt9_avancado'), 'MT 9º Avançado'),
    ]], colWidths=[2.25*cm]*8)
    saeb_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COR_BG_DOURADO),
        ('BOX', (0, 0), (-1, -1), 0.5, COR_SECUNDARIA),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(saeb_tbl)
    elements.append(Spacer(1, 0.15*cm))
    
    # === GRÁFICO DE NÍVEIS ===
    tem_saeb = saeb and saeb.get('niveis_lp5') and sum(x for x in saeb.get('niveis_lp5', []) if x) > 0
    if tem_saeb:
        niv_path = Path(tmp_dir) / f'niveis_{cod}.png'
        gerar_grafico_niveis(saeb, str(niv_path))
        elements.append(Image(str(niv_path), width=17*cm, height=5*cm))
    else:
        elements.append(Paragraph('<i>Dados SAEB 2021 não disponíveis para este município (não avaliado).</i>', styles['BodySmall']))
    
    elements.append(Spacer(1, 0.2*cm))
    
    # === DADOS DO CENSO 2025 ===
    elements.append(Paragraph('Dados do Censo Escolar 2025 - Rede Municipal', styles['SectionTitle']))
    censo_rows = [
        ['Escolas Municipais', fmt_int(censo.get('escolasMunicipaisTotal'))],
        ['Matrículas Municipais', fmt_int(censo.get('matriculasMunicipaisTotal'))],
        ['Docentes Municipais', fmt_int(censo.get('docentesMunicipaisTotal'))],
        ['Alunos por docente', fmt_num(censo.get('matriculasMunicipaisTotal') / censo.get('docentesMunicipaisTotal', 1) if censo.get('docentesMunicipaisTotal') else None)],
    ]
    # Dados por etapa
    etapas = [
        ('Creche', censo.get('crecheMunicipal')),
        ('Pré-escola', censo.get('preEscolaMunicipal')),
        ('Anos Iniciais', censo.get('anosIniciaisFundamentalMunicipal')),
        ('Anos Finais', censo.get('anosFinaisFundamentalMunicipal')),
    ]
    for nome_e, val in etapas:
        censo_rows.append([f'  → {nome_e}', fmt_int(val)])
    
    # Tempo integral
    integral_total = censo.get('tempoIntegralBasicaMunicipal')
    if integral_total:
        mat_total = censo.get('matriculasMunicipaisTotal', 1)
        pct = (integral_total / mat_total * 100) if mat_total else 0
        censo_rows.append(['Tempo Integral', f'{fmt_int(integral_total)} alunos ({pct:.1f}%)'])
    
    # Educação Especial
    if censo.get('educacaoEspecialMunicipal'):
        censo_rows.append(['Educação Especial', fmt_int(censo.get('educacaoEspecialMunicipal'))])
    
    # EJA
    if censo.get('ejaMunicipal'):
        censo_rows.append(['EJA Municipal', fmt_int(censo.get('ejaMunicipal'))])
    
    censo_tbl = Table(censo_rows, colWidths=[8*cm, 7*cm])
    censo_style = [
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.2, colors.HexColor('#DDDDDD')),
        ('BACKGROUND', (0, 0), (-1, 0), COR_BG_CLARO),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]
    for i in range(1, len(censo_rows)):
        if censo_rows[i][0].startswith('  →'):
            censo_style.append(('FONTSIZE', (0, i), (-1, i), 7))
            censo_style.append(('TEXTCOLOR', (0, i), (0, i), COR_CINZA))
    censo_tbl.setStyle(TableStyle(censo_style))
    elements.append(censo_tbl)
    
    elements.append(Spacer(1, 0.2*cm))
    elements.append(HRFlowable(
        width='100%', thickness=0.5, color=COR_CINZA,
        spaceBefore=4, spaceAfter=2
    ))
    elements.append(Paragraph(
        '<i>Fontes: INEP/MEC. IDEB - série histórica 2005-2023. '
        'SAEB - edição 2021, amostragem representativa com taxa de participação ≥50% (critério INEP). '
        'Níveis: Adequado (5-6 LP, 6-8 MT) | Avançado (7+ LP, 9+ MT).</i>',
        ParagraphStyle('footnote', parent=styles['Normal'], fontSize=6, textColor=COR_CINZA, leading=7)
    ))
    
    elements.append(PageBreak())


# ============ MAIN ============
def main():
    print('📊 Carregando datasets...')
    censo = load_censo()
    ideb = load_ideb()
    saeb = load_saeb()
    print(f'   Censo: {len(censo)} | IDEB: {len(ideb)} | SAEB MT Municipal: {len(saeb)}')
    
    # Monta estrutura combinada
    mt_data = {}
    for cod, info in censo.items():
        if info.get('uf') != 'Mato Grosso':
            continue
        mt_data[cod] = {
            'nome': info.get('municipio', cod),
            'ideb': ideb.get(cod, {}),
            'saeb': saeb.get(cod, {}),
            'censo': info,
        }
    
    print(f'   Municípios de MT: {len(mt_data)}')
    
    # Diretório temporário para gráficos
    tmp_dir = OUTPUT_DIR / 'tmp_charts'
    tmp_dir.mkdir(exist_ok=True)
    
    print('📄 Gerando relatório PREMIUM...')
    build_premium_pdf(mt_data, str(tmp_dir))
    
    # Limpar arquivos de gráficos temporários
    import shutil
    shutil.rmtree(tmp_dir, ignore_errors=True)
    
    # Estatísticas
    print('\n📈 Estatísticas MT:')
    lp5_validos = [v for v in (m['saeb'].get('media_5_lp') for m in mt_data.values()) if v]
    mt5_validos = [v for v in (m['saeb'].get('media_5_mt') for m in mt_data.values()) if v]
    if lp5_validos:
        print(f'   Média LP 5º ano: {sum(lp5_validos)/len(lp5_validos):.1f}')
    if mt5_validos:
        print(f'   Média MT 5º ano: {sum(mt5_validos)/len(mt5_validos):.1f}')


if __name__ == '__main__':
    main()
