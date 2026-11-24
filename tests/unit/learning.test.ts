import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, blankProgress, startLesson, completeLesson, recordQuiz, checkMastery, applyMastery, demoteAfterLapse,
  newCard, reviewCard, dueCards, gradeFromScore, lessonAvailability, nextLessons,
  generateQuestion, checkClicks, adapt, analyse, trainerRecommendations, TRAINER_STAGES, TRAINER_MODES, weightsFromAttempts,
  generateEarQuestion, EAR_KINDS, earStats, suggestedEarLevel,
  streak, practiceSummary, nextBpm, bpmProgress, weeklyGoals,
  buildRoutine, baseWeights, weaknesses, dailyRecommendations, newAchievements, ACHIEVEMENTS,
  CHALLENGES, buildChallenge, chordView, unlockedChallenges,
  type Lesson, type Exercise, type StudentState, type TrainerAttempt,
} from '@gma/learning';
import { STANDARD_TUNING, findTuning, midiAt, mod, resolveProgression, PROGRESSIONS } from '@gma/theory';
import { emptyScore } from '@gma/notation';

const NOW = new Date('2026-03-10T12:00:00Z');
const iso = (d: Date) => d.toISOString();

function lesson(id: string, level: number, prereq: string[] = [], extra: Partial<Lesson> = {}): Lesson {
  return {
    id, level, module: `m${level}`, title: id, minutes: 10, objectives: ['o'], prerequisites: prereq, categories: ['theory'], sources: [{ book: 'P' }],
    why: 'w', explanation: [], guitar: [], exercise: { title: 'e', steps: ['s'] }, mistakes: [], selfCheck: [], quiz: [], realWorld: '', summary: [],
    mastery: { quizPass: 0.8, criteria: ['c'] }, ...extra,
  };
}

function exercise(id: string, extra: Partial<Exercise> = {}): Exercise {
  return {
    id, name: id, technique: 'alternate-picking', category: 'technique', level: 1, difficulty: 2, bpmStart: 60, bpmTarget: 100, notesPerBeat: 4,
    reps: 4, minutes: 5, score: emptyScore(STANDARD_TUNING.strings), instructions: ['Play evenly.'], mistakes: [], mastery: 'clean at target', analyzable: true, ...extra,
  };
}

test('progress: statuses, mastery requires evidence beyond completion', () => {
  const L = lesson('l1-power-chords', 1, [], { mastery: { quizPass: 0.8, practice: { exerciseId: 'ex-power', bpm: 80 }, criteria: [] } });
  let p = blankProgress(L.id, iso(NOW));
  p = startLesson(p, iso(NOW));
  assert.equal(p.status, 'in_progress');
  p = completeLesson(p, iso(NOW));
  assert.equal(p.status, 'completed');
  assert.equal(checkMastery(L, p, []).mastered, false, 'completion alone is not mastery');
  p = recordQuiz(p, 'mastery', 4, 5, iso(NOW));
  const c1 = checkMastery(L, p, []);
  assert.equal(c1.quizMet, true);
  assert.equal(c1.practiceMet, false);
  const rec = { id: 'r', exerciseId: 'ex-power', at: iso(NOW), bpm: 84, clean: true, source: 'manual' as const, updatedAt: iso(NOW) };
  p = applyMastery(L, p, [rec], iso(NOW));
  assert.equal(p.status, 'mastered');
  assert.equal(demoteAfterLapse(p, iso(NOW)).status, 'completed');
  const slow = { ...rec, bpm: 70 };
  assert.equal(checkMastery(L, { ...p, status: 'completed' }, [slow]).practiceMet, false, 'below target bpm');
});

test('progress: prerequisites, placement and test-out', () => {
  const lessons = [lesson('a', 0), lesson('b', 0, ['a']), lesson('c', 1, ['b']), lesson('d', 2, ['c'])];
  const s = emptyState(iso(NOW));
  assert.equal(lessonAvailability(lessons[1], s, lessons).available, false);
  assert.equal(lessonAvailability(lessons[1], s, lessons).canTestOut, true);
  assert.deepEqual(nextLessons(lessons, s).map((l) => l.id), ['a']);
  s.lessons.a = completeLesson(blankProgress('a', iso(NOW)), iso(NOW));
  assert.equal(lessonAvailability(lessons[1], s, lessons).available, true);
  // A student placed at level 2 is not blocked by unfinished lower-level prerequisites.
  const placed = emptyState(iso(NOW));
  placed.profile.startLevel = 2;
  assert.equal(lessonAvailability(lessons[3], placed, lessons).available, true);
  assert.deepEqual(nextLessons(lessons, placed).map((l) => l.id), ['d']);
});

