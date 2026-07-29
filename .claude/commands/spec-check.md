以下の手順でサブエージェントを起動し、仕様書・実装・テストの整合性チェックを実施してください。

## ステップ 1: コンテキスト収集

Bash で以下を実行して結果を記録する：

```bash
git branch --show-current
git diff origin/main...HEAD --name-only
```

## ステップ 2: サブエージェント起動

収集した情報を使って Agent を起動する（`run_in_background: false`）。

- `subagent_type`: `"spec-checker"`
- `description`: `"仕様書・実装・テスト整合性チェック"`
- `prompt` に以下を含める：
  - 作業ブランチ名
  - 変更ファイルの一覧
  - 「上記コンテキストをもとに整合性チェックを実施してください」

## ステップ 3: 結果の処理

- 「整合性 OK」であれば push & PR 作成へ進む
- ズレがあれば内容を確認し、仕様書・実装・テストを修正してから再実行する
