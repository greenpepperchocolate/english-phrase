# 英語学習アプリ R2 要件定義

## 0. 目的・コンセプト
- 秒程度の短尺フレーズ動画を縦スワイプ（TikTok風）で学べるマルチモーダル学習アプリを最小コストで提供する。
- 読む（字幕）・聞く（TTS音声）・見る（簡易映像）の統合で記憶定着を強化し、他サービスとの差別化を図る。

## 1. 対象ユーザーと提供価値
- **対象**: スキマ時間で英会話表現を増やしたい初〜中級学習者、短時間でリスニング/発話を鍛えたい層。
- **提供価値**:
  - 1スワイプ=1学習単位（約4秒）で飽きずに継続しやすい学習体験。
  - 文脈付きの短いフレーズで運用語彙を拡充。
  - 発音ミラーリングやクイズなど能動学習機能へ拡張（MVP後に実装想定）。

## 2. 成功指標 (KPI)
| 指標 | 目標値 |
| --- | --- |
| 日次継続率 | 25% |
| 1セッション平均再生数 | 40本 |
| 1本あたり再生完了率 | 80% |
| 発音練習起動率 (将来拡張) | 15% |
| コスト/1再生 | 0.02円 |

## 3. 主要機能 (MVP)
- 縦スワイプ動画フィード（全画面、短尺動画の自動ループ、上下スワイプで前後切替）。
- ビューポート制御による自動再生/一時停止。
- 字幕表示：英語字幕はアクセント区切りを強調、日本語字幕はタップで表示/非表示を切替。
- ネイティブ風TTS音声の再生と音量・速度調整（ユーザー設定を保存）。
- お気に入りと視聴履歴、復習リストで継続学習を可視化（視聴回数・連続日数）。
- 認証：匿名メール/Googleによる登録（無料枠は例として1日100本まで）。
- 配信最適化：R2署名URLまたはパブリックURLで再生し、キャッシュ制御と先読みを実施（次の数本のみ）。

## 4. 非機能要件
- **パフォーマンス**: 初回動画までのTTI 1.5秒以内（Wi-Fi想定）、連続スワイプ時もカクつきなし。
- **可用性**: API稼働率 99.9%。
- **セキュリティ**: JWT/OAuth2による認証、R2は短寿命署名URLで保護（有料領域）。
- **拡張性**: 数万〜10万クリップ追加にも耐えるメタデータ設計とCDNキャッシュ戦略。
- **コスト**: ストレージ月数百円規模を維持し、配信はR2活用で極小化。

## 5. システム構成 (最小コスト設計)
- **クライアント**: React Native (Expo推奨)。縦型全画面Video、FlatList + paging、ビューポート検知で自動再生制御。軽量先読み（次の数本）。
- **API**: Django REST FrameworkをRenderなど低コストPaaSにデプロイ。フィード取得、学習ログ、認証、署名URL発行を担う。
- **ストレージ/配信**: Cloudflare R2に4秒動画を配置。Cache-Control: public, max-age=31536000, immutable を設定し、カスタムドメインまたは *.r2.dev を利用。
- **DB**: PostgreSQL (Render/Neon/Cloud SQL)。メタデータ、タグ、難易度、利用統計を管理。
- **動画生成 (バッチ)**: Pythonスクリプト（ffmpeg + TTS + 簡易アニメ背景）で動画を生成しR2へアップロード、メタデータを更新。

## 6. API仕様 (例)
- GET /api/feed?topic=travel&limit=50&cursor=... → [{id, text_en, text_ja, video_url_or_token}]
- POST /api/logs/play → { phrase_id, play_ms, completed }
- POST /api/favorites/toggle → { phrase_id, on: true|false }
- POST /api/auth/login, POST /api/auth/refresh
- GET /api/phrase/:id
- 有料領域の署名URL発行: POST /api/media/signed-url → 入力 { key } に対して60〜600秒の署名URLを返却。

## 7. R2運用ポリシー
- オブジェクト名は phrases/<hash>.mp4 形式で内容ハッシュを採用し、キャッシュ切替を容易化。
- Cache-Control: public, max-age=31536000, immutable を付与。
- 無料枠では公開+強キャッシュで開始し、課金導入後に署名URL配信へ移行。
- HEADやLISTを多用せずリクエスト数を抑え、Class A/B請求を最小化。