test('spaced repetition: SM-2 intervals, lapses and due cards', () => {
  let c = newCard('l3-intervals', NOW);
  c = reviewCard(c, 5, NOW);
  assert.equal(c.intervalDays, 1);
  c = reviewCard(c, 4, NOW);
  assert.equal(c.intervalDays, 3);
  c = reviewCard(c, 4, NOW);
  assert.ok(c.intervalDays >= 7);
  const lapsed = reviewCard(c, 1, NOW);
  assert.equal(lapsed.intervalDays, 1);
  assert.equal(lapsed.lapses, 1);
  assert.ok(lapsed.ease >= 1.3);
  const s = emptyState();
  s.srs[c.id] = { ...c, due: iso(new Date(NOW.getTime() - 1000)) };
  assert.equal(dueCards(s, NOW).length, 1);
  assert.equal(gradeFromScore(3, 3), 5);
  assert.equal(gradeFromScore(1, 3), 1);
});

test('fretboard trainer: questions are correct for every mode, tuning and string count', () => {
  const tunings = [STANDARD_TUNING, findTuning('drop-d')!, findTuning('7-standard')!, findTuning('8-standard')!, findTuning('open-g')!];
  for (const tuning of tunings)
    for (const mode of TRAINER_MODES)
      for (let seed = 1; seed <= 25; seed++) {
        const stage = TRAINER_STAGES[Math.max(mode.minStage, 3) - 1 + (seed % 3 === 0 ? 1 : 0)] ?? TRAINER_STAGES[4];
        const q = generateQuestion({ tuning, stage, mode: mode.id, seed: seed * 31 });
        assert.equal(q.mode, mode.id);
        if (q.options) {
          assert.ok(q.answerOption! >= 0 && q.answerOption! < q.options.length, `${mode.id}: answer is among options`);
          assert.equal(new Set(q.options).size, q.options.length, `${mode.id}: options are unique`);
        }
        if (q.accept) {
          assert.ok(q.accept.length > 0, `${mode.id} has accepted positions`);
          for (const p of q.accept) assert.ok(p.string < tuning.strings.length && p.fret >= q.range.minFret && p.fret <= q.range.maxFret);
        }
        if (mode.id === 'note-id') {
          const pc = mod(midiAt(tuning, q.highlight[0].string, q.highlight[0].fret), 12);
          assert.equal(q.meta.pc, pc);
        }
        if (mode.id === 'find-note' || mode.id === 'find-all')
          for (const p of q.accept!) assert.equal(mod(midiAt(tuning, p.string, p.fret), 12), q.meta.pc);
        if (mode.id === 'interval-find') {
          const root = q.highlight[0];
          for (const p of q.accept!) assert.equal(midiAt(tuning, p.string, p.fret) - midiAt(tuning, root.string, root.fret), q.meta.interval === 12 ? 12 : q.meta.interval);
        }
      }
});

test('fretboard trainer: click checking, adaptive stages, analytics and weighting', () => {
  const q = generateQuestion({ tuning: STANDARD_TUNING, stage: TRAINER_STAGES[3], mode: 'find-all', seed: 7 });
  assert.equal(checkClicks(q, q.accept!).correct, true);
  assert.equal(checkClicks(q, q.accept!.slice(1)).correct, false);
  assert.equal(checkClicks(q, [...q.accept!, { string: 0, fret: 99 }]).correct, false);
  let a = { stage: 1, streak: 0, recent: [] as boolean[] };
  for (let i = 0; i < 10; i++) a = adapt(a, true, 1500, [1500]);
  assert.equal(a.stage, 2, 'promoted after 10 fast correct answers');
  for (let i = 0; i < 10; i++) a = adapt(a, i % 3 === 0, 3000, [3000]);
  assert.equal(a.stage, 1, 'demoted when accuracy falls below 60%');
  const attempts: TrainerAttempt[] = [];
  for (let i = 0; i < 60; i++) attempts.push({ id: String(i), mode: 'note-id', tuningId: 'e-standard', string: i % 6, fret: (i * 3) % 13, pc: i % 12, correct: i % 6 !== 2, ms: 2000, at: iso(NOW) });
  const an = analyse(attempts, STANDARD_TUNING);
  assert.equal(an.total, 60);
  assert.equal(an.byString.find((b) => b.key === '2')!.accuracy, 0);
  assert.equal(an.weakest[0].key, '2');
  assert.match(trainerRecommendations(an)[0], /string 4 \(D\)/);
  const w = weightsFromAttempts(STANDARD_TUNING, attempts);
  assert.ok(w.byString[2] > w.byString[0], 'weak string is weighted up');
});

