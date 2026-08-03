# ✅ GIGA Standard v4 監査：パクパクゴブレット（Gobblet）

- 監査日：2026-08-03
- 対象コミット：`3b452d8`（main）
- 判定：**A型（単一HTML完結・静的ホスティング）**
  - `vite.config.*` なし／`*.gs` なし／`manifest.json`（MV3）なし
  - `package.json` の依存は `express` のみ（開発用ローカルサーバー `server.js`。配信物には含まれない）
- 公開先の想定：`https://gigayama.github.io/Gobblet/`

> 判定の凡例　✅ 適合 ／ ⚠️ 一部不足 ／ ❌ 不適合 ／ — 対象外

---

## A. 法務・配布

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| A1 | LICENSE 実ファイル | ❌ | ファイルなし。README には「MIT License」とだけ書かれており、本文が存在しない |
| A2 | .gitignore | ⚠️ | `node_modules/` の1行のみ。`.env` `.DS_Store` `.assets-original/` 等が未指定 |
| A3 | dependabot.yml | ❌ | `.github/` ディレクトリ自体が存在しない |
| A4 | README.md / MANUAL.md 両方 | ⚠️ | README.md はある（62行）。MANUAL.md（先生向け）が**なし** |

## B. セキュリティ

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| B1 | CSP（connect-src が最小） | ❌ | `Content-Security-Policy` の記述が0件。インライン `<script>` 1個・インライン `<style>` 1個・`onclick=` 属性1個（offline.html:18）があるため、現状のままでは CSP を入れられない |
| B2 | 秘密情報・IDの直書きなし | ✅ | `.env` / `.clasp.json` / APIキー / メールアドレス / シートID いずれも検出なし。`git ls-files` にも該当なし |
| B3 | OAuthスコープ最小 | — | GAS を使わない静的アプリのため対象外 |
| B4 | postMessage の宛先が `*` でない | ✅ | `postMessage` の使用が0件 |
| B5 | サーバー側5段ガード | — | サーバーを持たず、個人情報を一切扱わないため対象外 |

**補足**：本アプリは通信を一切行わず、氏名・出席番号などの個人情報を保持しない（`localStorage` の使用も0件）。信頼境界の観点でのリスクは低い。

## C. 堅牢性

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| C1 | LockService + try/finally | — | GAS ではないため対象外 |
| C2 | 自動復旧 | — | 永続データを持たないため対象外 |
| C3 | pagehide で記録確定 | — | 保存する記録が存在しないため対象外（対局は再読み込みでリセットされる仕様） |
| C4 | 通信失敗時のリトライと明示 | ⚠️ | `offline.html` はあるが、Service Worker の更新失敗・待機を利用者に知らせる導線がない |
| C5 | localStorage.clear() を使っていない | ✅ | `localStorage` の参照が0件 |

## D. 表示（Part I §2）

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| D1 | viewport に viewport-fit=cover | ⚠️ | index.html は ✅（5行目）。**offline.html は未設定** |
| D2 | 100dvh を使用（100vh 単独でない） | ⚠️ | index.html は `min-height:100dvh` ✅。**offline.html:9 が `min-height:100vh` 単独**（`dvh` フォールバックなし） |
| D3 | safe-area-inset を適用 | ⚠️ | index.html は header/footer/toast に計8箇所 ✅。**offline.html は0箇所** |
| D4 | clamp() による fluid type | ✅ | h1・label・turn・盤面・駒サイズに `clamp()` を使用。ただし CSS 変数（`--fs-body` 等）としては定義されていない |
| D5 | Canvas に devicePixelRatio 補正 | — | `getContext('2d')` の使用が0件。駒・アイコンはすべてインライン SVG のためぼやけない |
| D6 | 320px 幅で横スクロールが出ない | ⚠️ | `overflow:hidden` により横スクロールバーは出ないが、320px 幅では手駒6個（34+34+42+42+50+50px＋余白）が入りきらず、flex 縮小で駒が歪む可能性がある（要実測） |
| D7 | 画像に width/height、150KB以下 | ❌ | **`favicon.png` が 1024×1024 / 615KB**（上限150KB の4倍超。favicon 上限30KB に対しては20倍超）。しかも `sw.js` のプリキャッシュ対象に含まれており、初回起動時に必ずダウンロードされる |
| D8 | コントラスト 4.5:1 以上 | ✅ | 主要な文字色を実測：`#1769aa`/白＝5.78、`#bf360c`/白＝5.60、`#b71c1c`/白＝6.50、`#0d47a1`/白＝8.60、`#795548`/白＝7.16、`#2e7d32`＋白文字＝5.12。手番表示の `●`（`#f4511e`＝3.47）は文字ではなく記号のため 3:1 基準で適合 |
| D9 | タップ領域 44px 以上・touch-action | ⚠️ | `touch-action:manipulation` は ✅。サイズは **`.btn` 38px / `.icon-btn` 38px / `.reset` 34px / 小駒 34px** で、いずれも 44px 未満 |
| D10 | prefers-reduced-motion 対応 | ⚠️ | index.html は ✅（28行目）。offline.html は未対応 |
| D11 | 提示モード（一斉授業で使う場合） | ❌ | フルスクリーン API のボタンがない。電子黒板で2人対戦を見せる使い方が想定されるが導線なし |
| D12 | 印刷CSS | — | 印刷して配る性質のアプリではない（対局画面のみ）ため対象外 |
| D13 | forced-colors（ハイコントラスト）対応 | ❌ | `@media (forced-colors: active)` が0件。背景色が無効化されるとボタンの輪郭が消える |

