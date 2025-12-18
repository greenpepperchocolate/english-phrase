import { StyleSheet, Text, View } from 'react-native';
import { useMasteryRate } from '../hooks/useMasteryRate';

export function MasteryRateDisplay() {
  const { data, isLoading, error } = useMasteryRate();

  // ローディング中やエラー時、未認証時は何も表示しない
  if (isLoading || error || !data) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.rate}>{data.mastery_rate}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 10,
  },
  rate: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
