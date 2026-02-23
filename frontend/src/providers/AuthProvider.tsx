import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { QueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../utils/config';
import { resetAllSeeds } from '../hooks/useFeedSeed';

// ネットワークエラーアラートの重複表示を防ぐためのフラグ
let isNetworkAlertShowing = false;

function showNetworkErrorAlert() {
  if (isNetworkAlertShowing) return;
  isNetworkAlertShowing = true;
  Alert.alert(
    '接続エラー',
    'ネットワークが不安定です',
    [
      {
        text: 'OK',
        onPress: () => {
          isNetworkAlertShowing = false;
        },
      },
    ],
    { onDismiss: () => { isNetworkAlertShowing = false; } }
  );
}

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  anonymous: boolean;
  expiresAt: number;
  userEmail?: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type SignUpPayload = {
  email: string;
  password: string;
  password_confirm: string;
};

type SignUpResponse = {
  message: string;
  email: string;
};

type AuthContextValue = {
  tokens: AuthTokens | null;
  userEmail: string | null;
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  signUp: (payload: SignUpPayload) => Promise<SignUpResponse>;
  signIn: (payload: LoginPayload) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithApple: (identityToken: string) => Promise<void>;
  signInAnonymously: (deviceId?: string) => Promise<void>;
  signInWithTokenData: (data: { access_token: string; refresh_token: string; expires_in: number }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  authorizedFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const TOKEN_KEY = 'eitangoTokens';

class ApiError extends Error {
  status: number;
  data: unknown;
  isNetworkError: boolean;

  constructor(message: string, status: number, data: unknown, isNetworkError = false) {
    super(message);
    this.status = status;
    this.data = data;
    this.isNetworkError = isNetworkError;
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchJson<T>(path: string, init?: RequestInit, timeoutMs = 60000): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  if (__DEV__) {
    console.log('📡 Fetching:', url);
  }

  try {
    // タイムアウト処理（デフォルト60秒、メール送信などの重い処理に対応）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (__DEV__) {
      console.log('📥 Response status:', res.status);
    }

    if (!res.ok) {
      let data: unknown = null;
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch (error) {
        data = text;
      }
      console.error('❌ Request failed:', res.status, data);
      throw new ApiError(res.statusText || 'Request failed', res.status, data, false);
    }

    if (res.status === 204) {
      return null as T;
    }

    return res.json() as Promise<T>;
  } catch (error) {
    console.error('❌ Network error:', error);

    // ネットワークエラーの場合、ApiErrorでラップする
    if (error instanceof ApiError) {
      // 本番ビルドではSentryが自動的にエラーを収集
      throw error;
    }

    // AbortError（タイムアウト）の場合
    if (error instanceof Error && error.name === 'AbortError') {
      showNetworkErrorAlert();
      const timeoutError = new ApiError(
        'リクエストがタイムアウトしました。ネットワーク接続を確認してください。',
        0,
        null,
        true
      );
      throw timeoutError;
    }

    // TypeError（ネットワーク切断、タイムアウトなど）の場合
    if (error instanceof TypeError) {
      showNetworkErrorAlert();
      const message = error.message || '';
      // タイムアウトの場合
      if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('timed out')) {
        const timeoutError = new ApiError(
          'サーバーへの接続がタイムアウトしました。しばらく待ってから再試行してください。',
          0,
          null,
          true
        );
        throw timeoutError;
      }
      const networkError = new ApiError('ネットワークに接続できません', 0, null, true);
      throw networkError;
    }

    // その他のエラー
    showNetworkErrorAlert();
    const unknownError = new ApiError(
      error instanceof Error ? error.message : 'Unknown error',
      0,
      null,
      true
    );
    throw unknownError;
  }
}

function hydrateTokens(data: { access_token: string; refresh_token: string; expires_in: number; anonymous: boolean }): AuthTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    anonymous: data.anonymous,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export function AuthProvider({ children, queryClient }: { children: ReactNode; queryClient?: QueryClient }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const refreshPromiseRef = useRef<Promise<AuthTokens | null> | null>(null);

  useEffect(() => {
    (async () => {
      // アプリ起動時にフィードのシードとキャッシュをリセット（毎回新しいランダム順序）
      resetAllSeeds();
      queryClient?.clear();

      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (stored) {
          const parsed: AuthTokens = JSON.parse(stored);
          setTokens(parsed);
        }
      } catch (error) {
        console.warn('Failed to load auth tokens', error);
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, [queryClient]);

  // バックグラウンドからフォアグラウンドに復帰したときにシードをリセット
  // 短時間の離脱（通知確認等）ではリセットしない（5分以上で発動）
  const backgroundTimestampRef = useRef<number | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        backgroundTimestampRef.current = Date.now();
      } else if (nextState === 'active' && backgroundTimestampRef.current) {
        const elapsed = Date.now() - backgroundTimestampRef.current;
        backgroundTimestampRef.current = null;
        if (elapsed >= 5 * 60 * 1000) {
          resetAllSeeds();
          queryClient?.removeQueries({ queryKey: ['feed'] });
          queryClient?.removeQueries({ queryKey: ['favorites'] });
        }
      }
    });
    return () => subscription.remove();
  }, [queryClient]);

  const persistTokens = useCallback(async (next: AuthTokens | null) => {
    setTokens(next);
    if (next) {
      await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(next));
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  }, []);

  const refreshTokens = useCallback(async () => {
    if (!tokens) {
      return tokens;
    }
    if (tokens.expiresAt > Date.now() + 30_000) {
      return tokens;
    }

    // 既にリフレッシュ中の場合、同じPromiseを返す（競合制御）
    if (refreshPromiseRef.current !== null) {
      return refreshPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const data = await fetchJson<{ access_token: string; refresh_token: string; expires_in: number }>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: tokens.refreshToken }),
        });
        const next: AuthTokens = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? tokens.refreshToken,
          anonymous: tokens.anonymous,
          expiresAt: Date.now() + data.expires_in * 1000,
        };
        await persistTokens(next);
        return next;
      } catch (error) {
        await persistTokens(null);
        throw error;
      }
    })();

    // Promiseをキャッシュ
    refreshPromiseRef.current = promise;

    try {
      return await promise;
    } finally {
      // 完了後、キャッシュをクリア
      refreshPromiseRef.current = null;
    }
  }, [persistTokens, tokens]);

  const signUp = useCallback(async ({ email, password, password_confirm }: SignUpPayload): Promise<SignUpResponse> => {
    const data = await fetchJson<SignUpResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, password_confirm }),
    });
    return data;
  }, []);

  const signIn = useCallback(
    async ({ email, password }: LoginPayload) => {
      const data = await fetchJson<{ access_token: string; refresh_token: string; expires_in: number; anonymous: boolean }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      );
      const next = { ...hydrateTokens(data), userEmail: email };
      await persistTokens(next);
      // ログイン時にフィードのシードとキャッシュをリセット（新しいランダム順序）
      resetAllSeeds();
      queryClient?.clear();
    },
    [persistTokens, queryClient]
  );

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      const data = await fetchJson<{ access_token: string; refresh_token: string; expires_in: number; anonymous: boolean }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ provider: 'google', id_token: idToken }),
        }
      );
      const next = hydrateTokens(data);
      await persistTokens(next);
      // Googleログイン時にフィードのシードとキャッシュをリセット（新しいランダム順序）
      resetAllSeeds();
      queryClient?.clear();
    },
    [persistTokens, queryClient]
  );

  const signInWithApple = useCallback(
    async (identityToken: string) => {
      const data = await fetchJson<{ access_token: string; refresh_token: string; expires_in: number; anonymous: boolean }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ provider: 'apple', id_token: identityToken }),
        }
      );
      const next = hydrateTokens(data);
      await persistTokens(next);
      // Appleログイン時にフィードのシードとキャッシュをリセット（新しいランダム順序）
      resetAllSeeds();
      queryClient?.clear();
    },
    [persistTokens, queryClient]
  );

  const signInAnonymously = useCallback(
    async (deviceId?: string) => {
      if (__DEV__) {
        console.log('🚀 Attempting anonymous login to:', `${API_BASE_URL}/auth/anonymous`);
      }
      const data = await fetchJson<{ access_token: string; refresh_token: string; expires_in: number; anonymous: boolean }>(
        '/auth/anonymous',
        {
          method: 'POST',
          body: JSON.stringify({ device_id: deviceId }),
        }
      );
      if (__DEV__) {
        console.log('✅ Anonymous login successful');
      }
      const next = hydrateTokens(data);
      await persistTokens(next);
      // ゲストログイン時にフィードのシードとキャッシュをリセット（新しいランダム順序）
      resetAllSeeds();
      queryClient?.clear();
    },
    [persistTokens, queryClient]
  );

  const signInWithTokenData = useCallback(
    async (data: { access_token: string; refresh_token: string; expires_in: number }) => {
      const next = hydrateTokens({ ...data, anonymous: false });
      await persistTokens(next);
      resetAllSeeds();
      queryClient?.clear();
    },
    [persistTokens, queryClient]
  );

  const signOut = useCallback(async () => {
    await persistTokens(null);
    // ログアウト時にReact Queryのキャッシュをクリア
    queryClient?.clear();
    // ログアウト時にフィードのシードをリセット（次回ログイン時に新しいランダム順序）
    resetAllSeeds();
  }, [persistTokens, queryClient]);

  const deleteAccount = useCallback(async () => {
    if (!tokens) {
      throw new Error('Not authenticated');
    }

    // アカウント削除APIを呼び出し
    await fetchJson('/auth/delete-account', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    // 削除成功後、ローカルのトークンをクリア
    await persistTokens(null);
    // アカウント削除時にReact Queryのキャッシュをクリア
    queryClient?.clear();
    // アカウント削除時にフィードのシードをリセット
    resetAllSeeds();
  }, [persistTokens, tokens, queryClient]);

  const authorizedFetch = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      let activeTokens = tokens;
      if (!activeTokens) {
        throw new Error('Not authenticated');
      }
      if (activeTokens.expiresAt <= Date.now() + 30_000) {
        activeTokens = await refreshTokens();
        if (!activeTokens) {
          throw new Error('Session expired');
        }
      }
      const doFetch = (accessToken: string) =>
        fetchJson<T>(path, {
          ...init,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(init?.headers ?? {}),
          },
        });

      try {
        return await doFetch(activeTokens.accessToken);
      } catch (error) {
        // 401 Unauthorized または 400 Bad Request（Token is expired）の場合、トークンをリフレッシュしてリトライ
        if (error instanceof ApiError && (error.status === 401 || error.status === 400)) {
          const refreshed = await refreshTokens();
          if (!refreshed) {
            await persistTokens(null);
            throw error;
          }
          try {
            return await doFetch(refreshed.accessToken);
          } catch (retryError) {
            // リフレッシュ後も401なら、アカウント削除やトークン無効化 → 強制ログアウト
            if (retryError instanceof ApiError && retryError.status === 401) {
              await persistTokens(null);
            }
            throw retryError;
          }
        }
        throw error;
      }
    },
    [refreshTokens, tokens]
  );

  const value = useMemo(
    () => ({
      tokens,
      userEmail: tokens?.userEmail ?? null,
      isBootstrapping,
      isAuthenticated: !!tokens,
      signUp,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signInAnonymously,
      signInWithTokenData,
      signOut,
      deleteAccount,
      authorizedFetch
    }),
    [authorizedFetch, isBootstrapping, signUp, signIn, signInWithGoogle, signInWithApple, signInAnonymously, signInWithTokenData, signOut, deleteAccount, tokens]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
