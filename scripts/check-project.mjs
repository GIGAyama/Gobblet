#!/usr/bin/env node
/*
 * GIGA Standard v4 品質ゲート
 *
 * ブラウザを起動せずに調べられる範囲を機械的に検査する。
 * 「320px で横スクロールが出ないか」のような実際に描画しないと分からない項目は
 * 対象外なので、リリース前には MANUAL.md と AUDIT.md の手順で実機確認もすること。
 *
 * 使い方: npm run check
 * 検査を緩めたくなったら、まず quality.config.json の securityExceptions に
 * 「なぜ許すのか」を書く。理由なしで無効化しない。
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'quality.config.json'), 'utf8'));

const results = [];
const pass = (id, label, detail = '') => results.push({ id, label, ok: true, detail });
const fail = (id, label, detail = '') => results.push({ id, label, ok: false, detail });
const skip = (id, label, detail = '') => results.push({ id, label, ok: null, detail });

const read = p => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : null);
const size = p => (existsSync(join(ROOT, p)) ? statSync(join(ROOT, p)).size : -1);
const kb = n => `${(n / 1024).toFixed(1)}KB`;

const exempt = id => cfg.securityExceptions.find(e => e.id === id);

function walk(dir, out = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.assets-original'].includes(name.name)) continue;
    const full = join(dir, name.name);
    if (name.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const files = walk(ROOT).map(f => relative(ROOT, f));

const html = read(cfg.entry) ?? '';
const sw = read(cfg.swFile) ?? '';
// 「localStorage には触れない」といった説明文をコードと誤検出しないよう、
// 判定にはコメントを取り除いたものを使う
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const swCode = stripComments(sw);
const manifestRaw = read(cfg.manifest);
const manifest = manifestRaw ? JSON.parse(manifestRaw) : null;
const offline = read('offline.html') ?? '';
const cssFiles = files.filter(f => f.endsWith('.css'));
const jsFiles = files.filter(f => f.endsWith('.js') && f !== cfg.swFile && !f.startsWith('scripts/') && !f.startsWith('tests/'));
const allCss = cssFiles.map(f => read(f)).join('\n');
const allJs = jsFiles.map(f => read(f)).join('\n');

/* ── A. 法務・配布 ───────────────────────── */
for (const [id, label, file] of [
  ['A1', 'LICENSE 実ファイル', 'LICENSE'],
  ['A2', '.gitignore', '.gitignore'],
  ['A3', 'dependabot.yml', '.github/dependabot.yml'],
  ['A4a', 'README.md', 'README.md'],
  ['A4b', 'MANUAL.md（先生向け）', 'MANUAL.md'],
]) {
  existsSync(join(ROOT, file)) ? pass(id, label, file) : fail(id, label, `${file} がない`);
}
{
  const manual = read('MANUAL.md') ?? '';
  manual.includes('うまくいかないとき')
    ? pass('A5', 'MANUAL に「うまくいかないとき」がある')
    : fail('A5', 'MANUAL に「うまくいかないとき」がある', '節が見つからない');
  manual.includes('ホーム画面に追加')
    ? pass('A6', 'MANUAL に iOS のホーム画面追加手順がある')
    : fail('A6', 'MANUAL に iOS のホーム画面追加手順がある');
}

