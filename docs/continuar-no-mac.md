# Continuar o trabalho — estado atual e o que falta

> Handoff escrito em **2026-07-29**, no fim de uma sequência de rodadas sobre os
> relatórios FUNDEB. Serve para retomar o trabalho em outra máquina (MacBook)
> sem reconstruir contexto.
>
> **Atualizado em 2026-07-29:** o trabalho foi consolidado na `main` — o
> repositório passou a ter **uma branch só**, e **push é deploy** (ver
> `CLAUDE.md` seção 7). A branch `migracao-flutter-para-next` citada abaixo não
> existe mais.

---

## 1. Setup na máquina nova

```bash
git clone <repo> && cd Sync
npm install
npx playwright install chromium   # obrigatório: os PDFs são gerados no Chromium
npm test                          # 438 testes — confirma que a base chegou íntegra
npm run dev                       # Next em :3100
```

### Variáveis de ambiente — vão à mão, não pelo git

Os arquivos de configuração (`.env`, `.env.local`, `cloudrun.env.yaml`) **não
estão no repositório**, e o motivo não é só o `.gitignore`: o **GitHub Push
Protection rejeita o push** por regra do repositório. A tentativa de 2026-07-29
foi recusada com quatro detecções — Google OAuth Client ID, Google OAuth Client
Secret, OpenRouter API Key e Google Cloud Service Account Credentials.

**Como levar a configuração para a máquina nova** (12 KB no total): copiar estes
três arquivos por AirDrop, pendrive, `scp` ou gerenciador de senhas, e colar na
raiz do projeto depois do clone.

```
.env
.env.local
cloudrun.env.yaml
```

É o único passo manual do setup, e substitui qualquer preenchimento variável por
variável.

**Se algum dia quiser versionar mesmo assim** (não recomendado): é preciso
aprovar cada segredo pelas URLs de *unblock* que o GitHub imprime no push
recusado. A partir daí `.env.local` passa a ser arquivo rastreado — o
`.gitignore` deixa de protegê-lo, qualquer edição local entra no próximo commit,
e as credenciais ficam no histórico de forma permanente. Nesse cenário,
**rotacionar é a única correção possível** se o repositório vazar: apagar o
arquivo depois não o remove dos commits antigos. As duas mais sensíveis são
`FIREBASE_SERVICE_ACCOUNT` (admin do projeto `globalconsultorias`: lê e escreve
todo o Firestore e personifica qualquer usuário) e `SUPABASE_SERVICE_ROLE_KEY`
(admin do Postgres); `GEMINI_API_KEY` e `OPENROUTER_API_KEY` são faturáveis.

### Dois ajustes obrigatórios no macOS

O `.env.local` foi escrito na máquina Windows/WSL e traz dois caminhos que não
existem no Mac — eles resolvem onde ficam os anexos de contrato e os dados
brutos (a pasta irmã `Sync-Arquivos/`, que **não** está no git):

```bash
CONTRATOS_ASSETS_DIR="/Users/<você>/.../Sync-Arquivos/assets-contratos"
DADOS_BRUTOS_DIR="/Users/<você>/.../Sync-Arquivos/dados-brutos"
```

Sem ajustar, a geração de kit documental não encontra os anexos. O resto
(relatórios FUNDEB, Raio-X, Histórico do Censo) funciona sem essa pasta, porque
lê apenas os JSON de `data/`.

### O que ficou fora do repositório de propósito

- `.code-review-graph/` (455 MB) — cache do grafo de código, se reconstrói sozinho.
- `.claude/skills/` e `.superpowers/` — ferramentas instaladas por máquina.
- `.env.local.bak-pre-migracao` — backup de config anterior à migração Firebase;
  só confundiria.
- `Sync-Arquivos/` — a pasta irmã com PDFs, DOCX e fontes brutas de negócio
  (ver `CLAUDE.md`, seção "O que NÃO fica no repositório"). Copiar à mão.

