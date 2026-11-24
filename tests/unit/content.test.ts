import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS } from '@content/lessons/index';
import { LEVELS, MODULES } from '@content/curriculum';
import { EXERCISES } from '@content/exercises';
import { GLOSSARY } from '@content/glossary';
import { buildAssessment, GENERATORS, LESSON_GENERATORS, CHALLENGES, TRAINER_MODES } from '@gma/learning';
import { findScale, parseChordSymbol, findTuning, parseNote, PROGRESSIONS } from '@gma/theory';
import { validateScore } from '@gma/notation';

test('curriculum covers levels 0–12 with modules and real content', () => {
  assert.deepEqual(LEVELS.map((l) => l.level), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const lvl of LEVELS) assert.ok(LESSONS.some((l) => l.level === lvl.level), `level ${lvl.level} has lessons`);
  assert.ok(LESSONS.length >= 75, `${LESSONS.length} lessons`);
  const ids = new Set<string>();
  for (const l of LESSONS) {
    assert.ok(!ids.has(l.id), `duplicate ${l.id}`);
    ids.add(l.id);
    assert.ok(MODULES.some((m) => m.id === l.module && m.level === l.level), `${l.id}: module ${l.module} matches its level`);
    assert.ok(l.objectives.length > 0 && l.why.length > 40, `${l.id}: objectives and rationale`);
    assert.ok(l.explanation.length > 0, `${l.id}: explanation`);
    assert.ok(l.quiz.length >= 2, `${l.id}: quiz`);
    assert.ok(l.summary.length > 0 && l.mistakes.length > 0, `${l.id}: summary and mistakes`);
    assert.ok(l.sources.length > 0, `${l.id}: provenance recorded`);
    const text = JSON.stringify(l).toLowerCase();
    for (const banned of ['coming soon', 'lesson content goes here', 'lorem ipsum', 'todo']) assert.ok(!text.includes(banned), `${l.id} contains placeholder "${banned}"`);
  }
});

test('prerequisites, next links and unlocks reference real items and form a DAG', () => {
  const byId = new Map(LESSONS.map((l) => [l.id, l]));
  for (const l of LESSONS) {
    for (const p of l.prerequisites) {
      assert.ok(byId.has(p), `${l.id}: prerequisite ${p} exists`);
      assert.ok(byId.get(p)!.level <= l.level, `${l.id}: prerequisite ${p} is not from a later level`);
    }
    if (l.next) assert.ok(byId.has(l.next), `${l.id}: next ${l.next} exists`);
    for (const s of l.unlocks?.scales ?? []) assert.ok(findScale(s), `${l.id}: unlocks scale ${s}`);
    for (const c of l.unlocks?.chords ?? []) assert.ok(parseChordSymbol(c), `${l.id}: unlocks chord ${c}`);
    for (const c of l.unlocks?.challenges ?? []) assert.ok(CHALLENGES.some((x) => x.id === c), `${l.id}: challenge ${c}`);
    for (const m of l.unlocks?.trainerModes ?? []) assert.ok(TRAINER_MODES.some((x) => x.id === m), `${l.id}: trainer mode ${m}`);
  }
  // No cycles.
  const state = new Map<string, number>();
  const visit = (id: string) => {
    if (state.get(id) === 2) return;
    assert.notEqual(state.get(id), 1, `cycle through ${id}`);
    state.set(id, 1);
    for (const p of byId.get(id)!.prerequisites) visit(p);
    state.set(id, 2);
  };
  LESSONS.forEach((l) => visit(l.id));
  for (const c of CHALLENGES) for (const r of c.requires) assert.ok(byId.has(r), `challenge ${c.id} requires ${r}`);
});

test('pedagogical ordering required by the brief', () => {
  const byId = new Map(LESSONS.map((l) => [l.id, l]));
  const ancestors = (id: string, seen = new Set<string>()): Set<string> => {
    for (const p of byId.get(id)!.prerequisites) if (!seen.has(p)) { seen.add(p); ancestors(p, seen); }
    return seen;
  };
  const dorian = ancestors('l7-dorian');
  for (const need of ['l3-major-scale', 'l3-intervals', 'l7-modes-intro']) assert.ok(dorian.has(need), `Dorian requires ${need}`);
  const sweep = ancestors('l9-sweep');
  for (const need of ['l1-alternate-picking', 'l9-picking-systems', 'l8-chord-tones']) assert.ok(sweep.has(need), `Sweep requires ${need}`);
  const improv = ancestors('l10-styles');
  for (const need of ['l3-intervals', 'l8-chord-tones', 'l3-diatonic-chords', 'l5-minor-pentatonic']) assert.ok(improv.has(need), `Advanced improvisation requires ${need}`);
  assert.ok(ancestors('l6-pillitiere-patterns').has('l6-pillitiere-shapes'));
});

