import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { PhraseSummary } from '../api/types';

// セッション内でランダムシードを永続化
let sessionSearchSeed: number | null = null;

function getSessionSearchSeed(): number {
  if (sessionSearchSeed === null) {
    sessionSearchSeed = Math.floor(Math.random() * 1000000);
  }
  return sessionSearchSeed;
}

type SearchResponse = {
  results: PhraseSummary[];
  next: string | null;
  previous: string | null;
};

function extractPageNumber(next: string | null): number | undefined {
  if (!next) {
    return undefined;
  }
  try {
    const url = new URL(next);
    const page = url.searchParams.get('page');
    return page ? parseInt(page, 10) : undefined;
  } catch (error) {
    const match = next.match(/page=(\d+)/);
    return match?.[1] ? parseInt(match[1], 10) : undefined;
  }
}

interface UseSearchOptions {
  query: string;
  pageSize?: number;
}

export function useSearch({ query, pageSize = 20 }: UseSearchOptions) {
  const { authorizedFetch } = useAuth();

  // セッション内で一貫したランダムシードを使用
  const randomSeed = useMemo(() => getSessionSearchSeed(), []);

  return useInfiniteQuery<SearchResponse, Error>({
    queryKey: ['search', query, randomSeed],
    queryFn: async ({ pageParam }) => {
      const search = new URLSearchParams({
        limit: String(pageSize),
        search: query,
      });
      if (pageParam && pageParam !== 1) {
        search.set('page', String(pageParam));
      }
      search.set('seed', String(randomSeed));
      const url = `/feed?${search.toString()}`;

      try {
        return await authorizedFetch<SearchResponse>(url);
      } catch (error) {
        // AbortErrorは静かに処理（キャッシュを使用）
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[useSearch] Request aborted, using cached data');
          throw error;
        }
        throw error;
      }
    },
    getNextPageParam: (lastPage) => extractPageNumber(lastPage.next),
    initialPageParam: 1,
    enabled: query.length > 0, // 検索クエリがある場合のみ実行
    // メモリ管理: 10000回スワイプ対応
    // maxPagesは設定しない（インデックスずれ防止）

    // React Query設定: 10000回スワイプでもエラーが出ないように最適化
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: (failureCount, error) => {
      // AbortErrorはリトライしない
      if (error instanceof Error && error.name === 'AbortError') return false;
      if (failureCount >= 3) return false;
      // ネットワークエラーの場合のみリトライ
      if (error && 'isNetworkError' in error && error.isNetworkError) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    retryOnMount: false,
    throwOnError: false,
    networkMode: 'offlineFirst',
  });
}
