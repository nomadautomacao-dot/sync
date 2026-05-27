# 🔧 FUNDEB — Plano de Correção: Dados Reais no Levantamento

> **Status:** Os dados exibidos no app e no PDF são **100% fake** (mock hardcoded).
> **Objetivo:** Substituir por dados reais de APIs públicas (SICONFI, IBGE, INEP).

---

## 📋 Situação Atual

### O que funciona ✅
- UI do levantamento renderiza sem travar (bugs de layout corrigidos)
- Fallback automático Remote → Local (timeout 15s)
- Pipeline SICONFI implementado no `LocalSyncRepository` (busca receitas)
- PDF é gerado corretamente (design excelente)
- Busca de município via API IBGE funciona

### O que NÃO funciona ❌
- **Backend Cloud Run** (`POST /api/modulos/levantamento-fundeb/autonomo`) trava (timeout)
- **Dados retornados são MOCK** — o SICONFI retorna dados mas o mock substitui tudo
- Projeção financeira é hardcoded (Poções/BA)
- Censo escolar, IDEB, PAR, PDDE, sistemas são todos fake
- Perfil comercial é hardcoded
- Identificação (prefeito, partido, mesorregião) é fake

---

## 🏗️ Arquitetura dos Repositórios

```
┌─────────────────────────────────────────────────┐
│              HybridSyncRepository               │
│  (lib/src/core/repositories/hybrid_sync_repository.dart)
│                                                 │
│  getLevantamentoFundeb(request)                  │
│    ├─ try: RemoteSyncRepository (timeout 15s)   │
│    └─ catch: LocalSyncRepository (fallback)     │
└─────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐    ┌──────────────────────────┐
│ RemoteSyncRepo   │    │ LocalSyncRepository      │
│ (remote_sync_    │    │ (local_sync_             │
│  repository.dart)│    │  repository.dart)        │
│                  │    │                          │
│ POST /api/modulos│    │ 1. Resolve município     │
│ /levantamento-   │    │    via API IBGE          │
│ fundeb/autonomo  │    │ 2. MockSyncRepository()  │
│                  │    │    .getLevantamento()     │
│ ⚠️ TRAVA (Cloud  │    │ 3. _fetchSiconfiFundeb() │
│    Run timeout)  │    │    → Enriquece receitas  │
└──────────────────┘    │ 4. Retorna bundle        │
                        └──────────────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ MockSyncRepo     │
                        │ (mock_sync_      │
                        │  repository.dart)│
                        │                  │
                        │ ❌ TUDO HARDCODED │
                        │ Poções/BA values │
                        └──────────────────┘
```

---

## 📁 Arquivos Críticos

| Arquivo | Caminho | Função |
|---------|---------|--------|
| **HybridSyncRepository** | `lib/src/core/repositories/hybrid_sync_repository.dart` | Orquestra Remote vs Local |
| **RemoteSyncRepository** | `lib/src/core/repositories/remote_sync_repository.dart` | Chama backend Cloud Run |
| **LocalSyncRepository** | `lib/src/core/repositories/local_sync_repository.dart` | Fallback com SICONFI |
| **MockSyncRepository** | `lib/src/core/repositories/mock_sync_repository.dart` | Dados fake hardcoded |
| **RelatorioFundeb (model)** | `lib/src/core/models/levantamento_fundeb_models.dart:677` | Modelo de dados |
| **Tela UI** | `lib/src/features/modules/presentation/levantamento_fundeb_screen.dart` | Interface do levantamento |
| **PDF Builder** | `lib/src/features/modules/application/fundeb_levantamento_pdf_builder.dart` | Geração do PDF |
| **Shared Widgets** | `lib/src/features/shared/presentation/shared_widgets.dart` | SyncMetricCard, etc. |
| **main.dart** | `lib/main.dart` | SystemUI (edgeToEdge) |

---

## 🎯 Campos do RelatorioFundeb e Fontes de Dados

### Campos que JÁ são enriquecidos pelo SICONFI ✅
| Campo | Fonte atual | Status |
|-------|-------------|--------|
| `receitas.totalReceitas` | SICONFI DCA-Anexo I-C | ✅ Funcional |
| `receitas.receitaContribuicaoMunicipal` | SICONFI calculado | ✅ Funcional |
| `receitas.complementacaoVAAF` | SICONFI DCA-Anexo I-HI | ✅ Funcional |

