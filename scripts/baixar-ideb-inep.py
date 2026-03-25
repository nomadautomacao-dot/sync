import re
import urllib.request
import os
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Parse the HTML we downloaded
html_path = BASE_DIR / "ideb.html"
with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

# Find the exact .xlsx or .zip links. The INEP site uses data-link or href.
links = re.findall(r'href=[\'"](https://download.inep.gov.br/[^"\'<>]+)[\'"]', html)
excel_links = [l for l in links if 'municipios_2023.xlsx' in l.lower() or 'municipios_2023_atualizado' in l.lower()]
zip_links = [l for l in links if '.zip' in l.lower() and ('ideb' in l.lower() or 'resultado' in l.lower())]

print("Links extraídos:")
for link in excel_links:
    print(link)

for link in zip_links:
    print(link)

# Fallback se não encontrar
if not excel_links and not zip_links:
    excel_links = [
        "https://download.inep.gov.br/ideb/resultados/divulgacao_anos_iniciais_municipios_2023.xlsx",
        "https://download.inep.gov.br/ideb/resultados/divulgacao_anos_finais_municipios_2023.xlsx"
    ]

# We are interested in anos_iniciais and anos_finais .xlsx
targets = []
for l in excel_links:
    if 'anos_iniciais' in l.lower() or 'anos_finais' in l.lower():
        targets.append(l)

targets = list(set(targets))

if not targets:
    # If INEP uses a ZIP file instead:
    try_zip = next((z for z in zip_links if 'resultados_ideb' in z.lower() or 'microdados' in z.lower() or '2023' in z.lower()), None)
    if try_zip:
        print(f"Planilhas não encontradas diretamente, baixando arquivo ZIP principal... {try_zip}")
        # Simplificando, tentaremos os links diretos primeiro, mesmo que não estejam na pág. principal.

URLS = targets if targets else [
    "https://download.inep.gov.br/ideb/resultados/divulgacao_anos_iniciais_municipios_2023.xlsx",
    "https://download.inep.gov.br/ideb/resultados/divulgacao_anos_finais_municipios_2023.xlsx"
]

for url in URLS:
    filename = url.split('/')[-1]
    filepath = DATA_DIR / filename
    if filepath.exists():
        print(f"[OK] Arquivo já existe: {filename}")
        continue
        
    print(f"Baixando: {url}")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            with open(filepath, 'wb') as f:
                f.write(response.read())
        print(f"[OK] Salvo como {filename}")
    except Exception as e:
        print(f"[ERRO] Falha ao baixar {filename}: {e}")

print("\nExecutando script de importação do IDEB...")
script_import = BASE_DIR / "scripts" / "importar-ideb-inep.py"
result = subprocess.run([sys.executable, str(script_import)], capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print(f"Erros na importação:\n{result.stderr}")
