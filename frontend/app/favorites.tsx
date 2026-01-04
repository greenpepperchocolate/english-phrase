import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, Text, View, ViewToken, ViewabilityConfig } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/providers/AuthProvider';
import { useFavorites } from '../src/hooks/useFavorites';
import { useToggleFavorite } from '../src/hooks/useToggleFavorite';
import { useMasteredToggle } from '../src/hooks/useMasteredToggle';
import { PhraseSummary } from '../src/api/types';
import { VideoFeedCard, VideoFeedCardRef } from '../src/components/VideoFeedCard';
import { ErrorFallback } from '../src/components/ErrorFallback';

// FlatListの外で定義して安定性を確保
const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 80,
};

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
  const activeIndexRef = useRef(0);

  // スライディングウィンドウ対応: 現在のアイテムIDを追跡
  const currentItemIdRef = useRef<string | null>(null);
  const prevItemOffsetRef = useRef(0);

  // 安定したコールバック用のref
  const favoritesRef = useRef(favorites);
  const itemsLengthRef = useRef(0);

  // 画面がフォーカスされているかを検出
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  // favoritesRefを同期
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  // activeIndexRefを同期
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const items = useMemo(() => favorites.data?.pages.flatMap((page) => page.results) ?? [], [favorites.data]);

  // itemsの長さを同期
  useEffect(() => {
    itemsLengthRef.current = items.length;
  }, [items.length]);

  // 現在のアイテムIDを追跡（スライディングウィンドウでページ破棄時のインデックス調整用）
  useEffect(() => {
    if (items[activeIndex]) {
      currentItemIdRef.current = String(items[activeIndex].id);
    }
  }, [activeIndex, items]);

  // ページ破棄時のインデックス調整
  useEffect(() => {
    const currentOffset = favorites.itemOffset;
    const prevOffset = prevItemOffsetRef.current;

    // オフセットが増加した = 古いページが破棄された
    if (currentOffset > prevOffset && currentItemIdRef.current) {
      const newIndex = items.findIndex(item => String(item.id) === currentItemIdRef.current);
      if (newIndex !== -1 && newIndex !== activeIndex) {
        console.log(`[FavoritesScreen] Page dropped, adjusting index: ${activeIndex} -> ${newIndex}`);
        setActiveIndex(newIndex);
        activeIndexRef.current = newIndex;
      }
    }

    prevItemOffsetRef.current = currentOffset;
  }, [favorites.itemOffset, items, activeIndex]);

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
    []
  );

  const flatListRef = useRef<FlatList>(null);

  const handleEndReached = useCallback(() => {
    if (favoritesRef.current.hasNextPage && !favoritesRef.current.isFetchingNextPage) {
      favoritesRef.current.fetchNextPage();
    }
  }, []);

  const handleAutoSwipe = useCallback(() => {
    const nextIndex = activeIndexRef.current + 1;
    if (nextIndex < itemsLengthRef.current) {
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }
    // 残り3件でプリフェッチ
    if (nextIndex >= itemsLengthRef.current - 3 && favoritesRef.current.hasNextPage && !favoritesRef.current.isFetchingNextPage) {
      favoritesRef.current.fetchNextPage();
    }
  }, []);

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
