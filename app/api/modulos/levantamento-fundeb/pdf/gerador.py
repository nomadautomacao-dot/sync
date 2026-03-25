import sys
import json
import tempfile
import os
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

try:
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from kit_padrao_pdf_rocha_prime.report_style_pdf import (
        PAGE_W, PAGE_H, MARGIN_X, draw_header, draw_footer, draw_section_title,
        draw_kv_table, draw_highlight_box, draw_paragraph, draw_cover,
        fmt_money, fmt_int, register_fonts, round_rect,
        NAVY, BLUE, TEXT, MUTED, LINE, LIGHT_BLUE, GREEN, WHITE, SOFT_ROW, ORANGE
    )
except ImportError as e:
    sys.stderr.write(f"Import error: {e}\n")
    sys.exit(1)

LIGHT_ORANGE = colors.HexColor("#FFF7EC")

def f_money(v):
    try:
        return fmt_money(float(v or 0))
    except Exception:
        return "R$ 0,00"

def f_int(v):
    try:
        return fmt_int(int(v or 0))
    except Exception:
        return "0"

def f_int_na(v, default="-"):
    if v in (None, "", "null", "None"):
        return default
    return f_int(v)

def f_pct(v):
    try:
        return f"{float(v or 0):.1f}%".replace(".", ",")
    except Exception:
        return "0,0%"

def calc_pct(part, total):
    try:
        total_f = float(total or 0)
        if total_f <= 0:
            return None
        return (float(part or 0) / total_f) * 100
    except Exception:
        return None

import unicodedata

def normalize_ptbr_text(value):
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    try:
        repaired = text.encode("latin1").decode("utf-8")
        if any(ch in repaired for ch in "áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ"):
            text = repaired
    except Exception:
        pass
    return text.replace("\xa0", " ")

def f_str(v, default="-"):
    s = normalize_ptbr_text(v)
    if not s or s.lower() in ("none", "null", "undefined"):
        return default
    # Fix broken encodings from DB source
    s = s.replace("c\ufffdlculo", "cálculo").replace("\ufffd", "")
    return s

def safe_text(v):
    return f_str(v)

def safe_row(cells):
    """Apply safe_text to all cells in a row."""
    return [safe_text(c) for c in cells]

