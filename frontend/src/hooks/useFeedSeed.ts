import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FEED_SEEDS_KEY = 'feedSeeds';

type FeedSeedsStorage = {
  date: string; // YYYY-MM-DD形式
  seeds: Record<string, number>; // key: "all" | "topic" | "topic_difficulty"
};

function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

function generateSeed(): number {
  return Math.floor(Math.random() * 1000000);
}

function getSeedKey(topic?: string, difficulty?: string): string {
  if (!topic && !difficulty) return 'all';
  if (topic && difficulty) return `${topic}_${difficulty}`;
  if (topic) return topic;
  return difficulty || 'all';
}

export function useFeedSeed(topic?: string, difficulty?: string) {
  const [seed, setSeed] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrGenerateSeed = useCallback(async () => {
    try {
      const today = getTodayString();
      const seedKey = getSeedKey(topic, difficulty);

      // AsyncStorageから既存のseedデータを取得
      const stored = await AsyncStorage.getItem(FEED_SEEDS_KEY);
      let seedsData: FeedSeedsStorage;

      if (stored) {
        seedsData = JSON.parse(stored);

        // 日付が変わっていたら全seed再生成
        if (seedsData.date !== today) {
          seedsData = {
            date: today,
            seeds: { [seedKey]: generateSeed() }
          };
        } else if (!seedsData.seeds[seedKey]) {
          // 今日のデータだが、このキーのseedがない場合は生成
          seedsData.seeds[seedKey] = generateSeed();
        }
      } else {
        // 初回起動
        seedsData = {
          date: today,
          seeds: { [seedKey]: generateSeed() }
        };
      }

      // AsyncStorageに保存
      await AsyncStorage.setItem(FEED_SEEDS_KEY, JSON.stringify(seedsData));
      setSeed(seedsData.seeds[seedKey]);
    } catch (error) {
      console.error('Error loading feed seed:', error);
      // エラー時はフォールバック（ランダム生成）
      setSeed(generateSeed());
    } finally {
      setIsLoading(false);
    }
  }, [topic, difficulty]);

  useEffect(() => {
    loadOrGenerateSeed();
  }, [loadOrGenerateSeed]);

  return { seed, isLoading, refreshSeed: loadOrGenerateSeed };
}
