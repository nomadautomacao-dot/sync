# Continuar o trabalho — estado atual e o que falta

> Handoff escrito em **2026-07-29**, no fim de uma sequência de rodadas sobre os
> relatórios FUNDEB. Serve para retomar o trabalho em outra máquina (MacBook)
> sem reconstruir contexto. Branch: `migracao-flutter-para-next`.

---

## 1. Setup na máquina nova

```bash
git clone <repo> && cd Sync
npm install
npx playwright install chromium   # obrigatório: os PDFs são gerados no Chromium
```

### Variáveis de ambiente (`.env.local`, nunca versionado)

O `.gitignore` bloqueia `.env*` (exceto `.env.example`). Copie o template e
preencha:

| Variável | Onde conseguir | Sem ela |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | já estão no `.env.example` (identificadores públicos) | login não funciona |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Contas de serviço → gerar chave (JSON em uma linha) | rotas de API respondem 401 |
| `QEDU_TOKEN` | painel QEdu | indicadores QEdu ficam `null` |
| `PORTAL_TRANSPARENCIA_TOKEN` | **chave gratuita já cadastrada** para `adrieltavares87@gmail.com` — está no `.env.local` da máquina Windows e no e-mail de confirmação do Portal | convênios e sanções CEIS/CNEP degradam para "indisponível" no Raio-X |

> A chave do Portal da Transparência **não está no git** de propósito. Copie do
> `.env.local` antigo ou gere outra em `portaldatransparencia.gov.br/api-de-dados`.
> Ela também precisa entrar no Cloud Run (ver `cloudrun.env.yaml.example`).

### Verificação rápida

```bash
npm test              # 343 testes, 38 arquivos — devem passar todos
npm run dev           # Next em :3100
```

`npx tsc --noEmit` **precisa de heap maior** nesta base:
`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`. Há erros
**pré-existentes** em `collaboration-data-access.ts`, `slides/gerar/route.ts`,
`workspace/settings/route.ts` e `fundeb-directed-context.ts` (Prisma/`any`) —
não foram introduzidos por este trabalho e não bloqueiam o build do Next.

### O que não roda em qualquer máquina

- **Testes de regras do Firestore** (`firestore-rules-test/`) exigem
  `firebase-tools` + **Java** (emulador). Nunca rodaram na máquina Windows.
  No Mac: `brew install openjdk && npx firebase emulators:exec --only firestore
  --project globalconsultorias "node --test"` dentro de `firestore-rules-test/`.
- Os scripts de `npm run build:flutter:web` apontam para um caminho Linux do
  Flutter SDK. O app Flutter é **legado** (será apagado) — não investir nele.

---

## 2. O que os três relatórios são hoje

| Relatório | Rota | Páginas | Contrato de páginas |
|---|---|---|---|
| **Raio-X Municipal** | `POST /api/modulos/levantamento-fundeb/raio-x` | **40** | `PAGINAS_ESPERADAS` em `core/lib/municipal-xray-pdf.ts` |
| **Diagnóstico FUNDEB** (Levantamento) | `POST /api/modulos/levantamento-fundeb/pdf?tipo=levantamento` | 10 (+5 anexos) | gerador Python (`kit_padrao_pdf_rocha_prime/`) |
| **Histórico do Censo Escolar** | `POST /api/modulos/levantamento-fundeb/historico-censo` | **11** | `PAGINAS_ESPERADAS` em `core/lib/censo-historico-pdf.ts` |

Todos os três aparecem como cards em
`app/(sync)/modulos/levantamento-fundeb/page.tsx`, baixam o PDF **e** arquivam o
JSON na ficha da cidade (Firestore, coleção `cityReports`, tipos `raio_x`,
`diagnostico_fundeb`, `historico_censo`).

### Regra dura do contrato de páginas

Ao adicionar uma página no template, **subir o número em
`municipal-xray-pdf.ts` (ou `censo-historico-pdf.ts`) e no teste**. A numeração
dos rodapés é automática (contador `prox()`), e o teste de sequência falha se
alguma página não usar o contador. O card da UI também mostra a contagem.

