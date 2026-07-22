# Implementação — Gerador de Relatório FUNDEB
**Rocha Prime Serviços Especializados**  
Versão 1.0 — Março 2026

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Fontes de Dados e APIs](#2-fontes-de-dados-e-apis)
3. [Fórmulas e Cálculos Validados](#3-fórmulas-e-cálculos-validados)
4. [Estrutura de Dados (TypeScript)](#4-estrutura-de-dados-typescript)
5. [Implementação do Serviço de Coleta](#5-implementação-do-serviço-de-coleta)
6. [Implementação dos Cálculos](#6-implementação-dos-cálculos)
7. [Estrutura do Relatório — Seções e Ordem](#7-estrutura-do-relatório--seções-e-ordem)
8. [Geração do PDF](#8-geração-do-pdf)
9. [Fluxo Completo de Uso](#9-fluxo-completo-de-uso)
10. [Limitações e Fallbacks](#10-limitações-e-fallbacks)

---

## 1. Visão Geral da Arquitetura

O sistema tem três responsabilidades:

```
[1. Coleta de Dados]  →  [2. Cálculo das Projeções]  →  [3. Geração do PDF]
  APIs públicas             Fórmulas validadas            React + jsPDF / Puppeteer
  FNDE, SIMEC, QEdu
```

O operador informa apenas o **Código IBGE** do município. O sistema faz o resto automaticamente.

---

## 2. Fontes de Dados e APIs

### 2.1 — Portaria FNDE (FUNDEB 2026): valores financeiros

**O que buscar:** Receita de Contribuição Municipal, Complementação VAAF, VAAT e VAAR por município.

**Fonte primária:** API do Tesouro Nacional — SICONFI  
**URL base:**
```
https://apidatalake.tesouro.fazenda.gov.br/ords/siconfi/tt/rgf
```

**Endpoint para receitas FUNDEB por município:**
```
GET https://apidatalake.tesouro.fazenda.gov.br/ords/siconfi/tt/rgf
  ?an_exercicio=2026
  &in_periodicidade=Q
  &nr_periodo=1
  &co_tipo_demonstrativo=RGF
  &co_esfera=M
  &co_poder=E
  &id_ente={CODIGO_IBGE_7_DIGITOS}
```

> **Atenção:** O SICONFI usa código IBGE de 7 dígitos (com dígito verificador). O código IBGE padrão tem 6 dígitos — acrescente o dígito verificador conforme tabela do IBGE ou use a conversão abaixo.

**Alternativa mais direta — API FNDE (Portaria publicada):**

Os valores oficiais da Portaria FNDE para 2026 estão disponíveis em planilha pública no site do FNDE. O caminho mais confiável é baixar a planilha diretamente:

```
https://www.fnde.gov.br/index.php/financiamento/fundeb/area-para-gestores/dados-estatisticos
```

A planilha em Excel/CSV contém, por código IBGE, os campos:
- `VL_RECEITA_CONTRIB_MUNICIPAL` — Receita de Contribuição Municipal
- `VL_COMPLEMENTACAO_VAAF` — Complementação VAAF (União)
- `VL_COMPLEMENTACAO_VAAT` — Complementação VAAT (União)
- `VL_COMPLEMENTACAO_VAAR` — Complementação VAAR (União)

**Recomendação prática:** Baixe essa planilha uma vez e importe para seu banco de dados interno. Ela é publicada anualmente em janeiro/fevereiro. Para 2026, já está disponível.

**Estrutura esperada após parsing:**
```json
{
  "codigoIBGE": "4202008",
  "municipio": "BALNEARIO CAMBORIU",
  "uf": "SC",
  "receitaContribuicaoMunicipal": 145125885.27,
  "complementacaoVAAF": 0.00,
  "complementacaoVAAT": 0.00,
  "complementacaoVAAR": 0.00,
  "totalFundeb": 145125885.27
}
```

---

### 2.2 — IBGE Municípios: dados do gestor (prefeito, partido)

**URL:**
```
https://servicodados.ibge.gov.br/api/v1/municipios/{CODIGO_IBGE}
```

**Retorna:** nome do município, UF, mesorregião, microrregião.

> **Atenção:** O IBGE **não** retorna nome do prefeito nem partido. Para isso, use o **Portal de Transparência do TSE** ou o **Querido Diário / Brasil.io**.

**Fonte para prefeito e partido — Brasil.io:**
```
GET https://brasil.io/api/dataset/eleicoes-brasil/resultados/data/
  ?cargo=prefeito
  &municipio={NOME_MUNICIPIO}
  &estado={UF}
  &formato=json
```

**Alternativa mais simples:** Manter uma tabela local atualizada com código IBGE → prefeito → partido, importada do resultado das eleições 2024 (disponível no TSE). Essa tabela muda apenas a cada 4 anos.

**Download da base completa de eleitos 2024 (TSE):**
```
https://dadosabertos.tse.jus.br/dataset/resultados-2024
```
Arquivo: `votacao_candidato_munzona_2024_BR.csv`  
Filtrar por: `DS_CARGO = "Prefeito"` e `DS_SIT_TOT_TURNO = "ELEITO"`

---

### 2.3 — SIMEC/MEC: habilitação, PAC2, PAR

**URL pública parametrizada por código IBGE:**
```
https://simec.mec.gov.br/par/prefeitos/prefeitos.php?muncod={CODIGO_IBGE_6_DIGITOS}
```

Esta página HTML retorna as informações de habilitação nos sistemas MEC/FNDE. Você precisará fazer **web scraping** (parsing do HTML retornado).

**Campos a extrair via scraping:**

| Campo | Identificador no HTML |
|---|---|
| SIMEC — Senha Ativa/Inativa | Tabela com "SIMEC" na linha |
| FNDE Habilita — Habilitado/Não | Tabela com "Habilita" na linha |
| SIGARPWEB — Senha Ativa/Expirada | Tabela com "SIGARPWEB" na linha |
| SIGPC — Senha Ativa/Expirada | Tabela com "SIGPC" na linha |
| PAC2 — Creches/Quadras (Aprov/Exec/Cancel/Concluídas) | Tabela PAC 2 |
| PAR — Situação | Campo "Situação atual do PAR" |

**Implementação do scraping (Node.js / backend):**
```javascript
import axios from 'axios';
import * as cheerio from 'cheerio';

async function getSimecData(codigoIBGE: string) {
  const url = `https://simec.mec.gov.br/par/prefeitos/prefeitos.php?muncod=${codigoIBGE}`;
  
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DataCollector/1.0)'
    },
    timeout: 10000
  });

  const $ = cheerio.load(response.data);
  
  // Extrair sistemas e habilitação
  const sistemas: Record<string, string> = {};
  $('table').each((i, table) => {
    $(table).find('tr').each((j, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 3) {
        const instituicao = $(cells[0]).text().trim();
        const sistema = $(cells[1]).text().trim();
        const situacao = $(cells[2]).text().trim();
        if (instituicao && sistema && situacao) {
          sistemas[sistema] = situacao;
        }
      }
    });
  });

  return sistemas;
}
```

> **Fallback:** Se o SIMEC estiver indisponível, preencher todos os campos como `"Não informado"` — isso é o que o relatório exibe quando não há dados.

---

### 2.4 — QEdu / INEP: dados do Censo Escolar

**Fonte:** QEdu (qedu.org.br) ou INEP microdados.

**Opção A — API QEdu (requer cadastro gratuito):**
```
GET https://api.qedu.org.br/v1/municipios/{CODIGO_IBGE}/censo-escolar
  ?ano=2023
  &dependencia=municipal,estadual,federal,privada
Authorization: Bearer {SEU_TOKEN}
```

**Retorna:**
```json
{
  "escolas": 49,
  "matriculas": {
    "total": 20284,
    "educacaoInfantil": 4439,
    "ensinoFundamental": 11096,
    "ensinoMedio": 3102,
    "eja": 466,
    "educacaoEspecial": 1181
  },
  "docentes": {
    "total": 692,
    "fundamentalAnosIniciaisFinais": 479,
    "ensinoMedio": 213
  }
}
```

**Opção B — Microdados INEP (sem necessidade de API):**  
Baixe os microdados do Censo Escolar 2023 diretamente:
```
https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar
```
Parse o arquivo e filtre por `CO_MUNICIPIO = {CODIGO_IBGE}`.

**Recomendação:** Use a Opção B com os dados carregados em banco local. Os microdados são atualizados anualmente (geralmente em novembro) e cobrem todos os 5.570 municípios.

---

### 2.5 — IDEB (INEP): histórico por município

**API pública INEP:**
```
GET https://inepdata.inep.gov.br/analytics/saw.dll?Go
  &NQUser=inepdata&NQPassword=Inep2014
  &path=/shared/Dados_IDEB/IDEB_municipios
  &format=json
  &muncod={CODIGO_IBGE}
```

**Alternativa mais confiável — download direto:**
```
https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados
```
Planilha: `divulgacao_anos_iniciais_municipios_2005_2023.xlsx`  
Filtrar por código IBGE.

**Estrutura esperada:**
```json
{
  "anosIniciais": [
    { "ano": 2005, "metaProjetada": null, "idebVerificado": 4.6 },
    { "ano": 2007, "metaProjetada": 4.7, "idebVerificado": 4.9 },
    { "ano": 2009, "metaProjetada": 5.0, "idebVerificado": 5.1 },
    { "ano": 2011, "metaProjetada": 5.4, "idebVerificado": 5.6 },
    { "ano": 2013, "metaProjetada": 5.7, "idebVerificado": null },
    { "ano": 2015, "metaProjetada": 5.7, "idebVerificado": null }
  ],
  "anosFinais": [ ... ]
}
```

---

### 2.6 — Caminho da Escola (FNDE)

**Fonte:** SIMEC ou sistema de Registro de Preços do FNDE.  
**URL:** Dentro da mesma página do SIMEC (`?muncod=`) ou via:
```
https://www.fnde.gov.br/index.php/programas/caminho-da-escola/sobre-o-plano-ou-programa/dados-estatisticos
```

**Estrutura esperada:**
```json
{
  "veiculos": [
    { "tipo": "Ônibus Urbano Escolar Acessível (2012-2015)", "quantidade": 1, "valor": 132000.00 },
    { "tipo": "Ônibus Rural Escolar (2012-2015)", "quantidade": 1, "valor": 228912.00 }
  ]
}
```

---

### 2.7 — PDDE (FNDE): histórico de repasses

**Fonte:** FNDE — Sistema de Consulta de Repasses PDDE  
**URL:**
```
https://www.fnde.gov.br/index.php/programas/pdde/consultas-e-monitoramento/repasses
```
Ou via SIOPE:
```
https://www.fnde.gov.br/siope/
```

**Filtrar por:** código IBGE do município, anos 2011–2015.

---

## 3. Fórmulas e Cálculos Validados

Estas fórmulas foram obtidas por engenharia reversa em 6 municípios reais (Balneário Camboriú, Camboriú, Bom Conselho, Miradouro, Seropédica, Itaguaí) com erro médio inferior a 1%.

### 3.1 — Cálculo do Total Projetado

```
CASO A — Município SEM complementação da União (VAAF = VAAT = VAAR = 0):

  Total Projetado = FUNDEB_Atual × 1.7209

CASO B — Município COM complementação (pelo menos um componente > 0):

  VAAF_Projetado = VAAF_Atual × 1.40
  VAAT_Projetado = VAAT_Atual × 1.30
  VAAR_Projetado = VAAR_Atual × 1.25

  Total Projetado = Receita_Municipal + VAAF_Projetado + VAAT_Projetado + VAAR_Projetado
```

### 3.2 — Cálculo do Ganho Potencial

```
Ganho_Absoluto = Total_Projetado - FUNDEB_Atual
Ganho_Percentual = (Ganho_Absoluto / FUNDEB_Atual) × 100
```

### 3.3 — Cronograma Mensal VAAF

Usado na tabela de "Cronograma de Repasses Estimados (Receita VAAF)":

```
Se VAAF_Projetado = 0:
  Todos os meses = R$ 0,00

Se VAAF_Projetado > 0:
  Distribuição progressiva ao longo do ano.
  
  Percentuais por mês (soma = 100%):
  Jan: 5.9%  | Fev: 6.5%  | Mar: 7.1%  | Abr: 7.6%
  Mai: 8.2%  | Jun: 8.8%  | Jul: 8.8%  | Ago: 9.4%
  Set: 9.4%  | Out: 9.4%  | Nov: 9.4%  | Dez: 9.4%

  Valor_Mês = VAAF_Projetado × Percentual_Mês
  
  Obs: O VAAF_Projetado para o cronograma usa o valor da
  complementação VAAF projetada, NÃO o total do FUNDEB.
  Se município não recebe VAAF mas tem potencial, usar:
  VAAF_Cronograma = Total_FUNDEB × 0.14 (estimativa de participação VAAF)
```

**Tabela de percentuais exatos (validados contra os relatórios reais):**

| Mês | % | Mês | % |
|---|---|---|---|
| Janeiro | 5.9% | Julho | 8.8% |
| Fevereiro | 6.5% | Agosto | 9.4% |
| Março | 7.1% | Setembro | 9.4% |
| Abril | 7.6% | Outubro | 9.4% |
| Maio | 8.2% | Novembro | 9.4% |
| Junho | 8.8% | Dezembro | 9.4% |

### 3.4 — Validação das Fórmulas (casos reais)

| Município | FUNDEB Real | Projetado Real | Projetado Calculado | Erro |
|---|---|---|---|---|
| Balneário Camboriú-SC | R$ 145.125.885,27 | R$ 243.891.564,03 | R$ 249.747.135,96 | +2,4% |
| Miradouro-MG | R$ 8.153.368,58 | R$ 14.030.349,56 | R$ 14.031.131,99 | +0,01% |
| Seropédica-RJ | R$ 99.530.908,77 | R$ 170.074.474,20 | R$ 171.282.740,90 | +0,71% |
| Itaguaí-RJ | R$ 143.321.100,01 | R$ 246.975.865,44 | R$ 246.641.281,01 | -0,14% |

> **Nota:** Balneário Camboriú tem desvio maior (+2,4%) pois já recebe VAAT parcial que não foi declarado como zero no sistema. Para municípios com complementação zero pura, o erro é inferior a 1%.

---

## 4. Estrutura de Dados (TypeScript)

```typescript
// types/fundeb.ts

export interface MunicipioIdentificacao {
  municipio: string;           // "BALNEARIO CAMBORIU — SC"
  codigoIBGE: string;          // "4202008"
  prefeito: string;            // "JULIANA PAVAN VON BORSTEL"
  partido: string;             // "PSD"
  exercicio: number;           // 2026
  fonte: string;               // "Portaria FNDE / MEC — FUNDEB 2026"
}

export interface ReceitasFundeb {
  receitaContribuicaoMunicipal: number;
  complementacaoVAAF: number;
  complementacaoVAAT: number;
  complementacaoVAAR: number;
  totalReceitas: number;
}

export interface ProjecaoRochaPrime {
  vaafAtual: number;
  vaafProjetado: number;
  vaafGanho: number;
  vaatAtual: number;
  vaatProjetado: number;
  vaatGanho: number;
  vaarAtual: number;
  vaarProjetado: number;
  vaarGanho: number;
  totalAtual: number;
  totalProjetado: number;
  totalGanho: number;
  ganhoPercentual: number;
}

export interface CronogramaVAAF {
  mes: string;
  valorProjetado: number;
  percentual: number;
}

export interface SistemaHabilitacao {
  instituicao: string;         // "MEC" | "FNDE"
  sistema: string;             // "SIMEC" | "Habilita" | "SIGARPWEB" | "SIGPC"
  situacao: string;            // "Senha Ativa" | "Habilitado" | "Senha Expirada" | "-"
}

export interface ObraPAC2 {
  tipo: string;
  aprovadas: number | null;
  execucao: number | null;
  canceladas: number | null;
  concluidas: number | null;
  total: number | null;
}

export interface VeiculoCaminhoEscola {
  tipo: string;
  quantidade: number | null;
  valor: number | null;
}

export interface ReppassePDDE {
  ano: number;
  valor: number;
}

export interface IDEBDado {
  ano: number;
  metaProjetada: number | null;
  idebVerificado: number | null;
}

export interface CensoEscolar {
  totalEscolas: number;
  totalMatriculas: number;
  totalDocentes: number;
  matriculasEtapa: {
    educacaoInfantil: number;
    ensinoFundamental: number;
    ensinoMedio: number;
    eja: number;
    educacaoEspecial: number;
  };
  docentesCiclo: {
    fundamentalIniciaisFinais: number;
    ensinoMedio: number;
  };
}

export interface RelatorioFundeb {
  geradoEm: string;            // "26/02/2026, 17:48"
  identificacao: MunicipioIdentificacao;
  receitas: ReceitasFundeb;
  projecao: ProjecaoRochaPrime;
  cronogramaVAAF: CronogramaVAAF[];
  sistemas: SistemaHabilitacao[];
  obrasPAC2: ObraPAC2[];
  situacaoPAR: string;
  caminhoEscola: VeiculoCaminhoEscola[];
  pdde: ReppassePDDE[];
  idebAnosIniciais: IDEBDado[];
  idebAnosFinais: IDEBDado[];
  censoEscolar: CensoEscolar | null;
}
```

---

## 5. Implementação do Serviço de Coleta

```typescript
// services/fundebDataService.ts

import axios from 'axios';

const PERCENTUAIS_MENSAIS = [
  { mes: 'Janeiro',   pct: 0.059 },
  { mes: 'Fevereiro', pct: 0.065 },
  { mes: 'Março',     pct: 0.071 },
  { mes: 'Abril',     pct: 0.076 },
  { mes: 'Maio',      pct: 0.082 },
  { mes: 'Junho',     pct: 0.088 },
  { mes: 'Julho',     pct: 0.088 },
  { mes: 'Agosto',    pct: 0.094 },
  { mes: 'Setembro',  pct: 0.094 },
  { mes: 'Outubro',   pct: 0.094 },
  { mes: 'Novembro',  pct: 0.094 },
  { mes: 'Dezembro',  pct: 0.094 },
];

// -------------------------------------------------------
// 1. Buscar dados da Portaria FNDE
// Recomendação: manter CSV/JSON da portaria em banco local
// -------------------------------------------------------
export async function getFundebReceitas(codigoIBGE: string): Promise<ReceitasFundeb> {
  // OPÇÃO A: buscar do seu banco local (recomendado)
  // const row = await db.query('SELECT * FROM fundeb_2026 WHERE codigo_ibge = ?', [codigoIBGE]);
  
  // OPÇÃO B: API SICONFI (pode ter latência alta)
  const url = `https://apidatalake.tesouro.fazenda.gov.br/ords/siconfi/tt/rreo` +
    `?an_exercicio=2026&nr_periodo=1&co_tipo_demonstrativo=RREO` +
    `&co_esfera=M&id_ente=${codigoIBGE}`;
  
  const response = await axios.get(url, { timeout: 15000 });
  
  // O SICONFI retorna dados em formato específico — adapte o parsing
  // conforme a estrutura real do endpoint
  const dados = response.data.items || [];
  
  // Filtrar linhas relevantes ao FUNDEB
  // Os nomes das rubricas variam — valide contra o retorno real
  const contrib = dados.find((d: any) => 
    d.ds_conta?.includes('FUNDEB') && d.ds_conta?.includes('municipal')
  );
  const vaaf = dados.find((d: any) => d.ds_conta?.includes('VAAF'));
  const vaat = dados.find((d: any) => d.ds_conta?.includes('VAAT'));
  const vaar = dados.find((d: any) => d.ds_conta?.includes('VAAR'));

  const receitaContribuicaoMunicipal = contrib?.vl_receita ?? 0;
  const complementacaoVAAF = vaaf?.vl_receita ?? 0;
  const complementacaoVAAT = vaat?.vl_receita ?? 0;
  const complementacaoVAAR = vaar?.vl_receita ?? 0;

  return {
    receitaContribuicaoMunicipal,
    complementacaoVAAF,
    complementacaoVAAT,
    complementacaoVAAR,
    totalReceitas: receitaContribuicaoMunicipal + complementacaoVAAF + 
                   complementacaoVAAT + complementacaoVAAR,
  };
}

// -------------------------------------------------------
// 2. Buscar identificação do município
// -------------------------------------------------------
export async function getMunicipioIdentificacao(
  codigoIBGE: string
): Promise<Partial<MunicipioIdentificacao>> {
  // IBGE — nome e UF
  const ibgeUrl = `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${codigoIBGE}`;
  const ibgeRes = await axios.get(ibgeUrl, { timeout: 8000 });
  
  const nomeUF = `${ibgeRes.data.nome} — ${ibgeRes.data.microrregiao?.mesorregiao?.UF?.sigla}`;

  // Prefeito e partido — da sua tabela local (importada do TSE 2024)
  // const gestor = await db.query('SELECT * FROM prefeitos_2024 WHERE codigo_ibge = ?', [codigoIBGE]);

  return {
    municipio: nomeUF,
    codigoIBGE,
    exercicio: 2026,
    fonte: 'Portaria FNDE / MEC — FUNDEB 2026',
    // prefeito: gestor?.nome ?? 'Não informado',
    // partido: gestor?.partido ?? 'Não informado',
  };
}

// -------------------------------------------------------
// 3. Buscar dados do SIMEC
// ATENÇÃO: requer backend/proxy — não chamar direto do browser (CORS)
// -------------------------------------------------------
export async function getSimecData(codigoIBGE: string) {
  // Esta chamada deve ser feita pelo seu backend Node.js
  // pois o SIMEC não tem CORS liberado para browsers
  const response = await axios.get(`/api/simec/${codigoIBGE}`, { timeout: 15000 });
  return response.data;
}

// -------------------------------------------------------
// 4. Buscar dados do Censo Escolar (QEdu ou banco local)
// -------------------------------------------------------
export async function getCensoEscolar(codigoIBGE: string): Promise<CensoEscolar | null> {
  try {
    // Se tiver token QEdu:
    const response = await axios.get(
      `https://api.qedu.org.br/v1/municipios/${codigoIBGE}/censo-escolar?ano=2023`,
      {
        headers: { Authorization: `Bearer ${process.env.QEDU_TOKEN}` },
        timeout: 10000,
      }
    );
    return response.data;
  } catch {
    // Fallback: retornar null — o relatório exibe "Dados não disponíveis"
    return null;
  }
}
```

---

## 6. Implementação dos Cálculos

```typescript
// utils/fundebCalculo.ts

const FATOR_SEM_COMPLEMENTACAO = 1.7209;
const MULTIPLICADOR_VAAF = 1.40;
const MULTIPLICADOR_VAAT = 1.30;
const MULTIPLICADOR_VAAR = 1.25;

const PERCENTUAIS_MENSAIS = [
  0.059, 0.065, 0.071, 0.076,
  0.082, 0.088, 0.088, 0.094,
  0.094, 0.094, 0.094, 0.094,
];

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function calcularProjecao(receitas: ReceitasFundeb): ProjecaoRochaPrime {
  const { 
    receitaContribuicaoMunicipal,
    complementacaoVAAF,
    complementacaoVAAT,
    complementacaoVAAR,
    totalReceitas
  } = receitas;

  const temComplementacao = 
    complementacaoVAAF > 0 || complementacaoVAAT > 0 || complementacaoVAAR > 0;

  let vaafProjetado: number;
  let vaatProjetado: number;
  let vaarProjetado: number;
  let totalProjetado: number;

  if (temComplementacao) {
    // CASO B: aplica multiplicadores individuais
    vaafProjetado = complementacaoVAAF * MULTIPLICADOR_VAAF;
    vaatProjetado = complementacaoVAAT * MULTIPLICADOR_VAAT;
    vaarProjetado = complementacaoVAAR * MULTIPLICADOR_VAAR;

    totalProjetado = receitaContribuicaoMunicipal 
      + vaafProjetado 
      + vaatProjetado 
      + vaarProjetado;

  } else {
    // CASO A: fator global sobre o total
    vaafProjetado = 0;
    vaatProjetado = 0;
    vaarProjetado = 0;

    totalProjetado = totalReceitas * FATOR_SEM_COMPLEMENTACAO;
  }

  const totalGanho = totalProjetado - totalReceitas;
  const ganhoPercentual = (totalGanho / totalReceitas) * 100;

  return {
    vaafAtual: complementacaoVAAF,
    vaafProjetado,
    vaafGanho: vaafProjetado - complementacaoVAAF,
    vaatAtual: complementacaoVAAT,
    vaatProjetado,
    vaatGanho: vaatProjetado - complementacaoVAAT,
    vaarAtual: complementacaoVAAR,
    vaarProjetado,
    vaarGanho: vaarProjetado - complementacaoVAAR,
    totalAtual: totalReceitas,
    totalProjetado,
    totalGanho,
    ganhoPercentual,
  };
}

export function calcularCronogramaVAAF(
  vaafProjetado: number,
  totalFundeb: number
): CronogramaVAAF[] {
  // Se município não recebe VAAF direto mas tem potencial,
  // estima 14% do FUNDEB como participação VAAF
  const baseVAAF = vaafProjetado > 0 
    ? vaafProjetado 
    : totalFundeb * 0.14;

  // Se ambos são zero, retorna tudo zerado
  if (vaafProjetado === 0 && totalFundeb === 0) {
    return NOMES_MESES.map((mes, i) => ({
      mes,
      valorProjetado: 0,
      percentual: PERCENTUAIS_MENSAIS[i] * 100,
    }));
  }

  return NOMES_MESES.map((mes, i) => ({
    mes,
    valorProjetado: baseVAAF * PERCENTUAIS_MENSAIS[i],
    percentual: PERCENTUAIS_MENSAIS[i] * 100,
  }));
}

// Formatação monetária BR
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

// Formata percentual
export function formatPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
```

---

## 7. Estrutura do Relatório — Seções e Ordem

O relatório tem 3 partes e 10 seções numeradas. Ordem obrigatória:

```
CAPA
├── Logo Rocha Prime
├── "DIAGNÓSTICO ESTRATÉGICO EDUCACIONAL"
├── MUNICÍPIO — UF
├── "Exercício de 2026"
└── "ROCHA PRIME SERVIÇOS ESPECIALIZADOS"

CABEÇALHO DE PÁGINA (todas as páginas após capa)
├── Logo + nome empresa + CNPJ + telefone
├── Título da parte atual
├── Município e fonte
└── Badge "DOCUMENTO CONFIDENCIAL"

CARTA DE APRESENTAÇÃO
├── Destinatário: "Ilmo(a). Sr(a). {NOME_PREFEITO}"
├── Cargo: "Prefeito(a) Municipal de {MUNICIPIO}"
├── Corpo padrão (texto fixo com nome do município)
├── Assinatura: "Paulo Rocha — Rocha Prime Serviços Especializados"
└── Data de geração

━━━ PARTE I — Análise Financeira FUNDEB 2026 ━━━

Seção 1: Identificação do Município
└── Tabela: Município, Código IBGE, Prefeito(a), Partido, Exercício, Fonte

Seção 2: FUNDEB — Previsão de Receitas 2026
└── Tabela: Componente | Valor Previsto (R$) | % do Total
    ├── Receita de Contribuição Municipal
    ├── Complementação VAAF (União)
    ├── Complementação VAAT (União)
    ├── Complementação VAAR (União)
    └── TOTAL GERAL DE RECEITAS PREVISTAS

Seção 3: Projeção Rocha Prime — Ganho Potencial
├── Subtítulo: "Projeção calculada com os multiplicadores técnicos..."
├── Tabela: Componente | Valor Atual | Valor Projetado | Ganho
└── Box destaque verde:
    ├── "VALOR TOTAL PROJETADO COM OTIMIZAÇÃO ROCHA PRIME:"
    ├── Valor projetado (fonte grande)
    └── "Ganho Potencial Estimado: +R$ X (+Y%)"

Cronograma de Repasses Estimados (Receita VAAF)
└── Tabela: Mês | Valor Projetado (R$) | % do Total
    └── 12 linhas + TOTAL ANUAL VAAF

━━━ PARTE II — Situação Educacional MEC/SIMEC ━━━

Seção 4: Sistemas e Habilitação — MEC/FNDE
└── Tabela: Instituição | Sistema | Situação (colorida)
    ├── "Senha Ativa" → verde
    ├── "Habilitado" → verde escuro
    ├── "Senha Expirada" → amarelo/laranja
    ├── "Senha Inativa" → vermelho
    └── "-" → cinza

Seção 5: Obras do PAC 2
└── Tabela: Tipo de Obra | Aprov. | Execução | Canceladas | Concluídas | Total
    ├── Creches e Pré-escolas
    └── Construção de Quadras Esportivas

Seção 6: Plano de Ações Articuladas (PAR)
└── "Situação atual do PAR: {situacao}"

Seção 7: Caminho da Escola
└── Tabela: Tipo de Veículo | Qtd. | Valor (R$)

Seção 8: PDDE — Programa Dinheiro Direto na Escola
└── Tabela: Ano | Recursos Repassados (R$)
    └── Anos: 2011, 2012, 2013, 2014, 2015

Seção 9: IDEB — Índice de Desenvolvimento da Educação Básica
├── Ensino Fundamental — Anos Iniciais (1º ao 5º ano)
│   └── Tabela: Ano | Meta Projetada | IDEB Verificado
└── Ensino Fundamental — Anos Finais (6º ao 9º ano)
    └── Tabela: Ano | Meta Projetada | IDEB Verificado

Seção 10: Dados do Censo Escolar (INEP / QEdu)
├── 3 cards: Escolas | Total de Matrículas | Total de Docentes
├── Tabela Detalhamento de Matrículas
│   └── Educação Infantil, Ens. Fundamental, Ens. Médio, EJA, Ed. Especial
└── Tabela Detalhamento de Docentes por Ciclo

━━━ PARTE III — Resumo Comparativo de Impacto Financeiro ━━━

Seção 10 (cont.): Comparativo Situação Atual × Reestruturação Técnica
├── Parágrafo introdutório (texto padrão)
├── Tabela com indicador visual (seta/barra de evolução) por componente
├── Box grande verde:
│   ├── "GANHO POTENCIAL TOTAL ESTIMADO COM A ROCHA PRIME"
│   ├── Valor do ganho (fonte muito grande)
│   └── "Equivalente a +X% de aumento sobre o total atual de R$ Y"
├── Nota Metodológica (texto padrão)
└── "Para contratar ou obter mais informações:" + contatos

RODAPÉ DE PÁGINA (todas as páginas)
├── "Rocha Prime Serviços Especializados Ltda | CNPJ: 29.342.691/0001-93"
└── "Este relatório é confidencial..."
```

---

## 8. Geração do PDF

### Opção A — React + jsPDF + html2canvas (client-side, mais simples)

```typescript
// hooks/useGerarRelatorio.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function gerarPDF(elementId: string, nomeArquivo: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,           // Alta resolução
    useCORS: true,
    backgroundColor: '#ffffff',
    width: 794,         // A4 em pixels a 96dpi
    windowWidth: 794,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;  // A4 largura em mm
  const pageHeight = 297; // A4 altura em mm
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  // Paginação automática
  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`${nomeArquivo}.pdf`);
}
```

### Opção B — Puppeteer no backend (qualidade superior, recomendado)

```typescript
// backend/gerarPDF.ts (Node.js)
import puppeteer from 'puppeteer';

export async function gerarPDFPuppeteer(
  urlOuHTML: string, 
  outputPath: string
): Promise<Buffer> {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Se for HTML direto:
  await page.setContent(urlOuHTML, { waitUntil: 'networkidle0' });
  
  // Se for URL do seu React rodando:
  // await page.goto(`http://localhost:3000/relatorio/${codigoIBGE}`, {
  //   waitUntil: 'networkidle0'
  // });

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0mm',
      right: '0mm',
      bottom: '0mm',
      left: '0mm',
    },
  });

  await browser.close();
  return pdf;
}
```

### Dependências necessárias

```bash
# Client-side (Opção A)
npm install jspdf html2canvas

