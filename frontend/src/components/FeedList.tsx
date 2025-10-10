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

  const originalItems = useMemo(() => feed.data?.pages.flatMap((page) => page.results) ?? [], [feed.data]);

  // 無限ループのためにアイテムを複製（3回繰り返す）
  const items = useMemo(() => {
    if (originalItems.length === 0) return [];
    if (originalItems.length === 1) return originalItems; // 1件の場合はループ再生で対応
    // 3回繰り返して疑似無限ループ
    return [...originalItems, ...originalItems, ...originalItems];
  }, [originalItems]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const index = viewableItems[0].index;
        if (index !== null && index !== activeIndex) {
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
    // 無限ループ：最後に到達したら最初に戻る
    if (originalItems.length > 1 && items.length > 0) {
      // 最初の動画にジャンプ（スムーズにスクロール）
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: 0, animated: false });
        setActiveIndex(0);
      }, 100);
    }

    // 追加のページがあればフェッチ
    if (feed.hasNextPage && !feed.isFetchingNextPage) {
      feed.fetchNextPage();
    }
  };

  const handleAutoSwipe = useCallback(() => {
    // 次の動画にスクロール
    const nextIndex = activeIndex + 1;
    if (nextIndex < items.length) {
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    } else if (originalItems.length > 1) {
      // 最後の動画の場合は最初に戻る
      flatListRef.current?.scrollToIndex({ index: 0, animated: true });
      setActiveIndex(0);
    }
  }, [activeIndex, items.length, originalItems.length]);

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
      keyExtractor={(item, index) => `${item.id}-${index}`}
      renderItem={renderItem}
      pagingEnabled
      snapToInterval={SCREEN_HEIGHT}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig.current}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.1}
      getItemLayout={(data, index) => ({
        length: SCREEN_HEIGHT,
        offset: SCREEN_HEIGHT * index,
        index,
      })}
      ListEmptyComponent={() => (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No videos available</Text>
          <Text style={styles.emptySubtext}>Add some phrases from the admin panel</Text>
        </View>
      )}
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
});