import { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Text,
  Dimensions,
  ViewToken,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/providers/AuthProvider';
import { useSearch } from '../src/hooks/useSearch';
import { useFavorites } from '../src/hooks/useFavorites';
import { useToggleFavorite } from '../src/hooks/useToggleFavorite';
import { useMasteredToggle } from '../src/hooks/useMasteredToggle';
import { PhraseSummary } from '../src/api/types';
import { VideoFeedCard, VideoFeedCardRef } from '../src/components/VideoFeedCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SearchScreen() {
  const router = useRouter();
  const { tokens } = useAuth();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const search = useSearch({ query: activeSearchQuery, pageSize: 10 });
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

  const items = useMemo(() => search.data?.pages.flatMap((page) => page.results) ?? [], [search.data]);

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
    if (search.hasNextPage && !search.isFetchingNextPage) {
      search.fetchNextPage();
    }
  };

  const handleAutoSwipe = useCallback(() => {
    const nextIndex = activeIndex + 1;
    if (nextIndex < items.length) {
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }
    if (nextIndex >= items.length - 5 && search.hasNextPage && !search.isFetchingNextPage) {
      search.fetchNextPage();
    }
  }, [activeIndex, items.length, search]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setActiveSearchQuery(searchQuery.trim());
      setActiveIndex(0);
    }
  };

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

  const handleClose = () => {
    router.back();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveSearchQuery('');
    setActiveIndex(0);
  };

  return (
    <View style={styles.container}>
      {!activeSearchQuery ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>Enter a word or phrase to search</Text>
        </View>
      ) : search.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : search.isError ? (
        <View style={styles.loading}>
          <Text style={styles.errorText}>Error loading search results</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>😔</Text>
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>Try searching for different words</Text>
        </View>
      ) : (
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
          removeClippedSubviews={true}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={2}
          updateCellsBatchingPeriod={50}
          ListFooterComponent={() =>
            search.isFetchingNextPage ? (
              <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color="#ffffff" />
              </View>
            ) : null
          }
        />
      )}

      {/* 検索バーをオーバーレイとして表示 */}
      <View style={[styles.searchBar, { paddingTop: insets.top }]}>
        <Pressable style={styles.backButton} onPress={handleClose}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <TextInput
          style={styles.searchInput}
          placeholder="Search phrases..."
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoFocus
        />
        {searchQuery.length > 0 && (
          <Pressable style={styles.clearButton} onPress={handleClearSearch}>
            <Text style={styles.clearButtonText}>×</Text>
          </Pressable>
        )}
        <Pressable style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>🔍</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  searchBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: '#000000',
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '400',
  },
  searchInput: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 22,
    paddingHorizontal: 20,
    color: '#ffffff',
    fontSize: 16,
  },
  clearButton: {
    position: 'absolute',
    right: 64,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '300',
  },
  searchButton: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1d4ed8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 20,
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
  emptyState: {
    flex: 1,
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
    textAlign: 'center',
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
