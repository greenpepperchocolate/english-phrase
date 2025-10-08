import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { UserSettings } from '../api/types';

const SETTINGS_KEY = ['user-settings'];

export function useUserSettings() {
  const queryClient = useQueryClient();
  const { authorizedFetch } = useAuth();

  const settingsQuery = useQuery<UserSettings, Error>({
    queryKey: SETTINGS_KEY,
    queryFn: () => authorizedFetch<UserSettings>('/settings'),
  });

  const updateSettings = useMutation({
    mutationFn: (payload: Partial<UserSettings>) => {
      console.log('Updating settings with payload:', payload);
      return authorizedFetch<UserSettings>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_KEY, data);
    },
  });

  return {
    settingsQuery,
    updateSettings,
  };
}