## 8. クライアントUX要件
- 縦スワイプUI：画面内に入ったら自動再生、外れたら停止。再生不可時は次のフレーズへフォールバックし後で再試行。
- 字幕：英語は常時表示、日本語はタップ/長押しでトグル。フォントサイズやコントラスト調整を提供。
- 音声：初期設定は音量80%、再生速度1.0x。ユーザー設定を保存。
- 先読み：次の数本のみを事前ロードし、無駄な通信を抑制。
- アクセシビリティ：ボイスオーバー、フォント拡大、コントラスト調整に対応。

## 9. バッチ生成要件 (動画パイプライン)
- **入力**: 	ext_en, 	ext_ja。
- **TTS**: 無料枠を優先利用（例: GCP TTS無料分、端末TTSで仮素材を作成し後で差し替え）。
- **映像**: 静止背景に軽いモーション/字幕アニメを加え、ファイルサイズを最小化。
- **長さ**: 4.0秒固定（±0.1秒以内）。
- **サイズ目標**: 約1.0MB/本（360×480px, AAC 64〜96kbps, 映像ビットレート250〜450kbps）。
- **出力**: MP4 (H.264 + AAC)、ハッシュ算出後にR2へアップロードしDBを更新。

## 10. コスト最適化ルール
- R2の無料エグレス枠と強キャッシュを活用して帯域コストを抑制。
- 動画は音声品質を優先しつつ映像ビットレートを抑える。
- 先読みを抑制し、お気に入りなど限定的にオフラインDLを許可。
- サーバーはRenderの無料/低額ティアで開始し、重い処理はバッチに集約。
- 分析は無料プラン内で収まるようイベントを厳選し集計。

## 11. データモデル概要
- R2のオブジェクトキーを直接保存し、将来の署名付きURLやCDN切替に対応 (ideo_key, udio_key, image_key)。
- Expression と Phrase を多対多 (through PhraseExpression) で連携し、並び順を保証。
- UserProgress でユーザーごとの学習状態を記録し、部分的Unique制約でフレーズ/表現ごとに重複を防止。
- difficulty は1〜5段階で管理し、レコメンドや並び替えの基盤とする。

## 12. 画面遷移・ワイヤーフレーム概要
### 12.1 主要画面
- **スプラッシュ/起動**: ロゴとローディング。認証状態を確認しフィードまたはオンボーディングへ遷移。
- **オンボーディング/ログイン**: メール匿名登録とGoogleログインを並列表示。利用可能枠（1日100本）を明示。
- **トピック選択 (任意)**: 初回のみ旅行/日常/ビジネスなどから好みを選択。選択結果はフィードAPIのクエリに反映。
- **メインフィード**: 縦スクロール1枚=1フレーズ。動画プレイヤー、英字幕、タップで日本語字幕、操作ボタン（お気に入り、再生速度、音量、シェア）。
- **設定モーダル**: 速度/音量スライダー、字幕表示設定、キャッシュクリア、ログアウト。
- **お気に入り/履歴リスト**: タブで切替。カード形式で視聴済み・お気に入りを確認し単体再生へ遷移。
- **エラー/オフライン**: 再試行ボタンとシンプルなメッセージ。バックグラウンドでもフィードに復帰可能。

### 12.2 ユーザーフロー
1. 起動画面で認証状態チェック → 未ログインならオンボーディングへ。
2. ログイン完了後、必要に応じてトピック選択 → メインフィード取得。
3. フィードでは上下スワイプでフレーズ切替。お気に入りタップで状態保存。
4. 設定モーダルで再生速度・音量を調整しユーザー設定APIへ保存。
5. お気に入り/履歴画面から復習再生 → 完了時に学習ログAPIへ送信。
6. エラー発生時は次の動画へ自動フォールバックし、バックグラウンドで再試行。

