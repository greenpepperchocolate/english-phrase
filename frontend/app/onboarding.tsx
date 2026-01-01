import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Pressable,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel';
import { useOnboarding } from '../src/hooks/useOnboarding';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// オンボーディング画像
const ONBOARDING_SLIDES = [
  { id: 1, image: require('../assets/onboarding/1.png') },
  { id: 2, image: require('../assets/onboarding/2.png') },
  { id: 3, image: require('../assets/onboarding/3.png') },
  { id: 4, image: require('../assets/onboarding/4.png') },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useOnboarding();
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<ICarouselInstance>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const isLastSlide = activeIndex === ONBOARDING_SLIDES.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      handleComplete();
    } else {
      carouselRef.current?.next();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    // フェードアウトアニメーション
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(async () => {
      await completeOnboarding();
      router.replace('/');
    });
  };

  const renderItem = ({ item }: { item: typeof ONBOARDING_SLIDES[0] }) => (
    <View style={styles.slide}>
      <Image source={item.image} style={styles.image} resizeMode="contain" />
    </View>
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Carousel
        ref={carouselRef}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        data={ONBOARDING_SLIDES}
        renderItem={renderItem}
        onSnapToItem={setActiveIndex}
        loop={false}
      />

      {/* ページインジケーター */}
      <View style={[styles.pagination, { bottom: insets.bottom + 120 }]}>
        {ONBOARDING_SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === activeIndex && styles.paginationDotActive,
            ]}
          />
        ))}
      </View>

      {/* ボタンエリア */}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.buttonRow}>
          {!isLastSlide ? (
            <Pressable style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>スキップ</Text>
            </Pressable>
          ) : (
            <View style={styles.skipButtonPlaceholder} />
          )}

          <Pressable
            style={[styles.nextButton, isLastSlide && styles.startButton]}
            onPress={handleNext}
          >
            <Text style={[styles.nextButtonText, isLastSlide && styles.startButtonText]}>
              {isLastSlide ? 'はじめる' : '次へ →'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  pagination: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#3b82f6',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingTop: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
  },
  skipButtonPlaceholder: {
    flex: 1,
  },
  skipButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  startButton: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
  },
});
