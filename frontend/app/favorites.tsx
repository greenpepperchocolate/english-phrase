import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../src/providers/AuthProvider';
import { useFavorites } from '../src/hooks/useFavorites';
import { useToggleFavorite } from '../src/hooks/useToggleFavorite';
import { useMasteredToggle } from '../src/hooks/useMasteredToggle';
import { VideoFeedCard, VideoFeedCardRef } from '../src/components/VideoFeedCard';
import { ErrorFallback } from '../src/components/ErrorFallback';

export default function FavoritesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { tokens } = useAuth();
  const favorites = useFavorites();
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

  const items = useMemo(() => favorites.data?.pages.flatMap((page) => page.results) ?? [], [favorites.data]);

  // メモリ節約: アクティブなインデックス周辺のみをレンダリング
  const RENDER_WINDOW = Platform.OS === 'android' ? 2 : 3;
  const shouldRenderItem = useCallback((index: number) => {
    return Math.abs(index - activeIndex) <= RENDER_WINDOW;
  }, [activeIndex]);

  // 安定したコールバック用のref
  const favoritesRef = useRef(favorites);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  useEffect(() => {
    isFetchingRef.current = favorites.isFetchingNextPage;
  }, [favorites.isFetchingNextPage]);

  // itemsの長さを同期
  useEffect(() => {
    itemsLengthRef.current = items.length;
  }, [items.length]);

  // activeIndexRefを同期
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // items縮小時にactiveIndexが範囲外にならないようクランプ
  useEffect(() => {
    if (items.length > 0 && activeIndex >= items.length) {
      const clamped = items.length - 1;
      setActiveIndex(clamped);
      pagerRef.current?.setPageWithoutAnimation(clamped);
    }
  }, [items.length, activeIndex]);

  // PagerViewのページ変更ハンドラ
  const onPageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const index = e.nativeEvent.position;
      if (index !== activeIndexRef.current) {
        setActiveIndex(index);

        // 最後に近づいたら次のページをプリフェッチ
        if (index >= itemsLengthRef.current - 3 && favoritesRef.current.hasNextPage && !isFetchingRef.current) {
          favoritesRef.current.fetchNextPage();
        }
      }
    },
    []
  );

  const handleAutoSwipe = useCallback(() => {
    const nextIndex = activeIndexRef.current + 1;
    if (nextIndex < itemsLengthRef.current) {
      pagerRef.current?.setPage(nextIndex);
    } else if (!favoritesRef.current.hasNextPage) {
      // 最後のアイテム: 最初に戻る（データはリセットしない）
      if (itemsLengthRef.current > 0) {
        pagerRef.current?.setPage(0);
        setActiveIndex(0);
      }
    }
    if (nextIndex >= itemsLengthRef.current - 3 && favoritesRef.current.hasNextPage && !isFetchingRef.current) {
      favoritesRef.current.fetchNextPage();
    }
  }, []);

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

  // データがない場合
  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>⭐</Text>
          <Text style={styles.emptyText}>No saved videos yet</Text>
          <Text style={styles.emptySubtext}>Tap the Keep button on videos to save them for later review</Text>
        </View>
        {/* Backボタン */}
        <Pressable
          style={[styles.backButton, { top: insets.top }]}
          onPress={() => router.back()}
        >
          <View style={styles.backButtonInner}>
            <Text style={styles.backButtonIcon}>‹</Text>
            <Text style={styles.backButtonText}>Back</Text>
          </View>
        </Pressable>
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
          <View key={`${item.id}-${index}`} style={styles.page} collapsable={false}>
            {shouldRenderItem(index) ? (
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
                shouldPreload={index === activeIndex + 1 && isFocused}
              />
            ) : (
              <View style={styles.placeholder} />
            )}
          </View>
        ))}
      </PagerView>

      {/* 次のページ読み込み中のインジケーター */}
      {favorites.isFetchingNextPage && (
        <View style={styles.loadingFooter}>
          <ActivityIndicator size="small" color="#ffffff" />
        </View>
      )}

      {/* Backボタン */}
      <Pressable
        style={[styles.backButton, { top: insets.top }]}
        onPress={() => router.back()}
      >
        <View style={styles.backButtonInner}>
          <Text style={styles.backButtonIcon}>‹</Text>
          <Text style={styles.backButtonText}>Back</Text>
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
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  backButtonInner: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
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
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 24,
    includeFontPadding: false,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
    lineHeight: 14,
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
  loadingFooter: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
