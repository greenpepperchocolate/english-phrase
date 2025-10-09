import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API_BASE_URL } from '../src/utils/config';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams();
  const token = typeof params.token === 'string' ? params.token : params.token?.[0];
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.detail || 'Verification failed. Please try again.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage('Network error. Please check your connection and try again.');
      }
    };

    verifyEmail();
  }, [token]);

  const handleContinue = () => {
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {status === 'verifying' && (
          <>
            <ActivityIndicator size="large" color="#1d4ed8" />
            <Text style={styles.title}>Verifying Your Email...</Text>
            <Text style={styles.message}>Please wait while we verify your email address.</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Text style={styles.icon}>✅</Text>
            <Text style={styles.title}>Email Verified!</Text>
            <Text style={styles.message}>{message}</Text>
            <Text style={styles.subMessage}>You can now sign in to your account.</Text>
            <Pressable style={styles.button} onPress={handleContinue}>
              <Text style={styles.buttonText}>Continue to Login</Text>
            </Pressable>
          </>
        )}

        {status === 'error' && (
          <>
            <Text style={styles.icon}>❌</Text>
            <Text style={styles.title}>Verification Failed</Text>
            <Text style={styles.message}>{message}</Text>
            <Pressable style={styles.button} onPress={handleContinue}>
              <Text style={styles.buttonText}>Back to Login</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 8,
  },
  subMessage: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