## E. PWA（Part I §3）

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| E1 | manifest の id/scope/start_url がリポジトリ名絶対パス | ❌ | **`"id": "/"`**。`gigayama.github.io` はオリジンを数十アプリで共有しているため、このアプリが**オリジンのルートを自分の識別子として占有**している。`start_url`/`scope` は `"./"`（相対）で実質 `/Gobblet/` に解決されるが、仕様が要求する絶対パス表記ではない |
| E2 | アイコン4種 + apple-touch-icon | ❌ | PNG アイコンは 1024×1024 の `favicon.png` 1枚のみ。192/512/maskable-192/maskable-512 が**すべて未整備**。`apple-touch-icon` は 615KB の favicon.png を流用（iOS は SVG・maskable 非対応のため実質これ1枚） |
| E3 | beforeinstallprompt を head 最上部で捕捉 | ❌ | **index.html:59（`</body>` 直前のインラインスクリプト内）**で登録。Chrome は条件が揃うと即座にイベントを出すため、校内Wi‑Fi が混んでいる端末では取りこぼして「インストール」ボタンが出ない |
| E4 | インストールボタンをアプリ内に設置 | ✅ | ヘッダーに `#install`（既定 `display:none`、イベント受信で表示） |
| E5 | sw.js が自アプリ接頭辞のキャッシュのみ削除 | ❌ | **sw.js:14-15 `caches.keys()` を全走査し、`VERSION` 以外を無条件で削除**。同一オリジンの他アプリ（gigayama.github.io の全アプリ）のキャッシュを消しており、それらがオフラインで起動しなくなる。**本監査で最も影響範囲が広い不具合** |
| E6 | sw.js が localStorage に触れていない | ✅ | 参照0件 |
| E7 | 更新通知 | ❌ | `updatefound` / `SKIP_WAITING` の実装なし。`skipWaiting()` を install 時に無条件実行しているため、**対局の途中で新版に切り替わって画面が作り直される**恐れがある |
| E8 | offline.html | ⚠️ | 存在するが、アプリ本体と配色は近いもののフォント・角丸・ボタン形状が異なり、`100vh`・safe-area 未対応 |
| E9 | APP_VERSION を今回のリリース値に更新した | ⚠️ | `VERSION = 'gobblet-v5'` という単一文字列。静的キャッシュとランタイムキャッシュが分離されておらず、版を上げるとユーザーが開いた全ファイルのキャッシュが毎回捨てられる |
| E10 | iOS の「ホーム画面に追加」手順を MANUAL に記載 | ❌ | MANUAL.md が存在しない |

## F. アクセシビリティ・性能

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| F1 | alt / aria-label / aria-live | ✅ | `<img>` は0件。アイコンボタンに `aria-label`、盤面に `role="grid"`/`gridcell`、手番に `aria-live="polite"`、トーストに `role="status"` |
| F2 | キーボードのみで全機能に到達 | ✅ | すべての操作要素が `<button>`。`:focus-visible` に3px アウトライン。`<dialog>` の `showModal()` によりフォーカストラップと Esc 閉じは標準機能で担保 |
| F3 | 初回JS 300KB以下 | ✅ | JS は約8KB（index.html 内蔵）。外部ライブラリ・CDN・Webフォントの読み込みは0件 |
| F4 | 1ファイル 5,000行 / 400KB 以内 | ✅ | 最大は index.html（63行 / 17KB） |
| F5 | 総アセット（初回）1MB以下 | ⚠️ | 実測 **634KB**（index 17KB + favicon 615KB + icon.svg 1KB + manifest/offline/sw 3KB）。上限内だが、**その97%が不要に巨大な favicon.png** |

