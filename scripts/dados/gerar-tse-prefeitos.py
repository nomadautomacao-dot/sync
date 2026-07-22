#!/usr/bin/env python3
"""
Gerador: data/tse-prefeitos-2024.json
Fonte: TSE Dados Abertos - consulta_cand_2024.zip
URL: https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip

Baixa o ZIP nacional, extrai os CSVs por UF, filtra apenas prefeitos eleitos,
cruza com IBGE para obter o codigo de 7 digitos e salva JSON indexado por IBGE.

Uso: python scripts/gerar-tse-prefeitos.py
"""

import csv
import gzip
import io
import json
import urllib.request
import unicodedata
import zipfile
from pathlib import Path

OUTPUT_PATH = Path(__file__).parent.parent / "data" / "tse-prefeitos-2024.json"
TMP_ZIP = Path("C:/tmp/consulta_cand_2024.zip")

TSE_ZIP_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip"
IBGE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
MANUAL_IBGE_CODES = {
    "BOA ESPERANCA DO NORTE-MT": "5101837",
}
MUNICIPIO_ALIASES = {
    "ALVORADA DO OESTE-RO": "ALVORADA D OESTE-RO",
    "AMPARO DE SAO FRANCISCO-SE": "AMPARO DO SAO FRANCISCO-SE",
    "AREZ-RN": "ARES-RN",
    "ASSU-RN": "ACU-RN",
    "BARAO DE MONTE ALTO-MG": "BARAO DO MONTE ALTO-MG",
    "BOA SAUDE-RN": "JANUARIO CICCO-RN",
    "DONA EUSEBIA-MG": "DONA EUZEBIA-MG",
    "ELDORADO DOS CARAJAS-PA": "ELDORADO DO CARAJAS-PA",
    "ESPIGAO DO OESTE-RO": "ESPIGAO D OESTE-RO",
    "SANTA ISABEL DO PARA-PA": "SANTA IZABEL DO PARA-PA",
    "SANTO ANTONIO DO LEVERGER-MT": "SANTO ANTONIO DE LEVERGER-MT",
    "SAO LUIS DO PARAITINGA-SP": "SAO LUIZ DO PARAITINGA-SP",
    "SAO THOME DAS LETRAS-MG": "SAO TOME DAS LETRAS-MG",
}


def normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFD", str(value)).encode("ascii", "ignore").decode("ascii").upper()
    for token in ("'", "`", "´", "-", ".", ",", "/"):
        normalized = normalized.replace(token, " ")
    return " ".join(normalized.split()).strip()


def title_case(value: str) -> str:
    lower_words = {"de", "da", "do", "das", "dos", "e", "em", "o", "a", "os", "as", "na", "no", "nas", "nos"}
    words = str(value).strip().lower().split()
    return " ".join(
        word.capitalize() if (index == 0 or word not in lower_words) else word
        for index, word in enumerate(words)
    )