test('ear training: every kind and level yields a consistent question', () => {
  for (const k of EAR_KINDS)
    for (const lvl of k.levels)
      for (let seed = 1; seed <= 15; seed++) {
        const q = generateEarQuestion({ kind: k.id, level: lvl.level, seed });
        assert.ok(q.options.length >= 2, `${k.id} has options`);
        assert.ok(q.answer >= 0 && q.answer < q.options.length);
        assert.equal(new Set(q.options).size, q.options.length, `${k.id} options unique`);
        assert.ok(q.play.length > 0 && q.play.every((p) => p.duration > 0));
        if (k.id === 'interval') {
          const notes = q.play.flatMap((p) => p.notes);
          assert.equal(Math.max(...notes) - Math.min(...notes), Number(q.item));
        }
      }
  const attempts = Array.from({ length: 20 }, (_, i) => ({ id: String(i), kind: 'interval' as const, item: String(i % 3), correct: true, at: iso(NOW) }));
  assert.equal(suggestedEarLevel(attempts, 'interval', 1), 2);
  assert.equal(earStats(attempts)[0].accuracy, 1);
});

test('analytics: streaks, summary, bpm progression and weekly goals', () => {
  const s = emptyState();
  for (let i = 0; i < 5; i++) {
    const d = new Date(NOW.getTime() - i * 86_400_000);
    s.sessions.push({ id: `s${i}`, startedAt: iso(d), plannedMinutes: 30, actualMinutes: 30, routineName: 'r', blocks: [{ category: 'technique', activity: 'x', title: 't', minutes: 30, completed: true }], updatedAt: iso(d) });
  }
  assert.equal(streak(s, NOW).current, 5);
  const sum = practiceSummary(s, NOW);
  assert.equal(sum.weekMinutes, 150);
  assert.ok(sum.neglected.includes('ear'));
  assert.ok(!sum.neglected.includes('technique'));
  const ex = exercise('ex1');
  assert.equal(nextBpm(ex, []).bpm, 60);
  const recs = [
    { id: 'a', exerciseId: 'ex1', at: '2026-03-01T00:00:00Z', bpm: 80, clean: true, source: 'manual' as const, updatedAt: '' },
    { id: 'b', exerciseId: 'ex1', at: '2026-03-02T00:00:00Z', bpm: 84, clean: true, source: 'manual' as const, updatedAt: '' },
  ];
  assert.equal(nextBpm(ex, recs).bpm, 88);
  assert.equal(nextBpm(ex, [...recs, { ...recs[1], id: 'c', at: '2026-03-03T00:00:00Z', bpm: 90, clean: false }]).bpm, 82);
  assert.equal(bpmProgress(recs, 'ex1')!.bestCleanBpm, 84);
  assert.equal(weeklyGoals(s, NOW).find((g) => g.id === 'days')!.progress, 5);
});

