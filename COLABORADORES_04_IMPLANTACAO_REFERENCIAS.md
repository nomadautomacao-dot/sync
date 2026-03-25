# COLABORADORES 04 - IMPLANTACAO, ROADMAP E REFERENCIAS

Data: 2026-03-06
Projeto: Sync
Objetivo: orientar implementacao tecnica e registrar as referencias usadas no desenho

---

## 1. Estrategia geral

A migracao nao deve ser destrutiva.

Caminho recomendado:
- manter `Employee` para RH interno, se necessario
- criar `Collaborator` para o novo dominio
- mover a UI de `/people` para `Collaborator`
- adicionar `MunicipalityAccount` e `MunicipalityOpportunity`
- depois ligar comissao e forecast

---

## 2. O que reaproveitar do Sync atual

Reaproveitar:
- Next.js App Router
- layout do workspace
- React Query
- Prisma
- audit log
- rota `/people`
- dashboard shell atual

---

## 3. O que precisa evoluir

Evoluir:
- schemas de dominio
- formularios
- API routes
- dashboard principal
- relacao cidade <-> colaborador
- forecast
- engine de comissao

---

## 4. O que nao fazer

Evitar:
- enfiar toda a logica em `Employee`
- usar `Company` como se fosse prefeitura
- pagar comissao por anotacao manual
- depender de planilha paralela para forecast

---

## 5. Arquivos do repo impactados

Arquivos locais mais relevantes:
- `app/(workspace)/people/page.tsx`
- `components/forms/employee-form.tsx`
- `core/domain/organization.ts`
- `prisma/schema.prisma`
- `modules/dashboard/dashboard-page.tsx`
- `core/config/navigation.ts`

---

## 6. Estrutura futura recomendada

Dominio:
- `core/domain/collaborator.ts`
- `core/domain/municipality.ts`
- `core/domain/opportunity.ts`
- `core/domain/commission.ts`
- `core/domain/forecast.ts`

Hooks:
- `core/hooks/use-collaborators.ts`
- `core/hooks/use-collaborator-dashboard.ts`
- `core/hooks/use-municipalities.ts`
- `core/hooks/use-executive-dashboard.ts`

Telas:
- `modules/collaborators/collaborators-page.tsx`
- `modules/collaborators/collaborator-dashboard-page.tsx`
- `modules/municipalities/municipalities-page.tsx`
- `modules/municipalities/municipality-detail-page.tsx`
- `modules/dashboard/executive-dashboard-page.tsx`

APIs:
- `app/api/collaborators/route.ts`
- `app/api/collaborators/[id]/route.ts`
- `app/api/collaborators/[id]/dashboard/route.ts`
- `app/api/municipalities/route.ts`
- `app/api/municipalities/[id]/route.ts`
- `app/api/dashboard/executive/route.ts`

---

## 7. Fase 1 - reposicionamento semantico

Objetivo:
- trocar linguagem de funcionario para colaborador

Entregas:
- label `Pessoas` -> `Colaboradores`
- CTA `Novo funcionario` -> `Novo colaborador`
- formulario rebatizado
- nova descricao da pagina

Valor:
- alinhamento imediato com o negocio real

---

## 8. Fase 2 - cadastro de colaboradores

Objetivo:
- criar entidade `Collaborator`

Entregas:
- schema Prisma
- CRUD basico
- filtros
- tabela com metricas iniciais

Valor:
- sair do RH generico e entrar em rede de parceiros

---

## 9. Fase 3 - cadastro de municipios e pipeline

Objetivo:
- criar prefeitura como conta principal

Entregas:
- `MunicipalityAccount`
- `MunicipalityOpportunity`
- stakeholders
- pipeline por etapa

Valor:
- visibilidade real do negocio

---

## 10. Fase 4 - participacoes e ownership

Objetivo:
- ligar colaborador a cidade

Entregas:
- `CollaboratorParticipation`
- owner interno
- fontes de oportunidade
- papel principal por cidade

Valor:
- saber quem trouxe o que

---

## 11. Fase 5 - implantacao e fidelizacao

Objetivo:
- separar fechamento de operacao madura

Entregas:
- `ServiceImplementation`
- milestones
- criterio de fidelizacao
- timeline

Valor:
- previsao mais confiavel

---

## 12. Fase 6 - snapshots financeiros e comissao

Objetivo:
- tornar a remuneracao auditavel

Entregas:
- snapshots mensais
- regras de comissao
- accrual
- payout

Valor:
- seguranca financeira e historico

---

## 13. Fase 7 - dashboard executivo completo

