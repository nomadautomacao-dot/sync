#!/bin/bash

# Script de setup inicial para Google Cloud Run

set -e

echo "🚀 Setup do Google Cloud Run para Sync App"
echo ""

# Verificar se gcloud está instalado
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud não encontrado. Instale em: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "✅ gcloud encontrado"

# Verificar se está logado
if ! gcloud auth list --filter="status:ACTIVE" --format="value(account)" | grep -q "@"; then
    echo "📝 Faça login no Google Cloud:"
    gcloud auth login
fi

# Verificar projeto
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "📝 Configure o projeto do Google Cloud:"
    gcloud projects list
    read -p "Digite o ID do projeto: " PROJECT_ID
    gcloud config set project "$PROJECT_ID"
fi

echo "✅ Projeto: $PROJECT_ID"

# Ativar APIs
echo ""
echo "🔧 Ativando APIs necessárias..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    containerregistry.googleapis.com \
    --quiet

echo "✅ APIs ativadas"

# Perguntar sobre variáveis de ambiente
echo ""
echo "⚙️  Configuração das variáveis de ambiente:"
echo "   Você precisará configurar manualmente no Google Cloud Console:"
echo "   1. DATABASE_URL (Supabase Transaction Pooler)"
echo "   2. DIRECT_URL (Supabase Direct Connection)"
echo "   3. NEXTAUTH_URL (URL da aplicação)"
echo "   4. NEXTAUTH_SECRET (chave aleatória)"
echo "   5. GOOGLE_CLIENT_ID"
echo "   6. GOOGLE_CLIENT_SECRET"

# Perguntar se quer fazer deploy agora
echo ""
read -p "Deseja fazer o deploy agora? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Iniciando deploy..."
    npm run deploy
else
    echo ""
    echo "✅ Setup concluído! Para fazer o deploy depois, execute:"
    echo "   npm run deploy"
fi

echo ""
echo "📚 Documentação completa em: DEPLOYMENT.md"