### Campos que precisam de dados reais ❌
| Campo | Fonte pública sugerida | Prioridade |
|-------|----------------------|------------|
| `receitas.complementacaoVAAT` | SICONFI (conta específica) | 🔴 ALTA |
| `receitas.complementacaoVAAR` | SICONFI (conta específica) | 🔴 ALTA |
| `identificacao.prefeito` | IBGE Perfil Municipal ou TSE | 🟡 MÉDIA |
| `identificacao.partido` | TSE API ou scraping | 🟡 MÉDIA |
| `identificacao.mesorregiao` | IBGE Localidades | 🟢 BAIXA |
| `identificacao.microrregiao` | IBGE Localidades | 🟢 BAIXA |
| `identificacao.regiao` | IBGE Localidades | 🟢 BAIXA |
| `censoEscolar` | INEP Microdados ou API | 🔴 ALTA |
| `idebAnosIniciais` | INEP IDEB API | 🟡 MÉDIA |
| `idebAnosFinais` | INEP IDEB API | 🟡 MÉDIA |
| `projecao.*` | Cálculo interno baseado nas receitas reais | 🔴 ALTA |
| `projecaoRecuperavel.*` | Cálculo interno | 🔴 ALTA |
| `projecaoComercial.*` | Cálculo com benchmark | 🟡 MÉDIA |
| `pdde` | FNDE PDDE dados abertos | 🟡 MÉDIA |
| `sistemas` | FNDE PAR/SIMEC | 🟢 BAIXA |
| `obrasPAC2` | FNDE PAC2 dados abertos | 🟢 BAIXA |
| `situacaoPAR` | FNDE PAR | 🟢 BAIXA |
| `caminhoEscola` | FNDE Caminho da Escola | 🟢 BAIXA |
| `cronogramaVAAF` | FNDE cronograma | 🟡 MÉDIA |
| `perfilComercial` | Cálculo interno | 🟡 MÉDIA |

---

## 🌐 APIs Públicas Disponíveis

### 1. SICONFI — Tesouro Nacional (Receitas FUNDEB)
```
GET https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca
  ?an_exercicio=2025
  &id_ente=2800308  (código IBGE)
```
- **Retorna:** DCA completo com receitas, despesas, balanço
- **Contas relevantes para FUNDEB:**
  - `DCA-Anexo I-C` / `RO1.7.5.1.00.0.0` → Total receitas FUNDEB
  - `DCA-Anexo I-HI` / `P4.5.2.2.3.00.00` → Complementação União (VAAF)
  - `DCA-Anexo I-HI` / `P4.5.2.2.4.00.00` → Complementação Estado
  - **FALTAM:** contas específicas VAAT e VAAR (precisam investigação)
- **Status:** ✅ Funcional, implementado em `_fetchSiconfiFundeb()`
- **Problema:** O mock sobrescreve os dados reais quando SICONFI não tem a conta específica

### 2. IBGE — Localidades e Perfil
```
GET https://servicodados.ibge.gov.br/api/v1/localidades/municipios/{id}
```
- **Retorna:** nome, mesorregião, microrregião, UF, região
- **Status:** ✅ Funcional para resolução de município

### 3. INEP — Censo Escolar e IDEB
```
# Censo Escolar (escolas por município)
GET https://dadosabertos.mec.gov.br/api/action/datastore_search
  ?resource_id=<ID>
  &filters={"CO_MUNICIPIO":"2800308"}

# IDEB
GET https://api.qedu.org.br/v1/ideb/municipio/{id}
```
- **Status:** ❌ Não implementado
- **Alternativa:** INEP Dados Abertos CSV (pode ser pesado)

### 4. FNDE — PDDE, PAR
- Dados abertos disponíveis em CSV
- **Status:** ❌ Não implementado

---

## 📐 Plano de Implementação (6 Tarefas)

### Tarefa 1: Criar `ExternalDataService` (Nova classe)
**Arquivo:** `lib/src/core/services/external_data_service.dart`

Extrair toda a lógica de enriquecimento do `LocalSyncRepository` para uma classe dedicada:

```dart
class ExternalDataService {
  // SICONFI
  Future<ReceitasFundeb?> fetchReceitasFundeb(String ibge, int exercicio);
  
  // IBGE
  Future<MunicipioIdentificacao?> fetchIdentificacao(String ibge, int exercicio);
  
  // INEP
  Future<CensoEscolar?> fetchCensoEscolar(String ibge, int exercicio);
  Future<List<IDEBDado>?> fetchIdeb(String ibge, {bool anosIniciais = true});
  
  // Cálculo
  ProjecaoRochaPrime calcularProjecao(ReceitasFundeb receitas);
}
```

### Tarefa 2: Corrigir `_fetchSiconfiFundeb()` — Mapear VAAT/VAAR
**Arquivo:** `lib/src/core/repositories/local_sync_repository.dart:442-474`

O método atual só busca receita total e VAAF. Precisa:
1. Investigar as contas DCA para VAAT e VAAR no SICONFI
2. Adicionar parsing para separar complementações
3. Tratar caso de exercício sem dados (usar ano anterior)

> **Dica:** As contas SICONFI mudaram em 2023. Consultar a tabela de contas em:
> `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/contas_dca`

