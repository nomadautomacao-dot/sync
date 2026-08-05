# EnvFile vazio de proposito — ver a nota longa no equivalente Linux.
# `gcloud run deploy --env-vars-file` SUBSTITUI o conjunto inteiro de variaveis
# do servico; com o padrao antigo, este script publicava uma revisao sem
# FIREBASE_SERVICE_ACCOUNT e derrubava toda a API com 401.
param(
  [string]$EnvFile = "",
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

if ($EnvFile -and -not (Test-Path -LiteralPath $EnvFile)) {
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

if ($EnvFile) {
  Write-Step "Deploy no Cloud Run — SUBSTITUINDO as variaveis por $EnvFile"
} else {
  Write-Step "Deploy no Cloud Run — troca so a imagem, variaveis preservadas"
}

$DeployArgs = @(
  "--project", $ProjectId,
  "--image", $ImageUri,
  "--region", $Region,
  "--platform", "managed",
  "--allow-unauthenticated",
  "--port", "3000",
  "--memory", "2Gi",
  "--cpu", "2",
  "--timeout", "900",
  "--max-instances", "10",
  "--min-instances", "0"
)
if ($EnvFile) { $DeployArgs += @("--env-vars-file", $EnvFile) }

gcloud run deploy $ServiceName @DeployArgs | Out-Host

$ServiceUrl = (gcloud run services describe $ServiceName --project $ProjectId --region $Region --format "value(status.url)").Trim()

Write-Step "Deploy concluido"
Write-Host "URL publica:  $ServiceUrl" -ForegroundColor Green
Write-Host "Health check: $ServiceUrl/api/health" -ForegroundColor Green
Write-Host ""
Write-Host "Proximo passo no Android:"
Write-Host "1. Abra o app Flutter"
Write-Host "2. Preencha 'URL da API' com $ServiceUrl"
Write-Host "3. Autenticacao e via Firebase Auth (projeto globalconsultorias)"
Write-Host ""
Write-Host "Nao esqueca do Google OAuth redirect URI:"
Write-Host "$ServiceUrl/api/auth/callback/google"
