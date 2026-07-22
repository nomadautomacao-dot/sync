from __future__ import annotations

import csv
import io
import json
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
PUBLIC_DEPENDENCIAS = {"1", "2", "3"}
ACESSIBILIDADE_FIELDS = (
    "IN_ACESSIBILIDADE_CORRIMAO",
    "IN_ACESSIBILIDADE_ELEVADOR",
    "IN_ACESSIBILIDADE_PISOS_TATEIS",
    "IN_ACESSIBILIDADE_VAO_LIVRE",
    "IN_ACESSIBILIDADE_RAMPAS",
    "IN_ACESSIBILIDADE_SINAL_SONORO",
    "IN_ACESSIBILIDADE_SINAL_TATIL",
    "IN_ACESSIBILIDADE_SINAL_VISUAL",
    "IN_ACESSIBILIDADE_SINALIZACAO",
)
INFRA_POSITIVE_FIELDS = (
    "escolasComAguaPotavel",
    "escolasComEsgoto",
    "escolasComCozinha",
    "escolasComInternet",
    "escolasComBandaLarga",
    "escolasComLaboratorioInformatica",
    "escolasComLaboratorioCiencias",
    "escolasComQuadra",
    "escolasComAlimentacao",
    "escolasComAcessibilidade",
)
INFRA_NEGATIVE_FIELDS = (
    "escolasSemAgua",
    "escolasSemEsgoto",
    "escolasSemCozinha",
    "escolasSemAcessibilidade",
)
INFRA_PCT_FIELDS = {
    "escolasComAguaPotavel": "escolasComAguaPotavelPct",
    "escolasComEsgoto": "escolasComEsgotoPct",
    "escolasComCozinha": "escolasComCozinhaPct",
    "escolasComInternet": "escolasComInternetPct",
    "escolasComBandaLarga": "escolasComBandaLargaPct",
    "escolasComLaboratorioInformatica": "escolasComLaboratorioInformaticaPct",
    "escolasComLaboratorioCiencias": "escolasComLaboratorioCienciasPct",
    "escolasComQuadra": "escolasComQuadraPct",
    "escolasComAlimentacao": "escolasComAlimentacaoPct",
    "escolasComAcessibilidade": "escolasComAcessibilidadePct",
    "escolasSemAgua": "escolasSemAguaPct",
    "escolasSemEsgoto": "escolasSemEsgotoPct",
    "escolasSemCozinha": "escolasSemCozinhaPct",
    "escolasSemAcessibilidade": "escolasSemAcessibilidadePct",
}
JsonScalar = int | float | str | None


