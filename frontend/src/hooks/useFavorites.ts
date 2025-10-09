import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { PhraseSummary } from '../api/types';

type FavoritesResponse = {
  results: PhraseSummary[];
  next: string | null;
  previous: string | null;
};

export function useFavorites() {
  const { authorizedFetch } = useAuth();

  return useInfiniteQuery<FavoritesResponse, Error>({
    queryKey: ['favorites'],
    queryFn: ({ pageParam }) => {
      const url = pageParam || '/favorites?limit=20';
      return authorizedFetch<FavoritesResponse>(url);
    },
    getNextPageParam: (lastPage) => lastPage.next,
    initialPageParam: undefined as string | undefined,
  });
}