# COLABORADORES 03 - DASHBOARDS E UX

Data: 2026-03-06
Projeto: Sync
Objetivo: especificar a UX da area de colaboradores, do dashboard executivo e do dashboard individual

---

## 1. Diretriz geral de UX

A UX nao deve parecer:
- RH generico
- folha de cadastro
- lista sem contexto economico

Ela deve parecer:
- cockpit comercial
- painel de implantacao
- visao financeira por cidade
- centro de decisao executiva

---

## 2. Lista de colaboradores - objetivo

A tela hoje chamada de `Pessoas` deve virar a porta de entrada para:
- cadastro de colaboradores
- leitura da carteira de cidades
- leitura de desempenho individual
- controle de comissao

---

## 3. Header da tela de colaboradores

Titulo:
- `Colaboradores`

Descricao:
- `Rede de parceiros, articuladores e responsaveis por abrir, sustentar e expandir operacoes em prefeituras.`

CTA principal:
- `Novo colaborador`

CTA secundario:
- `Registrar prefeitura`

---

## 4. Busca e filtros da tela de colaboradores

Busca:
- nome do colaborador
- cidade
- UF
- prefeitura associada
- telefone
- email
- tag

Filtros:
- status da parceria
- tipo de colaborador
- estado
- faixa de resultado
- possui cidades fidelizadas?
- possui pagamento pendente?

---

## 5. Cards do topo da tela de colaboradores

Cards recomendados:
- total de colaboradores ativos
- colaboradores com cidades em pipeline
- colaboradores com cidades fidelizadas
- lucro total associado aos colaboradores
- comissao prevista total
- comissao paga total

---

## 6. Tabela principal de colaboradores

Colunas recomendadas:
- colaborador
- tipo
- UF principal
- cidades associadas
- cidades fidelizadas
- lucro gerado YTD
- comissao prevista YTD
- ultima atividade
- score
- status
- acoes

---

## 7. Acoes por colaborador

Acoes:
- abrir dashboard individual
- editar cadastro
- ver prefeituras
- registrar nova indicacao
- ajustar percentual padrao
- pausar parceria
- encerrar parceria

---

## 8. Estado vazio da tela de colaboradores

Titulo:
- `Nenhum colaborador encontrado`

Descricao:
- `Cadastre o primeiro colaborador para acompanhar indicacoes, municipios associados, implantacoes e comissoes.`

---

## 9. Formulario de colaborador - secoes

Secao 1:
- dados basicos

Secao 2:
- perfil da parceria

Secao 3:
- configuracao comercial padrao

Secao 4:
- contexto qualitativo

Secao 5:
- anexos

---

## 10. Campos do formulario - dados basicos

Campos:
- nome completo
- nome curto
- email
- telefone
- WhatsApp
- documento
- cidade
- estado
- empresa/organizacao
- cargo/titulo

---

## 11. Campos do formulario - perfil da parceria

Campos:
- tipo de colaborador
- papel principal
- status da parceria
- data de inicio da parceria
- origem do relacionamento
- indicado por
- regiao principal de atuacao

---

## 12. Campos do formulario - configuracao comercial

Campos:
- percentual padrao de comissao
- base padrao da comissao
- gatilho padrao
- ciclo de pagamento
- forma de pagamento

---

## 13. Dashboard executivo - objetivo

O dashboard principal precisa responder, em uma tela:
- quantas cidades trabalhamos no ano?
- quantas fidelizaram?
- quantas estao em implantacao?
- qual o lucro deste ano?
- qual a media de retorno por cidade?
- quanto do ano que vem ja esta desenhado?
- quais colaboradores puxam mais resultado?
- onde estao os gargalos?

---

## 14. Estrutura do dashboard executivo

Blocos:
- bloco A: KPIs do ano atual
- bloco B: curva mensal
- bloco C: funil municipal
- bloco D: ranking de colaboradores
- bloco E: forecast do ano seguinte
- bloco F: tabelas operacionais
- bloco G: painel de alertas e higiene

---

## 15. Cards obrigatorios do dashboard executivo

Linha 1:
- cidades trabalhadas no ano
- cidades fidelizadas no ano
- cidades em implantacao
- cidades em risco
- colaboradores ativos
- colaboradores com resultado

Linha 2:
- receita bruta YTD
- lucro base YTD
- margem media por cidade
- comissao prevista acumulada
- comissao reconhecida acumulada
- comissao paga acumulada

Linha 3:
- forecast de receita do proximo ano
- forecast de lucro do proximo ano
- cidades previstas no proximo ano
- ticket medio projetado
- margem media projetada
- forecast ponderado

---

## 16. Grafico de curva mensal

Visual:
- linhas mensais

Series:
- receita reconhecida
- lucro base
- comissao reconhecida

Comparacoes opcionais:
- realizado vs previsto
- ano atual vs ano anterior

---

## 17. Grafico de funil municipal

Etapas:
- mapeamento
- contato inicial
- validacao
- diagnostico
- proposta
- negociacao
- contratual
- implantacao
- fidelizado

Metricas por etapa:
- quantidade de cidades
- receita potencial
- lucro potencial ponderado

---

## 18. Grafico de ranking de colaboradores

Barras horizontais com ordenacao por:
- lucro gerado
- numero de cidades fidelizadas
- taxa de conversao
- comissao prevista

Filtros:
- ano
- estado
- tipo de servico

---

## 19. Visualizacao de forecast do ano seguinte

Visual recomendado:
- bridge chart ou waterfall

Componentes:
- base recorrente atual
- cidades que continuam
- cidades em implantacao que entram
- pipeline `commit`
- pipeline `best_case`
- risco de atraso/perda
- total projetado

---

