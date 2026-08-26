# Roadmap Multiusuario: Colaboracao dentro da empresa no Sync

Este documento mapeia as melhorias necessarias para o Sync operar como app multiusuario de verdade: varias pessoas da mesma empresa trocando informacoes, criando servicos, preenchendo e anexando documentos. Baseado em levantamento do codigo em 2026-08-23.

---

## O que ja existe (base solida)

- **Isolamento por grupo (`groupId`)**: toda colecao carrega `groupId` e as `firestore.rules` isolam por grupo. O "tenant" ja existe, via custom claims do Firebase Auth.
- **RBAC de 4 papeis + permissoes por area** (`core/domain/rbac.ts`): `owner | admin | member | viewer` com niveis `nenhum | ver | editar` sobre 9 areas do menu.
- **Provisionamento admin-driven** (`core/lib/acessos.ts` + `app/api/acessos/route.ts`): admin cria conta sem senha, grava claims, envia link de definicao manualmente.
- **Autoria pervasiva**: documentos, relatorios, posts, eventos e comentarios carregam quem criou; edicao restrita a autor/admin nas rules.
- **Mural da equipe** (`core/domain/mural.ts`): quadro de assuntos com recado/pergunta/arquivo, respostas encadeadas e "pergunta em aberto".
- **Comentarios com autoria travada** em `cities/{id}/eventos/{id}/comentarios` — padrao replicavel para outras entidades.
- **Soft delete e imutabilidade seletivos**: contratos nunca apagam (cancelam), eventos nunca apagam, `cityReports` imutavel com snapshot.
- **Fila de emissao compartilhada** (`modules/cidades/fila-emissao-firestore.ts`): unico exemplo de coordenacao multiusuario implicita.
- **Colecao `audit` com rules e testes prontos** — hoje subutilizada (so o console de sistemas escreve).

---

## Lacunas mapeadas

### Seguranca e confianca
1. Permissoes finas por area (`perm`) **nao sao enforceadas nas Firestore rules** — as rules so conhecem o binario owner/admin vs. resto. Qualquer `member` escreve em quase tudo via SDK direto.
2. Delete de `cityDocuments` e **livre para qualquer membro do grupo** (`firestore.rules:240`), e metadado e imutavel (`update: if false`) — nem corrigir um titulo e possivel.
3. Concessao/edicao de acessos em `/api/acessos` **nao grava evento em `audit`**.
4. Fallback `DEFAULT_GROUP_ID = "default"` em `app/(sync)/pessoas/page.tsx:23` pode misturar dados entre grupos.
5. Testes de rules `companies`/`employees` em `firestore-rules-test/` estao mortos (rules removidas em 2026-08-13).

### Colaboracao e comunicacao
6. **Sem notificacoes**: nenhuma colecao, email, push ou inbox. Ninguem e avisado de pergunta no mural, comentario, documento vencendo (`expiresAt` ja existe no modelo) ou job concluido.
7. **Zero tempo real**: nenhum `onSnapshot` no codebase; tudo e `getDocs` + React Query com refetch manual. Dados de outro usuario so aparecem apos "Atualizar".
8. **Sem presenca** (quem esta online) nem indicador de "quem esta editando".
9. A aba Auditoria da caixa (`app/(sync)/caixa/page.tsx`) e **derivada no cliente**, nao um log persistido.
10. Busca global so cobre cidades + rotas — nao busca pessoas, posts, documentos.

### Servicos e documentos
11. **Nao existe entidade "servico" ou "tarefa"** — nada para criar, atribuir a alguem e acompanhar. O mais proximo sao as etapas do cronograma (`responsavelId`), que qualquer um edita.
12. **Documentos sem status, sem dono operacional e sem versionamento** — `createdBy` e informativo; nao ha rascunho/finalizado, responsavel por preencher, nem fluxo de revisao/aprovacao.
13. **Sem comentarios em documentos, contratos e relatorios** — o padrao ja existe (eventos/mural), so nao foi replicado.
14. **Contratos mudam de estado sem historico** — so o estado atual e gravado; sem trilha de quem/quando.
15. **Preenchimento de documentos nao e colaborativo** — templates DOCX sao preenchidos de uma vez por agente/API; nao ha formulario para uma pessoa preencher e outra revisar.

---

## Plano em fases

### Fase 1 — Fundacao de seguranca (rapido, alto impacto)
Corrige os riscos que multiusuario real expoe, sem features novas.

- [x] **Enforcar permissoes finas nas Firestore rules** ou decisao consciente de aceitar o binario atual. Caminho: expandir helper nas rules para ler `perm` da claim (cuidado: claims sao limitadas a 1000 bytes — `core/lib/acessos.ts:103`).
- [x] **Restringir delete de `cityDocuments`** para autor ou admin; permitir `update` de metadados (titulo, descricao, validade) com autoria registrada.
- [x] **Gravar em `audit`** as acoes de `/api/acessos` (concessao, edicao, desativacao) via Admin SDK, seguindo o padrao de `core/lib/sistemas-registro.ts`.
- [x] **Remover o fallback `DEFAULT_GROUP_ID`** de `pessoas/page.tsx:23` — sessao sem claim deve falhar fechado.
- [x] **Apagar os testes mortos** `companies.rules.test.mjs` e `employees.rules.test.mjs`.

