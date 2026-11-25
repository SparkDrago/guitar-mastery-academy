# Tab formats

## Native format (`.gmatab.json`)

The Tab Editor stores and exports a structured document that keeps rhythm, techniques, tuning and repeats. It round-trips exactly.

```json
{
  "format": "gma-tab",
  "version": 1,
  "title": "Pentatonic run",
  "tuning": { "name": "E Standard", "strings": [40, 45, 50, 55, 59, 64] },
  "tempo": 90,
  "timeSignature": [4, 4],
  "measures": [
    {
      "repeatStart": true,
      "beats": [
        { "duration": 8, "notes": [{ "string": 0, "fret": 5 }] },
        { "duration": 8, "notes": [{ "string": 0, "fret": 8, "techniques": ["hammer"] }] },
        { "duration": 4, "notes": [{ "string": 1, "fret": 7, "techniques": ["bend", "vibrato"], "bend": 1 }], "chord": "Am" },
        { "duration": 4, "rest": true, "notes": [] },
        { "duration": 4, "dotted": true, "notes": [{ "string": 0, "fret": 0 }, { "string": 1, "fret": 2 }, { "string": 2, "fret": 2 }] }
      ],
      "repeatEnd": 2
    }
  ]
}
```

| Field | Rules |
|---|---|
| `tuning.strings` | 4–9 MIDI note numbers (12–88), **lowest string first** (index 0) |
| `tempo` | 20–400 bpm |
| `timeSignature` | `[beats, unit]`, beats 1–32, unit 1/2/4/8/16 |
| `beat.duration` | 1 whole, 2 half, 4 quarter, 8 eighth, 16 sixteenth, 32 thirty-second; `dotted` ×1.5, `triplet` ×2/3 |
| `note.string` | 0-based from the lowest string; at most one note per string per beat |
| `note.fret` | 0–30 |
| `note.techniques` | any of `hammer pull slideUp slideDown slideIn slideOut bend prebend release vibrato palmMute harmonic artificialHarmonic tap tremolo trill ghost dead letRing accent` |
| `note.bend` | whole steps: 0.25, 0.5 (half step), 1 (full), 1.5, 2 |
| `note.trillFret` | second fret for trills |
| `repeatStart` / `repeatEnd` | `repeatEnd` is the total number of plays (2 = play twice) |

Validation (`validateScore`) reports **errors** (structure, ranges, unknown techniques; these block saving) and **warnings** (measures longer or shorter than the time signature allows).

## ASCII tab

Export (`toAscii`) writes standard six-line (or 7/8-line) tab, highest string on top, with string names, bar lines, repeat signs and technique symbols:

| Symbol | Meaning |
|---|---|
| `5h7` `7p5` | hammer-on, pull-off |
| `5/7` `7\5` | slide up / down |
| `7b9` | bend up to the pitch of fret 9 (`7b` alone = full bend, `7bq` = quarter-tone) |
| `7pb9` `9r7` | pre-bend, release |
| `7~` | vibrato |
| `7tr9` | trill between frets 7 and 9 |
| `<12>` | natural harmonic |
| `[7]` | artificial / pinch harmonic |
| `(5)` | ghost note |
| `x` | dead note |
| `t12` | tapped note |
| annotation row | `PM--` palm mute, `LR--` let ring, `TP--` tremolo picking, `>` accent |

Import (`parseAscii`) accepts tab pasted from most sources:

- 4–9 consecutive lines made of `-`, `|`, digits and technique symbols, optionally prefixed with string names (`e|`, `B|`, `E |`).
- Several systems (blocks of lines) are joined in order.
- Rhythm is inferred from horizontal spacing, so imported tab plays with approximate durations; check durations in the editor.
- The editor's current tuning is used when its string count matches the tab; otherwise the standard tuning for that string count (4, 6, 7 or 8) is assumed and a warning is shown.
- Anything unparseable is reported as a warning rather than silently dropped.

## Song files for Play mode

Play mode uses a timed model (`PlaySong`, seconds rather than beats; see `packages/notation/src/song.ts`). It can be created from:

| Source | Notes |
|---|---|
| Exercises and Tab Editor scores | converted at the chosen tempo, played twice after a two-bar count-in |
| Rocksmith 2014 arrangement XML (`<song>` root) | open format written by custom-song tools. String 0 is the lowest string; `<tuning stringN>` are semitone offsets from E standard (bass E1 A1 D2 G2); times are seconds in the song audio; bends are in half steps. Each `<phraseIteration>` takes its phrase's `maxDifficulty` level (or the `<transcriptionTrack>` if present). Sections, beats, chord templates, sustains and common techniques are imported. Vocals/showlights XML is rejected. |
| Guitar Pro 7/8 `.gp` | ZIP containing `Content/score.gpif`; tempo automations, time signatures, sections, ties, rhythm values (dots, tuplets), hammer-ons/pull-offs, slides, bends, palm mutes, dead notes, harmonics, vibrato and taps. The player picks a track when there are several. |
| Guitar Mastery `.json` | a serialized `PlaySong` (`"format": "gma-song"`). |

A recording can be attached to any imported song; the sync offset (−3…+3 s) aligns it with the notes.
