import os
import shutil
import datetime
from gen_case_part1 import *
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor

def draw_header(c, pagenum=None):
    c.setFont("Inter", 10)
    c.setFillColor(NAVY)
    c.drawString(40, H - 40, "ROCHA PRIME SERVIÇOS ESPECIALIZADOS")
    c.setFont("Inter", 8)
    c.setFillColor(MUTED)
    c.drawString(40, H - 52, "Material executivo | Case de sucesso FUNDEB")
    try:
        c.drawImage(LOGO_PATH, W - 100, H - 60, width=60, height=30, preserveAspectRatio=True, mask='auto')
    except:
        pass

def draw_footer(c, pagenum):
    c.setFont("Inter", 6)
    c.setFillColor(MUTED)
    now_str = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
    c.drawString(40, 30, "Fontes: INEP 2024/2025, Portarias FUNDEB 2024-2026 e instrumentos oficiais da carteira.")
    c.drawRightString(W - 40, 30, f"{now_str}  |  {pagenum:02d}")

def cover_page(c):
    c.setFillColor(COVER_BG)
    c.rect(0, 0, W * 0.62, H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(W * 0.62, 0, W * 0.38, H, fill=1, stroke=0)
    
    c.setFillColor(NAVY)
    c.setFont("Inter", 24)
    c.drawString(40, H - 150, "APRESENTAÇÃO EXECUTIVA")
    c.drawString(40, H - 180, "Case de Sucesso Rocha Prime")
    
    c.setFont("Inter", 10)
    c.setFillColor(TEXT_COLOR)
    c.drawString(40, H - 220, "Quatro cidades, uma estratégia: reorganizar base, qualificar o Censo/FUNDEB e")
    c.drawString(40, H - 235, "ampliar a injeção de recursos na educação municipal.")
    
    c.setFillColor(CARD_BG)
    c.roundRect(40, H - 450, W * 0.5 - 40, 150, 10, fill=1, stroke=0)
    
    c.setFillColor(ORANGE)
    c.setFont("Inter", 20)
    c.drawString(60, H - 360, money(GANHO_ACUMULADO))
    c.setFont("Inter", 8)
    c.setFillColor(MUTED)
    c.drawString(60, H - 375, "de ganho acumulado em complementação entre 2024 e 2026")
    
    c.setFillColor(GREEN)
    c.setFont("Inter", 20)
    c.drawString(60, H - 420, money(CRESCIMENTO_FUNDEB))
    c.setFont("Inter", 8)
    c.setFillColor(MUTED)
    c.drawString(60, H - 435, "crescimento agregado do FUNDEB entre 2024 e 2026")
    
    c.setFillColor(WHITE)
    c.setFont("Inter", 10)
    c.drawString(W * 0.62 + 40, H - 150, "BAHIA | 2024-2026")
    
    c.setFont("Inter", 32)
    c.drawString(W * 0.62 + 40, H - 250, "4 cidades")
    
    c.setFont("Inter", 10)
    c.setFillColor(LIGHT_BLUE_TEXT)
    c.drawString(W * 0.62 + 40, H - 280, "Sítio do Mato, Coribe,")
    c.drawString(W * 0.62 + 40, H - 295, "São Félix do Coribe e")
    c.drawString(W * 0.62 + 40, H - 310, "São Desidério")
    
    c.showPage()

def view_page(c):
    draw_header(c)
    c.setFillColor(NAVY)
    c.setFont("Inter", 20)
    c.drawString(40, H - 100, "Visão Geral")
    c.setFont("Inter", 10)
    c.setFillColor(MUTED)
    c.drawString(40, H - 120, "Impacto consolidado do portfólio")
    
    y = H - 200
    for m in MUNICIPIOS:
        c.setFillColor(NAVY)
        c.setFont("Inter", 14)
        c.drawString(40, y, m['nome'])
        c.setFont("Inter", 10)
        c.setFillColor(TEXT_COLOR)
        c.drawString(40, y - 20, f"Ganho Comp.: {money(m['anos'][2026]['comp'] - m['anos'][2024]['comp'])}")
        c.setFont("Inter", 8)
        c.setFillColor(MUTED)
        c.drawString(40, y - 40, m['leitura'][:120] + "...")
        y -= 100
        
    draw_footer(c, 2)
    c.showPage()

def muni_page(c, m, pagenum):
    draw_header(c)
    c.setFillColor(NAVY)
    c.setFont("Inter", 20)
    c.drawString(40, H - 100, m['nome'])
    c.setFont("Inter", 10)
    c.setFillColor(MUTED)
    c.drawString(40, H - 120, m['tag'])
    
    c.setFillColor(TEXT_COLOR)
    c.setFont("Inter", 10)
    y = H - 180
    for s in m['servicos']:
        c.drawString(50, y, f"• {s}")
        y -= 20
        
    y -= 40
    c.setFont("Inter", 12)
    c.setFillColor(NAVY)
    c.drawString(40, y, "Evolução")
    
    y -= 40
    for ano in [2024, 2025, 2026]:
        data = m['anos'][ano]
        c.setFont("Inter", 10)
        c.setFillColor(TEXT_COLOR)
        c.drawString(40, y, f"{ano} - Comp: {money(data['comp'])} | VAAF: {money(data['vaaf'])} | VAAT: {money(data['vaat'])} | VAAR: {money(data['vaar'])}")
        y -= 20
    
    draw_footer(c, pagenum)
    c.showPage()

def pdf_main():
    c = canvas.Canvas(OUTPUT, pagesize=A4)
    cover_page(c)
    view_page(c)
    
    pagenum = 3
    for m in MUNICIPIOS:
        muni_page(c, m, pagenum)
        pagenum += 1
        
    c.save()
    shutil.copyfile(OUTPUT, OUTPUT2)
    print(f"Generated {OUTPUT2}")

if __name__ == '__main__':
    pdf_main()
