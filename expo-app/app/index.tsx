import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuthStore } from '../stores/auth';
import { colors, spacing } from '../config/colors';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/(drawer)');
      } else {
        router.replace('/auth/login');
      }
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Sync</Text>
      <Text style={styles.sub}>Carregando sistema...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgPrimary,
    gap: spacing.md,
  },
  logo: { fontSize: 42, color: colors.primary, fontWeight: 'bold' },
  sub: { color: colors.textSecondary, fontSize: 14 },
});
