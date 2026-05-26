import { Stack } from 'expo-router';
import { colors } from '../../config/colors';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.bgPrimary } }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
