import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Pressable,
  Animated,
  PanResponder,
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

// 全スライド数（画像4枚 + チュートリアル2枚）
const TOTAL_SLIDES = ONBOARDING_SLIDES.length + 2;

// 横スワイプチュートリアルコンポーネント
function HorizontalSwipeTutorial({ onComplete }: { onComplete: () => void }) {
  const [currentTab, setCurrentTab] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;

  // 左右に動くアニメーション
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(arrowAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [arrowAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50 && currentTab === 0) {
          // 左スワイプ → Phraseタブへ
          Animated.spring(translateX, {
            toValue: -SCREEN_WIDTH * 0.7,
            useNativeDriver: true,
          }).start(() => {
            setCurrentTab(1);
            if (!hasCompleted) {
              setHasCompleted(true);
              setTimeout(onComplete, 500);
            }
          });
        } else if (gestureState.dx > 50 && currentTab === 1) {
          // 右スワイプ → Wordタブへ
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start(() => {
            setCurrentTab(0);
          });
        } else {
          Animated.spring(translateX, {
            toValue: currentTab === 0 ? 0 : -SCREEN_WIDTH * 0.7,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={tutorialStyles.container}>
      {/* ヘッダー */}
      <View style={tutorialStyles.header}>
        <Text style={tutorialStyles.headerTitle}>横スワイプを試してみよう</Text>
        <Text style={tutorialStyles.headerSubtitle}>
          左右にスワイプしてWord/Phraseを切り替え
        </Text>
      </View>

      {/* タブバー */}
      <View style={tutorialStyles.tabBar}>
        <View style={tutorialStyles.tabItem}>
          <Text style={[tutorialStyles.tabText, currentTab === 0 && tutorialStyles.tabTextActive]}>
            Word
          </Text>
          {currentTab === 0 && <View style={tutorialStyles.tabUnderline} />}
        </View>
        <View style={tutorialStyles.tabItem}>
          <Text style={[tutorialStyles.tabText, currentTab === 1 && tutorialStyles.tabTextActive]}>
            Phrase
          </Text>
          {currentTab === 1 && <View style={tutorialStyles.tabUnderline} />}
        </View>
      </View>

      {/* スワイプエリア */}
      <View style={tutorialStyles.swipeArea} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            tutorialStyles.cardContainer,
            { transform: [{ translateX }] },
          ]}
        >
          {/* Wordカード */}
          <View style={[tutorialStyles.card, tutorialStyles.wordCard]}>
            <Text style={tutorialStyles.cardEmoji}>📚</Text>
            <Text style={tutorialStyles.cardTitle}>Word</Text>
            <Text style={tutorialStyles.cardText}>単語の動画</Text>
          </View>
          {/* Phraseカード */}
          <View style={[tutorialStyles.card, tutorialStyles.phraseCard]}>
            <Text style={tutorialStyles.cardEmoji}>💬</Text>
            <Text style={tutorialStyles.cardTitle}>Phrase</Text>
            <Text style={tutorialStyles.cardText}>フレーズの動画</Text>
          </View>
        </Animated.View>
      </View>

      {/* スワイプ指示 */}
      {!hasCompleted && (
        <View style={tutorialStyles.instruction}>
          <Animated.View
            style={{
              transform: [
                {
                  translateX: arrowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -20],
                  }),
                },
              ],
            }}
          >
            <Text style={tutorialStyles.arrowText}>←</Text>
          </Animated.View>
          <Text style={tutorialStyles.instructionText}>左にスワイプ</Text>
        </View>
      )}

      {hasCompleted && (
        <View style={tutorialStyles.successBadge}>
          <Text style={tutorialStyles.successText}>✓ 完了！</Text>
        </View>
      )}
    </View>
  );
}

