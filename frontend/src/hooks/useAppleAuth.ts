import { useCallback, useState, useEffect } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

export type AppleAuthResult =
  | { type: 'success'; identityToken: string; email: string | null; fullName: string | null }
  | { type: 'cancel' }
  | { type: 'error'; error: string };

export function useAppleAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    // Apple認証はiOS 13以降でのみ利用可能
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAvailable).catch(() => {
        // エラーを無視してfalseのまま
      });
    }
  }, []);

  const signInWithApple = useCallback(async (): Promise<AppleAuthResult> => {
    if (!isAvailable) {
      return { type: 'error', error: 'Apple authentication is not available' };
    }

    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const fullName = credential.fullName
          ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
          : null;

        return {
          type: 'success',
          identityToken: credential.identityToken,
          email: credential.email,
          fullName: fullName || null,
        };
      } else {
        return { type: 'error', error: 'Failed to get identity token' };
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        return { type: 'cancel' };
      }
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable]);

  return {
    signInWithApple,
    isLoading,
    isAvailable,
  };
}
