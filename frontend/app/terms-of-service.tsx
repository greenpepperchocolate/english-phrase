import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TermsOfServiceScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>利用規約</Text>
          <Text style={styles.updated}>最終更新日: 2024年12月17日</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. はじめに</Text>
            <Text style={styles.paragraph}>
              本利用規約（以下「本規約」）は、EnglishFhrase（以下「本アプリ」）の利用に関する条件を定めるものです。本アプリをご利用いただく際には、本規約に同意していただく必要があります。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. アカウントについて</Text>
            <Text style={styles.paragraph}>
              本アプリを利用するには、アカウントの作成が必要です。アカウント作成時には、正確な情報を提供していただく必要があります。
            </Text>
            <Text style={styles.listItem}>• アカウント情報は常に最新の状態に保ってください</Text>
            <Text style={styles.listItem}>• パスワードは第三者と共有しないでください</Text>
            <Text style={styles.listItem}>• アカウントの不正使用が疑われる場合は、速やかにご連絡ください</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. 利用制限</Text>
            <Text style={styles.paragraph}>
              以下の行為は禁止されています：
            </Text>
            <Text style={styles.listItem}>• 本アプリを違法な目的で使用すること</Text>
            <Text style={styles.listItem}>• 本アプリの運営を妨害する行為</Text>
            <Text style={styles.listItem}>• 他のユーザーに迷惑をかける行為</Text>
            <Text style={styles.listItem}>• 本アプリのシステムに不正アクセスする行為</Text>
            <Text style={styles.listItem}>• 本アプリのコンテンツを無断で複製、配布する行為</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. コンテンツについて</Text>
            <Text style={styles.paragraph}>
              本アプリで提供されるすべてのコンテンツ（動画、テキスト、画像など）の著作権は、それぞれの権利者に帰属します。ユーザーは、個人的な学習目的でのみコンテンツを使用することができます。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. 免責事項</Text>
            <Text style={styles.paragraph}>
              本アプリは、サービスの内容について、その完全性、正確性、有用性などいかなる保証もいたしません。本アプリの利用によって生じた損害について、運営者は一切の責任を負いません。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. サービスの変更・中断</Text>
            <Text style={styles.paragraph}>
              運営者は、ユーザーへの事前の通知なく、本アプリの内容を変更、追加、または削除することができます。また、システムメンテナンスやその他の理由により、サービスを一時的に中断することがあります。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. 規約の変更</Text>
            <Text style={styles.paragraph}>
              運営者は、必要に応じて本規約を変更することができます。変更後の規約は、本アプリ内で通知された時点から効力を発生します。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. お問い合わせ</Text>
            <Text style={styles.paragraph}>
              本規約に関するご質問やご不明な点がございましたら、アプリ内のお問い合わせフォームよりご連絡ください。
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
