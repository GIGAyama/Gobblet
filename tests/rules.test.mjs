/*
 * js/rules.js（勝敗と配置の判定）のテスト
 *
 * rules.js はブラウザでそのまま <script> として読み込む素の JS なので、
 * node:vm で評価して GobbletRules を取り出している。
 * こうしておくと、テストのためにアプリ側の書き方を変えずに済む。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// vm の中で作られた配列は、外側の Array とは別物として扱われる。
// 中身だけを比べたいので、形をそろえてから比較する。
const shape = v => JSON.parse(JSON.stringify(v));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({});
vm.runInContext(readFileSync(join(ROOT, 'js/rules.js'), 'utf8'), ctx);
const R = vm.runInContext('GobbletRules', ctx);

const piece = (player, size, id = `${player}${size}`) => ({ id, player, size });
const empty = () => [[[], [], []], [[], [], []], [[], [], []]];

/** 'o' = オレンジ(p1) / 'b' = ブルー(p2) / '.' = 空 の3行で盤を作る */
const build = rows => rows.map((row, r) =>
  [...row].map((ch, c) => (ch === '.' ? [] : [piece(ch === 'o' ? 'p1' : 'p2', 1, `${ch}${r}${c}`)])));

test('空の盤では勝者なし', () => {
  assert.equal(R.findWin(empty()), null);
});

test('よこ3つで勝ち', () => {
  const win = R.findWin(build(['ooo', '.b.', 'b..']));
  assert.equal(win.player, 'p1');
  assert.deepEqual(shape(win.line), [[0, 0], [0, 1], [0, 2]]);
});

test('たて3つで勝ち', () => {
  const win = R.findWin(build(['b.o', 'b.o', 'b..']));
  assert.equal(win.player, 'p2');
  assert.deepEqual(shape(win.line), [[0, 0], [1, 0], [2, 0]]);
});

test('ななめ3つで勝ち（両方向）', () => {
  assert.equal(R.findWin(build(['o..', '.o.', '..o'])).player, 'p1');
  assert.equal(R.findWin(build(['..b', '.b.', 'b..'])).player, 'p2');
});

test('3つそろっていなければ勝者なし', () => {
  assert.equal(R.findWin(build(['oob', 'boo', 'obb'])), null);
});

test('かぶせた駒だけを見る（下に隠れた駒は数えない）', () => {
  const board = empty();
  // オレンジが上段に3つ並んでいるが、真ん中はブルーの大きい駒でかぶせられている
  board[0][0] = [piece('p1', 0)];
  board[0][1] = [piece('p1', 0), piece('p2', 2)];
  board[0][2] = [piece('p1', 0)];
  assert.equal(R.findWin(board), null, 'かぶせられた駒で勝ちになってはいけない');
});

test('駒を持ち上げて下から現れた駒で相手が勝つ', () => {
  const board = empty();
  // ブルーが上段に3つ並んでいて、真ん中だけオレンジの大きい駒でふさいでいる状態
  board[0][0] = [piece('p2', 0)];
  board[0][1] = [piece('p2', 0), piece('p1', 2)];
  board[0][2] = [piece('p2', 0)];
  assert.equal(R.findWin(board), null);

  // オレンジが自分の駒を持ち上げた瞬間、ブルーの3つ並びが現れる
  board[0][1].pop();
  assert.equal(R.findWin(board).player, 'p2', '持ち上げた側ではなく相手の勝ちになる');
});

test('canPlace：空マスにはどの駒でも置ける', () => {
  assert.equal(R.canPlace(piece('p1', 0), []), true);
  assert.equal(R.canPlace(piece('p1', 2), []), true);
});

test('canPlace：小さい駒の上には置けるが、同じ大きさ・大きい駒の上には置けない', () => {
  const stack = [piece('p2', 1)];
  assert.equal(R.canPlace(piece('p1', 2), stack), true, '大 > 中 は置ける');
  assert.equal(R.canPlace(piece('p1', 1), stack), false, '中 = 中 は置けない');
  assert.equal(R.canPlace(piece('p1', 0), stack), false, '小 < 中 は置けない');
});

test('topOf：いちばん上の駒を返す', () => {
  assert.equal(R.topOf([]), null);
  const bottom = piece('p1', 0);
  const top = piece('p2', 2);
  assert.equal(R.topOf([bottom, top]), top);
});

test('勝ち筋は8通りすべてが定義されている', () => {
  assert.equal(R.LINES.length, 8);
  const keys = new Set(R.LINES.map(l => l.map(([r, c]) => `${r}${c}`).join('-')));
  assert.equal(keys.size, 8, '重複した勝ち筋がない');
});
