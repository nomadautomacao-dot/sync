#!/usr/bin/env python3
"""Case de Sucesso Rocha Prime — Bahia V2 (apresentação ao cliente).

4 páginas | linguagem comercial | paleta navy/azul/verde | visual forte.

  python3 scripts/generate-case-sucesso-bahia-v2.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parent.parent
PRIMARY_LOGO = ROOT / "public" / "logo-rocha-prime.png"
sys.path.insert(0, str(ROOT))

from kit_padrao_pdf_rocha_prime.report_style_pdf import (  # noqa: E402
    LOGO_SMALL,
    load_logo,
    register_fonts,
    round_rect,
)

# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------

PW, PH = 960, 540
MX = 40

# Design system Rocha Prime / Sync — sem laranja
NAVY = colors.HexColor("#1B2A4A")
NAVY_DEEP = colors.HexColor("#121C33")
NAVY_MID = colors.HexColor("#243656")
BLUE = colors.HexColor("#2F6BFF")
BLUE_SOFT = colors.HexColor("#E8F0FF")
BLUE_MID = colors.HexColor("#5B8CFF")
GREEN = colors.HexColor("#10B981")
GREEN_SOFT = colors.HexColor("#E6F9F1")
GREEN_DARK = colors.HexColor("#059669")
WHITE = colors.white
BG = colors.HexColor("#EEF1F6")
SURFACE = colors.HexColor("#FFFFFF")
SOFT = colors.HexColor("#F1F5FB")
TEXT = colors.HexColor("#1E293B")
MUTED = colors.HexColor("#64748B")
BORDER = colors.HexColor("#E2E8F0")
LINE = colors.HexColor("#E2E8F0")

# ---------------------------------------------------------------------------
# Conteúdo — fala com o cliente, não com a equipe interna
# ---------------------------------------------------------------------------

CASE = {
    "date": "2026",
    "hero_value": "R$ 50,2 mi",
    "hero_label": "mais recursos da União\npara a educação municipal",
    "hero_note": "Complementação adicional capturada entre 2024 e 2026",
    "subtitle": (
        "Quatro municípios baianos. Uma mesma estratégia: organizar a base escolar, "
        "fortalecer a gestão e ampliar o recurso federal que chega à educação."
    ),
    "kpis": [
        {"value": "R$ 73,9 mi", "label": "a mais no FUNDEB total"},
        {"value": "+1.237", "label": "alunos na EJA"},
        {"value": "+1.839", "label": "vagas em tempo integral"},
        {"value": "4", "label": "cidades com resultado"},
    ],
    "cities": [
        {
            "name": "Sítio do Mato",
            "tag": "Maior crescimento",
            "before": 12.9,
            "after": 28.8,
            "metric": "Recursos da União",
            "period": "2024 → 2026",
            "gain": "+R$ 15,8 mi",
            "pct": "+122%",
            "signal": "+452 alunos EJA  ·  +495 em integral",
            "story": "Em dois anos, a rede mais que dobrou o recurso da União.",
        },
        {
            "name": "Coribe",
            "tag": "Rede em expansão",
            "before": 8.5,
            "after": 16.6,
            "metric": "Recursos da União",
            "period": "2024 → 2026",
            "gain": "+R$ 8,1 mi",
            "pct": "+96%",
            "signal": "+476 alunos EJA  ·  +495 em integral",
            "story": "Mais alunos na rede, mais recurso federal na educação.",
        },
        {
            "name": "São Félix do Coribe",
            "tag": "Crescimento sólido",
            "before": 17.3,
            "after": 27.7,
            "metric": "Recursos da União",
            "period": "2024 → 2026",
            "gain": "+R$ 10,4 mi",
            "pct": "+60%",
            "signal": "+476 alunos EJA  ·  +494 em integral",
            "story": "Organização da secretaria com crescimento contínuo de receita.",
        },
        {
            "name": "Serra do Ramalho",
            "tag": "Resultado no tempo",
            "before": 36.3,
            "after": 87.4,
            "metric": "Receita total do FUNDEB",
            "period": "2023 → 2026",
            "gain": "+R$ 51,1 mi",
            "pct": "+141%",
            "signal": "Desde 2023  ·  +355 em tempo integral",
            "story": "Resultado que se mantém e cresce ano após ano.",
        },
    ],
    "steps": [
        {
            "n": "1",
            "title": "Olhamos a rede",
            "text": "Entendemos matrículas, Censo e quanto o município já recebe — e o que ainda pode capturar.",
        },
        {
            "n": "2",
            "title": "Trabalhamos juntos",
            "text": "Apoiamos a secretaria no dia a dia para organizar dados, sistemas e a operação da educação.",
        },
        {
            "n": "3",
            "title": "O recurso chega",
            "text": "O resultado aparece de forma oficial: mais dinheiro federal para a educação do município.",
        },
    ],
    "pillars": [
        {"title": "Rede organizada", "text": "Censo correto e foco em EJA e tempo integral — o que define o repasse."},
        {"title": "Secretaria apoiada", "text": "Acompanhamento próximo nos sistemas e programas da educação federal."},
        {"title": "Mais caixa", "text": "Mais recurso da União e mais FUNDEB, com números oficiais e comprováveis."},
    ],
    "closing_title": "Mais organização. Mais gestão. Mais recurso para a educação.",
    "closing_body": (
        "Nos municípios em que a estratégia foi aplicada, a rede ganhou "
        "organização e capturou mais recursos federais para a educação."
    ),
    "quote": (
        "O bom trabalho se mede em resultado: alunos bem contabilizados, "
        "secretaria organizada e recurso novo entrando na educação do município."
    ),
    "cta": "Quer ver o potencial do seu município?",
    "cta_sub": "Fazemos o diagnóstico da rede e mostramos a oportunidade real de captura no FUNDEB.",
    "sources": "Fontes: Censo Escolar INEP 2024/2025 · Portarias oficiais do FUNDEB 2024–2026",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _font(name: str, fallback: str) -> str:
    try:
        from reportlab.pdfbase import pdfmetrics

        if name in pdfmetrics.getRegisteredFontNames():
            return name
    except Exception:
        pass
    return fallback


def FH() -> str:
    return _font("Heading", "Helvetica-Bold")


def FB() -> str:
    return _font("Body", "Helvetica")


def FBB() -> str:
    return _font("BodyBold", "Helvetica-Bold")


def money_mi(v: float) -> str:
    return f"R$ {v:.1f} mi".replace(".", ",")


def wrap(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    *,
    font=None,
    size=10,
    leading=14,
    color=TEXT,
) -> float:
    style = ParagraphStyle(
        "w",
        fontName=font or FB(),
        fontSize=size,
        leading=leading,
        textColor=color,
    )
    para = Paragraph(text.replace("\n", "<br/>"), style)
    _, h = para.wrap(width, PH)
    para.drawOn(c, x, y - h)
    return y - h


def logo(c: canvas.Canvas, x: float, y: float, w=140, h=34, *, light=False):
    img = load_logo(PRIMARY_LOGO if PRIMARY_LOGO.exists() else LOGO_SMALL)
    if img:
        c.drawImage(img, x, y, w, h, mask="auto", preserveAspectRatio=True, anchor="c")
    else:
        c.setFillColor(WHITE if light else NAVY)
        c.setFont(FBB(), 11)
        c.drawString(x, y + 10, "ROCHA PRIME")


def footer(c: canvas.Canvas, page: int, total: int = 4):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.line(MX, 24, PW - MX, 24)
    c.setFillColor(MUTED)
    c.setFont(FB(), 7)
    c.drawString(MX, 11, CASE["sources"])
    # page dots
    total_w = total * 12
    sx = PW - MX - total_w
    for i in range(total):
        c.setFillColor(BLUE if i + 1 == page else colors.HexColor("#CBD5E1"))
        c.circle(sx + i * 12 + 4, 14, 3.2, fill=1, stroke=0)


def compare_bars(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    before: float,
    after: float,
    *,
    max_v: float | None = None,
):
    """Barras horizontais antes/depois com track de fundo."""
    max_v = max_v or max(before, after) * 1.05
    track = colors.HexColor("#EEF2F7")
    bar_h = 12
    gap = 18

    # Antes
    c.setFillColor(MUTED)
    c.setFont(FBB(), 6.5)
    c.drawString(x, y + h - 8, "ANTES")
    c.setFillColor(TEXT)
    c.setFont(FBB(), 7.5)
    c.drawRightString(x + w, y + h - 8, money_mi(before))
    round_rect(c, x, y + h - 24, w, bar_h, track, radius=6)
    bw = max(10, (before / max_v) * w)
    round_rect(c, x, y + h - 24, bw, bar_h, colors.HexColor("#94A3B8"), radius=6)

    # Depois
    c.setFillColor(GREEN_DARK)
    c.setFont(FBB(), 6.5)
    c.drawString(x, y + h - 8 - gap - 10, "DEPOIS")
    c.setFillColor(GREEN_DARK)
    c.setFont(FBB(), 7.5)
    c.drawRightString(x + w, y + h - 8 - gap - 10, money_mi(after))
    round_rect(c, x, y + h - 24 - gap - 10, w, bar_h, track, radius=6)
    aw = max(10, (after / max_v) * w)
    round_rect(c, x, y + h - 24 - gap - 10, aw, bar_h, GREEN, radius=6)


def icon_circle(c: canvas.Canvas, x: float, y: float, r: float, fill, glyph: str):
    c.setFillColor(fill)
    c.circle(x, y, r, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FBB(), max(9, r * 0.75))
    c.drawCentredString(x, y - r * 0.28, glyph)


# ---------------------------------------------------------------------------
# Páginas
# ---------------------------------------------------------------------------


def page_cover(c: canvas.Canvas):
    # fundo
    c.setFillColor(SURFACE)
    c.rect(0, 0, PW * 0.56, PH, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(PW * 0.56, 0, PW * 0.44, PH, fill=1, stroke=0)

    # formas decorativas (só azul/navy)
    c.setFillColor(NAVY_MID)
    c.circle(PW + 20, PH + 10, 140, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#1E3358"))
    c.circle(PW - 120, -20, 160, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.rect(0, 0, PW, 5, fill=1, stroke=0)

    logo(c, MX, PH - 58, 150, 36)
    c.setFillColor(BLUE)
    c.setFont(FBB(), 8.5)
    c.drawString(MX, PH - 82, "CASE DE SUCESSO  ·  BAHIA  ·  2024–2026")

    c.setFillColor(TEXT)
    c.setFont(FH(), 34)
    c.drawString(MX, PH - 145, "Resultado real")
    c.drawString(MX, PH - 185, "para a educação")
    c.setFillColor(BLUE)
    c.setFont(FH(), 34)
    c.drawString(MX, PH - 225, "municipal.")

    wrap(
        c,
        CASE["subtitle"],
        MX,
        PH - 250,
        PW * 0.50 - MX,
        size=11.5,
        leading=16.5,
        color=MUTED,
    )

    # hero card
    card_w = PW * 0.50 - MX
    round_rect(c, MX, 70, card_w, 130, SOFT, radius=20)
    c.setFillColor(GREEN)
    c.rect(MX, 70, 6, 130, fill=1, stroke=0)
    c.setFillColor(GREEN_DARK)
    c.setFont(FBB(), 8)
    c.drawString(MX + 24, 172, "IMPACTO NAS QUATRO CIDADES")
    c.setFillColor(TEXT)
    c.setFont(FH(), 36)
    c.drawString(MX + 24, 128, CASE["hero_value"])
    c.setFillColor(GREEN_DARK)
    c.setFont(FBB(), 12)
    # two lines
    lines = CASE["hero_label"].split("\n")
    c.drawString(MX + 24, 104, lines[0])
    if len(lines) > 1:
        c.drawString(MX + 24, 88, lines[1])

    c.setFillColor(MUTED)
    c.setFont(FB(), 8.5)
    c.drawString(MX, 42, "Sítio do Mato  ·  Coribe  ·  São Félix do Coribe  ·  Serra do Ramalho")

    # painel direito
    rx = PW * 0.56 + 32
    c.setFillColor(colors.HexColor("#8BA3D1"))
    c.setFont(FBB(), 8.5)
    c.drawString(rx, PH - 70, "EM NÚMEROS")

    c.setFillColor(WHITE)
    c.setFont(FH(), 26)
    c.drawString(rx, PH - 112, "4 cidades.")
    c.setFillColor(BLUE_MID)
    c.setFont(FH(), 26)
    c.drawString(rx, PH - 146, "1 estratégia.")
    c.setFillColor(GREEN)
    c.setFont(FH(), 26)
    c.drawString(rx, PH - 180, "Resultado comprovado.")

    y = PH - 240
    accents = [BLUE, GREEN, BLUE_MID, colors.HexColor("#7C9CFF")]
    for i, kpi in enumerate(CASE["kpis"]):
        round_rect(c, rx, y - 6, 300, 52, colors.HexColor("#243656"), radius=14)
        c.setFillColor(accents[i])
        c.rect(rx, y - 6, 5, 52, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(FH(), 16)
        c.drawString(rx + 18, y + 18, kpi["value"])
        c.setFillColor(colors.HexColor("#B6C5E3"))
        c.setFont(FB(), 9)
        c.drawString(rx + 18, y + 2, kpi["label"])
        y -= 62

    footer(c, 1)
    c.showPage()


def page_cities(c: canvas.Canvas):
    c.setFillColor(BG)
    c.rect(0, 0, PW, PH, fill=1, stroke=0)

    # header
    c.setFillColor(NAVY)
    c.rect(0, PH - 72, PW, 72, fill=1, stroke=0)
    logo(c, MX, PH - 48, 120, 28, light=True)
    c.setFillColor(WHITE)
    c.setFont(FH(), 18)
    c.drawString(180, PH - 36, "O que cada município conquistou")
    c.setFillColor(colors.HexColor("#9BB0D4"))
    c.setFont(FB(), 9)
    c.drawString(180, PH - 52, "Crescimento de recursos — antes e depois")

    gap = 14
    cw = (PW - MX * 2 - gap * 3) / 4
    ch = 380
    y0 = 38
    max_comp = max(ct["after"] for ct in CASE["cities"][:3])

    for i, city in enumerate(CASE["cities"]):
        x = MX + i * (cw + gap)
        round_rect(c, x, y0, cw, ch, SURFACE, radius=18)
        c.setStrokeColor(BORDER)
        c.setLineWidth(1)
        c.roundRect(x, y0, cw, ch, 18, fill=0, stroke=1)

        accent = GREEN if i in (0, 3) else BLUE
        c.setFillColor(accent)
        c.roundRect(x + 1, y0 + ch - 7, cw - 2, 7, 3, fill=1, stroke=0)

        # tag
        pill_fill = GREEN_SOFT if accent == GREEN else BLUE_SOFT
        pill_ink = GREEN_DARK if accent == GREEN else BLUE
        pill_w = min(cw - 24, 28 + len(city["tag"]) * 5.4)
        round_rect(c, x + 14, y0 + ch - 44, pill_w, 22, pill_fill, radius=11)
        c.setFillColor(pill_ink)
        c.setFont(FBB(), 7)
        c.drawCentredString(x + 14 + pill_w / 2, y0 + ch - 36, city["tag"].upper())

        c.setFillColor(TEXT)
        c.setFont(FH(), 12 if len(city["name"]) < 18 else 10.5)
        c.drawString(x + 14, y0 + ch - 72, city["name"])

        c.setFillColor(MUTED)
        c.setFont(FB(), 7.5)
        c.drawString(x + 14, y0 + ch - 90, f"{city['metric']}  ·  {city['period']}")

        # hero number
        c.setFillColor(TEXT)
        c.setFont(FH(), 24)
        c.drawString(x + 14, y0 + ch - 130, money_mi(city["after"]))
        c.setFillColor(MUTED)
        c.setFont(FB(), 8)
        c.drawString(x + 14, y0 + ch - 148, "resultado atual")

        # bars
        scale = max(city["before"], city["after"]) if i == 3 else max_comp
        compare_bars(
            c,
            x + 14,
            y0 + 150,
            cw - 28,
            72,
            city["before"],
            city["after"],
            max_v=scale * 1.05,
        )

        # gain
        round_rect(c, x + 12, y0 + 78, cw - 24, 58, GREEN_SOFT, radius=12)
        c.setFillColor(GREEN_DARK)
        c.setFont(FH(), 15)
        c.drawString(x + 22, y0 + 110, city["gain"])
        c.setFont(FBB(), 11)
        c.drawString(x + 22, y0 + 90, city["pct"] + " de crescimento")

        c.setFillColor(MUTED)
        c.setFont(FBB(), 6.8)
        c.drawString(x + 14, y0 + 58, "O QUE CRESCEU NA REDE")
        c.setFillColor(TEXT)
        c.setFont(FB(), 7.8)
        wrap(c, city["signal"], x + 14, y0 + 48, cw - 28, size=7.8, leading=10, color=TEXT)

        wrap(
            c,
            city["story"],
            x + 14,
            y0 + 28,
            cw - 28,
            size=8,
            leading=10.5,
            color=MUTED,
        )

    footer(c, 2)
    c.showPage()


def page_method(c: canvas.Canvas):
    c.setFillColor(BG)
    c.rect(0, 0, PW, PH, fill=1, stroke=0)

    c.setFillColor(NAVY)
    c.rect(0, PH - 72, PW, 72, fill=1, stroke=0)
    logo(c, MX, PH - 48, 120, 28, light=True)
    c.setFillColor(WHITE)
    c.setFont(FH(), 18)
    c.drawString(180, PH - 36, "Como o recurso chega ao município")
    c.setFillColor(colors.HexColor("#9BB0D4"))
    c.setFont(FB(), 9)
    c.drawString(180, PH - 52, "Três etapas simples — da leitura da rede ao resultado em caixa")

    # timeline connector
    gap = 18
    w = (PW - MX * 2 - gap * 2) / 3
    y_card = 270
    cy = y_card + 150

    # line behind steps
    c.setStrokeColor(colors.HexColor("#C5D4F0"))
    c.setLineWidth(3)
    c.line(MX + w / 2, cy + 18, PW - MX - w / 2, cy + 18)

    for i, step in enumerate(CASE["steps"]):
        x = MX + i * (w + gap)
        round_rect(c, x, y_card, w, 168, SURFACE, radius=18)
        c.setStrokeColor(BORDER)
        c.setLineWidth(1)
        c.roundRect(x, y_card, w, 168, 18, fill=0, stroke=1)

        fill = BLUE if i < 2 else GREEN
        icon_circle(c, x + w / 2, cy + 18, 18, fill, step["n"])

        c.setFillColor(TEXT)
        c.setFont(FH(), 15)
        c.drawCentredString(x + w / 2, y_card + 100, step["title"])
        wrap(
            c,
            step["text"],
            x + 20,
            y_card + 82,
            w - 40,
            size=10,
            leading=14,
            color=MUTED,
        )

    # bottom visual band
    round_rect(c, MX, 48, PW - MX * 2, 190, NAVY, radius=22)
    # accent strip
    c.setFillColor(BLUE)
    c.rect(MX, 48, 8, 190, fill=1, stroke=0)

    c.setFillColor(BLUE_MID)
    c.setFont(FBB(), 8)
    c.drawString(MX + 32, 208, "PARA O MUNICÍPIO, ISSO SIGNIFICA")
    c.setFillColor(WHITE)
    c.setFont(FH(), 17)
    c.drawString(MX + 32, 176, "Organização na secretaria e mais recurso na educação.")

    pw = (PW - MX * 2 - 64 - 24) / 3
    for i, pillar in enumerate(CASE["pillars"]):
        x = MX + 32 + i * (pw + 12)
        round_rect(c, x, 68, pw, 88, colors.HexColor("#243656"), radius=14)
        c.setFillColor(GREEN if i == 2 else BLUE_MID)
        c.setFont(FH(), 13)
        c.drawString(x + 16, 128, pillar["title"])
        wrap(
            c,
            pillar["text"],
            x + 16,
            112,
            pw - 32,
            size=9,
            leading=12.5,
            color=colors.HexColor("#C5D3EF"),
        )

    footer(c, 3)
    c.showPage()


def page_close(c: canvas.Canvas):
    c.setFillColor(BG)
    c.rect(0, 0, PW, PH, fill=1, stroke=0)

    c.setFillColor(NAVY)
    c.rect(0, PH - 72, PW, 72, fill=1, stroke=0)
    logo(c, MX, PH - 48, 120, 28, light=True)
    c.setFillColor(WHITE)
    c.setFont(FH(), 18)
    c.drawString(180, PH - 36, "O que isso significa para o seu município")
    c.setFillColor(colors.HexColor("#9BB0D4"))
    c.setFont(FB(), 9)
    c.drawString(180, PH - 52, "Resultado comprovado — e o convite para diagnosticar a sua rede")

    # main statement
    round_rect(c, MX, 280, PW - MX * 2, 150, NAVY, radius=22)
    c.setFillColor(GREEN)
    c.rect(MX, 280, 8, 150, fill=1, stroke=0)

    c.setFillColor(WHITE)
    c.setFont(FH(), 20)
    c.drawString(MX + 32, 388, CASE["closing_title"])
    wrap(
        c,
        CASE["closing_body"],
        MX + 32,
        360,
        560,
        size=12,
        leading=17,
        color=colors.HexColor("#C5D3EF"),
    )

    # remember number
    round_rect(c, PW - MX - 230, 300, 200, 110, colors.HexColor("#243656"), radius=16)
    c.setFillColor(colors.HexColor("#8BA3D1"))
    c.setFont(FBB(), 8)
    c.drawString(PW - MX - 210, 380, "IMPACTO NAS 4 CIDADES")
    c.setFillColor(WHITE)
    c.setFont(FH(), 28)
    c.drawString(PW - MX - 210, 340, CASE["hero_value"])
    c.setFillColor(GREEN)
    c.setFont(FBB(), 9)
    c.drawString(PW - MX - 210, 318, "mais recursos da União")

    # quote
    round_rect(c, MX, 168, PW - MX * 2, 88, SURFACE, radius=16)
    c.setStrokeColor(BORDER)
    c.setLineWidth(1)
    c.roundRect(MX, 168, PW - MX * 2, 88, 16, fill=0, stroke=1)
    c.setFillColor(BLUE)
    c.rect(MX, 168, 6, 88, fill=1, stroke=0)
    wrap(
        c,
        f'“{CASE["quote"]}”',
        MX + 28,
        232,
        PW - MX * 2 - 56,
        size=13,
        leading=18,
        color=TEXT,
        font=FBB(),
    )

    # CTA
    round_rect(c, MX, 48, PW - MX * 2, 100, BLUE, radius=18)
    c.setFillColor(WHITE)
    c.setFont(FH(), 17)
    c.drawString(MX + 28, 112, CASE["cta"])
    c.setFillColor(colors.HexColor("#D6E4FF"))
    c.setFont(FB(), 11)
    c.drawString(MX + 28, 88, CASE["cta_sub"])

    round_rect(c, PW - MX - 210, 68, 178, 56, colors.HexColor("#1D4FD7"), radius=14)
    c.setFillColor(WHITE)
    c.setFont(FBB(), 8.5)
    c.drawCentredString(PW - MX - 121, 98, "VAMOS COMEÇAR")
    c.setFont(FH(), 11)
    c.drawCentredString(PW - MX - 121, 78, "Diagnóstico da sua rede")

    footer(c, 4)
    c.showPage()


def main():
    register_fonts()
    out = ROOT / "Case_Sucesso_Rocha_Prime_Bahia_V2.pdf"
    c = canvas.Canvas(str(out), pagesize=(PW, PH))
    c.setTitle("Case de Sucesso Rocha Prime — Bahia")
    c.setAuthor("Rocha Prime")
    c.setSubject("Resultados FUNDEB em municípios da Bahia · 2024–2026")

    page_cover(c)
    page_cities(c)
    page_method(c)
    page_close(c)

    c.save()
    print(out)


if __name__ == "__main__":
    main()
