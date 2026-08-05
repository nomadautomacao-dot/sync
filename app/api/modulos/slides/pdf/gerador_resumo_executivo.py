"""
gerador_resumo_executivo.py
===========================
Motor de geracao do deck Resumo Executivo (7 slides)
Formato 16:9 (1280x720). Versao compacta com indicadores-chave.
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

# Import duro: deck sem identidade confiavel nao deve sair.
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

def page_number(c, n, total=7):
    c.setFillColor(MUTED)
    c.setFont(F_BODY, 11)
    c.drawRightString(W - PX, 28, f"{n:02d} / {total:02d}")

def footer_line(c):
    hline(c, PX, 52, CW, color=NAVY_LIGHT, lw=0.5)

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
    mun_label = f"{nome} — {uf}" if uf else nome

    section_badge(c, PX, H - PY - 22, "RESUMO EXECUTIVO · 2026")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 56)
    c.drawString(PX, H - PY - 100, "RESUMO EXECUTIVO")
    c.setFillColor(BLUE_BRIGHT)
    c.setFont(F_HERO, 48)
    c.drawString(PX, H - PY - 165, mun_label.upper())
    c.setFillColor(BLUE_ACC)
    c.rect(PX, H - PY - 190, 80, 3, fill=1, stroke=0)
    para(c, "Global Company — Inteligencia Tecnica para Gestao Educacional",
         PX, H - PY - 210, CW, size=20, color=MUTED)

    # Compact info strip
    prefeito = safe_get(mun, "prefeito", default="")
    partido = safe_get(mun, "partido", default="")
    if prefeito:
        info = f"Prefeito(a): {prefeito}"
        if partido:
            info += f" ({partido})"
        para(c, info, PX, H - PY - 250, CW, size=16, color=MUTED)

    footer_line(c)
    page_number(c, 1)

def slide_02_diagnostico(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "DIAGNOSTICO RAPIDO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 48)
    c.drawString(PX, H - PY - 84, "Diagnostico")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 140, "Rapido")

    mun = safe_get(payload, "municipio", default={})
    censo = safe_get(payload, "censo", default={})

    cards_data = [
        ("POPULACAO", f_int_safe(safe_get(mun, "populacao")), "habitantes", BLUE_ACC),
        ("ESCOLAS", f_int_safe(safe_get(censo, "escolas")), "unidades municipais", BLUE_BRIGHT),
        ("MATRICULAS", f_int_safe(safe_get(censo, "matriculas")), "alunos", GREEN_LIGHT),
        ("DOCENTES", f_int_safe(safe_get(censo, "docentes")), "professores", AMBER),
        ("PREFEITO(A)", safe_get(mun, "prefeito", default="-"), safe_get(mun, "partido", default=""), BLUE_ACC),
        ("IDHM", str(safe_get(mun, "idhm", default="-")), "", GREEN_LIGHT),
    ]

    cw = (CW - 20) / 3
    card_h = 140
    for i, (label, value, sub, accent) in enumerate(cards_data):
        col = i % 3
        row = i // 3
        cx = PX + col * (cw + 10)
        cy = H - PY - 180 - row * (card_h + 16)
        draw_card(c, cx, cy, cw, card_h)
        c.setFillColor(accent)
        c.roundRect(cx, cy + card_h - 8, cw, 8, 8, fill=1, stroke=0)
        c.rect(cx, cy + card_h - 8, cw, 4, fill=1, stroke=0)
        c.setFillColor(MUTED)
        c.setFont(F_SEMI, 11)
        c.drawString(cx + 16, cy + card_h - 28, label)
        c.setFillColor(WHITE)
        # Adjust font for long values
        val_str = str(value)[:20]
        fsize = 32 if len(val_str) < 14 else 22
        c.setFont(F_HERO, fsize)
        c.drawString(cx + 16, cy + card_h - 68, val_str)
        if sub:
            c.setFillColor(MUTED)
            c.setFont(F_BODY, 12)
            c.drawString(cx + 16, cy + 14, str(sub)[:30])

    footer_line(c)
    page_number(c, 2)

def slide_03_receita(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "RECEITA FUNDEB")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 48)
    c.drawString(PX, H - PY - 84, "Receita FUNDEB")

    fundeb = safe_get(payload, "fundeb", default={})
    receita_atual = safe_get(fundeb, "receitaAtual", default={})
    total = float(safe_get(receita_atual, "totalReceitas", default=0) or 0)
    contrib = float(safe_get(receita_atual, "receitaContribuicaoMunicipal", default=0) or 0)
    vaaf = float(safe_get(receita_atual, "complementacaoVAAF", default=0) or 0)
    vaat = float(safe_get(receita_atual, "complementacaoVAAT", default=0) or 0)
    vaar = float(safe_get(receita_atual, "complementacaoVAAR", default=0) or 0)

    # Total highlight
    c.setFillColor(BLUE_BRIGHT)
    c.setFont(F_HERO, 36)
    c.drawString(PX + 520, H - PY - 84, f_money_safe(total))

    # Visual bars
    items = [
        ("Contribuicao Municipal", contrib, BLUE_ACC),
        ("VAAF", vaaf, BLUE_BRIGHT),
        ("VAAT", vaat, GREEN_LIGHT),
        ("VAAR", vaar, AMBER),
    ]
    bar_max = max(total, 1)
    bar_top = H - PY - 150
    bar_h = 55
    bar_gap = 16
    bar_w_max = CW - 280

    for i, (label, val, color) in enumerate(items):
        by = bar_top - i * (bar_h + bar_gap)
        bw = max(8, (val / bar_max) * bar_w_max) if bar_max > 0 else 8
        c.setFillColor(MUTED)
        c.setFont(F_SEMI, 14)
        c.drawString(PX, by + bar_h / 2 - 6, label)
        bar_x = PX + 240
        c.setFillColor(color)
        c.roundRect(bar_x, by, bw, bar_h, 4, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(F_SEMI, 14)
        c.drawString(bar_x + bw + 12, by + bar_h / 2 - 6, f_money_safe(val))

    footer_line(c)
    page_number(c, 3)

def slide_04_projecao(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "PROJECAO DE GANHOS")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 48)
    c.drawString(PX, H - PY - 84, "Projecao de Ganhos")

    fundeb = safe_get(payload, "fundeb", default={})
    receita_atual = safe_get(fundeb, "receitaAtual", default={})
    total_atual = float(safe_get(receita_atual, "totalReceitas", default=0) or 0)
    ganho_estimado = total_atual * 0.20
    total_projetado = total_atual + ganho_estimado

    pw = (CW - 30) / 3
    card_h = 220
    card_y = H / 2 - card_h / 2 - 20

    panels = [
        ("ATUAL", f_money_safe(total_atual), "receita consolidada", BLUE_ACC, NAVY_LIGHT),
        ("PROJETADO", f_money_safe(total_projetado), "com otimizacao", GREEN_LIGHT, GREEN_LIGHT),
        ("DELTA", f"+ {f_money_safe(ganho_estimado)}", "ganho potencial", AMBER, AMBER),
    ]
    for i, (title, value, sub, accent, border) in enumerate(panels):
        cx = PX + i * (pw + 15)
        draw_card(c, cx, card_y, pw, card_h, stroke=border)
        c.setFillColor(accent)
        c.roundRect(cx, card_y + card_h - 8, pw, 8, 8, fill=1, stroke=0)
        c.rect(cx, card_y + card_h - 8, pw, 4, fill=1, stroke=0)
        c.setFillColor(MUTED)
        c.setFont(F_SEMI, 14)
        c.drawString(cx + 20, card_y + card_h - 34, title)
        c.setFillColor(WHITE)
        c.setFont(F_HERO, 28)
        c.drawString(cx + 20, card_y + card_h - 80, value)
        c.setFillColor(MUTED)
        c.setFont(F_BODY, 14)
        c.drawString(cx + 20, card_y + 16, sub)

    footer_line(c)
    page_number(c, 4)

def slide_05_indicadores(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "INDICADORES EDUCACIONAIS")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 44)
    c.drawString(PX, H - PY - 84, "Indicadores")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 132, "Educacionais")

    ideb = safe_get(payload, "ideb", default={})
    censo = safe_get(payload, "censo", default={})

    # IDEB section
    pw = CW / 2 - 15
    card_h = 170
    card_y = H / 2 - card_h / 2 - 10

    # IDEB card
    draw_card(c, PX, card_y, pw, card_h)
    c.setFillColor(BLUE_ACC)
    c.roundRect(PX, card_y + card_h - 8, pw, 8, 8, fill=1, stroke=0)
    c.rect(PX, card_y + card_h - 8, pw, 4, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont(F_SEMI, 12)
    c.drawString(PX + 20, card_y + card_h - 28, "IDEB MUNICIPAL")

    ani = safe_get(ideb, "anosIniciais", default=None)
    af = safe_get(ideb, "anosFinais", default=None)
    # Two columns inside
    half = (pw - 40) / 2
    c.setFillColor(MUTED)
    c.setFont(F_BODY, 13)
    c.drawString(PX + 20, card_y + card_h - 55, "Anos Iniciais")
    c.drawString(PX + 20 + half + 10, card_y + card_h - 55, "Anos Finais")
    c.setFillColor(BLUE_BRIGHT)
    c.setFont(F_HERO, 52)
    c.drawString(PX + 20, card_y + card_h - 120, str(ani) if ani is not None else "-")
    c.setFillColor(GREEN_LIGHT)
    c.drawString(PX + 20 + half + 10, card_y + card_h - 120, str(af) if af is not None else "-")

    # Censo card
    rx = W / 2 + 5
    draw_card(c, rx, card_y, pw, card_h)
    c.setFillColor(GREEN_LIGHT)
    c.roundRect(rx, card_y + card_h - 8, pw, 8, 8, fill=1, stroke=0)
    c.rect(rx, card_y + card_h - 8, pw, 4, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont(F_SEMI, 12)
    c.drawString(rx + 20, card_y + card_h - 28, "CENSO ESCOLAR")

    esc_val = f_int_safe(safe_get(censo, "escolas"))
    mat_val = f_int_safe(safe_get(censo, "matriculas"))
    doc_val = f_int_safe(safe_get(censo, "docentes"))

    col_w = (pw - 30) / 3
    metrics = [
        ("Escolas", esc_val, BLUE_ACC),
        ("Matriculas", mat_val, BLUE_BRIGHT),
        ("Docentes", doc_val, AMBER),
    ]
    for j, (lbl, val, accent) in enumerate(metrics):
        mx = rx + 15 + j * col_w
        c.setFillColor(MUTED)
        c.setFont(F_BODY, 11)
        c.drawString(mx, card_y + card_h - 55, lbl)
        c.setFillColor(accent)
        c.setFont(F_HERO, 30)
        c.drawString(mx, card_y + card_h - 95, str(val)[:10])

    footer_line(c)
    page_number(c, 5)

def slide_06_proposta(c, payload):
    navy_base(c)
    section_badge(c, PX, H - PY - 22, "PROPOSTA DE SERVICO")
    c.setFillColor(WHITE)
    c.setFont(F_HERO, 48)
    c.drawString(PX, H - PY - 84, "Proposta de")
    c.setFillColor(BLUE_BRIGHT)
    c.drawString(PX, H - PY - 140, "Servico")

    servicos = [
        {"title": "Consultoria\nFUNDEB", "body": "Diagnostico, projecao de ganhos\ne acompanhamento de receitas.", "accent": BLUE_ACC},
        {"title": "Gestao de\nSistemas", "body": "SIOPE, SIGPC, PAR, PDDE e\ndemais sistemas oficiais.", "accent": BLUE_BRIGHT},
        {"title": "Formacao\nTecnica", "body": "Capacitacao da equipe da\nsecretaria para autonomia.", "accent": GREEN_LIGHT},
    ]
    cw = (CW - 40) / 3
    card_h = H - PY - 230
    card_y = 80
    for i, srv in enumerate(servicos):
        cx = PX + i * (cw + 20)
        draw_card(c, cx, card_y, cw, card_h)
        c.setFillColor(srv["accent"])
        c.roundRect(cx, card_y + card_h - 8, cw, 8, 8, fill=1, stroke=0)
        c.rect(cx, card_y + card_h - 8, cw, 4, fill=1, stroke=0)
        para(c, srv["title"], cx + 20, card_y + card_h - 24, cw - 40, size=22, leading=32, color=WHITE, font=F_SEMI)
        hline(c, cx + 20, card_y + card_h - 90, cw - 40, color=NAVY_LIGHT)
        para(c, srv["body"], cx + 20, card_y + card_h - 105, cw - 40, size=16, leading=24, color=MUTED)

    footer_line(c)
    page_number(c, 6)

def slide_07_contato(c, payload):
    c.setFillColor(NAVY_DEEP)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(BLUE_ACC, alpha=0.08)
    for i in range(6):
        c.rect(W - 6 - i * 6, 0, 6 + i * 6, H, fill=1, stroke=0)

    mun = safe_get(payload, "municipio", default={})
    nome = safe_get(mun, "nome", default="")

    c.setFillColor(WHITE)
    c.setFont(F_HERO, 56)
    c.drawCentredString(W / 2, H - PY - 100, "VAMOS CONVERSAR?")
    c.setFillColor(BLUE_ACC)
    c.rect(W / 2 - 40, H - PY - 130, 80, 3, fill=1, stroke=0)
    if nome:
        para(c, f"Pronto para transformar a gestao educacional de {nome}.",
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
    page_number(c, 7)

# ── MAIN ──────────────────────────────────────────────────────
def gerar_pdf(payload) -> str:
    fd, path = tempfile.mkstemp(suffix=".pdf", prefix="slides_resumo_executivo_")
    os.close(fd)
    c = canvas.Canvas(path, pagesize=(W, H))

    slides = [
        slide_01_capa,
        slide_02_diagnostico,
        slide_03_receita,
        slide_04_projecao,
        slide_05_indicadores,
        slide_06_proposta,
        slide_07_contato,
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
