# Especificação Técnica: Módulo "Case de Sucesso"

## 1. Visão Geral
**Objetivo**: Desenvolver o módulo "Case de Sucesso" voltado para analisar e comparar dinamicamente a evolução das parcelas do FUNDEB (VAAR, VAAF, VAAT e Total) entre 2024 e 2025. 
**Experiência do Usuário (UX/UI)**: O módulo entregará um dashboard premium e dinâmico, dentro do padrão "Sync Dark". O usuário digitará o nome do município em um seletor inteligente (autocomplete) e a página fará transições suaves para exibir painéis e gráficos comparativos lado-a-lado ou sobrepostos, destacando claramente a evolução financeira (ex: variação percentual) de modo extremamente visual e refinado.

---

## 2. Ingestão de Dados (Origem: PDFs)
As fontes de dados são os arquivos locais:
- `complementacao/2024.pdf`
- `complementacao/2025.pdf`

**Estratégia**: 
Durante a implementação, esses arquivos precisarão ser processados. Será criado um script em `scripts/import-case-sucesso.ts` que utilizará uma biblioteca de parse de PDF (como `pdf-parse` ou conversão manual para CSV) para ler e extrair os valores correspondentes de cada Município para as variáveis VAAF, VAAT, VAAR e Total. 
Os dados processados serão armazenados no banco de dados para consulta rápida pela aplicação.

---

## 3. Modelo de Dados (Prisma)
Adicionar e executar as migrations do seguinte modelo no arquivo `prisma/schema.prisma`:

```prisma
model CaseSucessoFundeb {
  id           String   @id @default(cuid())
  municipio    String
  uf           String?  // Estado, se disponível na tabela
  ano          Int      // 2024 ou 2025
  
  // Valores financeiros
  vaaf         Float    @default(0)
  vaat         Float    @default(0)
  vaar         Float    @default(0)
  total        Float    @default(0)
  
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Índices para performance
  @@unique([municipio, ano])
  @@index([municipio])
}
```

---

## 4. Estrutura de Pastas e Arquivos do Módulo
Baseado na arquitetura do Sync, os seguintes recursos deverão ser criados:

1. **Definição e Registro:**
   - Adicionar id `'case-de-sucesso'` no tipo `ModuleId` em `core/domain/module-types.ts`.
   - Adicionar o registro no `core/config/module-catalog.ts` para que apareça automaticamente na lista de módulos.

2. **Rotas (BFF - API):**
   - `app/api/modulos/case-de-sucesso/route.ts`: Para buscar os municípios disponíveis.
   - `app/api/modulos/case-de-sucesso/[municipio]/route.ts`: Endpoint que devolve os dados de 2024 e 2025 do município consultado.

3. **Arquivos Visuais e Componentes (Módulo):**
   - `modules/case-de-sucesso/case-de-sucesso-page.tsx`: Entrypoint do dashboard do módulo.
   - `modules/case-de-sucesso/hooks/use-case-sucesso.ts`: Mutação (TanStack Query) para chamar a API e gerenciar estado.
   - `modules/case-de-sucesso/components/municipio-selector.tsx`: Componente de busca (`Command` input) robusto para selecionar o município.
   - `modules/case-de-sucesso/components/fundeb-metrics-cards.tsx`: Cards brilhantes do design system destacando o percentual de crescimento entre 2024 e 2025 de cada métrica (VAAF, VAAT, VAAR e Total).
   - `modules/case-de-sucesso/components/fundeb-evolution-charts.tsx`: Gráfico de barras (Recharts) cruzando 2024 vs 2025 para comparação visual cristalina.

4. **Rota na Empresa:**
   - `app/(dashboard)/empresas/[companyId]/modulos/case-de-sucesso/page.tsx`: Para injetar o componente `case-de-sucesso-page.tsx`.

---

## 5. UI / Estética Premium
Para obedecer aos requisitos de "extremamente visual", os gráficos devem usar o design já aprovado.
- Os cards de delta (evolução percentual) devem ter indicadores em verde (`text-emerald-500`) quando há ganho na arrecadação, ou vermelho caso contrário.
- Utilize a biblioteca Recharts implementada nativamente (ou Shadcn UI/Tremor) com cores vibrantes do fundo (`--sync-bg-surface`), grids sutis (`--sync-border-subtle`) e dicas visuais (Tooltips com backdrop-blur).
- Animações usando `framer-motion` para surgir o relátorio quando um novo município for selecionado no combobox.

---

## 6. Passo a Passo de Execução para a próxima IA
1. Atualizar o Prisma Schema e gerar banco de dados.
2. Criar ou processar o script de ingestão de dados (`scripts/seed-case-sucesso.ts`) lendo do PDF/CSV e populando a tabela.
3. Criar a tipagem global (`ModuleId`) e expor no Catálogo.
4. Criar a APIRoute `GET /api/modulos/case-de-sucesso/[municipio]`.
5. Construir os UI Components (Seletor, Gráficos, Cards de Variação).
6. Montar a `case-de-sucesso-page.tsx` com React Query e Framer Motion.
7. Testar a transição.
