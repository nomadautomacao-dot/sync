#!/usr/bin/env bash
#
# run-local.sh — Inicia o Next.js (backend) + Flutter Linux (frontend) juntos.
#
# Uso:  ./run-local.sh
# Para encerrar tudo:  Ctrl+C (mata ambos os processos)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLUTTER_BIN="/home/AdrielT87/sync_tooling/flutter/bin/flutter"
API_PORT=3000
API_URL="http://localhost:${API_PORT}"

# ── Cores ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  PrimeOS — Ambiente Local${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── Limpar processos anteriores ──
echo -e "${YELLOW}[1/4] Limpando processos anteriores...${NC}"
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
fuser -k "${API_PORT}/tcp" 2>/dev/null || true
rm -f "${SCRIPT_DIR}/.next/dev/lock" 2>/dev/null || true
sleep 1

# ── Iniciar Next.js em background ──
echo -e "${GREEN}[2/4] Iniciando Next.js (API backend) na porta ${API_PORT}...${NC}"
cd "${SCRIPT_DIR}"
npm run dev > /tmp/nextjs-sync.log 2>&1 &
NEXT_PID=$!

# ── Aguardar Next.js ficar pronto ──
echo -e "${YELLOW}[3/4] Aguardando API ficar pronta...${NC}"
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w '' "http://localhost:${API_PORT}/api/health" 2>/dev/null; then
    echo -e "${GREEN}       ✓ API pronta em ${i}s${NC}"
    break
  fi
  if ! kill -0 $NEXT_PID 2>/dev/null; then
    echo -e "${RED}       ✗ Next.js falhou ao iniciar. Log: /tmp/nextjs-sync.log${NC}"
    exit 1
  fi
  sleep 1
done

echo -e "${GREEN}[4/4] Iniciando Flutter Linux...${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}API:${NC}     ${API_URL}"
echo -e "  ${GREEN}Log API:${NC} /tmp/nextjs-sync.log"
echo -e "  ${GREEN}Ctrl+C${NC}   para encerrar tudo"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Cleanup ao sair ──
cleanup() {
  echo ""
  echo -e "${YELLOW}Encerrando...${NC}"
  kill $NEXT_PID 2>/dev/null || true
  pkill -f "next dev" 2>/dev/null || true
  pkill -f "sync_flutter" 2>/dev/null || true
  echo -e "${GREEN}Tudo encerrado.${NC}"
}
trap cleanup EXIT INT TERM

# ── Rodar Flutter Linux ──
cd "${SCRIPT_DIR}/sync_flutter"
"${FLUTTER_BIN}" run -d linux \
  --dart-define="SYNC_API_BASE_URL=${API_URL}"
