import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { UserSettings } from '../api/types';

const SETTINGS_KEY = ['user-settings'];

export function useUserSettings() {
  const queryClient = useQueryClient();
  const { authorizedFetch } = useAuth();

  const settingsQuery = useQuery<UserSettings, Error>({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      console.log('Fetching settings...');
      try {
        const result = await authorizedFetch<UserSettings>('/settings');
        console.log('Settings fetched:', result);
        return result;
      } catch (error) {
        console.error('Settings fetch error:', error);
        throw error;
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5分間はキャッシュを使用（再取得しない）
    cacheTime: 10 * 60 * 1000, // 10分間キャッシュを保持
    refetchOnWindowFocus: false, // ウィンドウフォーカス時に再取得しない
    refetchOnMount: false, // マウント時に再取得しない（キャッシュがあれば使用）
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