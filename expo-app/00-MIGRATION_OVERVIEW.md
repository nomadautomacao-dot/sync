# 📱 Migração Sync Next.js → Expo Android

## 🎯 Objetivo

Criar um aplicativo Android fiel ao Sync web atual utilizando Expo (React Native), maximizando reutilização de código e minimizando tempo de desenvolvimento.

## 📊 Stack Atual (Next.js)

```
Frontend: Next.js 16.1.6 + React 19.2.3 + TypeScript
UI: Radix UI + Tailwind CSS + Lucide React
State: Zustand + TanStack Query
Auth: NextAuth.js (Credentials + Google)
Charts: Recharts
PDFs: jsPDF + jsPDF-autotable + docx
Database: Prisma (Supabase)
Deploy: Google Cloud Build
```

## 🎯 Stack Alvo (Expo)

```
Frontend: Expo SDK 52 + React Native 0.76 + TypeScript
UI: React Native Paper / NativeBase + NativeWind (Tailwind)
State: Zustand + TanStack Query
Auth: Expo SecureStore + Custom Auth Flow
Charts: Victory Native / react-native-chart-kit
PDFs: react-native-pdf-print + rn-pdf-generator
Database: API calls (mesma backend)
Deploy: EAS Build (Expo Application Services)
```

## 📋 Pré-requisitos

### Ferramentas Necessárias
- Node.js 20+ (instalado)
- npm ou yarn
- Git
- Android Studio (para build final)
- Expo CLI
- EAS CLI

### Conhecimentos Necessários
- React Native básico
- Expo workflow
- Android build process
- Diferenças web vs mobile

## 🗂️ Estrutura do Projeto

```
sync/
├── app/                    # Next.js web (existente)
│   ├── api/               # API routes (reutilizar)
│   ├── (workspace)/       # Workspace web
│   └── ...
├── expo-app/              # NOVO - App Expo
│   ├── app/               # Expo Router
│   ├── components/        # Componentes mobile
│   ├── hooks/             # Hooks React Native
│   ├── lib/               # Utilitários compartilhados
│   ├── types/             # Types TypeScript
│   ├── utils/             # Funções utilitárias
│   ├── config/            # Configurações
│   └── docs/              # Documentação (este arquivo)
├── packages/              # Pacotes compartilhados (opcional)
│   ├── shared-ui/         # Componentes compartilhados
│   ├── shared-utils/      # Utilitários compartilhados
│   └── shared-types/      # Types compartilhados
└── core/                  # Core lógica (compartilhado)
    ├── domain/            # Domain types
    └── lib/               # Core libraries
```

## 🔄 Fluxo de Migração

### Fase 1: Setup Inicial (1-2 dias)
1. ✅ Criar projeto Expo
2. ✅ Configurar ambiente de desenvolvimento
3. ✅ Setup de navegação
4. ✅ Configurar TypeScript e lint
5. ✅ Setup de state management

### Fase 2: Autenticação (2-3 dias)
1. ✅ Implementar login screen
2. ✅ Implementar auth flow
3. ✅ SecureStore para tokens
4. ✅ Session management
5. ✅ Protected routes

### Fase 3: Componentes UI (3-5 dias)
1. ✅ Portar componentes base (Button, Input, etc.)
2. ✅ Adaptar componentes complexos (DataTable, etc.)
3. ✅ Setup de tema e estilos
4. ✅ Ícones e assets

### Fase 4: Features Principais (5-7 dias)
1. ✅ Dashboard
2. ✅ Módulos/Companies
3. ✅ People/Colaboradores
4. ✅ Inbox
5. ✅ Settings

### Fase 5: Funcionalidades Especiais (3-5 dias)
1. ✅ Geração de PDFs
2. ✅ Gráficos e visualizações
3. ✅ Upload de arquivos
4. ✅ Download de relatórios

