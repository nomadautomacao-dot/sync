from __future__ import annotations

from pathlib import Path

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parent
ASSETS_DIR = ROOT / "assets"
LOGO_SMALL = ASSETS_DIR / "xref_10.png"
LOGO_MARK = ASSETS_DIR / "xref_17.png"

PAGE_W, PAGE_H = A4

NAVY = colors.HexColor("#1E2840")
BLUE = colors.HexColor("#2F73C8")
TEXT = colors.HexColor("#4B5563")
MUTED = colors.HexColor("#8A8F98")
LINE = colors.HexColor("#D9DDE5")
LIGHT_BLUE = colors.HexColor("#EAF4FF")
LIGHT_GREEN = colors.HexColor("#EDF8E9")
GREEN = colors.HexColor("#1FA05A")
ORANGE = colors.HexColor("#F6A63A")
WHITE = colors.white
SOFT_ROW = colors.HexColor("#F8FAFC")

MARGIN_X = 36
_LOGO_CACHE: dict[str, ImageReader] = {}


def register_fonts() -> None:
    import platform
    is_win = platform.system() == "Windows"

    # Windows fonts (primary)
    win_fonts = {
        "Heading": Path(r"C:\Windows\Fonts\bahnschrift.ttf"),
        "Body": Path(r"C:\Windows\Fonts\segoeui.ttf"),
        "BodyBold": Path(r"C:\Windows\Fonts\seguisb.ttf"),
    }
    # Linux fallback: Liberation Sans (widely available)
    linux_candidates = [
        Path("/usr/share/fonts/liberation-sans-fonts/LiberationSans-Regular.ttf"),
        Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
        Path("/usr/share/fonts/google-noto/NotoSans-Regular.ttf"),
    ]
    linux_bold_candidates = [
        Path("/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf"),
        Path("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
        Path("/usr/share/fonts/google-noto/NotoSans-Bold.ttf"),
    ]

    def find_font(candidates: list[Path]) -> Path | None:
        for p in candidates:
            if p.exists():
                return p
        return None

    if is_win:
        fonts = win_fonts
    else:
        regular = find_font(linux_candidates)
        bold = find_font(linux_bold_candidates)
        if not regular or not bold:
            # Absolute fallback: use Helvetica (built-in)
            return
        fonts = {
            "Heading": bold,
            "Body": regular,
            "BodyBold": bold,
        }

    for name, path in fonts.items():
        if name not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(name, str(path)))


def load_logo(path: Path) -> ImageReader | None:
    key = str(path)
    if key in _LOGO_CACHE:
        return _LOGO_CACHE[key]
    if not path.exists():
        return None
    img = Image.open(path).convert("RGBA")
    pixels = []
    for r, g, b, a in img.getdata():
        if max(r, g, b) < 90:
            pixels.append((255, 255, 255, 0))
        else:
            pixels.append((r, g, b, a))
    img.putdata(pixels)
    reader = ImageReader(img)
    _LOGO_CACHE[key] = reader
    return reader


def fmt_money(value: float) -> str:
    s = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def fmt_int(value: int) -> str:
    return f"{value:,}".replace(",", ".")


def fmt_pct(value: float) -> str:
    return f"{value:.2f}%".replace(".", ",")


def draw_paragraph(
    c: canvas.Canvas,
    text: str,
    x: float,
    top: float,
    width: float,
    *,
    font: str = "Body",
    size: float = 10,
    leading: float = 14,
    color=TEXT,
) -> float:
    style = ParagraphStyle(
        "p",
        fontName=font,
        fontSize=size,
        leading=leading,
        textColor=color,
    )
    p = Paragraph(text, style)
    _, height = p.wrap(width, PAGE_H)
    p.drawOn(c, x, top - height)
    return height


def round_rect(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill, stroke=None, radius: float = 8) -> None:
    c.saveState()
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1 if stroke else 0)
    c.restoreState()


def draw_cover(c: canvas.Canvas, title: str, subtitle: str, municipality: str, year_label: str) -> None:
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    logo = load_logo(LOGO_SMALL)
    if logo:
        c.drawImage(logo, (PAGE_W - 104) / 2, PAGE_H - 275, 104, 130, mask="auto")
    c.setFillColor(NAVY)
    c.setFont("Heading", 20)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 395, title)
    if subtitle:
        c.drawCentredString(PAGE_W / 2, PAGE_H - 425, subtitle)
    c.setFillColor(colors.HexColor("#666666"))
    c.setFont("BodyBold", 12.5)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 500, municipality)
    c.setFont("Body", 10)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 518, year_label)
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 9)
    c.drawCentredString(PAGE_W / 2, 88, "ROCHA PRIME SERVIÇOS ESPECIALIZADOS")
    c.setFillColor(MUTED)
    c.setFont("Body", 7.5)
    c.drawCentredString(PAGE_W / 2, 76, "Inteligência e Estratégia para Gestão Pública")


