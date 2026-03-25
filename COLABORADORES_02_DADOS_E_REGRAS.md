# COLABORADORES 02 - DADOS, COMISSAO E REGRAS

Data: 2026-03-06
Projeto: Sync
Objetivo: definir modelo de dados, regras de comissao, fidelizacao e forecast

---

## 1. Principio financeiro central

A comissao do colaborador nao pode depender de memoria, conversa solta ou planilha paralela.

Ela precisa de:
- regra formal
- base de calculo explicita
- snapshot financeiro por cidade
- aprovacao
- historico

---

## 2. Base recomendada para comissao

Base principal sugerida:
- `lucro operacional pre-comissao`

Formula sugerida:

`lucro_base = receita_reconhecida - custos_diretos - implantacao_rateada - impostos_diretos - despesas_operacionais_diretas_da_conta`

Depois:

`comissao = lucro_base x percentual`

---

## 3. O que evitar

Nao recomendo usar:
- receita bruta como base padrao
- lucro liquido contabil da empresa inteira
- valor "de cabeca" sem rastreabilidade mensal

Razao:
- receita bruta pode superremunerar cidade cara
- lucro liquido total mistura custo corporativo
- valor solto destrói a auditabilidade

---

## 4. Regra padrao para o seu caso

Pelo que voce descreveu, a regra padrao deveria ser:
- percentual: `3%`
- base: `recurring_profit_pre_commission`
- gatilho: `monthly_recurring_after_fidelization`

Ou seja:
- a cidade fideliza
- o sistema passa a reconhecer comissao recorrente sobre o lucro base

---

## 5. Tipos de base de comissao

Valores recomendados:
- `gross_revenue`
- `gross_margin`
- `recurring_profit_pre_commission`
- `operational_profit_pre_commission`
- `net_profit`

Padrao ideal:
- `operational_profit_pre_commission`

---

## 6. Gatilhos de comissao

Valores recomendados:
- `on_signature`
- `on_go_live`
- `on_fidelization`
- `monthly_recurring_after_fidelization`
- `milestone_based`

Para o seu modelo:
- `monthly_recurring_after_fidelization`

---

## 7. Regra, reconhecimento e pagamento

Tres entidades diferentes:

`CommissionRule`
- o que foi combinado

`CommissionAccrual`
- o que foi gerado em determinado periodo

`CommissionPayout`
- o que foi efetivamente pago

Sem essa separacao, o historico fica quebrado.

---

## 8. Status do reconhecimento mensal

Valores recomendados:
- `draft`
- `calculated`
- `under_review`
- `approved`
- `blocked`
- `paid`

---

## 9. Status do pagamento

Valores recomendados:
- `scheduled`
- `processing`
- `paid`
- `disputed`
- `cancelled`

---

## 10. Fidelizacao

Fidelizacao precisa de criterio objetivo.

Campos recomendados:
- `goLiveDate`
- `firstRevenueRecognitionDate`
- `fidelityEligibleAt`
- `fidelityApprovedAt`
- `fidelityApprovedByUserId`
- `fidelityStatus`
- `fidelityNotes`

Status:
- `not_started`
- `tracking`
- `eligible`
- `approved`
- `blocked`
- `revoked`

---

## 11. Criterio padrao de fidelizacao

Sugestao de regra:
- cidade em operacao ativa
- pelo menos 1 ciclo mensal completo
- sem bloqueio critico
- com receita reconhecida
- aprovacao manual do owner/admin

---

## 12. Milestones de implantacao

Milestones recomendados:
- kickoff realizado
- acesso a dados recebido
- contato tecnico definido
- cronograma validado
- primeiro diagnostico entregue
- primeiro ciclo operacional executado
- ajustes aplicados
- go-live
- primeiro fechamento
- elegivel a fidelizacao

---

## 13. Snapshot financeiro mensal

Cada cidade ativa deve guardar por mes:
- receita reconhecida
- custo direto
- custo de implantacao rateado
- impostos diretos
- lucro base
- observacoes

Sem snapshot, nao existe comissao confiavel.

---

## 14. Forecast - principio

Forecast nao deve ser chute.

Ele deve usar:
- valor estimado
- probabilidade
- etapa atual
- data esperada de entrada
- risco de atraso

---

## 15. Probabilidades padrao por etapa

| Etapa | Probabilidade |
|---|---:|
| mapping | 0.05 |
| first_contact | 0.10 |
| institutional_validation | 0.20 |
| technical_diagnosis | 0.35 |
| proposal_presented | 0.50 |
| negotiation | 0.65 |
| verbally_approved | 0.80 |
| contractual | 0.90 |
| implementation | 0.95 |
| assisted_operation | 0.98 |
| fidelized | 1.00 |
| paused | 0.00 |
| lost | 0.00 |

---

## 16. Formula do valor ponderado

`valor_ponderado = lucro_estimado x probabilidade`

Para o ano seguinte:

`valor_ponderado_ano_seguinte = lucro_anual_cheio x probabilidade x fator_temporal`

Exemplo:
- lucro cheio: 120.000
- probabilidade: 0.80
- entrada em julho: fator temporal 0.50
- valor ponderado: 48.000

---

## 17. Categorias de forecast

