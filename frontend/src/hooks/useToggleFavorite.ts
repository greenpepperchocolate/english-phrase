import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { Favorite, PhraseSummary } from '../api/types';

export function useToggleFavorite() {
  const { authorizedFetch } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { phraseId: number; on: boolean }) =>
      authorizedFetch<{ phrase_id: number; is_favorite: boolean }>(
        '/favorites/toggle',
        {
          method: 'POST',
          body: JSON.stringify({ phrase_id: payload.phraseId, on: payload.on }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}