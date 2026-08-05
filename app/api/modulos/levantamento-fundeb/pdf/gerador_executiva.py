"""
Gerador: Apresentacao Executiva Global Sync — Fundeb
Formato: 16:9 (960 x 540 pt)
Paginas: 7
Spec: kit_padrao_pdf/01_apresentacao_executiva_fundeb.md
"""
import sys
import json
import tempfile
import os
import unicodedata
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

try:
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Paragraph
    from kit_padrao_pdf.report_style_pdf import (
        register_fonts, round_rect,
        NAVY, BLUE, TEXT, MUTED, LINE, LIGHT_BLUE, GREEN, WHITE, SOFT_ROW, ORANGE,
        LIGHT_GREEN, load_logo, LOGO_SMALL, fmt_money,
    )
except ImportError as e:
    sys.stderr.write(f"Import error: {e}\n")
    sys.exit(1)

# ── Dimensões 16:9 ──────────────────────────────────────────────
PW, PH = 960, 540
MX, MY = 48, 36        # margens horizontal e vertical

DARK_BG  = NAVY
ACCENT   = BLUE
GRAY_BG  = colors.HexColor("#F4F6FA")
CARD_BG  = colors.HexColor("#EAF4FF")
GREEN_BG = LIGHT_GREEN
MUTED_C  = MUTED

# ── Helpers ─────────────────────────────────────────────────────
def safe(v):
    if v is None:
        return "-"
    text = str(v).strip()
    if not text:
        return "-"
    try:
        repaired = text.encode("latin1").decode("utf-8")
        if any(ch in repaired for ch in "áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ"):
            text = repaired
    except Exception:
        pass
    return text.replace("\xa0", " ")

def money(v):
    try: return fmt_money(float(v or 0))
    except: return "R$ 0,00"

def pct(v):
    try: return f"{float(v or 0):.1f}%".replace(".", ",")
    except: return "-"

def f_int(v):
    try:
        n = int(float(v or 0))
        return f"{n:,}".replace(",", ".")
    except:
        return "-"

def delta_pct(v1, v2):
    """Variacao percentual entre v1 e v2."""
    try:
        v1, v2 = float(v1 or 0), float(v2 or 0)
        if v1 == 0: return "-"
        d = (v2 - v1) / v1 * 100
        sign = "+" if d >= 0 else ""
        return f"{sign}{d:.1f}%".replace(".", ",")
    except: return "-"

def delta_abs(v1, v2):
    try:
        d = float(v2 or 0) - float(v1 or 0)
        sign = "+" if d >= 0 else "-"
        return f"{sign}{f_int(abs(d))}"
    except:
        return "-"

def wrap_para(c, text, x, y, w, size=9, font="Body", color=TEXT, leading=14):
    style = ParagraphStyle("p", fontName=font, fontSize=size, leading=leading, textColor=color)
    p = Paragraph(text, style)
    _, h = p.wrap(w, PH)
    p.drawOn(c, x, y - h)
    return y - h - 6

def hline(c, y, color=LINE):
    c.setStrokeColor(color)
    c.setLineWidth(1)
    c.line(MX, y, PW - MX, y)

# ── Header / Footer 16:9 ────────────────────────────────────────
def exec_header(c, mun_label, source="FNDE / INEP / IBGE"):
    logo = load_logo(LOGO_SMALL)
    if logo:
        c.drawImage(logo, MX, PH - 52, 26, 32, mask="auto")
    left = MX + 36
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 11)
    c.drawString(left, PH - 22, "GLOBAL SYNC")
    c.setFillColor(TEXT)
    c.setFont("Body", 5.5)
    c.drawString(left, PH - 30, "Global Services Company  |  Tel: (77) 99700-5880")
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 10)
    c.drawString(left, PH - 42, safe(mun_label))
    c.setFillColor(TEXT)
    c.setFont("Body", 5.5)
    c.drawString(left + 160, PH - 42, f"Fonte: {source}")
    # Confidencial badge
    round_rect(c, left, PH - 57, 74, 12, ORANGE, radius=2)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 5.5)
    c.drawCentredString(left + 37, PH - 52, "DOCUMENTO CONFIDENCIAL")
    # linha divisora
    c.setStrokeColor(NAVY)
    c.setLineWidth(1.5)
    c.line(MX, PH - 68, PW - MX, PH - 68)

def exec_footer(c, page_num=None):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(MX, 20, PW - MX, 20)
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 5)
    c.drawCentredString(PW / 2, 14, "GLOBAL SYNC")
    c.setFillColor(MUTED)
    c.setFont("Body", 4.5)
    c.drawCentredString(PW / 2, 8, "Global Services Company — Tecnologia e dados para gestão pública")
    if page_num:
        c.setFont("Body", 5)
        c.drawRightString(PW - MX, 8, str(page_num))

