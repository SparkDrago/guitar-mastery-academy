/** Create, edit, rename and delete custom tunings (any string count from 4 to 9). */
import { useState } from 'react';
import { LuPlus, LuTrash2, LuPen, LuCopy } from 'react-icons/lu';
import { CUSTOM_TEMPLATES, MAX_STRINGS, MIN_STRINGS, midiName, parsePitch, validateTuning, tuningLabel, type Tuning } from '@gma/theory';
import type { CustomTuning } from '@gma/learning';
import { store } from '@/lib/store';
import { useActiveTuning, useStudent } from '@/lib/hooks';
import { nowIso, uid } from '@/lib/core';
import { Button, Callout, Empty, Field, Modal } from './ui';

export function TuningEditorModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: CustomTuning | null }) {
  const active = useActiveTuning();
  const [name, setName] = useState(editing?.name ?? '');
  const [pitches, setPitches] = useState<string[]>(() => (editing ?? active).strings.map((m) => midiName(m)));
  const [errors, setErrors] = useState<string[]>([]);
  const reset = (t: Tuning) => setPitches(t.strings.map((m) => midiName(m)));

  const save = () => {
    const strings = pitches.map((p) => parsePitch(p));
    if (strings.some((s) => s === null)) {
      setErrors(['Every string needs a pitch like E2, F#1 or Bb3.']);
      return;
    }
    const v = validateTuning({ name, strings: strings as number[] });
    const ascending = (strings as number[]).every((m, i, a) => i === 0 || m > a[i - 1] - 12);
    if (!v.ok || !ascending) {
      setErrors([...v.errors, ...(ascending ? [] : ['List strings from lowest to highest pitch.'])]);
      return;
    }
    const t: CustomTuning = { id: editing?.id ?? uid('tuning'), name: name.trim(), category: 'custom', strings: strings as number[], custom: true, description: `Custom ${strings.length}-string tuning`, updatedAt: nowIso() };
    store.append('tunings', t);
    store.setProfile({ tuningId: t.id, strings: (Math.min(8, Math.max(6, t.strings.length)) as 6 | 7 | 8) });
    store.toast(editing ? 'Tuning updated' : 'Tuning saved', `${t.name}: ${tuningLabel(t)}`, 'success');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit “${editing.name}”` : 'New custom tuning'}>
      <div className="space-y-4">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName((e.target as HTMLInputElement).value)} placeholder="e.g. Baritone B" maxLength={60} data-testid="tuning-name" /></Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label">Strings (lowest first)</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setPitches((p) => (p.length < MAX_STRINGS ? [midiName(Math.max(12, (parsePitch(p[0]) ?? 40) - 5)), ...p] : p))} disabled={pitches.length >= MAX_STRINGS}>+ low string</Button>
              <Button size="sm" variant="ghost" onClick={() => setPitches((p) => (p.length > MIN_STRINGS ? p.slice(1) : p))} disabled={pitches.length <= MIN_STRINGS}>− low string</Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {pitches.map((p, i) => (
              <input key={i} className="input text-center font-mono" value={p} aria-label={`String ${pitches.length - i}`} data-testid={`tuning-pitch-${i}`}
                onChange={(e) => { const v = (e.target as HTMLInputElement).value; setPitches((a) => a.map((x, k) => (k === i ? v : x))); }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-xs text-ink-400">Start from:</span>
            {[active, ...CUSTOM_TEMPLATES].map((t) => <button key={t.id} type="button" className="text-xs text-accent-300 hover:underline" onClick={() => reset(t)}>{t.name}</button>)}
          </div>
        </div>
        {errors.length > 0 && <Callout tone="warn">{errors.map((e) => <div key={e}>{e}</div>)}</Callout>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} data-testid="tuning-save">Save tuning</Button>
        </div>
      </div>
    </Modal>
  );
}

export function CustomTuningList() {
  const s = useStudent();
  const [editing, setEditing] = useState<CustomTuning | null | undefined>(undefined);
  return (
    <div>
      {s.tunings.length === 0 ? (
        <Empty title="No custom tunings yet" body="Create tunings for baritone, 7- or 8-string guitars or anything else. They appear in the Tuner, Fretboard, Scale Explorer, Tab Editor and Trainer." action={<Button variant="primary" onClick={() => setEditing(null)}><LuPlus size={16} /> New tuning</Button>} />
      ) : (
        <>
          <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">
            {s.tunings.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink-50">{t.name}</div>
                  <div className="font-mono text-xs text-ink-300">{t.strings.length} strings · {tuningLabel(t)}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => store.setProfile({ tuningId: t.id })}>Use</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}><LuPen size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => store.append('tunings', { ...t, id: uid('tuning'), name: `${t.name} (copy)`, updatedAt: nowIso() })} aria-label={`Duplicate ${t.name}`}><LuCopy size={14} /></Button>
                  <Button size="sm" variant="danger" onClick={() => { if (s.profile.tuningId === t.id) store.setProfile({ tuningId: 'e-standard' }); store.remove('tunings', t.id); }} aria-label={`Delete ${t.name}`}><LuTrash2 size={14} /></Button>
                </div>
              </li>
            ))}
          </ul>
          <Button className="mt-3" onClick={() => setEditing(null)}><LuPlus size={16} /> New tuning</Button>
        </>
      )}
      {editing !== undefined && <TuningEditorModal open onClose={() => setEditing(undefined)} editing={editing} />}
    </div>
  );
}
