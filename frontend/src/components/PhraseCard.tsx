import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AVPlaybackStatus, AVPlaybackStatusSuccess, Video, ResizeMode } from 'expo-av';
import { PhraseSummary } from '../api/types';
import { usePlaybackLogger } from '../hooks/usePlaybackLogger';

interface Props {
  phrase: PhraseSummary;
  onPress: () => void;
  isFavorite: boolean;
  onToggleFavorite: (next: boolean) => void;
}

function isPlaybackSuccess(status: AVPlaybackStatus): status is AVPlaybackStatusSuccess {
  return status.isLoaded;
}

export function PhraseCard({ phrase, onPress, isFavorite, onToggleFavorite }: Props) {
  const video = useRef<Video | null>(null);
  const playbackLogger = usePlaybackLogger();

  const handlePlaybackStatus = (status: AVPlaybackStatus) => {
    if (!isPlaybackSuccess(status) || !status.didJustFinish || playbackLogger.isPending) {
      return;
    }
    playbackLogger.mutate({
      phrase_id: phrase.id,
      play_ms: status.positionMillis ?? 0,
      completed: true,
      source: 'feed',
    });
  };

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityHint="Open phrase details">
      <View style={styles.videoContainer}>
        {phrase.video_url ? (
          <Video
            ref={video}
            source={{ uri: phrase.video_url }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isLooping
            onPlaybackStatusUpdate={handlePlaybackStatus}
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoPlaceholderText}>No video available</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.topic}>{phrase.topic.toUpperCase()}</Text>
        <Text style={styles.text}>{phrase.text}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{phrase.difficulty}</Text>
          <Text style={styles.meta}>{phrase.duration_sec}s</Text>
          <Pressable
            onPress={() => onToggleFavorite(!isFavorite)}
            accessibilityRole="button"
            style={[styles.favorite, isFavorite && styles.favoriteActive]}
          >
            <Text style={styles.favoriteText}>{isFavorite ? '★' : '☆'}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  videoContainer: {
    height: 220,
    backgroundColor: '#0d1b2a',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderText: {
    color: '#ffffff',
  },
  content: {
    padding: 16,
    rowGap: 8,
  },
  topic: {
    color: '#0077b6',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1b263b',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {
    color: '#415a77',
    fontSize: 12,
  },
  favorite: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#adb5bd',
  },
  favoriteActive: {
    borderColor: '#ffb703',
    backgroundColor: '#fff3bf',
  },
  favoriteText: {
    fontSize: 14,
  },
});
