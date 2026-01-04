import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { PhraseSummary } from '../api/types';
import { useMemo } from 'react';

// スライディングウィンドウ設定
const MAX_PAGES = 10; // 10ページ（200アイテム）をメモリに保持
const PAGE_SIZE = 20;

// セッション内でランダムシードを永続化
let sessionFavoritesSeed: number | null = null;

function getSessionFavoritesSeed(): number {
  if (sessionFavoritesSeed === null) {
    sessionFavoritesSeed = Math.floor(Math.random() * 1000000);
  }
  return sessionFavoritesSeed;
}

type FavoritesResponse = {
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

export function useFavorites() {
  const { authorizedFetch } = useAuth();

  // セッション内で一貫したランダムシードを使用
  const randomSeed = useMemo(() => getSessionFavoritesSeed(), []);

  const query = useInfiniteQuery<FavoritesResponse, Error>({
    queryKey: ['favorites', randomSeed],
    queryFn: async ({ pageParam }) => {
      const search = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam && pageParam !== 1) {
        search.set('page', String(pageParam));
      }
      // ランダムシードを追加
      search.set('seed', String(randomSeed));
      const url = `/favorites?${search.toString()}`;

      try {
        return await authorizedFetch<FavoritesResponse>(url);
      } catch (error) {
        // AbortErrorは静かに処理（キャッシュを使用）
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[useFavorites] Request aborted, using cached data');
          throw error;
        }
        throw error;
      }
    },
    getNextPageParam: (lastPage) => extractPageNumber(lastPage.next),
    initialPageParam: 1,

    // メモリ管理: スライディングウィンドウ方式
    maxPages: MAX_PAGES,

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

  // 破棄されたアイテム数を計算
  const itemOffset = useMemo(() => {
    if (!query.data?.pageParams || query.data.pageParams.length === 0) return 0;
    const firstPageNum = query.data.pageParams[0] as number;
    return (firstPageNum - 1) * PAGE_SIZE;
  }, [query.data?.pageParams]);

  return {
    ...query,
    itemOffset,
  };
}