### 12.3 ワイヤーフレーム要素
- **メインフィード**: 上段にトピックタグ、中央に動画 (16:9縦) と英字幕、下部に操作ボタン列。右下に設定ボタン。
- **お気に入り/履歴**: トップタブ + リスト。各アイテムにサムネイル、英語フレーズ、再生ボタン、視聴回数。
- **設定モーダル**: スライダーUI（速度0.75〜1.25x、音量0〜100%）、字幕トグルスイッチ、保存/閉じるボタン。
- **オンボーディング**: 3枚スライド（コンセプト→マルチモーダル→コスト注意）+ 登録フォーム。
### 6.1 エンドポイント詳細
| Endpoint | Method | Auth | 説明 |
| --- | --- | --- | --- |
| /api/feed | GET | 必須 (アクセストークン) | トピックや難易度を指定したフィード取得。cursorベースのページング。 |
| /api/logs/play | POST | 必須 | 再生開始/完了ログを記録。バッチ集計用に再生時間と完了フラグを送信。 |
| /api/favorites/toggle | POST | 必須 | お気に入り状態をトグル。レスポンスは現在のお気に入り状態。 |
| /api/user/settings | PATCH | 必須 | 再生速度・音量・字幕設定などユーザー設定を保存。 |
| /api/phrase/:id | GET | 任意 (無料枠は匿名トークンも可) | フレーズ詳細と関連Expressionを返却。 |
| /api/auth/login | POST | 不要 | メール/パスワードまたはGoogle OAuthコードでログイン。 |
| /api/auth/refresh | POST | リフレッシュトークン | アクセストークンを再発行。 |
| /api/media/signed-url | POST | 必須 (有料枠) | 指定キーの短寿命署名URLを発行。 |

#### /api/feed
- **Query**: 	opic, difficulty, limit (<=50), cursor
- **Response**:
`json
{
  "data": [
    {
      "id": 123,
      "text_en": "Can I get a window seat?",
      "text_ja": "窓側の席はありますか？",
      "video_token": "eyJhbGciOiJI...",
      "audio_key": "phrases/abc123/audio.mp3",
      "difficulty": 2,
      "duration_sec": 4.0,
      "is_favorite": false
    }
  ],
  "next_cursor": "opaque-string",
  "ttl_sec": 120
}
`
- ideo_token は無料枠では公開URL、課金ユーザーはトークンから署名URLを取得。

#### /api/logs/play
- **Body**:
`json
{
  "phrase_id": 123,
  "play_ms": 3900,
  "completed": true,
  "source": "feed"  // feed, favorites, autoplay
}
`
- **Response**: 204 No Content
- 重複送信を想定し冪等処理（最新ログで上書き）。

#### /api/favorites/toggle
- **Body**: { "phrase_id": 123, "on": true }
- **Response**:
`json
{
  "phrase_id": 123,
  "is_favorite": true,
  "favorite_count": 18
}
`

#### /api/user/settings
- **Body** (部分更新):
`json
{
  "playback_speed": 1.05,
  "volume": 0.8,
  "show_japanese": false
}
`
- **Response**: 保存後の設定JSON。

#### /api/auth/login
- メール/パスワード: { "email": "user@example.com", "password": "..." }
- Google: { "provider": "google", "id_token": "..." }
- **Response**:
`json
{
  "access_token": "jwt...",
  "refresh_token": "jwt...",
  "expires_in": 3600,
  "anonymous": false
}
`
- 匿名利用はメールリンク不要の簡易発行も検討 (デバイス固有ID + PIN)。

#### /api/auth/refresh
- **Body**: { "refresh_token": "jwt..." }
- **Response**: 新しいアクセストークンと有効期限。

#### /api/media/signed-url
- **Body**: { "key": "phrases/abc123.mp4" }
- **Response**:
`json
{
  "url": "https://cdn.example.com/...?Expires=...",
  "expires_in": 300
}
`
- 有料枠のみ許可。無料枠は直接公開URLを返す。

### 6.2 認可・レート制御
- アクセストークンは1時間有効。リフレッシュトークンは30日 (無操作時7日で失効)。
- pi/feed は匿名利用でも当日残回数があればトークンを発行。サーバー側で日次カウント (例: 100本/日)。
- 重要API（ログ/お気に入り/設定）はユーザー認証必須。匿名ユーザーは内部ユーザーIDを付与。
- リクエスト制限: Cloudflare Turnstile + Django Throttling (例: 60 req/min)。

