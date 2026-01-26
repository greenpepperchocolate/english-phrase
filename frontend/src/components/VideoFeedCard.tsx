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
  ActivityIndicator,
  Alert,
  Animated,
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
  shouldPreload?: boolean; // 次の動画のプリロード用
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
      shouldPreload = false,
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
    const [isLandscape, setIsLandscape] = useState<boolean | null>(null);

    const { settingsQuery } = useUserSettings();
    const playCountRef = useRef(0);
    const repeatCount = settingsQuery.data?.repeat_count ?? 3;
    const showJapanese = settingsQuery.data?.show_japanese ?? true;

    const [horizontalIndex, setHorizontalIndex] = useState(0);
    const horizontalIndexRef = useRef(0);
    const [isHorizontalLoading, setIsHorizontalLoading] = useState(false);

    const [shouldPlayVideo, setShouldPlayVideo] = useState(true);
    const [tabBarHeight, setTabBarHeight] = useState(0);
    const tabBarMeasuredRef = useRef(false);

    const autoSwipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // キラキラエフェクト用のアニメーション値
    const sparkleAnim1 = useRef(new Animated.Value(0)).current;
    const sparkleAnim2 = useRef(new Animated.Value(0)).current;
    const sparkleAnim3 = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const [showSparkle, setShowSparkle] = useState(false);

    // ロードオーバーレイのフェードアウト用
    const overlayOpacity = useRef(new Animated.Value(1)).current;

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

    // タブバーの推定高さ（レイアウトジャンプ防止）
    // onLayoutで計測されるまでは推定値を使用
    const effectiveTabBarHeight = tabBarMeasuredRef.current ? tabBarHeight : (hasExpressions ? insets.top + 52 : 0);

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

    // デコーダ枯渇防止: ロード登録制御（アクティブまたはプリロード時）
    const shouldRegisterLoading = (isActive && horizontalIndex === 0) || shouldPreload;

    useEffect(() => {
      if (shouldRegisterLoading) {
        const tryRegister = () => {
          if (registerLoading(videoId)) {
            setIsLoadRegistered(true);
          } else {
            loadRetryTimerRef.current = setTimeout(tryRegister, 100);
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
      shouldRegisterLoading,
      videoId,
      registerLoading,
      unregisterLoading,
      isLoadRegistered,
    ]);

    // コンポーネントのアンマウント時にリソース解放
    useEffect(() => {
      return () => {
        unregisterLoading(videoId);
        // 動画リソースを明示的に解放
        videoRef.current?.unloadAsync();
      };
    }, [videoId, unregisterLoading]);

    // アクティブでなくなったら動画をアンロード（メモリ節約）
    useEffect(() => {
      if (!isActive && !shouldPreload) {
        videoRef.current?.unloadAsync();
      }
    }, [isActive, shouldPreload]);

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
      setIsLandscape(null);
      overlayOpacity.setValue(1);
      scrollViewRef.current?.scrollTo({ x: 0, animated: false });
    }, [phrase.id, overlayOpacity]);

    // オーバーレイのフェードアウト
    useEffect(() => {
      if (isVideoLoaded) {
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }).start();
      } else {
        overlayOpacity.setValue(1);
      }
    }, [isVideoLoaded, overlayOpacity]);

    useEffect(() => {
      if (isActive) {
        setIsPlaying(true);
        // プリロードでロード済みの場合はリセットしない（フラッシュ防止）
        // phrase.id変更時に別のuseEffectでリセットされる
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

    // 横スワイプ時にローディングをリセット
    // horizontalIndex > 0 になった時点で状態をリセットしておく
    // これにより戻ってきた時は既に正しい状態になっている
    useEffect(() => {
      if (horizontalIndex > 0) {
        setIsHorizontalLoading(true);
        // phrase動画から離れる時に状態をリセット
        // 戻ってきた時にオーバーレイが確実に表示されるようにする
        setIsVideoLoaded(false);
        overlayOpacity.setValue(1);
      }
    }, [horizontalIndex, overlayOpacity]);

    // ExpressionVideoCardのロード完了コールバック
    const handleExpressionVideoLoaded = useCallback(() => {
      setIsHorizontalLoading(false);
    }, []);

    useEffect(() => {
      if (!isActive) return;

      const timer = setTimeout(() => {
        if (isPlaying) {
          if (horizontalIndex === 0) {
            // isVideoLoadedがtrueになるまで再生しない
            if (isVideoLoaded) {
              videoRef.current?.playAsync();
            }
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
    }, [isActive, isPlaying, horizontalIndex, isVideoLoaded]);

    const handlePlaybackStatus = (status: AVPlaybackStatus) => {
      // isVideoLoadedはonReadyForDisplayでのみ設定する
      // handlePlaybackStatusでは設定しない（resizeModeが確定する前に表示されるのを防ぐため）

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
          `[VideoFeedCard] Video error: phrase=${phrase.id}, text="${phrase.text}", url=${phrase.video_url?.substring(
            0,
            50
          )}..., error=${error}`
        );
        setVideoError(error);
      },
      [phrase.id, phrase.text, phrase.video_url]
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

    // キラキラエフェクトを再生
    const playSparkleEffect = useCallback(() => {
      setShowSparkle(true);
      sparkleAnim1.setValue(0);
      sparkleAnim2.setValue(0);
      sparkleAnim3.setValue(0);
      pulseAnim.setValue(0);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(sparkleAnim1, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(sparkleAnim2, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(sparkleAnim3, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setShowSparkle(false);
      });
    }, [sparkleAnim1, sparkleAnim2, sparkleAnim3, pulseAnim]);

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
      // Masterにする時だけキラキラエフェクトを再生
      if (!isMastered) {
        playSparkleEffect();
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
        return (
          <View style={styles.container}>
            {phrase.video_url ? (
              <>
                {(isActive && horizontalIndex === 0) || (shouldPreload && isLoadRegistered) ? (
                  <>
                    <Video
                      key={phrase.id}
                      ref={videoRef}
                      source={{ uri: phrase.video_url }}
                      style={{
                        position: 'absolute',
                        width: SCREEN_WIDTH,
                        height: SCREEN_HEIGHT - effectiveTabBarHeight,
                        top: effectiveTabBarHeight,
                        left: 0,
                      }}
                      resizeMode={isLandscape === false ? ResizeMode.COVER : ResizeMode.CONTAIN}
                      shouldPlay={isActive && isLoadRegistered && isPlaying && shouldPlayVideo && !videoError && isVideoLoaded}
                      isLooping={false}
                      onPlaybackStatusUpdate={handlePlaybackStatus}
                      onReadyForDisplay={(e: any) => {
                        const ns = e?.naturalSize;
                        if (ns && isLandscape === null) {
                          const { width, height, orientation } = ns;
                          const landscape =
                            orientation === 'landscape' ||
                            (width > 0 && height > 0 && width / height > 1.05);
                          setIsLandscape(landscape);
                          // resizeModeが適用されるまで待ってからisVideoLoadedをtrueにする
                          setTimeout(() => {
                            setIsVideoLoaded(true);
                          }, 50);
                        } else {
                          setIsVideoLoaded(true);
                        }
                      }}
                      onError={handleVideoError}
                    />
                    {!videoError && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.loadingOverlay,
                          // isVideoLoadedがfalseの時は即座に不透明、trueの時はアニメーション値を使用
                          { opacity: isVideoLoaded ? overlayOpacity : 1 }
                        ]}
                      />
                    )}
                  </>
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
                <View style={styles.masteredButtonContainer}>
                  <Pressable
                    onPress={handleMasteredPress}
                    style={[styles.masteredButton, isMastered && styles.masteredButtonActive]}
                  >
                    <Text style={[styles.masteredButtonText, isMastered && styles.masteredButtonTextActive]}>
                      Master
                    </Text>
                  </Pressable>
                  {/* キラキラエフェクト - 派手バージョン */}
                  {showSparkle && (
                    <>
                      {/* パルス効果 - より大きく */}
                      <Animated.View
                        style={[
                          styles.pulseGlow,
                          {
                            opacity: pulseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 1],
                            }),
                            transform: [{
                              scale: pulseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 2.5],
                              }),
                            }],
                          },
                        ]}
                      />
                      {/* 第1波 - 大きな星 (金/青/ピンク) */}
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim1.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                            transform: [
                              { translateX: -12 }, { translateY: -12 },
                              { scale: sparkleAnim1.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.5, 2.5, 0.8] }) },
                              { translateX: sparkleAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) },
                              { translateY: sparkleAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -50] }) },
                              { rotate: sparkleAnim1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
                            ],
                          },
                        ]}
                      >
                        <Text style={[styles.sparkleTextLarge, { color: '#fbbf24' }]}>✦</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim1.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                            transform: [
                              { translateX: -12 }, { translateY: -12 },
                              { scale: sparkleAnim1.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.5, 2.2, 0.6] }) },
                              { translateX: sparkleAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, 65] }) },
                              { translateY: sparkleAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) },
                              { rotate: sparkleAnim1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-150deg'] }) },
                            ],
                          },
                        ]}
                      >
                        <Text style={[styles.sparkleTextLarge, { color: '#60a5fa' }]}>★</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim1.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                            transform: [
                              { translateX: -12 }, { translateY: -12 },
                              { scale: sparkleAnim1.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.5, 2.0, 0.5] }) },
                              { translateX: sparkleAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -50] }) },
                              { translateY: sparkleAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, 45] }) },
                              { rotate: sparkleAnim1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '120deg'] }) },
                            ],
                          },
                        ]}
                      >
                        <Text style={[styles.sparkleTextLarge, { color: '#f472b6' }]}>✧</Text>
                      </Animated.View>
                      {/* 第2波 - 中サイズの星 */}
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim2.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                            transform: [
                              { translateX: -8 }, { translateY: -8 },
                              { scale: sparkleAnim2.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.3, 1.8, 0.4] }) },
                              { translateX: sparkleAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 55] }) },
                              { translateY: sparkleAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 35] }) },
                              { rotate: sparkleAnim2.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-90deg'] }) },
                            ],
                          },
                        ]}
                      >
                        <Text style={[styles.sparkleTextMedium, { color: '#fbbf24' }]}>✦</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim2.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                            transform: [
                              { translateX: -8 }, { translateY: -8 },
                              { scale: sparkleAnim2.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.3, 1.6, 0.3] }) },
                              { translateX: sparkleAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }) },
                              { translateY: sparkleAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
                              { rotate: sparkleAnim2.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '200deg'] }) },
                            ],
                          },
                        ]}
                      >
                        <Text style={[styles.sparkleTextMedium, { color: '#ffffff' }]}>★</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim2.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                            transform: [
                              { translateX: -8 }, { translateY: -8 },
                              { scale: sparkleAnim2.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.3, 1.5, 0.3] }) },
                              { translateX: sparkleAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) },
                              { translateY: sparkleAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, -65] }) },
                              { rotate: sparkleAnim2.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '150deg'] }) },
                            ],
                          },
                        ]}
                      >
                        <Text style={[styles.sparkleTextMedium, { color: '#60a5fa' }]}>✧</Text>
                      </Animated.View>
                      {/* 第3波 - 小さな星 */}
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim3.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                            transform: [
                              { translateX: -6 }, { translateY: -6 },
                              { scale: sparkleAnim3.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.2, 1.4, 0.2] }) },
                              { translateX: sparkleAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) },
                              { translateY: sparkleAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }) },
                              { rotate: sparkleAnim3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '270deg'] }) },
                            ],
                          },
                        ]}
                      >
                        <Text style={[styles.sparkleTextSmall, { color: '#fbbf24' }]}>⋆</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim3.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                            transform: [
                              { translateX: -6 }, { translateY: -6 },
                              { scale: sparkleAnim3.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.2, 1.3, 0.2] }) },
                              { translateX: sparkleAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, 75] }) },
                              { translateY: sparkleAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) },
                              { rotate: sparkleAnim3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-180deg'] }) },
                            ],
                          },
                        ]}
                      >
                        <Text style={[styles.sparkleTextSmall, { color: '#f472b6' }]}>✦</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim3.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                            transform: [
                              { translateX: -6 }, { translateY: -6 },
                              { scale: sparkleAnim3.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.2, 1.2, 0.2] }) },
                              { translateX: sparkleAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -25] }) },
                              { translateY: sparkleAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }) },
                              { rotate: sparkleAnim3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) },
                            ],
                          },
                        ]}
                      >
                        <Text style={[styles.sparkleTextSmall, { color: '#ffffff' }]}>★</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim3.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
                            transform: [
                              { translateX: -6 }, { translateY: -6 },
                              { scale: sparkleAnim3.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.2, 1.1, 0.2] }) },
                              { translateX: sparkleAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, 50] }) },
                              { translateY: sparkleAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, 55] }) },
                              { rotate: sparkleAnim3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-120deg'] }) },
                            ],
                          },
                        ]}
                      >
                        <Text style={[styles.sparkleTextSmall, { color: '#60a5fa' }]}>✧</Text>
                      </Animated.View>
                    </>
                  )}
                </View>

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
              <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>動画を読み込めませんでした</Text>
                <Text style={styles.errorText}>{phrase.text}</Text>
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
          tabBarHeight={effectiveTabBarHeight}
          onVideoLoaded={handleExpressionVideoLoaded}
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
            if (height !== tabBarHeight) {
              setTabBarHeight(height);
              tabBarMeasuredRef.current = true;
            }
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
    backgroundColor: 'rgba(240, 140, 166, 0.9)',
    borderColor: '#F08CA6',
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
    backgroundColor: '#F08CA6',
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
    height: SCREEN_HEIGHT,
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
    backgroundColor: '#F08CA6',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  horizontalLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
});
