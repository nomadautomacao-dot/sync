import json
import sys

payload = {
    "identificacao": {"municipio": "Berizal", "uf": "MG", "exercicio": 2026},
    "ano_base_1": 2025,
    "ano_base_2": 2026,
    "ano_censo_base_1": 2024,
    "ano_censo_base_2": 2025,
    "receitas": {
        "receitaContribuicaoMunicipal": 1200000,
        "complementacaoVAAF": 300000,
        "complementacaoVAAT": 100000,
        "complementacaoVAAR": 0,
        "totalReceitas": 1600000
    },
    "receitasComparativas": [
        {"componente": "Contribuicao Municipal", "valor_ano_1": 1100000, "valor_ano_2": 1200000},
        {"componente": "Complementacao VAAF", "valor_ano_1": 250000, "valor_ano_2": 300000},
        {"componente": "Complementacao VAAT", "valor_ano_1": 90000, "valor_ano_2": 100000},
        {"componente": "Complementacao VAAR", "valor_ano_1": 0, "valor_ano_2": 0},
        {"componente": "TOTAL", "valor_ano_1": 1440000, "valor_ano_2": 1600000}
    ],
    "serieReceitasFundeb": [
        {"ano": 2023, "receitaTotal": 1300000, "contribuicao": 1000000, "complementacaoTotal": 300000},
        {"ano": 2024, "receitaTotal": 1400000, "contribuicao": 1050000, "complementacaoTotal": 350000},
        {"ano": 2025, "receitaTotal": 1440000, "contribuicao": 1100000, "complementacaoTotal": 340000},
        {"ano": 2026, "receitaTotal": 1600000, "contribuicao": 1200000, "complementacaoTotal": 400000}
    ],
    "redePublicaHistorica": [
        {"ano": 2024, "escolasPublicas": 12, "docentesPublicos": 150, "matriculasPublicas": 2100, "status": "publicado"},
        {"ano": 2025, "escolasPublicas": 12, "docentesPublicos": 145, "matriculasPublicas": 2050, "status": "publicado"},
        {"ano": 2026, "escolasPublicas": None, "docentesPublicos": None, "matriculasPublicas": None, "status": "pendente_inep"}
    ],
    "matriculasComparativas": [
        {"etapa": "Creche Integral", "valor_ano_1": 50, "valor_ano_2": 60},
        {"etapa": "Pre-escola", "valor_ano_1": 200, "valor_ano_2": 190},
        {"etapa": "Anos Iniciais", "valor_ano_1": 800, "valor_ano_2": 780},
        {"etapa": "Anos Finais", "valor_ano_1": 750, "valor_ano_2": 720},
        {"etapa": "TOTAL", "valor_ano_1": 2100, "valor_ano_2": 2050}
    ],
    "cenarioEstruturacao": {
        "frentes": ["Auditoria de Matriculas EJA", "Habilitacao VAAT"],
        "impactoFinanceiroIndicativo": {"minimo": 150000, "maximo": 300000}
    }
}

json.dump(payload, sys.stdout)