test('scheduler: routines sum to the requested time and adapt to weaknesses', () => {
  const lessons = [lesson('l0', 0), lesson('l1', 1), lesson('l5', 5)];
  const exercises = [
    exercise('pick-1', { level: 0 }), exercise('pick-2', { level: 1, easier: 'pick-1' }), exercise('sync-1', { technique: 'synchronization', level: 1 }),
    exercise('chord-1', { category: 'chords', technique: 'chord-changes', level: 0 }), exercise('rhythm-1', { category: 'rhythm', technique: 'rhythm-accuracy', level: 0 }),
    exercise('scale-1', { category: 'scales', technique: 'scales', level: 3 }),
  ];
  const s = emptyState();
  for (const m of [15, 30, 60, 90]) {
    const r = buildRoutine({ state: s, lessons, exercises, minutes: m, now: NOW, seed: 1 });
    assert.equal(r.blocks.reduce((a, b) => a + b.minutes, 0), m, `${m}-minute routine sums correctly`);
    assert.ok(r.blocks.every((b) => b.minutes >= 5));
    assert.ok(r.blocks.every((b) => b.route.startsWith('/')));
    if (m >= 60) assert.ok(r.breaks.length >= 1, 'break reminders in long routines');
  }
  const beginner = baseWeights(0);
  assert.equal(beginner.improvisation, 0);
  // Struggling repeatedly with pick-2 → the easier variation is scheduled.
  s.exerciseRecords = [1, 2, 3].map((i) => ({ id: `r${i}`, exerciseId: 'pick-2', at: `2026-03-0${i}T00:00:00Z`, bpm: 90, clean: false, source: 'manual' as const, updatedAt: '' }));
  const w = weaknesses(s, exercises, NOW);
  assert.equal(w[0].category, 'technique');
  const r = buildRoutine({ state: s, lessons, exercises, minutes: 30, now: NOW, seed: 2 });
  const tech = r.blocks.find((b) => b.category === 'technique')!;
  assert.equal(tech.exerciseId, 'pick-1');
  assert.match(tech.reason, /simpler variation/);
});

test('recommendations and achievements follow the rules in the brief', () => {
  const lessons = [lesson('l5-minor-pentatonic', 5, [], { title: 'Minor pentatonic position 1' }), lesson('l0-tuning', 0)];
  const exercises = [exercise('pick-1'), exercise('sync-1', { technique: 'synchronization' })];
  const s = emptyState();
  s.exerciseRecords = [1, 2].map((i) => ({ id: `r${i}`, exerciseId: 'pick-1', at: iso(NOW), bpm: 100, clean: false, source: 'analyzer' as const, analyzer: { meanAbsErrorMs: 40, stdDevMs: 25, driftMsPerBar: 2, matched: 12, expected: 16, confidence: 'high' as const }, updatedAt: '' }));
  s.lessons['l5-minor-pentatonic'] = completeLesson(blankProgress('l5-minor-pentatonic', iso(NOW)), iso(NOW));
  const recs = dailyRecommendations(s, lessons, exercises, NOW);
  assert.ok(recs.some((r) => r.id === 'sync' && /synchronisation/.test(r.detail)));
  assert.ok(recs.some((r) => r.id === 'phrasing'));
  const got = newAchievements(s, lessons, exercises, NOW).map((a) => a.id);
  assert.ok(got.includes('first-lesson'));
  assert.ok(!got.includes('first-solo'));
  assert.ok(ACHIEVEMENTS.length >= 15);
});

test('jam lab: challenges compute concrete, harmony-based targets', () => {
  const s = emptyState();
  assert.equal(unlockedChallenges(s).length, 0);
  s.lessons['l5-minor-pentatonic'] = completeLesson(blankProgress('l5-minor-pentatonic', iso(NOW)), iso(NOW));
  assert.ok(unlockedChallenges(s).some((c) => c.id === 'three-notes'));
  const thirds = buildChallenge(CHALLENGES.find((c) => c.id === 'target-thirds')!, { key: 'A', mode: 'major', progressionId: '12-bar-blues' });
  assert.deepEqual(thirds.targets, ['A7: C#', 'D7: F#', 'E7: G#']);
  const dorian = buildChallenge(CHALLENGES.find((c) => c.id === 'dorian-minor')!, { key: 'D', mode: 'minor', progressionId: 'dorian-vamp' });
  assert.match(dorian.targets[0], /^B /);
  const chords = resolveProgression(PROGRESSIONS.find((p) => p.id === 'andalusian')!.bars, 'A');
  const v = chordView(chords[3], 'A', 'minor');
  assert.equal(v.symbol, 'E7');
  assert.equal(v.suggestions[0].scaleId, 'phrygian-dominant');
  assert.equal(v.inKey, false);
  for (const c of CHALLENGES) for (const p of c.progressions) assert.ok(PROGRESSIONS.some((x) => x.id === p), `${c.id}: ${p} exists`);
});
