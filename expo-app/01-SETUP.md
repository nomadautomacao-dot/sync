# 🚀 Passo 1: Setup Inicial do Projeto Expo

## 📋 Objetivo

Criar e configurar o projeto Expo com todas as dependências necessárias para a migração do Sync.

## 🎯 Pré-requisitos

```bash
# Verificar versões
node --version  # deve ser 20+
npm --version   # deve ser 10+
npx --version   # deve funcionar

# Instalar Expo CLI globalmente
npm install -g expo-cli

# Instalar EAS CLI
npm install -g eas-cli

# Verificar se Expo está instalado
expo --version  # deve ser 6.x ou maior
eas --version   # deve ser 7.x ou maior
```

## 🔧 Criar Projeto Expo

### Opção 1: Expo Router (Recomendado)

```bash
# Navegar para a raiz do projeto sync
cd C:\Users\Adrie\Desktop\Sync

# Criar projeto com Expo Router
npx create-expo-app@latest expo-app --template blank-typescript

# Entrar no diretório
cd expo-app

# Instalar Expo Router
npm install expo-router

# Instalar outras dependências essenciais
npm install @tanstack/react-query zustand axios
npm install date-fns clsx tailwind-merge
npm install react-native-safe-area-context react-native-screens
npm install react-native-gesture-handler react-native-reanimated

# Instalar dependências de UI
npm install react-native-paper
npm install nativewind
npm install react-native-svg
npm install react-native-vector-icons

# Instalar dependências para PDF e documentos
npm install react-native-pdf react-native-fs
npm install @react-native-async-storage/async-storage
npm install expo-secure-store

# Instalar dependências para navegação e gestos
npm install @react-navigation/native
npm install @react-navigation/native-stack
npm install @react-navigation/bottom-tabs
npm install @react-navigation/material-top-tabs

# Instalar dependências de desenvolvimento
npm install -D @types/react-native-vector-icons
```

### Opção 2: Configuração Manual do app.json

```json
{
  "expo": {
    "name": "Sync Mobile",
    "slug": "sync-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.sync.mobile"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.sync.mobile",
      "permissions": [
        "INTERNET",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "CAMERA",
        "READ_MEDIA_IMAGES",
        "READ_MEDIA_VIDEO"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-camera",
        {
          "cameraPermission": "Permitir que $(PRODUCT_NAME) acesse sua câmera",
          "microphonePermission": "Permitir que $(PRODUCT_NAME) acesse seu microfone",
          "recordAudioAndroid": true
        }
      ],
      [
        "expo-file-system",
        {
          "iosFileSystemPermissions": "Documents"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": {
        "origin": false
      },
      "eas": {
        "projectId": "seu-project-id-aqui"
      }
    }
  }
}
```

## 📁 Estrutura de Diretórios

```bash
expo-app/
├── app/                      # Expo Router
│   ├── (tabs)/               # Tab navigation
│   │   ├── _layout.tsx       # Tab layout
│   │   ├── index.tsx         # Home/Dashboard
│   │   ├── companies.tsx     # Companies tab
│   │   ├── people.tsx        # People tab
│   │   ├── inbox.tsx         # Inbox tab
│   │   └── settings.tsx      # Settings tab
│   ├── auth/                 # Auth screens
│   │   ├── login.tsx
│   │   └── _layout.tsx
│   ├── _layout.tsx           # Root layout
│   └── index.tsx             # Redirect to login or home
├── components/               # React Native components
│   ├── ui/                   # Base UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── modal.tsx
│   │   ├── dialog.tsx
│   │   └── avatar.tsx
│   ├── layout/               # Layout components
│   │   ├── header.tsx
│   │   ├── screen-container.tsx
│   │   └── loading-skeleton.tsx
│   ├── data-display/         # Data display components
│   │   ├── data-table.tsx
│   │   ├── list-item.tsx
│   │   ├── status-badge.tsx
│   │   └── progress-bar.tsx
│   ├── forms/                # Form components
│   │   ├── form-field.tsx
│   │   ├── form-select.tsx
│   │   └── form-checkbox.tsx
│   └── feedback/             # Feedback components
│       ├── loading.tsx
│       ├── error.tsx
│       └── empty-state.tsx
├── hooks/                    # Custom hooks
│   ├── useAuth.ts
│   ├── useApi.ts
│   ├── useDebounce.ts
│   └── useToast.ts
├── lib/                      # Core libraries
│   ├── api/                  # API clients
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── companies.ts
│   │   ├── people.ts
│   │   ├── modules.ts
│   │   └── dashboard.ts
│   ├── storage/              # Storage utilities
│   │   ├── secure-store.ts
│   │   └── async-storage.ts
│   ├── utils/                # Utilities
│   │   ├── date.ts
│   │   ├── format.ts
│   │   └── validators.ts
│   └── constants.ts          # App constants
├── stores/                   # State management
│   ├── auth-store.ts
│   ├── ui-store.ts
│   └── data-store.ts
├── types/                    # TypeScript types
│   ├── auth.ts
│   ├── api.ts
│   ├── domain.ts
│   └── common.ts
├── config/                   # Configuration
│   ├── theme.ts
│   ├── colors.ts
│   └── env.ts
├── assets/                   # Assets
│   ├── images/
│   ├── icons/
│   └── fonts/
├── utils/                    # Shared utilities (pode apontar para core/)
│   └── ...
└── package.json
```

