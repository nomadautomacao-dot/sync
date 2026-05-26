import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../components/providers/auth-provider';
import { queryClient } from '../lib/query-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { syncTheme } from '../config/theme';
import { colors } from '../config/colors';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={syncTheme}>
            <AuthProvider>
              <StatusBar style="light" translucent backgroundColor="transparent" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'fade',
                  contentStyle: { backgroundColor: colors.bgPrimary },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="auth" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
              </Stack>
            </AuthProvider>
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
