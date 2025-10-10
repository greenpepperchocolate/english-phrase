import { useMemo, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Dimensions, FlatList, StyleSheet, Text, View, ViewToken } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/providers/AuthProvider';
import { useFavorites } from '../src/hooks/useFavorites';
import { useToggleFavorite } from '../src/hooks/useToggleFavorite';
import { PhraseSummary } from '../src/api/types';
import { VideoFeedCard, VideoFeedCardRef } from '../src/components/VideoFeedCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FavoritesScreen() {
  const router = useRouter();
  const { tokens } = useAuth();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRefs = useRef<Map<number, VideoFeedCardRef>>(new Map());

  const items = useMemo(() => favorites.data?.pages.flatMap((page) => page.results) ?? [], [favorites.data]);

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
    if (favorites.hasNextPage && !favorites.isFetchingNextPage) {
      favorites.fetchNextPage();
    }
  };

  const handleAutoSwipe = useCallback(() => {
    const nextIndex = activeIndex + 1;
    if (nextIndex < items.length) {
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    }
  }, [activeIndex, items.length]);

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
      isFavorite={true}
      onPress={() => router.push({ pathname: '/phrase/[id]', params: { id: String(item.id) } })}
      onToggleFavorite={(next) => toggleFavorite.mutate({ phraseId: item.id, on: next })}
      onAutoSwipe={handleAutoSwipe}
      isGuest={tokens?.anonymous}
    />
  );

  if (favorites.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (favorites.isError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Error loading favorites</Text>
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
      onEndReachedThreshold={0.5}
      getItemLayout={(data, index) => ({
        length: SCREEN_HEIGHT,
        offset: SCREEN_HEIGHT * index,
        index,
      })}
      ListEmptyComponent={() => (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>⭐</Text>
          <Text style={styles.emptyText}>No saved videos yet</Text>
          <Text style={styles.emptySubtext}>Tap the Keep button on videos to save them for later review</Text>
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
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
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
