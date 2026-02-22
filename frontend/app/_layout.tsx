import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/providers/AuthProvider';
import { AppQueryClientProvider, queryClient } from '../src/providers/QueryProvider';
import { AuthBoundary } from '../src/components/AuthBoundary';
import { VideoLoadingProvider } from '../src/contexts/VideoLoadingContext';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';


function CustomBackButton() {
  const router = useRouter();
  return (
    <Pressable style={styles.backButton} onPress={() => router.back()}>
      <Text style={styles.backButtonIcon}>‹</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (__DEV__) {
      console.log('🔧 Development mode: Error tracking is disabled');
    }
  }, []);
  return (
    <AppErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider queryClient={queryClient}>
        <AppQueryClientProvider>
          <AuthBoundary>
            <VideoLoadingProvider>
            <StatusBar style="auto" />
            <Stack
            screenOptions={{
              headerTitleStyle: {
                fontWeight: '600',
                fontSize: 17,
              },
              headerShadowVisible: false,
              headerStyle: {
                backgroundColor: '#f8fafc',
              },
            }}
          >
            <Stack.Screen
              name="index"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="onboarding"
              options={{
                headerShown: false,
                gestureEnabled: false,
              }}
            />
            <Stack.Screen name="phrase/[id]" options={{ title: '' }} />
            <Stack.Screen
              name="favorites"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="search"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="settings"
              options={{
                title: '設定',
                headerLeft: () => <CustomBackButton />,
              }}
            />
            <Stack.Screen
              name="verify-email"
              options={{
                title: 'Email Verification',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="forgot-password"
              options={{
                title: 'Forgot Password',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="reset-password"
              options={{
                title: 'Reset Password',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="privacy-policy"
              options={{
                title: 'プライバシーポリシー',
                headerLeft: () => <CustomBackButton />,
              }}
            />
            <Stack.Screen
              name="terms-of-service"
              options={{
                title: '利用規約',
                headerLeft: () => <CustomBackButton />,
              }}
            />
            </Stack>
          </VideoLoadingProvider>
          </AuthBoundary>
        </AppQueryClientProvider>
      </AuthProvider>
    </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  backButtonIcon: {
    color: '#1d4ed8',
    fontSize: 28,
    fontWeight: '400',
    marginLeft: -2,
    marginTop: -2,
  },
});
