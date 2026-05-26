import json
import os
import re
import sys
import tempfile
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

try:
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfgen import canvas
    from reportlab.platypus import Paragraph
    from kit_padrao_pdf_rocha_prime.report_style_pdf import (
        BLUE,
        GREEN,
        LIGHT_BLUE,
        LINE,
        MARGIN_X,
        MUTED,
        NAVY,
        ORANGE,
        PAGE_H,
        PAGE_W,
        TEXT,
        WHITE,
        register_fonts,
        round_rect,
    )
except ImportError as e:
    sys.stderr.write(f"Import error: {e}\n")
    sys.exit(1)

LIGHT_GREEN = colors.HexColor("#EEF8F2")
LIGHT_AMBER = colors.HexColor("#FFF6E6")
LIGHT_RED = colors.HexColor("#FEF0F0")
LIGHT_GRAY = colors.HexColor("#F6F8FB")
SOFT_BLUE = colors.HexColor("#E8F1FF")
DARK_TEXT = colors.HexColor("#0F172A")
PDF_W = PAGE_H
PDF_H = PAGE_W
H_MARGIN = 34

STATUS_META = {
    "confirmado": ("Confirmado", GREEN, LIGHT_GREEN),
    "sinalizado": ("Sinalizado", ORANGE, LIGHT_AMBER),
    "pendente_manual": ("Revisar", colors.HexColor("#B91C1C"), LIGHT_RED),
    "nao_encontrado": ("Não encontrado", colors.HexColor("#64748B"), LIGHT_GRAY),
}

READINESS_META = {
    "aprovado_gestor": ("Pronto para gestor", GREEN, LIGHT_GREEN),
    "revisao_assistida": ("Entrega com revisão", ORANGE, LIGHT_AMBER),
    "bloqueado": ("Versão de trabalho", colors.HexColor("#B91C1C"), LIGHT_RED),
}


def safe(v, default="-"):
    if v is None:
        return default
    text = str(v).strip()
    if not text:
        return default
    try:
        repaired = text.encode("latin1").decode("utf-8")
        mojibake_markers = ["Ã", "Â", "â€", "â€™", "â€œ", "â€\x9d", "â€“", "â€”"]
        if (
            any(marker in text for marker in mojibake_markers)
            and sum(repaired.count(marker) for marker in mojibake_markers) < sum(text.count(marker) for marker in mojibake_markers)
            and repaired.count("?") <= text.count("?")
            and repaired.count("�") <= text.count("�")
        ):
            text = repaired
    except Exception:
        pass
    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r",(?=[A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç])", ", ", text)
    text = re.sub(r";(?=[A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç])", "; ", text)
    text = re.sub(r":(?=[A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç])", ": ", text)
    text = re.sub(r"([!?])(?=[A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç])", r"\1 ", text)
    text = re.sub(r"(?<!\d)\.(?=[A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç])", ". ", text)
    text = re.sub(r"\s*→\s*", " → ", text)
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r",\s*,+", ", ", text)
    text = re.sub(r";\s*;+", "; ", text)
    text = re.sub(r"\.\s*\.+", ".", text)
    corrections = {
        r"\bNao informado\b": "Não informado",
        r"\bnao informado\b": "não informado",
        r"\bMatriculas\b": "Matrículas",
        r"\bmatriculas\b": "matrículas",
        r"\bEducacao\b": "Educação",
        r"\beducacao\b": "educação",
        r"\bPolitica\b": "Política",
        r"\bpolitica\b": "política",
        r"\bFormacao\b": "Formação",
        r"\bformacao\b": "formação",
        r"\bCapacitacao\b": "Capacitação",
        r"\bcapacitacao\b": "capacitação",
        r"\bGestao\b": "Gestão",
        r"\bgestao\b": "gestão",
        r"\bMunicipio\b": "Município",
        r"\bmunicipio\b": "município",
        r"\bApresentacao\b": "Apresentação",
        r"\bapresentacao\b": "apresentação",
        r"\bExecucao\b": "Execução",
        r"\bexecucao\b": "execução",
    }
    for pattern, replacement in corrections.items():
        text = re.sub(pattern, replacement, text)
    return text.strip()


def normalize_spaces(text):
    return re.sub(r"\s+", " ", safe(text, "")).strip()


def split_sentences(text):
    normalized = normalize_spaces(text)
    if not normalized:
        return []
    return [chunk.strip() for chunk in re.split(r"(?<=[.!?])\s+", normalized) if chunk.strip()]


def summarize_text(text, max_sentences=2):
    cleaned = normalize_spaces(text)
    if not cleaned:
        return ""
    cleaned = re.sub(r"(?i)\b(Evid[eê]ncia objetiva:|Leitura t[eé]cnica:|Pend[eê]ncia documental:)\s*", "", cleaned)
    cleaned = re.sub(r"\.?\s*Nenhuma,\s*status\s*[a-z_]+\.?", "", cleaned)
    result = []
    for sentence in split_sentences(cleaned):
        if re.match(r"^(sim|nao|não)([,.!?:]|$)", sentence, re.I):
            continue
        if len(sentence) < 18:
            continue
        result.append(sentence)
        if len(result) >= max_sentences:
            break
    if result:
        return " ".join(result)
    return cleaned


def wrap_para(c, text, x, y, w, size=8.8, font="Body", color=TEXT, leading=13):
    style = ParagraphStyle("body", fontName=font, fontSize=size, leading=leading, textColor=color)
    p = Paragraph(safe(text, ""), style)
    _, h = p.wrap(w, PDF_H)
    p.drawOn(c, x, y - h)
    return y - h


