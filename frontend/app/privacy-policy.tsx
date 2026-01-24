import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>プライバシーポリシー</Text>
          <Text style={styles.updated}>最終更新日: 2024年12月17日</Text>

          {/* 0. 総則 */}
          <View style={styles.section}>
            <Text style={styles.paragraph}>
              川部 貴洋（屋号：AI Works、以下「当方」）は、当方が提供するモバイルアプリケーション（以下「本アプリ」）における、
              ユーザーの個人情報および利用情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
            </Text>
          </View>

          {/* 1. 取得する情報 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. 取得する情報</Text>

            <Text style={styles.subTitle}>1.1 ユーザーが提供する情報</Text>
            <Text style={styles.listItem}>• メールアドレス（アカウント登録・ログイン時）</Text>
            <Text style={styles.listItem}>• アプリ内で設定された学習・表示設定</Text>
            <Text style={styles.listItem}>• お問い合わせ時に入力された情報</Text>

            <Text style={styles.subTitle}>1.2 自動的に取得される情報</Text>
            <Text style={styles.listItem}>• 学習履歴（再生回数、視聴進捗、お気に入り等）</Text>
            <Text style={styles.listItem}>• 端末情報（OS、端末種別、アプリバージョン）</Text>
            <Text style={styles.listItem}>• 利用ログ、操作履歴</Text>
            <Text style={styles.listItem}>• クラッシュ情報、パフォーマンスデータ</Text>
            <Text style={styles.listItem}>• IPアドレス、タイムゾーン等の技術情報</Text>

            <Text style={styles.note}>
              ※ 本アプリは、連絡先、写真、位置情報等の端末内個人データへはアクセスしません。
            </Text>
          </View>

          {/* 2. 利用目的 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. 情報の利用目的</Text>
            <Text style={styles.paragraph}>取得した情報は、以下の目的で利用されます。</Text>
            <Text style={styles.listItem}>• アカウント管理および本人認証</Text>
            <Text style={styles.listItem}>• 学習履歴・設定の保存および同期</Text>
            <Text style={styles.listItem}>• アプリ機能の提供、維持、改善</Text>
            <Text style={styles.listItem}>• 利用状況の分析および品質向上</Text>
            <Text style={styles.listItem}>• 不正利用の防止およびセキュリティ確保</Text>
            <Text style={styles.listItem}>• お問い合わせ対応およびサポート提供</Text>
            <Text style={styles.listItem}>• 法令遵守および紛争対応</Text>
          </View>

          {/* 3. 外部サービス */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. 外部サービスの利用について</Text>
            <Text style={styles.paragraph}>
              本アプリは、サービス提供および品質向上のため、以下の外部サービスを利用する場合があります。
            </Text>
            <Text style={styles.listItem}>• クラウドデータベース・ストレージサービス</Text>
            <Text style={styles.listItem}>• アクセス解析・クラッシュ解析サービス</Text>
            <Text style={styles.listItem}>• 認証・配信・インフラ関連サービス</Text>
            <Text style={styles.paragraph}>
              これらのサービス事業者は、各社のプライバシーポリシーに基づき情報を管理します。
            </Text>
          </View>

          {/* 4. 第三者提供 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. 個人情報の第三者提供</Text>
            <Text style={styles.paragraph}>
              当方は、以下の場合を除き、ユーザーの個人情報を第三者に提供することはありません。
            </Text>
            <Text style={styles.listItem}>• ユーザーの同意がある場合</Text>
            <Text style={styles.listItem}>• 法令に基づき開示が求められた場合</Text>
            <Text style={styles.listItem}>
              • 業務委託先に対し、サービス提供に必要な範囲で提供する場合（この場合、適切な契約および管理を行います）
            </Text>
          </View>

          {/* 5. 保存期間 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. データの保存期間</Text>
            <Text style={styles.paragraph}>
              取得した個人情報は、利用目的の達成に必要な期間のみ保存されます。アカウント削除後は、
              合理的な期間内に削除または匿名化されます。
            </Text>
            <Text style={styles.note}>※ 法令上保存義務がある情報は、その期間保存される場合があります。</Text>
          </View>

          {/* 6. ユーザーの権利 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. ユーザーの権利</Text>
            <Text style={styles.paragraph}>ユーザーは、以下の権利を有します。</Text>
            <Text style={styles.listItem}>• 個人情報の確認・修正</Text>
            <Text style={styles.listItem}>• 利用停止または削除の要請</Text>
            <Text style={styles.listItem}>• アカウント削除の申請</Text>
            <Text style={styles.paragraph}>
              これらは、アプリ内設定またはお問い合わせにより対応します。
            </Text>
          </View>

          {/* 7. 未成年 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. 未成年者の利用について</Text>
            <Text style={styles.paragraph}>
              本アプリは、13歳未満の児童による利用を想定していません。13歳未満の方は、
              保護者の同意なく本アプリを利用できません。
            </Text>
            <Text style={styles.paragraph}>
              万一、13歳未満の児童の個人情報が取得されたことが判明した場合、速やかに削除対応を行います。
            </Text>
          </View>

          {/* 8. セキュリティ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. セキュリティ対策</Text>
            <Text style={styles.paragraph}>
              当方は、個人情報の漏洩、改ざん、紛失等を防止するため、暗号化、アクセス制御等の合理的な安全管理措置を講じます。
            </Text>
          </View>

          {/* 9. 変更 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. プライバシーポリシーの変更</Text>
            <Text style={styles.paragraph}>
              本ポリシーは、法令改正やサービス内容の変更等に応じて改定されることがあります。
              重要な変更がある場合、アプリ内または当方Webサイト等で通知します。
            </Text>
          </View>

          {/* 10. 事業者情報 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. 事業者情報・お問い合わせ</Text>

            <Text style={styles.listItem}>• 事業者名：川部 貴洋（屋号：AI Works）</Text>
            <Text style={styles.listItem}>• メールアドレス：aiworks.corporate@gmail.com</Text>
            <Text style={styles.listItem}>• Webサイト：https://www.ai-works.site/</Text>
          </View>

          <View style={styles.footerSpace} />
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
  subTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1b263b',
    marginBottom: 8,
    marginTop: 8,
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
  note: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginTop: 8,
  },
  footerSpace: {
    height: 24,
  },
});
