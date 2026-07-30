# Raio-X municipal — roadmap do dossiê completo

> Objetivo: transformar o Raio-X no panorama total do município — FUNDEB e
> contexto geral — para a equipe técnica. Extensão não é problema; afirmação
> sem fonte é. Criado em 2026-07-29, a partir da lista aprovada pelo Adriel.
>
> Princípio de projeto (o mesmo que tirou o "já evidenciado" do Levantamento):
> **o relatório só afirma o que a fonte sustenta, e transforma o resto em
> pergunta de campo precisa.** Fator indireto não é imensurável — é mensurável
> por outra fonte: rio que isola escola aparece no transporte por embarcação do
> Censo; tráfico que impede prova aparece na participação do Saeb por escola
> (que é a Cond. II do VAAR); fazenda que paga bem aparece no PIB agro, no
> salário de admissão do setor e no calendário de safra cruzado com o abandono.

Legenda de esforço: ● dado local já integrado · ◐ fonte pública, falta script
· ○ semi-manual · ✍ campo · ✦ IA.
Status: `feito` · `em curso` · `pendente`.

## Onda 1 — em execução

| # | Item | Fonte | Esforço | Status |
|---|------|-------|---------|--------|
| 44 | Gêmeos estatísticos — percentil do município entre os ~semelhantes (porte da rede, UF) em cada indicador local | datasets locais (ponderadas, VAAR, SIOPE, remuneração) | ● | feito |
| 25 | Pontualidade Siconfi (extrato de entregas) → risco de habilitação VAAT | `apidatalake.tesouro.gov.br/ords/siconfi/tt/extrato_entregas?id_ente=&an_referencia=` (validada 2026-07-29) | ◐ | feito |
| 7 | Participação no Saeb por escola — nomeia a escola que derrubou a Cond. II do VAAR | INEP, IDEB por escola (marcador ND = participação < 80%) | ◐ | feito |
| 17 | Pirâmide etária + nascimentos → projeção de coortes e receita FUNDEB futura | SIDRA (Censo 2022, tab. 9514; Registro Civil, tab. 2612) | ◐ | feito |
| 18 | Taxa de atendimento por faixa etária (população × matrículas de todas as redes) | SIDRA (9514) + Censo Escolar (totais por etapa, dataset local) — na página de demografia | ◐ | feito |
| 33 | Quilombos certificados × escolas declaradas quilombolas → ganho apurado novo | IBGE Censo 2022 (tab. 8176/8175, população quilombola/indígena em idade escolar × matrículas ponderadas) | ◐ | feito |
| 34 | Assentamentos INCRA × escolas de assentamento declaradas | INCRA dados abertos (acervo fundiário, DBF) | ◐ | feito |
| 16 | Descumprimento da condicionalidade de frequência do Bolsa Família — censo mensal de evasão | MDS/SICON dados abertos (misocial) | ◐ | feito |
| 45 | Parecer do território por IA — narrativa que costura o dossiê, cada frase citando a página-fonte | Gemini (integração existente em `fundeb-directed-report.ts`) | ✦ | pendente |

## Onda 2 — contexto que explica resultado

