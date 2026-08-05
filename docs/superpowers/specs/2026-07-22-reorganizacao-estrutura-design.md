# Reorganização da estrutura de pastas — Sync

Data: 2026-07-22
Status: aprovado

## Problema

O repositório mistura código de aplicação com documentos de negócio, saídas
geradas e dados brutos. Sintomas medidos:

- 9 PDFs, 3 ZIPs e 1 HTML soltos na raiz.
- 10 pastas de relatórios gerados (`relatorios_*`, `output/`), 52 MB.
- 361 binários (PDF/ZIP/DOCX) versionados; `.git` com 1,2 GB.
- `public/` contém um build Flutter antigo duplicado, 40 MB mortos.
- `data/` mistura JSONs bundlados no build com 399 MB de fontes brutas.

## Regra de corte

Fica no repositório apenas o que satisfaz uma destas condições:

1. o Next importa ou executa em runtime;
2. o Flutter compila;
3. o build ou o deploy precisa.

Todo o resto sai para `Sync-Arquivos/`, uma pasta irmã fora do git, ou é
deletado quando for regenerável.

## Estrutura destino

### `Sync/` — repositório

```
app/  core/  components/  modules/  lib/  styles/  types/  prisma/   Next
sync_flutter/                                                        Flutter (fonte)
public/flutter-web/ + favicon.png + file.svg                         servido pelo Next
kit_padrao_pdf/  +  app/api/**/pdf/*.py                  motor PDF (runtime)
data/*.json  +  data/fnde/*.csv                                      bundlado no build
data-stub/  scripts/  docs/  + configs da raiz
```

### `Sync-Arquivos/` — pasta irmã, fora do git

```
assets-contratos/     Anexos_DOCX, Anexos_TXT, Habilitacao_PRIME  (runtime, via env var)
kits-entregues/       Seropédica RJ, Miradouro MG, Ouricuri, _analise_kit, ZIPs de kit
relatorios-gerados/   as 10 pastas relatorios_* e output/, uma subpasta por lote
modelos-processo/     luciana/ — modelos .doc de processo administrativo
documentos-empresa/   documents/ — contratos sociais, alterações, propostas
habilitacao/          documentonovo/ — certidões avulsas
apresentacoes/        PDFs de apresentacao/
ferramentas/          apresentacao/ — toolkit Python de slides, sem vínculo com o app
fontes-fundeb/        complementacao/*.pdf — portarias 2024-2026
dados-brutos/         data/_sinopses, data/*.xlsx, data/batch/*.zip, data/ideb_ai_2023.zip
inbox/                PDFs, ZIPs e HTML soltos da raiz; imagens avulsas de public/
```

### Deletados (regeneráveis ou mortos)

- Build Flutter antigo em `public/`: `index.html`, `main.dart.js`, `canvaskit/`,
  `assets/`, `icons/`, `flutter.js`, `flutter_bootstrap.js`,
  `flutter_service_worker.js`, `manifest.json`, `version.json`.
  O build vivo é `public/flutter-web/`, servido por `app/flutter-web/route.ts`.
- `scripts/_archive/` — scripts com caminhos `c:/Users/Adrie/...`, inertes.
- `scripts/payloads_temp/`, `relatorios_fundeb_ce/` (vazia),
  `complementacao/Google Gemini.html` e `Google Gemini_files/`.

### Permanecem no repositório, mudando de lugar

- `complementacao/*.md` (9 análises técnicas de FUNDEB) → `docs/analises-fundeb/`.
- `export-fundeb-pdf.mjs`, `test-ideb.ts` → `scripts/`.

## Decisões e o porquê

**`data/*.json` fica versionado.** Os JSONs entram por `import ... from "@/data/..."`
(`core/lib/inep-censo.ts:1`, `core/lib/ideb-municipal.ts:1`), portanto são
bundlados no build. É por isso que o Dockerfile não os copia para o estágio
final. Saem apenas as fontes que ninguém importa: `_sinopses/`, os `.xlsx` de
origem e `data/batch/`.

