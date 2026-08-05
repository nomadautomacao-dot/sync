# Arquitetura de Integração — Mapa do Sistema PrimeOS

> **Objetivo:** Documentar como todos os módulos se conectam entre si,
> definindo os fluxos de dados, dependências e pontos de integração
> para garantir um sistema coeso e sem redundâncias.

---

## 1. Mapa de Módulos do PrimeOS

```
                          ┌──────────────────────┐
                          │     DASHBOARD        │
                          │  KPIs consolidados   │
                          │  Pipeline value      │
                          │  Funil conversão     │
                          │  Alertas pendências  │
                          └──────────┬───────────┘
                                     │ consome dados de todos
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
          ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
          │ COLABORADORES│  │ PLANO AÇÃO   │  │ MINHA EMPRESA│
          │             │  │ (Pipeline)   │  │              │
          │ • Perfil    │  │ • Kanban     │  │ • Dados inst.│
          │ • Documentos│  │ • Checklist  │  │ • Documentos │
          │ • Cidades   │  │ • Timeline   │  │ • Funcionários│
          │ • Comissões │  │ • Financeiro │  │              │
          └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
                 │                │                  │
                 │         ┌──────┴───────┐          │
                 │         ▼              ▼          │
                 │  ┌─────────────┐ ┌──────────┐     │
                 └─▶│ LEVANTAMENTO│ │CONTRATOS │◀────┘
                    │ FUNDEB      │ │ FUNDEB   │
                    │             │ │          │
                    │ • VAAF/VAAT │ │ • Proposta│
                    │ • IDEB/SAEB │ │ • Kit Doc │
                    │ • SICONFI   │ │ • Anexos  │
                    │ • Relatório │ │          │
                    └─────────────┘ └──────────┘
```

---

## 2. Fluxo de Dados entre Módulos

### 2.1 — Diagnóstico → Financeiro (automático)

```
Levantamento FUNDEB (Cidade X)
  └─ VAAF: R$ 5.000.000
  └─ VAAT: R$ 1.200.000
  └─ VAAR: R$ 800.000
  └─ Total FUNDEB: R$ 7.000.000
      │
      ▼ Cálculo automático
  Mensalidade estimada: R$ 7.000.000 × 0.5% = R$ 35.000/mês
  Receita anual: R$ 420.000
  Custo estimado: R$ 180.000 (variável por complexidade)
  Lucro projetado: R$ 240.000
  Comissão (5% lucro): R$ 12.000/ano → R$ 1.000/mês
      │
      ▼ Alimenta
  MunicipalityAccount.estimatedAnnualRevenue = 420000
  MunicipalityAccount.estimatedAnnualCost = 180000
  MunicipalityAccount.estimatedAnnualProfit = 240000
      │
      ▼ Alimenta
  FundebConsultingProject.projectedMonthlyRevenue = 35000
  FundebConsultingProject.projectedAnnualRevenue = 420000
  FundebConsultingProject.projectedAnnualProfit = 240000
  FundebConsultingProject.projectedCommissionAmount = 12000
```

### 2.2 — Documentos → Kit FUNDEB (sob demanda)

```
CollaboratorDocument (João)               CompanyDocument (Global Company)
├─ CND Federal (válido)                  ├─ Contrato Social (válido)
├─ CND Estadual (válido)                 ├─ Balanço 2025 (válido)
├─ FGTS (vencido ⚠️)                     ├─ Alvará (válido)
│                                         │
│                                         │
▼ Merge com prioridade                   ▼
┌─────────────────────────────────────────────────────┐
│ Kit Documental FUNDEB — Cidade X                     │
│                                                       │
│ Habilitação Fiscal:                                   │
│   ✅ CND Federal → do Colaborador João                │
│   ✅ CND Estadual → do Colaborador João               │
│   ❌ FGTS → VENCIDO! (bloqueia geração do kit)        │
│                                                       │
│ Habilitação Jurídica:                                 │
│   ✅ Contrato Social → da Empresa Global Company         │
│   ✅ Alvará → da Empresa Global Company                  │
│                                                       │
│ Habilitação Técnica:                                  │
│   ✅ Balanço 2025 → da Empresa Global Company            │
│   ❌ Atestado Capacidade Técnica → PENDENTE           │
└─────────────────────────────────────────────────────┘
```

### 2.3 — Pipeline → Dashboard (tempo real)

```
Pipeline de Cidades
├─ Mapeamento:     5 cidades  → R$ 0 (prob 10%)
├─ Primeiro Contato: 3 cidades → R$ 180k (prob 20%)
├─ Diagnóstico:    2 cidades  → R$ 250k (prob 40%)
├─ Proposta:       2 cidades  → R$ 320k (prob 60%)
├─ Negociação:     1 cidade   → R$ 200k (prob 75%)
├─ Contratual:     1 cidade   → R$ 180k (prob 90%)
├─ Implementação:  3 cidades  → R$ 900k (prob 95%)
└─ Fidelizadas:    2 cidades  → R$ 600k (prob 100%)
                                ─────────────────
                   Pipeline ponderado: R$ 1.8M
                   Receita ativa: R$ 1.5M
                   Comissões previstas: R$ 75k
      │
      ▼ Alimenta Dashboard KPIs
  Projected Gross Revenue: R$ 1.8M
  Projected Profit: R$ 720k
  Implementation Coverage: 62% (5/8 cidades ativas)
  Portfolio Mix: [Mapeamento: 5, Contato: 3, ...]
```