def draw_badge(c, x, y, text, fill_color, text_color=WHITE):
    text = safe(text)
    width = max(90, len(text) * 5.3 + 18)
    round_rect(c, x, y - 18, width, 18, fill_color, radius=9)
    c.setFillColor(text_color)
    c.setFont("BodyBold", 7)
    c.drawString(x + 9, y - 12, text.upper())
    return width


def draw_section_heading(c, x, y, index, title, subtitle=""):
    c.setFillColor(BLUE)
    c.setFont("BodyBold", 8)
    c.drawString(x, y, f"{index}.")
    c.setFillColor(DARK_TEXT)
    c.setFont("Heading", 16)
    c.drawString(x + 18, y, safe(title))
    if subtitle:
        c.setFillColor(MUTED)
        c.setFont("Body", 8)
        c.drawString(x + 18, y - 14, safe(subtitle))
        return y - 28
    return y - 18


def draw_exec_header(c, title, subtitle):
    c.setFillColor(WHITE)
    c.rect(0, PDF_H - 54, PDF_W, 54, fill=1, stroke=0)
    c.setStrokeColor(LINE)
    c.line(H_MARGIN, PDF_H - 54, PDF_W - H_MARGIN, PDF_H - 54)
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 9)
    c.drawString(H_MARGIN, PDF_H - 24, "ROCHA PRIME | RELATÓRIO EXECUTIVO")
    c.setFillColor(DARK_TEXT)
    c.setFont("Heading", 14)
    c.drawString(H_MARGIN, PDF_H - 42, safe(title))
    c.setFillColor(MUTED)
    c.setFont("Body", 8)
    c.drawRightString(PDF_W - H_MARGIN, PDF_H - 24, safe(subtitle))


def draw_exec_footer(c, page_number):
    c.setStrokeColor(LINE)
    c.line(H_MARGIN, 42, PDF_W - H_MARGIN, 42)
    c.setFillColor(MUTED)
    c.setFont("Body", 7)
    c.drawString(H_MARGIN, 28, "Material executivo para reunião institucional")
    c.drawRightString(PDF_W - H_MARGIN, 28, f"Página {page_number}")


def start_exec_page(c, page_number, title, subtitle):
    draw_exec_header(c, title, subtitle)
    return PDF_H - 88


def check_y(c, y, required, title, subtitle):
    if y - required < 86:
        draw_exec_footer(c, getattr(c, "_sync_page_number", 1))
        c.showPage()
        c._sync_page_number = getattr(c, "_sync_page_number", 1) + 1
        return start_exec_page(c, c._sync_page_number, title, subtitle)
    return y


