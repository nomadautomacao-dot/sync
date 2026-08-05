#!/usr/bin/env bash
#
# deploy-cloudrun-linux.sh — Build & deploy Sync to Google Cloud Run (Linux/macOS)
#
# Uso:  bash scripts/deploy/deploy-cloudrun-linux.sh
#       bash scripts/deploy/deploy-cloudrun-linux.sh --env-file cloudrun.env.yaml --region southamerica-east1
#
set -euo pipefail

# ── Defaults ──
#
# ENV_FILE vazio de proposito. `gcloud run deploy --env-vars-file` NAO soma:
# ele SUBSTITUI o conjunto inteiro de variaveis do servico pelo conteudo do
# arquivo. Enquanto isso era o padrao, rodar este script publicava uma revisao
# sem FIREBASE_SERVICE_ACCOUNT — e sem ela `getSessionUser()` devolve null em
# toda requisicao, ou seja, 401 em cada rota da API.
#
# O padrao agora e o mesmo do cloudbuild.yaml: troca so a imagem, e o que ja
# esta configurado no servico continua onde esta. Quem quiser reescrever as
# variaveis pede explicitamente com --env-file.
ENV_FILE=""
SERVICE_NAME="sync-app"
REGION="us-central1"
PROJECT_ID=""

# ── Parse args ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)  ENV_FILE="$2";      shift 2 ;;
    --service)   SERVICE_NAME="$2";  shift 2 ;;
    --region)    REGION="$2";        shift 2 ;;
    --project)   PROJECT_ID="$2";    shift 2 ;;
    *) echo "Argumento desconhecido: $1"; exit 1 ;;
  esac
done

# ── Cores ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

step() { echo -e "\n${CYAN}==> $1${NC}"; }

# ── Validações ──
if ! command -v gcloud &>/dev/null; then
  echo -e "${RED}Erro: gcloud não encontrado. Instale em https://cloud.google.com/sdk/docs/install${NC}"
  exit 1
fi

if [[ -n "$ENV_FILE" && ! -f "$ENV_FILE" ]]; then
  echo -e "${RED}Erro: Arquivo de variáveis '$ENV_FILE' não encontrado.${NC}"
  echo "Copie cloudrun.env.yaml.example para $ENV_FILE e preencha os valores reais."
  exit 1
fi

# ── Detectar projeto ──
if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
fi

if [[ -z "$PROJECT_ID" ]]; then
  echo -e "${RED}Nenhum projeto GCP configurado.${NC}"
  echo "Rode: gcloud config set project SEU_PROJECT_ID"
  exit 1
fi

IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
IMAGE_URI="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${IMAGE_TAG}"

step "Configuração"
echo -e "  ${GREEN}Projeto:${NC}  $PROJECT_ID"
echo -e "  ${GREEN}Serviço:${NC}  $SERVICE_NAME"
echo -e "  ${GREEN}Região:${NC}   $REGION"
echo -e "  ${GREEN}Imagem:${NC}   $IMAGE_URI"
if [[ -n "$ENV_FILE" ]]; then
  echo -e "  ${YELLOW}Env:${NC}      $ENV_FILE — SUBSTITUI todas as variáveis do serviço"
else
  echo -e "  ${GREEN}Env:${NC}      preservadas (troca só a imagem)"
fi

step "Ativando APIs necessárias"
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  --project "$PROJECT_ID" --quiet

step "Buildando e publicando a imagem (Cloud Build)"
echo -e "${YELLOW}Isso pode levar 10-15 minutos...${NC}"
gcloud builds submit \
  --project "$PROJECT_ID" \
  --tag "$IMAGE_URI" \
  .

step "Fazendo deploy no Cloud Run"
DEPLOY_ARGS=(
  --project "$PROJECT_ID"
  --image "$IMAGE_URI"
  --region "$REGION"
  --platform managed
  --allow-unauthenticated
  --port 3000
  --memory 4Gi
  --cpu 2
  --timeout 900
  --max-instances 10
  --min-instances 0
)
[[ -n "$ENV_FILE" ]] && DEPLOY_ARGS+=(--env-vars-file "$ENV_FILE")

gcloud run deploy "$SERVICE_NAME" "${DEPLOY_ARGS[@]}"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format "value(status.url)")

step "Deploy concluído! ✅"
echo ""
echo -e "  ${GREEN}URL pública:${NC}   $SERVICE_URL"
echo -e "  ${GREEN}Health check:${NC}  $SERVICE_URL/api/health"
echo ""
echo -e "${CYAN}Próximo passo — o smoke test (seção 7.1 do CLAUDE.md):${NC}"
echo "  npm run smoke -- $SERVICE_URL --producao"
echo ""
echo "  O npm test é cego para erro de dado, que aqui é a falha mais provável."
echo "  O smoke emite um Raio-X de verdade e confere folhas, corte e fontes vivas."
echo ""
echo -e "${CYAN}Reverter, se preciso:${NC}"
echo "  gcloud run services update-traffic $SERVICE_NAME \\"
echo "    --to-revisions=<revisão-anterior>=100 --region=$REGION"
echo ""
echo -e "${YELLOW}Garanta que FIREBASE_SERVICE_ACCOUNT esteja setada no Cloud Run.${NC}"
