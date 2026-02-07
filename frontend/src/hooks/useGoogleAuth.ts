// このファイルは互換性のために残しています
// Google認証の実際の実装は GoogleSignInButton.tsx にあります
// （React.lazy で遅延ロードされる）

import { useCallback, useState } from 'react';

export type GoogleAuthResult =
  | { type: 'success'; idToken: string }
  | { type: 'cancel' }
  | { type: 'error'; error: string };

// ダミー実装（実際の認証は GoogleSignInButton で行う）
export function useGoogleAuth() {
  const [isLoading] = useState(false);

  const signInWithGoogle = useCallback(async (): Promise<GoogleAuthResult> => {
    return { type: 'error', error: 'Use GoogleSignInButton component instead' };
  }, []);

  return {
    signInWithGoogle,
    isLoading,
    isReady: false,
  };
}
