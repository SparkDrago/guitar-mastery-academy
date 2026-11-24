import type { Lesson } from '@gma/learning';
import { p, list, steps, tip, warn, theory, tab, table, fb, chords, q, src } from '../helpers';

export const LEVEL_10: Lesson[] = [
  {
    id: 'l10-motifs', level: 10, module: 'm10-language', title: 'Motifs: repetition, variation and development', minutes: 35,
    objectives: ['Invent short motifs', 'Develop them by repetition, rhythmic change, transposition and extension', 'Build a solo from one idea'],
    prerequisites: ['l5-blues-phrasing'], categories: ['improvisation'], sources: [src.P('Motivic development')],
    why: 'Memorable solos are built from ideas that return and evolve. Motivic development gives solos coherence and makes them sound composed even when improvised.',
    explanation: [
      p('A motif is a short musical idea, 3 to 6 notes with a distinctive rhythm. Development techniques: repeat it exactly; change one note; change the rhythm; start it on a different beat; move it to another scale degree (sequence); extend or shorten it; invert its direction.'),
      p('A solo built on one motif feels like a story: statement, variations, climax, return.'),
    ],
    guitar: [
      tab(`
   motif          sequence (up a step)   rhythmic variation
B|-8-5-----------10-8-----------8--8-5--|
G|------7-----------9-------------------|
D|---------------------------------7----|`, 'Original A minor motif, its sequence, and a rhythmic variation ending lower.'),
    ],
    exercise: { title: 'One idea, one solo', steps: ['Invent a motif over an A minor groove.', 'Play it 8 times, varying it each time with a different technique.', 'Complete the "Develop a motif" Jam Lab challenge.'] },
    mistakes: ['Abandoning ideas after one play.', 'Varying so much that the motif is unrecognisable.'],
    selfCheck: ['I can develop one motif across a whole chorus.'],
    quiz: [
      q('l10m-1', 'Playing a motif starting on a different scale degree is called a…', ['Repetition', 'Sequence', 'Retrograde', 'Fermata'], 1, 'A sequence repeats the shape from a new starting point.'),
      q('l10m-2', 'Why use motifs?', ['They give solos coherence and memorability', 'They make solos longer', 'They avoid chord tones', 'They are faster'], 0, 'Recurring ideas make music easier to follow and remember.'),
    ],
    realWorld: 'Many classic guitar solos are built from a single developed idea.',
    summary: ['Short, rhythmic ideas.', 'Repeat, vary, sequence, extend.', 'Tell a story with one motif.'],
    next: 'l10-targeting',
    mastery: { quizPass: 1, criteria: ['Answer both questions.', 'Complete the motif challenge.'] },
    unlocks: { challenges: ['motif'] },
  },
  {
    id: 'l10-targeting', level: 10, module: 'm10-language', title: 'Target notes, connecting scales and blending pentatonic with modes', minutes: 35,
    objectives: ['Plan target notes for each chord', 'Connect scale positions around targets', 'Blend pentatonic and modal sounds'],
    prerequisites: ['l8-chord-tones', 'l10-motifs'], categories: ['improvisation'], sources: [src.P()],
    why: 'Targets are the skeleton of a solo; scales are the muscles. Planning where phrases land makes improvisation purposeful.',
    explanation: [
      p('Choose a target note for each chord change (usually the 3rd or 7th) and improvise toward it. Arriving exactly on the beat of the change makes the harmony audible in your line.'),
      p('Pentatonic–modal blending: the pentatonic is a five-note skeleton of a seven-note mode. Add the two missing notes for colour: A minor pentatonic + B + F♯ = A Dorian; + B + F = A Aeolian. Start phrases with pentatonic licks and finish with the mode\'s characteristic note.'),
    ],
    guitar: [
      fb('A', { scale: 'dorian', minFret: 4, maxFret: 9, labels: 'interval', caption: 'A Dorian: the minor pentatonic plus 2 (B) and 6 (F♯).' }),
    ],
    exercise: { title: 'Aim and fire', steps: ['Over a I–IV–V in A, write down the 3rd of each chord, then improvise landing on each.', 'Over an A Dorian vamp, alternate between pentatonic phrases and phrases featuring F♯.'] },
    mistakes: ['Choosing targets but arriving late.'],
    selfCheck: ['I can hit planned targets on chord changes.'],
    quiz: [
      q('l10t-1', 'A minor pentatonic plus 2 and 6 gives…', ['A Aeolian', 'A Dorian', 'A Phrygian', 'A Lydian'], 1, 'The natural 6 makes it Dorian.'),
      q('l10t-2', 'Good target notes at a chord change are usually…', ['Notes a half step above chord tones', 'The 3rd or 7th of the new chord', 'Random', 'Open strings'], 1, 'Guide tones outline the harmony.'),
    ],
    realWorld: 'Rock players blend pentatonic and modal sounds constantly; jazz players plan targets.',
    summary: ['Plan targets, arrive on time.', 'Pentatonic = skeleton; modes add colour.'],
    next: 'l10-chromatic',
    mastery: { quizPass: 1, criteria: ['Answer both questions.'] },
  },
  {
    id: 'l10-chromatic', level: 10, module: 'm10-language', title: 'Chromatic approaches, passing tones and enclosures', minutes: 35,
    objectives: ['Approach target notes chromatically', 'Use passing tones between scale notes', 'Play enclosures around targets'],
    prerequisites: ['l10-targeting'], categories: ['improvisation'], sources: [src.C('Blues scale ♭5 as a passing note'), src.P('Chromatic approach techniques')],
    why: 'Chromatic notes add sophistication and forward motion. Placed on weak beats and resolving to chord tones, "outside" notes sound intentional.',
    explanation: [
      p('A chromatic approach note sits a half step below (or above) a target and resolves to it. Passing tones connect two scale notes by half steps (the blues scale\'s ♭5 between 4 and 5 is the classic example). An enclosure surrounds a target: a note above, a note below, then the target.'),
      p('Rule of thumb: put the chromatic note on a weak beat or off-beat and the target on the strong beat.'),
    ],
    guitar: [
      tab(`
G|-------------------------|
B|-4-5-----6-4-5-----------|
   ^approach  ^enclosure → E (B string, fret 5)`, 'Original: chromatic approach from below, then an enclosure (above, below, target).'),
    ],
    exercise: { title: 'Outside, then home', steps: ['Over A7, approach C♯ (the 3rd) from C and from D.', 'Enclose E (the 5th) over A7 with F and D♯.', 'Use one chromatic approach per phrase in a blues solo.'] },
    mistakes: ['Landing chromatic notes on strong beats.'],
    selfCheck: ['I can enclose any chord tone.'],
    quiz: [
      q('l10c-1', 'An enclosure is…', ['A slide into the target', 'Notes above and below the target before resolving to it', 'A bend', 'A rest'], 1, 'Surround, then resolve.'),
      q('l10c-2', 'Chromatic approach notes sound best on…', ['Strong beats', 'Weak beats or off-beats, resolving to strong-beat targets', 'Only the last note', 'Anywhere, equally'], 1, 'Tension on weak beats, resolution on strong beats.'),
    ],
    realWorld: 'Bebop lines and blues licks use approaches and passing tones constantly.',
    summary: ['Approach from a half step away.', 'Passing tones connect scale notes.', 'Enclose targets; resolve on strong beats.'],
    next: 'l10-rhythm-space',
    mastery: { quizPass: 1, criteria: ['Answer both questions.'] },
  },
  {
    id: 'l10-rhythm-space', level: 10, module: 'm10-language', title: 'Rhythmic variation, space, phrasing, tension and resolution', minutes: 35,
    objectives: ['Vary rhythm deliberately', 'Shape solos with space and dynamics', 'Build and release tension across a solo'],
    prerequisites: ['l10-motifs', 'l4-subdivisions'], categories: ['improvisation', 'rhythm'], sources: [src.P()],
    why: 'Rhythm and space are the most overlooked improvisation tools. The same notes with better rhythm sound like a different, better solo.',
    explanation: [
      list('Rhythmic displacement: start a phrase on a different beat or off-beat.', 'Density contrast: alternate sparse long notes with bursts of fast notes.', 'Space: rests as long as phrases.', 'Tension sources: high register, repetition, chromaticism, faster notes, held bends.', 'Resolution: return to chord tones, lower register, longer notes.'),
      p('Shape a solo like a story: low and sparse at the start, building intensity, a climax (often the highest note), then resolution. Dynamics matter: use the guitar\'s volume knob and picking strength.'),
    ],
    guitar: [
      p('Improvise one chorus using only quarter notes, the next using only eighths, the next mixing them with long rests. Record each and compare.'),
    ],
    exercise: { title: 'Rhythm-first solo', steps: ['Over a minor groove, improvise with only two notes but varied rhythm.', 'Plan a chorus: bars 1–4 sparse, 5–8 busier, 9–12 climax and resolve.'] },
    mistakes: ['Constant eighth notes with no space.', 'Climaxing in the first bar.'],
    selfCheck: ['My solos have a clear shape.'],
    quiz: [
      q('l10r-1', 'Which builds tension?', ['Long notes on the root', 'Ascending to a high register with faster notes', 'Silence', 'Ending on the root'], 1, 'Register and density increase tension.'),
      q('l10r-2', 'Rhythmic displacement means…', ['Playing out of time', 'Starting a phrase on a different beat', 'Changing tempo', 'Playing faster'], 1, 'Same idea, new position in the bar.'),
    ],
    realWorld: 'Great soloists are recognisable by their rhythmic phrasing as much as their note choice.',
    summary: ['Vary rhythm and density.', 'Use space.', 'Shape tension and resolution.'],
    next: 'l10-styles',
    mastery: { quizPass: 1, criteria: ['Answer both questions.'] },
  },
  {
    id: 'l10-styles', level: 10, module: 'm10-styles', title: 'Improvising in style: blues, rock, metal and fusion', minutes: 40,
    objectives: ['Recognise the vocabulary of four styles', 'Adapt scale choice, technique and phrasing to style', 'Improvise at different tempos'],
    prerequisites: ['l10-rhythm-space', 'l10-chromatic'], categories: ['improvisation', 'jamming'], sources: [src.P()],
    why: 'Each style has its own language. Speaking it convincingly means adapting scales, techniques, tone and rhythm, not just notes.',
    explanation: [
      table(['Style', 'Scales', 'Techniques', 'Phrasing'], [
        ['Blues', 'Minor & major pentatonic, blues scale, Mixolydian', 'Bends, vibrato, slides, call & response', 'Vocal, behind the beat, lots of space'],
        ['Rock', 'Pentatonic + Aeolian/Dorian/Mixolydian', 'Bends, legato, double stops, repeated licks', 'Riff-based, energetic, on the beat'],
        ['Metal', 'Aeolian, Phrygian, harmonic minor, diminished', 'Alternate picking, sweeps, tapping, tremolo', 'Precise, fast runs, dramatic climaxes'],
        ['Fusion', 'Dorian, Lydian, melodic minor modes, chromaticism', 'Legato, outside playing, wide intervals', 'Long lines, chord-scale awareness'],
      ]),
      p('Tempo changes the vocabulary too: slow blues allows long held notes; fast tempos favour shorter motifs and rhythmic punch.'),
    ],
    guitar: [
      p('In the Jam Lab, play the same 4-bar idea over Blues, Hard rock, Heavy metal and Fusion styles, adapting it to each.'),
    ],
    exercise: { title: 'Style switching', steps: ['Improvise one chorus in each style with appropriate scales and techniques.', 'Try each at a slow and a fast tempo.'] },
    mistakes: ['Playing the same licks in every style.'],
    selfCheck: ['Bandmates could tell which style I am improvising in.'],
    quiz: [
      q('l10s-1', 'Which scale is most associated with neoclassical metal?', ['Major pentatonic', 'Harmonic minor', 'Mixolydian', 'Whole tone'], 1, 'Harmonic minor and Phrygian dominant.'),
      q('l10s-2', 'Fusion improvisation typically emphasises…', ['Only the blues scale', 'Modes, chord-scale awareness and chromaticism', 'Power chords', 'Open strings'], 1, 'Fusion draws on jazz harmony.'),
    ],
    realWorld: 'Session players switch styles daily; versatility is employability.',
    summary: ['Styles differ in scales, technique, phrasing and tone.', 'Adapt to tempo.'],
    next: 'l11-key-finding',
    mastery: { quizPass: 1, criteria: ['Answer both questions.'] },
  },
];

