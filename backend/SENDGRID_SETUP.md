# SendGrid セットアップガイド

イメタンではメール送信にSendGridを使用します。以下の手順でSendGrid APIキーを取得してください。

## 1. SendGridアカウントの作成

1. [SendGrid](https://sendgrid.com/)にアクセス
2. 「無料で始める」をクリック
3. アカウント情報を入力して登録
4. メールで確認リンクが送られてくるので、クリックして確認

## 2. API キーの作成

1. SendGridにログイン
2. 左メニューから **Settings** → **API Keys** に移動
3. 「Create API Key」をクリック
4. API Key の名前を入力（例：imetan-production）
5. **Full Access** を選択
6. 「Create & View」をクリック
7. **表示されたAPIキーをコピー**（二度と表示されないので注意）

## 3. .envファイルの更新

backend/.env ファイルに以下を追加：

```bash
# SendGrid API Key
SENDGRID_API_KEY=SG.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# 送信元メールアドレス
DEFAULT_FROM_EMAIL=noreply@imetan.com
```

注意: `DEFAULT_FROM_EMAIL` は実際にドメイン認証したメールアドレスに変更してください。

## 4. 送信者認証（Single Sender Verification）

SendGridでメールを送信するには、送信者の認証が必要です。

### 簡単な方法（個人使用向け）:

1. Settings → Sender Authentication に移動
2. 「Single Sender Verification」をクリック
3. 送信者情報を入力:
   - From Name: イメタン
   - From Email Address: あなたのメールアドレス
   - Reply To: あなたのメールアドレス
   - Company Address: 任意
4. 「Create」をクリック
5. 確認メールが送られてくるので、リンクをクリックして認証

### 本番環境向け（推奨）:

1. Settings → Sender Authentication に移動
2. 「Authenticate Your Domain」をクリック
3. DNSレコードを設定（ドメイン所有の証明）
4. SendGridが提供するDNSレコードをドメインのDNS設定に追加

## 5. 動作確認

Djangoサーバーを再起動して、サインアップ機能をテストしてください：

```bash
python manage.py runserver
```

## 無料プランの制限

- **1日100通まで無料**
- それ以上必要な場合は有料プランへのアップグレードが必要

## トラブルシューティング

### メールが送信されない場合

1. APIキーが正しく設定されているか確認
2. 送信者認証が完了しているか確認
3. Djangoのログでエラーメッセージを確認

### Gmail フォールバック

SendGrid APIキーが設定されていない場合、自動的にGmail SMTPにフォールバックします（開発環境用）。

## 参考リンク

- [SendGrid公式ドキュメント](https://docs.sendgrid.com/)
- [Python SDK](https://github.com/sendgrid/sendgrid-python)