## 13. ERモデルとマイグレーション方針
### 13.1 エンティティ概要
`
User ───< UserSetting (1:1)
  │
  ├──< UserProgress >── Phrase
  │                │
  │                └── Expression
  │
  └──< PlaybackLog

Phrase ───< PhraseExpression >── Expression
Phrase ───< Favorite (ユーザー別お気に入り)
`

| テーブル | 主なカラム | 補足 |
| --- | --- | --- |
| expression | id, 	ype, 	ext, meaning, phonetic, image_key, udio_key, parent_id, order | type/textに複合インデックス。親子関係でチャンク構造を持てる。 |
| phrase | id, 	ext, meaning, udio_key, ideo_key, scene_image_key, duration_sec, difficulty | 難易度にインデックス。R2キーのみ保存。 |
| phrase_expression | id, phrase_id, expression_id, order | unique (phrase_id, expression_id) + order昇順デフォルト。 |
| user_progress | id, user_id, phrase_id, expression_id, completed, 
eplay_count, last_reviewed, is_favorite | 部分Unique制約でフレーズ/表現単位を分離。 |
| avorite (別テーブル案) | id, user_id, phrase_id, created_at | リスト表示用に独立させる場合。MVPではuser_progress.is_favoriteで代替可能。 |
| user_setting | id, user_id, playback_speed, olume, show_japanese, created_at, updated_at | 1ユーザー1行。userユニーク制約。 |
| playback_log | id, user_id, phrase_id, play_ms, completed, source, created_at | KPI集計向け。日次でアーカイブも検討。 |

### 13.2 初期マイグレーション案
1.  001_initial
   - Expression, Phrase, PhraseExpression, UserProgress を作成。
   - インデックス: expression(type, text), phrase(difficulty)。
   - 制約: PhraseExpression の unique_together、UserProgress の部分Unique (NULL条件付き)。
2.  002_user_setting
   - UserSetting モデル追加。OneToOneField(User) に unique=True。
3.  003_playback_log
   - 再生ログを保持する PlaybackLog。created_at にインデックス。大量蓄積に備えて将来的にパーティション分割も検討。
4.  004_indexes
   - 運用結果に応じて UserProgress(user, is_favorite) や PlaybackLog(user, created_at) に追加インデックス。

### 13.3 モデル補足
- 署名URL発行時は ideo_key + R2署名APIで短寿命URLを生成するため、URL自体をDBに保存しない。
- UserProgress はフレーズと表現の両軸で進捗を管理できるが、NULLが混在するためビューやAPIで明示的にフィルタリングする。
- PlaybackLog は将来的なA/Bテストや機械学習向けにdevice_type, 
etwork_type等の拡張余地を残す。
- 履歴画面の高速化には UserProgress の last_reviewed 降順インデックスを利用。



データベースのテーブル構造は以下の通りです：

  1. Expression（表現）

  英語の単語・フレーズ・イディオムなど

- id: 主キー
- type: 種類（phrase/word/idiom/sentence）
- text: 英語テキスト
- meaning: 日本語の意味
- phonetic: 発音記号
- image_key: 画像ファイルのキー
- audio_key: 音声ファイルのキー
- parent_id: 親表現（階層構造用）
- order: 表示順
- created_at, updated_at: タイムスタンプ

  2. Phrase（フレーズ）

  学習コンテンツの単位

- id: 主キー
- text: フレーズの英語テキスト
- meaning: 日本語の意味
- topic: トピック（travel, business等）
- tags: タグ（JSON配列）
- audio_key: 音声ファイルのキー
- video_key: 動画ファイルのキー
- scene_image_key: シーン画像のキー
- duration_sec: 動画の長さ（秒）
- difficulty: 難易度（easy/normal/hard）
- created_at, updated_at: タイムスタンプ

  3. PhraseExpression（中間テーブル）

  Phrase と Expression の多対多の関連

- id: 主キー
- phrase_id: フレーズID
- expression_id: 表現ID
- order: 表示順

  4. User（ユーザー）

  Djangoの標準 auth.User モデルを使用

  5. UserSetting（ユーザー設定）

- id: 主キー
- user_id: ユーザーID（1対1）
- playback_speed: 再生速度（デフォルト1.0）
- volume: 音量（デフォルト0.8）
- show_japanese: 日本語表示フラグ
- created_at, updated_at: タイムスタンプ

  6. UserProgress（学習進捗）

  ユーザーごとのフレーズ/表現の進捗管理

