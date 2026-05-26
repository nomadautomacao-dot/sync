# 🔐 Passo 2: Sistema de Autenticação

## 📋 Objetivo

Implementar o sistema de autenticação do app mobile, replicando a funcionalidade do NextAuth.js mas adaptado para mobile com SecureStore.

## 🎯 Visão Geral da Arquitetura

```
Web (NextAuth)                  Mobile (Expo)
├─ JWT Session               ├─ SecureStore (Token)
├─ Server validation         ├─ Token validation
├─ Cookie-based             ├─ Header-based (Bearer)
├─ Session callbacks        ├─ Auth Context + Hooks
└─ Provider pattern         └─ Custom Auth Flow
```

## 🔧 Autenticação - API Backend

### Aproveitar Auth Existente

A autenticação do backend web já está implementada em `core/lib/auth.ts`. Vamos reutilizar os endpoints:

**Endpoints existentes:**
- `/api/auth/login` - Login com credenciais
- `/api/auth/logout` - Logout
- `/api/auth/refresh` - Refresh token (implementar se necessário)

### Adicionar Refresh Token Endpoint (se necessário)

### app/api/auth/refresh/route.ts (no projeto web)
```typescript
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { signJWT } from '@/core/lib/jwt';

export async function POST(request: Request) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: { message: 'Refresh token required' } },
        { status: 400 }
      );
    }

    // Verify refresh token
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(refreshToken, secret);

    // Generate new access token
    const newToken = await signJWT({
      email: payload.email,
      userId: payload.userId,
    });

    return NextResponse.json({
      success: true,
      data: { token: newToken },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid refresh token' } },
      { status: 401 }
    );
  }
}
```

## 📱 Autenticação Mobile

### 1. Auth Context Provider

