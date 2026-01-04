import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { CursorPaginatedResponse, PhraseSummary } from '../api/types';
import { useMemo } from 'react';

// セッション内でランダムシードを永続化（コンポーネントのリマウントでも維持）
let sessionFeedSeed: number | null = null;

function getSessionFeedSeed(): number {
  if (sessionFeedSeed === null) {
    sessionFeedSeed = Math.floor(Math.random() * 1000000);
  }
  return sessionFeedSeed;
}

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

// スライディングウィンドウ設定
const MAX_PAGES = 10; // 10ページ（100アイテム）をメモリに保持

export function useFeed(params: { topic?: string; difficulty?: string; pageSize?: number }) {
  const { authorizedFetch } = useAuth();
  const pageSize = params.pageSize || 20;

  // セッション内で一貫したランダムシードを使用（キャッシュの安定性を確保）
  const randomSeed = useMemo(() => getSessionFeedSeed(), []);

  const query = useInfiniteQuery<CursorPaginatedResponse<PhraseSummary>, Error>({
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
      const queryStr = search.toString();
      const path = queryStr ? `/feed?${queryStr}` : '/feed';

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

    // メモリ管理: スライディングウィンドウ方式
    // 10ページ（100アイテム）を保持し、古いページは自動的に破棄
    maxPages: MAX_PAGES,

    // React Query設定: 10000回スワイプでもエラーが出ないように最適化
    staleTime: 5 * 60 * 1000, // 5分間はキャッシュを新鮮とみなす
    gcTime: 10 * 60 * 1000, // 10分間キャッシュを保持（メモリ節約のため短縮）
    refetchOnWindowFocus: false, // ウィンドウフォーカス時の自動refetchを無効化
    refetchOnReconnect: true, // 再接続時は自動refetch（ネットワーク復帰時）
    refetchOnMount: false, // マウント時の自動refetchを無効化
    // ネットワークエラー時のみリトライ（サーバーエラーはリトライしない）
    retry: (failureCount, error) => {
      // AbortErrorはリトライしない
      if (error instanceof Error && error.name === 'AbortError') return false;
      // 3回までリトライ
      if (failureCount >= 3) return false;
      // ネットワークエラー（status 0）の場合のみリトライ
      if (error && 'isNetworkError' in error && error.isNetworkError) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // 1s, 2s, 4s...最大10s
    retryOnMount: false, // マウント時のリトライを無効化

    // エラー時の動作を制御
    throwOnError: false, // エラーをスローしない（UI側で制御）

    // ネットワークモード: 常にキャッシュを優先
    networkMode: 'offlineFirst', // オフラインでもキャッシュから返す
  });

  // 破棄されたアイテム数を計算（FlatListのインデックス調整用）
  const itemOffset = useMemo(() => {
    if (!query.data?.pageParams || query.data.pageParams.length === 0) return 0;
    const firstPageNum = query.data.pageParams[0] as number;
    // 最初のページが1なら破棄なし、5なら (5-1) * pageSize アイテムが破棄済み
    return (firstPageNum - 1) * pageSize;
  }, [query.data?.pageParams, pageSize]);

  return {
    ...query,
    itemOffset, // 破棄されたアイテム数をFeedListに提供
  };
}