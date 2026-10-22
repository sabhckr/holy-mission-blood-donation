import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getMessages, namespaces } from '@/i18n/messages';

const SLOGAN = 'রক্ত লাইগলে রক্ত আছে, এত ডরানোর কী আছে?';
const BENGALI = /[ঀ-৿]/;

type Leaf = { path: string; value: unknown };
function leaves(obj: unknown, prefix = ''): Leaf[] {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  }
  if (Array.isArray(obj)) return obj.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  return [{ path: prefix, value: obj }];
}

function render(value: unknown): string {
  if (typeof value === 'function') return String((value as (...a: unknown[]) => unknown)('1', '2', '3'));
  return String(value);
}

describe('translations', () => {
  it('has the same keys in Bangla and English for every namespace', () => {
    for (const [name, ns] of Object.entries(namespaces)) {
      const bn = leaves(ns.bn).map((l) => l.path).sort();
      const en = leaves(ns.en).map((l) => l.path).sort();
      expect(en, `namespace ${name}`).toEqual(bn);
    }
  });

  it('has no empty strings and every function returns text', () => {
    for (const locale of ['bn', 'en'] as const) {
      for (const leaf of leaves(getMessages(locale))) {
        const text = render(leaf.value);
        expect(text.trim().length, `${locale}:${leaf.path}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the official slogan word for word in both languages', () => {
    expect(getMessages('bn').common.slogan).toBe(SLOGAN);
    expect(getMessages('en').common.slogan).toBe(SLOGAN);
    expect(getMessages('en').common.sloganMeaning).not.toMatch(BENGALI);
  });

  it('English text contains no Bangla (except the slogan) and Bangla text is actually Bangla', () => {
    for (const leaf of leaves(getMessages('en'))) {
      if (leaf.path === 'common.slogan') continue;
      expect(render(leaf.value), `en:${leaf.path}`).not.toMatch(BENGALI);
    }
    const bn = leaves(getMessages('bn')).map((l) => render(l.value));
    const bangla = bn.filter((s) => BENGALI.test(s)).length;
    // A few entries are legitimately Latin (e.g. "SMS" style tokens); the vast majority must be Bangla.
    expect(bangla / bn.length).toBeGreaterThan(0.95);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.tsx') ? [full] : [];
  });
}

describe('no hard-coded UI text in components', () => {
  // Language names are shown in their own language on purpose; symbols are not words.
  const ALLOWED = new Set(['বাংলা', 'English', '*', '·', '—', '/', '›']);
  const files = [...walk('src/app'), ...walk('src/components')];
  const textNode = />\s*([^<>{}\n]+?)\s*</g;
  const attr = /\b(aria-label|title|placeholder|alt)="([^"]+)"/g;
  const letters = /[A-Za-zঀ-৿]/;

  it.each(files)('%s', (file) => {
    const source = readFileSync(file, 'utf8');
    const offenders: string[] = [];
    for (const m of source.matchAll(textNode)) {
      const text = m[1].trim();
      if (source[m.index! - 1] === '=') continue; // arrow function return type, e.g. "=> Promise<"
      if (!letters.test(text) || ALLOWED.has(text)) continue;
      if (/[;=()|:&`]|=>/.test(text)) continue; // TypeScript generics, not JSX text
      offenders.push(text);
    }
    for (const m of source.matchAll(attr)) if (letters.test(m[2])) offenders.push(`${m[1]}="${m[2]}"`);
    expect(offenders).toEqual([]);
  });
});
