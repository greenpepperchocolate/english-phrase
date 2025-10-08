import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AVPlaybackStatus, AVPlaybackStatusSuccess, Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhraseSummary } from '../api/types';
import { usePlaybackLogger } from '../hooks/usePlaybackLogger';
import { useUserSettings } from '../hooks/useUserSettings';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  phrase: PhraseSummary;
  isActive: boolean;
  isFavorite: boolean;
  onToggleFavorite: (next: boolean) => void;
  onPress: () => void;
  onAutoSwipe?: () => void;
}

export interface VideoFeedCardRef {
  play: () => void;
  pause: () => void;
}

function isPlaybackSuccess(status: AVPlaybackStatus): status is AVPlaybackStatusSuccess {
  return status.isLoaded;
}

export const VideoFeedCard = forwardRef<VideoFeedCardRef, Props>(
  ({ phrase, isActive, isFavorite, onToggleFavorite, onPress, onAutoSwipe }, ref) => {
    const videoRef = useRef<Video | null>(null);
    const playbackLogger = usePlaybackLogger();
    const insets = useSafeAreaInsets();
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const { settingsQuery } = useUserSettings();
    const playCountRef = useRef(0);
    const repeatCount = settingsQuery.data?.repeat_count ?? 1;

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
        videoRef.current?.playAsync();
        playCountRef.current = 0; // 新しい動画になったらカウントリセット
      } else {
        videoRef.current?.pauseAsync();
      }
    }, [isActive]);

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

    return (
      <View style={styles.container}>
        {phrase.video_url ? (
          <>
            <Video
              ref={videoRef}
              source={{ uri: phrase.video_url }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={isActive}
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
          </>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No video available</Text>
          </View>
        )}

        {/* オーバーレイコンテンツ */}
        <View style={styles.overlay}>
          {/* 右下のお気に入りボタン */}
          <View style={styles.favoriteButtonContainer}>
            <Pressable
              onPress={() => onToggleFavorite(!isFavorite)}
              style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
            >
              <Text style={styles.favoriteIcon}>{isFavorite ? '★' : '☆'}</Text>
              <Text style={styles.favoriteLabel}>Favorite</Text>
            </Pressable>
          </View>
        </View>

        {/* テキスト情報（動画の上にオーバーレイ） */}
        <Pressable style={styles.textOverlay} onPress={onPress}>
          <Text style={styles.phraseText}>{phrase.text}</Text>
          <Text style={styles.meaningText}>{phrase.meaning}</Text>
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
  favoriteButtonContainer: {
    position: 'absolute',
    right: 16,
    bottom: 140,
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
    fontSize: 28,
    fontWeight: '700',
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
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