---

## 3. Pontos de Integração Detalhados

### 3.1 — Entre Módulos Flutter

| De                | Para               | Ação                                              | Como                                           |
|-------------------|--------------------|---------------------------------------------------|-------------------------------------------------|
| Plano de Ação     | Levantamento FUNDEB | Gerar diagnóstico da cidade                       | `repository.getLevantamentoFundeb(request)`     |
| Plano de Ação     | Contratos FUNDEB   | Gerar proposta                                    | `repository.gerarPropostaDocx(data)`            |
| Plano de Ação     | Contratos FUNDEB   | Gerar kit documental                              | `repository.gerarKitContratosFundebComAnexos()` |
| Colaboradores     | Plano de Ação      | Navegar para cidade do colaborador                | `controller.selectSection(AppSection.pipeline)` |
| Colaboradores     | Contratos FUNDEB   | Anexar docs do colaborador no kit                 | Via `CollaboratorDocument` no backend           |
| Minha Empresa     | Contratos FUNDEB   | Docs da empresa como fallback no kit              | Via `CompanyDocument` no backend                |
| Dashboard         | Plano de Ação      | Clicar em KPI → abre pipeline filtrado            | `controller.selectSection(AppSection.pipeline)` |
| Dashboard         | Colaboradores      | Clicar em comissão → abre colaborador             | `controller.selectSection(AppSection.people)`   |

### 3.2 — Entre Backend APIs

| API de origem                 | API destino                        | Dados transferidos                          |
|-------------------------------|------------------------------------|---------------------------------------------|
| `/api/municipio/levantamento` | `/api/pipeline/:id` (financeiro)   | VAAF, VAAT, VAAR → receita estimada         |
| `/api/collaborators/:id/docs` | `/api/contratos-fundeb/generate-kit` | Documentos habilitatórios como anexos      |
| `/api/pipeline/:id/stage`     | `/api/audit`                       | Registro de mudança de estágio              |
| `/api/pipeline/kpis`          | `/api/dashboard`                   | KPIs de pipeline consolidados               |

---

## 4. Modelo de Permissões (futuro)

```
Admin (owner)        → Tudo
Gerente              → Dashboard + Pipeline + Colaboradores (leitura)
Colaborador externo  → Somente suas cidades + seus documentos
Financeiro           → Comissões + Dashboard financeiro
```

---

## 5. Fórmulas de Cálculo

### Mensalidade estimada
```
mensalidade = (VAAF + VAAT + VAAR) × percentual_servico
percentual_servico = 0.5% a 1.0% (configurável por porte da cidade)
```

### Comissão do colaborador
```
comissao_mensal = lucro_mensal × percentual_comissao
lucro_mensal = mensalidade - custo_operacional
percentual_comissao = CommissionRule.percent (ex: 5%)
```

### Pipeline ponderado
```
pipeline_ponderado = Σ (receita_estimada × probabilidade_por_estagio)
probabilidade_por_estagio = {
  mapping: 0.10,
  first_contact: 0.20,
  institutional_validation: 0.30,
  technical_diagnosis: 0.40,
  proposal_presented: 0.60,
  negotiation: 0.75,
  verbally_approved: 0.85,
  contractual: 0.90,
  implementation: 0.95,
  fidelized: 1.00,
}
```

---

## 6. Prioridade de Implementação

```
PRIORIDADE 1 (Impacto imediato)
├─ Colaboradores: Edição + Salvar dados
├─ Pipeline: Sidebar + Kanban básico com cidades existentes
└─ Minha Empresa: Upload/download de documentos

PRIORIDADE 2 (Integração)
├─ Colaboradores: Repositório documental
├─ Pipeline: Checklist por estágio
├─ Pipeline: Integração com Levantamento FUNDEB
└─ Pipeline: Integração com Contratos FUNDEB

PRIORIDADE 3 (Automação)
├─ Auto-preenchimento de valores financeiros a partir do diagnóstico
├─ Auto-inclusão de documentos válidos no Kit
├─ Alertas de documentos vencidos
└─ Timeline automática

PRIORIDADE 4 (Polimento)
├─ Dashboard com funil de conversão
├─ Relatórios de comissão
├─ Notificações de próximos passos
└─ Exportação de relatórios
```

---

## 7. Stack Técnica

| Camada    | Tecnologia                    | Uso                                      |
|-----------|-------------------------------|------------------------------------------|
| Frontend  | Flutter (Dart)                | Telas, formulários, Kanban               |
| Backend   | Next.js API Routes (TypeScript)| REST endpoints, lógica de negócio       |
| Banco     | PostgreSQL via Prisma          | Modelos, relações, queries              |
| Storage   | Supabase Storage (ou local)    | Upload/download de documentos           |
| PDF       | `pdf` package (Dart) + backend | Geração de relatórios e kits            |
| Auth      | Session-based (cookie)         | Autenticação colaborador/admin          |
