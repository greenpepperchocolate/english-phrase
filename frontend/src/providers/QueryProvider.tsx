import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useMemo } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function AppQueryClientProvider({ children }: PropsWithChildren) {
  const client = useMemo(() => queryClient, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}