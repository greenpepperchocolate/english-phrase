import { PropsWithChildren, useState } from 'react';
import { Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { API_BASE_URL } from '../utils/config';

export function AuthBoundary({ children }: PropsWithChildren) {
  const { tokens, isBootstrapping } = useAuth();
  const pathname = usePathname();

  // Allow access to verify-email, forgot-password, and reset-password without authentication
  const publicRoutes = ['/verify-email', '/forgot-password', '/reset-password'];
  const isPublicRoute = publicRoutes.includes(pathname);

  if (isBootstrapping) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#ffffff" size="large" />
      </SafeAreaView>
    );
  }

  if (!tokens && !isPublicRoute) {
    return <AuthScreen />;
  }

  return <>{children}</>;
}

function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  if (showForgotPassword) {
    return <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image
              source={require('../../assets/イメタンロゴ.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>映像で覚える英単語アプリ</Text>
          </View>

          {isSignUp ? (
            <SignUpForm onSuccess={() => setIsSignUp(false)} />
          ) : (
            <SignInForm onForgotPassword={() => setShowForgotPassword(true)} />
          )}

          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>
              {isSignUp ? 'すでにアカウントをお持ちですか？' : 'アカウントを作成する'}
            </Text>
            <Pressable onPress={() => setIsSignUp(!isSignUp)}>
              <Text style={styles.switchLink}>{isSignUp ? 'ログイン' : '新規登録'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SignInForm({ onForgotPassword }: { onForgotPassword: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn, signInAnonymously } = useAuth();

  const handleSignIn = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Alert.alert('エラー', 'メールアドレスとパスワードを入力してください。');
      return;
    }
    // メール形式の簡易チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('エラー', '有効なメールアドレスを入力してください。');
      return;
    }
    setBusy(true);
    try {
      await signIn({ email: trimmedEmail, password });
    } catch (error: any) {
      console.error(error);
      if (error?.status === 403) {
        Alert.alert(
          'メール未認証',
          error?.data?.detail || 'ログインする前にメールアドレスを認証してください。受信トレイで認証メールをご確認ください。'
        );
      } else {
        Alert.alert('ログイン失敗', error?.data?.detail || 'メールアドレスとパスワードをご確認ください。');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGuestLogin = async () => {
    setBusy(true);
    try {
      await signInAnonymously();
    } catch (error) {
      Alert.alert('エラー', 'ゲストログインに失敗しました。もう一度お試しください。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      <TextInput
        style={styles.input}
        placeholder="メールアドレス"
        placeholderTextColor="#888"
        value={email}
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        placeholder="パスワード"
        placeholderTextColor="#888"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
        editable={!busy}
      />

      <Pressable style={styles.forgotPasswordButton} onPress={onForgotPassword} disabled={busy}>
        <Text style={styles.forgotPasswordText}>パスワードをお忘れですか？</Text>
      </Pressable>

      <Pressable
        style={[styles.button, styles.primaryButton, busy && styles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={busy}
      >
        <Text style={styles.buttonText}>{busy ? 'ログイン中...' : 'ログイン'}</Text>
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>または</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        style={[styles.button, styles.secondaryButton, busy && styles.buttonDisabled]}
        onPress={handleGuestLogin}
        disabled={busy}
      >
        <Text style={styles.secondaryButtonText}>ゲストとして続ける</Text>
      </Pressable>
    </View>
  );
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const { signUp } = useAuth();

  const handleSignUp = async () => {
    if (!email || !password || !passwordConfirm) {
      Alert.alert('エラー', '全ての項目を入力してください。');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('エラー', 'パスワードが一致しません。');
      return;
    }
    if (password.length < 6) {
      Alert.alert('エラー', 'パスワードは6文字以上で入力してください。');
      return;
    }
    setBusy(true);
    try {
      const response = await signUp({ email, password, password_confirm: passwordConfirm });
      Alert.alert(
        'メールをご確認ください',
        `${response.email}に認証リンクを送信しました。ログインする前にメールを確認してリンクをクリックしてアカウントを認証してください。`,
        [
          {
            text: 'OK',
            onPress: () => {
              setEmail('');
              setPassword('');
              setPasswordConfirm('');
              onSuccess();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error(error);
      const errorMsg = error?.data?.email?.[0] || error?.data?.password?.[0] || error?.data?.detail || '新規登録に失敗しました。もう一度お試しください。';
      Alert.alert('新規登録失敗', errorMsg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      <TextInput
        style={styles.input}
        placeholder="メールアドレス"
        placeholderTextColor="#888"
        value={email}
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        placeholder="パスワード（6文字以上）"
        placeholderTextColor="#888"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        placeholder="パスワード（確認）"
        placeholderTextColor="#888"
        value={passwordConfirm}
        secureTextEntry
        onChangeText={setPasswordConfirm}
        editable={!busy}
      />

      <Pressable
        style={[styles.button, styles.primaryButton, busy && styles.buttonDisabled]}
        onPress={handleSignUp}
        disabled={busy}
      >
        <Text style={styles.buttonText}>{busy ? 'アカウント作成中...' : '新規登録'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  tagline: {
    fontSize: 13,
    color: '#888888',
  },
  formContainer: {
    gap: 14,
    marginBottom: 8,
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
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#1d4ed8',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1d4ed8',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333333',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#888888',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
    gap: 8,
  },
  switchText: {
    fontSize: 14,
    color: '#888888',
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#1d4ed8',
  },
  forgotIcon: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 16,
  },
  forgotMessage: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 32,
  },
  backToLoginButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
});

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      Alert.alert('エラー', 'メールアドレスを入力してください。');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/password-reset/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'メールをご確認ください',
          'そのメールアドレスのアカウントが存在する場合、パスワードリセットリンクが送信されました。メールをご確認ください。',
          [
            {
              text: 'OK',
              onPress: onBack,
            },
          ]
        );
      } else {
        Alert.alert('エラー', data.detail || 'リセットメールの送信に失敗しました。もう一度お試しください。');
      }
    } catch (error) {
      console.error('Password reset request error:', error);
      Alert.alert('エラー', 'ネットワークエラーが発生しました。接続をご確認の上、もう一度お試しください。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.forgotIcon}>🔒</Text>
          <Text style={styles.appName}>パスワードをお忘れですか？</Text>
          <Text style={styles.forgotMessage}>
            メールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
          </Text>

          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="メールアドレス"
              placeholderTextColor="#888"
              value={email}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
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
                <Text style={styles.buttonText}>リセットリンクを送信</Text>
              )}
            </Pressable>

            <Pressable style={styles.backToLoginButton} onPress={onBack} disabled={busy}>
              <Text style={styles.switchLink}>ログインに戻る</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
