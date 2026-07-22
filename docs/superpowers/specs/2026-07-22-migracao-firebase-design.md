# Migração Supabase/Prisma → Firebase — Sync

Data: 2026-07-22
Status: aprovado
Projeto Firebase: `globalconsultorias`

## Contexto

O projeto Supabase referenciado em `cloudrun.env.yaml` responde
`FATAL: (ENOTFOUND) tenant/user postgres.pbjlpcqdrbypufleoxnm not found` — o
tenant não existe mais. Os dados existentes são descartáveis, o que remove ETL,
janela de corte e risco de perda de histórico da equação. A migração é, na
prática, um desenho de esquema novo.

O que se ganha, e por que compensa a reescrita:

- **Offline e tempo real no campo.** O consultor usa o app em reunião com gestor
  municipal, onde a conexão é ruim. O Flutter falando direto com o Firestore
  funciona sem sinal e sincroniza depois.
- **Autenticação de verdade.** Hoje o login é artesanal: token de 32 bytes numa
  tabela `Session` e credenciais de desenvolvimento em texto puro no fonte
  (`core/lib/session-auth.ts`). Firebase Auth resolve isso e some com o problema.
- **Security Rules no lugar de 44 checagens manuais.** A autorização passa a ser
  declarativa e centralizada, em vez de um `getSessionUser()` repetido em cada
  rota.

O custo honesto: o Firestore não tem join, decimal, constraint única nem cascata.
As três primeiras seções do desenho existem para compensar cada uma dessas
ausências.

## Decisões

| Decisão | Escolha |
|---|---|
| Alcance | Firebase Auth **e** Firestore; Prisma e Postgres saem |
| Acesso a dados | Flutter fala direto com o Firestore |
| Papel do Next | Documentos e integrações externas apenas |
| Dados existentes | Descartáveis — sem migração |

## Arquitetura destino

```
Flutter  ──────────────────────────►  Firestore        (leitura direta, tempo real, offline)
   │                                      ▲
   │  callable                            │  Admin SDK (ignora as rules)
   ▼                                      │
Cloud Functions ──────────────────────────┘            (toda escrita financeira)
   
Flutter  ──── Firebase ID token ────►  Next / Cloud Run
                                          └─► PDF (Python/ReportLab), DOCX, slides
                                          └─► IBGE, FNDE, INEP, QEdu, SICONFI, TSE, SIMEC
                                          └─► agent de contrato (chaves de LLM)
```

**16 rotas** do Next tocam o Prisma e são CRUD puro: desaparecem, substituídas
por acesso direto do Flutter. **3 rotas** de autenticação desaparecem no Firebase
Auth. **25 rotas sobrevivem** — as que geram documento, falam com fonte pública
ou guardam segredo, coisas que não pertencem ao cliente.

A autenticação dessas 25 passa a ser: o Flutter envia o ID token no header, o
Next verifica com `admin.auth().verifyIdToken()`.

### Atenção cross-project

O Cloud Run vive no projeto GCP `opus-sec`; o Firebase é `globalconsultorias`.
São projetos distintos, então o Admin SDK no Cloud Run precisa de uma service
account de `globalconsultorias` com papel `roles/datastore.user`, entregue como
credencial. Alternativa que elimina o passo: mover o serviço Cloud Run para
`globalconsultorias`.

## Modelagem Firestore

```
users/{uid}                              espelha o Firebase Auth
groups/{groupId}
companies/{companyId}                    campo groupId
employees/{userId}_{companyId}           ← ID determinístico = @@unique
collaborators/{collaboratorId}
municipalityAccounts/{accountId}
    ├── participations/{collaboratorId}  ← ID determinístico: um vínculo por colaborador
    ├── profitSnapshots/{yyyy-MM}        ← ID determinístico = @@unique(account, year, month)
    ├── opportunities/{opportunityId}
    └── serviceImplementations/{implId}
commissionRules/{ruleId}
commissionAccruals/{collaboratorId}_{accountId}_{yyyy-MM}
commissionPayouts/{payoutId}
forecastSnapshots/{yyyy-MM}
fundebConsultingProjects/{projectId}
caseSucessoFundeb/{caseId}
collaboratorDocuments/{docId}            binário em Cloud Storage
auditLogs/{logId}
```

`sessions` não existe: token, refresh e revogação são do Firebase Auth.

