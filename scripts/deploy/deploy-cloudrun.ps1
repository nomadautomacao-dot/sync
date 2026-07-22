param(
  [string]$EnvFile = "cloudrun.env.yaml",
  [string]$ServiceName = "sync-app",
  [string]$Region = "us-central1",
  [string]$ProjectId = ""
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Comando obrigatorio nao encontrado: $name"
  }
}

Require-Command "gcloud"

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Arquivo de variaveis nao encontrado: $EnvFile. Copie cloudrun.env.yaml.example para $EnvFile e preencha os valores reais."
}

if (-not $ProjectId) {
  $ProjectId = (gcloud config get-value project 2>$null).Trim()
}

if (-not $ProjectId) {
  throw "Nenhum projeto Google Cloud configurado. Rode 'gcloud config set project SEU_PROJECT_ID' e tente novamente."
}

$ImageTag = Get-Date -Format "yyyyMMdd-HHmmss"
$ImageUri = "gcr.io/$ProjectId/$ServiceName`:$ImageTag"

Write-Step "Projeto ativo: $ProjectId"
Write-Host "Servico: $ServiceName"
Write-Host "Regiao:  $Region"
Write-Host "Imagem:  $ImageUri"

Write-Step "Ativando APIs necessarias"
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com --project $ProjectId | Out-Host

Write-Step "Buildando e publicando a imagem"
gcloud builds submit --project $ProjectId --tag $ImageUri . | Out-Host

Write-Step "Fazendo deploy publico no Cloud Run com variaveis do ambiente"
gcloud run deploy $ServiceName `
  --project $ProjectId `
  --image $ImageUri `
  --region $Region `
  --platform managed `
  --allow-unauthenticated `
  --port 3000 `
  --memory 2Gi `
  --cpu 2 `
  --timeout 900 `
  --max-instances 10 `
  --min-instances 0 `
  --env-vars-file $EnvFile | Out-Host

$ServiceUrl = (gcloud run services describe $ServiceName --project $ProjectId --region $Region --format "value(status.url)").Trim()

Write-Step "Deploy concluido"
Write-Host "URL publica:  $ServiceUrl" -ForegroundColor Green
Write-Host "Health check: $ServiceUrl/api/health" -ForegroundColor Green
Write-Host ""
Write-Host "Proximo passo no Android:"
Write-Host "1. Abra o app Flutter"
Write-Host "2. Preencha 'URL da API' com $ServiceUrl"
Write-Host "3. Entre com SYNC_LOGIN_EMAIL / SYNC_LOGIN_PASSWORD"
Write-Host ""
Write-Host "Nao esqueca do Google OAuth redirect URI:"
Write-Host "$ServiceUrl/api/auth/callback/google"
