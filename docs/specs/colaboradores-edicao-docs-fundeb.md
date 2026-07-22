# Colaboradores — Edição, Documentos e Integração FUNDEB

> **Objetivo:** Tornar a aba "Colaboradores" uma central completa de gestão de parceiros,
> com edição em tempo real, repositório documental integrado aos contratos FUNDEB,
> e visibilidade de performance e comissões.

---

## 1. Estado Atual vs. Estado Desejado

### Estado Atual
- Lista de colaboradores com KPIs (ativos, cidades, lucro, comissão)
- Cards com nome, papel, tipo, UF, status e métricas básicas
- Sem edição inline
- Sem gestão de documentos
- Sem vínculo visual com contratos FUNDEB
- Sem perfil detalhado

### Estado Desejado
- **Edição completa** dos dados do colaborador (inline ou modal)
- **Repositório documental** por colaborador (certidões, contratos, comprovantes)
- **Vínculo direto** com Kit Documental FUNDEB (documentos habilitatórios)
- **Perfil expandido** com tabs (Dados, Documentos, Cidades, Comissões, Histórico)
- **Ações rápidas**: gerar kit, baixar documentos, marcar como vencido

---

## 2. Tela de Detalhe do Colaborador

Ao clicar em um colaborador na lista, abre uma tela com **5 tabs**:

### Tab 1: Dados Pessoais e Profissionais (Editar + Salvar)

```
┌─────────────────────────────────────────────────────────────────┐
│  👤 João da Silva          [Ativo]              [✎ Editar]      │
│     Articulador FUNDEB — Belém/PA                               │
├─────────────────────────────────────────────────────────────────┤
│  DADOS PESSOAIS                                                 │
│  ├─ Nome completo:     [João da Silva Neto    ] ← editável      │
│  ├─ Nome curto:        [João Silva            ]                 │
│  ├─ Email:             [joao@email.com        ]                 │
│  ├─ Telefone:          [(91) 99999-0000       ]                 │
│  ├─ WhatsApp:          [(91) 99999-0000       ]                 │
│  ├─ CPF/Documento:     [000.000.000-00        ]                 │
│  ├─ Cidade/UF:         [Belém / PA            ]                 │
│  └─ Empresa/Org:       [Consultoria XYZ       ]                 │
│                                                                 │
│  DADOS PROFISSIONAIS                                            │
│  ├─ Tipo:              [Articulador Municipal  ▼]               │
│  ├─ Papel principal:   [Consultor FUNDEB       ]                │
│  ├─ Status:            [Ativo  ▼]                               │
│  ├─ Nível de confiança:[⭐⭐⭐⭐☆ (4/5)         ]               │
│  ├─ Score de influência:[8/10                  ]                │
│  ├─ Estado primário:   [PA                     ]                │
│  └─ Região primária:   [Norte                  ]                │
│                                                                 │
│  COMISSÃO PADRÃO                                                │
│  ├─ Percentual:        [5.00%                  ]                │
│  ├─ Base de cálculo:   [Lucro Líquido    ▼]                     │
│  ├─ Trigger:           [Após fidelização ▼]                     │
│  ├─ Ciclo de pagamento:[Mensal                 ]                │
│  └─ Método de pag.:    [PIX                    ]                │
│                                                                 │
│  OBSERVAÇÕES                                                    │
│  ├─ Notas:             [Textarea...            ]                │
│  └─ Notas confidenciais: [Textarea...          ]                │
│                                                                 │
│                                    [Cancelar]  [💾 Salvar]      │
└─────────────────────────────────────────────────────────────────┘
```

**Campos editáveis** (já existem no Prisma `Collaborator`):
- `fullName`, `shortName`, `email`, `phone`, `whatsapp`
- `cpfOrDocument`, `city`, `state`, `companyOrOrganization`
- `collaboratorType`, `primaryRole`, `partnershipStatus`
- `trustLevel`, `averageInfluenceScore`
- `defaultCommissionPercent`, `defaultProfitBaseType`, `defaultTriggerType`
- `payoutCycle`, `payoutMethod`
- `notes`, `confidentialNotes`

### Tab 2: Documentos

