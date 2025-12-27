import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { PhraseSummary } from '../api/types';

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

  // ランダムシードを生成
  const randomSeed = useMemo(() => Math.floor(Math.random() * 1000000), []);

  return useInfiniteQuery<SearchResponse, Error>({
    queryKey: ['search', query, randomSeed],
    queryFn: ({ pageParam }) => {
      const search = new URLSearchParams({
        limit: String(pageSize),
        search: query,
      });
      if (pageParam && pageParam !== 1) {
        search.set('page', String(pageParam));
      }
      search.set('seed', String(randomSeed));
      const url = `/feed?${search.toString()}`;
      return authorizedFetch<SearchResponse>(url);
    },
    getNextPageParam: (lastPage) => extractPageNumber(lastPage.next),
    initialPageParam: 1,
    enabled: query.length > 0, // 検索クエリがある場合のみ実行
    // メモリ管理: FlatListのremoveClippedSubviewsとwindowSizeで最適化済み
    // maxPagesは設定しない（戻るスクロールを可能にするため）

    // React Query設定: 1000回スワイプでもエラーが出ないように最適化
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
    retryOnMount: false,
    throwOnError: false,
    networkMode: 'offlineFirst',
  });
}
