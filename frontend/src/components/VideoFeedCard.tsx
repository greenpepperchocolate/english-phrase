import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  View,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable
} from 'react-native';
import { TapGestureHandler, State } from 'react-native-gesture-handler';
import {
  Audio,
  AVPlaybackStatus,
  AVPlaybackStatusSuccess,
  Video,
  ResizeMode,
} from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Expression, PhraseSummary } from '../api/types';
import { usePlaybackLogger } from '../hooks/usePlaybackLogger';
import { useUserSettings } from '../hooks/useUserSettings';
import { useAuth } from '../providers/AuthProvider';
import { ExpressionVideoCard, ExpressionVideoCardRef } from './ExpressionVideoCard';
import { useVideoLoading } from '../contexts/VideoLoadingContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Audio modeの初期化フラグ（グローバル）
let isAudioModeInitialized = false;

interface Props {
  phrase: PhraseSummary;
  isActive: boolean;
  isFavorite: boolean;
  isMastered: boolean;
  onToggleFavorite: (next: boolean) => void;
  onToggleMastered: (next: boolean) => void;
  onPress: () => void;
  onAutoSwipe?: () => void;
  isGuest?: boolean;
  onVerticalScrollEnabledChange?: (enabled: boolean) => void;
}

export interface VideoFeedCardRef {
  play: () => void;
  pause: () => void;
}

function isPlaybackSuccess(
  status: AVPlaybackStatus
): status is AVPlaybackStatusSuccess {
  return status.isLoaded;
}

