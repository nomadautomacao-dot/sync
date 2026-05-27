"""
gerador_institucional.py
========================
Motor de geracao do deck Institucional (16 slides) — Rocha Prime
Formato 16:9 (1280x720). Paleta navy + blue.
Lê JSON via stdin, imprime caminho do PDF gerado em stdout.
"""
import sys
import json
import tempfile
import os
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.enums import TA_LEFT, TA_CENTER

try:
    from kit_padrao_pdf_rocha_prime.report_style_pdf import fmt_money, fmt_int
except ImportError:
    def fmt_money(v):
        return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    def fmt_int(v):
        return f"{v:,}".replace(",", ".")

# ── DESIGN TOKENS ─────────────────────────────────────────────
W, H = 1280, 720

NAVY        = colors.HexColor("#1E2840")
NAVY_DEEP   = colors.HexColor("#0F1E36")
NAVY_MID    = colors.HexColor("#243B5E")
NAVY_LIGHT  = colors.HexColor("#2E4A72")
BLUE_ACC    = colors.HexColor("#2F6BFF")
BLUE_BRIGHT = colors.HexColor("#60A5FA")
GREEN       = colors.HexColor("#0F7B3F")
GREEN_LIGHT = colors.HexColor("#34D399")
AMBER       = colors.HexColor("#F5A623")
WHITE       = colors.white
MUTED       = colors.HexColor("#94A3B8")
LIGHT_TEXT  = colors.HexColor("#E2E8F0")
DARK_TEXT   = colors.HexColor("#1E293B")
LIGHT_BG    = colors.HexColor("#F8FAFC")

PX, PY = 90, 55
CW = W - 2 * PX

F_HERO  = "Helvetica-Bold"
F_TITLE = "Helvetica-Bold"
F_SEMI  = "Helvetica-Bold"
F_BODY  = "Helvetica"
F_BOLD  = "Helvetica-Bold"

# ── HELPERS ───────────────────────────────────────────────────
def esc(t):
    return str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")

def para(c, text, x, top, width, *, size=20, leading=None, color=MUTED, font=F_BODY, align=TA_LEFT):
    if leading is None:
        leading = size * 1.5
    style = ParagraphStyle("p", fontName=font, fontSize=size, leading=leading, textColor=color, alignment=align)
    p = Paragraph(esc(text), style)
    _, h = p.wrap(width, H)
    p.drawOn(c, x, top - h)
    return top - h

def navy_base(c):
    c.setFillColor(NAVY)
    c.rect(0, 0, W, H, fill=1, stroke=0)

def draw_card(c, x, y, w, h, *, radius=8, fill=NAVY_MID, stroke=NAVY_LIGHT):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)

def accent_bar(c, x, y, h, w=4, color=BLUE_ACC):
    c.setFillColor(color)
    c.rect(x, y, w, h, fill=1, stroke=0)

def hline(c, x, y, length, color=NAVY_LIGHT, lw=0.8):
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.line(x, y, x + length, y)

def section_badge(c, x, y, text, bg=NAVY_MID, fg=BLUE_BRIGHT):
    w = len(text) * 7 + 24
    c.setFillColor(bg)
    c.roundRect(x, y, w, 22, 5, fill=1, stroke=0)
    c.setFillColor(fg)
    c.setFont(F_SEMI, 10)
    c.drawString(x + 12, y + 7, text.upper())

def page_number(c, n, total=16):
    c.setFillColor(MUTED)
    c.setFont(F_BODY, 11)
    c.drawRightString(W - PX, 28, f"{n:02d} / {total:02d}")

def footer_line(c):
    hline(c, PX, 52, CW, color=NAVY_LIGHT, lw=0.5)

def bullet_list(c, items, x, y, width, *, size=18):
    for item in items:
        c.setFillColor(BLUE_ACC)
        c.circle(x + 5, y - 6, 4, fill=1, stroke=0)
        y = para(c, item, x + 24, y + 2, width - 24, size=size, font=F_SEMI, color=WHITE)
        y -= 14
    return y

