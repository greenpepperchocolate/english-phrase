import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, FlatList, Pressable, StyleSheet, Text, View, ViewToken, ViewabilityConfig } from 'react-native';
import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess, Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Expression, PhraseSummary } from '../api/types';
import { usePlaybackLogger } from '../hooks/usePlaybackLogger';
import { useUserSettings } from '../hooks/useUserSettings';
import { useAuth } from '../providers/AuthProvider';
import { ExpressionVideoCard, ExpressionVideoCardRef } from './ExpressionVideoCard';
import { useVideoLoading } from '../contexts/VideoLoadingContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// 安定したviewabilityConfig
const HORIZONTAL_VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 80,
};

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
}

export interface VideoFeedCardRef {
  play: () => void;
  pause: () => void;
}

function isPlaybackSuccess(status: AVPlaybackStatus): status is AVPlaybackStatusSuccess {
  return status.isLoaded;
}

export const VideoFeedCard = forwardRef<VideoFeedCardRef, Props>(
  ({ phrase, isActive, isFavorite, isMastered, onToggleFavorite, onToggleMastered, onPress, onAutoSwipe, isGuest = false }, ref) => {
    const videoRef = useRef<Video | null>(null);
    const expressionVideoRefs = useRef<Map<number, ExpressionVideoCardRef>>(new Map());
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
    const horizontalFlatListRef = useRef<FlatList>(null);
    const [shouldPlayVideo, setShouldPlayVideo] = useState(true);
    const [tabBarHeight, setTabBarHeight] = useState(0);
    const horizontalIndexRef = useRef(0); // 安定したコールバック用
    const autoSwipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 自動スワイプタイマー

    // デコーダ枯渇防止: ロード制御
    const { registerLoading, unregisterLoading } = useVideoLoading();
    const [isLoadRegistered, setIsLoadRegistered] = useState(false);
    const videoId = `phrase-${phrase.id}`;
    const loadRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // キラキラエフェクト用のアニメーション値
    const sparkleAnim1 = useRef(new Animated.Value(0)).current;
    const sparkleAnim2 = useRef(new Animated.Value(0)).current;
    const sparkleAnim3 = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const [showSparkle, setShowSparkle] = useState(false);

    // キラキラエフェクトを再生
    const playSparkleEffect = useCallback(() => {
      setShowSparkle(true);
      sparkleAnim1.setValue(0);
      sparkleAnim2.setValue(0);
      sparkleAnim3.setValue(0);
      pulseAnim.setValue(0);

      // 複数のアニメーションを時間差で実行
      Animated.parallel([
        // パルス効果（ボタンの輝き）
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
        // 第1波のキラキラ
        Animated.timing(sparkleAnim1, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        // 第2波のキラキラ（少し遅れて）
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(sparkleAnim2, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        // 第3波のキラキラ（さらに遅れて）
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

    // 横スワイプアイテム: メインフレーズ + Expression動画（メモ化）
    const horizontalItems = useMemo(() => [
      { type: 'phrase' as const, data: phrase },
      ...(phrase.expressions || []).map(pe => ({ type: 'expression' as const, data: pe.expression }))
    ], [phrase]);

    // horizontalIndexRefを同期
    useEffect(() => {
      horizontalIndexRef.current = horizontalIndex;
    }, [horizontalIndex]);

    useImperativeHandle(ref, () => ({
      play: async () => {
        if (videoRef.current) {
          await videoRef.current.playAsync();
        }
      },
      pause: async () => {
        if (videoRef.current) {
          await videoRef.current.pauseAsync();
        }
      },
    }));

    // Audio modeを設定（音声再生を有効化）- 初回のみ
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

    // 安定したコールバック（依存配列を空にして再生成を防止）
    const onHorizontalViewableItemsChanged = useCallback(
      ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
          const index = viewableItems[0].index;
          if (index !== null && index !== horizontalIndexRef.current) {
            setHorizontalIndex(index);
          }
        }
      },
      [] // 依存配列を空にして安定化
    );

    // デコーダ枯渇防止: ロード登録制御
    useEffect(() => {
      // アクティブ かつ メインフレーズ動画表示中の場合のみ登録を試みる
      if (isActive && horizontalIndex === 0) {
        const tryRegister = () => {
          if (registerLoading(videoId)) {
            setIsLoadRegistered(true);
          } else {
            // 登録失敗時は300ms後に再試行
            loadRetryTimerRef.current = setTimeout(tryRegister, 300);
          }
        };
        tryRegister();
      } else {
        // 非アクティブ or 横スワイプで別画面の場合は登録解除
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
    }, [isActive, horizontalIndex, videoId, registerLoading, unregisterLoading]);

    // コンポーネントのアンマウント時に登録解除
    useEffect(() => {
      return () => {
        unregisterLoading(videoId);
      };
    }, [videoId, unregisterLoading]);

    // phrase idが変わった時に横スワイプとカウントをリセット
    useEffect(() => {
      // 自動スワイプタイマーをクリア（ゾンビタイマー防止）
      if (autoSwipeTimerRef.current) {
        clearTimeout(autoSwipeTimerRef.current);
        autoSwipeTimerRef.current = null;
      }
      setHorizontalIndex(0);
      playCountRef.current = 0;
      setShouldPlayVideo(true);
      setIsVideoLoaded(false);    // ロード状態もリセット
      setVideoError(null);        // エラー状態もリセット
      horizontalFlatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [phrase.id]);

    useEffect(() => {
      if (isActive) {
        setIsPlaying(true);
        setIsVideoLoaded(false);
      } else {
        // 非アクティブになったら動画を停止（メモリはFlatListのremoveClippedSubviewsで管理）
        videoRef.current?.pauseAsync();
        // すべてのExpression動画も停止
        expressionVideoRefs.current.forEach(ref => ref.pause());
        // 自動スワイプタイマーもクリア
        if (autoSwipeTimerRef.current) {
          clearTimeout(autoSwipeTimerRef.current);
          autoSwipeTimerRef.current = null;
        }
      }
    }, [isActive]);

    useEffect(() => {
      if (!isActive) {
        return;
      }

      const timer = setTimeout(() => {
        if (isPlaying) {
          if (horizontalIndex === 0) {
            // メインのフレーズ動画を再生
            videoRef.current?.playAsync();
            expressionVideoRefs.current.forEach(ref => ref.pause());
          } else {
            // Expression動画を再生
            videoRef.current?.pauseAsync();
            expressionVideoRefs.current.forEach((ref, index) => {
              if (index === horizontalIndex - 1) {
                ref.play();
              } else {
                ref.pause();
              }
            });
          }
        } else {
          videoRef.current?.pauseAsync();
          expressionVideoRefs.current.forEach(ref => ref.pause());
        }
      }, 100);
      return () => clearTimeout(timer);
    }, [isActive, isPlaying, horizontalIndex]);

    const handlePlaybackStatus = (status: AVPlaybackStatus) => {
      // 動画が読み込まれたらサムネイルを非表示に
      if (isPlaybackSuccess(status) && !isVideoLoaded) {
        console.log(`[VideoFeedCard] Video loaded: phrase=${phrase.id}, duration=${status.durationMillis}ms`);
        setIsVideoLoaded(true);
      }

      if (!isPlaybackSuccess(status) || !status.didJustFinish) {
        return;
      }

      // 動画が実際にロードされていない場合はオートスワイプしない（URL期限切れ対策）
      if (!isVideoLoaded) {
        console.warn(`[VideoFeedCard] didJustFinish but video not loaded, skipping auto-swipe: phrase=${phrase.id}`);
        return;
      }

      // 動画の長さが異常に短い場合（1秒未満）はスキップ（読み込み失敗の可能性）
      if (status.durationMillis && status.durationMillis < 1000) {
        console.warn(`[VideoFeedCard] Video too short (${status.durationMillis}ms), skipping auto-swipe: phrase=${phrase.id}`);
        return;
      }

      // 再生回数をインクリメント
      playCountRef.current += 1;
      const currentPlayCount = playCountRef.current;
      console.log(`[VideoFeedCard] Play completed: phrase=${phrase.id}, count=${currentPlayCount}/${repeatCount}`);

      // 指定回数に達したら自動スワイプ
      if (currentPlayCount >= repeatCount) {
        // PlaybackLogを記録（カード完了時のみ送信 - API負荷軽減）
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
          // 既存のタイマーをクリア（ゾンビタイマー防止）
          if (autoSwipeTimerRef.current) {
            clearTimeout(autoSwipeTimerRef.current);
          }
          // 新しいタイマーをセット
          autoSwipeTimerRef.current = setTimeout(() => {
            autoSwipeTimerRef.current = null;
            onAutoSwipe();
          }, 500); // 少し遅延させて自然な動きに
        }
      }
    };

    const handleVideoPress = () => {
      setIsPlaying(!isPlaying);
    };

    const handleVideoError = useCallback((error: string) => {
      console.warn(`[VideoFeedCard] Video error: phrase=${phrase.id}, url=${phrase.video_url?.substring(0, 50)}..., error=${error}`);
      setVideoError(error);
      // エラー時もサムネイルを表示したままにする
      // 注意: エラー時は自動スワイプしない（ユーザーが手動でスワイプする必要がある）
    }, [phrase.id, phrase.video_url]);

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

    const handleSettingsPress = () => {
      router.push('/settings');
    };

    const handleSearchPress = () => {
      router.push('/search');
    };

    const handleTabPress = (targetIndex: number) => {
      if (targetIndex !== horizontalIndex) {
        horizontalFlatListRef.current?.scrollToIndex({ index: targetIndex, animated: true });
      }
    };

    // Expression動画が存在するか確認
    const hasExpressions = horizontalItems.length > 1;

    const renderHorizontalItem = ({ item, index }: { item: typeof horizontalItems[0]; index: number }) => {
      if (item.type === 'phrase') {
        // タブバーがある場合は動画をヘッダーの下に配置（実測値を使用）
        const videoMarginTop = hasExpressions && tabBarHeight > 0 ? tabBarHeight : 0;


        return (
          <View style={styles.container}>
            {phrase.video_url ? (
              <>
                                {isActive && horizontalIndex === 0 && isLoadRegistered ? (
                <Video
                  ref={videoRef}
                  source={{ uri: phrase.video_url }}
                  style={[styles.video, { marginTop: videoMarginTop }]}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={isPlaying && shouldPlayVideo && !videoError}
                  isLooping={true}
                  onPlaybackStatusUpdate={handlePlaybackStatus}
                  onError={handleVideoError}
                />
                ) : null}
                
                <Pressable style={styles.playPauseArea} onPress={handleVideoPress}>
                  {!isPlaying && (
                    <View style={styles.playIconContainer}>
                      <Text style={styles.playIcon}>▶</Text>
                    </View>
                  )}
                </Pressable>
              </>
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>動画がありません</Text>
              </View>
            )}

            <View style={styles.overlay}>
              <View style={[styles.buttonGroup, { bottom: insets.bottom + 46 }]}>
                <View style={styles.masteredButtonContainer}>
                  <Pressable
                    onPress={handleMasteredPress}
                    style={[styles.masteredButton, isMastered && styles.masteredButtonActive]}
                  >
                    <Text style={[styles.masteredButtonText, isMastered && styles.masteredButtonTextActive]}>
                      Master
                    </Text>
                  </Pressable>
                  {/* キラキラエフェクト */}
                  {showSparkle && (
                    <>
                      {/* パルス効果（ボタンの輝き） */}
                      <Animated.View
                        style={[
                          styles.pulseGlow,
                          {
                            opacity: pulseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 0.8],
                            }),
                            transform: [
                              {
                                scale: pulseAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [1, 1.8],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                      {/* 第1波 - 大きな星 */}
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim1.interpolate({
                              inputRange: [0, 0.3, 0.8, 1],
                              outputRange: [0, 1, 0.8, 0],
                            }),
                            transform: [
                              { translateX: -8 },
                              { translateY: -8 },
                              {
                                scale: sparkleAnim1.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.3, 2, 0.5],
                                }),
                              },
                              {
                                translateX: sparkleAnim1.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -45],
                                }),
                              },
                              {
                                translateY: sparkleAnim1.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -35],
                                }),
                              },
                              {
                                rotate: sparkleAnim1.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '180deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.sparkleTextLarge}>✦</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim1.interpolate({
                              inputRange: [0, 0.3, 0.8, 1],
                              outputRange: [0, 1, 0.8, 0],
                            }),
                            transform: [
                              { translateX: -8 },
                              { translateY: -8 },
                              {
                                scale: sparkleAnim1.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.3, 1.8, 0.3],
                                }),
                              },
                              {
                                translateX: sparkleAnim1.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 50],
                                }),
                              },
                              {
                                translateY: sparkleAnim1.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -25],
                                }),
                              },
                              {
                                rotate: sparkleAnim1.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '-120deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.sparkleTextLarge}>✧</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim1.interpolate({
                              inputRange: [0, 0.3, 0.8, 1],
                              outputRange: [0, 1, 0.8, 0],
                            }),
                            transform: [
                              { translateX: -8 },
                              { translateY: -8 },
                              {
                                scale: sparkleAnim1.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.3, 1.6, 0.4],
                                }),
                              },
                              {
                                translateX: sparkleAnim1.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -35],
                                }),
                              },
                              {
                                translateY: sparkleAnim1.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 30],
                                }),
                              },
                              {
                                rotate: sparkleAnim1.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '90deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.sparkleTextLarge}>⋆</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim1.interpolate({
                              inputRange: [0, 0.3, 0.8, 1],
                              outputRange: [0, 1, 0.8, 0],
                            }),
                            transform: [
                              { translateX: -8 },
                              { translateY: -8 },
                              {
                                scale: sparkleAnim1.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.3, 2.2, 0.5],
                                }),
                              },
                              {
                                translateX: sparkleAnim1.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 40],
                                }),
                              },
                              {
                                translateY: sparkleAnim1.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 28],
                                }),
                              },
                              {
                                rotate: sparkleAnim1.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '200deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.sparkleTextLarge}>✦</Text>
                      </Animated.View>
                      {/* 第2波 - 中くらいの星 */}
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim2.interpolate({
                              inputRange: [0, 0.3, 0.8, 1],
                              outputRange: [0, 1, 0.6, 0],
                            }),
                            transform: [
                              { translateX: -6 },
                              { translateY: -6 },
                              {
                                scale: sparkleAnim2.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.2, 1.5, 0.3],
                                }),
                              },
                              {
                                translateX: sparkleAnim2.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -55],
                                }),
                              },
                              {
                                translateY: sparkleAnim2.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -10],
                                }),
                              },
                              {
                                rotate: sparkleAnim2.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '150deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.sparkleTextMedium}>✧</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim2.interpolate({
                              inputRange: [0, 0.3, 0.8, 1],
                              outputRange: [0, 1, 0.6, 0],
                            }),
                            transform: [
                              { translateX: -6 },
                              { translateY: -6 },
                              {
                                scale: sparkleAnim2.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.2, 1.4, 0.2],
                                }),
                              },
                              {
                                translateX: sparkleAnim2.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 55],
                                }),
                              },
                              {
                                translateY: sparkleAnim2.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 5],
                                }),
                              },
                              {
                                rotate: sparkleAnim2.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '-100deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.sparkleTextMedium}>✦</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim2.interpolate({
                              inputRange: [0, 0.3, 0.8, 1],
                              outputRange: [0, 1, 0.6, 0],
                            }),
                            transform: [
                              { translateX: -6 },
                              { translateY: -6 },
                              {
                                scale: sparkleAnim2.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.2, 1.3, 0.3],
                                }),
                              },
                              {
                                translateX: sparkleAnim2.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 10],
                                }),
                              },
                              {
                                translateY: sparkleAnim2.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -45],
                                }),
                              },
                              {
                                rotate: sparkleAnim2.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '80deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.sparkleTextMedium}>⋆</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim2.interpolate({
                              inputRange: [0, 0.3, 0.8, 1],
                              outputRange: [0, 1, 0.6, 0],
                            }),
                            transform: [
                              { translateX: -6 },
                              { translateY: -6 },
                              {
                                scale: sparkleAnim2.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.2, 1.5, 0.2],
                                }),
                              },
                              {
                                translateX: sparkleAnim2.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -15],
                                }),
                              },
                              {
                                translateY: sparkleAnim2.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 45],
                                }),
                              },
                              {
                                rotate: sparkleAnim2.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '-60deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.sparkleTextMedium}>✧</Text>
                      </Animated.View>
                      {/* 第3波 - 小さな星 */}
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim3.interpolate({
                              inputRange: [0, 0.3, 0.7, 1],
                              outputRange: [0, 1, 0.5, 0],
                            }),
                            transform: [
                              { translateX: -4 },
                              { translateY: -4 },
                              {
                                scale: sparkleAnim3.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.2, 1.2, 0.1],
                                }),
                              },
                              {
                                translateX: sparkleAnim3.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -40],
                                }),
                              },
                              {
                                translateY: sparkleAnim3.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -50],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.sparkleTextSmall}>✦</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim3.interpolate({
                              inputRange: [0, 0.3, 0.7, 1],
                              outputRange: [0, 1, 0.5, 0],
                            }),
                            transform: [
                              { translateX: -4 },
                              { translateY: -4 },
                              {
                                scale: sparkleAnim3.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.2, 1.1, 0.1],
                                }),
                              },
                              {
                                translateX: sparkleAnim3.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 60],
                                }),
                              },
                              {
                                translateY: sparkleAnim3.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -35],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.sparkleTextSmall}>✧</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim3.interpolate({
                              inputRange: [0, 0.3, 0.7, 1],
                              outputRange: [0, 1, 0.5, 0],
                            }),
                            transform: [
                              { translateX: -4 },
                              { translateY: -4 },
                              {
                                scale: sparkleAnim3.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.2, 1.3, 0.1],
                                }),
                              },
                              {
                                translateX: sparkleAnim3.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 50],
                                }),
                              },
                              {
                                translateY: sparkleAnim3.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 40],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.sparkleTextSmall}>⋆</Text>
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.sparkle,
                          { top: '50%', left: '50%' },
                          {
                            opacity: sparkleAnim3.interpolate({
                              inputRange: [0, 0.3, 0.7, 1],
                              outputRange: [0, 1, 0.5, 0],
                            }),
                            transform: [
                              { translateX: -4 },
                              { translateY: -4 },
                              {
                                scale: sparkleAnim3.interpolate({
                                  inputRange: [0, 0.5, 1],
                                  outputRange: [0.2, 1.0, 0.1],
                                }),
                              },
                              {
                                translateX: sparkleAnim3.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -60],
                                }),
                              },
                              {
                                translateY: sparkleAnim3.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 20],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.sparkleTextSmall}>✦</Text>
                      </Animated.View>
                    </>
                  )}
                </View>
                <Pressable
                  onPress={handleFavoritePress}
                  style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
                >
                  <Text style={[styles.favoriteIcon, isFavorite && styles.favoriteIconActive]}>{isFavorite ? '★' : '☆'}</Text>
                  <Text style={[styles.favoriteLabel, isFavorite && styles.favoriteLabelActive]}>Keep</Text>
                </Pressable>
                <Pressable
                  onPress={handleFavoritesListPress}
                  style={styles.iconButton}
                >
                  <Text style={styles.iconButtonTextYellow}>★</Text>
                </Pressable>
                <Pressable
                  onPress={handleSearchPress}
                  style={styles.iconButton}
                >
                  <Text style={styles.iconButtonText}>🔍</Text>
                </Pressable>
                <Pressable
                  onPress={handleSettingsPress}
                  style={styles.iconButton}
                >
                  <Text style={styles.iconButtonText}>⚙</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.textOverlay, { bottom: insets.bottom + 106 }]}>
              <Text style={styles.phraseText}>{phrase.text}</Text>
              {showJapanese && <Text style={styles.meaningText}>{phrase.meaning}</Text>}
            </View>
          </View>
        );
      } else {
        // Expression動画
        return (
          <ExpressionVideoCard
            ref={(ref) => {
              if (ref) {
                expressionVideoRefs.current.set(index - 1, ref);
              } else {
                expressionVideoRefs.current.delete(index - 1);
              }
            }}
            expression={item.data}
            isActive={isActive && horizontalIndex === index}
            showJapanese={showJapanese}
            tabBarHeight={tabBarHeight}
          />
        );
      }
    };

    return (
      <View style={styles.wrapper}>
        {/* タブバー（ヘッダー部分） */}
        {hasExpressions && (
          <View
            style={[styles.tabBar, { paddingTop: insets.top }]}
            onLayout={(event) => {
              const { height } = event.nativeEvent.layout;
              if (height !== tabBarHeight) {
                setTabBarHeight(height);
              }
            }}
          >
            <Pressable style={styles.tabItem} onPress={() => handleTabPress(0)}>
              <Text style={[styles.tabText, horizontalIndex === 0 && styles.tabTextActive]}>
                Word
              </Text>
              {horizontalIndex === 0 && <View style={styles.tabUnderline} />}
            </Pressable>
            <Pressable style={styles.tabItem} onPress={() => handleTabPress(1)}>
              <Text style={[styles.tabText, horizontalIndex > 0 && styles.tabTextActive]}>
                Phrase
              </Text>
              {horizontalIndex > 0 && <View style={styles.tabUnderline} />}
            </Pressable>
          </View>
        )}

        <FlatList
          ref={horizontalFlatListRef}
          data={horizontalItems}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderItem={renderHorizontalItem}
          horizontal
          pagingEnabled
          snapToInterval={SCREEN_WIDTH}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onHorizontalViewableItemsChanged}
          viewabilityConfig={HORIZONTAL_VIEWABILITY_CONFIG}
          removeClippedSubviews={true}
          windowSize={1}
          maxToRenderPerBatch={1}
          initialNumToRender={1}
          getItemLayout={(data, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />
      </View>
    );
  }
);

VideoFeedCard.displayName = 'VideoFeedCard';

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    marginTop: -80,
  },
  thumbnail: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
    marginTop: -80,
  },
  playPauseArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
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
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
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
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
});
