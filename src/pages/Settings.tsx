/** Settings (profile, instrument, data, account) and the /account auth landing page. */
import { useEffect, useState, type FormEvent } from 'react';
import { LuUser, LuCloud, LuCloudOff, LuDownload, LuUpload, LuTrash2, LuRefreshCw, LuLogOut, LuKeyRound, LuCircleCheck } from 'react-icons/lu';
import { CATEGORIES, type Category } from '@gma/learning';
import { useStore, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx, download, getConfig, readFile, relativeDay } from '@/lib/core';
import { navigate, useDocumentTitle, useLocation } from '@/lib/router';
import { setMasterVolume } from '@/lib/audio';
import { Badge, Button, Callout, Card, Field, Modal, PageHeader, Segmented, Select, Stepper, Toggle } from '@/components/ui';
import { TuningPicker } from '@/components/widgets';
import { CustomTuningList } from '@/components/TuningEditor';
import { LEVELS } from '@content/curriculum';

const VOLUME_KEY = 'gma.volume';

export function SettingsPage() {
  useDocumentTitle('Settings');
  const s = useStudent();
  const p = s.profile;
  const [volume, setVolume] = useState(() => { try { return Number(localStorage.getItem(VOLUME_KEY) ?? 80); } catch { return 80; } });
  const [resetOpen, setResetOpen] = useState(false);
  const toggleGoal = (c: Category) => store.setProfile({ goals: p.goals.includes(c) ? p.goals.filter((g) => g !== c) : [...p.goals, c] });

  return (
    <div>
      <PageHeader eyebrow="You" title="Settings" />
      <div className="grid gap-5 lg:grid-cols-2">
        <AccountCard />
        <Card title="Profile">
          <div className="space-y-4">
            <Field label="Display name"><input className="input" value={p.displayName} onChange={(e) => store.setProfile({ displayName: e.target.value })} data-testid="settings-name" /></Field>
            <Field label="Starting level" hint="Lessons below this level count as satisfied prerequisites, so you can start where you are."><Select value={String(p.startLevel)} onChange={(v) => store.setProfile({ startLevel: Number(v) })} options={LEVELS.map((l) => ({ value: String(l.level), label: `Level ${l.level}: ${l.title}` }))} aria-label="Starting level" /></Field>
            <Field label="Daily practice target"><Segmented value={String(p.dailyMinutes)} onChange={(v) => store.setProfile({ dailyMinutes: Number(v) })} options={['15', '30', '45', '60', '90'].map((m) => ({ value: m, label: `${m} min` }))} aria-label="Daily minutes" /></Field>
            <Field label="Goals" hint="The practice scheduler weights these areas.">
              <div className="flex flex-wrap gap-1.5">{CATEGORIES.map((c) => <button key={c.id} type="button" onClick={() => toggleGoal(c.id)} aria-pressed={p.goals.includes(c.id)} className={cx('rounded-full border px-3 py-1 text-sm', p.goals.includes(c.id) ? 'border-accent-500 bg-accent-500/15 text-accent-300' : 'border-ink-600 text-ink-200 hover:border-ink-400')}>{c.name}</button>)}</div>
            </Field>
          </div>
        </Card>
        <Card title="Instrument">
          <div className="space-y-4">
            <Field label="Default tuning" hint="Used by the tuner, fretboard, scales, chords, trainer and tab editor."><TuningPicker value={p.tuningId} onChange={(id) => store.setProfile({ tuningId: id })} testId="settings-tuning" /></Field>
            <Field label="Strings on your main guitar"><Segmented value={String(p.strings) as '6' | '7' | '8'} onChange={(v) => store.setProfile({ strings: Number(v) as 6 | 7 | 8 })} options={[{ value: '6', label: '6-string' }, { value: '7', label: '7-string' }, { value: '8', label: '8-string' }]} aria-label="Strings" /></Field>
            <div className="flex flex-wrap gap-6">
              <Toggle checked={p.leftHanded} onChange={(v) => store.setProfile({ leftHanded: v })} label="Left-handed fretboards" />
              <Toggle checked={p.noteNames === 'flats'} onChange={(v) => store.setProfile({ noteNames: v ? 'flats' : 'sharps' })} label="Prefer flat names (B♭ not A♯)" />
            </div>
            <Field label="Reference pitch (A4)"><Stepper value={p.a4} onChange={(v) => store.setProfile({ a4: v })} min={415} max={466} suffix="Hz" label="A4 reference" /></Field>
            <Field label="App volume"><input type="range" min={0} max={100} value={volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); setMasterVolume(v / 100); try { localStorage.setItem(VOLUME_KEY, String(v)); } catch { /* not persisted */ } }} aria-label="Volume" className="w-full" /></Field>
          </div>
        </Card>
        <Card title="Custom tunings"><CustomTuningList /></Card>
        <Card title="Your data" subtitle={store.getSnapshot().persistent ? 'Saved in this browser and, when signed in, in your account.' : 'This browser blocks storage: progress lasts only for this visit unless you sign in.'}>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => download(`guitar-mastery-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportBackup(), 'application/json')} data-testid="settings-export"><LuDownload size={14} /> Export backup</Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3.5 py-2 text-sm text-ink-100 hover:border-ink-400">
              <LuUpload size={14} /> Import backup
              <input type="file" accept=".json" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = store.importBackup(await readFile(f));
                store.toast(r.ok ? 'Backup restored' : 'Import failed', r.ok ? 'Your progress has been replaced with the backup.' : r.error, r.ok ? 'success' : 'warning');
                e.target.value = '';
              }} data-testid="settings-import" />
            </label>
            <Button variant="danger" onClick={() => setResetOpen(true)}><LuTrash2 size={14} /> Reset progress</Button>
          </div>
          <p className="mt-3 text-xs text-ink-400">Backups are plain JSON containing your profile, progress, practice history, custom tunings and exercises.</p>
        </Card>
        <Card title="About">
          <p className="text-sm text-ink-300">Guitar Mastery Academy · version {getConfig().version}. The curriculum is original teaching material organised around four guitar method books (see each lesson's source line) plus clearly marked supplementary material. All audio is synthesised in your browser; microphone audio never leaves your device.</p>
        </Card>
      </div>
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset all progress?">
        <p className="text-sm text-ink-300">This clears lesson progress, practice history, trainer results, custom tunings and exercises stored in this browser. {store.getSnapshot().auth.session ? 'Your account copy is not deleted; it will sync back on next sign-in.' : 'Export a backup first if you might want it back.'}</p>
        <div className="mt-4 flex justify-end gap-2"><Button onClick={() => setResetOpen(false)}>Cancel</Button><Button variant="danger" onClick={() => { store.resetLocalData(); setResetOpen(false); navigate('/'); }}>Reset</Button></div>
      </Modal>
    </div>
  );
}

function AccountCard() {
  const snap = useStore();
  const { auth } = snap;
  const [ping, setPing] = useState<{ ok: boolean; message: string } | null>(null);
  if (!auth.configured) return (
    <Card title={<span className="flex items-center gap-2"><LuCloudOff size={16} /> Account & sync</span>}>
      <p className="text-sm text-ink-300">Accounts are not enabled on this deployment yet, so your progress is stored in this browser only. Use <b>Export backup</b> to move it between devices.</p>
      <p className="mt-2 text-xs text-ink-400">Administrators: set GMA_SUPABASE_URL and GMA_SUPABASE_ANON_KEY at build time (see docs/backend.md).</p>
    </Card>
  );
  if (!auth.session) return (
    <Card title={<span className="flex items-center gap-2"><LuUser size={16} /> Account & sync</span>} subtitle="Sign in to keep your progress in sync across devices.">
      <AuthForms />
    </Card>
  );
  return (
    <Card title={<span className="flex items-center gap-2"><LuCloud size={16} /> Account & sync</span>} action={<Badge tone={auth.error ? 'warn' : auth.pending ? 'neutral' : 'ok'}>{auth.syncing ? 'Syncing…' : auth.error ? 'Sync error' : auth.pending ? `${auth.pending} pending` : 'Up to date'}</Badge>} data-testid="account-card">
      <p className="text-sm text-ink-200">Signed in as <b>{auth.session.user.email}</b></p>
      <p className="mt-1 text-xs text-ink-400">Last sync: {auth.lastSyncAt ? relativeDay(auth.lastSyncAt) + ' at ' + new Date(auth.lastSyncAt).toLocaleTimeString() : 'not yet'}</p>
      {auth.error && <Callout tone="warn" title="Sync problem">{auth.error} Changes are kept on this device and retried automatically.</Callout>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void store.syncNow()} disabled={auth.syncing}><LuRefreshCw size={14} /> Sync now</Button>
        <Button onClick={async () => setPing(await store.client!.ping())}>Test connection</Button>
        <ChangePassword />
        <Button variant="ghost" onClick={() => void store.signOut()}><LuLogOut size={14} /> Sign out</Button>
      </div>
      {ping && <p className={cx('mt-2 text-xs', ping.ok ? 'text-ok-400' : 'text-warn-400')}>{ping.message}</p>}
    </Card>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <Button onClick={() => { setOpen(true); setMsg(null); setPw(''); }}><LuKeyRound size={14} /> Change password</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Change password">
        <form onSubmit={async (e) => { e.preventDefault(); try { await store.updatePassword(pw); setMsg('Password updated.'); } catch (err) { setMsg((err as Error).message); } }} className="space-y-3">
          <Field label="New password" hint="At least 8 characters"><input className="input" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
          {msg && <p className="text-sm text-ink-200">{msg}</p>}
          <div className="flex justify-end"><Button type="submit" variant="primary">Update</Button></div>
        </form>
      </Modal>
    </>
  );
}

function AuthForms({ initial = 'signin' }: { initial?: 'signin' | 'signup' | 'reset' }) {
  const [tab, setTab] = useState<'signin' | 'signup' | 'reset'>(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (tab === 'signin') { await store.signIn(email, password); setMsg({ ok: true, text: 'Signed in.' }); }
      else if (tab === 'signup') {
        const r = await store.signUp(email, password, name || 'Guitarist');
        setMsg({ ok: true, text: r.needsConfirmation ? 'Check your email to confirm your account, then sign in.' : 'Account created and signed in.' });
      } else { await store.requestReset(email); setMsg({ ok: true, text: 'If an account exists for that address, a reset link is on its way.' }); }
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message || 'Something went wrong.' });
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3" data-testid="auth-form">
      <Segmented value={tab} onChange={(v) => { setTab(v); setMsg(null); }} size="sm" options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }, { value: 'reset', label: 'Forgot password' }]} aria-label="Account action" />
      {tab === 'signup' && <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>}
      <Field label="Email"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" data-testid="auth-email" /></Field>
      {tab !== 'reset' && <Field label="Password" hint={tab === 'signup' ? 'At least 8 characters' : undefined}><input className="input" type="password" required minLength={tab === 'signup' ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === 'signup' ? 'new-password' : 'current-password'} data-testid="auth-password" /></Field>}
      {msg && <p className={cx('text-sm', msg.ok ? 'text-ok-400' : 'text-warn-400')} role="status">{msg.text}</p>}
      <Button type="submit" variant="primary" disabled={busy} data-testid="auth-submit">{busy ? 'Please wait…' : tab === 'signin' ? 'Sign in' : tab === 'signup' ? 'Create account' : 'Send reset link'}</Button>
      {tab === 'signup' && <p className="text-xs text-ink-400">Progress you have made on this device as a guest is moved into the new account on first sign-in.</p>}
    </form>
  );
}

/** Landing page for email links (confirmation, recovery) and a standalone sign-in screen. */
export function AccountPage() {
  useDocumentTitle('Account');
  const snap = useStore();
  const { query } = useLocation();
  const [status, setStatus] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [recovery, setRecovery] = useState(query.get('reset') === '1');
  const [done, setDone] = useState(false);
  useEffect(() => {
    void store.handleAuthRedirect().then((r) => {
      if (!r) return;
      if (r.startsWith('error:')) setStatus(r.slice(6));
      else if (r === 'recovery') { setRecovery(true); setStatus('Choose a new password.'); }
      else setStatus('Your email is confirmed and you are signed in.');
    });
  }, []);
  if (!snap.auth.configured) return <div><PageHeader title="Account" /><Callout tone="info">Accounts are not enabled on this deployment.</Callout></div>;
  return (
    <div className="mx-auto max-w-md">
      <PageHeader eyebrow="Account" title={recovery ? 'Reset password' : snap.auth.session ? 'You are signed in' : 'Sign in'} />
      {status && <Callout tone={status.toLowerCase().includes('error') || status.toLowerCase().includes('expired') || status.toLowerCase().includes('invalid') ? 'warn' : 'ok'}>{status}</Callout>}
      <Card>
        {recovery && snap.auth.session ? (
          done ? <p className="flex items-center gap-2 text-sm text-ok-400"><LuCircleCheck size={16} /> Password updated. <Button size="sm" onClick={() => navigate('/')}>Continue</Button></p> : (
            <form onSubmit={async (e) => { e.preventDefault(); try { await store.updatePassword(pw); setDone(true); } catch (err) { setStatus((err as Error).message); } }} className="space-y-3">
              <Field label="New password" hint="At least 8 characters"><input className="input" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
              <Button type="submit" variant="primary">Save new password</Button>
            </form>
          )
        ) : snap.auth.session ? (
          <div className="space-y-3"><p className="text-sm text-ink-200">Signed in as <b>{snap.auth.session.user.email}</b>.</p><div className="flex gap-2"><Button variant="primary" onClick={() => navigate('/')}>Go to dashboard</Button><Button onClick={() => navigate('/settings')}>Settings</Button></div></div>
        ) : recovery ? (
          <><p className="mb-3 text-sm text-ink-300">Open the reset link from your email on this device to choose a new password, or request a new link.</p><AuthForms initial="reset" /></>
        ) : <AuthForms />}
      </Card>
    </div>
  );
}
