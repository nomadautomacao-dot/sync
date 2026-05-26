# -*- coding: utf-8 -*-
import os
from gen_case_part1 import *
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor, white, black
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF

W, H = landscape(A4) 

NAVY = HexColor('#1A233A')
TEXT_NAVY = HexColor('#1E293B')
BLUE = HexColor('#2563EB')
GREEN = HexColor('#059669')
RED = HexColor('#DC2626')
ORANGE = HexColor('#D97706')
TEXT_COLOR = HexColor('#334155')
MUTED = HexColor('#64748B')
LINE_COLOR = HexColor('#E2E8F0')
BG_LIGHT = HexColor('#F8FAFC')
WHITE = white

SOFT_GREEN = HexColor('#ECFDF5')
SOFT_RED = HexColor('#FEF2F2')
SOFT_BLUE = HexColor('#EFF6FF')
SOFT_ORANGE = HexColor('#FFFBEB')

LOGO_SVG = os.path.join(BASE, 'assets/branding/logo-rocha-prime-institucional.svg')

def money(v):
    if abs(v) >= 1e9: return f'R$ {v/1e9:.2f} bi'.replace('.', ',')
    if abs(v) >= 1e6: return f'R$ {v/1e6:.2f} mi'.replace('.', ',')
    if abs(v) >= 1e3: return f'R$ {v/1e3:.1f} mil'.replace('.', ',')
    return f'R$ {v:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')

def pct(before, after):
    if before == 0: return '-'
    p = ((after - before) / before) * 100
    sign = '+' if p >= 0 else ''
    return f'{sign}{p:.1f}%'.replace('.', ',')

def int_pt(v):
    return f"{int(v):,}".replace(',', '.')

def draw_bold(c, text, x, y):
    c.drawString(x, y, text)
    c.drawString(x+0.3, y, text)

def multi_line_text(c, text, x, y, width, line_height=14, align='left'):
    words = text.split(' ')
    lines = []
    current_line = []
    for word in words:
        current_line.append(word)
        if c.stringWidth(' '.join(current_line), c._fontname, c._fontsize) > width:
            current_line.pop()
            if not current_line:  # Word itself is longer than width
                lines.append(word)
                current_line = []
            else:
                lines.append(' '.join(current_line))
                current_line = [word]
    if current_line:
        lines.append(' '.join(current_line))
    for line in lines:
        if align == 'center':
            c.drawCentredString(x, y, line)
        else:
            c.drawString(x, y, line)
        y -= line_height
    return y

def draw_metric_card(c, x, y, w, h, label, value, sub, accent, bg):
    c.setFillColor(bg)
    c.setStrokeColor(LINE_COLOR)
    c.setLineWidth(1)
    c.roundRect(x, y, w, h, 8, fill=1, stroke=1)
    
    c.setFillColor(accent)
    c.pathText = 0
    c.roundRect(x, y, 6, h, 4, fill=1, stroke=0)
    c.rect(x+4, y, 2, h, fill=1, stroke=0)
    
    c.setFillColor(MUTED)
    c.setFont("Inter", 8)
    draw_bold(c, label.upper(), x + 16, y + h - 22)
    
    c.setFillColor(TEXT_NAVY)
    
    # Auto-adjust font size for very long values
    font_size = 22
    if c.stringWidth(value, "Inter", font_size) > (w - 24):
        font_size = 18
    c.setFont("Inter", font_size)
    draw_bold(c, value, x + 16, y + h - 45)
    
    c.setFillColor(MUTED)
    c.setFont("Inter", 8)
    multi_line_text(c, sub, x + 16, y + h - 64, w - 24, 11)

def header(c, title_left="ROCHA PRIME SERVIÇOS ESPECIALIZADOS", sub_left="Material executivo | Case de sucesso FUNDEB", right_pill=None):
    c.setStrokeColor(LINE_COLOR)
    c.setLineWidth(1)
    
    try:
        drawing = svg2rlg(LOGO_SVG)
        scale = 22.0 / drawing.height
        drawing.scale(scale, scale)
        renderPDF.draw(drawing, c, 40, H - 45)
    except:
        c.setFillColor(TEXT_NAVY)
        c.setFont("Inter", 12)
        draw_bold(c, "RP", 40, H - 35)

    c.setFillColor(TEXT_NAVY)
    c.setFont("Inter", 9)
    draw_bold(c, title_left, 75, H - 32)
    
    c.setFillColor(MUTED)
    c.setFont("Inter", 7)
    c.drawString(75, H - 42, sub_left)
    
    if right_pill:
        c.setFillColor(SOFT_BLUE)
        pw = c.stringWidth(right_pill, "Inter", 8) + 40
        c.roundRect(W - 40 - pw, H - 45, pw, 22, 11, fill=1, stroke=0)
        c.setFillColor(BLUE)
        c.setFont("Inter", 8)
        draw_bold(c, right_pill.upper(), W - 40 - pw/2 - c.stringWidth(right_pill.upper(), "Inter", 8)/2, H - 32)

