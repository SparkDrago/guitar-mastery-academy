import type { Lesson } from '@gma/learning';
import { p, list, steps, tip, warn, theory, tab, table, fb, q, src } from '../helpers';

export const LEVEL_2: Lesson[] = [
  {
    id: 'l2-musical-alphabet', level: 2, module: 'm2-notes', title: 'The musical alphabet, half steps and whole steps', minutes: 20,
    objectives: ['Recite the musical alphabet forward and backward', 'Know that a fret equals a half step (semitone)', 'Find the two natural half steps: E–F and B–C'],
    prerequisites: ['l0-tuning'], categories: ['fretboard', 'theory'], sources: [src.A('Notes on each string (frets 0–5)'), src.P('The chromatic system')],
    why: 'Every note name on the guitar comes from seven letters and one rule. Learn the rule and you can work out any note on any string, in any tuning.',
    explanation: [
      p('Music uses seven letter names: A B C D E F G, then the cycle repeats (A again, one octave higher). Between most neighbouring letters there is a gap that a sharp or flat fills. The exceptions are E–F and B–C: these letters are already a half step apart, so there is no note between them.'),
      p('A half step (semitone) is the smallest distance in Western music: one fret on the guitar. A whole step (tone) is two half steps: two frets.'),
      table(['Fret', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], [['Low E string', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B', 'C', 'C♯/D♭', 'D', 'D♯/E♭', 'E']], 'The chromatic scale on the low E string: twelve half steps to the octave.'),
      theory('Twelve half steps make an octave. Fret 12 is the same note name as the open string, one octave higher, which is why the 12th fret has a double dot.'),
    ],
    guitar: [
      fb('E', { notes: ['E', 'F', 'G', 'A', 'B', 'C', 'D'], maxFret: 12, labels: 'note', caption: 'Natural notes (no sharps or flats) on every string up to fret 12.' }),
      tip('Say the note names aloud as you play up the low E string: "E, F, F-sharp, G…". Saying and playing together builds the connection quickly.'),
    ],
    exercise: { title: 'Chromatic walk', steps: ['Play every fret from 0 to 12 on the low E string, naming each note aloud.', 'Repeat on the A string (A, A♯, B, C …).', 'Find only the natural notes on the A string, skipping sharps and flats.'] },
    mistakes: ['Putting a sharp between E and F or between B and C.', 'Forgetting the alphabet restarts after G.'],
    selfCheck: ['I can name all twelve notes in order from any starting note.', 'I know where the natural half steps are.'],
    quiz: [
      q('l2a-1', 'Which pair of natural notes is only a half step apart?', ['C–D', 'E–F', 'G–A', 'A–B'], 1, 'E–F and B–C are the natural half steps.'),
      q('l2a-2', 'How many frets is a whole step?', ['1', '2', '3', '12'], 1, 'A whole step is two half steps, two frets.'),
      q('l2a-3', 'What note is at fret 3 of the low E string?', ['F', 'F♯', 'G', 'A'], 2, 'E (0), F (1), F♯ (2), G (3).'),
      q('l2a-4', 'The note one whole step above B is…', ['C', 'C♯', 'B♯', 'D'], 1, 'B to C is a half step; one more half step reaches C♯.'),
    ],
    realWorld: 'When someone says "play it a whole step up" or "drop it a half step," you will know it means two frets or one fret.',
    summary: ['Seven letters A–G, then repeat.', 'One fret = half step; two frets = whole step.', 'E–F and B–C are natural half steps.'],
    next: 'l2-sharps-flats',
    mastery: { quizPass: 0.75, criteria: ['Score at least 75%.', 'Name every note on the low E string up to fret 12.'] },
    unlocks: { trainerModes: ['find-note', 'string-nav'] },
  },
  {
    id: 'l2-sharps-flats', level: 2, module: 'm2-notes', title: 'Sharps, flats and enharmonic equivalents', minutes: 15,
    objectives: ['Explain sharp (♯) and flat (♭)', 'Recognise enharmonic equivalents such as C♯ = D♭', 'Know when to use sharp or flat names'],
    prerequisites: ['l2-musical-alphabet'], categories: ['theory', 'fretboard'], sources: [src.P('Accidentals and enharmonic spelling')],
    why: 'The same fret can have two names. Knowing which name to use keeps scales and chords readable and makes theory click.',
    explanation: [
      p('A sharp (♯) raises a note by a half step; a flat (♭) lowers it by a half step. The fret between F and G can be called F♯ or G♭. Two names for the same sound are called enharmonic equivalents.'),
      p('Which name is right depends on context. In a scale, each letter appears once: the G major scale is G A B C D E F♯ (not G♭, because G is already used). The F major scale is F G A B♭ C D E (not A♯, because A is already used).'),
      theory('There are rarer spellings too: E♯ (= F), C♭ (= B), and double sharps or flats in some keys and chords. The theory engine in this app always spells notes correctly for their key.'),
    ],
    guitar: [
      p('On the A string, play fret 1 and say both names: "A-sharp or B-flat." Do the same for every fret that is not a natural note up to fret 12.'),
      tip('In settings you can choose whether the fretboard shows sharps or flats by default.'),
    ],
    exercise: { title: 'Two names, one fret', steps: ['On the D string, find all five notes that have two names between frets 0 and 12.', 'Use the Fretboard Trainer in "Name the note" mode with Stage 2.'] },
    mistakes: ['Writing a scale with two versions of the same letter (G♭ and G).', 'Thinking sharps and flats are different pitches on the guitar.'],
    selfCheck: ['I can give both names of every sharp/flat note.'],
    quiz: [
      q('l2s-1', 'What is the enharmonic equivalent of D♯?', ['E', 'E♭', 'D♭', 'C♯'], 1, 'D♯ and E♭ are the same pitch.'),
      q('l2s-2', 'In the F major scale, the fourth note is…', ['A♯', 'B♭', 'B', 'C'], 1, 'Each letter appears once: F G A B♭ C D E.'),
      q('l2s-3', 'A flat lowers a note by…', ['A whole step', 'A half step', 'An octave', 'A quarter tone'], 1, 'Flat = down one half step (one fret).'),
    ],
    realWorld: 'Chord charts say B♭ and F♯, not A♯ and G♭, because they follow key spelling. Reading them confidently comes from this lesson.',
    summary: ['♯ raises, ♭ lowers by a half step.', 'Enharmonic = same pitch, different name.', 'Scales use each letter once.'],
    next: 'l2-root-strings',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.'] },
  },
  {
    id: 'l2-root-strings', level: 2, module: 'm2-notes', title: 'Notes on the E and A strings (root strings)', minutes: 25,
    objectives: ['Know every natural note on the low E and A strings to fret 12', 'Use landmark frets 3, 5, 7, 9 and 12', 'Name power chords and barre chords by their root'],
    prerequisites: ['l2-sharps-flats'], categories: ['fretboard'], sources: [src.A('The low E and A strings'), src.C('Root of barre chords on the 6th and 5th strings'), src.P('Landmark method')],
    why: 'Almost every movable shape (power chords, barre chords, scale patterns) is named after its root on the E or A string. Learn these two strings first.',
    explanation: [
      p('Landmarks make memorising fast. On the low E string: fret 3 = G, 5 = A, 7 = B, 8 = C, 10 = D, 12 = E. On the A string: fret 2 = B, 3 = C, 5 = D, 7 = E, 8 = F, 10 = G, 12 = A.'),
      p('The inlay dots help: fret 5 on the E string is A, the same note as the open A string. Fret 5 on the A string is D, the open D string. That relationship (fret 5 = next open string) works on every pair of strings except G→B, which you will see in the next module.'),
      table(['Fret', '3', '5', '7', '8', '10', '12'], [['E string', 'G', 'A', 'B', 'C', 'D', 'E'], ['A string', 'C', 'D', 'E', 'F', 'G', 'A']], 'Landmarks on the root strings.'),
    ],
    guitar: [
      fb('E', { notes: ['E', 'F', 'G', 'A', 'B', 'C', 'D'], maxFret: 12, labels: 'note', caption: 'Focus only on the bottom two strings first.' }),
      p('Practise: name a power chord, find its root on the E string, play it, then find the same chord with its root on the A string. For example, C5 is at fret 8 on the E string or fret 3 on the A string.'),
    ],
    exercise: { title: 'Root hunt', steps: ['Play the natural notes on the E string up and down, naming them.', 'Same on the A string.', 'Fretboard Trainer: "Note on a string" restricted to strings 6 and 5, until you reach 90% accuracy.'] },
    mistakes: ['Counting every fret from the nut instead of using landmarks.', 'Relying on a single position for each note.'],
    selfCheck: ['I can find any natural note on the E and A strings in under 3 seconds.'],
    quiz: [
      q('l2r-1', 'What note is at fret 7 on the low E string?', ['A', 'B', 'C', 'D'], 1, 'Landmark: fret 7 on the E string is B.'),
      q('l2r-2', 'Where is C on the A string (below fret 12)?', ['Fret 1', 'Fret 3', 'Fret 5', 'Fret 8'], 1, 'A (0), B (2), C (3).'),
      q('l2r-3', 'A power chord rooted at fret 10 of the E string is…', ['C5', 'D5', 'E5', 'G5'], 1, 'Fret 10 on the low E is D.'),
      q('l2r-4', 'Fret 5 on the A string has the same pitch as…', ['The open D string', 'The open G string', 'The open E string', 'Fret 7 on the D string'], 0, 'In standard tuning, fret 5 of one string equals the next open string (except G→B).'),
    ],
    realWorld: 'When a bandmate says "the riff is in D, starting on the 10th fret," you can find it instantly.',
    summary: ['Learn landmarks, not every fret.', 'Fret 5 = next open string (except G→B).', 'Movable shapes are named after these roots.'],
    next: 'l2-octaves',
    mastery: { quizPass: 0.75, criteria: ['Score at least 75%.', 'Reach 90% in the Fretboard Trainer on strings 6 and 5 (frets 0–12, naturals).'] },
  },
  {
    id: 'l2-octaves', level: 2, module: 'm2-navigation', title: 'Octave shapes and finding every note', minutes: 25,
    objectives: ['Use octave shapes to find a note on every string', 'Understand why the G–B string pair shifts the shape', 'Find all occurrences of a note across the neck'],
    prerequisites: ['l2-root-strings'], categories: ['fretboard'], sources: [src.P('Octave-shape fretboard navigation')],
    why: 'Octave shapes let you jump from a note you know to the same note elsewhere, which is the fastest route to knowing the entire fretboard.',
    explanation: [
      p('An octave is the same note name 12 half steps higher. On the guitar you can reach many octaves with fixed shapes. From a note on the E or A string, the octave is two strings higher and two frets higher. From the D or G string, crossing the B string adds one fret: two strings higher, three frets higher.'),
      p('Another common shape goes three strings higher and three frets lower (E string to G string), again plus one fret if the jump crosses the G–B pair.'),
      theory('Standard tuning is built from perfect 4ths (5 half steps) between strings, except G to B, which is a major 3rd (4 half steps). Every shape that crosses that pair moves up one fret to compensate. This same "B-string shift" appears in Pillitiere\'s scale system in Level 6.'),
      fb('G', { notes: ['G'], maxFret: 17, labels: 'note', caption: 'Every G between frets 0 and 17. Trace the octave shapes linking them.' }),
    ],
    guitar: [
      tab(`
e|---------------3--|
B|----------8-------|
G|------------------|
D|-----5------------|
A|-------------10---|
E|-3----------------|`, 'Gs linked by octave shapes: low E fret 3 → D string fret 5 (two strings up, two frets up); D fret 5 → B fret 8 (two strings up, three frets up: the G–B shift); A fret 10 is the same pitch as D fret 5; high E fret 3 is the same pitch as B fret 8.'),
    ],
    exercise: { title: 'Find all the Gs', steps: ['Starting on the low E string fret 3, use octave shapes to find every G up to fret 17.', 'Repeat for C, then for F♯.', 'Fretboard Trainer: "Find every occurrence" and "Octave shapes" modes.'] },
    mistakes: ['Forgetting the extra fret when crossing the G–B pair.', 'Only knowing one octave shape.'],
    selfCheck: ['I can find every occurrence of a note between frets 0 and 12 in under 15 seconds.'],
    quiz: [
      q('l2o-1', 'From the A string, the octave two strings higher is…', ['Two frets higher', 'Three frets higher', 'Two frets lower', 'The same fret'], 0, 'From E or A string: two strings up, two frets up.'),
      q('l2o-2', 'From the D string, the octave two strings higher (on the B string) is…', ['Two frets higher', 'Three frets higher', 'One fret higher', 'Two frets lower'], 1, 'Crossing the G–B pair adds one fret: three frets higher.'),
      q('l2o-3', 'Why do shapes shift by one fret around the B string?', ['The B string is thicker', 'G to B is a major 3rd, not a perfect 4th', 'Frets are wider there', 'It does not shift'], 1, 'All other adjacent strings are a 4th apart; G–B is a 3rd.'),
    ],
    realWorld: 'Octave shapes are also a sound: guitarists play melodies in octaves for a big, fat lead tone. You will use that in Level 9.',
    summary: ['Octave shapes link the same note across strings.', 'Add one fret when crossing the G–B pair.', 'Use them to find every note fast.'],
    next: 'l2-tuning-relationships',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.', 'Find all Gs, Cs and F♯s on the neck using octave shapes.'] },
    unlocks: { trainerModes: ['find-all', 'octaves'] },
  },
  {
    id: 'l2-tuning-relationships', level: 2, module: 'm2-navigation', title: 'Standard tuning relationships and fretboard navigation', minutes: 20,
    objectives: ['Tune string to string using the 5th-fret method', 'Understand how alternate tunings change note locations', 'Navigate all strings to fret 12'],
    prerequisites: ['l2-octaves'], categories: ['fretboard', 'ear'], sources: [src.C('Drop D tuning'), src.P('Relative tuning and tuning systems')],
    why: 'Understanding how strings relate lets you tune without a tuner, read music in any tuning, and see why shapes behave the way they do.',
    explanation: [
      p('Relative tuning: with the low E in tune, fret 5 of the E string should match the open A. Fret 5 of A matches open D, fret 5 of D matches open G, fret 4 of G matches open B, and fret 5 of B matches open high E.'),
      p('Alternate tunings change these relationships. In Drop D the low string is lowered a whole step to D, so its notes move two frets higher than in standard (D is open, E is at fret 2). In E♭ standard every string is a half step lower but the relationships stay the same, so all shapes still work.'),
      warn('The Fretboard, Scale Explorer, Tab Editor and Trainer all follow your selected tuning, including 7- and 8-string tunings and your own custom tunings. If notes look wrong, check the tuning selector.'),
    ],
    guitar: [
      steps('Tune the low E with the tuner, then tune the other strings by ear with the 5th-fret method.', 'Check your result with the tuner and note which strings were off.', 'Switch the Fretboard to Drop D and compare where the notes on the lowest string moved.'),
    ],
    exercise: { title: 'Ear tuning and tuning maps', steps: ['Relative-tune all strings, then check with the tuner.', 'In the Fretboard view, show natural notes in standard tuning, then in Drop D and Open G. Describe what changed.'] },
    mistakes: ['Using fret 5 on the G string (it should be fret 4) when relative tuning.', 'Assuming chord shapes work unchanged in open tunings.'],
    selfCheck: ['I can tune by ear to within 10 cents of the tuner.', 'I can explain how Drop D changes the lowest string.'],
    quiz: [
      q('l2t-1', 'To relative-tune the B string, you match it to which fret of the G string?', ['Fret 3', 'Fret 4', 'Fret 5', 'Fret 7'], 1, 'G to B is four half steps, so use fret 4.'),
      q('l2t-2', 'In Drop D, where is the note E on the lowest string?', ['Open', 'Fret 1', 'Fret 2', 'Fret 4'], 2, 'D up a whole step is E: fret 2.'),
      q('l2t-3', 'In E♭ standard tuning, standard chord shapes…', ['Do not work', 'Work, but sound a half step lower', 'Sound a half step higher', 'Need a capo'], 1, 'All strings drop equally, so shapes are unchanged but lower in pitch.'),
    ],
    realWorld: 'Many famous recordings use E♭ standard or Drop D. Knowing what a tuning changes lets you play along correctly.',
    summary: ['5th-fret method (4th fret on G).', 'Alternate tunings move notes on retuned strings.', 'All app tools follow your tuning.'],
    next: 'l2-pitch',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.', 'Relative-tune all strings within 10 cents.'] },
  },
  {
    id: 'l2-pitch', level: 2, module: 'm2-navigation', title: 'Introduction to pitch recognition', minutes: 15,
    objectives: ['Match a heard pitch on the guitar', 'Tell higher from lower and same from different', 'Start daily ear training'],
    prerequisites: ['l2-musical-alphabet'], categories: ['ear'], sources: [src.P('Ear-training foundations')],
    why: 'Your ear guides everything: tuning, learning songs, improvising. Like the fingers, it improves with short, regular practice.',
    explanation: [
      p('Pitch matching means hearing a note and finding it on the guitar. Start by deciding direction: is the target higher or lower than the note you are playing? Then move in that direction one fret at a time until the two notes merge and the "beating" (a wobble when two pitches are close) disappears.'),
      p('Singing helps enormously. Humming a note before you play it connects your ear and your hands.'),
    ],
    guitar: [
      steps('Open the Tuner and use reference-tone mode to play a pitch.', 'Find it on the guitar by ear, then confirm with the tuner.', 'Open Ear Training → Relative pitch and Intervals (level 1).'),
    ],
    exercise: { title: 'Five minutes of ears', steps: ['Do 20 interval questions at level 1.', 'Do 10 relative-pitch questions.', 'Hum the low E string, then play it to check.'] },
    mistakes: ['Guessing instead of listening for the beating to stop.', 'Skipping ear training because it feels hard; it gets easier quickly.'],
    selfCheck: ['I can match a pitch within the first 5 frets of one string.'],
    quiz: [
      q('l2p-1', 'When two nearly identical pitches sound together you hear…', ['Silence', 'A wobbling "beat"', 'An octave', 'Distortion'], 1, 'Close frequencies interfere and create audible beating that slows as they converge.'),
      q('l2p-2', 'The first step in matching a pitch is…', ['Guess a fret', 'Decide if it is higher or lower than your note', 'Turn up the gain', 'Play a chord'], 1, 'Direction first, then move by half steps.'),
    ],
    realWorld: 'Learning songs by ear, finding a singer\'s key and jamming all start with pitch recognition.',
    summary: ['Decide direction, then move by half steps.', 'Listen for beating to disappear.', 'Hum and sing to train the ear.'],
    next: 'l3-pitch-intervals',
    mastery: { quizPass: 1, criteria: ['Answer both questions correctly.', 'Complete 20 level-1 interval questions with 70% or more.'] },
  },
];
