import { useMemo, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Dimensions, FlatList, StyleSheet, Text, View, ViewToken } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { useFeed } from '../hooks/useFeed';
import { useFavorites } from '../hooks/useFavorites';
import { useToggleFavorite } from '../hooks/useToggleFavorite';
import { useMasteredToggle } from '../hooks/useMasteredToggle';
import { PhraseSummary } from '../api/types';
import { VideoFeedCard, VideoFeedCardRef } from './VideoFeedCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  topic?: string;
}

export function FeedList({ topic }: Props) {
  const router = useRouter();
  const { tokens } = useAuth();
  const feed = useFeed({ topic, pageSize: 10 });
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const toggleMastered = useMasteredToggle();
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRefs = useRef<Map<number, VideoFeedCardRef>>(new Map());

  const favoriteIds = useMemo(() => {
    if (!favorites.data) {
      return new Set<number>();
    }
    const allFavorites = favorites.data.pages.flatMap((page) => page.results);
    return new Set<number>(allFavorites.map((item) => item.id));
  }, [favorites.data]);

  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.results) ?? [], [feed.data]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const index = viewableItems[0].index;
        if (index !== null && index !== activeIndex) {
          console.log(`[FeedList] Viewable item changed: ${activeIndex} -> ${index}`);
          setActiveIndex(index);
        }
      }
    },
    [activeIndex]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  });

  const flatListRef = useRef<FlatList>(null);

  const handleEndReached = () => {
    // 追加のページがあればフェッチ
    if (feed.hasNextPage && !feed.isFetchingNextPage) {
      feed.fetchNextPage();
    }
  };

  const handleAutoSwipe = useCallback(() => {
    // 次の動画にスクロール
    const nextIndex = activeIndex + 1;
    console.log(`[FeedList] Auto swipe: ${activeIndex} -> ${nextIndex}`);
    if (nextIndex < items.length) {
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      // scrollToIndexを呼ぶと、onViewableItemsChangedが呼ばれてactiveIndexが更新される
      // ので、ここで手動で setActiveIndex を呼ぶ必要はない
    }
    // 最後に近づいたら次のページをプリフェッチ（残り5件）
    if (nextIndex >= items.length - 5 && feed.hasNextPage && !feed.isFetchingNextPage) {
      feed.fetchNextPage();
    }
  }, [activeIndex, items.length, feed]);

  const renderItem = ({ item, index }: { item: PhraseSummary; index: number }) => (
    <VideoFeedCard
      ref={(ref) => {
        if (ref) {
          videoRefs.current.set(index, ref);
        } else {
          videoRefs.current.delete(index);
        }
      }}
      phrase={item}
      isActive={index === activeIndex}
      isFavorite={favoriteIds.has(item.id)}
      isMastered={item.is_mastered}
      onPress={() => router.push({ pathname: '/phrase/[id]', params: { id: String(item.id) } })}
      onToggleFavorite={(next) => toggleFavorite.mutate({ phraseId: item.id, on: next })}
      onToggleMastered={(next) => toggleMastered.mutate({ phraseId: item.id, on: next })}
      onAutoSwipe={handleAutoSwipe}
      isGuest={tokens?.anonymous}
    />
  );

  if (feed.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (feed.isError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Error loading feed</Text>
      </View>
    );
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
      viewabilityConfig={viewabilityConfig.current}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
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