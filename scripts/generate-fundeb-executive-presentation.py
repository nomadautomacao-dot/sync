import json
import math
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from kit_padrao_pdf_rocha_prime.report_style_pdf import (  # noqa: E402
    BLUE,
    GREEN,
    LIGHT_BLUE,
    LIGHT_GREEN,
    LOGO_SMALL,
    MUTED,
    NAVY,
    ORANGE,
    SOFT_ROW,
    TEXT,
    WHITE,
    LINE,
    fmt_money,
    load_logo,
    register_fonts,
    round_rect,
)


PW = 960
PH = 540
MX = 36
MY = 28
PALE = colors.HexColor("#F5F8FC")
PALE_CARD = colors.HexColor("#F1F6FD")
RIGHT_PANEL = colors.HexColor("#253364")
RIGHT_PANEL_INNER = colors.HexColor("#31447A")
GREEN_SOFT = colors.HexColor("#EEF8EE")
TEXT_DARK = colors.HexColor("#26324B")


def short_money(value: float) -> str:
    if value >= 1_000_000:
      return f"R$ {value / 1_000_000:.1f} mi".replace(".", ",")
    if value >= 1_000:
      return f"R$ {value / 1_000:.1f} mil".replace(".", ",")
    return fmt_money(value)


def format_int(value: int) -> str:
    return f"{int(value):,}".replace(",", ".")


def format_pct(value: float) -> str:
    signal = "+" if value > 0 else ""
    return f"{signal}{value:.2f}%".replace(".", ",")


def format_pct_plain(value: float) -> str:
    return f"{value:.1f}%".replace(".", ",")


def has_history(data) -> bool:
    return bool(data.get("history"))


def page_with_optional_history(data, page_num: int) -> int:
    return page_num + (1 if has_history(data) else 0)


def growth_copy(data):
    municipio = data["municipio"]
    growth_pct = data["metrics"]["crescimento_receita_pct"]
    if growth_pct >= 0:
        return {
            "message_2025": "Base anterior do município antes do avanço de 2026.",
            "message_2026": f"Cenário atual com avanço de {format_pct(growth_pct)} frente a 2025.",
            "message_rocha": f"Leitura projetada para levar {municipio} a um patamar superior de resultado.",
            "financial_2026": "Avanço frente a 2025.",
        }
    return {
        "message_2025": "Base anterior do município antes da queda de 2026.",
        "message_2026": f"Cenário atual com recuo de {format_pct(growth_pct)} frente a 2025.",
        "message_rocha": f"Leitura projetada para recolocar {municipio} em trajetória de crescimento.",
        "financial_2026": "Queda frente a 2025.",
    }


def wrap_para(c, text, x, top, width, *, font="Body", size=10, leading=14, color=TEXT):
    style = ParagraphStyle(
        "body",
        fontName=font,
        fontSize=size,
        leading=leading,
        textColor=color,
    )
    p = Paragraph(text, style)
    _, height = p.wrap(width, PH)
    p.drawOn(c, x, top - height)
    return top - height


def footer(c, material_date: str, page_num: int):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.line(MX, 24, PW - MX, 24)
    c.setFillColor(MUTED)
    c.setFont("Body", 6.2)
    c.drawString(MX, 12, f"Rocha Prime Serviços Especializados | Material executivo confidencial | {material_date}")
    c.drawRightString(PW - MX, 12, f"{page_num:02d}")


