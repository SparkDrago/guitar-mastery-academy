/**
 * Generates docs/02-curriculum.md from the bundled content.
 * Run: npx tsx scripts/gen-curriculum-doc.ts
 */
import { writeFileSync } from 'node:fs';
import { LESSONS } from '../content/lessons/index';
import { LEVELS, MODULES } from '../content/curriculum';
import { EXERCISES } from '../content/exercises';
import { BOOKS } from '../content/helpers';

const src = (s: { book: string; section?: string; note?: string }) => (s.book === 'P' ? 'Supplementary' : `${s.book}: ${s.section}`);
const out: string[] = [];
out.push('# Curriculum overview', '');
out.push('_Generated from `content/` by `scripts/gen-curriculum-doc.ts`; do not edit by hand._', '');
out.push(`${LEVELS.length} levels · ${MODULES.length} modules · ${LESSONS.length} lessons · ${LESSONS.reduce((a, l) => a + l.quiz.length, 0)} quiz questions · ${EXERCISES.length} exercises`, '');
out.push('Source key: ' + Object.entries(BOOKS).filter(([k]) => k !== 'P').map(([k, v]) => `**${k}** ${v}`).join(' · ') + ' · **Supplementary** = established pedagogy not taken from the supplied books.', '');
for (const lv of LEVELS) {
  const lessons = LESSONS.filter((l) => l.level === lv.level);
  out.push(`## Level ${lv.level}: ${lv.title}`, '', lv.summary, '', `**Outcome:** ${lv.outcome}`, '');
  for (const m of MODULES.filter((x) => x.level === lv.level)) {
    out.push(`### ${m.title}`, '', m.summary, '');
    out.push('| Lesson | Min | Mastery | Sources |', '|---|---|---|---|');
    for (const l of lessons.filter((x) => x.module === m.id)) {
      const mastery = `quiz ≥ ${Math.round(l.mastery.quizPass * 100)}%${l.mastery.practice ? `, clean take${l.mastery.practice.bpm ? ` at ${l.mastery.practice.bpm} bpm` : ''}` : ''}`;
      out.push(`| ${l.title} | ${l.minutes} | ${mastery} | ${l.sources.map(src).join('; ')} |`);
    }
    out.push('');
  }
}
writeFileSync(new URL('../docs/02-curriculum.md', import.meta.url), out.join('\n') + '\n');
console.log(`wrote docs/02-curriculum.md (${LESSONS.length} lessons)`);
