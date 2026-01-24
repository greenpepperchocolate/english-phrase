import { useMutation, useQueryClient, InfiniteData } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { PhraseSummary, MasteryRate } from '../api/types';
import { maybeRequestMasteryReview } from '../utils/reviewPrompt';

type FeedPage = {
  results: PhraseSummary[];
  next: string | null;
  previous: string | null;
};

// キャッシュ内のフレーズを更新するヘルパー関数
function updatePhraseInCache(
  old: InfiniteData<FeedPage> | undefined,
  phraseId: number,
  updates: Partial<PhraseSummary>
): InfiniteData<FeedPage> | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      results: page.results.map((phrase) =>
        phrase.id === phraseId ? { ...phrase, ...updates } : phrase
      ),
    })),
  };
}

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
    // 楽観的更新: APIコール前にキャッシュを即座に更新
    onMutate: async (payload) => {
      // 現在のキャッシュを取得（ロールバック用）
      // 注: cancelQueriesは動画再生に影響するため行わない
      const feedQueries = queryClient.getQueriesData<InfiniteData<FeedPage>>({
        queryKey: ['feed'],
      });
      const favoritesQueries = queryClient.getQueriesData<InfiniteData<FeedPage>>({
        queryKey: ['favorites'],
      });
      const searchQueries = queryClient.getQueriesData<InfiniteData<FeedPage>>({
        queryKey: ['search'],
      });

      // フィードキャッシュを楽観的に更新（全てのfeedクエリに適用）
      queryClient.setQueriesData<InfiniteData<FeedPage>>(
        { queryKey: ['feed'] },
        (old) => updatePhraseInCache(old, payload.phraseId, { is_mastered: payload.on })
      );

      // お気に入りキャッシュを楽観的に更新
      queryClient.setQueriesData<InfiniteData<FeedPage>>(
        { queryKey: ['favorites'] },
        (old) => updatePhraseInCache(old, payload.phraseId, { is_mastered: payload.on })
      );

      // 検索キャッシュも楽観的に更新
      queryClient.setQueriesData<InfiniteData<FeedPage>>(
        { queryKey: ['search'] },
        (old) => updatePhraseInCache(old, payload.phraseId, { is_mastered: payload.on })
      );

      // ロールバック用にコンテキストを返す
      return { feedQueries, favoritesQueries, searchQueries };
    },
    // エラー時はロールバック
    onError: (err, payload, context) => {
      // 元のデータを復元
      context?.feedQueries?.forEach(([queryKey, data]) => {
        if (data) queryClient.setQueryData(queryKey, data);
      });
      context?.favoritesQueries?.forEach(([queryKey, data]) => {
        if (data) queryClient.setQueryData(queryKey, data);
      });
      context?.searchQueries?.forEach(([queryKey, data]) => {
        if (data) queryClient.setQueryData(queryKey, data);
      });
    },
    // 成功時にマスター率のみ更新（フィードは再取得しない）
    onSuccess: async (_data, variables) => {
      if (variables?.on) {
        const mastery = await queryClient.fetchQuery<MasteryRate>({
          queryKey: ['mastery-rate'],
          queryFn: () => authorizedFetch<MasteryRate>('/mastery-rate'),
          staleTime: 0,
        });
        await maybeRequestMasteryReview(mastery.mastered_count);
      } else {
        queryClient.invalidateQueries({ queryKey: ['mastery-rate'] });
      }
    },
  });
}
