import type { Lesson } from '@gma/learning';
import { p, list, steps, tip, warn, theory, tab, table, fb, chords, q, src, sourceNote } from '../helpers';

export const LEVEL_5: Lesson[] = [
  {
    id: 'l5-minor-pentatonic', level: 5, module: 'm5-pentatonic', title: 'The minor pentatonic scale: position 1', minutes: 30,
    objectives: ['Build the minor pentatonic from the formula 1 ♭3 4 5 ♭7', 'Play position 1 in any key', 'Identify the roots inside the shape'],
    prerequisites: ['l3-relative-minor', 'l2-root-strings'], categories: ['scales', 'improvisation'], sources: [src.P('Pentatonic system'), src.C('Blues scale = minor pentatonic + ♭5 (Book 3 refers back to Book Two for the pentatonic)')],
    why: 'The minor pentatonic is the most used lead-guitar scale in rock and blues. With just five notes and no half steps, almost any note you play sounds good, which makes it the perfect first improvising scale.',
    explanation: [
      p('"Penta" means five. The minor pentatonic takes the natural minor scale and removes its two most tension-prone notes (2 and ♭6), leaving 1 ♭3 4 5 ♭7. In A: A C D E G.'),
      p('Position 1 is the box shape whose lowest note is the root on the low E string. In A it sits at frets 5–8: two notes per string, with roots on the low E (fret 5), D string (fret 7) and high E (fret 5).'),
      fb('A', { scale: 'minor-pentatonic', minFret: 5, maxFret: 8, labels: 'interval', caption: 'A minor pentatonic, position 1. Roots (1) are highlighted.' }),
      theory('Because the shape is movable, the root on the low E string sets the key: fret 3 = G minor pentatonic, fret 8 = C, fret 12 = E.'),
    ],
    guitar: [
      tab(`
e|-----------------------5-8-|
B|-------------------5-8-----|
G|---------------5-7---------|
D|-----------5-7-------------|
A|-------5-7-----------------|
E|-5-8-----------------------|`, 'Ascending position 1. Use fingers 1 and 4 on the 5–8 strings, 1 and 3 on 5–7.'),
      tip('Always know where the roots are. Ending a phrase on a root sounds resolved; ending on the ♭7 or 4 sounds open.'),
    ],
    exercise: { title: 'Own the box', steps: ['Play position 1 ascending and descending with alternate picking.', 'Play it in groups of three notes (1-2-3, 2-3-4, …) for fluency.', 'Over a Jam Lab A minor rock track, improvise using only this box for two minutes.'], exerciseId: 'ex-pent-pos1' },
    metronome: { bpmStart: 60, bpmTarget: 110, subdivision: 2, instructions: 'Eighth notes up and down without pausing at the top.' },
    mistakes: ['Not knowing which note is the root.', 'Playing the box up and down without musical intent.', 'Using finger 3 instead of 4 on the wide stretches, which strains the hand.'],
    selfCheck: ['I can play position 1 in any key.', 'I can point to every root in the shape.'],
    quiz: [
      q('l5p-1', 'The minor pentatonic formula is…', ['1 2 3 5 6', '1 ♭3 4 5 ♭7', '1 2 ♭3 4 5 ♭6 ♭7', '1 ♭3 4 ♭5 5 ♭7'], 1, 'Five notes: 1 ♭3 4 5 ♭7.'),
      q('l5p-2', 'Which notes make A minor pentatonic?', ['A B C D E', 'A C D E G', 'A C♯ E F♯ G', 'A C D E♭ G'], 1, 'A C D E G.'),
      q('l5p-3', 'Position 1 of G minor pentatonic starts at which fret on the low E?', ['1', '3', '5', '8'], 1, 'G is at fret 3 on the low E.'),
      q('l5p-4', 'Why is the pentatonic forgiving for improvising?', ['It has no half steps, so no harsh clashes', 'It has more notes', 'It only works in A', 'It uses open strings'], 0, 'Removing the half-step notes removes most strong dissonances.'),
    ],
    realWorld: 'A huge share of classic rock and blues solos are built mostly on this one box. It is the gateway to improvising.',
    summary: ['1 ♭3 4 5 ♭7.', 'Position 1 starts on the root on the low E.', 'Know the roots; resolve to them.'],
    next: 'l5-pentatonic-positions',
    mastery: { quizPass: 0.75, practice: { exerciseId: 'ex-pent-pos1', bpm: 100 }, criteria: ['Score at least 75%.', 'Log a clean position-1 take at 100 bpm (eighth notes).'] },
    unlocks: { scales: ['minor-pentatonic'], challenges: ['three-notes', 'pentatonic-melody'] },
  },
  {
    id: 'l5-pentatonic-positions', level: 5, module: 'm5-pentatonic', title: 'Five positions, connecting them, and the major pentatonic', minutes: 35,
    objectives: ['Play all five pentatonic positions in one key', 'Connect positions with slides', 'Use the same shapes as the major pentatonic of the relative major'],
    prerequisites: ['l5-minor-pentatonic'], categories: ['scales', 'fretboard'], sources: [src.P('Five-position pentatonic system')],
    why: 'One box limits you to one area of the neck. Five connected positions let you play anywhere, and each position highlights different notes and licks.',
    explanation: [
      p('Each pentatonic position starts on the next scale note on the low E string. In A minor: position 1 starts on A (fret 5), position 2 on C (fret 8), 3 on D (fret 10), 4 on E (fret 12), 5 on G (fret 15), then position 1 repeats at fret 17 (or 5 an octave lower).'),
      p('The positions overlap: the upper notes of one box are the lower notes of the next. Slide along one string to move between them.'),
      p('Major pentatonic: 1 2 3 5 6. C major pentatonic (C D E G A) has exactly the same notes as A minor pentatonic, the relative relationship again. Position 2 of A minor is position 1 of C major. What changes is which note you treat as home.'),
      fb('A', { scale: 'minor-pentatonic', minFret: 0, maxFret: 17, labels: 'interval', caption: 'A minor pentatonic across the neck: five interlocking positions.' }),
    ],
    guitar: [
      tab(`
e|-------------------------------------|
B|-------------------------------------|
G|-------------5-7-9/12-9-7------------|
D|-------5-7-10----------10-7-5--------|
A|-5-7-------------------------7-5-----|
E|-------------------------------------|`, 'Moving from position 1 into position 3/4 with a slide on the G string.'),
    ],
    exercise: { title: 'Map the neck', steps: ['Learn each position slowly, naming its starting degree.', 'Play one octave of the scale moving diagonally through three positions.', 'Over a C major Jam Lab track, use the same shapes and resolve to C.', 'Fretboard Trainer: chord tones and degree modes in A minor.'] },
    mistakes: ['Learning the shapes but never connecting them.', 'Forgetting that the root changes when you switch to major pentatonic.'],
    selfCheck: ['I can play all five positions in A minor and in E minor.', 'I can move between positions mid-phrase.'],
    quiz: [
      q('l5q-1', 'Position 2 of A minor pentatonic starts on which note?', ['A', 'C', 'D', 'G'], 1, 'Positions start on successive scale notes: A, C, D, E, G.'),
      q('l5q-2', 'C major pentatonic contains the same notes as…', ['C minor pentatonic', 'A minor pentatonic', 'E minor pentatonic', 'G major pentatonic'], 1, 'A is the relative minor of C.'),
      q('l5q-3', 'The major pentatonic formula is…', ['1 2 3 5 6', '1 ♭3 4 5 ♭7', '1 2 3 4 5', '1 3 5 6 7'], 0, '1 2 3 5 6.'),
    ],
    realWorld: 'Country and Southern rock lean on the major pentatonic; rock and blues on the minor. Many players mix both in one solo.',
    summary: ['Five positions start on the five scale notes.', 'Positions overlap; slide between them.', 'Same shapes, different root = major pentatonic.'],
    next: 'l5-bends-vibrato',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.', 'Play all five positions of A minor pentatonic from memory.'] },
    unlocks: { scales: ['major-pentatonic'], challenges: ['connect-positions'] },
  },
  {
    id: 'l5-bends-vibrato', level: 5, module: 'm5-expression', title: 'String bending and vibrato', minutes: 30,
    objectives: ['Bend a half step and a whole step in tune', 'Release bends in control', 'Apply even, controlled vibrato'],
    prerequisites: ['l5-minor-pentatonic'], categories: ['technique'], sources: [src.C('Double-stop bend, pre-bend, bends in blues licks'), src.B('Bends and vibrato in solos'), src.P('Bending technique')],
    why: 'Bends and vibrato turn a guitar into a voice. They are the most expressive tools in lead guitar, and in-tune bends are a mark of a skilled player.',
    explanation: [
      p('A bend pushes the string across the fretboard to raise its pitch. A half-step bend raises it by one fret\'s worth, a whole-step (full) bend by two frets. Use several fingers together: for a ring-finger bend, place fingers 1 and 2 behind it on the same string and push with all three.'),
      p('The power comes from rotating the wrist (like turning a door handle), not from pushing with the fingers alone. Hook the thumb over the neck for leverage when bending.'),
      p('Vibrato is a repeated small bend and release that makes a held note sing. Aim for an even speed and width that fits the tempo; a wide, slow vibrato for blues, faster and narrower for rock and metal.'),
      warn('Mute the strings you are not playing. When you bend, the fretting hand\'s spare fingers and the picking hand should keep neighbouring strings silent.'),
      theory('Check bend accuracy with the tuner: play fret 9 on the G string (E), note its pitch, then bend fret 7 up until it reads E.'),
    ],
    guitar: [
      tab(`
e|----------------------------------|
B|-8---8b10---8b10r8---8~~~~--------|
G|-------------------------7b9~~----|
D|----------------------------------|`, 'Target note, full bend to it, bend and release, vibrato; then a full bend with vibrato on the G string.'),
    ],
    exercise: { title: 'In-tune bends', steps: ['Play the target note (B string fret 10), then bend fret 8 up to match it. Repeat 10 times.', 'Use the tuner to check: the bent note should read the target pitch.', 'Hold a note with vibrato for 4 beats at 70 BPM: one vibrato cycle per beat, then two per beat.'], exerciseId: 'ex-bend-pitch' },
    metronome: { bpmStart: 60, bpmTarget: 90, subdivision: 1, instructions: 'Synchronise vibrato cycles with the beat.' },
    mistakes: ['Under-bending (flat bends are the most common error).', 'Bending with one finger only.', 'Nervous, uneven vibrato.', 'Letting neighbouring strings ring during bends.'],
    selfCheck: ['My full bends reach pitch within 10 cents on the tuner.', 'My vibrato is even and in time.'],
    quiz: [
      q('l5b-1', 'A full (whole-step) bend raises the pitch by…', ['1 fret', '2 frets', '3 frets', '12 frets'], 1, 'A whole step = two semitones.'),
      q('l5b-2', 'Where should the main bending force come from?', ['The tip of one finger', 'Wrist rotation with several fingers supporting', 'The picking hand', 'The tremolo arm'], 1, 'Rotate the wrist and support with extra fingers.'),
      q('l5b-3', '"7b9r7" means…', ['Play frets 7, 9 and 7', 'Bend 7 to the pitch of 9, then release back to 7', 'Slide 7 to 9', 'Vibrato on 7'], 1, 'b = bend, r = release.'),
    ],
    realWorld: 'Blues greats are known for their vibrato and bends. A single well-bent note can say more than a fast run.',
    summary: ['Bend with the wrist and several fingers.', 'Check bends against the target pitch.', 'Even, deliberate vibrato.'],
    next: 'l5-legato',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-bend-pitch' }, criteria: ['Score at least 2 of 3.', 'Log a clean bend exercise take (bends in tune).'] },
  },
  {
    id: 'l5-legato', level: 5, module: 'm5-expression', title: 'Hammer-ons, pull-offs, slides and legato phrasing', minutes: 30,
    objectives: ['Play clear hammer-ons and pull-offs', 'Slide accurately to target notes', 'Combine legato with picking for smooth phrases'],
    prerequisites: ['l5-minor-pentatonic'], categories: ['technique'], sources: [src.A('Legato: hammer-on, pull-off, slides'), src.C('Trills'), src.P()],
    why: 'Legato connects notes without picking each one, giving a smooth, vocal sound and freeing the picking hand. It is essential for blues phrasing and for fast rock lines later.',
    explanation: [
      p('Hammer-on: pick a note, then bring another finger down hard and fast on a higher fret of the same string; the impact sounds the new note. Pull-off: with both fingers in place, pick the higher note and flick the finger off sideways (slightly downward), plucking the string to sound the lower note.'),
      p('Slides: pick a note and slide the same finger to a new fret without lifting pressure. Slide into a note from below for a vocal swoop; slide out of a note to end a phrase.'),
      p('A trill alternates rapidly between two notes with continuous hammer-ons and pull-offs.'),
      tip('Hammer from just above the string with the fingertip, aiming right behind the fret. Volume should match the picked notes.'),
    ],
    guitar: [
      tab(`
e|-------------------------------------|
B|-5h8p5-------5h8p5-------------------|
G|-------7p5-7-------7/9--9\\7-5--------|
D|-----------------------------7-------|`, 'A minor pentatonic phrase with hammer-ons, pull-offs and slides.'),
    ],
    exercise: { title: 'Legato control', steps: ['Trill frets 5 and 7 on the G string for 10 seconds; then 5 and 8.', 'Play the phrase above, matching the volume of legato and picked notes.', 'Technique Lab: legato trills and hammer-pull drills.'], exerciseId: 'ex-legato-hp' },
    metronome: { bpmStart: 60, bpmTarget: 100, subdivision: 3, instructions: 'Triplets suit hammer-pull groups.' },
    mistakes: ['Weak hammer-ons that are much quieter than picked notes.', 'Pull-offs that lift straight up and make no sound.', 'Unwanted strings ringing during pull-offs.'],
    selfCheck: ['My legato notes are as loud as picked notes.', 'I can trill evenly for 10 seconds.'],
    quiz: [
      q('l5l-1', 'A pull-off sounds the…', ['Higher note', 'Lower, already-fretted note', 'Open string always', 'Same note again'], 1, 'Flicking off the higher finger plucks the string so the lower note sounds.'),
      q('l5l-2', 'Legato means…', ['Detached and short', 'Smooth and connected', 'Loud', 'Palm-muted'], 1, 'Legato = connected notes with fewer pick attacks.'),
      q('l5l-3', 'What is a trill?', ['A fast pick tremolo', 'Rapid alternation of two notes by hammer-ons and pull-offs', 'A wide bend', 'A slide'], 1, 'Continuous hammer-ons and pull-offs between two frets.'),
    ],
    realWorld: 'Blues phrasing relies on slides and pull-offs; rock and metal shred uses long legato runs.',
    summary: ['Hammer-ons and pull-offs sound notes without picking.', 'Slides connect positions vocally.', 'Match legato and picked volume.'],
    next: 'l5-12-bar-blues',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-legato-hp', bpm: 80 }, criteria: ['Score at least 2 of 3.', 'Log a clean legato take at 80 bpm.'] },
  },
  {
    id: 'l5-12-bar-blues', level: 5, module: 'm5-blues', title: 'The 12-bar blues, the blues scale and turnarounds', minutes: 35,
    objectives: ['Play the standard and quick-change 12-bar forms with dominant 7th chords', 'Use the blues scale and its ♭5 blue note', 'Play a turnaround in the last two bars'],
    prerequisites: ['l3-diatonic-chords', 'l5-minor-pentatonic', 'l1-riffs'], categories: ['chords', 'scales', 'repertoire'], sources: [src.C('12-bar blues: standard form, quick change, blues scale, licks, turnarounds, call and response'), src.P()],
    why: 'The 12-bar blues is the most important song form a guitarist can know. It underlies blues, rock\'n\'roll, much of rock and jazz, and is the default jam-session form.',
    explanation: [
      p('The 12-bar blues uses the I, IV and V chords of a key, usually as dominant 7ths (I7, IV7, V7). In A: A7, D7, E7. The standard form is:'),
      table(['Bars 1–4', 'Bars 5–8', 'Bars 9–12'], [['I7 | I7 | I7 | I7', 'IV7 | IV7 | I7 | I7', 'V7 | IV7 | I7 | V7']]),
      p('The quick change moves to IV7 in bar 2 and back to I7 in bar 3. The final bar\'s V7 (the turnaround) leads back to the top of the form; a turnaround lick in bars 11–12 signals that the form is repeating.'),
      p('The blues scale adds one note to the minor pentatonic, the ♭5: 1 ♭3 4 ♭5 5 ♭7 (A C D E♭ E G). The ♭5 is a "blue note": a passing tone with a crying sound. Slide or bend through it rather than sitting on it.'),
      sourceNote('Book 3 presents the standard and quick-change forms, the blues scale, four "must-know" licks and two turnarounds tied to specific bars of the form. The examples below are original.'),
      chords(['A7', 'D7', 'E7'], 'Dominant 7th chords for a blues in A.'),
    ],
    guitar: [
      tab(`
e|-----------------------------------|
B|-----------------------------------|
G|-------------------------5---------|
D|-----------------5-6-7-------------|
A|-5-7-----5-6-7---------------------|
E|-----8-----------------------------|`, 'Blues-scale phrase in A using the ♭5 (E♭) as a passing note.'),
      tab(`
     A7                         E7
e|-5---4---3---2-------|---------------|
B|-5---5---5---5-------|---------------|
G|---------------2-1-0-|-1-------------|
D|---------------------|-0-------------|
A|---------------------|---------------|
E|---------------------|-0-------------|`, 'An original descending turnaround for bars 11–12 in A, landing on E7.'),
    ],
    exercise: { title: 'Play the form', steps: ['Play the 12-bar in A with A7–D7–E7, one strum per beat, counting bars aloud.', 'Play the boogie riff from Level 1 through the whole form.', 'Over the Jam Lab "12-bar blues" (Blues shuffle style), solo with the blues scale and add the turnaround in bars 11–12.'], exerciseId: 'ex-12bar-comp' },
    metronome: { bpmStart: 70, bpmTarget: 110, subdivision: 2, instructions: 'Use the shuffle preset.' },
    mistakes: ['Losing your place in the form (count bars!).', 'Sitting on the ♭5 instead of passing through it.', 'Forgetting the turnaround.'],
    selfCheck: ['I can play the 12-bar form in A and E without losing my place.', 'I can use the ♭5 musically.'],
    quiz: [
      q('l5w-1', 'Which chords make a 12-bar blues in E?', ['E7, A7, B7', 'E, F♯m, B', 'Em, Am, Bm', 'E7, G7, A7'], 0, 'I7, IV7, V7 in E: E7, A7, B7.'),
      q('l5w-2', 'In the standard form, which chord is in bar 9?', ['I7', 'IV7', 'V7', 'vi'], 2, 'Bar 9 = V7, bar 10 = IV7.'),
      q('l5w-3', 'The blues scale is the minor pentatonic plus…', ['The 2nd', 'The ♭5', 'The major 3rd', 'The 6th'], 1, '1 ♭3 4 ♭5 5 ♭7.'),
      q('l5w-4', 'The quick change differs from the standard form in…', ['Bar 2 (IV7 instead of I7)', 'Bar 9', 'It has 16 bars', 'It uses minor chords'], 0, 'The IV7 comes early, in bar 2.'),
    ],
    realWorld: 'At any blues jam someone will call "blues in A, shuffle." After this lesson you can join in.',
    summary: ['I7–IV7–V7 over 12 bars.', 'Blues scale adds the ♭5 blue note.', 'Turnarounds lead back to the top.'],
    next: 'l5-blues-phrasing',
    mastery: { quizPass: 0.75, practice: { exerciseId: 'ex-12bar-comp', bpm: 90 }, criteria: ['Score at least 75%.', 'Log a clean take of the 12-bar comping exercise at 90 bpm.'] },
    unlocks: { scales: ['blues'], chords: ['A7', 'D7', 'E7', 'B7'] },
  },
  {
    id: 'l5-blues-phrasing', level: 5, module: 'm5-blues', title: 'Blues improvisation: call and response and phrase construction', minutes: 35,
    objectives: ['Build phrases with a beginning, middle and end', 'Use call and response', 'Leave space and repeat ideas'],
    prerequisites: ['l5-12-bar-blues', 'l5-bends-vibrato', 'l5-legato'], categories: ['improvisation', 'jamming'], sources: [src.C('Call and response between vocal and guitar'), src.D('Practice: improvise regularly, with others or a recording'), src.P('Phrasing pedagogy')],
    why: 'Knowing scales is not the same as improvising. Musical solos are made of phrases, like sentences in conversation. This lesson turns the pentatonic box into a language.',
    explanation: [
      p('A phrase is a short musical sentence, usually one or two bars, followed by a breath (rest). Build each phrase with intent: start somewhere, go somewhere, end on a strong note (often the root, or the 3rd or 5th of the current chord).'),
      p('Call and response: play a short phrase (the call), then answer it with a related phrase (the response). Blues singers and guitarists trade lines this way. The response can repeat the call\'s rhythm with different notes, or end it differently.'),
      list('Repeat: play an idea twice. Repetition makes solos memorable.', 'Space: rest as long as you played. Silence lets ideas land.', 'Target: land on the root when the I chord returns, or on the chord\'s 3rd.', 'Dynamics: start quieter, build intensity toward the end of the chorus.'),
      tip('Limit yourself. Two-note solos, one-string solos, or rhythm-only variations force creativity and break the "run up and down the box" habit.'),
    ],
    guitar: [
      tab(`
         call                response
e|-----------------|-----------------|
B|-8b10---8-5------|-8b10---8--5-----|
G|------------7----|-----------------|
D|-----------------|------------7~~~-|`, 'An original call and response. The call ends on D (the 4th, unresolved); the response ends on A, the root, with vibrato.'),
    ],
    exercise: { title: 'Conversation in A', steps: ['Over a 12-bar shuffle in A, play a one-bar call, rest for one bar, then answer it.', 'Play a full chorus using only three notes.', 'Complete the Jam Lab challenge "Build a four-bar question-and-answer phrase".'] },
    mistakes: ['Playing constantly without rests.', 'Ignoring the chord changes entirely.', 'Never repeating an idea.'],
    selfCheck: ['My solos contain clear phrases with rests.', 'I can play a call and answer it.'],
    quiz: [
      q('l5c-1', 'In call and response, the response…', ['Ignores the call', 'Answers the call with a related phrase', 'Is always faster', 'Must use different notes and rhythm'], 1, 'The answer relates to the call, often by rhythm or contour.'),
      q('l5c-2', 'Why leave space in a solo?', ['To rest your hands only', 'It lets phrases breathe and land, like pauses in speech', 'Because the scale has gaps', 'It is not recommended'], 1, 'Silence gives structure and impact.'),
      q('l5c-3', 'A strong note to end a phrase over the I chord is…', ['The ♭5', 'The root', 'A note a half step above a chord tone', 'The 4th'], 1, 'The root (or the 3rd or 5th) sounds resolved.'),
    ],
    realWorld: 'Many of the most loved blues solos use few notes but strong phrasing. Audiences remember melodies, not speed.',
    summary: ['Phrases are musical sentences.', 'Call and response creates dialogue.', 'Repeat, leave space, target strong notes.'],
    next: 'l6-pillitiere-shapes',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.', 'Complete the Jam Lab "four-bar question-and-answer" challenge.'] },
    unlocks: { challenges: ['four-bar-phrase'] },
  },
];
