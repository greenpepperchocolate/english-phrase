import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/providers/AuthProvider';
import { AppQueryClientProvider } from '../src/providers/QueryProvider';
import { AuthBoundary } from '../src/components/AuthBoundary';

// Sentryの初期化は本番ビルド時のみ
// 開発環境では依存関係の問題を避けるため無効化
// 本番ビルドを作成する際は、app.config.jsでSentryプラグインを設定してください
// 詳細: https://docs.sentry.io/platforms/react-native/

export default function RootLayout() {
  useEffect(() => {
    if (__DEV__) {
      console.log('🔧 Development mode: Error tracking is disabled');
    }
  }, []);
  return (
    <AuthProvider>
      <AppQueryClientProvider>
        <AuthBoundary>
          <StatusBar style="auto" />
          <Stack>
            <Stack.Screen
              name="index"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen name="phrase/[id]" options={{ title: '' }} />
            <Stack.Screen
              name="favorites"
              options={{
                title: 'Keep',
                headerStyle: {
                  backgroundColor: '#1d4ed8',
                },
                headerTintColor: '#ffffff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Stack.Screen
              name="search"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen name="settings" options={{ title: '設定' }} />
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
          </Stack>
        </AuthBoundary>
      </AppQueryClientProvider>
    </AuthProvider>
  );
}