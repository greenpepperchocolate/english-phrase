import React, { createContext, useCallback, useContext, useRef } from 'react';

// 古いAndroid端末を考慮して3に設定（プリロード1枠 + アクティブ2枠）
const MAX_CONCURRENT_VIDEOS = 3;

interface VideoLoadingContextValue {
  registerLoading: (videoId: string) => boolean;
  unregisterLoading: (videoId: string) => void;
  canLoad: () => boolean;
  getLoadingCount: () => number;
}

const VideoLoadingContext = createContext<VideoLoadingContextValue | null>(null);

export function VideoLoadingProvider({ children }: { children: React.ReactNode }) {
  const loadingVideosRef = useRef(new Set<string>());

  const registerLoading = useCallback((videoId: string): boolean => {
    const currentCount = loadingVideosRef.current.size;

    // 既に登録済みの場合はtrue
    if (loadingVideosRef.current.has(videoId)) {
      return true;
    }

    // 上限に達している場合はfalse
    if (currentCount >= MAX_CONCURRENT_VIDEOS) {
      console.log(`[VideoLoading] Rejected: ${videoId} (${currentCount}/${MAX_CONCURRENT_VIDEOS} loading)`);
      return false;
    }

    loadingVideosRef.current.add(videoId);
    console.log(`[VideoLoading] Registered: ${videoId} (${loadingVideosRef.current.size}/${MAX_CONCURRENT_VIDEOS})`);
    return true;
  }, []);

  const unregisterLoading = useCallback((videoId: string) => {
    if (loadingVideosRef.current.has(videoId)) {
      loadingVideosRef.current.delete(videoId);
      console.log(`[VideoLoading] Unregistered: ${videoId} (${loadingVideosRef.current.size}/${MAX_CONCURRENT_VIDEOS})`);
    }
  }, []);

  const canLoad = useCallback((): boolean => {
    return loadingVideosRef.current.size < MAX_CONCURRENT_VIDEOS;
  }, []);

  const getLoadingCount = useCallback((): number => {
    return loadingVideosRef.current.size;
  }, []);

  return (
    <VideoLoadingContext.Provider value={{ registerLoading, unregisterLoading, canLoad, getLoadingCount }}>
      {children}
    </VideoLoadingContext.Provider>
  );
}

export function useVideoLoading(): VideoLoadingContextValue {
  const context = useContext(VideoLoadingContext);
  if (!context) {
    throw new Error('useVideoLoading must be used within a VideoLoadingProvider');
  }
  return context;
}

// コンテキスト外で使用する場合のフォールバック（オプショナル）
export function useVideoLoadingOptional(): VideoLoadingContextValue | null {
  return useContext(VideoLoadingContext);
}
