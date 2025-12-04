import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { PhraseSummary } from '../api/types';
import { useMemo } from 'react';

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

  // アプリ起動時にランダムシードを生成
  const randomSeed = useMemo(() => Math.floor(Math.random() * 1000000), []);

  return useInfiniteQuery<FavoritesResponse, Error>({
    queryKey: ['favorites', randomSeed],
    queryFn: ({ pageParam }) => {
      const search = new URLSearchParams({ limit: '20' });
      if (pageParam && pageParam !== 1) {
        search.set('page', String(pageParam));
      }
      // ランダムシードを追加
      search.set('seed', String(randomSeed));
      const url = `/favorites?${search.toString()}`;
      return authorizedFetch<FavoritesResponse>(url);
    },
    getNextPageParam: (lastPage) => extractPageNumber(lastPage.next),
    initialPageParam: 1,
  });
}