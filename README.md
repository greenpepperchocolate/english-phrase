# english-phrase

英語フレーズ学習アプリ

## エラーハンドリング機能

### 実装内容

1. **ネットワークエラー検出**
   - `@react-native-community/netinfo`を使用してネットワーク接続状態を監視
   - オフライン時に明確なメッセージを表示

2. **リトライ機能**
   - すべての画面（フィード、検索、お気に入り）でエラー時にリトライボタンを表示
   - `ErrorFallback`コンポーネントで統一的なエラーUI

3. **クラッシュレポート（Sentry）**
   - ネットワークエラーとアプリケーションエラーを自動的にSentryに送信
   - エラータイプ（network, unknown）とメタデータを記録

### Sentryの設定

**⚠️ 本番ビルド時に設定が必要**

開発環境ではSentryは無効化されています（モジュール解決の問題を回避）。

**本番ビルドを作成する際の手順：**

1. `frontend/app.config.js` の Sentry プラグインのコメントを解除
2. `frontend/app/_layout.tsx` で Sentry の初期化コードのコメントを解除
3. 本番ビルドを実行: `eas build --platform ios/android`

**現在の設定：**
- **開発環境**: Sentryは無効（エラーはconsole.errorとErrorFallbackで表示）
- **本番環境**: ビルド時にSentryプラグインを有効化する必要あり

設定済みファイル:
- `frontend/.env` - SENTRY_DSN設定済み
- `frontend/app.config.js` - Sentryプラグイン（コメントアウト）
- `frontend/app/_layout.tsx` - 初期化コード（コメントアウト）

Sentryダッシュボード: [https://sentry.io/](https://sentry.io/)

### エラー表示の仕組み

- **ネットワーク切断時**: 📡アイコンと「インターネット接続がありません」メッセージ
- **サーバーエラー時**: ⚠️アイコンと「サーバーに接続できません」メッセージ
- **その他のエラー**: ⚠️アイコンと「エラーが発生しました」メッセージ

すべてのエラー画面に「もう一度試す」ボタンが表示され、ユーザーが簡単にリトライできます。