def kv_table_exec(c, x, y, w, headers, rows, col_widths,
                  row_h=20, font_size=7.5, highlight_last=False,
                  center_cols=None, left_cols=None):
    """draw_kv_table adaptado para 16:9 com left_cols."""
    center_cols = center_cols or set()
    left_cols = left_cols or set()

    c.setFillColor(NAVY)
    c.rect(x, y - row_h, w, row_h, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 6.5)
    cx = x
    for i, (hd, cw) in enumerate(zip(headers, col_widths)):
        if i in center_cols:
            c.drawCentredString(cx + cw/2, y - 13, hd)
        elif i == 0 or i in left_cols:
            c.drawString(cx + 5, y - 13, hd)
        else:
            c.drawRightString(cx + cw - 5, y - 13, hd)
        cx += cw
    y -= row_h
    for idx, row in enumerate(rows):
        fill = SOFT_ROW if idx % 2 else WHITE
        if highlight_last and idx == len(rows) - 1:
            fill = colors.HexColor("#ECEFF5")
        c.setFillColor(fill)
        c.rect(x, y - row_h, w, row_h, fill=1, stroke=0)
        cx = x
        for i, (cell, cw) in enumerate(zip(row, col_widths)):
            c.setFillColor(TEXT if i else colors.HexColor("#333333"))
            bold = highlight_last and idx == len(rows) - 1
            c.setFont("BodyBold" if bold else "Body", font_size)
            if i == 0 or i in left_cols:
                c.drawString(cx + 5, y - 12, str(cell))
            elif i in center_cols:
                c.drawCentredString(cx + cw/2, y - 12, str(cell))
            else:
                c.drawRightString(cx + cw - 5, y - 12, str(cell))
            cx += cw
        y -= row_h
    return y