def draw_metric_card(c, x, y, w, h, label, value, helper="", accent=NAVY, bg=WHITE, value_size=16):
    round_rect(c, x, y - h, w, h, bg, radius=10)
    c.setFillColor(accent)
    c.rect(x, y - 4, w, 4, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont("BodyBold", 7)
    c.drawString(x + 12, y - 18, safe(label).upper())
    c.setFillColor(DARK_TEXT)
    c.setFont("Heading", value_size)
    c.drawString(x + 12, y - 40, safe(value))
    if helper:
        c.setFillColor(TEXT)
        c.setFont("Body", 7.2)
        wrap_para(c, helper, x + 12, y - 48, w - 24, size=7.2, leading=10)


def draw_callout(c, x, y, w, title, text, accent=BLUE, bg=WHITE):
    style = ParagraphStyle("callout", fontName="Body", fontSize=9, leading=14, textColor=TEXT)
    p = Paragraph(safe(text, ""), style)
    _, ph = p.wrap(w - 28, PDF_H)
    height = ph + 38
    round_rect(c, x, y - height, w, height, bg, radius=10)
    c.setFillColor(accent)
    c.rect(x, y - height, 5, height, fill=1, stroke=0)
    c.setFillColor(DARK_TEXT)
    c.setFont("BodyBold", 9)
    c.drawString(x + 14, y - 16, safe(title))
    p.drawOn(c, x + 14, y - height + 12)
    return y - height


def draw_list_block(c, x, y, w, title, items, accent=NAVY, bg=WHITE, bullet_color=BLUE, max_items=6):
    items = [safe(item) for item in items if safe(item, "")]
    if not items:
        items = ["Nenhum ponto relevante registrado nesta versao."]

    style = ParagraphStyle("list", fontName="Body", fontSize=8.4, leading=12.5, textColor=TEXT)
    total_height = 42
    wrapped = []
    for item in items[:max_items]:
        p = Paragraph(item, style)
        _, ph = p.wrap(w - 34, PDF_H)
        wrapped.append((item, p, ph))
        total_height += ph + 8

    round_rect(c, x, y - total_height, w, total_height, bg, radius=10)
    c.setFillColor(accent)
    c.rect(x, y - total_height, 5, total_height, fill=1, stroke=0)
    c.setFillColor(DARK_TEXT)
    c.setFont("BodyBold", 9)
    c.drawString(x + 14, y - 16, safe(title))

    current_y = y - 34
    for _, paragraph, ph in wrapped:
        c.setFillColor(bullet_color)
        c.circle(x + 17, current_y - 4, 1.8, fill=1, stroke=0)
        paragraph.drawOn(c, x + 24, current_y - ph)
        current_y -= ph + 8

    return y - total_height


def estimate_list_block_height(items, max_items=6, line_height=20):
    count = max(1, min(len(items), max_items))
    return 48 + (count * line_height)


def find_item(report, item_id):
    for item in report.get("itens") or []:
        if safe(item.get("id"), "") == item_id:
            return item
    return {}


def extract_number(text):
    match = re.search(r"\b\d{1,3}(?:\.\d{3})*(?:,\d+)?\b", safe(text, ""))
    return match.group(0) if match else "-"


def extract_currency(text):
    match = re.search(r"R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?", safe(text, ""))
    return match.group(0) if match else ""


def extract_gain_currency(text):
    normalized = normalize_spaces(text)
    patterns = [
        r"ganho potencial estimado(?: nesta fase)?(?: e| e de| de)?\s*(R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?)",
        r"incremento orcamentario(?: estimado)?(?: de)?\s*(R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?)",
        r"potencial estimado(?: de incremento orcamentario)?(?: de)?\s*(R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?)",
    ]
    for pattern in patterns:
        match = re.search(pattern, normalized, re.I)
        if match:
            return match.group(1)
    return ""


def format_int(value):
    if value is None:
        return "Não informado"
    try:
        numeric = int(round(float(value)))
    except Exception:
        return safe(value)
    return f"{numeric:,}".replace(",", ".")


def format_money(value):
    if value is None:
        return "Não informado"
    try:
        numeric = float(value)
    except Exception:
        return safe(value)
    base = f"{numeric:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {base}"


def format_decimal(value, digits=3):
    if value is None:
        return "Não informado"
    try:
        numeric = float(value)
    except Exception:
        return safe(value)
    return f"{numeric:.{digits}f}".replace(".", ",")


def get_historical_range_label(report):
    historico = (report.get("historico") or {}).get("anos") or []
    years = []
    for item in historico:
        try:
            years.append(int(item.get("ano")))
        except Exception:
            continue
    if not years:
        return "Histórico recente"
    return f"Histórico detalhado {min(years)}-{max(years)}"


def get_historical_method_note(report):
    return (
        "A série recente prioriza os exercícios com melhor consistência entre receita oficial do FUNDEB, "
        "base educacional consolidada no Sync e a última base anual disponível do Censo Escolar."
    )


def extract_year(text):
    match = re.search(r"\b20\d{2}\b", safe(text, ""))
    return match.group(0) if match else "-"


def metric_value(item_id, report, mode="number"):
    item = find_item(report, item_id)
    resposta = safe(item.get("resposta"), "")
    if not resposta:
        return "-"
    if mode == "year":
        return extract_year(resposta)
    return extract_number(resposta)


def unique_external_sources(report, preferred_ids):
    seen = set()
    result = []
    for item_id in preferred_ids:
        item = find_item(report, item_id)
        for fonte in item.get("fontes") or []:
            if safe(fonte.get("tipo")) == "base_interna":
                continue
            title = safe(fonte.get("titulo") or fonte.get("url"), "")
            if not title:
                continue
            key = title.lower()
            if key in seen:
                continue
            seen.add(key)
            result.append(title)
    return result[:8]


def status_badge_data(item):
    return STATUS_META.get(safe(item.get("status"), "nao_encontrado"), STATUS_META["nao_encontrado"])


def draw_resource_card(c, x, y, w, title, item):
    label, accent, bg = status_badge_data(item)
    text = summarize_text(item.get("resposta"), max_sentences=2) or "Sem resposta consolidada nesta rodada."
    fontes = [
        safe(fonte.get("titulo") or fonte.get("url"), "")
        for fonte in (item.get("fontes") or [])
        if safe(fonte.get("tipo")) != "base_interna"
    ]
    fontes = [fonte for fonte in fontes if fonte][:2]

    style = ParagraphStyle("resource", fontName="Body", fontSize=8.6, leading=13, textColor=TEXT)
    p = Paragraph(text, style)
    _, ph = p.wrap(w - 24, PDF_H)
    extra = 18 if fontes else 0
    height = ph + 46 + extra
    round_rect(c, x, y - height, w, height, bg, radius=10)
    c.setFillColor(DARK_TEXT)
    c.setFont("BodyBold", 10)
    c.drawString(x + 12, y - 16, safe(title))
    badge_w = draw_badge(c, x + w - 118, y - 2, label, accent)
    if badge_w > 106:
        pass
    p.drawOn(c, x + 12, y - 30 - ph)
    current_y = y - 34 - ph
    if fontes:
        c.setFillColor(MUTED)
        c.setFont("Body", 7)
        c.drawString(x + 12, current_y - 8, f"Fonte-chave: {fontes[0]}")
    return y - height


def draw_cover_pillar(c, x, y, w, title, text):
    round_rect(c, x, y - 86, w, 86, colors.Color(1, 1, 1, alpha=0.08), radius=12)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 8)
    c.drawString(x + 14, y - 20, safe(title).upper())
    wrap_para(c, text, x + 14, y - 30, w - 28, size=9, color=WHITE, leading=13)


def get_profile(report):
    return report.get("perfilMunicipio") or {}


def get_diagnostico(report):
    return report.get("diagnosticoEducacao") or {}


def get_proposta(report):
    return report.get("propostaEmpresa") or {}


def build_exec_thesis(report):
    municipio = safe(report.get("municipio"))
    profile = get_profile(report)
    diagnostico = get_diagnostico(report)
    arranjo = summarize_text(find_item(report, "arranjo_educacional").get("resposta"), max_sentences=1)
    principal = summarize_text(find_item(report, "perda_ou_nao_captura_recursos_fundeb").get("resposta"), max_sentences=2)
    populacao = format_int(profile.get("populacao")) if profile.get("populacao") else None
    matriculas = format_int(diagnostico.get("totalMatriculas")) if diagnostico.get("totalMatriculas") else None
    escolas = format_int(diagnostico.get("totalEscolas")) if diagnostico.get("totalEscolas") else None
    proposta = get_proposta(report)
    abertura = []

    if populacao and matriculas and escolas:
        abertura.append(f"{municipio} tem {populacao} habitantes, {matriculas} matrículas e {escolas} escolas no recorte atual.")
    if arranjo:
        abertura.append(arranjo)
    if principal:
        abertura.append(principal)
    if proposta.get("descricao"):
        abertura.append(summarize_text(proposta.get("descricao"), max_sentences=1))
    return " ".join(abertura[:4])


