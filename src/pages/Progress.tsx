/** Progress & analytics, plus the spaced-repetition review session. */
import { useMemo, useState } from 'react';
import { LuFlame, LuClock, LuTrophy, LuBrain, LuRepeat, LuLock, LuCircleCheck, LuGauge } from 'react-icons/lu';
import {
  ACHIEVEMENTS, CATEGORIES, analyse, bpmProgress, buildAssessment, demoteAfterLapse, dueCards, earStats, EAR_KINDS, gradeFromScore,
  levelSummaries, practiceSummary, reviewCard, streak, weeklyGoals, type SrsCard,
} from '@gma/learning';
import { findTuning, TUNINGS } from '@gma/theory';
import { LESSONS } from '@content/lessons/index';
import { LEVELS } from '@content/curriculum';
import { useAllExercises, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { fmtMinutes, nowIso, pct, relativeDay, uid } from '@/lib/core';
import { navigate, useDocumentTitle, useLocation, Link } from '@/lib/router';
import { Badge, Button, Card, Empty, PageHeader, ProgressBar, Stat } from '@/components/ui';
import { BarChart, HBars, LineChart } from '@/components/charts';
import { QuizRunner } from '@/components/widgets';

export function ProgressPage() {
  useDocumentTitle('Progress');
  const { query } = useLocation();
  if (query.get('review') === '1') return <ReviewSession />;
  return <Overview />;
}

function Overview() {
  const s = useStudent();
  const exercises = useAllExercises();
  const now = useMemo(() => new Date(), [s]);
  const sum = useMemo(() => practiceSummary(s, now), [s, now]);
  const st = streak(s, now);
  const goals = weeklyGoals(s, now);
  const levels = levelSummaries(LESSONS, s);
  const due = dueCards(s, now);
  const tuning = findTuning(s.profile.tuningId, s.tunings) ?? TUNINGS[0];
  const trainer = useMemo(() => analyse(s.trainer, tuning), [s.trainer, tuning]);
  const ear = earStats(s.ear);
  const mastered = Object.values(s.lessons).filter((l) => l.status === 'mastered').length;
  const completed = Object.values(s.lessons).filter((l) => l.status === 'completed' || l.status === 'mastered').length;

  const tempoRows = useMemo(() => exercises.map((e) => ({ e, p: bpmProgress(s.exerciseRecords, e.id) })).filter((x) => x.p).sort((a, b) => b.p!.records - a.p!.records).slice(0, 8), [exercises, s.exerciseRecords]);
  const [tempoSel, setTempoSel] = useState<string | null>(null);
  const tempoFocus = tempoRows.find((r) => r.e.id === tempoSel) ?? tempoRows[0];
  const quizHistory = s.quizAttempts.slice(-20);

  return (
    <div>
      <PageHeader eyebrow="You" title="Progress" subtitle="Everything here is calculated from what you have actually done in the app."
        actions={due.length > 0 ? <Button variant="primary" onClick={() => navigate('/progress?review=1')} data-testid="start-review"><LuRepeat size={16} /> Review {due.length} due</Button> : undefined} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Current streak" value={`${st.current} day${st.current === 1 ? '' : 's'}`} hint={`Best ${st.best}`} icon={<LuFlame size={16} />} />
        <Stat label="Practice time" value={fmtMinutes(sum.totalMinutes)} hint={`${fmtMinutes(sum.weekMinutes)} this week`} icon={<LuClock size={16} />} />
        <Stat label="Lessons" value={`${completed} / ${LESSONS.length}`} hint={`${mastered} mastered`} icon={<LuTrophy size={16} />} />
        <Stat label="Consistency" value={pct(sum.consistency)} hint="days practised, last 28" icon={<LuGauge size={16} />} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Daily practice" subtitle="Minutes logged in Practice Studio, last 28 days">
          {sum.daily.some((d) => d.minutes > 0) ? <BarChart title="Practice minutes per day" unit=" min" data={sum.daily.map((d) => ({ label: d.day.slice(5), value: d.minutes }))} /> : <Empty title="No sessions yet" body="Run a session in Practice Studio and it appears here." action={<Button onClick={() => navigate('/practice')}>Open Practice Studio</Button>} />}
        </Card>
        <Card title="This week's goals">
          <ul className="space-y-3">
            {goals.map((g) => (
              <li key={g.id}>
                <div className="mb-1 flex justify-between text-sm"><span className="text-ink-200">{g.label}</span><span className="tabular-nums text-ink-400">{Math.round(g.progress)} / {g.target}</span></div>
                <ProgressBar value={Math.min(1, g.progress / Math.max(1, g.target))} tone={g.progress >= g.target ? 'ok' : 'accent'} label={g.label} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Time by skill area" subtitle="All logged practice">
          {sum.totalMinutes > 0
            ? <HBars unit=" min" data={sum.byCategory.filter((c) => c.minutes > 0).map((c) => ({ label: CATEGORIES.find((x) => x.id === c.category)?.name ?? c.category, value: c.minutes }))} />
            : <p className="text-sm text-ink-400">No practice logged yet.</p>}
          {sum.neglected.length > 0 && sum.totalMinutes > 0 && <p className="mt-3 text-xs text-ink-400">Not practised recently: {sum.neglected.map((c) => CATEGORIES.find((x) => x.id === c)?.name).join(', ')}. The scheduler will weight these.</p>}
        </Card>
        <Card title="Curriculum" subtitle="Completed and mastered lessons by level">
          <ul className="space-y-2">
            {levels.map((l) => (
              <li key={l.level} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
                <Link to="/path" className="truncate text-sm text-ink-200 hover:text-ink-50">L{l.level} · {LEVELS.find((x) => x.level === l.level)?.title}</Link>
                <span className="text-xs tabular-nums text-ink-400">{l.completed}/{l.total}{l.mastered ? ` · ${l.mastered}★` : ''}</span>
                <ProgressBar value={l.total ? l.completed / l.total : 0} className="col-span-2 mt-1" label={`Level ${l.level} completion`} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Tempo progress" subtitle="Logged takes per exercise (manual and analyzer)" className="lg:col-span-2">
          {tempoFocus ? (
            <div className="grid gap-5 md:grid-cols-[240px_1fr]">
              <ul className="space-y-1">
                {tempoRows.map(({ e, p }) => (
                  <li key={e.id}><button type="button" onClick={() => setTempoSel(e.id)} className={`w-full rounded-lg px-2.5 py-1.5 text-left ${tempoFocus.e.id === e.id ? 'bg-accent-500/15' : 'hover:bg-ink-800'}`}>
                    <div className="truncate text-sm text-ink-100">{e.name}</div>
                    <div className="text-xs text-ink-400">best clean {p!.bestCleanBpm || '—'} / target {e.bpmTarget} bpm</div>
                  </button></li>
                ))}
              </ul>
              <div>
                <LineChart title={`Tempo of logged takes for ${tempoFocus.e.name}`} unit=" bpm" data={tempoFocus.p!.history.map((h) => ({ label: new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: h.bpm, detail: h.clean ? 'clean' : 'not clean' }))} />
                <p className="mt-2 text-xs text-ink-400">{tempoFocus.p!.records} takes · first {tempoFocus.p!.firstBpm} bpm · best clean {tempoFocus.p!.bestCleanBpm || '—'} bpm. <Link to={`/technique-lab?exercise=${tempoFocus.e.id}`} className="text-accent-300 hover:underline">Practise it</Link></p>
              </div>
            </div>
          ) : <Empty title="No takes logged" body="Log takes in Technique Lab or the Playing Analyzer to track tempo over time." />}
        </Card>

        <Card title="Fretboard knowledge" subtitle={trainer.total ? `${trainer.total} answers in ${tuning.name}` : undefined}>
          {trainer.total ? (
            <>
              <HBars unit="%" data={trainer.byString.map((b) => ({ label: b.label, value: Math.round(b.accuracy * 100), detail: `${b.attempts} answers` }))} />
              <Link to="/fretboard-trainer" className="mt-3 inline-block text-xs text-accent-300 hover:underline">Open the trainer →</Link>
            </>
          ) : <Empty title="No trainer data" action={<Button onClick={() => navigate('/fretboard-trainer')}>Start training</Button>} />}
        </Card>
        <Card title="Ear training">
          {ear.length ? (
            <HBars unit="%" data={ear.map((e) => ({ label: EAR_KINDS.find((k) => k.id === e.kind)?.name ?? e.kind, value: Math.round(e.accuracy * 100), detail: `${e.attempts} answers` }))} />
          ) : <Empty title="No ear-training data" action={<Button onClick={() => navigate('/ear-training')}>Start ear training</Button>} />}
        </Card>

        {quizHistory.length > 1 && (
          <Card title="Quiz and assessment scores" subtitle="Last 20 attempts" className="lg:col-span-2">
            <LineChart title="Quiz score percentage" unit="%" min={0} data={quizHistory.map((q) => ({ label: new Date(q.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: Math.round((q.score / Math.max(1, q.total)) * 100), detail: `${LESSONS.find((l) => l.id === q.lessonId)?.title ?? q.lessonId} (${q.kind})` }))} />
          </Card>
        )}

        <Card title="Spaced review" subtitle="Lessons you completed come back for short reviews at growing intervals.">
          {Object.keys(s.srs).length === 0 ? <p className="text-sm text-ink-400">Complete a lesson to start your review queue.</p> : (
            <>
              <p className="text-sm text-ink-200">{due.length} due now · {Object.keys(s.srs).length} in the queue.</p>
              <ul className="mt-2 space-y-1 text-xs text-ink-400">
                {Object.values(s.srs).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6).map((c) => <li key={c.id}>{LESSONS.find((l) => l.id === c.lessonId)?.title ?? c.lessonId}: {relativeDay(c.due)}</li>)}
              </ul>
              {due.length > 0 && <Button className="mt-3" size="sm" variant="primary" onClick={() => navigate('/progress?review=1')}><LuRepeat size={14} /> Start review</Button>}
            </>
          )}
        </Card>
        <Card title="Achievements" subtitle={`${Object.keys(s.achievements).length} of ${ACHIEVEMENTS.length}`}>
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="achievements">
            {ACHIEVEMENTS.map((a) => {
              const got = s.achievements[a.id];
              return (
                <li key={a.id} className={`flex gap-2.5 rounded-lg border px-2.5 py-2 ${got ? 'border-ok-500/30 bg-ok-500/5' : 'border-ink-700 opacity-70'}`} title={a.description}>
                  <span className={got ? 'text-ok-400' : 'text-ink-500'}>{got ? <LuCircleCheck size={16} /> : <LuLock size={16} />}</span>
                  <div className="min-w-0"><div className="truncate text-sm text-ink-100">{a.title}</div><div className="text-[11px] text-ink-400">{got ? `Unlocked ${relativeDay(got.unlockedAt)}` : a.description}</div></div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ReviewSession() {
  useDocumentTitle('Review');
  const s = useStudent();
  const [queue] = useState<SrsCard[]>(() => dueCards(store.state, new Date()));
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<{ title: string; score: number; total: number; grade: number }[]>([]);
  const card = queue[idx];
  const lesson = card ? LESSONS.find((l) => l.id === card.lessonId) : undefined;
  const questions = useMemo(() => {
    if (!lesson) return [];
    const pool = [...lesson.quiz, ...buildAssessment(lesson, Date.now() % 100000)];
    const seen = new Set<string>();
    return pool.filter((q) => (seen.has(q.prompt) ? false : (seen.add(q.prompt), true))).sort(() => Math.random() - 0.5).slice(0, 5);
  }, [lesson?.id, idx]);

  if (!queue.length) return (
    <div><PageHeader eyebrow="Review" title="Nothing to review" /><Empty title="You're up to date" body="Completed lessons return here when they are due." icon={<LuBrain size={22} />} action={<Button onClick={() => navigate('/progress')}>Back to progress</Button>} /></div>
  );

  if (!card || !lesson) return (
    <div>
      <PageHeader eyebrow="Review" title="Review complete" />
      <Card>
        <ul className="space-y-2" data-testid="review-results">
          {results.map((r, i) => <li key={i} className="flex items-center justify-between text-sm"><span className="text-ink-100">{r.title}</span><span className="flex items-center gap-2"><span className="tabular-nums text-ink-300">{r.score}/{r.total}</span>{r.grade >= 3 ? <Badge tone="ok">recalled</Badge> : <Badge tone="warn">needs revision</Badge>}</span></li>)}
        </ul>
        <div className="mt-4 flex gap-2"><Button variant="primary" onClick={() => navigate('/progress')}>Back to progress</Button><Button onClick={() => navigate('/')}>Dashboard</Button></div>
      </Card>
    </div>
  );

  const done = (score: number, missed: string[]) => {
    const now = new Date();
    const grade = gradeFromScore(score, questions.length);
    store.upsert('srs', card.id, reviewCard(card, grade, now));
    store.append('quizAttempts', { id: uid('qa'), lessonId: lesson.id, kind: 'review', score, total: questions.length, missed, at: nowIso() });
    const prog = s.lessons[lesson.id];
    if (grade < 3 && prog?.status === 'mastered') {
      store.upsert('lessons', lesson.id, demoteAfterLapse(prog, nowIso()));
      store.toast('Lesson needs revision', `"${lesson.title}" moved back to completed. Revisit it and retake the mastery check.`, 'warning');
    }
    setResults((r) => [...r, { title: lesson.title, score, total: questions.length, grade }]);
    setIdx((i) => i + 1);
  };

  return (
    <div>
      <PageHeader eyebrow={`Review ${idx + 1} of ${queue.length}`} title={lesson.title} subtitle="A short retrieval check. Your answers set when this lesson comes back." actions={<Button onClick={() => navigate('/progress')}>Exit review</Button>} />
      <ProgressBar value={idx / queue.length} className="mb-5" label="Review progress" />
      <QuizRunner key={card.id} questions={questions} onDone={done} title="Review questions" />
      <p className="mt-3 text-xs text-ink-400"><Link to={`/lessons/${lesson.id}`} className="text-accent-300 hover:underline">Re-read the lesson</Link> if you are unsure; you can return to the review afterwards.</p>
    </div>
  );
}
