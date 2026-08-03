/* パクパクゴブレット — 本体
 *
 * index.html から切り出した。切り出した理由は、CSP（Content-Security-Policy）で
 * インラインの <script> を禁止するため。ゲームの遊び方・見た目・文言は変えていない。
 * 勝敗と配置の判定は js/rules.js（GobbletRules）に置き、テストできるようにしてある。
 */
(() => {
  'use strict';

  const N = 3;
  const P1 = 'p1';
  const P2 = 'p2';
  const names = { [P1]: 'オレンジ', [P2]: 'ブルー' };
  const colors = { [P1]: '#f4511e', [P2]: '#1e88e5' };

  // 駒の呼び名。読み上げ用なのでふりがなの指定は入れない。
  // 以前は「中さい駒」「大さい駒」という日本語にならない読み上げになっていた。
  const sizeNames = ['小さい', '中くらいの', '大きい'];

  const state = { board: [], hands: {}, turn: P1, selected: null, over: false, sound: true };
  let audio = null;
  let toastTimer = 0;
  let winning = [];

  const $ = s => document.querySelector(s);
  const boardEl = $('#board');
  const turnEl = $('#turn');
  const toastEl = $('#toast');

  const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const makeHand = player => [0, 0, 1, 1, 2, 2].map(size => ({ id: uid(), player, size }));

  function init() {
    state.board = Array.from({ length: N }, () => Array.from({ length: N }, () => []));
    state.hands = { [P1]: makeHand(P1), [P2]: makeHand(P2) };
    state.turn = P1;
    state.selected = null;
    state.over = false;
    winning = [];
    render();
  }

  const top = (r, c) => GobbletRules.topOf(state.board[r][c]);
  const canPlace = (piece, r, c) => GobbletRules.canPlace(piece, state.board[r][c]);

  function winner() {
    const found = GobbletRules.findWin(state.board);
    winning = found ? found.line : [];
    return found ? found.player : null;
  }

  function svg(player, selected) {
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" fill="${colors[player]}" stroke="#fff" stroke-width="5"/><circle cx="28" cy="38" r="11" fill="#fff"/><circle cx="72" cy="38" r="11" fill="#fff"/><circle cx="28" cy="38" r="6" fill="#263238"/><circle cx="72" cy="38" r="6" fill="#263238"/><ellipse cx="50" cy="68" rx="16" ry="${selected ? 15 : 6}" fill="#263238"/></svg>`;
  }

  function render() {
    renderBoard();
    renderHands();
    // 手番の「●」は色そのものが情報なので、style 属性ではなく CSSOM で色を付ける。
    // （CSP の style-src はマークアップ中の style="..." を弾くが、この書き方は通る）
    turnEl.replaceChildren();
    const dot = document.createElement('i');
    dot.className = 'turn-dot';
    dot.textContent = '●';
    dot.style.color = colors[state.turn];
    dot.setAttribute('aria-hidden', 'true');
    turnEl.append(dot, ` ${names[state.turn]} のばん`);
  }

  function renderBoard() {
    boardEl.replaceChildren();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `${r + 1}行${c + 1}列`);
        if (winning.some(([wr, wc]) => wr === r && wc === c)) cell.classList.add('win');
        const p = top(r, c);
        if (state.selected && canPlace(state.selected.piece, r, c)) cell.classList.add('valid');
        if (p) {
          const piece = document.createElement('span');
          piece.className = 'piece';
          piece.style.width = piece.style.height = ['48%', '68%', '88%'][p.size];
          if (state.selected?.type === 'board' && state.selected.r === r && state.selected.c === c) {
            piece.classList.add('selected');
          }
          piece.innerHTML = svg(p.player, piece.classList.contains('selected'));
          cell.append(piece);
          cell.setAttribute('aria-label', `${r + 1}行${c + 1}列、${names[p.player]}の${sizeNames[p.size]}駒`);
        }
        cell.addEventListener('click', () => cellClick(r, c));
        boardEl.append(cell);
      }
    }
  }

  function renderHands() {
    for (const player of [P1, P2]) {
      const box = $(`#${player}-hand`);
      box.replaceChildren();
      box.classList.toggle('active', state.turn === player && !state.over);
      for (const p of [...state.hands[player]].sort((a, b) => a.size - b.size)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'piece-button';
        b.dataset.size = p.size;
        b.setAttribute('aria-label', `${names[player]}の${sizeNames[p.size]}駒`);
        if (state.selected?.type === 'hand' && state.selected.piece.id === p.id) b.classList.add('selected');
        b.innerHTML = svg(player, b.classList.contains('selected'));
        b.addEventListener('click', () => handClick(p));
        box.append(b);
      }
    }
  }

  function handClick(piece) {
    if (state.over) return;
    if (piece.player !== state.turn) return notice('{今|いま}は{相手|あいて}のばんです');
    if (state.selected?.type === 'hand' && state.selected.piece.id === piece.id) state.selected = null;
    else state.selected = { type: 'hand', piece };
    tone('select');
    render();
  }

  function cellClick(r, c) {
    if (state.over) return;
    const p = top(r, c);
    if (!state.selected) {
      if (p?.player === state.turn) {
        state.selected = { type: 'board', piece: p, r, c };
        tone('select');
        render();
      } else if (p) {
        notice('{相手|あいて}の{駒|こま}は{動|うご}かせません');
      }
      return;
    }
    if (state.selected.type === 'board' && state.selected.r === r && state.selected.c === c) {
      state.selected = null;
      tone('select');
      render();
      return;
    }
    if (p?.player === state.turn && state.selected.piece.size <= p.size) {
      state.selected = { type: 'board', piece: p, r, c };
      tone('select');
      render();
      return;
    }
    if (!canPlace(state.selected.piece, r, c)) return notice('もっと{大|おお}きい{駒|こま}なら、そこに{置|お}けます');
    moveSelected(r, c);
  }

  function moveSelected(r, c) {
    const sel = state.selected;
    const covered = Boolean(top(r, c));
    if (sel.type === 'hand') {
      const i = state.hands[sel.piece.player].findIndex(x => x.id === sel.piece.id);
      if (i < 0) return;
      state.hands[sel.piece.player].splice(i, 1);
    } else {
      // 盤上の駒を持ち上げた瞬間に、下から現れた駒で3つ並びができていたら、
      // 並べた側（相手のこともある）の勝ちで即終了する。
      state.board[sel.r][sel.c].pop();
      const revealed = winner();
      if (revealed) {
        state.board[r][c].push(sel.piece);
        return finish(revealed);
      }
    }
    state.board[r][c].push(sel.piece);
    state.selected = null;
    tone(covered ? 'place' : 'select');
    const won = winner();
    if (won) return finish(won);
    state.turn = state.turn === P1 ? P2 : P1;
    render();
  }

  function finish(player) {
    state.over = true;
    state.selected = null;
    tone('win');
    render();
    showMessage(`🎉 ${names[player]}の{勝|か}ち！`, 'すごい{作戦|さくせん}でした！', 'もう{一回|いっかい}', init);
  }

  function notice(text) {
    tone('error');
    // 画面にはふりがな付きで出し、読み上げ用には素のことばを残す
    Furigana.setText(toastEl, text);
    toastEl.setAttribute('aria-label', Furigana.strip(text));
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
  }

  function showMessage(title, text, ok = 'OK', after) {
    const d = $('#message-dialog');
    Furigana.setText($('#message-title'), title);
    Furigana.setText($('#message-text'), text);
    Furigana.setText($('#message-ok'), ok);
    // ボタンは絵ではなく文字なので、読み上げ用にも素のことばを添える
    $('#message-ok').setAttribute('aria-label', Furigana.strip(ok));
    $('#message-ok').onclick = () => { d.close(); after?.(); };
    d.showModal();
  }

  function tone(type) {
    if (!state.sound) return;
    try {
      audio ??= new AudioContext();
      if (audio.state === 'suspended') audio.resume();
      const now = audio.currentTime;
      const notes = type === 'win' ? [523, 659, 784] : [type === 'error' ? 140 : type === 'place' ? 660 : 440];
      notes.forEach((f, i) => {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.connect(g).connect(audio.destination);
        o.type = type === 'error' ? 'sawtooth' : 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(.13, now + i * .1);
        g.gain.exponentialRampToValueAtTime(.001, now + i * .1 + .18);
        o.start(now + i * .1);
        o.stop(now + i * .1 + .2);
      });
    } catch {
      state.sound = false;
    }
  }

  /* ── 画面まわりのボタン ───────────────────── */

  $('#rules').addEventListener('click', () => $('#rules-dialog').showModal());
  $('.close-dialog').addEventListener('click', () => $('#rules-dialog').close());

  $('#sound').addEventListener('click', e => {
    state.sound = !state.sound;
    const btn = e.currentTarget;
    btn.querySelector('.sound-icon').textContent = state.sound ? '🔊' : '🔇';
    btn.querySelector('.sound-label').textContent = state.sound ? 'ON' : 'OFF';
    btn.setAttribute('aria-pressed', String(state.sound));
    btn.setAttribute('aria-label', state.sound ? '音を消す' : '音を出す');
    if (state.sound) tone('select');
  });

  $('#reset').addEventListener('click', () => showMessage(
    '{最初|さいしょ}からやり{直|なお}す？', '{今|いま}の{勝負|しょうぶ}はリセットされます。', 'やり{直|なお}す', init));

  /* ── 提示モード（電子黒板で使うとき） ─────────── */

  const fsBtn = $('#fullscreen');
  if (document.body.requestFullscreen) {
    fsBtn.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.body.requestFullscreen();
      } catch {
        notice('この{端末|たんまつ}では{大|おお}きく{表示|ひょうじ}できません');
      }
    });
    document.addEventListener('fullscreenchange', () => {
      fsBtn.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
    });
  } else {
    // iPhone の Safari など、フルスクリーンに対応しない端末では出さない
    fsBtn.remove();
  }

  /* ── インストール ─────────────────────────── */

  const installBtn = $('#install');

  function syncInstallButton() {
    // すでにアプリとして起動している場合は、インストールを勧める意味がない
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    installBtn.classList.toggle('show', Boolean(window.__deferredInstallPrompt) && !standalone);
  }

  addEventListener('pwa-installable', syncInstallButton);
  addEventListener('pwa-installed', syncInstallButton);

  installBtn.addEventListener('click', async () => {
    const deferred = window.__deferredInstallPrompt;
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    window.__deferredInstallPrompt = null;   // 合図は一度しか使えない
    syncInstallButton();
  });

  syncInstallButton();

  /* ── Service Worker と更新のお知らせ ─────────── */

  function showUpdateBar(worker) {
    const bar = $('#update-bar');
    $('#update-apply').onclick = () => {
      bar.classList.remove('show');
      worker.postMessage({ type: 'SKIP_WAITING' });
    };
    bar.classList.add('show');
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js');
        // 新しい版は「待機」させたままにする。対局の途中で画面が作り直されないように、
        // 児童が「さいしんに する」を押したときだけ切り替える。
        if (reg.waiting && navigator.serviceWorker.controller) showUpdateBar(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(sw);
          });
        });
      } catch (err) {
        console.error('[sw] 登録できませんでした', err);
      }
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }

  init();
})();