- id: 主キー
- user_id: ユーザーID
- phrase_id: フレーズID（NULL可）
- expression_id: 表現ID（NULL可）
- completed: 完了フラグ
- replay_count: 再生回数
- last_reviewed: 最終復習日時
- is_favorite: お気に入りフラグ
- created_at, updated_at: タイムスタンプ
- 制約: (user, phrase, expression) の組み合わせはユニーク

  7. PlaybackLog（再生ログ）

  動画/音声の再生履歴

- id: 主キー
- user_id: ユーザーID
- phrase_id: フレーズID
- play_ms: 再生時間（ミリ秒）
- completed: 完了フラグ
- source: 再生元（feed/favorites/search）
- device_type: デバイス種別
- network_type: ネットワーク種別
- created_at: 作成日時

  リレーションシップ:

- Phrase ⇔ Expression: 多対多（PhraseExpressionを経由）
- User → UserSetting: 1対1
- User → UserProgress: 1対多
- User → PlaybackLog: 1対多
- Expression → Expression: 親子関係（自己参照）



！Django管理画面から動画をアップロードできる。

  使い方

  1. Djangoサーバーを再起動してください（既に起動している場合）
  2. 管理画面にアクセス
  <http://192.168.3.4:8000/admin/>
  3. Phraseを作成・編集
    - 「Phrases」→「Add Phrase」をクリック
    - 基本情報セクション: テキスト、意味、トピック、難易度などを入力
    - メディアアップロードセクション:
        - 動画ファイル: mp4などの動画ファイルを選択
      - 音声ファイル: mp3などの音声ファイルを選択
      - シーン画像: jpg/pngなどの画像を選択
    - 保存すると自動的にアップロードされます
  4. Expressionも同様に
    - 「Expressions」→「Add Expression」
    - 画像・音声ファイルをアップロード可能

  動作の仕組み

- R2設定がある場合: Cloudflare R2にアップロード → 署名付きURL生成
- R2設定がない場合（ローカル開発）: backend/media/ フォルダに保存 → ローカルURL生成

  アップロードされたファイルの確認

- フロントエンドアプリで表示される動画URLは自動的に生成されます
- Phrase一覧で「動画」列にチェックマークが表示されます



Cloudflare R2を設定します。以下の手順で進めてください。

  1. Cloudflare R2の設定手順

  ステップ1: Cloudflareダッシュボードでバケット作成

  1. Cloudflareにログイン: <https://dash.cloudflare.com/>
  2. R2に移動: サイドバーから「R2」を選択
  3. バケット作成:
    - 「Create bucket」をクリック
    - バケット名: english-phrase-media （または任意の名前）
    - リージョン: Asia Pacific推奨
    - 作成をクリック

  ステップ2: 公開アクセスの設定

  1. 作成したバケットをクリック
  2. Settings タブに移動
  3. Public Access セクションで:
    - 「Allow Access」を有効化
    - 公開URLが表示されます（例: <https://pub-xxxxx.r2.dev）>
    - このURLをメモしてください

  ステップ3: APIトークンの取得

  1. R2のトップページに戻る
  2. 右上の Manage R2 API Tokens をクリック
  3. Create API Token をクリック
  4. 設定:
    - Token name: english-phrase-app
    - Permissions: Object Read & Write
    - TTL: Never expire（または任意）
    - Specify bucket: 作成したバケットを選択
  5. Create API Token をクリック
  6. 表示される情報をメモ:
    - Access Key ID
    - Secret Access Key
    - Endpoint URL (例: <https://xxxxx.r2.cloudflarestorage.com>)

  2. .envファイルの作成

  取得した情報を使って.envファイルを作成します。以下の情報を教えてください：

  1. R2_PUBLIC_BASE_URL: バケットの公開URL（<https://pub-xxxxx.r2.dev）>
  2. R2_ACCESS_KEY: Access Key ID
  3. R2_SECRET_KEY: Secret Access Key
  4. R2_BUCKET_NAME: バケット名（english-phrase-mediaなど）
  5. R2_SIGNING_ENDPOINT: Endpoint URL（<https://xxxxx.r2.cloudflarestorage.com）>
