# Roadmap de Implementação — PrimeOS v2

> **Versão:** 1.0 | **Data:** 2026-06-29 | **Autor:** Equipe Técnica

---

## Resumo Executivo

O PrimeOS precisa evoluir de uma plataforma de consulta para uma **plataforma operacional
completa**, onde cada etapa do ciclo comercial FUNDEB é gerenciada digitalmente:

```
Prospecção → Reunião → Diagnóstico → Proposta → Contrato → Implementação → Fidelização
     ↑           ↑          ↑            ↑           ↑            ↑              ↑
     │           │          │            │           │            │              │
Colaborador  Pipeline   Módulo       Módulo      Empresa +    Operação      Dashboard
             Kanban     FUNDEB     Contratos   Documentos   Mensal         KPIs
```

---

## Sprint 1: Fundação (Semana 1)

### 1.1 — Colaboradores: Edição e Salvar
- [ ] Criar `CollaboratorDetailScreen` com formulário editável
- [ ] Endpoint `PUT /api/collaborators/:id`
- [ ] Validação de campos obrigatórios
- [ ] Feedback visual de salvamento (toast/snackbar)

### 1.2 — Sidebar: Nova entrada "Plano de Ação"
- [ ] Adicionar `AppSection.pipeline` ao enum `AppSection`
- [ ] Criar ícone + label na sidebar
- [ ] Criar `PipelineScreen` placeholder

### 1.3 — Minha Empresa: Upload de documentos
- [ ] Modelo `CompanyDocument` no Prisma (similar ao `CollaboratorDocument`)
- [ ] Endpoint `POST /api/companies/:id/documents` (multipart upload)
- [ ] Endpoint `GET /api/companies/:id/documents`
- [ ] Endpoint `GET /api/companies/:id/documents/:docId/download`
- [ ] UI de upload na seção "Documentação e Atestados" existente

---

## Sprint 2: Pipeline Visual (Semana 2)

### 2.1 — Kanban de Cidades
- [ ] `PipelineKanbanScreen` com colunas por estágio
- [ ] Cards com: cidade, UF, colaborador, receita projetada, dias parado
- [ ] Drag & drop para alterar estágio (atualiza `MunicipalityAccount.currentStage`)
- [ ] Toggle entre visualização Kanban e Tabela

### 2.2 — KPIs do Pipeline
- [ ] Endpoint `GET /api/pipeline/kpis`
- [ ] Cards: Pipeline total, Em reunião, Em negociação, Contratadas, Fidelizadas
- [ ] Funil visual de conversão por estágio

### 2.3 — Detalhe da Cidade (Tab Resumo)
- [ ] `CityPipelineDetailScreen` com 7 tabs
- [ ] Tab "Resumo" com dados do município + contatos + edição
- [ ] Campos: prefeito, secretário educação, procurador, próximo passo, data

---

## Sprint 3: Checklist e Documentos (Semana 3)

### 3.1 — Checklist por estágio
- [ ] Modelo `CityActionItem` no Prisma
- [ ] Items pré-populados ao mudar de estágio
- [ ] Marcar como concluído com data e usuário
- [ ] Endpoint CRUD `/api/pipeline/:id/checklist`

### 3.2 — Colaboradores: Repositório documental
- [ ] Modelo `CollaboratorDocument` no Prisma
- [ ] Upload multipart via API
- [ ] Categorias: fiscal, jurídica, técnica, pessoal, contratual
- [ ] Controle de validade com alertas visuais
- [ ] Download individual

### 3.3 — Timeline da cidade
- [ ] Modelo `CityTimelineEvent` no Prisma
- [ ] Auto-registrar: mudança de estágio, doc anexado, checklist concluído
- [ ] Registrar notas/reuniões manualmente
- [ ] Endpoint `/api/pipeline/:id/timeline`

---

## Sprint 4: Integração FUNDEB (Semana 4)

### 4.1 — Pipeline ↔ Levantamento FUNDEB
- [ ] Tab "Diagnóstico" integra com `getLevantamentoFundeb()`
- [ ] Valores VAAF/VAAT/VAAR preenchem automaticamente campos financeiros
- [ ] Botão "Gerar Levantamento" dentro do Plano de Ação

### 4.2 — Pipeline ↔ Contratos FUNDEB
- [ ] Tab "Proposta" integra com `gerarPropostaDocx()`
- [ ] Tab "Kit Documental" integra com `gerarKitContratosFundebComAnexos()`
- [ ] Auto-inclusão de documentos válidos do colaborador e empresa

### 4.3 — Valores financeiros automáticos
- [ ] Fórmula: mensalidade = FUNDEB total × percentual (configurável)
- [ ] Custo estimado por porte de cidade
- [ ] Lucro = mensalidade - custo
- [ ] Comissão = lucro × percentual do colaborador

---

## Sprint 5: Dashboard e Polimento (Semana 5)

### 5.1 — Dashboard integrado com Pipeline
- [ ] Card "Pipeline" com valor total ponderado
- [ ] Gráfico de funil de conversão
- [ ] Top 5 cidades por potencial de receita
- [ ] Alertas: cidades paradas > 7 dias, documentos vencidos

### 5.2 — Colaboradores: Comissões
- [ ] Tab "Comissões" com regras, accruals e payouts
- [ ] Totalização YTD pago vs. a pagar
- [ ] Geração de pagamento

### 5.3 — Polimento UX
- [ ] Transições suaves entre telas
- [ ] Skeletons durante carregamento
- [ ] Empty states com CTAs claros
- [ ] Responsividade mobile (Flutter Web)

---

## Métricas de Sucesso

| Métrica                              | Meta                    |
|--------------------------------------|-------------------------|
| Tempo para cadastrar cidade          | < 2 minutos             |
| Tempo para gerar diagnóstico         | < 30 segundos           |
| Tempo para gerar kit documental      | < 1 minuto              |
| Documentos vencidos visíveis         | 100% com alertas        |
| Pipeline sempre atualizado           | Atualização em tempo real|
| Comissões calculadas automaticamente | Após fidelização        |

---

## Dependências Técnicas

- [ ] Supabase Storage (ou equivalente) para upload de documentos
- [ ] Prisma migrations para novos modelos
- [ ] Flutter file_picker para upload mobile/desktop
- [ ] Drag & drop library para Kanban (desktop)

---

## Referências

- [Pipeline de Cidades](./PIPELINE_CIDADES_PLANO_ACAO.md)
- [Colaboradores — Edição e Docs](./COLABORADORES_EDICAO_DOCS_FUNDEB.md)
- [Mapa de Integração](./INTEGRACAO_SISTEMA_MAPA.md)
- [Specs Colaboradores (existentes)](./colaboradores/)
- [Roadmap FUNDEB (existente)](../roadmaps/roadmap_automacao_fundeb.md)