### Tarefa 3: Enriquecer Identificação via IBGE Localidades
**Arquivo:** `lib/src/core/repositories/local_sync_repository.dart`

A resolução de município já funciona, mas não extrai:
- `mesorregião`, `microrregião`, `regiaoIntermediaria`, `regiao`

O endpoint `GET /api/v1/localidades/municipios/{id}` retorna tudo isso.

### Tarefa 4: Implementar Cálculo de Projeção Real
**Lógica:** Quando temos receitas reais do SICONFI, calcular projeção:

```
projecao.vaafProjetado = receitas.vaaf * multiplicador (1.04~1.06)
projecao.vaafGanho = vaafProjetado - receitas.vaaf
projecao.totalProjetado = sum(vaaf + vaat + vaar projetados) + municipal
projecao.ganhoPercentual = totalGanho / totalAtual
```

### Tarefa 5: Refatorar `LocalSyncRepository.getLevantamentoFundeb()`
**Arquivo:** `lib/src/core/repositories/local_sync_repository.dart:391-439`

Fluxo atual (problemático):
```
1. MockSyncRepository().getLevantamentoFundeb() → bundle COM DADOS FAKE
2. _fetchSiconfiFundeb() → tenta enriquecer SOMENTE receitas
3. Se SICONFI falhar → retorna bundle 100% MOCK
```

Fluxo desejado:
```
1. ExternalDataService.fetchReceitasFundeb() → receitas REAIS
2. ExternalDataService.fetchIdentificacao() → nome, UF, região REAIS
3. ExternalDataService.calcularProjecao() → projeção baseada em dados REAIS
4. ExternalDataService.fetchCensoEscolar() → censo REAL (se disponível)
5. MockSyncRepository apenas para campos sem API pública (PAR, sistemas, etc.)
6. Construir RelatorioFundeb mesclando dados reais + fallback mock
```

### Tarefa 6: Adicionar Debug Logging
**Arquivo:** Todos os repositórios

Adicionar `debugPrint()` em cada etapa:
```dart
debugPrint('[FUNDEB] Fonte: SICONFI | Receita total: R\$ ${receitas.totalReceitas}');
debugPrint('[FUNDEB] Fonte: MOCK   | Projeção: R\$ ${projecao.totalProjetado}');
debugPrint('[FUNDEB] Fonte: IBGE   | Município: ${id.municipioNome}/${id.uf}');
```

---

## 🧪 Critérios de Aceitação

### Obrigatórios (P0)
- [ ] Receitas FUNDEB vêm do SICONFI (não são hardcoded)
- [ ] Identificação do município (nome, UF, código) vem do IBGE
- [ ] Projeção financeira é calculada com base nas receitas reais
- [ ] O PDF exibe os mesmos dados da tela (consistência)
- [ ] App não trava ao carregar a prévia
- [ ] Fallback gracioso quando API pública está offline

### Desejáveis (P1)
- [ ] VAAT e VAAR separados (não zerados)
- [ ] Censo escolar real do INEP
- [ ] IDEB real do INEP
- [ ] Mesorregião/microrregião do IBGE

### Opcionais (P2)
- [ ] PDDE real do FNDE
- [ ] Situação PAR real
- [ ] Prefeito/partido do TSE

---

## 🐛 Bugs de UI Já Corrigidos Nesta Sessão

| Bug | Causa | Fix | Arquivo |
|-----|-------|-----|---------|
| Tela congelava ao carregar | `Spacer()` em Column sem bounded height | `Spacer()` → `SizedBox(height: 8)` | `shared_widgets.dart:182` |
| Overflow 6px nos cards | `mainAxisSize: max` (default) | `mainAxisSize: MainAxisSize.min` | `shared_widgets.dart:155` |
| Overflow residual 2px | Padding 20px excessivo | Padding 20 → 16 | `shared_widgets.dart:153` |
| SystemUI loop | `SystemUiMode.manual` | `SystemUiMode.edgeToEdge` | `main.dart:10` |
| API timeout infinito | 120s timeout | 15s timeout | `remote_sync_repository.dart:295` |
| Sem fallback | Sem try-catch no hybrid | Fallback automático Remote → Local | `hybrid_sync_repository.dart:220-228` |
| setState loop | Múltiplos setState em sequência | setState consolidado único | `levantamento_fundeb_screen.dart:279-307` |

---

## ⚡ Quick Start para Próximo Chat

1. Leia este documento
2. Abra `local_sync_repository.dart` (linhas 391-439 — é o ponto de entrada)
3. Crie `ExternalDataService` para centralizar chamadas a APIs públicas
4. Substitua cada campo mock por dados reais, um a um
5. Teste com Aracaju/SE (código IBGE: `2800308`)
6. Valide que o PDF exportado contém dados reais
