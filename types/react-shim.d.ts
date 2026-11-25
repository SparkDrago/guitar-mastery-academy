/**
 * Minimal React 19 type declarations.
 *
 * This workspace could not install @types/react, so the app ships these
 * declarations for the React APIs it actually uses. They keep hooks and
 * component props type-checked. When moving to a normal npm setup you can
 * replace this file with `npm i -D @types/react @types/react-dom` and delete it.
 */
declare module 'react' {
  export type Key = string | number;
  export type ReactElement = { type: unknown; props: unknown; key: Key | null };
  export type ReactNode = ReactElement | string | number | bigint | boolean | null | undefined | Iterable<ReactNode>;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export interface MutableRefObject<T> { current: T }
  export interface RefObject<T> { current: T | null }
  export type Ref<T> = RefObject<T> | ((instance: T | null) => void) | null;
  export type CSSProperties = Record<string, string | number | undefined>;
  export type FC<P = {}> = (props: P) => ReactNode;
  export type PropsWithChildren<P = {}> = P & { children?: ReactNode };

  export interface SyntheticEvent<T = Element> {
    currentTarget: T; target: EventTarget & T; preventDefault(): void; stopPropagation(): void; nativeEvent: Event;
  }
  export interface ChangeEvent<T = Element> extends SyntheticEvent<T> { target: EventTarget & T }
  export interface FormEvent<T = Element> extends SyntheticEvent<T> {}
  export interface MouseEvent<T = Element> extends SyntheticEvent<T> { clientX: number; clientY: number; button: number; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }
  export interface PointerEvent<T = Element> extends MouseEvent<T> { pointerId: number; pointerType: string }
  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T> { key: string; code: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; altKey: boolean; repeat: boolean }
  export interface FocusEvent<T = Element> extends SyntheticEvent<T> {}
  export interface DragEvent<T = Element> extends MouseEvent<T> { dataTransfer: DataTransfer }

  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useReducer<S, A>(reducer: (state: S, action: A) => S, initial: S): [S, Dispatch<A>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: never[]) => unknown>(cb: T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): MutableRefObject<T>;
  export function useRef<T>(initial: T | null): RefObject<T>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  export function useId(): string;
  export function useSyncExternalStore<T>(subscribe: (cb: () => void) => () => void, getSnapshot: () => T, getServerSnapshot?: () => T): T;
  export function useTransition(): [boolean, (cb: () => void) => void];
  export function useDeferredValue<T>(value: T): T;

  export interface Context<T> { Provider: FC<{ value: T; children?: ReactNode }>; Consumer: unknown }
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(ctx: Context<T>): T;

  export function memo<P>(c: FC<P>): FC<P>;
  export function lazy<P>(factory: () => Promise<{ default: FC<P> }>): FC<P>;
  export const Fragment: FC<{ children?: ReactNode; key?: Key }>;
  export const StrictMode: FC<{ children?: ReactNode }>;
  export const Suspense: FC<{ children?: ReactNode; fallback?: ReactNode }>;

  export class Component<P = {}, S = {}> {
    constructor(props: P);
    props: Readonly<P> & { children?: ReactNode };
    state: Readonly<S>;
    setState(s: Partial<S> | ((prev: S) => Partial<S>)): void;
    render(): ReactNode;
  }

  const React: { createElement: unknown; Fragment: typeof Fragment };
  export default React;
}