Categorias recomendadas:
- `pipeline`
- `best_case`
- `commit`
- `active_recurring`
- `fidelized_recurring`
- `lost_or_paused`

---

## 18. O que entra no forecast do ano atual

Devem entrar:
- cidades fidelizadas
- cidades em operacao assistida
- cidades em implantacao com parte do ano util
- oportunidades muito avancadas com entrada no proprio ano

---

## 19. O que entra no forecast do ano seguinte

Blocos recomendados:
- base recorrente garantida
- cidades em implantacao que viram recorrencia
- pipeline novo ponderado
- risco de perda/churn

Formula executiva:

`forecast_ano_seguinte = base_recorrente + novas_implantacoes + pipeline_ponderado - risco_de_churn`

---

## 20. Media de retorno do ano atual

Sugestao:

`media_retorno_ano_atual = lucro_base_ytd / numero_de_cidades_com_receita_no_ano`

Ou, se quiser ser mais restritivo:

`media_retorno_por_cidade_fidelizada = lucro_base_ytd / numero_de_cidades_fidelizadas_com_receita`

---

## 21. Media de retorno do ano seguinte

Sugestao:

`media_retorno_ano_seguinte = forecast_lucro_ano_seguinte / numero_de_cidades_previstas_ativas_no_ano_seguinte`

Recomendo duas visoes:
- conservadora
- expandida

Conservadora:
- apenas `fidelized_recurring` + `commit`

Expandida:
- `fidelized_recurring` + `commit` + `best_case`

---

## 22. KPI dictionary - cidades

`cidades_trabalhadas_no_ano`
- numero de municipios com atividade no ano

`cidades_ativas`
- cidades em `assisted_operation` ou `fidelized`

`cidades_em_implantacao`
- cidades em `implementation`

`cidades_fidelizadas`
- cidades com `fidelityStatus = approved`

`cidades_perdidas`
- oportunidades encerradas como `lost`

---

## 23. KPI dictionary - financeiro

`receita_bruta_ytd`
- soma da receita reconhecida do ano

`lucro_base_ytd`
- soma do lucro base do ano

`margem_media_por_cidade`
- lucro base ytd / numero de cidades com receita

`ticket_medio_anual`
- receita anual estimada media por cidade

`lucro_ponderado_pipeline`
- soma do lucro estimado ponderado por probabilidade

---

## 24. KPI dictionary - colaboradores

`colaboradores_ativos`
- parceiros com participacao ativa

`colaboradores_com_resultado`
- parceiros com pelo menos 1 cidade em implantacao, ativa ou fidelizada

`lucro_gerado_por_colaborador`
- lucro das cidades associadas a ele conforme regra adotada

`comissao_prevista`
- soma de accruals previstas

`comissao_reconhecida`
- soma de accruals aprovadas

`comissao_paga`
- soma de pagamentos realizados

---

## 25. KPI dictionary - forecast hygiene

`cidades_sem_proximo_passo`
- oportunidades abertas sem `nextStep`

`cidades_sem_atividade_recente`
- sem atividade ha X dias

`cidades_com_prazo_vencido`
- expected close/start date no passado e ainda abertas

`cidades_sem_stakeholder_principal`
- risco de conta mal mapeada

---

## 26. Exemplos praticos

Exemplo 1:
- receita: 40.000
- custo direto: 18.000
- implantacao rateada: 2.000
- impostos/despesas: 4.000
- lucro base: 16.000
- comissao 3%: 480

Exemplo 2:
- lucro anual cheio: 90.000
- probabilidade: 0.50
- entrada em abril: fator 0.75
- forecast do proximo ano: 33.750

---

## 27. Regras de negocio essenciais

Regras:
- cidade pode existir sem colaborador
- colaborador pode existir sem cidade
- oportunidade precisa de etapa e probabilidade
- oportunidade perdida exige motivo
- cidade fidelizada so existe apos go-live
- accrual nao pode ser paga sem aprovacao
- alteracao de percentual deve gerar audit log
- lucro negativo nao deve gerar accrual positiva

---

## 28. Higiene de pipeline

O sistema deve alertar automaticamente:
- cidade com prazo esperado vencido
- cidade muito tempo na mesma etapa
- cidade aberta acima do ciclo medio
- cidade sem owner
- cidade sem next step
- cidade sem contato principal

Esses alertas impactam diretamente a qualidade do forecast.

---

## 29. Score de oportunidade

Componentes recomendados:
- fit politico
- fit tecnico
- urgencia
- cobertura de stakeholders
- confianca no colaborador
- ticket potencial
- risco juridico

Formula inicial:

`score = (fit_politico * 0.15) + (fit_tecnico * 0.20) + (urgencia * 0.15) + (stakeholder_coverage * 0.10) + (confianca_colaborador * 0.15) + (ticket_score * 0.15) - (risco_juridico * 0.10)`

---

## 30. Recomendacao final de modelagem

Manter `Employee` para RH interno, se ainda for util.

Criar o novo dominio:
- `Collaborator`
- `MunicipalityAccount`
- `MunicipalityOpportunity`
- `ServiceImplementation`
- `CommissionRule`
- `CommissionAccrual`
- `CommissionPayout`
- `ForecastSnapshot`

Esse e o caminho mais limpo para o seu negocio.

