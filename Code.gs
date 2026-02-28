/**
 * ==============================================================================
 * アプリ名: パクパクゴブレット (GIGAスクール版)
 * 製作者: GIGA Game Architect
 * * このファイルはサーバーサイド（Google Apps Script）のコードです。
 * ブラウザからのアクセスを受け付け、HTMLを表示する役割を持っています。
 * ==============================================================================
 */

/**
 * Webアプリにアクセスした時に、一番最初に自動で実行される関数です。
 * (ここはいじらなくてOKです！)
 */
function doGet(e) {
  // 1. 'index.html' というファイルを探して、Webページのひな形を作ります
  const template = HtmlService.createTemplateFromFile('index');

  // 2. テンプレートを実行して、最終的なHTMLデータを生成します
  const htmlOutput = template.evaluate();

  // 3. Webページとしての基本設定を追加します
  htmlOutput
    .setTitle('パクパクゴブレット') // ブラウザのタブに表示されるタイトル
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0') // スマホやタブレットでも見やすくする設定
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) // サイトへの埋め込みを許可する場合の設定
    .setFaviconUrl('https://drive.google.com/uc?id=1dKHhagcejNvZw-GWIZhRenUA97eELryn&.png');

  // 4. 完成したWebページをブラウザに送ります
  return htmlOutput;
}

/**
 * HTMLファイルの中に、別のファイル（CSSやJS）を読み込むための「道具」です。
 * これを使うことで、1つのファイルが長くなりすぎるのを防ぎ、
 * デザイン(css)やプログラム(js)を別ファイルに分けて管理できるようになります。
 * * @param {string} filename - 読み込みたいファイルの名前（拡張子なし）
 * @return {string} - そのファイルの中身
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
