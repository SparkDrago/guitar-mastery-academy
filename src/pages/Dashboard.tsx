/** Dashboard: everything on it is computed from the student's own activity. */
import { useMemo, type ReactNode } from 'react';
import { LuArrowRight, LuCalendar, LuTarget, LuTrendingUp, LuTrendingDown, LuFlame, LuTrophy } from 'react-icons/lu';
import {
  ACHIEVEMENTS, CATEGORIES, bpmProgress, buildRoutine, currentLevel, dailyRecommendations, getProgress, levelSummaries, nextLessons, statusAtLeast, streak,
  type Category,
} from '@gma/learning';
import { pcName, tuningLabel } from '@gma/theory';
import { LESSONS } from '@content/lessons/index';
import { LEVELS, MODULES } from '@content/curriculum';
import { EXERCISES } from '@content/exercises';
import { useActiveTuning, useAllExercises, useStudent } from '@/lib/hooks';
import { cx, fmtMinutes } from '@/lib/core';
import { Link, navigate, useDocumentTitle } from '@/lib/router';
import { Badge, Button, Card } from '@/components/ui';
import { AreaChart, Ring, TrackBars, VIZ } from '@/components/charts';
import { StatusIcon } from './Learn';

const DAY = 864e5;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Accuracy over the last `n` attempts, and the change made by today's attempts. */
function accuracyStats(attempts: { correct: boolean; at: string }[], now: Date, n = 50) {
  const recent = attempts.slice(-n);
  const acc = recent.length ? recent.filter((a) => a.correct).length / recent.length : null;
  const today = dayKey(now);
  const before = attempts.filter((a) => dayKey(new Date(a.at)) !== today).slice(-n);
  const accBefore = before.length ? before.filter((a) => a.correct).length / before.length : null;
  const todayCount = attempts.filter((a) => dayKey(new Date(a.at)) === today).length;
  return { acc, delta: acc !== null && accBefore !== null && todayCount ? acc - accBefore : null, todayCount, total: attempts.length };
}

