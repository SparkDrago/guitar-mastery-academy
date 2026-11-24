import type { Lesson } from '@gma/learning';
import { p, list, tip, warn, theory, tab, table, fb, chords, q, src, sourceNote } from '../helpers';

export const LEVEL_8: Lesson[] = [
  {
    id: 'l8-barre-chords', level: 8, module: 'm8-chords', title: 'Barre chords: E and A shapes', minutes: 35,
    objectives: ['Play E-shape and A-shape major and minor barre chords', 'Name barre chords from their root on the 6th or 5th string', 'Switch between open and barre chords in time'],
    prerequisites: ['l1-open-chords', 'l2-root-strings'], categories: ['chords', 'technique'], sources: [src.C('Barre chords: E-shape and A-shape major and minor, dominant 7th barres'), src.P()],
    why: 'Barre chords let you play any major or minor chord with two movable shapes. They are the bridge from beginner chords to the whole neck.',
    explanation: [
      p('A barre chord is an open chord shape moved up the neck, with the first finger replacing the nut. E-shape: fret an E major chord with fingers 2, 3 and 4, then slide up and lay finger 1 across all six strings. At fret 1 that is F; at fret 3, G. The root is on the 6th string.'),
      p('E-shape minor: the same idea starting from E minor. A-shape major: barre strings 5–1 with finger 1 and either use fingers 2-3-4 or a ring-finger mini-barre on strings 4–2 (often muting string 1). A-shape minor comes from Am. The root is on the 5th string.'),
      chords(['F', 'Fm', 'Bb', 'Bbm'], 'E-shape (root on 6th string) and A-shape (root on 5th string) barre chords.'),
      tip('Roll the first finger slightly onto its bony edge, keep the elbow close to the body and let arm weight (not thumb squeeze) provide pressure. Check each string; most problems are one or two muted strings.'),
      sourceNote('Book 3 opens with exactly these four shapes plus E- and A-shape dominant 7th barres, then applies them in many riffs. The progression below is original.'),
    ],
    guitar: [
      p('Play | F | Dm | B♭ | C | using barre chords (F at fret 1 E-shape, Dm at fret 5 A-shape, B♭ at fret 1 A-shape, C at fret 3 A-shape).'),
    ],
    exercise: { title: 'Barre fitness', steps: ['Hold an F barre for 10 seconds, release, repeat 5 times (build strength gently).', 'Move the E-shape chromatically from fret 1 to 7 and back.', 'Technique Lab: barre-chord changes exercise.'], exerciseId: 'ex-barre-changes' },
    metronome: { bpmStart: 60, bpmTarget: 100, subdivision: 1, instructions: 'One chord per bar, then two beats per chord.' },
    mistakes: ['Squeezing with the thumb until the hand cramps.', 'Barre finger flat on its soft pad, muting strings in its creases.', 'Ignoring which string carries the root.'],
    selfCheck: ['All strings ring in my E- and A-shape barres.', 'I can find any major or minor barre chord by its root.'],
    quiz: [
      q('l8b-1', 'An E-shape barre at the 5th fret is…', ['A major', 'C major', 'D major', 'E major'], 0, 'Fret 5 on the 6th string is A.'),
      q('l8b-2', 'An A-shape minor barre with its root at the 7th fret (5th string) is…', ['Em', 'Am', 'Bm', 'C♯m'], 0, 'Fret 7 on the A string is E.'),
      q('l8b-3', 'The main source of barre pressure should be…', ['A hard thumb squeeze', 'Arm weight and finger positioning', 'Pressing with the palm', 'Higher action'], 1, 'Let the arm\'s weight pull back gently; avoid thumb tension.'),
    ],
    realWorld: 'Barre chords let you play any song in any key without a capo. Countless rock and pop songs use only E- and A-shape barres.',
    summary: ['E shape: root on 6th string. A shape: root on 5th.', 'Major and minor versions of each.', 'Use arm weight, not grip.'],
    next: 'l8-sevenths',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-barre-changes', bpm: 80 }, criteria: ['Score at least 2 of 3.', 'Log a clean barre-change take at 80 bpm.'] },
  },
  {
    id: 'l8-sevenths', level: 8, module: 'm8-chords', title: 'Seventh chords, sus and add chords', minutes: 35,
    objectives: ['Build maj7, 7, m7, m7♭5 and dim7 chords', 'Play add9, sus2 and sus4 voicings', 'Hear each chord\'s colour'],
    prerequisites: ['l8-barre-chords', 'l3-triads'], categories: ['chords', 'theory'], sources: [src.C('Dominant seventh, minor seventh, add and sus chords, ninth chords'), src.P()],
    why: 'Seventh chords add colour and direction: dominant 7ths drive the blues, minor 7ths give soul and funk their mellowness, major 7ths sound lush.',
    explanation: [
      p('A seventh chord adds a 7th above the root to a triad:'),
      table(['Chord', 'Formula', 'Sound / use'], [['maj7', '1 3 5 7', 'Lush, dreamy (I and IV)'], ['7 (dominant)', '1 3 5 ♭7', 'Bluesy, wants to resolve (V, blues I-IV-V)'], ['m7', '1 ♭3 5 ♭7', 'Mellow (ii, iii, vi)'], ['m7♭5', '1 ♭3 ♭5 ♭7', 'Unstable (vii in major, ii in minor)'], ['dim7', '1 ♭3 ♭5 ♭♭7', 'Very tense, symmetrical']]),
      p('Add chords keep the triad and add a note: add9 = 1 3 5 9. Sus chords replace the 3rd: sus2 = 1 2 5, sus4 = 1 4 5. Ninth chords (9 = 1 3 5 ♭7 9) are often used as a funkier substitute for a dominant 7th.'),
      chords(['Cmaj7', 'C7', 'Cm7', 'Bm7b5', 'Cadd9', 'Dsus4', 'E9'], 'Common voicings. Explore more in the Chord Explorer.'),
    ],
    guitar: [
      p('Play Am7 – D7 – Gmaj7 – Cmaj7 and listen to how each chord colours the progression. Then play G – Cadd9 – G – Cadd9 (keeping fingers 3 and 4 anchored on the top strings).'),
    ],
    exercise: { title: 'Colour palette', steps: ['For one root (A), play maj7, 7, m7 and m7♭5 back to back.', 'Play a ii–V–I in G: Am7 – D7 – Gmaj7.', 'Use the Chord Explorer to find three voicings of each seventh type.'] },
    mistakes: ['Using a maj7 where a dominant 7 is needed (and vice versa): the 7th type changes everything.'],
    selfCheck: ['I can hear the difference between maj7, 7 and m7.'],
    quiz: [
      q('l8s-1', 'A dominant 7th chord is…', ['1 3 5 7', '1 3 5 ♭7', '1 ♭3 5 ♭7', '1 ♭3 ♭5 ♭7'], 1, '1 3 5 ♭7.'),
      q('l8s-2', 'Cadd9 contains…', ['C E G D', 'C D G', 'C F G', 'C E G B♭ D'], 0, 'Triad plus the 9th (D), no 7th.'),
      q('l8s-3', 'Which chord is built on the 7th degree of a major key as a seventh chord?', ['maj7', 'dominant 7', 'm7♭5', 'dim7'], 2, 'vii in major is half-diminished.'),
    ],
    realWorld: 'Blues uses dominant 7ths everywhere; neo-soul and jazz use maj7, m7 and 9 chords; pop and rock love add9 and sus chords.',
    summary: ['Four main seventh qualities plus dim7.', 'Add chords add; sus chords replace the 3rd.', 'Each colour has a typical function.'],
    next: 'l8-inversions',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3, including generated chord-spelling questions.'] },
    unlocks: { chords: ['Cmaj7', 'C7', 'Cm7', 'Bm7b5', 'Cadd9', 'E9', 'Bdim7'] },
  },
  {
    id: 'l8-inversions', level: 8, module: 'm8-chords', title: 'Triad inversions, voice leading and drop voicings', minutes: 35,
    objectives: ['Play major and minor triads in root position and both inversions on three-string groups', 'Connect chords with minimal movement (voice leading)', 'Understand drop-2 voicings'],
    prerequisites: ['l8-sevenths', 'l3-triads'], categories: ['chords', 'fretboard'], sources: [src.P('Inversions, voice leading, drop voicings')],
    why: 'Small triad shapes on the top strings are the secret of tasteful rhythm guitar: they sit above the band, move smoothly and outline the harmony anywhere on the neck.',
    explanation: [
      p('An inversion puts a note other than the root in the bass. Root position: 1-3-5 from low to high. First inversion: 3-5-1. Second inversion: 5-1-3. On any group of three adjacent strings you get three shapes per triad, climbing the neck.'),
      p('Voice leading means moving from one chord to the next with the smallest possible motion of each note. Choose inversions so common tones stay put and the other notes move by step.'),
      p('Drop voicings spread close-position chords so they fit the guitar. A drop-2 voicing takes the second-highest note of a close seventh chord and drops it an octave, giving playable four-note shapes on strings 4–1 or 5–2.'),
      fb('C', { chord: 'maj', minFret: 0, maxFret: 15, labels: 'interval', caption: 'C major triad tones across the neck. Find root position and both inversions on strings 3-2-1.' }),
    ],
    guitar: [
      tab(`
   C (root)     F (2nd inv)  G (2nd inv)  C (1st inv)
e|-3------------5------------7------------8----|
B|-5------------6------------8------------8----|
G|-5------------5------------7------------9----|`, 'Original voice-led triads on the top three strings.'),
    ],
    exercise: { title: 'Triads everywhere', steps: ['Play C major on strings 3-2-1 in all three inversions up the neck.', 'Play I–IV–V–I in C using the nearest inversion each time.', 'Find drop-2 maj7 and m7 voicings on strings 4-3-2-1 in the Chord Explorer.'] },
    mistakes: ['Jumping around the neck instead of choosing the nearest inversion.'],
    selfCheck: ['I can play any major or minor triad in three inversions on the top strings.'],
    quiz: [
      q('l8i-1', 'A first-inversion C major triad has which note in the bass?', ['C', 'E', 'G', 'B'], 1, 'First inversion = 3rd in the bass.'),
      q('l8i-2', 'Voice leading aims to…', ['Move every note as far as possible', 'Move notes as little as possible between chords', 'Use only root position', 'Avoid common tones'], 1, 'Minimal motion and held common tones.'),
    ],
    realWorld: 'Funk, soul and pop guitarists use small triads to stay out of the bass and keyboard range and still define the chords.',
    summary: ['Three inversions per triad per string set.', 'Voice leading: minimal motion.', 'Drop voicings make 7th chords playable.'],
    next: 'l8-extended',
    mastery: { quizPass: 1, criteria: ['Answer both questions.', 'Play I–IV–V–I in C with voice-led triads.'] },
  },
  {
    id: 'l8-extended', level: 8, module: 'm8-chords', title: 'Extended and altered chords', minutes: 30,
    objectives: ['Build 9th, 11th and 13th chords', 'Understand altered dominants (♭9, ♯9, ♭5, ♯5)', 'Choose which notes to omit in guitar voicings'],
    prerequisites: ['l8-sevenths'], categories: ['chords', 'theory'], sources: [src.C('Ninth chords; m11 extension'), src.P('Extended and altered harmony')],
    why: 'Extensions add sophistication and tension; altered dominants are the spice of jazz, fusion and funk.',
    explanation: [
      p('Keep stacking thirds above a seventh chord and you reach the 9th, 11th and 13th (the 2nd, 4th and 6th an octave up). A 13 chord technically contains 1 3 5 ♭7 9 11 13, far too many for six strings, so guitarists omit notes: the 5th first (it adds little), the 11th on dominant and major chords (it clashes with the 3rd), often the root if a bassist plays it.'),
      p('Altered chords change the 5th or 9th of a dominant chord: 7♭9, 7♯9 (the "Hendrix chord", with both major 3rd and ♯9), 7♭5, 7♯5. They create strong tension before resolving to the tonic.'),
      chords(['A9', 'Am11', 'G13', 'E7#9', 'B7b9'], 'Typical guitar voicings with notes omitted.'),
    ],
    guitar: [
      p('Play E7♯9 (x7678x) and resolve it to A. Then play a funk vamp on E9 with short, staccato strums.'),
    ],
    exercise: { title: 'Tension and colour', steps: ['Play Dm9 – G13 – Cmaj9.', 'Resolve B7♭9 to Em and B7 to Em; compare.', 'In the Chord Explorer, display the formula and note which tones each voicing omits.'] },
    mistakes: ['Trying to fit every extension into one voicing.'],
    selfCheck: ['I can explain which notes are safe to omit.'],
    quiz: [
      q('l8e-1', 'The 9th is the same note as…', ['The 3rd', 'The 2nd', 'The 4th', 'The 6th'], 1, '9 = 2 + an octave.'),
      q('l8e-2', 'The first note usually omitted from an extended chord voicing is…', ['The 3rd', 'The 7th', 'The 5th', 'The root always'], 2, 'The 5th contributes least to chord quality.'),
      q('l8e-3', 'The "Hendrix chord" is…', ['maj7', '7♯9', 'm7♭5', 'sus4'], 1, 'Dominant 7 with a ♯9.'),
    ],
    realWorld: 'Funk rhythm guitar lives on 9th chords; jazz on 13ths and altered dominants.',
    summary: ['Extensions: 9, 11, 13.', 'Alterations: ♭9 ♯9 ♭5 ♯5 on dominants.', 'Omit the 5th first.'],
    next: 'l8-chord-tones',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.'] },
    unlocks: { chords: ['A9', 'Am11', 'G13', 'E7#9', 'B7b9'] },
  },
  {
    id: 'l8-chord-tones', level: 8, module: 'm8-harmony', title: 'Chord tones and arpeggios', minutes: 35,
    objectives: ['Play arpeggios of triads and seventh chords', 'See chord tones inside scale positions', 'Target chord tones while soloing'],
    prerequisites: ['l8-sevenths', 'l6-caged'], categories: ['chords', 'improvisation', 'fretboard'], sources: [src.A('Arpeggios (broken chords)'), src.C('Arpeggio riffs; arpeggiated minor triads in minor blues'), src.P('Chord-tone soloing')],
    why: 'Chord tones are the strongest notes over any chord. Soloists who target them sound like they are following the changes rather than running scales over them.',
    explanation: [
      p('An arpeggio is a chord played one note at a time. Practising arpeggios teaches you where the root, 3rd, 5th and 7th of every chord sit on the neck, inside the scale shapes you already know.'),
      p('Chord-tone targeting means landing on a chord tone, often the 3rd or 7th, on strong beats, especially when the chord changes. Non-chord tones (passing notes) fill the space between targets.'),
      fb('A', { chord: 'm7', minFret: 4, maxFret: 9, labels: 'interval', caption: 'Am7 arpeggio (1 ♭3 5 ♭7) around the 5th fret, inside the A minor pentatonic box.' }),
      theory('The 3rd and 7th are called guide tones: they define the chord quality. Moving smoothly between the guide tones of successive chords creates lines that outline the harmony by themselves.'),
    ],
    guitar: [
      tab(`
e|---------------------5-8-----|
B|-----------------5-8---------|
G|-------------5-7-------------|
D|---------5-7-----------------|
A|-----7-----------------------|
E|-5-8-------------------------|`, 'Am7 arpeggio, ascending (A C E G across two octaves, with one passing note D on the G string).'),
    ],
    exercise: { title: 'Follow the changes', steps: ['Arpeggiate Am7, Dm7 and Em7 in position 1 of A minor.', 'Over a 12-bar blues, land on each chord\'s 3rd at the change (C♯ on A7, F♯ on D7, G♯ on E7).', 'Complete the "Target the 3rd of every chord" and "Resolve every phrase to a chord tone" challenges.'], exerciseId: 'ex-arp-triads' },
    mistakes: ['Playing arpeggios as exercises only and never in solos.'],
    selfCheck: ['I can find the 3rd of any chord in the position I\'m playing.'],
    quiz: [
      q('l8c-1', 'Over a D7 chord, which note is the 3rd?', ['D', 'F', 'F♯', 'A'], 2, 'D major 3rd = F♯.'),
      q('l8c-2', 'Guide tones are…', ['Root and 5th', '3rd and 7th', '9th and 13th', 'Open strings'], 1, 'The 3rd and 7th define quality.'),
      q('l8c-3', 'When should chord tones usually be targeted?', ['On weak beats only', 'On strong beats and at chord changes', 'Never', 'Only at the end of the song'], 1, 'Strong beats and changes make the harmony audible.'),
    ],
    realWorld: 'This is how blues, jazz and fusion players make solos "speak the changes."',
    summary: ['Arpeggios map chord tones.', 'Target 3rds and 7ths at changes.', 'Passing notes connect targets.'],
    next: 'l8-functional',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-arp-triads', bpm: 80 }, criteria: ['Score at least 2 of 3.', 'Log a clean arpeggio take at 80 bpm.'] },
    unlocks: { challenges: ['target-thirds', 'resolve-chord-tones'], trainerModes: ['chord-tones'] },
  },
  {
    id: 'l8-functional', level: 8, module: 'm8-harmony', title: 'Roman numerals, functional harmony, secondary dominants and substitutions', minutes: 40,
    objectives: ['Analyse progressions with Roman numerals', 'Explain tonic, subdominant and dominant function', 'Recognise secondary dominants and common substitutions'],
    prerequisites: ['l3-diatonic-chords', 'l8-sevenths'], categories: ['theory', 'chords'], sources: [src.C('Chord numbers'), src.P('Functional harmony')],
    why: 'Functional harmony explains why progressions move the way they do. It lets you predict chords, write convincing progressions and choose scales when chords leave the key.',
    explanation: [
      p('Diatonic chords group into three functions. Tonic (I, iii, vi): stable, home. Subdominant (ii, IV): moving away. Dominant (V, vii°): tension that wants to resolve to tonic. Most progressions follow tonic → subdominant → dominant → tonic.'),
      p('The V7 chord resolves strongly because its 3rd (the leading tone) rises a half step to the tonic and its ♭7 falls a half step to the tonic chord\'s 3rd.'),
      p('Secondary dominants temporarily treat another chord as a tonic: V7/V (D7 in C) leads to G; V7/vi (E7 in C) leads to Am. They are non-diatonic dominant chords a perfect 5th above their target.'),
      list('Relative substitution: replace I with vi or iii (same function).', 'Tritone substitution: replace V7 with a dominant 7th a tritone away (D♭7 for G7 in C); both share the same 3rd and 7th.', 'Backdoor: ♭VII7 → I (B♭7 → C).'),
    ],
    guitar: [
      chords(['C', 'A7', 'Dm7', 'G7', 'C'], 'I – V7/ii – ii7 – V7 – I: a secondary dominant leading to Dm7.'),
    ],
    exercise: { title: 'Analyse and play', steps: ['Analyse C – A7 – Dm7 – G7 – C with numerals.', 'Replace G7 with D♭7 (tritone sub) and listen.', 'Use the Jam Lab theory panel to see how the engine labels secondary dominants and out-of-key notes.'] },
    mistakes: ['Labelling a secondary dominant as a "wrong" chord rather than understanding its target.'],
    selfCheck: ['I can analyse a progression containing a secondary dominant.'],
    quiz: [
      q('l8f-1', 'In C major, V7/V is…', ['G7', 'D7', 'A7', 'E7'], 1, 'V of G is D; as a dominant 7th, D7.'),
      q('l8f-2', 'Which function does the IV chord usually have?', ['Tonic', 'Subdominant', 'Dominant', 'None'], 1, 'IV is subdominant.'),
      q('l8f-3', 'A tritone substitute for G7 is…', ['C7', 'D♭7', 'D7', 'F7'], 1, 'D♭ is a tritone from G; D♭7 shares G7\'s guide tones (B/C♭ and F).'),
    ],
    realWorld: 'Jazz standards, soul, Beatles-era pop and gospel use secondary dominants constantly.',
    summary: ['Tonic, subdominant, dominant.', 'Secondary dominants point to other chords.', 'Substitutions keep function, change colour.'],
    next: 'l8-chord-scale',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3, including generated numeral questions.'] },
  },
  {
    id: 'l8-chord-scale', level: 8, module: 'm8-harmony', title: 'Chord–scale relationships: playing over changes', minutes: 40,
    objectives: ['Pick a scale for each chord based on key context', 'Identify notes that change between chords', 'Improvise over a changing progression'],
    prerequisites: ['l8-chord-tones', 'l8-functional', 'l7-minor-modes'], categories: ['improvisation', 'theory'], sources: [src.P('Chord–scale theory')],
    why: 'Understanding why a scale fits a chord turns improvising over changes from guesswork into informed choice.',
    explanation: [
      p('The academy\'s rule (also used by the Jam Lab engine): for each chord, choose a scale built on the chord root that (1) contains every chord tone and (2) shares as many notes as possible with the prevailing key. For diatonic chords this gives the familiar modes: ii7 → Dorian, V7 → Mixolydian, IVmaj7 → Lydian. For non-diatonic chords it changes exactly the notes the chord requires.'),
      p('Example in A minor: Am7 (Aeolian), Dm7 (Dorian), E7 (Phrygian dominant, because the chord\'s G♯ replaces the key\'s G). Only one note changes, and you change it only while E7 sounds.'),
      p('Tension notes: scale notes a half step above a chord tone (e.g. F over C major) clash when held. Use them as passing notes resolving down.'),
    ],
    guitar: [
      fb('E', { scale: 'phrygian-dominant', minFret: 4, maxFret: 9, labels: 'interval', caption: 'E Phrygian dominant over E7 in A minor: the only change from A minor is G♯.' }),
    ],
    exercise: { title: 'Changes, not keys', steps: ['Over a jazz turnaround (Imaj7–vi7–ii7–V7) in C, follow the scale recommendations in the Jam Lab theory panel.', 'Over the Andalusian cadence, keep A minor but switch G to G♯ on E7.', 'Complete the "Follow the chord-scale map" challenge.'] },
    mistakes: ['Changing scales so mechanically that phrases lose continuity; connect them via nearby chord tones.'],
    selfCheck: ['I can explain why a scale fits a chord in context.'],
    quiz: [
      q('l8x-1', 'In C major, the best scale for Dm7 by the key-context rule is…', ['D minor (Aeolian)', 'D Dorian', 'D Phrygian', 'D blues'], 1, 'D Dorian uses only C major notes and contains Dm7.'),
      q('l8x-2', 'Over E7 in A minor, the note that must change from the key is…', ['F → F♯', 'G → G♯', 'C → C♯', 'D → D♯'], 1, 'E7 contains G♯.'),
      q('l8x-3', 'A tension note is…', ['Any chord tone', 'A scale note a half step above a chord tone', 'The root', 'Any note outside the key'], 1, 'Held against the chord tone below it, it clashes.'),
    ],
    realWorld: 'This is the core skill of jazz and fusion improvisation and of any rock soloist who wants solos that follow the song.',
    summary: ['Scale contains chord tones and stays close to the key.', 'Change only the notes the chord requires.', 'Treat tension notes as passing tones.'],
    next: 'l9-picking-systems',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.', 'Complete the chord-scale Jam Lab challenge.'] },
    unlocks: { challenges: ['chord-scale-tour'] },
  },
];
