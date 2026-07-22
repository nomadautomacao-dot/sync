# Pipeline de Cidades — Plano de Ação Integrado

> **Objetivo:** Criar um fluxo operacional completo dentro do PrimeOS que conduza um município
> desde o primeiro contato até o contrato FUNDEB assinado e a implementação em curso, com
> rastreabilidade total, documentação vinculada e valores calculados automaticamente.

---

## 1. Visão Geral do Fluxo Comercial

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  PROSPECÇÃO   │ →  │  REUNIÃO CIDADE  │ →  │   CHECKLIST DOC  │ →  │   DIAGNÓSTICO    │ →  │   CONTRATUAL     │
│              │    │                 │    │  (Sec. Educação) │    │  FUNDEB + IDEB   │    │  Kit Documental  │
│ Colaborador  │    │ Reunião marcada │    │  Docs pendentes  │    │  Relatório auto  │    │  Proposta, NFs,  │
│ indica cidade│    │ com gestor mun. │    │  Atas, decretos  │    │  Levantamento    │    │  Contrato assinado│
└──────────────┘    └─────────────────┘    └──────────────────┘    └──────────────────┘    └──────────────────┘
                                                                                                    │
                                                                          ┌─────────────────────────┘
                                                                          ▼
                                                                ┌──────────────────┐    ┌──────────────────┐
                                                                │  IMPLEMENTAÇÃO   │ →  │   FIDELIZAÇÃO    │
                                                                │  Kickoff, setup  │    │  Base recorrente │
                                                                │  Acompanhamento  │    │  Comissões ativas│
                                                                └──────────────────┘    └──────────────────┘
