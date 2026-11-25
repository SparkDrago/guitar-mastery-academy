/** Shared report types: every file, archive component and archive entry gets a visible status. */

export type ComponentState = 'ok' | 'warning' | 'unsupported' | 'error' | 'unavailable';

/** One structural part of a container (header, table of contents, block table, ...). */
export interface ComponentReport {
  id: string;
  label: string;
  state: ComponentState;
  detail: string;
}

export type EntryStatus =
  | 'imported'     // became part of a song (arrangement, audio)
  | 'metadata'     // read for song details (title, artist, ...)
  | 'unsupported'  // a recognised format the app cannot use (encrypted, unsupported codec, ...)
  | 'not-used'     // recognised game or authoring data Play mode has no use for
  | 'duplicate'    // identical to something already in this import
  | 'rejected'     // unsafe path, too large, ...
  | 'error';       // damaged or unreadable

export interface EntryReport {
  path: string;
  size: number;
  role: string;
  status: EntryStatus;
  detail: string;
}

export interface Fact { label: string; value: string }
