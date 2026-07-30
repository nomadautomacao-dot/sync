# Dossiê das Escolas

> Unidade de análise: **a escola**. Um bloco por unidade da rede municipal.
> Volume: 30 a 500+ blocos, conforme o município.

---

## 1. Por que este é o carro-chefe

É o único dossiê que **não existe em lugar nenhum**. O INEP publica microdado
bruto — arquivos de centenas de megabytes que exigem alguém que saiba lê-los. O
QEdu mostra escola a escola, mas separado por indicador e sem o fator de
ponderação. A secretaria tem o Educacenso, que mostra o que ela declarou, não o
que isso produziu.

Aqui as três coisas ficam na mesma linha: **o que a escola declarou** (matrícula,
localização, cor/raça), **o que ela produziu** (IDEB, Saeb, aprovação, abandono,
distorção) e **em que condição** (INSE, complexidade de gestão, docentes com
formação adequada). Para o diretor, é a primeira vez que ele se vê comparado às
outras escolas da própria rede com dado oficial. Para o secretário, é o mapa de
onde intervir.

E há o laço com o dinheiro: localização diferenciada declarada é fator de
ponderação. A escola que está em território quilombola e não foi declarada como
tal aparece nomeada — e cada uma dessas vale de 1,40 a 2,17 contra 1,00.

---

## 2. Como o dossiê é montado

Três datasets locais, unidos pelo **código da escola** (`CO_ENTIDADE` do INEP):

```
escolas-territorio.json   ──┐
ideb-escolas-2023.json    ──┼── join por `codigo` ──> um registro por escola
indicadores-escolas.json  ──┘
```

Nenhum deles cobre 100% da rede sozinho, e as coberturas são diferentes — o que
tem consequência direta no documento (seção 5).

---

## 3. Campos disponíveis hoje, por escola

### 3.1 De `escolas-territorio.ts` (cobertura: toda a rede municipal ativa)

| Campo | Tipo | Observação |
|---|---|---|
| `codigo` | string | chave do join |
| `rural` | boolean | `TP_LOCALIZACAO` = 2 → fator +15% no campo |
| `dif` | number | 0 = não diferenciada; 1 assentamento, 2 terra indígena, 3 quilombola, 8 ribeirinha |
| `lat` / `lng` | number \| null | coordenada declarada — permite distância ao núcleo |
| `matriculas` | number \| null | `QT_MAT_BAS` |
| `transporte` | number \| null | alunos em transporte público |
| `racas` | number[6] \| null | `[ND, branca, preta, parda, amarela, indígena]` |

### 3.2 De `ideb-escolas.ts` (cobertura: só escolas na divulgação do IDEB)

| Campo | Tipo | Observação |
|---|---|---|
| `nome` | string | **a única fonte de nome hoje** — ver seção 5 |
| `ai` / `af` | objeto \| null | anos iniciais / anos finais, cada um com: |
| ↳ `aprovacao` | number \| null | % |
| ↳ `rendimento` | number \| null | indicador de fluxo |
| ↳ `lp` / `mt` | number \| null | proficiência Saeb em Língua Portuguesa e Matemática |
| ↳ `media` | number \| null | média padronizada |
| ↳ `ideb` | number \| null | |
| ↳ `meta2021` | number \| null | última meta projetada pelo INEP; não há projeção após 2021 |
| ↳ `nd` | boolean | **resultado retido: participação < 80% no Saeb** — é a Cond. II do VAAR, nomeada por escola |

### 3.3 De `indicadores-escolas.ts` (cobertura: escolas com Saeb 2023)

| Campo | Tipo | Observação |
|---|---|---|
| `nome` | string | segunda fonte de nome |
| `inse` | number \| null | Indicador de Nível Socioeconômico, escala contínua |
| `inseNivel` | number \| null | 1 (mais vulnerável) a 8 |
| `inseAlunos` | number \| null | respondentes — peso da média |
| `icg` | number \| null | complexidade de gestão, 1 a 6 |
| `tdiFund` | number \| null | distorção idade-série no fundamental, % |
| `aprovacaoFund` | number \| null | % |
| `abandonoFund` | number \| null | % |
| `docentesAdequadosFund` | number \| null | % com formação adequada (Grupo 1) |

**Total: 22 campos por escola**, quando os três datasets cobrem a unidade.

---

## 4. Estrutura do documento

### Capa e sumário (altura fixa)
Nome do município, contagem de escolas, e o resumo que só existe porque o
dossiê inteiro foi computado: pior IDEB, maior abandono, maior distorção,
escolas retidas por participação, escolas sem coordenada, escolas em
localização diferenciada.

### Painel da rede (altura fixa, 2–3 folhas)
As distribuições que dão sentido às páginas seguintes: histograma de IDEB,
dispersão INSE × IDEB (a leitura que separa escola que vai mal de escola que
vai mal **para o seu contexto**), matrícula por faixa de porte.

### Blocos por escola (fluxo — o corpo do dossiê)
Um bloco por escola, com `break-inside: avoid`. Ordenação padrão: **sinal mais
grave primeiro** — retidas por participação, depois pior IDEB, depois maior
abandono. Cada bloco:

