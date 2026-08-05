"""
Gerador: Analise Comparativa FUNDEB 2025-2026
Formato: A4 retrato
Paginas: 3
Spec: kit_padrao_pdf/02_analise_comparativa_fundeb_2025_2026.md
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
        PAGE_W, PAGE_H, MARGIN_X,
        draw_header, draw_footer, draw_section_title, draw_kv_table,
        draw_highlight_box, draw_paragraph, register_fonts, round_rect,
        NAVY, BLUE, TEXT, MUTED, LINE, LIGHT_BLUE, GREEN, WHITE, SOFT_ROW, ORANGE,
        LIGHT_GREEN, fmt_money,
    )
except ImportError as e:
    sys.stderr.write(f"Import error: {e}\n")
    sys.exit(1)

LIGHT_ORANGE = colors.HexColor("#FFF7EC")
CARD_BG      = colors.HexColor("#EAF4FF")

MX = MARGIN_X

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

def f_int(v):
    try:
        n = int(float(v or 0))
        return f"{n:,}".replace(",", ".")
    except: return "-"

def delta_pct(v1, v2):
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
        sign = "+" if d >= 0 else ""
        return f"{sign}{money(abs(d))}"
    except: return "-"

def check_y(c, y, req, title, sub):
    if y - req < 70:
        draw_footer(c)
        c.showPage()
        draw_header(c, title=title, subtitle=sub, source="FNDE / INEP / IBGE")
        return PAGE_H - 140
    return y

def wrap_box(c, x, y, w, text, font="Body", size=8, leading=13,
             color=TEXT, bg=CARD_BG, accent=NAVY, label=None):
    """Box com bordo lateral colorida e paragrafo interno."""
    style = ParagraphStyle("wb", fontName=font, fontSize=size, leading=leading, textColor=color)
    p = Paragraph(safe(text), style)
    _, h = p.wrap(w - 24, PAGE_H)
    bh = h + (30 if label else 20)
    round_rect(c, x, y - bh, w, bh, bg, radius=6)
    c.setFillColor(accent)
    c.rect(x, y - bh, 4, bh, fill=1, stroke=0)
    if label:
        c.setFillColor(NAVY)
        c.setFont("BodyBold", 8)
        c.drawString(x + 12, y - 16, safe(label))
        p.drawOn(c, x + 12, y - bh + 8)
    else:
        p.drawOn(c, x + 12, y - bh + 8)
    return y - bh - 10


# ── GERAR PDF ───────────────────────────────────────────────────
def gerar_comparativa(payload_raw) -> str:
    register_fonts()

    if isinstance(payload_raw, list):
        d = payload_raw[0] if payload_raw else {}
    else:
        d = payload_raw or {}

    # Identificacao
    ident = d.get("identificacao") or {}
    mun = safe(ident.get("municipioNome") or ident.get("municipio") or "Município")
    uf  = safe(ident.get("uf") or "")
    mun_label = f"{mun} - {uf}" if uf else mun

    ano1 = str(d.get("ano_base_1") or ident.get("exercicio") or "2025")
    ano2 = str(d.get("ano_base_2") or int(ano1) + 1)

    TITLE = f"Análise Comparativa FUNDEB {ano1}-{ano2}"
    FONTE = "FNDE / INEP / IBGE"
    W = PAGE_W - 2 * MX

    # ── Receitas comparativas ──────────────────────────────────
    # Aceita lista explicita ou constroi a partir de receitas do payload
    receitas_raw = d.get("receitas") or {}
    proj = d.get("projecaoRecuperavel") or d.get("projecao") or {}

    receitas_comp = d.get("receitasComparativas") or [
        {
            "componente": "Contribuicao Municipal",
            "valor_ano_1": receitas_raw.get("receitaContribuicaoMunicipal"),
            "valor_ano_2": receitas_raw.get("receitaContribuicaoMunicipal"),
        },
        {
            "componente": "Complementacao VAAF",
            "valor_ano_1": proj.get("vaafAtual"),
            "valor_ano_2": proj.get("vaafProjetado"),
        },
        {
            "componente": "Complementacao VAAT",
            "valor_ano_1": proj.get("vaatAtual"),
            "valor_ano_2": proj.get("vaatProjetado"),
        },
        {
            "componente": "Complementacao VAAR",
            "valor_ano_1": proj.get("vaarAtual"),
            "valor_ano_2": proj.get("vaarProjetado"),
        },
        {
            "componente": "TOTAL",
            "valor_ano_1": proj.get("totalAtual"),
            "valor_ano_2": proj.get("totalProjetado"),
        },
    ]

    total_ano1 = float(next((r["valor_ano_1"] for r in receitas_comp if "TOTAL" in r.get("componente","").upper()), 0) or 0)
    total_ano2 = float(next((r["valor_ano_2"] for r in receitas_comp if "TOTAL" in r.get("componente","").upper()), 0) or 0)
    ganho_abs = total_ano2 - total_ano1

    # ── Matriculas comparativas ────────────────────────────────
    censo = d.get("censoEscolar") or {}
    etapas = censo.get("matriculasEtapa") or {}

    mat_comp = d.get("matriculasComparativas") or [
        {"etapa": "Creche Integral",         "valor_ano_1": None, "valor_ano_2": None},
        {"etapa": "Creche Parcial",           "valor_ano_1": None, "valor_ano_2": None},
        {"etapa": "Pre-escola Integral",      "valor_ano_1": None, "valor_ano_2": None},
        {"etapa": "Pre-escola Parcial",       "valor_ano_1": None, "valor_ano_2": None},
        {"etapa": "Anos Iniciais",            "valor_ano_1": None, "valor_ano_2": etapas.get("ensinoFundamental")},
        {"etapa": "Anos Finais",              "valor_ano_1": None, "valor_ano_2": None},
        {"etapa": "EJA",                      "valor_ano_1": None, "valor_ano_2": etapas.get("eja")},
        {"etapa": "Educacao Especial",        "valor_ano_1": None, "valor_ano_2": etapas.get("educacaoEspecial")},
        {"etapa": "TOTAL",                    "valor_ano_1": None, "valor_ano_2": censo.get("totalMatriculas")},
    ]

    # ── QEdu Snapshot ──────────────────────────────────────────
    qedu_snap = d.get("qeduSnapshot") or [
        {"indicador": "Escolas",           "valor": censo.get("totalEscolas")},
        {"indicador": "Docentes",          "valor": censo.get("totalDocentes")},
        {"indicador": "Educacao Infantil", "valor": etapas.get("educacaoInfantil")},
        {"indicador": "Ensino Fundamental","valor": etapas.get("ensinoFundamental")},
        {"indicador": "EJA",               "valor": etapas.get("eja")},
        {"indicador": "Ed. Especial",      "valor": etapas.get("educacaoEspecial")},
        {"indicador": "Total Matriculas",  "valor": censo.get("totalMatriculas")},
    ]

    historico_censo = d.get("historicoCenso") or []
    cenario_estruturacao = d.get("cenarioEstruturacao") or {}

    # ── Textos ─────────────────────────────────────────────────
    perfilComercial = d.get("perfilComercial") or {}
    ganho_pct_val = float(d.get("projecaoRecuperavel", {}).get("ganhoPercentual") or
                          proj.get("ganhoPercentual") or 0)

    txt_sintese = safe(d.get("texto_sintese") or
        f"O levantamento tecnico de {mun} para o periodo {ano1}-{ano2} identificou"
        f" variacao na composicao das receitas do FUNDEB, com destaque para a"
        f" evolucao das complementacoes federais. A analise comparativa apresentada"
        f" neste documento subsidia a tomada de decisao do gestor municipal.")
    txt_qedu = safe(d.get("texto_qedu") or
        "Os dados do Censo Escolar e da base QEdu refletem a estrutura da rede"
        " publica municipal para o exercicio atual, servindo como base de calculo"
        " para as complementacoes federais VAAF e VAAT.")
    txt_movimentos = safe(d.get("texto_movimentos_relevantes") or
        f"A variacao de receita entre {ano1} e {ano2} aponta para oportunidade"
        " de incremento via ajustes tecnicos nas bases do FNDE — sem impacto"
        " fiscal adicional para o municipio.")
    # A chave antiga fica como reserva: relatorios ja arquivados guardam o
    # envelope exato que os gerou, e um snapshot de 2026 nao muda de nome
    # porque a empresa mudou.
    txt_como_entra = safe(d.get("texto_como_consultoria_entra") or
        d.get("texto_como_rocha_prime_entra") or
        "A Global Company atua na identificacao e correcao das inconsistencias"
        " tecnicas que limitam o acesso as complementacoes federais. Nosso"
        " trabalho e fundamentado em evidencias documentadas e orientado ao resultado.")
    txt_conclusao = safe(d.get("texto_conclusao") or
        f"Com base no cenario identificado, o potencial de incremento anual"
        f" para {mun} e de {money(ganho_abs)} ({delta_pct(total_ano1, total_ano2)})"
        f" — sem custos fixos para o municipio, com honorarios condicionados ao resultado.")

    # ── Arquivo temporario ─────────────────────────────────────
    fd, path = tempfile.mkstemp(suffix=".pdf", prefix="comparativa_fundeb_")
    os.close(fd)
    c = canvas.Canvas(path, pagesize=(PAGE_W, PAGE_H))

    # ═══════════════════════════════════════════════════════════
    # PG 1 — CAPA
    # ═══════════════════════════════════════════════════════════
    from kit_padrao_pdf.report_style_pdf import draw_cover
    draw_cover(
        c,
        title=f"ANÁLISE COMPARATIVA FUNDEB",
        subtitle=f"Exercícios {ano1} e {ano2}  |  Base: FNDE / QEdu / Censo Escolar",
        municipality=mun.upper() + (f" - {uf}" if uf else ""),
        year_label=f"Levantamento Técnico Global Sync  |  {ano1}-{ano2}"
    )
    c.showPage()

    # ═══════════════════════════════════════════════════════════
    # PG 2 — SINTESE: texto intro + ganho + receitas + qedu
    # ═══════════════════════════════════════════════════════════
    draw_header(c, title=TITLE, subtitle=mun_label, source=FONTE)
    y = PAGE_H - 140

    draw_section_title(c, "1", f"Sintese do Levantamento {ano1}-{ano2}", y)
    y -= 20

    # Texto introdutorio
    style_p = ParagraphStyle("p", fontName="Body", fontSize=8, leading=13, textColor=TEXT)
    p_intro = Paragraph(txt_sintese, style_p)
    _, pi_h = p_intro.wrap(W, PAGE_H)
    p_intro.drawOn(c, MX, y - pi_h)
    y -= pi_h + 16

    # Box de destaque do ganho total
    bh = 80
    y = check_y(c, y, bh + 16, TITLE, mun_label)
    draw_highlight_box(c, MX, y - bh, W, bh,
        f"VARIAÇÃO DE RECEITA FUNDEB {ano1} a {ano2}",
        money(ganho_abs) if ganho_abs >= 0 else f"-{money(abs(ganho_abs))}",
        f"De {money(total_ano1)} para {money(total_ano2)}  |  Variação: {delta_pct(total_ano1, total_ano2)}"
    )
    y -= bh + 16

    # Tabela receitas comparativas
    y = check_y(c, y, 200, TITLE, mun_label)
    draw_section_title(c, "1.1", f"Composicao das Receitas FUNDEB", y)
    y -= 20
    rec_rows_comp = []
    for r in receitas_comp:
        v1 = r.get("valor_ano_1")
        v2 = r.get("valor_ano_2")
        dp = delta_pct(v1, v2)
        if v1 is not None or v2 is not None:
            rec_rows_comp.append([
                safe(r.get("componente", "")),
                money(v1), money(v2), dp
            ])
    last = len(rec_rows_comp) - 1
    # Marcar TOTAL como highlight
    total_is_last = any("TOTAL" in r.get("componente","").upper() for r in receitas_comp)
    y = draw_kv_table(c, MX, y, W,
        (f"Componente", f"{ano1}", f"{ano2}", "Variacao %"),
        rec_rows_comp,
        [W * 0.40, W * 0.22, W * 0.22, W * 0.16],
        highlight_last=total_is_last,
        center_cols={1, 2, 3}
    )
    y -= 12

    # QEdu Snapshot
    y = check_y(c, y, 180, TITLE, mun_label)
    draw_section_title(c, "1.2", "Rede Educacional — Censo Escolar / QEdu", y)
    y -= 20
    qedu_rows = [[safe(str(q.get("indicador",""))), f_int(q.get("valor"))] for q in qedu_snap]
    half_qedu = W * 0.55
    y = draw_kv_table(c, MX, y, half_qedu,
        ("Indicador", "Valor"),
        qedu_rows,
        [half_qedu * 0.65, half_qedu * 0.35],
        center_cols={1}
    )
    y -= 12

    # Box de interpretacao QEdu
    y = check_y(c, y, 80, TITLE, mun_label)
    y = wrap_box(c, MX, y, W, txt_qedu,
                 label="Leitura dos dados educacionais", bg=CARD_BG, accent=BLUE)

    draw_footer(c)
    c.showPage()

    # ═══════════════════════════════════════════════════════════
    # PG 3 — MATRICULAS COMPARATIVAS + LEITURA GERAL
    # ═══════════════════════════════════════════════════════════
    draw_header(c, title=TITLE, subtitle=mun_label, source=FONTE)
    y = PAGE_H - 140

    draw_section_title(c, "2", f"Matriculas Consideradas — {ano1} x {ano2}", y)
    y -= 20

    # Tabela matriculas comparativas
    mat_rows = []
    for m in mat_comp:
        v1 = m.get("valor_ano_1")
        v2 = m.get("valor_ano_2")
        d_abs = ""
        if v1 is not None and v2 is not None:
            diff = float(v2 or 0) - float(v1 or 0)
            sign = "+" if diff >= 0 else ""
            d_abs = f"{sign}{f_int(abs(diff))}" if diff != 0 else "="
        mat_rows.append([
            safe(m.get("etapa", "")),
            f_int(v1) if v1 is not None else "-",
            f_int(v2) if v2 is not None else "-",
            d_abs or "-"
        ])
    last_mat = any("TOTAL" in m.get("etapa","").upper() for m in mat_comp)
    y = draw_kv_table(c, MX, y, W,
        ("Etapa / Modalidade", f"{ano1}", f"{ano2}", "Variação"),
        mat_rows,
        [W * 0.46, W * 0.18, W * 0.18, W * 0.18],
        highlight_last=last_mat,
        center_cols={1, 2, 3}
    )
    y -= 16

    # Card "Movimentos Relevantes"
    y = check_y(c, y, 100, TITLE, mun_label)
    half_w = (W - 10) / 2
    y_save = y
    y = wrap_box(c, MX, y, half_w, txt_movimentos,
                 label="Movimentos Relevantes", bg=LIGHT_BLUE, accent=NAVY)
    # Card "Como a Global Sync Entra" — ao lado
    y2 = y_save
    y2 = wrap_box(c, MX + half_w + 10, y2, half_w, txt_como_entra,
                  label="Como a Global Sync Entra", bg=colors.HexColor("#EDF8E9"), accent=GREEN)
    y = min(y, y2) - 8

    # Conclusao
    draw_footer(c)
    c.showPage()

    # PG 4 — HISTORICO RECENTE + CENARIO 2027
    draw_header(c, title=TITLE, subtitle=mun_label, source=FONTE)
    y = PAGE_H - 140

    draw_section_title(c, "3", "Historico Recente da Base Educacional", y)
    y -= 20

    hist_rows = []
    for item in historico_censo[-3:]:
        hist_rows.append([
            safe(item.get("ano")),
            f_int(item.get("matriculasPublicas")),
            f_int(item.get("eja")),
            f_int(item.get("tempoIntegral")),
            f_int(item.get("educacaoEspecial")),
        ])
    y = draw_kv_table(
        c, MX, y, W,
        ("Ano", "Matriculas publicas", "EJA", "Integral", "Ed. especial"),
        hist_rows,
        [W * 0.12, W * 0.26, W * 0.18, W * 0.18, W * 0.26],
        center_cols={0, 1, 2, 3, 4}
    )
    y -= 14

    leitura_hist = (
        f"A leitura historica mostra que {mun} nao converteu o ciclo recente em reforco estrutural da base. "
        "Quando a rede nao expande de forma planejada EJA, jornada ampliada e educacao especial, o municipio cresce menos do que poderia no radar tecnico do FUNDEB."
    )
    y = wrap_box(c, MX, y, W, leitura_hist, label="Leitura de tendencia", bg=LIGHT_ORANGE, accent=ORANGE)

    y = check_y(c, y, 180, TITLE, mun_label)
    draw_section_title(c, "4", f"Agenda {safe(cenario_estruturacao.get('anoAlvo') or '')} com Global Sync", y)
    y -= 20

    metas = cenario_estruturacao.get("metas") or {}
    base_atual = cenario_estruturacao.get("baseAtual") or {}
    ganhos_mat = cenario_estruturacao.get("ganhosMatriculas") or {}
    impacto = cenario_estruturacao.get("impactoFinanceiroIndicativo") or {}

    meta_rows = [
        ["EJA", f_int(base_atual.get("eja")), f_int(metas.get("eja")), f"+{f_int(ganhos_mat.get('eja'))}"],
        ["Tempo integral", f_int(base_atual.get("integral")), f_int(metas.get("integral")), f"+{f_int(ganhos_mat.get('integral'))}"],
        ["Educacao especial", f_int(base_atual.get("educacaoEspecial")), f_int(metas.get("educacaoEspecial")), f"+{f_int(ganhos_mat.get('educacaoEspecial'))}"],
    ]
    y = draw_kv_table(
        c, MX, y, W,
        ("Frente", "Base atual", "Meta de reestruturacao", "Ganho de base"),
        meta_rows,
        [W * 0.24, W * 0.18, W * 0.34, W * 0.24],
        center_cols={1, 2, 3}
    )
    y -= 14

    faixa_msg = (
        f"Faixa indicativa de efeito financeiro com a agenda de reestruturacao: {money(impacto.get('minimo'))} a {money(impacto.get('maximo'))}. "
        "Esta faixa nao substitui simulacao oficial do FNDE; ela organiza a conversa comercial e a priorizacao tecnica da proxima rodada."
    )
    y = wrap_box(c, MX, y, W, faixa_msg, label="Impacto indicativo 2027", bg=colors.HexColor("#F0FFF4"), accent=GREEN)

    draw_footer(c)
    c.showPage()

    # PG 5 — CONCLUSAO
    draw_header(c, title=TITLE, subtitle=mun_label, source=FONTE)
    y = PAGE_H - 140
    draw_section_title(c, "5", "Conclusao e Oportunidade", y)
    y -= 20
    y = wrap_box(c, MX, y, W, txt_conclusao,
                 label=f"Virada proposta para {mun}",
                 bg=colors.HexColor("#F0FFF4"), accent=GREEN)

    frentes = cenario_estruturacao.get("frentes") or []
    if frentes:
        y = check_y(c, y, 120, TITLE, mun_label)
        y = wrap_box(
            c,
            MX,
            y,
            W,
            " | ".join([safe(item) for item in frentes]),
            label="Frentes de oficina e consultoria Global Sync",
            bg=CARD_BG,
            accent=BLUE,
        )

    draw_footer(c)

    c.save()
    return path


if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read().decode("utf-8-sig")
        if not raw.strip():
            sys.stderr.write("Empty input\n"); sys.exit(1)
        payload = json.loads(raw)
        print(gerar_comparativa(payload), flush=True)
    except Exception as e:
        import traceback
        sys.stderr.write(f"ERROR: {e}\n{traceback.format_exc()}")
        sys.exit(1)
