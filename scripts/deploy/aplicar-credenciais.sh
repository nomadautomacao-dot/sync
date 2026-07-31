#!/usr/bin/env bash
#
# Leva as credenciais do `.env.local` para o Cloud Run, sem elas passarem por
# terminal, histórico de shell ou conversa.
#
# ## Por que existe
#
# `FIREBASE_SERVICE_ACCOUNT` e `PORTAL_TRANSPARENCIA_TOKEN` estavam no
# `.env.local` e **não** no serviço publicado. Consequência medida em
# 2026-07-31: toda rota autenticada em produção devolvia 401 (o `firebaseApp()`
# lança sem a credencial), e todo relatório saía sem convênios e sem sanções
# CEIS/CNEP, porque a consulta ao Portal da Transparência exige chave.
#
# O JSON da service account tem quebras de linha escapadas e mais de 2 mil
# caracteres — colar isso à mão num terminal é onde as coisas dão errado. Este
# script lê do arquivo e passa por `--env-vars-file`, que aceita o valor
# literal sem interpretação de shell.
#
# ## Uso
#
#     ./scripts/deploy/aplicar-credenciais.sh
#
# Cria uma revisão nova só com a mudança de ambiente — não passa pelo build.
# Para reverter, `gcloud run services update-traffic sync-app
# --to-revisions=<revisão-anterior>=100 --region=us-central1`.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_LOCAL="$RAIZ/.env.local"
SERVICO="sync-app"
REGIAO="us-central1"

[ -f "$ENV_LOCAL" ] || { echo "erro: $ENV_LOCAL não existe." >&2; exit 1; }

# O arquivo temporário nasce com permissão restrita e morre com o script,
# inclusive se ele falhar no meio.
TMP="$(mktemp -t sync-cred-XXXXXX.yaml)"
chmod 600 "$TMP"
trap 'rm -f "$TMP"' EXIT

ler() {
  # Pega a primeira ocorrência, tira aspas das pontas e preserva o resto —
  # incluindo os `\n` escapados dentro da chave privada.
  python3 - "$ENV_LOCAL" "$1" <<'PY'
import re, sys
texto = open(sys.argv[1], encoding="utf-8").read()
m = re.search(rf'^{re.escape(sys.argv[2])}=(.*)$', texto, re.M)
if not m:
    sys.exit(1)
v = m.group(1).strip()
if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
    v = v[1:-1]
print(v, end="")
PY
}

FSA="$(ler FIREBASE_SERVICE_ACCOUNT)" || { echo "erro: FIREBASE_SERVICE_ACCOUNT ausente no .env.local" >&2; exit 1; }
PTT="$(ler PORTAL_TRANSPARENCIA_TOKEN)" || { echo "erro: PORTAL_TRANSPARENCIA_TOKEN ausente no .env.local" >&2; exit 1; }

[ -n "$FSA" ] || { echo "erro: FIREBASE_SERVICE_ACCOUNT está vazia." >&2; exit 1; }
[ -n "$PTT" ] || { echo "erro: PORTAL_TRANSPARENCIA_TOKEN está vazia." >&2; exit 1; }

# Falha aqui é melhor que 401 em produção: se o JSON estiver truncado, o
# serviço subiria e só quebraria no primeiro login.
python3 -c "import json,sys; json.loads(sys.argv[1])" "$FSA" 2>/dev/null \
  || { echo "erro: FIREBASE_SERVICE_ACCOUNT não é um JSON válido." >&2; exit 1; }

echo "Lidas do .env.local: service account (${#FSA} caracteres) e token (${#PTT} caracteres)."

# `--env-vars-file` é o único caminho que aceita JSON multilinha sem o shell
# reinterpretar. As demais variáveis do serviço são preservadas.
python3 - "$TMP" "$FSA" "$PTT" <<'PY'
import sys, yaml  # PyYAML acompanha o gcloud
destino, fsa, ptt = sys.argv[1], sys.argv[2], sys.argv[3]
with open(destino, "w", encoding="utf-8") as f:
    yaml.safe_dump({"FIREBASE_SERVICE_ACCOUNT": fsa, "PORTAL_TRANSPARENCIA_TOKEN": ptt}, f,
                   allow_unicode=True, default_flow_style=False)
PY

echo "Aplicando em $SERVICO ($REGIAO)…"
gcloud run services update "$SERVICO" --region="$REGIAO" --env-vars-file="$TMP" --quiet

echo
echo "Pronto. Confira com:"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' -H 'Authorization: Bearer invalido' \\"
echo "    https://sync-app-n7cfomhaaq-uc.a.run.app/api/modules"
echo "  → 401 continua sendo o esperado para token inválido; o que muda é o login real passar a funcionar."
echo
echo "E rode o smoke test para ver convênios e sanções entrarem no relatório:"
echo "  npm run smoke -- https://sync-app-n7cfomhaaq-uc.a.run.app --producao"
