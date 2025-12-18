import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';

export function useMasteredToggle() {
  const { authorizedFetch } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { phraseId: number; on: boolean }) =>
      authorizedFetch<{ phrase_id: number; is_mastered: boolean }>(
        '/mastered/toggle',
        {
          method: 'POST',
          body: JSON.stringify({ phrase_id: payload.phraseId, on: payload.on }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['mastery-rate'] });
    },
  });
}
