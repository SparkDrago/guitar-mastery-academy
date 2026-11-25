/** Navigation structure shared by the sidebar, mobile menu and command search. */
import {
  LuLayoutDashboard, LuRoute, LuBookOpen, LuGraduationCap, LuGuitar, LuLayers, LuGrid3X3, LuZap, LuWandSparkles, LuRadio,
  LuEar, LuScanSearch, LuGamepad2, LuGauge, LuTimer, LuCalendar, LuChartLine, LuSettings, LuMap, LuAudioLines, LuPenLine,
} from 'react-icons/lu';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LuGauge;
  description: string;
}

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Learn', items: [
    { to: '/', label: 'Dashboard', icon: LuLayoutDashboard, description: 'Today\'s plan, progress and recommendations' },
    { to: '/path', label: 'Learning Path', icon: LuRoute, description: 'The academy from Level 0 to Level 12' },
    { to: '/lessons', label: 'Lessons', icon: LuBookOpen, description: 'Every lesson, searchable' },
    { to: '/theory', label: 'Theory Academy', icon: LuGraduationCap, description: 'Circle of fifths, intervals, harmony and glossary' },
  ] },
  { group: 'Tools', items: [
    { to: '/tuner', label: 'Tuner', icon: LuGauge, description: 'Chromatic tuner with every tuning' },
    { to: '/metronome', label: 'Metronome', icon: LuTimer, description: 'Tap tempo, subdivisions, accents' },
    { to: '/fretboard', label: 'Fretboard', icon: LuGuitar, description: 'Interactive 6/7/8-string fretboard' },
    { to: '/scales', label: 'Scales', icon: LuLayers, description: 'Scale explorer and Pillitiere pattern builder' },
    { to: '/chords', label: 'Chords', icon: LuGrid3X3, description: 'Chord library and voicings' },
    { to: '/chord-finder', label: 'Chord Finder', icon: LuScanSearch, description: 'Reverse chord lookup from a shape, notes or by ear' },
  ] },
  { group: 'Practice', items: [
    { to: '/practice', label: 'Practice Studio', icon: LuCalendar, description: 'Personalised daily routines' },
    { to: '/technique-lab', label: 'Technique Lab', icon: LuZap, description: 'Technique exercises with BPM tracking' },
    { to: '/fretboard-trainer', label: 'Fretboard Trainer', icon: LuMap, description: 'Fretboard intelligence drills' },
    { to: '/ear-training', label: 'Ear Training', icon: LuEar, description: 'Intervals, chords, scales and rhythm' },
    { to: '/analyzer', label: 'Playing Analyzer', icon: LuAudioLines, description: 'Measure timing and pitch with the mic' },
    { to: '/tab-editor', label: 'Tab Editor', icon: LuPenLine, description: 'Write tabs and exercises' },
  ] },
  { group: 'Play', items: [
    { to: '/play', label: 'Play Mode', icon: LuGamepad2, description: 'Note highway with live scoring; import songs' },
    { to: '/improvisation', label: 'Improvisation', icon: LuWandSparkles, description: 'Guided improvisation challenges' },
    { to: '/jam', label: 'Jam Room', icon: LuRadio, description: 'Backing tracks with live theory' },
  ] },
  { group: 'You', items: [
    { to: '/progress', label: 'Progress', icon: LuChartLine, description: 'Analytics, mastery and reviews' },
    { to: '/settings', label: 'Settings', icon: LuSettings, description: 'Account, instrument and data' },
  ] },
];
