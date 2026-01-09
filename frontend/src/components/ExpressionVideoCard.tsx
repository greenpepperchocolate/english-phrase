import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AVPlaybackStatus, AVPlaybackStatusSuccess, Video, ResizeMode } from 'expo-av';
import { Expression } from '../api/types';

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

function isPlaybackSuccess(status: AVPlaybackStatus): status is AVPlaybackStatusSuccess {
  return status.isLoaded;
}

export const ExpressionVideoCard = forwardRef<ExpressionVideoCardRef, Props>(
  ({ expression, isActive, showJapanese, tabBarHeight = 0 }, ref) => {
    const insets = useSafeAreaInsets();
    const videoRef = useRef<Video | null>(null);
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [videoError, setVideoError] = useState<string | null>(null);

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

    const handleVideoError = (error: string) => {
      console.warn('[ExpressionVideoCard] Video error:', error);
      setVideoError(error);
    };

    const videoMarginTop = tabBarHeight > 0 ? tabBarHeight - 80 : -80;

    return (
      <View style={styles.container}>
        {expression.video_url ? (
          <>
            {isActive ? (
              <Video
                ref={videoRef}
                source={{ uri: expression.video_url }}
                style={[styles.video, { marginTop: videoMarginTop }]}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={isPlaying && !videoError}
                isLooping
                onPlaybackStatusUpdate={handlePlaybackStatus}
                onError={handleVideoError}
              />
            ) : null}
            {(!isActive || !isVideoLoaded || videoError) && expression.scene_image_url && (
              <Image
                source={{ uri: expression.scene_image_url }}
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