## G. 学習ログ（学習系のみ）

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| G1 | study.v1 準拠・個人情報を持たない | — | 対戦ゲームであり学習記録を取らない設計。個人情報は保持していない（適合） |
| G2 | 中断記録・5分ルール | — | 同上、対象外 |

---

## ❌ の理由と対処方針（フェーズ割り当て）

| 優先 | 項目 | なぜ問題か | 対処 | フェーズ |
|:--:|---|---|---|:--:|
| 🔴1 | E5 `caches.keys()` 全削除 | **他アプリを壊している。**このゲームを開くだけで、同じ `gigayama.github.io` 上の他アプリがオフラインで起動しなくなる | `CACHE_PREFIX = 'gobblet-'` で始まるキャッシュだけを削除する形に置換 | P1 |
| 🔴2 | E1 `"id": "/"` | オリジンのルートを識別子として占有している。他アプリと取り違えて「開いたら違うゲームが立ち上がる」事故につながる | `id`/`start_url`/`scope` を `/Gobblet/` の絶対パスに修正（**§停止条件に該当。下記「人間に確認してほしいこと」参照**） | P1 |
| 🔴3 | D7/F5 favicon 615KB | 初回起動時に必ず 615KB を落とす。校内Wi‑Fi で40人が一斉に開くと待たされる | SVG から各サイズの PNG を生成し直し、favicon は30KB以下に | P1/P2 |
| 🟠4 | E2 アイコン不足 | Android のホーム画面でアイコンが白い枠に押し込まれる（maskable なし）。iOS で粗く表示される | 192/512/maskable 192/512/apple-touch-icon を生成 | P1 |
| 🟠5 | E3 捕捉位置 | 通信が遅い端末でインストールボタンが出ない | `<head>` 最上部に捕捉スクリプトを移動 | P1 |
| 🟠6 | E7 更新通知なし＋無条件 skipWaiting | **対局中に画面が作り直される**恐れ。逆に更新に気づけない | 待機 → トーストで「あたらしい バージョンが あります」→ 利用者が押したら適用 | P1 |
| 🟠7 | B1 CSP なし | 静的アプリでも、将来の混入・改ざんに対する最低限の防壁がない | インライン script/style を外部ファイル化した上で CSP を投入し、実ブラウザで `Refused to` 0件を確認 | P1 |
| 🟡8 | D9 タップ44px未満 | 低学年の指では押し外す | ボタンの最小寸法を 44px に。小駒は見た目を保ったまま当たり判定のみ 44px に拡張 | P1 |
| 🟡9 | D1/D2/D3/D10 offline.html | 圏外画面だけ作りが古く、iPhone で下端が隠れる | アプリ本体と同じ配色・フォント・safe-area・dvh に揃える | P1 |
| 🟡10 | D11 提示モード | 電子黒板で使うときに周辺 UI が邪魔になる | フルスクリーンボタンを追加（文言・配色は変更しない） | P1 |
| 🟡11 | D13 forced-colors | ハイコントラストモードでボタンの境界が消える | `@media (forced-colors: active)` を追加 | P1 |
| 🟢12 | A1/A2/A3 | 配布物としての体裁が整っていない | LICENSE・.gitignore・dependabot.yml を追加 | P0 |
| 🟢13 | A4/E10 | 先生が困ったときの拠り所がない | MANUAL.md を作成（iOS のホーム画面追加手順を含む） | P3 |
| 🟢14 | 品質ゲートなし | 次の改修で同じ劣化が再発する | `npm run check` で A〜F を機械チェック | P4 |

## 人間に確認してほしいこと（§停止条件に該当）

**manifest の `id` を `"/"` → `"/Gobblet/"` に変更すると、すでにインストール済みの端末では「別のアプリ」として扱われます。**
古いアイコンが残り、新しくインストールし直してもらう必要があります。

それでも変更を推奨する理由：

- 現在の `"id": "/"` は `https://gigayama.github.io/` そのものを識別子にしており、**同一オリジンの他アプリと衝突する構成**です（GIGA Standard v4 §3-1 が「最重要」として禁じている状態）。
- 衝突が起きると「アイコンを押したら違うアプリが開く」という、児童には原因が分からない事故になります。
- 影響を受けるのは**すでにインストール済みの端末だけ**で、ブラウザで遊んでいる場合・これから入れる場合には影響がありません。

本ロールアウトでは**修正する前提で進めています**。既存インストールを優先して現状維持にしたい場合は、この1点だけを差し戻してください（該当は `manifest.webmanifest` の `id` 行のみです）。