def draw_header(c: canvas.Canvas, title: str, subtitle: str | None = None, source: str | None = None, confidential: bool = True) -> None:
    logo = load_logo(LOGO_SMALL)
    if logo:
        c.drawImage(logo, MARGIN_X, PAGE_H - 86, 34, 42, mask="auto")
    left = MARGIN_X + 44
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 14)
    c.drawString(left, PAGE_H - 44, "ROCHA PRIME SERVIÇOS ESPECIALIZADOS")
    c.setFillColor(TEXT)
    c.setFont("Body", 6.5)
    c.drawString(left, PAGE_H - 54, "CNPJ: 29.342.691/0001-93  |  Tel: (61) 99866-7834")
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 12.5)
    c.drawString(left, PAGE_H - 72, title)
    if subtitle:
        c.setFillColor(TEXT)
        c.setFont("Body", 7)
        c.drawString(left, PAGE_H - 82, subtitle)
    if source:
        c.setFillColor(TEXT)
        c.setFont("Body", 7)
        c.drawString(left + 190, PAGE_H - 82, f"Fonte: {source}")
    if confidential:
        round_rect(c, left, PAGE_H - 101, 86, 15, ORANGE, radius=3)
        c.setFillColor(WHITE)
        c.setFont("BodyBold", 6.5)
        c.drawCentredString(left + 43, PAGE_H - 96, "DOCUMENTO CONFIDENCIAL")
    c.setStrokeColor(NAVY)
    c.setLineWidth(2)
    c.line(MARGIN_X, PAGE_H - 118, PAGE_W - MARGIN_X, PAGE_H - 118)


def draw_footer(c: canvas.Canvas) -> None:
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.line(MARGIN_X, 32, PAGE_W - MARGIN_X, 32)
    c.setFillColor(MUTED)
    c.setFont("BodyBold", 6)
    c.drawCentredString(PAGE_W / 2, 22, "Rocha Prime Serviços Especializados Ltda  |  CNPJ: 29.342.691/0001-93")
    c.setFont("Body", 5.7)
    c.drawCentredString(PAGE_W / 2, 14, "Este relatório é confidencial e destinado exclusivamente ao destinatário. Reprodução proibida sem autorização.")


def draw_section_title(c: canvas.Canvas, number: str, title: str, y: float) -> None:
    """Draw a styled section title with a navy badge containing the section number."""
    badge_w = max(24, len(number) * 10 + 12)
    badge_h = 18
    badge_y = y - 4
    # Badge background
    c.saveState()
    c.setFillColor(NAVY)
    c.setStrokeColor(NAVY)
    c.roundRect(MARGIN_X, badge_y, badge_w, badge_h, 4, fill=1, stroke=0)
    # Badge number
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 9)
    c.drawCentredString(MARGIN_X + badge_w / 2, badge_y + 5, str(number))
    c.restoreState()
    # Title text
    c.setFillColor(NAVY)
    c.setFont("BodyBold", 12)
    c.drawString(MARGIN_X + badge_w + 8, y, title)


def draw_kv_table(
    c: canvas.Canvas,
    x: float,
    y_top: float,
    w: float,
    headers: tuple[str, ...],
    rows: list[tuple[str, ...]],
    col_widths: list[float],
    *,
    row_h: float = 22,
    font_size: float = 8.2,
    highlight_last: bool = False,
    positive_cols: set[int] | None = None,
    center_cols: set[int] | None = None,
    left_cols: set[int] | None = None,
) -> float:
    positive_cols = positive_cols or set()
    center_cols = center_cols or set()
    left_cols = left_cols or set()
    y = y_top
    c.setFillColor(NAVY)
    c.rect(x, y - row_h, w, row_h, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("BodyBold", 7.5)
    cx = x
    for col_idx, (header, cw) in enumerate(zip(headers, col_widths)):
        if col_idx in center_cols:
            c.drawCentredString(cx + (cw / 2), y - 15, header)
        elif col_idx == 0 or col_idx in left_cols:
            c.drawString(cx + 6, y - 15, header)
        else:
            c.drawRightString(cx + cw - 6, y - 15, header)
        cx += cw
    y -= row_h
    for idx, row in enumerate(rows):
        fill = SOFT_ROW if idx % 2 else WHITE
        if highlight_last and idx == len(rows) - 1:
            fill = colors.HexColor("#ECEFF5")
        c.setFillColor(fill)
        c.rect(x, y - row_h, w, row_h, fill=1, stroke=0)
        cx = x
        for col_idx, (cell, cw) in enumerate(zip(row, col_widths)):
            if col_idx in positive_cols and str(cell).strip().startswith("+"):
                c.setFillColor(GREEN)
                c.setFont("BodyBold", font_size)
            else:
                c.setFillColor(TEXT if col_idx else colors.HexColor("#333333"))
                c.setFont("BodyBold" if highlight_last and idx == len(rows) - 1 else "Body", font_size)
            if col_idx == 0 or col_idx in left_cols:
                c.drawString(cx + 6, y - 14, str(cell))
            elif col_idx in center_cols:
                c.drawCentredString(cx + (cw / 2), y - 14, str(cell))
            else:
                c.drawRightString(cx + cw - 6, y - 14, str(cell))
            cx += cw
        y -= row_h
    return y


def draw_highlight_box(c: canvas.Canvas, x: float, y: float, w: float, h: float, title: str, main: str, secondary: str) -> None:
    round_rect(c, x, y, w, h, LIGHT_GREEN, radius=10)
    c.setFillColor(GREEN)
    c.rect(x, y, 4, h, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#7E8B73"))
    c.setFont("BodyBold", 10)
    c.drawString(x + 16, y + h - 22, title)
    c.setFillColor(GREEN)
    c.setFont("BodyBold", 24)
    c.drawString(x + 16, y + h - 48, main)
    c.setFillColor(colors.HexColor("#4F5B48"))
    c.setFont("Body", 10)
    c.drawString(x + 16, y + 14, secondary)
