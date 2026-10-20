// Text from the catalogue — a service's name, caption, description — goes into
// many kinds of file: shell scripts (some run as root), CSS, XML, JSON,
// Markdown rendered as HTML, the login screen. The validator keeps control
// characters out; these helpers make each use safe on its own, so no file
// depends on the validator alone.

/** Control characters (C0, DEL, C1) — newlines included. */
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/g;

/** One line of plain text: controls become spaces, runs of spaces one. */
export const oneLine = (s: string): string => s.replace(CONTROLS, ' ').replace(/\s{2,}/g, ' ').trim();

/** Text for XML or HTML content and attributes. */
export const xmlText = (s: string): string => oneLine(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Text for Markdown that the site renders: no HTML, no emphasis or table breaks. */
export const mdText = (s: string): string =>
  oneLine(s)
    .replace(/[\\`*_[\]{}()#+!|~>]/g, (c) => `\\${c}`)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;');

/** Text inside a comment of any kind (shell, CSS, HTML, SCAD): nothing that could close it or start code. */
export const commentText = (s: string): string => oneLine(s).replace(/\*\/|\/\*|-->|<!--|--|\{\{|\}\}|[<>\\`$]/g, ' ').replace(/\s{2,}/g, ' ').trim();

/** A single-quoted shell word. */
export const shQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;