**`apresentacao/` sai inteira.** Os geradores de slides em
`app/api/modulos/slides/pdf/` importam `kit_padrao_pdf`, não
`apresentacao`. Nenhuma rota referencia a pasta.

**`contratos/` se divide.** `Anexos_DOCX`, `Anexos_TXT` e `Habilitacao_PRIME`
são lidos em runtime por `modules/contrato-fundeb/services/contrato-docx-generator.ts`,
mas são 42 MB de certidões que vencem e são substituídas. Vão para
`Sync-Arquivos/assets-contratos/`, alcançados por variável de ambiente. Os kits
por município são saída entregue e vão para `kits-entregues/`.

**`luciana/` vira `modelos-processo/`.** É biblioteca de modelos `.doc`
reutilizáveis, não entrega de um cliente — não pertence a `kits-entregues/`.

## Variáveis de ambiente novas

Ambas com fallback para o caminho atual, de modo que nada quebra se ficarem
indefinidas.

| Var | Default | Consumidores |
|---|---|---|
| `CONTRATOS_ASSETS_DIR` | `./contratos` | `contrato-docx-generator.ts:49,160,276`; `scripts/prepare-docx-templates.mjs:5` |
| `DADOS_BRUTOS_DIR` | `./data` | `scripts/regenerate-ideb.ts:9-10`; `scripts/populate-ideb-from-xlsx.ts`; `scripts/importar-ideb-inep.py`; `scripts/gerar_saeb_mt*.py` |

Quando o diretório apontado não existir, o código falha com mensagem nomeando a
variável, em vez de um `ENOENT` opaco.

## Fases de execução

### Fase 0 — preservar trabalho em andamento

O repositório tem 20+ arquivos modificados e vários untracked (`raio-x/`,
`municipal-xray-*.ts`, `pipeline/`, `collaborator_detail_screen.dart`).
`git filter-repo` recusa rodar com árvore suja, então esse trabalho é commitado
antes de qualquer coisa.

### Fase 1 — mover e deletar

Mover para `Sync-Arquivos/`, deletar os regeneráveis, atualizar `.gitignore`
(`output/`, `relatorios_*/`, `graphify-out/`, `data/_sinopses/`, `data/batch/`,
`*.pdf` na raiz) e `.gcloudignore`. Commit.

### Fase 2 — código

Introduzir as duas variáveis de ambiente, documentá-las em `.env.example` e
`cloudrun.env.yaml.example`, atualizar a seção 2 do `CLAUDE.md` com a árvore
nova. Rodar `npm run build` e confirmar verde. Commit.

### Fase 3 — histórico

1. `cp -a .git ../Sync-git-backup-2026-07-22`.
2. `git filter-repo` removendo `*.pdf` `*.zip` `*.doc` `*.docx` `*.xlsx`
   (exceto `data/fnde/`) e os caminhos `contratos/ documents/ luciana/
   complementacao/ apresentacao/ output/ public/canvaskit/ public/assets/
   public/main.dart.js public/flutter-web/ data/batch/`.
3. `npm run build:flutter:web` e commitar o `public/flutter-web/` regenerado —
   ele é purgado do histórico junto e precisa voltar ao `HEAD`.
4. `git reflog expire --expire=now --all && git gc --prune=now --aggressive`.
5. Verificar: `du -sh .git` (~50 MB), `git log --oneline | wc -l` (50),
   `npm run build` verde.
6. `git push --force origin main`.

O passo 6 é o único irreversível no remoto e ocorre após três verificações.
Autor único e branch única tornam o force-push seguro.

## Critérios de sucesso

- Raiz sem PDF, ZIP ou HTML solto.
- `git ls-files | grep -cE '\.(pdf|zip|docx?|xlsx)$'` retorna 0 fora de `data/fnde/`.
- `.git` abaixo de 100 MB.
- `npm run build` verde.
- Geração de kit de contrato funciona apontando `CONTRATOS_ASSETS_DIR` para
  `Sync-Arquivos/assets-contratos/`.