```

### Estágios (já existem no Prisma como `MunicipalityStage`)

| # | Stage Key                  | Label (PT-BR)            | Descrição                                                |
|---|----------------------------|--------------------------|----------------------------------------------------------|
| 1 | `mapping`                  | Mapeamento               | Cidade identificada, dados IBGE coletados                |
| 2 | `first_contact`            | Primeiro Contato         | Colaborador marcou reunião com gestor/prefeito           |
| 3 | `institutional_validation` | Validação Institucional  | Checklist documental com Sec. Educação                   |
| 4 | `technical_diagnosis`      | Diagnóstico Técnico      | Levantamento FUNDEB + IDEB + SICONFI gerado              |
| 5 | `proposal_presented`       | Proposta Apresentada     | Proposta técnica + comercial entregue                    |
| 6 | `negotiation`              | Negociação               | Ajustes de valores, prazos, modalidade                   |
| 7 | `verbally_approved`        | Aprovação Verbal         | Acordo verbal, aguardando formalização                   |
| 8 | `contractual`              | Fase Contratual          | Kit documental montado, licitação/inexigibilidade        |
| 9 | `implementation`           | Implementação            | Contrato assinado, operação em curso                     |
| 10| `assisted_operation`       | Operação Assistida       | Acompanhamento mensal ativo                              |
| 11| `fidelized`                | Fidelizada               | Base recorrente consolidada, comissões fluindo           |
| 12| `paused`                   | Pausada                  | Cidade temporariamente inativa                           |
| 13| `lost`                     | Perdida                  | Negociação encerrada sem contrato                        |

---

## 2. Nova Seção na Sidebar: "Plano de Ação"

### Onde fica na sidebar

```
WORKSPACE
├─ Dashboard
├─ Inbox
├─ Minha Empresa
├─ Colaboradores
├─ **Plano de Ação** ← NOVO (ícone: LucideIcons.route ou LucideIcons.clipboardList)
├─ Módulos
└─ Configurações
```

### O que contém a seção "Plano de Ação"

A tela "Plano de Ação" é uma **visão Kanban + Tabela** do pipeline de cidades, com:

#### 2.1 — Visualização Kanban (modo padrão)
- Colunas = estágios do pipeline
- Cards = cidades, com:
  - Nome da cidade + UF
  - Nome do colaborador responsável
  - Receita projetada
  - Próximo passo (texto livre)
  - Data do próximo passo
  - Indicador de "há quantos dias está parado"
- Drag & drop para mover entre colunas (atualiza stage)

#### 2.2 — Visualização Tabela (toggle)
- Já existe parcialmente na `CitiesScreen`
- Adicionar colunas: Próximo Passo, Data, Documentos pendentes

#### 2.3 — KPIs do Pipeline
- Pipeline total (soma de `estimatedAnnualRevenue` ponderada por `probability`)
- Conversão por estágio (funil)
- Tempo médio em cada estágio
- Cidades sem atividade > 7 dias (alerta)

#### 2.4 — Cada cidade expande para um "Plano de Ação Detalhado"
Ao clicar na cidade, abre uma tela/sheet com tabs:

| Tab                  | Conteúdo                                                                  |
|----------------------|---------------------------------------------------------------------------|
| **Resumo**           | Dados da cidade, contatos, estágio atual, histórico de movimentação       |
| **Checklist**        | Lista de documentos/ações por estágio (dinâmico por stage)                |
| **Diagnóstico**      | Relatório FUNDEB + IDEB integrado (já existe no módulo Levantamento)      |
| **Proposta**         | Geração da proposta técnica + comercial (já existe no módulo Contratos)   |
| **Kit Documental**   | Upload/download de documentos habilitatórios (já existe no Kit Documental)|
| **Financeiro**       | Valores projetados, mensalidade, comissão do colaborador                  |
| **Histórico**        | Timeline de todas as ações (audit trail)                                  |

---

## 3. Checklist Documental por Estágio

### 3.1 — Primeiro Contato (`first_contact`)
- [ ] Reunião agendada (data + local/virtual)
- [ ] Ata/registro da reunião
- [ ] Identificação dos decisores (prefeito, secretário, procurador)

### 3.2 — Validação Institucional (`institutional_validation`)
- [ ] Contato com Secretário de Educação confirmado
- [ ] Levantamento FUNDEB preliminar compartilhado
- [ ] Interesse formal registrado

### 3.3 — Diagnóstico Técnico (`technical_diagnosis`)
- [ ] Levantamento FUNDEB completo gerado (via módulo existente)
- [ ] Relatório Dirigido gerado (IDEB, SAEB, Censo)
- [ ] Dados de receita FUNDEB do município validados
- [ ] Diagnóstico apresentado ao secretário

### 3.4 — Proposta Apresentada (`proposal_presented`)
- [ ] Proposta Técnica e Comercial gerada (DOCX — módulo existente)
- [ ] Valores de mensalidade definidos
- [ ] Proposta entregue formalmente
- [ ] Feedback do município recebido

### 3.5 — Fase Contratual (`contractual`)
- [ ] Modalidade definida (Inexigibilidade / Dispensa / Pregão)
- [ ] Certidões da empresa atualizadas
- [ ] Kit documental completo (módulo existente)
- [ ] Edital/termo de referência publicado
- [ ] Contrato assinado

### 3.6 — Implementação (`implementation`)
- [ ] Kickoff realizado
- [ ] Acesso aos sistemas do município
- [ ] Primeiro relatório mensal entregue
- [ ] Pagamento da primeira mensalidade confirmado

---

## 4. Integração com Módulos Existentes

### Módulo Levantamento FUNDEB → Diagnóstico
- Na tab "Diagnóstico" do Plano de Ação, o botão "Gerar Levantamento" chama
  `repository.getLevantamentoFundeb()` já existente
- Os valores de VAAF, VAAT, VAAR são automaticamente preenchidos nos campos financeiros
- O relatório PDF pode ser baixado e compartilhado com o município

### Módulo Contratos FUNDEB → Proposta + Kit
- Na tab "Proposta", o botão "Gerar Proposta" chama `repository.gerarPropostaDocx()`
- Na tab "Kit Documental", integra com `repository.gerarKitContratosFundebComAnexos()`
- Os valores de mensalidade e êxito vêm do diagnóstico

### Módulo Colaboradores → Responsável
- Cada cidade tem um `collaboratorId` vinculado
- As comissões são calculadas com base nos `CommissionRule` já existentes
- O Plano de Ação mostra: valor projetado de comissão para o colaborador

### Dashboard → KPIs
- Pipeline total alimenta `projectedGrossRevenue` do Dashboard
- Funil de conversão alimenta os gráficos de `portfolioMix`
- Cidades em cada estágio alimentam os `kpis` do Dashboard

---

## 5. Modelo de Dados — Novos campos/tabelas

### 5.1 — `CityActionItem` (novo modelo Prisma)

```prisma
model CityActionItem {
  id                    String              @id @default(cuid())
  municipalityAccountId String
  municipalityAccount   MunicipalityAccount @relation(fields: [municipalityAccountId], references: [id], onDelete: Cascade)
  stage                 MunicipalityStage
  title                 String              // "Reunião com secretário"
  description           String?
  completed             Boolean             @default(false)
  completedAt           DateTime?
  completedByUserId     String?
  dueDate               DateTime?
  sortOrder             Int                 @default(0)
  category              String              @default("checklist") // checklist | document | meeting | milestone
  documentUrl           String?             // URL do documento anexado (se for tipo document)
  documentName          String?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  @@index([municipalityAccountId, stage])
}
```

### 5.2 — `CityTimelineEvent` (novo modelo)

```prisma
model CityTimelineEvent {
  id                    String              @id @default(cuid())
  municipalityAccountId String
  municipalityAccount   MunicipalityAccount @relation(fields: [municipalityAccountId], references: [id], onDelete: Cascade)
  eventType             String              // stage_change | meeting | document_uploaded | note | milestone
  description           String
  metadata              Json?
  userId                String?
  createdAt             DateTime            @default(now())

  @@index([municipalityAccountId, createdAt])
}
```

### 5.3 — Campos adicionais em `MunicipalityAccount`

```prisma
// Adicionar ao model MunicipalityAccount existente:
  nextStepDescription     String?
  nextStepDueDate         DateTime?
  lastActivityAt          DateTime?
  collaboratorId          String?
  collaborator            Collaborator? @relation(fields: [collaboratorId], references: [id])
