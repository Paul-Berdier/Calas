// Lettering redrawn from the business card supplied by Sara and the 02/11 PDF.
// These outlines are independent of browser fonts and of the shell geometry.
// Coordinates follow the reference: a large, sweeping C; fine Roman capitals;
// and a more compact CONSEIL. Do not replace this with live text.
export const wordmarkViewBox = '0 0 510 64';
export const wordmarkWidth = 510;
export const wordmarkHeight = 64;

const sweepingC = 'M58 6 L57.5 15 L56.7 15 C55 7 49 3 39 2 C24 1 14 11 10 24 C5 38 8 51 17 57 C28 65 42 61 50 55 C61 46 67 34 79 30 L79.5 30.8 C69 34 64 45 55 54 C47 62 38 64 27 64 C10 64 0 54 0 38 C0 22 10 8 24 3 C37 -1 49 1 58 6 Z';
const a = 'M29 8 L52 59 Q53 61 57 61 L57 61.7 L39 61.7 L39 61 Q44 61 42 57 L34.8 40 L15.7 40 L9 56.5 Q7.3 61 12 61 L12 61.7 L0 61.7 L0 61 Q5 61 7 56 L28.3 8 Z M16.4 38.3 L34.1 38.3 L25.2 17.5 Z';
const l = 'M0 8 L17 8 L17 8.7 Q12.5 8.7 12.5 12.5 L12.5 60 L28 60 Q35 60 37.5 51 L38.3 51.2 L36.8 61.7 L0 61.7 L0 61 Q4.5 61 4.5 57 L4.5 12.5 Q4.5 8.7 0 8.7 Z';
const s = 'M28.5 10 L28.5 19 L27.7 19 C26.8 11 23 8.7 17.6 8.7 C10.8 8.7 6.7 13.4 7.3 19.3 C7.9 25 14.8 28.8 21.2 32.8 C29.2 37.7 34.2 43.5 32.1 51.3 C30.3 58.9 24.3 63 16.2 63 C10.6 63 4.9 61.1 1.2 59.1 L1.8 49.2 L2.6 49.2 C4.2 58.2 9.2 61.6 16.3 61.6 C23.2 61.6 27.2 56.2 25.9 50.3 C24.7 44.7 19.2 41 12.8 37 C4.3 31.7 .4 26 1.3 19.6 C2.4 11.5 9.8 7.4 17.3 7.4 C21.8 7.4 25.4 8.5 28.5 10 Z';
const c = 'M41 6 L40.8 15 L40 15 C38.4 7.2 34 3.5 26.8 3.5 C12.7 3.5 7.8 17.8 7.8 32 C7.8 46.8 13.6 61 27.8 61 C34.7 61 40.1 57.4 43.1 51.7 L43.8 52.1 C40.5 59 34.9 63 26.7 63 C9.7 63 0 50.8 0 33 C0 15.5 10.9 2 27.5 2 C33.5 2 38.2 3.9 41 6 Z';
const o = 'M23 7.4 C38.1 7.4 46 18.1 46 35 C46 51.1 37.8 63 23 63 C8.1 63 0 52.2 0 35.4 C0 18.8 8.7 7.4 23 7.4 Z M21.6 8.8 C10.9 8.8 7.6 21.4 8 34.6 C8.4 49 12.8 61.6 24.2 61.6 C34.8 61.6 38.6 49.5 38 35.2 C37.4 20.8 33 8.8 21.6 8.8 Z';
const n = 'M0 8 L11 8 L42 50.1 L42 13 Q42 8.7 37 8.7 L37 8 L49 8 L49 8.7 Q44 8.7 44 13 L44 62.2 L42.5 62.2 L7 14.3 L7 56.8 Q7 61 12 61 L12 61.7 L0 61.7 L0 61 Q5 61 5 56.8 L5 13 Q2.7 8.7 0 8.7 Z';
const e = 'M0 8 L36 8 L36.5 17 L35.7 17 Q34.5 9.8 27.5 9.8 L12 9.8 L12 33 L25.5 33 Q31 33 31 28 L31.8 28 L31.8 40 L31 40 Q31 34.8 25.5 34.8 L12 34.8 L12 60 L27.8 60 Q35 60 38 52 L38.8 52.3 L37.3 61.7 L0 61.7 L0 61 Q4 61 4 57 L4 12.3 Q4 8.7 0 8.7 Z';
const i = 'M0 8 L17 8 L17 8.7 Q12.5 8.7 12.5 12.5 L12.5 57 Q12.5 61 17 61 L17 61.7 L0 61.7 L0 61 Q4.5 61 4.5 57 L4.5 12.5 Q4.5 8.7 0 8.7 Z';

const glyph = (d, x = 0, scale = 1) => `<path d="${d}" transform="translate(${x} 0) scale(${scale} 1)"/>`;
export function wordmarkMarkup({ dark = false, mono = null } = {}) {
  const navy = mono ?? (dark ? '#F7F2EA' : '#14213A');
  const gold = mono ?? (dark ? '#D5B37E' : '#94672F');
  return `<g fill="${navy}" fill-rule="evenodd">${glyph(sweepingC)}${glyph(a, 60)}${glyph(l, 120, .85)}${glyph(a, 151, .86)}${glyph(s, 198)}</g>` +
    `<g fill="${gold}" fill-rule="evenodd">${glyph(c, 244)}${glyph(o, 283, .92)}${glyph(n, 324, .88)}${glyph(s, 369, .88)}${glyph(e, 402, .98)}${glyph(i, 443, .85)}${glyph(l, 460, 1.2)}</g>`;
}
