/* インストールの合図を「いちばん先に」受け取るための小さなスクリプト。
 *
 * Chrome は条件が揃うと即座に beforeinstallprompt を出す。本体のスクリプトを
 * 待ってから登録すると、校内Wi-Fi が混んでいる端末では合図を取りこぼし、
 * 「インストール」ボタンが出ないままになる。そのため <head> の最上部で、
 * 何よりも先にこのファイルだけを読み込んでいる。
 */
(() => {
  'use strict';

  window.__deferredInstallPrompt = null;

  addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    window.__deferredInstallPrompt = event;
    dispatchEvent(new Event('pwa-installable'));
  });

  addEventListener('appinstalled', () => {
    window.__deferredInstallPrompt = null;
    dispatchEvent(new Event('pwa-installed'));
  });
})();
