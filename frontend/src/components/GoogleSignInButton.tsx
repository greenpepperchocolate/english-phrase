import { useEffect, useState, useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

// iOS Client ID
const IOS_CLIENT_ID = '384167074200-2llae64j272arbhca63cl815cq37o270.apps.googleusercontent.com';

// ネイティブモジュールを動的にロード（Expo Goではnull）
let GoogleSigninModule: any = null;
try {
  GoogleSigninModule = require('@react-native-google-signin/google-signin');
} catch {
  // Expo Goではネイティブモジュールが利用不可
}

interface GoogleSignInButtonProps {
  busy: boolean;
  setBusy: (busy: boolean) => void;
  signInWithGoogle: (idToken: string) => Promise<void>;
}

export default function GoogleSignInButton({
  busy,
  setBusy,
  signInWithGoogle,
}: GoogleSignInButtonProps) {
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    if (!GoogleSigninModule) return;
    try {
      GoogleSigninModule.GoogleSignin.configure({
        iosClientId: IOS_CLIENT_ID,
      });
      setIsConfigured(true);
    } catch (error) {
      console.error('Failed to configure Google Sign-In:', error);
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (!isConfigured || !GoogleSigninModule) return;

    const { GoogleSignin, isErrorWithCode, statusCodes } = GoogleSigninModule;

    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (response.type === 'success' && response.data?.idToken) {
        await signInWithGoogle(response.data.idToken);
      } else if (response.type === 'cancelled') {
        // ユーザーがキャンセル
      } else {
        Alert.alert('エラー', 'Googleログインに失敗しました。');
      }
    } catch (error: any) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            break;
          case statusCodes.IN_PROGRESS:
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert('エラー', 'Google Play Servicesが利用できません');
            break;
          default:
            console.error('Google Sign-In error:', error);
            Alert.alert('エラー', 'Googleログインに失敗しました。もう一度お試しください。');
        }
      } else {
        console.error('Google Sign-In error:', error);
        const errorDetail = error?.data?.detail || error?.data?.id_token?.[0] || error?.message || 'Googleログインに失敗しました。もう一度お試しください。';
        Alert.alert('エラー', errorDetail);
      }
    } finally {
      setBusy(false);
    }
  };

  // ネイティブモジュールが利用不可（Expo Go）または未設定の場合は非表示
  if (!GoogleSigninModule || !isConfigured) {
    return null;
  }

  return (
    <Pressable
      style={[styles.button, styles.googleButton, busy && styles.buttonDisabled]}
      onPress={handleGoogleLogin}
      disabled={busy}
    >
      <View style={styles.googleButtonContent}>
        <Text style={styles.googleIcon}>G</Text>
        <Text style={styles.googleButtonText}>Googleでログイン</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButton: {
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