def footer(c, pagenum):
    c.setStrokeColor(LINE_COLOR)
    c.setLineWidth(1)
    c.line(40, 30, W - 40, 30)
    
    c.setFillColor(MUTED)
    c.setFont("Inter", 6)
    c.drawString(40, 18, "Fontes: Censo Escolar INEP 2024/2025 aplicado ao ciclo 2024-2026, Portarias FUNDEB 2024-2026 e anexos.")
    
    c.drawRightString(W - 40, 18, f"{pagenum:02d}")

def page_cover(c):
    left_w = W * 0.58 # Increased left width slightly to prevent text cutoff
    
    c.setFillColor(WHITE)
    c.rect(0, 0, left_w, H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(left_w, 0, W - left_w, H, fill=1, stroke=0)
    
    # --- Left Column ---
    try:
        drawing = svg2rlg(LOGO_SVG)
        scale = 24.0 / drawing.height
        drawing.scale(scale, scale)
        renderPDF.draw(drawing, c, 40, H - 60)
    except:
        pass
        
    c.setFillColor(TEXT_NAVY)
    c.setFont("Inter", 10)
    draw_bold(c, "APRESENTAÇÃO EXECUTIVA", 80, H - 52)
    
    c.setFont("Inter", 42)
    draw_bold(c, "Case de Sucesso", 40, H - 170)
    draw_bold(c, "Rocha Prime", 40, H - 220)
    
    c.setFillColor(TEXT_COLOR)
    c.setFont("Inter", 12)
    multi_line_text(c, "Quatro cidades, uma estratégia: reorganizar base, qualificar o Censo/FUNDEB e ampliar a injeção de recursos na educação. Serra do Ramalho entra como frente de resultado expressivo desde 2024.", 40, H - 270, left_w - 80, 18)
    
    # The big rounded background for cards
    c.setFillColor(BG_LIGHT)
    c.roundRect(40, 60, left_w - 80, 190, 16, fill=1, stroke=0)
    
    # Cards
    card_w = (left_w - 120) / 2
    draw_metric_card(c, 60, 120, card_w, 100, "AVANÇO AGREGADO", pct(COMP_2024, COMP_2026), "Crescimento somado da complementação de 2024 para 2026.", GREEN, WHITE)
    draw_metric_card(c, 60 + card_w + 20, 120, card_w, 100, "COMPLEMENTAÇÃO TOTAL", money(COMP_2026), "Total de complementação da União em 2026 nas quatro cidades.", ORANGE, WHITE)
    
    c.setFillColor(MUTED)
    c.setFont("Inter", 8)
    draw_bold(c, "BASE ESCOLAR DO CICLO 2024 -> 2026", 60, 95)
    
    c.setFillColor(TEXT_NAVY)
    c.setFont("Inter", 16)
    draw_bold(c, f"{'+' if EJA_DELTA >= 0 else ''}{int_pt(EJA_DELTA)} EJA", 60, 75)
    draw_bold(c, f"{'+' if INTEGRAL_DELTA >= 0 else ''}{int_pt(INTEGRAL_DELTA)} Integral", 60 + card_w + 20, 75)
    
    c.setFillColor(MUTED)
    c.setFont("Inter", 6)
    c.drawString(40, 20, "Fontes: Censo Escolar INEP 2024/2025 aplicado ao ciclo 2024-2026, Portarias FUNDEB 2024-2026 e anexos.")

    # --- Right Column ---
    rx = left_w + 40
    rw = (W - left_w) - 80
    
    c.setFillColor(WHITE)
    c.setFont("Inter", 10)
    c.drawString(rx, H - 100, "PORTFÓLIO BAHIA | 2024-2026")
    
    c.setFont("Inter", 42)
    c.drawString(rx, H - 160, "4 cidades")
    c.drawString(rx, H - 210, "1 tese")
    c.drawString(rx, H - 260, "resultado")
    
    # Transparency box 1 
    box1_y = H - 380
    c.setFillColor(HexColor('#29354F'))
    c.roundRect(rx, box1_y, rw, 90, 12, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Inter", 9)
    multi_line_text(c, "A Rocha Prime atuou sobre base, governança, monitoramento e leitura técnica do FUNDEB. Serra do Ramalho evidencia entrada em 2023, resultado expressivo em 2024 e evolução financeira até 2026.", rx + 20, box1_y + 70, rw - 40, 14)
    
    # Transparency box 2
    box2_y = box1_y - 85
    c.setFillColor(HexColor('#3B4764'))
    c.roundRect(rx, box2_y, rw, 80, 12, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Inter", 9)
    draw_bold(c, "NÚCLEO DO CASE", rx + 20, box2_y + 60)
    c.setFont("Inter", 9)
    c.setFillColor(HexColor('#CBD5E1'))
    multi_line_text(c, "2024: base do problema. 2025: atuação Rocha Prime. 2026: efeito financeiro oficial capturado nas portarias do fundo.", rx + 20, box2_y + 45, rw - 40, 14)
    
    # Cidades Analisadas
    c.setFillColor(ORANGE)
    c.roundRect(rx, box2_y - 45, 160, 22, 6, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Inter", 8)
    draw_bold(c, "DOCUMENTO CONFIDENCIAL", rx + 15, box2_y - 37)
    
    c.setFillColor(HexColor('#94A3B8'))
    c.setFont("Inter", 8)
    c.drawString(rx, box2_y - 75, "Cidades analisadas")
    c.setFillColor(WHITE)
    c.setFont("Inter", 9)
    multi_line_text(c, "Sítio do Mato | Coribe | São Félix do Coribe | Serra do Ramalho", rx, box2_y - 90, rw, 14)

    c.showPage()


def page_muni(c, m, pagenum):
    c.setFillColor(BG_LIGHT)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    
    is_main = (m['nome'] == 'Sítio do Mato')
    tag = m['nome'].upper()
    header(c, f"{m['nome']} | {'Município principal do case' if is_main else 'Município do case'}", m.get('subtitle', "Base 2024, atuação em 2025 e efeito financeiro oficial em 2026."), right_pill=tag)
    
    y = H - 160
    cw = (W - 80 - 40) / 3
    timeline_years = m.get('timeline_years', [2024, 2025, 2026])
    
    base_key = m.get('base_metric_key', 'eja')
    base_label = m.get('base_metric_label', 'EJA')

    if timeline_years[0] == 2023:
        f23 = m['anos'][2023]['fundeb']
        f24 = m['anos'][2024]['fundeb']
        f26 = m['anos'][2026]['fundeb']
        int_delta = m['anos'][2025]['integral'] - m['anos'][2024]['integral']
        int_pct = pct(m['anos'][2024]['integral'], m['anos'][2025]['integral'])
        draw_metric_card(c, 40, y, cw, 80, "AVANÇO FUNDEB 2023 -> 2026", money(f26 - f23), f"{pct(f23, f26)} no ciclo completo", GREEN, SOFT_GREEN)
        draw_metric_card(c, 40 + cw + 20, y, cw, 80, "1º RESULTADO 2023 -> 2024", money(f24 - f23), f"{pct(f23, f24)} após entrada", GREEN, SOFT_GREEN)
        draw_metric_card(c, 40 + cw*2 + 40, y, cw, 80, "INTEGRAL CICLO 2024-2026", f"{int_delta:+}", f"{int_pct} na base que impacta 2026", GREEN, SOFT_GREEN)
    else:
        d_eja = m['anos'][2025][base_key] - m['anos'][2024][base_key]
        d_int = m['anos'][2025]['integral'] - m['anos'][2024]['integral']
        p_eja = pct(m['anos'][2024][base_key], m['anos'][2025][base_key])
        p_int = pct(m['anos'][2024]['integral'], m['anos'][2025]['integral'])
        
        eja_color, eja_bg = (RED, SOFT_RED) if d_eja < 0 else (GREEN, SOFT_GREEN)
        int_color, int_bg = (RED, SOFT_RED) if d_int < 0 else (GREEN, SOFT_GREEN)
        
        draw_metric_card(c, 40, y, cw, 80, f"{base_label} CICLO 2024-2026", f"{d_eja:+}", f"{p_eja} na base que impacta 2026", eja_color, eja_bg)
        draw_metric_card(c, 40 + cw + 20, y, cw, 80, "INTEGRAL CICLO 2024-2026", f"{d_int:+}", f"{p_int} na base que impacta 2026", int_color, int_bg)
        
        c26 = m['anos'][2026]['comp']
        c25 = m['anos'][2025]['comp']
        comp_pct = pct(c25, c26)
        draw_metric_card(c, 40 + cw*2 + 40, y, cw, 80, "COMP. 2025 -> 2026", money(c26 - c25), f"{comp_pct} de crescimento", GREEN, SOFT_GREEN)
    
    bh = y - 40
    left_w = (W - 100) * 0.55
    right_w = (W - 100) * 0.45
    
    # --- Left Card: Linha do Tempo ---
    c.setFillColor(WHITE)
    c.setStrokeColor(LINE_COLOR)
    c.setLineWidth(1)
    c.roundRect(40, 60, left_w, bh - 60, 16, fill=1, stroke=1)
    
    c.setFillColor(TEXT_NAVY)
    c.setFont("Inter", 12)
    draw_bold(c, "Linha do tempo da transformação", 60, bh - 30)
    c.setFillColor(MUTED)
    c.setFont("Inter", 8)
    c.drawString(60, bh - 45, "Proposta Técnica Rocha Prime | Reestruturação Censo/FUNDEB")
    
    tl_w = (left_w - 60) / len(timeline_years)
    ty = bh - 170
    
    c.setStrokeColor(HexColor('#93C5FD')) # Lighter line
    c.setLineWidth(3)
    c.line(60 + tl_w/2, ty + 80, 60 + tl_w*(len(timeline_years) - 0.5), ty + 80)
    
    for i, ano in enumerate(timeline_years):
        tx = 60 + i * tl_w
        # Circle marker on timeline instead of stray icons
        c.setFillColor(BLUE if i < 2 else GREEN)
        c.circle(tx + tl_w/2, ty + 80, 6, fill=1, stroke=0)
        
        c.setFillColor(SOFT_BLUE if i < 2 else SOFT_GREEN)
        c.roundRect(tx, ty, tl_w - 15, 65, 8, fill=1, stroke=0)
        
        c.setFillColor(TEXT_NAVY)
        c.setFont("Inter", 11)
        draw_bold(c, str(ano), tx + 12, ty + 45)
        
        c.setFillColor(MUTED)
        c.setFont("Inter", 7)
        if timeline_years[0] == 2023:
            lbl = "ENTRADA" if ano == 2023 else "1º RESULTADO" if ano == 2024 else "CONSOLIDAÇÃO" if ano == 2025 else "RESULTADO"
        else:
            lbl = "BASE" if ano == 2024 else "ATUAÇÃO/CENSO" if ano == 2025 else "RESULTADO"
        c.drawString(tx + 12, ty + 33, lbl)
        
        c.setFillColor(TEXT_COLOR)
        c.setFont("Inter", 7.3 if len(timeline_years) > 3 else 8)
        if timeline_years[0] == 2023:
            c.drawString(tx + 8, ty + 18, f"FDB: {money(m['anos'][ano]['fundeb'])}")
            if ano in [2024, 2025]:
                c.drawString(tx + 8, ty + 5, f"Integral: {int_pt(m['anos'][ano]['integral'])}")
            elif ano == 2026:
                c.drawString(tx + 8, ty + 5, f"Cmp: {money(m['anos'][ano]['comp'])}")
            else:
                c.drawString(tx + 8, ty + 5, "Entrada RP")
        elif ano != 2026:
            c.drawString(tx + 12, ty + 18, f"{base_label}: {int_pt(m['anos'][ano][base_key])}")
            c.drawString(tx + 12, ty + 5, f"Integral: {int_pt(m['anos'][ano]['integral'])}")
        else:
            c.drawString(tx + 12, ty + 18, f"Cmp: {money(m['anos'][ano]['comp'])}")
            c.drawString(tx + 12, ty + 5, f"FDB: {money(m['anos'][ano]['fundeb'])}")
            
    c.setFillColor(TEXT_NAVY)
    c.setFont("Inter", 11)
    reading_title = "Leitura executiva e KPIs escolares" if m.get('school_kpis') else "Leitura executiva e atuação Rocha Prime"
    draw_bold(c, reading_title, 60, ty - 30)
    
    c.setFillColor(TEXT_COLOR)
    c.setFont("Inter", 8)
    my = multi_line_text(c, m['leitura'], 60, ty - 45, left_w - 40, 11)
    
    my -= 7
    if m.get('school_kpis'):
        c.setFillColor(MUTED)
        c.setFont("Inter", 7)
        c.drawString(60, my, "Base escolar do ciclo 2024-2026; o Censo 2025 sustenta o efeito financeiro oficial de 2026.")
        my -= 12
        kpis = m['school_kpis']
        sw = (left_w - 40 - 18) / 4
        sy = max(72, my - 44)
        for idx, item in enumerate(kpis):
            sx = 60 + idx * (sw + 6)
            c.setFillColor(SOFT_BLUE if idx != 2 else SOFT_GREEN)
            c.roundRect(sx, sy, sw, 44, 8, fill=1, stroke=0)
            c.setFillColor(MUTED)
            c.setFont("Inter", 6.2)
            draw_bold(c, item['label'].upper(), sx + 7, sy + 31)
            c.setFillColor(GREEN if item['value'].startswith('+') else RED)
            c.setFont("Inter", 13)
            draw_bold(c, item['value'], sx + 7, sy + 15)
            c.setFillColor(TEXT_COLOR)
            c.setFont("Inter", 5.6)
            multi_line_text(c, item['note'], sx + 7, sy + 7, sw - 12, 6.5)
    else:
        for s in m['servicos']:
            if my < 80: # Prevent cutting off at the bottom!
                break
            my = multi_line_text(c, "• " + s, 60, my, left_w - 40, 11)
        
    # --- Right Card: Evolução Bar Chart ---
    c.setFillColor(WHITE)
    c.setStrokeColor(LINE_COLOR)
    c.setLineWidth(1)
    c.roundRect(40 + left_w + 20, 60, right_w, bh - 60, 16, fill=1, stroke=1)
    
    rx = 40 + left_w + 20
    c.setFillColor(TEXT_NAVY)
    c.setFont("Inter", 12)
    chart_metric = m.get('chart_metric', 'comp')
    chart_title = m.get('chart_title', 'Evolução da complementação da União')
    chart_years = timeline_years if chart_metric == 'fundeb' else [2024, 2025, 2026]
    draw_bold(c, chart_title, rx + 20, bh - 30)
    
    cx = rx + 20
    cw = right_w - 40
    ch = 180
    cy = bh - 240
    
    c.setStrokeColor(LINE_COLOR)
    c.setLineWidth(2)
    c.roundRect(cx, cy, cw, ch, 16, fill=0, stroke=1)
    
    c.setStrokeColor(HexColor('#F1F5F9'))
    for gl in [40, 80, 120]:
        c.line(cx + 20, cy + gl, cx + cw - 20, cy + gl)
        
    vals = [m['anos'][ano][chart_metric] for ano in chart_years]
    max_v = max(vals) * 1.2
    bar_w = 50 if len(chart_years) == 3 else 42
    spacing = (cw - (bar_w * len(chart_years))) / (len(chart_years) + 1)
    colors = [HexColor('#93C5FD'), HexColor('#2563EB'), HexColor('#60A5FA'), HexColor('#10B981')] 
    
    for i, (ano, v) in enumerate(zip(chart_years, vals)):
        bh_bar = (v / max_v) * ch
        bx = cx + spacing + i * (bar_w + spacing)
        c.setFillColor(colors[i])
        c.roundRect(bx, cy + 20, bar_w, bh_bar - 20, 6, fill=1, stroke=0)
        c.setFillColor(TEXT_NAVY)
        c.setFont("Inter", 9)
        draw_bold(c, str(ano), bx + bar_w/2 - c.stringWidth(str(ano), "Inter", 9)/2, cy + 5)
        
        c.setFillColor(TEXT_COLOR)
        c.setFont("Inter", 7.5 if len(chart_years) > 3 else 8)
        lbl = f"{ano}: {money(v)}"
        c.drawCentredString(bx + bar_w / 2, cy - 25, lbl)
        
    c.setFillColor(MUTED)
    c.setFont("Inter", 8)
    anos_txt = ", ".join(str(ano) for ano in chart_years[:-1]) + f" e {chart_years[-1]}"
    multi_line_text(c, f"A leitura financeira oficial foi feita com base nas portarias do FUNDEB {anos_txt}, permitindo comparar o ponto de entrada, o primeiro resultado expressivo e o efeito capturado.", rx + 20, cy - 50, right_w - 40, 12)
        
    footer(c, pagenum)
    c.showPage()


def page_closing(c, pagenum):
    c.setFillColor(BG_LIGHT)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "Mensagem final para apresentação", "O que o superior precisa enxergar em uma única leitura.", "FECHAMENTO")
    
    box_w = W - 80
    
    # 1. Navy Box
    navy_box_top = H - 65
    navy_box_height = 290
    navy_box_y = navy_box_top - navy_box_height
    
    c.setFillColor(NAVY)
    c.roundRect(40, navy_box_y, box_w, navy_box_height, 24, fill=1, stroke=0)
    
    # Portfolio box inside
    p_box_w = 220
    p_box_h = 140
    p_box_y = navy_box_top - p_box_h - 50 
    c.setFillColor(HexColor('#29354F'))
    c.roundRect(W - 40 - 40 - p_box_w, p_box_y, p_box_w, p_box_h, 16, fill=1, stroke=0)
    
    c.setFillColor(WHITE)
    c.setFont("Inter", 10)
    draw_bold(c, "PORTFÓLIO 2026", W - 40 - 20 - p_box_w, p_box_y + 110)
    c.setFont("Inter", 32)
    draw_bold(c, money(COMP_2026), W - 40 - 20 - p_box_w, p_box_y + 70)
    c.setFillColor(HexColor('#CBD5E1'))
    c.setFont("Inter", 10)
    multi_line_text(c, "de complementação total da União em 2026 nas quatro cidades.", W - 40 - 20 - p_box_w, p_box_y + 50, p_box_w - 40, 16)

    # Texts inside Navy block
    c.setFillColor(WHITE)
    c.setFont("Inter", 26) 
    text_y = navy_box_top - 50
    next_y = multi_line_text(c, "A Rocha Prime não entregou só consultoria. Entregou base mais forte e mais caixa para a educação.", 80, text_y, box_w * 0.55, 34)
    
    c.setFillColor(HexColor('#CBD5E1'))
    c.setFont("Inter", 12)
    multi_line_text(c, "Nos municípios em que a estratégia ganhou tração, o efeito foi direto: base escolar qualificada, avanço forte de tempo integral e maior complementação da União em 2026. Onde a base física ainda não acelerou, a governança técnica ajudou a preservar crescimento e estabilidade de captação.", 80, next_y - 20, box_w * 0.55, 18)
    
    # 2. Mensagem Title
    msg_title_y = navy_box_y - 30
    c.setFillColor(TEXT_NAVY)
    c.setFont("Inter", 12)
    draw_bold(c, "Mensagem que pode abrir a reunião", 40, msg_title_y)
    
    # 3. Mensagem Box
    msg_box_h = 65
    msg_box_y = msg_title_y - msg_box_h - 15 
    c.setFillColor(WHITE)
    c.setStrokeColor(HexColor('#BAE6FD'))
    c.setLineWidth(2)
    c.roundRect(40, msg_box_y, W - 80, msg_box_h, 16, fill=1, stroke=1)
    
    c.setFillColor(TEXT_NAVY)
    c.setFont("Inter", 12)
    multi_line_text(c, "Entre 2024 e 2026, mostramos que consultoria boa não é discurso: é matrícula estratégica bem capturada, é base técnica organizada e é recurso novo entrando de forma concreta na educação municipal.", 60, msg_box_y + msg_box_h - 22, W - 120, 18)
    
    # 4. Fontes
    fontes_title_y = msg_box_y - 35 
    c.setFillColor(TEXT_NAVY)
    c.setFont("Inter", 11)
    draw_bold(c, "Base metodológica e fontes", 40, fontes_title_y)
    
    c.setFillColor(MUTED)
    c.setFont("Inter", 9)
    fonts = [
        "Censo Escolar INEP 2024 e 2025 aplicado ao ciclo de resultado 2024-2026.",
        "Portarias oficiais FUNDEB 2024, 2025 e 2026 (arquivos locais em /complementacao).",
        "Documentos contratuais anexados pelo usuário para São Félix do Coribe e Coribe.",
        "Levantamento técnico anexado para Serra do Ramalho/BA e proposta técnica Rocha Prime para Sítio do Mato/BA."
    ]
    
    font_y = fontes_title_y - 20
    for f in fonts:
        c.drawString(40, font_y, "• " + f)
        font_y -= 13
        
    footer(c, pagenum)
    c.showPage()


def pdf_main():
    c = canvas.Canvas(OUTPUT, pagesize=landscape(A4))
    page_cover(c)
    munis = sorted(MUNICIPIOS, key=lambda x: x['nome'] != 'Sítio do Mato')
    pagenum = 2
    for m in munis:
        page_muni(c, m, pagenum)
        pagenum += 1
    page_closing(c, pagenum)
    c.save()

if __name__ == '__main__':
    pdf_main()
