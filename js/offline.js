/* 圏外画面の「もういちど ためす」ボタン。
   CSP でインラインの onclick= を禁止しているため、外部ファイルにしている。 */
document.getElementById('retry').addEventListener('click', () => location.reload());
