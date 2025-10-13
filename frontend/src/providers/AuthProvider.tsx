import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../utils/config';

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  anonymous: boolean;
  expiresAt: number;
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
  isBootstrapping: boolean;
  signUp: (payload: SignUpPayload) => Promise<SignUpResponse>;
  signIn: (payload: LoginPayload) => Promise<void>;
  signInAnonymously: (deviceId?: string) => Promise<void>;
  signOut: () => Promise<void>;
  authorizedFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const TOKEN_KEY = 'englishPhraseTokens';

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  console.log('📡 Fetching:', url);

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    console.log('📥 Response status:', res.status);

    if (!res.ok) {
      let data: unknown = null;
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch (error) {
        data = text;
      }
      console.error('❌ Request failed:', res.status, data);
      throw new ApiError(res.statusText || 'Request failed', res.status, data);
    }

    if (res.status === 204) {
      return null as T;
    }

    return res.json() as Promise<T>;
  } catch (error) {
    console.error('❌ Network error:', error);
    throw error;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
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
  }, []);

  const persistTokens = useCallback(async (next: AuthTokens | null) => {
    setTokens(next);
    if (next) {
      await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(next));
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  }, []);

  const refreshTokens = useCallback(async () => {
    if (!tokens || refreshing) {
      return tokens;
    }
    if (tokens.expiresAt > Date.now() + 30_000) {
      return tokens;
    }
    setRefreshing(true);
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
    } finally {
      setRefreshing(false);
    }
  }, [persistTokens, refreshing, tokens]);

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
      const next = hydrateTokens(data);
      await persistTokens(next);
    },
    [persistTokens]
  );

  const signInAnonymously = useCallback(
    async (deviceId?: string) => {
      console.log('🚀 Attempting anonymous login to:', `${API_BASE_URL}/auth/anonymous`);
      const data = await fetchJson<{ access_token: string; refresh_token: string; expires_in: number; anonymous: boolean }>(
        '/auth/anonymous',
        {
          method: 'POST',
          body: JSON.stringify({ device_id: deviceId }),
        }
      );
      console.log('✅ Anonymous login successful');
      const next = hydrateTokens(data);
      await persistTokens(next);
    },
    [persistTokens]
  );

  const signOut = useCallback(async () => {
    await persistTokens(null);
  }, [persistTokens]);

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
        if (error instanceof ApiError && error.status === 401) {
          const refreshed = await refreshTokens();
          if (!refreshed) {
            throw error;
          }
          return doFetch(refreshed.accessToken);
        }
        throw error;
      }
    },
    [refreshTokens, tokens]
  );

  const value = useMemo(
    () => ({ tokens, isBootstrapping, signUp, signIn, signInAnonymously, signOut, authorizedFetch }),
    [authorizedFetch, isBootstrapping, signUp, signIn, signInAnonymously, signOut, tokens]
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