| # | Item | Fonte | Esforço | Status |
|---|------|-------|---------|--------|
| 6 | Homicídios por 100 mil com recorte juvenil (proxy publicável de território conflagrado) | Atlas da Violência via IPEADATA (AVIOL12_HOMIC/HOMICJ/THOMIC — `dados:violencia`) | ◐ | feito |
| 1 | Transporte escolar por tipo — embarcação, van, ônibus; frota própria × terceirizada | microdados Censo Escolar 2025 (`dados:escolas-territorio`). O tipo de veículo saiu da divulgação pós-LGPD: entregue transporte público total + escolas ribeirinhas; embarcação virou pergunta de campo | ◐ | feito |
| 2 | Mapa das escolas sobre o contorno do território (lat/long, matrícula, IDEB) | microdados Censo Escolar (LATITUDE/LONGITUDE da Tabela_Escola) × malha IBGE — página "Mapa das escolas" | ◐ | feito |
| 4 | Desastres reconhecidos (seca/cheia) últimos 5 anos | S2iD/Defesa Civil — **bloqueado**: app JSF sem endpoint aberto (download exige sessão); via viável é Base dos Dados/BigQuery (semi-manual ○) | ○ | pendente |
| 11 | Composição do PIB municipal (VAB agro/indústria/serviços/adm.) | SIDRA (tab. 5938) | ◐ | feito |
| 12 | Custo de oportunidade do estudo — salário de admissão por setor × EJA/médio | Parcial: salário médio (CEMPRE) já na página de emprego; salário de admissão POR SETOR municipal não existe em fonte aberta (CAGED/IPEADATA só traz fluxo; RAIS microdados = ○) | ○ | parcial |
| 13 | Calendário de safra × sazonalidade do abandono | PAM/SIDRA (agregado 5457, valor por cultura, consulta viva) — cultura dominante + janela de colheita na página de economia; a sazonalidade do abandono não é pública e virou pergunta de campo | ◐ | feito |
| 14 | Analfabetismo (Censo 2022) × matrícula EJA = demanda reprimida | SIDRA (tab. 9543) | ◐ | feito |
| 20 | Gravidez na adolescência (Registro Civil por idade da mãe) | SIDRA (tab. 2612, c240) | ◐ | feito |
| 21 | Raio-X por escola: IDEB, fluxo, distorção, INSE, complexidade, adequação docente | INEP indicadores por escola (INSE 2023, ICG 2021, TDI/rend/AFD 2024 — `dados:indicadores-escolas`) | ◐ | feito |
| 22 | INSE × resultado — separa escola fraca de escola de contexto duro que performa | INEP (cruzamento em `indicadores-escolas.ts`) | ◐ | feito |
| 23 | Distribuição de proficiência (% abaixo do básico), não só média | planilha de resultados Saeb 2023 (xlsb municipal, rede municipal — `dados:saeb-distribuicao`; microdado é mascarado) | ◐ | feito |
| 8 | Abstenção no ENEM vs UF | microdados ENEM 2024 (`dados:enem`) — por município de PROVA (residência não é publicada pós-LGPD), régua da UF, na página de economia | ◐ | feito |

## Onda 3 — dinheiro além do já coberto

| # | Item | Fonte | Esforço | Status |
|---|------|-------|---------|--------|
| 26 | Quota municipal do salário-educação (mensal) | FNDE — **bloqueado**: consulta SIGEF (`sigefweb/liberacoes`, programa 51=QUOTA) é fechada por reCAPTCHA; via alternativa são as planilhas do portal (estrutura instável, semi-manual ○). Mapeada a gramática do AJAX (`/liberacoes/ajax/ano/{ano}`, `/estado/{uf}`) para quando o captcha cair | ○ | pendente |
| 28 | Emendas parlamentares para a educação do município | Portal da Transparência (download de dados bulk → `dados:emendas` → `emendas-municipais.ts`) — página "Dinheiro federal". Só emendas com município de aplicação identificado; a fatia estadual/nacional difusa não entra (dito na página) | ◐ | feito |
| 29 | Convênios vigentes + CAUC em tempo real | Convênios: Portal da Transparência (`/convenios?codigoIBGE=` + `tipoConvenente=municipal`) na página "Dinheiro federal". CAUC: CSV diário do Tesouro (CKAN, sem chave) em `cauc-requisitos.ts` → página "Requisitos fiscais", com os 5 itens de educação nomeados (5.1, 5.5, 5.6, 5.7 e o Anexo 8 ao SIOPE) | ◐ | feito |
| 30 | Obras FNDE paralisadas com valor parado (destacar; dado já coletado) | `fnde-obras.ts` (obras críticas estruturadas) — página "Obras FNDE" | ● | feito |
| 31 | Sanções CEIS/CNEP do ente e de fornecedores da educação | Portal da Transparência (consulta viva) — o que a fonte sustenta: (a) o ente sancionado (busca nominal) e (b) sanções aplicadas pela própria prefeitura. O rol de fornecedores da educação não é público → pergunta de campo | ◐ | feito |
| 27 | Precatórios do FUNDEF — existência, fase, regra dos 60% | TRFs/portais | ○ | pendente |
| 32 | Judicialização (vaga em creche etc.) | DataJud/CNJ | ○ | pendente |
| 24 | Alfabetização — Criança Alfabetizada (adesão/resultado) | INEP — ICA por município (`dados:alfabetizacao`): série 2023–2025, **metas pactuadas até 2030**, nível e participação → página "Alfabetização". É o único indicador do dossiê com meta do próprio ente, então a página afirma "cumpriu / não cumpriu" sem ressalva | ◐ | feito |
| 36 | Escolas urbanas com ≥50% de alunos rurais (calcular a captura, não só recomendá-la) | **bloqueado**: a residência do aluno saiu dos microdados públicos pós-LGPD — o cálculo só é possível com acesso restrito (Educacenso do próprio ente); segue como recomendação + pergunta de campo | ✍ | bloqueado |

