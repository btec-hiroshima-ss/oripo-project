# 開発フロー

Phase 5 以降の機能実装における標準手順。**Claude あり**と**Claude なし**の2モードに対応。

---

## 共通事項

### ブランチ戦略

| ブランチ | 役割 |
|---|---|
| `main` | リリース済み・安定版 |
| `develop` | 開発の集約先 |
| `feature/issue-{番号}-{内容}` | 作業ブランチ |

- 作業ブランチは必ず `develop` から切る
- `main` / `develop` への直接 push 禁止（PR 経由のみ）

### コミットメッセージ

- **日本語**で記述
- プレフィックスなし（例: `ログイン機能を追加`、`スケジュール表示のバグを修正`）

### 仕様書テンプレート（`specs/{機能名}.md`）

```markdown
# 機能名
## 概要
## モックアップ
## 機能要件
## API
## データモデル
## 受け入れ条件
```

---

## Claude ありフロー

Claude がスキルコマンドを使って自律的に進める。

```
【人間】開発してほしいIssueを選び、Claudeに指示を出す
  │
  ▼
[1] ブランチ作成（develop から）
  │
  ▼
[2] 仕様書作成・更新（specs/{機能名}.md）
    └─ /spec-review → 指摘があれば修正
  │
  ▼
[3] 実装 + ユニットテスト（Vitest）
    ├─ /check-implementation で規約確認してから着手
    └─ テストは受け入れ条件をもとに作成（必須）
  │
  ▼
[4] コードレビュー
    └─ /code-review → 指摘があれば修正してステップ3へ戻る
  │
  ▼
[5] ブラウザ動作確認
    └─ /browser-check → NG があれば修正
  │
  ▼
[6] push & PR 作成 → 人間レビュー
    ├─ /spec-check で最終整合性確認
    ├─ develop ← feature/... の PR を作成
    └─ レビュー依頼

         【人間レビューの確認事項】
         ① 仕様書（specs/）を先に確認（最優先）
            └─ 要件定義書・AIPOと照らして問題がないか
         ② 動作確認（localhost:3000 でアプリを操作）
            ├─ 現行AIPOと要件定義書と照らして異なる部分がないか
            └─ 単純なバグがないか
  │
  ▼
[7] フィードバック対応（PRコメント）
    ├─ 全コメントを把握 → 修正をまとめて実施 → 全スレッドに返信
    └─ 変更内容に応じてスキルを再実行してステップ3へ戻る
```

### スキルコマンド一覧

| コマンド | タイミング | 内容 |
|---|---|---|
| `/check-implementation` | 実装前 | コーディング規約の確認 |
| `/spec-review` | 仕様書作成後 | 要件定義書・AIPO仕様との整合性チェック |
| `/code-review` | 実装後 | コード品質・仕様準拠のレビュー |
| `/browser-check` | 実装後 | ブラウザ動作確認（受け入れ条件に従って操作） |
| `/spec-check` | PR作成前 | 仕様書・実装・テストの整合性最終確認 |
| `/generate-checklist` | 任意 | 手動確認用チェックリストを specs/checklists/ に生成 |

---

## Claude なしフロー

人間が手動で進める場合の手順。各ステップの代替方法を記載する。

```
Issue 確認
  │
  ▼
[1] ブランチ作成
    git checkout develop && git pull origin develop
    git checkout -b feature/issue-{番号}-{内容}
  │
  ▼
[2] 仕様書作成・更新（specs/{機能名}.md）
    ├─ docs/02_requirements/requirements.md を確認（最優先）
    ├─ docs/01_current/ で AIPO 現行仕様を確認
    └─ チームレビュー後に実装へ進む
  │
  ▼
[3] 実装 + ユニットテスト（Vitest）
    ├─ docs/05_develop/implementation-rules.md の規約に従う
    ├─ 仕様書の受け入れ条件をもとにテストを作成（必須）
    └─ npm run test で通過確認
  │
  ▼
[4] コードレビュー（チームメンバーによる）
    ├─ implementation-rules.md のチェックリストを使う
    └─ 指摘があれば修正してテストを再実行
  │
  ▼
[5] ブラウザ動作確認
    ├─ specs/checklists/{機能名}.md があれば使う
    └─ 仕様書の受け入れ条件をすべて手動操作で確認
  │
  ▼
[6] push & PR 作成
    git push -u origin feature/issue-{番号}-{内容}
    gh pr create --base develop --title "..." --body "..."
  │
  ▼
[7] レビュー対応 → マージ
    └─ レビュワーのコメントに対応して push
```

### 確認の優先順位

| 優先度 | 参照先 |
|---|---|
| 1（最優先） | `docs/02_requirements/requirements.md` |
| 2 | AIPO 現行仕様（`docs/01_current/`） |
| 3 | 独自判断（理由を仕様書に明記・チームに確認） |

---

## develop → main へのリリース

```bash
# develop から main への PR を作成
gh pr create --base main --head develop --title "リリース: {内容}" --body "..."
```

- リリース PR はチームメンバーが作成・マージする
- マージ後に CI/CD が自動でイメージをビルドして本番に反映される（`.github/workflows/deploy.yml`）

---

## よく使うコマンド

```bash
# Issue 確認
gh issue view <番号> -R btec-hiroshima-ss/oripo-project

# PR 一覧
gh pr list -R btec-hiroshima-ss/oripo-project

# テスト実行
npm run test

# 型チェック
npx tsc --noEmit

# ローカル起動
docker compose up
```