## 20. Tabela de cidades do ano

Colunas:
- cidade
- UF
- etapa atual
- entrada no ano
- previsao de fidelizacao
- receita anual estimada
- lucro anual estimado
- probabilidade
- colaborador principal
- owner interno
- risco

---

## 21. Tabela de cidades em implantacao

Colunas:
- cidade
- kickoff
- milestone atual
- progresso
- data prevista de go-live
- data prevista de fidelizacao
- bloqueios
- owner

---

## 22. Tabela de forecast do proximo ano

Colunas:
- cidade
- categoria do forecast
- lucro anual cheio
- probabilidade
- fator temporal
- lucro ponderado
- mes esperado de entrada
- colaborador principal

---

## 23. Painel de higiene

Cards ou lista com alertas:
- cidade sem proximo passo
- cidade sem owner
- cidade sem stakeholder principal
- cidade com prazo vencido
- cidade parada ha muito tempo
- implantacao atrasada
- accrual pendente de revisao

---

## 24. Filtros globais do dashboard executivo

Filtros:
- ano
- UF
- regiao
- colaborador
- owner
- etapa
- status
- modulo/servico
- apenas cidades fidelizadas
- apenas cidades em implantacao

---

## 25. Dashboard individual do colaborador - objetivo

Cada colaborador precisa de uma pagina que responda:
- quantas cidades ele trouxe?
- quantas cidades fecharam?
- quantas fidelizaram?
- quanto de lucro ele gerou?
- quanto ja foi pago?
- quanto ainda esta previsto?
- quanto ele representa no forecast do ano seguinte?

---

## 26. Estrutura do dashboard individual

Blocos:
- resumo individual
- funil individual
- carteira por cidade
- tendencia mensal
- historico de comissoes
- alertas de carteira

---

## 27. Cards do dashboard individual

Cards:
- cidades associadas
- cidades trazidas
- cidades fidelizadas
- taxa de conversao
- lucro gerado YTD
- comissao prevista YTD
- comissao reconhecida YTD
- comissao paga YTD
- forecast do proximo ano
- tempo medio de conversao

---

## 28. Funil individual

Etapas do painel:
- cidades mapeadas
- cidades qualificadas
- cidades com proposta
- cidades em negociacao
- cidades em implantacao
- cidades fidelizadas

Metricas:
- quantidade
- lucro potencial
- taxa de passagem

---

## 29. Carteira por cidade

Cada linha ou card deve mostrar:
- cidade
- etapa
- valor estimado
- lucro estimado
- probabilidade
- percentual combinado
- comissao prevista
- owner interno
- ultimo contato
- proximo passo

---

## 30. Tendencia mensal do colaborador

Series:
- lucro base associado por mes
- comissao prevista por mes
- comissao paga por mes

Objetivo:
- mostrar sazonalidade e evolucao de resultado

---

## 31. Historico de comissoes

Tabela:
- periodo
- cidade
- lucro base
- percentual aplicado
- valor reconhecido
- status
- pagamento vinculado

---

## 32. Alertas individuais

Alertas:
- cidade da carteira sem atividade recente
- cidade sem proximo passo
- cidade em negociacao estagnada
- cidade elegivel para fidelizacao
- pagamento aguardando aprovacao

---

## 33. Pagina da prefeitura - abas recomendadas

Abas:
- resumo
- contatos
- oportunidade
- implantacao
- financeiro
- colaboradores
- timeline
- documentos

---

## 34. Aba resumo da prefeitura

Conteudo:
- status da conta
- etapa atual
- owner interno
- colaborador principal
- data do ultimo contato
- proximo passo
- probabilidade
- valor estimado
- valor ponderado

---

## 35. Aba contatos

Campos por stakeholder:
- nome
- orgao/secretaria
- cargo
- email
- telefone
- WhatsApp
- score de influencia
- score de favorabilidade
- contato principal?
- ultimo contato

---

## 36. Aba oportunidade

Campos:
- etapa
- probabilidade
- proposta
- prazo
- modelo de contratacao
- concorrentes
- objecoes
- proxima acao

---

## 37. Aba implantacao

Campos:
- kickoff
- milestone atual
- progresso
- bloqueios
- go-live previsto
- go-live real
- elegibilidade de fidelizacao
- status de fidelizacao

---

## 38. Aba financeiro

Campos:
- receita mensal prevista
- receita anual prevista
- custo de implantacao
- custo mensal
- lucro base previsto
- snapshots realizados
- margens

---

## 39. Aba colaboradores

Campos:
- colaborador
- tipo de participacao
- percentual
- gatilho
- status
- comissao prevista
- comissao reconhecida
- comissao paga

---

## 40. Aba timeline

Eventos visiveis:
- cidade cadastrada
- contato criado
- reuniao registrada
- proposta enviada
- etapa alterada
- contrato iniciado
- implantacao iniciada
- go-live
- fidelizacao aprovada
- accrual gerada
- payout pago

---

## 41. Layout mobile

No mobile:
- cards empilhados
- filtros em drawer
- tabelas viram cards
- funil vira carrossel ou grafico simplificado
- acoes principais fixas no rodape da tela

---

## 42. Estados vazios recomendados

Para dashboard executivo sem dados:
- `Cadastre municipios e vincule colaboradores para iniciar o painel executivo.`

Para dashboard individual sem cidades:
- `Este colaborador ainda nao possui municipios vinculados.`

Para aba financeiro sem snapshots:
- `Sem lancamentos financeiros ainda para esta cidade.`

---

## 43. Recomendacao final de UX

Nao tratar a tela como tabela fria.

Tratar como sistema de decisao.

Cada tela deve mostrar:
- contexto
- resultado
- risco
- proximo passo

