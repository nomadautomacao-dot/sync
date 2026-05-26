# Deploy no Google Cloud Run

## Pré-requisitos

1. **Google Cloud SDK** instalado: https://cloud.google.com/sdk/docs/install
2. **Conta Google Cloud** com projeto criado
3. **Docker** instalado (para testes locais)

## Arquitetura real de produção

O backend principal do Sync já está preparado para rodar em **Google Cloud Run** com:
- Next.js App Router
- Prisma + Supabase/Postgres
- geradores Python/ReportLab dos PDFs FUNDEB

Não encontrei uma versão equivalente do backend principal em Firebase Hosting/App Hosting. As referências a Firebase no repositório estão em `projetoapi/GovIA_React`, que é outro projeto.

## Antes de publicar

1. Rotacione os segredos atuais antes do deploy se eles já estiverem expostos localmente:
- senha do banco/Supabase
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_SECRET`
2. Defina credenciais reais para o login por email/senha do app Flutter:
- `SYNC_LOGIN_EMAIL`
- `SYNC_LOGIN_PASSWORD`
- `SYNC_LOGIN_NAME`
3. Garanta que `NEXTAUTH_URL` aponte para a URL pública HTTPS do Cloud Run.
4. Atualize o OAuth do Google com o redirect URI público:
- `https://[SEU-DOMINIO]/api/auth/callback/google`

## Caminho recomendado no Windows

1. Copie o arquivo de exemplo:

```powershell
Copy-Item cloudrun.env.yaml.example cloudrun.env.yaml
```

2. Preencha `cloudrun.env.yaml` com os valores reais.

3. Execute:

```powershell
npm run deploy:cloudrun:windows
```

Esse fluxo:
- faz o build da imagem no Cloud Build
- publica a imagem no Container Registry
- faz o deploy no Cloud Run ja com as variaveis corretas
- mostra a URL publica final e o endpoint `/api/health`

## Configuração Inicial

### 1. Ativar APIs necessárias

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com
```

### 2. Configurar variáveis de ambiente

No Google Cloud Console, vá para **Cloud Run** > **sync-app** > **Editar e implantar nova revisão** > **Variáveis de ambiente**:

```
DATABASE_URL=postgresql://postgres:[SENHA]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres:[SENHA]@db.[PROJECT-REF].supabase.co:5432/postgres
NEXTAUTH_URL=https://[SEU-DOMINIO]
NEXTAUTH_SECRET=[CHAVE-SECRETA-ALEATORIA]
GOOGLE_CLIENT_ID=[SEU-GOOGLE-CLIENT-ID]
GOOGLE_CLIENT_SECRET=[SEU-GOOGLE-CLIENT-SECRET]
SYNC_LOGIN_EMAIL=[LOGIN-DO-APP]
SYNC_LOGIN_PASSWORD=[SENHA-FORTE-DO-APP]
SYNC_LOGIN_NAME=[NOME-EXIBICAO]
NODE_ENV=production
```

### 3. Configurar Google OAuth

No Google Cloud Console > **APIs & Services** > **Credentials**:

Adicione esses **Authorized redirect URIs**:
- `https://[SEU-DOMINIO]/api/auth/callback/google`

## Deploy Local (Teste)

```bash
# Build da imagem Docker
docker build -t sync-app:latest .

# Rodar localmente
docker run -p 3000:3000 \
  -e DATABASE_URL="sua-url-do-banco" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET="teste-local" \
  -e GOOGLE_CLIENT_ID="seu-client-id" \
  -e GOOGLE_CLIENT_SECRET="seu-client-secret" \
  sync-app:latest
```

## Deploy Automático (Cloud Build)

### 1. Conectar repositório

```bash
# Se usar GitHub
gcloud builds submit --config cloudbuild.yaml .

# Ou configurar trigger automático
gcloud builds triggers create github \
  --name="sync-app-deploy" \
  --repo-name="[SEU-REPO]" \
  --repo-owner="[SEU-USUARIO]" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml"
```

### 2. Deploy manual

```bash
# Subir imagem e deployar
gcloud builds submit --config cloudbuild.yaml .
```

## Acessar a Aplicação

Após o deploy:
1. URL será: `https://sync-app-[HASH].a.run.app`
2. Configure um domínio personalizado se preferir
3. Teste saúde: `https://sync-app-[HASH].a.run.app/api/health`
4. No app Flutter, preencha `URL da API` com essa base pública

## Comandos Úteis

```bash
# Ver logs
gcloud logs tail /projects/[PROJECT-ID]/runs/sync-app

# Ver status do serviço
gcloud run services describe sync-app --region=us-central1

# Escalonamento
gcloud run services update sync-app \
  --region=us-central1 \
  --min-instances=1 \
  --max-instances=10

# Atualizar variáveis de ambiente
gcloud run services update sync-app \
  --region=us-central1 \
  --update-env-vars=NODE_ENV=production
```

## Custos Estimados

- **0 instâncias**: R$ 0,00 (quando não está sendo usado)
- **1 instância (512MB)**: ~R$ 25,00/mês
- **1 instância (1GB)**: ~R$ 50,00/mês
- **Requests**: R$ 0,40 por milhão de requests
- **Egress**: R$ 0,18 por GB

Total estimado: **R$ 30-100/mês** dependendo do uso

## Troubleshooting

### Erro de conexão com banco
- Verifique se DATABASE_URL está correta
- Confirme que o IP do Cloud Run está liberado no Supabase

### PDF não funciona
- Aumente a memória para 2GB: `--memory 2Gi`
- Aumente o timeout: `--timeout 900`
- Confirme que a imagem publicada inclui `app/api/modulos/levantamento-fundeb/pdf` e `kit_padrao_pdf_rocha_prime`

### Build falha
- Verifique logs: `gcloud builds log [BUILD-ID]`
- Confirme que todas as dependências estão no package.json

### Login com email/senha falha no celular
- Verifique se `SYNC_LOGIN_EMAIL` e `SYNC_LOGIN_PASSWORD` foram definidos no Cloud Run
- Confirme que o app Flutter está apontando para a URL pública certa
- Teste `POST /api/auth/login` diretamente no backend publicado