```
┌─────────────────────────────────────────────────────────────────┐
│  📄 Documentos do Colaborador              [⬆ Anexar documento]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DOCUMENTOS HABILITATÓRIOS (Vinculados ao Kit FUNDEB)           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✅ Certidão Negativa Federal     2026-01-15   [⬇ Baixar]  ││
│  │ ✅ Certidão Negativa Estadual    2026-01-15   [⬇ Baixar]  ││
│  │ ⚠️  FGTS                        2025-12-01   [⬇] VENCIDO ││
│  │ ❌ Balanço Patrimonial           —            [⬆ Anexar]  ││
│  │ ✅ Contrato Social               2026-01-20   [⬇ Baixar]  ││
│  │ ❌ Atestado de Capacidade Técn.  —            [⬆ Anexar]  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  DOCUMENTOS GERAIS                                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 📎 RG / CNH                     2026-01-10   [⬇ Baixar]  ││
│  │ 📎 Comprovante de endereço      2026-02-05   [⬇ Baixar]  ││
│  │ 📎 Contrato de parceria         2026-03-01   [⬇ Baixar]  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Resumo: 5 de 8 documentos habilitatórios OK                   │
│          1 vencido | 2 pendentes                                │
└─────────────────────────────────────────────────────────────────┘
```

**Categorias de documentos:**

| Categoria              | Documentos                                          | Vínculo FUNDEB |
|------------------------|-----------------------------------------------------|----------------|
| `habilitacao_fiscal`   | CND Federal, CND Estadual, CND Municipal, FGTS      | ✅ Kit         |
| `habilitacao_juridica` | Contrato Social, Procuração, Alvará                  | ✅ Kit         |
| `habilitacao_tecnica`  | Atestados de Capacidade, Balanço, DRE                | ✅ Kit         |
| `pessoal`              | RG, CPF, CNH, Comprovante de endereço                | ❌             |
| `contratual`           | Contrato de parceria, aditivos, distratos            | ❌             |
| `financeiro`           | Comprovantes de pagamento, recibos                   | ❌             |

**Regras de vencimento:**
- Certidões: válidas por 180 dias (configurável)
- Balanço patrimonial: último exercício fiscal
- Alerta visual quando < 30 dias para vencer
- Status: ✅ Válido | ⚠️ Vencendo | ❌ Vencido | 📎 Sem validade

### Tab 3: Cidades Vinculadas

```
┌─────────────────────────────────────────────────────────────────┐
│  🏙️ Cidades do Colaborador (3)                                 │
├─────────────────────────────────────────────────────────────────┤
│  Arapiraca/AL     [Diagnóstico ●]   R$ 15.000/mês   70%       │
│  Palmeira/PR      [Proposta ●]      R$ 8.000/mês    50%       │
│  Mirandópolis/SP  [Contratual ●]    R$ 12.000/mês   90%       │
├─────────────────────────────────────────────────────────────────┤
│  Receita projetada total: R$ 420.000/ano                       │
│  Comissão projetada (5%): R$ 21.000/ano                        │
└─────────────────────────────────────────────────────────────────┘
```

- Lista de `MunicipalityAccount` onde o colaborador participa
- Cada cidade mostra: estágio, valor projetado, probabilidade
- Clicar navega para o Plano de Ação da cidade
- Totalizadores de receita e comissão

### Tab 4: Comissões

```
┌─────────────────────────────────────────────────────────────────┐
│  💰 Comissões                                                   │
├─────────────────────────────────────────────────────────────────┤
│  REGRAS ATIVAS                                                  │
│  ├─ Arapiraca/AL:    5% sobre lucro líquido, após fidelização  │
│  ├─ Palmeira/PR:     3% sobre receita bruta, após go-live      │
│  └─ Mirandópolis/SP: R$ 500/mês fixo + 2% lucro               │
│                                                                 │
│  ACCRUALS (Acumulados)                                          │
│  ├─ Jun/2026: R$ 1.200,00  [Calculado]                         │
│  ├─ Mai/2026: R$ 1.150,00  [Aprovado]                          │
│  ├─ Abr/2026: R$ 1.100,00  [Pago ✅]                           │
│  └─ Mar/2026: R$ 1.050,00  [Pago ✅]                           │
│                                                                 │
│  TOTAL ACUMULADO (YTD): R$ 4.500,00                            │
│  TOTAL PAGO (YTD):      R$ 2.150,00                            │
│  A PAGAR:               R$ 2.350,00                            │
└─────────────────────────────────────────────────────────────────┘
```

- Visualização das `CommissionRule` vinculadas
- Listagem dos `CommissionAccrual` por mês
- Totalizadores de pago vs. a pagar
- Botão "Gerar Pagamento" para criar `CommissionPayout`

### Tab 5: Histórico

- Timeline cronológica de todas as ações do colaborador
- Baseada nos `AuditLog` filtrados por collaboratorId
- Tipos: cadastro, edição, cidade vinculada, documento anexado, comissão paga

---

## 3. Vínculo com Kit Documental FUNDEB

### Fluxo Documentos → Kit