export const LEVEL_11: Lesson[] = [
  {
    id: 'l11-key-finding', level: 11, module: 'm11-jamming', title: 'Finding the key and hearing chord changes', minutes: 35,
    objectives: ['Find the key of a song by ear', 'Recognise common chord changes by ear', 'Follow a progression you have never heard before'],
    prerequisites: ['l3-diatonic-chords', 'l2-pitch'], categories: ['ear', 'jamming'], sources: [src.P()],
    why: 'In real jams nobody hands you a chart. Hearing the key and the changes lets you join in within seconds.',
    explanation: [
      steps('Find home: hum the note the song feels like it rests on. Find it on the guitar.', 'Test major or minor: play a major then a minor chord on that note; one will fit.', 'Check with the scale: play the key\'s scale quietly; if no notes clash, you have it.', 'Hear changes: follow the bass. Rising a 4th (or falling a 5th) is often I → IV; rising a 5th, I → V; falling a minor 3rd, I → vi.'),
      tip('Most songs use I, IV, V and vi. Guess those first.'),
    ],
    guitar: [
      p('Ear Training → Progressions levels 1–2. Then play along with any song you like: find the key in under 30 seconds.'),
    ],
    exercise: { title: 'Key detective', steps: ['Find the key of three songs by ear.', 'Write the progression of one as Roman numerals.', 'Reach 80% in progression ear training level 1.'] },
    mistakes: ['Assuming the first chord is the key.'],
    selfCheck: ['I can find the key of most songs in under a minute.'],
    quiz: [
      q('l11k-1', 'The quickest way to find a song\'s key is to…', ['Look at the singer', 'Find the note the music resolves to, then test major/minor', 'Count bars', 'Use the highest note'], 1, 'Home note first, then quality.'),
      q('l11k-2', 'A bass line rising a 4th from the tonic most likely moves to…', ['ii', 'IV', 'vi', 'vii°'], 1, 'I → IV is up a perfect 4th.'),
    ],
    realWorld: 'This is the core jam-session skill.',
    summary: ['Find home, test quality, check with the scale.', 'Follow the bass to hear changes.'],
    next: 'l11-band',
    mastery: { quizPass: 1, criteria: ['Answer both questions.', 'Reach 80% on progression ear training level 1.'] },
  },
  {
    id: 'l11-band', level: 11, module: 'm11-jamming', title: 'Playing with drummers and bassists: groove, comping and trading solos', minutes: 35,
    objectives: ['Lock in with a rhythm section', 'Comp tastefully behind a soloist or singer', 'Trade solos (fours and eights)'],
    prerequisites: ['l4-groove', 'l8-inversions'], categories: ['jamming', 'rhythm'], sources: [src.P()],
    why: 'In a band, what you leave out matters as much as what you play. Rhythm-section awareness makes you the guitarist people want to play with.',
    explanation: [
      list('Lock with the kick drum and the bass; accent where they accent.', 'Stay out of the bass register when comping: use triads and small voicings on the top strings.', 'Comping: support the soloist with sparse, rhythmic chords; respond to their phrases.', 'Trading fours: soloists alternate 4-bar solos; listen and pick up the previous player\'s idea.', 'Dynamics: play softer behind vocals, build into choruses.'),
    ],
    guitar: [
      p('In the Jam Lab, mute the chord track and comp with small triads over drums and bass. Then alternate 4 bars of comping with 4 bars of soloing.'),
    ],
    exercise: { title: 'Band simulation', steps: ['Comp over the "Funk" style using short 9th-chord stabs on the off-beats.', 'Trade fours with yourself: 4 bars solo, 4 bars comp, for three choruses.'] },
    mistakes: ['Playing full six-string chords that clash with keys and bass.', 'Overplaying behind the soloist.'],
    selfCheck: ['I can comp without getting in the way.'],
    quiz: [
      q('l11b-1', 'When comping behind a soloist you should…', ['Play as much as possible', 'Play sparse, supportive rhythms and leave space', 'Solo at the same time', 'Stop playing'], 1, 'Support, do not compete.'),
      q('l11b-2', '"Trading fours" means…', ['Playing four chords', 'Soloists alternating four-bar solos', 'Four guitarists', 'Changing tuning four times'], 1, 'Alternating short solos.'),
    ],
    realWorld: 'Every band rehearsal and jam session uses these skills.',
    summary: ['Lock with kick and bass.', 'Comp small and sparse.', 'Trade solos by listening.'],
    next: 'l11-song-structure',
    mastery: { quizPass: 1, criteria: ['Answer both questions.'] },
  },
  {
    id: 'l11-song-structure', level: 11, module: 'm11-jamming', title: 'Song structure, chart navigation and live performance', minutes: 30,
    objectives: ['Recognise intro, verse, chorus, bridge and outro', 'Read repeat signs, endings, D.S. and coda', 'Prepare for performance'],
    prerequisites: ['l11-band'], categories: ['repertoire', 'jamming'], sources: [src.B('Chart navigation: rhythm figures, endings, D.S./coda markings'), src.A('1st and 2nd endings'), src.P('Performance preparation')],
    why: 'Knowing where you are in a song, and how charts tell you where to go, prevents train wrecks on stage.',
    explanation: [
      p('Common forms: verse–chorus (V C V C bridge C), AABA (32-bar standards), and the 12-bar blues. Charts compress repetition with symbols: repeat signs (|: :|), 1st and 2nd endings, D.S. (go back to the sign), D.C. (go back to the start), "al Coda" (jump to the coda when you reach the coda symbol).'),
      list('Performance checklist: tuned instrument and spare strings, set list with keys and tempos, a backup cable, a quick sound check routine, and a plan for mistakes: keep going, never stop.', 'Rehearse transitions between sections more than the sections themselves.'),
    ],
    guitar: [
      p('In the Tab Editor, write a two-section exercise with a repeat and first/second endings; check the playback order.'),
    ],
    exercise: { title: 'Gig ready', steps: ['Map the structure of a song you know (sections and bar counts).', 'Play it start to finish without stopping, even through mistakes.', 'Record yourself performing it.'] },
    mistakes: ['Stopping after a mistake.', 'Not knowing how many bars each section lasts.'],
    selfCheck: ['I can play a full song without stopping.'],
    quiz: [
      q('l11s-1', '"D.S. al Coda" means…', ['Play faster', 'Go back to the sign, then jump to the coda at the coda symbol', 'End now', 'Repeat the first bar'], 1, 'Back to the segno, then to the coda.'),
      q('l11s-2', 'If you make a mistake on stage you should…', ['Stop and restart', 'Keep going in time', 'Apologise', 'Play louder'], 1, 'The audience rarely notices if you keep the groove.'),
    ],
    realWorld: 'Professional musicians rehearse structure and transitions so performances stay solid under pressure.',
    summary: ['Know the form.', 'Read navigation symbols.', 'Never stop on stage.'],
    next: 'l12-advanced-harmony',
    mastery: { quizPass: 1, criteria: ['Answer both questions.', 'Play a complete song without stopping.'] },
  },
];

