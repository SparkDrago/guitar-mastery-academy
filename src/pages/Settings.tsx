/** Settings (profile, instrument, data, account) and the /account auth landing page. */
import { useEffect, useState, type FormEvent } from 'react';
import { LuUser, LuCloud, LuCloudOff, LuDownload, LuUpload, LuTrash2, LuRefreshCw, LuLogOut, LuKeyRound, LuCircleCheck } from 'react-icons/lu';
import { CATEGORIES, type Category } from '@gma/learning';
import { useStore, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx, download, getConfig, readFile, relativeDay } from '@/lib/core';
import { navigate, useDocumentTitle, useLocation } from '@/lib/router';
import { setMasterVolume } from '@/lib/audio';
import { getMidiOutputs, getMidiSettings, initMidi, midiPanic, midiSupported, sendMidiTest, subscribeMidi, updateMidiSettings } from '@/lib/midi';
import { getAudioInputSettings, probeAsioBridge, subscribeAudioInput, updateAudioInputSettings, type BridgeApi, type BridgeDeviceInfo, type BrowserChannel, type InputMode } from '@/lib/asio';
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
        <AudioInputCard />
        <MidiOutputCard />
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

function AudioInputCard() {
  const [cfg, setCfg] = useState(() => getAudioInputSettings());
  const [browserDevices, setBrowserDevices] = useState<{ id: string; label: string }[]>([]);
  const [bridgeDevices, setBridgeDevices] = useState<BridgeDeviceInfo[]>([]);
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  useEffect(() => subscribeAudioInput(() => setCfg(getAudioInputSettings())), []);

  const refreshBrowserDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const inputs = list
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ id: d.deviceId, label: d.label || `Audio Input ${i + 1}` }));
      setBrowserDevices(inputs);
    } catch {
      // ignore
    }
  };

  useEffect(() => { void refreshBrowserDevices(); }, []);

  const checkBridge = async (url = cfg.bridgeUrl, api: BridgeApi = cfg.bridgeApi) => {
    setBridgeStatus('checking');
    setBridgeError(null);
    const r = await probeAsioBridge(url, api);
    if (r.ok) {
      setBridgeDevices(r.devices);
      setBridgeStatus('ok');
      if (cfg.bridgeDeviceId < 0 && r.devices.length) {
        const def = r.devices.find((d) => d.isDefaultInput) ?? r.devices[0];
        updateAudioInputSettings({ bridgeDeviceId: def.id });
      }
    } else {
      setBridgeDevices([]);
      setBridgeStatus('error');
      setBridgeError(r.error);
    }
  };

  useEffect(() => {
    if (cfg.mode === 'asio') void checkBridge(cfg.bridgeUrl, cfg.bridgeApi);
  }, [cfg.mode, cfg.bridgeApi]);

  const activeBridgeDevice = bridgeDevices.find((d) => d.id === cfg.bridgeDeviceId);
  const maxCh = Math.max(2, activeBridgeDevice?.inputChannels ?? 2);

  return (
    <Card title="Guitar Audio Input (Interface / ASIO)" subtitle="Choose your audio interface directly in the browser or connect to the local PC ASIO bridge.">
      <div className="space-y-4">
        <Field label="Input engine">
          <Segmented
            value={cfg.mode}
            onChange={(v) => updateAudioInputSettings({ mode: v as InputMode })}
            options={[
              { value: 'browser', label: 'Browser (WASAPI / CoreAudio)' },
              { value: 'asio', label: 'PC ASIO Bridge (Local)' },
            ]}
            aria-label="Audio input engine"
          />
        </Field>

        {cfg.mode === 'browser' ? (
          <>
            <Field label="Audio interface / microphone" hint="Grant mic permission once to see full device names.">
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    value={cfg.browserDeviceId}
                    onChange={(v) => updateAudioInputSettings({ browserDeviceId: v })}
                    aria-label="Browser audio input device"
                    options={[
                      { value: '', label: 'System default input' },
                      ...browserDevices.map((d) => ({ value: d.id, label: d.label })),
                    ]}
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => void refreshBrowserDevices()} aria-label="Refresh audio devices"><LuRefreshCw size={14} /></Button>
              </div>
            </Field>
            <Field label="Interface channel" hint="Focusrite Scarlett Solo & many 2-in interfaces put the guitar Hi-Z jack on Input 2.">
              <Segmented
                value={String(cfg.browserChannel)}
                onChange={(v) => updateAudioInputSettings({ browserChannel: (v === 'mix' ? 'mix' : Number(v)) as BrowserChannel })}
                options={[
                  { value: 'mix', label: 'Default / Mix' },
                  { value: '0', label: 'Input 1 (Left)' },
                  { value: '1', label: 'Input 2 (Right)' },
                ]}
                aria-label="Interface channel"
              />
            </Field>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-ink-300">Run <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-ink-100">npm start</code> inside <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-ink-100">asio-bridge/</code> on your PC.</span>
              <Badge tone={bridgeStatus === 'ok' ? 'ok' : bridgeStatus === 'error' ? 'warn' : 'neutral'}>
                {bridgeStatus === 'ok' ? `${bridgeDevices.length} device${bridgeDevices.length === 1 ? '' : 's'}` : bridgeStatus === 'checking' ? 'Connecting…' : bridgeStatus === 'error' ? 'Offline' : 'Not checked'}
              </Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bridge URL">
                <input className="input font-mono text-xs" value={cfg.bridgeUrl} onChange={(e) => updateAudioInputSettings({ bridgeUrl: e.target.value })} />
              </Field>
              <Field label="Driver API">
                <Segmented
                  value={cfg.bridgeApi}
                  onChange={(v) => updateAudioInputSettings({ bridgeApi: v as BridgeApi, bridgeDeviceId: -1 })}
                  options={[{ value: 'asio', label: 'ASIO' }, { value: 'wasapi', label: 'WASAPI' }]}
                  aria-label="Bridge driver API"
                />
              </Field>
            </div>
            <Field label="ASIO device">
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    value={String(cfg.bridgeDeviceId)}
                    onChange={(v) => updateAudioInputSettings({ bridgeDeviceId: Number(v) })}
                    aria-label="ASIO device"
                    options={bridgeDevices.length
                      ? bridgeDevices.map((d) => ({ value: String(d.id), label: `${d.name} (${d.inputChannels} in)` }))
                      : [{ value: '-1', label: 'No ASIO devices loaded' }]}
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => void checkBridge()} aria-label="Reconnect ASIO bridge"><LuRefreshCw size={14} /></Button>
              </div>
            </Field>
            <Field label="Guitar input channel (1-based)" hint="Select the physical jack your guitar is plugged into.">
              <Stepper value={cfg.bridgeChannel + 1} onChange={(v) => updateAudioInputSettings({ bridgeChannel: Math.max(0, v - 1) })} min={1} max={maxCh} label="ASIO channel" />
            </Field>
            {bridgeError && <p className="text-xs text-warn-400">{bridgeError}</p>}
          </>
        )}

        <Field label={`Input gain: ${Math.round(cfg.gain * 100)}%`} hint="Boost quiet DI pickups if the Tuner or Play mode misses notes.">
          <input type="range" min={25} max={400} step={5} value={Math.round(cfg.gain * 100)} onChange={(e) => updateAudioInputSettings({ gain: Number(e.target.value) / 100 })} aria-label="Input gain" className="w-full" />
        </Field>
      </div>
    </Card>
  );
}