Objetivo:
- responder ano atual e ano seguinte

Entregas:
- cards anuais
- curva mensal
- ranking de colaboradores
- forecast do proximo ano
- painel de higiene

Valor:
- cockpit executivo real

---

## 14. Fase 8 - inteligencia

Objetivo:
- melhorar qualidade de previsao

Entregas:
- probabilidades ajustadas por historico
- scoring
- alertas inteligentes
- comparativos por regiao/servico

---

## 15. Estrategia de carga inicial

Provavel origem dos dados:
- planilhas
- cadernos
- mensagens
- memoria operacional

Ordem recomendada de importacao:
- colaboradores
- municipios
- participacoes
- previsoes
- regras de comissao

---

## 16. CSVs recomendados

Arquivos:
- `seed_collaborators.csv`
- `seed_municipalities.csv`
- `seed_participations.csv`
- `seed_financial_projections.csv`
- `seed_commission_rules.csv`

---

## 17. Campos minimos do CSV de colaboradores

Campos:
- full_name
- short_name
- type
- email
- phone
- whatsapp
- state
- primary_role
- partnership_status
- default_commission_percent

---

## 18. Campos minimos do CSV de municipios

Campos:
- municipality_name
- state
- ibge_code
- owner_email
- stage
- estimated_annual_revenue
- estimated_annual_cost
- expected_start_date
- expected_fidelization_date

---

## 19. Campos minimos do CSV de participacoes

Campos:
- collaborator_email_or_name
- municipality_name
- state
- participation_type
- agreed_commission_percent
- trigger_type
- base_type
- is_primary_source

---

## 20. Auditoria obrigatoria

Eventos a registrar:
- colaborador criado
- percentual alterado
- participacao criada
- owner alterado
- etapa alterada
- fidelizacao aprovada
- accrual recalculada
- payout aprovado
- payout pago

---

## 21. Permissoes recomendadas

Perfis:
- owner
- admin
- financeiro
- comercial
- implantacao
- viewer

Campos mais sensiveis:
- custo
- lucro base
- percentual
- payout proof
- notas confidenciais

---

## 22. Riscos principais

Riscos:
- percentual mal definido
- forecast inflado
- dados incompletos
- cidade sem ownership
- pagamento sem lastro

Mitigacoes:
- aprovacao
- probabilidades por etapa
- score de qualidade
- owner obrigatorio
- accrual mensal

---

## 23. Benchmark externo sintetizado

Aprendizados usados:
- dashboards de vendas fortes mostram pipeline, ciclo e fonte
- programas de parceria precisam de expected revenue e metricas por parceiro
- weighted forecast melhora leitura executiva
- categorias de forecast ajudam a separar o que e recorrente do que e apenas chance
- pipeline hygiene e essencial para previsao confiavel

---

## 24. Fontes externas usadas

1. Salesforce Revenue Intelligence
https://www.salesforce.com/sales/revenue-intelligence/

2. Salesforce sales dashboard tips
https://www.salesforce.com/in/hub/analytics/essential-sales-dashboard-tips/

3. Salesforce channel partnerships
https://www.salesforce.com/blog/channel-partnerships/

4. Salesforce partner incentive programs
https://www.salesforce.com/sales/channel-revenue-management/channel-partner-incentive-programs/

5. Salesforce public sector capture management
https://www.salesforce.com/government/guided-tours/capture-management/

6. Salesforce sales pipeline
https://www.salesforce.com/resources/articles/sales-pipeline/

7. HubSpot forecast tool
https://knowledge.hubspot.com/forecast/set-up-the-forecast-tool

8. HubSpot AI forecasting
https://knowledge.hubspot.com/forecast/improve-forecasting-with-ai-projections

9. HubSpot forecast reports
https://blog.hubspot.com/customers/6-sales-reports-to-improve-your-forecast

---

## 25. Decisao recomendada agora

Se for escolher a ordem certa:

1. Assumir oficialmente que a area e de colaboradores, nao de funcionarios.
2. Criar municipio/prefeitura como conta principal.
3. Formalizar percentual, base e gatilho de comissao.
4. Separar ganho, implantacao e fidelizacao.
5. Refazer o dashboard principal em torno de cidades, lucro e projeção.

---

## 26. Resultado final esperado

Ao seguir esse plano, o Sync deixa de ser:
- cadastro generico de equipe

E passa a ser:
- plataforma de expansao municipal
- controle de colaborador
- controle de cidade
- controle de implantacao
- controle de comissao
- previsao anual e do proximo ano