### Fase 2 — Notificacoes (pre-requisito de toda colaboracao)
Sem isso, atribuir trabalho a alguem e inutil — a pessoa nunca fica sabendo.

- [ ] **Colecao `notifications` por usuario** (`{groupId, destinatarioUid, tipo, titulo, link, lida, criadoEm}`) + rules (le so as proprias, marca como lida).
- [ ] **Inbox no `SyncHeader`** (sino com badge) — o header hoje so existe no `/painel`; avaliar leva-lo ao shell inteiro (`app/(sync)/layout.tsx`).
- [ ] **Gatilhos iniciais**: pergunta nova no mural, comentario em evento seu, documento com `expiresAt` proximo, job de emissao concluido, etapa do cronograma atribuida. Via Cloud Functions (triggers Firestore) ou escrita pelo BFF.

### Fase 3 — Servicos / Tarefas
A entidade que falta para "criar servicos e distribuir trabalho".

- [ ] **Nova colecao `tasks`**: titulo, descricao, `responsavelUid/Nome`, `criadoPor`, status (`pendente | em_andamento | concluida | cancelada`), prazo, vinculo opcional com cidade/documento/contrato.
- [ ] **Comentarios na tarefa** replicando o padrao de `eventos/comentarios` (autoria travada nas rules).
- [ ] **Tela de tarefas** (lista/kanban) com filtro "minhas tarefas"; entrada na Caixa ou rota propria.
- [ ] **Historico de transicoes** gravado (quem mudou, quando) — resolver junto o problema analogo dos contratos (item 14).
- [ ] Notificacao ao ser atribuido (depende da Fase 2).

### Fase 4 — Documentos colaborativos
- [ ] **Status e responsavel em `cityDocuments`/`empresaDocumentos`**: rascunho/em_revisao/final + `responsavelUid`. Exige liberar `update` nas rules (hoje `update: if false`) com whitelist de campos.
- [ ] **Versionamento**: nova versao como novo doc vinculado (`versaoDe`), em vez de delete + reupload.
- [ ] **Comentarios em documentos** (mesmo padrao de comentarios).
- [ ] **Preenchimento por formulario**: hoje so agente/API preenche templates DOCX (contrato-fundeb). Criar fluxo em que uma pessoa preenche, outra revisa, e o DOCX/PDF sai no final — candidato natural a virar uma `task` da Fase 3.

### Fase 5 — Tempo real e presenca
- [ ] **`onSnapshot` nas colecoes colaborativas** (`mural`, `eventos`, `comentarios`, `notifications`, `tasks`): o padrao React Query + `invalidateQueries` e o ponto de troca natural.
- [ ] **Presenca simples** (quem esta online) pendurada num provider no `app/(sync)/layout.tsx`, seguindo o precedente do `FilaEmissaoProvider`.
- [ ] **Busca global ampliada**: pessoas, documentos, posts do mural (hoje so cidades + rotas, em `core/components/sync-shell/header.tsx`).
- [ ] **Auditoria como feed persistido**: a aba Auditoria passa a ler a colecao `audit` em vez de derivar no cliente (depende da Fase 1).

---

## Decisoes a tomar antes de tirar do papel

1. **Escopo do RBAC nas rules**: enforcear permissoes finas por area nas Firestore rules (mais seguro, mais complexo) ou manter o binario owner/admin e aceitar o risco (membros sao de confianca)?
2. **Nome e formato da entidade de trabalho**: "tarefa" generica ou "servico" com campos de negocio (tipo de servico, valor, cidade)? Isso define o schema da Fase 3.
3. **Mural vs. chat**: o mural foi desenhado deliberadamente para nao ser chat (comentario em `core/domain/mural.ts`). Manter essa filosofia ou adicionar mensagens diretas entre usuarios?
4. **Multi-grupo por usuario**: hoje um usuario pertence a um unico `groupId` (claim). Se a Global vai operar varias empresas/contas, isso vira bloqueio — mas para "varios usuarios da mesma empresa" o modelo atual ja serve.
5. **Convite por e-mail**: hoje o admin copia o link manualmente. Automatizar envio (e-mail transacional) quando o numero de usuarios crescer?

## Ordem sugerida de execucao

1. Fase 1 inteira (dias, nao semanas) — fecha riscos.
2. Fase 2 (notificacoes) — desbloqueia tudo.
3. Fase 3 (servicos/tarefas) — a feature central do pedido.
4. Fases 4 e 5 conforme uso real.