def header(c, data, page_num: int, section_label: str, title: str, subtitle: str, panel=None):
    municipio = data["municipio"]
    uf = data["uf"]
    material_date = data["material_date"]
    logo = load_logo(LOGO_SMALL)
    if logo:
        c.drawImage(logo, MX, PH - 58, 20, 24, mask="auto")
    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 8)
    c.drawString(MX + 28, PH - 40, "ROCHA PRIME SERVIÇOS ESPECIALIZADOS")
    c.setFillColor(MUTED)
    c.setFont("Body", 5.5)
    c.drawString(MX + 28, PH - 49, "CNPJ: 29.342.691/0001-93 | Tel: (61) 99866-7834")

    round_rect(c, MX + 28, PH - 68, 86, 13, LIGHT_BLUE, radius=6)
    c.setFillColor(BLUE)
    c.setFont("BodyBold", 6.5)
    c.drawCentredString(MX + 71, PH - 63.3, section_label.upper())

    c.setFillColor(TEXT_DARK)
    c.setFont("Heading", 22)
    c.drawString(MX + 28, PH - 98, title)
    c.setFillColor(MUTED)
    c.setFont("Body", 9)
    c.drawString(MX + 28, PH - 115, subtitle)

    panel_x = PW - 208
    panel_y = PH - 110
    panel_w = 188
    panel_h = 92
    round_rect(c, panel_x, panel_y, panel_w, panel_h, colors.HexColor("#EFF4FF"), radius=24)
    panel = panel or {}
    c.setFillColor(BLUE)
    c.setFont("BodyBold", 6.8)
    c.drawString(panel_x + 18, panel_y + panel_h - 22, panel.get("title", "RADAR EXECUTIVO"))
    c.setFillColor(TEXT_DARK)
    c.setFont("Body", 8)
    lines = panel.get("lines") or []
    for idx, line in enumerate(lines[:3]):
        bullet_y = panel_y + panel_h - 42 - idx * 18
        c.setFillColor(BLUE)
        c.circle(panel_x + 22, bullet_y + 3, 2.2, fill=1, stroke=0)
        c.setFillColor(TEXT)
        wrap_para(c, line, panel_x + 30, bullet_y + 8, panel_w - 42, size=7.6, leading=10.5, color=TEXT)
    c.setStrokeColor(NAVY)
    c.setLineWidth(2)
    c.line(MX, PH - 133, PW - MX, PH - 133)

    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 7)
    c.drawString(MX + 28, PH - 154, f"{municipio.upper()} | {uf.upper()}")

    footer(c, material_date, page_num)


def stat_card(c, x, y, w, h, label, value, detail=None):
    round_rect(c, x, y, w, h, WHITE, stroke=colors.HexColor("#D8E3F5"), radius=16)
    c.setFillColor(MUTED)
    c.setFont("BodyBold", 8)
    c.drawString(x + 14, y + h - 28, label)
    c.setFillColor(TEXT_DARK)
    c.setFont("Heading", 18)
    c.drawString(x + 14, y + 20, value)
    if detail:
        c.setFillColor(MUTED)
        c.setFont("Body", 6.8)
        wrap_para(c, detail, x + 14, y + 18, w - 28, size=6.8, leading=9, color=MUTED)


def emphasis_card(c, x, y, w, h, eyebrow, value, detail, *, accent=BLUE, bg=PALE_CARD):
    round_rect(c, x, y, w, h, bg, radius=16)
    c.setFillColor(accent)
    c.rect(x, y, 5, h, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont("BodyBold", 7.2)
    c.drawString(x + 16, y + h - 18, eyebrow.upper())
    c.setFillColor(accent if accent != BLUE else TEXT_DARK)
    c.setFont("Heading", 18)
    c.drawString(x + 16, y + h - 46, value)
    c.setFillColor(TEXT)
    wrap_para(c, detail, x + 16, y + 30, w - 28, size=7.5, leading=10.5, color=TEXT)


def mini_stat_card(c, x, y, w, h, label, value, detail):
    round_rect(c, x, y, w, h, WHITE, stroke=colors.HexColor("#D8E3F5"), radius=14)
    c.setFillColor(MUTED)
    c.setFont("BodyBold", 6.2)
    c.drawString(x + 12, y + h - 14, label.upper())
    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 12)
    c.drawString(x + 12, y + 14, value)
    c.setFillColor(MUTED)
    c.setFont("Body", 6.4)
    c.drawString(x + 12, y + 5, detail)


