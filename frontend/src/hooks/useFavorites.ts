import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { Favorite } from '../api/types';

export function useFavorites() {
  const { authorizedFetch } = useAuth();

  return useQuery<Favorite[], Error>({
    queryKey: ['favorites'],
    queryFn: () => authorizedFetch<Favorite[]>('/favorites'),
  });
}