---

## 3. Regras de projeto que não estão no código

Foram decididas ao longo das rodadas e valem para qualquer bloco novo:

1. **Todo número imprime fonte e ano.** Sem exceção.
2. **Indicador sensível** (violência, gravidez na adolescência, cor/raça) entra
   como **contexto explicativo**, nunca como rótulo do município.
3. **Afirmação sem fonte vira pergunta de campo** — com o dado que temos
   embutido na pergunta. Nunca preencher lacuna com estimativa silenciosa.
4. **Ausência ≠ zero.** `"--"`, `"-"`, campo vazio → `null` gracioso.
5. **"Desabilitado" do CAUC nunca é falha local** (vale para o país inteiro).
6. **Padrão de dados**: script offline em `scripts/dados/*.mjs` → JSON
   versionado em `data/**` → leitor em `core/lib/` com `null` gracioso + cache
   → wiring em `govia-compat.ts` (`relatorio_dirigido_base`) → extração em
   `mapMunicipalXrayModel` → página → teste. Fonte viva entra no `Promise.all`.
7. **Análise pura separada da rede**: a função que interpreta é exportada e
   testada com fixture; o `fetch` fica em volta.
8. **Marca**: a empresa é **Global Company Consultorias** (não "Rocha Prime").
   Pendência consciente: os documentos jurídicos do kit de contratos
   (`modules/contrato-fundeb/`, `app/api/workspace/settings/route.ts`) ainda
   usam a razão social antiga — **decisão do usuário: não mexer agora**, só
   quando ele fornecer razão social e CNPJ novos.
9. **Flutter é legado.** Não modificar `sync_flutter/`.
10. O hook de design (`impeccable`) está configurado para ignorar
    `core/lib/*-template.ts` (`.impeccable/config.json`) — templates de
    impressão não seguem o design system da web.

---

## 4. Datasets locais e como regenerar

Cada `npm run dados:*` baixa da fonte e regrava o JSON. Rodar quando a fonte
publicar edição nova.

| Comando | Saída | Quando regenerar |
|---|---|---|
| `npm run dados:alfabetizacao` | `data/inep/alfabetizacao-municipios.json` | nova edição do ICA (anual, ~março) |
| `npm run dados:cor-raca` | `data/inep/cor-raca-historico.json` | novo Censo Escolar (anual) |
| `npm run dados:escolas-territorio` | `data/inep/escolas-territorio.json` | novo Censo Escolar |
| `npm run dados:indicadores-escolas` | `data/inep/indicadores-escolas.json` | novas edições INSE/ICG/TDI/AFD |
| `npm run dados:ideb-escolas` | `data/inep/ideb-escolas.json` | novo IDEB (bienal) |
| `npm run dados:saeb-distribuicao` | `data/inep/saeb-distribuicao.json` | novo Saeb (bienal) |
| `npm run dados:enem` | `data/inep/enem-abstencao.json` | novos microdados ENEM (anual) |
| `npm run dados:emendas` | `data/portal-transparencia/emendas-municipios.json` | mensal (o bulk é atualizado sempre) |
| `npm run dados:violencia` | `data/ipea/violencia-municipios.json` | novo Atlas da Violência |
| `npm run dados:vaar` | `data/fnde/...` | **a cada portaria quadrimestral do FNDE** |
| `npm run dados:siope`, `dados:remuneracao`, `dados:ponderadas`, `dados:caged`, `dados:equidade`, `dados:assentamentos` | vários | ver `CLAUDE.md` seção 8 |

### Armadilhas das fontes (custaram horas)

- **URLs do INEP**: microdados ficam em
  `download.inep.gov.br/dados_abertos/microdados_censo_escolar_<ano>.zip`, mas
  **2025 tem underscore extra**: `..._2025_.zip`. O caminho antigo
  `/microdados/` devolve 404.