### Três regras que valem para todo o modelo

**1. Dinheiro nunca é `double`.** O Firestore só tem IEEE-754. Todo campo
`Decimal(14,2)` vira inteiro em centavos, com o sufixo no nome:

| Prisma | Firestore |
|---|---|
| `accruedAmount Decimal(14,2)` | `accruedAmountCents: int` |
| `profitBase Decimal(14,2)` | `profitBaseCents: int` |
| `appliedPercent Decimal(8,4)` | `appliedPercentBps: int` (basis points) |

O sufixo é proposital: torna visível, na leitura do código, qualquer soma de
unidades diferentes.

**2. Onde havia `@@unique`, a chave vira o ID do documento.** É assim que se
recupera unicidade sem constraint. Gravar duas vezes a mesma competência
sobrescreve em vez de duplicar — e isso é a base da idempotência da seção
seguinte.

**3. Exclusão é `deletedAt`, não `delete`.** São 31 relações com
`onDelete: Cascade` e o Firestore não cascateia. Soft delete evita órfãos e é o
comportamento correto para dado financeiro: provisão paga não deve sumir do
histórico. As queries filtram `where('deletedAt', '==', null)`.

### Enums

Os 10 enums (`CollaboratorType`, `MunicipalityStage`, `CommissionBaseType`,
`CommissionTriggerType`, `ParticipationType`, `PartnershipStatus`,
`OpportunityForecastCategory`, `FidelityStatus`, `AccrualStatus`,
`PayoutStatus`) viram strings. O valor válido é garantido em dois lugares: nas
Security Rules (`request.resource.data.currentStage in [...]`) e em enums Dart
no cliente. Sem os dois, string livre vira lixo em produção.

## Blindagem do cálculo de comissão

Esta seção existe porque pôr contabilidade em banco de documento é a parte
arriscada da migração. Quatro decisões, não boa intenção:

### O cliente não escreve dinheiro

As Security Rules negam `write` em `commissionAccruals`, `commissionPayouts` e
`profitSnapshots` para todo usuário autenticado, sem exceção. Só Cloud Functions
escrevem, via Admin SDK, que ignora rules. O Flutter lê em tempo real e envia
intenções por callable. O cálculo sai do dispositivo.

### ID determinístico dá idempotência

```
commissionAccruals/{collaboratorId}_{accountId}_{yyyy-MM}
```

Recomputar uma competência é um `set()` no mesmo documento. Rodar o fechamento
duas vezes — por retry, timeout ou clique repetido — produz exatamente o mesmo
resultado. Provisão duplicada é a falha mais cara desse domínio, e aqui ela
deixa de ser possível por construção.

### Aritmética inteira, arredondamento em um lugar só

```ts
// única função no sistema autorizada a arredondar dinheiro
function accrue(profitBaseCents: number, appliedPercentBps: number): number {
  return Math.round((profitBaseCents * appliedPercentBps) / 1_000_000);
}
```

`Decimal(8,4)` comporta 4 casas decimais, então `appliedPercentBps` guarda o
percentual multiplicado por 10.000; o divisor `1_000_000` converte de volta
(10.000 do bps × 100 do percentual).

### Totais são derivados, nunca digitados

`totalAccruedCents`, `totalApprovedCents` e `totalPaidCents` do
`CommissionPayout` são recalculados por Cloud Function dentro de
`runTransaction()` sempre que um accrual muda de status. Nenhum caminho de
escrita aceita esses campos vindos do cliente.

### Conferência agendada

Uma Function diária recomputa o mês corrente em memória e compara com o gravado,
alertando divergência. É barata e ataca diretamente o risco que motivou toda
esta seção: número errado silencioso. Entra na fase 3, não depois.

## Security Rules — forma

```js
function auth()      { return request.auth != null; }
function me()        { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
function sameGroup(r){ return auth() && r.groupId == me().groupId; }
function isAdmin()   { return auth() && me().groupRole in ['owner','admin']; }

match /collaborators/{id} {
  allow read:   if sameGroup(resource.data);
  allow write:  if isAdmin() && sameGroup(request.resource.data);
}

// Financeiro: leitura para o grupo, escrita para ninguém.
// As Cloud Functions usam Admin SDK e não passam por aqui.
match /commissionAccruals/{id} {
  allow read:  if sameGroup(resource.data);
  allow write: if false;
}
match /commissionPayouts/{id} { allow read: if sameGroup(resource.data); allow write: if false; }
match /municipalityAccounts/{a}/profitSnapshots/{m} {
  allow read:  if auth();
  allow write: if false;
}
```

