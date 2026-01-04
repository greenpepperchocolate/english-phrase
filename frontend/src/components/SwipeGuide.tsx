import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function SwipeGuide({ visible, onDismiss }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const bounceAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);

  // onDismissの最新値を保持
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (visible) {
      // 既存のアニメーションをクリーンアップ
      if (bounceAnimationRef.current) {
        bounceAnimationRef.current.stop();
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // アニメーション値をリセット
      fadeAnim.setValue(0);
      translateY.setValue(0);

      // フェードインとアニメーション開始
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // 上下に動くアニメーション（ループ）
      bounceAnimationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -20,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      bounceAnimationRef.current.start();

      // 3秒後に自動で非表示
      timerRef.current = setTimeout(() => {
        if (bounceAnimationRef.current) {
          bounceAnimationRef.current.stop();
          bounceAnimationRef.current = null;
        }
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onDismissRef.current();
        });
      }, 3000);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (bounceAnimationRef.current) {
          bounceAnimationRef.current.stop();
          bounceAnimationRef.current = null;
        }
      };
    }
  }, [visible, fadeAnim, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={styles.arrow}>^</Text>
        <Text style={styles.text}>上にスワイプして次の動画へ</Text>
        <View style={styles.swipeIndicator}>
          <View style={styles.swipeLine} />
          <View style={styles.swipeArrow} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  arrow: {
    fontSize: 48,
    color: '#ffffff',
    fontWeight: '300',
    marginBottom: -10,
    textShadowColor: 'rgba(59, 130, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  text: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  swipeIndicator: {
    alignItems: 'center',
  },
  swipeLine: {
    width: 4,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 2,
  },
  swipeArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 15,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(255, 255, 255, 0.6)',
    marginTop: -2,
    transform: [{ rotate: '180deg' }],
  },
});