test('every mastery rule is achievable and practice exercises exist', () => {
  const exIds = new Set(EXERCISES.map((e) => e.id));
  for (const l of LESSONS) {
    assert.ok(l.mastery.quizPass > 0 && l.mastery.quizPass <= 1, `${l.id}: pass mark`);
    assert.ok(Math.ceil(l.mastery.quizPass * l.quiz.length) <= l.quiz.length, `${l.id}: pass mark reachable`);
    if (l.mastery.practice) {
      assert.ok(exIds.has(l.mastery.practice.exerciseId), `${l.id}: mastery exercise ${l.mastery.practice.exerciseId}`);
      const ex = EXERCISES.find((e) => e.id === l.mastery.practice!.exerciseId)!;
      if (l.mastery.practice.bpm) assert.ok(l.mastery.practice.bpm <= ex.bpmTarget + 20, `${l.id}: bpm goal within reach of the exercise`);
    }
    if (l.exercise.exerciseId) assert.ok(exIds.has(l.exercise.exerciseId), `${l.id}: exercise ${l.exercise.exerciseId}`);
    for (const q of l.quiz) {
      assert.ok(q.answer >= 0 && q.answer < q.options.length, `${q.id}: answer index`);
      assert.equal(new Set(q.options).size, q.options.length, `${q.id}: unique options`);
      assert.ok(q.explanation.length > 5, `${q.id}: explanation`);
    }
  }
});

test('lesson blocks reference valid theory objects', () => {
  for (const l of LESSONS)
    for (const b of [...l.explanation, ...l.guitar]) {
      if (b.type === 'fretboard') {
        assert.ok(parseNote(b.root), `${l.id}: fretboard root ${b.root}`);
        if (b.scale) assert.ok(findScale(b.scale), `${l.id}: scale ${b.scale}`);
        if (b.chord) assert.ok(parseChordSymbol(b.root + (b.chord === 'maj' ? '' : b.chord)), `${l.id}: chord ${b.chord}`);
        if (b.tuning) assert.ok(findTuning(b.tuning));
        for (const n of b.notes ?? []) assert.ok(parseNote(n), `${l.id}: note ${n}`);
      }
      if (b.type === 'chord') for (const s of b.symbols) assert.ok(parseChordSymbol(s), `${l.id}: chord symbol ${s}`);
      if (b.type === 'pillitiere') { assert.ok(parseNote(b.key)); assert.ok(b.degree >= 1 && b.degree <= 7); }
      if (b.type === 'tab') assert.ok(b.ascii.split('\n').some((line) => /\|/.test(line)), `${l.id}: tab has string lines`);
    }
});

test('exercises: valid scores, sensible tempos, linked variations', () => {
  const ids = new Set(EXERCISES.map((e) => e.id));
  assert.equal(ids.size, EXERCISES.length, 'unique ids');
  assert.ok(EXERCISES.length >= 35);
  for (const e of EXERCISES) {
    assert.deepEqual(validateScore(e.score).filter((i) => i.level === 'error'), [], `${e.id} score valid`);
    assert.ok(e.score.measures.flatMap((m) => m.beats).some((b) => b.notes.length), `${e.id} has notes`);
    assert.ok(e.bpmStart < e.bpmTarget, `${e.id} tempo range`);
    if (e.easier) assert.ok(ids.has(e.easier), `${e.id} easier → ${e.easier}`);
    if (e.harder) assert.ok(ids.has(e.harder), `${e.id} harder → ${e.harder}`);
    assert.ok(e.instructions.length && e.mistakes.length && e.mastery, `${e.id} has guidance`);
  }
  const techniques = new Set(EXERCISES.map((e) => e.technique));
  for (const t of ['alternate-picking', 'legato', 'sweep-picking', 'tapping', 'string-skipping', 'bending', 'vibrato', 'tremolo-picking', 'synchronization', 'rhythm-accuracy'])
    assert.ok(techniques.has(t as never), `Technique Lab covers ${t}`);
});

test('assessments include generated questions with correct answers', () => {
  for (const [lessonId, gens] of Object.entries(LESSON_GENERATORS)) {
    const lesson = LESSONS.find((l) => l.id === lessonId);
    assert.ok(lesson, `generator target ${lessonId} exists`);
    for (const g of gens) assert.ok(GENERATORS[g], `generator ${g}`);
    for (let seed = 1; seed < 20; seed++) {
      const a = buildAssessment(lesson!, seed);
      assert.equal(a.length, lesson!.quiz.length + 3);
      for (const q of a) {
        assert.ok(q.answer >= 0 && q.answer < q.options.length, `${q.id} answer index`);
        assert.equal(new Set(q.options).size, q.options.length, `${q.id} unique options: ${q.options.join('|')}`);
      }
    }
  }
  const intervals = buildAssessment(LESSONS.find((l) => l.id === 'l3-intervals')!, 5).filter((q) => q.id.startsWith('gen-int'));
  for (const q of intervals) {
    const n = Number(/spans (\d+)/.exec(q.prompt)![1]);
    const names = ['', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone (aug 4th / dim 5th)', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave'];
    assert.equal(q.options[q.answer], names[n]);
  }
});

test('glossary is searchable and links to lessons', () => {
  assert.ok(GLOSSARY.length >= 100);
  const lessonIds = new Set(LESSONS.map((l) => l.id));
  for (const g of GLOSSARY) if (g.lesson) assert.ok(lessonIds.has(g.lesson), `glossary ${g.term} → ${g.lesson}`);
  const terms = GLOSSARY.map((g) => g.term.toLowerCase());
  assert.equal(new Set(terms).size, terms.length, 'unique terms');
  assert.ok(PROGRESSIONS.length >= 15);
});
