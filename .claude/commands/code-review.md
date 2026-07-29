以下の手順でサブエージェントを起動し、コードレビューを実施してください。

## ステップ 1: コンテキスト収集

Bash で以下を実行して結果を記録する：

```bash
git branch --show-current
git diff develop...HEAD --name-only
```

## ステップ 2: サブエージェント起動

収集した情報を使って Agent を起動する（`run_in_background: false`）。

- `subagent_type`: `"code-reviewer"`
- `description`: `"コードレビュー"`
- `prompt` に以下を含める：
  - 作業ブランチ名
  - 変更ファイルの一覧
  - 「上記コンテキストをもとにコードレビューを実施してください」

## ステップ 3: 結果の処理

- 指摘がなければ「レビュー OK」としてステップ 5（ブラウザ動作確認）へ進む
- 指摘があれば修正してから再実行する
