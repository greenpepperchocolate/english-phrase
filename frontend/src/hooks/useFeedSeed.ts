import { useCallback } from 'react';

// セッションごとのシードをグローバルに管理（アプリ起動ごとにリセット）
const sessionSeeds: Record<string, number> = {};

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
  const seedKey = getSeedKey(topic, difficulty);

  // セッション内で一度だけシードを生成
  if (!(seedKey in sessionSeeds)) {
    sessionSeeds[seedKey] = generateSeed();
  }

  const seed = sessionSeeds[seedKey];

  const refreshSeed = useCallback(() => {
    sessionSeeds[seedKey] = generateSeed();
  }, [seedKey]);

  return { seed, isLoading: false, refreshSeed };
}