def card_exec(c, x, y, w, h, title, value, sub=None, bg=CARD_BG, accent=NAVY):
    round_rect(c, x, y, w, h, bg, radius=6)
    c.setFillColor(accent)
    c.rect(x, y + h - 3, w, 3, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont("BodyBold", 6)
    c.drawString(x + 8, y + h - 14, title.upper())
    c.setFillColor(NAVY)
    c.setFont("BodyBold" if len(value) < 18 else "Body", 11 if len(value) < 18 else 9)
    c.drawString(x + 8, y + h - 30, value)
    if sub:
        c.setFillColor(GREEN)
        c.setFont("BodyBold", 7)
        c.drawString(x + 8, y + 8, sub)

# ── GERAR PDF ───────────────────────────────────────────────────
def gerar_executiva(payload_raw) -> str:
    register_fonts()

    if isinstance(payload_raw, list):
        d = payload_raw[0] if payload_raw else {}
    else:
        d = payload_raw or {}

    # Identificacao
    ident = d.get("identificacao") or {}
    mun = safe(ident.get("municipioNome") or ident.get("municipio") or "Município")
    uf  = safe(ident.get("uf") or "")
    exercicio = safe(ident.get("exercicio") or "2026")
    mun_label = f"{mun} - {uf}" if uf else mun
    data_material = safe(d.get("data_material") or exercicio)

    # Receitas
    receitas_raw = d.get("receitas") or {}
    rec_list = d.get("receitasList") or [
        ("Contribuicao Municipal", receitas_raw.get("receitaContribuicaoMunicipal"), None),
        ("Complementacao VAAF",   receitas_raw.get("complementacaoVAAF"), None),
        ("Complementacao VAAT",   receitas_raw.get("complementacaoVAAT"), None),
        ("Complementacao VAAR",   receitas_raw.get("complementacaoVAAR"), None),
        ("TOTAL",                 receitas_raw.get("totalReceitas"), None),
    ]

    # Projecao
    proj = d.get("projecaoComercial") or d.get("projecaoRecuperavel") or d.get("projecao") or {}
    proj_recuperavel = d.get("projecaoRecuperavel") or d.get("projecao") or {}
    proj_benchmark = d.get("projecaoComercial") or {}
    upside = d.get("upsideCondicionado") or {}
    ganho_total = float(proj.get("totalGanho") or 0)
    ganho_pct   = float(proj.get("ganhoPercentual") or 0)
    ganho_recuperavel = float(proj_recuperavel.get("totalGanho") or 0)
    ganho_recuperavel_pct = float(proj_recuperavel.get("ganhoPercentual") or 0)
    proj_list = d.get("projecaoList") or [
        ("VAAF", proj.get("vaafAtual"), proj.get("vaafProjetado"), proj.get("vaafGanho")),
        ("VAAT", proj.get("vaatAtual"), proj.get("vaatProjetado"), proj.get("vaatGanho")),
        ("VAAR", proj.get("vaarAtual"), proj.get("vaarProjetado"), proj.get("vaarGanho")),
        ("TOTAL", proj.get("totalAtual"), proj.get("totalProjetado"), proj.get("totalGanho")),
    ]

    # QEdu / Censo
    censo = d.get("censoEscolar") or {}
    etapas = censo.get("matriculasEtapa") or {}
    qedu_list = d.get("qeduList") or [
        ("Escolas",             censo.get("totalEscolas")),
        ("Docentes",            censo.get("totalDocentes")),
        ("Matriculas Totais",   censo.get("totalMatriculas")),
        ("Educacao Infantil",   etapas.get("educacaoInfantil")),
        ("Ensino Fundamental",  etapas.get("ensinoFundamental")),
        ("EJA",                 etapas.get("eja")),
        ("Ed. Especial",        etapas.get("educacaoEspecial")),
    ]

    receitas_comp = d.get("receitasComparativas") or []
    matriculas_comp = d.get("matriculasComparativas") or []
    historico_censo = d.get("historicoCenso") or []
    cenario_estruturacao = d.get("cenarioEstruturacao") or {}
    ano1 = safe(d.get("ano_base_1") or "2025")
    ano2 = safe(d.get("ano_base_2") or exercicio)

    total_comp_ano1 = float(next((item.get("valor_ano_1") for item in receitas_comp if str(item.get("componente", "")).upper() == "TOTAL"), 0) or 0)
    total_comp_ano2 = float(next((item.get("valor_ano_2") for item in receitas_comp if str(item.get("componente", "")).upper() == "TOTAL"), receitas_raw.get("totalReceitas") or 0) or 0)
    crescimento_receita_pct = delta_pct(total_comp_ano1, total_comp_ano2) if total_comp_ano1 > 0 else f"+{pct(ganho_pct)}"
    vaar_atual = float(receitas_raw.get("complementacaoVAAR") or 0)

    pontos_chave = []
    if censo.get("matriculasEtapa", {}).get("educacaoEspecial"):
        pontos_chave.append("peso em educacao especial")
    if censo.get("matriculasEtapa", {}).get("eja"):
        pontos_chave.append("espaco para reorganizacao de EJA")
    if censo.get("tempoIntegral", {}).get("total"):
        pontos_chave.append("expansao de tempo integral")
    if not pontos_chave:
        pontos_chave.append("rede com espaco claro para organizacao tecnica")
    pontos_chave_txt = ", ".join(pontos_chave[:3]).capitalize() + "."

    # Sistemas
    sistemas = d.get("sistemas") or []

    # Textos
    # Os quatro textos abaixo sao os padroes usados quando o chamador nao envia
    # os seus. Como nenhum chamador envia, eles valem sempre — e por isso nao
    # podem afirmar achado que nao foi feito. As versoes anteriores diziam que
    # "identificamos oportunidade real" e que a consultoria "identificou
    # divergencias entre os dados declarados e os criterios do FNDE" para
    # qualquer municipio, antes de qualquer conferencia. Bastava o gestor pedir
    # a lista de divergencias para o documento inteiro perder credibilidade.
    carta           = safe(d.get("carta_apresentacao") or
        f"O municipio de {mun} reune condicoes tecnicas para revisao da sua posicao"
        " no FUNDEB. Este documento organiza o que as bases do FNDE ja mostram e"
        " aponta os pontos que precisam ser conferidos junto aos sistemas federais —"
        " a correcao cadastral eleva a receita sem alterar o perfil fiscal do ente.")
    txt_importancia = safe(d.get("texto_importancia_municipio") or
        f"A rede publica de {mun} tem caracteristicas que pesam na formula do FUNDEB,"
        " em especial no calculo do VAAT e na habilitacao as complementacoes federais.")
    # Chave antiga como reserva — ver nota em gerador_comparativa.py.
    txt_leitura     = safe(d.get("texto_leitura_consultoria") or
        d.get("texto_leitura_rocha_prime") or
        "A Global Company levantou as bases de calculo e mapeou os pontos em que os dados"
        " declarados precisam ser confrontados com os criterios vigentes do FNDE. A"
        " conferencia desses pontos e o principal vetor de ganho tecnico — o que cada um"
        " vale so se determina apos a verificacao documental.")
    # "A camada recuperavel ja evidenciada nas bases oficiais" descrevia
    # `projecaoRecuperavel`, que e VAAF x 1,40 + VAAT x 1,30 + VAAR x 1,25:
    # multiplicadores fixos, iguais para todo municipio, sem base nenhuma atras.
    txt_oportunidade= safe(d.get("texto_oportunidade_final") or
        f"Com base no cenario atual, o ganho potencial estimado para"
        f" {mun} e de {money(ganho_total)} (+{pct(ganho_pct)})."
        + (
            f" Num cenario conservador, o incremento fica em {money(ganho_recuperavel)} (+{pct(ganho_recuperavel_pct)})."
            " Ambos sao estimativas e dependem de validacao nas bases oficiais."
            if ganho_recuperavel > 0 and abs(ganho_recuperavel - ganho_total) > 0.01
            else " Estimativa sujeita a validacao nas bases oficiais."
        ))

    # ── Arquivo temporario ───────────────────────────
    fd, path = tempfile.mkstemp(suffix=".pdf", prefix="exec_fundeb_")
    os.close(fd)
    c = canvas.Canvas(path, pagesize=(PW, PH))

    W = PW - 2 * MX   # largura util

    # ═══════════════════════════════════════════════════
    # PG 1 — CAPA
    # ═══════════════════════════════════════════════════
    # Fundo navy na metade esquerda
    c.setFillColor(DARK_BG)
    c.rect(0, 0, PW * 0.48, PH, fill=1, stroke=0)
    # Fundo branco na metade direita
    c.setFillColor(WHITE)
    c.rect(PW * 0.48, 0, PW * 0.52, PH, fill=1, stroke=0)

    # Logo no lado navy
    logo = load_logo(LOGO_SMALL)
    if logo:
        c.drawImage(logo, MX + 10, PH - 110, 46, 58, mask="auto")
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 9)
    c.drawString(MX + 10, PH - 122, "GLOBAL SYNC")
    c.setFont("Body", 6)
    c.drawString(MX + 10, PH - 132, "Inteligência e Estratégia para Gestão Pública")

    # Titulo principal
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 22)
    c.drawString(MX + 10, PH/2 + 40, "APRESENTACAO")
    c.setFont("BodyBold", 22)
    c.drawString(MX + 10, PH/2 + 15, "EXECUTIVA")
    c.setFillColor(ORANGE)
    c.setFont("BodyBold", 28)
    c.drawString(MX + 10, PH/2 - 20, "FUNDEB")
    c.setFillColor(LIGHT_BLUE)
    c.setFont("Body", 10)
    c.drawString(MX + 10, PH/2 - 38, f"Exercício {exercicio}")
    y_left = PH/2 - 76
    y_left = wrap_para(
        c,
        f"{mun} tem uma oportunidade tecnica relevante no FUNDEB.",
        MX + 10,
        y_left,
        PW * 0.40,
        size=16,
        font="BodyBold",
        color=WHITE,
        leading=20,
    )
    y_left = wrap_para(
        c,
        "Material executivo estruturado para reuniao com foco em servico, racional tecnico e potencial de resultado para o municipio.",
        MX + 10,
        y_left - 4,
        PW * 0.40,
        size=8.5,
        color=LIGHT_BLUE,
        leading=13,
    )

    # Lado direito: info do municipio
    rx = PW * 0.48 + 40
    rw = PW * 0.52 - 60
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 10)
    c.drawString(rx, PH - 80, "Município analisado:")
    c.setFont("BodyBold", 20)
    c.drawString(rx, PH - 105, mun)
    c.setFont("Body", 12)
    c.drawString(rx, PH - 122, uf)
    card_y = PH/2 - 76
    card_w = (rw - 16) / 3
    card_exec(c, rx, card_y, card_w, 82, "Receita prevista 2026", money(receitas_raw.get("totalReceitas")), bg=CARD_BG, accent=NAVY)
    card_exec(c, rx + card_w + 8, card_y, card_w, 82, "Ganho estimado", money(ganho_total), bg=colors.HexColor("#F0FFF4"), accent=GREEN)
    card_exec(c, rx + (card_w + 8) * 2, card_y, card_w, 82, "Matriculas QEdu", f_int(censo.get("totalMatriculas")), bg=GRAY_BG, accent=BLUE)

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 10)
    c.drawString(rx, PH/2 - 108, f"{mun.upper()} | {uf.upper() if uf else ''}".rstrip())
    c.setFillColor(TEXT)
    c.setFont("Body", 8)
    wrap_para(
        c,
        "Uma apresentacao com direcao executiva, linguagem clara e base tecnica suficiente para sustentar decisao.",
        rx,
        PH/2 - 120,
        rw,
        size=8,
        color=TEXT,
        leading=12,
    )
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 8)
    c.drawString(rx, PH/2 - 162, "PONTOS-CHAVE")
    c.setFillColor(TEXT)
    c.setFont("Body", 7.5)
    wrap_para(c, pontos_chave_txt, rx, PH/2 - 170, rw, size=7.5, color=TEXT, leading=11)
    # Data e confidencial
    c.setFillColor(MUTED)
    c.setFont("Body", 6.5)
    c.drawString(rx, 28, f"Material preparado em {data_material}")
    round_rect(c, rx + 200, 22, 82, 14, ORANGE, radius=2)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 5.5)
    c.drawCentredString(rx + 241, 27, "DOCUMENTO CONFIDENCIAL")

    exec_footer(c, 1)
    c.showPage()

    # ═══════════════════════════════════════════════════
    # PG 2 — CARTA DE APRESENTACAO
    # ═══════════════════════════════════════════════════
    exec_header(c, mun_label)
    y = PH - 85

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 14)
    c.drawString(MX, y, "2. Mensagem Executiva")
    y -= 12
    hline(c, y)
    y -= 20

    c.setFillColor(MUTED)
    c.setFont("BodyBold", 8)
    c.drawString(MX, y, f"Por que {mun} justifica uma agenda mais robusta")
    y -= 18
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 10)
    c.drawString(MX, y, "Leitura executiva do caso")
    y -= 12
    y = wrap_para(c, carta, MX, y, W, size=8.8, leading=14)
    y -= 6
    y = wrap_para(c, txt_importancia, MX, y, W, size=8.2, color=MUTED, leading=13)

    y -= 4
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 9)
    c.drawString(MX, y, "O QUE ESTA APRESENTAÇÃO ENTREGA")
    y -= 10
    entregas = [
        "Leitura clara do que a Global Sync faz e onde ela agrega valor.",
        f"Traducao executiva dos numeros de {mun} para contexto de decisao.",
        "Conexao entre rede, repasse, elegibilidade e agenda tecnica.",
    ]
    for item in entregas:
        y = wrap_para(c, f"• {item}", MX + 8, y, W - 8, size=8, leading=12)

    y -= 6
    card_w2 = (W - 16) / 3
    card_exec(c, MX, y - 78, card_w2, 78, "Receita prevista", money(receitas_raw.get("totalReceitas")), bg=CARD_BG, accent=NAVY)
    card_exec(c, MX + card_w2 + 8, y - 78, card_w2, 78, "Crescimento", crescimento_receita_pct, bg=colors.HexColor("#F0FFF4"), accent=GREEN)
    card_exec(c, MX + (card_w2 + 8) * 2, y - 78, card_w2, 78, "VAAR", money(vaar_atual), bg=GRAY_BG, accent=BLUE)

    exec_footer(c, 2)
    c.showPage()

    # ═══════════════════════════════════════════════════
    # PG 3 — NOSSA ATUACAO (4 cards + por que importa)
    # ═══════════════════════════════════════════════════
    exec_header(c, mun_label)
    y = PH - 85

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 14)
    c.drawString(MX, y, "3. Escopo de Atuação")
    y -= 12
    hline(c, y)
    y -= 20

    atuacao = [
        ("Levantamento completo", "Coleta e organizacao das bases educacionais, financeiras, cadastrais e operacionais do municipio."),
        ("Cruzamento tecnico", "Leitura integrada entre MEC, FNDE, INEP, QEdu e sistemas locais para localizar incoerencias e oportunidades."),
        ("Correcoes priorizadas", "Apoio tecnico para saneamento, habilitacao e medidas com maior impacto sobre elegibilidade e repasse."),
        ("Monitoramento executivo", "Acompanhamento da agenda e dos efeitos sobre receita, conformidade e evolucao do caso."),
    ]
    cw = (W - 12) / 4
    ch = 90
    cx0 = MX
    for title, desc in atuacao:
        round_rect(c, cx0, y - ch, cw, ch, CARD_BG, radius=6)
        c.setFillColor(NAVY)
        c.rect(cx0, y - 4, cw, 4, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont("BodyBold", 7.5)
        c.drawString(cx0 + 8, y - 18, title)
        wrap_para(c, desc, cx0 + 8, y - 26, cw - 16, size=7, leading=12, color=TEXT)
        cx0 += cw + 4

    y -= ch + 16

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 10)
    c.drawString(MX, y, "Nossa entrega não é só relatório.")
    y -= 10
    wrap_para(c, "Ela comeca no diagnostico, passa pela correcao e termina em uma agenda acompanhada, com traducao executiva para decisao do gestor.", MX + 10, y, W - 10, size=8.5, leading=14)

    exec_footer(c, 3)
    c.showPage()

    # ═══════════════════════════════════════════════════
    # PG 4 — BASE TECNICA (QEdu + Sistemas + Leitura RP)
    # ═══════════════════════════════════════════════════
    exec_header(c, mun_label)
    y = PH - 85

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 14)
    c.drawString(MX, y, "4. Base do Município")
    y -= 12
    hline(c, y)
    y -= 16

    # Duas colunas: QEdu | Sistemas
    half_w = (W - 16) / 2

    # QEdu
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 8.5)
    c.drawString(MX, y, "4.1 Rede educacional e condicoes operacionais")
    y -= 10
    qedu_rows = [[safe(str(k)), str(v if v is not None else "-")] for k, v in qedu_list]
    y_after_qedu = kv_table_exec(c, MX, y, half_w, ["Indicador", "Valor"], qedu_rows,
                                 [half_w * 0.6, half_w * 0.4], row_h=18, font_size=7,
                                 center_cols={1})

    # Sistemas (coluna direita, mesmo y inicial)
    sx = MX + half_w + 16
    y_sys = y
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 8.5)
    c.drawString(sx, y_sys, "4.2 Situação sistemas / habilitação")
    y_sys -= 10
    if sistemas:
        def crop80(t):
            t = unicodedata.normalize("NFD", str(t)).encode("ascii","ignore").decode("ascii")
            return t if len(t) <= 80 else t[:80].rstrip() + "..."
        sys_rows = [[safe(s.get("instituicao","")), safe(s.get("sistema","")), crop80(s.get("situacao",""))] for s in sistemas]
        kv_table_exec(c, sx, y_sys, half_w,
                      ["Inst.", "Sistema", "Situacao"],
                      sys_rows, [half_w*0.12, half_w*0.18, half_w*0.70],
                      row_h=18, font_size=6.5, center_cols={1})

    y = min(y_after_qedu, y_sys - len(sistemas) * 18 - 30) - 12

    # Box "Leitura Global Sync"
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 9)
    c.drawString(MX, y, "LEITURA GLOBAL SYNC")
    y -= 8
    leitura_style = ParagraphStyle("lr", fontName="Body", fontSize=8, leading=13, textColor=TEXT)
    lp = Paragraph(txt_leitura, leitura_style)
    _, lh = lp.wrap(W - 24, PH)
    box_h = lh + 20
    round_rect(c, MX, y - box_h, W, box_h, CARD_BG, radius=6)
    c.setFillColor(NAVY)
    c.rect(MX, y - box_h, 3, box_h, fill=1, stroke=0)
    lp.drawOn(c, MX + 12, y - box_h + 8)

    exec_footer(c, 4)
    c.showPage()

    # PG 5 — COMPARATIVO 2025 X 2026
    exec_header(c, mun_label)
    y = PH - 85

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 14)
    c.drawString(MX, y, f"5. Comparativo {ano1} x {ano2}")
    y -= 12
    hline(c, y)
    y -= 16

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 9)
    c.drawString(MX, y, "O que mudou na base considerada pelo Fundeb")
    y -= 12

    comp_rows = []
    for item in matriculas_comp:
        etapa = safe(item.get("etapa"))
        if etapa.upper() in {"TOTAL", "ESCOLAS MUNICIPAIS", "DOCENTES MUNICIPAIS"}:
            continue
        v1 = item.get("valor_ano_1")
        v2 = item.get("valor_ano_2")
        if v1 is None and v2 is None:
            continue
        if v1 is None or v2 is None:
            leitura = "Base comparativa parcial nesta etapa."
        else:
            diff = float(v2 or 0) - float(v1 or 0)
            if diff > 0:
                leitura = "Expansao observada em modalidade com peso tecnico."
            elif diff < 0:
                leitura = "Queda que merece leitura cadastral e operacional."
            else:
                leitura = "Etapa sem variacao material na rodada."
        comp_rows.append([etapa, safe(delta_abs(v1, v2)), leitura])

    comp_rows = comp_rows[:4]
    y = kv_table_exec(
        c,
        MX,
        y,
        W,
        ["Etapa / Modalidade", "Variacao", "Leitura"],
        comp_rows,
        [W * 0.34, W * 0.16, W * 0.50],
        row_h=19,
        font_size=7,
        center_cols={1},
        left_cols={2},
    )
    y -= 12

    total_mat_comp = next((item for item in matriculas_comp if safe(item.get("etapa")).upper() == "TOTAL"), {}) or {}
    hist_publico_1 = total_mat_comp.get("valor_ano_1")
    hist_publico_2 = total_mat_comp.get("valor_ano_2")
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 8)
    c.drawString(MX, y, "MATRÍCULA TOTAL")
    y -= 10

    card_exec(c, MX, y - 62, (W - 12) / 3, 62, f"Base {ano1}", f_int(hist_publico_1), bg=CARD_BG, accent=NAVY)
    card_exec(c, MX + ((W - 12) / 3) + 6, y - 62, (W - 12) / 3, 62, f"Base {ano2}", f_int(hist_publico_2), bg=GRAY_BG, accent=BLUE)
    card_exec(c, MX + (((W - 12) / 3) + 6) * 2, y - 62, (W - 12) / 3, 62, "Variacao", safe(delta_abs(hist_publico_1, hist_publico_2)), bg=colors.HexColor("#F0FFF4"), accent=GREEN)
    y -= 74

    critica = "VAAR segue zerado." if vaar_atual <= 0 else "VAAR ja aparece na base atual."
    y = wrap_para(
        c,
        critica + " A evolucao de receita precisa ser acompanhada de melhora de base, jornada e elegibilidade.",
        MX,
        y,
        W,
        size=8,
        leading=12,
    )

    c.setFillColor(MUTED)
    c.setFont("BodyBold", 7)
    c.drawString(MX, y, "Mensagem executiva:")
    y -= 10
    wrap_para(
        c,
        f"{mun} cresce em receita, mas precisa transformar comparacao historica em agenda de virada. O papel da Global Sync e traduzir esses movimentos em priorizacao corretiva e captura de valor.",
        MX,
        y,
        W,
        size=8.2,
        leading=13,
    )

    exec_footer(c, 5)
    c.showPage()

    # ═══════════════════════════════════════════════════
    # PG 5 — ANALISE FINANCEIRA
    # ═══════════════════════════════════════════════════
    exec_header(c, mun_label)
    y = PH - 85

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 14)
    c.drawString(MX, y, "6. Leitura Financeira")
    y -= 12
    hline(c, y)
    y -= 16

    # Duas colunas
    half_w2 = (W - 16) / 2

    # Tabela Receitas
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 8.5)
    c.drawString(MX, y, "6.1 Receitas FUNDEB (Exercicio Atual)")
    y -= 10
    total_rec = float(receitas_raw.get("totalReceitas") or 0)
    def pct_r(v):
        try:
            return f"{float(v or 0)/total_rec*100:.1f}%".replace(".", ",") if total_rec else "-"
        except: return "-"

    rec_rows_exec = [[safe(str(comp)), money(val), pct_r(val) if pct_r(val) != "-" else "-"]
                     for comp, val, _ in rec_list]
    y_rec = kv_table_exec(c, MX, y, half_w2,
                          ["Componente", "Valor (R$)", "%"],
                          rec_rows_exec,
                          [half_w2*0.50, half_w2*0.30, half_w2*0.20],
                          row_h=18, font_size=7,
                          highlight_last=True, center_cols={2})

    # Tabela Projecao
    px = MX + half_w2 + 16
    y_proj = y
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 8.5)
    c.drawString(px, y_proj, "6.2 Projecao Global Sync")
    y_proj -= 10
    proj_rows_exec = []
    for comp, atual, projetado, ganho in proj_list:
        g_val = float(ganho or 0)
        g_str = (f"+{money(g_val)}" if g_val > 0 else money(g_val))
        proj_rows_exec.append([safe(str(comp)), money(atual), money(projetado), g_str])
    y_proj_end = kv_table_exec(c, px, y_proj, half_w2,
                               ["Componente", "Atual", "Projetado", "Ganho"],
                               proj_rows_exec,
                               [half_w2*0.30, half_w2*0.23, half_w2*0.23, half_w2*0.24],
                               row_h=18, font_size=7,
                               highlight_last=True, center_cols={1, 2, 3})

    y = min(y_rec, y_proj_end) - 14

    # Box ganho total
    bh = 56
    round_rect(c, MX, y - bh, W, bh, GREEN_BG, radius=8)
    c.setFillColor(GREEN)
    c.rect(MX, y - bh, 3, bh, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#7E8B73"))
    c.setFont("BodyBold", 7)
    c.drawString(MX + 14, y - 14, "GANHO POTENCIAL ANUAL FUNDEB")
    c.setFillColor(GREEN)
    c.setFont("BodyBold", 20)
    c.drawString(MX + 14, y - 36, money(ganho_total))
    c.setFillColor(colors.HexColor("#4F5B48"))
    c.setFont("Body", 8)
    c.drawString(MX + 14, y - bh + 10, f"+{pct(ganho_pct)} sobre a base atual pela projecao comercial Global Sync")

    if ganho_recuperavel > 0 and abs(ganho_recuperavel - ganho_total) > 0.01:
        c.setFillColor(MUTED)
        c.setFont("Body", 7)
        c.drawString(MX + 255, y - bh + 10, f"Camada recuperavel: {money(ganho_recuperavel)}")

    exec_footer(c, 6)
    c.showPage()

    # ═══════════════════════════════════════════════════
    # PG 6 — METODOLOGIA E DIFERENCIAIS
    # ═══════════════════════════════════════════════════
    exec_header(c, mun_label)
    y = PH - 85

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 14)
    c.drawString(MX, y, "7. Método e Diferenciais")
    y -= 12
    hline(c, y)
    y -= 16

    # 4 passos metodologicos
    passos = [
        ("1. Levantamento", "Coleta e validacao das bases do FNDE, SIOPE, Censo Escolar e dados de complementacao."),
        ("2. Cruzamento", "Analise tecnica das divergencias entre os dados declarados e os criterios regulatorios vigentes."),
        ("3. Correcao", "Acao corretiva junto aos sistemas federais com documentacao tecnica e protocolo formal."),
        ("4. Monitoramento", "Acompanhamento continuo dos repasses e alertas proativos sobre mudancas regulatorias."),
    ]
    cw4 = (W - 12) / 4
    cx4 = MX
    for title, desc in passos:
        # Linha numerica como accent
        c.setFillColor(NAVY)
        c.rect(cx4, y - 3, cw4, 3, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont("BodyBold", 8.5)
        c.drawString(cx4, y - 16, title)
        wrap_para(c, desc, cx4, y - 26, cw4 - 8, size=7, leading=12, color=TEXT)
        cx4 += cw4 + 4
    y -= 80

    # Diferenciais
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 10)
    c.drawString(MX, y, "Por que a Global Sync?")
    y -= 10
    diferenciais = [
        "• Honorarios exclusivamente condicionados ao resultado — sem custo fixo para o municipio.",
        "• Equipe especializada em legislacao FUNDEB, Censo Escolar e sistemas FNDE.",
        "• Relatorios tecnicos acompanhados de documentacao probatoria para auditoria.",
        "• Historico de atuacao em municipios com perfil similar ao de " + mun + ".",
    ]
    for d_item in diferenciais:
        y = wrap_para(c, d_item, MX + 8, y, W - 8, size=8, leading=13)

    exec_footer(c, 7)
    c.showPage()

    # ═══════════════════════════════════════════════════
    # PG 7 — ENCAMINHAMENTO
    # ═══════════════════════════════════════════════════
    exec_header(c, mun_label)
    y = PH - 85

    c.setFillColor(NAVY)
    c.setFont("BodyBold", 14)
    c.drawString(MX, y, "8. Encaminhamento")
    y -= 12
    hline(c, y)
    y -= 20

    c.setFillColor(MUTED)
    c.setFont("BodyBold", 8)
    c.drawString(MX, y, "Fechamento executivo para reuniao")
    y -= 16
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 9)
    c.drawString(MX, y, "AGENDA PROPOSTA")
    y -= 10

    # 3 cards de proximos passos
    passos_cards = [
        ("01 | Apresentacao executiva ao gestor", "Alinhamento do racional tecnico e da oportunidade."),
        ("02 | Abertura da mesa tecnica", "Organizacao de documentos, responsaveis e validacoes."),
        ("03 | Plano de acao Global Sync", "Definicao de prioridades, cronograma e acompanhamento."),
    ]
    cw3 = (W - 8) / 3
    cx3 = MX
    for title, desc in passos_cards:
        round_rect(c, cx3, y - 80, cw3, 80, CARD_BG, radius=6)
        c.setFillColor(NAVY)
        c.rect(cx3, y - 5, cw3, 5, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("BodyBold", 7.5)
        c.drawString(cx3 + 8, y - 18, title)
        wrap_para(c, desc, cx3 + 8, y - 28, cw3 - 16, size=7, leading=12, color=TEXT)
        cx3 += cw3 + 4
    y -= 96

    # Card de contato
    contact_bh = 82
    round_rect(c, MX, y - contact_bh, W, contact_bh, DARK_BG, radius=6)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 10)
    c.drawString(MX + 16, y - 18, f"{mun.upper()} | OPORTUNIDADE EXECUTIVA")
    c.setFont("Body", 8)
    wrap_para(c, f"{mun} apresenta uma oportunidade tecnica real. A proposta da Global Sync e assumir essa agenda com clareza executiva, metodo, disciplina de acompanhamento e foco direto em resultado mensuravel.", MX + 16, y - 28, W * 0.62, size=8, color=WHITE, leading=12)
    c.setFont("BodyBold", 10)
    c.drawString(MX + W * 0.68, y - 18, "CONTATO")
    c.setFont("Body", 8)
    c.drawString(MX + W * 0.68, y - 32, "grupoglobalcomany2016@gmail.com")
    c.drawString(MX + W * 0.68, y - 43, "(77) 99700-5880")
    c.drawString(MX + W * 0.68, y - 54, "Global Services Company")
    c.setFillColor(ORANGE)
    c.setFont("BodyBold", 8)
    c.drawString(MX + W * 0.68, y - 66, "Tecnologia e dados para gestão pública")

    exec_footer(c, 8)
    c.showPage()

    c.save()
    return path


if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read().decode("utf-8-sig")
        if not raw.strip():
            sys.stderr.write("Empty input\n"); sys.exit(1)
        payload = json.loads(raw)
        print(gerar_executiva(payload), flush=True)
    except Exception as e:
        import traceback
        sys.stderr.write(f"ERROR: {e}\n{traceback.format_exc()}")
        sys.exit(1)