// 縦スワイプチュートリアルコンポーネント
function VerticalSwipeTutorial({ onComplete }: { onComplete: () => void }) {
  const [hasCompleted, setHasCompleted] = useState(false);
  const [showNextVideo, setShowNextVideo] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;

  // ================================================
  // ここで動画カードの内容を設定できます
  // ================================================
  const currentVideo = {
    emoji: '🎬',           // 絵文字（または画像コンポーネントに置換可能）
    title: 'Video 1',
    color: '#3b82f6',      // 背景色
  };
  const nextVideo = {
    emoji: '🎥',
    title: 'Video 2',
    color: '#8b5cf6',
  };
  // ================================================

  // 上下に動くアニメーション
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(arrowAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [arrowAnim]);

  const cardHeight = 300;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        // 上方向のみ許可
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -80) {
          // 上スワイプ → 次の動画を表示して完了
          Animated.timing(translateY, {
            toValue: -cardHeight - 20,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setShowNextVideo(true);
            setHasCompleted(true);
            setTimeout(onComplete, 500);
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={tutorialStyles.container}>
      {/* ヘッダー */}
      <View style={tutorialStyles.header}>
        <Text style={tutorialStyles.headerTitle}>縦スワイプを試してみよう</Text>
        <Text style={tutorialStyles.headerSubtitle}>
          上にスワイプして次の動画へ
        </Text>
      </View>

      {/* 動画エリア */}
      <View style={tutorialStyles.videoArea} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            tutorialStyles.videoStack,
            { transform: [{ translateY }] },
          ]}
        >
          {/* 現在の動画 */}
          <View
            style={[
              tutorialStyles.videoCard,
              { backgroundColor: currentVideo.color, height: cardHeight },
            ]}
          >
            <Text style={tutorialStyles.videoEmoji}>{currentVideo.emoji}</Text>
            <Text style={tutorialStyles.videoTitle}>{currentVideo.title}</Text>
            <Text style={tutorialStyles.videoSubtitle}>上にスワイプ！</Text>
          </View>

          {/* 次の動画（下に配置） */}
          <View
            style={[
              tutorialStyles.videoCard,
              { backgroundColor: nextVideo.color, height: cardHeight, marginTop: 20 },
            ]}
          >
            <Text style={tutorialStyles.videoEmoji}>{nextVideo.emoji}</Text>
            <Text style={tutorialStyles.videoTitle}>{nextVideo.title}</Text>
            <Text style={tutorialStyles.videoSubtitle}>次の動画</Text>
          </View>
        </Animated.View>
      </View>

      {/* スワイプ指示 */}
      {!hasCompleted && (
        <View style={tutorialStyles.instruction}>
          <Animated.View
            style={{
              transform: [
                {
                  translateY: arrowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -15],
                  }),
                },
              ],
            }}
          >
            <Text style={tutorialStyles.arrowText}>↑</Text>
          </Animated.View>
          <Text style={tutorialStyles.instructionText}>上にスワイプ</Text>
        </View>
      )}

      {hasCompleted && (
        <View style={tutorialStyles.successBadge}>
          <Text style={tutorialStyles.successText}>✓ 完了！</Text>
        </View>
      )}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useOnboarding();
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<ICarouselInstance>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [horizontalTutorialDone, setHorizontalTutorialDone] = useState(false);
  const [verticalTutorialDone, setVerticalTutorialDone] = useState(false);

  const isLastSlide = activeIndex === TOTAL_SLIDES - 1;
  const isHorizontalTutorial = activeIndex === ONBOARDING_SLIDES.length;
  const isVerticalTutorial = activeIndex === ONBOARDING_SLIDES.length + 1;

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

  const handleHorizontalTutorialComplete = useCallback(() => {
    setHorizontalTutorialDone(true);
    // 少し待ってから次のスライドへ
    setTimeout(() => {
      carouselRef.current?.next();
    }, 800);
  }, []);

  const handleVerticalTutorialComplete = useCallback(() => {
    setVerticalTutorialDone(true);
  }, []);

  const renderItem = ({ index }: { index: number }) => {
    // 画像スライド
    if (index < ONBOARDING_SLIDES.length) {
      return (
        <View style={styles.slide}>
          <Image
            source={ONBOARDING_SLIDES[index].image}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      );
    }

    // 横スワイプチュートリアル
    if (index === ONBOARDING_SLIDES.length) {
      return (
        <View style={styles.slide}>
          <HorizontalSwipeTutorial onComplete={handleHorizontalTutorialComplete} />
        </View>
      );
    }

    // 縦スワイプチュートリアル (最後のスライド)
    return (
      <View style={styles.slide}>
        <VerticalSwipeTutorial onComplete={handleVerticalTutorialComplete} />
      </View>
    );
  };

  // チュートリアル中はカルーセルのスワイプを無効化
  const scrollEnabled = !isHorizontalTutorial && !isVerticalTutorial;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Carousel
        ref={carouselRef}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        data={Array.from({ length: TOTAL_SLIDES })}
        renderItem={renderItem}
        onSnapToItem={setActiveIndex}
        loop={false}
        enabled={scrollEnabled}
      />

      {/* ページインジケーター */}
      <View style={[styles.paginationContainer, { bottom: insets.bottom + 120 }]}>
        <View style={styles.pagination}>
          {Array.from({ length: TOTAL_SLIDES }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === activeIndex && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>
        <Text style={styles.paginationText}>
          {activeIndex + 1} / {TOTAL_SLIDES}
        </Text>
      </View>

      {/* ボタンエリア - 最後のスライドで縦スワイプ完了時のみ表示 */}
      {isLastSlide && verticalTutorialDone && (
        <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 24 }]}>
          <Pressable style={styles.startButton} onPress={handleComplete}>
            <Text style={styles.startButtonText}>はじめる</Text>
          </Pressable>
        </View>
      )}
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
  paginationContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  paginationDotActive: {
    width: 28,
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  paginationText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: '#000000',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    overflow: 'hidden',
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
  startButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});

const tutorialStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: SCREEN_WIDTH,
    backgroundColor: '#0f172a',
    paddingTop: 80,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    marginHorizontal: 40,
    borderRadius: 12,
    marginBottom: 30,
  },
  tabItem: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 4,
    left: 24,
    right: 24,
    height: 3,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  swipeArea: {
    flex: 1,
    overflow: 'hidden',
    marginHorizontal: 20,
  },
  cardContainer: {
    flexDirection: 'row',
    height: 280,
  },
  card: {
    width: SCREEN_WIDTH * 0.7,
    marginHorizontal: 15,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  wordCard: {
    backgroundColor: '#3b82f6',
  },
  phraseCard: {
    backgroundColor: '#8b5cf6',
  },
  cardEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  instruction: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  arrowText: {
    fontSize: 40,
    color: '#3b82f6',
    fontWeight: '300',
  },
  instructionText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
  },
  successBadge: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  successText: {
    fontSize: 24,
    color: '#22c55e',
    fontWeight: '700',
  },
  videoArea: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflow: 'hidden',
    paddingTop: 20,
  },
  videoStack: {
    width: SCREEN_WIDTH - 80,
    alignItems: 'center',
  },
  videoContainer: {
    width: SCREEN_WIDTH - 80,
    height: 300,
  },
  videoCard: {
    width: SCREEN_WIDTH - 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  videoTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  videoSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
