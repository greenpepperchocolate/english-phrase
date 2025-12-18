import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useMemo } from 'react';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // 使われていないキャッシュは5分後に削除（デフォルトと同じ）
      gcTime: 1000 * 60 * 5, // 5分
    },
  },
});

export function AppQueryClientProvider({ children }: PropsWithChildren) {
  const client = useMemo(() => queryClient, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}