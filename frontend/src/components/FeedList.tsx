import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useRouter } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { useFeed } from '../hooks/useFeed';
import { useToggleFavorite } from '../hooks/useToggleFavorite';
import { useMasteredToggle } from '../hooks/useMasteredToggle';
import { VideoFeedCard, VideoFeedCardRef } from './VideoFeedCard';
import { ErrorFallback } from './ErrorFallback';

interface Props {
  topic?: string;
  isFocused?: boolean;
}

export function FeedList({ topic, isFocused = true }: Props) {
  const router = useRouter();
  const { tokens } = useAuth();
  const feed = useFeed({ topic, pageSize: 10 });
  const toggleFavorite = useToggleFavorite();
  const toggleMastered = useMasteredToggle();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0); // 安定したコールバック用
  const videoRefs = useRef<Map<number, VideoFeedCardRef>>(new Map());
  const isFetchingRef = useRef(false);
  const pagerRef = useRef<PagerView>(null);

  // 方向ロック用: 縦スクロールの有効/無効
  const [verticalScrollEnabled, setVerticalScrollEnabled] = useState(true);

  // 安定したコールバック用のref（10000回スワイプ対応）
  const feedRef = useRef(feed);
  const itemsLengthRef = useRef(0);

  // feedRefを同期（最新のfeedを参照）
  useEffect(() => {
    feedRef.current = feed;
  }, [feed]);

  // activeIndexRefを同期
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.results) ?? [], [feed.data]);

  // itemsの長さを同期（安定したコールバック用）
  useEffect(() => {
    itemsLengthRef.current = items.length;
  }, [items.length]);

  const fetchNextPageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // フェッチ状態を同期的に管理
  useEffect(() => {
    isFetchingRef.current = feed.isFetchingNextPage;
  }, [feed.isFetchingNextPage]);

  // クリーンアップ: アンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (fetchNextPageTimeoutRef.current) {
        clearTimeout(fetchNextPageTimeoutRef.current);
        fetchNextPageTimeoutRef.current = null;
      }
    };
  }, []);

  // デバウンス処理: feedRefを使用して安定化（10000回スワイプ対応）
  const debouncedFetchNextPage = useCallback(() => {
    // 既存のタイマーをクリア
    if (fetchNextPageTimeoutRef.current) {
      clearTimeout(fetchNextPageTimeoutRef.current);
      fetchNextPageTimeoutRef.current = null;
    }

    // 既にフェッチ中なら何もしない（重要！）
    if (isFetchingRef.current) {
      return;
    }

    // 300ms後にフェッチ（500ms→300msに短縮してレスポンス向上）
    fetchNextPageTimeoutRef.current = setTimeout(() => {
      const currentFeed = feedRef.current;
      // タイムアウト時点でも二重チェック
      if (currentFeed.hasNextPage && !isFetchingRef.current) {
        isFetchingRef.current = true; // 先にフラグを立てる
        currentFeed.fetchNextPage().catch((error) => {
          // エラーをキャッチして無視（AbortErrorなど）
          console.log('Fetch next page error (ignored):', error?.message);
        }).finally(() => {
          isFetchingRef.current = false; // フラグをクリア
        });
      }
      fetchNextPageTimeoutRef.current = null;
    }, 300);
  }, []); // 依存配列を空にして安定化

  // PagerViewのページ変更ハンドラ
  const onPageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const index = e.nativeEvent.position;
      if (index !== activeIndexRef.current) {
        setActiveIndex(index);

        // 最後に近づいたら次のページをプリフェッチ（残り3件）
        if (index >= itemsLengthRef.current - 3 && feedRef.current.hasNextPage && !isFetchingRef.current) {
          debouncedFetchNextPage();
        }
      }
    },
    [debouncedFetchNextPage]
  );

  const handleAutoSwipe = useCallback(() => {
    // 次の動画にスクロール
    const nextIndex = activeIndexRef.current + 1;
    if (nextIndex < itemsLengthRef.current) {
      pagerRef.current?.setPage(nextIndex);
    }
    // 最後に近づいたら次のページをプリフェッチ（残り3件に短縮）
    if (nextIndex >= itemsLengthRef.current - 3 && feedRef.current.hasNextPage && !isFetchingRef.current) {
      debouncedFetchNextPage();
    }
  }, [debouncedFetchNextPage]); // 依存配列を最小化して安定化

  // 初回ロード中のみローディング表示
  if (feed.isLoading && !feed.data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // エラーでも既存データがあればスワイプ可能にする
  if (feed.isError && !feed.data) {
    return <ErrorFallback error={feed.error} onRetry={() => feed.refetch()} />;
  }

  // データがない場合
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No videos available</Text>
        <Text style={styles.emptySubtext}>Add some phrases from the admin panel</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        orientation="vertical"
        onPageSelected={onPageSelected}
        offscreenPageLimit={1}
        scrollEnabled={verticalScrollEnabled}
        overdrag={true}
      >
        {items.map((item, index) => (
          <View key={String(item.id)} style={styles.page} collapsable={false}>
            <VideoFeedCard
              ref={(ref) => {
                if (ref) {
                  videoRefs.current.set(index, ref);
                } else {
                  videoRefs.current.delete(index);
                }
              }}
              phrase={item}
              isActive={index === activeIndex && isFocused}
              isFavorite={item.is_favorite}
              isMastered={item.is_mastered}
              onPress={() => router.push({ pathname: '/phrase/[id]', params: { id: String(item.id) } })}
              onToggleFavorite={(next) => toggleFavorite.mutate({ phraseId: item.id, on: next })}
              onToggleMastered={(next) => toggleMastered.mutate({ phraseId: item.id, on: next })}
              onAutoSwipe={handleAutoSwipe}
              isGuest={tokens?.anonymous}
              onVerticalScrollEnabledChange={setVerticalScrollEnabled}
            />
          </View>
        ))}
      </PagerView>

      {/* 次のページ読み込み中のインジケーター */}
      {feed.isFetchingNextPage && (
        <View style={styles.loadingFooter}>
          <ActivityIndicator size="small" color="#ffffff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingFooter: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
