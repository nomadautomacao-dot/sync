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
# reinterpretar — mas ele **substitui** o conjunto inteiro de variáveis, não
# soma. A primeira versão disto teria apagado QEDU_TOKEN e OPENROUTER_API_KEY.
# Por isso o arquivo é montado a partir do que o serviço já tem.
#
# JSON e não YAML de propósito: YAML é superconjunto de JSON, o `gcloud` aceita
# os dois, e assim o script não depende do PyYAML, que não existe no python do
# sistema deste Mac.
echo "Lendo as variáveis atuais do serviço, para não apagar nenhuma…"
ATUAIS="$(gcloud run services describe "$SERVICO" --region="$REGIAO" --format=json)"

python3 - "$TMP" "$FSA" "$PTT" "$ATUAIS" <<'PY'
import json, sys
destino, fsa, ptt, bruto = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
servico = json.loads(bruto)
# `.get("value", "")`: variável definida como string vazia vem do gcloud sem o
# campo `value`. Filtrar por `if "value" in e` a apagaria — foi o que quase
# aconteceu com OPENROUTER_API_KEY, que está vazia em produção de propósito.
# Referência a Secret Manager (`valueFrom`) não é suportada aqui: se aparecer,
# o script para em vez de silenciosamente convertê-la em texto.
env = servico["spec"]["template"]["spec"]["containers"][0].get("env", [])
segredos = [e["name"] for e in env if "valueFrom" in e]
if segredos:
    sys.exit(
        "erro: estas variáveis vêm do Secret Manager e este script as perderia: "
        + ", ".join(segredos)
        + ". Aplique pelo console do Cloud Run."
    )
atuais = {e["name"]: e.get("value", "") for e in env}
atuais["FIREBASE_SERVICE_ACCOUNT"] = fsa
atuais["PORTAL_TRANSPARENCIA_TOKEN"] = ptt
with open(destino, "w", encoding="utf-8") as f:
    json.dump(atuais, f, ensure_ascii=False)
print("  preservadas:", ", ".join(sorted(k for k in atuais if k not in ("FIREBASE_SERVICE_ACCOUNT", "PORTAL_TRANSPARENCIA_TOKEN"))))
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