O `get()` dentro da regra custa uma leitura por avaliação. Se pesar, o
`groupId` e o `groupRole` vão para **custom claims** do token, e a regra passa a
lê-los de `request.auth.token` sem custo.

## Cloud Functions

| Função | Gatilho | Responsabilidade |
|---|---|---|
| `onUserCreate` | Auth `onCreate` | Cria `users/{uid}`, atribui `groupId` e claims |
| `fecharCompetencia` | Callable | Recomputa accruals do mês a partir de `profitSnapshots` + `commissionRules`; idempotente |
| `onAccrualWrite` | Firestore `onWrite` | Recalcula os totais do payout em transação |
| `cascataSoftDelete` | Firestore `onUpdate` | Ao marcar `deletedAt`, propaga aos dependentes em batch |
| `conferirCompetencia` | Agendada, diária | Recomputa em memória e alerta divergência |

## Fases

| Fase | Escopo | Reversível |
|---|---|---|
| **1** | Firebase Auth substitui NextAuth e o login artesanal; `flutterfire configure` | sim |
| **2** | Coleções, índices compostos e Security Rules | sim |
| **3** | Cloud Functions financeiras e conferência agendada | sim |
| **4** | Flutter lê o Firestore direto; aposentar as 16 rotas CRUD | sim |
| **5** | Remover Prisma, Postgres, `core/lib/*-data-access.ts` | **não** |

Cada fase recebe seu próprio plano de implementação; esta spec não é executável
de uma vez. O primeiro plano cobre apenas a fase 1.

A ordem é deliberada. A fase 1 entrega o maior ganho com o menor risco e não
depende do Firestore. As rules vêm antes dos dados, porque escrever regra depois
é pôr fechadura depois do arrombamento. O motor financeiro fica pronto antes de
o Flutter tocar nesses dados. E a queima de ponte é a última, só depois da fase 4
estável em produção.

## O que sai do repositório

Ao fim da fase 5: `prisma/`, `@prisma/client`, `prisma`, `next-auth`,
`core/lib/auth.ts`, `core/lib/session-auth.ts`, `core/lib/user-provisioning.ts`,
`core/lib/data-access.ts`, `core/lib/collaboration-data-access.ts`,
`core/lib/fundeb-consulting-data-access.ts`, `core/providers/app-providers.tsx`
e as 19 rotas de CRUD e autenticação — cerca de 2.000 linhas.

Entram: `firebase-admin` no Next, `firebase_core`/`cloud_firestore`/
`firebase_auth` no Flutter, e um diretório `functions/`.

`.gitignore` ganha `.firebase/`, `functions/node_modules/` e
`firebase-debug.log`. A config web vai para `NEXT_PUBLIC_FIREBASE_*` no `.env` —
a `apiKey` do Firebase é identificador público, não segredo, mas mantê-la em
variável permite trocar de projeto sem editar código.

## Riscos aceitos

- **Sem join.** Telas que hoje fazem `include` aninhado (14 ocorrências em
  `collaboration-data-access.ts`) passam a fazer leituras adicionais ou a
  depender de campos denormalizados. Denormalização escolhida caso a caso na
  fase 2, nunca por reflexo.
- **Custo por leitura.** O modelo de cobrança do Firestore pune tela que lê
  coleção inteira. As telas de pipeline precisam de paginação real, não
  `getAll()`.
- **Índices compostos são explícitos.** Toda query com filtro e ordenação exige
  índice declarado em `firestore.indexes.json`; esquecer só aparece em runtime.

## Fora de escopo

- Quebrar os arquivos gigantes do Flutter (`fundeb_levantamento_pdf_builder.dart`
  com 5.018 linhas). Rodada própria.
- Testes automatizados dos cálculos FUNDEB. Continuam inexistentes, e seguem
  sendo a lacuna mais séria do projeto — a conferência agendada da fase 3 cobre
  apenas a comissão, não o cálculo de VAAF/VAAT/VAAR.
- Ferramenta de grafo de código (`code-review-graph`). Avaliada e adiada para
  depois da migração, porque grafo criado durante reescrita nasce obsoleto.