## 🎨 Setup de Tema e Cores

### config/theme.ts
```typescript
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6366f1',      // Indigo 500
    primaryContainer: '#e0e7ff',
    secondary: '#8b5cf6',     // Violet 500
    secondaryContainer: '#ede9fe',
    tertiary: '#06b6d4',     // Cyan 500
    tertiaryContainer: '#cffafe',
    error: '#ef4444',
    errorContainer: '#fee2e2',
    background: '#ffffff',
    surface: '#f8fafc',
    surfaceVariant: '#f1f5f9',
    onSurface: '#0f172a',
    onSurfaceVariant: '#475569',
    outline: '#cbd5e1',
    outlineVariant: '#e2e8f0',
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#818cf8',      // Indigo 400
    primaryContainer: '#312e81',
    secondary: '#a78bfa',     // Violet 400
    secondaryContainer: '#4c1d95',
    tertiary: '#22d3ee',     // Cyan 400
    tertiaryContainer: '#164e63',
    error: '#f87171',
    errorContainer: '#7f1d1d',
    background: '#0f172a',
    surface: '#1e293b',
    surfaceVariant: '#334155',
    onSurface: '#f8fafc',
    onSurfaceVariant: '#94a3b8',
    outline: '#475569',
    outlineVariant: '#334155',
  },
};
```

### config/colors.ts
```typescript
export const colors = {
  // Sync brand colors
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  // Semantic colors
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Neutral colors
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },
};
```

## 🔐 Setup de Variáveis de Ambiente

### .env
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api

# Auth Configuration
NEXTAUTH_SECRET=your-super-secret-key-here
NEXTAUTH_URL=http://localhost:19006

# Google Auth (opcional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# App Configuration
APP_NAME=Sync Mobile
APP_SLUG=sync-mobile

# Storage Keys
AUTH_TOKEN_KEY=@sync_auth_token
AUTH_REFRESH_TOKEN_KEY=@sync_refresh_token
USER_DATA_KEY=@sync_user_data

# Feature Flags
ENABLE_PDF_GENERATION=true
ENABLE_FILE_UPLOAD=true
ENABLE_NOTIFICATIONS=true
```

### config/env.ts
```typescript
import Constants from 'expo-constants';

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = Constants.expoConfig?.extra?.[key] || process.env[key];
  return value || defaultValue || '';
};

export const env = {
  // API
  apiBaseUrl: getEnvVar('NEXT_PUBLIC_API_URL', 'http://localhost:3000'),
  apiBasePath: getEnvVar('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3000/api'),

  // Auth
  authSecret: getEnvVar('NEXTAUTH_SECRET', ''),
  authUrl: getEnvVar('NEXTAUTH_URL', 'http://localhost:19006'),

  // Google Auth
  googleClientId: getEnvVar('GOOGLE_CLIENT_ID', ''),
  googleClientSecret: getEnvVar('GOOGLE_CLIENT_SECRET', ''),

  // App
  appName: getEnvVar('APP_NAME', 'Sync Mobile'),
  appSlug: getEnvVar('APP_SLUG', 'sync-mobile'),

  // Storage
  authTokenKey: getEnvVar('AUTH_TOKEN_KEY', '@sync_auth_token'),
  authRefreshTokenKey: getEnvVar('AUTH_REFRESH_TOKEN_KEY', '@sync_refresh_token'),
  userDataKey: getEnvVar('USER_DATA_KEY', '@sync_user_data'),

  // Features
  enablePdfGeneration: getEnvVar('ENABLE_PDF_GENERATION', 'true') === 'true',
  enableFileUpload: getEnvVar('ENABLE_FILE_UPLOAD', 'true') === 'true',
  enableNotifications: getEnvVar('ENABLE_NOTIFICATIONS', 'true') === 'true',
};
```

## 🧩 Setup de Tipos Compartilhados

### types/common.ts
```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  meta?: {
    page?: number;
    perPage?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export type SortOrder = 'asc' | 'desc';

export interface SortParams {
  field: string;
  order: SortOrder;
}

export interface FilterParams {
  [key: string]: any;
}

export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface QueryParams extends PaginationParams, Partial<SortParams> {
  filters?: FilterParams;
  search?: string;
}
```

### types/domain.ts
```typescript
// Reutilizar tipos do projeto web existente
export interface User {
  id: string;
  name: string;
  email: string;
  groupId: string;
  groupRole: GroupRole;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type GroupRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Group {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  slug: string;
  groupId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Module {
  id: string;
  name: string;
  description?: string;
  type: ModuleType;
  status: ModuleStatus;
  companyId?: string;
  groupId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ModuleType =
  | 'levantamento-fundeb'
  | 'contrato-fundeb'
  | 'case-de-sucesso'
  | 'education'
  | 'simec-obras';

export type ModuleStatus = 'draft' | 'active' | 'archived';

export interface Municipality {
  codigoIbge: string;
  nome: string;
  uf: string;
  regiao: string;
  populacao?: number;
  pib?: number;
  idh?: number;
}
```

## 📡 Setup de API Client

### lib/api/client.ts
```typescript
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { env } from '../../config/env';
import { ApiResponse } from '../../types/common';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.apiBasePath,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - Add auth token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await SecureStore.getItemAsync(env.authTokenKey);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiResponse>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Attempt to refresh token
            const refreshToken = await SecureStore.getItemAsync(env.authRefreshTokenKey);
            if (!refreshToken) {
              throw new Error('No refresh token');
            }

            const response = await this.client.post('/auth/refresh', {
              refreshToken,
            });

            const { token } = response.data.data;
            await SecureStore.setItemAsync(env.authTokenKey, token);

            // Retry original request
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, clear tokens and redirect to login
            await SecureStore.deleteItemAsync(env.authTokenKey);
            await SecureStore.deleteItemAsync(env.authRefreshTokenKey);
            // Navigate to login (implementar)
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  public get<T = any>(url: string, config?: any): Promise<ApiResponse<T>> {
    return this.client.get(url, config).then((res) => res.data);
  }

  public post<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    return this.client.post(url, data, config).then((res) => res.data);
  }

  public put<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    return this.client.put(url, data, config).then((res) => res.data);
  }

  public patch<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    return this.client.patch(url, data, config).then((res) => res.data);
  }

  public delete<T = any>(url: string, config?: any): Promise<ApiResponse<T>> {
    return this.client.delete(url, config).then((res) => res.data);
  }
}

