# Cloudflare R2 セットアップガイド

## 1. R2バケットの作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. 左側メニューから **R2** を選択
3. **Create bucket** をクリック
   - Bucket name: `english-phrase-media`
   - Location: Asia Pacific (APAC) 推奨
   - **Create bucket** をクリック

## 2. 公開アクセスの設定

1. 作成したバケットをクリック
2. **Settings** タブに移動
3. **Public Access** セクションで:
   - **Allow Access** を有効化
   - 公開URLが表示されます（例: `https://pub-xxxxx.r2.dev`）
   - **このURLをメモ** → `.env`の`R2_PUBLIC_BASE_URL`に使用

## 3. CORS設定（重要）

バケットの **Settings** タブで、**CORS Policy** を設定します。

### CORSポリシーのJSON設定

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:8081",
      "http://localhost:19006",
      "http://192.168.3.4:8081",
      "exp://*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type",
      "Accept-Ranges",
      "Content-Range"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### 本番環境用のCORS設定

本番環境では、`AllowedOrigins`に実際のアプリドメインを指定してください：

```json
[
  {
    "AllowedOrigins": [
      "https://yourdomain.com",
      "https://app.yourdomain.com"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type",
      "Accept-Ranges",
      "Content-Range"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**重要なポイント:**
- `GET`, `HEAD`: 動画再生に必要
- `Accept-Ranges`, `Content-Range`: Range リクエスト（部分取得）に必要
- `MaxAgeSeconds`: プリフライトリクエストのキャッシュ時間

## 4. API トークンの作成

1. R2のトップページに戻る
2. 右上の **Manage R2 API Tokens** をクリック
3. **Create API Token** をクリック
4. 設定:
   - **Token name**: `english-phrase-app`
   - **Permissions**: Object Read & Write
   - **TTL**: Never expire（または任意の期間）
   - **Specify bucket**: 作成したバケットを選択
5. **Create API Token** をクリック
6. 表示される情報をメモ:
   - **Access Key ID** → `.env`の`R2_ACCESS_KEY`
   - **Secret Access Key** → `.env`の`R2_SECRET_KEY`
   - **Jurisdiction-specific endpoint** → `.env`の`R2_SIGNING_ENDPOINT`
     - 例: `https://xxxxx.r2.cloudflarestorage.com`

⚠️ **Secret Access Keyは一度しか表示されません。必ずメモしてください！**

## 5. .envファイルの設定

`backend/.env`ファイルを作成し、以下を設定：

```env
# Django基本設定
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,192.168.3.4

# データベース
DATABASE_URL=sqlite:///db.sqlite3

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:8081,http://192.168.3.4:8081
CSRF_TRUSTED_ORIGINS=http://localhost:8000,http://192.168.3.4:8000

# Cloudflare R2設定
R2_PUBLIC_BASE_URL=https://pub-xxxxx.r2.dev
R2_ACCESS_KEY=your-access-key-here
R2_SECRET_KEY=your-secret-key-here
R2_BUCKET_NAME=english-phrase-media
R2_SIGNING_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com
R2_SIGNED_URL_TTL=600
```

## 6. 動作確認

1. Djangoサーバーを起動
   ```bash
   cd backend
   python manage.py runserver 0.0.0.0:8000
   ```

2. 管理画面にアクセス: `http://192.168.3.4:8000/admin/`

3. Phraseを作成し、動画ファイルをアップロード

4. APIでデータを確認:
   ```bash
   curl http://192.168.3.4:8000/api/feed?topic=travel
   ```

5. `video_url`に署名付きURLが含まれていることを確認

## 7. トラブルシューティング

### アップロードエラー

```python
# エラー例: botocore.exceptions.ClientError
```

**解決策:**
1. R2_ACCESS_KEY、R2_SECRET_KEYが正しいか確認
2. R2_SIGNING_ENDPOINTのURLが正しいか確認
3. APIトークンのPermissionsに"Object Write"が含まれているか確認

### CORS エラー

```
Access to video at 'https://...' from origin 'http://...' has been blocked by CORS policy
```

**解決策:**
1. R2バケットのCORS設定を確認
2. `AllowedOrigins`にアプリのオリジンが含まれているか確認
3. `AllowedMethods`に`GET`、`HEAD`が含まれているか確認

### 動画が再生されない

**確認項目:**
1. アップロード時に正しいContent-Typeが設定されているか
2. 署名URLの有効期限が切れていないか（600秒=10分）
3. R2の公開アクセスが有効になっているか

## 8. 本番環境への移行

本番環境では以下を変更してください：

1. **環境変数**
   ```env
   DJANGO_DEBUG=false
   R2_SIGNED_URL_TTL=300  # 5分
   ```

2. **CORS設定**: 本番ドメインのみ許可

3. **セキュリティ**:
   - `DJANGO_SECRET_KEY`を強固なランダム文字列に変更
   - `ALLOWED_HOSTS`に本番ドメインのみ設定
   - HTTPSを使用

## 9. コスト最適化

### 無料枠
- ストレージ: 10GB/月 無料
- Class Aオペレーション: 1,000万リクエスト/月 無料
- Class Bオペレーション: 1億リクエスト/月 無料

### 推奨設定

**有料コンテンツ（会員限定）:**
- 現在の署名URL方式を使用
- TTL: 300-600秒

**無料コンテンツ（一般公開）:**
- 署名なしの公開URLを使用
- `Cache-Control: public, max-age=31536000, immutable`
- CDNキャッシュで配信コストを削減

動画ファイル名にコンテンツハッシュを含めることで、キャッシュ効率が向上します：
```
videos/abc123def456_how-to-greet.mp4
```