def build_cover_points(report):
    diagnostico = get_diagnostico(report)
    profile = get_profile(report)
    proposta = get_proposta(report)
    fundeb = find_item(report, "perda_ou_nao_captura_recursos_fundeb")
    return [
        (
            "Porte da rede",
            f"{format_int(diagnostico.get('totalEscolas'))} escolas, {format_int(diagnostico.get('totalMatriculas'))} matrículas e censo base {safe(diagnostico.get('censoAno'), 'Não informado')}.",
        ),
        (
            "Leitura de oportunidade",
            summarize_text(proposta.get("descricao"), max_sentences=1)
            or "O documento organiza a agenda de recuperacao, protecao e ampliacao da receita educacional.",
        ),
        (
            "Mensagem central",
            summarize_text(fundeb.get("resposta"), max_sentences=2)
            or f"{safe(report.get('municipio'))} precisa converter base educacional em resultado financeiro e institucional.",
        ),
    ]


def build_profile_lines(report):
    profile = get_profile(report)
    arranjo = summarize_text(find_item(report, "arranjo_educacional").get("resposta"), max_sentences=1)
    return [
        f"População estimada: {format_int(profile.get('populacao'))}",
        f"Referência da população: {safe(profile.get('populacaoAnoReferencia'), 'Não informado')}",
        f"Último IDHM oficial disponível: {format_decimal(profile.get('idh'))}",
        f"Referência do IDHM oficial: {safe(profile.get('idhAnoReferencia'), 'Não informado')}",
        f"PIB per capita: {format_money(profile.get('pibPerCapita'))}",
        f"Referência do PIB per capita: {safe(profile.get('pibAnoReferencia'), 'Não informado')}",
        "Nota metodológica: indicadores estruturais, como IDHM, seguem a última publicação oficial disponível. A leitura gerencial detalhada se concentra na série 2024-2026.",
        f"Governança educacional: {arranjo or 'Sem fechamento nesta rodada.'}",
    ]


def build_modalidades_lines(report):
    diagnostico = get_diagnostico(report)
    modalidades = diagnostico.get("modalidades") or []
    lines = []
    for item in modalidades:
        valor = item.get("valor")
        if valor and float(valor) > 0:
            lines.append(f"{safe(item.get('label'))}: {format_int(valor)}")
    return lines[:7]


def build_program_lines(report):
    eja = find_item(report, "incentivo_eja")
    bonificacao = find_item(report, "bonificacao_boas_praticas")
    lines = []
    if eja:
        lines.append(summarize_text(eja.get("resposta"), max_sentences=2) or "EJA sem fechamento nesta rodada.")
    if bonificacao:
        lines.append(summarize_text(bonificacao.get("resposta"), max_sentences=2) or "Bonificação e boas práticas sem fechamento nesta rodada.")
    lines.append("Boas práticas, alfabetização e premiações fortalecem a narrativa institucional da educação e ajudam a sustentar agenda positiva com o gestor.")
    return lines[:4]


def build_partnership_lines(report):
    assistencia = summarize_text(find_item(report, "parceria_assistencia_eja").get("resposta"), max_sentences=2)
    cultura = summarize_text(find_item(report, "parceria_cultura_rua").get("resposta"), max_sentences=2)
    return [
        assistencia or "Assistência Social x Educação: não foram localizadas evidências públicas suficientes nesta rodada.",
        cultura or "Cultura x Educação: não foram localizadas evidências públicas suficientes nesta rodada.",
    ]


def build_recovery_lines(report):
    custom = []
    for item in report.get("proximosPassos") or []:
        item_text = safe(item, "")
        if not item_text:
            continue
        if item_text.lower() in [existing.lower() for existing in custom]:
            continue
        custom.append(item_text)
    if custom:
        return custom[:4]
    return [
        "Auditar a base do Censo Escolar para garantir ponderacoes corretas e capturar tudo o que e devido.",
        "Fechar a leitura de VAAF, VAAT e VAAR com documentacao oficial e memoria de calculo.",
        "Ativar rotina de monitoramento dos sistemas MEC/FNDE para evitar perda futura por pendencia operacional.",
        "Transformar os achados em plano de execução com prioridade, prazo e responsável.",
    ]


def build_validation_lines(report):
    prontidao = report.get("prontidao") or {}
    lines = [safe(item) for item in prontidao.get("bloqueios") or [] if safe(item, "")]
    lines.extend([safe(item) for item in prontidao.get("avisos") or [] if safe(item, "")])
    if not lines:
        lines = ["A versão atual não registrou bloqueios adicionais nesta rodada."]
    return lines[:4]


def build_transport_message(report):
    transporte = find_item(report, "transporte_escolar")
    return summarize_text(transporte.get("resposta"), max_sentences=3) or "Sem leitura consolidada de transporte escolar nesta rodada."


def build_icms_message(report):
    icms = find_item(report, "icms_28_goias")
    base = summarize_text(icms.get("resposta"), max_sentences=3) or "Tema juridico ainda sem fechamento suficiente."
    complemento = (
        " Em Goiás, o ICMS-Educação deve entrar na conversa como oportunidade de ganho extra orientado por desempenho e boas práticas na educação, sem exagerar a tese jurídica."
    )
    return f"{base}{complemento}"


