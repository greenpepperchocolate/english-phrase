import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../src/utils/config';

const TOKEN_KEY = 'eitangoTokens';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams();
  const token = typeof params.token === 'string' ? params.token : params.token?.[0];
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('無効な認証リンクです。トークンが提供されていません。');
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
          // 自動ログイン: トークンが返された場合は保存
          if (data.access_token && data.refresh_token) {
            const tokens = {
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              anonymous: false,
              expiresAt: Date.now() + data.expires_in * 1000,
            };
            await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
            setIsLoggedIn(true);
          }
          setStatus('success');
          setMessage(data.message || 'メールアドレスの認証が完了しました！');
        } else {
          setStatus('error');
          setMessage(data.detail || '認証に失敗しました。もう一度お試しください。');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage('ネットワークエラーが発生しました。接続をご確認の上、もう一度お試しください。');
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
            <ActivityIndicator size="large" color="#F08CA6" />
            <Text style={styles.title}>メールアドレスを認証中...</Text>
            <Text style={styles.message}>メールアドレスの認証を行っています。しばらくお待ちください。</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Text style={styles.icon}>✅</Text>
            <Text style={styles.title}>メール認証完了！</Text>
            <Text style={styles.message}>{message}</Text>
            <Text style={styles.subMessage}>
              {isLoggedIn ? '自動的にログインしました。' : 'アカウントにログインできるようになりました。'}
            </Text>
            <Pressable style={styles.button} onPress={handleContinue}>
              <Text style={styles.buttonText}>{isLoggedIn ? 'アプリを開始' : 'ログインへ進む'}</Text>
            </Pressable>
          </>
        )}

        {status === 'error' && (
          <>
            <Text style={styles.icon}>❌</Text>
            <Text style={styles.title}>認証失敗</Text>
            <Text style={styles.message}>{message}</Text>
            <Pressable style={styles.button} onPress={handleContinue}>
              <Text style={styles.buttonText}>ログインに戻る</Text>
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
    backgroundColor: '#F08CA6',
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
