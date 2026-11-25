# Song importer

`/import` turns local files into songs in the device-local library. Everything runs in the browser. No file is uploaded, and there is no server-side processing.

## Flow

```
files / folders / drag-and-drop
        │  (main thread: File objects + relative paths)
        ▼
import worker (src/workers/import.worker.ts)
        │  runImport() from @gma/importer
        │   1. classify each file by magic bytes + name
        │   2. archives → registered ArchiveHandler (PSARC, ZIP) → entries
        │   3. charts → PlaySong (Rocksmith XML, Guitar Pro 7/8, GMA JSON)
        │      audio → Blob (OGG, WAV, MP3, FLAC, M4A)
        │      manifests → song details
        │   4. groupSongs(): arrangements → songs, audio matched
        ▼
ImportResult { songs: SongDraft[], files: FileReport[], audio: AudioItem[] }
        │
main thread: decode audio (Web Audio) → worker: onset envelope + offset estimate
        │
preview (synced highway + audio, seek, offset nudge) → save to IndexedDB
```

One worker is created per import and terminated when the import finishes or is cancelled, which releases its memory immediately. Cancel also aborts cooperatively between blocks and entries. Archives are read through `Blob.slice`, so a large archive is never loaded whole. Each decompressed entry is released as soon as it has been handled.

DOMParser is not available inside Web Workers, so charts are parsed with the app's own XML reader (`@gma/notation` `parseXml`). zlib and deflate use the browser's native `DecompressionStream`. LZMA, which browsers lack, uses a TypeScript decoder (`lzma.ts`). WebAssembly was not needed: native decompression is faster than a WASM build would be, and LZMA decodes at tens of MB/s.

## Reports: nothing is dropped silently

Every input gets a `FileReport` with one of the statuses `imported`, `partial`, `unsupported`, `error` or `skipped`. Every archive entry gets an `EntryReport`:

| Status | Meaning |
|---|---|
| imported | became part of a song (arrangement, audio) |
| metadata | read for title, artist, album, arrangement, song length |
| unsupported | a recognised format the browser cannot use (encrypted `.sng`, Wwise Vorbis/Opus `.wem`, `.bnk`, old Guitar Pro) |
| not-used | recognised but not needed by Play mode (lyrics, showlights, artwork, game data) |
| duplicate | identical chart already in this import |
| rejected / error | unsafe path, over the size limit, or damaged |

Archives also report their structural components (`ComponentReport`: `ok`, `warning`, `unsupported`, `error`, `unavailable`). When an archive cannot be opened, the report names the component responsible: header, compression, table of contents, block table, manifest or data.

## PSARC (`packages/importer/src/psarc.ts`)

- Header: `PSAR`, version, compression (`zlib`/`lzma`), TOC length, entry size, entry count, block size, flags.
- TOC entries: MD5 of the path, first block, 40-bit size and offset. The block-size table uses u16/u24/u32 entries depending on the block size, and 0 means a full stored block.
- Entry 0 is the manifest (newline-separated paths). Each name's MD5 is checked against the TOC, and paths are validated: no `..`, no drive letters, no control characters, length limits.
- Layout checks for every entry (block range, data within the file, truncation), plus a per-entry decompression limit (1 GiB) against decompression bombs.
- Flag 0x4 (encrypted TOC, used by Rocksmith 2014): the TOC is decrypted with the Rocksmith AES-256-CFB key and then parsed normally. The importer can list and extract entries; it does not decrypt file payloads separately.

## Wwise audio (`packages/importer/src/wem.ts`)

`.wem` files (loose, inside archives, or picked with Play mode's *Add audio*) are read by their RIFF/RIFX `fmt ` codec tag:

| Codec tag | Result |
|---|---|
| 0x0001 PCM, 0x0003 float, 0xFFFE extensible PCM | rewritten as a plain little-endian WAV (Wwise's extra chunks dropped, RIFX byte-swapped) |
| 0x0002 Wwise IMA ADPCM | decoded to 16-bit WAV (per-channel sub-blocks, 4-byte header, low nibble first) |
| 0xFFFF Wwise Vorbis (Rocksmith 2014) | reported as unsupported with conversion steps |
| 0x3040/0x3041 Wwise Opus, XMA, others | reported as unsupported with conversion steps |

Wwise Vorbis removes the Vorbis codebooks from the stream and refers to them by index into an external table (the aoTuV 6.03 "packed codebooks" that ww2ogg and vgmstream ship). That table is not bundled here, so the stream cannot be rebuilt into Ogg in the browser yet. Adding it later only touches the `0xFFFF` branch of `convertWem`: rebuild the Ogg Vorbis headers and packets, and hand the Ogg to the browser's own decoder. Until then, convert with `vgmstream-cli song.wem -o song.wav` (or ww2ogg + revorb, or the Custom Song Toolkit) and import the WAV/OGG.

## Adding an archive format

Implement `ArchiveHandler` (`sniff(head, name)` and `open(src, opts)`, which returns entries plus component reports) and call `registerArchiveHandler()`. The pipeline, grouping, reports and UI need no changes. Entries go through the same classification as loose files.

## Grouping (`grouping.ts`)

- Scope: one archive, one selected folder, or the loose files of a selection.
- Within a package, arrangements group by song key (manifest `SongKey`, XML `albumArt`, or the `songs/arr/<key>_<part>.xml` path), otherwise by title.
- Loose arrangements group by title and artist, falling back to the file name without its part suffix.
- Audio from a package goes with that package's song. Loose audio is matched by name, or goes to the only song still missing audio. A preview clip is chosen only when there is no full recording. Unmatched audio is offered in every song's audio picker.
- Duplicates: identical charts within one import are read once. Against the library, the importer compares the song fingerprint (hash of the arrangement hashes) and offers Replace or Keep both.

## Sync (`@gma/audio` `sync.ts`)

The convention matches Play mode: `chartTime = audioTime + offset`.

1. The recording is decoded and downmixed to mono at 11 kHz (at most 15 minutes).
2. Onset envelope: the rise in log energy of the high-passed signal, minus its local mean, with exact fractional hops so there is no drift over a long song.
3. The chart's note times slide over the envelope within ±8 s. The estimator keeps offset 0 (charts are authored against their recording) unless another shift is clearly better. A result also needs a robust z-score of at least 3 and at least 30% of notes landing on real attacks.
4. When another shift fits almost as well (a strictly repetitive part), the smallest shift is chosen and the result is flagged as ambiguous.
5. The recording's length is compared with the chart's declared length, and with its last note to catch preview clips.

Playback derives the chart clock from `audio.currentTime + offset` every frame, so seeking and buffering stay in sync. A positive offset runs a short pre-roll on the clock before the recording starts. The offset can be nudged in 0.01 s and 0.1 s steps.

## Library (`src/lib/idb.ts`, schema v2)

`library` store: one `LibrarySong` per song, holding title, artist, album, year, arrangements (`id`, `label`, `role`, `PlaySong`, `hash`, `best`), audio reference (`key`, `name`, `size`, `type`, `duration`), sync (`offset`, `method`, `confidence`), source file names, fingerprint and dates. Recordings live in the `audio` store under their key. Version 1's per-arrangement `songs` records are migrated on upgrade and left in place.
