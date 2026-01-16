import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AVPlaybackStatus,
  AVPlaybackStatusSuccess,
  Video,
  ResizeMode,
} from 'expo-av';
import { Expression } from '../api/types';
import { useVideoLoading } from '../contexts/VideoLoadingContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  expression: Expression;
  isActive: boolean;
  showJapanese: boolean;
  tabBarHeight?: number;
}

export interface ExpressionVideoCardRef {
  play: () => void;
  pause: () => void;
}

function isPlaybackSuccess(
  status: AVPlaybackStatus
): status is AVPlaybackStatusSuccess {
  return status.isLoaded;
}

export const ExpressionVideoCard = forwardRef<ExpressionVideoCardRef, Props>(
  ({ expression, isActive, showJapanese, tabBarHeight = 0 }, ref) => {
    const insets = useSafeAreaInsets();
    const videoRef = useRef<Video | null>(null);
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [isLandscape, setIsLandscape] = useState<boolean | null>(null);

    // ロードオーバーレイのフェードアウト用
    const overlayOpacity = useRef(new Animated.Value(1)).current;


    // デコーダ枯渇防止: ロード制御
    const { registerLoading, unregisterLoading } = useVideoLoading();
    const [isLoadRegistered, setIsLoadRegistered] = useState(false);
    const videoId = `expression-${expression.id}`;
    const loadRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // デコーダ枯渇防止: ロード登録制御
    useEffect(() => {
      if (isActive) {
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
    }, [isActive, videoId, registerLoading, unregisterLoading]);

    // コンポーネントのアンマウント時に登録解除
    useEffect(() => {
      return () => {
        unregisterLoading(videoId);
      };
    }, [videoId, unregisterLoading]);

    useEffect(() => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      setIsVideoLoaded(false);
      setVideoError(null);
      setIsLandscape(null);
      overlayOpacity.setValue(1);
    }, [expression.id, overlayOpacity]);

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
        setIsVideoLoaded(false);
      } else {
        videoRef.current?.pauseAsync();
        if (replayTimerRef.current) {
          clearTimeout(replayTimerRef.current);
          replayTimerRef.current = null;
        }
      }
    }, [isActive]);

    useEffect(() => {
      if (isActive && isPlaying) {
        const timer = setTimeout(() => {
          videoRef.current?.playAsync();
        }, 100);
        return () => clearTimeout(timer);
      } else if (!isPlaying) {
        videoRef.current?.pauseAsync();
      }
    }, [isActive, isPlaying]);

    const handlePlaybackStatus = (status: AVPlaybackStatus) => {
      if (isPlaybackSuccess(status) && !isVideoLoaded) {
        setIsVideoLoaded(true);
      }

      // 動画終了時: 1秒静止してからリプレイ
      if (isPlaybackSuccess(status) && status.didJustFinish) {
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

    const handleVideoPress = () => {
      setIsPlaying(!isPlaying);
    };

    const handleVideoError = (error: string) => {
      console.warn('[ExpressionVideoCard] Video error:', error);
      setVideoError(error);
    };

    return (
      <View style={styles.container}>
        {expression.video_url ? (
          <>
            {isActive ? (
              <>
                <Video
                  key={expression.id}
                  ref={videoRef}
                  source={{ uri: expression.video_url }}
                  style={{
                    position: 'absolute',
                    width: SCREEN_WIDTH,
                    height: SCREEN_HEIGHT - tabBarHeight,
                    top: tabBarHeight,
                    left: 0,
                  }}
                  resizeMode={isLandscape === false ? ResizeMode.COVER : ResizeMode.CONTAIN}
                  shouldPlay={isLoadRegistered && isPlaying && !videoError}
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
                    }
                    setIsVideoLoaded(true);
                  }}
                  onError={handleVideoError}
                />
                {!videoError && (
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.loadingOverlay, { opacity: overlayOpacity }]}
                  />
                )}
              </>
            ) : null}

            {/* エラー表示 */}
            {videoError && (
              <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>動画を読み込めませんでした</Text>
              </View>
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
        <View style={[styles.textOverlay, { bottom: insets.bottom + 106 }]} pointerEvents="none">
          <Text style={styles.expressionText}>{expression.text}</Text>
          {showJapanese && (
            <Text style={styles.meaningText}>{expression.meaning}</Text>
          )}
        </View>
      </View>
    );
  }
);

ExpressionVideoCard.displayName = 'ExpressionVideoCard';

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d1b2a',
  },
  placeholderText: {
    color: '#ffffff',
    fontSize: 16,
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
  errorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  textOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    rowGap: 12,
    alignItems: 'center',
  },
  expressionText: {
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
});
