import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, Dimensions, FlatList, StyleSheet, Text, View, ViewToken, ViewabilityConfig } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { useFeed } from '../hooks/useFeed';
import { useToggleFavorite } from '../hooks/useToggleFavorite';
import { useMasteredToggle } from '../hooks/useMasteredToggle';
import { PhraseSummary } from '../api/types';
import { VideoFeedCard, VideoFeedCardRef } from './VideoFeedCard';
import { ErrorFallback } from './ErrorFallback';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// FlatListの外で定義して安定性を確保
const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 80,
};

interface Props {
  topic?: string;
  isFocused?: boolean;
}

// メモ化されたアイテムコンポーネント
const MemoizedVideoFeedCard = React.memo(VideoFeedCard);

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

  // スライディングウィンドウ対応: 現在のアイテムIDを追跡
  const currentItemIdRef = useRef<string | null>(null);
  const prevItemOffsetRef = useRef(0);

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

  // 現在のアイテムIDを追跡（スライディングウィンドウでページ破棄時のインデックス調整用）
  useEffect(() => {
    if (items[activeIndex]) {
      currentItemIdRef.current = String(items[activeIndex].id);
    }
  }, [activeIndex, items]);

  // ページ破棄時のインデックス調整
  useEffect(() => {
    const currentOffset = feed.itemOffset;
    const prevOffset = prevItemOffsetRef.current;

    // オフセットが増加した = 古いページが破棄された
    if (currentOffset > prevOffset && currentItemIdRef.current) {
      // 現在のアイテムを新しいインデックスで探す
      const newIndex = items.findIndex(item => String(item.id) === currentItemIdRef.current);
      if (newIndex !== -1 && newIndex !== activeIndex) {
        console.log(`[FeedList] Page dropped, adjusting index: ${activeIndex} -> ${newIndex}`);
        setActiveIndex(newIndex);
        activeIndexRef.current = newIndex;
      }
    }

    prevItemOffsetRef.current = currentOffset;
  }, [feed.itemOffset, items, activeIndex]);

  // itemsの長さを同期（安定したコールバック用）
  useEffect(() => {
    itemsLengthRef.current = items.length;
  }, [items.length]);

  // 安定したコールバック（依存配列を空にして再生成を防止）
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const index = viewableItems[0].index;
        if (index !== null && index !== activeIndexRef.current) {
          setActiveIndex(index);
        }
      }
    },
    [] // 依存配列を空にして安定化
  );

  const flatListRef = useRef<FlatList>(null);
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

  const handleEndReached = useCallback(() => {
    // onEndReachedは複数回呼ばれることがあるため、厳密にチェック
    if (!feedRef.current.hasNextPage || isFetchingRef.current) {
      return;
    }
    debouncedFetchNextPage();
  }, [debouncedFetchNextPage]);

  const handleAutoSwipe = useCallback(() => {
    // 次の動画にスクロール
    const nextIndex = activeIndexRef.current + 1;
    if (nextIndex < itemsLengthRef.current) {
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }
    // 最後に近づいたら次のページをプリフェッチ（残り3件に短縮）
    if (nextIndex >= itemsLengthRef.current - 3 && feedRef.current.hasNextPage && !isFetchingRef.current) {
      debouncedFetchNextPage();
    }
  }, [debouncedFetchNextPage]); // 依存配列を最小化して安定化

  // renderItemをuseCallbackでメモ化（10000回スワイプ対応）
  // activeIndexの変更でrenderItemが再生成されるが、React.memoにより実際の再レンダリングは最小限
  const renderItem = useCallback(
    ({ item, index }: { item: PhraseSummary; index: number }) => (
      <MemoizedVideoFeedCard
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
      />
    ),
    [activeIndex, isFocused, router, toggleFavorite, toggleMastered, handleAutoSwipe, tokens?.anonymous]
  );

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

  return (
    <FlatList
      ref={flatListRef}
      data={items}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      pagingEnabled
      snapToInterval={SCREEN_HEIGHT}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={VIEWABILITY_CONFIG}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      getItemLayout={(data, index) => ({
        length: SCREEN_HEIGHT,
        offset: SCREEN_HEIGHT * index,
        index,
      })}
      // メモリ最適化設定
      removeClippedSubviews={true}
      windowSize={3}
      maxToRenderPerBatch={2}
      initialNumToRender={2}
      updateCellsBatchingPeriod={50}
      ListEmptyComponent={() => (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No videos available</Text>
          <Text style={styles.emptySubtext}>Add some phrases from the admin panel</Text>
        </View>
      )}
      ListFooterComponent={() =>
        feed.isFetchingNextPage ? (
          <View style={styles.loadingFooter}>
            <ActivityIndicator size="small" color="#ffffff" />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  errorText: {
    color: '#ffffff',
    fontSize: 16,
  },
  empty: {
    height: SCREEN_HEIGHT,
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
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});