def build_company_closing(report):
    proposta = get_proposta(report)
    headline = safe(proposta.get("headline"), "")
    descricao = summarize_text(proposta.get("descricao"), max_sentences=2)
    return " ".join(part for part in [headline, descricao] if part).strip()


def build_political_lines(report):
    contexto = report.get("contextoPolitico") or {}
    return [
        f"Prefeito atual: {safe(contexto.get('prefeitoAtual'), 'Não informado')}",
        f"Partido: {safe(contexto.get('partidoAtual'), 'Não informado')}",
        f"Ciclo atual: {safe(contexto.get('inicioMandato'), '-')}-{safe(contexto.get('fimMandato'), '-')}",
        f"Situação do mandato: {safe(str(contexto.get('classificacaoMandato') or 'indeterminado').replace('_', ' '), 'indeterminado')}",
        safe(contexto.get("detalheMandato"), "Sem leitura política nesta rodada."),
        safe(contexto.get("estrategiaComercial"), "Sem estratégia comercial registrada nesta rodada."),
    ]


def build_historical_lines(report):
    historico = (report.get("historico") or {}).get("anos") or []
    lines = []
    for item in historico:
        lines.append(
            f"{safe(item.get('ano'))} | Base do Censo {safe(item.get('anoBaseCenso'), '-')} | Receita {format_money(item.get('totalReceitasFundeb'))} | Matrículas {format_int(item.get('totalMatriculas'))} | Escolas {format_int(item.get('totalEscolas'))} | EJA {format_int(item.get('eja'))} | Integral {format_int(item.get('tempoIntegral'))} | Educação especial {format_int(item.get('educacaoEspecial'))}"
        )
    return lines or ["Série histórica indisponível nesta rodada."]


def build_historical_year_detail(item, previous=None):
    ano = safe(item.get("ano"), "-")
    lines = [
        f"Base do Censo: {safe(item.get('anoBaseCenso'), 'Não informado')}",
        f"Receita total do FUNDEB: {format_money(item.get('totalReceitasFundeb'))}",
        f"Contribuição municipal: {format_money(item.get('contribuicaoMunicipal'))}",
        f"VAAF {format_money(item.get('complementacaoVAAF'))} | VAAT {format_money(item.get('complementacaoVAAT'))} | VAAR {format_money(item.get('complementacaoVAAR'))}",
        f"Matrículas {format_int(item.get('totalMatriculas'))} | Escolas {format_int(item.get('totalEscolas'))}",
        f"EJA {format_int(item.get('eja'))} | Integral {format_int(item.get('tempoIntegral'))} | Educação especial {format_int(item.get('educacaoEspecial'))}",
    ]
    if previous:
        lines.append(
            f"Comparação com {safe(previous.get('ano'))}: receita {format_money(previous.get('totalReceitasFundeb'))} → {format_money(item.get('totalReceitasFundeb'))} | matrículas {format_int(previous.get('totalMatriculas'))} → {format_int(item.get('totalMatriculas'))}"
        )
    else:
        lines.append(f"{ano} abre a série recente utilizada pelo módulo para leitura da evolução municipal.")
    return lines


def build_benchmark_lines(report):
    benchmark = (report.get("benchmarkRegional") or {}).get("municipios") or []
    lines = []
    for item in benchmark[:6]:
        lines.append(
            f"{safe(item.get('municipio'))}/{safe(item.get('uf'))} | {format_int(item.get('populacao'))} hab. | FUNDEB {format_money(item.get('totalReceitasFundeb'))} | União {format_money(item.get('complementacaoUniaoTotal'))}"
        )
        lines.append(safe(item.get("insight"), ""))
    return [line for line in lines if line] or ["Nenhum município comparável com superioridade clara foi localizado nesta rodada."]