- **ICA (alfabetização)**: os arquivos estão em
  `download.inep.gov.br/avaliacao_da_alfabetizacao/resultados/` — as páginas de
  notícia do INEP exigem login, então o caminho é a página de resultados por
  ano (`.../avaliacao-da-alfabetizacao/resultados/2025`).
- **XLSX**: `sharedStrings` deve ser lido **por `<si>` inteiro** (entradas com
  rich text têm vários `<t>`; contar cada um desloca todos os índices).
- **Planilhas do INEP com layouts diferentes**: a de municípios e a de UFs do
  ICA diferem em uma coluna. Mapear por coluna fixa sem separar os casos mistura
  meta de um ano com a do seguinte (aconteceu; ver comentário no gerador).
- **Encoding**: INEP e Tesouro publicam em **latin1**, não UTF-8.
- **IPEADATA (OData)**: ignora `$filter`/`$top`/`$select` — baixe a série
  inteira e filtre localmente.
- **SIDRA**: responde HTTP 200 com texto puro quando o município não existe.
- **PAM/SIDRA**: escolher o ano em duas passadas (coletar tudo → achar o ano
  máximo → filtrar), senão mistura anos.

---

## 5. Estado do roadmap

Fonte da verdade detalhada: **`docs/roadmaps/2026-07-29-raio-x-dossie-completo.md`**
(47 itens, 4 ondas, com fonte e esforço de cada um).

### Feito

- **Onda 1** completa (gêmeos estatísticos, pontualidade Siconfi, Saeb por
  escola, pirâmide etária, atendimento por faixa, quilombos/indígenas,
  assentamentos INCRA, frequência do Bolsa Família).
- **Onda 2** completa (violência, transporte escolar, mapa das escolas, PIB por
  setor, safra × abandono, analfabetismo × EJA, gravidez na adolescência,
  raio-X por escola, INSE × resultado, distribuição de proficiência, abstenção
  no ENEM).
- **Onda 3**: obras FNDE paralisadas, emendas parlamentares, convênios,
  CEIS/CNEP, **CAUC**, **Criança Alfabetizada (ICA)**.
- **Onda 4**: **#41 ciclo político** (reeleição/sucessão/alternância + as duas
  travas legais do fim de mandato).
- Fora da lista: **Relatório Histórico do Censo** (11 páginas, 3 Censos lado a
  lado, com cor/raça em série).

### Falta — onda 4, em ordem sugerida

| # | Item | Fonte | Nota para retomar |
|---|---|---|---|
| **3** | Densidade/dispersão de escolas; % população rural | dados **já locais** | Mais barato de todos: `escolas-territorio.json` já tem lat/long por escola e `ibge-municipal-boundary.ts` já projeta. Calcular dispersão ao centroide, distância máxima, escolas/100 km². Só a % de população rural precisa de SIDRA. |
| **40** | Perfil e rotatividade do secretário de educação | MUNIC | O repo **já baixa** a base MUNIC 2021 (`municipal-profile/governanca-educacional.ts` e `institucional.ts`, FTP do IBGE). Ver se há edição mais nova e quais variáveis do suplemento de educação servem. |
| **43** | Consórcios intermunicipais de educação | MUNIC | Mesma base do #40 — fazer os dois juntos. |
| **37** | Cobertura vacinal infantil | PNI/DataSUS | Avaliar OpenDataSUS (CSV) vs TabNet. |
| **38** | Desnutrição/obesidade (SISVAN) × PNAE | DataSUS | idem |
| **9** | Violência contra criança/adolescente notificada | SINAN | idem — indicador sensível: entra como contexto, nunca rótulo |
| **39** | Adesão ao Programa Saúde na Escola | MS | idem |
| **15** | Trabalho infantil municipal | Smartlab/MPT | verificar se há JSON público |
| **35** | Terras indígenas × escolas indígenas e línguas | FUNAI | cruzar com as escolas indígenas que já temos no Censo |
| **42** | Histórico de contas no TCE | portais estaduais | semi-manual, 27 portais diferentes |
| **46** | Radar de imprensa local (12 meses) | busca + IA | marcar como indício a confirmar |
| **47** | Roteiro de campo dinâmico ampliado para os blocos novos | template | as páginas novas já geram perguntas; falta consolidar no roteiro final |
| **5/10** | Fatores sem base oficial → perguntas de campo | — | contínuo |

