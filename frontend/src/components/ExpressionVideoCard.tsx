import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AVPlaybackStatus, AVPlaybackStatusSuccess, Video, ResizeMode } from 'expo-av';
import { Expression } from '../api/types';
import { useVideoLoading } from '../contexts/VideoLoadingContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  expression: Expression;
  isActive: boolean;
  shouldPreload?: boolean;
  showJapanese: boolean;
  tabBarHeight?: number;
}

export interface ExpressionVideoCardRef {
  play: () => void;
  pause: () => void;
}

function isPlaybackSuccess(status: AVPlaybackStatus): status is AVPlaybackStatusSuccess {
  return status.isLoaded;
}

export const ExpressionVideoCard = forwardRef<ExpressionVideoCardRef, Props>(
  ({ expression, isActive, shouldPreload = false, showJapanese, tabBarHeight = 0 }, ref) => {
    const insets = useSafeAreaInsets();
    const videoRef = useRef<Video | null>(null);
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [videoError, setVideoError] = useState<string | null>(null);

    // 動画ロードキュー管理
    const { registerLoading, unregisterLoading } = useVideoLoading();
    const videoIdRef = useRef(`expression-${expression.id}`);
    const isRegisteredRef = useRef(false);
    const [canLoadVideo, setCanLoadVideo] = useState(false);

    // 動画IDが変わった場合にリセット
    useEffect(() => {
      const oldVideoId = videoIdRef.current;
      videoIdRef.current = `expression-${expression.id}`;
      if (oldVideoId !== videoIdRef.current && isRegisteredRef.current) {
        unregisterLoading(oldVideoId);
        isRegisteredRef.current = false;
      }
    }, [expression.id, unregisterLoading]);

    // ロード可能かチェック（isActive または shouldPreload の場合）
    useEffect(() => {
      const shouldTryLoad = isActive || shouldPreload;

      if (shouldTryLoad && !isRegisteredRef.current) {
        const canRegister = registerLoading(videoIdRef.current);
        if (canRegister) {
          isRegisteredRef.current = true;
          setCanLoadVideo(true);
          console.log(`[ExpressionVideoCard] Video can load: ${videoIdRef.current}`);
        } else {
          setCanLoadVideo(false);
          console.log(`[ExpressionVideoCard] Video load blocked: ${videoIdRef.current}`);
        }
      } else if (!shouldTryLoad && isRegisteredRef.current) {
        // アクティブでなくなったら登録解除
        unregisterLoading(videoIdRef.current);
        isRegisteredRef.current = false;
        setCanLoadVideo(false);
      }
    }, [isActive, shouldPreload, registerLoading, unregisterLoading]);

    // コンポーネントアンマウント時にクリーンアップ
    useEffect(() => {
      return () => {
        if (isRegisteredRef.current) {
          unregisterLoading(videoIdRef.current);
          isRegisteredRef.current = false;
        }
      };
    }, [unregisterLoading]);

    // 動画ロード完了時にスロットを解放（プリロードの場合のみ）
    const handleVideoReadyForDisplay = useCallback(() => {
      console.log(`[ExpressionVideoCard] Video ready: ${videoIdRef.current}`);
      // プリロードで待機中の場合、ロード完了後にスロットを解放して他の動画がロードできるようにする
      // ただし、アクティブな動画は再生中なので解放しない
      if (!isActive && isRegisteredRef.current) {
        unregisterLoading(videoIdRef.current);
        isRegisteredRef.current = false;
        // 解放後もcanLoadVideoはtrueのままにして動画を表示し続ける
      }
    }, [isActive, unregisterLoading]);

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

    // Audio modeはVideoFeedCardで初期化済み（重複を避ける）

    // expression idが変わった時にリセット
    useEffect(() => {
      setIsVideoLoaded(false);
      setVideoError(null);
    }, [expression.id]);

    useEffect(() => {
      if (isActive) {
        setIsPlaying(true);
        setIsVideoLoaded(false);
      } else {
        videoRef.current?.pauseAsync();
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
    };

    const handleVideoPress = () => {
      setIsPlaying(!isPlaying);
    };

    const handleVideoError = useCallback((error: string) => {
      console.warn('[ExpressionVideoCard] Video error:', error);
      setVideoError(error);
      // エラー時もスロットを解放
      if (isRegisteredRef.current) {
        unregisterLoading(videoIdRef.current);
        isRegisteredRef.current = false;
      }
    }, [unregisterLoading]);

    // タブバーがある場合は動画をヘッダーの下に配置（実測値を使用）
    const videoMarginTop = tabBarHeight > 0 ? tabBarHeight - 80 : -80;

    // ロードスロットが確保できているか、または既にロード済みかをチェック
    const shouldRenderVideo = canLoadVideo || isVideoLoaded;

    return (
      <View style={styles.container}>
        {expression.video_url ? (
          <>
            {shouldRenderVideo ? (
              <Video
                ref={videoRef}
                source={{ uri: expression.video_url }}
                style={[styles.video, { marginTop: videoMarginTop }]}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={isActive && isPlaying && !videoError}
                isLooping
                onPlaybackStatusUpdate={handlePlaybackStatus}
                onReadyForDisplay={handleVideoReadyForDisplay}
                onError={handleVideoError}
              />
            ) : (
              // ロード待機中のプレースホルダー
              (isActive || shouldPreload) ? (
                <View style={[styles.loadingPlaceholder, { marginTop: videoMarginTop }]}>
                  <ActivityIndicator size="large" color="#ffffff" />
                  <Text style={styles.loadingText}>Loading...</Text>
                </View>
              ) : null
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

        {/* テキスト情報 */}
        <View style={[styles.textOverlay, { bottom: insets.bottom + 106 }]}>
          <Text style={styles.expressionText}>{expression.text}</Text>
          {showJapanese && <Text style={styles.meaningText}>{expression.meaning}</Text>}
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
  loadingPlaceholder: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 12,
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
