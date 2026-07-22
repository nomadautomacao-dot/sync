#!/usr/bin/env python3
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = ROOT / "data" / "presentations" / "cristalina-2026.json"
OUTPUT_DIR = ROOT / "relatorios_gerados"

OUTPUT_DIR.mkdir(exist_ok=True)

CIDADES = [
    {"nome": "Itupiranga", "uf": "PA", "ibge": "1503705", "receita": 142780504.31, "ganho": 83873542.96},
    {"nome": "Monte Alegre", "uf": "PA", "ibge": "1504802", "receita": 168071187.24, "ganho": 94982473.47},
    {"nome": "Prainha", "uf": "PA", "ibge": "1506005", "receita": 120608843.12, "ganho": 67551491.09}
]

with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
    base_payload = json.load(f)

for cidade in CIDADES:
    # Copia e adapta o payload base
    payload = json.loads(json.dumps(base_payload)) # Deep copy
    payload["material_date"] = "05/06/2026"
    payload["municipio"] = cidade["nome"]
    payload["uf"] = cidade["uf"]
    payload["codigo_ibge"] = cidade["ibge"]
    
    # Ajusta textos específicos
    payload["hero"]["headline"] = f"{cidade['nome']} tem uma oportunidade técnica relevante no FUNDEB."
    payload["hero"]["description"] = f"Material executivo estruturado para reunião com foco em serviço, racional técnico e potencial de resultado para o município de {cidade['nome']}."
    
    payload["metrics"]["receita_prevista"] = cidade["receita"]
    payload["metrics"]["receita_com_rocha_prime"] = cidade["receita"] + cidade["ganho"]
    payload["metrics"]["ganho_estimado"] = cidade["ganho"]
    
    payload["executive_message"]["body"] = (
        f"A tese de abertura da reunião é objetiva: {cidade['nome']} tem porte de rede, mas há espaço claro para otimização dos repasses. "
        f"Com uma receita prevista de R$ {cidade['receita']:,.2f}, a Rocha Prime entra para inverter a lógica de perda de recursos e fazer o município "
        f"voltar a crescer com método e defesa técnica, capturando até R$ {cidade['ganho']:,.2f} em complementação."
    )

    payload_path = ROOT / "scripts" / "payloads_temp" / f"{cidade['ibge']}_{cidade['nome'].lower().replace(' ', '_')}.json"
    payload_path.parent.mkdir(exist_ok=True)
    with open(payload_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        
    output_path = OUTPUT_DIR / f"Relatorio_Executivo_{cidade['nome']}_PA_2026.pdf"
    
    print(f"Gerando relatório para {cidade['nome']}...")
    import subprocess
    result = subprocess.run(
        ["python3", str(ROOT / "scripts" / "generate-fundeb-executive-presentation.py"), str(payload_path), str(output_path)],
        capture_output=True,
        text=True,
        cwd=str(ROOT)
    )
    
    if result.returncode == 0:
        print(f"✅ Sucesso: {output_path}")
    else:
        print(f"❌ Erro em {cidade['nome']}:")
        print(result.stderr)

print("\n🎉 Geração concluída! Verifique a pasta 'relatorios_gerados'.")