import { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Text,
  Pressable,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../src/providers/AuthProvider';
import { useSearch } from '../src/hooks/useSearch';
import { useToggleFavorite } from '../src/hooks/useToggleFavorite';
import { useMasteredToggle } from '../src/hooks/useMasteredToggle';
import { VideoFeedCard, VideoFeedCardRef } from '../src/components/VideoFeedCard';
import { ErrorFallback } from '../src/components/ErrorFallback';

export default function SearchScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tokens } = useAuth();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const search = useSearch({ query: activeSearchQuery, pageSize: 10 });
  const toggleFavorite = useToggleFavorite();
  const toggleMastered = useMasteredToggle();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(true);
  const videoRefs = useRef<Map<number, VideoFeedCardRef>>(new Map());
  const pagerRef = useRef<PagerView>(null);
  const activeIndexRef = useRef(0);
  const itemsLengthRef = useRef(0);

  // 方向ロック用: 縦スクロールの有効/無効
  const [verticalScrollEnabled, setVerticalScrollEnabled] = useState(true);

  // 画面がフォーカスされているかを検出
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  const items = useMemo(() => search.data?.pages.flatMap((page) => page.results) ?? [], [search.data]);

  // itemsの長さを同期
  useMemo(() => {
    itemsLengthRef.current = items.length;
  }, [items.length]);

  // activeIndexRefを同期
  useMemo(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // PagerViewのページ変更ハンドラ
  const onPageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const index = e.nativeEvent.position;
      if (index !== activeIndexRef.current) {
        setActiveIndex(index);

        // 最後に近づいたら次のページをプリフェッチ
        if (index >= itemsLengthRef.current - 3 && search.hasNextPage && !search.isFetchingNextPage) {
          search.fetchNextPage();
        }
      }
    },
    [search]
  );

  const handleAutoSwipe = useCallback(() => {
    const nextIndex = activeIndexRef.current + 1;
    if (nextIndex < itemsLengthRef.current) {
      pagerRef.current?.setPage(nextIndex);
    } else {
      // 最後の動画に達した場合
      if (!search.hasNextPage) {
        // 次のページがない場合はクエリをリセットして再フェッチ
        pagerRef.current?.setPage(0);
        setActiveIndex(0);
        // クエリをリセットして最初から再取得
        queryClient.resetQueries({ queryKey: ['search'] });
      }
    }
    if (nextIndex >= itemsLengthRef.current - 5 && search.hasNextPage && !search.isFetchingNextPage) {
      search.fetchNextPage();
    }
  }, [search, queryClient]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setActiveSearchQuery(searchQuery.trim());
      setActiveIndex(0);
    }
  };

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
        <ErrorFallback error={search.error} onRetry={() => search.refetch()} />
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>😔</Text>
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>Try searching for different words</Text>
        </View>
      ) : (
        <View style={styles.pagerContainer}>
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
          {search.isFetchingNextPage && (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          )}
        </View>
      )}

      {/* 検索バーをオーバーレイとして表示 */}
      <View style={[styles.searchBar, { paddingTop: insets.top }]}>
        <Pressable style={styles.backButton} onPress={handleClose}>
          <View style={styles.backButtonInner}>
            <Text style={styles.backButtonIcon}>‹</Text>
          </View>
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
  pagerContainer: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    width: '100%',
    height: '100%',
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
    marginRight: 8,
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
  },
  backButtonIcon: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '300',
    marginLeft: -2,
    marginTop: -2,
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
    backgroundColor: '#F08CA6',
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
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
