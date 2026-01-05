import { useMemo, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, Text, View, ViewToken } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/providers/AuthProvider';
import { useFavorites } from '../src/hooks/useFavorites';
import { useToggleFavorite } from '../src/hooks/useToggleFavorite';
import { useMasteredToggle } from '../src/hooks/useMasteredToggle';
import { PhraseSummary } from '../src/api/types';
import { VideoFeedCard, VideoFeedCardRef } from '../src/components/VideoFeedCard';
import { ErrorFallback } from '../src/components/ErrorFallback';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useAuth();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const toggleMastered = useMasteredToggle();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(true);
  const videoRefs = useRef<Map<number, VideoFeedCardRef>>(new Map());

  // 画面がフォーカスされているかを検出
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

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
      isActive={index === activeIndex && isFocused}
      isFavorite={true}
      isMastered={item.is_mastered}
      onPress={() => router.push({ pathname: '/phrase/[id]', params: { id: String(item.id) } })}
      onToggleFavorite={(next) => toggleFavorite.mutate({ phraseId: item.id, on: next })}
      onToggleMastered={(next) => toggleMastered.mutate({ phraseId: item.id, on: next })}
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
    return <ErrorFallback error={favorites.error} onRetry={() => favorites.refetch()} />;
  }

  return (
    <View style={styles.container}>
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
        viewabilityConfig={{
          itemVisiblePercentThreshold: 80,
        }}
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
            <Text style={styles.emptyIcon}>⭐</Text>
            <Text style={styles.emptyText}>No saved videos yet</Text>
            <Text style={styles.emptySubtext}>Tap the Keep button on videos to save them for later review</Text>
          </View>
        )}
      />
      {/* Backボタン */}
      <Pressable
        style={[styles.backButton, { top: insets.top + 10 }]}
        onPress={() => router.back()}
      >
        <View style={styles.backButtonInner}>
          <Text style={styles.backButtonIcon}>‹</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    // グロー効果
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  backButtonIcon: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '300',
    marginLeft: -2,
    marginTop: -2,
  },
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