# ── SLIDES ────────────────────────────────────────────────────
def slide_01_capa(c):
    c.setFillColor(NAVY_DEEP)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    # Blue glow strip
    c.setFillColor(BLUE_ACC, alpha=0.15)
    for i in range(8):
        c.rect(0, 0, 6 + i * 6, H, fill=1, stroke=0)

    section_badge(c, PX, H - PY - 22, "APRESENTACAO INSTITUCIONAL · 2026")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 72)
    c.drawString(PX, H - PY - 110, "ROCHA PRIME")
    c.setFillColor(BLUE_BRIGHT)
    c.setFont(F_HERO, 48)
    c.drawString(PX, H - PY - 175, "SERVICOS ESPECIALIZADOS")
    c.setFillColor(BLUE_ACC)
    c.rect(PX, H - PY - 200, 80, 3, fill=1, stroke=0)
    para(c, "Inteligencia Tecnica para Gestao Educacional Municipal",
         PX, H - PY - 220, CW, size=22, color=MUTED)
    # KPI strip
    kpis = [("500+", "municipios atendidos"), ("R$ 2 bi", "em recursos otimizados"), ("15 anos", "de experiencia")]
    kpi_w = CW / 3
    for i, (val, lbl) in enumerate(kpis):
        kx = PX + i * kpi_w
        draw_card(c, kx + 8, 100, kpi_w - 16, 80)
        c.setFillColor(GREEN_LIGHT)
        c.setFont(F_HERO, 26)
        c.drawString(kx + 24, 148, val)
        c.setFillColor(MUTED)
        c.setFont(F_BODY, 13)
        c.drawString(kx + 24, 122, lbl)
    footer_line(c)
    page_number(c, 1)

def slide_02_quem_somos(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "QUEM SOMOS")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "Consultoria Tecnica")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 136, "Especializada em Educacao")
    accent_bar(c, PX, H - PY - 165, 4, w=100, color=BLUE_ACC)
    para(c,
         "A Rocha Prime e uma consultoria tecnica especializada na gestao educacional municipal. "
         "Atuamos como um setor de inteligencia para organizar dados, ajustar sistemas e sustentar "
         "a conformidade operacional, trabalhando junto com a equipe do municipio para obter "
         "resultados concretos na captacao de recursos do FUNDEB.",
         PX, H - PY - 200, CW, size=21, leading=34, color=MUTED)
    footer_line(c)
    page_number(c, 2)

def slide_03_missao(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "MISSAO E VISAO")
    mid = H / 2
    pw = CW / 2 - 30
    # Missao card
    draw_card(c, PX, mid - 80, pw, 260)
    c.setFillColor(BLUE_ACC)
    c.roundRect(PX, mid - 80 + 252, pw, 8, 8, fill=1, stroke=0)
    c.rect(PX, mid - 80 + 252, pw, 4, fill=1, stroke=0)
    c.setFillColor(BLUE_BRIGHT)
    c.setFont(F_HERO, 28)
    c.drawString(PX + 24, mid + 140, "MISSAO")
    para(c, "Organizar a gestao educacional dos municipios brasileiros, "
         "garantindo a captacao integral dos recursos do FUNDEB e a "
         "conformidade com os sistemas oficiais do MEC e FNDE.",
         PX + 24, mid + 110, pw - 48, size=18, leading=28, color=LIGHT_TEXT)
    # Visao card
    rx = W / 2 + 15
    draw_card(c, rx, mid - 80, pw, 260)
    c.setFillColor(GREEN_LIGHT)
    c.roundRect(rx, mid - 80 + 252, pw, 8, 8, fill=1, stroke=0)
    c.rect(rx, mid - 80 + 252, pw, 4, fill=1, stroke=0)
    c.setFillColor(GREEN_LIGHT)
    c.setFont(F_HERO, 28)
    c.drawString(rx + 24, mid + 140, "VISAO")
    para(c, "Ser referencia nacional em inteligencia tecnica para "
         "gestao publica educacional, impactando positivamente a "
         "qualidade da educacao em todos os municipios atendidos.",
         rx + 24, mid + 110, pw - 48, size=18, leading=28, color=LIGHT_TEXT)
    footer_line(c)
    page_number(c, 3)

