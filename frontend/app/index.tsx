import { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FeedList } from '../src/components/FeedList';

const TOPICS = [
  { value: undefined, label: 'All' },
  { value: 'business', label: 'Business' },
  { value: 'travel', label: 'Travel' },
  { value: 'daily', label: 'Daily' },
];

export default function FeedScreen() {
  const router = useRouter();
  const [topic, setTopic] = useState<string | undefined>(undefined); // 全てのトピックを表示

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* トップオーバーレイアクション */}
      <View style={styles.topOverlay}>
        <Text style={styles.title}></Text>
        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={() => router.push('/favorites')} accessibilityRole="button">
            <Text style={styles.actionText}>★</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              console.log('Settings button clicked');
              router.push('/settings');
            }}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>⚙</Text>
          </Pressable>
        </View>
      </View>

      {/* トピック選択（横並び） */}
      <View style={styles.topicSelector}>
        {TOPICS.map((item) => (
          <Pressable
            key={item.label}
            style={[styles.topicChip, topic === item.value && styles.topicChipActive]}
            onPress={() => setTopic(item.value)}
          >
            <Text style={[styles.topicLabel, topic === item.value && styles.topicLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <FeedList key={topic ?? 'all'} topic={topic} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    columnGap: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  actionText: {
    fontSize: 20,
    color: '#ffffff',
  },
  topicSelector: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 100,
    zIndex: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 8,
    rowGap: 8,
    paddingHorizontal: 16,
  },
  topicChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
  },
  topicChipActive: {
    backgroundColor: 'rgba(29, 78, 216, 0.9)',
    borderColor: '#1d4ed8',
  },
  topicLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  topicLabelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
