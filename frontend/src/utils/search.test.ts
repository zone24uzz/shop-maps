import { describe, expect, it } from 'vitest';
import { DEMO_STORES } from '@/test/fixtures';
import { filterStores, normalizeSearchText } from './search';

const names = (query: string) => filterStores(DEMO_STORES, query).map((store) => store.name);

describe('normalizeSearchText', () => {
  it('lower-cases, trims and collapses whitespace', () => {
    expect(normalizeSearchText('  Demo   DO‘KON ')).toBe("demo do'kon");
  });

  it('folds every apostrophe variant into one character', () => {
    const variants = ['o‘', 'o’', 'oʻ', 'oʼ', 'o`', 'o´', "o'"];
    expect(new Set(variants.map(normalizeSearchText))).toEqual(new Set(["o'"]));
  });
});

describe('filterStores', () => {
  it('returns the same array for an empty or blank query', () => {
    expect(filterStores(DEMO_STORES, '')).toBe(DEMO_STORES);
    expect(filterStores(DEMO_STORES, '   ')).toBe(DEMO_STORES);
  });

  it('matches part of the name regardless of case', () => {
    expect(names('yunus')).toEqual(['Demo do‘kon: Yunusobod']);
    expect(names('SERGELI')).toEqual(['Demo do‘kon: Sergeli']);
    expect(names('ChIlOn')).toEqual(['Demo do‘kon: Chilonzor']);
  });

  it('finds names typed with a plain keyboard apostrophe', () => {
    expect(names("ulug'bek")).toEqual(['Demo do‘kon: Mirzo Ulug‘bek']);
    expect(names("do'kon")).toHaveLength(DEMO_STORES.length);
  });

  it('returns every store that shares the term and none when nothing matches', () => {
    expect(names('demo')).toHaveLength(DEMO_STORES.length);
    expect(names('samarqand')).toEqual([]);
  });

  it('does not match on source or coordinates', () => {
    expect(names('demo-seed')).toEqual([]);
    expect(names('41.27')).toEqual([]);
  });
});