def draw_cover_page(c, report, municipio_label):
    c.setFillColor(NAVY)
    c.rect(0, 0, PDF_W, PDF_H, fill=1, stroke=0)

    c.setFillColor(colors.HexColor("#173168"))
    c.circle(PDF_W - 70, PDF_H - 72, 150, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#264B96"))
    c.circle(90, 76, 120, fill=1, stroke=0)

    c.setFillColor(WHITE)
    c.setFont("BodyBold", 10)
    c.drawString(H_MARGIN, PDF_H - 78, "LEVANTAMENTO ESTRATÉGICO FUNDEB")
    c.setFont("Heading", 30)
    c.drawString(H_MARGIN, PDF_H - 136, "Relatório Executivo")
    c.drawString(H_MARGIN, PDF_H - 172, "para Gestão Municipal")

    c.setFillColor(colors.Color(1, 1, 1, alpha=0.84))
    wrap_para(
        c,
        build_exec_thesis(report)
        or "Material pensado para apresentação ao gestor, com foco em leitura rápida, oportunidade educacional e proposta de execução.",
        H_MARGIN,
        PDF_H - 206,
        430,
        size=11.2,
        color=WHITE,
        leading=17,
    )

    c.setFillColor(WHITE)
    c.setFont("BodyBold", 9)
    c.drawString(H_MARGIN, 164, "MUNICIPIO")
    c.setFont("Heading", 20)
    c.drawString(H_MARGIN, 136, municipio_label.upper())
    c.setFont("BodyBold", 9)
    c.drawString(H_MARGIN, 102, "CODIGO IBGE")
    c.setFont("Body", 11)
    c.drawString(H_MARGIN, 84, safe(report.get("codigoIbge"), "-"))

    c.setFont("BodyBold", 9)
    c.drawString(PDF_W - 190, 102, "GERADO EM")
    c.setFont("Body", 11)
    c.drawRightString(PDF_W - H_MARGIN, 84, safe(report.get("geradoEm"), "-"))

    pillar_gap = 14
    pillar_w = (PDF_W - (H_MARGIN * 2) - (pillar_gap * 2)) / 3
    pillar_y = 270
    for index, (title, text) in enumerate(build_cover_points(report)):
        draw_cover_pillar(c, H_MARGIN + ((pillar_w + pillar_gap) * index), pillar_y, pillar_w, title, text)


def gerar_pdf_dirigido(report) -> str:
    register_fonts()

    fd, path = tempfile.mkstemp(suffix=".pdf", prefix="relatorio_dirigido_fundeb_")
    os.close(fd)
    c = canvas.Canvas(path, pagesize=(PDF_W, PDF_H))

    municipio = safe(report.get("municipio"), "Município")
    uf = safe(report.get("uf"), "")
    municipio_label = f"{municipio} - {uf}" if uf else municipio
    title = "Relatório Executivo FUNDEB"
    c._sync_page_number = 2
    diagnostico = get_diagnostico(report)
    proposta = get_proposta(report)
    historical_range_label = get_historical_range_label(report)

    draw_cover_page(c, report, municipio_label)
    c.showPage()

    y = start_exec_page(c, c._sync_page_number, title, municipio_label)
    y = draw_section_heading(
        c,
        H_MARGIN,
        y,
        "1",
        "Perfil do município e diagnóstico da educação",
        "Base objetiva para abrir a reunião com o gestor",
    )

    card_gap = 10
    card_w = (PDF_W - 2 * H_MARGIN - card_gap * 4) / 5
    profile = get_profile(report)
    draw_metric_card(c, H_MARGIN, y, card_w, 70, "População", format_int(profile.get("populacao")), "Última estimativa oficial disponível", value_size=14)
    draw_metric_card(c, H_MARGIN + (card_w + card_gap), y, card_w, 70, "IDHM oficial", format_decimal(profile.get("idh")), f"Última referência oficial: {safe(profile.get('idhAnoReferencia'), 'n/d')}", value_size=14)
    draw_metric_card(c, H_MARGIN + ((card_w + card_gap) * 2), y, card_w, 70, "PIB per capita", format_money(profile.get("pibPerCapita")), f"Última referência oficial: {safe(profile.get('pibAnoReferencia'), 'n/d')}", value_size=12)
    draw_metric_card(c, H_MARGIN + ((card_w + card_gap) * 3), y, card_w, 70, "Escolas", format_int(diagnostico.get("totalEscolas")), "Recorte municipal atual", value_size=14)
    draw_metric_card(c, H_MARGIN + ((card_w + card_gap) * 4), y, card_w, 70, "Matrículas", format_int(diagnostico.get("totalMatriculas")), f"Censo {safe(diagnostico.get('censoAno'), 'n/d')}", value_size=14)
    y -= 92

    y = draw_callout(
        c,
        H_MARGIN,
        y,
        PDF_W - 2 * H_MARGIN,
        "Mensagem de abertura",
        build_exec_thesis(report),
        accent=BLUE,
        bg=WHITE,
    ) - 14

    col_gap = 16
    col_w = (PDF_W - 2 * H_MARGIN - col_gap) / 2
    left_y = draw_list_block(
        c,
        H_MARGIN,
        y,
        col_w,
        "Perfil do município",
        build_profile_lines(report),
        accent=NAVY,
        bg=WHITE,
        bullet_color=BLUE,
        max_items=8,
    )
    right_y = draw_list_block(
        c,
        H_MARGIN + col_w + col_gap,
        y,
        col_w,
        "Diagnóstico da educação",
        build_modalidades_lines(report) or ["Modalidades ainda não consolidadas nesta rodada."],
        accent=GREEN,
        bg=LIGHT_GREEN,
        bullet_color=GREEN,
        max_items=7,
    )
    y = min(left_y, right_y) - 14

    draw_exec_footer(c, c._sync_page_number)
    c.showPage()
    c._sync_page_number += 1

    y = start_exec_page(c, c._sync_page_number, title, municipio_label)
    y = draw_section_heading(
        c,
        H_MARGIN,
        y,
        "2",
        "Contexto político, gestão e histórico recente",
        "Leitura comercial para calibrar o discurso do apresentador",
    )

    y = draw_callout(
        c,
        H_MARGIN,
        y,
        PDF_W - 2 * H_MARGIN,
        "Como ler o momento político",
        safe((report.get("contextoPolitico") or {}).get("resumoComparativoGestao"), "Sem leitura política consolidada nesta rodada."),
        accent=BLUE,
        bg=SOFT_BLUE,
    ) - 14

    draw_list_block(
        c,
        H_MARGIN,
        y,
        PDF_W - 2 * H_MARGIN,
        "Contexto político",
        build_political_lines(report),
        accent=NAVY,
        bg=WHITE,
        bullet_color=BLUE,
        max_items=6,
    )
    draw_exec_footer(c, c._sync_page_number)
    c.showPage()
    c._sync_page_number += 1

    y = start_exec_page(c, c._sync_page_number, title, municipio_label)
    y = draw_section_heading(
        c,
        H_MARGIN,
        y,
        "3",
        historical_range_label,
        "Página exclusiva para a evolução anual mais confiável da rede e da receita",
    )

    y = draw_callout(
        c,
        H_MARGIN,
        y,
        PDF_W - 2 * H_MARGIN,
        "Leitura da série histórica",
        f"{safe((report.get('historico') or {}).get('resumo'), 'Série histórica indisponível nesta rodada.')} {get_historical_method_note(report)}",
        accent=GREEN,
        bg=LIGHT_GREEN,
    ) - 14

    historico = (report.get("historico") or {}).get("anos") or []
    col_gap = 16
    col_w = (PDF_W - 2 * H_MARGIN - col_gap) / 2

    if len(historico) > 0:
        draw_list_block(
            c,
            H_MARGIN,
            y,
            col_w,
            f"Exercício {safe(historico[0].get('ano'))}",
            build_historical_year_detail(historico[0], None),
            accent=NAVY,
            bg=WHITE,
            bullet_color=BLUE,
            max_items=8,
        )
    if len(historico) > 1:
        draw_list_block(
            c,
            H_MARGIN + col_w + col_gap,
            y,
            col_w,
            f"Exercício {safe(historico[1].get('ano'))}",
            build_historical_year_detail(historico[1], historico[0]),
            accent=GREEN,
            bg=LIGHT_GREEN,
            bullet_color=GREEN,
            max_items=8,
        )

    draw_exec_footer(c, c._sync_page_number)
    c.showPage()
    c._sync_page_number += 1

    y = start_exec_page(c, c._sync_page_number, title, municipio_label)
    y = draw_section_heading(
        c,
        H_MARGIN,
        y,
        "4",
        historical_range_label,
        "Continuação da leitura anual da rede e da receita",
    )

    y = draw_callout(
        c,
        H_MARGIN,
        y,
        PDF_W - 2 * H_MARGIN,
        "Fechamento da série histórica",
        "Nesta continuação, o foco é aprofundar a comparação entre os exercícios mais recentes e sustentar a conversa sobre evolução, estabilidade ou recuo da receita e da rede.",
        accent=BLUE,
        bg=SOFT_BLUE,
    ) - 14

    if len(historico) > 3:
        draw_list_block(
            c,
            H_MARGIN,
            y,
            col_w,
            f"Exercício {safe(historico[2].get('ano'))}",
            build_historical_year_detail(historico[2], historico[1]),
            accent=BLUE,
            bg=SOFT_BLUE,
            bullet_color=BLUE,
            max_items=8,
        )
        draw_list_block(
            c,
            H_MARGIN + col_w + col_gap,
            y,
            col_w,
            f"Exercício {safe(historico[3].get('ano'))}",
            build_historical_year_detail(historico[3], historico[2]),
            accent=ORANGE,
            bg=LIGHT_AMBER,
            bullet_color=ORANGE,
            max_items=8,
        )
    elif len(historico) > 2:
        draw_list_block(
            c,
            H_MARGIN,
            y,
            PDF_W - 2 * H_MARGIN,
            f"Exercício {safe(historico[2].get('ano'))}",
            build_historical_year_detail(historico[2], historico[1]),
            accent=BLUE,
            bg=SOFT_BLUE,
            bullet_color=BLUE,
            max_items=8,
        )

    draw_exec_footer(c, c._sync_page_number)
    c.showPage()
    c._sync_page_number += 1

    y = start_exec_page(c, c._sync_page_number, title, municipio_label)
    y = draw_section_heading(
        c,
        H_MARGIN,
        y,
        "5",
        "Benchmark de municípios comparáveis",
        "Comparação regional para reforçar a tese comercial",
    )

    y = draw_callout(
        c,
        H_MARGIN,
        y,
        PDF_W - 2 * H_MARGIN,
        "Por que este comparativo importa",
        safe((report.get("benchmarkRegional") or {}).get("resumo"), "Benchmark regional indisponível nesta rodada."),
        accent=ORANGE,
        bg=LIGHT_AMBER,
    ) - 14

    draw_list_block(
        c,
        H_MARGIN,
        y,
        PDF_W - 2 * H_MARGIN,
        "Municípios comparáveis",
        build_benchmark_lines(report),
        accent=ORANGE,
        bg=WHITE,
        bullet_color=ORANGE,
        max_items=8,
    )
    draw_exec_footer(c, c._sync_page_number)
    c.showPage()
    c._sync_page_number += 1

    y = start_exec_page(c, c._sync_page_number, title, municipio_label)
    y = draw_section_heading(
        c,
        H_MARGIN,
        y,
        "6",
        "Transporte, programas, incentivos e articulaÃ§Ã£o institucional",
        "Camadas que ajudam a mostrar maturidade da gestÃ£o educacional",
    )

    col_gap = 16
    col_w = (PDF_W - 2 * H_MARGIN - col_gap) / 2
    left_y = draw_callout(
        c,
        H_MARGIN,
        y,
        col_w,
        "Transporte Escolar",
        build_transport_message(report),
        accent=BLUE,
        bg=WHITE,
    ) - 12
    left_y = draw_callout(
        c,
        H_MARGIN,
        left_y,
        col_w,
        "ICMS-EducaÃ§Ã£o GoiÃ¡s",
        build_icms_message(report),
        accent=ORANGE,
        bg=LIGHT_AMBER,
    ) - 12

    right_y = draw_list_block(
        c,
        H_MARGIN + col_w + col_gap,
        y,
        col_w,
        "Programas e incentivos",
        build_program_lines(report),
        accent=GREEN,
        bg=LIGHT_GREEN,
        bullet_color=GREEN,
        max_items=4,
    ) - 12
    right_y = draw_callout(
        c,
        H_MARGIN + col_w + col_gap,
        right_y,
        col_w,
        "FormaÃ§Ã£o de servidores",
        summarize_text(find_item(report, "formacao_capacitacao").get("resposta"), max_sentences=3)
        or "NÃ£o foram localizadas evidÃªncias pÃºblicas suficientes sobre formaÃ§Ã£o e capacitaÃ§Ã£o do quadro nesta rodada.",
        accent=colors.HexColor("#9A6700"),
        bg=WHITE,
    ) - 12
    draw_list_block(
        c,
        H_MARGIN + col_w + col_gap,
        right_y,
        col_w,
        "Parcerias existentes",
        build_partnership_lines(report),
        accent=NAVY,
        bg=WHITE,
        bullet_color=BLUE,
        max_items=3,
    )
    draw_exec_footer(c, c._sync_page_number)
    c.showPage()
    c._sync_page_number += 1

    y = start_exec_page(c, c._sync_page_number, title, municipio_label)
    y = draw_section_heading(
        c,
        H_MARGIN,
        y,
        "7",
        "AnÃ¡lise do FUNDEB: o que foi perdido e como maximizar",
        "Ponto central da conversa com o gestor",
    )

    gap = 12
    resource_w = (PDF_W - 2 * H_MARGIN - (gap * 2)) / 3
    left_y = draw_resource_card(c, H_MARGIN, y, resource_w, "VAAF", find_item(report, "motivos_nao_captura_vaaf"))
    center_y = draw_resource_card(c, H_MARGIN + resource_w + gap, y, resource_w, "VAAT", find_item(report, "motivos_nao_captura_vaat"))
    right_y = draw_resource_card(c, H_MARGIN + ((resource_w + gap) * 2), y, resource_w, "VAAR", find_item(report, "motivos_nao_captura_vaar"))
    y = min(left_y, center_y, right_y) - 14

    principal = find_item(report, "perda_ou_nao_captura_recursos_fundeb")
    y = draw_callout(
        c,
        H_MARGIN,
        y,
        PDF_W - 2 * H_MARGIN,
        "Leitura consolidada para o gestor",
        summarize_text(principal.get("resposta"), max_sentences=4),
        accent=BLUE,
        bg=SOFT_BLUE,
    ) - 14

    col_gap = 16
    col_w = (PDF_W - 2 * H_MARGIN - col_gap) / 2
    draw_list_block(
        c,
        H_MARGIN,
        y,
        col_w,
        "Como recuperar ou maximizar",
        build_recovery_lines(report),
        accent=GREEN,
        bg=LIGHT_GREEN,
        bullet_color=GREEN,
        max_items=4,
    )
    draw_list_block(
        c,
        H_MARGIN + col_w + col_gap,
        y,
        col_w,
        "O que ainda precisa de validaÃ§Ã£o",
        build_validation_lines(report),
        accent=colors.HexColor("#B91C1C"),
        bg=LIGHT_RED,
        bullet_color=colors.HexColor("#B91C1C"),
        max_items=4,
    )
    draw_exec_footer(c, c._sync_page_number)
    c.showPage()
    c._sync_page_number += 1

    y = start_exec_page(c, c._sync_page_number, title, municipio_label)
    y = draw_section_heading(
        c,
        H_MARGIN,
        y,
        "8",
        "Proposta da Rocha Prime",
        "O que entregamos e como conduzimos a agenda tÃ©cnica",
    )

    y = draw_callout(
        c,
        H_MARGIN,
        y,
        PDF_W - 2 * H_MARGIN,
        "Tese comercial",
        build_company_closing(report),
        accent=NAVY,
        bg=SOFT_BLUE,
    ) - 16

    col_gap = 16
    col_w = (PDF_W - 2 * H_MARGIN - (col_gap * 2)) / 3
    left_y = draw_list_block(
        c,
        H_MARGIN,
        y,
        col_w,
        "Entregas",
        proposta.get("entregas") or ["Escopo em consolidacao nesta rodada."],
        accent=BLUE,
        bg=WHITE,
        bullet_color=BLUE,
        max_items=4,
    )
    center_y = draw_list_block(
        c,
        H_MARGIN + col_w + col_gap,
        y,
        col_w,
        "Etapas",
        proposta.get("etapas") or ["Roteiro em consolidacao nesta rodada."],
        accent=GREEN,
        bg=LIGHT_GREEN,
        bullet_color=GREEN,
        max_items=4,
    )
    right_y = draw_list_block(
        c,
        H_MARGIN + ((col_w + col_gap) * 2),
        y,
        col_w,
        "Diferenciais",
        proposta.get("diferenciais") or ["Diferenciais em consolidacao nesta rodada."],
        accent=ORANGE,
        bg=LIGHT_AMBER,
        bullet_color=ORANGE,
        max_items=4,
    )
    y = min(left_y, center_y, right_y) - 16

    draw_callout(
        c,
        H_MARGIN,
        y,
        PDF_W - 2 * H_MARGIN,
        "Fechamento de apresentaÃ§Ã£o",
        "A proposta deve ser apresentada como agenda de execuÃ§Ã£o: leitura tÃ©cnica, correÃ§Ãµes priorizadas, acompanhamento institucional e foco direto em recuperar, proteger e ampliar receita educacional com base real.",
        accent=colors.HexColor("#2D5DAF"),
        bg=WHITE,
    )
    draw_exec_footer(c, c._sync_page_number)
    c.save()
    return path


if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read().decode("utf-8-sig")
        if not raw.strip():
            sys.stderr.write("Empty input\n")
            sys.exit(1)
        payload = json.loads(raw)
        print(gerar_pdf_dirigido(payload), flush=True)
    except Exception as e:
        import traceback

        sys.stderr.write(f"ERROR: {e}\n{traceback.format_exc()}")
        sys.exit(1)

