以下の手順でサブエージェントを起動し、仕様書レビューを実施してください。

## ステップ 1: コンテキスト収集

Bash で以下を実行して結果を記録する：

```bash
git branch --show-current
git diff develop...HEAD --name-only
```

## ステップ 2: サブエージェント起動

収集した情報を使って Agent を起動する（`run_in_background: false`）。

- `subagent_type`: `"spec-reviewer"`
- `description`: `"仕様書レビュー"`
- `prompt` に以下を含める：
  - 作業ブランチ名
  - 変更ファイルの一覧
  - 「上記コンテキストをもとに仕様書レビューを実施してください」

## ステップ 3: 結果の処理

- 指摘がなければ「レビュー OK」としてステップ 3（実装）へ進む
- 指摘があれば修正してから再実行する
