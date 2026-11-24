/** Route table. Pages are plain components so they can move to Next.js app/ routes one-to-one. */
import type { ReactNode } from 'react';
import { matchPath, useLocation, Link } from '@/lib/router';
import { Layout } from '@/components/Layout';
import { ErrorBoundary, Toasts } from '@/components/ui';
import { LessonPage, LessonsPage, Onboarding, PathPage } from '@/pages/Learn';
import { DashboardPage } from '@/pages/Dashboard';
import { TunerPage } from '@/pages/Tuner';
import { ChordsPage, FretboardPage, MetronomePage } from '@/pages/Tools';
import { ScalesPage } from '@/pages/Scales';
import { PracticePage, TechniqueLabPage } from '@/pages/Practice';
import { EarTrainingPage, FretboardTrainerPage } from '@/pages/Train';
import { TabEditorPage } from '@/pages/TabEditor';
import { AnalyzerPage } from '@/pages/Analyzer';
import { ImprovisationPage, JamPage } from '@/pages/Jam';
import { ProgressPage } from '@/pages/Progress';
import { AccountPage, SettingsPage } from '@/pages/Settings';
import { TheoryPage } from '@/pages/Theory';

const ROUTES: { path: string; render: (params: Record<string, string>) => ReactNode; label: string }[] = [
  { path: '/', render: () => <DashboardPage />, label: 'Dashboard' },
  { path: '/path', render: () => <PathPage />, label: 'Learning Path' },
  { path: '/lessons', render: () => <LessonsPage />, label: 'Lessons' },
  { path: '/lessons/:id', render: (p) => <LessonPage key={p.id} id={p.id} />, label: 'Lesson' },
  { path: '/theory', render: () => <TheoryPage />, label: 'Theory Academy' },
  { path: '/tuner', render: () => <TunerPage />, label: 'Tuner' },
  { path: '/metronome', render: () => <MetronomePage />, label: 'Metronome' },
  { path: '/fretboard', render: () => <FretboardPage />, label: 'Fretboard' },
  { path: '/scales', render: () => <ScalesPage />, label: 'Scales' },
  { path: '/chords', render: () => <ChordsPage />, label: 'Chords' },
  { path: '/practice', render: () => <PracticePage />, label: 'Practice Studio' },
  { path: '/technique-lab', render: () => <TechniqueLabPage />, label: 'Technique Lab' },
  { path: '/fretboard-trainer', render: () => <FretboardTrainerPage />, label: 'Fretboard Trainer' },
  { path: '/ear-training', render: () => <EarTrainingPage />, label: 'Ear Training' },
  { path: '/analyzer', render: () => <AnalyzerPage />, label: 'Playing Analyzer' },
  { path: '/tab-editor', render: () => <TabEditorPage />, label: 'Tab Editor' },
  { path: '/improvisation', render: () => <ImprovisationPage />, label: 'Improvisation' },
  { path: '/jam', render: () => <JamPage />, label: 'Jam Room' },
  { path: '/progress', render: () => <ProgressPage />, label: 'Progress' },
  { path: '/settings', render: () => <SettingsPage />, label: 'Settings' },
  { path: '/account', render: () => <AccountPage />, label: 'Account' },
];

function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold text-ink-50">Page not found</h1>
      <p className="mt-2 text-ink-300">That address does not match any page in the academy.</p>
      <Link to="/" className="mt-5 inline-block rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-400">Go to the dashboard</Link>
    </div>
  );
}

export function App() {
  const { path } = useLocation();
  let page: ReactNode = <NotFound />;
  let label = 'page';
  for (const r of ROUTES) {
    const params = matchPath(r.path, path);
    if (params) { page = r.render(params); label = r.label; break; }
  }
  return (
    <Layout>
      <ErrorBoundary key={path} label={label}>{page}</ErrorBoundary>
      {path !== '/account' && <Onboarding />}
      <Toasts />
    </Layout>
  );
}
