# まなびば（簿記入門・試作版）

簿記入門の教材を読み、問題を解いて、習熟度を確認できる学習アプリの試作版です。

- **教材・問題**：運営者（あなた）が用意したものだけを使います
- **採点**：AI は使わず、正解データと機械的に照合します（全角数字・カンマ・行の順番違いにも対応）
- **AI チューター**（Amazon Bedrock）：教材や問題の解説、受講者の質問への回答
- **習熟度**：解答記録から単元ごと・講座全体で算出します

## 費用

**課金は発生しません。** AWS は無料プランのまま使います。

- サーバー・データベースは使いません（学習記録はブラウザの中に保存）
- AI チューターの利用分は、無料プランのクレジットから差し引かれます（請求はされません）
- 課金が必要になる変更は、事前に金額を示して確認します（`CLAUDE.md` のルール）

## 起動のしかた

```bash
cd learning-app
npm install
aws login --profile default   # AWS にログイン（12 時間有効、90 日まで延長可）
npm start                     # http://localhost:3000
npm test                      # 採点・習熟度のテスト
```

AI の認証情報は AWS CLI（`aws configure export-credentials`）から受け取ります。

## 教材と問題の追加

1. `content/courses.json` の `lessons` に単元を追加（`id`, `title`, `minutes`）
2. `content/lessons/boki-intro/<単元 id>.md` に教材を Markdown で書く
3. `content/problems/boki-intro.json` に問題を追加

### 問題の形式

```jsonc
// 仕訳
{ "id": "q1", "lessonId": "unit-01", "type": "journal",
  "question": "現金 100,000 円を元入れして開業した。",
  "accounts": ["現金", "資本金", "借入金"],          // 選択肢に出す勘定科目
  "answer": { "debit":  [{ "account": "現金",   "amount": 100000 }],
              "credit": [{ "account": "資本金", "amount": 100000 }] },
  "explanation": "解説（任意）" }

// 選択式（answer は 0 から数えた番号）
{ "id": "q2", "lessonId": "unit-01", "type": "choice",
  "question": "…", "choices": ["A", "B", "C"], "answer": 1, "explanation": "…" }

// 数値
{ "id": "q3", "lessonId": "unit-01", "type": "number",
  "question": "…", "unit": "円", "answer": 250000, "explanation": "…" }
```

正解と解説は、受講者が答えるまで画面に送られません。

## 習熟度の計算

- 1 問のスコア：直近 3 回の正誤を、新しい順に 5:3:2 で重み付け（0〜1）
- 単元・講座の習熟度：対象の全問題のスコアの平均（未解答は 0）
- 表示：未学習（未解答）／要復習（40% 未満）／学習中（40〜79%）／定着（80% 以上）

## 設定（環境変数）

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `TUTOR_MODEL_ID` | `apac.amazon.nova-lite-v1:0` | AI モデル。Anthropic の利用目的フォーム（無料）提出後は `au.anthropic.claude-sonnet-4-6` も可 |
| `TUTOR_AWS_PROFILE` | `default` | AWS のプロファイル名 |
| `PORT` | `3000` | ポート |