### Adiado por decisão do usuário

- **#45 parecer do território por IA** (Gemini; a integração existe em
  `core/lib/fundeb-directed-report.ts`). O usuário pediu para deixar a IA fora
  desta fase: "deixe a ia de fora dessa rodada".

### Bloqueado (documentado, não tentar de novo sem fonte nova)

| # | Item | Motivo |
|---|---|---|
| 4 | Desastres reconhecidos (seca/cheia) | S2iD é app JSF sem endpoint aberto; via viável é Base dos Dados/BigQuery (semi-manual) |
| 12 | Salário de admissão **por setor** municipal | não existe em fonte aberta (CAGED só traz fluxo; RAIS microdados = semi-manual) |
| 19 | Alunos imigrantes / nacionalidade | Censo 2025 agrega por escola e **não publica nacionalidade** (conferidas as 237 colunas) |
| 26 | Quota municipal do salário-educação | consulta SIGEF do FNDE é fechada por **reCAPTCHA**. Gramática do AJAX mapeada no roadmap para quando cair. **Não contornar captcha.** |
| 36 | Escolas urbanas com ≥50% de alunos rurais | residência do aluno saiu dos microdados pós-LGPD |

Padrão adotado nos bloqueios: em vez de esconder, o relatório **imprime o que a
fonte sustenta** e transforma o resto em pergunta de campo (ex.: transporte por
embarcação virou "o transporte dessas escolas é por embarcação?" com a contagem
de escolas ribeirinhas embutida).

---

## 6. Como testar um PDF de verdade (sem subir a UI)

Script descartável na raiz, rodado com `npx tsx`:

```ts
// probe.mts — apagar depois
process.env.PORTAL_TRANSPARENCIA_TOKEN = "<chave>";
import { buildGoviaMunicipioCompleto } from "./core/lib/govia-compat";
import { generateMunicipalXrayHtml, mapMunicipalXrayModel } from "./core/lib/municipal-xray-template";
import { generateMunicipalXrayPdf } from "./core/lib/municipal-xray-pdf";
import { fetchMunicipalBoundary } from "./core/lib/ibge-municipal-boundary";
import { writeFileSync } from "node:fs";

const id = { codigo_ibge: "1302603", nome: "Manaus", uf: "AM" };
const [cur, base, boundary] = await Promise.all([
  buildGoviaMunicipioCompleto({ ...id, exercicio: 2026 }),
  buildGoviaMunicipioCompleto({ ...id, exercicio: 2025 }).catch(() => null),
  fetchMunicipalBoundary("1302603").catch(() => null),
]);
const model = mapMunicipalXrayModel({
  basePayload: base?.payload ?? {}, currentPayload: cur.payload,
  baseYear: 2025, currentYear: 2026, profile: null, boundary,
});
const { pdfBuffer, filename } = await generateMunicipalXrayPdf(generateMunicipalXrayHtml(model), "TESTE");
writeFileSync(`/tmp/${filename}`, pdfBuffer);
```

Para inspecionar página por página sem PDF, usar Playwright e
`page.locator("section.page").nth(i).screenshot()` — foi assim que cada página
nova foi conferida visualmente.

---

## 7. Próximo passo recomendado

1. Rodar `npm test` no Mac para confirmar que a base chegou íntegra (343 testes).
2. Gerar um Raio-X real (Manaus, `1302603`) e um Histórico do Censo, e ler os
   dois PDFs inteiros — é a única forma de ver o conjunto.
3. Retomar a onda 4 pelo **#3 (densidade/dispersão)**, que não precisa de
   fonte nova, e depois **#40 + #43 (MUNIC)**, que compartilham a mesma base já
   integrada.