def page_cover(c, data):
    material_date = data["material_date"]
    municipio = data["municipio"]
    uf = data["uf"]
    hero = data["hero"]
    metrics = data["metrics"]
    logo = load_logo(LOGO_SMALL)

    c.setFillColor(WHITE)
    c.rect(0, 0, PW, PH, fill=1, stroke=0)

    if logo:
        c.drawImage(logo, MX, PH - 74, 28, 34, mask="auto")
    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 11)
    c.drawString(MX + 52, PH - 46, "APRESENTAÇÃO EXECUTIVA")

    c.setFillColor(TEXT_DARK)
    c.setFont("Heading", 31)
    left_top = PH - 138
    left_top = wrap_para(c, hero["headline"], MX, left_top, 360, font="Heading", size=31, leading=38, color=TEXT_DARK)
    wrap_para(c, hero["description"], MX, left_top - 34, 450, size=13, leading=18, color=TEXT)

    slab_x = MX
    slab_y = 42
    slab_w = 520
    slab_h = 138
    round_rect(c, slab_x, slab_y, slab_w, slab_h, PALE_CARD, radius=24)
    card_w = (slab_w - 46) / 3
    card_y = slab_y + 24
    stat_card(c, slab_x + 22, card_y, card_w, 84, "Receita prevista 2026", short_money(metrics["receita_prevista"]))
    stat_card(c, slab_x + 22 + card_w + 12, card_y, card_w, 84, "Ganho estimado", short_money(metrics["ganho_estimado"]))
    stat_card(c, slab_x + 22 + (card_w + 12) * 2, card_y, card_w, 84, "Matrículas QEdu", format_int(metrics["matriculas_qedu"]))

    right_x = 560
    right_y = 30
    right_w = PW - right_x - MX
    right_h = PH - 48
    round_rect(c, right_x, right_y, right_w, right_h, RIGHT_PANEL, radius=32)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 9)
    c.drawString(right_x + 32, PH - 64, f"{municipio.upper()} | {uf.upper()}")
    c.setFont("Heading", 28)
    c.drawString(right_x + 32, PH - 118, "Rocha Prime")
    c.drawString(right_x + 32, PH - 158, "Serviços")
    c.drawString(right_x + 32, PH - 198, "Especializados")
    wrap_para(
        c,
        "Uma apresentação com direção executiva, linguagem clara e base técnica suficiente para sustentar decisão.",
        right_x + 32,
        PH - 264,
        right_w - 64,
        size=12,
        leading=18,
        color=colors.HexColor("#DFE7FF"),
    )
    round_rect(c, right_x + 32, 234, right_w - 64, 92, RIGHT_PANEL_INNER, radius=18)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 10)
    c.drawString(right_x + 50, 296, "PONTOS-CHAVE")
    wrap_para(c, hero["points"], right_x + 50, 274, right_w - 100, size=10, leading=15, color=colors.HexColor("#D6E0FF"))
    round_rect(c, right_x + 32, 146, 120, 18, ORANGE, radius=5)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 7)
    c.drawCentredString(right_x + 92, 152, "DOCUMENTO CONFIDENCIAL")

    footer(c, material_date, 1)
    c.showPage()


def page_message(c, data):
    metrics = data["metrics"]
    message = data["executive_message"]
    copy = growth_copy(data)
    header(
        c,
        data,
        2,
        "Leitura executiva",
        "Mensagem Executiva",
        "Por que o caso justifica uma agenda mais robusta",
        data["guide_panels"]["message"],
    )
    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX + 28, PH - 170, message["eyebrow"])
    c.setFont("BodyBold", 16)
    c.drawString(MX + 28, PH - 192, message["title"])
    y = wrap_para(c, message["body"], MX + 28, PH - 206, 860, size=10.2, leading=16, color=TEXT)

    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX + 28, y - 18, "O QUE ESTA APRESENTAÇÃO ENTREGA")
    bullet_y = y - 28
    for item in message["deliverables"]:
        bullet_y = wrap_para(c, f"• {item}", MX + 34, bullet_y, 840, size=9.5, leading=14, color=TEXT)
        bullet_y -= 4

    card_y = 82
    card_w = (888 - 24) / 3
    emphasis_card(
        c,
        MX + 28,
        card_y,
        card_w,
        98,
        "2025 oficial",
        short_money(metrics["receita_2025"]),
        copy["message_2025"],
        accent=TEXT_DARK,
        bg=WHITE,
    )
    emphasis_card(
        c,
        MX + 28 + card_w + 12,
        card_y,
        card_w,
        98,
        "2026 oficial",
        short_money(metrics["receita_prevista"]),
        copy["message_2026"],
        accent=ORANGE,
        bg=colors.HexColor("#FFF7ED"),
    )
    emphasis_card(
        c,
        MX + 28 + (card_w + 12) * 2,
        card_y,
        card_w,
        98,
        "Com Rocha Prime",
        short_money(metrics["receita_com_rocha_prime"]),
        copy["message_rocha"],
        accent=GREEN,
        bg=colors.HexColor("#F1FAF2"),
    )
    c.showPage()


