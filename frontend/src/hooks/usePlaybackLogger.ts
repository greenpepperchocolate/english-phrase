import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { PlaybackLogPayload } from '../api/types';

export function usePlaybackLogger() {
  const { authorizedFetch } = useAuth();

  return useMutation({
    mutationFn: (payload: PlaybackLogPayload) =>
      authorizedFetch('/logs/play', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}