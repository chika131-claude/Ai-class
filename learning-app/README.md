# まなびば（オンライン学習ソフト・試作版）

講座の一覧 → 講座の詳細 → レッスン（教材ページ + AI チューター）の 3 画面からなる、オンライン講座サイトの試作版です。
AI チューターは Amazon Bedrock（ap-southeast-2）を使い、**そのレッスンの教材の内容をもとに**受講者の質問に答えます。

## 起動のしかた

```bash
cd learning-app
npm install
aws login --profile default        # AWS にログイン（12 時間有効）
npm start                          # Claude Sonnet 4.6 で起動
# または
npm run start:nova                 # Amazon Nova Lite で起動（Anthropic のフォーム提出前でも使える）
```

ブラウザで http://localhost:3000 を開きます。

> クラウドの Claude Code 環境では `AWS_ACCESS_KEY_ID` などの環境変数が入っていることがあります。
> このアプリは `aws login` のプロファイルを直接読むので影響を受けませんが、AWS CLI を使うときは
> `env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY aws ...` のように外してください。

## 設定（環境変数）

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `TUTOR_MODEL_ID` | `au.anthropic.claude-sonnet-4-6` | 使うモデル。`au.` はオーストラリア国内で処理 |
| `TUTOR_AWS_PROFILE` | `default` | AWS のプロファイル名。空文字で SDK 標準の認証情報（本番の Lambda 向け） |
| `PORT` | `3000` | サーバーのポート |

無料プランでは Claude 5.x 系は使えません。有料プランにすると `au.anthropic.claude-sonnet-5-5` なども使えます。

## 講座の追加

1. `content/courses.json` に講座とレッスン（`id`, `title`, `minutes`）を追加
2. `content/lessons/<講座 id>/<レッスン id>.md` に教材を Markdown で書く

プログラムの変更は不要です。AI チューターは自動でその教材をもとに答えます。

## 安全のための工夫

- AI に渡す教材はサーバー側で読み込む（受講者が教材をすり替えられない）
- 講座・レッスン ID は `courses.json` に登録されたものだけ受け付ける
- 質問は 1 回 2,000 文字・会話 20 件まで、IP ごとに 5 分 30 回まで
- `maxTokens` を明示（費用と利用枠の対策）
- AI の回答はエスケープしてから表示（HTML の埋め込みを防ぐ）

## 今後（公開・販売に向けて）

- ログイン（Amazon Cognito）と受講履歴の保存（DynamoDB）
- 決済（Stripe など）と購入者だけが見られる仕組み
- 動画教材（S3 + CloudFront）
- AWS へのデプロイ（画面は S3 + CloudFront、API は Lambda。すべて ap-southeast-2）