```

---

## 6. API Endpoints Necessários

| Método | Rota                                          | Descrição                                    |
|--------|-----------------------------------------------|----------------------------------------------|
| GET    | `/api/pipeline`                               | Lista cidades com dados de pipeline          |
| GET    | `/api/pipeline/:cityId`                       | Detalhe completo de uma cidade no pipeline   |
| PUT    | `/api/pipeline/:cityId/stage`                 | Atualiza estágio (Kanban drag)               |
| GET    | `/api/pipeline/:cityId/checklist`             | Items do checklist por estágio               |
| POST   | `/api/pipeline/:cityId/checklist`             | Cria item no checklist                       |
| PUT    | `/api/pipeline/:cityId/checklist/:itemId`     | Marca item como concluído                    |
| GET    | `/api/pipeline/:cityId/timeline`              | Timeline de eventos                          |
| POST   | `/api/pipeline/:cityId/timeline`              | Adiciona evento manual (nota, reunião)       |
| GET    | `/api/pipeline/kpis`                          | KPIs do pipeline para o dashboard            |

---

## 7. Fases de Implementação

### Fase 1 — Sidebar + Kanban básico (1-2 dias)
- Adicionar `AppSection.pipeline` ao enum
- Criar `PipelineScreen` com Kanban visual
- Reutilizar dados de `getCities()` já existente
- Agrupar por `currentStage`

### Fase 2 — Detalhe da cidade com tabs (2-3 dias)
- Criar `CityPipelineDetailScreen` com tabs
- Tab "Resumo" com dados básicos + edição
- Tab "Checklist" com items dinâmicos por estágio
- Tab "Financeiro" com cálculos automáticos

### Fase 3 — Integração com módulos existentes (2-3 dias)
- Tab "Diagnóstico" integrada com Levantamento FUNDEB
- Tab "Proposta" integrada com Contratos FUNDEB
- Tab "Kit Documental" integrada com Kit existente
- Valores do diagnóstico preenchem automaticamente campos financeiros

### Fase 4 — Backend APIs + Banco (2-3 dias)
- Criar modelos Prisma novos
- Implementar endpoints de pipeline
- Migrar dados existentes de `MunicipalityAccount` para o novo formato

### Fase 5 — Timeline + Auditoria (1-2 dias)
- Tab "Histórico" com timeline visual
- Registrar automaticamente mudanças de estágio
- Registrar uploads de documentos

### Fase 6 — Dashboard integrado (1 dia)
- Funil de conversão no Dashboard
- Pipeline total em valor
- Alertas de cidades paradas

---

## 8. Fluxo Operacional Completo (Exemplo)

```
1. Colaborador "João" identifica a cidade "Arapiraca/AL"
   → Cadastra no sistema → Stage: mapping

2. João agenda reunião com o prefeito
   → Registra data da reunião no checklist → Stage: first_contact

3. Reunião realizada, prefeito interessado
   → Marca ata da reunião como concluída → Stage: institutional_validation

4. Reunião com Secretário de Educação
   → Compartilha levantamento FUNDEB preliminar (gerado pelo sistema)
   → Confirma interesse formal → Stage: technical_diagnosis

5. Sistema gera diagnóstico completo
   → Levantamento FUNDEB com VAAF/VAAT/VAAR
   → Relatório Dirigido IDEB/SAEB
   → Valores de mensalidade calculados → Stage: proposal_presented

6. Proposta técnica e comercial gerada pelo sistema
   → DOCX baixado e apresentado ao município
   → Feedback recebido → Stage: negotiation

7. Acordo verbal com município
   → Stage: verbally_approved

8. Kit documental completo montado
   → Certidões, atestados, balanços (docs do colaborador/empresa)
   → Edital de inexigibilidade publicado → Stage: contractual

9. Contrato assinado!
   → Stage: implementation
   → Comissão de João começa a acumular

10. Após 6 meses operando → Stage: fidelized
    → Base recorrente consolidada
```