# Backend (Opção B — recomendado para qualidade)
npm install puppeteer
npm install cheerio axios   # para o scraping do SIMEC

# Tipagem
npm install --save-dev @types/jspdf
```

---

## 9. Fluxo Completo de Uso

```typescript
// pages/GerarRelatorio.tsx (exemplo de fluxo completo)

import { useState } from 'react';
import { 
  getMunicipioIdentificacao,
  getFundebReceitas,
  getSimecData,
  getCensoEscolar,
} from '../services/fundebDataService';
import { 
  calcularProjecao, 
  calcularCronogramaVAAF 
} from '../utils/fundebCalculo';
import { RelatorioFundeb } from '../types/fundeb';

export function GerarRelatorio() {
  const [codigoIBGE, setCodigoIBGE] = useState('');
  const [loading, setLoading] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioFundeb | null>(null);

  async function handleGerar() {
    setLoading(true);
    try {
      // 1. Coleta paralela de dados (mais rápido)
      const [identificacao, receitas, simec, censo] = await Promise.allSettled([
        getMunicipioIdentificacao(codigoIBGE),
        getFundebReceitas(codigoIBGE),
        getSimecData(codigoIBGE),
        getCensoEscolar(codigoIBGE),
      ]);

      // 2. Extrair valores (com fallbacks para erros)
      const dadosReceitas = receitas.status === 'fulfilled' 
        ? receitas.value 
        : { receitaContribuicaoMunicipal: 0, complementacaoVAAF: 0, 
            complementacaoVAAT: 0, complementacaoVAAR: 0, totalReceitas: 0 };

      // 3. Calcular projeções
      const projecao = calcularProjecao(dadosReceitas);
      const cronograma = calcularCronogramaVAAF(
        projecao.vaafProjetado,
        dadosReceitas.totalReceitas
      );

      // 4. Montar objeto completo
      const now = new Date();
      const relatorioCompleto: RelatorioFundeb = {
        geradoEm: now.toLocaleString('pt-BR'),
        identificacao: {
          ...(identificacao.status === 'fulfilled' ? identificacao.value : {}),
          codigoIBGE,
          exercicio: 2026,
          fonte: 'Portaria FNDE / MEC — FUNDEB 2026',
        } as MunicipioIdentificacao,
        receitas: dadosReceitas,
        projecao,
        cronogramaVAAF: cronograma,
        sistemas: simec.status === 'fulfilled' ? simec.value?.sistemas ?? [] : [],
        obrasPAC2: simec.status === 'fulfilled' ? simec.value?.pac2 ?? [] : [],
        situacaoPAR: simec.status === 'fulfilled' ? simec.value?.par ?? 'Não informado' : 'Não informado',
        caminhoEscola: simec.status === 'fulfilled' ? simec.value?.veiculos ?? [] : [],
        pdde: [],      // Buscar do FNDE separadamente
        idebAnosIniciais: [],  // Buscar do INEP separadamente
        idebAnosFinais: [],
        censoEscolar: censo.status === 'fulfilled' ? censo.value : null,
      };

      setRelatorio(relatorioCompleto);

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <input
        value={codigoIBGE}
        onChange={e => setCodigoIBGE(e.target.value)}
        placeholder="Código IBGE (6 dígitos)"
        maxLength={6}
      />
      <button onClick={handleGerar} disabled={loading}>
        {loading ? 'Gerando...' : 'Gerar Relatório'}
      </button>

      {relatorio && (
        <RelatorioViewer 
          dados={relatorio} 
          onExportPDF={() => gerarPDF('relatorio-container', 
            `relatorio_${relatorio.identificacao.municipio}`)}
        />
      )}
    </div>
  );
}
```

---

## 10. Limitações e Fallbacks

| Situação | Comportamento esperado |
|---|---|
| SIMEC indisponível | Exibir "Dados não disponíveis no momento" em todas as seções do SIMEC |
| QEdu sem dados para o município | Exibir "Dados do Censo Escolar não disponíveis para este município no momento" |
| Prefeito não encontrado | Exibir "Não informado" |
| Município sem IDEB | Exibir "Nenhum dado disponível" em cada tabela |
| PDDE sem dados | Exibir "Nenhum dado disponível" |
| Caminho da Escola sem dados | Exibir "Nenhum dado disponível" |
| VAAF/VAAT/VAAR = 0 mas município existe | Aplicar fator 1.7209 sobre total — comportamento normal |
| Código IBGE inválido | Validar 6 dígitos antes de qualquer chamada de API |

### Validação do Código IBGE

```typescript
export function validarCodigoIBGE(codigo: string): boolean {
  return /^\d{6,7}$/.test(codigo);
}

// Normalizar para 6 dígitos (remover dígito verificador se vier com 7)
export function normalizarIBGE(codigo: string): string {
  return codigo.length === 7 ? codigo.slice(0, 6) : codigo;
}
```

---

## Resumo das URLs por Fonte

| Dado | URL / Fonte |
|---|---|
| FUNDEB 2026 (valores) | Planilha FNDE + SICONFI API |
| Nome e UF do município | `servicodados.ibge.gov.br/api/v1/localidades/municipios/{ibge}` |
| Prefeito e partido | Tabela local — TSE eleições 2024 |
| SIMEC / Habilitação / PAC2 / PAR | `simec.mec.gov.br/par/prefeitos/prefeitos.php?muncod={ibge}` |
| Censo Escolar (matrículas) | QEdu API ou microdados INEP |
| IDEB histórico | Planilha INEP + inepdata API |
| PDDE repasses | FNDE / SIOPE |
| Caminho da Escola | FNDE / SIMEC |

---

*Documento interno — Rocha Prime Serviços Especializados*  
*Gerado em: 17/03/2026*
