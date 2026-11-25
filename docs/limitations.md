# Known limitations

An honest list of what the current build does not do, or does only partly. Nothing here is hidden behind a fake UI: where a feature is limited, the app says so on screen.

## Audio and measurement

- **Playing Analyzer scope.** Timing is measured from note attacks (spectral-flux onsets). It is reliable for picked single notes and muted strums; it is unreliable for legato (hammer-ons/pull-offs produce weak attacks), heavy distortion with long sustain, and very fast passages above roughly 12 notes per second. Exercises flagged as not measurable say so, and a manual self-assessment is always available.
- **Pitch checking** runs only on single-note exercises (one note per beat). Chords are not pitch-checked. Bends, slides and vibrato are not evaluated.
- **No technique recognition.** The analyzer does not judge picking direction, finger choice, muting quality or tone. It reports timing, consistency, drift, completeness and (where possible) pitch, nothing more.
- **Latency** differs per device and output (Bluetooth headphones can add 150–300 ms). Calibration is per browser; without it, timing results are shifted by the device's latency.
- **Tuner** accuracy is about ±1 cent on a clean signal; very low strings (below ~40 Hz, e.g. some 8-string and bass tunings) need a sustained note and may take a moment to lock. Background noise and other ringing strings can cause jumps; manual string selection helps.
- **Synthesised sound.** All instruments (guitar, bass, drums, clicks) are synthesised in the browser. They are clear enough for practice but are not realistic recordings.
- The analyzer was tested end to end with synthesised microphone input in Chrome; the timing/pitch algorithms are unit-tested on synthetic signals with known errors. They have not been validated against a corpus of real recordings by human-rated players.

## Play mode and imports

- **PSARC archives:** unencrypted archives are read fully in the browser (zlib, LZMA or stored blocks; manifest, name-hash and layout checks). **Rocksmith 2014 archives encrypt their table of contents** (flag 0x4); the importer reads and reports the header and compression, and marks the table of contents as unsupported and the block table, manifest and data as unreachable. It does not decrypt game files. Import the song's arrangement XMLs with its OGG/WAV audio instead.
- Inside readable archives, these are listed but not used: `.sng` charts (encrypted per file in Rocksmith 2014), Wwise audio (`.wem`) and sound banks (`.bnk`), which browsers cannot decode, vocals/lyrics and showlights XML, artwork, and game data. Each appears in the import report with its reason.
- Automatic sync confirms or corrects the chart-to-recording offset within ±8 s from note onsets. A strictly repetitive part can fit equally well one beat away; the importer then says the result is ambiguous and the offset should be checked by ear. It does not stretch the timing for recordings of a different tempo or version.
- OGG Vorbis playback depends on the browser (older Safari cannot decode it); WAV works everywhere.
- Guitar Pro 3–6 (.gp3/.gp4/.gp5/.gpx) are not imported; save as Guitar Pro 7/8 (.gp). Only the first voice of one track is used; tuplets beyond simple ratios, grace notes, and some techniques (whammy, rasgueado) are ignored.
- Play-mode scoring is single-microphone pitch analysis: single notes use YIN pitch detection, chords use a 12-bin pitch-class profile and count when all but one chord tone sound. It cannot verify string choice, fingering or muting, and loud backing audio through speakers can confuse it (use headphones).
- Imported songs and recordings are stored only in this browser (IndexedDB), are not synced and are lost if site data is cleared. Only import material you have the right to use.
- The highway is drawn with Canvas 2D (not 3D); camera movement follows the upcoming notes automatically.
- Session mode follows intensity (attack rate and loudness), not tempo: the band keeps the tempo you set.

## Content

- The curriculum is original teaching material organised around the supplied books; it does not reproduce their text, songs or tab. Song-based practice therefore uses original exercises rather than the books' songs.
- Repertoire is limited to the 37 built-in exercises plus anything students write in the Tab Editor; there is no song library.
- ASCII tab import infers rhythm from spacing, so imported rhythms are approximate. Guitar Pro / MusicXML / MIDI import and standard-notation rendering are not implemented.
- Lesson media are diagrams, fretboards, tab and synthesised audio; there are no videos.

## Accounts, data and sync

- Accounts and cross-device sync require the dedicated Supabase project to be configured (URL + anon key at build time). Until then the app runs in local-only mode: progress lives in the browser and can be moved with backup export/import.
- Sync is near-real-time (on change, on focus, on reconnect), not live-collaborative; two devices editing the same item at the same moment resolve by last write wins.
- Clearing site data or using a private window loses local-only progress.
- Lesson content is bundled with the app; the seeded content tables in Supabase are a server-side copy and are not yet the runtime source (no CMS).
- There are no teacher/class features, social features, payments or email notifications beyond Supabase auth emails.

## Platform

- Tested in desktop Chrome and Chrome mobile emulation (390×844), dark and light themes. Firefox, Safari and real iOS/Android devices were not tested in this environment.
- Requires a modern browser with Web Audio and, for the microphone, HTTPS (or localhost).
- The JavaScript bundle is about 930 KB minified (≈285 KB gzipped) because all 80 lessons ship with the app; route-level code splitting is a possible optimisation.
- Offline use works after the first load only while the page stays open; there is no service worker yet.
