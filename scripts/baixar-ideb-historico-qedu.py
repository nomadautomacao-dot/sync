#!/usr/bin/env python3
"""
Script: Baixar série histórica IDEB municipal via QEdu API (paralelo)
Gera: data/ideb-municipal-historico-municipios.json

Usage: python3 scripts/baixar-ideb-historico-qedu.py [codigoIBGE ...]
"""
import json
import sys
import ssl
import urllib.request
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
JSON_2023 = DATA_DIR / "ideb-municipal-2023.json"
JSON_OUT = DATA_DIR / "ideb-municipal-historico-municipios.json"

QEDU_TOKEN = None
env_file = BASE_DIR / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if line.startswith("QEDU_TOKEN="):
            QEDU_TOKEN = line.split("=", 1)[1].strip().strip('"').strip("'")
            break

if not QEDU_TOKEN:
    print("ERRO: QEDU_TOKEN não encontrado no .env")
    sys.exit(1)

YEARS = [2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019]
BASE_URL = "https://api.qedu.org.br/v1"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_all_years(codigo_ibge):
    """Fetch IDEB for all years for a single municipality."""
    entry = {"anosIniciais": [], "anosFinais": []}
    for ano in YEARS:
        url = f"{BASE_URL}/ideb?id={codigo_ibge}&ano={ano}"
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {QEDU_TOKEN}",
            "Accept": "application/json",
            "User-Agent": "Sync/1.0",
        })
        try:
            resp = urllib.request.urlopen(req, timeout=15, context=ctx)
            data = json.loads(resp.read())
            items = data if isinstance(data, list) else data.get("data", [])
            ai, af = None, None
            for item in items:
                ciclo = item.get("ciclo_id", "")
                dep = item.get("dependencia_id", 0)
                ideb_val = item.get("ideb")
                if dep in (3, 5) and ideb_val is not None and str(ideb_val) != "None":
                    try:
                        val = round(float(ideb_val), 1)
                    except (ValueError, TypeError):
                        continue
                    if ciclo == "AI" and (ai is None or dep == 3):
                        ai = val
                    elif ciclo == "AF" and (af is None or dep == 3):
                        af = val
            if ai is not None:
                entry["anosIniciais"].append({"ano": ano, "ideb": ai})
            if af is not None:
                entry["anosFinais"].append({"ano": ano, "ideb": af})
        except Exception:
            pass
        time.sleep(0.02)
    return codigo_ibge, entry

def main():
    if JSON_OUT.exists():
        with open(JSON_OUT, "r") as f:
            historico = json.load(f)
    else:
        historico = {}

    if len(sys.argv) > 1:
        codigos = sys.argv[1:]
    else:
        with open(JSON_2023, "r") as f:
            dataset_2023 = json.load(f)
        codigos = list(dataset_2023.keys())

    # Skip already fetched
    pending = [c for c in codigos if c not in historico or not historico[c].get("anosIniciais")]
    total = len(pending)
    already = len(codigos) - total
    
    print(f"Total municípios: {len(codigos)}")
    print(f"Já baixados: {already}")
    print(f"Pendentes: {total}")
    print(f"Workers: 10 (paralelo)")
    print(f"Output: {JSON_OUT}")
    print()

    if total == 0:
        print("Nada a fazer!")
        return

    done = 0
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_all_years, codigo): codigo for codigo in pending}
        for future in as_completed(futures):
            codigo, entry = future.result()
            historico[codigo] = entry
            done += 1
            if done % 100 == 0 or done == total:
                with open(JSON_OUT, "w") as f:
                    json.dump(historico, f, ensure_ascii=False)
                n_with = sum(1 for v in historico.values() if v.get("anosIniciais"))
                print(f"  [{done}/{total}] Salvo. {n_with}/{len(historico)} com dados.")

    # Final save
    with open(JSON_OUT, "w") as f:
        json.dump(historico, f, ensure_ascii=False, indent=2)

    n_with = sum(1 for v in historico.values() if v.get("anosIniciais"))
    print(f"\nConcluído! {n_with}/{len(historico)} municípios com dados históricos.")

    if "5200258" in historico:
        ai = len(historico["5200258"].get("anosIniciais", []))
        af = len(historico["5200258"].get("anosFinais", []))
        print(f"Amostra Águas Lindas: AI={ai} anos, AF={af} anos")

if __name__ == "__main__":
    main()
