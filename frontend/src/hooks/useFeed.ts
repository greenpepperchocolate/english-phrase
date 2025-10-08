import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { CursorPaginatedResponse, PhraseSummary } from '../api/types';

function extractCursor(next: string | null): string | undefined {
  if (!next) {
    return undefined;
  }
  try {
    const url = new URL(next);
    return url.searchParams.get('cursor') ?? undefined;
  } catch (error) {
    const match = next.match(/cursor=([^&]+)/);
    return match?.[1];
  }
}

export function useFeed(params: { topic?: string; difficulty?: string; pageSize?: number }) {
  const { authorizedFetch } = useAuth();

  return useInfiniteQuery<CursorPaginatedResponse<PhraseSummary>, Error>({
    queryKey: ['feed', params.topic, params.difficulty, params.pageSize],
    initialPageParam: undefined as string | undefined,
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
      if (pageParam) {
        search.set('cursor', pageParam);
      }
      const query = search.toString();
      const path = query ? `/feed?${query}` : '/feed';
      return authorizedFetch<CursorPaginatedResponse<PhraseSummary>>(path);
    },
    getNextPageParam: (lastPage) => extractCursor(lastPage.next),
  });
}