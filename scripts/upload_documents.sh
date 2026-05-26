#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Upload COMPLETO de documentos da Rocha Prime → Supabase Storage
# Organizado por pastas/categorias
# ═══════════════════════════════════════════════════════════════

SUPABASE_URL="https://pbjlpcqdrbypufleoxnm.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiamxwY3FkcmJ5cHVmbGVveG5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ2MTc5OCwiZXhwIjoyMDg4MDM3Nzk4fQ.S-gKdy2Upmux89DbGKbfYZME4FeeO-fj1BbzmCHn7tk"
BUCKET="company-documents"
BASE="/home/AdrielT87/Área de trabalho/Sync/documents"

upload_file() {
  local FILEPATH="$1"
  local CATEGORY="$2"
  local DISPLAY_NAME="$3"
  
  # Detect content type
  EXT="${FILEPATH##*.}"
  EXT_LOWER=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')
  case "$EXT_LOWER" in
    pdf) CT="application/pdf" ;;
    docx) CT="application/vnd.openxmlformats-officedocument.wordprocessingml.document" ;;
    doc) CT="application/msword" ;;
    xlsx) CT="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ;;
    *) CT="application/octet-stream" ;;
  esac

  # Safe storage name
  SAFE=$(echo "$DISPLAY_NAME.$EXT_LOWER" | sed 's/ /_/g' | sed 's/[()ãáâàéêíóôõúçÃÁÂÀÉÊÍÓÔÕÚÇ]//g' | sed 's/__*/_/g' | sed 's/^_//' | sed 's/_$//')
  
  SIZE=$(stat --printf="%s" "$FILEPATH" 2>/dev/null)
  
  echo "  [$CATEGORY] $DISPLAY_NAME ($SAFE, ${SIZE} bytes)"
  
  curl -s -X POST "$SUPABASE_URL/storage/v1/object/$BUCKET/rocha-prime/$CATEGORY/$SAFE" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: $CT" \
    -H "x-upsert: true" \
    --data-binary "@$FILEPATH" > /dev/null 2>&1
}

echo "═══════════════════════════════════════════════════════════"
echo " UPLOAD COMPLETO — Rocha Prime Documents → Supabase"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── SOCIETARIO ────────────────────────────────────────────────
echo "📁 SOCIETARIO"
upload_file "$BASE/02 CONTRATO SOCIAL ALT.pdf" "societario" "Contrato Social - Alteracao"
upload_file "$BASE/Alteracao ConsultoriaRocha.pdf" "societario" "Alteracao Consultoria Rocha"

# Arquivos com caracteres especiais - usar find
find "$BASE" -maxdepth 1 -name "*ALTERAÇAO*REGISTRADA*" -type f ! -name "*(1)*" ! -name "*(2)*" ! -name "*(3)*" ! -name "*(4)*" | head -1 | while read f; do
  upload_file "$f" "societario" "4a Alteracao Rocha Prime Registrada"
done

find "$BASE" -maxdepth 1 -name "*5 ALTER*REGISTRADA*" -type f ! -name "*(1)*" ! -name "*(2)*" ! -name "*(3)*" ! -name "*(4)*" | head -1 | while read f; do
  upload_file "$f" "societario" "5a Alteracao Rocha Prime Registrada"
done

find "$BASE" -maxdepth 1 -name "*6 ALTER*CONSOLDI*" -type f ! -name "*(1)*" | head -1 | while read f; do
  upload_file "$f" "societario" "6a Alteracao e Consolidacao Rocha Prime"
done

# Itaquaquecetuba pack
ITQ="$BASE/_extracted/06 - Itaquaquecetuba - SP/06 - Itaquaquecetuba - SP"
[ -f "$ITQ/01 CONTRATO SOCIAL.pdf" ] && upload_file "$ITQ/01 CONTRATO SOCIAL.pdf" "societario" "Contrato Social Original"

# ── DOCUMENTOS PESSOAIS ───────────────────────────────────────
echo "📁 DOCUMENTOS PESSOAIS"
upload_file "$BASE/CNH-e.pdf-1 PR.pdf" "pessoal" "CNH Paulo Rocha"
upload_file "$BASE/CNH-e.pdf-2 ANETE.pdf" "pessoal" "CNH Anete"

# ── CERTIDOES ─────────────────────────────────────────────────
echo "📁 CERTIDOES"
[ -f "$BASE/CONSUL ROCHA-1 (1).pdf" ] && upload_file "$BASE/CONSUL ROCHA-1 (1).pdf" "certidoes" "Consulta Cadastral Rocha"

