import { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { FeedList } from '../src/components/FeedList';

const TOPICS = [
  { value: undefined, label: 'All' },
  { value: 'business', label: 'Business' },
  { value: 'travel', label: 'Travel' },
  { value: 'daily', label: 'Daily' },
];

export default function FeedScreen() {
  const [topic, setTopic] = useState<string | undefined>(undefined); // 全てのトピックを表示

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* トピック選択（ヘッダ位置に移動） */}
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
  topicSelector: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 40,
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
