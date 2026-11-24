import { useMemo, useState, type ReactNode } from 'react';
import {
  LuArrowRight, LuCheck, LuCircle, LuCircleCheck, LuClock, LuFlame, LuLock, LuSearch, LuStar, LuTrophy, LuTarget, LuZap, LuCalendar,
  LuGauge, LuMap, LuEar, LuRadio, LuBookOpen,
} from 'react-icons/lu';
import {
  ACHIEVEMENTS, CATEGORIES, applyMastery, blankProgress, buildAssessment, checkMastery, completeLesson, currentLevel, dailyRecommendations,
  getProgress, lessonAvailability, levelSummaries, newCard, nextLessons, recordQuiz, startLesson, statusAtLeast, streak, weeklyGoals,
  type Category, type Lesson, type LessonStatus,
} from '@gma/learning';
import { LESSONS } from '@content/lessons/index';
import { LEVELS, MODULES } from '@content/curriculum';
import { EXERCISES } from '@content/exercises';
import { useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx, fmtMinutes, nowIso, pct, uid } from '@/lib/core';
import { Link, navigate, useDocumentTitle } from '@/lib/router';
import { Badge, Button, Callout, Card, Empty, Field, Modal, PageHeader, ProgressBar, Segmented, Stat, Stepper } from '@/components/ui';
import { LessonBlocks, MetronomeWidget, QuizRunner, SourceLine, TuningPicker } from '@/components/widgets';
import { TabView } from '@/components/music';

const lessonById = new Map(LESSONS.map((l) => [l.id, l]));

export function StatusIcon({ status, size = 16 }: { status: LessonStatus; size?: number }) {
  if (status === 'mastered') return <LuStar size={size} className="text-warn-400" aria-label="Mastered" />;
  if (status === 'completed') return <LuCircleCheck size={size} className="text-ok-400" aria-label="Completed" />;
  if (status === 'in_progress') return <LuCircle size={size} className="text-accent-300" aria-label="In progress" />;
  return <LuCircle size={size} className="text-ink-500" aria-label="Not started" />;
}

const STATUS_LABEL: Record<LessonStatus, string> = { not_started: 'Not started', in_progress: 'In progress', completed: 'Completed', mastered: 'Mastered' };

// ── Onboarding ───────────────────────────────────────────────────────────

