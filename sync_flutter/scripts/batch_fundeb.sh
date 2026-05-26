#!/bin/bash
# Batch FUNDEB PDF Generator
# Generates PDF reports for all cities via SYNC API

API="https://sync-app-n7cfomhaaq-uc.a.run.app/api/modulos/levantamento-fundeb/autonomo?tipo=levantamento&formato=pdf"
OUTPUT_DIR="/home/AdrielT87/Área de trabalho/sync_flutter/relatorios_fundeb"
EXERCICIO=2026
UF="MG"

mkdir -p "$OUTPUT_DIR"

# City list
CITIES=(
  "Ibiraci"
  "Capetinga"
  "Claraval"
  "Itaú de Minas"
  "Fortaleza de Minas"
  "Marmelópolis"
  "Careaçu"
  "Piranguinho"
  "Pedralva"
  "Ouro Fino"
  "Lambari"
  "Cruzília"
  "Heliodora"
  "Cambuquira"
  "Santana do Manhuaçu"
  "Pedra Dourada"
  "Caputira"
  "Dona Euzébia"
  "Coimbra"
  "Pouso Alegre"
  "Poços de Caldas"
  "Sacramento"
  "Araporã"
  "Gurinhatã"
  "Planura"
  "Vargem Bonita"
  "São Roque de Minas"
  "Piumhi"
  "Pimenta"
  "Capitólio"
  "Itajubá"
  "Tiradentes"
  "Prados"
  "Rio Pomba"
  "Santa Cruz de Minas"
  "São João del Rei"
  "Resende Costa"
  "Barbacena"
  "Conselheiro Lafaiete"
  "Itaúna"
  "Dores de Campos"
  "Delfinópolis"
  "Ituiutaba"
)

TOTAL=${#CITIES[@]}
SUCCESS=0
FAIL=0

echo "================================================"
echo "  FUNDEB Batch PDF Generator"
echo "  Total: $TOTAL cidades | UF: $UF | Exercício: $EXERCICIO"
echo "================================================"
echo ""

for i in "${!CITIES[@]}"; do
  CITY="${CITIES[$i]}"
  NUM=$((i + 1))
  FILENAME=$(echo "$CITY" | sed 's/ /_/g; s/[áàã]/a/g; s/[éê]/e/g; s/[íî]/i/g; s/[óôõ]/o/g; s/[úû]/u/g; s/ç/c/g')
  FILEPATH="$OUTPUT_DIR/${FILENAME}_FUNDEB_${EXERCICIO}.pdf"

  echo -n "[$NUM/$TOTAL] $CITY ... "

  HTTP_CODE=$(curl -sk -X POST "$API" \
    -H "Content-Type: application/json" \
    -d "{\"nome\":\"$CITY\",\"uf\":\"$UF\",\"exercicio\":$EXERCICIO}" \
    -o "$FILEPATH" \
    -w "%{http_code}" \
    --max-time 300 2>/dev/null)

  if [ "$HTTP_CODE" = "200" ] && [ -s "$FILEPATH" ]; then
    SIZE=$(du -h "$FILEPATH" | cut -f1)
    echo "✅ OK ($SIZE)"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "❌ FALHA (HTTP $HTTP_CODE)"
    rm -f "$FILEPATH"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "================================================"
echo "  Resultado: $SUCCESS ✅ sucesso | $FAIL ❌ falha"
echo "  PDFs salvos em: $OUTPUT_DIR"
echo "================================================"
