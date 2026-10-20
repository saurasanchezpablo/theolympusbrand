// The guide's Markdown, made into HTML that can do no more than a document
// should. Raw HTML in a chapter is not passed through: comments are dropped,
// an <img> is rebuilt from its source, width and alt text alone, and anything
// else is shown as text. (The chapters are the repository's, but some carry
// names from the catalogue.)

import { Marked } from 'marked';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A link or image source a page may use: relative, or http(s). */
export const safeUrl = (u: string) => /^(https?:|mailto:)/i.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u.trim());

function rawHtml(html: string): string {
  const t = html.trim();
  if (/^<!--[\s\S]*-->$/.test(t)) return '';
  const img = t.match(/^<img\s([^<>]*?)\/?>$/i);
  if (img) {
    const attrs = Object.fromEntries([...img[1].matchAll(/([a-z]+)\s*=\s*"([^"]*)"/gi)].map(([, k, v]) => [k.toLowerCase(), v]));
    if (!attrs.src || !safeUrl(attrs.src)) return '';
    const width = /^\d{1,4}$/.test(attrs.width ?? '') ? ` width="${attrs.width}"` : '';
    return `<img src="${escape(attrs.src)}"${width} alt="${escape(attrs.alt ?? '')}">`;
  }
  return escape(html);
}

export const guideMarked = new Marked({
  async: false,
  renderer: {
    html: ({ text }) => rawHtml(text),
    // A link to anything but a page or an address is only its text.
    link(token) {
      const text = this.parser.parseInline(token.tokens);
      if (!safeUrl(token.href)) return text;
      return `<a href="${escape(token.href)}"${token.title ? ` title="${escape(token.title)}"` : ''}>${text}</a>`;
    },
  },
});
