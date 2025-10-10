/**
 * @fileoverview このファイルは、Google Apps ScriptでWebアプリケーションを
 * 提供するためのサーバーサイドのコードです。
 */

/**
 * Webアプリケーションにブラウザからアクセスがあった時（GETリクエスト）に自動的に実行される、
 * Google Apps Scriptで決められている特別な名前の関数です。
 *
 * @param {object} e - アクセスに関する情報が入ったイベントオブジェクト（今回は使いません）。
 * @return {HtmlOutput} - ブラウザに表示するためのHTMLコンテンツを返します。
 */
function doGet(e) {
  // HtmlServiceを使って、'index.html'ファイルの内容を読み込みます。
  const template = HtmlService.createTemplateFromFile('index');

  // .evaluate() を実行することで、HTMLファイル内の <?!= ... ?> のような特殊なコード（スクリプトレット）
  // が実行され、最終的なHTMLが作られます。
  const htmlOutput = template.evaluate();

  // 作成したHTMLに、Webページとしての設定を追加します。
  htmlOutput
    .setTitle('ゴブレット') // ブラウザのタブに表示されるタイトル
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0'); // スマートフォンなどの画面サイズに合わせるための設定

  // 設定済みのHTMLをブラウザに返します。これが画面に表示されます。
  return htmlOutput;
}