declare module 'react/jsx-runtime' {
  import type { ReactNode, Key } from 'react';
  export const jsx: unknown;
  export const jsxs: unknown;
  export const Fragment: unknown;
  /** DOM props: event handlers are typed (method syntax keeps them bivariant); everything else is open. */
  interface DOMAttrs<T> {
    [attr: string]: unknown;
    children?: ReactNode;
    onClick?(e: import('react').MouseEvent<T>): void;
    onDoubleClick?(e: import('react').MouseEvent<T>): void;
    onMouseDown?(e: import('react').MouseEvent<T>): void;
    onMouseUp?(e: import('react').MouseEvent<T>): void;
    onMouseEnter?(e: import('react').MouseEvent<T>): void;
    onMouseLeave?(e: import('react').MouseEvent<T>): void;
    onPointerDown?(e: import('react').PointerEvent<T>): void;
    onPointerUp?(e: import('react').PointerEvent<T>): void;
    onPointerMove?(e: import('react').PointerEvent<T>): void;
    onMouseMove?(e: import('react').MouseEvent<T>): void;
    onChange?(e: import('react').ChangeEvent<T>): void;
    onInput?(e: import('react').FormEvent<T>): void;
    onSubmit?(e: import('react').FormEvent<T>): void;
    onKeyDown?(e: import('react').KeyboardEvent<T>): void;
    onKeyUp?(e: import('react').KeyboardEvent<T>): void;
    onFocus?(e: import('react').FocusEvent<T>): void;
    onBlur?(e: import('react').FocusEvent<T>): void;
    onDragEnter?(e: import('react').DragEvent<T>): void;
    onDragOver?(e: import('react').DragEvent<T>): void;
    onDragLeave?(e: import('react').DragEvent<T>): void;
    onDrop?(e: import('react').DragEvent<T>): void;
  }
  export namespace JSX {
    type Element = import('react').ReactElement;
    interface ElementChildrenAttribute { children: {} }
    interface IntrinsicAttributes { key?: Key }
    interface IntrinsicElements {
      [elemName: string]: DOMAttrs<globalThis.Element>;
      svg: DOMAttrs<SVGSVGElement>;
      input: DOMAttrs<HTMLInputElement>;
      textarea: DOMAttrs<HTMLTextAreaElement>;
      select: DOMAttrs<HTMLSelectElement>;
      form: DOMAttrs<HTMLFormElement>;
      button: DOMAttrs<HTMLButtonElement>;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type ElementType = string | ((props: any) => ReactNode) | (new (props: any) => { render(): ReactNode });
  }
}

declare module 'react-dom/client' {
  import type { ReactNode } from 'react';
  export function createRoot(container: Element | DocumentFragment): { render(node: ReactNode): void; unmount(): void };
}

declare module 'react-icons/lu' {
  import type { FC } from 'react';
  type Icon = FC<{ size?: number | string; className?: string; title?: string; 'aria-hidden'?: boolean | 'true' | 'false'; strokeWidth?: number; style?: Record<string, string | number> }>;
  export const LuGauge: Icon;
  export const LuMusic: Icon;
  export const LuFolderOpen: Icon;
  export const LuLayers2: Icon;
  export const LuImport: Icon;
  export const LuFileArchive: Icon;
  export const LuCircleX: Icon;
  export const LuCircleMinus: Icon;
  export const LuCircleDashed: Icon;
  export const LuLoaderCircle: Icon;
  export const LuPackage: Icon;
  export const LuSkipBack: Icon;
  export const LuAudioWaveform: Icon;
  export const LuGuitar: Icon;
  export const LuLayoutDashboard: Icon;
  export const LuBookOpen: Icon;
  export const LuTimer: Icon;
  export const LuEar: Icon;
  export const LuMic: Icon;
  export const LuMicOff: Icon;
  export const LuSettings: Icon;
  export const LuRoute: Icon;
  export const LuGraduationCap: Icon;
  export const LuGrid3X3: Icon;
  export const LuPiano: Icon;
  export const LuDrum: Icon;
  export const LuActivity: Icon;
  export const LuPenLine: Icon;
  export const LuTarget: Icon;
  export const LuChartLine: Icon;
  export const LuChartBar: Icon;
  export const LuFlame: Icon;
  export const LuPlay: Icon;
  export const LuPause: Icon;
  export const LuSquare: Icon;
  export const LuRepeat: Icon;
  export const LuCheck: Icon;
  export const LuX: Icon;
  export const LuChevronRight: Icon;
  export const LuChevronLeft: Icon;
  export const LuChevronDown: Icon;
  export const LuMenu: Icon;
  export const LuCloud: Icon;
  export const LuCloudOff: Icon;
  export const LuLogOut: Icon;
  export const LuLogIn: Icon;
  export const LuUser: Icon;
  export const LuWandSparkles: Icon;
  export const LuSparkles: Icon;
  export const LuZap: Icon;
  export const LuFileText: Icon;
  export const LuBell: Icon;
  export const LuMaximize: Icon;
  export const LuGamepad2: Icon;
  export const LuScanSearch: Icon;
  export const LuEraser: Icon;
  export const LuTrendingUp: Icon;
  export const LuTrendingDown: Icon;
  export const LuKeyRound: Icon;
  export const LuRedo2: Icon;
  export const LuUndo2: Icon;
  export const LuLibrary: Icon;
  export const LuSearch: Icon;
  export const LuPlus: Icon;
  export const LuTrash2: Icon;
  export const LuCopy: Icon;
  export const LuDownload: Icon;
  export const LuUpload: Icon;
  export const LuSave: Icon;
  export const LuVolume2: Icon;
  export const LuVolumeX: Icon;
  export const LuMinus: Icon;
  export const LuLock: Icon;
  export const LuCircleCheck: Icon;
  export const LuCircle: Icon;
  export const LuTrophy: Icon;
  export const LuHeadphones: Icon;
  export const LuAudioLines: Icon;
  export const LuWaves: Icon;
  export const LuSlidersHorizontal: Icon;
  export const LuListMusic: Icon;
  export const LuKeyboard: Icon;
  export const LuInfo: Icon;
  export const LuTriangleAlert: Icon;
  export const LuArrowRight: Icon;
  export const LuRotateCcw: Icon;
  export const LuHand: Icon;
  export const LuBrain: Icon;
  export const LuCompass: Icon;
  export const LuMap: Icon;
  export const LuLayers: Icon;
  export const LuFileMusic: Icon;
  export const LuStar: Icon;
  export const LuClock: Icon;
  export const LuCalendar: Icon;
  export const LuRadio: Icon;
  export const LuFootprints: Icon;
  export const LuDisc: Icon;
  export const LuPen: Icon;
  export const LuBook: Icon;
  export const LuAward: Icon;
  export const LuRefreshCw: Icon;
  export const LuCoffee: Icon;
  export const LuEye: Icon;
  export const LuEyeOff: Icon;
  export const LuSkipForward: Icon;
  export const LuStepForward: Icon;
  export const LuFlag: Icon;
  export const LuShuffle: Icon;
}
