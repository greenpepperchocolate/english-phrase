import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'hasOnboarded';
const SWIPE_GUIDE_KEY = 'hasSeenSwipeGuide';

export function useOnboarding() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      // ローカル環境（開発モード）では毎回オンボーディングを表示
      if (__DEV__) {
        setHasOnboarded(false);
      } else {
        const value = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasOnboarded(value === 'true');
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setHasOnboarded(false);
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setHasOnboarded(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  }, []);

  const resetOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      await AsyncStorage.removeItem(SWIPE_GUIDE_KEY);
      setHasOnboarded(false);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  }, []);

  return {
    hasOnboarded,
    isLoading,
    completeOnboarding,
    resetOnboarding,
  };
}

export function useSwipeGuide() {
  const [hasSeenSwipeGuide, setHasSeenSwipeGuide] = useState<boolean | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    checkSwipeGuideStatus();
  }, []);

  const checkSwipeGuideStatus = async () => {
    try {
      const value = await AsyncStorage.getItem(SWIPE_GUIDE_KEY);
      const hasSeen = value === 'true';
      setHasSeenSwipeGuide(hasSeen);
      // 初回のみガイドを表示
      if (!hasSeen) {
        setShowGuide(true);
      }
    } catch (error) {
      console.error('Error checking swipe guide status:', error);
      setHasSeenSwipeGuide(true); // エラー時は非表示
    }
  };

  const markSwipeGuideSeen = useCallback(async () => {
    try {
      await AsyncStorage.setItem(SWIPE_GUIDE_KEY, 'true');
      setHasSeenSwipeGuide(true);
      setShowGuide(false);
    } catch (error) {
      console.error('Error saving swipe guide status:', error);
    }
  }, []);

  const hideGuide = useCallback(() => {
    setShowGuide(false);
    markSwipeGuideSeen();
  }, [markSwipeGuideSeen]);

  return {
    hasSeenSwipeGuide,
    showGuide,
    hideGuide,
    markSwipeGuideSeen,
  };
}
