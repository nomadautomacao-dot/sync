import { Drawer } from 'expo-router/drawer';
import { useAuthStore } from '../../stores/auth';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { colors } from '../../config/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function DrawerLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isLoading, isAuthenticated]);

  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.bgPrimary,
          borderBottomColor: colors.borderSubtle,
          borderBottomWidth: 1,
        },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontSize: 18,
          fontWeight: '600',
        },
        headerTintColor: colors.primary,
        drawerStyle: {
          backgroundColor: colors.bgSecondary,
          width: 280,
        },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.textSecondary,
        drawerLabelStyle: {
          fontSize: 14,
          fontWeight: '500',
          marginLeft: -10,
        },
        overlayColor: 'rgba(0, 0, 0, 0.7)',
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: 'Dashboard',
          title: 'Sync Dashboard',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="companies"
        options={{
          drawerLabel: 'Empresas',
          title: 'Empresas',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="office-building-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="people"
        options={{
          drawerLabel: 'Equipe',
          title: 'Gestao de Equipe',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="modules"
        options={{
          drawerLabel: 'Modulos',
          title: 'Modulos do Sistema',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="apps" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="fundeb"
        options={{
          drawerLabel: 'Levantamento FUNDEB',
          title: 'Levantamento FUNDEB',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="file-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="inbox"
        options={{
          drawerLabel: 'Atividade',
          title: 'Centro de Notificacoes',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bell-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Esconder a pasta (tabs) do drawer */}
      <Drawer.Screen
        name="(tabs)"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
    </Drawer>
  );
}