# Itaquaquecetuba certidoes
[ -f "$ITQ/11 CNPJ.pdf" ] && upload_file "$ITQ/11 CNPJ.pdf" "certidoes" "CNPJ"
[ -f "$ITQ/12 CND FEDERAL.pdf" ] && upload_file "$ITQ/12 CND FEDERAL.pdf" "certidoes" "CND Federal"
[ -f "$ITQ/13 ESTADUAL.pdf" ] && upload_file "$ITQ/13 ESTADUAL.pdf" "certidoes" "Certidao Estadual"
[ -f "$ITQ/14 MUNICIPAL.pdf" ] && upload_file "$ITQ/14 MUNICIPAL.pdf" "certidoes" "Certidao Municipal"
[ -f "$ITQ/15 CND FGTS.pdf" ] && upload_file "$ITQ/15 CND FGTS.pdf" "certidoes" "CND FGTS"
[ -f "$ITQ/16 TRABALHISTA.pdf" ] && upload_file "$ITQ/16 TRABALHISTA.pdf" "certidoes" "Certidao Trabalhista"
[ -f "$ITQ/10 Consulta ao Cadastro.pdf" ] && upload_file "$ITQ/10 Consulta ao Cadastro.pdf" "certidoes" "Consulta ao Cadastro"

# Habilitacao
HAB="$ITQ/Habilitacao_PRIME"
[ -f "$HAB/40 CERTIDAO CRA PAULO ROCHA-1.pdf" ] && upload_file "$HAB/40 CERTIDAO CRA PAULO ROCHA-1.pdf" "certidoes" "Certidao CRA Paulo Rocha"
[ -f "$HAB/42 CERTDÃO FALENCIA CONCORDATA  VALI JAN 2025.pdf" ] && upload_file "$HAB/42 CERTDÃO FALENCIA CONCORDATA  VALI JAN 2025.pdf" "certidoes" "Certidao Falencia e Concordata"

# ── LICENCAS ──────────────────────────────────────────────────
echo "📁 LICENCAS"
[ -f "$ITQ/17 ALVARA.pdf" ] && upload_file "$ITQ/17 ALVARA.pdf" "licencas" "Alvara de Funcionamento"

# CRA Registro Profissional
[ -f "$HAB/41 CERTIDÃO DE REGISTRO DE REGULARIDADE PJ.pdf" ] && upload_file "$HAB/41 CERTIDÃO DE REGISTRO DE REGULARIDADE PJ.pdf" "licencas" "Certidao Registro Regularidade PJ CRA"

# ── PROPOSTAS ─────────────────────────────────────────────────
echo "📁 PROPOSTAS"
upload_file "$BASE/01 - Proposta - VinhedoSP.docx" "propostas" "Proposta Vinhedo-SP"
upload_file "$BASE/02 - Proposta - LemeSP.docx" "propostas" "Proposta Leme-SP"
[ -f "$BASE/Descrição dos Serviços.docx" ] && upload_file "$BASE/Descrição dos Serviços.docx" "propostas" "Descricao dos Servicos"
[ -f "$ITQ/00 - Proposta PRIME - ITAQUAQUECETUBA-SP.pdf" ] && upload_file "$ITQ/00 - Proposta PRIME - ITAQUAQUECETUBA-SP.pdf" "propostas" "Proposta Itaquaquecetuba-SP"

# ── TERMOS DE REFERENCIA ──────────────────────────────────────
echo "📁 TERMOS DE REFERENCIA"
upload_file "$BASE/02.2 - TERMO DE REFERENCIA.doc" "termos" "Termo de Referencia 01"
[ -f "$BASE/02.3 - Termo de Referência.doc" ] && upload_file "$BASE/02.3 - Termo de Referência.doc" "termos" "Termo de Referencia 02"

