import type { Lesson } from '@gma/learning';
import { p, list, steps, tip, warn, theory, tab, chords, table, q, src } from '../helpers';

export const LEVEL_1: Lesson[] = [
  {
    id: 'l1-fretting', level: 1, module: 'm1-notes', title: 'Clean single notes and muting unwanted noise', minutes: 20,
    objectives: ['Fret single notes without buzzing', 'Mute strings you are not playing', 'Use one finger per fret in the first position'],
    prerequisites: ['l0-posture', 'l0-pick', 'l0-tab'], categories: ['technique'], sources: [src.A('Your first notes; arching fingers so open strings ring'), src.P('Fret- and pick-hand muting for electric guitar')],
    why: 'Electric guitars amplify everything, including mistakes. Clean notes and silent unused strings are what separate a polished player from a noisy one, especially with distortion.',
    explanation: [
      p('A clean note needs three things: the fingertip just behind the fret, enough (but not excessive) pressure, and a pick attack on the right string. If a note buzzes, move closer to the fret before pressing harder. If it sounds dull or muted, the finger is probably touching the string with its pad or a neighbouring finger is resting on it.'),
      p('Muting means stopping strings you do not want to hear. The fretting hand mutes higher strings by lightly touching them with the underside of the fretting finger, and mutes strings below with the fingertip\'s edge. The picking hand mutes lower strings by resting the palm edge on them. Together these leave only the played string free to ring.'),
      theory('With high gain, a string that vibrates even slightly through sympathetic resonance becomes audible. That is why muting matters far more on electric guitar than on acoustic.'),
    ],
    guitar: [
      tab(`
e|-----------------------------0-1-3-|
B|-------------------0-1-3-----------|
G|-----------0-2-----------------------|
D|-----0-2-3---------------------------|
A|-0-2-3-------------------------------|
E|-------------------------------------|`, 'An ascending first-position line (part of the C major scale). Fingers: fret 1 = finger 1, fret 2 = finger 2, fret 3 = finger 3.'),
      tip('After each note, lift the fretting finger just enough to stop the sound; do not let it fly away from the string.'),
    ],
    exercise: { title: 'Buzz-free and silent', steps: ['Play the line above slowly. Every note must ring clearly.', 'Turn the amp gain up and play again: are any unplayed strings ringing? Use palm and finger muting to silence them.', 'Play the line backwards (descending).'], exerciseId: 'ex-melody-first5' },
    metronome: { bpmStart: 50, bpmTarget: 80, subdivision: 1, instructions: 'One note per click, then try two notes per click.' },
    mistakes: ['Pressing harder instead of moving closer to the fret.', 'Fingers flying far from the strings between notes.', 'Ignoring noise from open strings under distortion.'],
    selfCheck: ['Each note in the line rings clearly.', 'Under gain, unplayed strings stay silent.'],
    quiz: [
      q('l1f-1', 'A note buzzes. What should you try first?', ['Press much harder', 'Move the fingertip closer to the fret', 'Pick harder', 'Change strings'], 1, 'Proximity to the fret matters more than force.'),
      q('l1f-2', 'Which hand usually mutes the lower (thicker) strings?', ['The fretting hand only', 'The picking hand palm edge', 'Neither', 'The tremolo arm'], 1, 'The edge of the picking-hand palm rests lightly on the lower strings.'),
      q('l1f-3', 'Why does muting matter more on electric guitar?', ['Electric strings are thicker', 'Amplification and gain make any vibration audible', 'Acoustic guitars have no frets', 'It does not matter more'], 1, 'Gain amplifies small sympathetic vibrations into audible noise.'),
    ],
    realWorld: 'Clean, controlled lines are what producers and bandmates notice first. Muting is the invisible technique behind every tight rock and metal recording.',
    summary: ['Fingertip close to the fret, minimum pressure.', 'Both hands mute unused strings.', 'Practise clean notes with gain on to expose noise.'],
    next: 'l1-alternate-picking',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-melody-first5', bpm: 70 }, criteria: ['Score at least 2 of 3.', 'Log a clean take of the first-position melody at 70 bpm.'] },
  },
  {
    id: 'l1-alternate-picking', level: 1, module: 'm1-notes', title: 'Alternate picking and string crossing', minutes: 25,
    objectives: ['Alternate strictly down-up on one string', 'Cross between strings without losing the pattern', 'Keep picking motion small and even'],
    prerequisites: ['l1-fretting'], categories: ['technique'], sources: [src.A('Alternate picking'), src.P('Picking mechanics and string-crossing')],
    why: 'Alternate picking uses every motion of the hand, so you can play twice as many notes with the same effort as downstrokes alone. It is the foundation of almost all fast single-note playing.',
    explanation: [
      p('Strict alternate picking means every note alternates direction: down, up, down, up, regardless of string changes. Down on the beat and up on the off-beat creates a natural link between hand and time.'),
      p('String crossing is the hard part. When you move to a new string, the pick must travel past the string you just played. Keep the movement compact and let the forearm drift slowly across the strings rather than reaching with the wrist.'),
      table(['Count', '1', '+', '2', '+', '3', '+', '4', '+'], [['Stroke', '⊓', 'V', '⊓', 'V', '⊓', 'V', '⊓', 'V']], 'Eighth-note alternate picking: down on numbers, up on "ands".'),
    ],
    guitar: [
      tab(`
e|--------------------------------|
B|--------------------------------|
G|--------------------------------|
D|--------------------------------|
A|-------------------3-2-0-----3--|
E|-0-1-3-0-1-3-0-1-3-------3-1----|`, 'Down-up from the first note and keep alternating across the string change.'),
      tip('Exaggerate silence. Mute the previous string with the palm as you cross so every note is separate.'),
    ],
    exercise: { title: 'One string, then two', steps: ['Alternate-pick the open low E as eighth notes for 8 bars.', 'Play the tab above with strict alternation.', 'Practise the dedicated string-crossing exercise in the Technique Lab.'], exerciseId: 'ex-string-cross' },
    metronome: { bpmStart: 60, bpmTarget: 100, subdivision: 2, instructions: 'Eighth notes. Raise the tempo by 4 bpm only after two clean takes.' },
    mistakes: ['Two downstrokes in a row after a string change.', 'Big swinging pick motion.', 'Speeding up before notes are even.'],
    selfCheck: ['I can alternate-pick across two strings without breaking the pattern.', 'My notes are even in volume and timing.'],
    quiz: [
      q('l1p-1', 'In strict alternate picking, after a downstroke always comes…', ['Another downstroke', 'An upstroke', 'A rest', 'A hammer-on'], 1, 'Strict alternation never repeats a direction.'),
      q('l1p-2', 'In eighth notes, upstrokes fall on…', ['The beats (1, 2, 3, 4)', 'The "ands"', 'Every other bar', 'Random notes'], 1, 'Down on the beat, up on the off-beat.'),
      q('l1p-3', 'The most common string-crossing problem is…', ['Strings too heavy', 'Losing the alternation and repeating a stroke direction', 'Using a thick pick', 'Playing too slowly'], 1, 'Players often slip into two downstrokes at string changes.'),
    ],
    realWorld: 'Surf, punk, metal, bluegrass and fusion all rely on fluent alternate picking. Even simple riffs feel steadier with it.',
    summary: ['Down-up-down-up, every note.', 'Downs on beats, ups on off-beats.', 'Small motions; cross strings without breaking the pattern.'],
    next: 'l1-timing',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-string-cross', bpm: 90 }, criteria: ['Score at least 2 of 3.', 'Log a clean string-crossing take at 90 bpm (eighth notes).'] },
  },
  {
    id: 'l1-timing', level: 1, module: 'm1-notes', title: 'Timing with a metronome: quarters, eighths and sixteenths', minutes: 25,
    objectives: ['Play in time with a metronome', 'Switch between quarter, eighth and sixteenth notes at one tempo', 'Count subdivisions aloud'],
    prerequisites: ['l0-rhythm-notation', 'l1-alternate-picking'], categories: ['rhythm', 'technique'], sources: [src.A('Rhythm tab: quarter and eighth notes'), src.P('Metronome practice method')],
    why: 'Timing is what makes music feel good. A player with simple notes and great time sounds better than a fast player with shaky time.',
    explanation: [
      p('At a given tempo the beat stays the same; subdivisions split it. Quarter notes = one note per click, eighths = two (1-and), sixteenths = four (1-e-and-a). Switching between them without changing the click trains your internal clock.'),
      p('Use the metronome as a partner, not a judge. Aim to "bury" the click: when you are perfectly on the beat, your note masks the click and it seems to disappear.'),
      list('Start slower than you think: the tempo at which you can play perfectly five times in a row.', 'Increase in small steps (+3 to +5 bpm).', 'If you make two mistakes in a row, drop back 8–10 bpm.'),
      theory('At 60 bpm, a quarter note lasts exactly one second, an eighth note half a second and a sixteenth a quarter of a second.'),
    ],
    guitar: [
      tab(`
     1       2       3       4       |1 + 2 + 3 + 4 + |1e+a2e+a3e+a4e+a
e|-------------------------------|----------------|----------------|
B|-------------------------------|----------------|----------------|
G|-------------------------------|----------------|----------------|
D|-------------------------------|----------------|----------------|
A|-------------------------------|----------------|----------------|
E|-5-------5-------5-------5-----|-5-5-5-5-5-5-5-5-|5555555555555555|`, 'The same note as quarters, eighths, then sixteenths: the click never changes.'),
    ],
    exercise: { title: 'Subdivision ladder', steps: ['Metronome at 60 bpm. Play 4 bars of quarters, 4 of eighths, 4 of sixteenths, then back down.', 'Use alternate picking throughout.', 'Repeat at 70 and 80 bpm. Record a take in the Playing Analyzer to measure your timing.'], exerciseId: 'ex-alt-single' },
    metronome: { bpmStart: 60, bpmTarget: 90, subdivision: 4, instructions: 'Use the subdivision setting to hear sixteenths while you learn them.' },
    mistakes: ['Speeding up when switching to faster subdivisions.', 'Slowing down on the slower subdivisions.', 'Not counting aloud.'],
    selfCheck: ['I can switch subdivisions without the tempo drifting.', 'My analyzer timing error is under 30 ms at 70 bpm.'],
    quiz: [
      q('l1t-1', 'At 60 bpm, how long is one eighth note?', ['1 second', '0.5 seconds', '0.25 seconds', '2 seconds'], 1, 'At 60 bpm a beat is 1 s; an eighth is half of that.'),
      q('l1t-2', 'How are sixteenth notes usually counted?', ['1-2-3-4', '1-and', '1-e-and-a', '1-trip-let'], 2, 'Four sixteenths per beat: 1-e-and-a.'),
      q('l1t-3', 'After two mistakes in a row you should…', ['Speed up to push through', 'Drop the tempo 8–10 bpm', 'Stop practising', 'Turn off the metronome'], 1, 'Return to a tempo where you are accurate, then build up again.'),
    ],
    realWorld: 'In recording studios musicians play to a click track. Comfort with a metronome is a professional skill.',
    summary: ['Same click, different subdivisions.', 'Bury the click.', 'Build tempo slowly, retreat when accuracy drops.'],
    next: 'l1-melodies',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-alt-single', bpm: 80 }, criteria: ['Score at least 2 of 3.', 'Log a clean sixteenth-note take at 80 bpm.'] },
  },
  {
    id: 'l1-melodies', level: 1, module: 'm1-notes', title: 'Simple melodies in first position', minutes: 20,
    objectives: ['Play short melodies from tab with correct rhythm', 'Combine fretted and open notes across strings', 'Play expressively, not just correctly'],
    prerequisites: ['l1-timing'], categories: ['repertoire', 'technique'], sources: [src.A('Notes on each string within the first five frets, played through melodies'), src.P()],
    why: 'Melodies connect technique to music. Playing tunes trains your ear, your reading and your sense of phrasing all at once.',
    explanation: [
      p('Hal Leonard\'s Book 1 teaches the notes of each string through short tunes, one string at a time. This lesson condenses that idea: you will play original melodies that use the first five frets of several strings, with one finger per fret.'),
      p('Shape each phrase. Melodies breathe like speech: rise in volume toward the high point of a phrase and relax at the end. Let the last note of each phrase ring for its full value.'),
    ],
    guitar: [
      tab(`
   Melody 1 ("Morning Steps")
e|-------0-----|-----0-1-3---|-1---0-------|-------------|
B|-1-3-------3-|-3-----------|-----3---1---|-0---1-------|
G|-------------|-------------|-------------|-------2-----|
`, 'Original melody in C major. Quarter notes; let the final note ring.'),
      tab(`
   Melody 2 ("Low Road")
G|-----------------|-----------0-----|-----------------|
D|-----0---2---3---|-2---0-----------|-----0---2-------|
A|-0-----------------------3---------|-3---------------|-0------
`, 'Original melody in A minor across three strings.'),
    ],
    exercise: { title: 'Play with feeling', steps: ['Learn Melody 1 slowly with a metronome at 60.', 'Play it again shaping the volume of each phrase.', 'Learn Melody 2, then make up a two-bar melody of your own using the same notes.'] },
    metronome: { bpmStart: 60, bpmTarget: 90, subdivision: 1, instructions: 'Quarter notes; keep long notes their full length.' },
    mistakes: ['Choppy phrasing: lifting fingers too early.', 'Ignoring note lengths.', 'Looking at the tab only, never listening to the result.'],
    selfCheck: ['I can play both melodies from memory.', 'I composed my own two-bar melody.'],
    quiz: [
      q('l1m-1', 'In first position, which finger usually plays fret 3?', ['Finger 1', 'Finger 2', 'Finger 3', 'Thumb'], 2, 'One finger per fret: finger number = fret number in first position.'),
      q('l1m-2', 'What makes a melody sound "musical" rather than mechanical?', ['Always playing loudly', 'Phrasing, dynamics and holding notes for their full length', 'Playing faster', 'More distortion'], 1, 'Expression comes from dynamics, note length and phrasing.'),
    ],
    realWorld: 'Lead guitar is melody. Memorable solos (the ones people sing along to) are melodies first and technique second.',
    summary: ['Melodies combine reading, rhythm and expression.', 'One finger per fret in first position.', 'Shape phrases like sentences.'],
    next: 'l1-open-chords',
    mastery: { quizPass: 1, criteria: ['Answer both questions correctly.', 'Play Melody 1 and Melody 2 in time.'] },
  },
  {
    id: 'l1-open-chords', level: 1, module: 'm1-chords', title: 'Open chords and chord changes', minutes: 30,
    objectives: ['Play Em, Am, C, G, D, E, A and Dm cleanly', 'Change between chords in time', 'Use common fingers and anchor fingers for smoother changes'],
    prerequisites: ['l0-chord-diagrams', 'l1-fretting'], categories: ['chords'], sources: [src.A('Playing chords; changing chords; new chords Am and Dm; two fingerings of A'), src.P()],
    why: 'Eight open chords let you play thousands of songs. They are also the shapes from which barre chords, CAGED and chord theory grow later.',
    explanation: [
      p('Open chords combine fretted notes with open strings. Learn them in this order, which roughly matches their difficulty: Em, Am, E, A, D, Dm, C, G.'),
      chords(['Em', 'Am', 'E', 'A', 'D', 'Dm', 'C', 'G'], 'The eight core open chords. Check each string individually.'),
      p('Chord changes are the real skill. Two tricks make them faster: (1) common fingers: when two chords share a note, keep that finger down (C to Am keeps fingers 1 and 2 in place); (2) the "last-beat release": lift off the old chord on the last beat so the new one lands exactly on the next beat. A few open strings ringing during the change is normal and acceptable.'),
      tip('The one-minute drill: pick two chords, set a timer for 60 seconds, and count how many clean changes you make. Log the number and watch it rise day by day.'),
    ],
    guitar: [
      tab(`
    Em              C               G               D
e|-0-------0---|---0-------0---|---3-------3---|---2-------2---|
B|-0-------0---|---1-------1---|---0-------0---|---3-------3---|
G|-0-------0---|---0-------0---|---0-------0---|---2-------2---|
D|-2-------2---|---2-------2---|---0-------0---|---0-------0---|
A|-2-------2---|---3-------3---|---2-------2---|---------------|
E|-0-------0---|---------------|---3-------3---|---------------|`, 'Strum each chord on beats 1 and 3. Notice which strings to skip for C and D.'),
    ],
    exercise: { title: 'Changes in time', steps: ['Play Em–C–G–D with one strum per beat at 60 bpm, four beats per chord.', 'Then two beats per chord.', 'Run the one-minute drill for Am–C, G–D and E–A, logging your counts.'], exerciseId: 'ex-open-changes' },
    metronome: { bpmStart: 60, bpmTarget: 100, subdivision: 1, instructions: 'One strum per click. The change must land on beat 1.' },
    mistakes: ['Strumming muted strings (low E on C, low E and A on D).', 'Placing fingers one at a time instead of as a shape.', 'Stopping the rhythm to change chords.'],
    selfCheck: ['All eight chords ring clearly string by string.', 'I can change Em–C–G–D at two beats per chord at 80 bpm.'],
    quiz: [
      q('l1c-1', 'Which strings should you NOT strum on an open D chord?', ['High E and B', 'Low E and A', 'Only the G string', 'None'], 1, 'Open D is played on the top four strings (D, G, B, E).'),
      q('l1c-2', 'What is a "common finger" in a chord change?', ['A finger that stays on the same note in both chords', 'The index finger', 'A finger that mutes', 'A finger used for barres only'], 0, 'Keeping a shared note held anchors the hand and speeds the change.'),
      q('l1c-3', 'If a chord change is late, the best fix is to…', ['Stop and wait for the chord', 'Release the old chord on the last beat so the new one lands on time', 'Play faster', 'Skip the chord'], 1, 'Keeping time is more important than a perfect transition. Release early.'),
    ],
    realWorld: 'Campfire songs, pop, folk, country and countless rock songs use only these chords. Learn them well and you can accompany almost anyone.',
    summary: ['Eight open chords form a huge song vocabulary.', 'Use common and anchor fingers.', 'Keep the rhythm going through changes.'],
    next: 'l1-strumming',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-open-changes', bpm: 80 }, criteria: ['Score at least 2 of 3.', 'Log a clean take of the open-chord change exercise at 80 bpm.'] },
    unlocks: { chords: ['Em', 'Am', 'C', 'G', 'D', 'E', 'A', 'Dm'] },
  },
  {
    id: 'l1-strumming', level: 1, module: 'm1-chords', title: 'Strumming patterns and staccato', minutes: 20,
    objectives: ['Strum with a constant down-up arm motion', 'Play basic strumming patterns', 'Use staccato (damped) strums'],
    prerequisites: ['l1-open-chords'], categories: ['rhythm', 'chords'], sources: [src.A('Strumming, down-up strumming, staccato, chord charts'), src.P('Constant-motion strumming')],
    why: 'Strumming is how you accompany songs. A steady strum makes even simple chords groove.',
    explanation: [
      p('Keep your strumming hand moving down and up in eighth notes all the time, like a pendulum, even when you do not hit the strings. Downstrokes fall on the beats and upstrokes on the "ands". A pattern is made by choosing which of those motions actually touch the strings.'),
      table(['Pattern', '1', '+', '2', '+', '3', '+', '4', '+'], [['Basic', 'D', '', 'D', '', 'D', '', 'D', ''], ['Eighths', 'D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'], ['Pop pattern', 'D', '', 'D', 'U', '', 'U', 'D', 'U']], 'The hand always moves; blank cells are "air strums".'),
      p('Staccato means short and detached. Strum, then immediately release fretting pressure (or touch the strings with the strumming palm) so the chord stops. Alternating ringing and staccato strums creates a strong groove.'),
      p('Chord charts show chord names over bar slashes (/ / / /), one slash per beat. They leave the strumming pattern to you, which is how most working guitarists read songs.'),
    ],
    guitar: [
      p('Play G–C–D–G with the pop pattern, one bar per chord. Then play the same progression from a chord chart: | G / / / | C / / / | D / / / | G / / / |, inventing your own pattern.'),
      tip('Relax your wrist and hit fewer strings on upstrokes (usually the top three or four). That is normal and sounds right.'),
    ],
    exercise: { title: 'Pendulum strumming', steps: ['Mute the strings with the fretting hand and practise the pop pattern percussively.', 'Add the chords G–C–D–G.', 'Practise alternating a ringing strum with a staccato strum on beats 2 and 4.'], exerciseId: 'ex-strum-basic' },
    metronome: { bpmStart: 70, bpmTarget: 110, subdivision: 2, instructions: 'Hear the eighth-note subdivision to keep the pendulum steady.' },
    mistakes: ['Stopping the strumming hand on "air" strokes, which breaks the time.', 'Strumming all six strings hard on every upstroke.', 'Tense, stiff wrist.'],
    selfCheck: ['My strumming hand never stops moving.', 'I can play the pop pattern through a four-chord progression.'],
    quiz: [
      q('l1s-1', 'In constant-motion strumming, downstrokes fall on…', ['The "ands"', 'The beats', 'Only beat 1', 'Random places'], 1, 'Down on the beat, up on the off-beat; the hand never stops.'),
      q('l1s-2', 'What does staccato mean?', ['Very loud', 'Short and detached', 'Slow', 'With vibrato'], 1, 'Staccato notes or chords are cut short.'),
      q('l1s-3', 'In a chord chart, "| C / / / |" means…', ['Play C for four beats', 'Play C four times fast', 'Play C, then three other chords', 'Rest for four beats'], 0, 'Each slash is one beat of the chord shown.'),
    ],
    realWorld: 'Most bands give you a chord chart and expect you to find a fitting strum. This lesson gives you the tools to do that.',
    summary: ['The strumming hand is a pendulum.', 'Patterns = which strokes touch the strings.', 'Staccato strums add groove.'],
    next: 'l1-power-chords',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-strum-basic', bpm: 90 }, criteria: ['Score at least 2 of 3.', 'Log a clean strumming take at 90 bpm.'] },
  },
  {
    id: 'l1-power-chords', level: 1, module: 'm1-chords', title: 'Power chords and palm muting', minutes: 25,
    objectives: ['Play two- and three-note power chords on the E and A strings', 'Move power chords along the neck', 'Palm mute for a tight, chunky sound'],
    prerequisites: ['l1-open-chords', 'l1-alternate-picking'], categories: ['chords', 'technique', 'rhythm'], sources: [src.B('Power chords and palm muting throughout the songbook'), src.P('Power-chord construction')],
    why: 'Power chords are the backbone of rock, punk and metal rhythm guitar. With one shape you can play almost any rock riff.',
    explanation: [
      p('A power chord contains only the root and the 5th (often with the root doubled an octave higher). Because it has no 3rd, it is neither major nor minor, which is why it stays clear under heavy distortion where full chords turn muddy. Its symbol is the root plus "5": E5, A5, G5.'),
      p('Shape: finger 1 on the root (E or A string), finger 3 two frets higher on the next string, and optionally finger 4 on the string after that at the same fret. Mute the other strings with the underside of finger 1 and the picking-hand palm.'),
      chords(['G5', 'A5', 'C5', 'D5'], 'Movable power-chord shapes: root on string 6 (G5, A5) or string 5 (C5, D5).'),
      p('Palm muting: rest the edge of your picking hand lightly on the strings right where they meet the bridge saddles. Too far forward and the notes lose their pitch; right on the saddles they stay pitched but tight and percussive. Tab marks it with "PM" and a dashed line.'),
      theory('The name of a power chord comes from the root: the note on the lowest string you play. Knowing the notes on the E and A strings (Level 2) lets you find any power chord instantly.'),
    ],
    guitar: [
      tab(`
     PM----------------------    PM--------------
e|---------------------|--------------------|
B|---------------------|--------------------|
G|---------------------|--------------------|
D|-----------------5---|-----------7---5----|
A|-5-5-5-5-----7-7-3---|-5-5-5-5---5---3----|
E|-3-3-3-3-----5-5-----|-3-3-3-3------------|
     G5        A5  C5        G5      D5  C5`, 'An original palm-muted riff. Downstrokes throughout.'),
    ],
    exercise: { title: 'Power-chord riff', steps: ['Practise moving the G5 shape to A5 and C5 without lifting the shape apart.', 'Play the riff above with palm muting on the repeated eighth notes.', 'Practise the dedicated power-chord exercise in the Technique Lab.'], exerciseId: 'ex-power-chords' },
    metronome: { bpmStart: 70, bpmTarget: 120, subdivision: 2, instructions: 'All downstrokes; keep the chugs even.' },
    mistakes: ['Hitting open strings that should be muted.', 'Palm too far from the bridge, killing the pitch.', 'Shape collapsing when moving between positions.'],
    selfCheck: ['My power chords ring clean with distortion.', 'I can palm mute with pitch still audible.'],
    quiz: [
      q('l1w-1', 'A power chord contains…', ['Root, 3rd and 5th', 'Root and 5th', 'Root and 3rd', 'Root, 4th and 5th'], 1, 'Root and 5th (often with an octave root).'),
      q('l1w-2', 'Why do power chords suit heavy distortion?', ['They are louder', 'With no 3rd, the simple interval stays clear when distorted', 'They use only open strings', 'They are always minor'], 1, 'Complex chords produce clashing distortion products; root-5th stays clear.'),
      q('l1w-3', 'Where should the palm rest for a classic palm mute?', ['Over the neck pickup', 'Lightly on the strings at the bridge saddles', 'On the fretboard', 'On the volume knob'], 1, 'At the saddles you keep pitch while damping sustain.'),
      q('l1w-4', 'A power chord with its root on the A string at fret 3 is…', ['A5', 'C5', 'D5', 'G5'], 1, 'A string fret 3 is C.'),
    ],
    realWorld: 'Punk, grunge and metal riffs are mostly power chords and palm mutes, and many classic hard-rock riffs are too.',
    summary: ['Power chord = root + 5th.', 'Movable shapes on the E and A strings.', 'Palm mute at the saddles for chug.'],
    next: 'l1-riffs',
    mastery: { quizPass: 0.75, practice: { exerciseId: 'ex-power-chords', bpm: 100 }, criteria: ['Score at least 75%.', 'Log a clean power-chord take at 100 bpm.'] },
    unlocks: { chords: ['E5', 'A5', 'G5', 'C5', 'D5'] },
  },
  {
    id: 'l1-riffs', level: 1, module: 'm1-chords', title: 'Basic riffs: rock and blues', minutes: 25,
    objectives: ['Play single-note and power-chord riffs in time', 'Recognise the boogie (shuffle) riff', 'Combine chords and single notes'],
    prerequisites: ['l1-power-chords', 'l1-timing'], categories: ['repertoire', 'rhythm', 'technique'], sources: [src.A('Riffs on the low strings; combining chords and single notes'), src.C('Barre-chord and power-chord riffs'), src.P('The boogie shuffle pattern')],
    why: 'A riff is a short, repeated musical idea, the hook of most rock songs. Riffs combine everything from Level 1: clean notes, picking, timing and power chords.',
    explanation: [
      p('Many classic riffs live on the low strings and use only a few notes. Others alternate power chords with single-note fills. The boogie (or shuffle) riff is the foundation of blues and rock\'n\'roll: the root and 5th alternate with the root and 6th.'),
      p('Rhythm is what makes a riff recognisable. Practise riffs with a metronome until they feel automatic, then focus on attack and dynamics.'),
    ],
    guitar: [
      tab(`
      Boogie in A (shuffle feel)
D|---------------|---------------|-------------------|
A|-2-2-4-4-2-2-4-4|---------------|-2-2-4-4-2-2-4-4---|
E|-0-0-0-0-0-0-0-0|---------------|-0-0-0-0-0-0-0-0---|
                  D|-2-2-4-4-2-2-4-4|
                  A|-0-0-0-0-0-0-0-0|`, 'Root–5 to root–6 on A (bars 1 and 3) and D (bar 2). Swing the eighth notes: long-short.'),
      tab(`
e|------------------------------|
B|------------------------------|
G|------------------------------|
D|-----------------2-0----------|
A|---------0-2-3-------3-2-0----|
E|-0-3-0-3--------------------3-|`, 'An original single-note riff in E minor pentatonic on the low strings.'),
    ],
    exercise: { title: 'Riff toolkit', steps: ['Learn the boogie in A with a shuffle feel (use the "Shuffle" metronome preset).', 'Learn the E minor riff with alternate picking.', 'Create a two-bar riff of your own using the same notes, and save it in the Tab Editor.'], exerciseId: 'ex-blues-shuffle' },
    metronome: { bpmStart: 70, bpmTarget: 110, subdivision: 2, instructions: 'Use the shuffle preset for the boogie.' },
    mistakes: ['Straight eighths where a shuffle is needed.', 'Letting the open low string ring into the next chord.', 'Rushing repeated notes.'],
    selfCheck: ['I can play a 12-bar boogie in A (preview of Level 5).', 'I wrote and saved my own riff.'],
    quiz: [
      q('l1r-1', 'What is a riff?', ['A guitar solo', 'A short, repeated musical idea', 'A type of chord', 'A tuning'], 1, 'A riff is a repeated figure that often forms a song\'s hook.'),
      q('l1r-2', 'The boogie riff alternates root–5th with…', ['Root–3rd', 'Root–6th', 'Root–octave', 'Root–4th'], 1, 'Root–5 then root–6 is the classic boogie movement.'),
      q('l1r-3', 'A shuffle feel means the eighth notes are played…', ['Evenly', 'Long–short', 'Short–long', 'As triplets of equal accent'], 1, 'Shuffled eighths are uneven: long-short, based on triplets.'),
    ],
    realWorld: 'From early rock\'n\'roll to modern blues-rock, the boogie riff and low-string pentatonic riffs are everywhere.',
    summary: ['Riffs are repeated hooks built from simple material.', 'The boogie riff is foundational.', 'Rhythm defines a riff.'],
    next: 'l2-musical-alphabet',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-blues-shuffle', bpm: 90 }, criteria: ['Score at least 2 of 3.', 'Log a clean shuffle take at 90 bpm.'] },
  },
];