def draw_bullets_box(c, x, y, w, label, bullets):
    """Draw a table-style box with word-wrapped bullet lines using Paragraph.
    Handles full Unicode (accents, cedillas) correctly.
    Returns new y position after drawing.
    """
    from reportlab.platypus import Paragraph
    from reportlab.lib.styles import ParagraphStyle

    HEADER_H = 24
    PAD = 10

    # Build paragraph objects and calculate heights
    style = ParagraphStyle(
        'bullet_s', fontName='Body', fontSize=7.5,
        leading=13, textColor=TEXT, spaceAfter=4
    )
    paras = []
    total_text_h = 0
    for b in (bullets or ["Sem dados."]):
        p = Paragraph(b, style)
        _, ph = p.wrap(w - 2 * PAD, 9999)
        paras.append((p, ph))
        total_text_h += ph + 6

    box_h = HEADER_H + PAD + total_text_h + PAD

    # Background
    round_rect(c, x, y - box_h, w, box_h, LIGHT_BLUE, radius=4)
    # Header strip
    c.setFillColor(NAVY)
    c.rect(x, y - HEADER_H, w, HEADER_H, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('BodyBold', 7.5)
    c.drawString(x + PAD, y - HEADER_H + 7, label)

    # Draw each bullet paragraph
    cy = y - HEADER_H - PAD
    for p, ph in paras:
        p.drawOn(c, x + PAD, cy - ph)
        cy -= ph + 6

    return y - box_h - 8

def check_y(c, y, required, title, subtitle):
    """Move to new page if not enough space."""
    if y - required < 70:
        draw_footer(c)
        c.showPage()
        draw_header(c, title=title, subtitle=subtitle, source="FUNDEB / INEP / IBGE")
        return PAGE_H - 140
    return y

def draw_info_box(c, x, y, w, h, label, value, color=NAVY):
    """Draw a stat card like in Censo Escolar page."""
    round_rect(c, x, y, w, h, LIGHT_BLUE, radius=6)
    c.setStrokeColor(color)
    c.setLineWidth(2)
    c.line(x, y + h - 4, x + w, y + h - 4)
    c.setFillColor(MUTED)
    c.setFont("BodyBold", 7)
    c.drawString(x + 8, y + h - 16, label.upper())
    c.setFillColor(NAVY)
    c.setFont("Heading", 18)
    c.drawString(x + 8, y + h - 38, value)

def draw_analysis_box(c, x, y, w, text, color=BLUE):
    """Draw a blue-bordered analysis paragraph box."""
    style_leading = 13
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Paragraph
    style = ParagraphStyle("a", fontName="Body", fontSize=8, leading=style_leading, textColor=TEXT)
    p = Paragraph(text, style)
    _, height = p.wrap(w - 24, PAGE_H)
    box_h = height + 24
    round_rect(c, x, y - box_h, w, box_h, colors.HexColor("#F0F4FB"), radius=6)
    c.setFillColor(color)
    c.rect(x, y - box_h, 4, box_h, fill=1, stroke=0)
    p.drawOn(c, x + 12, y - box_h + 8)
    return y - box_h - 10

def draw_obs_box(c, x, y, w, label, text):
    """Draw an orange-bordered observation box."""
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Paragraph
    style = ParagraphStyle("o", fontName="Body", fontSize=7.5, leading=12, textColor=TEXT)
    p = Paragraph(text, style)
    _, height = p.wrap(w - 20, PAGE_H)
    box_h = height + 30
    round_rect(c, x, y - box_h, w, box_h, LIGHT_ORANGE, radius=6)
    c.setFillColor(ORANGE)
    c.rect(x, y - box_h, 4, box_h, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 8)
    c.drawString(x + 12, y - 14, label)
    p.drawOn(c, x + 12, y - box_h + 8)
    return y - box_h - 10

def gerar_pdf(relatorio_raw) -> str:
    register_fonts()

    if isinstance(relatorio_raw, list):
        relatorio = relatorio_raw[0] if relatorio_raw else {}
    else:
        relatorio = relatorio_raw or {}

    fd, path = tempfile.mkstemp(suffix=".pdf", prefix="levantamento_fundeb_")
    os.close(fd)
    c = canvas.Canvas(path, pagesize=(PAGE_W, PAGE_H))

    # --- Extrair dados ---
    ident = relatorio.get("identificacao") or {}
    municipio = f_str(ident.get("municipioNome") or ident.get("municipio"), "Município")
    uf = f_str(ident.get("uf"), "")
    exercicio = f_str(ident.get("exercicio"), "")
    mun_label = f"{municipio} - {uf}" if uf else municipio
    mun_upper = mun_label.upper()

    receitas = relatorio.get("receitas") or {}
    proj = relatorio.get("projecaoComercial") or relatorio.get("projecaoRecuperavel") or relatorio.get("projecao") or {}
    proj_recuperavel = relatorio.get("projecaoRecuperavel") or relatorio.get("projecao") or {}
    proj_benchmark = relatorio.get("projecaoComercial") or {}
    upside = relatorio.get("upsideCondicionado") or {}
    perfil = relatorio.get("perfilComercial") or {}
    camada = perfil.get("camadaEstadual") or {}
    crono = relatorio.get("cronogramaVAAF") or []
    sistemas = relatorio.get("sistemas") or []
    pdde = relatorio.get("pdde") or []
    obs_ops = relatorio.get("observacoesOperacionais") or []
    ideb_ini = relatorio.get("idebAnosIniciais") or []
    ideb_fin = relatorio.get("idebAnosFinais") or []
    censo = relatorio.get("censoEscolar") or {}

    TITLE = "Diagnóstico Estratégico Educacional"
    FONTE = "FNDE / INEP / IBGE"
    W = PAGE_W - 2 * MARGIN_X
    prefeito = f_str(ident.get("prefeito"), "Gestor Municipal")
    partido = f_str(ident.get("partido"), "-")
    ganho = float(proj.get("totalGanho") or 0)
    ganho_pct = float(proj.get("ganhoPercentual") or 0)
    ganho_recuperavel = float(proj_recuperavel.get("totalGanho") or 0)
    ganho_recuperavel_pct = float(proj_recuperavel.get("ganhoPercentual") or 0)
    total_rec_float = float(receitas.get("totalReceitas") or 0)
    total_proj_float = float(proj.get("totalProjetado") or 0)
    upside_val = float(upside.get("ganhoAdicional") or max(0, float(proj_benchmark.get("totalProjetado") or 0) - total_proj_float))
    upside_pct = float(
        upside.get("ganhoPercentual")
        or (upside_val / float(proj.get("totalAtual") or 1) * 100 if float(proj.get("totalAtual") or 0) > 0 else 0)
    )
    pendencia_vaat = f_str(perfil.get("pendenciaVaat"), "")
    habilitacao_vaat = f_str(perfil.get("habilitacaoVaat"), "")
    vetores_upside = upside.get("vetores") or []

    # ===================== CAPA =====================
    draw_cover(
        c,
        title="DIAGNÓSTICO ESTRATÉGICO EDUCACIONAL",
        subtitle="Avaliação financeira, operacional e educacional",
        municipality=mun_upper,
        year_label=f"Exercício {exercicio}"
    )
    c.showPage()

    # ===================== PAG 2: ABERTURA EXECUTIVA V2 =====================
    draw_header(c, title=TITLE, subtitle=mun_label, source=FONTE)
    y = PAGE_H - 130

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 13)
    c.drawString(MARGIN_X, y, "ABERTURA EXECUTIVA - VERSÃO 2")
    y -= 26

    carta = (
        f"Ilmo(a). Sr(a). {prefeito}, gestor(a) municipal de {mun_label}. "
        f"Este relatório apresenta a leitura executiva e técnica do FUNDEB para o exercício de {exercicio}, "
        "com foco na projeção comercial histórica do levantamento Rocha Prime, preservando em camada secundária o ganho recuperável "
        "já evidenciado nas bases oficiais para suporte técnico da tomada de decisão."
    )
    y = draw_analysis_box(c, MARGIN_X, y, W, carta)

    card_w = (W - 16) / 3
    card_h = 78
    cards = [
        ("BASE ATUAL DO FUNDEB", f_money(total_rec_float), "receita consolidada para leitura inicial"),
        ("PROJEÇÃO ROCHA PRIME", f_money(total_proj_float), f"+{f_pct(ganho_pct)} no cenário potencial"),
        ("GANHO POTENCIAL", f_money(ganho), "metodologia comercial calibrada"),
    ]
    cx = MARGIN_X
    for label, value, sub in cards:
        round_rect(c, cx, y - card_h, card_w, card_h, WHITE, radius=8)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.roundRect(cx, y - card_h, card_w, card_h, 8, fill=0, stroke=1)
        c.setFillColor(NAVY)
        c.setFont("BodyBold", 7)
        c.drawString(cx + 10, y - 16, label)
        c.setFont("Heading", 15)
        c.drawString(cx + 10, y - 38, value)
        c.setFillColor(MUTED)
        c.setFont("Body", 7.5)
        c.drawString(cx + 10, y - 56, safe_text(sub))
        cx += card_w + 8
    y -= card_h + 18

    leitura_exec = (
        f"O ente analisado registra receita base de {f_money(total_rec_float)} no FUNDEB. "
        f"Nesta rodada, o headline principal volta a seguir a projeção comercial histórica do levantamento, com potencial estimado de {f_money(ganho)} "
        f"e receita total projetada de {f_money(total_proj_float)}. "
        + (
            f"Como piso técnico, a camada recuperável já evidenciada nas bases atuais soma {f_money(ganho_recuperavel)} ({f_pct(ganho_recuperavel_pct)}). "
            if ganho_recuperavel > 0 and abs(ganho_recuperavel - ganho) > 0.01
            else ""
        )
        + (
            f"Há sinal administrativo relevante em VAAT: {pendencia_vaat}. "
            if pendencia_vaat not in ("", "-")
            else ""
        )
    )
    y = draw_analysis_box(c, MARGIN_X, y, W, leitura_exec, color=ORANGE)

    bullets = [
        f"\u2022 Gestor identificado na base atual: {prefeito} ({partido}).",
        "\u2022 Método principal desta versão: projeção comercial Rocha Prime como headline do levantamento, mantendo a camada recuperável apenas como suporte técnico.",
    ]
    if habilitacao_vaat not in ("", "-"):
        bullets.append(f"\u2022 Habilitação VAAT observada: {habilitacao_vaat}.")
    if vetores_upside:
        bullets.append(f"\u2022 Vetores do upside condicionado: {', '.join(vetores_upside[:3])}.")
    else:
        bullets.append("\u2022 Nesta rodada, o foco permanece na consistência da base e no ganho já evidenciado.")

    y = check_y(c, y, 180, TITLE, mun_label)
    y = draw_bullets_box(c, MARGIN_X, y, W, "Leitura executiva da oportunidade", bullets)

    draw_footer(c)
    c.showPage()

    # ===================== PÁG 2: IDENTIFICAÇÃO + RECEITAS =====================
    draw_header(c, title=TITLE, subtitle=mun_label, source=FONTE)
    y = PAGE_H - 160

    # Seção 1 - Identificação
    draw_section_title(c, "1", "Identificação do Ente Federativo", y)
    y -= 20

    id_rows = [safe_row(r) for r in [
        ["Município", mun_label],
        ["Código IBGE", f_str(ident.get("codigoIBGE"))],
        ["Gestor Municipal", f_str(ident.get("prefeito"))],
        ["Partido", f_str(ident.get("partido"))],
        ["Exercício de Análise", exercicio],
        ["Base Legal", "Lei nº 14.113/2020 (Novo FUNDEB)"],
        ["Fonte de Dados", f_str(ident.get("fonte"), "FNDE / INEP / IBGE")],
        ["Mesorregião", f_str(ident.get("mesorregiao"))],
        ["Microrregião", f_str(ident.get("microrregiao"))],
        ["Método principal", "Benchmark comercial calibrado"],
    ]]
    # Campo 38% | Valor 62% - left_cols={1} para que o header e o texto fiquem alinhados a esquerda
    y = draw_kv_table(c, MARGIN_X, y, W, safe_row(["Campo", "Valor"]), id_rows, [W * 0.38, W * 0.62], row_h=20, left_cols={1})

    # Seção 2 - Receitas
    y = check_y(c, y, 200, TITLE, mun_label)
    draw_section_title(c, "2", "Composição das Receitas do FUNDEB", y - 25)
    c.setFillColor(MUTED)
    c.setFont("Body", 7)
    c.drawString(MARGIN_X, y - 38, "Valores estimados conforme Portaria FNDE vigente e dados consolidados do exercício.")
    y -= 58

    total_rec = receitas.get("totalReceitas") or 0
    def pct_rec(v):
        try:
            return f"{float(v or 0) / float(total_rec) * 100:.1f}%".replace(".", ",") if total_rec else "-"
        except Exception:
            return "-"

    rec_rows = [safe_row(r) for r in [
        ["Contribuição do Município", f_money(receitas.get("receitaContribuicaoMunicipal")), pct_rec(receitas.get("receitaContribuicaoMunicipal"))],
        ["Complementação da União - VAAF", f_money(receitas.get("complementacaoVAAF")), pct_rec(receitas.get("complementacaoVAAF"))],
        ["Complementação da União - VAAT", f_money(receitas.get("complementacaoVAAT")), pct_rec(receitas.get("complementacaoVAAT"))],
        ["Complementação da União - VAAR", f_money(receitas.get("complementacaoVAAR")), pct_rec(receitas.get("complementacaoVAAR"))],
        ["TOTAL DE RECEITAS", f_money(total_rec), "100,0%"],
    ]]
    # Componente 50% | Valor 32% | % 18%
    y = draw_kv_table(c, MARGIN_X, y, W,
        safe_row(["Componente da Receita", "Valor Estimado (R$)", "Participação"]),
        rec_rows, [W * 0.50, W * 0.32, W * 0.18],
        highlight_last=True, center_cols={2}
    )

    # Análise de receitas
    vaaf_v = float(receitas.get("complementacaoVAAF") or 0)
    vaat_v = float(receitas.get("complementacaoVAAT") or 0)
    vaar_v = float(receitas.get("complementacaoVAAR") or 0)
    contrib_pct_text = f"{pct_rec(receitas.get('receitaContribuicaoMunicipal'))}"
    sem_vaar = "O município não está recebendo atualmente: VAAR (Vinculado a Resultados). " if vaar_v == 0 else ""
    analise_txt = (
        f"A estrutura de receitas do FUNDEB para o exercício de {exercicio} apresenta predominância de receita de contribuição "
        f"municipal, representando {contrib_pct_text} do montante total. {sem_vaar}"
        "A ausência destas complementações pode estar relacionada às condições de habilitação junto ao FNDE ou à estrutura do fundo estadual. "
        "Recomenda-se análise detalhada dos requisitos de acesso."
    )
    y = check_y(c, y, 80, TITLE, mun_label)
    y = draw_analysis_box(c, MARGIN_X, y - 10, W, analise_txt)

    draw_footer(c)
    c.showPage()

    # ===================== PÁG 3: PROJEÇÕES =====================
    draw_header(c, title=TITLE, subtitle=mun_label, source=FONTE)
    y = PAGE_H - 160

    draw_section_title(c, "3", "Projecao Rocha Prime - Ganho Potencial", y)
    y -= 30

    # 4 cards no topo
    vaaf_pr = float(proj.get("vaafProjetado") or proj.get("vaafAtual") or 0)
    vaat_pr = float(proj.get("vaatProjetado") or proj.get("vaatAtual") or 0)
    vaar_pr = float(proj.get("vaarProjetado") or 0)
    ganho   = float(proj.get("totalGanho") or 0)
    ganho_pct = float(proj.get("ganhoPercentual") or 0)
    upside_val = float(upside.get("ganhoAdicional") or max(0, float(proj_benchmark.get("totalProjetado") or 0) - float(proj.get("totalProjetado") or 0)))
    upside_pct = float(
        upside.get("ganhoPercentual")
        or (upside_val / float(proj.get("totalAtual") or 1) * 100 if float(proj.get("totalAtual") or 0) > 0 else 0)
    )

    card_w = (W - 12) / 4
    card_h = 55
    vaar_delta = "-" if vaar_pr == 0 else f"+{f_pct(ganho_pct)}"
    cards = [
        ("VAAF", f_money(vaaf_pr), f"+{f_pct(ganho_pct)}"),
        ("VAAT", f_money(vaat_pr), f"+{f_pct(ganho_pct)}"),
        ("VAAR", f_money(vaar_pr), vaar_delta),
        ("GANHO", f_money(ganho), f"+{f_pct(ganho_pct)}"),
    ]
    cx = MARGIN_X
    for label, value, delta in cards:
        round_rect(c, cx, y - card_h, card_w, card_h, WHITE, radius=6)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.roundRect(cx, y - card_h, card_w, card_h, 6, fill=0, stroke=1)
        c.setFillColor(NAVY)
        c.setFont("BodyBold", 8)
        c.drawString(cx + 8, y - 14, label)
        c.setFont("Heading", 11)
        c.drawString(cx + 8, y - 30, value)
        c.setFillColor(GREEN)
        c.setFont("BodyBold", 8)
        c.drawString(cx + 8, y - 44, delta)
        cx += card_w + 4
    y -= card_h + 20

    # Tabela comparativa - center_cols em todas as colunas numericas (alinha header E dados)
    proj_rows = [safe_row(r) for r in [
        ["VAAF (Valor Aluno Fundo)",     f_money(proj.get("vaafAtual")),  f_money(proj.get("vaafProjetado")),  f_money(proj.get("vaafGanho"))],
        ["VAAT (Valor Aluno Total)",     f_money(proj.get("vaatAtual")),  f_money(proj.get("vaatProjetado")),  f_money(proj.get("vaatGanho"))],
        ["VAAR (Vinculado a Resultados)",f_money(proj.get("vaarAtual")),  f_money(proj.get("vaarProjetado")),  f_money(proj.get("vaarGanho"))],
        ["TOTAL",                        f_money(proj.get("totalAtual")), f_money(proj.get("totalProjetado")), f_money(proj.get("totalGanho"))],
    ]]
    y = draw_kv_table(c, MARGIN_X, y, W,
        safe_row(["Componente", "Cenario Atual", "Cenario Projetado", "Variacao"]),
        proj_rows, [W * 0.37, W * 0.21, W * 0.21, W * 0.21],
        highlight_last=True, positive_cols={3}, center_cols={1, 2, 3}
    )

    # Fundamentação da projeção
    met_txt = f_str(proj.get("metodologia"), "")
    fund_text = (
        "A projeção de cenário otimizado foi elaborada considerando análise técnica das bases do FNDE, dados do Censo Escolar "
        "e parâmetros regulatórios vigentes. Os principais fatores de variação identificados estão relacionados a VAAT e VAAF. "
        "A estimativa considera a revisão de dados do Censo Escolar, a conferência das bases de cálculo e a evolução das condições "
        "para acesso às complementações federais. O ganho projetado em VAAR está condicionado ao atendimento dos indicadores de "
        "desempenho educacional e à regularidade das informações junto ao MEC/FNDE. "
        + (f"Metodologia aplicada: {met_txt}." if met_txt else "A metodologia adota parâmetros conservadores, respeitando os limites regulatórios estabelecidos pela legislação do FUNDEB.")
    )
    fund_text = (
        "A projecao de cenario otimizado foi elaborada considerando analise tecnica das bases do FNDE, dados do Censo Escolar "
        "e parametros regulatorios vigentes. Os principais fatores de variacao identificados estao relacionados a VAAT e VAAF. "
        "A estimativa considera a revisao de dados do Censo Escolar, a conferencia das bases de calculo e a evolucao das condicoes "
        "para acesso as complementacoes federais. O ganho projetado em VAAR permanece condicionado ao atendimento dos indicadores de "
        "desempenho educacional e a regularidade das informacoes junto ao MEC/FNDE. "
        + (f"Metodologia aplicada: {met_txt}." if met_txt else "A metodologia adota os parametros historicos do levantamento Rocha Prime.")
        + (
            f" Como camada técnica secundária, o ganho recuperável já evidenciado nas bases atuais soma {f_money(ganho_recuperavel)}."
            if ganho_recuperavel > 0 and abs(ganho_recuperavel - ganho) > 0.01
            else ""
        )
    )
    y = check_y(c, y, 90, TITLE, mun_label)
    y = draw_analysis_box(c, MARGIN_X, y - 10, W, fund_text)

    # Box verde de receita total
    total_proj = float(proj.get("totalProjetado") or 0)
    y = check_y(c, y, 90, TITLE, mun_label)
    draw_highlight_box(
        c, MARGIN_X, y - 80, W, 80,
        "RECEITA TOTAL PROJETADA (CENÁRIO OTIMIZADO)",
        f_money(total_proj),
        f"Potencial de incremento:  {f_money(ganho)}  (+{f_pct(ganho_pct)})"
    )
    y -= 90

    if ganho_recuperavel > 0 and abs(ganho_recuperavel - ganho) > 0.01:
        y = check_y(c, y, 70, TITLE, mun_label)
        y = draw_analysis_box(
            c,
            MARGIN_X,
            y - 10,
            W,
            f"Camada recuperavel evidenciada nas bases oficiais: {f_money(ganho_recuperavel)} (+{f_pct(ganho_recuperavel_pct)} sobre a base atual). "
            "Ela funciona como piso técnico da oportunidade, enquanto o headline do levantamento permanece ancorado na projeção comercial Rocha Prime.",
        )

    draw_footer(c)
    c.showPage()

    # ===================== PÁG 4: INDICADORES DE EFICIÊNCIA =====================
    draw_header(c, title=TITLE, subtitle=mun_label, source=FONTE)
    y = PAGE_H - 130

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 13)
    c.drawString(MARGIN_X, y, "ANEXO TÉCNICO — Indicadores de Eficiência")
    y -= 30

    draw_section_title(c, "4", "Indicadores de Eficiência Arrecadatória", y)
    y -= 20

    mul_aplicado = perfil.get("multiplicador") or proj.get("multiplicadorAplicado") or 1
    faixa = f_str(perfil.get("faixa"), "padrão")
    confianca = perfil.get("confianca") or 0
    score = perfil.get("score") or 0

    ef_rows = [safe_row(r) for r in [
        ["Indice de Eficiencia Arrecadatoria", f"{score:.2f}".replace(".", ",")],
        ["Classificacao", faixa],
        ["Multiplicador de Benchmark Interno", f"{mul_aplicado:.2f}x".replace(".", ",")],
        ["Nivel de Confianca", f_pct(confianca)],
        ["FUNDEB per capita", f_money(perfil.get("fundebPerCapita"))],
        ["Matriculas municipais por habitante", f_pct(perfil.get("matriculasMunicipaisPorHabitante"))],
        ["Educacao infantil municipal por habitante", f_pct(perfil.get("educacaoInfantilMunicipalPorHabitante"))],
        ["Creche municipal por habitante", f_pct(perfil.get("crecheMunicipalPorHabitante"))],
        ["Habilitação VAAT", f_str(perfil.get("habilitacaoVaat"))],
        ["Pendencia VAAT", f_str(perfil.get("pendenciaVaat"))],
        ["UF / fundo estadual", f"{f_str(ident.get('uf'))} / {f_str(camada.get('fundoEstadual'))}"],
        ["Ajuste estadual aplicado", f"{camada.get('ajusteMultiplicadorAplicado', 0):.2f}x".replace(".", ",")],
    ]]
    # Indicador 60% | Valor 40% - center_cols={1} alinha header e dados juntos
    y = draw_kv_table(c, MARGIN_X, y, W, safe_row(["Indicador de Benchmark", "Valor"]),
        ef_rows, [W * 0.60, W * 0.40], row_h=21, center_cols={1})

    # Secao 5 - Fundamentacao dos indicadores (usa Paragraph = word-wrap + Unicode correto)
    y = check_y(c, y, 180, TITLE, mun_label)
    draw_section_title(c, "5", "Fundamentacao dos Indicadores", y - 20)
    y -= 40

    fatores = perfil.get("fatores") or []
    mat_hab = perfil.get("matriculasMunicipaisPorHabitante") or 0
    ei_hab  = perfil.get("educacaoInfantilMunicipalPorHabitante") or 0
    cr_hab  = perfil.get("crecheMunicipalPorHabitante") or 0
    fpc     = perfil.get("fundebPerCapita") or 0
    hab_vaat = f_str(perfil.get("habilitacaoVaat"))

    bullets = []
    if mat_hab:
        bullets.append(f"\u2022 A rede municipal concentra {f_pct(mat_hab)} de matr\u00edculas por habitante, indicador que eleva o peso comercial do Munic\u00edpio na carteira.")
    if ei_hab:
        bullets.append(f"\u2022 A cobertura municipal de educa\u00e7\u00e3o infantil alcan\u00e7a {f_pct(ei_hab)} por habitante, refor\u00e7ando o potencial de leitura favor\u00e1vel em VAAT e IEI.")
    if cr_hab:
        bullets.append(f"\u2022 A presen\u00e7a de creche municipal em {f_pct(cr_hab)} por habitante amplia a sensibilidade do benchmark para pol\u00edticas de primeira inf\u00e2ncia.")
    if fpc:
        bullets.append(f"\u2022 O FUNDEB per capita estimado em {f_money(fpc)} sugere intensidade financeira relevante para o porte da rede local.")
    if hab_vaat and hab_vaat != "-":
        bullets.append(f"\u2022 O status de habilita\u00e7\u00e3o VAAT \u00e9 atualmente: {hab_vaat}. Isso interfere diretamente na calibragem do multiplicador aplicado.")
    if fatores:
        bullets.append(f"\u2022 Fatores adicionais considerados: {', '.join(fatores[:4])}.")

    bullets_required = len(bullets) * 35 + 60
    y = check_y(c, y, bullets_required, TITLE, mun_label)
    y = draw_bullets_box(c, MARGIN_X, y, W, "An\u00e1lise Contextual", bullets)

    draw_footer(c)
    c.showPage()

    # ===================== PÁG 5: CRONOGRAMA =====================
    if crono:
        draw_header(c, title=TITLE, subtitle=mun_label, source=FONTE)
        y = PAGE_H - 160

        draw_section_title(c, "6", "Cronograma Mensal VAAF Projetado", y)
        y -= 20

        # Mes 20% | Valor 50% | % 30% - center_cols={1,2} para cabecalho e dados alinhados
        crono_rows = [safe_row([f_str(r.get("mes")), f_money(r.get("valorProjetado")), f_pct(r.get("percentual"))]) for r in crono if r]

        y = draw_kv_table(c, MARGIN_X, y, W,
            safe_row(["Mes", "Valor Projetado (R$)", "Participacao (%)"]),
            crono_rows, [W * 0.20, W * 0.50, W * 0.30], center_cols={1, 2}
        )

        # Box potencial de incremento
        y = check_y(c, y, 90, TITLE, mun_label)
        draw_highlight_box(c, MARGIN_X, y - 80, W, 80,
            "POTENCIAL DE INCREMENTO ANUAL (VAAF)",
            f_money(ganho),
            f"+{f_pct(ganho_pct)} sobre o cenário atual"
        )
        y -= 90

        draw_footer(c)
        c.showPage()

    # ===================== PÁG 6: SITUAÇÃO OPERACIONAL =====================
    draw_header(c, title=TITLE, subtitle=mun_label, source=FONTE)
    y = PAGE_H - 130

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 13)
    c.drawString(MARGIN_X, y, "PARTE II — SITUAÇÃO OPERACIONAL MEC/FNDE")
    y -= 30

    draw_section_title(c, "7", "Sistemas, Obras e Programas Federais", y)
    y -= 20

    if sistemas:
        # Truncar: ~80 chars = seguro para 73% da largura a 7.0pt
        def crop_sit(text, maxlen=80):
            t = f_str(text)
            return t if len(t) <= maxlen else t[:maxlen].rstrip() + "..."

        sys_rows = [safe_row([
            s.get("instituicao"),
            s.get("sistema"),
            crop_sit(s.get("situacao"))
        ]) for s in sistemas if s]
        # Instituicao 12% | Sistema 16% | Situacao 72% (crop garante que nao vaza)
        sys_required = (len(sys_rows) + 1) * 30 + 40
        y = check_y(c, y, sys_required, TITLE, mun_label)
        y = draw_kv_table(c, MARGIN_X, y, W,
            safe_row(["Instituicao", "Sistema", "Situacao Cadastral"]),
            sys_rows, [W * 0.12, W * 0.16, W * 0.72], row_h=30, font_size=7.0,
            center_cols={1}
        )

    if pdde:
        pdde_required = (len(pdde) + 1) * 22 + 80
        y = check_y(c, y, pdde_required, TITLE, mun_label)
        draw_section_title(c, "7.1", safe_text("Historico de Repasses PDDE"), y - 20)
        y -= 40
        pdde_rows = [safe_row([str(p.get("ano", "")), f_money(p.get("valor"))]) for p in pdde if p]
        # Ano 20% | Valor Repassado 80%
        y = draw_kv_table(c, MARGIN_X, y, W, safe_row(["Ano", "Valor Repassado"]), pdde_rows, [W * 0.20, W * 0.80])
        y = draw_obs_box(c, MARGIN_X, y - 10, W, "Leitura operacional da secao",
            "O historico de repasses do PDDE reforca a leitura operacional do ente e oferece evidencia concreta da movimentacao recente de recursos federais na rede publica local.")

    if obs_ops:
        y = check_y(c, y, 60, TITLE, mun_label)
        for obs in obs_ops:
            y = check_y(c, y, 50, TITLE, mun_label)
            y = draw_obs_box(c, MARGIN_X, y - 5, W, "Observação Operacional", f_str(obs))

    draw_footer(c)
    c.showPage()

    # ===================== PÁG 7: CENSO + IDEB =====================
    draw_header(c, title=TITLE, subtitle=mun_label, source=FONTE)
    y = PAGE_H - 130

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 13)
    c.drawString(MARGIN_X, y, "PARTE III — INDICADORES EDUCACIONAIS")
    y -= 30

    draw_section_title(c, "8", "Censo Escolar e IDEB", y)
    y -= 20

    # 3 cards de resumo
    if censo:
        card_w2 = (W - 20) / 3
        censo_cards = [
            ("UNIDADES ESCOLARES", f_int(censo.get("totalEscolas"))),
            ("TOTAL DE MATRÍCULAS", f_int(censo.get("totalMatriculas"))),
            ("DOCENTES", f_int(censo.get("totalDocentes"))),
        ]
        cx2 = MARGIN_X
        for label, value in censo_cards:
            draw_info_box(c, cx2, y - 60, card_w2, 60, label, value)
            cx2 += card_w2 + 10
        y -= 75

        etapas = censo.get("matriculasEtapa") or {}
        detalhadas = censo.get("matriculasDetalhadas") or {}
        tempo_integral = censo.get("tempoIntegral") or {}
        if etapas:
            y = check_y(c, y, 100, TITLE, mun_label)
            draw_section_title(c, "8.1", "Distribuição de Matrículas por Etapa", y - 20)
            y -= 40
            etapa_rows = [
                ["Educação Infantil", f_int(etapas.get("educacaoInfantil"))],
                ["Ensino Fundamental", f_int(etapas.get("ensinoFundamental"))],
                ["Ensino Médio", f_int(etapas.get("ensinoMedio"))],
                ["EJA", f_int(etapas.get("eja"))],
                ["Educação Especial", f_int(etapas.get("educacaoEspecial"))],
            ]
            y = draw_kv_table(c, MARGIN_X, y, W,
                safe_row(["Etapa de Ensino", "Matriculas"]),
                [safe_row(r) for r in etapa_rows],
                [W * 0.58, W * 0.42]
            )

            detalhamento_rows = [
                ["Creche", f_int(detalhadas.get("creche"))],
                ["Pré-escola", f_int(detalhadas.get("preEscola"))],
                ["Anos iniciais do Fundamental", f_int(detalhadas.get("anosIniciais"))],
                ["Anos finais do Fundamental", f_int(detalhadas.get("anosFinais"))],
                ["Ensino Médio", f_int(etapas.get("ensinoMedio"))],
                ["EJA", f_int(etapas.get("eja"))],
                ["Educação Especial", f_int(etapas.get("educacaoEspecial"))],
            ]
            y = check_y(c, y, 170, TITLE, mun_label)
            draw_section_title(c, "8.2", "Detalhamento da Rede Publica", y - 20)
            y -= 40
            y = draw_kv_table(
                c,
                MARGIN_X,
                y,
                W,
                safe_row(["Recorte detalhado", "Matriculas"]),
                [safe_row(r) for r in detalhamento_rows],
                [W * 0.64, W * 0.36],
            )

            tempo_rows = []
            tempo_specs = [
                ("Rede publica total", tempo_integral.get("total"), censo.get("totalMatriculas")),
                ("Educação Infantil", tempo_integral.get("educacaoInfantil"), etapas.get("educacaoInfantil")),
                ("Creche", tempo_integral.get("creche"), detalhadas.get("creche")),
                ("Pré-escola", tempo_integral.get("preEscola"), detalhadas.get("preEscola")),
                ("Ensino Fundamental", tempo_integral.get("ensinoFundamental"), etapas.get("ensinoFundamental")),
                ("Anos iniciais", tempo_integral.get("anosIniciais"), detalhadas.get("anosIniciais")),
                ("Anos finais", tempo_integral.get("anosFinais"), detalhadas.get("anosFinais")),
                ("Ensino Médio", tempo_integral.get("ensinoMedio"), etapas.get("ensinoMedio")),
                ("EJA", tempo_integral.get("eja"), etapas.get("eja")),
                ("Educação Especial", tempo_integral.get("educacaoEspecial"), etapas.get("educacaoEspecial")),
            ]
            for label, integral_value, base_value in tempo_specs:
                if integral_value is None and base_value in (None, "", 0):
                    continue
                tempo_rows.append([
                    label,
                    f_int_na(integral_value),
                    f_int_na(base_value),
                    f_pct(calc_pct(integral_value, base_value)) if integral_value is not None and base_value not in (None, "", 0) else "-",
                ])

            if tempo_rows:
                y = check_y(c, y, len(tempo_rows) * 22 + 130, TITLE, mun_label)
                draw_section_title(c, "8.3", "Cobertura em Tempo Integral", y - 20)
                y -= 40
                y = draw_kv_table(
                    c,
                    MARGIN_X,
                    y,
                    W,
                    safe_row(["Etapa", "Integral", "Base de matriculas", "Cobertura"]),
                    [safe_row(r) for r in tempo_rows],
                    [W * 0.40, W * 0.18, W * 0.24, W * 0.18],
                    center_cols={1, 2, 3},
                )

                total_integral = tempo_integral.get("total")
                total_censo = censo.get("totalMatriculas")
                cobertura_total = calc_pct(total_integral, total_censo)
                analise_ti = (
                    f"A rede publica de {mun_label} registra {f_int_na(total_integral)} matriculas em tempo integral "
                    f"sobre uma base de {f_int_na(total_censo)} matriculas publicas no Censo Escolar. "
                    f"Isto representa cobertura aproximada de {f_pct(cobertura_total) if cobertura_total is not None else '-'} "
                    "e ajuda a qualificar a leitura da oferta de jornada ampliada por etapa."
                )
                y = check_y(c, y, 88, TITLE, mun_label)
                y = draw_analysis_box(c, MARGIN_X, y - 10, W, analise_ti)

    # IDEB
    if ideb_ini or ideb_fin:
        ideb_rows = []
        for d in (ideb_ini or []):
            ideb_rows.append(safe_row(["Anos Iniciais", str(d.get("ano", "")),
                               f_str(d.get("metaProjetada")), f_str(d.get("idebVerificado"))]))
        for d in (ideb_fin or []):
            ideb_rows.append(safe_row(["Anos Finais", str(d.get("ano", "")),
                               f_str(d.get("metaProjetada")), f_str(d.get("idebVerificado"))]))

        # Calcular altura real necessaria para a tabela inteira (evita overlap no footer)
        ideb_required = (len(ideb_rows) + 1) * 22 + 80
        y = check_y(c, y, ideb_required, TITLE, mun_label)
        draw_section_title(c, "8.4", "Serie Historica do IDEB", y - 20)
        y -= 40
        # Etapa 28% | Ano 12% (centralizado) | Meta 30% | IDEB 30%
        y = draw_kv_table(c, MARGIN_X, y, W,
            safe_row(["Etapa", "Ano", "Meta Projetada", "IDEB Verificado"]),
            ideb_rows, [W * 0.28, W * 0.12, W * 0.30, W * 0.30],
            center_cols={1}
        )
    else:
        y = check_y(c, y, 60, TITLE, mun_label)
        y = draw_obs_box(c, MARGIN_X, y - 10, W, "IDEB",
            "Os dados de IDEB para este município serão integrados na próxima versão deste relatório após consulta ao portal do SIMEC (simec.mec.gov.br). A série histórica do município pode ser verificada diretamente no portal.")

    draw_footer(c)
    c.showPage()
    c.save()
    return path

if __name__ == "__main__":
    try:
        input_data = sys.stdin.buffer.read().decode("utf-8-sig")
        if not input_data.strip():
            sys.stderr.write("Empty input\n")
            sys.exit(1)
        payload = json.loads(input_data)
        pdf_path = gerar_pdf(payload)
        print(pdf_path, flush=True)
    except Exception as e:
        import traceback
        sys.stderr.write(f"ERROR: {e}\n{traceback.format_exc()}")
        sys.exit(1)