export const VideoFeedCard = forwardRef<VideoFeedCardRef, Props>(
  (
    {
      phrase,
      isActive,
      isFavorite,
      isMastered,
      onToggleFavorite,
      onToggleMastered,
      onPress,
      onAutoSwipe,
      isGuest = false,
      onVerticalScrollEnabledChange,
    },
    ref
  ) => {
    const videoRef = useRef<Video | null>(null);
    const expressionVideoRefs = useRef<Map<number, ExpressionVideoCardRef>>(
      new Map()
    );
    const scrollViewRef = useRef<ScrollView>(null);

    const playbackLogger = usePlaybackLogger();
    const insets = useSafeAreaInsets();
    const { signOut } = useAuth();
    const router = useRouter();

    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [videoError, setVideoError] = useState<string | null>(null);

    const { settingsQuery } = useUserSettings();
    const playCountRef = useRef(0);
    const repeatCount = settingsQuery.data?.repeat_count ?? 3;
    const showJapanese = settingsQuery.data?.show_japanese ?? true;

    const [horizontalIndex, setHorizontalIndex] = useState(0);
    const horizontalIndexRef = useRef(0);

    const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
    const [shouldPlayVideo, setShouldPlayVideo] = useState(true);
    const [tabBarHeight, setTabBarHeight] = useState(0);

    const autoSwipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // デコーダ枯渇防止: ロード制御
    const { registerLoading, unregisterLoading } = useVideoLoading();
    const [isLoadRegistered, setIsLoadRegistered] = useState(false);
    const videoId = `phrase-${phrase.id}`;
    const loadRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const horizontalItems = useMemo(
      () => [
        { type: 'phrase' as const, data: phrase },
        ...(phrase.expressions || []).map((pe) => ({
          type: 'expression' as const,
          data: pe.expression,
        })),
      ],
      [phrase]
    );

    const hasExpressions = horizontalItems.length > 1;

    useEffect(() => {
      horizontalIndexRef.current = horizontalIndex;
    }, [horizontalIndex]);

    useImperativeHandle(ref, () => ({
      play: async () => {
        if (videoRef.current) await videoRef.current.playAsync();
      },
      pause: async () => {
        if (videoRef.current) await videoRef.current.pauseAsync();
      },
    }));

    // Audio mode 初回のみ
    useEffect(() => {
      if (!isAudioModeInitialized) {
        isAudioModeInitialized = true;
        Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        }).catch((error) => {
          console.warn('[VideoFeedCard] Failed to set audio mode:', error);
        });
      }
    }, []);

    // ✅ タップ（再生/停止）
    const handleVideoPress = useCallback(() => {
      setIsPlaying((p) => !p);
    }, []);


    const onHorizontalScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / SCREEN_WIDTH);
        if (index !== horizontalIndexRef.current) {
          setHorizontalIndex(index);
        }
      },
      []
    );

    // デコーダ枯渇防止: ロード登録制御
    useEffect(() => {
      if (isActive && horizontalIndex === 0) {
        const tryRegister = () => {
          if (registerLoading(videoId)) {
            setIsLoadRegistered(true);
          } else {
            loadRetryTimerRef.current = setTimeout(tryRegister, 300);
          }
        };
        tryRegister();
      } else {
        if (isLoadRegistered) {
          unregisterLoading(videoId);
          setIsLoadRegistered(false);
        }
        if (loadRetryTimerRef.current) {
          clearTimeout(loadRetryTimerRef.current);
          loadRetryTimerRef.current = null;
        }
      }

      return () => {
        if (loadRetryTimerRef.current) {
          clearTimeout(loadRetryTimerRef.current);
          loadRetryTimerRef.current = null;
        }
      };
    }, [
      isActive,
      horizontalIndex,
      videoId,
      registerLoading,
      unregisterLoading,
      isLoadRegistered,
    ]);

    useEffect(() => {
      return () => {
        unregisterLoading(videoId);
      };
    }, [videoId, unregisterLoading]);

    useEffect(() => {
      if (autoSwipeTimerRef.current) {
        clearTimeout(autoSwipeTimerRef.current);
        autoSwipeTimerRef.current = null;
      }
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      setHorizontalIndex(0);
      playCountRef.current = 0;
      setShouldPlayVideo(true);
      setIsVideoLoaded(false);
      setVideoError(null);
      setVideoAspectRatio(null); // アスペクト比リセット
      scrollViewRef.current?.scrollTo({ x: 0, animated: false });
    }, [phrase.id]);

    useEffect(() => {
      if (isActive) {
        setIsPlaying(true);
        setIsVideoLoaded(false);
      } else {
        videoRef.current?.pauseAsync();
        expressionVideoRefs.current.forEach((r) => r.pause());
        if (autoSwipeTimerRef.current) {
          clearTimeout(autoSwipeTimerRef.current);
          autoSwipeTimerRef.current = null;
        }
        if (replayTimerRef.current) {
          clearTimeout(replayTimerRef.current);
          replayTimerRef.current = null;
        }
      }
    }, [isActive]);

    useEffect(() => {
      if (!isActive) return;

      const timer = setTimeout(() => {
        if (isPlaying) {
          if (horizontalIndex === 0) {
            videoRef.current?.playAsync();
            expressionVideoRefs.current.forEach((r) => r.pause());
          } else {
            videoRef.current?.pauseAsync();
            expressionVideoRefs.current.forEach((r, idx) => {
              if (idx === horizontalIndex - 1) r.play();
              else r.pause();
            });
          }
        } else {
          videoRef.current?.pauseAsync();
          expressionVideoRefs.current.forEach((r) => r.pause());
        }
      }, 100);

      return () => clearTimeout(timer);
    }, [isActive, isPlaying, horizontalIndex]);

    const handlePlaybackStatus = (status: AVPlaybackStatus) => {
      if (isPlaybackSuccess(status) && !isVideoLoaded) {
        setIsVideoLoaded(true);
      }

      if (!isPlaybackSuccess(status) || !status.didJustFinish) return;
      if (!isVideoLoaded) return;
      if (status.durationMillis && status.durationMillis < 1000) return;

      playCountRef.current += 1;
      const currentPlayCount = playCountRef.current;

      if (currentPlayCount >= repeatCount) {
        if (!playbackLogger.isPending) {
          playbackLogger.mutate({
            phrase_id: phrase.id,
            play_ms: status.positionMillis ?? 0,
            completed: true,
            source: 'feed',
          });
        }

        setShouldPlayVideo(false);

        if (onAutoSwipe) {
          if (autoSwipeTimerRef.current) clearTimeout(autoSwipeTimerRef.current);
          // 1秒静止してから次の動画へ
          autoSwipeTimerRef.current = setTimeout(() => {
            autoSwipeTimerRef.current = null;
            onAutoSwipe();
          }, 1000);
        }
      } else {
        // リピート回数に達していない場合: 1秒静止してからリプレイ
        if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
        replayTimerRef.current = setTimeout(() => {
          replayTimerRef.current = null;
          if (videoRef.current && isActive && isPlaying) {
            videoRef.current.setPositionAsync(0);
            videoRef.current.playAsync();
          }
        }, 1000);
      }
    };

    const handleVideoError = useCallback(
      (error: string) => {
        console.warn(
          `[VideoFeedCard] Video error: phrase=${phrase.id}, url=${phrase.video_url?.substring(
            0,
            50
          )}..., error=${error}`
        );
        setVideoError(error);
      },
      [phrase.id, phrase.video_url]
    );

    const handleFavoritePress = () => {
      if (isGuest) {
        Alert.alert(
          'アカウントが必要です',
          'Keep機能は登録ユーザーのみ利用できます。動画を保存して後で復習するにはログインしてください。',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '新規登録', onPress: () => signOut() },
          ]
        );
        return;
      }
      onToggleFavorite(!isFavorite);
    };

    const handleMasteredPress = () => {
      if (isGuest) {
        Alert.alert(
          'アカウントが必要です',
          'Master機能は登録ユーザーのみ利用できます。進捗を記録するにはログインしてください',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '新規登録', onPress: () => signOut() },
          ]
        );
        return;
      }
      onToggleMastered(!isMastered);
    };

    const handleFavoritesListPress = () => {
      if (isGuest) {
        Alert.alert(
          'アカウントが必要です',
          'Keep機能は登録ユーザーのみ利用できます。動画を保存して後で復習するにはログインしてください',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '新規登録', onPress: () => signOut() },
          ]
        );
        return;
      }
      router.push('/favorites');
    };

    const handleSettingsPress = () => router.push('/settings');
    const handleSearchPress = () => router.push('/search');

    const handleTabPress = (targetIndex: number) => {
      if (targetIndex !== horizontalIndex) {
        scrollViewRef.current?.scrollTo({ x: targetIndex * SCREEN_WIDTH, animated: true });
      }
    };

    const renderHorizontalItem = ({
      item,
      index,
    }: {
      item: (typeof horizontalItems)[0];
      index: number;
    }) => {
      if (item.type === 'phrase') {
        const videoTopOffset = hasExpressions && tabBarHeight > 0 ? tabBarHeight : 0;

        // アスペクト比判定: ロードされるまで null
        const isPortrait = videoAspectRatio !== null && videoAspectRatio < 0.85;
        const videoResizeMode = isPortrait ? ResizeMode.COVER : ResizeMode.CONTAIN;

        return (
          <View style={styles.container}>
            {phrase.video_url ? (
              <>
                {isActive && horizontalIndex === 0 && isLoadRegistered ? (
                  <Video
                    ref={videoRef}
                    source={{ uri: phrase.video_url }}
                    style={{
                      position: 'absolute',
                      width: SCREEN_WIDTH,
                      height: isPortrait ? SCREEN_HEIGHT - videoTopOffset : SCREEN_HEIGHT,
                      top: isPortrait ? videoTopOffset : 0,
                      left: 0,
                      opacity: videoAspectRatio ? 1 : 0, // アスペクト比確定まで隠す（Layout Shift防止）
                    }}
                    resizeMode={videoResizeMode}
                    shouldPlay={isPlaying && shouldPlayVideo && !videoError}
                    isLooping={false}
                    onPlaybackStatusUpdate={handlePlaybackStatus}
                    onReadyForDisplay={(event) => {
                      const { width, height } = event.naturalSize;
                      if (width && height) {
                        setVideoAspectRatio(width / height);
                      }
                    }}
                    onError={handleVideoError}
                  />
                ) : null}

                <TapGestureHandler
                  onHandlerStateChange={(event) => {
                    if (event.nativeEvent.state === State.END) {
                      handleVideoPress();
                    }
                  }}
                >
                  <View style={styles.playPauseArea}>
                    {!isPlaying && (
                      <View style={styles.playIconContainer} pointerEvents="none">
                        <Text style={styles.playIcon}>▶</Text>
                      </View>
                    )}
                  </View>
                </TapGestureHandler>
              </>
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>動画がありません</Text>
              </View>
            )}

            <View style={styles.overlay} pointerEvents="box-none">
              <View style={[styles.buttonGroup, { bottom: insets.bottom + 46 }]} pointerEvents="box-none">
                <Pressable
                  onPress={handleMasteredPress}
                  style={[styles.masteredButton, isMastered && styles.masteredButtonActive]}
                >
                  <Text style={[styles.masteredButtonText, isMastered && styles.masteredButtonTextActive]}>
                    Master
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleFavoritePress}
                  style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
                >
                  <Text style={[styles.favoriteIcon, isFavorite && styles.favoriteIconActive]}>
                    {isFavorite ? '★' : '☆'}
                  </Text>
                  <Text style={[styles.favoriteLabel, isFavorite && styles.favoriteLabelActive]}>Keep</Text>
                </Pressable>

                <Pressable onPress={handleFavoritesListPress} style={styles.iconButton}>
                  <Text style={styles.iconButtonTextYellow}>★</Text>
                </Pressable>

                <Pressable onPress={handleSearchPress} style={styles.iconButton}>
                  <Text style={styles.iconButtonText}>🔍</Text>
                </Pressable>

                <Pressable onPress={handleSettingsPress} style={styles.iconButton}>
                  <Text style={styles.iconButtonText}>⚙</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.textOverlay, { bottom: insets.bottom + 106 }]} pointerEvents="none">
              <Text style={styles.phraseText}>{phrase.text}</Text>
              {showJapanese && <Text style={styles.meaningText}>{phrase.meaning}</Text>}
            </View>
            {/* エラー表示 */}
            {videoError && (
              <View style={[styles.loadingContainer, { marginTop: videoTopOffset }]}>
                <Text style={styles.errorText}>動画を読み込めませんでした</Text>
              </View>
            )}
          </View>
        );
      }

      return (
        <ExpressionVideoCard
          ref={(r) => {
            if (r) expressionVideoRefs.current.set(index - 1, r);
            else expressionVideoRefs.current.delete(index - 1);
          }}
          expression={item.data as unknown as Expression}
          isActive={isActive && horizontalIndex === index}
          showJapanese={showJapanese}
          tabBarHeight={tabBarHeight}
        />
      );
    };

    // expressionsがない場合はPagerViewを使わずに直接表示（縦スワイプを有効にするため）
    if (!hasExpressions) {
      return (
        <View style={styles.wrapper}>
          {renderHorizontalItem({ item: horizontalItems[0], index: 0 })}
        </View>
      );
    }

    return (
      <View style={styles.wrapper}>
        <View
          style={[styles.tabBar, { paddingTop: insets.top }]}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            if (height !== tabBarHeight) setTabBarHeight(height);
          }}
          pointerEvents="box-none"
        >
          <Pressable style={styles.tabItem} onPress={() => handleTabPress(0)}>
            <Text style={[styles.tabText, horizontalIndex === 0 && styles.tabTextActive]}>Word</Text>
            {horizontalIndex === 0 && <View style={styles.tabUnderline} />}
          </Pressable>

          <Pressable style={styles.tabItem} onPress={() => handleTabPress(1)}>
            <Text style={[styles.tabText, horizontalIndex > 0 && styles.tabTextActive]}>Phrase</Text>
            {horizontalIndex > 0 && <View style={styles.tabUnderline} />}
          </Pressable>
        </View>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          directionalLockEnabled={true}
          style={styles.horizontalPager}
          contentContainerStyle={styles.horizontalScrollContent}
          onMomentumScrollEnd={onHorizontalScroll}
          scrollEventThrottle={16}
        >
          {horizontalItems.map((item, index) => (
            <View key={`${item.type}-${index}`} style={styles.horizontalPage} collapsable={false}>
              {renderHorizontalItem({ item, index })}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }
);

VideoFeedCard.displayName = 'VideoFeedCard';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000000',
  },
  video: {
    // absoluteFillObjectを削除
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  playPauseArea: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 40,
    color: '#ffffff',
    marginLeft: 5,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d1b2a',
  },
  placeholderText: {
    color: '#ffffff',
    fontSize: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  buttonGroup: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 80,
    flexDirection: 'row',
    columnGap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    flexDirection: 'row',
    columnGap: 6,
  },
  favoriteButtonActive: {
    backgroundColor: 'rgba(255, 183, 3, 0.9)',
    borderColor: '#ffb703',
  },
  favoriteIcon: {
    fontSize: 20,
    color: '#ffffff',
  },
  favoriteIconActive: {
    color: '#1b263b',
  },
  favoriteLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  favoriteLabelActive: {
    color: '#1b263b',
    textShadowColor: 'transparent',
  },
  textOverlay: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    rowGap: 12,
    alignItems: 'center',
  },
  phraseText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  meaningText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 17,
    fontWeight: '400',
    fontFamily: 'NotoSansJP-Regular',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  masteredButtonContainer: {
    position: 'relative',
  },
  masteredButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  masteredButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    borderColor: '#3b82f6',
  },
  masteredButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  masteredButtonTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  // キラキラエフェクト
  pulseGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    zIndex: -1,
  },
  sparkle: {
    position: 'absolute',
    zIndex: 20,
  },
  sparkleTextLarge: {
    fontSize: 24,
    color: '#fbbf24',
    textShadowColor: '#fbbf24',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  sparkleTextMedium: {
    fontSize: 18,
    color: '#60a5fa',
    textShadowColor: '#60a5fa',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  sparkleTextSmall: {
    fontSize: 12,
    color: '#ffffff',
    textShadowColor: '#ffffff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  iconButtonText: {
    fontSize: 20,
    color: '#ffffff',
  },
  iconButtonTextYellow: {
    fontSize: 20,
    color: '#fbbf24',
  },
  wrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000000',
  },
  horizontalPager: {
    flex: 1,
  },
  horizontalScrollContent: {
    flexDirection: 'row',
  },
  horizontalPage: {
    width: SCREEN_WIDTH,
    height: '100%',
    flex: 1,
  },
  tabBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingBottom: 12,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  tabItem: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#3b82f6',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
});