def slide_04_fundeb(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "SERVICO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 40)
    c.drawString(PX, H - PY - 78, "Consultoria")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 126, "FUNDEB")
    hline(c, PX, H - PY - 145, CW, color=NAVY_LIGHT)
    items = [
        "Diagnostico completo das receitas FUNDEB do municipio",
        "Projecao tecnica de ganhos com complementacoes VAAF, VAAT e VAAR",
        "Organizacao documental e sistemica da rede educacional",
        "Acompanhamento continuo de prazos e entregas ao FNDE",
        "Capacitacao da equipe para operacao autonoma dos sistemas",
    ]
    bullet_list(c, items, PX, H - PY - 180, CW)
    footer_line(c)
    page_number(c, 4)

def slide_05_sistemas(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "SERVICO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 40)
    c.drawString(PX, H - PY - 78, "Gestao de")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 126, "Sistemas Oficiais")
    hline(c, PX, H - PY - 145, CW, color=NAVY_LIGHT)
    items = [
        "SIOPE — Sistema de Informacoes sobre Orcamentos Publicos em Educacao",
        "SIGPC — Sistema de Gestao de Prestacao de Contas",
        "PAR — Plano de Acoes Articuladas",
        "PDDE — Programa Dinheiro Direto na Escola",
        "MAVS — Modulo de Analise e Validacao do SIOPE",
    ]
    bullet_list(c, items, PX, H - PY - 180, CW)
    footer_line(c)
    page_number(c, 5)

def slide_06_terceirizacao(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "SERVICO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 40)
    c.drawString(PX, H - PY - 78, "Terceirizacao")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 126, "Tecnica Educacional")
    hline(c, PX, H - PY - 145, CW, color=NAVY_LIGHT)
    items = [
        "Alocacao de equipe tecnica especializada na secretaria de educacao",
        "Profissionais qualificados em FUNDEB, SIOPE e prestacao de contas",
        "Reducao de custos operacionais com equipe propria",
        "Flexibilidade contratual com foco em resultados",
    ]
    bullet_list(c, items, PX, H - PY - 180, CW)
    footer_line(c)
    page_number(c, 6)

def slide_07_formacao(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "SERVICO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 40)
    c.drawString(PX, H - PY - 78, "Formacao e")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 126, "Capacitacao")
    hline(c, PX, H - PY - 145, CW, color=NAVY_LIGHT)
    items = [
        "Treinamentos presenciais e online para equipes da secretaria",
        "Capacitacao em operacao de sistemas federais (SIOPE, PAR, PDDE)",
        "Formacao em legislacao educacional e prestacao de contas",
        "Certificados de conclusao para todos os participantes",
        "Materiais didaticos e manuais de procedimentos",
    ]
    bullet_list(c, items, PX, H - PY - 180, CW)
    footer_line(c)
    page_number(c, 7)

def slide_08_diferenciais(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "DIFERENCIAIS")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "Por que a")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 136, "Rocha Prime?")
    cols = [
        {"title": "Equipe Tecnica", "body": "Profissionais especializados\nem legislacao educacional\ne sistemas federais."},
        {"title": "Metodologia", "body": "Processo proprietario de\ndiagnostico, organizacao\ne monitoramento continuo."},
        {"title": "Acompanhamento", "body": "Suporte dedicado com\nacompanhamento de prazos\ne entregas ao FNDE."},
    ]
    cw = (CW - 40) / 3
    card_top = H - PY - 180
    card_h = 280
    for i, col in enumerate(cols):
        cx = PX + i * (cw + 20)
        draw_card(c, cx, card_top - card_h, cw, card_h,
                  stroke=BLUE_ACC if i == 0 else NAVY_LIGHT)
        c.setFillColor(BLUE_ACC)
        c.roundRect(cx, card_top - 8, cw, 8, 8, fill=1, stroke=0)
        c.rect(cx, card_top - 8, cw, 4, fill=1, stroke=0)
        c.setFillColor(BLUE_BRIGHT)
        c.setFont(F_HERO, 22)
        c.drawString(cx + 20, card_top - 44, col["title"])
        para(c, col["body"], cx + 20, card_top - 70, cw - 40, size=17, leading=27, color=LIGHT_TEXT)
    footer_line(c)
    page_number(c, 8)

