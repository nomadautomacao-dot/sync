#!/bin/bash
# Batch FUNDEB PDF Generator
# Generates PDF reports for all cities via SYNC API

API="http://localhost:3000/api/modulos/levantamento-fundeb/autonomo?tipo=levantamento&formato=pdf"
OUTPUT_DIR="/home/AdrielT87/Área de trabalho/Sync/relatorios_fundeb_ce"
EXERCICIO=2026
UF="CE"

mkdir -p "$OUTPUT_DIR"

# City list
CITIES=(
  "Coreaú"
  "Mucambo"
  "Forquilha"
  "Alcântaras"
  "Meruoca"
  "Uruoca"
  "Camocim"
  "Bela Cruz"
  "Frecheirinha"
  "Ubajara"
  "Varjota"
  "Tamboril"
  "Maranguape"
  "Apuiarés"
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
