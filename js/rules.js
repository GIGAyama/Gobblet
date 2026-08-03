/* パクパクゴブレット — 勝敗と配置の判定だけを取り出したもの
 *
 * 盤の状態しか見ない（画面も音も触らない）ので、そのままテストにかけられる。
 * tests/rules.test.mjs から読み込んで検証している。
 *
 * 盤の形： board[行][列] = 駒の積み重ね（配列の末尾がいちばん上の駒）
 * 駒の形： { id, player: 'p1' | 'p2', size: 0 | 1 | 2 }
 */
var GobbletRules = (() => {
  'use strict';

  // たて3・よこ3・ななめ2 の計8通り
  const LINES = [
    [[0, 0], [0, 1], [0, 2]],
    [[1, 0], [1, 1], [1, 2]],
    [[2, 0], [2, 1], [2, 2]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], [1, 2], [2, 2]],
    [[0, 0], [1, 1], [2, 2]],
    [[0, 2], [1, 1], [2, 0]],
  ];

  /** いちばん上に見えている駒。空マスなら null */
  const topOf = stack => stack[stack.length - 1] || null;

  /** そのマスに置けるか。空マスか、自分より小さい駒の上にだけ置ける */
  const canPlace = (piece, stack) => {
    const p = topOf(stack);
    return !p || p.size < piece.size;
  };

  /**
   * 3つ並びができているか。できていれば { player, line } を返す。
   * 「見えている駒」だけを見るので、駒を持ち上げて下から現れた駒が
   * 並びを完成させた場合も、この関数だけで判定できる。
   */
  const findWin = board => {
    for (const line of LINES) {
      const players = line.map(([r, c]) => topOf(board[r][c])?.player);
      if (players[0] && players.every(x => x === players[0])) {
        return { player: players[0], line };
      }
    }
    return null;
  };

  return { LINES, topOf, canPlace, findWin };
})();
