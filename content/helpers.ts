/** Small constructors that keep lesson files readable. */
import type { Block, QuizQuestion, SourceRef } from '@gma/learning';

export const p = (text: string): Block => ({ type: 'p', text });
export const list = (...items: string[]): Block => ({ type: 'list', items });
export const steps = (...items: string[]): Block => ({ type: 'list', items, ordered: true });
export const tip = (text: string): Block => ({ type: 'callout', tone: 'tip', text });
export const warn = (text: string): Block => ({ type: 'callout', tone: 'warning', text });
export const theory = (text: string): Block => ({ type: 'callout', tone: 'theory', text });
export const sourceNote = (text: string): Block => ({ type: 'callout', tone: 'source', text });
export const tab = (ascii: string, caption?: string): Block => ({ type: 'tab', ascii: ascii.replace(/^\n/, ''), caption });
export const chords = (symbols: string[], caption?: string): Block => ({ type: 'chord', symbols, caption });
export const table = (head: string[], rows: string[][], caption?: string): Block => ({ type: 'table', head, rows, caption });
export const fb = (root: string, opts: Omit<Extract<Block, { type: 'fretboard' }>, 'type' | 'root'> = {}): Block => ({ type: 'fretboard', root, ...opts });
export const pill = (key: string, degree: number, caption?: string): Block => ({ type: 'pillitiere', key, degree, caption });
export const check = (question: QuizQuestion): Block => ({ type: 'check', question });

export function q(id: string, prompt: string, options: string[], answer: number, explanation: string): QuizQuestion {
  return { id, prompt, options, answer, explanation };
}

/** Provenance helpers. A–D are the supplied books (see docs/01-book-analysis.md). */
export const src = {
  A: (section: string): SourceRef => ({ book: 'A', section }),
  B: (section: string): SourceRef => ({ book: 'B', section }),
  C: (section: string): SourceRef => ({ book: 'C', section }),
  D: (section: string): SourceRef => ({ book: 'D', section }),
  P: (note?: string): SourceRef => ({ book: 'P', note }),
};

export const BOOKS: Record<'A' | 'B' | 'C' | 'D' | 'P', string> = {
  A: 'Hal Leonard Acoustic Guitar Tab Method, Book 1',
  B: 'Hal Leonard Guitar Tab Method, Songbook 2',
  C: 'Hal Leonard Guitar Tab Method, Book 3',
  D: 'Michael Pillitiere, Building the Better Guitar Scale',
  P: 'Supplementary: established guitar pedagogy and music theory',
};
