import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TermsOfServiceScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>利用規約</Text>
          <Text style={styles.updated}>最終更新日: 2024年12月17日</Text>

          {/* 1. 総則 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. 総則</Text>
            <Text style={styles.paragraph}>
              本利用規約（以下「本規約」）は、AI Works（以下「当社」）が提供する
              モバイルアプリケーション「映単語」（以下「本アプリ」）の利用条件を定めるものです。
              ユーザーは、本規約に同意したうえで本アプリを利用するものとします。
            </Text>
          </View>

          {/* 2. 利用登録 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. 利用登録・アカウント</Text>
            <Text style={styles.paragraph}>
              本アプリの利用にあたり、ユーザーは正確かつ最新の情報をもってアカウント登録を行うものとします。
            </Text>
            <Text style={styles.listItem}>• アカウント情報は自己の責任で管理するものとします</Text>
            <Text style={styles.listItem}>• パスワード等を第三者に開示・共有してはなりません</Text>
            <Text style={styles.listItem}>• 不正利用が判明した場合、速やかに当社へ通知してください</Text>
          </View>

          {/* 3. 未成年者 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. 未成年者の利用</Text>
            <Text style={styles.paragraph}>
              13歳未満の方は、本アプリを利用することができません。
              未成年者が利用する場合は、保護者の同意を得たうえで利用するものとします。
            </Text>
          </View>

          {/* 4. 禁止事項 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. 禁止事項</Text>
            <Text style={styles.paragraph}>ユーザーは、以下の行為を行ってはなりません。</Text>
            <Text style={styles.listItem}>• 法令または公序良俗に反する行為</Text>
            <Text style={styles.listItem}>• 本アプリの運営を妨害する行為</Text>
            <Text style={styles.listItem}>• 不正アクセス、リバースエンジニアリング等の行為</Text>
            <Text style={styles.listItem}>• コンテンツを無断で複製・転載・配布する行為</Text>
            <Text style={styles.listItem}>• その他、当社が不適切と判断する行為</Text>
          </View>

          {/* 5. コンテンツ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. コンテンツの権利</Text>
            <Text style={styles.paragraph}>
              本アプリに掲載される動画、画像、テキスト等のコンテンツに関する著作権その他の権利は、
              当社または正当な権利者に帰属します。
              ユーザーは、個人的かつ非商業的な学習目的の範囲内でのみ利用できるものとします。
            </Text>
          </View>

          {/* 6. サービスの変更・停止 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. サービスの変更・停止</Text>
            <Text style={styles.paragraph}>
              当社は、ユーザーへの事前通知なく、本アプリの内容を変更、追加、または停止することがあります。
              これにより生じた損害について、当社は責任を負いません。
            </Text>
          </View>

          {/* 7. 利用停止・退会 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. 利用停止・退会</Text>
            <Text style={styles.paragraph}>
              当社は、ユーザーが本規約に違反した場合、事前通知なくアカウントの利用停止または削除を行うことができます。
            </Text>
          </View>

          {/* 8. 免責事項 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. 免責事項</Text>
            <Text style={styles.paragraph}>
              本アプリは現状有姿で提供されるものであり、当社はその完全性、正確性、有用性等について
              明示または黙示を問わず保証するものではありません。
              ただし、法令により免責が認められない場合を除きます。
            </Text>
          </View>

          {/* 9. 規約の変更 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. 規約の変更</Text>
            <Text style={styles.paragraph}>
              当社は、必要に応じて本規約を変更することがあります。
              変更後の規約は、本アプリ内に表示された時点から効力を生じるものとします。
            </Text>
          </View>

          {/* 10. 準拠法・管轄 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. 準拠法・管轄</Text>
            <Text style={styles.paragraph}>
              本規約は日本法を準拠法とし、本アプリに関して生じる紛争については、
              東京地方裁判所を第一審の専属的合意管轄裁判所とします。
            </Text>
          </View>

          {/* 11. 事業者情報 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. 事業者情報</Text>
            <Text style={styles.listItem}>• 事業者名：AI Works</Text>
            <Text style={styles.listItem}>• 所在地：〒160-0022 東京都新宿区新宿7-16-2 101</Text>
            <Text style={styles.listItem}>• メールアドレス：aiworks.corporate@gmail.com</Text>
            <Text style={styles.listItem}>• Webサイト：https://www.ai-works.site/</Text>
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