### Fase 6: Otimização e Deploy (2-3 dias)
1. ✅ Performance optimization
2. ✅ Error handling
3. ✅ Testing
4. ✅ EAS Build configuration
5. ✅ Store submission

## 🎨 Design Guidelines

### Princípios de Design Mobile
1. **Touch targets**: Min 44x44px
2. **Spacing**: Base 8px, usar múltiplos
3. **Typography**: Hierarquia clara
4. **Navigation**: Bottom tabs para principal
5. **Feedback**: Haptic feedback em ações
6. **Loading**: Skeleton screens

### Diferenças Web → Mobile

| Web | Mobile |
|-----|--------|
| Hover states | Pressable feedback |
| Keyboard nav | Touch gestures |
| Fixed width | Responsivo/flex |
| Desktop layout | Mobile-first |
| Mouse | Touch gestures |
| File input | File picker |

## 🔐 Autenticação

### Web (NextAuth)
```
Session JWT → Server-side validation
```

### Mobile (Expo)
```
SecureStore → Token storage
Auth Context → Session management
API interceptor → Auto-refresh
```

## 📱 Componentes Principais

### Port Priority
1. **High Priority** (Essencial)
   - Layout components (Header, Sidebar → Tabs)
   - Auth screens
   - Dashboard
   - Navigation

2. **Medium Priority** (Importante)
   - DataTable → FlatList
   - Forms
   - Modals/Dialogs
   - Charts

3. **Low Priority** (Opcional)
   - Drag and drop
   - Complex animations
   - Web-only features

## 📊 API Integration

### Estratégia
- **Backend**: Reutilizar API routes existentes
- **Client**: TanStack Query para data fetching
- **Auth**: Bearer token no header
- **Error**: Tratamento unificado
- **Offline**: Cache offline com React Query

### Exemplo de API Call
```typescript
// Web
const { data } = await fetch('/api/companies');

// Mobile
const { data } = await queryClient.fetchQuery({
  queryKey: ['companies'],
  queryFn: () => fetch('/api/companies').then(r => r.json())
});
```

## 🚀 Deploy e Distribuição

### Opções
1. **Development Build** (Rápido, não assinado)
2. **EAS Build** (Recomendado para produção)
3. **Custom Local Build** (Total controle)

### Store Submission
- Google Play Store (Android)
- APK distribuição direta (Teste)
- Firebase App Distribution (Beta)

## 📈 Métricas de Sucesso

- **Reutilização de código**: Mínimo 60%
- **Feature parity**: 90%+ features web
- **Performance**: 60fps na maioria das telas
- **Crash rate**: <1%
- **Time to launch**: 2-3 semanas

## 📚 Recursos de Referência

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [NativeWind](https://www.nativewind.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)

## ⚠️ Limitações e Workarounds

### Limitações do Expo
1. **Native modules**: Alguns precisam de config extra
2. **Background tasks**: Limitados
3. **System permissions**: Requer config
4. **File system**: Acesso limitado

### Workarounds
1. **Development builds** para custom native code
2. **Config plugins** para permissões
3. **FileSystem API** para arquivos
4. **Background Fetch** para tasks

## 🔄 Checklist de Migração

### Setup
- [ ] Criar projeto Expo
- [ ] Configurar TypeScript
- [ ] Setup de navegação
- [ ] Configurar tema

### Auth
- [ ] Login screen
- [ ] Auth provider
- [ ] Token storage
- [ ] Protected routes

### UI
- [ ] Base components
- [ ] Theme
- [ ] Navigation
- [ ] Layout

### Features
- [ ] Dashboard
- [ ] Companies
- [ ] People
- [ ] Inbox
- [ ] Settings

### Testing
- [ ] Unit tests
- [ ] E2E tests
- [ ] Performance tests
- [ ] User testing

### Deploy
- [ ] EAS Build config
- [ ] App signing
- [ ] Store submission
- [ ] Crashlytics

---

**Próximo passo**: Siga o arquivo `01-SETUP.md` para iniciar a configuração do projeto Expo.