```
┌────────────────────────────────────────────────────────────┐
│ NOME DA ESCOLA                          código · zona · dif │
│ ─────────────────────────────────────────────────────────── │
│ matrículas · transporte · coordenada · distância ao núcleo   │
│                                                              │
│ ANOS INICIAIS       ANOS FINAIS        CONTEXTO              │
│ IDEB · LP · MT      IDEB · LP · MT     INSE (nível) · ICG    │
│ aprovação           aprovação          TDI · abandono        │
│                                        docentes adequados    │
│                                                              │
│ [linha de leitura — só quando há algo a dizer]              │
└────────────────────────────────────────────────────────────┘
```

A **linha de leitura** é o que diferencia isto de uma planilha impressa, e só
aparece quando um critério objetivo dispara: resultado retido por participação,
IDEB abaixo da média da própria rede com INSE acima da média (a escola que
deveria ir melhor), abandono acima de X%, localização diferenciada declarada
(com o fator que ela vale), escola sem coordenada.

### Índice remissivo (fluxo, ao final)
Escolas em ordem alfabética com a página de cada uma. Num dossiê de 400
escolas, sem índice o documento é inutilizável.

---

## 5. O que hoje falta, e o que resolve

### 5.1 Escola sem nome

`escolas-territorio.json` guarda o código, não o nome. O nome vem do join com
`ideb-escolas` ou `indicadores-escolas`, que só cobrem escolas avaliadas pelo
Saeb. **Creche e pré-escola pura ficam sem nome** — e numa rede municipal isso
é uma fatia grande.

O dossiê **não pode** imprimir "Escola 29012345" e seguir adiante como se fosse
normal. Duas saídas, nesta ordem de preferência:

1. **Regerar o dataset com `NO_ENTIDADE`** (seção 5.3). É a solução certa.
2. Enquanto não, o bloco imprime o código com a etiqueta explícita
   *"nome não disponível na divulgação do IDEB — consultar Educacenso"*, e o
   sumário conta quantas escolas estão nessa situação.

### 5.2 Infraestrutura por escola não existe no dataset

Hoje a infraestrutura é **agregada do município** (`inep-censo-municipal-*.json`,
~40 campos: água potável, esgoto, cozinha, internet, banda larga, laboratórios,
quadra, acessibilidade). O Raio-X mostra o percentual da rede pública.

Os microdados têm isso **por escola** (`IN_AGUA_POTAVEL`, `IN_ESGOTO_REDE_PUBLICA`,
`IN_INTERNET`, `IN_BANDA_LARGA`, `IN_LABORATORIO_INFORMATICA`,
`IN_LABORATORIO_CIENCIAS`, `IN_QUADRA_ESPORTES`, `IN_BIBLIOTECA`,
`IN_ACESSIBILIDADE_*`, `IN_BANHEIRO_PNE`, `QT_SALAS_UTILIZADAS`…). Com eles, o
bloco de cada escola ganharia a linha que o diretor mais quer ver — e a rede
ganharia o ranking de gargalo físico por unidade.

### 5.3 Como regerar o dataset

O script já existe e já lê o zip dos microdados:

```bash
node scripts/dados/gerar-escolas-territorio.mjs <microdados_censo_escolar_2025.zip>
```

O que muda é a lista de colunas guardadas em `gerar-escolas-territorio.mjs`.
Colunas a acrescentar, em ordem de valor:

| Coluna | Ganho |
|---|---|
| `NO_ENTIDADE` | resolve o problema do nome para toda a rede |
| `IN_AGUA_POTAVEL`, `IN_ESGOTO_REDE_PUBLICA` | condição sanitária por escola |
| `IN_INTERNET`, `IN_BANDA_LARGA` | conectividade por escola |
| `IN_BIBLIOTECA`, `IN_QUADRA_ESPORTES`, `IN_LABORATORIO_*` | espaço pedagógico |
| `IN_ACESSIBILIDADE_*`, `IN_BANHEIRO_PNE` | acessibilidade — cruza com educação especial |
| `QT_SALAS_UTILIZADAS` | capacidade física × matrícula = lotação |
| `QT_DOC_BAS` | docentes por escola → razão aluno/docente por unidade |
| `IN_MANT_ESCOLA_PRIVADA_*` / etapas ofertadas | perfil de oferta |

**Bloqueio atual:** `DADOS_BRUTOS_DIR` no `.env.local` aponta para
`/home/AdrielT87/...`, caminho da máquina Windows. Neste Mac o zip não está
acessível. Baixar de
`https://download.inep.gov.br/microdados/microdados_censo_escolar_2025.zip`
(~2 GB) e ajustar a variável resolve.

> Esta é a **única** dependência de dado bruto de todos os oito dossiês. Os
> outros sete rodam com o que já está no repositório.

---

## 6. Regras específicas deste dossiê

1. **INSE e cor/raça são contexto, nunca rótulo.** O dossiê não classifica
   escola como "pobre" nem aluno como nada. INSE entra para responder *"esta
   escola vai mal para o contexto dela?"*, que é uma pergunta de gestão.
2. **Ranking de escola não vira exposição de diretor.** A ordenação por sinal
   grave é ferramenta de priorização; o texto de cada bloco fala do que a rede
   pode fazer, não de quem falhou.
3. **Cobertura declarada por dataset.** O sumário diz quantas escolas têm IDEB,
   quantas têm INSE e quantas têm coordenada. Um bloco com metade dos campos em
   `—` precisa que o leitor saiba por quê.
4. **Nenhuma escola some.** Escola sem nenhum dado além do código ainda aparece,
   com todos os campos em `—`. Ela existe na rede e o documento tem de mostrar
   que ela existe.
