#!/usr/bin/env python3
"""
Script: Importar planilhas do IDEB/INEP (Divulgacao 2023)
Objetivo: Atualizar o arquivo "data/ideb-municipal-2023.json" com os
resultados oficias do IDEB 2023.

Como usar:
1. Baixe os resultados do IDEB 2023 no site oficial do INEP:
   https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados
   - Faça download de "Resultados do Ideb - Brasil, Grandes Regioes, Unidades da Federacao e Municipios"
   - Extraia os arquivos .xlsx nas pastas ou mova-os para a pasta ./data/

2. Renomeie o Excel ou certifique-se de que os nomes contenham "anos_iniciais_municipios_2023"
   e "anos_finais_municipios_2023". Exemplo:
   C:/Users/Adrie/Desktop/Sync/data/divulgacao_anos_iniciais_municipios_2023.xlsx

3. Instale o Pandas/OpenPyXL caso ainda não tenha:
   pip install pandas openpyxl

4. Execute este script:
   python scripts/importar-ideb-inep.py
"""

import json
import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("ERRO: O pacote 'pandas' não está instalado. Execute: pip install pandas openpyxl")
    sys.exit(1)

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
JSON_OUT = DATA_DIR / "ideb-municipal-2023.json"

def locate_excel_file(pattern: str) -> Path | None:
    for file in DATA_DIR.glob("*.xlsx"):
        if pattern in file.name.lower():
            return file
    return None

def main():
    print(f"Buscando planilhas do INEP na pasta: {DATA_DIR}")
    
    file_iniciais = locate_excel_file("iniciais")
    file_finais = locate_excel_file("finais")

    if not file_iniciais and not file_finais:
        print(" NENHUMA planilha encontrada!")
        print(" O script ESPERA encontrar arquivos Excel do IDEB (.xlsx) na pasta 'data'.")
        print(" Exemplo: divulgacao_anos_iniciais_municipios_2023.xlsx")
        sys.exit(1)

    # Carrega a base vazia gerada automaticamente
    if not JSON_OUT.exists():
        print(f" Arquivo base {JSON_OUT.name} não encontrado. Criando vazio...")
        ideb_data = {}
    else:
        with open(JSON_OUT, "r", encoding="utf-8") as f:
            ideb_data = json.load(f)

    # Função para extrair dados da planilha do INEP, saltando as linhas de cabecalho padrao (geralmente 9)
    def process_file(path: Path, ideb_field: str, aprovacao_field: str):
        print(f" Carregando {path.name}...")
        try:
            # Planilhas INEP geralmente exigem pular o cabeçalho descritivo
            df = pd.read_excel(path, skiprows=9, engine='openpyxl')
            
            # Filtra apenas REDE PUBLICA (O INEP mapeia Municipal, Estadual, Publica, Federal)
            # Vamos focar na soma da Publica ou Municipal (Dependência Administrativa)
            # As colunas variam: "Código do Município" / "Ideb2023" / "Aprovação2023" (Ou Taxa de Aprovação)
            df.columns = [str(c).lower().strip() for c in df.columns]
            
            cod_col = next((c for c in df.columns if "código do município" in c or "cd_municipio" in c), None)
            dep_col = next((c for c in df.columns if "dependência" in c or "rede" in c), None)
            ideb_col = next((c for c in df.columns if "ideb2023" in c.replace(" ","") or "ideb_2023" in c), None)
            aprov_col = next((c for c in df.columns if "aprovação" in c or "aprovacao" in c), None)

            if not cod_col or not ideb_col:
                print(f" [Aviso] Colunas padrao nao encontradas em {path.name}. Cabecalhos:", df.columns.tolist()[:10])
                return

            for _, row in df.iterrows():
                rede = str(row.get(dep_col, "")).upper()
                if "PÚBLICA" not in rede and "PUBLICA" not in rede and "MUNICIPAL" not in rede:
                    continue  # Apenas publica ou municipal
                
                cod = str(row[cod_col]).replace(".0", "").strip()
                if len(cod) != 7:
                    continue
                
                val_ideb = row[ideb_col]
                val_aprov = row[aprov_col] if aprov_col else None

                if cod not in ideb_data:
                    ideb_data[cod] = {
                        "anosIniciaisPublica": None,
                        "anosFinaisPublica": None,
                        "ensinoMedioPublica": None,
                        "taxaAprovacaoIniciais": None,
                        "taxaAprovacaoFinais": None
                    }

                try:
                    if pd.notna(val_ideb) and str(val_ideb).strip() != "-" and str(val_ideb).strip() != "ND":
                        ideb_data[cod][ideb_field] = round(float(str(val_ideb).replace(",", ".")), 2)
                    
                    if pd.notna(val_aprov) and str(val_aprov).strip() != "-" and str(val_aprov).strip() != "ND":
                        ideb_data[cod][aprovacao_field] = round(float(str(val_aprov).replace(",", ".")), 2)
                except ValueError:
                    pass

            print(f" -> Sucesso ao integrar {ideb_field}.")
        except Exception as e:
            print(f" ERRO ao processar {path.name}: {e}")

    if file_iniciais:
        process_file(file_iniciais, "anosIniciaisPublica", "taxaAprovacaoIniciais")

    if file_finais:
        process_file(file_finais, "anosFinaisPublica", "taxaAprovacaoFinais")

    # Salva os resultados no JSON indexado
    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(ideb_data, f, ensure_ascii=False, indent=2)

    print(f"\nFinalizado! {len(ideb_data)} municipios mapeados e atualizados em data/ideb-municipal-2023.json")

if __name__ == "__main__":
    main()
