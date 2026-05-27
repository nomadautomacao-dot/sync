# COLABORADORES 01 - VISAO E DOMINIO

Data: 2026-03-06
Projeto: Sync
Objetivo: reposicionar a area `Pessoas` para o dominio real de `Colaboradores` e `Prefeituras`

---

## 1. Contexto

O repositorio atual mostra um sistema com:
- dashboard
- empresas
- pessoas
- modulos
- schema Prisma simples
- cadastro de `Employee`

Mas o seu negocio real, pela sua descricao e pelos documentos locais, depende de:
- colaboradores
- municipios/prefeituras
- implantacao de servico de assessoria
- fidelizacao
- percentual sobre lucro
- previsao por cidade
- dashboard individual por colaborador

---

## 2. O problema do modelo atual

Hoje o sistema traduz a area de pessoas como:
- funcionario
- cargo
- perfil
- data de admissao
- empresa vinculada

Isso serve para RH basico.

Nao serve para:
- articulador local
- parceiro externo
- colaborador que abre portas em prefeitura
- captacao de municipio
- comissao sobre lucro
- acompanhamento de cidades em implantacao

---

## 3. Decisao conceitual principal

O Sync deve assumir oficialmente que:
- `Pessoas`, na camada visivel do produto, significa `Colaboradores`
- a unidade principal do negocio nao e o funcionario, e sim a `Prefeitura/Municipio`
- o motor economico e o conjunto `Cidade + Oportunidade + Implantacao + Fidelizacao + Lucro + Comissao`

---

## 4. O que foi entendido sobre o seu servico

Inferencia baseada em:
- sua mensagem
- `servico-case-sucesso.md`
- `ARCHITECTURE.md`
- modulo atual de `case-de-sucesso`

Leitura de negocio:
- o Sync atende contexto municipal
- o servico tem natureza de assessoria/consultoria
- a entrada em novas cidades depende de relacionamento institucional/local
- colaboradores ajudam a viabilizar a operacao em prefeituras
- o pagamento ao colaborador acontece quando a cidade fideliza
- a comissao e percentual sobre lucro, e nao apenas premio de assinatura

---

## 5. Perguntas que o sistema precisa responder

O sistema futuro precisa responder:
- quem trouxe ou influenciou cada prefeitura?
- em que etapa esta cada cidade?
- qual e o valor estimado da oportunidade?
- qual e o lucro estimado e o lucro realizado?
- qual percentual foi combinado com cada colaborador?
- quanto cada colaborador ja gerou?
- quanto cada colaborador ainda pode gerar?
- quais cidades fidelizaram neste ano?
- qual a media de retorno por cidade neste ano?
- qual a media de retorno esperada para o ano que vem?

---

## 6. Novo glossario

| Termo | Definicao |
|---|---|
| Colaborador | Pessoa que contribui para captacao, relacionamento, negociacao ou implantacao de um servico em uma prefeitura |
| Prefeitura | Conta institucional principal do negocio |
| Municipio | Unidade geografica e comercial equivalente a conta municipal |
| Oportunidade | Tentativa comercial em andamento dentro de uma prefeitura |
| Implantacao | Periodo entre fechamento e operacao estabilizada |
| Fidelizacao | Momento em que a cidade passa a ser considerada valida para recorrencia e comissionamento |
| Lucro base | Lucro usado como referencia para calcular a comissao |
| Comissao prevista | Valor esperado de pagamento |
| Comissao reconhecida | Valor validado para pagamento |
| Comissao paga | Valor efetivamente quitado |
| Forecast | Projecao ponderada por probabilidade e tempo de entrada |

---

## 7. Mudancas imediatas de linguagem na UI

A area atual deve trocar:
- `Pessoas` -> `Colaboradores`
- `Novo funcionario` -> `Novo colaborador`
- `Cadastrar funcionario` -> `Cadastrar colaborador`
- `Data de admissao` -> `Inicio da parceria`
- `Cargo` -> `Papel principal`
- `Perfil` -> `Tipo de atuacao`
- `Gestao de funcionarios por empresa, perfil e status operacional.` -> `Rede de colaboradores, municipios associados, implantacoes e comissoes.`

Recomendacao tecnica:
- manter a rota `/people` por compatibilidade
- trocar apenas a linguagem visivel no produto

---

## 8. Dominio alvo

O dominio alvo precisa de 5 blocos:
- bloco 1: colaboradores
- bloco 2: prefeituras/municipios
- bloco 3: oportunidades e implantacao
- bloco 4: financeiro e comissao
- bloco 5: dashboards e forecast

---

## 9. Entidades principais

Entidades recomendadas:
- `Collaborator`
- `MunicipalityAccount`
- `MunicipalityOpportunity`
- `MunicipalityStakeholder`
- `CollaboratorParticipation`
- `ServiceImplementation`
- `ServiceContract`
- `RevenueProjection`
- `ProfitSnapshot`
- `CommissionRule`
- `CommissionAccrual`
- `CommissionPayout`
- `ForecastSnapshot`

---

## 10. Diferenca entre conta municipal e oportunidade

`MunicipalityAccount`:
- representa a prefeitura em si
- guarda dados institucionais
- existe antes do fechamento

`MunicipalityOpportunity`:
- representa a chance comercial concreta
- guarda etapa, valor, probabilidade, prazo e dono interno