def load_shared_strings(zip_file: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(zip_file.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for si in root.findall("x:si", NS):
        text = "".join(node.text or "" for node in si.iterfind(".//x:t", NS))
        values.append(text)
    return values


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    value = cell.find("x:v", NS)
    if value is None:
        return ""
    raw = value.text or ""
    return shared_strings[int(raw)] if cell_type == "s" else raw


def ref_to_index(ref: str) -> int:
    letters = "".join(ch for ch in ref if ch.isalpha())
    index = 0
    for ch in letters:
        index = index * 26 + (ord(ch.upper()) - 64)
    return index - 1


def read_rows(zip_file: zipfile.ZipFile, shared_strings: list[str], sheet_path: str) -> list[dict[int, str]]:
    root = ET.fromstring(zip_file.read(sheet_path))
    sheet_data = root.find("x:sheetData", NS)
    if sheet_data is None:
        return []

    rows: list[dict[int, str]] = []
    for row in sheet_data:
        parsed: dict[int, str] = {}
        for cell in row.findall("x:c", NS):
            parsed[ref_to_index(cell.attrib["r"])] = cell_value(cell, shared_strings)
        rows.append(parsed)
    return rows


def workbook_has_sheet(zip_file: zipfile.ZipFile, sheet_path: str) -> bool:
    try:
        zip_file.getinfo(sheet_path)
        return True
    except KeyError:
        return False


def to_int(value: str) -> int:
    if value in ("", None):
        return 0
    return int(float(value))


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value or "")
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn").lower().strip()


def sum_columns(row: dict[int, str], *indexes: int) -> int:
    return sum(to_int(row.get(index, "")) for index in indexes)


def load_workbook_sheet_map(zip_file: zipfile.ZipFile) -> dict[str, str]:
    workbook_root = ET.fromstring(zip_file.read("xl/workbook.xml"))
    rels_root = ET.fromstring(zip_file.read("xl/_rels/workbook.xml.rels"))
    rel_map = {
        relation.attrib["Id"]: f"xl/{relation.attrib['Target'].lstrip('/')}"
        for relation in rels_root
    }

    mapping: dict[str, str] = {}
    sheets = workbook_root.find("x:sheets", NS)
    if sheets is None:
        return mapping

    for sheet in sheets:
        rel_id = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        name = sheet.attrib.get("name", "")
        if rel_id and rel_id in rel_map:
            mapping[name] = rel_map[rel_id]
    return mapping


def find_sheet_path(sheet_map: dict[str, str], *patterns: str) -> str:
    normalized_patterns = tuple(normalize_text(pattern) for pattern in patterns)
    for name, path in sheet_map.items():
        normalized_name = normalize_text(name)
        if all(pattern in normalized_name for pattern in normalized_patterns):
            return path
    raise KeyError(f"Nao foi possivel localizar a aba com padroes: {patterns!r}")


def read_2025_location_metrics(row: dict[int, str]) -> tuple[int, int, int]:
    return to_int(row.get(4, "")), to_int(row.get(5, "")), to_int(row.get(8, ""))


def read_2024_location_metrics(row: dict[int, str]) -> tuple[int, int, int]:
    return (
        to_int(row.get(4, "")),
        sum_columns(row, 6, 7, 8, 11, 12, 13),
        to_int(row.get(8, "")) + to_int(row.get(13, "")),
    )


def read_2025_integral_metrics(row: dict[int, str]) -> tuple[int, int, int]:
    return to_int(row.get(5, "")), to_int(row.get(6, "")), to_int(row.get(9, ""))


def read_2024_integral_metrics(row: dict[int, str]) -> tuple[int, int, int]:
    return to_int(row.get(5, "")), sum_columns(row, 6, 7, 8), to_int(row.get(8, ""))


def apply_stage_metrics(
    entry: dict[str, JsonScalar],
    prefix: str,
    total: int,
    publica: int,
    municipal: int,
) -> None:
    entry[f"{prefix}Total"] = total
    entry[f"{prefix}Publica"] = publica
    entry[f"{prefix}Municipal"] = municipal


def apply_integral_metrics(
    entry: dict[str, JsonScalar],
    prefix: str,
    total: int,
    publica: int,
    municipal: int,
) -> None:
    entry[f"tempoIntegral{prefix}Total"] = total
    entry[f"tempoIntegral{prefix}Publica"] = publica
    entry[f"tempoIntegral{prefix}Municipal"] = municipal


def create_base_entry(code: str, municipio: str, uf: str) -> dict[str, JsonScalar]:
    return {
        "codigoIBGE": code,
        "municipio": municipio,
        "uf": uf,
        "matriculasBasicaTotal": 0,
        "matriculasPublicasTotal": 0,
        "matriculasMunicipaisTotal": 0,
        "educacaoInfantilTotal": 0,
        "educacaoInfantilPublica": 0,
        "educacaoInfantilMunicipal": 0,
        "crecheTotal": 0,
        "crechePublica": 0,
        "crecheMunicipal": 0,
        "preEscolaTotal": 0,
        "preEscolaPublica": 0,
        "preEscolaMunicipal": 0,
        "anosIniciaisFundamentalTotal": 0,
        "anosIniciaisFundamentalPublica": 0,
        "anosIniciaisFundamentalMunicipal": 0,
        "anosFinaisFundamentalTotal": 0,
        "anosFinaisFundamentalPublica": 0,
        "anosFinaisFundamentalMunicipal": 0,
        "ensinoFundamentalTotal": 0,
        "ensinoFundamentalPublica": 0,
        "ensinoFundamentalMunicipal": 0,
        "ensinoMedioTotal": 0,
        "ensinoMedioPublica": 0,
        "ensinoMedioMunicipal": 0,
        "ejaTotal": 0,
        "ejaPublica": 0,
        "ejaMunicipal": 0,
        "educacaoEspecialTotal": 0,
        "educacaoEspecialPublica": 0,
        "educacaoEspecialMunicipal": 0,
        "docentesTotal": 0,
        "docentesPublicosTotal": 0,
        "docentesMunicipaisTotal": 0,
        "escolasTotal": 0,
        "escolasPublicasTotal": 0,
        "escolasMunicipaisTotal": 0,
        "tempoIntegralBasicaTotal": None,
        "tempoIntegralBasicaPublica": None,
        "tempoIntegralBasicaMunicipal": None,
        "tempoIntegralEducacaoInfantilTotal": 0,
        "tempoIntegralEducacaoInfantilPublica": 0,
        "tempoIntegralEducacaoInfantilMunicipal": 0,
        "tempoIntegralCrecheTotal": 0,
        "tempoIntegralCrechePublica": 0,
        "tempoIntegralCrecheMunicipal": 0,
        "tempoIntegralPreEscolaTotal": 0,
        "tempoIntegralPreEscolaPublica": 0,
        "tempoIntegralPreEscolaMunicipal": 0,
        "tempoIntegralAnosIniciaisTotal": 0,
        "tempoIntegralAnosIniciaisPublica": 0,
        "tempoIntegralAnosIniciaisMunicipal": 0,
        "tempoIntegralAnosFinaisTotal": 0,
        "tempoIntegralAnosFinaisPublica": 0,
        "tempoIntegralAnosFinaisMunicipal": 0,
        "tempoIntegralEnsinoFundamentalTotal": 0,
        "tempoIntegralEnsinoFundamentalPublica": 0,
        "tempoIntegralEnsinoFundamentalMunicipal": 0,
        "tempoIntegralEnsinoMedioTotal": 0,
        "tempoIntegralEnsinoMedioPublica": 0,
        "tempoIntegralEnsinoMedioMunicipal": 0,
        "tempoIntegralEjaTotal": None,
        "tempoIntegralEjaPublica": None,
        "tempoIntegralEjaMunicipal": None,
        "tempoIntegralEducacaoEspecialTotal": 0,
        "tempoIntegralEducacaoEspecialPublica": 0,
        "tempoIntegralEducacaoEspecialMunicipal": 0,
        "escolasInfraPublicasTotal": 0,
        "escolasComAguaPotavel": 0,
        "escolasComAguaPotavelPct": 0.0,
        "escolasSemAgua": 0,
        "escolasSemAguaPct": 0.0,
        "escolasComEsgoto": 0,
        "escolasComEsgotoPct": 0.0,
        "escolasSemEsgoto": 0,
        "escolasSemEsgotoPct": 0.0,
        "escolasComCozinha": 0,
        "escolasComCozinhaPct": 0.0,
        "escolasSemCozinha": 0,
        "escolasSemCozinhaPct": 0.0,
        "escolasComInternet": 0,
        "escolasComInternetPct": 0.0,
        "escolasComBandaLarga": 0,
        "escolasComBandaLargaPct": 0.0,
        "escolasComLaboratorioInformatica": 0,
        "escolasComLaboratorioInformaticaPct": 0.0,
        "escolasComLaboratorioCiencias": 0,
        "escolasComLaboratorioCienciasPct": 0.0,
        "escolasComQuadra": 0,
        "escolasComQuadraPct": 0.0,
        "escolasComAlimentacao": 0,
        "escolasComAlimentacaoPct": 0.0,
        "escolasComAcessibilidade": 0,
        "escolasComAcessibilidadePct": 0.0,
        "escolasSemAcessibilidade": 0,
        "escolasSemAcessibilidadePct": 0.0,
    }


def ensure_named_entry(
    dataset: dict[str, dict[str, JsonScalar]],
    code: str,
    municipio: str,
    uf: str,
) -> dict[str, JsonScalar]:
    entry = dataset.setdefault(
        code,
        create_base_entry(code, municipio, uf),
    )
    if not entry.get("municipio") and municipio:
        entry["municipio"] = municipio
    if not entry.get("uf") and uf:
        entry["uf"] = uf
    return entry


def ensure_entry(dataset: dict[str, dict[str, JsonScalar]], code: str, row: dict[int, str]) -> dict[str, JsonScalar]:
    return ensure_named_entry(dataset, code, row.get(2, "").strip(), row.get(1, "").strip())


def detect_microdata_csv(zip_file: zipfile.ZipFile) -> str:
    for name in zip_file.namelist():
        normalized = name.replace("\\", "/")
        if normalized.endswith("Tabela_Escola_2025.csv"):
            return name
        if normalized.endswith("microdados_ed_basica_2024.csv"):
            return name
        if normalized.endswith("microdados_ed_basica_2023.csv"):
            return name
    raise FileNotFoundError("Nao foi possivel localizar a tabela de escolas nos microdados do Censo Escolar.")


def is_public_active_school(row: dict[str, str]) -> bool:
    dependencia = row.get("TP_DEPENDENCIA", "").strip()
    situacao = row.get("TP_SITUACAO_FUNCIONAMENTO", "").strip()
    return dependencia in PUBLIC_DEPENDENCIAS and situacao == "1"


def has_any_accessibility(row: dict[str, str]) -> bool:
    if row.get("IN_ACESSIBILIDADE_INEXISTENTE", "").strip() == "1":
        return False

    if to_int(row.get("QT_SALAS_UTILIZADAS_ACESSIVEIS", "")) > 0:
        return True

    return any(row.get(field, "").strip() == "1" for field in ACESSIBILIDADE_FIELDS)


def append_infrastructure(dataset: dict[str, dict[str, JsonScalar]], microdata_zip_path: Path) -> None:
    with zipfile.ZipFile(microdata_zip_path) as zip_file:
        csv_path = detect_microdata_csv(zip_file)

        with zip_file.open(csv_path) as raw_file:
            text_file = io.TextIOWrapper(raw_file, encoding="latin-1", newline="")
            reader = csv.DictReader(text_file, delimiter=";")

            for row in reader:
                if not is_public_active_school(row):
                    continue

                code = row.get("CO_MUNICIPIO", "").strip()
                if len(code) != 7:
                    continue

                entry = ensure_named_entry(
                    dataset,
                    code,
                    row.get("NO_MUNICIPIO", "").strip(),
                    row.get("NO_UF", "").strip() or row.get("SG_UF", "").strip(),
                )

                entry["escolasInfraPublicasTotal"] = int(entry["escolasInfraPublicasTotal"]) + 1

                if row.get("IN_AGUA_POTAVEL", "").strip() == "1":
                    entry["escolasComAguaPotavel"] = int(entry["escolasComAguaPotavel"]) + 1
                if row.get("IN_AGUA_INEXISTENTE", "").strip() == "1":
                    entry["escolasSemAgua"] = int(entry["escolasSemAgua"]) + 1

                if row.get("IN_ESGOTO_REDE_PUBLICA", "").strip() == "1":
                    entry["escolasComEsgoto"] = int(entry["escolasComEsgoto"]) + 1
                if row.get("IN_ESGOTO_INEXISTENTE", "").strip() == "1":
                    entry["escolasSemEsgoto"] = int(entry["escolasSemEsgoto"]) + 1

                if row.get("IN_COZINHA", "").strip() == "1":
                    entry["escolasComCozinha"] = int(entry["escolasComCozinha"]) + 1
                else:
                    entry["escolasSemCozinha"] = int(entry["escolasSemCozinha"]) + 1

                if row.get("IN_INTERNET", "").strip() == "1":
                    entry["escolasComInternet"] = int(entry["escolasComInternet"]) + 1
                if row.get("IN_BANDA_LARGA", "").strip() == "1":
                    entry["escolasComBandaLarga"] = int(entry["escolasComBandaLarga"]) + 1
                if row.get("IN_LABORATORIO_INFORMATICA", "").strip() == "1":
                    entry["escolasComLaboratorioInformatica"] = int(entry["escolasComLaboratorioInformatica"]) + 1
                if row.get("IN_LABORATORIO_CIENCIAS", "").strip() == "1":
                    entry["escolasComLaboratorioCiencias"] = int(entry["escolasComLaboratorioCiencias"]) + 1
                if row.get("IN_QUADRA_ESPORTES", "").strip() == "1":
                    entry["escolasComQuadra"] = int(entry["escolasComQuadra"]) + 1
                if row.get("IN_ALIMENTACAO", "").strip() == "1":
                    entry["escolasComAlimentacao"] = int(entry["escolasComAlimentacao"]) + 1

                if has_any_accessibility(row):
                    entry["escolasComAcessibilidade"] = int(entry["escolasComAcessibilidade"]) + 1
                else:
                    entry["escolasSemAcessibilidade"] = int(entry["escolasSemAcessibilidade"]) + 1

    for entry in dataset.values():
        total = int(entry["escolasInfraPublicasTotal"])
        if total <= 0:
            continue

        for field in INFRA_POSITIVE_FIELDS + INFRA_NEGATIVE_FIELDS:
            pct_field = INFRA_PCT_FIELDS[field]
            entry[pct_field] = round((int(entry[field]) / total) * 100, 1)


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(
            "Uso: python scripts/build-inep-censo-municipal-dataset.py <xlsx> <saida.json> [microdados.zip]"
        )

    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    microdata_zip_path = Path(sys.argv[3]) if len(sys.argv) >= 4 else None

    dataset: dict[str, dict[str, JsonScalar]] = {}

    with zipfile.ZipFile(source_path) as zip_file:
        shared_strings = load_shared_strings(zip_file)
        sheet_map = load_workbook_sheet_map(zip_file)
        is_2025_layout = any(normalize_text(name) == "educacao infantil 1.8" for name in sheet_map)

        if is_2025_layout:
            sheet_basic = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.2"))
            sheet_infant = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.8"))
            sheet_creche = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.10"))
            sheet_pre = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.15"))
            sheet_anos_iniciais = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.23"))
            sheet_anos_finais = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.29"))
            sheet_ensino_medio = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.37"))
            sheet_eja = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.50"))
            sheet_educacao_especial = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.56"))
            sheet_ti_basica = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.7"))
            sheet_ti_creche = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.14"))
            sheet_ti_pre = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.19"))
            sheet_ti_anos_iniciais = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.27"))
            sheet_ti_anos_finais = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.33"))
            sheet_ti_ensino_medio = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.41"))
            sheet_ti_eja = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.54"))
            sheet_ti_educacao_especial = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.59"))
            sheet_docentes = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "2.2"))
            sheet_escolas = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "3.2"))
        else:
            sheet_basic = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.2"))
            sheet_infant = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.5"))
            sheet_creche = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.6"))
            sheet_pre = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.10"))
            sheet_anos_iniciais = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.16"))
            sheet_anos_finais = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.21"))
            sheet_ensino_fundamental = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.14"))
            sheet_ensino_medio = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.26"))
            sheet_eja = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.36"))
            sheet_educacao_especial_comum = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.41"))
            sheet_educacao_especial_exclusiva = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.47"))
            sheet_ti_creche = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.9"))
            sheet_ti_pre = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.13"))
            sheet_ti_anos_iniciais = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.19"))
            sheet_ti_anos_finais = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.24"))
            sheet_ti_ensino_medio = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.29"))
            sheet_ti_educacao_especial_comum = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.45"))
            sheet_ti_educacao_especial_exclusiva = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "1.51"))
            sheet_docentes = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "2.2"))
            sheet_escolas = read_rows(zip_file, shared_strings, find_sheet_path(sheet_map, "3.2"))

        for row in sheet_basic:
            code = row.get(3, "").strip()
            if len(code) != 7:
                continue
            entry = ensure_entry(dataset, code, row)
            entry["matriculasBasicaTotal"] = to_int(row.get(4, ""))
            if is_2025_layout:
                entry["matriculasPublicasTotal"] = to_int(row.get(5, ""))
                entry["matriculasMunicipaisTotal"] = to_int(row.get(8, ""))
            else:
                _, publica, municipal = read_2024_location_metrics(row)
                entry["matriculasPublicasTotal"] = publica
                entry["matriculasMunicipaisTotal"] = municipal

        for row in sheet_infant:
            code = row.get(3, "").strip()
            if len(code) != 7:
                continue
            entry = ensure_entry(dataset, code, row)
            entry["educacaoInfantilTotal"] = to_int(row.get(4, ""))
            if is_2025_layout:
                entry["educacaoInfantilPublica"] = to_int(row.get(5, ""))
                entry["educacaoInfantilMunicipal"] = to_int(row.get(8, ""))
            else:
                entry["educacaoInfantilPublica"] = sum_columns(row, 6, 7, 8, 11, 12, 13)
                entry["educacaoInfantilMunicipal"] = to_int(row.get(8, "")) + to_int(row.get(13, ""))

        for row in sheet_creche:
            code = row.get(3, "").strip()
            if len(code) != 7:
                continue
            entry = ensure_entry(dataset, code, row)
            entry["crecheTotal"] = to_int(row.get(4, ""))
            if is_2025_layout:
                entry["crechePublica"] = to_int(row.get(5, ""))
                entry["crecheMunicipal"] = to_int(row.get(8, ""))
            else:
                _, publica, municipal = read_2024_location_metrics(row)
                entry["crechePublica"] = publica
                entry["crecheMunicipal"] = municipal

        for row in sheet_pre:
            code = row.get(3, "").strip()
            if len(code) != 7:
                continue
            entry = ensure_entry(dataset, code, row)
            entry["preEscolaTotal"] = to_int(row.get(4, ""))
            if is_2025_layout:
                entry["preEscolaPublica"] = to_int(row.get(5, ""))
                entry["preEscolaMunicipal"] = to_int(row.get(8, ""))
            else:
                _, publica, municipal = read_2024_location_metrics(row)
                entry["preEscolaPublica"] = publica
                entry["preEscolaMunicipal"] = municipal

        if is_2025_layout:
            for row in sheet_anos_iniciais:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_location_metrics(row)
                apply_stage_metrics(entry, "anosIniciaisFundamental", total, publica, municipal)

            for row in sheet_anos_finais:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_location_metrics(row)
                apply_stage_metrics(entry, "anosFinaisFundamental", total, publica, municipal)

            for row in sheet_ensino_medio:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_location_metrics(row)
                apply_stage_metrics(entry, "ensinoMedio", total, publica, municipal)

            for row in sheet_eja:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_location_metrics(row)
                apply_stage_metrics(entry, "eja", total, publica, municipal)

            for row in sheet_educacao_especial:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_location_metrics(row)
                apply_stage_metrics(entry, "educacaoEspecial", total, publica, municipal)

            for row in sheet_ti_basica:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_integral_metrics(row)
                apply_integral_metrics(entry, "Basica", total, publica, municipal)

            for row in sheet_ti_creche:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_integral_metrics(row)
                apply_integral_metrics(entry, "Creche", total, publica, municipal)

            for row in sheet_ti_pre:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_integral_metrics(row)
                apply_integral_metrics(entry, "PreEscola", total, publica, municipal)

            for row in sheet_ti_anos_iniciais:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_integral_metrics(row)
                apply_integral_metrics(entry, "AnosIniciais", total, publica, municipal)

            for row in sheet_ti_anos_finais:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_integral_metrics(row)
                apply_integral_metrics(entry, "AnosFinais", total, publica, municipal)

            for row in sheet_ti_ensino_medio:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_integral_metrics(row)
                apply_integral_metrics(entry, "EnsinoMedio", total, publica, municipal)

            for row in sheet_ti_eja:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_integral_metrics(row)
                apply_integral_metrics(entry, "Eja", total, publica, municipal)

            for row in sheet_ti_educacao_especial:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2025_integral_metrics(row)
                apply_integral_metrics(entry, "EducacaoEspecial", total, publica, municipal)
        else:
            for row in sheet_anos_iniciais:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_location_metrics(row)
                apply_stage_metrics(entry, "anosIniciaisFundamental", total, publica, municipal)

            for row in sheet_anos_finais:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_location_metrics(row)
                apply_stage_metrics(entry, "anosFinaisFundamental", total, publica, municipal)

            for row in sheet_ensino_fundamental:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total = to_int(row.get(5, "")) + to_int(row.get(10, ""))
                publica = sum_columns(row, 6, 7, 8, 11, 12, 13)
                municipal = to_int(row.get(8, "")) + to_int(row.get(13, ""))
                apply_stage_metrics(entry, "ensinoFundamental", total, publica, municipal)

            for row in sheet_ensino_medio:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_location_metrics(row)
                apply_stage_metrics(entry, "ensinoMedio", total, publica, municipal)

            for row in sheet_eja:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_location_metrics(row)
                apply_stage_metrics(entry, "eja", total, publica, municipal)

            for row in sheet_educacao_especial_comum:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_location_metrics(row)
                entry["educacaoEspecialTotal"] = int(entry["educacaoEspecialTotal"]) + total
                entry["educacaoEspecialPublica"] = int(entry["educacaoEspecialPublica"]) + publica
                entry["educacaoEspecialMunicipal"] = int(entry["educacaoEspecialMunicipal"]) + municipal

            for row in sheet_educacao_especial_exclusiva:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_location_metrics(row)
                entry["educacaoEspecialTotal"] = int(entry["educacaoEspecialTotal"]) + total
                entry["educacaoEspecialPublica"] = int(entry["educacaoEspecialPublica"]) + publica
                entry["educacaoEspecialMunicipal"] = int(entry["educacaoEspecialMunicipal"]) + municipal

            for row in sheet_ti_creche:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_integral_metrics(row)
                apply_integral_metrics(entry, "Creche", total, publica, municipal)

            for row in sheet_ti_pre:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_integral_metrics(row)
                apply_integral_metrics(entry, "PreEscola", total, publica, municipal)

            for row in sheet_ti_anos_iniciais:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_integral_metrics(row)
                apply_integral_metrics(entry, "AnosIniciais", total, publica, municipal)

            for row in sheet_ti_anos_finais:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_integral_metrics(row)
                apply_integral_metrics(entry, "AnosFinais", total, publica, municipal)

            for row in sheet_ti_ensino_medio:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_integral_metrics(row)
                apply_integral_metrics(entry, "EnsinoMedio", total, publica, municipal)

            for row in sheet_ti_educacao_especial_comum:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_integral_metrics(row)
                entry["tempoIntegralEducacaoEspecialTotal"] = int(entry["tempoIntegralEducacaoEspecialTotal"]) + total
                entry["tempoIntegralEducacaoEspecialPublica"] = int(entry["tempoIntegralEducacaoEspecialPublica"]) + publica
                entry["tempoIntegralEducacaoEspecialMunicipal"] = int(entry["tempoIntegralEducacaoEspecialMunicipal"]) + municipal

            for row in sheet_ti_educacao_especial_exclusiva:
                code = row.get(3, "").strip()
                if len(code) != 7:
                    continue
                entry = ensure_entry(dataset, code, row)
                total, publica, municipal = read_2024_integral_metrics(row)
                entry["tempoIntegralEducacaoEspecialTotal"] = int(entry["tempoIntegralEducacaoEspecialTotal"]) + total
                entry["tempoIntegralEducacaoEspecialPublica"] = int(entry["tempoIntegralEducacaoEspecialPublica"]) + publica
                entry["tempoIntegralEducacaoEspecialMunicipal"] = int(entry["tempoIntegralEducacaoEspecialMunicipal"]) + municipal

        for row in sheet_docentes:
            code = row.get(3, "").strip()
            if len(code) != 7:
                continue
            entry = ensure_entry(dataset, code, row)
            entry["docentesTotal"] = to_int(row.get(4, ""))
            if is_2025_layout:
                entry["docentesPublicosTotal"] = to_int(row.get(5, ""))
                entry["docentesMunicipaisTotal"] = to_int(row.get(8, ""))
            else:
                entry["docentesPublicosTotal"] = to_int(row.get(5, ""))
                entry["docentesMunicipaisTotal"] = to_int(row.get(8, ""))

        for row in sheet_escolas:
            code = row.get(3, "").strip()
            if len(code) != 7:
                continue
            entry = ensure_entry(dataset, code, row)
            entry["escolasTotal"] = to_int(row.get(4, ""))
            if is_2025_layout:
                entry["escolasPublicasTotal"] = to_int(row.get(5, ""))
                entry["escolasMunicipaisTotal"] = to_int(row.get(8, ""))
            else:
                _, publica, municipal = read_2024_location_metrics(row)
                entry["escolasPublicasTotal"] = publica
                entry["escolasMunicipaisTotal"] = municipal

    for entry in dataset.values():
        if int(entry["ensinoFundamentalTotal"]) == 0:
            entry["ensinoFundamentalTotal"] = int(entry["anosIniciaisFundamentalTotal"]) + int(entry["anosFinaisFundamentalTotal"])
            entry["ensinoFundamentalPublica"] = int(entry["anosIniciaisFundamentalPublica"]) + int(entry["anosFinaisFundamentalPublica"])
            entry["ensinoFundamentalMunicipal"] = int(entry["anosIniciaisFundamentalMunicipal"]) + int(entry["anosFinaisFundamentalMunicipal"])

        entry["tempoIntegralEducacaoInfantilTotal"] = int(entry["tempoIntegralCrecheTotal"]) + int(entry["tempoIntegralPreEscolaTotal"])
        entry["tempoIntegralEducacaoInfantilPublica"] = int(entry["tempoIntegralCrechePublica"]) + int(entry["tempoIntegralPreEscolaPublica"])
        entry["tempoIntegralEducacaoInfantilMunicipal"] = int(entry["tempoIntegralCrecheMunicipal"]) + int(entry["tempoIntegralPreEscolaMunicipal"])
        entry["tempoIntegralEnsinoFundamentalTotal"] = int(entry["tempoIntegralAnosIniciaisTotal"]) + int(entry["tempoIntegralAnosFinaisTotal"])
        entry["tempoIntegralEnsinoFundamentalPublica"] = int(entry["tempoIntegralAnosIniciaisPublica"]) + int(entry["tempoIntegralAnosFinaisPublica"])
        entry["tempoIntegralEnsinoFundamentalMunicipal"] = int(entry["tempoIntegralAnosIniciaisMunicipal"]) + int(entry["tempoIntegralAnosFinaisMunicipal"])

    if microdata_zip_path:
        append_infrastructure(dataset, microdata_zip_path)

    output_path.write_text(
        json.dumps(dict(sorted(dataset.items())), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