def page_history(c, data):
    history = data["history"]
    series = history["series"]
    totals = [float(item[1]) for item in series]
    projected_2027 = float(data["metrics"]["receita_com_rocha_prime"])
    chart_points = [(str(item[0]), float(item[1]), False) for item in series] + [("2027 RP", projected_2027, True)]
    first_value = totals[0]
    last_value = totals[-1]
    total_growth_pct = ((last_value - first_value) / first_value * 100) if first_value else 0
    last_growth_pct = ((totals[-1] - totals[-2]) / totals[-2] * 100) if len(totals) > 1 and totals[-2] else 0
    total_gain = last_value - first_value

    header(
        c,
        data,
        3,
        "Panorama",
        "Panorama Historico",
        history["title"],
        data["guide_panels"].get("history"),
    )
    wrap_para(c, history["intro"], MX + 28, PH - 162, 860, size=9.6, leading=15, color=TEXT)

    chart_x = MX + 28
    chart_y = 126
    chart_w = 540
    chart_h = 178
    round_rect(c, chart_x, chart_y, chart_w, chart_h, WHITE, stroke=colors.HexColor("#D8E3F5"), radius=18)

    inner_x = chart_x + 28
    baseline_y = chart_y + 32
    bar_w = 52
    gap = 18
    max_bar_h = 104
    max_value = max(point[1] for point in chart_points) if chart_points else 1

    c.setStrokeColor(colors.HexColor("#E5EDF9"))
    c.setLineWidth(1)
    for line_idx in range(1, 4):
        guide_y = baseline_y + (max_bar_h / 3) * line_idx
        c.line(inner_x - 6, guide_y, chart_x + chart_w - 24, guide_y)

    c.setStrokeColor(colors.HexColor("#C7D5EC"))
    c.line(inner_x - 6, baseline_y, chart_x + chart_w - 24, baseline_y)

    for idx, item in enumerate(chart_points):
        year, value, is_projection = item
        x = inner_x + idx * (bar_w + gap)
        bar_h = max(12, (value / max_value) * max_bar_h)
        if is_projection:
            accent = BLUE
            bg = colors.HexColor("#E8F1FF")
        else:
            accent = GREEN if idx == len(series) - 1 else (BLUE if idx >= len(series) - 2 else colors.HexColor("#7AA6E8"))
            bg = colors.HexColor("#EAF2FF") if idx != len(series) - 1 else colors.HexColor("#E9F8EC")
        round_rect(c, x, baseline_y, bar_w, bar_h, bg, radius=10)
        c.setFillColor(accent)
        c.rect(x, baseline_y, 4, bar_h, fill=1, stroke=0)
        c.setFillColor(TEXT_DARK)
        c.setFont("BodyBold", 7)
        c.drawCentredString(x + bar_w / 2, baseline_y - 14, str(year))
        c.setFillColor(accent)
        c.setFont("BodyBold", 8)
        c.drawCentredString(x + bar_w / 2, baseline_y + bar_h + 10, short_money(value))

        if idx > 0:
            prev = float(chart_points[idx - 1][1])
            delta_pct = ((value - prev) / prev * 100) if prev else 0
            pill_w = 48
            pill_x = x + (bar_w - pill_w) / 2
            pill_y = baseline_y + bar_h + 18
            round_rect(c, pill_x, pill_y, pill_w, 14, colors.HexColor("#F3F7FF"), radius=7)
            c.setFillColor(BLUE if is_projection else (GREEN if delta_pct >= 0 else ORANGE))
            c.setFont("BodyBold", 6.4)
            c.drawCentredString(pill_x + pill_w / 2, pill_y + 4.3, format_pct(delta_pct))

    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 9)
    c.drawString(chart_x + 18, chart_y + chart_h - 22, "EVOLUCAO OFICIAL DA RECEITA FUNDEB")

    legal_x = chart_x + chart_w + 20
    legal_y = 126
    legal_w = 328
    legal_h = 178
    round_rect(c, legal_x, legal_y, legal_w, legal_h, PALE_CARD, radius=18)
    c.setFillColor(BLUE)
    c.rect(legal_x, legal_y, 5, legal_h, fill=1, stroke=0)
    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 10)
    c.drawString(legal_x + 18, legal_y + legal_h - 22, "BASE LEGAL DOS DADOS")
    bullet_y = legal_y + legal_h - 36
    for item in history["legal_sources"]:
        bullet_y = wrap_para(c, f"• {item}", legal_x + 18, bullet_y, legal_w - 34, size=8.4, leading=12.5, color=TEXT)
        bullet_y -= 2

    round_rect(c, MX + 28, 82, 888, 34, colors.HexColor("#F8FAFE"), radius=12)
    c.setFillColor(MUTED)
    c.setFont("BodyBold", 8)
    c.drawString(MX + 42, 104, "Leitura executiva:")
    wrap_para(c, history["reading"], MX + 150, 104, 748, size=8.2, leading=11.5, color=TEXT)

    summary_y = 30
    summary_w = (888 - 24) / 3
    mini_stat_card(c, MX + 28, summary_y, summary_w, 44, "2022 -> 2026", format_pct(total_growth_pct), "Crescimento acumulado da serie.")
    mini_stat_card(c, MX + 28 + summary_w + 12, summary_y, summary_w, 44, "2025 -> 2026", format_pct(last_growth_pct), "Variacao mais recente do ciclo.")
    mini_stat_card(c, MX + 28 + (summary_w + 12) * 2, summary_y, summary_w, 44, "Ganho acumulado", short_money(total_gain), "Diferenca entre 2022 e 2026.")
    c.showPage()


