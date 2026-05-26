#!/usr/bin/env python3
"""
Re-fetch IDEB focusing on missing municipalities.
Uses dep=5 (pública) first, then dep=3 (municipal) as fallback.
"""
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

TOKEN = "Y4sNPKOrhVZIlsq4cmYOfT9u1VZG60yUv2HF9lpR"
YEARS = [2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023]


def fetch_one(ibge: str, year: int) -> tuple:
    url = f"https://api.qedu.org.br/v1/ideb?id={ibge}&ano={year}"
    try:
        result = subprocess.run(
            ["curl", "-sk", "--max-time", "20", "-H", f"Authorization: Bearer {TOKEN}", url],
            capture_output=True, text=True, timeout=25,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return (ibge, year, None)
        data = json.loads(result.stdout)
        items = data.get("data", [])
        if not items:
            return (ibge, year, None)

        out = {}
        # Try dep=5 first, fallback to dep=3
        for target_dep in [5, 3]:
            for item in items:
                if item.get("dependencia_id") != target_dep:
                    continue
                ciclo = item.get("ciclo_id", "")
                if ciclo not in ("AI", "AF"):
                    continue
                key = ciclo.lower()
                if key in out:
                    continue
                entry = {}
                ideb_val = item.get("ideb")
                proj_val = item.get("ideb_projetado")
                if ideb_val:
                    try:
                        entry["v"] = round(float(str(ideb_val).replace(",", ".")), 1)
                    except ValueError:
                        pass
                if proj_val:
                    try:
                        entry["p"] = round(float(str(proj_val).replace(",", ".")), 1)
                    except ValueError:
                        pass
                if entry:
                    out[key] = entry
        return (ibge, year, out if out else None)
    except Exception:
        return (ibge, year, None)


def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    censo_path = os.path.join(base_dir, "assets", "censo_matriculas.json")
    output_path = os.path.join(base_dir, "assets", "ideb_historico.json")

    # Load existing data
    existing = {}
    if os.path.exists(output_path):
        with open(output_path) as f:
            existing = json.load(f)
        print(f"Existing IDEB data: {len(existing)} municipalities")

    with open(censo_path) as f:
        censo = json.load(f)
    all_ibge = sorted(set(code for yd in censo.values() for code in yd.keys()))

    # Only fetch missing
    missing = [ibge for ibge in all_ibge if ibge not in existing]
    print(f"Missing municipalities: {len(missing)}")

    if not missing:
        print("All done!")
        return

    total_requests = len(missing) * len(YEARS)
    print(f"Requests needed: {total_requests}")

    tasks = [(ibge, year) for ibge in missing for year in YEARS]
    done = 0
    start = time.time()

    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(fetch_one, ibge, year): (ibge, year) for ibge, year in tasks}
        for future in as_completed(futures):
            ibge, year, data = future.result()
            done += 1
            if data:
                if ibge not in existing:
                    existing[ibge] = {}
                existing[ibge][str(year)] = data
            if done % 1000 == 0:
                elapsed = time.time() - start
                rate = done / elapsed if elapsed > 0 else 0
                remaining = (total_requests - done) / rate if rate > 0 else 0
                print(f"  {done}/{total_requests} ({done*100//total_requests}%) - {len(existing)} cities - ETA: {remaining/60:.1f}min")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(output_path) / 1024
    print(f"\nSaved: {size_kb:.0f} KB, {len(existing)} municipalities")

    for city, code in [("Aracaju", "2800308"), ("Carambeí", "4104204")]:
        d = existing.get(code, {})
        print(f"\n  {city} ({code}):")
        for y in YEARS:
            yd = d.get(str(y), {})
            ai = yd.get("ai", {})
            af = yd.get("af", {})
            print(f"    {y}: AI={ai.get('v','-')}/{ai.get('p','-')}  AF={af.get('v','-')}/{af.get('p','-')}")


if __name__ == "__main__":
    main()
