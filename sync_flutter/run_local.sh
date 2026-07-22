#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  PrimeOS — Inicialização Local Integrada
# ═══════════════════════════════════════════════════════════════════
#  Sobe o backend Next.js (porta 3000) e lança o Flutter Linux
#  apontando para http://localhost:3000.
#
#  Uso:
#    ./run_local.sh                → backend + Flutter Linux (padrão)
#    ./run_local.sh --no-flutter   → somente o backend
#    ./run_local.sh --web          → backend + Flutter Web (Chrome)
#    ./run_local.sh --rebuild-web  → reconstrói Flutter Web → public/flutter-web
#    ./run_local.sh --kill         → mata processos anteriores e sai
# ═══════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLUTTER_DIR="$SCRIPT_DIR"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_PORT=3000
API_URL="http://localhost:${BACKEND_PORT}"
PROD_URL="https://sync-app-621901234263.us-central1.run.app"
BACKEND_PID_FILE="$SCRIPT_DIR/.backend.pid"
LOG_FILE="$SCRIPT_DIR/.backend.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Auto-detect Flutter binary ─────────────────────────────────────
detect_flutter() {
  # O SDK pinado (~/sync_tooling/flutter, 3.38.7) vem PRIMEIRO de proposito.
  # O flutter do PATH costuma ser uma versao mais nova (3.44+) onde IconData
  # virou 'final class' e lucide_icons_flutter nao compila. Preferir o pinado
  # mantem dev:all consistente com os scripts npm dev:flutter:*.
  if [ -f "$HOME/sync_tooling/flutter/bin/flutter" ]; then
    echo "$HOME/sync_tooling/flutter/bin/flutter"
  elif [ -f "$HOME/flutter/bin/flutter" ]; then
    echo "$HOME/flutter/bin/flutter"
  elif command -v flutter &>/dev/null; then
    echo "flutter"
  else
    echo ""
  fi
}

FLUTTER_BIN="$(detect_flutter)"

# ── Kill previous processes ────────────────────────────────────────
kill_previous() {
  if [ -f "$BACKEND_PID_FILE" ]; then
    local old_pid
    old_pid=$(cat "$BACKEND_PID_FILE" 2>/dev/null)
    if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
      echo -e "${YELLOW}⏹  Parando backend anterior (PID $old_pid)...${NC}"
      kill "$old_pid" 2>/dev/null || true
      sleep 1
      kill -9 "$old_pid" 2>/dev/null || true
    fi
    rm -f "$BACKEND_PID_FILE"
  fi
  # Kill any orphan next-server on the port
  local port_pid
  port_pid=$(lsof -ti :"$BACKEND_PORT" 2>/dev/null || true)
  if [ -n "$port_pid" ]; then
    echo -e "${YELLOW}⏹  Liberando porta $BACKEND_PORT (PID $port_pid)...${NC}"
    kill "$port_pid" 2>/dev/null || true
    sleep 1
  fi
}

if [ "${1:-}" = "--kill" ]; then
  kill_previous
  echo -e "${GREEN}✓  Processos limpos.${NC}"
  exit 0
fi

# ── Cleanup on exit ───────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}⏹  Encerrando...${NC}"
  if [ -f "$BACKEND_PID_FILE" ]; then
    local pid
    pid=$(cat "$BACKEND_PID_FILE" 2>/dev/null)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$BACKEND_PID_FILE"
  fi
  echo -e "${GREEN}✓  Finalizado.${NC}"
}
trap cleanup EXIT

# ── Header ────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ${BOLD}🚀  PrimeOS — Ambiente Local${NC}${CYAN}                     ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Rebuild Flutter Web (opcional) ────────────────────────────────
if [ "${1:-}" = "--rebuild-web" ]; then
  if [ -z "$FLUTTER_BIN" ]; then
    echo -e "${RED}✗  Flutter não encontrado.${NC}"; exit 1
  fi
  echo -e "${BLUE}▶  Reconstruindo Flutter Web → public/flutter-web...${NC}"
  cd "$FLUTTER_DIR"
  "$FLUTTER_BIN" build web --release \
    --base-href /flutter-web/ \
    --dart-define="SYNC_API_BASE_URL=${PROD_URL}" \
    2>&1
  rm -rf "$BACKEND_DIR/public/flutter-web"
  cp -r "$FLUTTER_DIR/build/web" "$BACKEND_DIR/public/flutter-web"
  echo -e "${GREEN}✓  Flutter Web copiado para public/flutter-web/${NC}"
  echo ""
  echo -e "${YELLOW}   Acesse em: ${API_URL}/flutter-web/${NC}"
  echo -e "${YELLOW}   (inicie o backend separado com: npm run dev)${NC}"
  exit 0