export const apiClient = new ApiClient();
```

## 🗂️ Setup de Stores (Zustand)

### stores/auth-store.ts
```typescript
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types/domain';
import { env } from '../config/env';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadAuth: () => Promise<void>;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync(env.authTokenKey, token);
    await SecureStore.setItemAsync(env.userDataKey, JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(env.authTokenKey);
    await SecureStore.deleteItemAsync(env.authRefreshTokenKey);
    await SecureStore.deleteItemAsync(env.userDataKey);
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadAuth: async () => {
    try {
      const token = await SecureStore.getItemAsync(env.authTokenKey);
      const userData = await SecureStore.getItemAsync(env.userDataKey);

      if (token && userData) {
        const user = JSON.parse(userData);
        set({ user, token, isAuthenticated: true });
      } else {
        set({ isAuthenticated: false });
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
      set({ isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
}));
```

### stores/ui-store.ts
```typescript
import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface UIState {
  isLoading: boolean;
  toasts: Toast[];
  theme: 'light' | 'dark';
  setLoading: (isLoading: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  toasts: [],
  theme: 'light',

  setLoading: (isLoading) => set({ isLoading }),

  addToast: (toast) => {
    const id = Date.now().toString();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));

    // Auto remove after duration
    if (toast.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, toast.duration || 3000);
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),

  setTheme: (theme) => set({ theme }),
}));
```

## 🧪 Setup de TanStack Query

### lib/utils/query-client.ts
```typescript
import { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth-store';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Hook para logout global em caso de erro 401
queryClient.setMutationDefaults(['logout'], {
  onSuccess: () => {
    useAuthStore.getState().clearAuth();
  },
});
```

## 📝 Testar Setup

### Criar tela simples de teste

### app/index.tsx
```typescript
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../stores/auth-store';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading, loadAuth } = useAuthStore();

  useEffect(() => {
    loadAuth();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      router.replace(isAuthenticated ? '/(tabs)' : '/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <View style={styles.container}>
      <Text>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

### Rodar o app
```bash
# Instalar dependências
npm install

# Iniciar development server
npx expo start

# Para Android
npx expo start --android
```

## ✅ Checklist de Setup

- [ ] Criar projeto Expo
- [ ] Instalar todas as dependências
- [ ] Configurar app.json
- [ ] Criar estrutura de diretórios
- [ ] Configurar tema e cores
- [ ] Setup de environment variables
- [ ] Criar tipos TypeScript
- [ ] Setup de API client
- [ ] Setup de Zustand stores
- [ ] Setup de TanStack Query
- [ ] Testar app inicial

## 🚨 Troubleshooting Comum

### Problema: Metro bundler não encontra módulos
```bash
# Limpar cache do Metro
npx expo start -c
```

### Problema: Erro de types
```bash
# Reinstalar tipos
npm install -D @types/react @types/react-native
```

### Problema: Android emulator não conecta
```bash
# Verificar devices
adb devices

# Reiniciar ADB
adb kill-server
adb start-server
```

---

**Próximo passo**: Após completar o setup, siga o arquivo `02-AUTHENTICATION.md` para implementar o sistema de autenticação.
