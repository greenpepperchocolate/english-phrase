import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/providers/AuthProvider';
import { AppQueryClientProvider } from '../src/providers/QueryProvider';
import { AuthBoundary } from '../src/components/AuthBoundary';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppQueryClientProvider>
        <AuthBoundary>
          <StatusBar style="auto" />
          <Stack>
            <Stack.Screen
              name="index"
              options={{
                title: 'English-Now',
                headerStyle: {
                  backgroundColor: '#1d4ed8',
                },
                headerTintColor: '#ffffff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Stack.Screen name="phrase/[id]" options={{ title: '' }} />
            <Stack.Screen
              name="favorites"
              options={{
                title: 'favorites',
                headerStyle: {
                  backgroundColor: '#1d4ed8',
                },
                headerTintColor: '#ffffff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
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