export function Onboarding() {
  const s = useStudent();
  const [name, setName] = useState(s.profile.displayName === 'Guitarist' ? '' : s.profile.displayName);
  const [level, setLevel] = useState(String(s.profile.startLevel));
  const [goals, setGoals] = useState<Category[]>(s.profile.goals);
  const [minutes, setMinutes] = useState(s.profile.dailyMinutes);
  const [tuningId, setTuningId] = useState(s.profile.tuningId);
  if (s.profile.onboarded) return null;
  const toggle = (c: Category) => setGoals((g) => (g.includes(c) ? g.filter((x) => x !== c) : [...g, c]));
  const finish = () => {
    store.setProfile({ displayName: name.trim() || 'Guitarist', startLevel: Number(level), goals, dailyMinutes: minutes, tuningId, onboarded: true });
    store.toast('Welcome to the academy', 'Your dashboard now shows your next lesson and today\'s practice.', 'success');
  };
  return (
    <Modal open onClose={finish} title="Welcome to Guitar Mastery Academy" wide>
      <div className="space-y-5" data-testid="onboarding">
        <p className="text-sm text-ink-300">A few questions to personalise your path. You can change everything later in Settings.</p>
        <Field label="Your name"><input className="input" value={name} onChange={(e) => setName((e.target as HTMLInputElement).value)} placeholder="Guitarist" maxLength={80} /></Field>
        <Field label="Where are you starting?" hint="Skipping ahead marks lower levels as optional. You can still test out of any lesson by passing its mastery assessment.">
          <Segmented value={level} onChange={setLevel} size="sm" options={[{ value: '0', label: 'Never played' }, { value: '1', label: 'Know a few chords' }, { value: '3', label: 'Play songs, little theory' }, { value: '5', label: 'Intermediate' }, { value: '8', label: 'Advanced' }]} />
        </Field>
        <div>
          <div className="label mb-1.5">What do you want to focus on?</div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => <button key={c.id} type="button" onClick={() => toggle(c.id)} className={cx('rounded-full border px-3 py-1 text-sm', goals.includes(c.id) ? 'border-accent-500 bg-accent-500/15 text-accent-300' : 'border-ink-600 text-ink-200 hover:border-ink-400')}>{c.name}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-5">
          <Field label="Daily practice"><Stepper value={minutes} onChange={setMinutes} min={10} max={180} step={5} label="Daily minutes" suffix="min" /></Field>
          <Field label="Your guitar's tuning"><TuningPicker value={tuningId} onChange={setTuningId} /></Field>
        </div>
        <div className="flex justify-end"><Button variant="primary" size="lg" onClick={finish} data-testid="onboarding-finish">Start learning <LuArrowRight size={18} /></Button></div>
      </div>
    </Modal>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────

// ── Learning path ────────────────────────────────────────────────────────

export function PathPage() {
  useDocumentTitle('Learning Path');
  const s = useStudent();
  const current = currentLevel(LESSONS, s);
  const [open, setOpen] = useState<number>(current);
  const sums = levelSummaries(LESSONS, s);
  return (
    <div>
      <PageHeader eyebrow="Learn" title="Learning Path" subtitle="Thirteen levels from absolute zero to advanced musicianship. Lessons open when their prerequisites are complete, and you can test out of any lesson by passing its mastery assessment." />
      <ol className="space-y-3">
        {LEVELS.map((lvl) => {
          const sum = sums.find((x) => x.level === lvl.level)!;
          const isOpen = open === lvl.level;
          return (
            <li key={lvl.level} className="card overflow-hidden">
              <button type="button" onClick={() => setOpen(isOpen ? -1 : lvl.level)} className="flex w-full items-center gap-4 px-4 py-4 text-left sm:px-5" aria-expanded={isOpen} data-testid={`level-${lvl.level}`}>
                <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-semibold', sum.completed === sum.total ? 'bg-ok-500/15 text-ok-400' : lvl.level === current ? 'bg-accent-500/20 text-accent-300' : 'bg-ink-700 text-ink-300')}>{lvl.level}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink-50">{lvl.title}</span>
                  <span className="block truncate text-xs text-ink-400">{lvl.summary}</span>
                </span>
                <span className="hidden w-32 sm:block"><ProgressBar value={sum.completed / sum.total} tone={sum.completed === sum.total ? 'ok' : 'accent'} label={`Level ${lvl.level} progress`} /></span>
                <span className="w-12 text-right text-xs tabular-nums text-ink-300">{sum.completed}/{sum.total}</span>
              </button>
              {isOpen && (
                <div className="border-t border-ink-700 px-4 pb-4 sm:px-5">
                  <p className="mt-3 text-sm text-ink-300"><b className="text-ink-100">Outcome:</b> {lvl.outcome}</p>
                  {MODULES.filter((m) => m.level === lvl.level).map((m) => (
                    <div key={m.id} className="mt-4">
                      <div className="label mb-2">{m.title}</div>
                      <ul className="space-y-1.5">
                        {LESSONS.filter((l) => l.module === m.id).map((l) => {
                          const p = getProgress(s, l.id);
                          const av = lessonAvailability(l, s, LESSONS);
                          return (
                            <li key={l.id}>
                              <Link to={`/lessons/${l.id}`} className="flex items-center gap-3 rounded-lg border border-ink-700 px-3 py-2 hover:border-ink-500">
                                {av.available || p.status !== 'not_started' ? <StatusIcon status={p.status} /> : <LuLock size={16} className="text-ink-500" aria-label="Locked" />}
                                <span className="min-w-0 flex-1 truncate text-sm text-ink-100">{l.title}</span>
                                <span className="hidden text-xs text-ink-400 sm:inline">{l.minutes} min</span>
                                {!av.available && p.status === 'not_started' && <Badge>Test out available</Badge>}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Lessons list ─────────────────────────────────────────────────────────

export function LessonsPage() {
  useDocumentTitle('Lessons');
  const s = useStudent();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | LessonStatus>('all');
  const filtered = LESSONS.filter((l) => (!q || `${l.title} ${l.objectives.join(' ')}`.toLowerCase().includes(q.toLowerCase())) && (status === 'all' || getProgress(s, l.id).status === status));
  return (
    <div>
      <PageHeader eyebrow="Learn" title="Lessons" subtitle={`${LESSONS.length} lessons across 13 levels.`} />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1"><LuSearch size={16} className="absolute left-3 top-2.5 text-ink-400" /><input className="input pl-9" placeholder="Search lessons…" value={q} onChange={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Search lessons" /></div>
        <Segmented value={status} onChange={setStatus} size="sm" options={[{ value: 'all', label: 'All' }, { value: 'not_started', label: 'New' }, { value: 'in_progress', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'mastered', label: 'Mastered' }]} />
      </div>
      {filtered.length === 0 ? <Empty title="No lessons match" body="Try a different search or filter." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => {
            const p = getProgress(s, l.id);
            return (
              <Link key={l.id} to={`/lessons/${l.id}`} className="card card-pad block transition-colors hover:border-ink-500">
                <div className="flex items-center justify-between"><span className="label">Level {l.level}</span><StatusIcon status={p.status} /></div>
                <div className="mt-1.5 font-medium text-ink-50">{l.title}</div>
                <p className="mt-1 line-clamp-2 text-xs text-ink-300">{l.objectives[0]}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-400"><LuClock size={12} />{l.minutes} min{l.sources.some((x) => x.book !== 'P') && <Badge tone="accent" className="ml-auto">Source-based</Badge>}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Lesson page ──────────────────────────────────────────────────────────

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return <section id={id} className="mb-8"><h2 className="mb-3 text-lg font-semibold text-ink-50">{title}</h2>{children}</section>;
}

export function LessonPage({ id }: { id: string }) {
  const lesson = lessonById.get(id);
  useDocumentTitle(lesson?.title ?? 'Lesson');
  const s = useStudent();
  const [quiz, setQuiz] = useState<'none' | 'quiz' | 'mastery'>('none');
  const [seed, setSeed] = useState(1);
  const assessment = useMemo(() => (lesson ? buildAssessment(lesson, seed) : []), [lesson, seed]);
  if (!lesson) return <Empty title="Lesson not found" action={<Button onClick={() => navigate('/lessons')}>All lessons</Button>} />;
  const p = getProgress(s, lesson.id);
  const av = lessonAvailability(lesson, s, LESSONS);
  const mastery = checkMastery(lesson, p, s.exerciseRecords);
  // Only the assessment score and the logged practice take are verified by the app; other criteria are self-checks.
  const selfChecks = lesson.mastery.criteria.filter((c) => !/^(Score|Answer)/.test(c) && !(lesson.mastery.practice && /^Log/.test(c)));
  const next = lesson.next ? lessonById.get(lesson.next) : undefined;
  const level = LEVELS.find((l) => l.level === lesson.level)!;
  const mod = MODULES.find((m) => m.id === lesson.module)!;
  const exercise = lesson.exercise.exerciseId ? EXERCISES.find((e) => e.id === lesson.exercise.exerciseId) : undefined;

  const save = (np: typeof p) => store.upsert('lessons', lesson.id, np);
  const ensureStarted = () => { if (p.status === 'not_started') save(startLesson({ ...p, lessonId: lesson.id }, nowIso())); };
  const markComplete = () => {
    const done = completeLesson(p.updatedAt === new Date(0).toISOString() ? blankProgress(lesson.id, nowIso()) : p, nowIso());
    save(applyMastery(lesson, done, s.exerciseRecords, nowIso()));
    if (!s.srs[`srs-${lesson.id}`]) store.upsert('srs', `srs-${lesson.id}`, newCard(lesson.id, new Date()));
    store.toast('Lesson completed', next ? `Up next: ${next.title}` : 'Great work.', 'success');
  };
  const onQuizDone = (kind: 'quiz' | 'mastery', score: number, missed: string[], total: number) => {
    store.append('quizAttempts', { id: uid('quiz'), lessonId: lesson.id, kind, score, total, missed, at: nowIso() });
    let np = recordQuiz(getProgress(store.state, lesson.id).updatedAt === new Date(0).toISOString() ? blankProgress(lesson.id, nowIso()) : getProgress(store.state, lesson.id), kind, score, total, nowIso());
    if (kind === 'mastery') {
      const before = np.status;
      np = applyMastery(lesson, np, store.state.exerciseRecords, nowIso());
      if (np.status === 'mastered' && before !== 'mastered') {
        if (!store.state.srs[`srs-${lesson.id}`]) store.upsert('srs', `srs-${lesson.id}`, newCard(lesson.id, new Date()));
        store.toast('Lesson mastered', lesson.title, 'success');
      } else if (score / total >= lesson.mastery.quizPass) store.toast('Assessment passed', mastery.practiceRequired ? 'Log the required practice result to complete mastery.' : '', 'info');
      else store.toast('Not yet', `You scored ${score}/${total}. Review the lesson and try again.`, 'warning');
    }
    save(np);
  };
  const toggleCheck = (k: string) => {
    ensureStarted();
    const cur = getProgress(store.state, lesson.id);
    const checked = cur.checked?.includes(k) ? cur.checked.filter((x) => x !== k) : [...(cur.checked ?? []), k];
    save({ ...cur, lessonId: lesson.id, status: cur.status === 'not_started' ? 'in_progress' : cur.status, checked, updatedAt: nowIso() });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <article className="min-w-0" onPointerDown={ensureStarted} data-testid="lesson-article">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-400">
          <Link to="/path" className="hover:text-ink-200">Level {level.level} · {level.title}</Link><span>/</span><span>{mod.title}</span>
        </div>
        <h1 className="text-2xl font-semibold text-ink-50 sm:text-3xl">{lesson.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={p.status === 'mastered' ? 'warn' : p.status === 'completed' ? 'ok' : p.status === 'in_progress' ? 'accent' : 'neutral'}><StatusIcon status={p.status} size={12} />{STATUS_LABEL[p.status]}</Badge>
          <Badge><LuClock size={12} />{lesson.minutes} min</Badge>
          {lesson.categories.map((c) => <Badge key={c}>{CATEGORIES.find((x) => x.id === c)?.name}</Badge>)}
        </div>
        {!av.available && (
          <Callout tone="warn" title="Prerequisites not finished">
            Recommended first: {av.missing.map((m, i) => <span key={m}>{i > 0 && ', '}<Link to={`/lessons/${m}`} className="text-accent-300 hover:underline">{lessonById.get(m)?.title}</Link></span>)}. You can still study this lesson, or pass its mastery assessment to test out.
          </Callout>
        )}

        <Section title="Learning objectives"><ul className="ml-5 list-disc space-y-1 text-ink-200">{lesson.objectives.map((o) => <li key={o}>{o}</li>)}</ul></Section>
        <Section title="Why it matters"><p className="leading-relaxed text-ink-200">{lesson.why}</p></Section>
        <Section title="Explanation"><LessonBlocks blocks={lesson.explanation} /></Section>
        <Section title="On the guitar"><LessonBlocks blocks={lesson.guitar} /></Section>
        <Section title={`Practical exercise: ${lesson.exercise.title}`}>
          <ol className="ml-5 list-decimal space-y-1.5 text-ink-200">{lesson.exercise.steps.map((x) => <li key={x}>{x}</li>)}</ol>
          {exercise && (
            <div className="mt-4 rounded-xl border border-ink-700 bg-ink-850 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><div className="text-sm font-medium text-ink-50">{exercise.name}</div><div className="text-xs text-ink-400">{exercise.bpmStart}–{exercise.bpmTarget} bpm · {exercise.notesPerBeat} notes per beat</div></div>
                <Button size="sm" variant="primary" onClick={() => navigate(`/technique-lab?exercise=${exercise.id}`)}><LuZap size={14} /> Practise & log in Technique Lab</Button>
              </div>
              <TabView score={exercise.score} />
            </div>
          )}
        </Section>
        {lesson.metronome && (
          <Section title="Metronome challenge">
            <p className="mb-3 text-sm text-ink-200">{lesson.metronome.instructions} Start at <b>{lesson.metronome.bpmStart} bpm</b>; target <b>{lesson.metronome.bpmTarget} bpm</b>.</p>
            <MetronomeWidget bpm={lesson.metronome.bpmStart} subdivision={lesson.metronome.subdivision} />
          </Section>
        )}
        <Section title="Common mistakes"><ul className="ml-5 list-disc space-y-1 text-ink-200 marker:text-warn-500">{lesson.mistakes.map((m) => <li key={m}>{m}</li>)}</ul></Section>
        <Section title="Self-assessment">
          <ul className="space-y-1.5">{lesson.selfCheck.map((c) => {
            const on = p.checked?.includes(c);
            return <li key={c}><button type="button" onClick={() => toggleCheck(c)} className="flex items-start gap-2 text-left text-sm text-ink-200"><span className={cx('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border', on ? 'border-ok-500 bg-ok-500 text-ink-950' : 'border-ink-500')}>{on && <LuCheck size={12} />}</span>{c}</button></li>;
          })}</ul>
        </Section>
        <Section title="Quiz" id="quiz">
          {quiz === 'quiz' ? <Card><QuizRunner title="Lesson quiz" questions={lesson.quiz} onDone={(sc, missed) => onQuizDone('quiz', sc, missed, lesson.quiz.length)} /><div className="mt-4 flex justify-end"><Button size="sm" variant="ghost" onClick={() => setQuiz('none')}>Close</Button></div></Card>
            : <Button onClick={() => setQuiz('quiz')} data-testid="start-quiz">Take the {lesson.quiz.length}-question quiz{p.quizBest > 0 ? ` (best ${pct(p.quizBest)})` : ''}</Button>}
        </Section>
        <Section title="Real-world application"><p className="text-ink-200">{lesson.realWorld}</p></Section>
        <Section title="Summary"><ul className="ml-5 list-disc space-y-1 text-ink-200">{lesson.summary.map((x) => <li key={x}>{x}</li>)}</ul></Section>
        <Section title="Source basis"><SourceLine sources={lesson.sources as never} /></Section>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 pt-5">
          {statusAtLeast(p, 'completed') ? <Badge tone="ok"><LuCircleCheck size={12} /> Completed</Badge> : <Button variant="primary" onClick={markComplete} data-testid="mark-complete"><LuCheck size={16} /> Mark lesson complete</Button>}
          {next && <Link to={`/lessons/${next.id}`} className="inline-flex items-center gap-2 text-sm text-accent-300 hover:underline">Next: {next.title} <LuArrowRight size={16} /></Link>}
        </div>
      </article>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card title="Mastery" subtitle="Completion alone is not mastery: show understanding and, for skills, a measured result.">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">{mastery.quizMet ? <LuCircleCheck className="mt-0.5 shrink-0 text-ok-400" size={16} /> : <LuCircle className="mt-0.5 shrink-0 text-ink-500" size={16} />}<span className="text-ink-200">Mastery assessment ≥ {pct(lesson.mastery.quizPass)} <span className="text-ink-400">(best {pct(p.masteryBest)})</span></span></li>
            {lesson.mastery.practice && <li className="flex items-start gap-2">{mastery.practiceMet ? <LuCircleCheck className="mt-0.5 shrink-0 text-ok-400" size={16} /> : <LuCircle className="mt-0.5 shrink-0 text-ink-500" size={16} />}<span className="text-ink-200">Clean take of “{EXERCISES.find((e) => e.id === lesson.mastery.practice!.exerciseId)?.name}”{lesson.mastery.practice.bpm ? ` at ${lesson.mastery.practice.bpm} bpm` : ''}</span></li>}
          </ul>
          {selfChecks.length > 0 && (
            <div className="mt-4 border-t border-ink-700/60 pt-3">
              <div className="mb-1.5 text-xs font-medium text-ink-300">Self-check (not verified automatically)</div>
              <ul className="space-y-1.5 text-sm">{selfChecks.map((c) => <li key={c} className="flex items-start gap-2 text-ink-300"><LuTarget className="mt-0.5 shrink-0 text-ink-500" size={15} />{c}</li>)}</ul>
            </div>
          )}
          {p.status === 'mastered' ? <div className="mt-4"><Badge tone="warn"><LuStar size={12} /> Mastered</Badge></div> : (
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="primary" onClick={() => { setSeed(Date.now() % 100000); setQuiz('mastery'); }} data-testid="start-mastery">Take mastery assessment</Button>
              {lesson.mastery.practice && <Button size="sm" onClick={() => navigate(`/technique-lab?exercise=${lesson.mastery.practice!.exerciseId}`)}>Log practice result</Button>}
            </div>
          )}
        </Card>
        {lesson.prerequisites.length > 0 && (
          <Card title="Prerequisites">
            <ul className="space-y-1.5">{lesson.prerequisites.map((pid) => { const pl = lessonById.get(pid)!; return <li key={pid}><Link to={`/lessons/${pid}`} className="flex items-center gap-2 text-sm text-ink-200 hover:text-ink-50"><StatusIcon status={getProgress(s, pid).status} size={14} />{pl.title}</Link></li>; })}</ul>
          </Card>
        )}
      </aside>
      <Modal open={quiz === 'mastery'} onClose={() => setQuiz('none')} title={`Mastery assessment: ${lesson.title}`} wide>
        <QuizRunner key={seed} title={`Pass mark ${pct(lesson.mastery.quizPass)}`} questions={assessment} onDone={(sc, missed) => onQuizDone('mastery', sc, missed, assessment.length)} />
      </Modal>
    </div>
  );
}
