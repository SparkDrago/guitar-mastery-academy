import type { Lesson } from '@gma/learning';
import { p, list, steps, tip, warn, theory, tab, table, fb, pill, q, src, sourceNote } from '../helpers';

export const LEVEL_6: Lesson[] = [
  {
    id: 'l6-pillitiere-shapes', level: 6, module: 'm6-pillitiere', title: 'Three shapes, one system: X, Y and Z', minutes: 35,
    objectives: ['Explain why three notes per string gives consistent fingering', 'Recognise Pillitiere\'s three per-string shapes X, Y and Z', 'Know the 7-string shape cycle X X X Y Y Z Z'],
    prerequisites: ['l3-relative-minor', 'l5-pentatonic-positions'], categories: ['scales', 'fretboard', 'theory'], sources: [src.D('Starting out; finger shapes; horizontal order of shapes'), src.P('Three-notes-per-string fingering')],
    why: 'Scale books often show dozens of unrelated diagrams. Pillitiere shows that every diatonic 3NPS pattern is built from just three finger shapes in a fixed order. Learn the system and you can build any pattern instead of memorising it.',
    explanation: [
      p('Three notes per string (3NPS) means every string gets exactly three consecutive scale notes. Each string then needs the same kind of hand position, and the picking hand repeats a predictable pattern. Pillitiere suggests consistent fingering for both hands; with a pick, this translates naturally into strict alternate or economy picking.'),
      p('A major scale is made of whole steps and half steps. Three consecutive notes can only be spaced in three ways, and those are the three shapes:'),
      table(['Shape', 'Steps', 'Frets (relative)', 'Fingers'], [['X', 'whole – whole', '0 – 2 – 4', '1 – 2 – 4'], ['Y', 'half – whole', '0 – 1 – 3', '1 – 2 – 4'], ['Z', 'whole – half', '0 – 2 – 3', '1 – 3 – 4']]),
      p('Now the key insight. Imagine a guitar with unlimited strings tuned in 4ths. Playing the major scale 3NPS up across them, the shapes always appear in the same repeating order: X X X Y Y Z Z, then X X X again. The cycle is seven strings long because 7 strings × 3 notes = 21 notes = exactly three octaves of the seven-note scale.'),
      theory('Why that order? The three-note group starting on degree 1, 4 or 5 is whole–whole (X); starting on 7 or 3 is half–whole (Y); starting on 6 or 2 is whole–half (Z). Each new string starts four scale steps higher, so the starting degrees run 5, 1, 4, 7, 3, 6, 2, which gives X X X Y Y Z Z.'),
      sourceNote('This X/Y/Z model and the cycle come from Michael Pillitiere\'s Building the Better Guitar Scale. The app\'s theory engine re-derives the cycle mathematically, and an automated test confirms that it reproduces every 3NPS pattern in every key.'),
    ],
    guitar: [
      p('Play each shape on one string at the 5th fret: X = 5-7-9, Y = 5-6-8, Z = 5-7-8, using the fingers in the table. Then play the six-string pattern below, which shows X X Y Y Z Z, the window of the cycle that starts on degree 1.'),
      pill('G', 1, 'G major from degree 1 on the low E (fret 3): shapes X X Y Y Z Z.'),
    ],
    exercise: { title: 'Feel the shapes', steps: ['Play X, Y and Z on each string with the stated fingers until the shapes feel distinct.', 'Play the G major pattern above, saying the shape letter for each string.', 'Write out the cycle XXXYYZZ from memory and mark the six-string window for degree 1.'], exerciseId: 'ex-alt-3nps' },
    metronome: { bpmStart: 60, bpmTarget: 100, subdivision: 3, instructions: 'Triplets: one string per beat makes the 3NPS grouping audible.' },
    mistakes: ['Using finger 3 for the top note of X (it is a 4-fret stretch: use finger 4).', 'Memorising patterns as pictures instead of shape sequences.'],
    selfCheck: ['I can play and name X, Y and Z.', 'I can recite the cycle X X X Y Y Z Z.'],
    quiz: [
      q('l6x-1', 'Shape Y is…', ['whole–whole', 'half–whole', 'whole–half', 'half–half'], 1, 'Y = half step then whole step (frets 0-1-3).'),
      q('l6x-2', 'The repeating 7-string order of shapes is…', ['X Y Z X Y Z X', 'X X X Y Y Z Z', 'X X Y Y Z Z Z', 'Z Z Y Y X X X'], 1, 'X X X Y Y Z Z.'),
      q('l6x-3', 'Why does the cycle repeat every seven strings?', ['Guitars have seven strings', '7 strings × 3 notes = 21 notes = three full octaves of a 7-note scale', 'There are seven shapes', 'It is arbitrary'], 1, 'After 21 notes the scale starts again on the same degree.'),
      q('l6x-4', 'Which fingers play shape Z?', ['1-2-4', '1-3-4', '1-2-3', '2-3-4'], 1, 'Z (whole–half): 1-3-4.'),
    ],
    realWorld: 'Fusion and shred players rely on 3NPS fingering for fast scale runs. This system makes every position available without memorising pages of diagrams.',
    summary: ['3NPS gives both hands a consistent pattern.', 'Three shapes: X (W-W), Y (H-W), Z (W-H).', 'They cycle X X X Y Y Z Z.'],
    next: 'l6-pillitiere-patterns',
    mastery: { quizPass: 0.75, practice: { exerciseId: 'ex-alt-3nps', bpm: 80 }, criteria: ['Score at least 75%, including generated shape questions.', 'Log a clean 3NPS take at 80 bpm.'] },
  },
  {
    id: 'l6-pillitiere-patterns', level: 6, module: 'm6-pillitiere', title: 'Building every pattern from two facts', minutes: 40,
    objectives: ['Apply the two vertical shift rules', 'Build any of the seven patterns from its starting degree and first two shapes', 'Start patterns on the 6th, 5th or 4th string'],
    prerequisites: ['l6-pillitiere-shapes'], categories: ['scales', 'fretboard'], sources: [src.D('Vertical order of shapes; building patterns; beginning patterns on different strings; practice'), src.P()],
    why: 'With two shift rules and one small chart, you can construct any major-scale pattern on the spot, in any key, from any string. That is fretboard freedom without memorisation.',
    explanation: [
      p('The shapes tell you where notes fall within a string. Two rules tell you where the first finger lands on the next string:'),
      list('Rule 1: moving from an X string to a Y string, the first finger moves up one fret.', 'Rule 2: crossing from the 3rd (G) string to the 2nd (B) string, the first finger moves up one fret, because G–B is a major 3rd instead of a perfect 4th.', 'Otherwise the first finger stays at the same fret. When both rules apply at once, the shifts add up (two frets).'),
      p('To build a pattern you need only two facts: which scale degree you start on, and the first two shapes. Everything else follows from the cycle and the rules.'),
      table(['Start degree', '1', '2', '3', '4', '5', '6', '7'], [['First shapes', 'XX', 'ZX', 'YZ', 'XY', 'XXX', 'ZZ', 'YY']], 'Degrees 1 and 5 both begin with X X. Degree 5 begins with three Xs.'),
      p('Worked example: G major starting on the 7th fret of the low E string. That note is B, degree 3 of G major, so the pattern begins Y Z, then continues the cycle: Y Z Z X X X. Apply the rules string by string and the whole pattern appears.'),
      theory('The app generalises Rule 2 for other tunings: the first finger shifts by (5 − the interval between the strings in semitones). This is an extension of Pillitiere\'s method and is labelled as such in the Scale Explorer.'),
    ],
    guitar: [
      pill('G', 3, 'G major from degree 3 (B at fret 7): Y Z Z X X X. Watch the shifts at G→B and X→Y.'),
      pill('C', 1, 'C major from degree 1 on the A string (fret 3): the same rules work from any string.'),
      tip('Open the Scale Explorer\'s Pattern Builder. Choose a key and starting degree, then step through the strings: it shows each shape and which rule moved the finger.'),
    ],
    exercise: { title: 'Build it, don\'t recall it', steps: ['Pick a random key and degree; build the pattern mentally before checking it in the Pattern Builder.', 'Pillitiere\'s drill: choose one note (say A) and play every major scale that contains it, starting from that note, then their relative minors.', 'Play one scale (C major) in every position from the 6th string, then from the 5th.'] },
    mistakes: ['Forgetting that Rule 1 and Rule 2 can add together (two frets).', 'Applying Rule 2 at the wrong string pair.', 'Confusing degree-5 (XXX) with degree-1 (XX) patterns.'],
    selfCheck: ['I can build any pattern from the chart in under 20 seconds.', 'I can start a pattern on the 5th string.'],
    quiz: [
      q('l6y-1', 'Moving from an X string to a Y string, the first finger…', ['Stays put', 'Moves up one fret', 'Moves down one fret', 'Moves up two frets'], 1, 'Rule 1: X → Y shifts up one fret.'),
      q('l6y-2', 'A pattern starting on degree 6 begins with…', ['XX', 'YZ', 'ZZ', 'XY'], 2, 'Degree 6 → Z Z.'),
      q('l6y-3', 'G major starting on fret 7 of the low E string starts on degree…', ['1', '2', '3', '5'], 2, 'Fret 7 on low E is B, the 3rd of G.'),
      q('l6y-4', 'When moving X → Y AND crossing from G to B, the first finger moves up…', ['0 frets', '1 fret', '2 frets', '3 frets'], 2, 'The two shifts accumulate.'),
    ],
    realWorld: 'When the key changes mid-jam, you can build the new scale wherever your hand already is, instead of jumping back to a memorised box.',
    summary: ['Two shift rules place the shapes vertically.', 'Start degree + first two shapes = the whole pattern.', 'Works from any string and any key.'],
    next: 'l6-caged',
    mastery: { quizPass: 0.75, criteria: ['Score at least 75%, including generated Pattern Builder questions.', 'Build three random patterns correctly without help.'] },
  },
  {
    id: 'l6-caged', level: 6, module: 'm6-systems', title: 'The CAGED system: chord shapes to scale positions', minutes: 35,
    objectives: ['Recognise the C, A, G, E and D chord shapes as movable forms', 'Link each chord shape to a surrounding scale position', 'Compare CAGED with 3NPS'],
    prerequisites: ['l6-pillitiere-shapes', 'l1-open-chords'], categories: ['scales', 'chords', 'fretboard'], sources: [src.P('CAGED system')],
    why: 'CAGED connects chords, arpeggios and scales in five overlapping zones. It complements 3NPS: 3NPS is ideal for speed and consistency, CAGED for seeing chord tones and playing over changes.',
    explanation: [
      p('The open chord shapes C, A, G, E and D can each be moved up the neck (the nut replaced by a barre or by your first finger). For any major chord there are five shapes, and in the order C-A-G-E-D they link up the neck, each sharing notes with the next.'),
      p('Each chord shape has a scale position around it. Playing the major scale in that position keeps the chord tones under your fingers, which is very useful for soloing over chord changes.'),
      table(['Shape', 'Root string', 'Example (C major)'], [['C shape', 'A string (with root also on B)', 'Open position'], ['A shape', 'A string', 'Barre at fret 3'], ['G shape', 'Low E string', 'Around frets 5–8'], ['E shape', 'Low E string', 'Barre at fret 8'], ['D shape', 'D string', 'Around frets 10–13']]),
      warn('CAGED relies on standard-tuning intervals. In Drop D or open tunings the shapes change; the Scale Explorer hides CAGED when the tuning is not standard-interval.'),
    ],
    guitar: [
      fb('C', { scale: 'major', minFret: 0, maxFret: 15, labels: 'degree', caption: 'C major across the neck. In the Scale Explorer, switch to CAGED to see each shape\'s chord tones highlighted inside its position.' }),
    ],
    exercise: { title: 'Five shapes, one chord', steps: ['Play C major as each of the five shapes, from open position upward.', 'In each shape, play the surrounding scale position, then the chord.', 'Repeat for G major.'] },
    mistakes: ['Learning CAGED shapes without connecting them.', 'Assuming CAGED and 3NPS conflict: they are two views of the same notes.'],
    selfCheck: ['I can play a major chord in all five CAGED shapes.'],
    quiz: [
      q('l6c-1', 'CAGED is named after…', ['Five scales', 'Five open chord shapes', 'Five modes', 'Five tunings'], 1, 'The open C, A, G, E and D chord shapes.'),
      q('l6c-2', 'After the E shape, the next shape up the neck is…', ['C', 'A', 'D', 'G'], 2, 'The order is C-A-G-E-D, then C again.'),
      q('l6c-3', 'CAGED is especially helpful for…', ['Tuning', 'Seeing chord tones while soloing', 'Palm muting', 'Tremolo picking'], 1, 'Each position centres on a chord shape, so chord tones are visible.'),
    ],
    realWorld: 'Many blues, country and jazz guitarists think in CAGED; many shredders think in 3NPS. Versatile players use both.',
    summary: ['Five movable chord shapes link up the neck.', 'Each has a matching scale position.', 'CAGED for harmony, 3NPS for speed.'],
    next: 'l6-minor-scales',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.', 'Play C major in all five CAGED shapes.'] },
  },
  {
    id: 'l6-minor-scales', level: 6, module: 'm6-systems', title: 'Natural, harmonic and melodic minor', minutes: 35,
    objectives: ['Compare the three minor scales by formula and sound', 'Explain why harmonic minor creates a major V chord', 'Play each in one position'],
    prerequisites: ['l6-pillitiere-patterns', 'l3-diatonic-chords'], categories: ['scales', 'theory'], sources: [src.C('The minor scale: shapes rooted on the 6th and 5th strings'), src.D('Harmonic and melodic minor as altered scales, outside the method\'s scope'), src.P()],
    why: 'Natural minor is the sound of rock and metal; harmonic minor gives classical and neoclassical drama; melodic minor opens jazz and fusion. Each is one or two notes away from the others.',
    explanation: [
      table(['Scale', 'Formula', 'In A'], [['Natural minor (Aeolian)', '1 2 ♭3 4 5 ♭6 ♭7', 'A B C D E F G'], ['Harmonic minor', '1 2 ♭3 4 5 ♭6 7', 'A B C D E F G♯'], ['Melodic minor (jazz)', '1 2 ♭3 4 5 6 7', 'A B C D E F♯ G♯']]),
      p('Natural minor\'s chord on degree 5 is minor (E minor in A), which gives a weak pull back home. Raising the 7th (G → G♯) turns it into E major or E7, a strong dominant. That raised 7th is what defines harmonic minor; the gap between F and G♯ (an augmented 2nd) gives it its exotic, classical sound.'),
      p('Melodic minor also raises the 6th, smoothing out that gap. In jazz it is used both ascending and descending; it is the parent of important modes like Lydian dominant and the altered scale (Level 7).'),
      sourceNote('Pillitiere notes that harmonic and melodic minor are altered scales, outside his natural-diatonic system, and become easier once that system is understood. 3NPS still works for both, but the X/Y/Z cycle does not apply, so the app builds those patterns by calculation.'),
    ],
    guitar: [
      fb('A', { scale: 'harmonic-minor', minFret: 4, maxFret: 9, labels: 'interval', caption: 'A harmonic minor around the 5th fret. Find the raised 7th (G♯).' }),
      tab(`
e|---------------------------------|
B|---------------------------------|
G|-------------------4-5-7-5-4-----|
D|-------------3-6-7-------------7-|
A|-5-7-8-7-5-7---------------------|`, 'Original A harmonic-minor phrase emphasising G♯ resolving to A.'),
    ],
    exercise: { title: 'Three minors', steps: ['Play A natural, harmonic and melodic minor in one position, back to back.', 'Over the Jam Lab "Neoclassical i–iv–V–i" in A minor, use natural minor on Am and Dm, harmonic minor on E7.', 'Ear Training → Scales level 3.'] },
    mistakes: ['Using natural minor over the E7 in A minor (G clashes with the chord\'s G♯).', 'Treating harmonic minor as a constant flavour rather than a V-chord colour.'],
    selfCheck: ['I can hear and name all three minor scales.'],
    quiz: [
      q('l6m-1', 'Harmonic minor differs from natural minor by…', ['A raised 6th', 'A raised 7th', 'A lowered 2nd', 'A raised 4th'], 1, 'The 7th is raised (♭7 → 7).'),
      q('l6m-2', 'Why use harmonic minor over the V chord in a minor key?', ['It is faster', 'Its raised 7th is the major 3rd of the V chord', 'It avoids the root', 'It has fewer notes'], 1, 'In A minor, G♯ is the 3rd of E7.'),
      q('l6m-3', 'Melodic minor (jazz) is…', ['1 2 ♭3 4 5 ♭6 7', '1 2 ♭3 4 5 6 7', '1 ♭2 ♭3 4 5 ♭6 ♭7', '1 2 3 4 5 6 ♭7'], 1, 'A major scale with a ♭3.'),
    ],
    realWorld: 'Neoclassical metal players lean on harmonic minor; jazz and fusion players on melodic minor; nearly all rock uses natural minor.',
    summary: ['Natural: ♭6 ♭7. Harmonic: ♭6 7. Melodic: 6 7.', 'Harmonic minor supplies the V chord\'s leading tone.', 'Melodic minor is a jazz workhorse.'],
    next: 'l6-symmetrical',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.'] },
    unlocks: { scales: ['harmonic-minor', 'melodic-minor'] },
  },
  {
    id: 'l6-symmetrical', level: 6, module: 'm6-systems', title: 'Chromatic, whole-tone, diminished and exotic scales', minutes: 30,
    objectives: ['Understand symmetrical scales and their repeating structure', 'Know where whole-tone and diminished scales fit harmonically', 'Try a few exotic scales'],
    prerequisites: ['l6-minor-scales'], categories: ['scales', 'theory'], sources: [src.P('Symmetrical and exotic scales')],
    why: 'Symmetrical scales add tension and colour that diatonic scales cannot. Their repeating structure also makes them easy to visualise on the guitar.',
    explanation: [
      p('The chromatic scale uses all 12 notes. It is mainly a technique and passing-tone resource.'),
      p('The whole-tone scale (1 2 3 ♯4 ♯5 ♭7) uses only whole steps. Since every step is identical, there are only two different whole-tone scales. It fits augmented and 7♯5 chords and sounds dreamy and unresolved.'),
      p('Diminished scales alternate half and whole steps and repeat every minor 3rd (three frets). Half-whole (1 ♭2 ♯2 3 ♯4 5 6 ♭7) fits dominant 7♭9 chords; whole-half fits diminished 7th chords. Any fingering can be moved up three frets and remain the same scale.'),
      p('Exotic scales such as Hungarian minor, double harmonic and Hirajōshi bring folk and world colours. Explore them in the Scale Explorer, which shows their formulas, fretboard layout and audio.'),
    ],
    guitar: [
      fb('A', { scale: 'diminished-hw', minFret: 4, maxFret: 10, labels: 'interval', caption: 'A half-whole diminished: notice how the pattern repeats every three frets.' }),
    ],
    exercise: { title: 'Colour tour', steps: ['Play one octave of C whole-tone; then move it up one fret: that is the other whole-tone scale.', 'Play A half-whole diminished over an A7 chord in the Jam Lab (choose a one-chord funk vamp).', 'Audition three exotic scales in the Scale Explorer and describe each in one word.'] },
    mistakes: ['Overusing symmetrical scales so they lose their effect.', 'Using half-whole over a diminished 7th chord (use whole-half).'],
    selfCheck: ['I can explain why there are only two whole-tone scales.'],
    quiz: [
      q('l6s-1', 'How many distinct whole-tone scales are there?', ['1', '2', '6', '12'], 1, 'Each contains six of the twelve notes; shifting by a half step gives the other six.'),
      q('l6s-2', 'A diminished-scale fingering can be moved by how many frets and stay the same scale?', ['1', '2', '3', '5'], 2, 'It repeats every minor 3rd (three frets).'),
      q('l6s-3', 'The half-whole diminished scale fits which chord?', ['maj7', '7♭9', 'm7', 'sus2'], 1, 'It contains 1 3 5 ♭7 plus ♭9, ♯9 and ♯11.'),
    ],
    realWorld: 'Metal and fusion players use diminished runs for sudden tension; film composers use whole-tone for dream sequences.',
    summary: ['Symmetrical = repeating interval structure.', 'Whole-tone fits augmented chords; diminished fits 7♭9 and dim7.', 'Exotic scales bring world colours.'],
    next: 'l6-transposition',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.'] },
    unlocks: { scales: ['whole-tone', 'diminished-hw', 'diminished-wh', 'chromatic', 'hungarian-minor', 'double-harmonic', 'hirajoshi'] },
  },
  {
    id: 'l6-transposition', level: 6, module: 'm6-systems', title: 'Transposition, horizontal movement and connecting the neck', minutes: 30,
    objectives: ['Transpose any shape to a new key', 'Move horizontally along strings and vertically across positions', 'Play one scale through the whole neck'],
    prerequisites: ['l6-pillitiere-patterns', 'l6-caged'], categories: ['scales', 'fretboard'], sources: [src.D('Patterns tie into one another; play all over the neck'), src.P()],
    why: 'Real solos move. Connecting positions lets you take a phrase from the low register to the high register smoothly, and change keys without stopping.',
    explanation: [
      p('Transposing a movable shape is simple: move the root and everything moves with it. Up 2 frets = up a whole step; up 5 frets = up a 4th; up 7 frets = up a 5th.'),
      p('Vertical playing stays in one position and moves across strings. Horizontal playing moves along the strings, often two or three strings at a time, using slides or shifts. Diagonal runs combine both, for example climbing 3NPS patterns one string set at a time.'),
      p('Pillitiere points out that patterns interlock: the top two strings of one pattern are the bottom of another. Practise the "one scale, every position" drill until any position is reachable from any other.'),
    ],
    guitar: [
      tab(`
e|--------------------------------7-8-10-12-|
B|-------------------------6-8-10-----------|
G|-------------------5-7-9------------------|
D|-------------5-7-9------------------------|
A|-------5-7-8------------------------------|
E|-5-7-8------------------------------------|`, 'An original diagonal A natural-minor run climbing from the 5th to the 12th fret.'),
    ],
    exercise: { title: 'Full-neck journey', steps: ['Play A minor from the lowest to the highest note on the neck, shifting position every two strings.', 'Play a short phrase in A minor, then the same phrase in D minor and E minor.', 'In the Jam Lab, pick a progression that changes key (or change key between loops) and follow it.'] },
    mistakes: ['Shifting late so the timing stumbles.', 'Always shifting with the same finger regardless of context.'],
    selfCheck: ['I can play a scale from the bottom to the top of the neck without stopping.'],
    quiz: [
      q('l6t-1', 'Moving a shape up 7 frets transposes it up a…', ['Major 3rd', 'Perfect 4th', 'Perfect 5th', 'Octave'], 2, 'Seven half steps = perfect 5th.'),
      q('l6t-2', 'Horizontal playing means moving…', ['Across strings in one position', 'Along the strings up or down the neck', 'Only on one string', 'Without the pick'], 1, 'Horizontal = along the neck.'),
    ],
    realWorld: 'The most engaging solos travel across registers, building from low to high. Connected positions make that possible.',
    summary: ['Move the root and the shape follows.', 'Combine vertical and horizontal movement.', 'Patterns interlock across the whole neck.'],
    next: 'l7-modes-intro',
    mastery: { quizPass: 1, criteria: ['Answer both questions.', 'Play a scale through the whole neck without stopping.'] },
  },
];