def page_scope(c, data):
    scope = data["scope"]
    header(c, data, page_with_optional_history(data, 3), "Escopo", "Escopo de Atuação", scope["title"], data["guide_panels"]["scope"])
    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX + 28, PH - 170, scope["subtitle"])

    x = MX + 28
    y = PH - 194
    gap = 12
    width = (888 - gap) / 2
    height = 98
    for idx, card in enumerate(scope["cards"]):
        col = idx % 2
        row = idx // 2
        cx = x + col * (width + gap)
        cy = y - row * (height + 14) - height
        round_rect(c, cx, cy, width, height, WHITE, stroke=colors.HexColor("#D8E3F5"), radius=18)
        round_rect(c, cx + 14, cy + height - 32, 26, 26, LIGHT_BLUE, radius=13)
        c.setFillColor(BLUE)
        c.setFont("BodyBold", 10)
        c.drawCentredString(cx + 27, cy + height - 22, f"{idx + 1:02d}")
        c.setFillColor(TEXT_DARK)
        c.setFont("BodyBold", 10)
        c.drawString(cx + 52, cy + height - 22, card["title"])
        wrap_para(c, card["description"], cx + 18, cy + height - 42, width - 36, size=9, leading=13, color=TEXT)

    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 13)
    c.drawString(MX + 28, 104, "Nossa entrega não é só relatório.")
    wrap_para(c, scope["closing"], MX + 28, 90, 860, size=10, leading=16, color=TEXT)
    c.showPage()


def draw_table(c, x, y_top, w, headers, rows, col_widths, *, row_h=22, font_size=8, highlight_last=False, positive_cols=None):
    positive_cols = positive_cols or set()
    c.setFillColor(NAVY)
    c.rect(x, y_top - row_h, w, row_h, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 7.2)
    cursor = x
    for idx, (header_text, col_w) in enumerate(zip(headers, col_widths)):
        if idx == 0:
            c.drawString(cursor + 8, y_top - 14, header_text)
        else:
            c.drawCentredString(cursor + col_w / 2, y_top - 14, header_text)
        cursor += col_w
    y = y_top - row_h
    for idx, row in enumerate(rows):
        fill = SOFT_ROW if idx % 2 else WHITE
        if highlight_last and idx == len(rows) - 1:
            fill = colors.HexColor("#EEF2F8")
        c.setFillColor(fill)
        c.rect(x, y - row_h, w, row_h, fill=1, stroke=0)
        cursor = x
        for col_idx, (cell, col_w) in enumerate(zip(row, col_widths)):
            is_positive = col_idx in positive_cols and str(cell).startswith("+")
            c.setFillColor(GREEN if is_positive else TEXT)
            c.setFont("BodyBold" if is_positive or (highlight_last and idx == len(rows) - 1) else "Body", font_size)
            if col_idx == 0:
                c.drawString(cursor + 8, y - 14, str(cell))
            else:
                c.drawCentredString(cursor + col_w / 2, y - 14, str(cell))
            cursor += col_w
        y -= row_h
    return y


def page_base(c, data):
    base = data["base"]
    header(
        c,
        data,
        page_with_optional_history(data, 4),
        "Base do município",
        "Base do Município",
        "Rede educacional e condições operacionais",
        data["guide_panels"]["base"],
    )
    wrap_para(c, base["intro"], MX + 28, PH - 162, 860, size=9.6, leading=15, color=TEXT)

    left_x = MX + 28
    top = PH - 210
    table_w = 424
    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 9.5)
    c.drawString(left_x, top + 10, "Indicador")
    left_rows = [[row[0], row[1]] for row in base["qedu"]]
    draw_table(c, left_x, top, table_w, ["Indicador", "Valor"], left_rows, [table_w * 0.67, table_w * 0.33], row_h=20, font_size=7.8)

    right_x = MX + 28 + table_w + 20
    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 9.5)
    c.drawString(right_x, top + 10, "Instituição")
    draw_table(
        c,
        right_x,
        top,
        table_w,
        ["Instituição", "Sistema", "Situação"],
        base["systems"],
        [table_w * 0.18, table_w * 0.40, table_w * 0.42],
        row_h=26,
        font_size=7.2,
    )

    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX + 28, 104, "LEITURA ROCHA PRIME")
    round_rect(c, MX + 28, 44, 888, 48, PALE_CARD, radius=16)
    c.setFillColor(BLUE)
    c.rect(MX + 28, 44, 5, 48, fill=1, stroke=0)
    wrap_para(c, base["reading"], MX + 46, 81, 852, size=9.2, leading=14, color=TEXT)
    c.showPage()


