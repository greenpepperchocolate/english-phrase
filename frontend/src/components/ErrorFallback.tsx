import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface ErrorFallbackProps {
  error?: Error;
  onRetry?: () => void;
  message?: string;
}

export function ErrorFallback({ error, onRetry, message }: ErrorFallbackProps) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  const getErrorMessage = () => {
    if (message) {
      return message;
    }
    if (isOffline) {
      return 'インターネット接続がありません\nWi-Fiまたはモバイルデータをオンにしてください';
    }
    if (error?.message.includes('Failed to fetch') || error?.message.includes('Network request failed')) {
      return 'サーバーに接続できません\nしばらくしてからもう一度お試しください';
    }
    return 'エラーが発生しました\nもう一度お試しください';
  };

  const getErrorIcon = () => {
    if (isOffline) {
      return '📡';
    }
    return '⚠️';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{getErrorIcon()}</Text>
      <Text style={styles.message}>{getErrorMessage()}</Text>
      {onRetry && (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>もう一度試す</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  message: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 160,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
