import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View, ViewToken } from 'react-native';
import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess, Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Expression, PhraseSummary } from '../api/types';
import { usePlaybackLogger } from '../hooks/usePlaybackLogger';
import { useUserSettings } from '../hooks/useUserSettings';
import { useAuth } from '../providers/AuthProvider';
import { ExpressionVideoCard, ExpressionVideoCardRef } from './ExpressionVideoCard';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

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
    const { settingsQuery } = useUserSettings();
    const playCountRef = useRef(0);
    const repeatCount = settingsQuery.data?.repeat_count ?? 3;
    const showJapanese = settingsQuery.data?.show_japanese ?? true;
    const [horizontalIndex, setHorizontalIndex] = useState(0);
    const horizontalFlatListRef = useRef<FlatList>(null);
    const [shouldPlayVideo, setShouldPlayVideo] = useState(true);
    const [tabBarHeight, setTabBarHeight] = useState(0);

    // 横スワイプアイテム: メインフレーズ + Expression動画
    const horizontalItems = [
      { type: 'phrase' as const, data: phrase },
      ...(phrase.expressions || []).map(pe => ({ type: 'expression' as const, data: pe.expression }))
    ];

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

    // Audio modeを設定（音声再生を有効化）
    useEffect(() => {
      Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    }, []);

    const onHorizontalViewableItemsChanged = useCallback(
      ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
          const index = viewableItems[0].index;
          if (index !== null && index !== horizontalIndex) {
            setHorizontalIndex(index);
          }
        }
      },
      [horizontalIndex]
    );

    const horizontalViewabilityConfig = useRef({
      itemVisiblePercentThreshold: 80,
    });

    // phrase idが変わった時に横スワイプとカウントをリセット
    useEffect(() => {
      setHorizontalIndex(0);
      playCountRef.current = 0;
      setShouldPlayVideo(true);
      setIsVideoLoaded(false);    // ロード状態もリセット
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
        setIsVideoLoaded(true);
      }

      if (!isPlaybackSuccess(status) || !status.didJustFinish) {
        return;
      }

      // 再生回数をインクリメント
      playCountRef.current += 1;
      const currentPlayCount = playCountRef.current;

      // PlaybackLogを記録
      if (!playbackLogger.isPending) {
        playbackLogger.mutate({
          phrase_id: phrase.id,
          play_ms: status.positionMillis ?? 0,
          completed: true,
          source: 'feed',
        });
      }

      // 指定回数に達したら自動スワイプ
      if (currentPlayCount >= repeatCount) {
        setShouldPlayVideo(false);
        if (onAutoSwipe) {
          setTimeout(() => {
            onAutoSwipe();
          }, 500); // 少し遅延させて自然な動きに
        }
      }
    };

    const handleVideoPress = () => {
      setIsPlaying(!isPlaying);
    };

    const handleFavoritePress = () => {
      if (isGuest) {
        Alert.alert(
          'Account Required',
          'Keep feature is only available for registered users. Please create an account to save videos for later review.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Up', onPress: () => signOut() },
          ]
        );
        return;
      }
      onToggleFavorite(!isFavorite);
    };

    const handleMasteredPress = () => {
      if (isGuest) {
        Alert.alert(
          'Account Required',
          'Mastered feature is only available for registered users. Please create an account to track your progress.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Up', onPress: () => signOut() },
          ]
        );
        return;
      }
      onToggleMastered(!isMastered);
    };

    const handleFavoritesListPress = () => {
      if (isGuest) {
        Alert.alert(
          'Account Required',
          'Keep feature is only available for registered users. Please create an account to save videos for later review.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Up', onPress: () => signOut() },
          ]
        );
        return;
      }
      router.push('/favorites');
    };

    const handleSettingsPress = () => {
      router.push('/settings');
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
        const videoMarginTop = hasExpressions && tabBarHeight > 0 ? tabBarHeight - 80 : -80;


        return (
          <View style={styles.container}>
            {phrase.video_url ? (
              <>
                <Video
                  ref={videoRef}
                  source={{ uri: phrase.video_url }}
                  style={[styles.video, { marginTop: videoMarginTop }]}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={isActive && isPlaying && horizontalIndex === 0 && shouldPlayVideo}
                  isLooping={true}
                  onPlaybackStatusUpdate={handlePlaybackStatus}
                />
                {!isVideoLoaded && phrase.scene_image_url && (
                  <Image
                    source={{ uri: phrase.scene_image_url }}
                    style={[styles.thumbnail, { marginTop: videoMarginTop }]}
                    resizeMode="contain"
                  />
                )}
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
                <Text style={styles.placeholderText}>No video available</Text>
              </View>
            )}

            <View style={styles.overlay}>
              <View style={styles.buttonGroup}>
                <Pressable
                  onPress={handleMasteredPress}
                  style={[styles.masteredButton, isMastered && styles.masteredButtonActive]}
                >
                  <Text style={[styles.masteredButtonText, isMastered && styles.masteredButtonTextActive]}>
                    {isMastered ? '✓ Mastered' : 'Mastered'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleFavoritePress}
                  style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
                >
                  <Text style={styles.favoriteIcon}>{isFavorite ? '★' : '☆'}</Text>
                  <Text style={styles.favoriteLabel}>Keep</Text>
                </Pressable>
                <Pressable
                  onPress={handleFavoritesListPress}
                  style={styles.iconButton}
                >
                  <Text style={styles.iconButtonText}>★</Text>
                </Pressable>
                <Pressable
                  onPress={handleSettingsPress}
                  style={styles.iconButton}
                >
                  <Text style={styles.iconButtonText}>⚙</Text>
                </Pressable>
              </View>
            </View>

            <Pressable style={styles.textOverlay} onPress={onPress}>
              <Text style={styles.phraseText}>{phrase.text}</Text>
              {showJapanese && <Text style={styles.meaningText}>{phrase.meaning}</Text>}
            </Pressable>
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
              setTabBarHeight(height);
            }}
          >
            <Pressable style={styles.tabItem} onPress={() => handleTabPress(0)}>
              <Text style={[styles.tabText, horizontalIndex === 0 && styles.tabTextActive]}>
                英単語
              </Text>
              {horizontalIndex === 0 && <View style={styles.tabUnderline} />}
            </Pressable>
            <Pressable style={styles.tabItem} onPress={() => handleTabPress(1)}>
              <Text style={[styles.tabText, horizontalIndex > 0 && styles.tabTextActive]}>
                サンプルフレーズ
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
          viewabilityConfig={horizontalViewabilityConfig.current}
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
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
  favoriteLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  masteredButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
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
    backgroundColor: '#ffffff',
  },
});
