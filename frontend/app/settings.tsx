import { useEffect, useState, useRef } from 'react';
import {
  Alert,
  Button,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUserSettings } from '../src/hooks/useUserSettings';
import { APP_VERSION } from '../src/utils/config';
import { useAuth } from '../src/providers/AuthProvider';

function ContactForm({ scrollToInput }: { scrollToInput: () => void }) {
  const { authorizedFetch } = useAuth();
  const [subject, setSubject] = useState<'bug_report' | 'feature_request' | 'other'>('bug_report');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subjectOptions = [
    { value: 'bug_report' as const, label: 'バグ報告' },
    { value: 'feature_request' as const, label: '機能リクエスト' },
    { value: 'other' as const, label: 'その他' },
  ];

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (!message.trim()) {
      Alert.alert('エラー', 'メッセージを入力してください。');
      return;
    }

    if (message.trim().length < 10) {
      Alert.alert('エラー', 'メッセージは10文字以上入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      await authorizedFetch('/contact/submit', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          message: message.trim(),
        }),
      });

      Alert.alert(
        '送信完了',
        'お問い合わせを受け付けました。ご連絡ありがとうございます。',
        [
          {
            text: 'OK',
            onPress: () => {
              setMessage('');
              setSubject('bug_report');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Contact form error:', error);
      const errorMessage = error?.data?.detail || 'お問い合わせの送信に失敗しました。もう一度お試しください。';
      Alert.alert('エラー', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.contactFormContainer}>
      <Text style={styles.contactLabel}>お問い合わせの種類</Text>
      <View style={styles.pickerContainer}>
        {subjectOptions.map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.pickerButton,
              subject === option.value && styles.pickerButtonActive,
              isSubmitting && styles.pickerButtonDisabled,
            ]}
            onPress={() => !isSubmitting && setSubject(option.value)}
            disabled={isSubmitting}
          >
            <Text
              style={[
                styles.pickerButtonText,
                subject === option.value && styles.pickerButtonTextActive,
                isSubmitting && styles.pickerButtonTextDisabled,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.contactLabel}>メッセージ</Text>
      <TextInput
        style={[styles.textArea, isSubmitting && styles.textAreaDisabled]}
        placeholder="お問い合わせ内容を入力してください（10文字以上）"
        placeholderTextColor="#94a3b8"
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        editable={!isSubmitting}
        onFocus={scrollToInput}
      />
      <Text style={styles.characterCount}>{message.length} / 5000文字</Text>

      <Pressable
        style={[
          styles.submitButton,
          (isSubmitting || !message.trim() || message.trim().length < 10) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting || !message.trim() || message.trim().length < 10}
      >
        <Text style={styles.submitButtonText}>{isSubmitting ? '送信中...' : '送信'}</Text>
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { settingsQuery, updateSettings } = useUserSettings();
  const { signOut, deleteAccount, tokens, userEmail } = useAuth();
  const [showJapanese, setShowJapanese] = useState(true);
  const [repeatCount, setRepeatCount] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

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

  const scrollToContactForm = () => {
    // キーボードが表示された時にスクロールして入力欄を見えるようにする
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 400, animated: true });
    }, 300);
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
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
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
            {!isGuest && (
              <Pressable
                style={[styles.saveButton, updateSettings.isPending && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={updateSettings.isPending}
              >
                <Text style={styles.saveButtonText}>{updateSettings.isPending ? '保存中...' : '保存'}</Text>
              </Pressable>
            )}
          </View>

          {!isGuest && (
            <View style={styles.card}>
              <Text style={styles.label}>お問い合わせ</Text>
              <ContactForm scrollToInput={scrollToContactForm} />
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.label}>法的情報</Text>
            <Pressable
              style={styles.linkButton}
              onPress={() => router.push('/privacy-policy')}
            >
              <Text style={styles.linkButtonText}>プライバシーポリシー</Text>
              <Text style={styles.linkButtonArrow}>›</Text>
            </Pressable>
            <Pressable
              style={styles.linkButton}
              onPress={() => router.push('/terms-of-service')}
            >
              <Text style={styles.linkButtonText}>利用規約</Text>
              <Text style={styles.linkButtonArrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.info}>{isGuest ? 'ゲストアカウント' : userEmail || 'ログイン中'}</Text>
            {!isGuest && (
              <Pressable style={styles.logoutButton} onPress={signOut}>
                <Text style={styles.logoutButtonText}>ログアウト</Text>
              </Pressable>
            )}
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

          {/* 下部に余白を追加してスクロール時にすべてのコンテンツが見えるようにする */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    rowGap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  label: {
    fontWeight: '600',
    color: '#ffffff',
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
    borderColor: '#333333',
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatButtonActive: {
    borderColor: '#F08CA6',
    backgroundColor: '#F08CA6',
  },
  repeatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  repeatButtonTextActive: {
    color: '#ffffff',
  },
  hint: {
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
  },
  footer: {
    rowGap: 12,
    marginTop: 8,
  },
  info: {
    textAlign: 'center',
    color: '#888888',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginVertical: 8,
  },
  guestNotice: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F08CA6',
  },
  guestNoticeIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  guestNoticeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F08CA6',
    marginBottom: 8,
  },
  guestNoticeText: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  signUpPromptButton: {
    backgroundColor: '#F08CA6',
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
    color: '#666666',
  },
  repeatButtonDisabled: {
    backgroundColor: '#0d0d0d',
    borderColor: '#333333',
  },
  repeatButtonTextDisabled: {
    color: '#666666',
  },
  hintDisabled: {
    color: '#666666',
  },
  saveButton: {
    backgroundColor: '#F08CA6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#F08CA6',
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#64748b',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
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
  linkButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  linkButtonText: {
    fontSize: 16,
    color: '#F08CA6',
    fontWeight: '500',
  },
  linkButtonArrow: {
    fontSize: 24,
    color: '#666666',
    fontWeight: '300',
  },
  contactFormContainer: {
    rowGap: 12,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 4,
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pickerButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#333333',
    backgroundColor: '#1a1a1a',
    minWidth: 100,
    alignItems: 'center',
  },
  pickerButtonActive: {
    borderColor: '#F08CA6',
    backgroundColor: '#F08CA6',
  },
  pickerButtonDisabled: {
    backgroundColor: '#0d0d0d',
    borderColor: '#333333',
    opacity: 0.6,
  },
  pickerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  pickerButtonTextActive: {
    color: '#ffffff',
  },
  pickerButtonTextDisabled: {
    color: '#666666',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#ffffff',
    minHeight: 100,
    maxHeight: 150,
    backgroundColor: '#0d0d0d',
  },
  textAreaDisabled: {
    backgroundColor: '#0d0d0d',
    color: '#666666',
  },
  characterCount: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'right',
    marginTop: -8,
  },
  submitButton: {
    backgroundColor: '#F08CA6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#F08CA6',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
});