> Nota da onda 3: a API do Portal da Transparência exige a chave gratuita em
> `PORTAL_TRANSPARENCIA_TOKEN` (`.env.local` e Cloud Run). Sem ela, convênios
> e sanções degradam para `null` e a página imprime a ausência.
>
> Entrega irmã fora desta lista (2026-07-29): **Relatório Histórico do Censo
> Escolar** — 10 páginas comparando os três últimos Censos (matrículas por
> rede/etapa, integral, docentes, infraestrutura, sinais automáticos), 100%
> dados locais. Rota `/api/modulos/levantamento-fundeb/historico-censo`,
> template `censo-historico-template.ts`, terceiro card na Central.

## Onda 4 — pessoas, saúde, gestão

| # | Item | Fonte | Esforço | Status |
|---|------|-------|---------|--------|
| 15 | Trabalho infantil municipal | Smartlab/MPT | ◐ | pendente |
| 19 | Migração e alunos imigrantes | **bloqueado**: a divulgação do Censo 2025 agrega a matrícula por escola (237 colunas em `Tabela_Matricula`) e **não publica nacionalidade** — nenhuma coluna NAC/ESTRANG/PAIS. O recorte só existe no Educacenso do próprio ente | ✍ | bloqueado |
| 37 | Cobertura vacinal infantil | PNI/DataSUS | ◐ | pendente |
| 38 | Desnutrição/obesidade (SISVAN) × PNAE | DataSUS | ◐ | pendente |
| 39 | Adesão ao Programa Saúde na Escola | MS | ◐ | pendente |
| 9 | Violência contra criança/adolescente notificada | SINAN | ◐ | pendente |
| 40 | Perfil e rotatividade do secretário de educação | MUNIC (SIDRA **7296** — nível de instrução e área de formação do titular; **7282** — caracterização do órgão gestor) → página "Quem dirige a educação". **Rotatividade não existe na fonte**: nenhum dos 187 agregados da MUNIC nem as 200 colunas da aba Educação da planilha 2021 têm variável de posse, mandato ou tempo no cargo (conferido em 2026-07-29) — virou pergunta de campo | ◐ | feito (parcial: sem rotatividade) |
| 41 | Alternância política — reeleição, troca de partido, ano de transição | TSE (datasets locais 2020 × 2024, `alternancia-politica.ts`) → página "Ciclo político", que soma as **duas travas legais do fim de mandato**: vedação de transferência voluntária nos 3 meses antes do pleito (Lei nº 9.504/1997, art. 73, VI, "a") e LRF art. 42/21 | ● | feito |
| 43 | Consórcios intermunicipais de educação | **bloqueado**: não existe fonte pública. Varredura do catálogo inteiro do SIDRA em 2026-07-29 — o único agregado de consórcio é da PNSB (saneamento, tabela 349); a MUNIC 2021 só tem `MLEG09` (operação urbana consorciada) e `MSAU275/276` (consórcios de saúde), nada em educação; o cadastro de entes do SICONFI (`/tt/entes`, 5.598 registros) só tem esferas M/E/U/D, sem consórcios. Entregue como pergunta de campo na página "Quem dirige a educação" | ○ | bloqueado |
| 35 | Terras indígenas × escolas indígenas e línguas | FUNAI | ◐ | pendente |
| 42 | Histórico de contas no TCE | portais estaduais | ○ | pendente |
| 3 | Densidade/dispersão de escolas; % população rural | Coordenadas do Censo Escolar (dataset local) + área do IBGE + Censo 2022 por situação do domicílio (SIDRA **10211**, validada 2026-07-29) — página "Densidade e dispersão" (`densidade-rede.ts`). Distâncias em haversine ao núcleo urbano (média das escolas urbanas, proxy da sede); envergadura = par mais distante | ● | feito |
| 48 | **Subdeclaração indígena/quilombola — Censo Escolar × Censo Demográfico.** Página "Declaração étnica": a corrente de três elos — população indígena 0–14 (IBGE, agregados 8175/8176) → matrícula com cor/raça indígena declarada (Censo Escolar, `corRacaTotais` em `escolas-territorio.ts`) → matrícula no segmento indígena do FUNDEB (ponderação 1,40–2,17). Os dois vãos têm causas distintas, e só o segundo vira dinheiro: a ponderação segue a **classificação da escola**, não a cor/raça do aluno. Manaus: 71.691 indígenas, 15.647 de 0–14, **1.088** declarados na cor/raça e **142** no segmento — 946 matrículas fora da ponderação, 13,1% do registro chegando ao fundo. Regra dura respeitada: a página aponta lacuna de **registro** e nunca atribui pertencimento nem estima quem "deveria" se declarar | ● | feito |
| 46 | Radar de imprensa local (12 meses), marcado como indício a confirmar | busca + IA | ✦ | pendente |
| 47 | Roteiro de campo dinâmico ampliado para os blocos novos | Recolhe as perguntas que "Densidade e dispersão", "Quem dirige a educação" e "Declaração étnica" geram, cada uma com o número apurado embutido. O roteiro passou de 2 para **3 páginas** e o corte deixou de ser por índice fixo: `distribuirRoteiro` equilibra as seções minimizando a página mais cheia. Motivo: com `slice(0,3)`/`slice(3)` a página cabia exatamente, e acrescentar pergunta transbordava no PDF **sem** mudar a contagem de `<section class="page">` — o teste de contrato não pegava | ● | feito |
| 5/10 | Fatores sem base oficial (facção por escola, fundiário) → perguntas de campo contextualizadas | — | ✍ | contínuo |

## Regras para cada bloco novo

1. Padrão de dados igual ao existente: script offline em `scripts/dados/` →
   JSON versionado em `data/` → leitor em `core/lib/` com `null` gracioso →
   bloco no template → teste. Fonte viva (Siconfi, SIDRA) entra no
   `Promise.all` do `govia-compat` e flui pelo `relatorio_dirigido_base`.
2. Todo número imprime fonte e ano. Indicador sensível (violência, gravidez)
   entra como contexto explicativo, nunca como rótulo do município.
3. O que a fonte não sustenta vira pergunta no roteiro de campo — com o dado
   que temos embutido na pergunta.
4. O contrato de páginas (`municipal-xray-pdf.ts`) sobe junto com cada bloco;
   a numeração agora é automática (contador no template).
