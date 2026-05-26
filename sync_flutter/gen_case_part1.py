# -*- coding: utf-8 -*-
"""Case de Sucesso PDF Generator - Part 1: Data & Utilities"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle
from reportlab.graphics import renderPDF
from reportlab.pdfgen import canvas
import os, math

# ── Colors ──
NAVY = HexColor('#0F2747')
BLUE = HexColor('#1D5FAF')
GREEN = HexColor('#15803D')
RED = HexColor('#B91C1C')
ORANGE = HexColor('#E67E22')
TEXT_COLOR = HexColor('#172033')
MUTED = HexColor('#677184')
LINE_COLOR = HexColor('#D7DFEA')
SOFT_BG = HexColor('#F8FAFC')
CARD_BG = HexColor('#F0F4FA')
COVER_BG = HexColor('#F7FAFE')
DARK_PANEL = HexColor('#1A3058')
LIGHT_BLUE_TEXT = HexColor('#D8E2F2')
WHITE = white

# ── Paths ──
BASE = '/home/AdrielT87/Área de trabalho/Sync/sync_flutter'
FONT_PATH = os.path.join(BASE, 'assets/fonts/InterVariable.ttf')
LOGO_PATH = os.path.join(BASE, 'assets/branding/logo-rocha-prime.png')
LOGO_H_PATH = os.path.join(BASE, 'assets/branding/logo-rocha-prime-horizontal.png')
BADGE_PATH = os.path.join(BASE, 'assets/branding/logo-rocha-prime-badge.png')
BG_PATH = os.path.join(BASE, 'assets/branding/bg-capa-premium.jpg')
OUTPUT = os.path.join(BASE, 'assets/case_sucesso_rocha_prime_bahia_2024_2026.pdf')
OUTPUT2 = os.path.join(BASE, 'lib/src/features/modules/application/case_sucesso_rocha_prime_bahia_2024_2026.pdf')

# Register font
pdfmetrics.registerFont(TTFont('Inter', FONT_PATH))

W, H = A4  # 595.27 x 841.89

def money(v):
    if abs(v) >= 1e9: return f'R$ {v/1e9:.2f} bi'
    if abs(v) >= 1e6: return f'R$ {v/1e6:.2f} mi'
    if abs(v) >= 1e3: return f'R$ {v/1e3:.1f} mil'
    return f'R$ {v:,.2f}'

def pct(before, after):
    if before == 0: return '-'
    p = ((after - before) / before) * 100
    sign = '+' if p >= 0 else ''
    return f'{sign}{p:.1f}%'

def delta_label(before, after):
    d = after - before
    sign = '+' if d >= 0 else ''
    return f'{sign}{d:,}'

# ── Municipality Data ──
MUNICIPIOS = [
    {
        'nome': 'Sítio do Mato', 'uf': 'BA', 'tag': 'ACELERAÇÃO DE RECEITA',
        'contrato': 'Relatório Técnico Rocha Prime | Impacto Financeiro FUNDEB 2026',
        'base_metric_label': 'Alunos EJA',
        'base_metric_key': 'eja',
        'anos': {
            2024: {'vaaf': 4_871_055.23, 'vaat': 7_809_446.35, 'vaar': 257_720.96, 'comp': 12_938_222.54, 'fundeb': 27_533_970.45, 'eja': 273, 'matriculas': 3522, 'integral': 96},
            2025: {'vaaf': 4_549_765.96, 'vaat': 5_750_554.54, 'vaar': 451_274.43, 'comp': 10_751_594.93, 'fundeb': 24_845_500.62, 'eja': 725, 'matriculas': 4191, 'integral': 591},
            2026: {'vaaf': 7_209_249.44, 'vaat': 19_373_558.48, 'vaar': 2_165_618.08, 'comp': 28_748_426.00, 'fundeb': 49_400_529.31, 'eja': 0, 'integral': 0},
        },
        'servicos': [
            'Assessoria para regularização dos sistemas MEC/FNDE (SIMEC, SIGPC, SIGARP, HABILITA-FNDE).',
            'Reestruturação e correção do Censo Escolar para apuração e aumento da arrecadação do FUNDEB.',
            'Levantamento de créditos, destravamento de frentes FNDE/MEC e atendimento a diligências.',
        ],
        'leitura': 'Sítio do Mato entrou em forte aceleração de base e de receita. O município saiu de 273 matrículas EJA para 725 (+165,6%) e de 96 para 591 em tempo integral (+515,6%). O reflexo financeiro veio na complementação, que saltou de R$ 12,94 mi para R$ 28,75 mi em 2026.',
    },
    {
        'nome': 'Coribe', 'uf': 'BA', 'tag': 'CRESCIMENTO SÓLIDO',
        'contrato': 'Inexigibilidade 019/2025 | Processo Administrativo 221/2025',
        'base_metric_label': 'Alunos EJA',
        'base_metric_key': 'eja',
        'anos': {
            2024: {'vaaf': 4_284_786.79, 'vaat': 5_380_803.04, 'vaar': 227_282.99, 'comp': 9_892_872.82, 'fundeb': 22_731_911.80, 'eja': 180, 'matriculas': 3026, 'integral': 320},
            2025: {'vaaf': 4_576_138.43, 'vaat': 5_969_143.88, 'vaar': 1_090_778.16, 'comp': 11_636_060.47, 'fundeb': 25_811_660.68, 'eja': 656, 'matriculas': 3137, 'integral': 815},
            2026: {'vaaf': 7_012_347.38, 'vaat': 18_392_651.91, 'vaar': 1_863_289.93, 'comp': 27_268_289.22, 'fundeb': 47_356_333.59, 'eja': 0, 'integral': 0},
        },
        'servicos': [
            'Governança técnica do Censo e habilitação VAAT.',
            'Monitoramento de plataformas FNDE e suporte operacional à secretaria.',
        ],
        'leitura': 'Coribe apresentou crescimento expressivo em EJA (+264,4%) e integral (+154,7%), consolidando uma base sólida de captação. A complementação da União evoluiu de R$ 9,89 mi para R$ 27,27 mi (+175,6%).',
    },
    {
        'nome': 'São Félix do Coribe', 'uf': 'BA', 'tag': 'ESCALA FINANCEIRA',
        'contrato': 'Contrato 042/2025 | Processo Administrativo 389/2025',
        'base_metric_label': 'Alunos EJA',
        'base_metric_key': 'eja',
        'anos': {
            2024: {'vaaf': 5_391_329.07, 'vaat': 8_390_135.66, 'vaar': 663_277.97, 'comp': 14_444_742.70, 'fundeb': 30_599_451.78, 'eja': 310, 'matriculas': 3548, 'integral': 480},
            2025: {'vaaf': 5_791_192.72, 'vaat': 10_155_347.42, 'vaar': 1_331_527.36, 'comp': 17_278_067.50, 'fundeb': 35_217_566.95, 'eja': 786, 'matriculas': 3989, 'integral': 974},
            2026: {'vaaf': 7_759_656.35, 'vaat': 17_584_528.97, 'vaar': 2_360_281.18, 'comp': 27_704_466.50, 'fundeb': 49_933_302.64, 'eja': 0, 'integral': 0},
        },
        'servicos': [
            'Consultoria técnica especializada para elaboração e monitoramento dos programas vinculados ao Portal FNDE e ao MEC.',
            'Equipe multidisciplinar para orientação técnica aos servidores, gestor municipal e unidades executoras.',
            'Atuação sobre eixos como UEX, CACS-FUNDEB, SIOPE e sistemas operacionais da educação municipal.',
        ],
        'leitura': 'São Félix do Coribe converteu a agenda técnica em escala real de matrículas estratégicas. O ganho de EJA foi muito expressivo e a leitura financeira de 2026 mostra crescimento sólido tanto na complementação da União quanto na receita total do fundo.',
    },
    {
        'nome': 'Serra do Ramalho', 'uf': 'BA', 'tag': 'ENTRADA 2023 | RESULTADO 2024',
        'contrato': 'Levantamento Técnico Rocha Prime | Serra do Ramalho - BA',
        'base_metric_label': 'Alunos EJA',
        'base_metric_key': 'eja',
        'subtitle': 'Entrada em 2023, primeiro resultado expressivo em 2024 e evolução oficial até 2026.',
        'timeline_years': [2023, 2024, 2025, 2026],
        'chart_metric': 'fundeb',
        'chart_title': 'Evolução da receita FUNDEB',
        'school_kpis': [
            {'label': 'Escolas', 'value': '+7', 'note': 'ciclo 2024-2026: 43 para 50'},
            {'label': 'Tempo integral', 'value': '+355', 'note': 'ciclo 2024-2026: 418 para 773'},
            {'label': 'Ed. especial', 'value': '+21', 'note': 'ciclo 2024-2026: 704 para 725'},
        ],
        'anos': {
            2023: {'vaaf': 0.00, 'vaat': 0.00, 'vaar': 0.00, 'comp': 59_303_113.01, 'fundeb': 36_326_670.90, 'eja': 0, 'matriculas': 0, 'integral': 0, 'escolas': 0, 'especial': 0},
            2024: {'vaaf': 13_635_669.40, 'vaat': 14_554_642.34, 'vaar': 0.00, 'comp': 28_190_311.74, 'fundeb': 69_048_561.95, 'eja': 909, 'matriculas': 8952, 'integral': 418, 'escolas': 43, 'especial': 704},
            2025: {'vaaf': 0.00, 'vaat': 38_040_978.48, 'vaar': 0.00, 'comp': 38_040_978.48, 'fundeb': 82_862_019.93, 'eja': 742, 'matriculas': 8638, 'integral': 773, 'escolas': 50, 'especial': 725},
            2026: {'vaaf': 15_879_719.53, 'vaat': 26_063_166.61, 'vaar': 0.00, 'comp': 41_942_886.14, 'fundeb': 87_433_004.24, 'eja': 0, 'integral': 0},
        },
        'servicos': [
            'Levantamento técnico 2023 a 2026 com leitura de receita oficial, complementação da União e base educacional.',
            'Análise dos componentes VAAF, VAAT e VAAR para qualificar a estratégia de captura no próximo ciclo.',
            'Conferência de matrículas públicas, tempo integral e pontos de validação documental junto às bases MEC/FNDE.',
        ],
        'leitura': 'Em Serra do Ramalho, a empresa entrou em 2023 e o avanço financeiro deve ser lido até 2026: a receita total do FUNDEB saiu de R$ 36,33 mi para R$ 87,43 mi, acumulando R$ 51,11 mi (+140,7%). Os KPIs educacionais mostram a base escolar trabalhada no ciclo 2024-2026 e o efeito financeiro oficial de 2026.',
    },
]

ANO_BASE = 2024
ANO_ATUAL = 2026

# Aggregated totals
def total_comp(year):
    return sum(m['anos'][year]['comp'] for m in MUNICIPIOS)

def total_fundeb(year):
    return sum(m['anos'][year]['fundeb'] for m in MUNICIPIOS)

def total_eja_delta():
    return sum(
        m['anos'][2025].get(m.get('base_metric_key', 'eja'), m['anos'][2025]['eja']) -
        m['anos'][2024].get(m.get('base_metric_key', 'eja'), m['anos'][2024]['eja'])
        for m in MUNICIPIOS
    )

def total_integral_delta():
    return sum(m['anos'][2025]['integral'] - m['anos'][2024]['integral'] for m in MUNICIPIOS)

COMP_2024 = total_comp(2024)
COMP_2025 = total_comp(2025)
COMP_2026 = total_comp(2026)
FUNDEB_2024 = total_fundeb(2024)
FUNDEB_2026 = total_fundeb(2026)
GANHO_ACUMULADO = COMP_2026 - COMP_2024
GANHO_25_26 = COMP_2026 - COMP_2025
CRESCIMENTO_FUNDEB = FUNDEB_2026 - FUNDEB_2024
EJA_DELTA = total_eja_delta()
INTEGRAL_DELTA = total_integral_delta()

print(f"Data loaded: {len(MUNICIPIOS)} municipios")
print(f"Comp 2024: {money(COMP_2024)}")
print(f"Comp 2026: {money(COMP_2026)}")
print(f"Ganho acumulado: {money(GANHO_ACUMULADO)}")
print(f"Ganho 25->26: {money(GANHO_25_26)}")
print(f"FUNDEB growth: {money(CRESCIMENTO_FUNDEB)}")
print(f"EJA delta: +{EJA_DELTA}, Integral delta: +{INTEGRAL_DELTA}")