export function DashboardPage() {
  useDocumentTitle('');
  const s = useStudent();
  const tuning = useActiveTuning();
  const exercises = useAllExercises();
  const now = useMemo(() => new Date(), [s]);
  const level = currentLevel(LESSONS, s);
  const levelInfo = LEVELS.find((l) => l.level === level)!;
  const sum = levelSummaries(LESSONS, s).find((x) => x.level === level);
  const levelPct = sum && sum.total ? sum.completed / sum.total : 0;
  const st = streak(s, now);
  const next = nextLessons(LESSONS, s, 3);
  const recs = dailyRecommendations(s, LESSONS, EXERCISES, now);
  const totalMinutes = s.sessions.reduce((a, x) => a + x.actualMinutes, 0);
  const hour = now.getHours();

  // Skill levels: share of the curriculum's lessons in each area the student has completed.
  const skillAreas: Category[] = useMemo(() => {
    const goals = s.profile.goals.filter((g) => LESSONS.some((l) => l.categories.includes(g)));
    return [...new Set([...goals, 'technique', 'theory', 'fretboard', 'improvisation'] as Category[])].slice(0, 4);
  }, [s.profile.goals]);
  const skills = skillAreas.map((c) => {
    const ls = LESSONS.filter((l) => l.categories.includes(c));
    const done = ls.filter((l) => statusAtLeast(s.lessons[l.id], 'completed')).length;
    return { id: c, name: CATEGORIES.find((x) => x.id === c)!.name, value: ls.length ? done / ls.length : 0, detail: `${done} of ${ls.length} lessons` };
  });

  const fb = accuracyStats(s.trainer, now);
  const ear = accuracyStats(s.ear, now);
  const tempo = useMemo(() => {
    const rows = exercises.map((e) => ({ e, p: bpmProgress(s.exerciseRecords, e.id) })).filter((r) => r.p && r.p.bestCleanBpm > 0);
    const value = rows.length ? rows.reduce((a, r) => a + Math.min(1, r.p!.bestCleanBpm / r.e.bpmTarget), 0) / rows.length : null;
    const today = s.exerciseRecords.filter((r) => dayKey(new Date(r.at)) === dayKey(now));
    return { value, exercises: rows.length, todayTakes: today.length, todayClean: today.filter((r) => r.clean).length };
  }, [exercises, s.exerciseRecords, now]);

  // Today's tasks: the session started today if there is one, otherwise today's suggested routine.
  const todaySession = [...s.sessions].reverse().find((x) => dayKey(new Date(x.startedAt)) === dayKey(now));
  const planned = useMemo(() => (todaySession ? null : buildRoutine({ state: s, lessons: LESSONS, exercises, minutes: s.profile.dailyMinutes, now, seed: Number(dayKey(now).replace(/-/g, '')) % 100000 })), [todaySession, s, exercises, now]);
  const tasks = todaySession
    ? todaySession.blocks.map((b, i) => ({ title: b.title, state: b.completed ? 'done' : todaySession.endedAt ? 'skipped' : i === todaySession.blocks.findIndex((x) => !x.completed) ? 'in progress' : 'to do' }))
    : planned!.blocks.map((b) => ({ title: b.title, state: 'to do' }));
  const doneShare = tasks.length ? tasks.filter((t) => t.state === 'done').length / tasks.length : 0;

  // Intensity: practice minutes per day over the last 7 days.
  const week = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(now.getTime() - (6 - k) * DAY);
    const key = dayKey(d);
    const mins = s.sessions.filter((x) => dayKey(new Date(x.startedAt)) === key).reduce((a, x) => a + x.actualMinutes, 0);
    return { label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2), value: Math.round(mins), detail: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
  });

  // Progress: weekly practice minutes over the last 12 weeks.
  const weeks = Array.from({ length: 12 }, (_, k) => {
    const end = new Date(now.getTime() - (11 - k) * 7 * DAY);
    const start = new Date(end.getTime() - 7 * DAY);
    const mins = s.sessions.filter((x) => { const t = new Date(x.startedAt).getTime(); return t > start.getTime() && t <= end.getTime(); }).reduce((a, x) => a + x.actualMinutes, 0);
    return { label: end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: Math.round(mins), detail: 'week ending' };
  });
  const recentAch = Object.values(s.achievements).sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt)).slice(0, 3);

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-medium text-accent-300">Level {level} · {levelInfo.title}</div>
          <h1 className="text-[26px] font-semibold leading-tight text-ink-50 sm:text-[30px]">{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, {s.profile.displayName}</h1>
        </div>
        <Button variant="primary" size="lg" onClick={() => navigate('/practice')} data-testid="start-practice"><LuCalendar size={18} /> Today's practice</Button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* Profile and level ring */}
        <Card className="md:row-span-2" data-testid="dash-level">
          <div className="text-[19px] font-semibold text-ink-50">{s.profile.displayName}</div>
          <div className="mt-0.5 text-xs text-ink-400">{totalMinutes ? `${fmtMinutes(totalMinutes)} practised` : 'No practice logged yet'} · streak {st.current} day{st.current === 1 ? '' : 's'}</div>
          <div className="mt-6 flex items-center justify-between text-sm">
            <span className="font-medium text-ink-100">{levelInfo.title}</span>
            <span className="text-xs font-medium text-ok-400">{sum?.completed ?? 0}/{sum?.total ?? 0} lessons</span>
          </div>
          <div className="mt-6 flex justify-center">
            <Ring value={levelPct} label={`Level ${level} completion`} size={200} stroke={14}>
              <div>
                <div className="text-[44px] font-semibold leading-none tabular-nums text-ink-50">{level}<span className="ml-1 text-2xl font-medium text-ink-300">lvl</span></div>
                <div className="mt-2 text-xs text-ink-400">{Math.round(levelPct * 100)}% complete</div>
              </div>
            </Ring>
          </div>
          <p className="mt-6 text-center text-xs text-ok-400">
            {sum && sum.total - sum.completed > 0 ? `${sum.total - sum.completed} lesson${sum.total - sum.completed > 1 ? 's' : ''} to finish Level ${level}` : level < 12 ? `Level ${level} complete: Level ${level + 1} is open` : 'Final level complete'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-5 text-xs text-ink-300">
            <span className="inline-flex items-center gap-1.5"><LuFlame size={14} className={st.current ? 'text-warn-400' : 'text-ink-500'} /> Best streak {st.best}</span>
            <span className="inline-flex items-center gap-1.5"><LuTrophy size={14} className="text-warn-400" /> {Object.keys(s.achievements).length} awards</span>
          </div>
        </Card>

        {/* Instrument */}
        <Card title="Your guitar" subtitle={`${tuning.strings.length}-string · ${tuning.name}`} action={<Link to="/settings" className="text-xs text-ink-400 hover:text-ink-50">Change</Link>}>
          <GuitarArt strings={tuning.strings.length} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...tuning.strings].reverse().map((m, i) => <span key={i} className="rounded-lg bg-ink-800 px-2 py-1 font-mono text-[11px] text-ink-200">{pcName(m % 12, s.profile.noteNames === 'flats')}{Math.floor(m / 12) - 1}</span>)}
          </div>
          <Link to="/tuner" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent-300 hover:underline">Tune up <LuArrowRight size={12} /></Link>
        </Card>

        <Card title="Setup">
          <dl className="space-y-3.5 text-sm">
            <Row k="Tuning" v={<span className="font-mono text-[13px]">{tuningLabel(tuning, s.profile.noteNames === 'flats')}</span>} />
            <Row k="Strings" v={String(tuning.strings.length)} />
            <Row k="Reference" v={`A4 = ${s.profile.a4} Hz`} />
            <Row k="Hand" v={s.profile.leftHanded ? 'Left-handed' : 'Right-handed'} />
            <Row k="Daily goal" v={`${s.profile.dailyMinutes} min`} />
          </dl>
        </Card>

        <Card title="Skill levels" subtitle="Lessons completed per area">
          <ul className="space-y-3.5" data-testid="dash-skills">
            {skills.map((k) => (
              <li key={k.id} title={k.detail}>
                <div className="mb-1.5 flex justify-between text-sm"><span className="text-ink-100">{k.name}</span><span className="tabular-nums text-ink-200">{Math.round(k.value * 100)}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-950"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${k.value * 100}%`, background: VIZ[0] }} /></div>
              </li>
            ))}
          </ul>
        </Card>

        <RingCard title="Fretboard" subtitle="Trainer accuracy" value={fb.acc} color={VIZ[1]} delta={fb.delta} today={fb.todayCount ? `${fb.todayCount} answer${fb.todayCount === 1 ? '' : 's'}` : null} foot={fb.total ? `last 50 of ${fb.total} answers` : "no answers yet"} to="/fretboard-trainer" />
        <RingCard title="Ear" subtitle="Ear-training accuracy" value={ear.acc} color={VIZ[2]} delta={ear.delta} today={ear.todayCount ? `${ear.todayCount} answer${ear.todayCount === 1 ? '' : 's'}` : null} foot={ear.total ? `last 50 of ${ear.total} answers` : "no answers yet"} to="/ear-training" />
        <RingCard title="Tempo" subtitle="Clean tempo vs target" value={tempo.value} color={VIZ[3]} delta={null} today={tempo.todayTakes ? `${tempo.todayClean}/${tempo.todayTakes} clean takes` : null} foot={`${tempo.exercises} exercise${tempo.exercises === 1 ? '' : 's'} measured`} to="/technique-lab" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <Card title="Today" subtitle={todaySession ? todaySession.routineName : `Suggested ${s.profile.dailyMinutes}-minute routine`} data-testid="dash-today">
          <ul className="max-h-[220px] space-y-3 overflow-y-auto pr-1">
            {tasks.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-ink-100">{t.title}</span>
                <Badge solid tone={t.state === 'done' ? 'ok' : t.state === 'in progress' ? 'accent' : 'neutral'}>{t.state}</Badge>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between text-xs"><span className="text-ink-400">Tasks completed</span><span className="font-medium text-ok-400">{Math.round(doneShare * 100)}%</span></div>
        </Card>

        <Card title="Intensity" subtitle="Practice minutes, last 7 days">
          <TrackBars data={week} unit=" min" title="Practice minutes per day" height={180} />
        </Card>

        <Card title="Progress" subtitle="Weekly practice minutes, last 12 weeks" className="lg:col-span-2" data-testid="dash-progress">
          {weeks.some((w) => w.value > 0)
            ? <AreaChart data={weeks} unit=" min" title="Weekly practice minutes" height={210} />
            : <div className="grid h-[210px] place-items-center text-center text-sm text-ink-400"><div>Your weekly practice curve appears here after your first session.<div className="mt-3"><Button size="sm" onClick={() => navigate('/practice')}>Start a session</Button></div></div></div>}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Continue learning" action={<Link to="/path" className="text-xs font-medium text-accent-300 hover:underline">Full path</Link>}>
          {next.length === 0 ? <p className="text-sm text-ink-300">All available lessons are complete. Review mastered concepts or practise in the tools.</p> : (
            <ul className="space-y-2.5">
              {next.map((l, i) => (
                <li key={l.id}>
                  <Link to={`/lessons/${l.id}`} className={cx('flex items-center gap-3 rounded-xl px-4 py-3 transition-colors', i === 0 ? 'bg-accent-500/12 ring-1 ring-accent-500/40' : 'bg-ink-800 hover:bg-ink-700')} data-testid={i === 0 ? 'next-lesson' : undefined}>
                    <StatusIcon status={getProgress(s, l.id).status} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink-50">{l.title}</div>
                      <div className="text-xs text-ink-400">Level {l.level} · {MODULES.find((m) => m.id === l.module)?.title} · {l.minutes} min</div>
                    </div>
                    <LuArrowRight size={16} className="text-ink-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recommended for you" subtitle="From your lessons, practice records and trainer results">
          <ul className="space-y-1" data-testid="recommendations">
            {recs.map((r) => (
              <li key={r.id}>
                <Link to={r.route} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-ink-800">
                  <LuTarget size={16} className="mt-0.5 shrink-0 text-accent-300" />
                  <div><div className="text-sm font-medium text-ink-100">{r.title}</div><div className="text-xs text-ink-400">{r.detail}</div></div>
                </Link>
              </li>
            ))}
          </ul>
          {recentAch.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-ink-700/60 pt-4">
              {recentAch.map((a) => { const d = ACHIEVEMENTS.find((x) => x.id === a.id); return d ? <Badge key={a.id} tone="warn"><LuTrophy size={11} /> {d.title}</Badge> : null; })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-ink-300">{k}</dt><dd className="text-right text-ink-100">{v}</dd></div>;
}

function RingCard({ title, subtitle, value, color, delta, today, foot, to }: { title: string; subtitle: string; value: number | null; color: string; delta: number | null; today: string | null; foot: string; to: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold text-ink-50">{title}</h2>
          <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>
          <div className="mt-5 text-sm font-medium text-ink-100">Today:</div>
          {today ? (
            <div className="mt-0.5 text-xs">
              {delta !== null && Math.abs(delta) >= 0.005
                ? <span className={cx('inline-flex items-center gap-1 font-medium', delta > 0 ? 'text-ok-400' : 'text-bad-400')}>{delta > 0 ? <LuTrendingUp size={13} /> : <LuTrendingDown size={13} />}{delta > 0 ? '+' : ''}{Math.round(delta * 100)}%</span>
                : null}
              <div className="text-ink-300">{today}</div>
            </div>
          ) : <div className="mt-0.5 text-xs text-ink-400">nothing yet · <Link to={to} className="text-accent-300 hover:underline">start</Link></div>}
          <div className="mt-2 text-[11px] text-ink-400">{foot}</div>
        </div>
        <Ring value={value ?? 0} label={`${title}: ${subtitle}`} color={color} size={96} stroke={9}>
          <span className="text-[20px] font-semibold tabular-nums text-ink-50">{value === null ? '—' : `${Math.round(value * 100)}%`}</span>
        </Ring>
      </div>
    </Card>
  );
}

/** Original stylised electric guitar (generic double-cut body) over sound-wave rings. */
function GuitarArt({ strings }: { strings: number }) {
  const tuners = Math.max(4, Math.min(9, strings));
  return (
    <svg viewBox="14 8 282 114" className="w-full" role="img" aria-label={`Illustration of a ${strings}-string electric guitar`}>
      <defs>
        <linearGradient id="gbody" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#8466f5" /><stop offset="1" stopColor="#e0567f" /></linearGradient>
        <linearGradient id="gneck" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#c9935a" /><stop offset="1" stopColor="#9c6a3a" /></linearGradient>
      </defs>
      {[28, 44, 60].map((r) => <circle key={r} cx="78" cy="65" r={r} fill="none" className="svg-ring" stroke="#40386f" strokeWidth="9" opacity={0.55 - r / 200} />)}
      {/* body */}
      <path d="M38 40 C 30 22, 58 16, 70 30 C 78 38, 92 38, 102 34 C 116 28, 126 40, 116 52 C 110 60, 110 70, 116 78 C 126 92, 112 104, 98 96 C 88 90, 76 92, 68 100 C 54 114, 26 108, 30 88 C 32 78, 28 74, 24 66 C 18 54, 30 48, 38 40 Z" fill="url(#gbody)" />
      <path d="M44 52 C 52 46, 62 50, 66 56 L 60 80 C 52 84, 42 80, 40 72 Z" fill="#1d1839" opacity="0.35" />
      {/* pickups and bridge */}
      <rect x="54" y="54" width="9" height="22" rx="2.5" fill="#1d1839" />
      <rect x="74" y="54" width="9" height="22" rx="2.5" fill="#1d1839" />
      <rect x="42" y="56" width="6" height="18" rx="1.5" fill="#e7e4f6" opacity="0.85" />
      {/* knobs */}
      {[[92, 82], [102, 76], [100, 88]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3.4" fill="#efedfb" opacity="0.9" />)}
      {/* neck and frets */}
      <rect x="108" y="58.5" width="140" height="13" rx="2" fill="url(#gneck)" />
      {Array.from({ length: 16 }, (_, i) => 112 + i * 8.2 - i * i * 0.12).map((x) => <line key={x} x1={x} x2={x} y1="58.5" y2="71.5" stroke="#e7e4f6" strokeWidth="0.8" opacity="0.8" />)}
      {[3, 5, 7, 9].map((f) => <circle key={f} cx={112 + (f - 0.5) * 8.2 - (f - 0.5) * (f - 0.5) * 0.12} cy="65" r="1.3" fill="#efedfb" opacity="0.8" />)}
      {/* headstock with one tuner per string */}
      <path d="M246 56 L 282 50 C 290 49, 292 54, 290 58 L 286 74 C 285 78, 280 80, 276 79 L 246 74 Z" fill="#2b2452" />
      {Array.from({ length: tuners }, (_, i) => <circle key={i} cx={252 + i * (32 / tuners)} cy={i % 2 ? 77 : 53} r="2.6" fill="#cbc7e7" />)}
      {/* strings */}
      {Array.from({ length: Math.min(strings, 8) }, (_, i) => <line key={i} x1="44" x2="280" y1={60.5 + i * (9 / Math.max(1, Math.min(strings, 8) - 1))} y2={56 + i * (18 / Math.max(1, Math.min(strings, 8) - 1))} stroke="#f5f2ec" strokeWidth="0.45" opacity="0.8" />)}
    </svg>
  );
}