fi

# ── Start backend ─────────────────────────────────────────────────
kill_previous

echo -e "${BLUE}▶  [1/2] Iniciando backend Next.js em ${API_URL}...${NC}"
cd "$BACKEND_DIR"
npm run dev > "$LOG_FILE" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$BACKEND_PID_FILE"

# Wait for backend to be ready (max 60s)
echo -n "   Aguardando servidor"
READY=false
for i in $(seq 1 60); do
  if curl -sf "${API_URL}/api/health" > /dev/null 2>&1 || curl -sf "${API_URL}" > /dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}   ✓  Backend pronto na porta ${BACKEND_PORT} (PID ${BACKEND_PID}) — ${i}s${NC}"
    READY=true
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo -e "${RED}   ✗  Backend falhou ao iniciar. Veja ${LOG_FILE}${NC}"
    cat "$LOG_FILE" | tail -20
    exit 1
  fi
  echo -n "."
  sleep 1
done

if [ "$READY" = false ]; then
  echo ""
  echo -e "${RED}   ✗  Backend não respondeu em 60s. Veja ${LOG_FILE}${NC}"
  exit 1
fi

echo ""
echo -e "${CYAN}─────────────────────────────────────────────────────${NC}"
echo -e "  ${GREEN}Backend API:${NC}    ${API_URL}"
echo -e "  ${GREEN}Flutter Web:${NC}    ${API_URL}/flutter-web/"
echo -e "  ${GREEN}Log Backend:${NC}    ${LOG_FILE}"
echo -e "  ${GREEN}Ctrl+C${NC}          para encerrar tudo"
echo -e "${CYAN}─────────────────────────────────────────────────────${NC}"
echo ""

# ── Launch Flutter ────────────────────────────────────────────────
if [ "${1:-}" = "--no-flutter" ]; then
  echo -e "${GREEN}✓  Backend rodando. Flutter não foi iniciado (--no-flutter).${NC}"
  echo ""
  echo -e "${BLUE}   Para rodar o Flutter Linux manualmente:${NC}"
  echo -e "   cd $FLUTTER_DIR"
  echo -e "   $FLUTTER_BIN run -d linux --dart-define=SYNC_API_BASE_URL=${API_URL}"
  echo ""
  echo -e "${BLUE}   Para rodar o Flutter Web (Chrome) manualmente:${NC}"
  echo -e "   cd $FLUTTER_DIR"
  echo -e "   $FLUTTER_BIN run -d chrome --dart-define=SYNC_API_BASE_URL=${API_URL}"
  echo ""
  echo -e "${YELLOW}   Pressione Ctrl+C para parar o backend.${NC}"
  wait "$BACKEND_PID" 2>/dev/null || true
  exit 0
fi

if [ -z "$FLUTTER_BIN" ]; then
  echo -e "${RED}✗  Flutter não encontrado. Instale ou adicione ao PATH.${NC}"
  echo -e "${YELLOW}   O backend continua rodando em ${API_URL}${NC}"
  echo -e "${YELLOW}   Pressione Ctrl+C para encerrar.${NC}"
  wait "$BACKEND_PID" 2>/dev/null || true
  exit 1
fi

cd "$FLUTTER_DIR"

if [ "${1:-}" = "--web" ]; then
  echo -e "${BLUE}▶  [2/2] Iniciando Flutter Web (Chrome) → ${API_URL}...${NC}"
  echo ""
  "$FLUTTER_BIN" run -d chrome \
    --dart-define="SYNC_API_BASE_URL=${API_URL}"
else
  echo -e "${BLUE}▶  [2/2] Iniciando Flutter Linux → ${API_URL}...${NC}"
  echo ""
  "$FLUTTER_BIN" run -d linux \
    --dart-define="SYNC_API_BASE_URL=${API_URL}"
fi