### Verificação rápida

```bash
npm test              # 438 testes, 41 arquivos — devem passar todos
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
- ~~Os scripts de `npm run build:flutter:web` apontam para um caminho Linux~~ —
  **resolvido em 2026-07-29: o app Flutter foi apagado**, junto com o bundle
  `public/flutter-web/` e todos os scripts `flutter`/`apk` do `package.json`.
  Nada mais depende do SDK do Flutter.

---

## 2. O que os três relatórios são hoje

| Relatório | Rota | Páginas | Contrato de páginas |
|---|---|---|---|
| **Raio-X Municipal** | `POST /api/modulos/levantamento-fundeb/raio-x` | **42** | `PAGINAS_ESPERADAS` em `core/lib/municipal-xray-pdf.ts` |
| **Ofício de documentos** | `POST /api/modulos/levantamento-fundeb/oficio-documentos` | **4** | `PAGINAS_ESPERADAS` em `core/lib/oficio-documentos-pdf.ts` |
| **Diagnóstico FUNDEB** (Levantamento) | `POST /api/modulos/levantamento-fundeb/pdf?tipo=levantamento` | 10 (+5 anexos) | gerador Python (`kit_padrao_pdf_rocha_prime/`) |
| **Histórico do Censo Escolar** | `POST /api/modulos/levantamento-fundeb/historico-censo` | **11** | `PAGINAS_ESPERADAS` em `core/lib/censo-historico-pdf.ts` |

Todos aparecem como cards em
`app/(sync)/modulos/levantamento-fundeb/page.tsx`, baixam o PDF **e** arquivam o
JSON na ficha da cidade (Firestore, coleção `cityReports`, tipos `raio_x`,
`diagnostico_fundeb`, `historico_censo`).

### Regra dura do contrato de páginas

Ao adicionar uma página no template, **subir o número em
`municipal-xray-pdf.ts` (ou `censo-historico-pdf.ts`) e no teste**. A numeração
dos rodapés é automática (contador `prox()`), e o teste de sequência falha se
alguma página não usar o contador. O card da UI também mostra a contagem.

**O contrato não pega conteúdo cortado — e contar folhas do PDF também não.**
O CSS fixa a folha com `overflow:hidden`, então conteúdo que estoura a altura
**não** vira folha extra: ele é apagado do PDF, sem erro e sem aviso. Contar
`/Type /Page` no arquivo gerado é inútil para isso — com `overflow:hidden` o
total é sempre igual ao número de seções, por construção. (Esta seção já
ensinou esse comando como se detectasse transbordo; não detecta.)

A medida certa compara, dentro do navegador, `scrollHeight` contra
`clientHeight` de cada `.page-body`. Está em **`core/lib/pdf-corte.ts`** e roda
sozinha nos três geradores, em dois tempos:

1. `ajustarParaCaber` encolhe o conteúdo da página que estourou (piso de 88%,
   passo de 1%), porque **o volume varia por município**: a mesma página cabe
   em Ibateguara e estoura em Manaus. Ajustar o template para o pior caso
   desperdiçaria espaço em quase todos os 5.570.
2. `assertSemCorte` falha a geração se nem no piso coube — aí é conteúdo
   demais na página, e quem escreve o template precisa dividir o bloco.

Ao acrescentar conteúdo, gere o PDF de um município **grande** (Manaus) e de um
**pequeno** (Ibateguara): o log imprime quais páginas foram ajustadas e em que
escala. Escala perto de 88% é sinal de que a página está no limite.

---

## 3. Regras de projeto que não estão no código

Foram decididas ao longo das rodadas e valem para qualquer bloco novo:

1. **Todo número imprime fonte e ano.** Sem exceção.
2. **Indicador sensível** (violência, gravidez na adolescência, cor/raça) entra
   como **contexto explicativo**, nunca como rótulo do município.
3. **Afirmação sem fonte vira pergunta de campo** — com o dado que temos
   embutido na pergunta. Nunca preencher lacuna com estimativa silenciosa.
4. **Ausência ≠ zero.** `"--"`, `"-"`, campo vazio → `null` gracioso.
4b. **Comparar duas fatias exige as duas réguas.** Diferença em pontos
   percentuais sozinha mente nos extremos: em Manaus a população rural é 1,0%
   e a matrícula rural 5,4% — 4,4 pontos, que parecem ruído, mas são **5,4
   vezes** a fatia. A razão sozinha mente do outro lado (0,2% contra 0,6%
   triplica sem significar nada). O classificador só afirma quando **as duas
   concordam**; ver `paginaDensidadeRede` em `municipal-xray-template.ts`.
   Quando os denominadores diferem, dizer isso na página.
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
8b. **Só um documento é endereçado à prefeitura:** o Ofício de solicitação de
   documentos (`oficio-documentos-template.ts`). Raio-X, Diagnóstico e
   Histórico do Censo são análise interna. A diferença manda no tom: no ofício
   o contexto imprime o registro público e para ("a MUNIC 2021 não registra
   CAE — confirmar a situação atual"), nunca o veredito ("sem CAE o PNAE fica
   irregular"). Há teste que falha se um juízo voltar para lá.
8c. **No ofício, só entra pergunta que move receita ou trava repasse.** Foi o
   corte de 2026-07-30: de 30 perguntas para 15. Saíram UNDIME, acompanhamento
   jurídico, organograma, manutenção predial, urbanismo, formação continuada e
   absenteísmo — descrevem a máquina sem mexer no dinheiro, e num ofício com
   prazo cada pergunta gasta a paciência de quem responde. As seções passaram
   a se chamar pelo efeito financeiro ("o piso de 70% do fundo"), não pelo tema
   administrativo. Rotatividade e consórcio seguem vivos no Raio-X, que é
   interno. Há teste que falha se as cortadas voltarem.
9. **Flutter não existe mais.** Foi apagado do repositório em 2026-07-29; se
   precisar consultar uma tela antiga, use o histórico do git. Não recriar.
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
- **SIDRA v3 com classificação**: colchetes e barra vertical precisam ir
  **percent-encoded** (`%5B`, `%5D`, `%7C`). Com os caracteres crus a API
  responde **HTTP 200 com corpo vazio** — não dá erro, só não devolve nada.
  Custou uma rodada de depuração no agregado 10211.
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
  travas legais do fim de mandato), **#3 densidade/dispersão** (página
  "Densidade e dispersão"), **#40 perfil do titular da educação** (página
  "Quem dirige a educação") e **#48 declaração étnica** (página "Declaração
  étnica"), todas de 2026-07-29/30.
- Fora da lista: **Relatório Histórico do Censo** (11 páginas, 3 Censos lado a
  lado, com cor/raça em série).

### Falta — onda 4, em ordem sugerida

| # | Item | Fonte | Nota para retomar |
|---|---|---|---|
| **37** | Cobertura vacinal infantil | PNI/DataSUS | **É o próximo bloco de fonte nova.** Avaliar OpenDataSUS (CSV) vs TabNet. |
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

1. Rodar `npm test` no Mac para confirmar que a base chegou íntegra (438 testes).
2. Gerar um Raio-X real (Manaus, `1302603`) e um Histórico do Censo, e ler os
   dois PDFs inteiros — é a única forma de ver o conjunto.
3. Onda 4: #3, #40, #41, #47 e #48 entregues; **#43 confirmado sem fonte
   pública** (ver roadmap). O que resta são os blocos de saúde (#37 vacinação,
   #38 SISVAN, #39 PSE, #9 SINAN), o #35 (FUNAI), o #42 (TCE, semi-manual) e o
   #46 (radar de imprensa). O #45 (parecer por IA) segue adiado por decisão
   sua.