def slide_09_metodologia(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "METODO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 52)
    c.drawString(PX, H - PY - 90, "METODOLOGIA")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 150, "4 EIXOS")
    eixos = [
        ("01", "Diagnostico", "Levantamento completo\ndas bases e receitas."),
        ("02", "Organizacao", "Estruturacao documental\ne sistemica da rede."),
        ("03", "Operacao", "Gestao ativa dos sistemas\nfederais e estaduais."),
        ("04", "Monitoramento", "Acompanhamento continuo\nde prazos e entregas."),
    ]
    cw = (CW - 30) / 4
    card_y = 100
    card_h = H - PY - 240
    for i, (num, title, body) in enumerate(eixos):
        cx = PX + i * (cw + 10)
        draw_card(c, cx, card_y, cw, card_h)
        c.setFillColor(BLUE_BRIGHT)
        c.setFont(F_HERO, 36)
        c.drawString(cx + 16, card_y + card_h - 48, num)
        c.setFillColor(WHITE)
        c.setFont(F_TITLE, 20)
        c.drawString(cx + 16, card_y + card_h - 80, title)
        hline(c, cx + 16, card_y + card_h - 92, cw - 32, color=NAVY_LIGHT)
        para(c, body, cx + 16, card_y + card_h - 108, cw - 32, size=16, leading=24, color=MUTED)
    footer_line(c)
    page_number(c, 9)

def slide_10_resultados(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "RESULTADOS")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 48)
    c.drawString(PX, H - PY - 80, "Numeros que")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 136, "falam por si")
    kpis = [
        ("500+", "municipios\natendidos", GREEN_LIGHT),
        ("R$ 2 bi", "em recursos\notimizados", BLUE_BRIGHT),
        ("26", "estados com\natuacao", AMBER),
    ]
    cw = (CW - 40) / 3
    card_y = 100
    card_h = H - PY - 210
    for i, (val, lbl, accent) in enumerate(kpis):
        cx = PX + i * (cw + 20)
        draw_card(c, cx, card_y, cw, card_h)
        c.setFillColor(accent)
        c.roundRect(cx, card_y + card_h - 8, cw, 8, 8, fill=1, stroke=0)
        c.rect(cx, card_y + card_h - 8, cw, 4, fill=1, stroke=0)
        c.setFillColor(accent)
        c.setFont(F_HERO, 48)
        c.drawString(cx + 20, card_y + card_h - 100, val)
        para(c, lbl, cx + 20, card_y + card_h - 120, cw - 40, size=18, leading=28, color=MUTED)
    footer_line(c)
    page_number(c, 10)

