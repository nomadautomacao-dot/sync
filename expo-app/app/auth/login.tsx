import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { TextInput, Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/auth';
import { colors } from '../../config/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuthStore();
  const router = useRouter();

  const validateForm = () => {
    const newErrors: typeof errors = {};
    if (!email) newErrors.email = 'Email obrigtorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Email invalido';
    if (!password) newErrors.password = 'Senha obrigatoria';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.replace('/(drawer)');
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao entrar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Sync</Text>
            <Text style={styles.subtitle}>Mobile Connect</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              error={!!errors.email}
              style={styles.input}
              textColor={colors.textPrimary}
              theme={{ colors: { onSurfaceVariant: colors.textSecondary } }}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

            <TextInput
              label="Senha"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(!showPassword)} color={colors.textTertiary} />}
              error={!!errors.password}
              style={styles.input}
              textColor={colors.textPrimary}
              theme={{ colors: { onSurfaceVariant: colors.textSecondary } }}
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            <Button mode="contained" onPress={handleLogin} loading={isSubmitting} disabled={isSubmitting} style={styles.button} buttonColor={colors.primary}>
              Entrar no Sistema
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bgPrimary },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { marginBottom: 48, alignItems: 'center' },
  title: { fontSize: 42, color: colors.primary, fontWeight: 'bold' },
  subtitle: { color: colors.textSecondary, fontSize: 16, marginTop: 4 },
  form: { gap: 8 },
  input: { backgroundColor: colors.bgSurface },
  button: { marginTop: 16, borderRadius: 8, paddingVertical: 4 },
  errorText: { color: colors.statusError, fontSize: 12, marginLeft: 8, marginTop: -4, marginBottom: 4 },
});
