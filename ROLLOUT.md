# GIGA Standard v4 ロールアウト記録

| リポジトリ | 型 | P0 | P1(表示/PWA) | P2 | P3 | ゲート | 備考 |
|---|---|:--:|:--:|:--:|:--:|:--:|---|
| Gobblet | A | ✅ | ✅ | ✅ | ✅ | ✅ | 2026-08-03 実施。sw.js の他アプリ破壊と manifest の `id:"/"` を修正 |

## このリポジトリで実際にかかった手間（他リポジトリの見積もり用）

| フェーズ | 変更ファイル | 内容 | 所見 |
|---|---|---|---|
| P0 | 3 | LICENSE / .gitignore / dependabot.yml | どのリポジトリでも同じ。機械的に展開できる |
| P1 | 16 | sw.js 置換・manifest 修正・アイコン生成・CSP・表示の不具合修正 | **CSP のためのインライン切り出しがいちばん重い。** 単一HTML構成のアプリは全部これが要る |
| P2 | 6 | favicon 615KB → 3.3KB ほか | アイコンは `icon.svg` から Chromium で描き出すのが速くて劣化しない |
| P3 | 2 | MANUAL.md / README 追記 | 文章仕事。アプリごとに書き下ろしが必要 |
| P4 | 4 | 品質ゲート・テスト・CI | `scripts/check-project.mjs` は他リポジトリへほぼそのまま移植できる |

## 他リポジトリへ展開するときに、まず確認すること

1. **`sw.js` の `caches.keys()` 全削除**（このリポジトリで見つかった最悪の不具合）
   `gigayama.github.io` は同一オリジンを共有しているため、1本でもこれが残っていると
   他のアプリがオフラインで起動しなくなる。**最優先で全リポジトリを横断確認すること。**
   ```bash
   grep -n "caches.keys" sw.js docs/sw.js public/sw.js 2>/dev/null
   ```
2. **`manifest.webmanifest` の `id` / `start_url` / `scope`**
   `"/"` や相対パス、あるいはコピー元のリポジトリ名が残っていないか。
   ```bash
   grep -E '"id"|"scope"|"start_url"' manifest.webmanifest
   ```
3. **150KB を超える画像**
   ```bash
   find . -name "*.png" -size +150k -not -path "./.git/*" -exec ls -lh {} \;
   ```

## 品質ゲートの移植手順

1. `scripts/check-project.mjs` と `quality.config.json` をコピーする
2. `quality.config.json` の `repoName` / `notApplicable` を実態に合わせて書き換える
3. `package.json` に `"check": "node scripts/check-project.mjs"` を追加する
4. `.github/workflows/ci.yml` をコピーする
5. **落ちた項目を、検査を緩めて通さない。** どうしても直せないものは
   `securityExceptions` に `{"id": "...", "reason": "..."}` を書いて明示的に許可する

## 未着手（人間の判断が要るもの）

- **manifest の `id` 変更に伴う再インストール**の周知タイミング（AUDIT.md の「人間に確認してほしいこと」参照）
- 他56リポジトリへの展開順（GIGA Standard v4 Part III の推奨順に従う想定）