export const LEVEL_12: Lesson[] = [
  {
    id: 'l12-advanced-harmony', level: 12, module: 'm12-artistry', title: 'Advanced harmony and arpeggios for jazz and fusion', minutes: 40,
    objectives: ['Use extended arpeggios (maj9, m11, 13)', 'Apply upper-structure triads', 'Navigate ii–V–I progressions with chord-scale awareness'],
    prerequisites: ['l8-chord-scale', 'l8-extended'], categories: ['theory', 'improvisation', 'chords'], sources: [src.P()],
    why: 'Advanced harmony unlocks jazz, fusion and sophisticated rock. Thinking in extensions and upper structures gives instant, colourful vocabulary.',
    explanation: [
      p('Extended arpeggios continue the stack of thirds: Cmaj9 = C E G B D. Playing the arpeggio from the 3rd (E G B D = Em7) over C gives a Cmaj9 sound: this "arpeggio substitution" is a quick way to access extensions.'),
      p('Upper-structure triads: over a dominant chord, play a triad built on another degree to imply tensions. Over C7, a D major triad (D F♯ A) implies 9, ♯11 and 13; an A♭ major triad implies ♭13, root and ♯9.'),
      p('ii–V–I navigation: Dm7 (Dorian) – G7 (Mixolydian or altered) – Cmaj7 (Ionian/Lydian). Connect guide tones: F (♭3 of Dm7) → F (♭7 of G7) → E (3 of Cmaj7).'),
    ],
    guitar: [
      chords(['Dm9', 'G13', 'Cmaj9'], 'A lush ii–V–I.'),
    ],
    exercise: { title: 'Extensions in context', steps: ['Over Cmaj7, play Em7 and G major arpeggios: hear the 9 and 7.', 'Over G7, try a D triad and then an E♭ triad (♭13, root, ♭9 colours).', 'Play guide-tone lines through a ii–V–I in three keys.'] },
    mistakes: ['Using upper structures without resolving.'],
    selfCheck: ['I can outline a ii–V–I with guide tones.'],
    quiz: [
      q('l12a-1', 'Playing Em7 over C produces which sound?', ['C7', 'Cmaj9', 'Cm7', 'Csus4'], 1, 'E G B D over C = 3 5 7 9.'),
      q('l12a-2', 'Over C7, a D major triad implies…', ['♭9 ♯9', '9 ♯11 13', '♭5 ♯5', 'Root 3 5'], 1, 'D F♯ A = 9, ♯11, 13 of C.'),
    ],
    realWorld: 'Jazz guitarists use these devices daily; fusion and prog players borrow them for colour.',
    summary: ['Extended arpeggios and substitutions.', 'Upper-structure triads.', 'Guide-tone lines through ii–V–I.'],
    next: 'l12-neoclassical-prog',
    mastery: { quizPass: 1, criteria: ['Answer both questions.'] },
  },
  {
    id: 'l12-neoclassical-prog', level: 12, module: 'm12-artistry', title: 'Neoclassical guitar and progressive metal', minutes: 40,
    objectives: ['Use harmonic minor, diminished arpeggios and pedal-point lines', 'Play in odd meters and with polyrhythms', 'Combine extended-range guitars and drop tunings musically'],
    prerequisites: ['l9-sweep', 'l7-minor-modes', 'l4-tempo-time'], categories: ['technique', 'rhythm', 'scales'], sources: [src.P()],
    why: 'Neoclassical and progressive metal combine advanced technique with classical harmony and complex rhythm. They test everything you have learned.',
    explanation: [
      list('Neoclassical vocabulary: harmonic minor and Phrygian dominant runs, diminished 7th arpeggios (movable every three frets), pedal-point sequences (alternating a fixed note with a moving line), sweep-picked arpeggios following classical progressions (i–iv–V–i).', 'Progressive metal: odd meters (7/8, 5/4, 11/8), riffs that cycle against the bar line, polyrhythms (e.g. a 3-note riff over a 4/4 drum pattern), extended-range guitars and drop tunings, syncopated palm-muted riffs, and clean, ambient sections.'),
      p('Use the metronome\'s odd-meter presets and the Jam Lab\'s Progressive metal and Neoclassical styles. The fretboard and tab editor support 7- and 8-string tunings.'),
    ],
    guitar: [
      tab(`
B|-10-9-10-6-10-9-10-5-10-9-10-6-10-9-10-3-|
   pedal point on B string fret 10 (A harmonic minor)`, 'Original pedal-point figure in A harmonic minor (G♯ at fret 9).'),
    ],
    exercise: { title: 'Prog and neoclassical lab', steps: ['Play the pedal-point figure, then invent your own.', 'Play a 7/8 riff (2+2+3) on a low string for two minutes against the metronome.', 'Try an 8-string drop-E tuning on the fretboard and write a riff in the Tab Editor.'] },
    mistakes: ['Technique without musical purpose.', 'Losing the downbeat in odd meters.'],
    selfCheck: ['I can play a 7/8 riff and a pedal-point line in time.'],
    quiz: [
      q('l12n-1', 'A pedal-point line…', ['Uses a pedal effect', 'Alternates a fixed note with a moving line', 'Is played with the feet', 'Uses only open strings'], 1, 'One note repeats while the other line moves.'),
      q('l12n-2', 'Diminished 7th arpeggios repeat every…', ['2 frets', '3 frets', '5 frets', '12 frets only'], 1, 'Stacked minor 3rds make them symmetrical every three frets.'),
    ],
    realWorld: 'These styles demand precision and imagination in equal measure.',
    summary: ['Harmonic minor, diminished, pedal points.', 'Odd meters and polyrhythms.', 'Extended range used musically.'],
    next: 'l12-composition',
    mastery: { quizPass: 1, criteria: ['Answer both questions.'] },
  },
  {
    id: 'l12-composition', level: 12, module: 'm12-artistry', title: 'Composition, solo construction and signature phrasing', minutes: 40,
    objectives: ['Compose a short piece with sections', 'Construct a composed solo', 'Develop personal signature phrases'],
    prerequisites: ['l10-styles', 'l11-song-structure'], categories: ['improvisation', 'repertoire'], sources: [src.P()],
    why: 'Composition turns everything you know into something only you could have written. Composed solos and signature phrases become your musical identity.',
    explanation: [
      steps('Start with a riff or chord progression (use the Jam Lab or Tab Editor).', 'Build sections: verse, chorus, bridge, contrasting in register, rhythm or key.', 'Compose a solo: write a motif, develop it, plan the climax, end on a resolving note.', 'Refine: cut what is unnecessary; every note should have a reason.'),
      p('Signature phrasing: notice the licks you naturally return to, then refine them: a particular bend, a rhythmic quirk, a favourite interval. Consistent use of personal devices is what makes famous players instantly recognisable.'),
    ],
    guitar: [
      p('Write a 16-bar piece in the Tab Editor with a riff section and a composed 8-bar solo; save it as a custom exercise and practise it in the Practice Studio.'),
    ],
    exercise: { title: 'Write it', steps: ['Compose a 16-bar piece.', 'Record it and listen back critically.', 'List three phrases that feel like "you".'] },
    mistakes: ['Never finishing a piece.', 'Over-complicating.'],
    selfCheck: ['I have finished and recorded an original piece.'],
    quiz: [
      q('l12c-1', 'A strong composed solo usually…', ['Uses every technique', 'Develops a motif toward a planned climax and resolution', 'Avoids repetition', 'Stays in one register'], 1, 'Structure and development.'),
      q('l12c-2', 'Signature phrasing comes from…', ['Copying one player exactly', 'Refining the devices you naturally return to', 'Avoiding all licks', 'Speed only'], 1, 'Your recurring choices become your voice.'),
    ],
    realWorld: 'Original music is the destination of musical training.',
    summary: ['Riff → sections → solo → refine.', 'Develop signature devices.'],
    next: 'l12-transcription',
    mastery: { quizPass: 1, criteria: ['Answer both questions.', 'Save an original 16-bar piece in the Tab Editor.'] },
  },
  {
    id: 'l12-transcription', level: 12, module: 'm12-artistry', title: 'Transcription, ear training, analysis and your guitar identity', minutes: 40,
    objectives: ['Transcribe solos and riffs by ear', 'Analyse what makes them work', 'Plan your ongoing development'],
    prerequisites: ['l11-key-finding', 'l12-composition'], categories: ['ear', 'theory', 'repertoire'], sources: [src.D('Practice: continuous mental reinforcement through improvising'), src.P()],
    why: 'Transcription is how generations of musicians learned: by ear, from records. Analysing what you transcribe turns other people\'s ideas into your vocabulary.',
    explanation: [
      steps('Choose a short passage (4–8 bars).', 'Find the key and the chords first.', 'Sing each phrase, then find it on the guitar, a few notes at a time.', 'Write it in the Tab Editor, including rhythm and techniques.', 'Analyse: which scale, which chord tones on strong beats, which techniques, why it works.', 'Make it yours: play the idea in other keys and over other chords.'),
      p('Your guitar identity grows from the sum of your choices: the music you transcribe, the techniques you refine, the sounds you love. Keep a practice journal (the Practice Studio notes) and revisit your goals each month.'),
    ],
    guitar: [
      p('Transcribe a short melody from any recording you have permission to listen to, enter it in the Tab Editor and analyse it with the Scale Explorer.'),
    ],
    exercise: { title: 'Transcribe and analyse', steps: ['Transcribe 8 bars of a solo by ear.', 'Write a paragraph analysing it.', 'Use one idea from it in your own improvisation.'] },
    mistakes: ['Transcribing too much at once.', 'Skipping the analysis.'],
    selfCheck: ['I have transcribed and analysed a solo.'],
    quiz: [
      q('l12t-1', 'What should you identify first when transcribing?', ['The fastest lick', 'The key and chords', 'The guitar model', 'The tempo only'], 1, 'Harmony gives context for every note.'),
      q('l12t-2', 'Why analyse a transcription?', ['To pass time', 'To understand why it works and reuse the ideas', 'It is required by law', 'To correct the original player'], 1, 'Analysis turns imitation into vocabulary.'),
    ],
    realWorld: 'Transcription is the most effective lifelong learning habit for musicians.',
    summary: ['Key and chords first, then notes.', 'Analyse and transfer ideas.', 'Your identity is built from your choices.'],
    mastery: { quizPass: 1, criteria: ['Answer both questions.', 'Transcribe and analyse 8 bars.'] },
  },
];
