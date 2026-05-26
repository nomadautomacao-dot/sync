import math
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent.parent
PRIMARY_LOGO = ROOT / "public" / "logo-rocha-prime.png"
sys.path.insert(0, str(ROOT))

from kit_padrao_pdf_rocha_prime.report_style_pdf import (  # noqa: E402
    BLUE,
    GREEN,
    LIGHT_BLUE,
    LOGO_SMALL,
    MUTED,
    NAVY,
    ORANGE,
    TEXT,
    WHITE,
    draw_footer,
    load_logo,
    register_fonts,
    round_rect,
)


PW = 960
PH = 540
MX = 34
MY = 26

BG = colors.HexColor("#EEF3FA")
SOFT = colors.HexColor("#EEF3FA")
SOFT_2 = colors.HexColor("#F8FAFD")
SOFT_GREEN = colors.HexColor("#ECF8F1")
SOFT_ORANGE = colors.HexColor("#FFF6EA")
SOFT_RED = colors.HexColor("#FCEDEE")
DARK = colors.HexColor("#1F2B46")
SLATE = colors.HexColor("#657089")
BORDER = colors.HexColor("#D9E2EF")
RED = colors.HexColor("#C23C3C")
INK = colors.HexColor("#101A33")
PANEL_DARK = colors.HexColor("#16233F")
PANEL_MID = colors.HexColor("#24385F")
GOLD = colors.HexColor("#B9832F")
SAND = colors.HexColor("#EEF3FA")
MINT = colors.HexColor("#E3F3EC")


CASE_DATA = {
    "material_date": "06/04/2026",
    "title": "Case de Sucesso Rocha Prime",
    "subtitle": "Quatro cidades, uma estrat\u00e9gia: reorganizar base, qualificar o Censo/FUNDEB e ampliar a inje\u00e7\u00e3o de recursos na educa\u00e7\u00e3o municipal.",
    "portfolio": {
        "cities": 4,
        "eja_gain": 1007,
        "integral_gain": 2640,
        "comp_gain_2026": 45126634.94,
        "fundeb_gain_2026": 62242544.54,
        "comp_gain_2426": 48239573.89,
        "fundeb_gain_2426": 71320616.84,
        "comp_total_2026": 96431888.33,
        "fundeb_total_2026": 195812821.58,
    },
    "cities": [
        {
            "name": "S\u00edtio do Mato",
            "uf": "BA",
            "tag": "Acelera\u00e7\u00e3o de receita",
            "instrument": "Relat\u00f3rio T\u00e9cnico Rocha Prime | Impacto Financeiro FUNDEB 2026",
            "contract_value": 0.0,
            "contract_display": "RELAT\u00d3RIO 2026",
            "actions": [
                "Correta presta\u00e7\u00e3o de informa\u00e7\u00f5es e adequa\u00e7\u00e3o de diretrizes junto ao FNDE e \u00e0 STN.",
                "Tratamento t\u00e9cnico de dados cont\u00e1beis, censo escolar e declara\u00e7\u00f5es federais com foco em ganho de arrecada\u00e7\u00e3o.",
                "Reestrutura\u00e7\u00e3o dos componentes VAAF, VAAT e VAAR para ampliar a captura financeira do FUNDEB.",
            ],
            "baseline": {
                "eja": 273,
                "integral": 96,
                "comp": 12938222.54,
                "fundeb": 27533970.45,
            },
            "transition": {
                "eja": 725,
                "integral": 591,
                "comp": 10751594.93,
                "fundeb": 24845500.62,
            },
            "result": {
                "comp": 28748426.00,
                "fundeb": 49400529.31,
            },
            "reading": "S\u00edtio do Mato entrou em forte acelera\u00e7\u00e3o de base e de receita. O munic\u00edpio saiu de um patamar mais baixo em 2024, expandiu EJA e integral em 2025 e chegou a 2026 com salto expressivo na complementa\u00e7\u00e3o da Uni\u00e3o e na receita total do FUNDEB.",
        },
        {
            "name": "Coribe",
            "uf": "BA",
            "tag": "Aceleração de base",
            "instrument": "Contrato 016/2026 | Inexigibilidade 013/2026",
            "contract_value": 302500.00,
            "actions": [
                "Assessoria técnica e consultoria educacional para gestão, monitoramento e regularização dos programas FNDE/MEC.",
                "Prestação de contas, operação de sistemas e apoio à gestão pedagógica, administrativa e financeira da secretaria.",
                "Acompanhamento presencial e remoto com foco em consistência de base, rotinas e execução educacional.",
            ],
            "baseline": {
                "eja": 43,
                "integral": 271,
                "comp": 9892872.82,
                "fundeb": 22731911.80,
            },
            "transition": {
                "eja": 161,
                "integral": 2088,
                "comp": 11636060.47,
                "fundeb": 25811660.68,
            },
            "result": {
                "comp": 27268289.22,
                "fundeb": 47356333.59,
            },
            "reading": "Coribe foi o salto mais agressivo da carteira. A expansão de EJA e, principalmente, de tempo integral mudou de patamar a leitura técnica da rede e ampliou de forma contundente a captura financeira do FUNDEB 2026.",
        },
        {
            "name": "São Félix do Coribe",
            "uf": "BA",
            "tag": "Escalada de captação",
            "instrument": "Contrato 101/2025 | Inexigibilidade IL010/2025",
            "contract_value": 330000.00,
            "actions": [
                "Consultoria técnica especializada para elaboração e monitoramento dos programas vinculados ao Portal FNDE e ao MEC.",
                "Equipe multidisciplinar para orientação técnica aos servidores, gestor municipal e unidades executoras.",
                "Atuação sobre eixos como UEX, CACS-FUNDEB, SIOPE e sistemas operacionais da educação municipal.",
            ],
            "baseline": {
                "eja": 90,
                "integral": 903,
                "comp": 14444742.70,
                "fundeb": 30599451.78,
            },
            "transition": {
                "eja": 566,
                "integral": 1397,
                "comp": 17278067.50,
                "fundeb": 35217566.95,
            },
            "result": {
                "comp": 27704466.50,
                "fundeb": 49933302.64,
            },
            "reading": "São Félix do Coribe converteu a agenda técnica em escala real de matrículas estratégicas. O ganho de EJA foi muito expressivo e a leitura financeira de 2026 mostra crescimento sólido tanto na complementação da União quanto na receita total do fundo.",
        },
        {
            "name": "São Desidério",
            "uf": "BA",
            "tag": "Implanta\u00e7\u00e3o em matura\u00e7\u00e3o",
            "instrument": "Inexigibilidade 074/2025 | Processo Administrativo 977/2025",
            "contract_value": 330000.00,
            "actions": [
                "Prestação de serviços de assessoria e consultoria diante dos programas e sistemas vinculados ao FNDE e ao MEC.",
                "Suporte técnico para secretaria de educação com foco em acompanhamento, rotinas e qualificação da operação.",
                "Estruturação de governança para manter aderência documental e sustentação das linhas de financiamento.",
            ],
            "baseline": {
                "eja": 153,
                "integral": 593,
                "comp": 10916476.38,
                "fundeb": 43626870.71,
            },
            "transition": {
                "eja": 114,
                "integral": 427,
                "comp": 11639530.49,
                "fundeb": 47695548.79,
            },
            "result": {
                "comp": 12710706.61,
                "fundeb": 49122656.04,
            },
            "reading": "Em S\u00e3o Desid\u00e9rio, a atua\u00e7\u00e3o foi iniciada em 2025 e a curva de resultado ainda est\u00e1 em matura\u00e7\u00e3o. Por isso, o recorte atual deve ser lido como fase de implanta\u00e7\u00e3o, ajuste de base e prepara\u00e7\u00e3o t\u00e9cnica para capturas mais fortes no ciclo seguinte, e n\u00e3o como fotografia final do potencial do trabalho.",
        },
    ],
    "method": [
        "Leitura da base 2024 para identificar EJA, tempo integral e composição financeira do FUNDEB.",
        "Atuação Rocha Prime em 2025 sobre FNDE/MEC, regularização, monitoramento e orientação técnica da secretaria.",
        "Captura do efeito em 2026 por meio das portarias oficiais do FUNDEB, com destaque para complementação da União e receita total.",
        "Matrículas de EJA e integral usam Censo Escolar 2024 e 2025. O efeito financeiro é mostrado nas portarias FUNDEB 2024, 2025 e 2026.",
    ],
    "sources": [
        "Censo Escolar INEP 2024 e 2025 (recorte municipal, base local do projeto).",
        "Portarias oficiais FUNDEB 2024, 2025 e 2026 (arquivos locais em /complementa\u00e7\u00e3o).",
        "Documentos contratuais anexados pelo usu\u00e1rio para S\u00e3o F\u00e9lix do Coribe, S\u00e3o Desid\u00e9rio e Coribe.",
        "Relat\u00f3rio T\u00e9cnico FUNDEB 2026 de S\u00edtio do Mato localizado no diret\u00f3rio de Downloads.",
    ],
}