/* ── B. セキュリティ ─────────────────────── */
{
  const csp = /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i.exec(html)?.[0] ?? '';
  if (!csp) fail('B1', 'CSP がある');
  else if (/connect-src[^;"]*\*/.test(csp)) fail('B1', 'CSP がある', 'connect-src にワイルドカードがある');
  else if (/'unsafe-inline'|'unsafe-eval'/.test(csp)) fail('B1', 'CSP がある', "unsafe-inline / unsafe-eval が入っている");
  else pass('B1', 'CSP がある', 'connect-src は最小');

  offline.includes('Content-Security-Policy')
    ? pass('B1b', 'offline.html にも CSP がある')
    : fail('B1b', 'offline.html にも CSP がある');

  // インライン script / style は CSP と両立しない
  const inlineScript = /<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/i.test(html + offline);
  const inlineStyle = /<style[^>]*>[\s\S]*?<\/style>/i.test(html + offline);
  const onAttr = /\son[a-z]+\s*=\s*["']/i.test(html + offline);
  !inlineScript && !inlineStyle && !onAttr
    ? pass('B1c', 'インライン script / style / on属性 がない')
    : fail('B1c', 'インライン script / style / on属性 がない',
        [inlineScript && 'inline <script>', inlineStyle && 'inline <style>', onAttr && 'on属性'].filter(Boolean).join(' / '));

  const secretRe = /(AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|[A-Za-z0-9._%+-]+@(?!example\.)[A-Za-z0-9.-]+\.(?:com|jp|net|org)\b)/;
  const leaked = files.filter(f => /\.(html|js|mjs|json|css|md|yml)$/.test(f) && f !== 'package-lock.json' && secretRe.test(read(f) ?? ''));
  leaked.length ? fail('B2', '秘密情報・メールアドレスの直書きがない', leaked.join(', ')) : pass('B2', '秘密情報・メールアドレスの直書きがない');

  const committed = files.filter(f => /(^|\/)(\.env|\.clasp\.json)$/.test(f));
  committed.length ? fail('B2b', '.env / .clasp.json がコミットされていない', committed.join(', ')) : pass('B2b', '.env / .clasp.json がコミットされていない');

  /postMessage\s*\([^)]*["']\*["']/.test(allJs + html)
    ? fail('B4', "postMessage の宛先が '*' でない")
    : pass('B4', "postMessage の宛先が '*' でない");
}

/* ── C. 堅牢性 ───────────────────────────── */
{
  /localStorage\s*\.\s*clear\s*\(/.test(stripComments(allJs + html + sw))
    ? fail('C5', 'localStorage.clear() を使っていない')
    : pass('C5', 'localStorage.clear() を使っていない');
}

/* ── D. 表示 ─────────────────────────────── */
{
  /viewport-fit=cover/.test(html) ? pass('D1', 'viewport に viewport-fit=cover') : fail('D1', 'viewport に viewport-fit=cover');
  /viewport-fit=cover/.test(offline) ? pass('D1b', 'offline.html も viewport-fit=cover') : fail('D1b', 'offline.html も viewport-fit=cover');

  // 100vh だけを使っている行がないか（dvh のフォールバックとして併記するのは可）
  const badVh = [];
  for (const f of [...cssFiles, cfg.entry, 'offline.html']) {
    const text = read(f);
    if (!text) continue;
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (/\b100vh\b/.test(line)) {
        const near = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
        if (!/\b100dvh\b/.test(near)) badVh.push(`${f}:${i + 1}`);
      }
    });
  }
  badVh.length ? fail('D2', '100dvh を使用（100vh 単独でない）', badVh.join(', ')) : pass('D2', '100dvh を使用（100vh 単独でない）');

  /safe-area-inset/.test(allCss) ? pass('D3', 'safe-area-inset を適用') : fail('D3', 'safe-area-inset を適用');
  /clamp\(/.test(allCss) ? pass('D4', 'clamp() による fluid type') : fail('D4', 'clamp() による fluid type');

  // Canvas を使うなら DPR 補正が要る
  if (/getContext\(\s*['"]2d['"]/.test(allJs)) {
    /devicePixelRatio/.test(allJs)
      ? pass('D5', 'Canvas に devicePixelRatio 補正')
      : fail('D5', 'Canvas に devicePixelRatio 補正', 'getContext(2d) はあるが補正がない');
  } else {
    skip('D5', 'Canvas の DPR 補正', cfg.notApplicable.canvasDpr);
  }

  // 画像の重さ。
  // 見ているのは「児童の端末が実際に受け取る画像」なので、docs/ の中は数えない。
  // 記事用のスクリーンショットのような、配信物に含まれない資料まで縛ると、
  // 資料の解像度を落とすほうに力が働いてしまい、この検査の目的と合わない。
  const images = files.filter(f => /\.(png|jpe?g|webp|gif)$/i.test(f) && !f.startsWith('docs/'));
  const heavy = images.filter(f => {
    const s = size(f);
    if (/^favicon\.png$/i.test(f)) return s > cfg.limits.maxFaviconBytes;
    if (/^icons\//.test(f)) return s > cfg.limits.maxIconBytes;
    return s > cfg.limits.maxImageBytes;
  });
  heavy.length
    ? fail('D7', '画像が上限内', heavy.map(f => `${f} ${kb(size(f))}`).join(', '))
    : pass('D7', '画像が上限内', images.map(f => `${f} ${kb(size(f))}`).join(', '));

  // <img> に width/height（CLS 対策）
  const imgTags = [...(html + offline).matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const badImg = imgTags.filter(t => !/\bwidth=/.test(t) || !/\bheight=/.test(t) || !/\balt=/.test(t));
  badImg.length ? fail('D7b', '<img> に width/height/alt がある', badImg.join(' ')) : pass('D7b', '<img> に width/height/alt がある', `${imgTags.length}件`);

  /touch-action/.test(allCss) ? pass('D9a', 'touch-action がある') : fail('D9a', 'touch-action がある');
  /min-height:\s*44px|min-height: 44px/.test(allCss) ? pass('D9b', 'タップ領域 44px の指定がある') : fail('D9b', 'タップ領域 44px の指定がある');

  /prefers-reduced-motion/.test(allCss) ? pass('D10', 'prefers-reduced-motion 対応') : fail('D10', 'prefers-reduced-motion 対応');
  /requestFullscreen/.test(allJs) ? pass('D11', '提示モード（フルスクリーン）') : fail('D11', '提示モード（フルスクリーン）');
  cfg.notApplicable.print ? skip('D12', '印刷CSS', cfg.notApplicable.print) : null;
  /forced-colors/.test(allCss) ? pass('D13', 'forced-colors 対応') : fail('D13', 'forced-colors 対応');

  // 画面に出る漢字にすべてふりがなが付いているか。
  // 属性（aria-label など）は読み上げ用で画面には出ないので対象外。
  {
    const visibleText = src => {
      const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(src)?.[1] ?? '';
      return body
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
        .replace(/<ruby\b[\s\S]*?<\/ruby>/gi, '')   // ふりがな付きの部分はまるごと除く
        .replace(/<[^>]*>/g, '')                    // 残りのタグと属性を除く
        .replace(/&[a-z]+;|&#\d+;/gi, '');
    };
    const kanji = /[一-鿿]/g;
    const bare = [];
    for (const f of [cfg.entry, 'offline.html']) {
      const text = visibleText(read(f) ?? '');
      const hits = [...new Set(text.match(kanji) ?? [])];
      if (hits.length) bare.push(`${f}: ${hits.join('')}`);
    }
    bare.length
      ? fail('D14', '画面に出る漢字にふりがなが付いている', `ふりがなの無い漢字: ${bare.join(' / ')}`)
      : pass('D14', '画面に出る漢字にふりがなが付いている');
  }

  // JavaScript から出す文言も同じ（{漢字|かんじ} 記法で書く）
  {
    const shown = [...allJs.matchAll(/(?:notice|showMessage)\(([\s\S]*?)\);/g)].map(m => m[1]).join('');
    const literals = [...shown.matchAll(/'([^']*)'|`([^`]*)`/g)].map(m => m[1] ?? m[2]);
    const bad = literals.filter(l => /[一-鿿]/.test(l.replace(/\{[^|{}]+\|[^|{}]+\}/g, '')));
    bad.length
      ? fail('D15', 'JS の画面文言にもふりがなが付いている', bad.join(' / '))
      : pass('D15', 'JS の画面文言にもふりがなが付いている', `${literals.length}件を確認`);
  }
}

/* ── E. PWA ──────────────────────────────── */
{
  // 正しい値は「どこで配信するか」で変わる。
  // CNAME があれば独自ドメインの直下に置かれるので "./"。
  // 旧構成のようにオリジンを他アプリと共有する配置なら、取り違えを避けるため
  // リポジトリ名の絶対パスが要る。
  // ⚠️ 独自ドメインでリポジトリ名の絶対パスに戻すと、scope がページの URL を
  //    含まなくなり、manifest ごと無視されて PWA としてインストールできなくなる。
  const want = existsSync(join(ROOT, 'CNAME')) ? './' : `/${cfg.repoName}/`;
  if (!manifest) fail('E1', 'manifest がある');
  else {
    const bad = ['id', 'start_url', 'scope'].filter(k => !String(manifest[k] ?? '').startsWith(want));
    bad.length
      ? fail('E1', `manifest の id/scope/start_url が ${want} 始まり`, bad.map(k => `${k}=${manifest[k]}`).join(', '))
      : pass('E1', `manifest の id/scope/start_url が ${want} 始まり`);

    // shortcuts の url も scope の中でなければならない。
    // scope の外を指すショートカットはブラウザに捨てられる（メニューに出ない）。
    const badShortcuts = (manifest.shortcuts ?? [])
      .map(sc => String(sc.url ?? ''))
      .filter(u => !u.startsWith(want));
    badShortcuts.length
      ? fail('E1b', `shortcuts の url が ${want} 始まり`, badShortcuts.join(', '))
      : pass('E1b', `shortcuts の url が ${want} 始まり`);

    const purposes = (manifest.icons ?? []).map(i => `${i.sizes}:${i.purpose}`);
    const needMaskable = purposes.some(p => p.includes('maskable'));
    needMaskable ? pass('E2a', 'manifest に maskable アイコンがある') : fail('E2a', 'manifest に maskable アイコンがある');
  }

  const missing = cfg.requiredIcons.filter(p => !existsSync(join(ROOT, p)));
  missing.length ? fail('E2b', 'アイコン4種 + apple-touch-icon', `ない: ${missing.join(', ')}`) : pass('E2b', 'アイコン4種 + apple-touch-icon');
  /apple-touch-icon/.test(html) ? pass('E2c', 'apple-touch-icon を <head> で参照') : fail('E2c', 'apple-touch-icon を <head> で参照');

  // beforeinstallprompt を捕まえる仕掛けが <head> の早い位置にあるか
  {
    const headEnd = html.indexOf('</head>');
    const head = html.slice(0, headEnd < 0 ? html.length : headEnd);
    const scripts = [...head.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)];
    const idx = scripts.findIndex(m => /pwa-install/.test(m[1]));
    const hasHandler = /beforeinstallprompt/.test(read('js/pwa-install.js') ?? '') || /beforeinstallprompt/.test(head);
    if (!hasHandler) fail('E3', 'beforeinstallprompt を head 最上部で捕捉', '捕捉するコードがない');
    else if (idx !== 0) fail('E3', 'beforeinstallprompt を head 最上部で捕捉', `head 内で ${idx + 1} 番目の script`);
    else pass('E3', 'beforeinstallprompt を head 最上部で捕捉');
  }

  /id=["']install["']/.test(html) ? pass('E4', 'インストールボタンがある') : fail('E4', 'インストールボタンがある');

  // 最重要：他アプリのキャッシュを消していないか
  {
    const hasPrefix = /CACHE_PREFIX/.test(swCode);
    const deletesAll = /caches\.keys\(\)/.test(swCode) && !/startsWith\(\s*CACHE_PREFIX/.test(swCode);
    hasPrefix && !deletesAll
      ? pass('E5', 'sw.js が自アプリ接頭辞のキャッシュのみ削除')
      : fail('E5', 'sw.js が自アプリ接頭辞のキャッシュのみ削除', '同一オリジンの他アプリを壊す恐れがある');
  }

  /localStorage/.test(swCode) ? fail('E6', 'sw.js が localStorage に触れていない') : pass('E6', 'sw.js が localStorage に触れていない');
  /SKIP_WAITING/.test(sw) && /updatefound/.test(allJs) ? pass('E7', '更新通知の仕組みがある') : fail('E7', '更新通知の仕組みがある');
  existsSync(join(ROOT, 'offline.html')) ? pass('E8', 'offline.html がある') : fail('E8', 'offline.html がある');

  {
    const v = /APP_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(sw)?.[1];
    const pkg = JSON.parse(read('package.json') ?? '{}').version;
    if (!v) fail('E9', 'sw.js に APP_VERSION がある');
    else if (pkg && v !== pkg) fail('E9', 'APP_VERSION と package.json の version が一致', `sw=${v} / package.json=${pkg}`);
    else pass('E9', 'APP_VERSION と package.json の version が一致', v);
  }

  // プリキャッシュの取りこぼし（存在しないファイルを並べていないか）
  {
    const list = /PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/.exec(sw)?.[1] ?? '';
    const urls = [...list.matchAll(/['"]\.\/([^'"]+)['"]/g)].map(m => m[1]).filter(Boolean);
    const gone = urls.filter(u => !existsSync(join(ROOT, u)));
    gone.length ? fail('E11', 'プリキャッシュ対象が実在する', `ない: ${gone.join(', ')}`) : pass('E11', 'プリキャッシュ対象が実在する', `${urls.length}件`);

    // 逆に、読み込んでいるのにキャッシュしていないファイルがないか
    const refs = [...(html + offline).matchAll(/(?:src|href)=["']\.\/([^"']+)["']/g)].map(m => m[1])
      .filter(u => !u.startsWith('http') && !u.includes('manifest.webmanifest') === false || /\.(css|js)$/.test(u));
    const notCached = [...new Set(refs)].filter(u => /\.(css|js)$/.test(u) && !urls.includes(u));
    notCached.length ? fail('E12', '読み込む CSS/JS がすべてプリキャッシュ対象', notCached.join(', ')) : pass('E12', '読み込む CSS/JS がすべてプリキャッシュ対象');
  }
}

/* ── F. アクセシビリティ・性能 ───────────── */
{
  const iconBtns = [...html.matchAll(/<button\b[^>]*>/gi)].filter(m => !/aria-label/.test(m[0]));
  // テキストを持つボタンは aria-label 不要。id だけで判定せず、アイコンのみのものを見る
  const iconOnly = [...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/gi)]
    .filter(m => !/aria-label/.test(m[0]) && /^[\s⛶？?🔊🔇×]*$/.test(m[1]));
  iconOnly.length ? fail('F1a', 'アイコンのみのボタンに aria-label', iconOnly.map(m => m[0]).join(' ')) : pass('F1a', 'アイコンのみのボタンに aria-label', `button ${iconBtns.length}件を確認`);
  /aria-live/.test(html) ? pass('F1b', 'aria-live がある') : fail('F1b', 'aria-live がある');

  const jsBytes = jsFiles.reduce((n, f) => n + size(f), 0);
  jsBytes <= cfg.limits.maxInitialScriptBytes
    ? pass('F3', `初回JS ${kb(cfg.limits.maxInitialScriptBytes)} 以下`, kb(jsBytes))
    : fail('F3', `初回JS ${kb(cfg.limits.maxInitialScriptBytes)} 以下`, kb(jsBytes));

  const big = files.filter(f => /\.(js|mjs|css|html|gs)$/.test(f) && (size(f) > cfg.limits.maxFileBytes || (read(f) ?? '').split('\n').length > cfg.limits.maxFileLines));
  big.length ? fail('F4', '1ファイル 5,000行 / 400KB 以内', big.join(', ')) : pass('F4', '1ファイル 5,000行 / 400KB 以内');

  // 初回に読む合計（プリキャッシュされるもの）
  {
    const list = /PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/.exec(sw)?.[1] ?? '';
    const urls = [...list.matchAll(/['"]\.\/([^'"]+)['"]/g)].map(m => m[1]).filter(u => existsSync(join(ROOT, u)));
    const total = urls.reduce((n, u) => n + size(u), 0);
    total <= cfg.limits.maxInitialAssetBytes
      ? pass('F5', `総アセット ${kb(cfg.limits.maxInitialAssetBytes)} 以下`, kb(total))
      : fail('F5', `総アセット ${kb(cfg.limits.maxInitialAssetBytes)} 以下`, kb(total));
  }
}

/* ── 出力 ───────────────────────────────── */
const failed = results.filter(r => r.ok === false && !exempt(r.id));
const exempted = results.filter(r => r.ok === false && exempt(r.id));

console.log('\n✅ GIGA Standard v4 品質ゲート — ' + (manifest?.name ?? cfg.repoName) + '\n');
for (const r of results) {
  const mark = r.ok === null ? '－' : r.ok ? '✅' : exempt(r.id) ? '🟡' : '❌';
  console.log(`${mark} ${r.id.padEnd(5)} ${r.label}${r.detail ? `  … ${r.detail}` : ''}`);
}
if (exempted.length) {
  console.log('\n🟡 以下は quality.config.json の securityExceptions で明示的に許可されています:');
  for (const r of exempted) console.log(`   ${r.id}: ${exempt(r.id).reason}`);
}
console.log(`\n合格 ${results.filter(r => r.ok === true).length} / 対象外 ${results.filter(r => r.ok === null).length} / 不合格 ${failed.length}`);
if (failed.length) {
  console.log('\n❌ 不合格の項目があります。検査を緩める前に、quality.config.json の');
  console.log('   securityExceptions に「なぜ許すのか」を書いてください。');
  process.exit(1);
}
console.log('\nすべて合格しました。');