function MidiOutputCard() {
  const supported = midiSupported();
  const [ms, setMs] = useState(() => getMidiSettings());
  const [ports, setPorts] = useState(() => getMidiOutputs());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => subscribeMidi(() => {
    setMs(getMidiSettings());
    setPorts(getMidiOutputs());
  }), []);

  const toggleEnabled = async (on: boolean) => {
    setErr(null);
    updateMidiSettings({ enabled: on });
    if (on) {
      const r = await initMidi();
      if (!r.ok) {
        setErr(r.error ?? 'Could not access MIDI devices.');
        updateMidiSettings({ enabled: false });
      }
    }
  };

  const refresh = async () => {
    setErr(null);
    const r = await initMidi();
    if (!r.ok) setErr(r.error ?? 'Could not refresh MIDI devices.');
  };

  return (
    <Card title="MIDI Output (Desktop VSTs)" subtitle="Route fretboard, exercises, scales, and tabs to your DAW or guitar VSTs.">
      {!supported ? (
        <Callout tone="warn" title="Web MIDI not available">
          Use Chrome, Edge, or Brave on desktop to send MIDI to your DAW or standalone guitar VST.
        </Callout>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Toggle checked={ms.enabled} onChange={(v) => void toggleEnabled(v)} label="Enable MIDI output" />
            {ms.enabled && (
              <Badge tone={ports.length ? 'ok' : 'warn'}>
                {ports.length ? `${ports.length} port${ports.length === 1 ? '' : 's'} found` : 'No MIDI ports'}
              </Badge>
            )}
          </div>
          {err && <p className="text-xs text-warn-400">{err}</p>}
          {ms.enabled && (
            <>
              <Field label="Output port" hint="Pick your virtual MIDI cable (loopMIDI on Windows, IAC Driver on macOS).">
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={ms.outputId}
                      onChange={(v) => updateMidiSettings({ outputId: v })}
                      aria-label="MIDI output port"
                      options={ports.length ? ports.map((p) => ({ value: p.id, label: p.name })) : [{ value: '', label: 'No MIDI outputs detected' }]}
                    />
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void refresh()} aria-label="Refresh MIDI ports"><LuRefreshCw size={14} /></Button>
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="MIDI channel">
                  <Stepper value={ms.channel} onChange={(v) => updateMidiSettings({ channel: v })} min={1} max={16} label="MIDI channel" />
                </Field>
                <Field label="Octave shift" hint="Adjust if your guitar VST sounds an octave too high or low.">
                  <Stepper value={ms.octaveShift} onChange={(v) => updateMidiSettings({ octaveShift: v })} min={-2} max={2} label="Octave shift" />
                </Field>
              </div>
              <Toggle checked={ms.muteSynth} onChange={(v) => updateMidiSettings({ muteSynth: v })} label="Mute built-in browser guitar synth when MIDI is active" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => { if (!sendMidiTest()) setErr('Select an active MIDI output port first.'); }}>Test chord</Button>
                <Button size="sm" variant="ghost" onClick={() => midiPanic()}>All notes off</Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