def fetch_ibge_lookup() -> dict[str, str]:
    print("Baixando base do IBGE...")
    request = urllib.request.Request(
        IBGE_URL,
        headers={
            "User-Agent": "Sync/1.0",
            "Accept-Encoding": "gzip, deflate",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
        if "gzip" in response.headers.get("Content-Encoding", ""):
            raw = gzip.decompress(raw)

    municipios = json.loads(raw.decode("utf-8"))
    lookup: dict[str, str] = {}
    for municipio in municipios:
        ibge_id = str(municipio["id"]).zfill(7)
        nome = normalize(municipio["nome"])
        uf = (
            (municipio.get("microrregiao") or {}).get("mesorregiao", {}).get("UF", {}).get("sigla", "")
            or (municipio.get("regiao-imediata") or {})
            .get("regiao-intermediaria", {})
            .get("UF", {})
            .get("sigla", "")
        )
        lookup[f"{nome}-{uf}"] = ibge_id

    print(f"  {len(lookup)} municipios carregados.")
    return lookup


def download_tse_zip() -> bytes:
    if TMP_ZIP.exists() and TMP_ZIP.stat().st_size > 100_000:
        print(f"Usando cache: {TMP_ZIP}")
        return TMP_ZIP.read_bytes()

    print(f"Baixando ZIP do TSE ({TSE_ZIP_URL})...")
    TMP_ZIP.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(TSE_ZIP_URL, headers={"User-Agent": "Sync/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read()
    TMP_ZIP.write_bytes(data)
    print(f"  Download concluido: {len(data) / 1024 / 1024:.1f} MB")
    return data


def parse_tse_zip(zip_bytes: bytes) -> list[dict]:
    rows: list[dict] = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zip_file:
        csv_names = [name for name in zip_file.namelist() if name.endswith(".csv") and "consulta_cand_2024" in name]
        print(f"  Arquivos CSV no ZIP: {len(csv_names)}")
        for csv_name in csv_names:
            with zip_file.open(csv_name) as raw_file:
                raw = raw_file.read().decode("latin-1", errors="replace")
                reader = csv.DictReader(io.StringIO(raw), delimiter=";")
                rows.extend(reader)
    print(f"  Total de candidatos lidos: {len(rows)}")
    return rows


def is_prefeito_eleito(row: dict) -> bool:
    cargo = normalize(row.get("DS_CARGO", ""))
    situacao = normalize(row.get("DS_SIT_TOT_TURNO", ""))
    return cargo == "PREFEITO" and situacao == "ELEITO"


def build_record(row: dict) -> dict | None:
    nome_urna = (row.get("NM_URNA_CANDIDATO") or "").strip()
    nome_completo = (row.get("NM_CANDIDATO") or "").strip()
    partido = (row.get("SG_PARTIDO") or "").strip().upper()
    municipio = (row.get("NM_UE") or "").strip()
    uf = (row.get("SG_UF") or "").strip().upper()
    codigo_municipio_tse = (row.get("SG_UE") or "").strip()

    if not municipio or not uf or not partido or not nome_completo:
        return None

    nome_completo_formatado = title_case(nome_completo)
    nome_urna_formatado = title_case(nome_urna) if nome_urna else nome_completo_formatado

    return {
        "municipio": title_case(municipio),
        "uf": uf,
        "prefeito": nome_completo_formatado,
        "nomeUrna": nome_urna_formatado,
        "partido": partido,
        "nomeCompleto": nome_completo_formatado,
        "codigoMunicipioTSE": codigo_municipio_tse,
        "eleicao": "2024",
    }


def resolve_ibge(municipio: str, uf: str, lookup: dict[str, str]) -> str | None:
    exact_key = f"{normalize(municipio)}-{normalize(uf)}"
    if exact_key in MANUAL_IBGE_CODES:
        return MANUAL_IBGE_CODES[exact_key]
    if exact_key in lookup:
        return lookup[exact_key]

    alias_key = MUNICIPIO_ALIASES.get(exact_key)
    if alias_key and alias_key in lookup:
        return lookup[alias_key]

    prefix = normalize(municipio)
    suffix = f"-{normalize(uf)}"
    for key, value in lookup.items():
        if key.endswith(suffix) and prefix in key:
            return value
    return None


def main() -> None:
    ibge_lookup = fetch_ibge_lookup()
    zip_bytes = download_tse_zip()
    rows = parse_tse_zip(zip_bytes)

    result: dict[str, dict] = {}
    sem_ibge: set[str] = set()
    total_prefeitos = 0

    for row in rows:
        if not is_prefeito_eleito(row):
            continue
        record = build_record(row)
        if not record:
            continue

        total_prefeitos += 1
        codigo_ibge = resolve_ibge(record["municipio"], record["uf"], ibge_lookup)
        if codigo_ibge:
            result[codigo_ibge] = record
        else:
            sem_ibge.add(f'{record["municipio"]}/{record["uf"]}')

    sem_ibge_preview = sorted(sem_ibge)
    print(f"\nPrefeitos eleitos encontrados: {total_prefeitos}")
    print(f"Mapeados com IBGE:             {len(result)}")
    print(f"Sem IBGE ({len(sem_ibge_preview)}):    {', '.join(sem_ibge_preview[:10])}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"\nArquivo gerado: {OUTPUT_PATH}")
    print(f"  Tamanho: {size_kb:.0f} KB  |  Municipios: {len(result)}")


if __name__ == "__main__":
    main()
