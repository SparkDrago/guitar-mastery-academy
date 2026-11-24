import type { Lesson } from '@gma/learning';
import { p, list, steps, tip, warn, theory, tab, table, q, src, sourceNote } from '../helpers';

export const LEVEL_4: Lesson[] = [
  {
    id: 'l4-tempo-time', level: 4, module: 'm4-time', title: 'Tempo, BPM and time signatures', minutes: 20,
    objectives: ['Relate BPM to beat length', 'Count 4/4, 3/4, 6/8, 12/8 and odd meters', 'Distinguish simple from compound meter'],
    prerequisites: ['l1-timing'], categories: ['rhythm', 'theory'], sources: [src.A('4/4 and 3/4 time'), src.C('5/4, 6/8, 7/4, 12/8 and changing meters'), src.P()],
    why: 'Time signatures tell you how the music is grouped, and therefore where the strong beats are. Feeling the groupings is the difference between playing notes and playing music.',
    explanation: [
      p('Tempo is the speed of the beat in beats per minute (BPM). At 120 BPM there are two beats per second. Tempo markings also have names: largo (slow), andante (walking), moderato, allegro (fast), presto (very fast).'),
      p('Simple meters divide each beat into two: 2/4, 3/4, 4/4. Compound meters divide each beat into three: 6/8 (two beats of three eighths), 9/8, 12/8 (four beats of three eighths). Slow blues is often in 12/8: counted "1-2-3, 2-2-3, 3-2-3, 4-2-3".'),
      p('Odd meters such as 5/4 and 7/8 group beats unevenly: 5/4 often feels 3+2, 7/8 often 2+2+3. Progressive rock and metal use them constantly, as do some classic rock riffs.'),
      table(['Meter', 'Feels like', 'Count'], [['4/4', '4 beats, each split in 2', '1 + 2 + 3 + 4 +'], ['3/4', '3 beats (waltz)', '1 + 2 + 3 +'], ['6/8', '2 beats, each split in 3', '1 2 3 4 5 6'], ['12/8', '4 beats, each split in 3', '1 2 3 2 2 3 3 2 3 4 2 3'], ['5/4', '3 + 2', '1 2 3 4 5'], ['7/8', '2 + 2 + 3', '1 2 1 2 1 2 3']]),
    ],
    guitar: [
      p('Use the metronome presets: "3/4 waltz", "12/8 slow blues", "5/4" and "7/8 (2+2+3)". Strum an E minor chord on every accented click, then on every click.'),
      tip('Tap your foot on the beat and nod on the accents. Feeling meter in the body is faster than counting alone.'),
    ],
    exercise: { title: 'Meter tour', steps: ['Strum quarter notes in 4/4, then 3/4, accenting beat 1.', 'Play 12/8 with the triplet subdivision: strum on 1 of each group, then all three.', 'Play a 7/8 pattern accenting 1, 3 and 5 (2+2+3).'] },
    mistakes: ['Treating 6/8 like 3/4 (6/8 has two strong beats, 3/4 has three).', 'Rushing the long group in odd meters.'],
    selfCheck: ['I can feel and count 12/8 against a metronome.', 'I can play a 7/8 groove without losing my place.'],
    quiz: [
      q('l4t-1', 'At 90 BPM, how long is one beat?', ['0.5 s', '0.667 s', '0.9 s', '1.5 s'], 1, '60 / 90 ≈ 0.667 seconds.'),
      q('l4t-2', '12/8 time has how many main beats per bar?', ['12', '3', '4', '6'], 2, 'Four dotted-quarter beats, each divided into three eighths.'),
      q('l4t-3', 'Which is a compound meter?', ['3/4', '4/4', '6/8', '2/4'], 2, '6/8 divides each of its two beats into three.'),
      q('l4t-4', 'A common grouping for 7/8 is…', ['4 + 3 + 1', '2 + 2 + 3', '7 equal beats', '3 + 3 + 3'], 1, '2+2+3 (or 3+2+2) groupings make 7/8 feel natural.'),
    ],
    realWorld: 'Slow blues in 12/8, folk in 6/8, prog in 7/8: recognising meter lets you lock in with a band in seconds.',
    summary: ['BPM sets beat length.', 'Simple = beats split in 2; compound = split in 3.', 'Odd meters group unevenly.'],
    next: 'l4-subdivisions',
    mastery: { quizPass: 0.75, criteria: ['Score at least 75%.'] },
  },
  {
    id: 'l4-subdivisions', level: 4, module: 'm4-time', title: 'Subdivisions, rests, dots, ties and triplets', minutes: 30,
    objectives: ['Count and play sixteenths, triplets and sixteenth-note triplets', 'Read dotted notes, ties and rests', 'Play the shuffle feel'],
    prerequisites: ['l4-tempo-time'], categories: ['rhythm'], sources: [src.A('Ties, rests, pickups'), src.C('Sixteenth-note triplets; shuffle feel'), src.P()],
    why: 'Real riffs mix note values constantly. Fluent subdivision is what lets you read and play them accurately.',
    explanation: [
      p('Subdivisions split the beat: 2 (eighths, "1 +"), 3 (triplets, "1-trip-let"), 4 (sixteenths, "1 e + a"), 6 (sixteenth-note triplets). Practise moving between them over one click.'),
      p('A dot adds half the note\'s value: a dotted quarter = 1½ beats. Ties connect notes across beats or bar lines. Rests are silences with exact lengths; mute the strings so the silence is real.'),
      p('The shuffle (swing) feel replaces even eighths with the first and third notes of a triplet: long-short, "doo-ba doo-ba". Blues, early rock\'n\'roll and jazz depend on it.'),
      table(['Rhythm', 'Count'], [['♩. ♪ (dotted quarter + eighth)', '1 (2) +'], ['♪ ♩ ♪ (syncopated)', '1 + (2) +'], ['Triplet', '1-trip-let'], ['Shuffle eighths', '1 (trip) let 2 (trip) let']]),
    ],
    guitar: [
      tab(`
   1 e + a 2 e + a 3 trip let 4 trip let
E|-0-0-0-0-0-0-0-0-0---0---0---0---0---0-|`, 'Sixteenths for two beats, then triplets for two beats: one note per syllable.'),
    ],
    exercise: { title: 'Subdivision switching', steps: ['At 70 BPM, play one bar each of eighths, triplets and sixteenths on a muted string; repeat without stopping.', 'Use the "Shuffle @ 90" preset and play the boogie riff from Level 1 with a strong long-short feel.', 'Ear Training → Rhythm, levels 1–3.'], exerciseId: 'ex-alt-single' },
    metronome: { bpmStart: 60, bpmTarget: 90, subdivision: 3, instructions: 'Switch the metronome subdivision to match what you play.' },
    mistakes: ['Triplets that sound like uneven eighths.', 'Dotted rhythms played straight.', 'Ignoring rests.'],
    selfCheck: ['I can switch between 2, 3 and 4 notes per beat without the beat moving.', 'My shuffle sounds like a shuffle.'],
    quiz: [
      q('l4s-1', 'How long is a dotted quarter note?', ['1 beat', '1½ beats', '2 beats', '¾ beat'], 1, 'A dot adds half: 1 + ½ = 1½.'),
      q('l4s-2', 'A triplet divides the beat into…', ['2', '3', '4', '6'], 1, 'Three equal parts.'),
      q('l4s-3', 'Shuffle eighths are based on…', ['Sixteenths', 'Triplets', 'Dotted halves', 'Quintuplets'], 1, 'Long (two triplet parts) + short (one part).'),
    ],
    realWorld: 'Galloping metal, shuffled blues and funk sixteenths all come down to subdivision control.',
    summary: ['Know 2, 3, 4 and 6 per beat.', 'Dots, ties and rests have exact lengths.', 'Shuffle = triplet-based long-short.'],
    next: 'l4-syncopation',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.', 'Reach 80% on Rhythm ear training level 2.'] },
  },
  {
    id: 'l4-syncopation', level: 4, module: 'm4-rhythm-guitar', title: 'Syncopation and strumming patterns', minutes: 25,
    objectives: ['Play syncopated rhythms that accent off-beats', 'Use sixteenth-note strumming', 'Create your own strumming patterns'],
    prerequisites: ['l4-subdivisions', 'l1-strumming'], categories: ['rhythm', 'chords'], sources: [src.C('Syncopated rhythms in barre-chord riffs'), src.A('Three essential acoustic strum patterns'), src.P()],
    why: 'Syncopation is what makes rhythm exciting: notes that land between the beats create energy and groove.',
    explanation: [
      p('Syncopation places emphasis on weak beats or off-beats, often by tying across a strong beat. A pattern of D – D U – U D U skips the downstroke on beat 3, so the "and" of 2 is held over beat 3. That held note is the syncopation.'),
      p('For sixteenth-note strumming, the hand moves down-up in sixteenths: down on 1 and +, up on e and a. Accents and ghost strums (muted, percussive strokes) create funk and pop grooves.'),
      table(['Pattern', '1', 'e', '+', 'a', '2', 'e', '+', 'a'], [['Funk scratch', 'D', '', 'x', 'U', '', 'U', 'D', ''], ['Pop sixteenths', 'D', '', 'D', 'U', '', 'U', 'D', 'U']], 'x = muted (scratch) strum.'),
    ],
    guitar: [
      p('Play | G | Em | C | D | with D – D U – U D U, two bars per chord. Then add a palm-muted ghost strum on the "e" before beat 2.'),
    ],
    exercise: { title: 'Syncopated strumming', steps: ['Practise the syncopated pattern on muted strings until it feels natural.', 'Apply it to G–Em–C–D.', 'Invent a two-bar pattern with at least one tied off-beat.'], exerciseId: 'ex-strum-syncopated' },
    metronome: { bpmStart: 70, bpmTarget: 110, subdivision: 2, instructions: 'Hear eighths; keep the hand moving through skipped strokes.' },
    mistakes: ['Stopping the strumming hand on skipped beats.', 'Accenting the downbeat out of habit.'],
    selfCheck: ['I can play a syncopated pattern without the time wavering.'],
    quiz: [
      q('l4y-1', 'Syncopation means…', ['Playing only on beat 1', 'Emphasising off-beats or weak beats', 'Playing faster', 'Strumming only down'], 1, 'Accents away from the expected strong beats.'),
      q('l4y-2', 'In sixteenth strumming, upstrokes fall on…', ['1 and +', 'e and a', 'Only beat 4', 'Every beat'], 1, 'Down on 1 and +, up on e and a.'),
    ],
    realWorld: 'Funk, reggae, pop and much of rock rhythm guitar are built on syncopated patterns.',
    summary: ['Syncopation = off-beat emphasis.', 'Keep constant motion; choose which strokes connect.', 'Ghost strums add groove.'],
    next: 'l4-metal-rhythm',
    mastery: { quizPass: 1, practice: { exerciseId: 'ex-strum-syncopated', bpm: 90 }, criteria: ['Answer both questions.', 'Log a clean syncopated strumming take at 90 bpm.'] },
  },
  {
    id: 'l4-metal-rhythm', level: 4, module: 'm4-rhythm-guitar', title: 'Palm-muted rhythm, downpicking, gallops and chugging', minutes: 30,
    objectives: ['Downpick eighth notes evenly at speed', 'Play gallop rhythms', 'Combine palm-muted chugs with accented power chords'],
    prerequisites: ['l1-power-chords', 'l4-subdivisions'], categories: ['rhythm', 'technique'], sources: [src.B('Palm-muted power-chord rhythms in rock songs'), src.P('Metal rhythm technique')],
    why: 'Tight rhythm playing is the engine of rock and metal. Endurance and evenness in downpicking matter as much as any lead technique.',
    explanation: [
      p('Downpicking means playing every note with a downstroke for a heavier, more consistent attack. It demands an efficient, relaxed wrist motion: a small arc that returns above the string without touching it.'),
      p('A gallop is a rhythm of an eighth and two sixteenths ("da-da-dum" or "dum-da-da"), named after the sound of a horse. Forward gallop: eighth + two sixteenths. Reverse gallop: two sixteenths + eighth. Pick it down-down-up or down-up-down depending on the feel.'),
      p('Chugging is fast, palm-muted repetition of the lowest string, often between accented chords. Keep the palm position constant so every chug sounds the same.'),
      warn('Downpicking endurance builds over weeks. Stop when your forearm burns, shake out, and return. Pushing through tension leads to injury.'),
    ],
    guitar: [
      tab(`
   PM-----------------------------------
A|---------------------|-------------------|
E|-0-00-0-00-0-00-0-00-|-0-00-0-00-3---5---|`, 'Forward gallops on the open low E (palm muted), then two accented notes.'),
    ],
    exercise: { title: 'Downpick and gallop', steps: ['Downpick eighth notes on the low E for one minute at 120 BPM with palm muting.', 'Play forward gallops for one minute, then reverse gallops.', 'Technique Lab: "Gallop" and "Downpicking endurance" exercises.'], exerciseId: 'ex-gallop' },
    metronome: { bpmStart: 90, bpmTarget: 160, subdivision: 4, instructions: 'Sixteenth subdivision helps place the gallop notes.' },
    mistakes: ['Palm drifting toward the neck, losing pitch.', 'Uneven gallops where the sixteenths blur together.', 'Tensing the forearm instead of relaxing.'],
    selfCheck: ['I can downpick eighths at 140 BPM for 30 seconds evenly.', 'My gallops are clear and in time.'],
    quiz: [
      q('l4m-1', 'A forward gallop is…', ['Two sixteenths then an eighth', 'An eighth then two sixteenths', 'Three triplets', 'Four sixteenths'], 1, 'Eighth + two sixteenths.'),
      q('l4m-2', 'Why do metal players often downpick?', ['It is easier', 'For a heavier, more consistent attack', 'Upstrokes are not allowed', 'To play slower'], 1, 'Downstrokes give a uniform, aggressive attack.'),
      q('l4m-3', 'If your forearm burns during endurance practice you should…', ['Push through', 'Stop, shake out and relax before continuing', 'Pick harder', 'Use a thinner pick'], 1, 'Tension is a warning sign; rest and return relaxed.'),
    ],
    realWorld: 'Thrash and classic heavy metal are built on these rhythms. Even pop-rock uses palm-muted eighths to drive verses.',
    summary: ['Efficient downpicking with a relaxed wrist.', 'Gallops = eighth + two sixteenths (or reverse).', 'Consistent palm position for chugs.'],
    next: 'l4-groove',
    mastery: { quizPass: 0.67, practice: { exerciseId: 'ex-gallop', bpm: 120 }, criteria: ['Score at least 2 of 3.', 'Log a clean gallop take at 120 bpm.'] },
  },
  {
    id: 'l4-groove', level: 4, module: 'm4-rhythm-guitar', title: 'Groove: playing with drums and the shuffle', minutes: 25,
    objectives: ['Lock in with a drum groove', 'Play ahead of, on, or behind the beat intentionally', 'Measure your timing with the Playing Analyzer'],
    prerequisites: ['l4-syncopation'], categories: ['rhythm', 'jamming'], sources: [src.P('Groove and time feel')],
    why: 'Groove is how good the time feels. It is the quality that makes people move, and the main thing bandmates judge you on.',
    explanation: [
      p('Drummers divide the beat with the hi-hat, mark the backbeat (2 and 4) with the snare, and anchor the pulse with the kick. Lock your strums or riffs to the kick and snare and you are "in the pocket".'),
      p('Time feel is where you place notes relative to the grid: on top of the beat (driving, punk), right on it (pop), or slightly behind (laid-back blues and soul). Great players choose deliberately.'),
      p('The Playing Analyzer measures your note attacks against the grid in milliseconds and reports average error, consistency and tempo drift. Use it to make time feel measurable.'),
    ],
    guitar: [
      steps('Open the Jam Lab, choose "Classic rock" at 100 BPM and play G5 eighth notes, locking to the kick and snare.', 'Switch to "Blues shuffle" and play the boogie riff.', 'Record a take in the Playing Analyzer and read your timing report.'),
    ],
    exercise: { title: 'In the pocket', steps: ['Play 2 minutes of eighth-note power chords over the rock groove.', 'Play the same deliberately behind the beat, then ahead, and describe the feel.', 'Run the Analyzer at 90 BPM: target an average error under 25 ms.'] },
    mistakes: ['Listening only to yourself, not the drums.', 'Speeding up in loud sections.'],
    selfCheck: ['My analyzer average error is under 25 ms at 90 BPM.', 'I can play laid-back or driving on purpose.'],
    quiz: [
      q('l4g-1', 'The backbeat in rock is usually on…', ['Beats 1 and 3', 'Beats 2 and 4', 'Every eighth note', 'Only beat 1'], 1, 'The snare marks 2 and 4.'),
      q('l4g-2', 'Playing "behind the beat" sounds…', ['Rushed', 'Laid-back', 'Out of tune', 'Louder'], 1, 'Slightly late placement feels relaxed.'),
    ],
    realWorld: 'Drummers and bassists will play with you again if your groove is solid. This is the most valuable band skill.',
    summary: ['Lock to kick and snare.', 'Choose your time feel.', 'Measure timing to improve it.'],
    next: 'l5-minor-pentatonic',
    mastery: { quizPass: 1, criteria: ['Answer both questions.', 'Average timing error under 25 ms in an analyzer take at 90 bpm.'] },
  },
];
