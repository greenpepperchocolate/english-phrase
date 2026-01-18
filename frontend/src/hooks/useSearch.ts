import { useInfiniteQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { PhraseSummary } from '../api/types';
import { useFeedSeed } from './useFeedSeed';

// Android: メモリ制限が厳しいため短いキャッシュ時間
const GC_TIME = Platform.OS === 'android' ? 90 * 1000 : 3 * 60 * 1000;
const STALE_TIME = Platform.OS === 'android' ? 60 * 1000 : 3 * 60 * 1000;

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

  // セッションごとのランダムシードを使用（検索は"all"として扱う）
  const { seed: randomSeed, isLoading: isSeedLoading } = useFeedSeed();

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
    enabled: query.length > 0 && !isSeedLoading && randomSeed !== null,

    // メモリ管理: maxPagesは使用しない（FlatListのremoveClippedSubviewsで管理）

    // React Query設定: プラットフォーム別にキャッシュ時間を調整
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.name === 'AbortError') return false;
      if (failureCount >= 3) return false;
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