def slide_11_sistemas_oficiais(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "SISTEMAS OFICIAIS")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "ATUAMOS NOS")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 136, "SISTEMAS OFICIAIS")
    creds = [
        {"title": "FNDE", "body": "PAR, PDDE, SIGPC, PNAE,\nPNATE e todos os programas\nde transferencia direta."},
        {"title": "MEC", "body": "PDDE Interativo, PDE Escola,\nFormacao Continuada e\nFormacao pela Escola."},
        {"title": "Governo", "body": "SIOPE, MAVS, Siconfi,\ntransporte estadual e\nprestacao municipal."},
    ]
    cw = (CW - 40) / 3
    card_y = 100
    card_h = H - PY - 210
    for i, cred in enumerate(creds):
        cx = PX + i * (cw + 20)
        draw_card(c, cx, card_y, cw, card_h)
        c.setFillColor(BLUE_ACC)
        c.roundRect(cx, card_y + card_h - 8, cw, 8, 8, fill=1, stroke=0)
        c.rect(cx, card_y + card_h - 8, cw, 4, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(F_HERO, 30)
        c.drawString(cx + 24, card_y + card_h - 54, cred["title"])
        hline(c, cx + 24, card_y + card_h - 68, cw - 48, color=NAVY_LIGHT)
        para(c, cred["body"], cx + 24, card_y + card_h - 88, cw - 48, size=17, leading=27, color=MUTED)
    footer_line(c)
    page_number(c, 11)

def slide_12_case(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "CASE DE SUCESSO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 40)
    c.drawString(PX, H - PY - 76, "Case: Municipio de")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 124, "Referencia Educacional")
    hline(c, PX, H - PY - 140, CW, color=NAVY_LIGHT)
    pw = CW / 2 - 20
    panels = [
        {"title": "Antes", "kpi": "R$ 45 mi", "label": "receita FUNDEB anual", "accent": AMBER},
        {"title": "Depois", "kpi": "R$ 72 mi", "label": "receita otimizada (+60%)", "accent": GREEN_LIGHT},
    ]
    for i, p in enumerate(panels):
        px = PX + i * (pw + 40)
        py = 100
        ph = H - PY - 220
        draw_card(c, px, py, pw, ph)
        c.setFillColor(p["accent"])
        c.roundRect(px, py + ph - 8, pw, 8, 8, fill=1, stroke=0)
        c.rect(px, py + ph - 8, pw, 4, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(F_TITLE, 22)
        c.drawString(px + 24, py + ph - 48, p["title"])
        hline(c, px + 24, py + ph - 60, pw - 48, color=NAVY_LIGHT)
        c.setFillColor(p["accent"])
        c.setFont(F_HERO, 42)
        c.drawString(px + 24, py + 80, p["kpi"])
        para(c, p["label"], px + 24, py + 60, pw - 48, size=16, leading=24, color=MUTED)
    footer_line(c)
    page_number(c, 12)

def slide_13_programas(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "PROGRAMAS FEDERAIS")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 52)
    c.drawString(PX, H - PY - 82, "PROGRAMAS")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 140, "FEDERAIS")
    cols = [
        {"title": "Gestao", "items": ["PAR — Plano de Acoes Articuladas", "PDDE — Dinheiro Direto", "CACS FUNDEB", "Conselhos Escolares"]},
        {"title": "Infra e Tech", "items": ["Proinfancia", "Proinfo", "Programa do Livro", "PDE Escola"]},
        {"title": "Alimentacao", "items": ["PNAE — Alimentacao Escolar", "PNATE — Transporte Escolar", "Controle social PNAE", "Recalculo anual"]},
    ]
    cw = (CW - 40) / 3
    for i, col in enumerate(cols):
        cx = PX + i * (cw + 20)
        cy_top = H - PY - 200
        c.setFillColor(BLUE_BRIGHT)
        c.setFont(F_TITLE, 22)
        c.drawString(cx, cy_top, col["title"])
        accent_bar(c, cx, cy_top - 10, 3, w=40, color=BLUE_ACC)
        yy = cy_top - 30
        for item in col["items"]:
            c.setFillColor(NAVY_LIGHT)
            c.circle(cx + 5, yy - 6, 3, fill=1, stroke=0)
            yy = para(c, item, cx + 18, yy + 1, cw - 20, size=16, leading=24, color=MUTED)
            yy -= 5
    footer_line(c)
    page_number(c, 13)

def slide_14_prova_social(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "PROVA SOCIAL")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 42)
    c.drawString(PX, H - PY - 78, "O que dizem")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 126, "nossos clientes")
    hline(c, PX, H - PY - 145, CW, color=NAVY_LIGHT)
    depoimentos = [
        {"texto": "A Rocha Prime transformou a gestao educacional do nosso municipio. Conseguimos captar recursos que nao sabiamos existir.", "autor": "Secretario de Educacao"},
        {"texto": "A equipe tecnica e extremamente qualificada e comprometida com resultados. Recomendo sem hesitacao.", "autor": "Prefeito Municipal"},
    ]
    pw = CW / 2 - 20
    for i, dep in enumerate(depoimentos):
        dx = PX + i * (pw + 40)
        dy = 100
        dh = H - PY - 220
        draw_card(c, dx, dy, pw, dh)
        # Quote mark
        c.setFillColor(BLUE_ACC, alpha=0.15)
        c.setFont(F_HERO, 120)
        c.drawString(dx + 16, dy + dh - 100, '"')
        para(c, dep["texto"], dx + 24, dy + dh - 60, pw - 48, size=18, leading=30, color=LIGHT_TEXT)
        c.setFillColor(BLUE_BRIGHT)
        c.setFont(F_SEMI, 14)
        c.drawString(dx + 24, dy + 24, f"— {dep['autor']}")
    footer_line(c)
    page_number(c, 14)

