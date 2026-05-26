# Projeto de Reestruturação Visual (Material 3)

## 1. Visão Geral
- **Objetivo:** Reformular completamente o aplicativo para torná-lo mais leve, claro e com uma identidade forte, utilizando como base as diretrizes do Material Design 3.
- **Plataforma alvo:** Android (Exclusivamente Smartphones).
- **Identidade Base:** 
  - Cor semente primária: `#2F6BFF` (azul atual do `SyncPalette.accentHover`).
  - Será gerado um `ColorScheme` semântico nativo do Material 3 focado no tema (provavelmente Dark) utilizando esta cor para orquestrar todas as outras (superfícies, text on-surface, containers).

## 2. Princípios de Redesign (Mobile-Design Protocol)
- **Áreas de Toque Mínimas (Touch Targets):** `48dp x 48dp` mínimo para todos os elementos interativos. Fim dos botões ou ícones difíceis de clicar.
- **Hierarquia Visual via Superfícies:** Em vez de usar bordas duras para separar elementos, usaremos a variação de "Superfícies" (ex: `surface`, `surfaceContainer`, `surfaceVariant`) e elevações (Tonal Elevation) nativas do Material 3. Isso resolve o problema de interface "pesada".
- **Tipografia Escalonada:** Atualizaremos os estilos de texto usando o `TextTheme` M3 padrão (Display, Headline, Title, Body, Label). Isso garante hierarquia clara do que é mais importante ler primeiro.
- **Navegação Ergonômica (Thumb Zone):** CTAs primários (botões de salvar, avançar, confirmar) descerão para áreas fáceis de tocar com o polegar.

## 3. Plano de Ação (Fases de Implementação)

### Fase 1: A Nova Fundação do Design (App Theme)
- [ ] Refatorar o `app_theme.dart` para inicializar um tema puramente Material 3 via `ColorScheme.fromSeed(seedColor: Color(0xFF2F6BFF), ...)`.
- [ ] Ajustar `SyncPalette` se necessário, porém delegando a maioria dos tons de fundo e borda ao `theme.colorScheme`.
- [ ] Atualizar componentes globais (`ElevatedButtonTheme`, `OutlinedButtonTheme`, `InputDecorationTheme`, `CardTheme`) para as aparências limpas e arredondadas do M3.

### Fase 2: Componentes Comuns (UX/UI Android)
- [ ] Atualizar a navegação principal para o componente nativo `NavigationBar` (novo padrão Android para Bottom Navs).
- [ ] Refatorar estilos de Listas e Cards para uso de `ListTile` e margens de base 8dp ou 16dp.
- [ ] Revisar feedbacks interativos (garantir Ripple effects visíveis em todos os cliques).

### Fase 3: Refatoração das Telas
- [ ] **Dashboard Principal:** Melhorar os cards de estatísticas, usar espaços negativos para separar informações, removendo linhas de grid poluídas.
- [ ] **Telas de Formulários / PDF Builder:** Substituir inputs antigos por campos Material 3 (Filled ou Outlined), garantindo labels fáceis de ler.
- [ ] **Testes em Dispositivo:** Executar verificações para garantir 60fps, responsividade num celular padrão, e checar contrastes em tema Escuro/Claro.

## 4. Checkpoint Final
Toda alteração de tela passará pela validação:
1. Tem alvo de toque de no mínimo 48dp?
2. A tela flui bem em rolagem de listas (sem travas)?
3. A identidade parece profissional e leve?
