import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { CursorPaginatedResponse, PhraseSummary } from '../api/types';
import { useMemo } from 'react';

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

export function useFeed(params: { topic?: string; difficulty?: string; pageSize?: number }) {
  const { authorizedFetch } = useAuth();

  // アプリ起動時にランダムシードを生成（このhookがマウントされるたびに1回だけ）
  const randomSeed = useMemo(() => Math.floor(Math.random() * 1000000), []);

  return useInfiniteQuery<CursorPaginatedResponse<PhraseSummary>, Error>({
    queryKey: ['feed', params.topic, params.difficulty, params.pageSize, randomSeed],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const search = new URLSearchParams();
      if (params.pageSize) {
        search.set('limit', String(params.pageSize));
      }
      if (params.topic) {
        search.set('topic', params.topic);
      }
      if (params.difficulty) {
        search.set('difficulty', params.difficulty);
      }
      if (pageParam && pageParam !== 1) {
        search.set('page', String(pageParam));
      }
      // ランダムシードを追加
      search.set('seed', String(randomSeed));
      const query = search.toString();
      const path = query ? `/feed?${query}` : '/feed';
      return authorizedFetch<CursorPaginatedResponse<PhraseSummary>>(path);
    },
    getNextPageParam: (lastPage) => extractPageNumber(lastPage.next),
  });
}