def page_projection(c, data):
    projection = data["projection"]
    integral = projection["integral"]
    eja = projection["eja"]
    header(c, data, page_with_optional_history(data, 5), "Estruturação", "Tese de Expansão", projection["title"], data["guide_panels"]["projection"])

    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX + 28, PH - 170, projection["subtitle"])
    intro_y = wrap_para(c, projection["assumption_text"], MX + 28, PH - 184, 860, size=9.5, leading=15, color=TEXT)

    card_y = intro_y - 128
    card_w = (888 - 18) / 2
    card_h = 118
    for idx, item in enumerate(
        [
            ("Tempo integral", integral, GREEN, colors.HexColor("#F1FAF2")),
            ("EJA", eja, BLUE, colors.HexColor("#F3F7FF")),
        ]
    ):
        title, payload, accent, bg = item
        x = MX + 28 + idx * (card_w + 18)
        round_rect(c, x, card_y, card_w, card_h, bg, radius=20)
        c.setFillColor(accent)
        c.rect(x, card_y, 5, card_h, fill=1, stroke=0)
        c.setFillColor(TEXT_DARK)
        c.setFont("BodyBold", 11)
        c.drawString(x + 18, card_y + card_h - 24, title.upper())
        c.setFont("Heading", 20)
        c.setFillColor(accent)
        c.drawString(x + 18, card_y + card_h - 56, f"{format_int(payload['base_projetada'])} alunos")
        c.setFillColor(TEXT_DARK)
        c.setFont("Body", 8.5)
        c.drawString(x + 18, card_y + 42, f"Hoje: {format_int(payload['base_atual'])} | Depois Rocha Prime: {format_int(payload['base_projetada'])}")
        c.drawString(x + 18, card_y + 26, f"Incremento projetado: +{format_int(payload['alunos_adicionais'])} | {payload['escolas_priorizadas']} frentes ativas")
        c.drawString(x + 18, card_y + 10, f"Participação estimada: {format_pct_plain(payload['percentual_atual'])} -> {format_pct_plain(payload['percentual_projetado'])}")

    base_y = 110
    block_w = (888 - 24) / 3
    summary_blocks = [
        ("Escolas municipais", format_int(data["network_summary"]["escolas_municipais"]), "Base de ativação direta da prefeitura."),
        ("Multiplicador integral", "2,5x", "Tese ofertável sobre a base municipal atual."),
        ("Multiplicador EJA", "até 5x", "Leitura comercial apoiada por incentivos e programas."),
    ]
    for idx, block in enumerate(summary_blocks):
        x = MX + 28 + idx * (block_w + 12)
        round_rect(c, x, base_y, block_w, 56, PALE_CARD, radius=14)
        c.setFillColor(MUTED)
        c.setFont("BodyBold", 7)
        c.drawString(x + 14, base_y + 40, block[0].upper())
        c.setFillColor(TEXT_DARK)
        c.setFont("BodyBold", 14)
        c.drawString(x + 14, base_y + 20, block[1])
        c.setFillColor(MUTED)
        c.setFont("Body", 6.8)
        c.drawString(x + 14, base_y + 9, block[2])

    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 9)
    c.drawString(MX + 28, 84, "Leitura executiva")
    wrap_para(c, projection["closing"], MX + 28, 72, 888, size=9.3, leading=14, color=TEXT)
    c.showPage()


