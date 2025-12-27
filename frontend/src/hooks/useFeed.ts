import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { CursorPaginatedResponse, PhraseSummary } from '../api/types';
import { useMemo } from 'react';

function extractPageNumber(next: string | null): number | undefined {
  if (!next) {
    return undefined;
  }
  try {
    const url = new URL(next);
    const page = url.searchParams.get('page');
    return page ? parseInt(page, 10) : undefined;
  } catch (error) {
    const match = next.match(/page=(\d+)/);
    return match?.[1] ? parseInt(match[1], 10) : undefined;
  }
}

export function useFeed(params: { topic?: string; difficulty?: string; pageSize?: number }) {
  const { authorizedFetch } = useAuth();

  // アプリ起動時にランダムシードを生成（このhookがマウントされるたびに1回だけ）
  const randomSeed = useMemo(() => Math.floor(Math.random() * 1000000), []);

  return useInfiniteQuery<CursorPaginatedResponse<PhraseSummary>, Error>({
    queryKey: ['feed', params.topic, params.difficulty, params.pageSize, randomSeed],
    initialPageParam: 1,
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
      if (pageParam && pageParam !== 1) {
        search.set('page', String(pageParam));
      }
      // ランダムシードを追加
      search.set('seed', String(randomSeed));
      const query = search.toString();
      const path = query ? `/feed?${query}` : '/feed';

      try {
        return await authorizedFetch<CursorPaginatedResponse<PhraseSummary>>(path);
      } catch (error) {
        // AbortErrorは無視してキャッシュから返す
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[useFeed] Request aborted, using cached data');
          throw error; // React Queryがキャッシュを使用
        }
        throw error;
      }
    },
    getNextPageParam: (lastPage) => extractPageNumber(lastPage.next),
    // メモリ管理: FlatListのremoveClippedSubviewsとwindowSizeで最適化済み
    // maxPagesは設定しない（戻るスクロールを可能にするため）

    // React Query設定: 1000回スワイプでもエラーが出ないように最適化
    staleTime: 10 * 60 * 1000, // 10分間はキャッシュを新鮮とみなす（5分→10分に延長）
    gcTime: 30 * 60 * 1000, // 30分間キャッシュを保持（10分→30分に延長）
    refetchOnWindowFocus: false, // ウィンドウフォーカス時の自動refetchを無効化
    refetchOnReconnect: false, // 再接続時の自動refetchを無効化
    refetchOnMount: false, // マウント時の自動refetchを無効化
    retry: false, // リトライを完全に無効化（エラー時は既存データを使用）
    retryOnMount: false, // マウント時のリトライを無効化

    // エラー時の動作を制御
    throwOnError: false, // エラーをスローしない（UI側で制御）

    // ネットワークモード: 常にキャッシュを優先
    networkMode: 'offlineFirst', // オフラインでもキャッシュから返す
  });
}