### components/providers/auth-provider.tsx
```typescript
import React, { createContext, useContext, useEffect } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { router } from 'expo-router';

interface AuthContextType {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  isAuthenticated: ReturnType<typeof useAuthStore.getState>['isAuthenticated'];
  isLoading: ReturnType<typeof useAuthStore.getState>['isLoading'];
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, setAuth, clearAuth, loadAuth, setLoading } = useAuthStore();

  useEffect(() => {
    loadAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Login failed');
      }

      await setAuth(data.user, data.token);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/logout`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await clearAuth();
      router.replace('/auth/login');
    }
  };

  const refresh = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: await SecureStore.getItemAsync('refreshToken'),
        }),
      });

      const data = await response.json();
      if (data.success && data.token) {
        await SecureStore.setItemAsync('token', data.token);
        return data.token;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### 2. Login Screen

### app/auth/login.tsx
```typescript
import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { TextInput, Button, Text, HelperText, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../components/providers/auth-provider';
import { useUIStore } from '../../stores/ui-store';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const { addToast } = useUIStore();
  const theme = useTheme();

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!email) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email inválido';
    }

    if (!password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await login(email, password);
      addToast({ message: 'Login realizado com sucesso!', type: 'success' });
      router.replace('/(tabs)');
    } catch (error: any) {
      addToast({
        message: error.message || 'Erro ao fazer login',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Implementar Google Auth com expo-auth-session
    addToast({
      message: 'Google login será implementado em breve',
      type: 'info',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text variant="headlineMedium" style={styles.title}>
              Sync
            </Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              Entre para continuar
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={!!errors.email}
              style={styles.input}
            />
            {errors.email && (
              <HelperText type="error" visible={!!errors.email}>
                {errors.email}
              </HelperText>
            )}

            <TextInput
              label="Senha"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              error={!!errors.password}
              style={styles.input}
            />
            {errors.password && (
              <HelperText type="error" visible={!!errors.password}>
                {errors.password}
              </HelperText>
            )}

            <View style={styles.forgotPassword}>
              <Text
                style={styles.forgotPasswordText}
                onPress={() => router.push('/auth/forgot-password')}
              >
                Esqueceu a senha?
              </Text>
            </View>

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              Entrar
            </Button>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              mode="outlined"
              onPress={handleGoogleLogin}
              icon="google"
              style={styles.googleButton}
              contentStyle={styles.buttonContent}
            >
              Continuar com Google
            </Button>
          </View>

          <View style={styles.footer}>
            <Text variant="bodyMedium">
              Não tem uma conta?{' '}
              <Text style={styles.link} onPress={() => router.push('/auth/register')}>
                Criar conta
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginTop: 40,
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#fff',
  },
  forgotPassword: {
    alignItems: 'flex-end',
    marginTop: -8,
  },
  forgotPasswordText: {
    color: '#6366f1',
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#9ca3af',
  },
  googleButton: {
    borderRadius: 8,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  link: {
    color: '#6366f1',
    fontWeight: '600',
  },
});
```

### 3. Auth Layout

### app/auth/_layout.tsx
```typescript
import { Stack } from 'expo-router';
import { useAuth } from '../../components/providers/auth-provider';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  // Se já está autenticado, redirecionar para home
  if (!isLoading && isAuthenticated) {
    return null; // Será redirecionado pelo index
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" options={{ presentation: 'modal' }} />
      <Stack.Screen name="forgot-password" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
```

### 4. Protected Route Hook

### hooks/useProtectedRoute.ts
```typescript
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../components/providers/auth-provider';

export function useProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  return { isAuthenticated, isLoading };
}
```

### 5. Loading Screen

### components/layout/loading-screen.tsx
```typescript
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Carregando...' }: LoadingScreenProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text variant="bodyMedium" style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  message: {
    color: '#666',
  },
});
```

### 6. Session Management

### hooks/useSession.ts
```typescript
import { useAuth } from '../components/providers/auth-provider';

export function useSession() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return {
    user,
    isAuthenticated,
    isLoading,
    hasRole: (role: string) => user?.groupRole === role,
    hasPermission: (permission: string) => {
      // Implementar lógica de permissões baseada no role
      const role = user?.groupRole;
      if (!role) return false;

      const permissions: Record<string, string[]> = {
        owner: ['*'],
        admin: ['read', 'write', 'delete'],
        member: ['read', 'write'],
        viewer: ['read'],
      };

      return role === 'owner' || permissions[role]?.includes(permission) || false;
    },
  };
}
```

### 7. Google Authentication (Opcional)

### components/providers/google-auth-provider.tsx
```typescript
import React, { createContext, useContext, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

interface GoogleAuthContextType {
  googleSignIn: () => Promise<void>;
  isLoading: boolean;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    iosClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_CLIENT_ID,
    redirectUri: 'exp://127.0.0.1:19000/--/',
    scopes: ['openid', 'profile', 'email'],
  });

  const [isLoading, setIsLoading] = useState(false);

  const googleSignIn = async () => {
    try {
      setIsLoading(true);
      const result = await promptAsync();

      if (result?.type === 'success') {
        const { authentication } = result;
        // Enviar token para backend para criar sessão
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: authentication?.idToken,
          }),
        });

        const data = await response.json();
        if (data.success) {
          // Salvar token e usuário
          await SecureStore.setItemAsync('token', data.token);
          // Redirecionar
        }
      }
    } catch (error) {
      console.error('Google sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GoogleAuthContext.Provider value={{ googleSignIn, isLoading }}>
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
}
```

## 🧪 Testing Authentication

### Test Flow

1. **Teste de Login com Credenciais Válidas**
```bash
# Usar credenciais do .env do projeto web
Email: adrieltavares87@gmail.com
Senha: 91991589
```

2. **Teste de Login com Credenciais Inválidas**
```bash
Email: invalid@test.com
Senha: wrongpassword
```

3. **Teste de Logout**
4. **Teste de Sessão Persistente**
5. **Teste de Token Refresh** (se implementado)

### Manual Testing Checklist

- [ ] Login screen carrega corretamente
- [ ] Validação de email funciona
- [ ] Validação de senha funciona
- [ ] Login com credenciais corretas funciona
- [ ] Login com credenciais incorretas mostra erro
- [ ] Loading state funciona
- [ ] Redirecionamento após login funciona
- [ ] Sessão persiste ao fechar e abrir o app
- [ ] Logout funciona corretamente
- [ ] Redirecionamento para login após logout funciona

## 🔐 Security Considerations

### Best Practices

1. **Token Storage**
   ```typescript
   // ✅ Good: Use SecureStore
   await SecureStore.setItemAsync('token', token);

   // ❌ Bad: Don't use AsyncStorage for sensitive data
   await AsyncStorage.setItem('token', token);
   ```

2. **Token Validation**
   ```typescript
   // Validar token antes de cada request
   const token = await SecureStore.getItemAsync('token');
   if (!token) {
     // Redirecionar para login
   }
   ```

3. **HTTPS Only**
   ```typescript
   // Forçar HTTPS em produção
   const apiBaseUrl = __DEV__
     ? 'http://localhost:3000'
     : 'https://your-api.com';
   ```

4. **Session Timeout**
   ```typescript
   // Implementar timeout de sessão
   const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos
   ```

## 🚨 Common Issues and Solutions

### Issue: Token not persisting
```typescript
// Solution: Ensure SecureStore is properly initialized
import * as SecureStore from 'expo-secure-store';

// Check if token exists before attempting operations
const token = await SecureStore.getItemAsync('token');
if (token) {
  // Use token
}
```

### Issue: API calls failing with 401
```typescript
// Solution: Implement token refresh in API client
// See lib/api/client.ts in setup guide
```

### Issue: App crashing on auth state change
```typescript
// Solution: Add proper error handling and loading states
if (isLoading) {
  return <LoadingScreen />;
}
```

## ✅ Checklist de Autenticação

- [ ] Criar Auth Provider
- [ ] Criar Login Screen
- [ ] Criar Auth Layout
- [ ] Implementar Protected Route Hook
- [ ] Criar Loading Screen
- [ ] Implementar Session Management Hook
- [ ] Integrar com API do backend
- [ ] Testar login flow completo
- [ ] Testar logout
- [ ] Testar persistência de sessão
- [ ] Implementar Google Auth (opcional)
- [ ] Adicionar validações
- [ ] Adicionar error handling
- [ ] Testar security measures

## 📚 Recursos Adicionais

- [Expo SecureStore Docs](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo Auth Session](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [React Navigation Auth Flow](https://reactnavigation.org/docs/auth-flow/)
- [NextAuth.js Docs](https://next-auth.js.org/)

---

**Próximo passo**: Após completar a autenticação, siga o arquivo `03-COMPONENTS_UI.md` para portar os componentes UI.