def money(value):
    text = f"{value:,.2f}"
    return f"R$ {text.replace(',', 'X').replace('.', ',').replace('X', '.')}"


def money_short(value):
    if abs(value) >= 1_000_000:
        return f"R$ {value / 1_000_000:.2f} mi".replace(".", ",")
    if abs(value) >= 1_000:
        return f"R$ {value / 1_000:.1f} mil".replace(".", ",")
    return money(value)


def int_pt(value):
    return f"{int(round(value)):,}".replace(",", ".")


def pct(base, current):
    if not base:
        return 0.0
    return ((current - base) / base) * 100.0


def pct_text(base, current):
    value = pct(base, current)
    signal = "+" if value > 0 else ""
    return f"{signal}{value:.1f}%".replace(".", ",")


def delta_text(base, current):
    delta = current - base
    signal = "+" if delta > 0 else ""
    return f"{signal}{int_pt(delta)}"


def wrap_text(c, text, x, y, width, *, font="Body", size=10, leading=14, color=TEXT):
    from reportlab.platypus import Paragraph
    from reportlab.lib.styles import ParagraphStyle

    style = ParagraphStyle(
        "body",
        fontName=font,
        fontSize=size,
        leading=leading,
        textColor=color,
    )
    para = Paragraph(text, style)
    _, height = para.wrap(width, PH)
    para.drawOn(c, x, y - height)
    return y - height


