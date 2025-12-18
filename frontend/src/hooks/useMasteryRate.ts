import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import type { MasteryRate } from '../api/types';

export function useMasteryRate() {
  const { authorizedFetch, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['mastery-rate'],
    queryFn: () => authorizedFetch<MasteryRate>('/mastery-rate'),
    enabled: isAuthenticated,
    // マスター率は頻繁に変わらないので、5分間キャッシュ
    // マスターボタンを押した時は invalidateQueries で強制更新される
    staleTime: 1000 * 60 * 5, // 5分
    gcTime: 1000 * 60 * 10, // 10分（キャッシュ保持時間）
  });
}
