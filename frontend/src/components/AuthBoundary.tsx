import { PropsWithChildren, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
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
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>🎓</Text>
          <Text style={styles.appName}>English Phrase</Text>
          <Text style={styles.tagline}>Master English, one phrase at a time</Text>
        </View>

        {isSignUp ? (
          <SignUpForm onSuccess={() => setIsSignUp(false)} />
        ) : (
          <SignInForm onForgotPassword={() => setShowForgotPassword(true)} />
        )}

        <View style={styles.switchContainer}>
          <Text style={styles.switchText}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </Text>
          <Pressable onPress={() => setIsSignUp(!isSignUp)}>
            <Text style={styles.switchLink}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SignInForm({ onForgotPassword }: { onForgotPassword: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn, signInAnonymously } = useAuth();

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn({ email, password });
    } catch (error: any) {
      console.error(error);
      if (error?.status === 403) {
        Alert.alert(
          'Email Not Verified',
          error?.data?.detail || 'Please verify your email address before logging in. Check your inbox for the verification email.'
        );
      } else {
        Alert.alert('Login Failed', error?.data?.detail || 'Please check your email and password.');
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
      Alert.alert('Error', 'Guest login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
        editable={!busy}
      />

      <Pressable style={styles.forgotPasswordButton} onPress={onForgotPassword} disabled={busy}>
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </Pressable>

      <Pressable
        style={[styles.button, styles.primaryButton, busy && styles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={busy}
      >
        <Text style={styles.buttonText}>{busy ? 'Signing in...' : 'Sign In'}</Text>
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        style={[styles.button, styles.secondaryButton, busy && styles.buttonDisabled]}
        onPress={handleGuestLogin}
        disabled={busy}
      >
        <Text style={styles.secondaryButtonText}>Continue as Guest</Text>
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
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }
    setBusy(true);
    try {
      const response = await signUp({ email, password, password_confirm: passwordConfirm });
      Alert.alert(
        'Check Your Email',
        `We've sent a verification link to ${response.email}. Please check your email and click the link to verify your account before logging in.`,
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
      const errorMsg = error?.data?.email?.[0] || error?.data?.password?.[0] || error?.data?.detail || 'Sign up failed. Please try again.';
      Alert.alert('Sign Up Failed', errorMsg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 6 characters)"
        placeholderTextColor="#888"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
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
        <Text style={styles.buttonText}>{busy ? 'Creating account...' : 'Sign Up'}</Text>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#888888',
  },
  formContainer: {
    gap: 16,
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
    marginTop: 32,
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
      Alert.alert('Error', 'Please enter your email address.');
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
          'Check Your Email',
          'If an account with that email exists, a password reset link has been sent. Please check your email.',
          [
            {
              text: 'OK',
              onPress: onBack,
            },
          ]
        );
      } else {
        Alert.alert('Error', data.detail || 'Failed to send reset email. Please try again.');
      }
    } catch (error) {
      console.error('Password reset request error:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.forgotIcon}>🔒</Text>
        <Text style={styles.appName}>Forgot Password?</Text>
        <Text style={styles.forgotMessage}>
          Enter your email address and we'll send you a link to reset your password.
        </Text>

        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email"
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
              <Text style={styles.buttonText}>Send Reset Link</Text>
            )}
          </Pressable>

          <Pressable style={styles.backToLoginButton} onPress={onBack} disabled={busy}>
            <Text style={styles.switchLink}>Back to Login</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
