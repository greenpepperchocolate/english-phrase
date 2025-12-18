import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>プライバシーポリシー</Text>
          <Text style={styles.updated}>最終更新日: 2024年12月17日</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. はじめに</Text>
            <Text style={styles.paragraph}>
              本プライバシーポリシーは、EnglishFhrase（以下「本アプリ」）が、ユーザーの個人情報をどのように収集、使用、保護するかについて説明するものです。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. 収集する情報</Text>
            <Text style={styles.paragraph}>
              本アプリは、以下の情報を収集します：
            </Text>
            <Text style={styles.listItem}>• メールアドレス（アカウント登録時）</Text>
            <Text style={styles.listItem}>• 学習履歴（再生回数、お気に入り登録など）</Text>
            <Text style={styles.listItem}>• アプリ設定情報（日本語字幕表示設定、リピート回数など）</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. 情報の使用目的</Text>
            <Text style={styles.paragraph}>
              収集した情報は以下の目的で使用されます：
            </Text>
            <Text style={styles.listItem}>• アカウントの管理および認証</Text>
            <Text style={styles.listItem}>• 学習履歴の保存と表示</Text>
            <Text style={styles.listItem}>• アプリ機能の提供および改善</Text>
            <Text style={styles.listItem}>• ユーザーサポートの提供</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. 情報の共有</Text>
            <Text style={styles.paragraph}>
              本アプリは、ユーザーの個人情報を第三者と共有することはありません。ただし、以下の場合を除きます：
            </Text>
            <Text style={styles.listItem}>• 法律で義務付けられている場合</Text>
            <Text style={styles.listItem}>• ユーザーの同意がある場合</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. データのセキュリティ</Text>
            <Text style={styles.paragraph}>
              本アプリは、ユーザーの個人情報を保護するために、適切な技術的および組織的なセキュリティ対策を実施しています。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. データの削除</Text>
            <Text style={styles.paragraph}>
              ユーザーは、設定画面からアカウントを削除することができます。アカウント削除時には、すべての個人情報および学習データが完全に削除されます。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. お問い合わせ</Text>
            <Text style={styles.paragraph}>
              本プライバシーポリシーに関するご質問やご不明な点がございましたら、アプリ内のお問い合わせフォームよりご連絡ください。
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1b263b',
    marginBottom: 8,
  },
  updated: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1b263b',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 8,
  },
  listItem: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginLeft: 8,
    marginBottom: 4,
  },
});