def page_comparison(c, data):
    comp = data["comparison"]
    header(c, data, page_with_optional_history(data, 6), "Comparativo", "Comparativo 2025 x 2026", comp["title"], data["guide_panels"]["comparison"])
    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX + 28, PH - 170, comp["subtitle"])
    draw_table(
        c,
        MX + 28,
        PH - 184,
        888,
        ["Etapa / Modalidade", "Variação", "Leitura"],
        comp["rows"],
        [888 * 0.31, 888 * 0.15, 888 * 0.54],
        row_h=22,
        font_size=7.8,
        positive_cols={1},
    )

    x = MX + 28
    y = 134
    w = 420
    h = 58
    round_rect(c, x, y, w, h, PALE_CARD, radius=14)
    c.setFillColor(BLUE)
    c.rect(x, y, 5, h, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont("BodyBold", 7)
    c.drawString(x + 14, y + 38, "BASE EDUCACIONAL")
    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 17)
    c.drawString(x + 14, y + 14, f"{format_int(comp['matricula_base_1'])} -> {format_int(comp['matricula_base_2'])}")
    c.setFillColor(TEXT)
    c.setFont("Body", 7.2)
    c.drawString(x + 14, y + 28, f"Ganho líquido de {format_int(comp['matricula_base_2'] - comp['matricula_base_1'])} matrículas na base comparativa.")

    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX + 476, 200, comp["critical_title"])
    round_rect(c, MX + 476, 118, 440, 70, LIGHT_GREEN, radius=16)
    c.setFillColor(GREEN)
    c.rect(MX + 476, 118, 5, 70, fill=1, stroke=0)
    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 9.5)
    c.drawString(MX + 494, 166, comp["critical_label"])
    wrap_para(c, comp["critical_text"], MX + 494, 154, 396, size=8.8, leading=13, color=TEXT)

    c.setFillColor(MUTED)
    c.setFont("BodyBold", 8)
    c.drawString(MX + 28, 94, "Mensagem executiva:")
    wrap_para(c, comp["summary"], MX + 28, 82, 888, size=9.6, leading=15, color=TEXT)
    c.showPage()


def page_financial(c, data):
    financial = data["financial"]
    metrics = data["metrics"]
    copy = growth_copy(data)
    header(
        c,
        data,
        page_with_optional_history(data, 7),
        "Leitura financeira",
        "Leitura Financeira",
        "Receita atual e horizonte de ganho potencial",
        data["guide_panels"]["financial"],
    )
    current_rows = [[row[0], fmt_money(row[1]), row[2]] for row in financial["current_rows"]]
    projection_rows = [
        [row[0], fmt_money(row[1]), fmt_money(row[2]), f"+{fmt_money(row[3])}" if row[3] > 0 else fmt_money(row[3])]
        for row in financial["projection_rows"]
    ]
    draw_table(
        c,
        MX + 28,
        PH - 184,
        430,
        ["Componente", "Valor", "%"],
        current_rows,
        [430 * 0.45, 430 * 0.35, 430 * 0.20],
        row_h=22,
        font_size=7.8,
        highlight_last=True,
    )
    draw_table(
        c,
        MX + 486,
        PH - 184,
        430,
        ["Componente", "Atual", "Projetado", "Ganho"],
        projection_rows,
        [430 * 0.24, 430 * 0.24, 430 * 0.26, 430 * 0.26],
        row_h=22,
        font_size=7.5,
        highlight_last=True,
        positive_cols={3},
    )

    trio_y = 126
    trio_w = (888 - 24) / 3
    trio_items = [
        ("2025 oficial", short_money(metrics["receita_2025"]), "Base anterior do município.", TEXT_DARK, WHITE),
        ("2026 atual", short_money(metrics["receita_prevista"]), copy["financial_2026"], ORANGE, colors.HexColor("#FFF7ED")),
        ("Com Rocha Prime", short_money(metrics["receita_com_rocha_prime"]), "Novo patamar projetado.", GREEN, colors.HexColor("#F1FAF2")),
    ]
    for idx, item in enumerate(trio_items):
        label, value, note, accent, bg = item
        x = MX + 28 + idx * (trio_w + 12)
        round_rect(c, x, trio_y, trio_w, 52, bg, radius=14)
        c.setFillColor(accent)
        c.rect(x, trio_y, 5, 52, fill=1, stroke=0)
        c.setFillColor(MUTED)
        c.setFont("BodyBold", 6.8)
        c.drawString(x + 14, trio_y + 37, label.upper())
        c.setFillColor(accent if accent != BLUE else TEXT_DARK)
        c.setFont("BodyBold", 15)
        c.drawString(x + 14, trio_y + 14, value)
        c.setFillColor(TEXT)
        c.setFont("Body", 7)
        c.drawRightString(x + trio_w - 12, trio_y + 12, note)

    round_rect(c, MX + 28, 34, 888, 78, GREEN_SOFT, radius=20)
    c.setFillColor(GREEN)
    c.rect(MX + 28, 34, 5, 78, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont("BodyBold", 12)
    c.drawString(MX + 50, 90, financial["highlight_title"])
    c.setFont("Heading", 24)
    c.drawString(MX + 50, 50, fmt_money(financial["highlight_value"]))
    wrap_para(c, financial["narrative"], MX + 300, 88, 580, size=9.3, leading=13.5, color=TEXT)
    c.showPage()


def page_method(c, data):
    method = data["method"]
    header(c, data, page_with_optional_history(data, 8), "Método", "Método e Diferenciais", method["title"], data["guide_panels"]["method"])
    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX + 28, PH - 170, method["subtitle"])

    x = MX + 28
    step_w = (888 - 36) / 4
    for idx, step in enumerate(method["steps"]):
        cx = x + idx * (step_w + 12)
        round_rect(c, cx, 236, step_w, 92, WHITE, stroke=colors.HexColor("#D8E3F5"), radius=18)
        round_rect(c, cx + 16, 294, 28, 28, LIGHT_BLUE, radius=14)
        c.setFillColor(BLUE)
        c.setFont("BodyBold", 11)
        c.drawCentredString(cx + 30, 303, str(idx + 1))
        c.setFillColor(TEXT_DARK)
        c.setFont("BodyBold", 10)
        c.drawString(cx + 16, 278, step[0])
        wrap_para(c, step[1], cx + 16, 266, step_w - 32, size=8.3, leading=11.5, color=TEXT)

    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 12)
    c.drawString(MX + 28, 184, "Diferenciais executivos")

    diff_w = (888 - 16) / 2
    for idx, text in enumerate(method["differentials"]):
        col = idx % 2
        row = idx // 2
        cx = MX + 28 + col * (diff_w + 16)
        cy = 122 - row * 50
        round_rect(c, cx, cy, diff_w, 40, PALE_CARD, radius=12)
        c.setFillColor(BLUE)
        c.circle(cx + 14, cy + 20, 3, fill=1, stroke=0)
        wrap_para(c, text, cx + 26, cy + 29, diff_w - 40, size=8.6, leading=12, color=TEXT)
    c.showPage()