# ── PROCESSOS LICITATORIOS (ZIP LENE) ─────────────────────────
echo "📁 PROCESSOS LICITATORIOS - Lene"
LENE="$BASE/_extracted/01 - 000 - 00-06-2025 - INEX -  Assessoria Técnica e Consultoria  - ROCHA PRIME - LENE/01 - 000 - 00-06-2025 - INEX -  Assessoria Técnica e Consultoria  - ROCHA PRIME - LENE"
for f in "$LENE"/*.doc "$LENE"/*.pdf "$LENE"/*.xlsx; do
  [ -f "$f" ] && upload_file "$f" "licitacao-lene" "$(basename "$f" | sed 's/\.[^.]*$//')"
done

# ── PROCESSOS LICITATORIOS (ZIP VINHEDO) ──────────────────────
echo "📁 PROCESSOS LICITATORIOS - Vinhedo"
VINHEDO="$BASE/_extracted/02 - 000 - 00-06-2025 - INEX -  Assessoria Técnica e Consultoria  - ROCHA PRIME - VINHEDO/02 - 000 - 00-06-2025 - INEX -  Assessoria Técnica e Consultoria  - ROCHA PRIME - VINHEDO"
for f in "$VINHEDO"/*.doc "$VINHEDO"/*.pdf "$VINHEDO"/*.xlsx; do
  [ -f "$f" ] && upload_file "$f" "licitacao-vinhedo" "$(basename "$f" | sed 's/\.[^.]*$//')"
done

# ── HABILITACAO ITAQUAQUECETUBA ───────────────────────────────
echo "📁 HABILITACAO - Itaquaquecetuba"
for f in "$ITQ"/*.pdf "$HAB"/*.pdf; do
  [ -f "$f" ] && BNAME=$(basename "$f" | sed 's/\.[^.]*$//') && upload_file "$f" "habilitacao-itq" "$BNAME"
done

# ── CONTABIL ──────────────────────────────────────────────────
echo "📁 CONTABIL"
[ -f "$ITQ/54 Balanco_Patrimonial_2024_assinado_assinado.pdf" ] && upload_file "$ITQ/54 Balanco_Patrimonial_2024_assinado_assinado.pdf" "contabil" "Balanco Patrimonial 2024"
[ -f "$ITQ/55 Demonstracao_do_Resultado_assinado_%282%29_assinado.pdf" ] && upload_file "$ITQ/55 Demonstracao_do_Resultado_assinado_%282%29_assinado.pdf" "contabil" "DRE 2024"
[ -f "$HAB/43 Livro Diario 2023.pdf" ] && upload_file "$HAB/43 Livro Diario 2023.pdf" "contabil" "Livro Diario 2023"

# ── PROCURACOES ───────────────────────────────────────────────
echo "📁 PROCURACOES"
[ -f "$ITQ/08 PROCURAÇÃO.pdf" ] && upload_file "$ITQ/08 PROCURAÇÃO.pdf" "procuracoes" "Procuracao"

# ── CONTRATOS ─────────────────────────────────────────────────
echo "📁 CONTRATOS"
[ -f "$HAB/45 CONTRATO_ADMINISTRADOR 2024 OJOJ.pdf" ] && upload_file "$HAB/45 CONTRATO_ADMINISTRADOR 2024 OJOJ.pdf" "contratos" "Contrato Administrador 2024"
[ -f "$HAB/46 ADITIVO-DE-CONTRATO-RESPONSABILIDADE-TECNICA.pdf" ] && upload_file "$HAB/46 ADITIVO-DE-CONTRATO-RESPONSABILIDADE-TECNICA.pdf" "contratos" "Aditivo Contrato Responsabilidade Tecnica"
[ -f "$HAB/48 CONSULTORIA ROCHA EIRELI PE042.2022.pdf" ] && upload_file "$HAB/48 CONSULTORIA ROCHA EIRELI PE042.2022.pdf" "contratos" "Consultoria Rocha PE042.2022"
[ -f "$HAB/49 Aditivo 24-25.pdf" ] && upload_file "$HAB/49 Aditivo 24-25.pdf" "contratos" "Aditivo 2024-2025"

# ── ATESTADOS ─────────────────────────────────────────────────
echo "📁 ATESTADOS"
[ -f "$HAB/47 Atestado.pdf" ] && upload_file "$HAB/47 Atestado.pdf" "atestados" "Atestado de Capacidade Tecnica"
[ -f "$HAB/44 FORMULÁRIO_RCA_019-25_ROCHA PRIME SERVIÇOS ESPECIALIZADOS LTDA-1.pdf" ] && upload_file "$HAB/44 FORMULÁRIO_RCA_019-25_ROCHA PRIME SERVIÇOS ESPECIALIZADOS LTDA-1.pdf" "atestados" "Formulario RCA 019-25"

# ── NOTAS FISCAIS ─────────────────────────────────────────────
echo "📁 NOTAS FISCAIS"
[ -f "$ITQ/52 NF.pdf" ] && upload_file "$ITQ/52 NF.pdf" "notas-fiscais" "Nota Fiscal 52"
[ -f "$ITQ/53 NF.pdf" ] && upload_file "$ITQ/53 NF.pdf" "notas-fiscais" "Nota Fiscal 53"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " UPLOAD COMPLETO!"
echo "═══════════════════════════════════════════════════════════"

# Listar tudo que foi uploaded
echo ""
echo "Verificando arquivos no bucket..."
curl -s -X POST "$SUPABASE_URL/storage/v1/object/list/$BUCKET" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prefix":"rocha-prime/","limit":200}' | python3 -c "
import json, sys
data = json.load(sys.stdin)
folders = [d['name'] for d in data if d.get('id') is None or d.get('metadata') is None]
print(f'Pastas encontradas: {len(folders)}')
for f in folders:
    print(f'  📂 {f}')
" 2>/dev/null
