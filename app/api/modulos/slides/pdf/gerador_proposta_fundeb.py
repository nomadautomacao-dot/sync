"""
gerador_proposta_fundeb.py
==========================
Motor de geracao do deck Proposta FUNDEB Municipal (12 slides)
Formato 16:9 (1280x720). Usa dados reais do municipio.
Le JSON via stdin, imprime caminho do PDF gerado em stdout.
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

# Import duro: proposta sem identidade confiavel nao deve sair.
from kit_padrao_pdf.empresa import RAZAO_SOCIAL, CNPJ, linhas_de_contato

try:
    from kit_padrao_pdf.report_style_pdf import fmt_money, fmt_int
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

PX, PY = 90, 55
CW = W - 2 * PX

F_HERO  = "Helvetica-Bold"
F_TITLE = "Helvetica-Bold"
F_SEMI  = "Helvetica-Bold"
F_BODY  = "Helvetica"

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

def page_number(c, n, total=12):
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

def safe_get(d, *keys, default=None):
    current = d
    for k in keys:
        if isinstance(current, dict):
            current = current.get(k)
        else:
            return default
        if current is None:
            return default
    return current

def f_money_safe(v):
    try:
        return fmt_money(float(v or 0))
    except Exception:
        return "R$ 0,00"

def f_int_safe(v):
    try:
        return fmt_int(int(v or 0))
    except Exception:
        return "0"

def f_pct_safe(v):
    try:
        return f"{float(v or 0):.1f}%".replace(".", ",")
    except Exception:
        return "0,0%"

# ── SLIDES ────────────────────────────────────────────────────
def slide_01_capa(c, payload):
    c.setFillColor(NAVY_DEEP)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(BLUE_ACC, alpha=0.15)
    for i in range(8):
        c.rect(0, 0, 6 + i * 6, H, fill=1, stroke=0)

    mun = safe_get(payload, "municipio", default={})
    nome = safe_get(mun, "nome", default="Municipio")
    uf = safe_get(mun, "uf", default="")
    prefeito = safe_get(mun, "prefeito", default="")
    mun_label = f"{nome} — {uf}" if uf else nome

    section_badge(c, PX, H - PY - 22, "PROPOSTA FUNDEB · 2026")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 56)
    c.drawString(PX, H - PY - 100, "PROPOSTA FUNDEB")
    c.setFillColor(BLUE_BRIGHT)
    c.setFont(F_HERO, 48)
    c.drawString(PX, H - PY - 165, mun_label.upper())
    c.setFillColor(BLUE_ACC)
    c.rect(PX, H - PY - 190, 80, 3, fill=1, stroke=0)
    if prefeito:
        para(c, f"Exmo(a). Sr(a). {prefeito}", PX, H - PY - 210, CW, size=20, color=MUTED)
    para(c, "Global Company", PX, H - PY - 250, CW, size=18, color=MUTED)
    footer_line(c)
    page_number(c, 1)

def slide_02_dados_gerais(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "DADOS GERAIS")
    mun = safe_get(payload, "municipio", default={})

    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "Dados Gerais")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 132, safe_get(mun, "nome", default="Municipio"))

    cards_data = [
        ("POPULACAO", f_int_safe(safe_get(mun, "populacao")), "habitantes"),
        ("PREFEITO(A)", safe_get(mun, "prefeito", default="-"), safe_get(mun, "partido", default="")),
        ("UF", safe_get(mun, "uf", default="-"), ""),
        ("PIB PER CAPITA", f_money_safe(safe_get(mun, "pibPerCapita")), ""),
        ("IDHM", str(safe_get(mun, "idhm", default="-")), ""),
        ("COD. IBGE", safe_get(mun, "codigoIbge", default="-"), ""),
    ]
    cw = (CW - 20) / 3
    card_h = 130
    for i, (label, value, sub) in enumerate(cards_data):
        col = i % 3
        row = i // 3
        cx = PX + col * (cw + 10)
        cy = H - PY - 180 - row * (card_h + 16)
        draw_card(c, cx, cy, cw, card_h)
        c.setFillColor(MUTED)
        c.setFont(F_SEMI, 11)
        c.drawString(cx + 16, cy + card_h - 24, label)
        c.setFillColor(WHITE)
        c.setFont(F_HERO, 24)
        # Truncate long values
        disp_val = str(value)[:22]
        c.drawString(cx + 16, cy + card_h - 58, disp_val)
        if sub:
            c.setFillColor(MUTED)
            c.setFont(F_BODY, 13)
            c.drawString(cx + 16, cy + card_h - 80, str(sub)[:30])
    footer_line(c)
    page_number(c, 2)

def slide_03_receita_historica(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "RECEITA FUNDEB")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "Receita FUNDEB")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 132, "Evolucao Historica")

    receitas = safe_get(payload, "fundeb", "receitas", default=[])
    if not receitas:
        para(c, "Dados historicos nao disponiveis.", PX, H - PY - 200, CW, size=20, color=MUTED)
        footer_line(c)
        page_number(c, 3)
        return

    # Find max for bar scaling
    max_val = max((float(r.get("totalReceitas", 0) or 0) for r in receitas), default=1)
    if max_val <= 0:
        max_val = 1

    bar_area_top = H - PY - 180
    bar_area_bot = 90
    bar_area_h = bar_area_top - bar_area_bot
    n = len(receitas)
    bar_gap = 12
    bar_h = min(60, (bar_area_h - (n - 1) * bar_gap) / max(n, 1))

    for i, rec in enumerate(receitas):
        ano = rec.get("ano", "")
        total = float(rec.get("totalReceitas", 0) or 0)
        bar_y = bar_area_top - i * (bar_h + bar_gap) - bar_h
        bar_w_max = CW - 200
        bar_w = max(10, (total / max_val) * bar_w_max) if max_val > 0 else 10

        # Year label
        c.setFillColor(MUTED)
        c.setFont(F_SEMI, 16)
        c.drawString(PX, bar_y + bar_h / 2 - 6, str(ano))

        # Bar
        bar_x = PX + 80
        c.setFillColor(BLUE_ACC)
        c.roundRect(bar_x, bar_y, bar_w, bar_h, 4, fill=1, stroke=0)

        # Value
        c.setFillColor(WHITE)
        c.setFont(F_SEMI, 14)
        c.drawString(bar_x + bar_w + 12, bar_y + bar_h / 2 - 6, f_money_safe(total))

    footer_line(c)
    page_number(c, 3)

def slide_04_composicao(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "COMPOSICAO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "Composicao")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 132, "VAAF / VAAT / VAAR")

    fundeb = safe_get(payload, "fundeb", default={})
    receita_atual = safe_get(fundeb, "receitaAtual", default={})
    total = float(safe_get(receita_atual, "totalReceitas", default=0) or 0)
    contrib = float(safe_get(receita_atual, "receitaContribuicaoMunicipal", default=0) or 0)
    vaaf = float(safe_get(receita_atual, "complementacaoVAAF", default=0) or 0)
    vaat = float(safe_get(receita_atual, "complementacaoVAAT", default=0) or 0)
    vaar = float(safe_get(receita_atual, "complementacaoVAAR", default=0) or 0)

    items = [
        ("Contribuicao Municipal", contrib, BLUE_ACC),
        ("Complementacao VAAF", vaaf, BLUE_BRIGHT),
        ("Complementacao VAAT", vaat, GREEN_LIGHT),
        ("Complementacao VAAR", vaar, AMBER),
    ]
    bar_max = max(total, 1)
    bar_top = H - PY - 190
    bar_h = 50
    bar_gap = 20
    bar_w_max = CW - 300

    for i, (label, val, color) in enumerate(items):
        by = bar_top - i * (bar_h + bar_gap)
        bw = max(8, (val / bar_max) * bar_w_max) if bar_max > 0 else 8
        # Label
        c.setFillColor(MUTED)
        c.setFont(F_SEMI, 14)
        c.drawString(PX, by + bar_h / 2 - 6, label)
        # Bar
        bar_x = PX + 260
        c.setFillColor(color)
        c.roundRect(bar_x, by, bw, bar_h, 4, fill=1, stroke=0)
        # Value
        c.setFillColor(WHITE)
        c.setFont(F_SEMI, 14)
        c.drawString(bar_x + bw + 12, by + bar_h / 2 - 6, f_money_safe(val))

    # Total card
    draw_card(c, PX, 80, CW, 70)
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 28)
    c.drawString(PX + 20, 100, f"TOTAL: {f_money_safe(total)}")

    footer_line(c)
    page_number(c, 4)

def slide_05_projecao(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "PROJECAO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "Projecao de")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 132, "Ganhos Potenciais")

    fundeb = safe_get(payload, "fundeb", default={})
    receita_atual = safe_get(fundeb, "receitaAtual", default={})
    total_atual = float(safe_get(receita_atual, "totalReceitas", default=0) or 0)
    # Estimate potential (simplified: 15-30% gain estimate)
    ganho_estimado = total_atual * 0.20
    total_projetado = total_atual + ganho_estimado

    pw = CW / 2 - 20
    card_h = 200
    card_y = H / 2 - card_h / 2 - 40

    # Current card
    draw_card(c, PX, card_y, pw, card_h)
    c.setFillColor(MUTED)
    c.setFont(F_SEMI, 14)
    c.drawString(PX + 24, card_y + card_h - 30, "CENARIO ATUAL")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 36)
    c.drawString(PX + 24, card_y + card_h - 80, f_money_safe(total_atual))
    para(c, "Receita total consolidada do FUNDEB no exercicio corrente.",
         PX + 24, card_y + card_h - 100, pw - 48, size=16, leading=24, color=MUTED)

    # Projected card
    rx = W / 2 + 10
    draw_card(c, rx, card_y, pw, card_h, stroke=GREEN_LIGHT)
    c.setFillColor(GREEN_LIGHT)
    c.roundRect(rx, card_y + card_h - 8, pw, 8, 8, fill=1, stroke=0)
    c.rect(rx, card_y + card_h - 8, pw, 4, fill=1, stroke=0)
    c.setFillColor(GREEN_LIGHT)
    c.setFont(F_SEMI, 14)
    c.drawString(rx + 24, card_y + card_h - 30, "CENARIO PROJETADO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 36)
    c.drawString(rx + 24, card_y + card_h - 80, f_money_safe(total_projetado))
    para(c, f"Potencial de incremento: {f_money_safe(ganho_estimado)}",
         rx + 24, card_y + card_h - 100, pw - 48, size=16, leading=24, color=GREEN_LIGHT)

    # Delta highlight
    draw_card(c, PX, 80, CW, 70, stroke=GREEN_LIGHT)
    c.setFillColor(GREEN_LIGHT)
    c.setFont(F_HERO, 28)
    c.drawString(PX + 20, 100, f"GANHO POTENCIAL: {f_money_safe(ganho_estimado)}")
    c.setFillColor(MUTED)
    c.setFont(F_BODY, 16)
    c.drawString(PX + 520, 104, "estimativa baseada em diagnostico tecnico Global Company")

    footer_line(c)
    page_number(c, 5)

def slide_06_censo(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "CENSO ESCOLAR")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "Censo Escolar")

    censo = safe_get(payload, "censo", default={})
    ano_ref = safe_get(censo, "anoReferencia", default="")
    if ano_ref:
        c.setFillColor(BLUE_BRIGHT)
        c.drawString(PX + 420, H - PY - 84, str(ano_ref))

    cards_data = [
        ("ESCOLAS", f_int_safe(safe_get(censo, "escolas")), "unidades municipais", BLUE_ACC),
        ("MATRICULAS", f_int_safe(safe_get(censo, "matriculas")), "alunos matriculados", BLUE_BRIGHT),
        ("DOCENTES", f_int_safe(safe_get(censo, "docentes")), "professores na rede", GREEN_LIGHT),
        ("ED. INFANTIL", f_int_safe(safe_get(censo, "educacaoInfantil")), "matriculas", AMBER),
    ]
    cw = (CW - 30) / 4
    card_h = 180
    card_y = H / 2 - card_h / 2 - 20
    for i, (label, value, sub, accent) in enumerate(cards_data):
        cx = PX + i * (cw + 10)
        draw_card(c, cx, card_y, cw, card_h)
        c.setFillColor(accent)
        c.roundRect(cx, card_y + card_h - 8, cw, 8, 8, fill=1, stroke=0)
        c.rect(cx, card_y + card_h - 8, cw, 4, fill=1, stroke=0)
        c.setFillColor(MUTED)
        c.setFont(F_SEMI, 12)
        c.drawString(cx + 16, card_y + card_h - 30, label)
        c.setFillColor(accent)
        c.setFont(F_HERO, 36)
        c.drawString(cx + 16, card_y + card_h - 80, value)
        c.setFillColor(MUTED)
        c.setFont(F_BODY, 13)
        c.drawString(cx + 16, card_y + 16, sub)

    footer_line(c)
    page_number(c, 6)

def slide_07_ideb(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "IDEB")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "Indicadores")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 132, "IDEB Municipal")

    ideb = safe_get(payload, "ideb", default={})
    anos_ini = safe_get(ideb, "anosIniciais", default=None)
    anos_fin = safe_get(ideb, "anosFinais", default=None)
    ano_ref = safe_get(ideb, "anoReferencia", default="")

    pw = CW / 2 - 20
    card_h = 220
    card_y = H / 2 - card_h / 2 - 20

    # Anos iniciais
    draw_card(c, PX, card_y, pw, card_h, stroke=BLUE_ACC)
    c.setFillColor(BLUE_ACC)
    c.roundRect(PX, card_y + card_h - 8, pw, 8, 8, fill=1, stroke=0)
    c.rect(PX, card_y + card_h - 8, pw, 4, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont(F_SEMI, 14)
    c.drawString(PX + 24, card_y + card_h - 34, "ANOS INICIAIS")
    if anos_ini is not None:
        c.setFillColor(BLUE_BRIGHT)
        c.setFont(F_HERO, 72)
        c.drawCentredString(PX + pw / 2, card_y + card_h / 2 - 20, str(anos_ini))
    else:
        c.setFillColor(MUTED)
        c.setFont(F_HERO, 36)
        c.drawCentredString(PX + pw / 2, card_y + card_h / 2 - 10, "-")
    if ano_ref:
        c.setFillColor(MUTED)
        c.setFont(F_BODY, 14)
        c.drawCentredString(PX + pw / 2, card_y + 20, f"Referencia: {ano_ref}")

    # Anos finais
    rx = W / 2 + 10
    draw_card(c, rx, card_y, pw, card_h, stroke=GREEN_LIGHT)
    c.setFillColor(GREEN_LIGHT)
    c.roundRect(rx, card_y + card_h - 8, pw, 8, 8, fill=1, stroke=0)
    c.rect(rx, card_y + card_h - 8, pw, 4, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont(F_SEMI, 14)
    c.drawString(rx + 24, card_y + card_h - 34, "ANOS FINAIS")
    if anos_fin is not None:
        c.setFillColor(GREEN_LIGHT)
        c.setFont(F_HERO, 72)
        c.drawCentredString(rx + pw / 2, card_y + card_h / 2 - 20, str(anos_fin))
    else:
        c.setFillColor(MUTED)
        c.setFont(F_HERO, 36)
        c.drawCentredString(rx + pw / 2, card_y + card_h / 2 - 10, "-")
    if ano_ref:
        c.setFillColor(MUTED)
        c.setFont(F_BODY, 14)
        c.drawCentredString(rx + pw / 2, card_y + 20, f"Referencia: {ano_ref}")

    footer_line(c)
    page_number(c, 7)

def slide_08_oportunidades(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "OPORTUNIDADES")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "Oportunidades")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 132, "Identificadas")
    hline(c, PX, H - PY - 150, CW, color=NAVY_LIGHT)

    fundeb = safe_get(payload, "fundeb", default={})
    receita_atual = safe_get(fundeb, "receitaAtual", default={})
    vaaf = float(safe_get(receita_atual, "complementacaoVAAF", default=0) or 0)
    vaat = float(safe_get(receita_atual, "complementacaoVAAT", default=0) or 0)
    vaar = float(safe_get(receita_atual, "complementacaoVAAR", default=0) or 0)

    oportunidades = []
    if vaaf == 0:
        oportunidades.append("Complementacao VAAF nao recebida — potencial de captacao identificado")
    if vaat == 0:
        oportunidades.append("Complementacao VAAT nao recebida — verificar habilitacao junto ao FNDE")
    if vaar == 0:
        oportunidades.append("Complementacao VAAR nao recebida — vinculada a indicadores educacionais")
    oportunidades.extend([
        "Revisao das bases do Censo Escolar para maximizacao de receitas",
        "Organizacao documental para conformidade com SIOPE e SIGPC",
        "Capacitacao da equipe para operacao autonoma dos sistemas oficiais",
    ])

    bullet_list(c, oportunidades[:6], PX, H - PY - 185, CW, size=18)
    footer_line(c)
    page_number(c, 8)

def slide_09_servicos(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "SERVICOS PROPOSTOS")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "Servicos")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 132, "Propostos")

    servicos = [
        {"num": "01", "title": "Diagnostico\nFUNDEB", "body": "Levantamento completo\nde receitas, projecoes\ne oportunidades."},
        {"num": "02", "title": "Gestao de\nSistemas", "body": "Operacao de SIOPE,\nSIGPC, PAR, PDDE\ne demais sistemas."},
        {"num": "03", "title": "Formacao\nTecnica", "body": "Capacitacao da equipe\nda secretaria para\nautonomia operacional."},
        {"num": "04", "title": "Monitoramento\nContinuo", "body": "Acompanhamento de\nprazos, entregas e\nindicadores."},
    ]
    cw = (CW - 30) / 4
    card_h = H - PY - 220
    card_y = 80
    for i, srv in enumerate(servicos):
        cx = PX + i * (cw + 10)
        draw_card(c, cx, card_y, cw, card_h)
        c.setFillColor(BLUE_BRIGHT)
        c.setFont(F_HERO, 28)
        c.drawString(cx + 14, card_y + card_h - 38, srv["num"])
        para(c, srv["title"], cx + 14, card_y + card_h - 60, cw - 28, size=18, leading=26, color=WHITE, font=F_SEMI)
        hline(c, cx + 14, card_y + card_h - 120, cw - 28, color=NAVY_LIGHT)
        para(c, srv["body"], cx + 14, card_y + card_h - 135, cw - 28, size=15, leading=23, color=MUTED)
    footer_line(c)
    page_number(c, 9)

def slide_10_investimento(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "INVESTIMENTO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 48)
    c.drawString(PX, H - PY - 84, "Investimento")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 140, "sob medida")
    hline(c, PX, H - PY - 160, CW, color=NAVY_LIGHT)
    para(c,
         "O investimento e dimensionado de acordo com o porte do municipio, "
         "a complexidade da rede educacional e o potencial de captacao identificado. "
         "A proposta comercial detalhada sera apresentada apos o diagnostico inicial.",
         PX, H - PY - 195, CW, size=21, leading=34, color=MUTED)
    draw_card(c, PX, 110, CW, 130)
    c.setFillColor(GREEN_LIGHT)
    c.setFont(F_HERO, 44)
    c.drawString(PX + 30, 168, "ROI > 10x")
    c.setFillColor(MUTED)
    c.setFont(F_BODY, 18)
    c.drawString(PX + 300, 174, "retorno medio sobre o investimento")
    c.setFillColor(LIGHT_TEXT)
    c.setFont(F_BODY, 14)
    c.drawString(PX + 30, 128, "* Valores sujeitos a analise tecnica do municipio")
    footer_line(c)
    page_number(c, 10)

def slide_11_cronograma(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "CRONOGRAMA")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "Cronograma de")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 132, "Implementacao")

    etapas = [
        ("Mes 1-2", "Diagnostico e Levantamento", "Analise completa das bases FUNDEB, Censo Escolar e sistemas."),
        ("Mes 3-4", "Organizacao e Ajustes", "Correcao de bases, organizacao documental e ajuste de sistemas."),
        ("Mes 5-6", "Operacao e Monitoramento", "Gestao ativa dos sistemas, capacitacao e acompanhamento."),
    ]
    cw = (CW - 40) / 3
    card_h = 220
    card_y = H / 2 - card_h / 2 - 30

    for i, (periodo, titulo, desc) in enumerate(etapas):
        cx = PX + i * (cw + 20)
        draw_card(c, cx, card_y, cw, card_h)
        c.setFillColor(BLUE_ACC)
        c.roundRect(cx, card_y + card_h - 8, cw, 8, 8, fill=1, stroke=0)
        c.rect(cx, card_y + card_h - 8, cw, 4, fill=1, stroke=0)
        c.setFillColor(BLUE_BRIGHT)
        c.setFont(F_SEMI, 14)
        c.drawString(cx + 20, card_y + card_h - 30, periodo)
        c.setFillColor(WHITE)
        c.setFont(F_TITLE, 20)
        c.drawString(cx + 20, card_y + card_h - 58, titulo)
        hline(c, cx + 20, card_y + card_h - 70, cw - 40, color=NAVY_LIGHT)
        para(c, desc, cx + 20, card_y + card_h - 84, cw - 40, size=15, leading=23, color=MUTED)

        # Arrow between cards
        if i < 2:
            arrow_x = cx + cw + 6
            arrow_y = card_y + card_h / 2
            c.setStrokeColor(BLUE_ACC)
            c.setLineWidth(3)
            c.line(arrow_x, arrow_y, arrow_x + 10, arrow_y + 10)
            c.line(arrow_x, arrow_y, arrow_x + 10, arrow_y - 10)

    footer_line(c)
    page_number(c, 11)

def slide_12_contato(c, payload):
    c.setFillColor(NAVY_DEEP)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(BLUE_ACC, alpha=0.08)
    for i in range(6):
        c.rect(W - 6 - i * 6, 0, 6 + i * 6, H, fill=1, stroke=0)

    mun = safe_get(payload, "municipio", default={})
    nome = safe_get(mun, "nome", default="")

    c.setFillColor(WHITE)
    c.setFont(F_HERO, 56)
    c.drawCentredString(W / 2, H - PY - 100, "VAMOS COMECAR?")
    c.setFillColor(BLUE_ACC)
    c.rect(W / 2 - 40, H - PY - 130, 80, 3, fill=1, stroke=0)
    if nome:
        para(c, f"Estamos prontos para transformar a gestao educacional de {nome}.",
             W / 2 - 300, H / 2 + 50, 600, size=20, color=MUTED, align=TA_CENTER)

    contatos = linhas_de_contato()
    yy = H / 2 - 20
    for contato in contatos:
        para(c, contato, W / 2 - 250, yy, 500, size=22, color=LIGHT_TEXT, align=TA_CENTER)
        yy -= 40

    c.setFillColor(MUTED)
    c.setFont(F_BODY, 14)
    c.drawCentredString(W / 2, 100, RAZAO_SOCIAL)
    c.drawCentredString(W / 2, 80, "CNPJ: " + CNPJ)
    footer_line(c)
    page_number(c, 12)

# ── MAIN ──────────────────────────────────────────────────────
def gerar_pdf(payload) -> str:
    fd, path = tempfile.mkstemp(suffix=".pdf", prefix="slides_proposta_fundeb_")
    os.close(fd)
    c = canvas.Canvas(path, pagesize=(W, H))

    slides = [
        slide_01_capa,
        slide_02_dados_gerais,
        slide_03_receita_historica,
        slide_04_composicao,
        slide_05_projecao,
        slide_06_censo,
        slide_07_ideb,
        slide_08_oportunidades,
        slide_09_servicos,
        slide_10_investimento,
        slide_11_cronograma,
        slide_12_contato,
    ]

    for i, slide_fn in enumerate(slides):
        slide_fn(c, payload)
        if i < len(slides) - 1:
            c.showPage()

    c.save()
    return path


if __name__ == "__main__":
    raw = sys.stdin.buffer.read().decode("utf-8-sig")
    payload = json.loads(raw)
    print(gerar_pdf(payload), flush=True)
