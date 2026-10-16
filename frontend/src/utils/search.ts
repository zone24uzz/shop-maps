import type { Store } from '@/types/store';

// Uzbek Latin text is typed with many apostrophe look-alikes. They are folded
// into the plain keyboard apostrophe, so a name stored with a curly quote is
// found when typed as "Ulug'bek". Listed by code point because the glyphs are
// nearly indistinguishable in an editor.
const APOSTROPHE_CODE_POINTS = [
  0x02bb, // modifier letter turned comma (the official mark in o' and g')
  0x02bc, // modifier letter apostrophe
  0x2018, // left single quotation mark
  0x2019, // right single quotation mark
  0x0060, // grave accent (backtick)
  0x00b4, // acute accent
];
const APOSTROPHE_VARIANTS = new RegExp(
  `[${APOSTROPHE_CODE_POINTS.map((codePoint) => String.fromCodePoint(codePoint)).join('')}]`,
  'g',
);
const WHITESPACE_RUN = /\s+/g;

export function normalizeSearchText(text: string): string {
  return (
    text
      // Before NFKC, which would split the acute accent into space + combining mark.
      .replace(APOSTROPHE_VARIANTS, "'")
      .normalize('NFKC')
      .toLowerCase()
      .replace(WHITESPACE_RUN, ' ')
      .trim()
  );
}

/**
 * Case-insensitive match on the store name. An empty query returns the input
 * array itself, so memoized consumers do not re-render needlessly.
 */
export function filterStores(stores: readonly Store[], query: string): readonly Store[] {
  const needle = normalizeSearchText(query);
  if (needle === '') return stores;
  return stores.filter((store) => normalizeSearchText(store.name).includes(needle));
}
