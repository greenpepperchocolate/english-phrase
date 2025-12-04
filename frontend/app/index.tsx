import { StatusBar, StyleSheet, View } from 'react-native';
import { FeedList } from '../src/components/FeedList';

// カテゴリ選択機能は現在無効化
// const TOPICS = [
//   { value: undefined, label: 'All' },
//   { value: 'business', label: 'Business' },
//   { value: 'travel', label: 'Travel' },
//   { value: 'daily', label: 'Daily' },
// ];

export default function FeedScreen() {
  const topic = undefined; // 全てのトピックを表示

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* トピック選択を非表示 */}
      {/* <View style={styles.topicSelector}>
        {TOPICS.map((item) => (
          <Pressable
            key={item.label}
            style={[styles.topicChip, topic === item.value && styles.topicChipActive]}
            onPress={() => setTopic(item.value)}
          >
            <Text style={[styles.topicLabel, topic === item.value && styles.topicLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View> */}

      <FeedList key={topic ?? 'all'} topic={topic} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