def page_closing(c, data):
    closing = data["closing"]
    contact = data["contact"]
    header(c, data, page_with_optional_history(data, 9), "Encaminhamento", "Encaminhamento", "Fechamento executivo para reunião", data["guide_panels"]["closing"])

    c.setFillColor(TEXT_DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX + 28, PH - 170, "AGENDA PROPOSTA")

    agenda_w = (888 - 24) / 3
    for idx, step in enumerate(closing["agenda"]):
        cx = MX + 28 + idx * (agenda_w + 12)
        round_rect(c, cx, 236, agenda_w, 118, WHITE, stroke=colors.HexColor("#D8E3F5"), radius=18)
        round_rect(c, cx + 18, 306, 28, 28, LIGHT_BLUE, radius=14)
        c.setFillColor(BLUE)
        c.setFont("BodyBold", 10)
        c.drawCentredString(cx + 32, 315, f"{idx + 1:02d}")
        c.setFillColor(TEXT_DARK)
        c.setFont("BodyBold", 10)
        wrap_para(c, step[0], cx + 18, 298, agenda_w - 36, font="BodyBold", size=9.6, leading=12, color=TEXT_DARK)
        wrap_para(c, step[1], cx + 18, 270, agenda_w - 36, size=8.8, leading=12, color=TEXT)

    round_rect(c, MX + 28, 58, 888, 132, RIGHT_PANEL, radius=22)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 10)
    c.drawString(MX + 52, 166, closing["title"])
    wrap_para(c, closing["body"], MX + 52, 148, 500, size=10.2, leading=16, color=colors.HexColor("#E2E9FF"))

    c.setFont("BodyBold", 10)
    c.drawString(MX + 620, 166, "CONTATO")
    c.setFont("Body", 9)
    c.drawString(MX + 620, 144, contact["email"])
    c.drawString(MX + 620, 128, contact["phone"])
    c.drawString(MX + 620, 112, f"CNPJ: {contact['cnpj']}")
    c.setFillColor(ORANGE)
    c.setFont("BodyBold", 8)
    c.drawString(MX + 620, 92, contact["tagline"])
    c.showPage()


def main():
    if len(sys.argv) < 3:
        raise SystemExit("Uso: python scripts/generate-fundeb-executive-presentation.py <payload.json> <saida.pdf>")

    payload_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    with payload_path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)

    register_fonts()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output_path), pagesize=(PW, PH))
    page_cover(c, data)
    page_message(c, data)
    if has_history(data):
        page_history(c, data)
    page_scope(c, data)
    page_base(c, data)
    page_projection(c, data)
    page_comparison(c, data)
    page_financial(c, data)
    page_method(c, data)
    page_closing(c, data)
    c.save()
    print(output_path)


if __name__ == "__main__":
    main()
