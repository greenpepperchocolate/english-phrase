import { useCallback, useState, useEffect } from 'react';
import { StatusBar, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FeedList } from '../src/components/FeedList';
import { MasteryRateDisplay } from '../src/components/MasteryRateDisplay';
import { SwipeGuide } from '../src/components/SwipeGuide';
import { useOnboarding, useSwipeGuide } from '../src/hooks/useOnboarding';

// カテゴリ選択機能は現在無効化
// const TOPICS = [
//   { value: undefined, label: 'All' },
//   { value: 'business', label: 'Business' },
//   { value: 'travel', label: 'Travel' },
//   { value: 'daily', label: 'Daily' },
// ];

export default function FeedScreen() {
  const router = useRouter();
  const topic = undefined; // 全てのトピックを表示
  const [isFocused, setIsFocused] = useState(true);
  const { hasOnboarded, isLoading: isOnboardingLoading } = useOnboarding();
  const { showGuide, hideGuide } = useSwipeGuide();

  // オンボーディング未完了の場合はリダイレクト
  useEffect(() => {
    if (!isOnboardingLoading && hasOnboarded === false) {
      router.replace('/onboarding');
    }
  }, [hasOnboarded, isOnboardingLoading, router]);

  // 画面がフォーカスされているかを検出
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  // オンボーディング状態確認中はローディング表示
  if (isOnboardingLoading || hasOnboarded === false) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

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

      <MasteryRateDisplay />
      <FeedList key={topic ?? 'all'} topic={topic} isFocused={isFocused} />

      {/* 初回のみスワイプガイドを表示 */}
      <SwipeGuide visible={showGuide} onDismiss={hideGuide} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
