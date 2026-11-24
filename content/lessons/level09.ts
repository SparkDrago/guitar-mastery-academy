import type { Lesson } from '@gma/learning';
import { p, list, steps, tip, warn, theory, tab, table, q, src } from '../helpers';

export const LEVEL_9: Lesson[] = [
  {
    id: 'l9-picking-systems', level: 9, module: 'm9-picking', title: 'Picking systems: strict alternate, economy, directional; escape motions', minutes: 40,
    objectives: ['Compare strict alternate, economy and directional picking', 'Understand inside and outside string changes', 'Identify your escape motion and choose fingerings that suit it'],
    prerequisites: ['l1-alternate-picking', 'l6-pillitiere-shapes', 'l4-metal-rhythm'], categories: ['technique'], sources: [src.P('Picking mechanics: escape motions, string changes, economy and directional picking')],
    why: 'At speed, string changes are where picking breaks down. Knowing the mechanics lets you pick the right system for each phrase and practise efficiently instead of fighting your own hand.',
    explanation: [
      p('Strict alternate picking always alternates, regardless of string changes. Economy picking uses alternate picking on a string but, when moving to the next string in the same direction, continues with the same stroke (a mini sweep). Directional picking is a broader idea: choose stroke directions so that every string change moves the pick in the direction it is already travelling.'),
      p('Inside picking: the pick changes strings between them (a downstroke on the lower string followed by an upstroke on the higher string, crossing "inside" the pair). Outside picking: the pick goes around the outside of the two strings. Most players find one of these easier.'),
      p('Escape motion: to move between strings, the pick must leave the plane of the strings after a stroke. Many players naturally escape on downstrokes (downstroke escape, "DSX"), others on upstrokes ("USX"), some both. Fingerings with an even number of notes per string suit one escape; 3NPS fingerings combine naturally with economy picking.'),
      table(['System', 'Strengths', 'Watch out for'], [['Strict alternate', 'Rhythmic consistency, simple rule', 'Awkward inside/outside changes'], ['Economy', 'Efficient on 3NPS scales and sweeps', 'Uneven rhythm if the sweep rushes'], ['Directional / mixed', 'Optimises each string change', 'Requires planning']]),
      warn('No system is "correct." Measure: if a pattern stays clean at higher tempos with one system, that is the right system for you and that phrase.'),
    ],
    guitar: [
      tab(`
e|----------------------------|
B|-------5-7-8-----------------|
G|-5-7-9-------9-7-5-----------|`, 'Original 3NPS fragment: try strict alternate (D U D | U D U), then economy (D U D | D U D with a sweep across the change).'),
    ],
    exercise: { title: 'Find your system', steps: ['Play the fragment with strict alternate picking at 80 BPM sixteenths, then economy picking.', 'Practise a two-string inside-picking pattern, then an outside one, and note which is cleaner at 100 BPM.', 'Technique Lab: inside/outside picking exercise; log your clean tempo for each.'], exerciseId: 'ex-alt-inside-outside' },
    metronome: { bpmStart: 70, bpmTarget: 130, subdivision: 4, instructions: 'Sixteenths. Raise tempo only after two clean takes.' },
    mistakes: ['Assuming strict alternate is always superior.', 'Economy sweeps that rush the rhythm.', 'Large pick motions that hide the real escape issue.'],
    selfCheck: ['I know whether inside or outside picking is easier for me.', 'I can play a 3NPS run with both strict alternate and economy picking.'],
    quiz: [
      q('l9p-1', 'Economy picking differs from strict alternate picking because…', ['It never uses upstrokes', 'It continues the same stroke direction when moving to the next string in that direction', 'It uses fingers', 'It only works on one string'], 1, 'It sweeps across string changes in the direction of travel.'),
      q('l9p-2', '"Outside picking" means the pick…', ['Changes strings between them', 'Travels around the outside of the two strings', 'Plays only outer strings', 'Uses hybrid picking'], 1, 'Outside = around the pair rather than between.'),
      q('l9p-3', 'An escape motion is…', ['Muting technique', 'The pick leaving the string plane after a stroke so it can change strings', 'A slide', 'A pull-off'], 1, 'Without escaping, the pick would hit the next string mid-motion.'),
    ],
    realWorld: 'Players famous for fast picking each built a system around their natural escape motion. Measuring your own is the shortcut.',
    summary: ['Three systems: strict, economy, directional.', 'Inside vs outside string changes.', 'Match fingerings to your escape motion.'],
    next: 'l9-speed-system',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-alt-inside-outside', bpm: 100 }, criteria: ['Score at least 2 of 3.', 'Log a clean inside/outside picking take at 100 bpm sixteenths.'] },
  },
  {
    id: 'l9-speed-system', level: 9, module: 'm9-picking', title: 'A measurable speed-development system', minutes: 40,
    objectives: ['Establish a clean baseline tempo', 'Use BPM ladders, bursts and rest to build speed', 'Track BPM and timing accuracy over time'],
    prerequisites: ['l9-picking-systems'], categories: ['technique', 'rhythm'], sources: [src.P('Speed-development methodology')],
    why: 'Speed is a consequence of accuracy, relaxation and coordination, not of forcing. A measurable system prevents plateaus and protects your hands.',
    explanation: [
      steps('Baseline: find the fastest tempo at which you play an exercise perfectly five times in a row, relaxed. Log it.', 'Ladder: practise at 85% of baseline for accuracy, then step up 3–5 BPM per clean take. When two takes fail, drop 8–10 BPM.', 'Bursts: play short bursts (one beat or four notes) well above your baseline, then stop. Bursts teach the motion at speed without endurance strain.', 'Synchronisation: play slowly with exaggerated precision, checking that fretting and picking land together (the Playing Analyzer measures timing).', 'Endurance: once clean, extend the duration at a comfortable tempo (30 s → 60 s → 2 min).', 'Rest: take breaks every 20–25 minutes and stop at any pain.'),
      p('The Technique Lab and Practice Studio log every take\'s tempo and whether it was clean. The scheduler raises your target by 4 BPM after two clean takes and lowers it after a struggle, which is the ladder applied automatically.'),
      theory('Tension is the speed killer. At the edge of your speed, focus on the most relaxed motion possible, not the hardest attack.'),
    ],
    guitar: [
      tab(`
e|-------------------------------|
B|-------------------------------|
G|-------------------------------|
D|-------------------------------|
A|-------------------------------|
E|-5-6-7-8-5-6-7-8-5-6-7-8-5-6-7-8-|`, 'A simple four-note group for bursts: play one group as fast as possible cleanly, then stop.'),
    ],
    exercise: { title: 'Ladder and bursts', steps: ['Find your clean baseline on the Synchronisation exercise and log it.', 'Run a ladder from 85% upward until two failed takes.', 'Do 10 bursts of one beat at baseline + 20 BPM.'], exerciseId: 'ex-sync-burst' },
    metronome: { bpmStart: 80, bpmTarget: 160, subdivision: 4, instructions: 'Use tap tempo to set your baseline, then the presets to step up.' },
    mistakes: ['Practising at maximum speed every session.', 'Ignoring timing accuracy because notes "felt" fast.', 'Practising through pain.'],
    selfCheck: ['I have a logged baseline for at least three exercises.', 'My progress chart shows a rising clean tempo.'],
    quiz: [
      q('l9s-1', 'What is a clean baseline?', ['The fastest tempo you can attempt', 'The fastest tempo you play perfectly several times in a row, relaxed', 'Always 120 BPM', 'The slowest tempo'], 1, 'Baseline = reliable, relaxed, clean speed.'),
      q('l9s-2', 'Speed bursts are useful because…', ['They build endurance', 'They teach the motion at high speed without long strain', 'They replace slow practice', 'They improve tone'], 1, 'Short bursts at speed train the motion safely.'),
      q('l9s-3', 'After two failed takes in a ladder you should…', ['Keep going faster', 'Drop 8–10 BPM', 'Stop practising for the week', 'Switch to a thinner pick'], 1, 'Return to accuracy before climbing again.'),
    ],
    realWorld: 'Professional shredders track tempos and practise systematically. This turns "practice until you improve" into measurable progress.',
    summary: ['Baseline → ladder → bursts → endurance.', 'Measure clean tempo and timing.', 'Relaxation is speed.'],
    next: 'l9-legato-advanced',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-sync-burst', bpm: 110 }, criteria: ['Score at least 2 of 3.', 'Log a clean take at 110 bpm sixteenths.'] },
  },
  {
    id: 'l9-legato-advanced', level: 9, module: 'm9-techniques', title: 'Three-notes-per-string legato and finger independence', minutes: 35,
    objectives: ['Play 3NPS legato runs with even volume', 'Build finger independence and strength', 'Increase legato endurance'],
    prerequisites: ['l5-legato', 'l6-pillitiere-patterns'], categories: ['technique'], sources: [src.D('3NPS shapes provide consistent left-hand fingerings'), src.P('Legato technique')],
    why: 'Legato gives fluid, saxophone-like lines and lets you play fast with little picking. Pillitiere\'s X/Y/Z shapes are ideal legato units.',
    explanation: [
      p('In 3NPS legato, pick only the first note on each string, then hammer on (ascending) or pull off (descending) the other two. Each Pillitiere shape (X, Y, Z) becomes a three-note legato cell with consistent fingering.'),
      p('Hammer-ons from nowhere (hammering a note on a new string without picking) allow fully legato lines. Mute idle strings with the fretting hand\'s underside and the picking-hand palm.'),
      list('Finger independence: play 1-3-2-4 and 1-4-2-3 permutations on one string.', 'Strength: trill pairs (1-2, 1-3, 1-4, 2-3, 2-4, 3-4) for 15 seconds each.', 'Endurance: play a 3NPS scale up and down legato for 1 minute without volume drop.'),
    ],
    guitar: [
      tab(`
e|-------------------------------------7h8h10--|
B|-----------------------------6h8h10----------|
G|----------------------5h7h9------------------|
D|---------------5h7h9-------------------------|
A|--------5h7h8--------------------------------|
E|-5h7h8---------------------------------------|`, 'A natural-minor 3NPS legato run (A minor = C major from degree 6, so the shapes are Z Z X X X Y). Pick only the first note on each string.'),
    ],
    exercise: { title: 'Legato engine', steps: ['Trill each finger pair for 15 s.', 'Play the 3NPS legato run up and down at a steady tempo.', 'Technique Lab: 3NPS legato exercise; log clean tempo.'], exerciseId: 'ex-legato-3nps' },
    metronome: { bpmStart: 60, bpmTarget: 120, subdivision: 3, instructions: 'Triplets: one string per beat.' },
    mistakes: ['Volume drop on hammered notes.', 'Unmuted strings ringing during legato.', 'Pull-offs that lift straight up.'],
    selfCheck: ['All three notes per string are equally loud.', 'Idle strings stay silent.'],
    quiz: [
      q('l9l-1', 'In 3NPS legato, how many notes per string are usually picked?', ['All three', 'One', 'Two', 'None ever'], 1, 'Pick the first, hammer or pull the others.'),
      q('l9l-2', 'A "hammer-on from nowhere" is…', ['A hammer-on on a new string without picking', 'A bend', 'A tap with the picking hand', 'A slide'], 0, 'It sounds a note on a new string purely by hammering.'),
    ],
    realWorld: 'Fluid rock and fusion legato lines are built from exactly these cells.',
    summary: ['One pick per string, the rest legato.', 'X/Y/Z shapes as legato cells.', 'Mute idle strings; keep volume even.'],
    next: 'l9-sweep',
    mastery: { quizPass: 1, practice: { exerciseId: 'ex-legato-3nps', bpm: 90 }, criteria: ['Answer both questions.', 'Log a clean 3NPS legato take at 90 bpm (triplets).'] },
  },
  {
    id: 'l9-sweep', level: 9, module: 'm9-techniques', title: 'Sweep picking and arpeggio sweeping', minutes: 40,
    objectives: ['Sweep a three-string triad cleanly', 'Roll fingers to keep notes separate', 'Extend to five-string arpeggios'],
    prerequisites: ['l9-picking-systems', 'l8-chord-tones'], categories: ['technique', 'chords'], sources: [src.P('Sweep picking')],
    why: 'Sweep picking plays arpeggios at high speed with a single raking motion. It requires solid picking coordination and arpeggio knowledge, which is why it comes after both.',
    explanation: [
      p('A sweep is one continuous pick motion across several strings, one note per string: a downward sweep for ascending notes, an upward sweep descending. The pick should "fall" through the strings with a controlled push, not a strum.'),
      p('The fretting hand must let each note sound and then mute it before the next, otherwise the arpeggio becomes a strummed chord. Rolling the fingertip across adjacent strings at the same fret, and releasing pressure after each note, keeps notes separate.'),
      warn('Practise sweeps slowly enough that each note is distinct. A blurry sweep at speed is worse than a clean one at half speed.'),
    ],
    guitar: [
      tab(`
e|-----------5---------------|
B|---------5---5-------------|
G|-------5-------5-----------|
D|-----7-----------7---------|
A|-5h8---------------8p5-----|`, 'Original five-string A minor arpeggio: downward sweep from D to e, upward sweep back, with legato on the A string.'),
      tab(`
e|-----8-------|
B|---8---8-----|
G|-9-------9---|`, 'Three-string C major triad: start here.'),
    ],
    exercise: { title: 'Sweep ladder', steps: ['Three-string triad sweep at 50 BPM triplets, checking note separation.', 'Five-string A minor arpeggio, very slowly.', 'Technique Lab: three-string then five-string sweep exercises.'], exerciseId: 'ex-sweep-3string' },
    metronome: { bpmStart: 50, bpmTarget: 120, subdivision: 3, instructions: 'Triplets suit three-string sweeps.' },
    mistakes: ['Notes ringing together like a strum.', 'Uneven rhythm: the sweep rushes.', 'Starting too fast.'],
    selfCheck: ['Every note of my three-string sweep is separate.'],
    quiz: [
      q('l9w-1', 'In a sweep, the pick…', ['Alternates strictly', 'Moves in one continuous motion across strings', 'Stays on one string', 'Is replaced by fingers'], 1, 'One stroke direction per sweep.'),
      q('l9w-2', 'The most common sweep problem is…', ['Notes ringing together', 'Too much vibrato', 'Wrong tuning', 'Thin picks'], 0, 'The fretting hand must mute each note after it sounds.'),
      q('l9w-3', 'Which skill should come before sweeping?', ['Tapping', 'Solid picking coordination and arpeggio knowledge', 'Whammy technique', 'Drop tuning'], 1, 'Sweeping depends on both.'),
    ],
    realWorld: 'Neoclassical and technical metal guitarists use sweeps for fast arpeggios.',
    summary: ['One motion per direction.', 'Separate notes with rolling and muting.', 'Slow and clean first.'],
    next: 'l9-tapping',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-sweep-3string', bpm: 80 }, criteria: ['Score at least 2 of 3.', 'Log a clean three-string sweep at 80 bpm triplets.'] },
  },
  {
    id: 'l9-tapping', level: 9, module: 'm9-techniques', title: 'Tapping and two-handed tapping', minutes: 35,
    objectives: ['Tap notes with the picking hand', 'Play triplet tapping patterns', 'Mute effectively while tapping'],
    prerequisites: ['l9-legato-advanced'], categories: ['technique'], sources: [src.P('Tapping technique')],
    why: 'Tapping extends legato to wide intervals and very fast note groups, a signature sound in rock and metal.',
    explanation: [
      p('Tap the string with the index or middle finger of the picking hand (holding the pick with the remaining fingers), then pull off to a fretted note, then pull off or hammer within the fretting hand. A classic pattern: tap 12, pull off to 5, hammer to 8, repeat, in triplets.'),
      p('Muting is crucial: the fretting hand\'s spare fingers mute strings below; the picking-hand palm mutes strings above. Some players use a fret wrap or hair tie at the nut while practising.'),
      tip('Pull off slightly downward (toward the floor) with the tapping finger to pluck the string, just like a fretting-hand pull-off.'),
    ],
    guitar: [
      tab(`
         T     T     T     T
B|-12p5h8-12p5h8-13p5h8-13p5h8-|`, 'Original triplet tapping cell on the B string (T = tap).'),
    ],
    exercise: { title: 'Tap triplets', steps: ['Tap 12-5-8 triplets on the B string at 60 BPM, focusing on evenness.', 'Move the tapped note to 13, 15 and 17 while keeping the fretted notes.', 'Technique Lab: one-string triplet tapping exercise.'], exerciseId: 'ex-tap-triplet' },
    metronome: { bpmStart: 60, bpmTarget: 140, subdivision: 3, instructions: 'One tap per beat.' },
    mistakes: ['Tapped note quieter than the others.', 'Open strings ringing.'],
    selfCheck: ['My tapping triplets are even and quiet strings stay silent.'],
    quiz: [
      q('l9t-1', 'In a tap–pull-off–hammer-on cell, the tapping finger…', ['Picks the string', 'Taps then pulls off to the fretted note', 'Bends the string', 'Mutes only'], 1, 'Tap, then pull off to sound the fretted note.'),
      q('l9t-2', 'Why is muting critical for tapping?', ['Tapping is quiet', 'Hammer and pull motions set other strings ringing', 'It changes the key', 'It is not critical'], 1, 'Legato motions excite idle strings.'),
    ],
    realWorld: 'Tapping licks are a hallmark of 1980s rock and modern technical metal.',
    summary: ['Tap, pull off, hammer.', 'Triplet cells for evenness.', 'Mute with both hands.'],
    next: 'l9-skipping-hybrid',
    mastery: { quizPass: 1, practice: { exerciseId: 'ex-tap-triplet', bpm: 90 }, criteria: ['Answer both questions.', 'Log a clean tapping take at 90 bpm.'] },
  },
  {
    id: 'l9-skipping-hybrid', level: 9, module: 'm9-techniques', title: 'String skipping and hybrid picking', minutes: 35,
    objectives: ['Skip strings accurately with alternate picking', 'Play wide-interval arpeggios', 'Combine pick and fingers (hybrid picking)'],
    prerequisites: ['l9-picking-systems'], categories: ['technique'], sources: [src.C('Hybrid picking in a blues turnaround'), src.P()],
    why: 'String skipping creates wide, modern intervals; hybrid picking lets you play country-style double stops, chicken pickin\' and clean arpeggios.',
    explanation: [
      p('String skipping means jumping over one or more strings between notes. Keep the pick motion small and aim for the target string; mute the skipped string with the palm.'),
      p('Hybrid picking holds the pick between thumb and index and uses the middle and ring fingers to pluck higher strings. It allows simultaneous notes on non-adjacent strings and snappy, percussive attacks.'),
    ],
    guitar: [
      tab(`
e|-------5-8-----------|
B|---------------------|
G|-5-7---------7-5-----|`, 'Original string-skipping figure (G to high E, skipping B).'),
      tab(`
e|---3-----3-----|
B|---------------|
G|-0-----0-------|
     m     m      (pick on G, middle finger on e)`, 'Hybrid-picking pattern.'),
    ],
    exercise: { title: 'Skip and pluck', steps: ['Octave skips: play notes on the E and D strings an octave apart, alternating, 2 minutes.', 'Play the skipping figure cleanly at 80 BPM.', 'Hybrid-pick G string with the pick and high E with the middle finger.'], exerciseId: 'ex-skip-octaves' },
    metronome: { bpmStart: 60, bpmTarget: 120, subdivision: 2, instructions: 'Eighths, then sixteenths.' },
    mistakes: ['Hitting the skipped string.', 'Fingers plucking too hard compared with the pick.'],
    selfCheck: ['I can skip strings at 100 BPM without hitting the wrong string.'],
    quiz: [
      q('l9h-1', 'Hybrid picking uses…', ['Only the pick', 'The pick plus the middle/ring fingers', 'Only the thumb', 'Tapping'], 1, 'Pick and fingers together.'),
      q('l9h-2', 'In string skipping, the skipped string should be…', ['Played lightly', 'Muted', 'Bent', 'Retuned'], 1, 'Mute it to avoid accidental noise.'),
    ],
    realWorld: 'Country, rockabilly and modern rock use hybrid picking; string-skipping arpeggios are common in rock solos.',
    summary: ['Small motions, accurate aim.', 'Mute skipped strings.', 'Pick + fingers = hybrid.'],
    next: 'l9-expressive',
    mastery: { quizPass: 1, practice: { exerciseId: 'ex-skip-octaves', bpm: 90 }, criteria: ['Answer both questions.', 'Log a clean string-skipping take at 90 bpm.'] },
  },
  {
    id: 'l9-expressive', level: 9, module: 'm9-techniques', title: 'Expressive tools: bend accuracy, pre-bends, vibrato control, harmonics, whammy, tremolo and trills', minutes: 40,
    objectives: ['Bend accurately to quarter, half, whole and 1½ steps', 'Use pre-bends and releases', 'Produce natural, pinch and artificial harmonics', 'Apply tremolo picking, trills, octaves and whammy techniques'],
    prerequisites: ['l5-bends-vibrato', 'l9-speed-system'], categories: ['technique'], sources: [src.C('Pre-bends, trills'), src.P('Advanced expressive techniques')],
    why: 'Technique becomes music through expression. These tools give you a personal voice: pitch inflection, shimmering harmonics and dramatic textures.',
    explanation: [
      table(['Technique', 'How'], [
        ['Pre-bend', 'Bend silently to the target pitch, pick, then release down. Accuracy depends on muscle memory: check against the target note.'],
        ['Bend accuracy', 'Practise ¼, ½, 1 and 1½ step bends against fretted target notes and the tuner.'],
        ['Vibrato control', 'Choose speed and width deliberately; synchronise with the tempo (e.g. eighth-note cycles).'],
        ['Natural harmonics', 'Touch the string lightly directly above frets 12, 7 or 5 and pick; lift immediately.'],
        ['Pinch harmonics', 'Let the side of the thumb graze the string just after the pick strikes; move along the string to find the squeal.'],
        ['Artificial harmonics', 'Fret a note, touch the string 12 frets higher with the picking-hand index and pluck with the thumb or ring finger.'],
        ['Tremolo picking', 'Rapid, even alternate picking of one note; relax the wrist and lock to sixteenths or thirty-seconds.'],
        ['Trills', 'Rapid hammer-pull between two frets.'],
        ['Octaves', 'Fret a note and its octave two strings up; mute the string between with the underside of the first finger.'],
        ['Whammy bar', 'Dips, dive-bombs, vibrato and flutter; keep the guitar in tune by returning the bar gently.'],
        ['Muting', 'Combine palm and fretting-hand muting for silence under high gain.'],
      ]),
      warn('Whammy techniques require a tremolo bridge. On fixed-bridge guitars, practise bends and vibrato instead.'),
    ],
    guitar: [
      tab(`
e|---------------------------------|
B|-<12>--<7>--<5>-----------8--10--|
G|-----------------7pb9~r7---------|
D|--------------------------5--7---|`, 'Natural harmonics at 12, 7 and 5; a pre-bend with vibrato and release; then octaves (D string + B string, G string muted).'),
    ],
    exercise: { title: 'Expression workout', steps: ['Bend fret 7 on the G string to ½, 1 and 1½ steps, checking with the tuner.', 'Play natural harmonics at 12, 7 and 5 on all strings.', 'Tremolo-pick one note for 30 seconds at 16ths, 120 BPM.', 'Technique Lab: tremolo and harmonics exercises.'], exerciseId: 'ex-tremolo' },
    metronome: { bpmStart: 80, bpmTarget: 160, subdivision: 4, instructions: 'Sixteenths for tremolo picking.' },
    mistakes: ['Flat bends and pre-bends.', 'Pressing too hard for harmonics (touch lightly).', 'Tense tremolo picking.'],
    selfCheck: ['My 1½-step bends are in tune.', 'I can produce pinch harmonics on demand.'],
    quiz: [
      q('l9e-1', 'A natural harmonic is produced by…', ['Fretting hard behind the fret', 'Lightly touching the string over the fret wire and picking', 'Bending', 'Tapping'], 1, 'Touch over frets 12, 7, 5 and pick.'),
      q('l9e-2', 'A pre-bend is…', ['Bending after picking', 'Bending before picking, then releasing', 'A slide', 'A whammy dip'], 1, 'Bend first, pick, then release.'),
      q('l9e-3', 'When playing octaves, the string between the two notes is…', ['Played', 'Muted by the fretting finger', 'Bent', 'Retuned'], 1, 'Mute it with the underside of the first finger.'),
    ],
    realWorld: 'Expressive control is what makes a guitarist recognisable after a single note.',
    summary: ['Accurate bends and controlled vibrato.', 'Three kinds of harmonics.', 'Tremolo, trills, octaves and whammy for texture.'],
    next: 'l10-motifs',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-tremolo', bpm: 120 }, criteria: ['Score at least 2 of 3.', 'Log a clean tremolo-picking take at 120 bpm.'] },
  },
];
