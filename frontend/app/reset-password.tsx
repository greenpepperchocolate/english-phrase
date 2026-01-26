import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API_BASE_URL } from '../src/utils/config';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const token = typeof params.token === 'string' ? params.token : params.token?.[0];
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      Alert.alert('エラー', '無効なパスワードリセットリンクです。', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    }
  }, [token]);

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('エラー', '全ての項目を入力してください。');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('エラー', 'パスワードが一致しません。');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('エラー', 'パスワードは6文字以上で入力してください。');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/password-reset/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'パスワードリセット完了',
          'パスワードのリセットが完了しました。新しいパスワードでログインできます。',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/'),
            },
          ]
        );
      } else {
        Alert.alert('エラー', data.detail || 'パスワードのリセットに失敗しました。もう一度お試しいただくか、新しいリセットリンクをリクエストしてください。');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      Alert.alert('エラー', 'ネットワークエラーが発生しました。接続をご確認の上、もう一度お試しください。');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.icon}>🔑</Text>
          <Text style={styles.title}>パスワードリセット</Text>
          <Text style={styles.message}>新しいパスワードを入力してください。</Text>

          <TextInput
            style={styles.input}
            placeholder="新しいパスワード（6文字以上）"
            placeholderTextColor="#888"
            value={newPassword}
            secureTextEntry
            onChangeText={setNewPassword}
            editable={!busy}
          />

          <TextInput
            style={styles.input}
            placeholder="新しいパスワード（確認）"
            placeholderTextColor="#888"
            value={confirmPassword}
            secureTextEntry
            onChangeText={setConfirmPassword}
            editable={!busy}
          />

          <Pressable
            style={[styles.button, styles.primaryButton, busy && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>パスワードをリセット</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  icon: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#F08CA6',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
