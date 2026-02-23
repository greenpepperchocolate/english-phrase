import { useCallback, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { FeedList } from '../src/components/FeedList';
import { MasteryRateDisplay } from '../src/components/MasteryRateDisplay';
import { useOnboarding } from '../src/hooks/useOnboarding';

// カテゴリ選択機能は現在無効化
// const TOPICS = [
//   { value: undefined, label: 'All' },
//   { value: 'business', label: 'Business' },
//   { value: 'travel', label: 'Travel' },
//   { value: 'daily', label: 'Daily' },
// ];

export default function FeedScreen() {
  const topic = undefined; // 全てのトピックを表示
  const [isFocused, setIsFocused] = useState(true);
  const { hasOnboarded, isLoading: onboardingLoading } = useOnboarding();

  // 画面がフォーカスされているかを検出
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  // オンボーディング状態の読み込み中
  if (onboardingLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F08CA6" />
      </View>
    );
  }

  // オンボーディング未完了の場合はリダイレクト
  if (!hasOnboarded) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <MasteryRateDisplay />
      <FeedList key={topic ?? 'all'} topic={topic} isFocused={isFocused} />
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