Sem essa separacao, o sistema mistura:
- cadastro institucional
- pipeline comercial
- contrato
- operacao

---

## 11. Tipos de colaborador

Campo recomendado: `collaboratorType`

Valores sugeridos:
- `internal_consultant`
- `external_partner`
- `municipal_articulator`
- `introducer`
- `strategic_advisor`
- `implementation_support`
- `executive_sponsor`
- `hybrid`

---

## 12. Papeis principais do colaborador

Campo recomendado: `primaryRole`

Exemplos:
- captacao
- articulacao
- relacionamento institucional
- negociacao
- implantacao
- suporte tecnico
- networking
- expansao regional

---

## 13. Status de parceria

Campo recomendado: `partnershipStatus`

Valores:
- `prospect`
- `active`
- `paused`
- `blocked`
- `inactive`

---

## 14. Dados relevantes do colaborador

Dados basicos:
- nome completo
- nome curto
- email
- telefone
- WhatsApp
- documento
- cidade
- estado
- empresa ou organizacao
- cargo/titulo

Dados estrategicos:
- regiao principal
- rede politica/institucional
- score de influencia
- score de confianca
- data de inicio da parceria
- ultimo contato

Dados comerciais:
- percentual padrao de comissao
- base padrao de comissao
- gatilho padrao
- ciclo de pagamento

---

## 15. Dados relevantes da prefeitura

Dados institucionais:
- nome do municipio
- UF
- codigo IBGE
- faixa populacional
- prefeito
- secretario de educacao
- secretario de financas
- responsavel juridico
- responsavel por compras/licitaoes

Dados comerciais:
- owner interno
- etapa atual
- probabilidade
- valor estimado
- lucro estimado
- data esperada de entrada
- data esperada de fidelizacao

Dados de risco:
- risco juridico
- risco de implantacao
- risco de dependencia de um contato
- score de cobertura de stakeholders

---

## 16. Relacao entre colaborador e prefeitura

Essa relacao precisa virar entidade propria:
- `CollaboratorParticipation`

Ela deve responder:
- qual colaborador atua na cidade?
- qual foi o papel dele?
- qual percentual foi combinado?
- qual o gatilho da comissao?
- ele foi a fonte primaria?
- ele e o relacionamento principal?

---

## 17. Campos da participacao

Campos recomendados:
- `collaboratorId`
- `municipalityAccountId`
- `opportunityId`
- `participationType`
- `influenceLevel`
- `sourcingWeight`
- `negotiationWeight`
- `implementationWeight`
- `agreedCommissionPercent`
- `agreedCommissionFlatValue`
- `commissionBaseType`
- `commissionTriggerType`
- `isPrimarySource`
- `isPrimaryRelationship`
- `approvedByUserId`
- `approvedAt`

---

## 18. Tipos de participacao

Valores sugeridos:
- `sourced_opportunity`
- `opened_doors`
- `institutional_introduction`
- `political_support`
- `technical_validation`
- `commercial_negotiation`
- `implementation_support`
- `account_maintenance`

---

## 19. Pipeline municipal recomendado

Etapas:
- `mapping`
- `first_contact`
- `institutional_validation`
- `technical_diagnosis`
- `proposal_presented`
- `negotiation`
- `verbally_approved`
- `contractual`
- `implementation`
- `assisted_operation`
- `fidelized`
- `paused`
- `lost`

---

## 20. Significado das etapas

`mapping`
- cidade mapeada, ainda sem contato util validado

`first_contact`
- houve abordagem inicial

`institutional_validation`
- existe abertura politica ou tecnica minima

`technical_diagnosis`
- dor, viabilidade e potencial foram entendidos

`proposal_presented`
- proposta entregue

`negotiation`
- cidade esta avaliando, ajustando ou pedindo adequacoes

`verbally_approved`
- aceite verbal, ainda sem seguranca juridica/plena

`contractual`
- formalizacao, documentos, juridico ou processo equivalente

`implementation`
- setup e entrada operacional

`assisted_operation`
- operacao ja roda, mas ainda esta em estabilizacao

`fidelized`
- cidade madura o suficiente para recorrencia e comissionamento pleno

---

## 21. Por que fidelizacao precisa existir

No seu caso, a cidade nao gera a mesma confianca economica em todos os momentos.

Assinou:
- ainda nao significa operacao estabilizada

Comecou implantacao:
- ainda nao significa resultado recorrente

Fidelizou:
- significa conta validada para leitura mais segura de lucro e comissao

Logo:
- ganho comercial
- go-live
- fidelizacao

Devem ser marcos diferentes.

---

## 22. Decisao de produto recomendada

O Sync deve assumir que seu caso e de:
- expansao municipal
- rede de colaboradores
- CRM de prefeituras
- pipeline de implantacao
- previsao financeira
- comissionamento auditavel

Nao de:
- RH simplificado de funcionarios

---

## 23. Arquivos do repo que este documento reposiciona

Arquivos locais diretamente impactados no futuro:
- `app/(workspace)/people/page.tsx`
- `components/forms/employee-form.tsx`
- `core/domain/organization.ts`
- `prisma/schema.prisma`
- `modules/dashboard/dashboard-page.tsx`
- `core/config/navigation.ts`

---

## 24. Resultado esperado

Com essa mudanca, o produto deixa de ser:
- cadastro de funcionarios

E passa a ser:
- plataforma de controle de colaboradores, municipios, lucro e projecao

