#!/bin/bash

# Script de deploy rápido para Sync App

set -e

echo "🚀 Deploy do Sync App para Google Cloud Run"
echo "============================================"

PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
SERVICE_NAME="sync-app"

echo ""
echo "📋 Configuração:"
echo "   Projeto: $PROJECT_ID"
echo "   Região: $REGION"
echo "   Serviço: $SERVICE_NAME"

# Verificar se o serviço existe
if gcloud run services describe $SERVICE_NAME --region=$REGION &>/dev/null; then
    echo "   ✅ Serviço já existe, atualizando..."
else
    echo "   ℹ️  Criando novo serviço..."
fi

echo ""
echo "📦 Iniciando build e deploy..."
echo "   Isso pode levar 10-15 minutos..."
echo ""

# Fazer o deploy
gcloud builds submit --config cloudbuild.yaml .

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "🌐 URL da aplicação:"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)"

echo ""
echo "📊 Status do serviço:"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="table(status.conditions[0].type,status.conditions[0].status,status.conditions[0].message)"

echo ""
echo "⚠️  Não esqueça de configurar as variáveis de ambiente no Google Cloud Console:"
echo "   1. Acesse: https://console.cloud.google.com/run"
echo "   2. Selecione o serviço: $SERVICE_NAME"
echo "   3. Vá em: Editar e implantar nova revisão > Variáveis de ambiente"
echo "   4. Configure: DATABASE_URL, DIRECT_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
