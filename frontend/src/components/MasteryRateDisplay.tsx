import { StyleSheet, Text, View } from 'react-native';
import { useMasteryRate } from '../hooks/useMasteryRate';

const CIRCLE_SIZE = 56;

export function MasteryRateDisplay() {
  const { data, isLoading, error } = useMasteryRate();

  // ローディング中やエラー時、未認証時は何も表示しない
  if (isLoading || error || !data) {
    return null;
  }

  const rate = data.mastery_rate;

  return (
    <View style={styles.container}>
      {/* 円形デザイン */}
      <View style={styles.outerRing}>
        <View style={styles.innerCircle}>
          <Text style={styles.rate}>{rate}</Text>
          <Text style={styles.percent}>%</Text>
        </View>
      </View>
      {/* ラベル */}
      <Text style={styles.label}>Master</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 120,
    left: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  outerRing: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 3,
    borderColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    // グロー効果
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  innerCircle: {
    width: CIRCLE_SIZE - 8,
    height: CIRCLE_SIZE - 8,
    borderRadius: (CIRCLE_SIZE - 8) / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  rate: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  percent: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 1,
    marginTop: 4,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
