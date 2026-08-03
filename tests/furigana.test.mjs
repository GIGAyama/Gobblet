/*
 * js/furigana.js（ふりがな）のテスト
 *
 * DOM を組み立てる toFragment() はブラウザでしか動かないので、
 * ここでは文言の解釈（parse）と、読み上げ用に戻す strip() を確かめる。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({});
vm.runInContext(readFileSync(join(ROOT, 'js/furigana.js'), 'utf8'), ctx);
const F = vm.runInContext('Furigana', ctx);

const shape = v => JSON.parse(JSON.stringify(v));

test('ふりがなの指定がない文言はそのまま', () => {
  assert.deepEqual(shape(F.parse('あたらしい バージョンが あります')),
    [{ text: 'あたらしい バージョンが あります' }]);
  assert.equal(F.strip('あたらしい バージョンが あります'), 'あたらしい バージョンが あります');
});

test('{漢字|かんじ} を漢字と読みに分ける', () => {
  assert.deepEqual(shape(F.parse('{相手|あいて}のばん')),
    [{ base: '相手', reading: 'あいて' }, { text: 'のばん' }]);
});

test('文中に複数あっても、前後の文字を落とさない', () => {
  assert.deepEqual(shape(F.parse('もっと{大|おお}きい{駒|こま}なら、そこに{置|お}けます')), [
    { text: 'もっと' },
    { base: '大', reading: 'おお' },
    { text: 'きい' },
    { base: '駒', reading: 'こま' },
    { text: 'なら、そこに' },
    { base: '置', reading: 'お' },
    { text: 'けます' },
  ]);
});

test('先頭と末尾がふりがなでも欠けない', () => {
  assert.deepEqual(shape(F.parse('{今|いま}')), [{ base: '今', reading: 'いま' }]);
  assert.deepEqual(shape(F.parse('やり{直|なお}す')),
    [{ text: 'やり' }, { base: '直', reading: 'なお' }, { text: 'す' }]);
});

test('strip は読み上げ用の素のことばに戻す', () => {
  assert.equal(F.strip('{今|いま}は{相手|あいて}のばんです'), '今は相手のばんです');
  assert.equal(F.strip('{最初|さいしょ}からやり{直|なお}す？'), '最初からやり直す？');
});

test('絵文字や記号が混ざっても壊れない', () => {
  assert.equal(F.strip('🎉 オレンジの{勝|か}ち！'), '🎉 オレンジの勝ち！');
  assert.deepEqual(shape(F.parse('🎉 オレンジの{勝|か}ち！')),
    [{ text: '🎉 オレンジの' }, { base: '勝', reading: 'か' }, { text: 'ち！' }]);
});

test('parse を続けて呼んでも結果が変わらない（正規表現の位置が残らない）', () => {
  const text = '{今|いま}の{勝負|しょうぶ}はリセットされます。';
  assert.deepEqual(shape(F.parse(text)), shape(F.parse(text)));
});

test('app.js の画面文言は、漢字にすべてふりがなが付いている', () => {
  const app = readFileSync(join(ROOT, 'js/app.js'), 'utf8');
  // notice(...) と showMessage(...) に渡している文字列だけを見る
  const shown = [...app.matchAll(/(?:notice|showMessage)\(([\s\S]*?)\);/g)].map(m => m[1]).join('');
  const literals = [...shown.matchAll(/'([^']*)'|`([^`]*)`/g)].map(m => m[1] ?? m[2]);
  assert.ok(literals.length > 0, '検査対象の文言が見つからない');

  const kanji = /[一-鿿]/;
  for (const lit of literals) {
    // {漢字|かんじ} の中身を取り除いた残りに漢字があってはいけない
    const rest = lit.replace(/\{[^|{}]+\|[^|{}]+\}/g, '');
    assert.ok(!kanji.test(rest), `ふりがなの無い漢字がある: 「${lit}」`);
  }
});
