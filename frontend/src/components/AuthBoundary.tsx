import { PropsWithChildren, useState } from 'react';
import { Alert, Button, SafeAreaView, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { useAuth } from '../providers/AuthProvider';

export function AuthBoundary({ children }: PropsWithChildren) {
  const { tokens, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!tokens) {
    return <SignInScreen />;
  }

  return <>{children}</>;
}

function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn, signInAnonymously } = useAuth();

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn({ email, password });
    } catch (error) {
      console.error(error);
      Alert.alert('Login failed', 'Please check your email and password.');
    } finally {
      setBusy(false);
    }
  };

  const handleAnonymous = async () => {
    setBusy(true);
    try {
      await signInAnonymously();
    } catch (error) {
      Alert.alert('Guest login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>English Phrase Tutor</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          secureTextEntry
          onChangeText={setPassword}
        />
        <Button title={busy ? 'Sending...' : 'Sign in'} onPress={handleEmailLogin} disabled={busy} />
        <View style={styles.divider} />
        <Button title="Continue as guest" onPress={handleAnonymous} disabled={busy} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#edf2f4',
  },
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    rowGap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f3f5',
    marginVertical: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