```
Colaborador                    Kit Documental FUNDEB
├─ Certidão Federal  ──────→   Anexo: Habilitação Fiscal
├─ Certidão Estadual ──────→   Anexo: Habilitação Fiscal
├─ FGTS              ──────→   Anexo: Habilitação Fiscal
├─ Balanço           ──────→   Anexo: Habilitação Técnica
├─ Contrato Social   ──────→   Anexo: Habilitação Jurídica
└─ Atestados         ──────→   Anexo: Habilitação Técnica
```

**Quando gerar o Kit Documental de uma cidade:**
1. O sistema verifica automaticamente quais documentos do colaborador estão válidos
2. Se há documentos vencidos/pendentes, exibe alerta antes de gerar
3. Os documentos válidos são automaticamente incluídos como anexos
4. O kit é montado chamando `gerarKitContratosFundebComAnexos(data, anexos)`

---

## 4. Modelo de Dados — Novos campos

### 4.1 — `CollaboratorDocument` (novo modelo Prisma)

```prisma
model CollaboratorDocument {
  id               String        @id @default(cuid())
  collaboratorId   String
  collaborator     Collaborator  @relation(fields: [collaboratorId], references: [id], onDelete: Cascade)
  category         String        // habilitacao_fiscal | habilitacao_juridica | habilitacao_tecnica | pessoal | contratual | financeiro
  documentType     String        // cnd_federal | cnd_estadual | fgts | contrato_social | balanco | atestado | etc
  name             String        // Nome exibido: "Certidão Negativa Federal"
  fileName         String        // Nome do arquivo original
  fileUrl          String        // URL do storage
  fileSize         Int?          // bytes
  mimeType         String?       // application/pdf, image/jpeg, etc
  issuedAt         DateTime?     // Data de emissão
  expiresAt        DateTime?     // Data de validade (null = sem validade)
  notes            String?
  uploadedByUserId String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  @@index([collaboratorId, category])
  @@index([collaboratorId, documentType])
}
```

### 4.2 — Relação no `Collaborator`

```prisma
// Adicionar ao model Collaborator existente:
  documents             CollaboratorDocument[]
```

---

## 5. API Endpoints

| Método | Rota                                              | Descrição                              |
|--------|---------------------------------------------------|----------------------------------------|
| GET    | `/api/collaborators/:id`                          | Detalhe completo do colaborador        |
| PUT    | `/api/collaborators/:id`                          | Atualiza dados do colaborador          |
| GET    | `/api/collaborators/:id/documents`                | Lista documentos do colaborador        |
| POST   | `/api/collaborators/:id/documents`                | Upload de documento (multipart)        |
| DELETE | `/api/collaborators/:id/documents/:docId`         | Remove documento                       |
| GET    | `/api/collaborators/:id/documents/:docId/download` | Download do documento                 |
| GET    | `/api/collaborators/:id/cities`                   | Cidades vinculadas                     |
| GET    | `/api/collaborators/:id/commissions`              | Comissões do colaborador               |
| GET    | `/api/collaborators/:id/commissions/summary`      | Resumo financeiro                      |

---

## 6. Fases de Implementação

### Fase 1 — Perfil editável (1-2 dias)
- Criar `CollaboratorDetailScreen` com tabs
- Tab "Dados" com formulário editável
- Endpoint PUT `/api/collaborators/:id`
- Validação de campos obrigatórios

### Fase 2 — Repositório documental (2-3 dias)
- Criar modelo `CollaboratorDocument` no Prisma
- Implementar upload/download via API
- Tab "Documentos" com categorias e status de validade
- Alertas de documentos vencidos

### Fase 3 — Vínculo com Kit FUNDEB (1-2 dias)
- Mapear categorias de documentos → categorias do kit
- Auto-incluir documentos válidos ao gerar kit
- Verificação de pendências antes da geração

### Fase 4 — Cidades e Comissões (1-2 dias)
- Tab "Cidades" com participações do colaborador
- Tab "Comissões" com regras, accruals e payouts
- Totalizadores financeiros

### Fase 5 — Histórico e Auditoria (1 dia)
- Tab "Histórico" com timeline
- Registrar ações no AuditLog automaticamente

---

## 7. Considerações sobre "Minha Empresa" (Tab existente)

A tela "Minha Empresa" já mostra dados institucionais da Rocha Prime.
A seção **"Documentação e Atestados"** existente deve funcionar de forma similar:

- **Os documentos da empresa** (Certidões, Balanço, Contrato Social) servem
  como **documentos padrão** para todos os kits FUNDEB
- Quando um colaborador não tem um documento específico (ex: Balanço da empresa),
  o sistema usa o documento da empresa como fallback
- A hierarquia é: `Documento do Colaborador` > `Documento da Empresa` > `Pendente`

Isso garante que o Kit Documental sempre tenha a versão mais atualizada de cada documento.
