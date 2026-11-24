import type { Lesson } from '@gma/learning';
import { p, list, steps, tip, warn, theory, tab, chords, table, fb, q, src } from '../helpers';

export const LEVEL_0: Lesson[] = [
  {
    id: 'l0-anatomy', level: 0, module: 'm0-instrument', title: 'Anatomy of the electric guitar', minutes: 15,
    objectives: ['Name every major part of an electric guitar', 'Explain what pickups, the selector switch and the volume/tone knobs do', 'Know which parts affect tuning and playability'],
    prerequisites: [], categories: ['theory'], sources: [src.A('Getting Started: parts of the guitar'), src.P('Electric-specific hardware: pickups, bridges, electronics')],
    why: 'You will hear these names in every lesson, every video and every guitar shop. Knowing what each part does also tells you which knob to turn when the guitar sounds wrong, and which parts to leave alone.',
    explanation: [
      p('An electric guitar has three zones. The headstock holds the tuners (machine heads), which change string tension and therefore pitch. The neck carries the fretboard: a strip of wood with metal frets hammered across it. The body holds the electronics and the bridge.'),
      p('Strings run from the tuners, over the nut (a slotted strip at the top of the fretboard), along the neck, over the pickups, and end at the bridge. The vibrating length between nut and bridge saddles is the scale length; pressing a string behind a fret shortens that length and raises the pitch.'),
      p('Unlike an acoustic guitar, a solid electric guitar is almost silent on its own. Pickups (magnets wrapped in thousands of turns of fine wire) sense the steel strings vibrating and turn that motion into a tiny electrical signal. Single-coil pickups sound bright and glassy; humbuckers use two coils wired to cancel hum and sound thicker and louder, which suits overdrive.'),
      table(['Part', 'What it does'], [
        ['Tuners', 'Raise or lower each string\'s pitch'],
        ['Nut', 'Spaces the strings and sets their height at the headstock end'],
        ['Frets', 'Metal bars; each one is one semitone higher than the last'],
        ['Inlays', 'Position markers (usually frets 3, 5, 7, 9, 12, 15 …)'],
        ['Pickups', 'Convert string vibration to an electrical signal'],
        ['Selector switch', 'Chooses neck, bridge or combined pickups'],
        ['Volume / tone knobs', 'Set output level and roll off treble'],
        ['Bridge & saddles', 'Anchor the strings; saddles set string height and intonation'],
        ['Tremolo arm (if fitted)', 'Lowers (sometimes raises) the pitch of all strings'],
        ['Output jack', 'Where the cable plugs in'],
      ]),
      theory('The neck pickup sits where the strings swing widely, giving a warm, round tone. The bridge pickup sits near the fixed end where the motion is small and complex, giving a bright, cutting tone.'),
    ],
    guitar: [
      p('Pick up your guitar and find each part from the table. Then plug in (or imagine plugging in) and flip the selector switch while playing an open string: neck position for warm rhythm and smooth leads, bridge position for biting riffs and solos, middle positions for mixed tones.'),
      tip('Turn the tone knob down to about 3 on the neck pickup for a classic "woman tone" lead sound; turn it fully up for clarity.'),
    ],
    exercise: { title: 'Guided tour', steps: ['Point to and name: headstock, tuners, nut, frets, inlays, body, pickups, selector, volume, tone, bridge, output jack.', 'Play the open low E string with the selector in each position and describe the change in one word.', 'Roll the tone knob from 10 to 0 while the string rings and listen to the treble disappear.'] },
    mistakes: ['Confusing the nut with the bridge saddles: the nut is at the headstock end.', 'Turning tuners to fix a bad tone: tuners only change pitch; tone comes from pickups, knobs and the amp.', 'Leaving the volume knob at 0 and assuming the amp is broken.'],
    selfCheck: ['I can name ten parts of the guitar without looking.', 'I can explain the sound difference between neck and bridge pickups.'],
    quiz: [
      q('l0a-1', 'What do the pickups do?', ['Hold the strings at the bridge', 'Convert string vibration into an electrical signal', 'Change the pitch of each string', 'Make the guitar louder acoustically'], 1, 'Pickups are magnets and coils that sense string motion and output an electrical signal for the amplifier.'),
      q('l0a-2', 'Which pickup gives the warmest, roundest tone?', ['Bridge pickup', 'Neck pickup', 'Both are identical', 'Whichever is a humbucker'], 1, 'Near the neck the string swings widely, producing a stronger fundamental and fewer harsh overtones.'),
      q('l0a-3', 'Moving one fret toward the body raises the pitch by…', ['A whole step', 'An octave', 'A semitone (half step)', 'Nothing; frets only mark positions'], 2, 'Each fret is one semitone. Twelve frets make an octave.'),
      q('l0a-4', 'A humbucker differs from a single-coil pickup because it…', ['Has two coils that cancel hum', 'Only works with nylon strings', 'Is always in the neck position', 'Has no magnets'], 0, 'Two coils wired out of phase cancel electrical hum and produce a thicker, louder signal.'),
    ],
    realWorld: 'When a band says "switch to the neck pickup for the solo" or a tech says "your saddles need adjusting," you will know exactly what they mean.',
    summary: ['Headstock, neck and body each have a job.', 'Frets are semitones; the nut and saddles define the vibrating length.', 'Pickups and electronics shape the electric sound.'],
    next: 'l0-signal-chain',
    mastery: { quizPass: 0.75, criteria: ['Score 75% or more on the mastery check.', 'Name the parts of your own guitar from memory.'] },
  },
  {
    id: 'l0-signal-chain', level: 0, module: 'm0-instrument', title: 'Amplifiers, cables and the signal chain', minutes: 15,
    objectives: ['Connect a guitar to an amplifier correctly', 'Understand clean, overdrive and distortion', 'Set a safe starting amp tone'],
    prerequisites: ['l0-anatomy'], categories: ['theory'], sources: [src.P('Electric guitar amplification and accessories')],
    why: 'The amplifier is half of the electric guitar\'s sound. A good basic setup avoids hum, protects your ears and speakers, and makes practice sound inspiring instead of harsh.',
    explanation: [
      p('The signal chain is the path of your sound: guitar → cable → (optional effects pedals) → amplifier input → preamp (gain and EQ) → power amp → speaker. Headphone amps, multi-effects units and audio interfaces with amp-simulator software follow the same logic in one box.'),
      p('Gain (or drive) controls how hard the preamp is pushed. Low gain stays clean; more gain compresses and clips the signal, first into crunchy overdrive, then thick distortion. Master volume sets how loud the result is. Bass, middle and treble controls shape the EQ.'),
      list('Essential accessories: a shielded instrument cable (3–6 m), picks, a clip-on or app tuner (this app has one), spare strings, a strap, a gig bag or case, and a metronome (also built in).', 'Optional: headphones or a headphone amp for quiet practice, a capo, a string winder, and a small set of hex keys and screwdrivers for adjustments.'),
      warn('Turn the amp volume to zero before plugging or unplugging a cable. Plugging in with the volume up produces a loud pop that can damage speakers and ears.'),
    ],
    guitar: [
      steps('Amp volume to 0, power on.', 'Plug the cable into the guitar, then into the amp input.', 'Guitar volume to 10, tone to 10.', 'Amp: gain 3, bass 5, middle 5, treble 5, master volume up slowly to a comfortable level.', 'Strum an open chord. Raise gain to 6–7 and hear the overdrive; return to 3 for clean.'),
      tip('Practise at a moderate volume. If your ears ring afterwards, it was too loud.'),
    ],
    exercise: { title: 'Dial in three tones', steps: ['Clean: gain 2–3, all EQ at 5.', 'Crunch: gain 5–6, middle 6.', 'Lead: gain 7–8, bass 5, middle 7, treble 6. Save a phone photo of each setting.'] },
    mistakes: ['Too much gain while learning: it hides sloppy technique.', 'Treble on 10: harsh and fatiguing.', 'Coiling cables tightly around the elbow, which breaks the inner wires.'],
    selfCheck: ['I can connect and power up without a pop.', 'I can dial in clean, crunch and lead tones.'],
    quiz: [
      q('l0s-1', 'What is the correct order of the basic signal chain?', ['Amp → cable → guitar', 'Guitar → cable → pedals → amp → speaker', 'Speaker → amp → guitar', 'Pedals → guitar → amp'], 1, 'Sound starts at the guitar and travels through the cable and any pedals into the amp and out of the speaker.'),
      q('l0s-2', 'Which control mainly decides clean versus distorted?', ['Treble', 'Master volume', 'Gain / drive', 'Presence'], 2, 'Gain sets how hard the preamp is driven; more gain means more clipping.'),
      q('l0s-3', 'Before plugging in a cable you should…', ['Turn the amp volume to zero', 'Turn the gain to 10', 'Unplug the speaker', 'Tune the guitar'], 0, 'Volume at zero prevents a loud, potentially damaging pop.'),
    ],
    realWorld: 'At a rehearsal you will plug into an unfamiliar amp. Starting from "gain 3, EQ at noon, volume up slowly" gets you a usable sound in seconds.',
    summary: ['Guitar → cable → pedals → amp → speaker.', 'Gain shapes distortion; master volume sets loudness.', 'Volume to zero before plugging in.'],
    next: 'l0-posture',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3 on the mastery check.', 'Set up a clean and an overdriven tone safely.'] },
  },
  {
    id: 'l0-posture', level: 0, module: 'm0-setup', title: 'Posture and hand positions', minutes: 20,
    objectives: ['Sit and stand with the guitar in a relaxed, repeatable position', 'Position the fretting hand: thumb behind the neck, arched fingers, fingertips', 'Position the picking hand near the pickups'],
    prerequisites: [], categories: ['technique'], sources: [src.A('Holding the guitar; left- and right-hand position'), src.P('Ergonomics and tension management')],
    why: 'Every technique you will ever learn is built on posture. Good habits now prevent pain and plateaus later; bad habits become very hard to unlearn once you are fast.',
    explanation: [
      p('Sitting: use a chair without arms, feet flat. The guitar\'s waist rests on your right leg (left leg if you play left-handed). The neck points slightly upward. Your back stays straight and your shoulders relaxed; bring the guitar to you rather than hunching over it.'),
      p('Standing: adjust the strap so the guitar sits at roughly the same height as when seated. Very low "rock star" positions bend the fretting wrist sharply and make many techniques harder.'),
      p('Fretting hand: fingers are numbered 1 (index) to 4 (pinky). Your thumb rests on the back of the neck, roughly behind the middle finger. Curve your fingers so they come down on their tips, just behind the fret wire, not on top of it. Keep the palm off the neck, leaving a small gap.'),
      p('Picking hand: your forearm rests on the upper edge of the body. The hand floats over the strings between the neck and bridge pickups. Some players lightly anchor the palm edge on the bridge for stability, which is fine as long as it does not press hard.'),
      warn('Tension is the enemy. Every few minutes, check: shoulders down? jaw loose? thumb not squeezing? Squeeze only as hard as needed to stop buzzing.'),
    ],
    guitar: [
      p('Place finger 1 on the 1st fret of the high E string, finger 2 on the 2nd fret, finger 3 on the 3rd and finger 4 on the 4th: one finger per fret. Press each just behind the fret wire with the fingertip and pick it. Then move the shape to the next string.'),
      tip('Use a mirror or your phone camera. Look for a straight-ish fretting wrist and a relaxed picking shoulder.'),
    ],
    exercise: { title: 'One finger per fret, relaxed', steps: ['Play frets 1-2-3-4 on each string from high E to low E, slowly.', 'Release pressure between notes until the note just stops buzzing; that is the minimum pressure you need.', 'Repeat standing up with your strap adjusted.'] },
    metronome: { bpmStart: 50, bpmTarget: 70, subdivision: 1, instructions: 'One note per click. Focus on relaxed, buzz-free notes rather than speed.' },
    mistakes: ['Thumb wrapped high over the neck while learning single notes (fine for some chords later).', 'Fretting in the middle of the fret space or on the fret wire, which causes buzzing or muted notes.', 'Collapsed, flat fingers touching neighbouring strings.', 'Raised picking shoulder.'],
    selfCheck: ['I can hold one-finger-per-fret position without pain.', 'My fingertips land just behind the frets.', 'I check my tension regularly.'],
    quiz: [
      q('l0p-1', 'Where should a fingertip press the string?', ['Directly on top of the fret wire', 'Just behind the fret wire', 'In the middle between two frets', 'Anywhere, as long as it is firm'], 1, 'Just behind the fret gives a clear note with the least pressure.'),
      q('l0p-2', 'Which finger is "finger 3"?', ['Index', 'Middle', 'Ring', 'Pinky'], 2, 'Index = 1, middle = 2, ring = 3, pinky = 4. The thumb is usually labelled T.'),
      q('l0p-3', 'What is the main sign you are pressing too hard?', ['The note buzzes', 'Your hand tires fast and the note goes sharp', 'The amp hums', 'The string breaks'], 1, 'Excess pressure bends the pitch sharp and wastes energy. Find the minimum pressure that stops buzzing.'),
    ],
    realWorld: 'Professional players often practise for hours a day without pain because their posture is relaxed and efficient. This lesson is the foundation for that stamina.',
    summary: ['Straight back, relaxed shoulders, guitar at a consistent height.', 'Fingertips just behind frets, thumb behind the neck.', 'Minimum pressure; constant tension checks.'],
    next: 'l0-pick',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.', 'Play one-finger-per-fret on all six strings at 60 bpm without buzzing.'] },
  },
  {
    id: 'l0-pick', level: 0, module: 'm0-setup', title: 'Holding and using the pick', minutes: 15,
    objectives: ['Hold a pick securely with a small tip exposed', 'Choose a pick thickness for your style', 'Play controlled down- and upstrokes'],
    prerequisites: ['l0-posture'], categories: ['technique'], sources: [src.A('Right-hand position'), src.P('Pick grip and pick gauge')],
    why: 'The pick is where your tone, timing and speed are born. A consistent grip makes every later picking technique easier.',
    explanation: [
      p('Curl your index finger. Lay the pick on the side of the last joint with the point aiming away from you, then place the pad of your thumb on top. Only 2–3 mm of the tip should show. Grip firmly enough that the pick does not spin, but not so hard that your forearm tenses.'),
      p('Pick thickness (gauge) changes feel and tone. Thin picks (0.4–0.6 mm) flex and suit light strumming. Medium (0.6–0.8 mm) is an all-rounder. Heavy picks (1.0 mm and up) give precise, punchy single notes and are standard for lead playing and metal.'),
      table(['Gauge', 'Feel', 'Best for'], [['0.40–0.60 mm', 'Flexible', 'Light strumming'], ['0.60–0.80 mm', 'Medium', 'All-round rhythm and lead'], ['0.88–1.14 mm', 'Firm', 'Rock lead and riffs'], ['1.5 mm +', 'Rigid', 'Fast picking, metal, jazz']]),
      p('A downstroke moves toward the floor (symbol ⊓ in notation); an upstroke moves toward the ceiling (symbol V). Keep the motion small and come from the wrist or a mix of wrist and forearm, not from the elbow alone.'),
    ],
    guitar: [
      p('Rest your forearm on the body and pick the open low E string with downstrokes, aiming to hit only that string. Then alternate down-up on each open string. Notice that a smaller motion gives you more control.'),
      tip('Angle the pick very slightly (about 10–20°) so it glides through the string instead of catching on it.'),
    ],
    exercise: { title: 'Downstroke and upstroke control', steps: ['Four downstrokes on each open string from low E to high E.', 'Four upstrokes on each string.', 'Alternate down-up, four pairs per string, keeping the motion as small as possible.'] },
    metronome: { bpmStart: 60, bpmTarget: 90, subdivision: 2, instructions: 'Alternate down on the beat, up on the "and".' },
    mistakes: ['Too much pick showing, which makes it flap and miss strings.', 'Gripping so hard that the forearm locks.', 'Big, arm-driven strokes that overshoot the string.'],
    selfCheck: ['My pick does not spin or slip after a minute of playing.', 'I can hit a single open string without touching its neighbours.'],
    quiz: [
      q('l0k-1', 'How much of the pick tip should usually be exposed?', ['About half the pick', '2–3 mm', 'None', 'As much as possible for speed'], 1, 'A small exposed tip gives control and precision.'),
      q('l0k-2', 'The symbol V above a note means…', ['Vibrato', 'Upstroke', 'Downstroke', 'Volume swell'], 1, 'V is an upstroke; a square bracket shape (⊓) is a downstroke.'),
      q('l0k-3', 'Which pick is most typical for fast, precise single-note lead playing?', ['0.46 mm', '0.60 mm', '1.0 mm or thicker', 'No pick'], 2, 'Heavier picks do not flex, so attacks are precise and consistent.'),
    ],
    realWorld: 'Many great lead players use small, stiff picks with very little tip showing. Experiment, but keep one grip long enough for it to become automatic.',
    summary: ['Pick between thumb pad and the side of the index finger, small tip showing.', 'Gauge affects feel and tone.', 'Small, efficient down- and upstrokes.'],
    next: 'l0-tuning',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.', 'Alternate-pick open strings at 80 bpm eighth notes cleanly.'] },
  },
  {
    id: 'l0-tuning', level: 0, module: 'm0-setup', title: 'Standard tuning and how to tune', minutes: 20,
    objectives: ['Name the open strings E A D G B E', 'Use the built-in tuner to tune every string', 'Understand cents, flat and sharp'],
    prerequisites: [], categories: ['theory', 'ear'], sources: [src.A('Tuning: E–A–D–G–B–E and the electronic tuner'), src.P('Cents, reference pitch and alternate tunings')],
    why: 'An out-of-tune guitar makes correct playing sound wrong, and trains your ear badly. Tuning is the first thing you do every time you pick up the instrument.',
    explanation: [
      p('In standard tuning the six open strings, from the thickest (lowest pitch, nearest your face) to the thinnest (highest pitch, nearest the floor) are E A D G B E. A popular memory aid: "Eddie Ate Dynamite, Good Bye Eddie."'),
      p('Strings are also numbered from the thinnest: the high E is string 1 and the low E is string 6. So "the 5th string" is the A string. On 7- and 8-string guitars the extra strings are lower: string 7 is usually B, string 8 usually F♯.'),
      table(['String', 'Note', 'Octave', 'Frequency'], [['6', 'E', 'E2', '82.41 Hz'], ['5', 'A', 'A2', '110.00 Hz'], ['4', 'D', 'D3', '146.83 Hz'], ['3', 'G', 'G3', '196.00 Hz'], ['2', 'B', 'B3', '246.94 Hz'], ['1', 'E', 'E4', '329.63 Hz']]),
      p('A tuner measures the pitch you play and shows how far it is from the nearest note in cents. A cent is 1/100 of a semitone. Negative cents (flat) means the string is too low: tighten it. Positive cents (sharp) means too high: loosen it. Within ±3 cents is effectively perfect.'),
      tip('Always tune up to the note. If a string is sharp, go below the target and come back up. This settles the string against the tuner gear so it stays in tune.'),
      theory('The reference pitch is A4 = 440 Hz. The app lets you change it (for example to 432 Hz) to match a recording or another instrument.'),
    ],
    guitar: [
      steps('Open the Tuner (the tuning-fork button is always in the header).', 'Allow microphone access. Audio is analysed on your device and never recorded or uploaded.', 'Pick the low E string and let it ring. Watch the needle: left = flat, right = sharp.', 'Turn the tuning key slowly until the needle centres and turns green.', 'Repeat for A, D, G, B and high E, then check all six again: changing one string slightly changes the others\' tension.'),
      p('On most guitars, turning a tuner so the post winds more string on raises the pitch. Turn slowly, a few degrees at a time.'),
    ],
    exercise: { title: 'Tune from scratch', steps: ['Detune two strings slightly on purpose.', 'Use the tuner to bring all six strings within ±3 cents.', 'Use the reference-tone mode to hear each target pitch and try tuning one string by ear before checking.'] },
    mistakes: ['Tuning to the wrong octave: the tuner shows the octave number; low E must read E2.', 'Turning the wrong tuner peg.', 'Tuning down to the note instead of up.', 'Pressing a fret accidentally while tuning an open string.'],
    selfCheck: ['I can say the six string names from low to high and high to low.', 'I can tune all six strings in under two minutes.'],
    quiz: [
      q('l0t-1', 'What are the open strings in standard tuning, from low to high?', ['E A D G B E', 'E B G D A E', 'A D G C E A', 'E A D G C F'], 0, 'Low to high: E A D G B E.'),
      q('l0t-2', 'Which string is "string 1"?', ['The low E', 'The A string', 'The high E', 'The G string'], 2, 'Strings are numbered from the thinnest: string 1 is the high E.'),
      q('l0t-3', 'The tuner shows −15 cents. The string is…', ['Sharp: loosen it', 'Flat: tighten it', 'In tune', 'An octave too low'], 1, 'Negative cents means the pitch is below the target: tighten (raise) it.'),
      q('l0t-4', 'Why tune up to the note rather than down?', ['It is faster', 'The string settles against the gear and holds tuning better', 'Tuners only read rising pitches', 'It lowers string tension'], 1, 'Approaching from below removes slack in the gear and string, so the tuning stays put.'),
    ],
    realWorld: 'Before every rehearsal, recording or gig, guitarists tune, often between songs too. Drop D and E♭ tunings in the tuner prepare you for songs that use them.',
    summary: ['Standard tuning is E A D G B E (low to high).', 'Cents measure how far off you are; ±3 is in tune.', 'Tune up to the note, then re-check all strings.'],
    next: 'l0-tab',
    mastery: { quizPass: 0.75, criteria: ['Score at least 75%.', 'Tune all strings within ±3 cents using the tuner.'] },
    unlocks: { trainerModes: ['note-id'] },
  },
  {
    id: 'l0-tab', level: 0, module: 'm0-reading', title: 'Reading tablature', minutes: 20,
    objectives: ['Read string and fret information from tab', 'Recognise stacked notes (chords and double stops)', 'Understand common tab symbols'],
    prerequisites: ['l0-tuning'], categories: ['theory', 'repertoire'], sources: [src.A('Your first notes: tablature'), src.C('Tab conventions used throughout Book 3'), src.P('Technique symbols')],
    why: 'Tab is the most common way guitar music is written and shared. Reading it fluently opens up almost every song, lesson and exercise.',
    explanation: [
      p('Tablature uses one horizontal line per string. The TOP line is the highest string (high E) and the BOTTOM line is the lowest (low E), which matches looking down at the guitar from above. A number on a line tells you which fret to press on that string; 0 means play the string open.'),
      p('Read left to right like text. Numbers stacked vertically are played at the same time (a chord or a double stop). Numbers placed one after another are played one after another.'),
      tab(`
e|-----------------0---|
B|-------------1-------|
G|---------0-----------|
D|-----2---------------|
A|-3-------------------|
E|---------------------|`, 'A C-major chord played one note at a time (an arpeggio): A string 3rd fret, D string 2nd fret, open G, B string 1st fret, open high E.'),
      table(['Symbol', 'Meaning'], [['h', 'Hammer-on'], ['p', 'Pull-off'], ['/ and \\', 'Slide up / down'], ['b', 'Bend (7b9 = bend the 7th fret up to the pitch of the 9th)'], ['~', 'Vibrato'], ['x', 'Muted, pitchless "dead" note'], ['PM----', 'Palm mute for the length of the dashes'], ['<12>', 'Natural harmonic']]),
      warn('Basic tab does not show rhythm. Listen to the music, or use rhythm tab (stems and beams), which you will learn next.'),
    ],
    guitar: [
      tab(`
e|-------------------------|
B|-------------------------|
G|-------------------------|
D|---------------2---4-----|
A|-------0---3-------------|
E|-0---3-------------------|`, 'An original riff on the three lowest strings. Play each note with a downstroke.'),
    ],
    exercise: { title: 'Read and play', steps: ['Play the C-major arpeggio above slowly, letting the notes ring.', 'Play the low-string riff, saying the string and fret aloud for each note.', 'Open the Tab Editor, write a four-note riff of your own, and play it back.'] },
    mistakes: ['Reading tab upside down (the top line is the THIN string).', 'Playing stacked numbers one at a time.', 'Confusing fret numbers with finger numbers.'],
    selfCheck: ['I can read a tab line and instantly know string and fret.', 'I know at least five tab symbols.'],
    quiz: [
      q('l0b-1', 'In tab, the top line represents…', ['The low E string', 'The high E string', 'The A string', 'Whichever string is played first'], 1, 'The top line is the highest-pitched (thinnest) string.'),
      q('l0b-2', 'A "0" on the G line means…', ['Do not play the G string', 'Play the G string open', 'Play the G string at fret 10', 'Mute the G string'], 1, 'Zero means the string is played open, without fretting.'),
      q('l0b-3', 'Numbers stacked vertically are played…', ['One after another, low to high', 'At the same time', 'Only with hammer-ons', 'Twice each'], 1, 'Vertically aligned numbers sound together.'),
      q('l0b-4', 'What does "7b9" mean?', ['Fret 7, then fret 9', 'Bend fret 7 up to the pitch of fret 9', 'Slide from 7 to 9', 'Play frets 7 and 9 together'], 1, 'The bend raises fret 7 by a whole step, to fret 9\'s pitch.'),
    ],
    realWorld: 'Almost every online lesson, song transcription and guitar magazine uses tab. The app\'s Tab Editor can import ASCII tab you find online and export your own exercises.',
    summary: ['Six lines = six strings, high E on top.', 'Numbers = frets; 0 = open; stacked = together.', 'Symbols show techniques; basic tab has no rhythm.'],
    next: 'l0-chord-diagrams',
    mastery: { quizPass: 0.75, criteria: ['Score at least 75%.', 'Play both tab examples correctly from the page.'] },
  },
  {
    id: 'l0-chord-diagrams', level: 0, module: 'm0-reading', title: 'Reading chord diagrams', minutes: 15,
    objectives: ['Read strings, frets, fingers, open and muted strings from a chord diagram', 'Recognise barre markings and position numbers'],
    prerequisites: ['l0-tab'], categories: ['chords', 'theory'], sources: [src.C('Barre chords: chord diagrams'), src.A('Playing chords'), src.P()],
    why: 'Chord diagrams are the fastest way to learn a chord shape. Every chord in this academy is shown as a diagram, and the Chord Explorer draws them for any tuning.',
    explanation: [
      p('A chord diagram is a picture of the fretboard standing upright. Vertical lines are strings: the LEFT line is the low E string and the RIGHT line is the high E. Horizontal lines are frets; a thick line at the top is the nut.'),
      p('Dots show where to press. A number in or under a dot tells you which finger to use (1 = index … 4 = pinky). Above the diagram, "o" means play the string open and "x" means do not play (mute) that string.'),
      p('When the shape is higher up the neck, a number such as "5fr" beside the diagram tells you which fret the top line represents. A curved line or bar across several strings is a barre: one finger presses several strings at the same fret.'),
      chords(['Em', 'C', 'G', 'D'], 'Four open chords. Compare each diagram with the tab version you play next.'),
    ],
    guitar: [
      p('Read the E minor diagram: there are no x marks, so all six strings sound. Fingers 2 and 3 press the 2nd fret of the A and D strings. Strum all six strings. Then read the C diagram: the low E has an "x", so start your strum on the A string.'),
      tip('Place all fingers of a chord at once rather than one by one. It feels slower at first but makes chord changes much faster later.'),
    ],
    exercise: { title: 'Diagram to fingers', steps: ['Read each of the four diagrams aloud: which strings are open, muted and fretted, and with which fingers.', 'Form each chord and pick the strings one at a time to check every note rings clearly.', 'Open the Chord Explorer and look up the same chords in Drop D tuning: notice how the shapes change.'] },
    mistakes: ['Mirroring the diagram (low E is on the LEFT).', 'Ignoring "x" strings and strumming notes that do not belong to the chord.', 'Fingers leaning on and muting neighbouring strings.'],
    selfCheck: ['I can read any chord diagram correctly, including x, o and fret numbers.'],
    quiz: [
      q('l0c-1', 'In a standard chord diagram, the leftmost vertical line is…', ['The high E string', 'The low E string', 'The 1st fret', 'The nut'], 1, 'Diagrams show the guitar upright, facing you: low E on the left.'),
      q('l0c-2', 'An "x" above a string means…', ['Play it open', 'Do not play it', 'Bend it', 'Use finger 1'], 1, 'x = muted or not played.'),
      q('l0c-3', 'A "5fr" label means…', ['Use five fingers', 'The diagram starts at the 5th fret', 'Strum five times', 'Mute five strings'], 1, 'The position marker tells you which fret the diagram begins at.'),
    ],
    realWorld: 'Song books and chord charts show diagrams above the lyrics. Being able to read them instantly lets you play along with thousands of songs.',
    summary: ['Strings vertical (low E left), frets horizontal.', 'Dots = fingers; o = open; x = muted.', 'Fret labels and barre lines for higher positions.'],
    next: 'l0-rhythm-notation',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.', 'Form Em, C, G and D from diagrams with every note ringing.'] },
  },
  {
    id: 'l0-rhythm-notation', level: 0, module: 'm0-reading', title: 'Rhythm notation basics', minutes: 20,
    objectives: ['Understand beats, measures and time signatures', 'Recognise whole, half, quarter and eighth notes and their rests', 'Count simple rhythms aloud'],
    prerequisites: ['l0-tab'], categories: ['rhythm', 'theory'], sources: [src.A('Rhythm tab: measures, time signatures, note values, rests, ties'), src.P()],
    why: 'Pitch is only half of music; timing is the other half. A riff with the right notes and the wrong rhythm is not the riff.',
    explanation: [
      p('The beat is the steady pulse you tap your foot to. Beats are grouped into measures (bars), separated by bar lines. A time signature such as 4/4 tells you how many beats are in each measure (top number) and which note value counts as one beat (bottom number: 4 = quarter note).'),
      table(['Note', 'Length in 4/4', 'Count'], [['Whole note', '4 beats', '1-2-3-4'], ['Half note', '2 beats', '1-2'], ['Quarter note', '1 beat', '1'], ['Eighth note', '½ beat', '1-and'], ['Sixteenth note', '¼ beat', '1-e-and-a']]),
      p('Every note value has a matching rest: a symbol for silence of the same length. A tie joins two notes of the same pitch: play the first and hold it for the combined length. A dot after a note adds half its value (a dotted half note lasts three beats).'),
      p('Rhythm tab combines tab numbers with stems and beams: a number with a stem is a quarter note, two numbers joined by a beam are eighth notes, a circled number with a stem is a half note.'),
      tip('Count out loud: "1 and 2 and 3 and 4 and". Your hand plays, your voice keeps time. It feels silly, and it is one of the fastest ways to improve.'),
    ],
    guitar: [
      tab(`
       1   2   3   4   | 1 + 2 + 3   4
e|-----------------|-----------------|
B|-----------------|-----------------|
G|-----------------|-----------------|
D|-----------------|-----------------|
A|-----------------|-----------------|
E|-0---0---0---0---|-0-0-0-0-0---0---|`, 'Bar 1: four quarter notes. Bar 2: four eighth notes (1 + 2 +), then two quarter notes.'),
    ],
    exercise: { title: 'Count and play', steps: ['Set the metronome to 70 bpm. Play the open low E as quarter notes for 4 bars, counting aloud.', 'Switch to eighth notes (down-up), counting "1 and 2 and…".', 'Play bar 2 of the example. Then try a half note (let it ring for 2 clicks) followed by two quarters.'] },
    metronome: { bpmStart: 60, bpmTarget: 90, subdivision: 2, instructions: 'Downstrokes on the numbers, upstrokes on the "ands".' },
    mistakes: ['Rushing the eighth notes so they are uneven.', 'Cutting half and whole notes short.', 'Not counting rests: silence has a length too.'],
    selfCheck: ['I can explain 4/4 time.', 'I can count and play quarters, eighths and half notes with a metronome.'],
    quiz: [
      q('l0r-1', 'In 4/4 time, how many quarter notes fill one measure?', ['2', '3', '4', '8'], 2, 'Four beats per measure, and the quarter note gets one beat.'),
      q('l0r-2', 'How long does a dotted half note last in 4/4?', ['2 beats', '3 beats', '1½ beats', '4 beats'], 1, 'A dot adds half the value: 2 + 1 = 3 beats.'),
      q('l0r-3', 'Two eighth notes together last…', ['Half a beat', 'One beat', 'Two beats', 'Four beats'], 1, 'Each eighth note is half a beat.'),
      q('l0r-4', 'What does a tie between two notes of the same pitch mean?', ['Play both notes loudly', 'Play the first and hold for both durations', 'Skip both notes', 'Slide between them'], 1, 'Tied notes are struck once and held for the combined length.'),
    ],
    realWorld: 'Bands communicate in bars and beats: "the riff comes in on bar 9," "hold it for two beats." Counting is how you stay together.',
    summary: ['Beats, measures and time signatures organise time.', 'Whole → half → quarter → eighth → sixteenth, each half the length.', 'Count aloud and use the metronome.'],
    next: 'l0-maintenance',
    mastery: { quizPass: 0.75, criteria: ['Score at least 75%.', 'Play eighth notes evenly at 80 bpm with the metronome.'] },
  },
  {
    id: 'l0-maintenance', level: 0, module: 'm0-reading', title: 'Setup fundamentals and maintenance', minutes: 15,
    objectives: ['Know when and how to change strings', 'Understand action, relief and intonation at a basic level', 'Keep the guitar clean and stable'],
    prerequisites: ['l0-anatomy'], categories: ['theory'], sources: [src.P('Guitar setup and maintenance')],
    why: 'A well-maintained guitar is easier to play, stays in tune and sounds better. Many "I can\'t play this" problems are actually setup problems.',
    explanation: [
      p('Strings lose brightness and tuning stability as they age and collect grime. Change them every one to three months if you play regularly, or when they look dull, feel rough or will not stay in tune. Gauges are named by the thinnest string: "10s" (0.010–0.046 in) are standard for electric guitar; "9s" are lighter and easier to bend; heavier sets suit lower tunings.'),
      list('Action: the height of the strings above the frets. Lower action is easier to press but can buzz; higher action is cleaner but harder to play.', 'Neck relief: a tiny forward bow in the neck, adjusted with the truss rod. Leave truss-rod adjustments to a technician until you are confident.', 'Intonation: whether fretted notes stay in tune higher up the neck. Check by comparing the 12th-fret note with the open string on the tuner; if they differ, the saddle needs moving.'),
      warn('Change strings one at a time on guitars with floating tremolos, so the bridge stays balanced. Always keep fingers away from the cut end of a string; it is sharp.'),
    ],
    guitar: [
      steps('Wipe the strings and fretboard with a dry cloth after every session.', 'Check intonation: tune the open low E, then play its 12th fret. The tuner should still read E (one octave higher) within a few cents.', 'Store the guitar away from heaters, open windows and direct sun; sudden temperature and humidity changes affect the neck and tuning.'),
    ],
    exercise: { title: 'Mini health check', steps: ['Tune all strings.', 'Check every string\'s 12th-fret intonation with the tuner and note any that differ by more than 5 cents.', 'Listen for buzzing on frets 1–12 of each string and note where it happens.'] },
    mistakes: ['Over-tightening truss rods without knowledge.', 'Never changing strings.', 'Leaving the guitar next to a radiator.'],
    selfCheck: ['I know how old my strings are.', 'I can check intonation with the tuner.'],
    quiz: [
      q('l0m-1', 'How do you check intonation?', ['Compare the open string with the 12th-fret note on a tuner', 'Measure the scale length', 'Play loudly', 'Tighten the truss rod'], 0, 'If the 12th-fret note is not exactly an octave above the open string, intonation needs adjusting.'),
      q('l0m-2', '"Action" refers to…', ['How hard you pick', 'String height above the frets', 'Pickup output', 'Neck length'], 1, 'Action is the distance between strings and frets.'),
      q('l0m-3', 'A set described as "9s" is…', ['Heavier than standard', 'Lighter than standard', 'For bass guitar', 'Nylon strings'], 1, '9s are lighter than the standard 10s and easier to bend.'),
    ],
    realWorld: 'Touring guitarists change strings before every show. You do not need to go that far, but fresh strings make practice more rewarding.',
    summary: ['Change strings regularly.', 'Action, relief and intonation decide playability.', 'Keep the guitar clean and climate-stable.'],
    next: 'l1-fretting',
    mastery: { quizPass: 0.67, criteria: ['Score at least 2 of 3.', 'Check your guitar\'s intonation with the tuner.'] },
  },
];
