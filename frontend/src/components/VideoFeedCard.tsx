import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AVPlaybackStatus, AVPlaybackStatusSuccess, Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhraseSummary } from '../api/types';
import { usePlaybackLogger } from '../hooks/usePlaybackLogger';
import { useUserSettings } from '../hooks/useUserSettings';
import { useAuth } from '../providers/AuthProvider';

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
    const playbackLogger = usePlaybackLogger();
    const insets = useSafeAreaInsets();
    const { signOut } = useAuth();
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const { settingsQuery } = useUserSettings();
    const playCountRef = useRef(0);
    const repeatCount = settingsQuery.data?.repeat_count ?? 1;
    const showJapanese = settingsQuery.data?.show_japanese ?? true;

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

    useEffect(() => {
      if (isActive) {
        playCountRef.current = 0; // 新しい動画になったらカウントリセット
        setIsPlaying(true); // 新しい動画は自動再生
        setIsVideoLoaded(false); // 動画をリロード
      } else {
        videoRef.current?.pauseAsync();
      }
    }, [isActive]);

    useEffect(() => {
      if (isActive && isPlaying) {
        // 少し遅延させて動画が読み込まれるのを待つ
        const timer = setTimeout(() => {
          videoRef.current?.playAsync();
        }, 100);
        return () => clearTimeout(timer);
      } else if (!isPlaying) {
        videoRef.current?.pauseAsync();
      }
    }, [isActive, isPlaying]);

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
      if (currentPlayCount >= repeatCount && onAutoSwipe) {
        setTimeout(() => {
          onAutoSwipe();
        }, 500); // 少し遅延させて自然な動きに
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

    return (
      <View style={styles.container}>
        {phrase.video_url ? (
          <>
            <Video
              ref={videoRef}
              source={{ uri: phrase.video_url }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={isActive && isPlaying}
              isLooping
              onPlaybackStatusUpdate={handlePlaybackStatus}
            />
            {/* サムネイルプレビュー（動画読み込み中のみ表示） */}
            {!isVideoLoaded && phrase.scene_image_url && (
              <Image
                source={{ uri: phrase.scene_image_url }}
                style={styles.thumbnail}
                resizeMode="contain"
              />
            )}
            {/* 再生/停止用のタップエリア */}
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

        {/* オーバーレイコンテンツ */}
        <View style={styles.overlay}>
          {/* 右下のボタングループ */}
          <View style={styles.buttonGroup}>
            {/* Masteredボタン */}
            <Pressable
              onPress={handleMasteredPress}
              style={[styles.masteredButton, isMastered && styles.masteredButtonActive]}
            >
              <Text style={[styles.masteredButtonText, isMastered && styles.masteredButtonTextActive]}>
                {isMastered ? '✓ Mastered' : 'Mastered'}
              </Text>
            </Pressable>
            {/* Keepボタン */}
            <Pressable
              onPress={handleFavoritePress}
              style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
            >
              <Text style={styles.favoriteIcon}>{isFavorite ? '★' : '☆'}</Text>
              <Text style={styles.favoriteLabel}>Keep</Text>
            </Pressable>
          </View>
        </View>

        {/* テキスト情報（動画の上にオーバーレイ） */}
        <Pressable style={styles.textOverlay} onPress={onPress}>
          <Text style={styles.phraseText}>{phrase.text}</Text>
          {showJapanese && <Text style={styles.meaningText}>{phrase.meaning}</Text>}
        </Pressable>
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
    bottom: 140,
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
    bottom: 280,
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
});