def slide_15_investimento(c):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "INVESTIMENTO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 48)
    c.drawString(PX, H - PY - 84, "Investimento")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 140, "que se paga")
    hline(c, PX, H - PY - 160, CW, color=NAVY_LIGHT)
    para(c,
         "O investimento na consultoria Rocha Prime e proporcional ao porte do municipio "
         "e ao potencial de captacao identificado no diagnostico inicial. "
         "Em media, o retorno sobre o investimento supera 10x o valor contratado.",
         PX, H - PY - 195, CW, size=21, leading=34, color=MUTED)
    # ROI highlight
    draw_card(c, PX, 110, CW, 130)
    c.setFillColor(GREEN_LIGHT)
    c.setFont(F_HERO, 52)
    c.drawString(PX + 30, 170, "ROI > 10x")
    c.setFillColor(MUTED)
    c.setFont(F_BODY, 20)
    c.drawString(PX + 340, 178, "retorno medio sobre o investimento")
    c.setFillColor(LIGHT_TEXT)
    c.setFont(F_BODY, 16)
    c.drawString(PX + 30, 128, "* Baseado em resultados historicos de municipios atendidos pela Rocha Prime")
    footer_line(c)
    page_number(c, 15)

def slide_16_contato(c):
    c.setFillColor(NAVY_DEEP)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(BLUE_ACC, alpha=0.08)
    for i in range(6):
        c.rect(W - 6 - i * 6, 0, 6 + i * 6, H, fill=1, stroke=0)

    c.setFillColor(WHITE)
    c.setFont(F_HERO, 56)
    c.drawCentredString(W / 2, H - PY - 100, "VAMOS CONVERSAR?")
    c.setFillColor(BLUE_ACC)
    c.rect(W / 2 - 40, H - PY - 130, 80, 3, fill=1, stroke=0)
    contatos = [
        "Tel: (61) 99866-7834",
        "E-mail: contato@rochaprime.com.br",
        "Site: www.rochaprime.com.br",
    ]
    yy = H / 2 + 20
    for contato in contatos:
        para(c, contato, W / 2 - 250, yy, 500, size=22, color=LIGHT_TEXT, align=TA_CENTER)
        yy -= 40
    c.setFillColor(MUTED)
    c.setFont(F_BODY, 14)
    c.drawCentredString(W / 2, 100, "ROCHA PRIME SERVICOS ESPECIALIZADOS LTDA")
    c.drawCentredString(W / 2, 80, "CNPJ: 29.342.691/0001-93")
    footer_line(c)
    page_number(c, 16)

# ── MAIN ──────────────────────────────────────────────────────
def gerar_pdf(payload) -> str:
    fd, path = tempfile.mkstemp(suffix=".pdf", prefix="slides_institucional_")
    os.close(fd)
    c = canvas.Canvas(path, pagesize=(W, H))

    slides = [
        slide_01_capa,
        slide_02_quem_somos,
        slide_03_missao,
        slide_04_fundeb,
        slide_05_sistemas,
        slide_06_terceirizacao,
        slide_07_formacao,
        slide_08_diferenciais,
        slide_09_metodologia,
        slide_10_resultados,
        slide_11_sistemas_oficiais,
        slide_12_case,
        slide_13_programas,
        slide_14_prova_social,
        slide_15_investimento,
        slide_16_contato,
    ]

    for i, slide_fn in enumerate(slides):
        slide_fn(c)
        if i < len(slides) - 1:
            c.showPage()

    c.save()
    return path


if __name__ == "__main__":
    raw = sys.stdin.buffer.read().decode("utf-8-sig")
    payload = json.loads(raw)
    print(gerar_pdf(payload), flush=True)
