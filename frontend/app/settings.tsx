import { useEffect, useState } from 'react';
import { Alert, Button, Pressable, SafeAreaView, StyleSheet, Switch, Text, View } from 'react-native';
import { useUserSettings } from '../src/hooks/useUserSettings';
import { useAuth } from '../src/providers/AuthProvider';

export default function SettingsScreen() {
  const { settingsQuery, updateSettings } = useUserSettings();
  const { signOut, deleteAccount, tokens } = useAuth();
  const [showJapanese, setShowJapanese] = useState(true);
  const [repeatCount, setRepeatCount] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      console.log('Settings data:', JSON.stringify(settingsQuery.data));
      setShowJapanese(settingsQuery.data.show_japanese ?? true);
      setRepeatCount(settingsQuery.data.repeat_count ?? 1);
    }
  }, [settingsQuery.data]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        show_japanese: showJapanese,
        repeat_count: repeatCount,
      });
      Alert.alert('保存完了', '設定を保存しました。');
    } catch (error) {
      Alert.alert('エラー', '設定の保存に失敗しました。');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'アカウント削除の確認',
      '本当にアカウントを削除しますか？この操作は取り消せません。すべてのデータ（お気に入り、学習履歴、設定）が完全に削除されます。',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteAccount();
              Alert.alert('削除完了', 'アカウントが削除されました。');
            } catch (error: any) {
              console.error('Delete account error:', error);
              Alert.alert(
                'エラー',
                error?.data?.detail || 'アカウントの削除に失敗しました。もう一度お試しください。'
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (settingsQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>設定を読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (settingsQuery.isError) {
    console.error('Settings error:', settingsQuery.error);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>設定の読み込みエラー</Text>
          <Text style={styles.errorText}>{settingsQuery.error?.message || '不明なエラー'}</Text>
          <Button title="再試行" onPress={() => settingsQuery.refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  const isGuest = tokens?.anonymous;

  return (
    <SafeAreaView style={styles.container}>
      {isGuest && (
        <View style={styles.guestNotice}>
          <Text style={styles.guestNoticeIcon}>🔒</Text>
          <Text style={styles.guestNoticeTitle}>ゲストアカウント</Text>
          <Text style={styles.guestNoticeText}>
            ゲストアカウントでは設定が保存されません。アカウントを作成して設定を保存しましょう！
          </Text>
          <Pressable style={styles.signUpPromptButton} onPress={signOut}>
            <Text style={styles.signUpPromptButtonText}>新規登録 / ログイン</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.card, isGuest && styles.cardDisabled]}>
        <View style={styles.switchRow}>
          <Text style={[styles.label, isGuest && styles.labelDisabled]}>日本語字幕を表示</Text>
          <Switch value={showJapanese} onValueChange={setShowJapanese} disabled={isGuest} />
        </View>
        <Text style={[styles.label, isGuest && styles.labelDisabled]}>リピート回数（動画1本あたり）</Text>
        <View style={styles.repeatCountContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => (
            <Pressable
              key={count}
              style={[styles.repeatButton, repeatCount === count && styles.repeatButtonActive, isGuest && styles.repeatButtonDisabled]}
              onPress={() => !isGuest && setRepeatCount(count)}
              disabled={isGuest}
            >
              <Text style={[styles.repeatButtonText, repeatCount === count && styles.repeatButtonTextActive, isGuest && styles.repeatButtonTextDisabled]}>
                {count}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.hint, isGuest && styles.hintDisabled]}>
          {repeatCount === 1 ? '1回 = 1回再生後に次の動画へ' : `${repeatCount}回 = ${repeatCount}回再生後に次の動画へ`}
        </Text>
        {!isGuest && <Button title="保存" onPress={handleSave} disabled={updateSettings.isPending} />}
      </View>
      <View style={styles.footer}>
        <Text style={styles.info}>{isGuest ? 'ゲストアカウント' : 'ログイン中'}</Text>
        <Button title="ログアウト" onPress={signOut} />
        {!isGuest && (
          <Pressable
            style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
          >
            <Text style={styles.deleteButtonText}>
              {isDeleting ? 'アカウント削除中...' : 'アカウントを削除'}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
    rowGap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    rowGap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  label: {
    fontWeight: '600',
    color: '#1b263b',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 10,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  repeatCountContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  repeatButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ced4da',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatButtonActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#1d4ed8',
  },
  repeatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1b263b',
  },
  repeatButtonTextActive: {
    color: '#ffffff',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 'auto',
    rowGap: 12,
  },
  info: {
    textAlign: 'center',
    color: '#475569',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginVertical: 8,
  },
  guestNotice: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  guestNoticeIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  guestNoticeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 8,
  },
  guestNoticeText: {
    fontSize: 14,
    color: '#78350f',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  signUpPromptButton: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  signUpPromptButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  labelDisabled: {
    color: '#94a3b8',
  },
  repeatButtonDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  repeatButtonTextDisabled: {
    color: '#cbd5e1',
  },
  hintDisabled: {
    color: '#cbd5e1',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonDisabled: {
    backgroundColor: '#fca5a5',
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