def draw_page_bg(c):
    c.setFillColor(BG)
    c.rect(0, 0, PW, PH, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#F7FAFE"))
    c.circle(-20, PH - 20, 120, fill=1, stroke=0)
    c.circle(PW - 34, 92, 150, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#E0E9F7"))
    c.circle(PW - 96, PH - 36, 86, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#DCE6F5"))
    c.rect(PW - 18, 0, 18, PH, fill=1, stroke=0)


def draw_top_header(c, title, subtitle, *, page_label=None):
    c.setFillColor(PANEL_DARK)
    c.rect(0, PH - 112, PW, 112, fill=1, stroke=0)
    c.setFillColor(PANEL_MID)
    c.circle(PW - 42, PH - 8, 92, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#10203B"))
    c.circle(PW - 112, PH - 112, 82, fill=1, stroke=0)
    logo = load_logo(PRIMARY_LOGO if PRIMARY_LOGO.exists() else LOGO_SMALL)
    if logo:
        c.drawImage(logo, MX, PH - 52, 146, 35, mask="auto")
    c.setFillColor(colors.HexColor("#AFC1E8"))
    c.setFont("Body", 6.3)
    c.drawString(MX, PH - 60, "Educa\u00e7\u00e3o | Censo Escolar | FUNDEB")

    if page_label:
        chip_w = max(108, min(190, 34 + len(page_label) * 4.4))
        round_rect(c, PW - MX - chip_w, PH - 54, chip_w, 22, GOLD, radius=11)
        c.setFillColor(WHITE)
        c.setFont("BodyBold", 7)
        c.drawCentredString(PW - MX - (chip_w / 2), PH - 46.5, page_label.upper())

    c.setFillColor(WHITE)
    c.setFont("Heading", 22)
    c.drawString(MX, PH - 92, title)
    c.setFillColor(colors.HexColor("#D5E1FA"))
    c.setFont("Body", 8.5)
    c.drawString(MX, PH - 106, subtitle)
    c.setFillColor(GOLD)
    c.rect(MX, PH - 112, PW - (MX * 2), 2.5, fill=1, stroke=0)


def footer(c, page_num):
    c.setStrokeColor(colors.HexColor("#CCD8EA"))
    c.setLineWidth(0.8)
    c.line(MX, 24, PW - MX, 24)
    c.setFillColor(SLATE)
    c.setFont("Body", 6.3)
    c.drawString(MX, 12, "Fontes: INEP 2024/2025, Portarias FUNDEB 2024-2026 e instrumentos oficiais da carteira.")
    round_rect(c, PW - MX - 34, 7, 34, 12, PANEL_DARK, radius=6)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 6.8)
    c.drawCentredString(PW - MX - 17, 11, f"{page_num:02d}")


def panel_rect(c, x, y, w, h, fill, *, stroke=None, radius=18, shadow=None, dx=4, dy=-4):
    shadow = shadow if shadow is not None else colors.HexColor("#D8E3F2")
    round_rect(c, x + dx, y + dy, w, h, shadow, radius=radius)
    round_rect(c, x, y, w, h, fill, stroke=stroke, radius=radius)


def label_chip(c, x, y, w, text, *, fill=LIGHT_BLUE, text_color=BLUE):
    round_rect(c, x, y, w, 18, fill, radius=7)
    c.setFillColor(text_color)
    c.setFont("BodyBold", 6.9)
    c.drawCentredString(x + (w / 2), y + 5.3, text.upper())


def kpi_card(c, x, y, w, h, label, value, detail, *, accent=BLUE, bg=WHITE):
    panel_rect(c, x, y, w, h, bg, stroke=colors.HexColor("#D5E0F0"), radius=18)
    label_chip(c, x + 16, y + h - 28, min(120, w - 32), label, fill=SOFT_2, text_color=accent)
    c.setFillColor(accent)
    c.setFont("Heading", 24)
    c.drawString(x + 16, y + h - 58, value)
    c.setFillColor(TEXT)
    wrap_text(c, detail, x + 16, y + 24, w - 32, size=8, leading=11.2, color=TEXT)


def small_metric(c, x, y, w, h, label, value, note, *, positive=True):
    bg = SOFT_GREEN if positive else SOFT_RED
    accent = GREEN if positive else RED
    round_rect(c, x, y, w, h, bg, radius=14)
    c.setFillColor(accent)
    c.rect(x, y, 5, h, fill=1, stroke=0)
    c.setFillColor(SLATE)
    c.setFont("BodyBold", 6.5)
    c.drawString(x + 14, y + h - 16, label.upper())
    c.setFillColor(accent)
    c.setFont("BodyBold", 15)
    c.drawString(x + 14, y + 16, value)
    c.setFillColor(TEXT)
    c.setFont("Body", 7)
    c.drawString(x + 14, y + 6, note)


def bar_chart(c, x, y, w, h, values, labels, *, colors_list=None, title=None, format_fn=None, show_values=True):
    colors_list = colors_list or [BLUE, colors.HexColor("#81A9E8"), ORANGE]
    format_fn = format_fn or money_short
    round_rect(c, x, y, w, h, WHITE, stroke=BORDER, radius=18)
    if title:
        c.setFillColor(DARK)
        c.setFont("BodyBold", 9)
        c.drawString(x + 18, y + h - 22, title)

    inner_x = x + 30
    inner_y = y + 26
    inner_h = h - 58
    max_val = max(abs(value) for value in values) if values else 1
    slots = max(1, len(values))
    available_w = max(40, w - 58)
    gap = 26 if slots >= 3 else 14
    bar_w = min(54, (available_w - gap * (slots - 1)) / slots)
    if bar_w < 22:
        gap = 8
        bar_w = max(22, (available_w - gap * (slots - 1)) / slots)

    c.setStrokeColor(colors.HexColor("#E6EDF7"))
    for idx in range(1, 4):
        guide_y = inner_y + (inner_h / 4) * idx
        c.line(inner_x - 8, guide_y, x + w - 22, guide_y)

    for idx, value in enumerate(values):
        bx = inner_x + idx * (bar_w + gap)
        bh = 12 if max_val <= 0 else max(12, (abs(value) / max_val) * inner_h)
        fill = RED if value < 0 else colors_list[idx % len(colors_list)]
        round_rect(c, bx, inner_y, bar_w, bh, fill, radius=10)
        c.setFillColor(DARK)
        c.setFont("BodyBold", 7)
        c.drawCentredString(bx + bar_w / 2, inner_y - 14, labels[idx])
        if show_values:
            c.setFillColor(fill)
            c.setFont("BodyBold", 7)
            c.drawCentredString(bx + bar_w / 2, inner_y + bh + 10, format_fn(value))


def premium_chart_panel(c, x, y, w, h, title, values, labels, colors_list, format_fn, *, mixed=False, footer_note=None, summary_text=None):
    panel_rect(c, x, y, w, h, PANEL_DARK, radius=16, shadow=colors.HexColor("#D7E2F3"), dx=4, dy=-4)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 9)
    wrap_text(c, title, x + 16, y + h - 18, w - 120, font="BodyBold", size=9, leading=11, color=WHITE)

    if footer_note:
        wrap_text(
            c,
            footer_note,
            x + 16,
            y + h - 36,
            w - 120,
            size=6.8,
            leading=8.6,
            color=colors.HexColor("#BFD2F0"),
        )

    if values and summary_text is not False:
        summary = summary_text if summary_text is not None else (format_fn(values[-1] - values[0]) if mixed else pct_text(values[0], values[-1]))
        label_chip(c, x + w - 94, y + h - 30, 76, summary, fill=colors.HexColor("#C08A33"), text_color=WHITE)

    plot_x = x + 16
    plot_y = y + 34
    plot_w = w - 32
    plot_h = h - 66
    round_rect(c, plot_x, plot_y, plot_w, plot_h, colors.HexColor("#10203A"), radius=10)
    c.setStrokeColor(colors.HexColor("#3E557F"))
    c.setLineWidth(1.2)
    c.line(plot_x + 10, plot_y + 18, plot_x + 10, plot_y + plot_h - 10)

    if mixed:
        max_abs = max(abs(v) for v in values) if values else 1
        zero_y = plot_y + plot_h * 0.5
        guides = [plot_y + plot_h * 0.2, zero_y, plot_y + plot_h * 0.8]
    else:
        max_abs = max(values) if values else 1
        zero_y = plot_y + 24
        guides = [plot_y + plot_h * 0.32, plot_y + plot_h * 0.56, plot_y + plot_h * 0.78]

    c.setStrokeColor(colors.HexColor("#2C446E"))
    c.setLineWidth(0.9)
    for gy in guides:
        c.line(plot_x + 10, gy, plot_x + plot_w - 10, gy)

    slots = max(1, len(values))
    gap = 8 if slots >= 4 else 12
    inner_w = plot_w - 28
    bar_w = min(40, (inner_w - gap * (slots - 1)) / slots)
    total_w = slots * bar_w + (slots - 1) * gap
    start_x = plot_x + (plot_w - total_w) / 2

    if mixed:
        c.setStrokeColor(colors.HexColor("#43618F"))
        c.setLineWidth(1.4)
        c.line(plot_x + 10, zero_y, plot_x + plot_w - 10, zero_y)
    else:
        c.setStrokeColor(colors.HexColor("#43618F"))
        c.setLineWidth(1.4)
        c.line(plot_x + 10, zero_y, plot_x + plot_w - 10, zero_y)

    for idx, value in enumerate(values):
        bx = start_x + idx * (bar_w + gap)
        fill = RED if value < 0 else colors_list[idx % len(colors_list)]
        if mixed:
            height = max(10, (abs(value) / max_abs) * (plot_h * 0.34)) if max_abs else 10
            by = zero_y if value >= 0 else zero_y - height
            ty = by + height + 8 if value >= 0 else by - 10
        else:
            height = max(12, (value / max_abs) * (plot_h - 64)) if max_abs else 12
            by = zero_y
            ty = by + height + 8

        c.setFillColor(fill)
        c.rect(bx, by, bar_w, height, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#0D1830"))
        c.rect(bx, zero_y - 4, bar_w, 4, fill=1, stroke=0)

        val_box_w = min(52, bar_w + 18)
        val_box_x = bx + (bar_w - val_box_w) / 2
        val_box_y = min(max(ty, plot_y + 30), y + h - 38)
        round_rect(c, val_box_x, val_box_y, val_box_w, 12, colors.HexColor("#1F3155"), radius=3)
        c.setFillColor(WHITE if value >= 0 else colors.HexColor("#FFDADA"))
        c.setFont("BodyBold", 6.1)
        c.drawCentredString(bx + (bar_w / 2), val_box_y + 3.8, format_fn(value))

        label_y = plot_y + 4
        round_rect(c, bx - 2, label_y, bar_w + 4, 11, colors.HexColor("#162744"), radius=3)
        c.setFillColor(colors.HexColor("#D7E4FC"))
        c.setFont("BodyBold", 6.5)
        c.drawCentredString(bx + (bar_w / 2), label_y + 3.4, labels[idx])


def draw_cover(c):
    c.setFillColor(PANEL_DARK)
    c.rect(0, 0, PW, PH, fill=1, stroke=0)
    c.setFillColor(PANEL_MID)
    c.circle(PW - 48, PH - 42, 122, fill=1, stroke=0)
    c.circle(PW - 172, 104, 164, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#0E1830"))
    c.circle(158, 124, 126, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#203157"))
    c.rect(0, 0, 196, 10, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(0, 0, PW, 6, fill=1, stroke=0)

    logo = load_logo(PRIMARY_LOGO if PRIMARY_LOGO.exists() else LOGO_SMALL)
    if logo:
        c.drawImage(logo, MX, PH - 72, 204, 49, mask="auto")
    c.setFillColor(colors.HexColor("#D8E3FA"))
    c.setFont("BodyBold", 9)
    c.drawString(MX, PH - 86, "APRESENTACAO EXECUTIVA")
    c.setFillColor(GOLD)
    c.setFont("BodyBold", 7.5)
    c.drawString(MX, PH - 104, "BAHIA | 2024-2026")

    top = PH - 146
    top = wrap_text(c, CASE_DATA["title"], MX, top, 446, font="Heading", size=34, leading=38, color=WHITE)
    wrap_text(
        c,
        CASE_DATA["subtitle"],
        MX,
        top - 22,
        462,
        size=12.4,
        leading=17.5,
        color=colors.HexColor("#CBD9F6"),
    )

    panel_rect(c, MX, 54, 486, 148, colors.HexColor("#F7FAFE"), radius=24, shadow=colors.HexColor("#0C1428"))
    label_chip(c, MX + 18, 176, 152, "Evolucao acumulada do case", fill=GOLD, text_color=WHITE)
    c.setFillColor(INK)
    c.setFont("Heading", 26)
    c.drawString(MX + 18, 136, money_short(CASE_DATA["portfolio"]["comp_gain_2426"]))
    c.setFillColor(TEXT)
    c.setFont("BodyBold", 8.5)
    c.drawString(MX + 18, 118, "de ganho acumulado em complementa\u00e7\u00e3o entre 2024 e 2026")
    wrap_text(
        c,
        "O case combina escala financeira, reorganiza\u00e7\u00e3o de base e capta\u00e7\u00e3o oficial de recursos para a educa\u00e7\u00e3o municipal. Apenas no recorte 2025 para 2026, o ganho adicional foi de R$ 45,13 mi.",
        MX + 18,
        98,
        448,
        size=8.6,
        leading=12.4,
        color=TEXT,
    )
    label_chip(c, MX + 18, 58, 110, f"+{int_pt(CASE_DATA['portfolio']['eja_gain'])} EJA", fill=SOFT_GREEN, text_color=GREEN)
    label_chip(c, MX + 136, 58, 128, f"+{int_pt(CASE_DATA['portfolio']['integral_gain'])} INTEGRAL", fill=colors.HexColor("#E7B15A"), text_color=WHITE)

    stat_x = 566
    stat_y = 292
    stat_w = 324
    stat_h = 76
    stats = [
        ("Munic\u00edpios no case", "4 cidades", "S\u00edtio do Mato, Coribe, S\u00e3o F\u00e9lix do Coribe e S\u00e3o Desid\u00e9rio", GOLD),
        ("Receita total ampliada", money_short(CASE_DATA["portfolio"]["fundeb_gain_2426"]), "crescimento agregado do FUNDEB entre 2024 e 2026", BLUE),
        ("Fundo total em 2026", money_short(CASE_DATA["portfolio"]["fundeb_total_2026"]), "massa financeira total das quatro redes em 2026", GREEN),
    ]
    for idx, (label, value, detail, accent) in enumerate(stats):
        y = stat_y - idx * 92
        panel_rect(c, stat_x, y, stat_w, stat_h, colors.HexColor("#12213D"), radius=22, shadow=colors.HexColor("#0A1328"))
        label_chip(c, stat_x + 16, y + 48, 118, label, fill=accent, text_color=WHITE)
        c.setFillColor(WHITE)
        c.setFont("Heading", 22)
        c.drawString(stat_x + 16, y + 22, value)
        c.setFillColor(colors.HexColor("#CDD9F4"))
        c.setFont("Body", 7.8)
        wrap_text(c, detail, stat_x + 146, y + 40, 156, size=7.8, leading=10.5, color=colors.HexColor("#CDD9F4"))

    c.setFillColor(colors.HexColor("#CAD7F3"))
    c.setFont("Body", 8)
    c.drawString(566, 54, "Cidades analisadas")
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 10)
    c.drawString(566, 38, "S\u00edtio do Mato | Coribe | S\u00e3o F\u00e9lix do Coribe")
    c.drawString(566, 27, "S\u00e3o Desid\u00e9rio")
    c.setFillColor(colors.HexColor("#CAD7F3"))
    c.setFont("Body", 8)
    c.drawRightString(PW - MX, 54, CASE_DATA["material_date"])

    footer(c, 1)
    c.showPage()


def draw_portfolio_page(c):
    draw_page_bg(c)
    draw_top_header(
        c,
        "Impacto consolidado do portf\u00f3lio",
        "Leitura executiva do que cresceu na base e no caixa do FUNDEB.",
        page_label="Visao geral",
    )

    p = CASE_DATA["portfolio"]
    top_y = 310
    top_w = (PW - (MX * 2) - 16) / 2
    kpi_card(
        c,
        MX,
        top_y,
        top_w,
        100,
        "Comp. acumulada",
        money_short(p["comp_gain_2426"]),
        "Ganho agregado de 2024 para 2026 nas quatro cidades. S\u00f3 no recorte de 2025 para 2026 foram R$ 45,13 mi adicionais.",
        accent=GREEN,
        bg=WHITE,
    )
    kpi_card(
        c,
        MX + top_w + 16,
        top_y,
        top_w,
        100,
        "FUNDEB acumulado",
        money_short(p["fundeb_gain_2426"]),
        "Crescimento agregado da receita total do FUNDEB entre 2024 e 2026, com base nas portarias oficiais.",
        accent=ORANGE,
        bg=WHITE,
    )
    chart_y = 84
    chart_w = (PW - (MX * 2) - 24) / 3
    premium_chart_panel(
        c,
        MX,
        chart_y,
        chart_w,
        206,
        "Complementa\u00e7\u00e3o adicional em 2026",
        [17996831.07, 15632228.75, 10426399.00, 1071176.12],
        ["S\u00edtio", "Coribe", "S. F\u00e9lix", "S. Desid."],
        [NAVY, GREEN, BLUE, ORANGE],
        money_short,
        footer_note="2025 versus 2026",
        summary_text=False,
    )
    premium_chart_panel(
        c,
        MX + chart_w + 12,
        chart_y,
        chart_w,
        206,
        "Varia\u00e7\u00e3o l\u00edquida em EJA",
        [452, 118, 476, -39],
        ["S\u00edtio", "Coribe", "S. F\u00e9lix", "S. Desid."],
        [NAVY, GREEN, BLUE, ORANGE],
        lambda v: f"{'+' if v > 0 else ''}{int_pt(v)}",
        mixed=True,
        footer_note="2024 versus 2025",
        summary_text=False,
    )
    premium_chart_panel(
        c,
        MX + (chart_w + 12) * 2,
        chart_y,
        chart_w,
        206,
        "Varia\u00e7\u00e3o l\u00edquida em integral",
        [495, 1817, 494, -166],
        ["S\u00edtio", "Coribe", "S. F\u00e9lix", "S. Desid."],
        [NAVY, GREEN, BLUE, ORANGE],
        lambda v: f"{'+' if v > 0 else ''}{int_pt(v)}",
        mixed=True,
        footer_note="2024 versus 2025",
        summary_text=False,
    )

    panel_rect(c, MX, 34, PW - (MX * 2), 34, colors.HexColor("#F7FAFE"), radius=14, shadow=colors.HexColor("#D7E3F2"))
    c.setFillColor(DARK)
    c.setFont("BodyBold", 8.2)
    c.drawString(MX + 16, 47, "Leitura executiva")
    wrap_text(
        c,
        "O portf\u00f3lio mostra uma mesma l\u00f3gica de trabalho: qualificar base, aumentar ader\u00eancia t\u00e9cnica e transformar essa disciplina em mais receita para a educa\u00e7\u00e3o. S\u00edtio do Mato, Coribe e S\u00e3o F\u00e9lix aceleram a curva de base; S\u00e3o Desid\u00e9rio aparece como frente de implanta\u00e7\u00e3o ainda em matura\u00e7\u00e3o.",
        MX + 126,
        49,
        770,
        size=8.2,
        leading=11.2,
        color=TEXT,
    )

    footer(c, 2)
    c.showPage()


def draw_method_page(c):
    draw_page_bg(c)
    draw_top_header(
        c,
        "Como o case foi estruturado",
        "Da leitura da base \u00e0 captura do resultado financeiro oficial.",
        page_label="M\u00e9todo",
    )

    timeline_x = MX
    timeline_y = 244
    col_w = (PW - (MX * 2) - 24) / 3
    steps = [
        ("2024 | Diagn\u00f3stico", "Leitura da base municipal de EJA, tempo integral e receita FUNDEB para mostrar o ponto de partida da rede."),
        ("2025 | Atua\u00e7\u00e3o Rocha Prime", "Assessoria t\u00e9cnica, monitoramento FNDE/MEC, regulariza\u00e7\u00e3o, apoio \u00e0 gest\u00e3o e orienta\u00e7\u00e3o operacional das secretarias."),
        ("2026 | Resultado capturado", "Leitura das portarias oficiais do FUNDEB para mostrar a inje\u00e7\u00e3o financeira ap\u00f3s a reorganiza\u00e7\u00e3o da base."),
    ]
    fills = [colors.HexColor("#12213D"), colors.HexColor("#23365C"), colors.HexColor("#1A4A3B")]
    accents = [GOLD, ORANGE, colors.HexColor("#7DE2AF")]
    for idx, step in enumerate(steps):
        x = timeline_x + idx * (col_w + 12)
        panel_rect(c, x, timeline_y, col_w, 164, fills[idx], radius=22, shadow=colors.HexColor("#D4C5AE"))
        round_rect(c, x + 18, timeline_y + 114, 38, 26, colors.HexColor("#F8E6C9"), radius=13)
        c.setFillColor(accents[idx])
        c.setFont("BodyBold", 11)
        c.drawCentredString(x + 37, timeline_y + 123, str(idx + 1))
        c.setFillColor(WHITE)
        c.setFont("BodyBold", 11)
        c.drawString(x + 18, timeline_y + 92, step[0])
        wrap_text(c, step[1], x + 18, timeline_y + 76, col_w - 36, size=9, leading=13.2, color=colors.HexColor("#D8E4FC"))

    c.setFillColor(DARK)
    c.setFont("BodyBold", 11)
    c.drawString(MX, 214, "O que fizemos na pr\u00e1tica")
    cards = [
        ("Programas e sistemas FNDE/MEC", "Monitoramento de plataformas, programas, exig\u00eancias e fluxos operacionais da educa\u00e7\u00e3o."),
        ("Regulariza\u00e7\u00e3o e presta\u00e7\u00e3o de contas", "Apoio \u00e0 consist\u00eancia documental, presta\u00e7\u00e3o de contas e leitura de conformidade."),
        ("Base estrat\u00e9gica de matr\u00edculas", "Foco em EJA e tempo integral como vetores de reorganiza\u00e7\u00e3o e captura financeira."),
        ("Orienta\u00e7\u00e3o \u00e0 equipe da secretaria", "Atua\u00e7\u00e3o com servidores, gest\u00e3o e frentes operacionais para executar o plano."),
    ]
    cw = (PW - (MX * 2) - 12) / 2
    for idx, item in enumerate(cards):
        x = MX + (idx % 2) * (cw + 12)
        y = 122 - (idx // 2) * 64
        panel_rect(c, x, y, cw, 50, colors.HexColor("#F8FBFE"), stroke=colors.HexColor("#D5E0F0"), radius=16, shadow=colors.HexColor("#D8E3F2"))
        c.setFillColor(GOLD if idx % 2 == 0 else BLUE)
        c.circle(x + 18, y + 25, 4, fill=1, stroke=0)
        c.setFillColor(DARK)
        c.setFont("BodyBold", 8.6)
        c.drawString(x + 30, y + 31, item[0])
        c.setFillColor(TEXT)
        c.setFont("Body", 7.2)
        c.drawString(x + 30, y + 14, item[1])

    footer(c, 3)
    c.showPage()


def draw_city_page(c, city, page_num):
    draw_page_bg(c)
    draw_top_header(
        c,
        f"{city['name']} | {city['tag']}",
        "Base 2024, atua\u00e7\u00e3o em 2025 e efeito financeiro oficial em 2026.",
        page_label=city["name"],
    )

    left_x = MX
    left_y = 54
    left_w = 526
    left_h = 350
    right_x = left_x + left_w + 18
    chart_size = 168
    grid_gap = 12
    top_row_y = 236
    bottom_row_y = 56

    panel_rect(c, left_x, left_y, left_w, left_h, colors.HexColor("#F8FBFE"), stroke=colors.HexColor("#D5E0F0"), radius=22, shadow=colors.HexColor("#D8E3F2"))
    tag_w = max(120, min(190, 26 + len(city["tag"]) * 4.2))
    label_chip(c, left_x + 18, left_y + left_h - 30, tag_w, city["tag"], fill=GOLD, text_color=WHITE)
    top_right_text = city.get("contract_display", money(city["contract_value"]))
    label_chip(c, left_x + left_w - 142, left_y + left_h - 30, 124, top_right_text, fill=colors.HexColor("#20345C"), text_color=WHITE)
    c.setFillColor(DARK)
    c.setFont("BodyBold", 8.5)
    c.drawString(left_x + 18, left_y + left_h - 52, city["instrument"])

    chip_y = left_y + left_h - 112
    chip_w = (left_w - 52) / 3
    deltas = [
        ("EJA", delta_text(city["baseline"]["eja"], city["transition"]["eja"]), pct_text(city["baseline"]["eja"], city["transition"]["eja"]), GREEN if city["transition"]["eja"] >= city["baseline"]["eja"] else RED, SOFT_GREEN if city["transition"]["eja"] >= city["baseline"]["eja"] else SOFT_RED),
        ("Integral", delta_text(city["baseline"]["integral"], city["transition"]["integral"]), pct_text(city["baseline"]["integral"], city["transition"]["integral"]), ORANGE if city["transition"]["integral"] >= city["baseline"]["integral"] else RED, SOFT_ORANGE if city["transition"]["integral"] >= city["baseline"]["integral"] else SOFT_RED),
        ("Comp. 2026", money_short(city["result"]["comp"] - city["transition"]["comp"]), pct_text(city["transition"]["comp"], city["result"]["comp"]), BLUE if city["result"]["comp"] >= city["transition"]["comp"] else RED, SOFT_2 if city["result"]["comp"] >= city["transition"]["comp"] else SOFT_RED),
    ]
    for idx, (label, value, note, accent, bg) in enumerate(deltas):
        x = left_x + 18 + idx * (chip_w + 8)
        round_rect(c, x, chip_y, chip_w, 56, bg, radius=14)
        c.setFillColor(accent)
        c.setFont("BodyBold", 6.8)
        c.drawString(x + 12, chip_y + 40, label.upper())
        c.setFont("Heading", 16)
        c.drawString(x + 12, chip_y + 18, value)
        c.setFillColor(TEXT)
        c.setFont("BodyBold", 6.8)
        c.drawRightString(x + chip_w - 12, chip_y + 10, note)

    box_y = left_y + 120
    box_w = (left_w - 60) / 3
    items = [
        ("2024", city["baseline"], "Base"),
        ("2025", city["transition"], "Atua\u00e7\u00e3o"),
        ("2026", city["result"], "Resultado"),
    ]
    fills = [colors.HexColor("#EEF4FD"), colors.HexColor("#F8F0DE"), colors.HexColor("#E7F4EF")]
    for idx, (label, payload, note) in enumerate(items):
        x = left_x + 18 + idx * (box_w + 12)
        round_rect(c, x, box_y, box_w, 94, fills[idx], radius=16)
        c.setFillColor(DARK)
        c.setFont("BodyBold", 8.8)
        c.drawString(x + 12, box_y + 72, label)
        c.setFillColor(SLATE)
        c.setFont("BodyBold", 6.6)
        c.drawString(x + 12, box_y + 60, note.upper())
        c.setFillColor(TEXT)
        c.setFont("Body", 7.4)
        if "eja" in payload:
            c.drawString(x + 12, box_y + 40, f"EJA: {int_pt(payload['eja'])}")
            c.drawString(x + 12, box_y + 26, f"Integral: {int_pt(payload['integral'])}")
            c.drawString(x + 12, box_y + 12, f"Comp.: {money_short(payload['comp'])}")
        else:
            c.drawString(x + 12, box_y + 40, f"Comp.: {money_short(payload['comp'])}")
            c.drawString(x + 12, box_y + 26, f"FUNDEB: {money_short(payload['fundeb'])}")
            c.drawString(x + 12, box_y + 12, "Portarias oficiais")

    c.setFillColor(DARK)
    c.setFont("BodyBold", 9)
    c.drawString(left_x + 18, left_y + 98, "Leitura executiva")
    text_y = wrap_text(c, city["reading"], left_x + 18, left_y + 84, left_w - 36, size=8.1, leading=11.2, color=TEXT)
    text_y -= 4
    for action in city["actions"]:
        text_y = wrap_text(c, f"- {action}", left_x + 18, text_y, left_w - 36, size=7.4, leading=10.1, color=TEXT)
        text_y -= 1

    premium_chart_panel(
        c,
        right_x,
        top_row_y,
        chart_size,
        chart_size,
        "EJA",
        [city["baseline"]["eja"], city["transition"]["eja"]],
        ["2024", "2025"],
        [colors.HexColor("#8CB6FF"), GREEN],
        lambda v: int_pt(v),
        footer_note="Matr. municipais",
    )
    premium_chart_panel(
        c,
        right_x + chart_size + grid_gap,
        top_row_y,
        chart_size,
        chart_size,
        "Integral",
        [city["baseline"]["integral"], city["transition"]["integral"]],
        ["2024", "2025"],
        [colors.HexColor("#F2C57A"), ORANGE],
        lambda v: int_pt(v),
        footer_note="Matr. municipais",
    )
    premium_chart_panel(
        c,
        right_x,
        bottom_row_y,
        chart_size,
        chart_size,
        "Comp.",
        [city["baseline"]["comp"], city["transition"]["comp"], city["result"]["comp"]],
        ["2024", "2025", "2026"],
        [colors.HexColor("#88A8D9"), BLUE, GREEN],
        money_short,
        footer_note="Valores oficiais",
    )
    premium_chart_panel(
        c,
        right_x + chart_size + grid_gap,
        bottom_row_y,
        chart_size,
        chart_size,
        "FUNDEB",
        [city["baseline"]["fundeb"], city["transition"]["fundeb"], city["result"]["fundeb"]],
        ["2024", "2025", "2026"],
        [colors.HexColor("#C39A59"), GOLD, ORANGE],
        money_short,
        footer_note="Receita total",
    )

    footer(c, page_num)
    c.showPage()


def draw_closing_page(c):
    draw_page_bg(c)
    draw_top_header(
        c,
        "Mensagem final para apresentação",
        "O que o superior precisa enxergar em uma única leitura.",
        page_label="Fechamento",
    )

    round_rect(c, MX, 248, 892, 168, NAVY, radius=26)
    c.setFillColor(WHITE)
    c.setFont("Heading", 24)
    c.drawString(MX + 28, 372, "A Rocha Prime não entregou só consultoria.")
    c.drawString(MX + 28, 338, "Entregou base mais forte e mais caixa para a educação.")
    wrap_text(
        c,
        "Nos municípios em que a estratégia ganhou tração, o efeito foi direto: crescimento de EJA, avanço forte de tempo integral e maior captura financeira no FUNDEB 2026. Onde a base física ainda não acelerou, a governança técnica ajudou a preservar crescimento e estabilidade de receita.",
        MX + 28,
        306,
        620,
        size=11,
        leading=17,
        color=colors.HexColor("#E2E9F8"),
    )

    round_rect(c, 706, 276, 192, 102, colors.HexColor("#32416B"), radius=18)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 8.5)
    c.drawString(724, 352, "PORTFÓLIO 2026")
    c.setFont("Heading", 24)
    c.drawString(724, 322, money_short(CASE_DATA["portfolio"]["comp_gain_2026"]))
    c.setFont("Body", 8)
    c.drawString(724, 300, "de complementação adicional")
    c.drawString(724, 284, "capturada nas quatro cidades")

    c.setFillColor(DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX, 218, "Mensagem que pode abrir a reunião")
    round_rect(c, MX, 128, 892, 72, WHITE, stroke=BORDER, radius=18)
    quote = (
        "Entre 2024 e 2026, mostramos que consultoria boa não é discurso: é matrícula estratégica bem capturada, "
        "é base técnica organizada e é recurso novo entrando de forma concreta na educação municipal."
    )
    wrap_text(c, quote, MX + 22, 176, 848, font="BodyBold", size=11.2, leading=16, color=DARK)

    c.setFillColor(DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX, 94, "Base metodológica e fontes")
    src_y = 78
    for source in CASE_DATA["sources"]:
        src_y = wrap_text(c, f"• {source}", MX, src_y, 900, size=8.4, leading=11.5, color=TEXT)
        src_y -= 2

    footer(c, 8)
    c.showPage()


def draw_closing_page_v2(c):
    draw_page_bg(c)
    draw_top_header(
        c,
        "Resultados consolidados do case",
        "Evolu\u00e7\u00e3o educacional e financeira capturada entre 2024 e 2026.",
        page_label="Fechamento",
    )

    panel_rect(c, MX, 244, 892, 172, PANEL_DARK, radius=26, shadow=colors.HexColor("#D8E3F2"))
    c.setFillColor(WHITE)
    c.setFont("Heading", 24)
    c.drawString(MX + 28, 370, "A Rocha Prime nao entregou so consultoria.")
    c.drawString(MX + 28, 336, "Entregou base mais forte e mais caixa para a educa\u00e7\u00e3o.")
    wrap_text(
        c,
        "Nos munic\u00edpios em que a estrat\u00e9gia ganhou tra\u00e7\u00e3o, o efeito foi direto: crescimento de EJA, avan\u00e7o forte de tempo integral e maior captura financeira no FUNDEB 2026. Onde a base f\u00edsica ainda n\u00e3o acelerou, a governan\u00e7a t\u00e9cnica ajudou a preservar crescimento e estabilidade de receita.",
        MX + 28,
        304,
        620,
        size=11,
        leading=17,
        color=colors.HexColor("#E2E9F8"),
    )

    round_rect(c, 706, 276, 192, 102, colors.HexColor("#24385F"), radius=18)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 8.5)
    c.drawString(724, 352, "PORTFOLIO 2026")
    c.setFont("Heading", 24)
    c.drawString(724, 322, money_short(CASE_DATA["portfolio"]["comp_gain_2026"]))
    c.setFont("Body", 8)
    c.drawString(724, 300, "de complementa\u00e7\u00e3o adicional")
    c.drawString(724, 284, "capturada nas quatro cidades")

    c.setFillColor(DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX, 214, "S\u00edntese executiva")
    panel_rect(c, MX, 128, 892, 72, WHITE, stroke=colors.HexColor("#D5E0F0"), radius=18, shadow=colors.HexColor("#D8E3F2"))
    quote = (
        "Entre 2024 e 2026, mostramos que consultoria boa n\u00e3o \u00e9 discurso: \u00e9 matr\u00edcula estrat\u00e9gica bem capturada, "
        "\u00e9 base t\u00e9cnica organizada e \u00e9 recurso novo entrando de forma concreta na educa\u00e7\u00e3o municipal."
    )
    wrap_text(c, quote, MX + 22, 176, 848, font="BodyBold", size=11.2, leading=16, color=DARK)

    c.setFillColor(DARK)
    c.setFont("BodyBold", 10)
    c.drawString(MX, 94, "Base metodol\u00f3gica e fontes")
    src_y = 78
    for source in CASE_DATA["sources"]:
        src_y = wrap_text(c, f"- {source}", MX, src_y, 900, size=8.4, leading=11.5, color=TEXT)
        src_y -= 2

    footer(c, 8)
    c.showPage()


def main():
    output = ROOT / "outputs" / "case_sucesso_rocha_prime_bahia_2024_2026.pdf"
    output.parent.mkdir(parents=True, exist_ok=True)

    register_fonts()
    c = canvas.Canvas(str(output), pagesize=(PW, PH))

    draw_cover(c)
    draw_portfolio_page(c)
    draw_method_page(c)
    draw_city_page(c, CASE_DATA["cities"][0], 4)
    draw_city_page(c, CASE_DATA["cities"][1], 5)
    draw_city_page(c, CASE_DATA["cities"][2], 6)
    draw_city_page(c, CASE_DATA["cities"][3], 7)
    draw_closing_page_v2(c)

    c.save()
    print(output)


if __name__ == "__main__":
    main()
