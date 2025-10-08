import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { PhraseDetail } from '../api/types';

export function usePhraseDetail(id: number | undefined) {
  const { authorizedFetch } = useAuth();

  return useQuery<PhraseDetail, Error>({
    queryKey: ['phrase', id],
    enabled: !!id,
    queryFn: () => authorizedFetch<PhraseDetail>(`/phrase/${id}`),
  });
}