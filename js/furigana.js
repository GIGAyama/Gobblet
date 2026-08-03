/* パクパクゴブレット — ふりがな（ルビ）
 *
 * JavaScript から出す文言にもふりがなを付けるための小さな道具。
 * 文言の中に「{漢字|かんじ}」と書いておくと、<ruby> に組み立てて表示する。
 *
 *   furigana.toFragment('もっと{大|おお}きい{駒|こま}なら、そこに{置|お}けます')
 *
 * 読み上げソフトが「かんじ」を二重に読まないよう、<rp> を必ず添える
 * （GIGA Standard v4 §4）。読み上げ用・属性用には strip() で素のことばに戻す。
 *
 * 画面に直接書ける文章（あそびかたの説明など）は、HTML に <ruby> を
 * そのまま書いている。JavaScript が動く前でもふりがなが見えるようにするため。
 */
var Furigana = (() => {
  'use strict';

  // {漢字|かんじ} … 中に { } | を含まないものだけを拾う
  const RE = /\{([^|{}]+)\|([^|{}]+)\}/g;

  /** 文言を「そのままの文字」と「ふりがな付きの文字」の並びに分解する */
  const parse = text => {
    const parts = [];
    let last = 0;
    let m;
    RE.lastIndex = 0;
    while ((m = RE.exec(text)) !== null) {
      if (m.index > last) parts.push({ text: text.slice(last, m.index) });
      parts.push({ base: m[1], reading: m[2] });
      last = RE.lastIndex;
    }
    if (last < text.length) parts.push({ text: text.slice(last) });
    return parts;
  };

  /** ふりがなの指定を取り除いた、素のことば（aria-label や読み上げ用） */
  const strip = text => text.replace(RE, '$1');

  /** 画面に差し込むための DOM を組み立てる */
  const toFragment = text => {
    const frag = document.createDocumentFragment();
    for (const part of parse(text)) {
      if (part.text !== undefined) {
        frag.append(part.text);
        continue;
      }
      const ruby = document.createElement('ruby');
      const rp1 = document.createElement('rp');
      const rt = document.createElement('rt');
      const rp2 = document.createElement('rp');
      rp1.textContent = '（';
      rt.textContent = part.reading;
      rp2.textContent = '）';
      ruby.append(part.base, rp1, rt, rp2);
      frag.append(ruby);
    }
    return frag;
  };

  /** 要素の中身を、ふりがな付きの文言で置き換える */
  const setText = (el, text) => {
    el.replaceChildren(toFragment(text));
    return el;
  };

  return { parse, strip, toFragment, setText };
})();
