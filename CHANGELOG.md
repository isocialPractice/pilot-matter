# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.24.3-alpha] - 2026-10-07

The control list's self-name guard holds the whole list rather than one row of
it. `1.24.2-alpha` added `the row that collapses the list names the action
rather than the list` to close the gap that had let the `H` row read
`Hide Controls` for a version - but the test captured the body of
`#controls-help-list`, narrowed the span to the `H` row, and then ran both of
its assertions on the text after `H - `. The list could therefore still carry a
second name for itself in any of its other fourteen rows with all 1245 tests
passing, which was verified by adding one. The gap was narrowed from the whole
list to one row rather than closed, and the test's own docstring stated the
wider bound it did not hold.

### Changed

- **`test/page.test.js` reads the whole control list for a second name rather
  than the `H` row.** The `doesNotMatch` for `/controls?/i` runs over the
  captured list body now, with the `<h3>CONTROL REFERENCE</h3>` heading sliced
  off the span first so the list's own correct name is not read as the thing
  being forbidden - that heading is held to that name by `the reference list is
  headed with the name of the row that opens it` a few lines above, so excluding
  it loses nothing. The `^Collapse` assertion stays on the `H` row, which is the
  one part of the test genuinely about that row's wording. The failure names the
  offending row rather than printing the whole body, so a reader is sent to the
  line. Re-run with `X - Show Controls<br>` added under the last row it fails on
  the row it read, the way the test was already checked against
  `H - Hide Controls`; the suite is otherwise green at 1245.
- **Four comments say the `CONTROL REFERENCE` row opens the control list, rather
  than the retired `Controls` entry.** That entry was renamed `CONTROL SETTINGS`
  in `1.23.0-alpha` and sends to `openControlSettingsPanel()`, with the list one
  level in from there, but `index.html`, two comments in `js/main.js` and one in
  `test/page.test.js` were not brought along and went on asserting the old chain
  in the present tense - leaving `js/main.js` contradicting itself twice inside
  one module, since the comment beside the entry already said the list "is a row
  inside that panel now". All four now name the row that opens the list and the
  `H` key that collapses it over a flight, which is the arrangement that comment
  and `docs/controls/clearing-the-screen.html` already describe. Each keeps the
  point it was written to make: the two about `#controls-help` taking the pointer
  still say why it takes it, and the one on `titleHelp` is still about the start
  screen, where the row turns the list over rather than only opening it. The
  comment in `test/control-settings.test.js` is untouched - it names the entry in
  the past tense on purpose, "before this panel was between them", and was the
  one of the five already correct.
- **The `1.24.2-alpha` entry below no longer says its new test stops a second
  name "by any spelling".** It held that bound over the `H` row only, so the
  claim covered one row of fifteen - the same shape of overclaim as the
  `1.24.1-alpha` sentence that entry itself corrected. The claim is corrected in
  place and points at this version for the rest of it.

## [1.24.2-alpha] - 2026-10-06

The control list no longer calls itself `Controls` in its own body. Last
version renamed the heading above the list and the hint the list collapses to,
so that the row which opens it, the list itself and the line left behind were
one name - and the row inside the list that does the collapsing was missed, so
the list went on offering `Hide Controls` nine lines under its own
`CONTROL REFERENCE` heading. Nothing failed, because nothing in the suite had
ever read the rows of that list for what they say; it read the heading and it
read the hint. It reads a row now.

### Changed

- **The `H` row of the control list says what the key does rather than naming
  the list again.** `index.html` drew `H - Hide Controls` as the ninth row of
  `#controls-help-list`, which put the word the renames were made to retire
  back inside the list those renames had just given one name. The row reads
  `H - Collapse List` now, which is the action rather than a second name for
  the list, and it is the wording `README.md`, `CHEATSHEET.md`,
  `docs/cheatsheet.html` and `docs/controls/index.html` were already describing
  the key with - all four say the key collapses the control list, so the row
  joins them rather than asking them to change. The rest of the rows are
  untouched: they name actions already, which is the idiom the row was the one
  exception to.
- **The `1.24.1-alpha` entry above no longer says the collapsed hint was the
  only place still reading `CONTROLS`.** It was one of two, and the row fixed
  here was the other, so the entry recorded a rename as finished a version
  before it was. The claim is corrected in place and points at this version for
  the rest of it, rather than being quietly dropped - a changelog that edits
  away what it got wrong leaves a reader no way to tell the two states apart.

### Added

- **`test/page.test.js` reads what a row of the control list says, not just
  which key it names.** Three tests already reach this list, and the gap the row
  sat in for a version runs between them: `the reference list is headed with the
  name of the row that opens it` pins the `<h3>`, `the collapsed controls list
  leaves the hint that reopens it` pins `HELP_HINT`, and `the control list names
  the keys the flight is worked with` walks the rows for the keys - `C`, `Tab`,
  `H`, `P`, `R` and the four it imports from the modules that own them - but
  matches each as `X -` and stops at the dash. So the suite knew the `H` row
  existed and had never read a word of what it offered. The new test pulls the
  `H` row out of the list body and holds two things about it: that it opens with
  `Collapse`, so it keeps saying what the key does in the words the
  documentation uses, and that it contains no form of `control` at all. That
  bound is held over the `H` row alone, so it stops a second name in that row
  rather than anywhere in the list; `1.24.3-alpha` above widens it to the list. The
  test was then run with `H - Hide Controls` put back in `index.html`, to see it
  fail on the wording it was written for rather than only pass on the wording
  that replaced it: it fails the first assertion, naming the row it read. The
  row is matched with `[^<\r\n]*`, so the span cannot run past the `<br>` that
  ends it into the rows either side.

## [1.24.1-alpha] - 2026-10-05

`A` rolls left. The `ROLL AXIS` row shipped last version offering its two
settings the wrong way round, so the `DIRECTIONAL` default flew what this
repository calls inverted: held from level, `A` dropped the right wing and
turned right. The row itself was sound and so was the binding behind it - the
sign was two lines of the flight model that predate the setting, and nothing in
the suite could see them, because nothing in the suite had ever read which way
the aircraft physically goes for a given input. That test exists now, for all
four pitch and roll controls.

### Fixed

- **`A` drops the left wing and turns left on the default axis, and `D` the
  mirror of it.** The two roll lines of `Aircraft.update` in `js/aircraft.js`
  had `rollLeft` raising `rotation.z`, and a raised `rotation.z` drops the right
  wing: the model flies nose-first along `+Z`, which carries its right wing on
  `-X`. So the control named for the left wing was attached to the end of the
  flight model that banks right, and the coordinated turn below rode the same
  sign the whole way round. The signs are swapped, with the reason written
  beside them the way the pitch keys four lines above already carry it - that
  pair fell into this same hole once, and their comment still records it as
  "Raising it here flew W into a dive."

  Nothing else moved with it. `js/input-map.js` was already correct and is
  untouched; the tilt and the touch pads write `rollLeft` and `rollRight` rather
  than the angle, so they come right for free; and `CHEATSHEET.md`, `README.md`,
  `docs/cheatsheet.html` and `docs/controls/control-settings.html` all already
  described this behaviour, so they become true rather than wanting an edit.
- **The controls page no longer contradicts the README about stepping a value.**
  **Working a menu** in `docs/controls/index.html` named only the settings panel
  and the element editor, so the published page said the control settings
  panel's rows could not be stepped while `README.md` said they could. The
  paragraph names all three now, and links the panel's own page.

### Added

- **`test/control-sense.test.js` pins which way every pitch and roll control
  flies the aircraft.** This is the gap that let the sign above sit here: the
  suite pinned which input field a key writes (`test/input-map.test.js`), which
  field a tilt writes (`test/tilt-controls.test.js`) and `rotation.z` as a value
  carried or zeroed (`test/flight-state.test.js`), and none of that can tell a
  field wired to the wrong end of the flight model from one wired to the right
  end. The fifteen tests here read the attitude instead - where the nose and the
  right wing are actually pointing - so they state what a pilot would notice and
  stay true whichever way the model signs its Euler: `pitchUp` raises
  `forwardY`, `rollLeft` raises `rightY`, `rollRight` lowers it, and the
  coordinated turn follows the dropped wing. Both settings of both axes are
  flown on real key presses through `applyKeyToInput`, so the test that would
  have caught this one is the one asserting `A` rolls left on the default.

  `js/aircraft.js` imports Three.js and wants a scene, so the frame's rotation
  steps are mirrored out of the same shared functions it calls, in the same
  order - the idiom `test/flight-model.test.js` already flies a glide with. Two
  of the tests read `js/aircraft.js` as source text to hold that mirror honest,
  so a sign changed in the frame and not in the mirror fails rather than passing
  against a copy nobody flies.
- **`attitudeFrom` in `js/attitude.js`.** Where the nose, the right wing and the
  aircraft's own up are pointing, as the vertical part of each direction, from
  the pitch and the bank that decide it. `Aircraft.getAttitude` read the same
  three directions off its own quaternion and now asks this for them, which is
  what lets a test state which way a control flies the aircraft: the frame
  cannot be run in Node, but the answer it is reaching for can be. It also puts
  the code that moves an angle and the code that reads it in one file instead of
  two, which is the whole of how a control ends up flying the opposite way to
  its own label. The heading drops out of the arithmetic rather than being
  ignored by it: the aircraft turns on a `YXZ` Euler, where the heading is
  applied outermost about the world's own up and so swings all three directions
  round the horizon without raising or lowering any of them.

### Changed

- **The collapsed control list is named for the list it reopens.** `HELP_HINT`
  in `js/controls-help.js` was `H - CONTROLS`, while the expanded list it
  collapses to is headed `CONTROL REFERENCE` - which is also the label on the
  control settings panel row that opens it. The point of that rename was that
  the row and the list are named the same thing, and the collapsed form was one
  of two places still naming it something else, so a pilot who collapsed the
  list saw it change its own name. (This entry claimed it was the only one. The
  `H` row inside the list still read `H - Hide Controls`, and `1.24.2-alpha`
  below is where that was caught.) It reads `H - CONTROL REFERENCE` now, in
  `js/controls-help.js`, in `index.html` and in
  `docs/controls/clearing-the-screen.html`, with the key still at the front
  because saying which key brings the list back is the whole reason the line is
  left behind. `test/controls-help.test.js` pins the hint against
  `CONTROL_REFERENCE_LABEL` rather than against a second spelling of it.
- **Every panel opener closes the other three.** `openControlSettingsPanel` in
  `js/main.js` closed the other three, but none of `openSettingsPanel`,
  `openEditorPanel` or `openGameModesPanel` had been taught to close it, so the
  set was mutually exclusive only because `syncOverlays` ranks `controls` below
  `modes` and `settings` and because an open panel swallows every key that would
  open another. Nothing reached it, which is why this is not filed as a fix: the
  next panel, or the next open key, is what would have made a closed panel
  reappear from under the one over it. Each opener states what it closes now
  rather than resting on the order something else happens to rank them in, and
  `test/control-settings.test.js` reads the exclusion across all four of them.

## [1.24.0-alpha] - 2026-10-04

What the keys mean is a setting now. The menu entry that showed the reference
list of every key opens a panel instead, holding the two things a pilot most
wants to change about how an aircraft is flown: which way round each attitude
axis reads, and whether the nose and the wings may go all the way round. The
list is still there, one row down the panel.

### Added

- **A control settings panel, in `js/control-settings.js`.** The
  `CONTROL SETTINGS` entry on the start screen and in the pause menu opens it,
  and it is modal over the flight the way the other three panels are. It is a
  keyboard menu like them, drawn and stepped by the same functions
  `js/settings.js` already exposes - `optionEntryText`, `optionValueLabel`,
  `cycleOptionValue`, `isOptionValue`, all of which take the options they work
  on - rather than by a second set written to look like them. What is not shared
  is the storage key and the list of options, because those are what make it a
  different panel rather than a second copy of one. Three rows and a way through
  to the list: `PITCH AXIS`, `ROLL AXIS`, `FULL ROTATION`, `CONTROL REFERENCE`.
- **Pitch and roll read either way round, independently.** `DIRECTIONAL` points
  the key where the aircraft goes and `INVERTED` points it where a stick would,
  and either axis takes either setting, so all four combinations are available.
  The turning over happens in one place - `axisControl` in `js/input-map.js`,
  which answers with the control a key actually works - so both spellings of the
  input turn over together. `WASD` and the arrow keys are two names for one
  control rather than two control schemes, and there is no state in which one of
  them is inverted and the other is not. Changing an axis also releases both of
  its controls, through `releaseAxisControls`: a key held while its axis turns
  over would otherwise be released by the other end of its pair when it came up,
  leaving the end that was pressed held for the rest of the flight.
- **A full turn in pitch and in roll, for a pilot who asks for it.**
  `boundAttitude` in `js/attitude.js` takes both angles and the setting and
  hands both back bounded. Clamped, it is exactly the pair of clamps it replaced
  in `js/aircraft.js`: the nose short of the vertical and the wings at half a
  turn, which is the thing that makes ordinary flight readable. Opened up, the
  angle crosses the limit and comes round the other side rather than stopping
  dead, so a loop and a barrel roll both carry on. It wraps rather than
  reflecting the angle back off the pole, and that is the whole of why the keys
  stay honest: a reflection is the same attitude written differently, and
  writing it differently is what turns the pitch keys over at the top of a
  loop. One call for both angles, because a bound written per key is how two
  keys come to disagree about which way is up at 180 degrees.
- **The coordinated turn a bank carries round reverses over the top**, through
  `turnSign` in `js/attitude.js`: past the vertical the lift the wings are
  turning on points the other way, and so does the turn. Inside the clamp it is
  1 on every frame, so a flight flown with `FULL ROTATION` off is the flight
  that was flown before any of this existed.
- **A page for the panel**, at `docs/controls/control-settings.html`, spliced
  into the Controls group between Settings and Game modes. `test/site.test.js`
  now holds it to `CONTROL_OPTIONS` the way it holds the settings page to
  `START_FIELDS`, so an option added to the panel and not to the page fails.

### Changed

- **The `CONTROLS` menu entry is `CONTROL SETTINGS`, on both screens.** It
  answered "which key does what" and left "what do I want the keys to do" with
  no answer anywhere in the game. Both menus carry it under the same id, so the
  rename is one label in two places rather than two names for one thing, and the
  reference list it used to show is reached from the `CONTROL REFERENCE` row
  inside the panel. Choosing that row closes the panel, because the list is read
  against the world rather than against the rows that were covering it - which
  over a flight is the list `H` collapses, opened back up, and on the start
  screen is the one place it is shown at all. On the start screen the row also
  turns the list over rather than only opening it, which is what the `CONTROLS`
  entry did: there is no flight yet for `H` to be part of, so a row that only
  ever put the list on would leave a pilot working the menus from the keyboard
  with it over the title for the rest of the session.
- **The control list is headed `CONTROL REFERENCE`** rather than `CONTROLS`, so
  the row that opens it and the list it opens are named the same thing.
- **The attitude bound left `js/aircraft.js`.** The two
  `THREE.MathUtils.clamp` calls on `rotation.x` and `rotation.z` are one
  `boundAttitude` call, and the limits are `ATTITUDE_PITCH_LIMIT` and
  `ATTITUDE_ROLL_LIMIT` in `js/attitude.js` rather than `Math.PI / 2.2` and
  `Math.PI` written at the point of use.
- **`applyKeyToInput` takes the axes**, after the keymap, defaulting to both
  axes directional - so a host flying the Pilot API, which passes neither, reads
  its keys exactly as it always did.

### Queued

- **Seven control settings, as items under `## Flight Controls`.** Each is
  something already configurable in `js/input-map.js`, `js/controls-help.js` or
  `js/tilt-controls.js` and offered nowhere in the interface: the keymap, the
  axis settings reaching the tilt input, whether tilt flies at all, the tilt
  deadzone, which controls end a level off, the two keys that are not control
  surfaces, and whether the reference list is remembered open.

## [1.23.0-alpha] - 2026-10-03

A canyon run is held under the lid of its first cut as well as over the ground
beneath it, which is the half of that guard that was never written. The other
three are readings that agreed with the code without being able to disagree
with it: the lid rule was pinned by two bounds a materially different rule
cleared more generously, and the landing that closes a circuit was matched
against a method body rather than against the guard inside it.

### Added

- **`HEADROOM_SAMPLES` is published through `js/api/index.js`.** The constant
  was exported from `js/corridor.js` and read by the suite, and the entry point
  a host imports did not carry it. Documenting it is what surfaced that: the
  check in `test/docs.test.js` holds every name the reference presents as an
  export to one the API actually publishes, and it refused the row until the
  export was there.

### Fixed

- **A run opens under the lid of its first cut, not only over the ground.**
  `corridorOpening` in `js/game-modes.js` put the aircraft at
  `Math.max(first.floor, ground) + margin`, which is the floor side of a guard
  with no ceiling side: the ground at the opening raises the height wanted and
  leaves the lid where it is, so ground standing higher over the cut's floor
  than half the cut's air opens the run above the ceiling it is meant to be
  flown under, with the first section already failed. The two are now a band,
  `Math.min(first.ceiling - OPENING_CLEARANCE, ...)`, and the clearance is half
  of `MIN_HEADROOM` rather than a figure of its own - no cut is laid with less
  air in it than `MIN_HEADROOM`, so the cap can never ask for a height below
  the cut's own floor. Flown as it stood, all four stages were fine; `THE SLOT`
  opened 22.1 units under its first lid against a margin of 115.0, and the
  remaining 22.9 was the seed's to spend.
- **A band held at both edges, so the cap cannot lower a run into the hill
  behind its first cut.** `MIN_HEADROOM` bounds the lid against the ground
  *under the cut*, and the opening is a whole spacing back from that cut, so
  nothing holds the ground at the opening below the same lid. Where it stands
  within `OPENING_CLEARANCE` of that lid, the band the entry above describes
  has no width left and lowering to the lid put the aircraft underground: with
  `GROUND_CLEARANCE` at 5 units and the opening flying at 105 knots, that is a
  wreck on the frame the pilot is handed rather than a stage. The opening is now
  held `OPENING_CLEARANCE` over whichever is higher of the cut's floor and the
  ground beneath it as well as that far under the lid, and where the two cannot
  both be met the ground takes it - a run opened over its first lid has the
  whole spacing in which to come down. Reachable on the stages as they ship
  rather than only in principle: over the preset `CANYON RUN` draws its ground
  from, `THE SLOT` opened below the terrain on 204 of the first 400 world seeds
  and by as much as 453 units, and `THE RIM` on 29 of them. The mode's own seed
  is not one of them, which is why the suite stayed green.
- **The lid rule is pinned against itself rather than against bounds it
  clears.** `test/corridor.test.js` read the lid three ways and none of them
  separated `Math.max(floor + plan.ceiling, crest + MIN_HEADROOM)` from the
  rule that measures both halves off the crest - the level-ground case runs
  where `crest === floor` and every candidate agrees, and the other two assert
  floors the crest version clears more generously while standing hundreds of
  units too high on the steeper cuts. Substituting it ran the suite green. A
  case over rolling and over steep ground now asserts the formula itself, with
  a count on each side so both halves of the `Math.max` are shown to win
  somewhere.
- **The landing that closes a circuit is matched inside the guard that counts
  it.** `the landing closes the final leg, and reports the circuit with it` in
  `test/pattern.test.js` matched `this.closeFinalLeg();` against the whole
  `onLanding` body under a message about the guard, so it said nothing about
  where in the method the call sat. Moved above
  `if (recordLanding(this.run, runway))` it still matched, and a landing the
  run refuses by design - the takeoff roll, or a pass down the strip left by a
  go-around - would have closed `FINAL` and reported a circuit the pilot never
  flew out. The span is now bounded to the guard with `[^}]*?`, the way
  `test/input-map.test.js` bounds its spans.
- **Two enumerations in `docs/api.md` carry what was added to them.** The leg
  shape gains `onStrip`, the one field a host has to read to draw a circuit
  without standing a mast on the runway, and which the prose two paragraphs
  below already described; the corridor module's constants row gains
  `HEADROOM_SAMPLES` and a phrase saying what it is. Both propagate to
  `docs/api-reference.html`. The `1.22.0-alpha` entry's sentence about
  `patternScore` was also missing its last word.
- **A dash that began a line is no longer read as a bullet.** The new
  `stageStart` paragraph in `docs/api.md` wrapped a parenthetical so that its
  closing ` - ` fell at the start of a line, which is a list marker in
  markdown: `tools/build-api-reference.mjs` split the paragraph there and
  `docs/api-reference.html` shipped a sentence ending mid-clause with no stop,
  followed by a one-item `<ul>` opening with the word "and". Reflowed so the
  dashes sit inside their lines, and the page regenerated.

## [1.22.0-alpha] - 2026-10-02

Five fixes in the two newest modes, four of them about a reading taken in one
place and used as though it had been taken in another. A traffic pattern no
longer stands a mast on the runway at each end of the strip, and the approach it
reads every frame is finally marked. A canyon run measures the air in a cut
across the span the cut is open over rather than at one point on its centre
line, and opens at a height read against the ground it actually opens above.
The fifth is an assertion that was matching a dot against any character.

### Fixed

- **A circuit puts a mast at the turns in open air and at no others.**
  `standingMarks` in `js/main.js` mapped every leg of the circuit onto a mast,
  and two of the five legs end on the strip itself - the takeoff at the
  departure threshold and the final at the approach one, which is the threshold
  the circuit opened from. Built in Node off the mode's own seed, `TRAFFIC
  PATTERN` / `WIDE CIRCUIT` stood a 130-unit mast with a lit head on it 0.0
  units from each of its runway's two thresholds: the takeoff roll ended at one
  and the landing was flown onto the other. Nothing crashed, because `js/crash.js`
  reads the terrain height and knows nothing about meshes, so the aircraft
  passed through the pole rather than into it. But the reason the code gave for
  the mast - that a turn in a circuit is a place in empty air with nothing drawn
  at it - is true of the three middle turns and false of these two, which are
  the ends of a drawn strip the approach guidance already marks. `buildPattern`
  now says which turns stand on the strip, as `onStrip` on the leg, and the
  renderer leaves those out.
- **And the mast being waited on is still the right one.** Dropping two marks
  from a list of five broke the lighting, because `beacon.setNext` is handed a
  leg index while `RescueMarker.setNext` coloured `this.heads` by position - so
  a shorter list would have lit the wrong head from then on. A mark may now
  name the mark it stands for, as `at`, and is lit by that; a mark without one
  is lit by its place in the list, which is what a survey's landmarks want
  since they are drawn in the order they are shot.
- **The final leg of a circuit is closed by the landing, and reported.**
  `trackPattern` sampled whatever `nextLeg` answered, which is the final leg for
  the whole of the approach, so the tally for that leg filled up with the height
  and heading error flown down final - and nothing ever closed it. `trackLegs`
  returns unless a turn was crossed, and `recordPatternLeg` refuses the final
  leg by design, because the pilot crosses that threshold on every go-around
  they fly. The pilot got `HELD n` for `TAKEOFF`, `CLIMB OUT`, `DOWNWIND` and
  `BASE`, and nothing at all for `FINAL`. The landing now closes it, which is
  the one event that means the circuit was flown out rather than crossed over,
  and `circuitNotice` reports the leg's mark and the circuit's together -
  `patternScore` was a published export the game never asked for.
- **A cut's headroom is measured across the span the cut is open over.**
  `MIN_HEADROOM` in `js/corridor.js` is the least room a stage may leave between
  the ceiling and the ground under a section, and `buildCorridor` applied it
  against the ground sampled at the section's centre line and nowhere else. A
  cut whose centre falls in a gully had its lid measured off the gully floor
  while the ground at its posts stood far higher. Built in Node off the mode's
  own seed, `CANYON RUN` / `THE SLOT` left 40.4 units between the ground at a
  post of cut 5 and the beam over it, against a declared minimum of 70 - and
  nothing in the formula stopped the figure going negative on another seed,
  which is the impossible cut the constant exists to refuse. A section now
  carries `crest`, the highest ground it is open over, read at
  `HEADROOM_SAMPLES` points from one post to the other, and the lid is held at
  whichever is higher of the stage's own headroom over the floor and the least
  room over the crest. All four shipped stages now clear the minimum, the worst
  of them at exactly 70.
- **A run opens at a height read against the ground it opens above.**
  `corridorOpening` in `js/game-modes.js` put the aircraft a full `spacing` back
  from the first cut and set its altitude to the midpoint of the air at the cut,
  over ground sampled at the cut. The two places are a whole spacing apart and
  the ground between them is not flat: `CANYON RUN` / `THE SLOT` opened 24.3
  units over the ground beneath it, and `GROUND_CLEARANCE` in `js/crash.js` is
  5, so the stage opened about four of its own clearances off the deck at cruise
  speed. The first cut's floor was 92 units below the ground the aircraft was
  actually put over, and that difference was the whole of the error. `stageStart`
  now carries a `sampleHeight` in its world, and the opening is held half the
  cut's air above whichever is higher of the cut's floor and the ground at the
  opening - 115.7 units for that stage. A host that hands over no terrain gets
  the height this always gave.
- **A source-text assertion matched a dot against any character.**
  `test/minimap.test.js` built its `runWorld` assertions as `new RegExp(` plus a
  template literal reading `${mark}: this\.${mark}`. Inside a template literal
  `\.` is not an escape, so it collapsed to a bare `.` before the `RegExp`
  constructor saw it, and the assertion passed on text it was written to reject
  - `course: thisXcourse` satisfied it. Every other span in the file is escaped
  correctly, so this one read as a slip rather than a choice. The dot is escaped
  now, and the suite checks each span rejects a non-dot in that position.

### Changed

- `docs/api.md` records the section's new `crest` reading and the rule the lid
  is held by, the `onStrip` reading on a circuit's legs, what closes and reports
  the final leg, and the `sampleHeight` a `stageStart` world carries.
  `CHEATSHEET.md` and the cheatsheet page say that the landing closes `FINAL`
  and that a mast stands only at the turns in open air.

## [1.21.0-alpha] - 2026-10-01

Three modes that are not met by arriving somewhere. A traffic pattern is
marked on how each leg of the circuit was held rather than only on the landing
at the end of it; a canyon run counts a cut only when it is crossed inside the
walls and under the ceiling; and a photo survey counts a landmark only when the
shutter goes with the aircraft inside the height, the range and the heading the
brief asked for. The simulator goes from five modes to eight.

### Added

- **`js/pattern.js` lays a traffic circuit off a strip and marks each leg of
  it.** Five legs - takeoff, climb out, downwind, base, final - each carrying
  the heading that runs along it, the height to be at by the end of it, and the
  turn it ends at. The circuit is laid off the runway rather than placed world
  by world, so the same plan at any strip in any world is the circuit that strip
  would be flown; `buildPattern` closes it back on the threshold it opened from,
  which the suite checks at six bearings. The turn onto the downwind belongs to
  the climb out rather than standing as a crosswind leg of its own, which is
  what leaves the downwind exactly parallel to the strip - the downwind is the
  leg genuinely about holding a heading, and a leg laid diagonally would be
  asking for a number nothing on the ground explains. The height a leg asks for
  at a place along it is read off a ramp between its two ends, so a leg whose
  ends match is a height to hold and a leg whose ends differ is a climb or a
  descent to fly at a steady rate; one reading serves all five without any of
  them needing a rule of its own. Both errors accumulate against time rather
  than against frames, so what a leg comes to does not depend on how fast the
  machine was drawing - the suite flies one leg identically wrong in long frames
  and in short ones and holds the two to the same mark.
- **`js/corridor.js` lays a canyon corridor and says whether a step went
  through a cut.** The line is walked across the ground the way a course of
  loops is, and the ceiling is held a declared height over whatever is
  underneath, so a stage that brings the ceiling down brings it down everywhere
  rather than only where the ground was already high. It is laid rather than
  found: the generator draws its canyons wherever the noise puts them, so a run
  that went looking for one would be a run whose difficulty was whatever the
  seed handed it. `corridorCrossing` is the gate test asked of a rectangle open
  at the bottom rather than of an ellipse - open at the bottom because the floor
  is the ground, and the ground is already a thing that ends a flight. Climbing
  over the lid is the one way the mode could be cheated and the only thing it
  guards against. `MIN_HEADROOM` keeps a plan from asking for a cut with no air
  in it, which is not a hard cut but an impossible one.
- **`js/survey.js` places a list of landmarks and reads a shot against the
  window each one has to be caught through.** Three readings at once - a height
  band, a range band, and a heading with a reach either side of it - because a
  landmark photographed from directly overhead at four thousand feet is a
  photograph of a roof and the brief asked for an elevation. A reading that
  cannot be taken is outside every part of the window rather than inside it by
  default: a missing place measures `NaN`, and `NaN` fails every comparison
  including the ones that would have rejected it. `shotFault` names the first
  thing wrong with a shot rather than all of them, because a line that lists
  three is a line nobody reads in the second it is up, and a pilot who fixes the
  first comes round and is told the second.
- **`js/walls.js` draws a corridor as a post at either wall and a beam across
  the top.** The opening the pilot flies at is bounded on three sides by
  something drawn and on the fourth by the ground, which needs no drawing. The
  beam's turn is written as the two directions it is between rather than as a
  pair of Euler angles: a hoop's two turns happen to compose in the order
  Three.js applies them and the same pair here does not, so saying it the short
  way would have been saying it wrong in a way only a screenshot would show.
- **Two worlds for the two modes that needed ground of their own.**
  `CANYON REACH` is a deep plateau cut end to end by canyons, so the corridor a
  run is judged on has real walls standing beside it; `SURVEY COUNTRY` puts
  town, forest, water and rock together, so a survey's landmarks are things on
  the ground rather than places on a map. Both are read the other way round from
  the three mode worlds already there, which are deliberately thin because what
  those modes ask the pilot to read is the objective rather than the scenery.
- **`test/pattern.test.js`, `test/corridor.test.js` and `test/survey.test.js`,
  and thirty-three more in `test/game-modes.test.js`.** The suite goes from
  1052 to 1149.

### Changed

- **A circuit is the one run that opens on the ground.** Every other stage
  opens in the air because a takeoff is the part nobody is being scored on;
  here the takeoff is the first leg of the thing being scored. `stageStart`
  hands back `START_TAKEOFF` and a null `position`, leaving the threshold to
  the takeoff start rather than naming it a second time - two answers to one
  question is how an aircraft ends up beside the strip it is supposed to be
  lined up on. The test that read `START_FLYING` for every mode now reads the
  rule it was written for rather than the shape it had.
- **The last leg of a circuit is closed by the landing rather than by the
  turn.** Final ends at the threshold, and an aircraft crosses that threshold on
  every go-around it flies, so counting the crossing would have finished the
  circuit for a pilot who never got down. `recordPatternLeg` refuses the final
  leg and `recordLanding` closes it; a landing reported anywhere earlier in the
  pattern counts for nothing.
- **`js/marker.js` draws a list of marks rather than one.** A rescue marker, a
  survey's landmarks and a circuit's turns are all a mast with a lit head and,
  where one is wanted, a circle on the ground - so one renderer draws all three
  rather than two near-copies of it being written. A mark may name its own mast
  height, which is what lets a turn in a circuit stand up to the height its leg
  wants; `setNext` colours the heads from the mark the run is waiting on, the
  way a course colours its hoops.
- **The objective card's notice is one timer rather than one per mode.** A
  missed gate, a cut flown over the top of, a shot outside its window and a leg
  just held are all the same thing to the card - something that just happened,
  worth a moment of the row the objective is usually in - so `missHold` became
  `noticeHold` and the text it holds.
- **What a run is flying to is gathered in one place.** `runWorld()` in
  `js/main.js` carries the course, the strips, the corridor, the circuit and the
  landmarks, and the chart, the pointer and the brief are all read off it. The
  check in `test/minimap.test.js` that caught a chart being handed only a loop
  course now reads that one place rather than the call, and names all five:
  leaving one out is exactly what lost a route its bearing before.
- **The corridor is counted in cuts rather than in sections.** The status row
  is measured at forty-four characters with the stage's own name in front of it,
  and a run of eleven `SECTION`s runs past that. `CUT` is both short enough and
  the word the thing is already called, a canyon run being a run down a cut.
  The survey's brief sits at exactly the thirty-two characters the objective row
  was measured at, and the check in `test/page.test.js` now walks the new modes'
  lines - the briefs, the fault notices and the leg reports - so none of them
  can drift past the height its row was declared at.
- **A survey's range band is drawn on the ground rather than written on the
  card.** The objective row has room for a name, a height and a bearing, and not
  for a second band on top of them. The range is the one of the three readings
  that is a place, and a place can be drawn, so `rangeBand` hands its near and
  far edges to the renderer as circles laid round the landmark.
- **The ignore-rules check in `test/site.test.js` applies on every tree.** The
  stand-down branch at the top of it dated from a personal global rule keeping
  `.gitignore` out of the repository, so `actions/checkout` fetched a tree
  without it. The file has been tracked since - `git ls-files .gitignore`
  answers - so the branch guarded nothing and would have hidden the check on any
  tree that lost the file again, which is the one tree worth failing on. The
  rules now reach a clone: a fresh checkout carries `.tmp/`, `test-results/` and
  `user-scripts/` and is held to carrying them.
- **`js/pattern.js`, `js/corridor.js` and `js/survey.js` are published.** Each
  is a subpath of its own in the manifest and re-exported from `js/api/index.js`,
  so a host wanting one of the three mechanics without the run state around it
  can import it. `docs/api.md` names every one of the new exports and carries a
  worked example per mode.

### Fixed

- **The terrain page keeps the qualifier that made its element count true.**
  Listing the two new mode worlds turned "All three are deliberately thin - four
  elements each at most" into "Most of them are deliberately thin - four elements
  each", and `LOOP VALLEY` carries three: a mountain, grass and water. The
  sentence is about the three older worlds either way, so the count goes back to
  being an upper bound rather than a figure one of the three does not meet.

## [1.20.1-alpha] - 2026-09-30

The address opener is pinned where it is connected to the page, not only where
it is worked out. `openingRun` was read five ways and `startRun`'s new stage
argument three more, and none of those readings reached `js/main.js`, which is
where the feature meets the browser: replacing the one call at start-up with a
comment left the suite reporting 1049 of 1049 passing while
`?mode=cargo-run&stage=2` opened free flight at the first stage without a word
said about it. The same edit now fails one test and nothing else.

### Changed

- **`test/game-modes.test.js` pins the wiring the address reaches the run
  through.** `js/main.js` imports Three.js and cannot be constructed in Node, so
  the three tests read it as source text through a `mainSource` regex, which is
  the idiom `test/landing-score.test.js`, `test/minimap.test.js`,
  `test/page.test.js` and `test/world-tiles.test.js` already use on that file. A
  `simulatorMethod` helper extracts a named method by its own braces, so no span
  can run past the method it is anchored on - which is the reason the hold test
  in `test/input-map.test.js` gives for bounding a span, applied at the method
  rather than at the call - and inside a method the spans are bounded tighter
  again with `[^}]*?` and `[^)]*?`. Three things are held: that start-up hands
  `window.location.search` to `openRequestedRun`, and hands it over after
  `applySettings`, whose world would otherwise be built on top of the stage just
  opened; that the request is read from the address the method was given and its
  `modeId` and `stageIndex` passed to `startRun` on this session's run, with that
  stage's own ground laid and the aircraft put back to its start; and that a
  request carrying a `problem`, or no request at all, opens nothing - the guard
  read by position as well as by text, because a guard written below the call it
  guards reads exactly the same and stops nothing. Comments come off the source
  before any of that, the way `styleRules` in `test/page.test.js` takes them off
  the stylesheet: a call read as text reads the same whether it is made or
  commented out, so without the strip putting `//` in front of the call in
  `init` - which is how a line is disconnected in practice - left all three
  tests passing on a page that no longer asks. Only a comment opening its own
  line is taken, so a `//` inside a string is left alone. The two calls whose
  order is held are both found before they are compared, because a call that is
  not there at all is `indexOf` -1, which sits below every real position and so
  reads as the right order: without that, deleting `applySettings` from `init`
  passed the very assertion written to hold the opener behind it. Fifteen edits
  to `js/main.js` were tried against the finished tests and every one of them
  fails: the call commented out and the call replaced by a comment, the call
  moved above `applySettings`, `applySettings` gone from `init` altogether, the
  stage argument dropped from `startRun`, `refreshWorld` and the aircraft reset
  each dropped and each commented out, the `problem` guard deleted and commented
  out, the guard left reporting to the console without returning, the `!request`
  return deleted and commented out, and the guard moved below `startRun`. The
  first of those was run against the whole suite, which reports 1051 of 1052
  with the wiring cut and 1052 passing with it in place; `js/main.js` is
  unchanged either way

## [1.20.0-alpha] - 2026-09-29

A mode's later stages can be opened directly, which is what put them back
within reach of anything automated. A run opened at its first stage and had no
way to open at another, so the only route to a route's second stage was landing
at both of the first stage's strips thousands of units apart - and an arrival
cannot be handed to the page from outside, because a landing reported while the
aircraft is airborne is cleared on the next frame. Two runs tried that leg and
neither flew it, which left the two held chart marks at `CARGO RUN` /
`LONG HAUL` confirmed off the geometry rather than off the glass.

### Added

- **A run can be opened at a chosen stage, from the address.**
  `startRun(state, id, stageIndex)` takes an optional stage and clamps it into
  the ones the mode carries, so a run never stands on a stage with no world to
  build; nothing on the panel passes it, and a mode chosen there opens where the
  pilot is meant to start it. `openingRun(query)` reads
  `?mode=cargo-run&stage=2` off a query string and answers with the run asked
  for, `OPENING_MODE_KEY` and `OPENING_STAGE_KEY` naming the two keys. The stage
  is counted the way the card counts it, so `STAGE 2 OF 3` on the glass is
  `stage=2` on the address. `js/main.js` reads it once at start-up and lays the
  stage out on the first frame - its own world, its own seed, its own start,
  the clock at nothing - by the same three steps the panel takes. A request that
  cannot be met opens nothing and writes the reason to the console rather than
  opening the nearest stage: something checking the page would otherwise read a
  stage it did not ask for with no way to tell, which is worse than the flying
  it replaced, because a flight that misses a stage at least fails visibly.
  Refused are a mode nothing answers to, a stage below 1, above the last, or not
  a whole number, and a stage asked for with no mode to open it in;
  `free-flight` is a name the address accepts and has no stage. Published
  through `js/api/index.js` and named in `docs/api.md`. Read in Chromium against
  the running page: `?mode=cargo-run&stage=2` opens `LONG HAUL · STAGE 2 OF 3 ·
  LEG 1 OF 2` with both marks held and hollow - the next one stroked
  `rgb(0, 255, 68)`, the one still ahead `rgb(255, 176, 0)`, both at
  `0.9px` - and `stage=3` opens `THREE STOPS` holding neither, which is what the
  geometry predicted for each and had no way to show

### Changed

- **`test/page.test.js` pins the weight a held mark is drawn at.** A mark held
  at the edge of the chart reads by three declarations at once - `fill: none`,
  the colour, and a stroke wider than an unheld mark's - and the suite settled
  two of them for `1.19.2-alpha` while no test in the project mentioned a stroke
  width at all. The loop over the three held readings now resolves
  `stroke-width` through `cascaded` beside the fill and the colour, so a rule
  that dropped the width or a later one that overrode it fails here. The number
  is read against the unheld mark's as well as against itself: pinned alone it
  would still pass with `.minimap-mark`'s own width raised to meet it, and a
  held mark drawn at the weight of an unheld one is the reading gone whatever
  either number says. Measured in Chromium against the running page, all three
  held readings resolve `0.9px`, which is what the assertion holds them to
- **The stylesheet's note about the held block says what actually holds.** The
  comment over `index.html:219` ended "Three classes beat two, so these win on
  specificity without the order being touched", which is false for the one
  declaration in the block that competes with anything. `.minimap-mark.off-map`
  carries two classes, the same as `.minimap-mark.next`, so its `fill: none`
  beats that rule's `fill: #00ff44` on written order alone; only the two strokes
  below it carry three classes and win on specificity, and a stroke never
  competes with a fill. Following the comment and lifting the block above
  `.minimap-mark.next` - which it said cost nothing - fills a held next mark
  green and drops the hollow that is what says it is past the edge. The note now
  says which half wins on what, that the block has to stay below
  `.minimap-mark.next` and `.minimap-mark.flown`, and that the order is pinned
  by the held-mark reading in `test/page.test.js` rather than only by the
  comment. The rules themselves are unchanged

## [1.19.2-alpha] - 2026-09-28

The chart's colour tests ask which rule wins rather than whether one exists.
Both readings added for `1.19.1-alpha` looked for a rule carrying the right
colour, which is the weaker of the two questions and the one the defect that
release fixed answered yes to throughout: `.minimap-mark.next` carried the green
the whole time a held mark drew amber, and the reading written to close that
blind spot inherited it.

### Changed

- **`test/page.test.js` settles a declaration through the cascade.**
  `styleRules` now keeps each rule's position in the sheet and whether an at-rule
  is wrapped around it, `specificity` reads a selector's ids, classes and element
  names, and `cascaded` answers what an element carrying a set of classes is left
  with for one property: of the rules matching it that declare the property, the
  one marked important if any rule marked it, and otherwise the last written
  among those of the highest specificity. A body naming the property twice is
  read as leaving the second, the way the cascade leaves it. The three readings
  inside the square and the three at its edge are stated as the colour a mark
  with `next`, `flown` or neither resolves to, and the hollow fill is now
  asserted for all three held readings rather than for the base rule alone -
  which is the same cascade question in reverse, since `.minimap-mark.off-map`
  ties with `.minimap-mark.next` and wins only by being written below it. What a
  set of classes cannot settle is refused rather than answered around: a rule
  reaching the element through an ancestor, an id or an element name, and a rule
  written inside an at-rule, which decides whether it applies at all. A rule
  written for some other subject is passed over instead - which is what keeps
  `#minimap.off-map .minimap-marker` out of a reading about marks. Verified by
  writing `.minimap-mark.next.off-map { stroke: #ffb000; }` below the fix and
  `.minimap-mark.next { fill: #ffb000; }` below the base rules, each flattening a
  reading on equal specificity and later order: the new readings fail on both and
  the readings as `1.19.1-alpha` left them pass on both. Four further sheets were
  tried against the finished reading and each of them fails it: the held block
  moved above `.minimap-mark.next`, which is the order the hollow fill depends
  on; a second `fill` added to the held rule; an `!important` stroke added to the
  base rule; and a `.minimap-mark.next` fill written inside `@media`, which
  reports that it cannot be weighed rather than reporting a colour. The suite
  reports 1039 passing, and `index.html` is unchanged
- **The four chart tests left saying gate now say mark.** `coursePoints` and
  `courseLine` in `test/minimap.test.js` are the same two functions the
  mark-named tests below them exercise through `setCourse`, and a course point is
  now a gate on a loop, a strip on a route or a search's one marker. Their four
  names, the comment above the held-mark test, its `gate` local and the assertion
  message about a course with nothing on it all say mark, which finishes the
  rename `1.19.1-alpha` began and leaves the seam between the two halves of the
  file gone. The seam tests below are untouched: they say gate where a gate is
  what is meant, for `nextGate` and the hoops a loop course lights. Text only,
  and the suite reports 1039 passing either way

## [1.19.1-alpha] - 2026-09-27

A mark held at the edge of the chart says which leg it is again. `1.19.0-alpha`
handed the chart a route's strips and a search's marker, and both are ordinarily
off the square the chart covers rather than inside it - which is where the three
readings the chart draws in were being thrown away. A route opening a tile
boundary away from its own strips drew the leg being flown and the leg still
ahead identically, so the chart the pointer row hands off to on a short screen
gave a bearing with no leg attached to it.

### Fixed

- **A mark held at the edge of the chart keeps its reading.**
  `.minimap-mark.off-map` in `index.html` hollows a held mark out, which is what
  says it stands past the ground the chart covers - and it carried the same
  specificity as `.minimap-mark.next` and `.minimap-mark.flown` while being
  written after both, so it won outright and a held mark drew
  `fill: none; stroke: #ffb000` whichever of the three readings it carried.
  `markClass` in `js/minimap.js` was setting the class correctly throughout;
  nothing on the glass was reading it. The stroke now carries what the fill
  carries inside the square, in `.minimap-mark.next.off-map` and
  `.minimap-mark.flown.off-map` - three classes to the base rule's two, so they
  win on specificity with the order untouched, and the hollow fill and wider
  stroke go on saying what they said. On `CARGO RUN` / `SHORT HAUL`, which opens
  675 units the wrong side of a tile boundary from both its strips, that was
  7.5 seconds of a stage with the two legs indistinguishable; a search draws one
  mark and had nothing to tell apart. The pages written for the chart needed no
  edit: the route and search paragraphs in `docs/controls/game-modes.html` and
  the chart's own section in `docs/controls/instruments.html` each compose a
  colour with the hollow edge - a leg "marked green" with a strip "held hollow at
  that edge", a marker "green" and "held hollow at the edge of the square" - which
  the shipped stylesheet made mutually exclusive and this fix makes true
  together, so all three read true as written

### Changed

- **The chart test that fits the course to new ground says mark rather than
  gate.** `a chart fitted to new ground draws the course against that ground` in
  `test/minimap.test.js` kept gate where the test immediately above it had been
  moved to mark: its comment, its `gates` and `gate` locals and its assertion
  message all still said gate for a course that may now be a route's strips or a
  search's marker. The four tests above it that cover `coursePoints` and
  `courseLine` still said gate, in all four names, a comment, a local and an
  assertion message; `1.19.2-alpha` finishes those four, after which the file
  says one word for one thing. The seam tests below it are not part of that: they say
  gate where a gate is what is meant, for `nextGate` and the hoops a loop course
  lights. The seam test beside it also built and destructured a single-element
  array to bind one value, which is now bound directly

## [1.19.0-alpha] - 2026-09-26

The chart in the corner draws what the run is flying to, whatever the run is.
It drew a course of loops and nothing else, so on the two other modes that write
the objective card's pointer row it was a face, a grid and an aircraft - and a
screen under 746 pixels of height takes that row off and gives the chart as the
reason. A route and a search lost their bearing and their distance altogether at
that height. The chart is now handed the strips a route lands at and the marker
a search is looking for, on the same terms the gates were always drawn on.

This release also carries the dead stick's last way of not coming down, which
was never the vertical. The descent was made honest in `1.18.1-alpha` and the
level off wrote an altitude straight over it, so a glide could be trimmed to
hold height and the stage had nothing left to end it. The three accounts that
called the case closed are corrected along with it, and so is what
`1.18.1-alpha` wrote about the objective card's pointer row. The test that reads
the frame's hold out of the source now reads the whole of it - the field it
stopped checking being the one the fix turns on, and the two refusals it never
read at all being the two that make the fix hold.

### Added

- **The chart draws a route's strips and a search's marker, not only a course's
  gates.** `chartCourse` and `chartNext` in `js/game-modes.js` answer what the
  chart should draw and which of it the run is waiting on, for any objective:
  the gates of a loop course, the strips of a route in the order it lands at
  them, the one marker of a search, and nothing for a landing or a free flight,
  which have no objective standing off somewhere to be told about. They are the
  same answer `runPointer` gives the card in words, built beside it so the two
  cannot drift apart, and both are published from `js/api/index.js` for a host
  drawing a map of its own

### Fixed

- **A dead stick can no longer be trimmed to hold its height.** `Space` is the
  level off, and it set `holdingAltitude` without reading the engine, so one
  press on a dead engine pinned the altitude the frame opened at over whatever
  `glideDescentAt` had just worked out. The altitude never fell, `V/S` read
  `0 ft/min` because it is measured from the same two altitudes, and only pitch
  and throttle end a hold - roll and yaw are not a call for a different vertical
  state - so the strip could be steered to at a fixed height and the stage never
  ended. The press is now refused with no engine, with the nose left where the
  pilot put it rather than half a level off being flown, and an engine that dies
  under a hold already in force hands the aircraft back on the spot
- **The hold is a function the frame calls rather than a line inside it.**
  `heldAltitude` in `js/flight-model.js` answers what altitude a frame ends at
  given the altitude it opened at, the altitude it flew to, and whether the hold
  is in force, the aircraft airborne and the engine live. `js/aircraft.js` is not
  constructible in Node - it wants a scene - so a rule written into its frame
  loop can only be checked by reading the source for it, which is how the
  original line came to be asserted about and still wrong. This one is swept the
  way the glide plane is swept: every attitude the nose can be clamped to
  against every airspeed to the top of the range, each flown one frame under a
  hold on a dead engine, asserting none of them ends the frame higher than it
  began. The manoeuvre that found it - settled at 4153 ft and 65 units, `Space`,
  nothing else touched - is flown through the same calls the frame makes. The
  guard being in the model rather than in the aircraft is also what gives a host
  driving the Pilot API the same answer the game gets, whatever it writes the
  engine flag to
- **The test reading that call out of the source reads the field the hold turns
  on.** `js/aircraft.js` is not constructible in Node, so what the frame hands
  `heldAltitude` can only be checked by matching the source, and the three
  assertions doing it checked the call's shape, `airborne` and `engine` - not
  `holding`. Nothing else tied the frame's flag to the altitude write either:
  `heldAltitude` is handed its state directly by its own unit tests, so it
  cannot see what the frame passes. Writing `holding: true` into the call left
  the whole suite green while pinning every airborne powered aircraft to the
  altitude it opened the frame at, so free flight could neither climb nor
  descend. A fourth assertion now matches `holding: this.holdingAltitude`, and
  all three spans are bounded to the call's own braces with `[^}]*?` rather than
  running to the end of the file with `[\s\S]*?` - an unbounded span passes a
  field deleted from the call as soon as the same text appears anywhere below it
- **Nothing in the suite read the two paths that set the hold's flag.** The
  frame's use of it was pinned and the refusals that make it correct were not:
  deleting `if (!this.engine) return false;` from `levelOff` and
  `if (!this.engine) this.endLevelOff();` from `setEngine` each left 1033 of
  1033 passing. The first puts the level off's own refusal back to what it was
  before the fix above, and the second lets `isHoldingAltitude` report a trim
  the frame has already stopped honouring. `js/aircraft.js` imports three and
  cannot be constructed in Node, so the hold test in `test/input-map.test.js`
  now reads both out of the source the way it reads the frame's call, each
  bounded to its own method
- **The one unbounded span left in that test is bounded like the rest.** The
  assertion that a press brings the nose to level matched
  `/levelOff\(\)\s*\{[\s\S]*?this\.levelling = \{/`, four lines under the comment
  explaining why the spans beside it are bounded. Deleting the assignment
  `levelOff` makes and reseeding the ease in a method below it - the plausible
  edit - passed under that span and fails under `[^}]*?`, with `levelOff`
  holding no closing brace between its own and the line matched. The comment's
  second paragraph now speaks for every source-matching span in the test rather
  than for the three the frame hands `heldAltitude`, which is what it had come
  to read as

### Changed

- **What the objective card's pointer row comes off for is now true of every
  mode that writes it.** Two media queries in `index.html` take the row off a
  short screen and give the same reason - the chart in the corner is already
  saying which way the objective lies. Measured at 393x740, that held for
  `FLYING THROUGH LOOPS`, which draws three gates and the course line, and not
  for `CARGO RUN` or `SEARCH AND RESCUE`, which drew no gates and an empty
  course line: a route lost `LEG 1 · 234° · 8570 ft` and a search lost
  `MARKER · 045° · 11810 ft` with nothing put in their place. `js/main.js` hands
  the chart `chartCourse` now rather than the loop course alone, so the reason
  those comments give is a reason that holds, and both comments say `objective`
  where they said `gate`
- **The chart's marks are named for what they are rather than for the first
  thing they were.** A mark on the face is a gate, a strip or a marker depending
  on the mode, so `gateClass`, `GATE_STATES` and `GATE_RADIUS` in
  `js/minimap.js` are `markClass`, `MARK_STATES` and `MARK_RADIUS`, the CSS class
  is `.minimap-mark`, and `Hud.setNextGate` is `setNextMark`. The hoops in the
  world are still lit from `nextGate`, which is the one place the word still
  means only a gate. No reading changes: a mark is drawn in the same three hoop
  colours and held hollow at the edge of the square the same way
- **The three accounts that declared the case closed now say what closed it.**
  `js/flight-model.js` said no pair the aircraft can be in comes out climbing,
  `docs/controls/game-modes.html` said the one thing that holds height is speed
  rather than attitude, and the `1.18.1-alpha` entry below named the one case
  that does hold height. All three were true of the vertical and silent about
  the trim, which holds an altitude without going through the vertical at all.
  Each now names the second case and where it is closed, and the flight model
  page documents the engine beside the ground rule it already documented
- **Every list of the keys says the level off needs an engine.** `README.md`,
  `CHEATSHEET.md`, `docs/cheatsheet.html` and `docs/controls/index.html` each
  describe `Space` as trimming the climb and holding the altitude, and each now
  says what that needs, so which page the bindings were read off does not decide
  whether the dead stick's refusal comes as a surprise
- **What keeps the pointer row's two lines whole is named correctly.** The
  comment at `#game-mode-pointer` and the `1.18.1-alpha` entry below both said
  the bound is summed from the wrapped height, and nothing sums `--card-pointer`.
  The four bounds written as row sums are the short-screen ones, and each sits
  inside a media query that has already taken the pointer row off with
  `display: none`. Where the row is drawn wrapped the card is bounded by the
  room left under the readouts instead, which is the opposite kind of bound and
  is room enough for both lines; below 746 pixels of height the row comes off
  rather than wrapping in a card too short for it. The comment now points at the
  `(max-height: 745px)` rule that works that height out rather than restating it
- **A paragraph in `CHEATSHEET.md` is wrapped to the width the rest of it
  uses.** The glide paragraph was edited in place for `1.18.1-alpha` and the
  text after the edit was left where it sat, leaving one line at 96 characters
  in a paragraph wrapping at about 75. Line breaks only; the prose is unchanged
- **The reason written beside the bounded span says what the bound forecloses
  rather than what the file carries.** The comment above the frame's hold test
  in `test/input-map.test.js` said an unbounded span "finds the same text
  somewhere below the call and passes a field that has been deleted from it",
  as present fact. It does not: `holding`, `airborne` and `engine` each occur
  once in `js/aircraft.js`, so deleting any one of them fails its assertion
  under `[\s\S]*?` exactly as it does under `[^}]*?`. The hazard is the day one
  of those texts is written a second time below the call, which is the
  conditional the entry above already used, and the comment now states it that
  way. The bound stays, and the comment is the only account a reader of the test
  finds of why it bounds its spans where the source-matching tests elsewhere in
  `test/` do not - the changelog being the record of the change rather than
  something the test carries - so the comment is what a later reader weighs
  before keeping or reverting the divergence

## [1.18.1-alpha] - 2026-09-22

The dead stick stops climbing. `1.18.0-alpha` guaranteed that a glide is always
a descent and swept the whole attitude range for it, and the guarantee held over
the settled pair while the aircraft flew every pair in between - so holding the
nose up gained height on no engine. The guarantee now covers the pairs the
aircraft is actually in, and every page that wrote it down without the qualifier
that made it true is corrected, including the `1.18.0-alpha` entry above.

### Fixed

- **A dead stick no longer gains height when the nose is held up.** From a
  settled glide at 130 kt, holding the nose up climbed 151 ft with the vertical
  speed reading positive for nine frames at up to +6520 ft/min; entered from a
  dive it climbed 2150 ft and finished 297 ft above where the dive began.
  `glideDescent` was sound and the sweep asserting it was not wrong - both
  describe the settled pair, the descent at an attitude once the airspeed is the
  one that attitude asks for. The nose moves at the control rate and the
  airspeed follows at `GLIDE_ACCEL` and `GLIDE_DECEL`, so the aircraft spends a
  second or two after every pull carrying the speed of the attitude it left at
  the angle of the one it arrived at, and that pair is not on the curve the
  sweep walks. At the 65 units a settled glide holds, any nose-up past about
  -0.19 radians came out climbing
- **The nose is now counted for no more height than the airspeed can pay for.**
  `glideDescentAt` in `js/flight-model.js` is the descent at any attitude and
  airspeed, with the attitude taken as no higher than the one that airspeed has
  settled to - and never as pointing down when the pilot has not pointed it
  down, so a speed above the level glide's is not answered with a dive nobody
  asked for. Being a floor on the attitude rather than on the descent, it bites
  only on a nose held up and can never ask for a faster sink than the level nose
  at that speed is already losing, so an engine dying at cruise does not drop
  the aircraft on the frame the tank empties. `js/aircraft.js` takes its whole
  vertical from it while the engine is dead, and from `descentRate` - the same
  sum without the floor - while the engine is live, rather than adding the
  nose's half and the wing's half in two places a bound cannot see across
- **The sweep now walks the plane rather than the curve.** The suite swept
  `glideDescent(pitch)` across the attitude range, which passed against the
  build that failed in the browser: every attitude, at the one airspeed that
  attitude settles to. It now sweeps every attitude the nose can be clamped to
  against every airspeed from a standstill to the top of the range, asserts that
  none of them climbs and that below cruise speed every one of them is losing
  height, and flies the two reported manoeuvres a frame at a time through the
  same calls the aircraft's frame makes. A settled glide is asserted unchanged
  at every attitude, so the glide the mode is flown on is still exactly the one
  `glideDescent` describes
- **Every account of that guarantee is qualified to what was true of it.**
  The `1.18.0-alpha` entry above, `docs/flight-model.html` and
  `docs/controls/game-modes.html` each said there was no attitude that holds
  height on no engine, which was true of the pure pair and false of the
  aircraft that shipped. Each now says what the settled sweep covers, what the
  aircraft does on its way to a settled attitude, and the one case in the
  vertical that does hold height - at or above cruise speed a level nose holds
  it while the speed lasts, which is the wing cancelling gravity rather than the
  glide giving way. That qualifier is narrower than it reads: the level off
  holds an altitude without going through the vertical at all, and this release
  neither closed that nor said so. The `Unreleased` section above closes it.
  `CHEATSHEET.md` and `docs/cheatsheet.html` said a nose-up gives the height
  back, and now say it spends the speed for a slower descent, which is what it
  buys
- **The Game modes API page describes the row it added and reads the right
  strip in the example under it.** The `gatePointer`, `stripPointer` and
  `searchBriefing` row read "The three that answers with", which is not a
  sentence and does not say what the three answer with; it now names them as
  the three `runPointer` dispatches to, one per objective. The route example
  logged `nextStrip(run)` after `recordLanding(run, runway)`, which names the
  wrong strip every time because a landing it accepts moves the route on before
  it returns - a two-strip route logged "down at strip 1" for the arrival at
  strip 0 and "down at strip -1" for the one that finished it. It reads the
  strip off the `runway` the handler was already given, with `stripIndex`, and
  the prose above it now says which of the two answers which question

### Changed

- **The objective card's pointer row is two lines on a narrow card, and says
  so where the row is written.** At the card's 260 pixel minimum the row has 218
  pixels to write in, which `↑ LEG 1  ·  234°  ·  8560 ft` runs past, so it
  wraps. Nothing is clipped and nothing is written off the side: `--card-pointer`
  declares the wrapped height, the suite holds the line to the 30 characters that
  height was measured at, and where the row is drawn wrapped the card is bounded
  by the room left under the readouts rather than by a sum of its rows - the
  bounds written as row sums are the short-screen ones, and each sits inside a
  media query that has already taken this row off. The wrap is
  the decision rather than an oversight - a bearing is three digits wherever it
  is read, a distance without its unit is a number, and widening the card is
  what would take it off a 320 pixel screen - and `formatRunPointer` in
  `js/hud.js` and the `#game-mode-pointer` rule now record it, because the row's
  own specification said nothing about the width it is written at

## [1.18.0-alpha] - 2026-09-21

Three modes join the two: a landing flown with no engine, a route of landings
flown against a budget, and a marker found on a bearing and set down beside. The
`1.17.2-alpha` entry's account of the ignore rules is corrected in the same
release, to claim only what that version carries.

### Added

- **`DEAD STICK`: the engine quits and the throttle is dead for the rest of the
  flight.** Four stages over open country, opening high with the strip far
  enough off that reaching it is a glide to be planned rather than a descent to
  be flown. The lever still moves and there is nothing on the end of it, so the
  airspeed comes off the attitude instead: a level nose settles at 80 units/s
  and every radian of nose-down adds 180 to that, floored at a standstill and
  capped where the engine's own top speed is. `HIGH KEY` opens comfortably
  inside a level glide with the threshold bar and the lead-in both drawn;
  `OFF THE LINE` puts the strip to one side so the turn is part of the glide;
  `ABEAM` and `BEHIND YOU` are given neither, open lower and further out, and
  want the nose held where the glide is best rather than merely pointed at the
  runway. A level glide reaches about twelve times the height it spends and a
  little nose-up reaches further, which is the thing the mode is about finding
- **A settled glide that is always a descent, and a test that sweeps for it
  rather than samples.** `glideSpeed` and `glideDescent` in `js/flight-model.js`
  are the pure pair, and the two constants behind them are chosen so that the
  nose-up angle which bleeds the speed to nothing is about 25 degrees: short of
  that the sink the slow wing is already losing outruns the climb the nose is
  asking for, and there is no attitude in the range the aircraft clamps its
  pitch to that a settled glide holds height at. That is the one way a dead
  stick could quietly stop being one, and it is not a hole anyone would find by
  flying - so the suite walks the whole attitude range in two-thousandth-radian
  steps rather than checking a handful of angles. What the pair describes is the
  glide once the airspeed has caught up with the attitude, and this version
  bounds nothing off that pair: the aircraft carrying the speed of one attitude
  at the angle of another still climbs, which `1.18.1-alpha` corrects
- **`CARGO RUN`: land at one strip, then at the next, against a budget that only
  spends while the engine is open.** Three stages over open country, each laying
  a strip per stop rather than the single strip every other mode is flown over.
  The burn is the lever setting itself, so a wide open throttle costs a second
  of budget per second, half open costs half of that, and a closed throttle
  costs nothing at all - which is what makes the route worth planning rather
  than merely flying. What is left is written where the time to beat goes on the
  one card row that is drawn every frame, because on a route that is the number
  being raced. Spend the last of it and the engine stops while the stage carries
  on, so the rest of the route is flown as a dead stick. Only the strip the
  route is up to counts, which is the rule a course of loops is already flown
  under: landing back at the strip behind you is somewhere to be rather than
  progress. `SHORT HAUL` gives two strips six thousand units apart and more
  budget than the run needs, `LONG HAUL` moves them to nine and a half thousand
  on less, and `THREE STOPS` adds a third strip in broken country on fuel for
  about two of them
- **`SEARCH AND RESCUE`: a marker found on a bearing and a distance, and set
  down beside.** Three stages over `BACK COUNTRY`, a new mode world of rough
  wooded ground with no strip anywhere in it. The briefing is the whole of what
  the pilot is given, and it is read off where the stage opens rather than off
  the aircraft - so it says the same thing however far the flight has gone and
  whichever way it has turned, and nothing swings round to the marker on the way
  in. The marker is a mast with a lit head, tall enough to stand clear of the
  trees, with a ring laid on the ground at the distance that counts as beside
  it; the ring follows the country rather than lying flat across it, so what it
  shows is the ground being landed on. The stage is flown out when the aircraft
  is on the ground, stopped, inside the ring and in one piece - rolling through
  at flying speed is a pass over it, and a wreck beside the marker is not a
  rescue. A set-down that does not say where it was made is refused rather than
  measured, because a place that is not a number is not a distance outside the
  ring either. `CLOSE IN`, `OUT A WAY` and `LONG LEG` each put the marker further
  out, off the heading the stage opens on, in rougher country, inside a tighter
  ring
- **A strip can be asked to stand clear of the strips already laid.** The runway
  element takes a `separation` in world units, and a candidate site inside
  another strip's stand-off is charged for how far inside it falls - the same
  way a site outside its height band is charged for the part of it that lies
  outside. So a world asking for three strips gets three however tight the
  ground is, rather than getting one and a failure, and the strips of a world
  now carry the number they were laid in, which is what lets a route say which
  one a landing was made on. A world that asks for no separation is laid exactly
  as it always was

### Changed

- **The card's pointer row points at whatever the run is waiting on, not only at
  a gate.** One row, one formatter, and the mode decides what goes in it: a loop
  as before, the strip a route is up to, or a search's briefing. A gate is still
  suppressed while it is in front of the aircraft, because a lit hoop on the
  screen is already pointing at itself - but a strip is not suppressed, being a
  grey mark on grey country several miles off that a pilot can be looking
  straight at without knowing it. A briefing carries no arrow at all, and is
  written without the glyph and the space that would be left behind it. The
  labels are `LEG n` and `MARKER` rather than `STRIP n` and `MARKER ON` because
  the row is measured at thirty characters and both of the longer forms ran one
  past it
- **A landing is reported with the strip it was made on.** `recordLanding` takes
  the runway as a second argument, which a route needs and every other mode
  ignores, and answers whether the landing counted rather than whether it
  finished the stage - `isStageComplete` is the question a route makes worth
  asking separately. Only a numbered strip counts: a route already flown out is
  waiting on nothing and an arrival on open ground is no strip at all, and the
  two are refused apart rather than read as one. The help on the approach is
  drawn again when a leg lands rather than only when a stage is laid out, so the
  lead-in moves to the strip being flown to instead of pointing back at the one
  behind, and comes off the ground entirely once the last strip is landed at. A landing breakdown
  now comes off the card at the takeoff rather than at the next arrival, which
  on a route is a long way further on

### Fixed

- **The second `1.17.2-alpha` bullet is headed as a rule the project applies,
  and the release carries no file that would apply it.** Its heading, "`.tmp/`
  is ignored by the project rather than by one machine", reads as a rule that
  travels with the repository, and the same paragraph takes it back four
  sentences later - "which is every clone, the file being untracked". What that
  release actually contains is the rule written into this repository's own
  `.gitignore`, beside `test-results/` and `user-scripts/`, in a file that is
  itself untracked and so reaches no clone: `git ls-files .gitignore` comes back
  empty, and `git check-ignore -v .gitignore` answers with a personal global
  ignore file rather than with anything the repository owns. The entry's closing
  sentence, that this is "the half of this the repository cannot close on its
  own", was wrong rather than overstated. Force-adding the file is a call left
  to the user rather than one a run takes, because what excludes it is the
  user's own global configuration rather than a limit on this repository -
  `.nojekyll` is tracked here under the same global `.*` rule that hides
  `.gitignore`, so a dotfile in this repository can be force-added and one
  already has been. `TODO.md` put it that way from the start, and only the
  changelog put it as an impossibility. Nothing about the rule itself has
  changed, and the tagged `1.17.2-alpha` entry is left exactly as it shipped,
  being the record of that release rather than a claim about the code as it
  stands

## [1.17.2-alpha] - 2026-09-19

The two comments nearest the level off binding say what the level off does, and
the tester's scratch folder is kept out of the repository by the repository.

### Fixed

- **The comments around the `Space` binding describe the nose easing to level.**
  `1.17.1-alpha` changed the level off to settle the attitude as well as the
  climb, and five documents were rewritten to say so, but the two comments
  closest to the binding still described the behaviour it replaced.
  `js/input-map.js` told a reader that `Space` is an instruction to trim the
  climb out and leave the nose exactly where the pilot put it, and the doc
  comment over `test('space levels the flight off')` in `test/input-map.test.js`
  said it leaves the nose where the pilot put it. Both were the file a reader
  opens to find what `Space` is bound to, and both stated the opposite of what
  the code does. Each now describes the ease and names `LEVEL_OFF_SECONDS`
  rather than writing the interval out as a number, so neither can go stale the
  next time that interval changes, and each keeps the job it was there for: the
  binding comment still explains why the key sits beside reset rather than among
  the control surfaces, and the test comment still explains what one press saves
  the pilot. The `1.17.0-alpha` entry below carries the same sentence and is
  left exactly as it is, being the record of what that version shipped rather
  than a claim about the code as it stands. `test/input-map.test.js` now reads
  both comments as text and asks that each name the constant, a comment being
  the one part of a module no test was reading
- **`.tmp/` is ignored by the project rather than by one machine.** The UI/UX
  tester writes its screenshots, logs and scratch modules under `.tmp/ui-ux/`,
  and `git check-ignore -v` answered with a personal global ignore file rather
  than with anything in the repository. On a clone without that global rule -
  another machine, or CI - the folder is untracked and visible, and a
  `git add -A` sweeps every one of those files into the repository. `.tmp/` now
  sits in `.gitignore` beside `test-results/` and `user-scripts/`, under the
  comment already describing that output as a record of one run on one machine
  rather than anything the project ships, and `git check-ignore -v .tmp/`
  answers from `.gitignore` itself. All three folders are pinned in
  `test/site.test.js`, beside the checks on the deploy workflow, and that check
  stands down on a tree with no `.gitignore` in it - which is every clone, the
  file being untracked. That is the half of this the repository cannot close on
  its own, and it is queued as a found issue rather than left implied here

## [1.17.1-alpha] - 2026-09-17

The level off brings the nose with it, so the instrument and the horizon stop
disagreeing about whether the aircraft is still climbing.

### Fixed

- **Levelling off settles the attitude as well as the climb.** `Space` set the
  vertical speed to zero and deliberately left the nose alone, which is what the
  item asked for and what shipped - but levelling off is something a pilot
  watches happen, and half of what they watch is the attitude. The dial read
  `0 ft/min` over a horizon still tilted and an artificial horizon still showing
  a climb, so the aircraft read as going up at the moment the instrument said it
  was not. The nose now eases from wherever the pilot left it down to level over
  **0.6 seconds**, on a curve that leaves the old attitude gently and arrives at
  level gently, so the movement reads as the aeroplane settling rather than as a
  jump. The altitude is held from the frame the key goes down and the attitude
  arrives a moment later, which is the order a pilot flies it in: the climb
  stops, and the aeroplane settles. At rest all three agree - `V/S` at zero,
  pitch at a flat level, and the artificial horizon centred. The interval is
  `LEVEL_OFF_SECONDS` in `js/flight-model.js`, beside the pure `levelOffProgress`
  and `pitchLevellingOff` the ease is worked out by, and it is the only copy of
  it: the artificial horizon reads the model's own pitch, so easing that pitch
  is the whole of what carries the horizon down with the nose. Nothing eases a
  second copy, which is how the two would come to disagree by a frame. Roll is
  left alone - a wing-level is a decision of its own, and rolling the aircraft
  on a keypress nobody pressed for it would be a surprise rather than a
  convenience. A call for a different vertical state hands both halves back at
  once, so a pilot who takes the pitch back part way through is flying it
  themselves from that frame

## [1.17.0-alpha] - 2026-09-16

A level off on the stick, an orbit sweep a pilot sets, and five things the
simulator was doing that nobody asked it to do.

### Added

- **`Space` levels the flight off.** Holding an altitude meant trimming the
  vertical speed to zero by hand, a nudge of the nose at a time, which is a
  fiddle in the middle of everything else an approach is asking for. One press
  now puts the vertical speed on zero and leaves the nose exactly where the
  pilot put it, and the aircraft keeps the altitude it was at. The hold lasts
  until the pilot calls for a different vertical state - a pitch or a throttle
  input - so a turn does not end it, which is the whole point of holding an
  altitude through one. It is bound in `js/input-map.js` beside reset rather
  than among the control surfaces, because it is an instruction rather than a
  surface held while a key is down, and because `Space` is also the key a menu
  is chosen with: a surface a menu key could write to is a surface waiting for
  the one path that forgets to take the key first
- **`ORBIT SWEEP` in the settings panel.** The rate the orbit camera circles at
  was a constant in the camera code, and it swept fast enough that the ground
  it was showing went past faster than it could be read. The default is half
  what it was - 12 degrees a second, half a minute the whole way round, against
  the 23 it used to be - and the rate is a setting beside the other camera
  options rather than a second number written into the source, offered from
  `6°/S` to `36°/S` and remembered with the rest of them

### Fixed

- **`LOW ALTITUDE` no longer warns before the flight has started.** An aircraft
  held on the strip is as low as the warning ever gets, so the first thing a
  pilot saw was a warning about the state the simulator had just put them in:
  true, and useless. The warning speaks about an altitude the pilot flew to
  now, gated on the flight having left the ground. Takeoff is the condition
  rather than a timer, so a flight that never leaves the runway never raises it
  however long it sits there, and a host flying an aircraft that does not report
  being airborne keeps the warning it always had
- **A run off the end of the runway ends the attempt.** A takeoff that went past
  the end of the strip kept going over the environment as though it were
  taxiing, so a failed takeoff had no outcome at all and the flight continued in
  a state nothing had rules for. Leaving the runway surface while still on the
  ground is a crash now, recorded through the same path any other arrival on
  ground the aircraft cannot use takes. The rule is bound to the runway rather
  than to a distance from where the run began, so an overrun off either end and
  a swerve off either side are the same event, and a flight that never had a
  strip under it is never leaving one
- **Nothing the element editor can move reaches the runway.** The strip is cut
  last, over whatever else claimed the ground, and levelling is enough for
  everything drawn as a height - but the water is read back off the finished
  field afterwards, as the vertices lying under its own line, so a strip graded
  at or below that line came back out as water and a flight started from the
  bottom of a lake. Raising the water level in the editor did it in three of the
  five worlds. A strip sited on ground the water settled on is lifted clear of
  the line now, and the element it was moved clear of is named on its own row in
  the panel, because a range that reads as applied and is not is worse than one
  that was refused out loud
- **Clicking left of a value no longer raises it.** A row holding a value is
  drawn with a mark either side of its reading, so it reads as a control with a
  down at one end and an up at the other - and every control of that shape reads
  left as down. A click stepped the value up wherever it landed, which did the
  opposite of what the row looked like on half of every press, in the settings
  panel and the element editor at once. The fix is at the menu the two panels
  share rather than in either of them, since both were wrong in the same
  direction and for the same reason
- **The card's rows are bounded at the heights they actually draw at.** The
  bounds are sums of the row heights declared on `#game-mode`, and each of those
  was one line of that row's type. At the card's 260 pixel minimum a row has 218
  pixels to be written across, and four of the five rows run past it and wrap -
  so on `FLYING THROUGH LOOPS` the bound landed part way down a wrapped row and
  cut it through its own glyphs, which is the same fault the rows were
  introduced to close arriving by a different route. `FLY THROUGH EVERY LOOP`
  lost 22 of its 32 pixels on 320x460, in ordinary flight, with no landing or
  gate involved.

  The rows that wrap declare the height they wrap to, at the widths they wrap
  at, from what a browser laid them out at; the ladder that takes rows off a
  card with no room for them steps where the wrapped heights say it has to; and
  `test/page.test.js` holds every line the card can be asked for - every mode,
  every stage, every gate, the miss notice, the stage report, the clock and the
  pointer - to the lengths those heights were measured against, so a mode with a
  longer name fails a check rather than slicing a row. The miss notice lost
  `AGAIN`, which put it inside the two lines the row it is written in declares

## [1.16.3-alpha] - 2026-09-15

The objective card's bound measured against the rows it is actually holding,
and the trade it is paid for with scoped to the screens that take it.

### Fixed

- **The card stops between its rows rather than part way down one.** The bound
  was a count of pixels taken off the screen and the card's rows are whatever
  height the type comes to, so the two did not line up. On 320x460 - the
  shortest screen a browser leaves - the clip landed seven pixels into
  `FINAL  ·  STAGE 1 OF 4` and cut the bottom five off it square; with a
  landing read off the card the same happened to `DOWN THE STRIP`, four pixels
  cut. Clipping there is right and intended, because there are 108 pixels
  between the chart and the pads and the card and the readouts both want them,
  but clipping between rows and clipping through one are not the same thing and
  a half-drawn line reads as a rendering fault.

  The card declares its own row heights now, and the bounds are written in
  those rows rather than in a count off the screen, so a type size changed once
  moves every bound that counts that row. The rows there is no room to draw
  whole come off instead, the way the readouts already drop `THROTTLE` and
  `CAMERA`: in flight the stage and the clock, and with a breakdown up the four
  measurements under the score. Tightening the count alone would not have done
  it - the card's bottom padding is not space the row under it respects, so a
  bound landing on a row boundary still slices the row after it
- **The readouts stand down only where the card is bounded against them.** The
  rule that hides them for the length of a breakdown was written outside every
  media query, so it fired wherever the pads were out, while the bound it is
  paid for is given on three bands of screen and nowhere else. On a tablet
  flown from the glass at 1024x768 the card sits at x 382..642 and the readouts
  at x 20..228, so the two never meet - and the whole stack, `AIRSPEED` through
  `CAMERA`, went invisible for as long as a breakdown was up and came back with
  nothing gained. It is scoped to the widths the card is bounded under the
  stack at, and to the short wide screen where the two share the lane
- **The card is bounded on every screen it is drawn on.** Past 679 pixels of
  width, on a screen tall enough to keep the readouts in their own corner, it
  carried no `max-height` and no `overflow` at all, so the bound the last
  release describes as everywhere was not. It is bounded to the 20 pixel inset
  it is held at there, which is the one thing above it on a screen that wide. A
  screen short enough to put the readouts in the middle lane was already
  bounded to that lane at every width

### Changed

- **The gate pointer is raised off a mark on the card rather than a style
  written onto the row.** The pointer is the last line written on a card that
  clips from the bottom, so it is the first row the clip reaches - and a
  display written inline by the run is one no rule can reach, which left the
  row to be sliced rather than taken off. It is marked the way the landing
  breakdown is now, and on a narrow screen with less than five rows of room for
  the card it comes off: the chart in the corner is drawing the same gate,
  held hollow at its own edge for one past the ground shown

### Testing

- **The two arrangements no screen measured are measured.** `MEASURED_SCREENS`
  was 393x852, 320x568, 393x578, 320x460, 852x330 and 568x320, every one of
  which resolves through `(max-width: 640px)` or `(max-height: 540px) and
  (min-width: 500px)`. The band between 641 and 679 pixels of width was read by
  no check at all, and neither was the screen past it. 660x720 and 1024x768 are
  driven with the other six now
- **Three checks on the card's bound.** That every row it still carries is
  drawn whole or not at all, at both readings and every measured screen; that
  the readouts stand down on exactly the screens the card takes their band on;
  and that the card declares where it stops wherever the pads are out, since an
  overlay with no declared height reads as clear of everything by being
  unmeasurable

## [1.16.2-alpha] - 2026-09-14

The objective card and the floated readouts placed against each other rather
than each against the pads, which is the check neither of the releases that
moved them made.

### Fixed

- **The objective card is not drawn over the floated readouts.** The release
  that lifted the card clear of the pads and the one before it that dropped the
  readouts below the two instruments each placed one overlay well and neither
  placed it against the other, so on a phone the two ended up in one column.
  `#game-mode` is opaque at `z-index: 120` against `#hud`'s `100`, so where they
  met it was the card that read correctly and the readouts that were lost: on an
  852x330 screen - a phone held sideways in a browser with a toolbar - three
  seconds into an ordinary flight, with nothing on the card but the stage and
  the clock, `AIRSPEED`, `ALTITUDE` and `HEADING` were behind it for the whole
  flight. Every size but a tall phone lost readouts with the card at its
  shortest, and the landing breakdown made it worse rather than causing it.

  The card is placed against the readouts now, at every size a phone comes in.
  On a short wide screen it leaves the bottom middle, which is the band the
  readouts were given, for the top of that same lane: hung at 62 under the muted
  notice, narrowed to the lane so the ladder is off one end of it and the chart
  off the other, and stopping where the band begins. Everywhere else it keeps
  the corner it had and is bounded to the room under the stack rather than to
  the top of the screen, clipping from the bottom, which is the order its lines
  are written in. A narrow screen compacts the readouts from 657 pixels of
  height rather than 541, because a narrow screen has the card under them as
  well as the pads under both
- **The card is not drawn over the left edge of the chart on a phone held
  sideways.** The card is 260 across and centred, and on a 568x320 screen the
  lift put it at x 134..434 against a chart starting at 408. Narrowed to the
  lane the readouts use, it ends at 396 and the chart is clear of it

### Changed

- **The readouts stand down while a landing is being read off the card.**
  Bounded to the room the readouts leave, the card holds the four lines it
  carries in flight and not a landing breakdown, which is five lines more - so
  the breakdown clipped away on every screen it was most wanted on. The
  readouts give way for as long as it is up and the card takes the column,
  which is the trade the `LANDED` banner already makes and the same reason for
  it: an aircraft stopped on the strip reads zero knots, zero feet a minute and
  the strip's own elevation, so of the two wanting that column it is the stack
  with nothing to say. `js/hud.js` marks the card off the same reading the
  banner steps aside for, so a screen cleared with `Tab` brings the readouts
  back with the card. The whole breakdown is readable at 393x852, 320x568,
  393x578, 852x330 and 568x320; at 320x460, where there are 108 pixels between
  the chart and the pads, the score line reads and the four rows under it clip
- **The cheatsheet and the controls page name the height a narrow screen
  compacts the readouts at.** Both said 541, which is where a wide screen
  compacts them; on one 640 pixels or narrower it is 657, because the card is
  under the readouts there as well as the pads under both. A phone in portrait
  at 320x568 sits between the two, so `THROTTLE` and `CAMERA` come off a screen
  both pages said was still carrying them

### Added

- **A check that the card and the readouts are never given the same band of
  the screen**, at the six sizes the collision was driven at. Every other
  layout check in `test/page.test.js` measures one overlay against the pads;
  this one resolves both out of the stylesheet for a given viewport - the rules
  written for every screen, then every media block that matches, in source
  order - and asks whether the two bands intersect. The blocks are cut out of
  the page with its comments off and taken back out of it the same way, so a
  block carrying a comment is not left reading as a rule written for every
  screen whatever the size being asked about

## [1.16.1-alpha] - 2026-09-13

The stick wired the way everything written about it says, and the controls a
phone is flown with fitted to the screen a phone actually gives.

### Fixed

- **The pitch keys carry the nose the way the controls say they do.** `W`, the
  pad labelled `PITCH +` and a device tilted back all reach the aircraft
  through `pitchUp`, and `pitchUp` raised `rotation.x` - which `pitchForClimb`
  in `js/flight-model.js` states in its own comment is the direction that
  carries the nose *down*, the model being built nose-first along `+Z`. Held
  from a steady cruise, `W` took the altimeter from 1073 to 860 ft in 1.2
  seconds with the vertical speed reading -20950 ft/min. The attitude ladder
  agreed with the world throughout, so what was inverted was the binding rather
  than the instrument, and the documentation and the pad label both claimed the
  direction the binding was not flying. The two cases in `js/aircraft.js` are
  swapped; the tilt mapping needs nothing, because a device tilted back asks
  for `pitchUp` and `pitchUp` now means what it is called
- **Both clusters of pads are drawn inside the narrowest phone.**
  `#touch-controls` is a flex row with `justify-content: space-between`, and at
  48 pixel cells the two clusters and the padding either side of them wanted
  344 pixels against the 320 a phone gives at its narrowest. `space-between`
  has no space to distribute below that: it packs from the left and the
  right-hand cluster runs off the end, so eight pixels of `YAW R` were outside
  the viewport. A cell is 44 pixels now with a 4 pixel gap - the pair comes to
  312 and leaves 8 between them - and 44 is a floor rather than a number to go
  on shrinking, being the smallest a control found by a thumb should be. The
  band the pads take is 156 deep with it rather than 172, so the stacked
  readouts clear them from 541 pixels of height rather than 557, and the
  objective card is lifted 172 rather than 188
- **The muted notice is out of the pad band on a phone held sideways.**
  `#audio-muted.floated` was placed once, 140 pixels down the left edge, and is
  22 tall - so it ran into the band on every screen a phone gives sideways and
  `PITCH +` painted over it at z-index 130 against its 100. The readouts leave
  that edge for the bottom band on a screen this short, which frees the whole
  top of it, so the notice goes up beside the attitude indicator rather than
  staying under it
- **The `LANDED` banner comes off as the landing breakdown goes up.** The two
  were on screen for exactly the same moment - the banner shows while the
  ground outcome reads `LANDED`, and the breakdown goes up when the rollout
  ends, which is inside that - and the banner is centred at z-index 150 against
  the card's 120, so it painted over the card. On a 320x568 screen the card
  lifted clear of the pads landed under the banner instead and lost seven of
  its lines, `LANDING  ·  <score>` among them. They were also saying the same
  thing about the same event: the card's first line names the landing and reads
  the score off it, on the strip the aircraft is stopped on, which is the
  banner's whole content and four lines more. So the banner is what gives way,
  rather than the two being placed around each other on a screen with room for
  neither - and only for as long as the card is on the screen to give way to.
  `Tab` clears the card off with the instruments while the flight goes on being
  flown, and a cleared screen is not a frozen one, so a landing rolled to a
  stop with the instruments off would otherwise have had the banner stepping
  aside for a card that was not there and nothing at all saying the aircraft
  was down
- **The API's tiled-world example names the compass this release settled on.**
  `docs/api.md` called the tile at `x: -0.5` west and the one at `x: 0.5` east,
  which is the mirror of the frame `js/units.js`, `js/minimap.js` and the
  instruments page now share - so two pages of the same site contradicted each
  other on which way the x axis runs, and a host building an assembly from the
  example ended up with every compass name in it reversed. The two are swapped,
  the reference page regenerated, and a paragraph under the example says which
  way the frame runs and where it is written down. `test/environment-tiles.test.js`
  names its pairs the same way round
- **`directionToBearing` describes itself accurately.** It was documented as
  coming back "in whole degrees from 0 to 359", which is the phrasing of
  `headingDegrees` thirty lines above it - but only that one rounds, and every
  caller happened to cover for the difference by rounding what it drew. The
  same sentence credited a guard against `Math.atan2` of two zeros being a NaN.
  It is `0`, and the wrap on the line below is what leaves a direction of
  nothing at all reading as north. A bearing between two places is a
  measurement rather than a reading off a dial, so the return stays fractional
  and the docstring says so

### Removed

- `colorAt` in `test/runway.test.js`, a sampling helper whose only caller was
  rewritten to read every vertex through `paintBands` and `colorOf`

## [1.16.0-alpha] - 2026-09-12

One compass for the whole simulator, and the two overlays a phone was reading
from behind a thumb.

### Fixed

- **A bearing now points the way an aircraft on it flies.** There were two
  compass frames in the world and they were mirror images in x. An aircraft on
  heading `H` carries `yaw = headingToYaw(H)` and travels `(-sin H, cos H)`,
  because a model built nose-first along `+Z` in a right-handed world with `+Y`
  up carries its right wing on `-X` - so east is `-X`. `bearingDirection` in
  `js/game-modes.js` and `runwayDirection` in `js/environment/elements.js` both
  returned `(+sin H, cos H)` instead, and `approachOpening` used the first to
  place the aircraft and the second's frame to point it. `RUNWAY LANDING`'s
  `FINAL` stage sets `approach.heading: 0`, which is the stage saying it opens
  aimed at the strip, and it opened ten degrees off it: held, the card's
  `HEADING: 005` carried the aircraft past the side of the runway onto open
  country. The frame now lives once, in `js/units.js` beside `headingToYaw`, as
  `bearingToDirection` and its reverse `directionToBearing`; both modules take
  it from there rather than writing the sign out again
- **A landing is scored against the strip it was flown down.** The same
  mismatch reached the mark for how square a touchdown was. `scoreLanding`
  compares the aircraft's heading against a runway's own `heading` field, and
  that field was in the mirrored frame, so a landing that physically crossed
  the strip at `9.9` degrees was reported as `4`. The card was self-consistent
  and wrong: the number matched the game's own arithmetic, and the two numbers
  were not the same angle
- **The gate pointer, the approach marks and the chart follow the same
  compass.** `gateBearing` and the opening of a loop course each wrote the
  mirrored frame out for themselves and now read it off `directionToBearing`.
  The threshold bar and the extended centreline are turned by `headingToYaw`
  rather than by the bearing in radians, which is its mirror and put them on
  the wrong diagonal of every strip not laid north to south. The chart runs the
  world's x axis right to left, so that a marker turned by the compass heading
  points along the track it is leaving - it pointed at the mirror of it before
- **The landing breakdown is read off the screen rather than from behind a
  thumb.** The objective card is centred at the bottom and the pads are not, so
  it cleared them for as long as it only carried an instruction: its rows are
  narrow enough to pass between the two clusters. The breakdown is wider and
  lower, and `#touch-controls` paints over the card at z-index 130 against its
  120, so on a 393 pixel phone every one of the five rows ran 44 to 83 pixels
  into a cluster at each end. The card is lifted the depth of the pad band and
  a gap where the two meet, bounded to the room above that band so a short
  screen clips the last line of the breakdown rather than drawing the name of
  the stage off the top, and drawn opaque because lifted it lands over the
  readouts it already paints over
- **The floated readouts stop before the pads start.** Dropped to 180 pixels to
  clear the ladder and the chart, the six rows ran to 384.75 and the pads take
  the bottom 172, so the two are clear of each other only from 557 pixels of
  height up. A phone held sideways - which `js/tilt-controls.js` calls the
  ordinary way this is flown - gives 393 at most and about 330 with a browser
  toolbar, and at 330 the whole block sat inside the pad band with `THROTTLE`
  and `CAMERA` off the bottom edge. Below 557 the block is compact and drops
  those two, which are the readouts a pilot is not flying on; below that and
  wide with it, which is a phone held sideways, it moves into the band between
  the two pad clusters, the one part of a short screen nothing else claims. The
  height is declared rather than left to the rows, so a test can say where it
  ends - the content's own height was nowhere in the stylesheet

### Changed

- **A seed lays a different runway than it did.** Turning `runwayDirection`
  into the aircraft's frame mirrors the bearing a strip is laid on, so the site
  search scores different candidates and settles on a different one. A strip is
  symmetric about its own axis, so this is a different strip in the same world
  rather than a broken one, but `RUNWAY LANDING` is flown over new ground:
  its first stage now opens on a strip at `-3844, 2202` on `170.58` where it
  was on `5165, -7469` before

## [1.15.0-alpha] - 2026-09-11

The landing the card was never told about, a sensor that says nothing read as a
device held level, and three instruments given the top of a phone between them.

### Fixed

- **The card is handed the strip a landing was made on.** `js/aircraft.js`
  reports a touchdown with the strip it happened on and the arrival itself -
  where on the strip, how hard, how square - which is everything a landing can
  be scored from. `js/main.js` registered a zero-argument arrow for it, so both
  were dropped on the way in: `onLanding` ran with `undefined` twice,
  `scoreLanding` returned null for want of a strip, and `setLandingReport(null)`
  wrote nothing and left `#game-mode-report` hidden. A landing flown onto the
  first stage's strip in a browser touched down on the centreline, was judged
  `LANDED`, rolled to a stop, and the breakdown it was all measured for never
  appeared. The handler now names the two it is given and hands them on. Every
  other part of the feature was already right, which is why nothing showed:
  the five rows, the score line, the hold through the rollout and the ten
  second limit had all been exercised in isolation, and the suite passed with
  the breakdown never once reaching the screen
- **A seam the suite could not import is read from the source instead.** Both
  files load `three`, so no test could hold the two ends of that call together,
  and a callback that quietly took nothing was worth 893 green tests.
  `test/landing-score.test.js` now reads `js/aircraft.js` and `js/main.js` as
  text the way `test/world-tiles.test.js` reads the camera out of `js/main.js`,
  and checks the three joints in turn: that the flight model still reports two
  things, that the handler registered takes two and hands on the two it took,
  and that the breakdown is written from those rather than from nothing
- **A sensor that reports nothing is no longer read as a device held level.** A
  browser with no gyroscope still fires one `deviceorientation` event, with
  `alpha`, `beta` and `gamma` all null - the specification's way of saying it
  has nothing to report. `TiltSensor.onReading` coerced that to
  `{pitch: 0, roll: 0}`, which is a device being held perfectly level: tilt went
  to flying, and `PITCH +`, `PITCH -`, `ROLL L` and `ROLL R` came off the glass
  of a machine that has no keys to fall back on, leaving an aircraft that could
  not be pitched or rolled at all. `applyTiltReading` now refuses a reading with
  no numbers in it and returns null, so `state.reading` stays null, `tiltFlying`
  stays false, and the pads stay where they are until a real orientation
  arrives. One axis reported and the other not is still a reading, with the
  silent axis taken as the neutral - a sensor that only knows roll can still fly
  the wings. The decision is made in the pure module rather than in the
  listener, so it is tested in Node beside the rest of it
- **The floated instruments are given the top of the screen between them.** With
  the pads out, the attitude indicator was floated to the top centre, where the
  readouts already ran: on a 393 pixel phone it covered the right-hand end of
  the airspeed, the altitude, the vertical speed and the heading at once, and
  clipped the chart in the other corner besides. Three instruments do not fit
  across the top of a phone, so they are stacked instead: the ladder takes the
  left corner, the chart keeps the right one it already had, and the readouts
  drop below both. Pinning the two instruments to opposite edges is what keeps
  them apart at a width nobody chose - they meet only on a screen narrower than
  290 pixels - and the muted notice goes into the band the readouts left behind,
  on the same left edge. Measured clear at 320, 360, 393 and 412 pixels, with
  the notice showing

## [1.14.0-alpha] - 2026-09-10

A gate is an attitude to match rather than a place to be, a landing is four
measurements rather than a count, and a machine with no keys has controls of its
own.

### Added

- **Gates are laid over, and closed up one way across as they are.** A course
  used to be round hoops, upright, and the whole of flying one was getting to
  it: a circle is the same circle at every angle, so there was never anything to
  line up on. Every stage past the first now lays its gates off the horizontal
  by an amount of its own, either way, and narrows them along their own vertical
  as it does - which is what makes the bank something to fly rather than
  something to look at. `gateAxes` reads the span and the rise a crossing is
  measured on off the gate's bearing and its bank, `gateCrossing` puts the
  crossing to the opening those two describe rather than to a radius, and
  `js/rings.js` draws the hoop about the same two axes, so the opening on the
  screen and the opening the rules test are one opening. A gate that names no
  shape is the round one a course was always flown through, which is what leaves
  the first stage exactly as it was and every gate written by hand in the suite
  reading as it always did
- **A landing is scored rather than counted.** `js/landing-score.js` takes the
  reading the touchdown was judged from and says what the approach came to: how
  far down the strip from the threshold it touched, how far off the centreline,
  the rate it came down at, and how far off the strip the nose was. Each is
  marked against its own limit - the aim is a fifth of the strip past the
  threshold and a third of its length either side of that is worth nothing, the
  centreline against the half width, the sink against the landing limit, the
  heading against the 25 degrees a landing is allowed - and the four averaged out
  of a hundred are the score. A touchdown short of the threshold reads negative,
  which is an undershoot and reads as one. The threshold it is all measured from
  is whichever end the aircraft came over, so a strip flown in either direction
  is scored the same way
- **The breakdown is held until the aircraft has stopped.** The stage's clock
  still stops at the touchdown - the time is the one the approach was flown in -
  but the card waits out the rollout before saying anything, so what the pilot
  reads it against is the strip they are sitting on rather than the one going
  past the window. A pilot who lands and leaves the throttle open is waited on
  for ten seconds and then told anyway, because a stage that waited forever
  would be a stage with no end. `#game-mode-report` is where it goes: five lines
  ruled off under the rest of the card, on whichever scale the altimeter is set
  to
- **Approach guidance, withdrawn as the stages go on.** The first landing stage
  is given a bar across the threshold and an extended centreline running 3200
  units back down the approach in eight marks; the second keeps the bar and
  loses the line; by the last there is neither and the strip is where the pilot
  works out it is. Which of the two a stage gets is declared on the stage rather
  than worked out from its number. `approachGuidance` is the pure geometry and
  `js/guidance.js` draws it, the same division `js/rings.js` keeps with the
  course, and each mark stands clear of the ground under it rather than at the
  runway's own elevation - the lead-in leaves the graded strip after a mark or
  two, and one laid at the strip's height would bury itself in the first rise
- **`approachThreshold`**, which is what stops those two pointing at opposite
  ends of the same runway. A strip has two thresholds and is landed on in either
  direction, so which one is "the" threshold is a decision rather than a
  reading; the approach is opened off it and the guidance is drawn from it, and
  it is now made once for both
- **On-screen controls, for a machine with no keys to fly with.**
  `js/touch-controls.js` is the layout of two crosses of pads - attitude under
  the left thumb, power under the right - and the rule for whether a machine
  wants them. There is no way to ask a browser whether a keyboard is attached,
  so what is asked is whether the machine takes touches and has no pointer that
  can hover: a laptop with a touchscreen has a trackpad, and a trackpad means
  there are keys beside it. The pads write the same input state the keyboard
  does, which is what lets the flight model stay ignorant of where a control
  came from. The pointer is captured on the way down, so a thumb that slides off
  a pad still lets the control go when it lifts. Only pads actually coming off
  the glass let go of what they were holding: the overlays are synced on every
  photo, every resize, and every press of the HUD and control-list keys, and a
  set of pads that was never drawn letting go each time would take the control
  off a key still being held with it
- **Flying by tilting the device.** `js/tilt-controls.js` turns the orientation
  sensors into the same controls again, and it is what those machines open in -
  a machine with keys is flown with them and is never offered it. Whatever angle
  the device is being held at when a flight starts is level for that flight, and
  a reset levels it again; seven degrees either side of that is a hand rather
  than a control input. The screen's own angle turns the device's frame into the
  pilot's, because a flight simulator on a phone is held sideways every time.
  The four pads tilt takes over come off the glass rather than fighting it, and
  they stay on it until a reading actually arrives - a browser can refuse the
  sensor outright, and a device with no gyroscope answers the ask and then never
  says anything, and pads taken off for a tilt that never came would be an
  aircraft with no controls at all

### Changed

- **`onLanding` is handed the arrival as well as the strip.** It has always been
  called with the runway landed on, and it still is; the contact reading the
  touchdown rules were applied to now follows it. `contactAt` carries the place
  and the bearing along with the manner, on the one reading rather than on a
  second, because a landing is scored on where down the strip it happened as
  much as on how, and the place and the manner are the same moment. A host
  reading only the first argument sees no change
- **The pads take the bottom corners, so two overlays move out of them.** The
  attitude indicator goes to the top of the screen while they are out rather
  than coming off it - it is the instrument a pilot flying on a small screen
  most wants - and the muted notice goes with it. The on-screen control list
  comes off entirely, naming as it does keys the device does not have, though
  the start screen's `CONTROLS` entry still shows it: there are no pads out yet

## [1.13.3-alpha] - 2026-09-09

The reverse check on the document is held to the tables it says it reads.

### Fixed

- **The reverse check guarded its count rather than its read.**
  `documentedNames` in `test/docs.test.js` scrapes `docs/api.md` two ways - the
  leading code spans of every export table's rows, and the names taken off
  `from 'pilot-matter'` - and the check then guarded itself with
  `assert.ok(documented.length > 20)`. The fifteen import lines carry 25 unique
  names between them, so that guard was met on the imports alone. The table
  half matched a header row of exactly `| Export | Is |` followed by a
  separator row, so a second column renamed, a separator rewritten, or the file
  saved with CRLF endings dropped all nine export tables out of the scrape
  while `documented` stayed at 25, still over 20, and the suite stayed green
  with nothing checking a table at all - the same silent pass the check was
  written to close, one level up from it. The tables are now read by
  `exportTables` and their count held against `exportTableCount`, which
  recognizes a header row by its leading `Export` cell and nothing else, so the
  loose count keeps standing where the strict pattern gives way. Each of those
  three ways of breaking the scrape now fails the suite by name instead of
  leaving it, and the name assertions underneath are unchanged

## [1.13.2-alpha] - 2026-09-08

The record a terrain keeps of the world it built is a module of its own, and the
document is read against the entry point in both directions rather than one.

### Added

- **`js/world-record.js`**, the record a terrain keeps of the world it built:
  the copy taken of an ask, and the comparison that decides whether the ground
  already on screen is the ground being asked for. Both used to sit inside
  `js/terrain.js`, which reaches for Three.js and so cannot be imported by the
  suite - and the project carries no dependencies to import it from, so nothing
  reached them at all. Backing the copy out of the class gave 807 tests, 807
  pass, and ground that was never drawn again: the half of the redraw fix that
  lives outside the element editor had no cover of any kind. The module is pure
  in the shape `js/world-tiles.js` is, and `setEnvironment` calls it
- **`test/world-record.test.js`**, fifteen cases over that seam. What counts as
  the same world - the preset, the seed, the strip and the configuration it was
  laid to, an element moved - and then the copy itself, which is the case the
  redraw fix turns on: a set of placements handed over, kept a reference to, and
  edited by its caller reads back as a changed world rather than as the same
  one. Five of the fifteen fail against a record that holds the ask instead of a
  copy of it. The last two read `js/terrain.js` rather than import it, the way
  `test/world-tiles.test.js` reads the camera out of `js/main.js`, because a
  module the terrain stopped calling would pass every case above them
- **The document's own claims are checked against the published surface.**
  `test/docs.test.js` asserted every name `js/api/index.js` publishes is named
  in `docs/api.md` and nothing asserted the other way, so a name the document
  presented as an export of `pilot-matter` that the entry point did not
  re-export passed the whole suite - which is exactly what `flyStep` and
  `gateMissed` did last version, in an export table and in an import line a
  host would copy, for `SyntaxError: The requested module does not provide an
  export named 'flyStep'`. The reverse check reads the names out of the export
  tables' leading code spans and out of the `from 'pilot-matter'` imports and
  holds each one to the entry point. It names nothing today, which is the point:
  the gap is closed rather than the symptom

### Fixed

- **`setEnvironment` copied the placements and called it the ask.** The record
  was `{ ...asked, elements: <clone> }` while the comment above it said the
  world was recorded as a copy of the ask rather than as the ask itself. `base`
  and `runway` stayed references into the caller's object, and both are
  compared, so a caller that went on editing its own `base` would have hit the
  same self-comparison the elements copy was added to close: a world never seen
  to change, and ground never drawn again. Nothing reached it, because every
  `base` that gets to `setEnvironment` today is a static stage or preset that
  nothing mutates - it was the comment claiming cover the code did not have.
  `recordWorld` clones the whole of an ask, every field of which is JSON-shaped
  data, so no field is left as a reference for a later one to be caught out by

## [1.13.1-alpha] - 2026-09-07

The element editor draws the ground it was already editing, and a stage of a
course can be flown out from a case, so the one line a pilot reads at the end of
a stage is held by the suite rather than by nobody.

### Added

- **`flyStep(state, course, from, to)`**, which is the whole of what a step of
  flight does to a course, in one call. `js/main.js` used to hold half that rule
  and `js/game-modes.js` the other: the frame asked `gatePassed` and
  `gateMissed` itself, chose between `recordGate` and `recordMiss` on the
  answer, and read whether the stage was out of the return value. That put the
  mode's only end-of-stage path inside the one module the suite cannot import -
  `js/main.js` reaches for Three.js and for the document - and a 240 unit hoop
  2600 units down its own axis is not something a case can reach by tapping the
  flight keys: the aircraft opens lined up and climbs away at full throttle, and
  there was no other way in. The seam takes the two ends of a step and reports
  the gate it was put to, whether the step went through that gate or past it,
  and whether going through it was the last gate the stage was waiting on;
  `trackCourse` is the screen's answer to that record and nothing more
- **`stageReport(result)`** in `js/best-times.js` - the line a finished stage
  is reported on, `NEW BEST  ·  0:12.0` against `STAGE TIME  ·  0:12.0`,
  written from the record `recordStageTime` hands back rather than from the
  clock, so the card and the board cannot disagree about what was flown. It was
  a method on the class in `js/main.js`, which is to say it was the one thing a
  pilot is told at the end of a stage and the one thing nothing checked
- **`test/stage-flight.test.js`**, ten cases that fly a stage out gate by gate
  through the seam and hold everything that only happens at the end of one: the
  card on a first flight and on a slower second and on a faster third, a stage
  whose clock never ran reported as nothing at all, the next stage opening on
  its own clock at `TIME -:--.-  ·  BEST -:--.-`, a best flown in one session
  reading back as `BEST 0:12.0` in the next, the mark walking the course one
  gate at a time and going out when the stage does, a gate gone past leaving the
  course waiting on that same gate, a step that crosses nothing leaving the run
  alone, and a crash costing the thirty seconds before it rather than the stage
- **`flyStep` and `gateMissed` are published from `js/api/index.js`**, which is
  what the `pilot-matter` specifier resolves to. A name the document tells a
  host to import and the entry point does not re-export is not a name they have
  to go looking for, it is an import that fails on their page
- The **Game modes** table in `docs/api.md` names `flyStep` and `gateMissed`,
  and the worked example drives a course through the seam rather than through
  the four calls it replaces

### Fixed

- **The element editor moved every reading and never the ground.** `HEIGHT MAX`
  under `MOUNTAIN` walked from `500` to `900` on the start screen and again in
  a free flight, and the terrain either side of the panel came back pixel for
  pixel identical both times. The generator was willing - built from the same
  placements directly, eight steps of that range take the highest point from
  `578.2` to `904.9` - it was never asked to run. `editorPlacements` handed out
  the panel's own live `config` objects, `setEnvironment` kept the ask it was
  given as `this.built`, and stepping a range then edited that record in place,
  so `sameWorld` stringified the changed placements against themselves, reported
  a world that had not changed, and released no tile. Both halves are closed
  rather than the reachable one: the panel copies each configuration on the way
  out, so what a caller is handed is a description of the world rather than a
  handle on the editor, and the terrain records a copy of the ask rather than
  the ask itself, so a caller that goes on editing what it handed over is not
  editing the record of it. Two cases hold the copy, a span stepped eight times
  and a colour stepped once, and both fail against the aliased placements

## [1.13.0-alpha] - 2026-09-06

A world whose ranges can be moved while it is being flown over, and a course of
loops a pilot can find their way round rather than have to remember.

### Added

- **An element editor**, on `L`. An environment has been a description rather
  than a mesh since the registry landed, which means there has never been
  anything to re-author when a range moves - only a number, and the ground drawn
  again from the algorithm. The panel lists the elements the world being flown
  was assembled from, in the order the pipeline applies them, and choosing one
  opens the ranges it declared underneath it. A span is two rows, `MIN` and
  `MAX`, and neither end may be stepped past the other, because a range whose
  ends have swapped is a range the generator has to guess about. A single value
  is one row. A gradient is two rows, `LIGHT` and `DARK`, each stepped as a
  percentage of the colour the preset laid it down in: the arrow keys lighten and
  darken an end and do nothing else, because the gradient rule exists precisely
  so no element shifts colour dramatically across the ground it covers, and an
  editor that let two presses undo it would be undoing the thing it is editing.
  One press moves a fiftieth of what the range allows, put on the nearest of 1,
  2, or 5 times a power of ten, so a peak height in the hundreds moves by fifties
  and a ratio between nothing and one moves by hundredths - and that step is read
  off the declared bounds rather than configured beside them, so it stays right
  when the bounds move. Every reading the panel hands out has already been
  clamped into the range the registry declared, so no edit can ask for a world an
  element says it cannot draw. Edits belong to the world they were made on:
  choosing another environment, or turning the strip on, is a different set of
  elements, and the panel is filled again from that preset rather than carrying a
  mountain's height range onto ground that never had that mountain.
  `RESTORE THE PRESET` puts everything back without changing world. The preset
  itself is never written to - what the panel holds is a copy, and what it hands
  out is the same list of placements the Matter API takes
- **Every stage timed**, against the best that stage of that mode has ever been
  flown in. The clock runs from the moment a stage is laid out to the moment its
  objective is met, so neither the beat a finished stage is held on screen for
  nor a pause halfway down the course is part of it, and a stage started again is
  timed from nothing - what is recorded is the attempt that finished rather than
  everything done on the way there. A finished stage gives the objective line up
  for its beat and reports what the attempt came to, `NEW BEST` or `STAGE TIME`.
  The board is kept per stage per mode in `localStorage`, and a browser that
  refuses storage costs it its memory and nothing else
- **The whole course on the chart**, laid the moment its stage is rather than as
  it is flown, in the same three colours the hoops are drawn in. The first gate
  is no longer the only one the pilot has ever seen, and which way the course
  runs is something to read rather than to remember. A gate past the edge of the
  square the chart covers is held hollow at that edge, which is the convention
  the chart already reads by - the aircraft marker is held the same way, and
  dropping the gate instead would leave the course vanishing exactly when a pilot
  most wants to know which way it ran
- **A pointer to the gate the course is waiting on**, while it is more than 35
  degrees off the nose: an arrow for which way to turn, the compass bearing to
  fly, and how far there is to go on whichever scale the altimeter is set to.
  Thirty-five degrees is half the camera's vertical field of view, which is the
  narrow way across the frame, so a gate inside it is on the screen whatever
  shape the window has been dragged into - and a gate on the screen is already
  pointing at itself, so the line goes away rather than sitting there being
  ignored
- `js/element-editor.js` and `js/best-times.js`, both pure and both testable in
  Node with no renderer and no browser storage: the panel's rows, its steps, and
  the placements it hands out, and the board, its reading and writing, and the
  stopwatch format the readouts are written in
- `setMenuEntries` and `MenuList.rebuild`, for the first menu here whose rows
  come and go. A list built once was enough for every menu that was a fixed set
  of rows; a menu that opens and shuts its sections has to have its rows built
  again to be walked at all, because a row carries its place in the whole menu
  and a place that has moved is a row pointing at somebody else's entry

### Changed

- **A missed gate is reported rather than silently waited on.** Crossing a
  gate's plane outside the hoop left the course exactly as it was, which is
  correct - the gate is still the one being waited on, and that is what lets it
  be flown again - but the pilot was told nothing, so a course that had stopped
  counting looked exactly like a course that had not. The card now says so for a
  few seconds, and says the half that matters: not that a gate was missed, but
  that the course is still waiting on it. Only the direction the course runs
  counts, unlike a pass, which counts from both sides. Flying a loop backwards is
  still flying it; being told you missed one is about having left it behind you,
  and a pilot who has turned round to come at a gate again crosses its plane on
  the way back - which is the turn, not a second miss
- `gatePassed` is now read off `gateCrossing`, which works out where a step
  crossed a gate's plane once and answers everything either half of the course
  rules asks about it: how far off the middle of the hoop the crossing landed,
  whether that was inside it, and which way the step was going. The gate test
  itself is unchanged, and the same cases still hold it
- `Terrain.setEnvironment` takes an `elements` override, which is how an edited
  world reaches the generator: as a description like any other rather than down a
  path of its own. The strip comes off every tile but the middle one, for the
  reason it was only ever laid on that one - a runway is a place in the world
  rather than a feature of the ground that repeats across it, and a description
  handed whole to every tile would cut a strip into all nine
- `relativeBearing` folds two bearings in degrees rather than through radians and
  back. Two bearings a whole number of degrees apart are a whole number of
  degrees apart, and the round trip handed that number back with a tail on it

## [1.12.7-alpha] - 2026-09-05

Both halves of the anchor resolution are held by a case now, so which page a
fragment is read against is something the suite fails on rather than something
the documentation happens to carry.

### Fixed

- **The case ran the anchor resolution without ever letting it read a linked
  page.** Last release made `unresolvedAnchors()` the one home the check and the
  case both run, so a raw read put anywhere inside it fails the case - verified,
  27 pass and 1 fail. Which page that read is made against was another matter.
  `unresolvedAnchors()` takes `readPage` so a case can answer it, and the case
  answered with `nothingOffPage`, which asserts the reader is never called: every
  anchor on its synthetic page is a same-page one, so the resolution always took
  the `path === here` branch and no case had once run the half that reads another
  page's ids. What ran it was the site - `docs/controls/settings.html` links
  `../terrain.html#environments` and `docs/controls/instruments.html` links
  `../terrain.html#the-edge-of-the-world`, the only two cross-page anchors on
  twenty-two pages - so resolving every fragment against the page that links it
  rather than the page it points at left the case passing and failed only the
  check, verified at 27 pass and 1 fail, and an edit dropping the fragment from
  both links would have left that branch held by nothing at all. `an anchor into
  another page is an id that page has, not one this page has` takes the seam
  instead, the way `a folder is a page the browser opens, and a document is still
  a download` holds a form no page carries yet: it links a second page, answers
  `readPage` with that page's source, and asserts the fragment the linked page
  only prints inside a sample comes back unresolved while the one its own heading
  carries does not. Resolving against the linking page now fails the case as well
  as the check, at 27 pass and 2 fail, and skipping cross-page anchors
  altogether - which the site cannot notice, its own two being sound - fails the
  case alone

## [1.12.6-alpha] - 2026-09-04

The anchor check and the case standing over it are one call now, so the
resolution has a single home and nothing is left between them for a raw read to
move back into.

### Changed

- **The `1.12.5-alpha` notes no longer close on work still to do.** Their last
  sentence recorded the unheld call site as the next thing to hold, which it was
  for a day. It now names the release that held it, so the entry reads as the
  account of what that release did rather than as a promise about the one after

### Fixed

- **The line that called the anchor resolution was still unheld.** Last release
  named that resolution `resolvesOn()` and pointed `an anchor into a sample block
  is not an address the page offers` at it, so a `resolvesOn()` reading the raw
  source again failed. The line calling it was another matter: replacing it with
  the raw ``target_source.includes(`id="${fragment}"`)`` left `resolvesOn()`
  defined, unused, and read only by the case, which went on passing. That is 28
  green checks over a fix that is gone, for the fourth release running, and it is
  the shape the raw read sat in before `1.12.4-alpha`, so it is the shape this
  reverts to. The per-anchor loop is now `unresolvedAnchors()`, taking a page,
  its source, and a way to read a page linked from it, and returning the anchors
  that resolve nowhere. The check is a call on it, and the case is the same call
  over a synthetic page that prints `<div id="app">` in a sample and links
  `#app`: the printed id comes back unresolved while the heading's own fragment
  does not. There is no line left between the check and the case, and a raw read
  put anywhere inside the resolution now fails the case, verified by making that
  edit - 27 pass, 1 fail, where the same edit left all 28 passing before

## [1.12.5-alpha] - 2026-09-03

The case standing over the anchor check now holds the resolution that check
runs, rather than the helpers underneath it.

### Fixed

- **Nothing failed when the anchor check came apart.** Last release taught
  `every anchor a page links to is an id that page has` to resolve a fragment
  through `idsOn()`, so a page whose only `id="app"` sits inside a printed
  sample no longer answers a link to `#app`. What was added to hold it does
  not: `an anchor into a sample block is not an address the page offers`
  asserted on `idsOn()` and `sameePageAnchors()` directly and never on the
  resolution that reads them, so putting that line back to the raw `includes`
  left all 28 checks in `test/site.test.js` passing and the fix silently gone.
  This is the third release running to move this pair, and nothing yet failed
  when they came apart, which is the reason they kept coming apart. The
  per-anchor resolution is now `resolvesOn()`, lifted out of the loop the way
  `opensInBrowser` and `idsOn` were each lifted, and the case asserts on that
  rather than on the helpers under it: a fragment a page only prints does not
  resolve, and one a heading on that page carries does. A `resolvesOn()` that
  reads the raw source again fails the case now. The line that calls it does
  not: a check inlining that read again leaves `resolvesOn()` behind, unused,
  and all 28 checks still pass, which is the shape this pair came apart in
  before. `1.12.6-alpha` closed that, putting the whole resolution behind one
  call the case runs end to end

## [1.12.4-alpha] - 2026-09-02

The two checks that read an id now read the same one, and the release notes
above are in the order the rest of the file keeps.

### Changed

- **The `1.12.3-alpha` notes lead with what changed, the way the entries around
  them do.** They headed `### Fixed` before `### Changed`, and every other entry
  carrying both runs Added, Changed, Fixed - `1.12.1-alpha` and `1.12.0-alpha`
  each do - which is the Keep a Changelog order this file's own header cites.
  Both bodies are as they were; only the sections trade places
- **The site's testing page names the anchor check.** Its "What is covered"
  paragraph already named the addresses the reference page hands its headings
  and the one id per address every page is held to, and now names the check
  below, which is the third thing in that file to have an opinion about an id

### Fixed

- **The suite held two answers to what an id is.** Last release taught `no page
  gives the same id to two things` to read `linkable()` first, so a printed
  `<div id="app">` is markup to read rather than an address the page hands out.
  The check above it was left as it was: `every anchor a page links to is an id
  that page has` still asked whether the unstripped source `includes` the text
  `id="<fragment>"`, so on a page whose only `id="app"` sat inside a worked
  example, one check said the page offers no such address and the other said it
  does. A reference page printing `<div id="app">` and a line linking `#app`
  would have passed `npm test` on a link that scrolls nowhere. An anchor now
  resolves against `idsOn()`, which is lifted above the first check to read it
  rather than sitting between the two, and a case of its own holds the pair the
  check compares: the page links `#app`, the sample prints it, and the address
  is not one the page offers

## [1.12.3-alpha] - 2026-09-01

Two things a code review found in last release's own fixes - a check reading a
sample as markup, and an address the counted suffix could still hand out twice -
and the reference page's account of what it now covers.

### Changed

- **The site's testing page names the third check last release added.** Its
  "What is covered" paragraph had been extended with the converter and the link
  check but not with the duplicate id check, which is the first and longest
  entry in the `1.12.2-alpha` notes. The paragraph reads as the whole list and
  nothing holds it to the suite, so the page under-reported the release it was
  edited for. It now names the addresses the reference page hands its headings,
  the sample markup it prints rather than carries, and the one id per address
  every page is held to

### Fixed

- **The check for duplicate ids read printed markup as markup.** `no page gives
  the same id to two things` matched `id="..."` against each page's raw source,
  while every other check in `test/site.test.js` reads `linkable()` first, whose
  own comment says why: the reference page prints a host page's markup, and a
  sample is something to read rather than something the page does. `escapeHtml`
  in `tools/build-api-reference.mjs` escapes `<`, `>`, and `&` but not quotes,
  so an `id` inside a fenced block arrives on the page as the literal text
  ` id="app"` and the scan counted it. `examples/host.html` - the host the
  worked examples describe - carries `id="panes"`, `id="pilot-pane"`, and
  `id="pilot-readout"`, so a worked example printing two of those, or one
  matching a heading's slug, would have failed `npm test` over text that is not
  an id, on a page whose ids are all unique. The scan reads `linkable()` now,
  and it is a named function rather than a regex inside the loop, so a sample
  block that repeats an id and a page that repeats one are each held by a case
  of their own rather than by whatever the site prints that day
- **Two headings could still be handed the same anchor.** `anchors()` counted
  how often a slug had been asked for and appended that count, without asking
  whether the anchor it had just built was itself already taken. `Options`,
  `Options`, and `Options 1` came to `options`, `options-1`, and `options-1` -
  the defect `1.12.2-alpha` set out to remove, handed back by the fix for it.
  No heading in `docs/api.md` collides that way, and the duplicate id check
  above fails the build rather than letting a page ship, so this was a build
  that stops rather than a page that misleads. The count carries on now until it
  names an anchor no heading has taken, from either direction, and `anchors()`
  is held by tests of its own - it is exported, and nothing exercised it except
  through whatever headings the document happened to carry

## [1.12.2-alpha] - 2026-08-31

Three things a code review found around the reference page built last release:
an address that named two places, a line the builder read forever rather than
failed on, and a link check that turned down a folder for having no extension.

### Fixed

- **Four headings on the API reference page shared two addresses.** The page
  built for `1.12.1-alpha` slugged a heading from its own text and nothing
  else, and the document heads a section `Options` and a section `What comes
  back` under each half of the API. So the page went out carrying two headings
  at `#options` and two at `#what-comes-back`: a reader linking either one
  landed on the Pilot API's whichever they meant, the Matter API's two had no
  address at all, and duplicate ids are invalid markup that no other page on
  the site had. A repeat now takes a counted suffix, `#options-1`, which is
  what GitHub does to the same document, so an anchor copied from there reaches
  the same section on the site. A test holds every page to one id per address
- **A line the builder could not parse was read forever rather than failed
  on.** `markdownToHtml` took a line beginning with `|` for a table only when
  the line under it was the `|---|---|` rule. A `|` line that was not one - a
  table whose rule row is mistyped, a single pipe line, a paragraph that
  happens to open with one - matched no branch and fell through to the
  paragraph branch, whose own guard stopped it on that same `|` before it had
  taken anything. So the paragraph closed empty, the reader went back to where
  it had started, and it read that line again for as long as there was memory
  to hold the empty paragraphs it produced. One `| a | b |` with no rule under
  it in `docs/api.md` hung `npm run docs:api` and `npm test` both, and
  `npm test` is what CI runs, so it hung a job with nothing in the log to say
  why. Every branch now consumes at least the line it was entered on, so a
  line none of them describes is written out as the text it is and the
  document carries on past it. The tests convert in a process of their own
  under a clock, because a loop that consumes nothing is a synchronous one and
  no timeout inside the runner can interrupt it: a regression fails now,
  rather than hanging the suite that is supposed to catch it
- **The link check turned down a link to a folder.** The check that no page
  links a file the browser downloads read a target's extension and required it
  be one the browser renders. A folder has no extension to read -
  `posix.extname('controls/')` is `''` - so `href="controls/"` failed a test
  written to catch `text/markdown`, though Pages answers a folder with that
  folder's own `index.html`, which is a page. No page links one today, so the
  check passed and the first page to link a folder would have been the one to
  find out. A trailing slash, or no extension at all, is now read as the
  directory index it names, and what is left to fail is a target naming a type
  the browser hands to the filesystem. Both readings are held by a test of
  their own rather than by whatever the site happens to link that day

## [1.12.1-alpha] - 2026-08-30

The documentation site, and the two things a code review found once it was
standing: a stage opening still being carried round a square the world no
longer has, and the ground's reach and the camera's far plane holding together
only because two numbers happened to match.

### Added

- **A documentation site**, at `docs/`, because the README had become a manual
  rather than a front door: 576 lines and 55,000 characters, which is a
  document nobody reads to the end of and everybody scrolls past the middle
  of. Every section it carried is now a page of its own, with the text moved
  across whole rather than summarized down, so nothing that was written is
  lost and the thing a reader wants is one entry in a menu rather than one
  scroll position in a file. Twenty-two pages, a fixed side menu whose groups
  collapse, and a folder structure the menu matches, so where a page sits in
  the tree and where it sits in the menu are the same answer
- `DESIGN_LANGUAGE.md`, which is why the site looks like the project rather
  than like a template it was poured into. There is no vector art here, so the
  palette is sampled out of `logo.png`: the sky the aircraft is flying out of,
  the navy it is drawn in, the sage of the banner, and the two tans of the
  mountains, each at the frequency it actually occurs in the file. Two of them
  cannot carry text - sky reaches 1.74:1 against white and sage 2.07:1 - so
  both are held to fills and darker tones of the same hues are used wherever
  something has to be read. Every pair the site renders is measured and
  written down, and the lowest of them is 5.17:1
- `QUICKSTART.md` and `CHEATSHEET.md`, the two documents a long manual always
  needs and never contains: one for a reader who wants it working now, one for
  a reader who has already read the long version and needs the numbers back.
  Both are site pages as well as Markdown
- A Pages deploy workflow, and the `.nojekyll` that stops a site not built by
  Jekyll from silently losing every path beginning with an underscore. The
  tree it publishes is the tree that was already being published, so the
  simulator stays exactly where it is
- Tests over the site: that every page carries the head it needs, that every
  copy of the menu is still the same menu, that every link reaches a file and
  every anchor reaches an id, that nothing is linked by an absolute path -
  which works locally and breaks on a project site - that every colour on the
  site is one the design document declares, and that the README stayed short
  enough to be the front door it was cut back to
- **The API reference is a page.** `docs/api.md` is 934 lines and the deepest
  reference the project has, and the site linked it from the footer of every
  page, from a card on the home page, and from the body of the API overview -
  as the markdown file itself, which Pages serves as `text/markdown` and a
  browser downloads rather than renders. The most linked destination on the
  site was the one destination that was not a page. It has one now,
  `docs/api-reference.html`, carrying the document in full under the same head,
  menu, and prev/next chain as everything else. The file stays where it is: the
  tests read it, and the README links it for a reader on GitHub rather than on
  the site
- `npm run docs:api`, which is what builds that page. The reference is
  generated from the markdown rather than written beside it, and its head,
  menu, and footer are lifted off `docs/api.html` rather than copied, so it can
  drift from neither the document nor the rest of the site. A test renders it
  again and fails when what is committed is not what the markdown now comes to
- The site read against the code it describes. `test/docs.test.js` holds
  `docs/api.md` and the README to the source - every published name, every
  telemetry field, every start field, every environment id - while
  `test/site.test.js` imported nothing from `js/` and checked the pages for
  structure and a handful of hardcoded strings. Adding a field to the
  configuration failed the document while `docs/controls/settings.html`, which
  lists all eight start fields by label, went stale with nothing failing. The
  pages carrying that material are now read against the modules publishing it:
  the start fields on the settings page, and every world and every game mode on
  the terrain page, the game modes page, and the cheatsheet
- A check that every document the site links is one a browser opens rather than
  one it downloads, so the reference cannot quietly become a file again

### Changed

- **The README is a front door rather than the manual.** 576 lines down to
  190: what it is, how to run it, the keys, and where the rest of it lives.
  Every section heading it kept is a link to the page carrying that section in
  full, so the short version is never the whole story pretending to be

### Fixed

- **A stage opening was still being carried round one square.** `stageStart`
  wrapped a stage's opening into a single 16,000-unit square, on the reasoning
  that the world had no outside and an opening was carried round it the same
  way a flight was. A flight is not carried round any more - the tile grid
  replaced that last release - so a wrapped opening had become a different
  place rather than the same one. Nothing had reached it yet, but DOWNWIND
  opened 184 units inside the line the wrap fired at, so a stage given a longer
  approach, or a runway sited nearer a tile edge, would have opened the
  aircraft on the far side of the strip at a bearing and a distance the stage
  never asked for. An opening now stands where its bearing and its distance put
  it, and a test flies all four landing stages off a strip sited at seven
  places across the tile - twelve of those openings are ones the wrap would
  have moved
- **Nothing held the ground out as far as the camera was drawn.** `TILE_REACH`
  was 12,000 and the camera's far plane was 12,000, and the two were tied by a
  comment rather than by anything that failed when they drifted apart. The
  promise the whole grid rests on - that the ground always runs further than the
  camera can see - would have broken the moment either was changed on its own,
  back into the void edge the grid removed. The camera is built from the reach
  now, and a test reads it: the far plane has to be drawn from `TILE_REACH`
  rather than named as a number that matches it, and it can never be drawn
  further than the ground is laid

## [1.12.0-alpha] - 2026-08-28

### Added

- **A world with no edge.** The world was one square with nothing outside it,
  and carrying the aircraft round at the bounds kept the ground from running out
  without keeping the edge from being reached: the seam where the world stopped
  could still be flown at, and crossing it moved the flight rather than
  continuing it. The square is now one tile of an endless grid of them, each
  tile the same description of a world seeded from its own place in that grid,
  and the tiles around the aircraft are drawn out as far as the camera is drawn
  at - so the ground the fog was promising is actually there and there is nothing
  left to reach. The tile at a given place is that ground every time it is laid,
  so a country worth flying back to is still there on the way back, and the
  middle tile is the description untouched, which leaves every stored seed, every
  course, and every runway exactly where it was
- `js/world-tiles.js`, the arithmetic of that grid and nothing else: which tile a
  place is in, where a tile sits, which tiles have to be drawn for an aircraft
  somewhere in it, and which are worth holding on to. Pure, so the promise it
  makes - that from any position the ground runs further in every direction than
  the camera can see - is a property the tests check across the whole of a tile
  rather than a claim about one position
- **Every menu answers to the mouse**, not only the two the flight opens on. The
  modes panel and all three lists of the settings panel now follow the pointer
  and choose on a click, and a click does whatever choosing that row does: picks
  a world, steps an option on to its next setting, or turns a box over. The
  control list takes the pointer too, so a click collapses it and a click on what
  is left opens it again, which is the way back off it for a pilot who never
  reached for `H`

### Changed

- **A menu takes its keys back off the flight behind it.** Every key that works a
  menu also works a control surface, and only the start screen was taking them,
  so walking the pause menu or the settings panel was also pitching and rolling
  the aircraft under it. A menu on screen now reads the cursor and adjust keys
  ahead of the flight and stops them there; every other key is read as it always
  was, so `F2` still takes a picture of a paused world and `Esc` still closes a
  panel. Both sets of keys the cursor answers to are named on every card that
  carries a menu, because a pilot who reaches for the arrows and is told only
  about `W`/`S` reads the arrows as not working
- The chart in the corner is fitted to the tile being flown over rather than to a
  world that no longer has bounds to draw. Crossing into the next tile moves the
  marker to the edge it came in over and the chart on to the new square, which
  says where in the country the aircraft is instead of pinning it to an edge
- Menu entries are read down their left edge rather than about their middle, so
  entries of different lengths line up under each other, and every one of them
  reads as something to click. The settings panel's headings are set large,
  underlined, and over the left edge of the list each heads, so a panel long
  enough to scroll reads as three sections rather than one run of rows
- The ground is laid a tile at a time, one per frame, so changing world costs a
  few slow frames rather than one long stall - and the tile the aircraft is
  actually over is always drawn before it is flown over, never on a budget

### Fixed

- `tileSeed` gave a place and the place opposite it the same seed, because taking
  one coordinate against the other is only as good as its symmetries: an endless
  world laid out from it would have been folded in half about its middle, with
  the country north-east of the start laid out again to the south-west. The two
  coordinates are now stirred together rather than combined, and no two places in
  a grid share a seed. The middle tile is still the seed itself, so a world laid
  as one square of a grid and the same world laid on its own remain the same
  ground

## [1.11.0-alpha] - 2026-08-27

### Added

- **Worlds that tile**, so an environment can be one square of a larger one
  rather than the whole of what there is. A world told which square of a grid it
  is - `tile: { x, z }` - is generated in the world's coordinates rather than in
  its own: its vertices stand where its place in the grid puts them, its sampler
  answers for that square and nothing outside it, and its mesh is drawn where its
  field says it is, so a host flying across an assembly passes the world position
  it already has rather than converting into and out of each square's own
  coordinates. Because the ground is shaped from noise read off the world rather
  than off the square, the base ground now runs on across a join instead of
  starting again at it
- `join(...neighbours)` and `matchEdges(fields)`, which close what the base
  ground cannot. A peak that ended at one square's edge knows nothing about the
  ground its neighbour laid against it, so every place two or more squares put a
  vertex is settled on one height and one colour - the average of what they all
  had there - and each square is walked back to what it was over the next few
  vertices in, which leaves the join seamless without flattening the country
  behind it. A vertex four squares meet at is settled against all four at once
  rather than twice against two of them, so a corner closes as exactly as an edge
  does, and settling a join that is already settled changes nothing
- `createTiledEnvironment`, which builds a whole grid: every square generated,
  every join settled in one pass before anything is drawn, one set of lights over
  the assembly rather than one per square, and a sampler, an aircraft contract,
  and a water pass that all work across the grid rather than one square at a
  time. It answers the terrain contract the way a single environment does, so the
  Pilot API flies over the whole assembly without knowing it is one
- **A day to fly through**. The world was lit one way all flight, which is a
  world with one hour in it. A cycle now carries a phase from midnight through
  dawn, noon, and dusk and back round, and the sky the world fades to, the fog
  tinted with it, the colour and the strength of the sun, and the fill light
  under it are all read off that phase as the blend between the two moments
  either side of it - so a sunrise is a gradual thing rather than a switch thrown
  at a threshold. The sun walks an arc across the sky and is held a little over
  the horizon after it sets, so the ground keeps its shape after dark and it is
  the colour and the strength of the light that say what time it is. Midday is
  exactly the light the world was drawn in before it had a day, and time the
  flight does not spend flying - paused, held behind the title screen, or under a
  panel - is time the day does not spend passing
- **Moving water**, which is the one part of the ground that was never still and
  the one part that shines. Every vertex at or under the water line now rides a
  swell of two wave trains crossing at an angle, and catches a sheen on the face
  of each crest - a colour the land is never painted, so water reads as water
  rather than as blue ground. The swell is held down to nothing at the bank, so
  the surface meets the shore it was poured against rather than lapping over it,
  and the sheen is scaled by how much daylight there is to throw back, so a lake
  goes flat and dark at night. Both are functions of where a point is in the
  world and what time it is, which is what lets two squares of an assembly work
  out the same surface at the place they meet without agreeing on anything
- `js/day-night.js` and `js/water.js`, both pure and both published:
  `createDayNight`, `advanceDayNight`, `daylightAt`, `sunPositionAt`,
  `wrapPhase`, and `clockAt` for the day, and `waveHeight`, `waveSpecular`,
  `waterColor`, `animateWater`, and `waterSurface` for the water. A host can
  drive its own sky and move its own water from them with no renderer loaded at
  all, or read the hour without drawing one
- `examples/host.html`, a host page working both halves of the API side by side:
  the Pilot API flying over ground the page generated itself, with no terrain of
  Pilot Matter's loaded at all, beside the Matter API carrying an aircraft the
  page built and flies with a model of its own, over an assembly of four squares,
  running the day and moving its own water. It imports by the specifier the
  manifest publishes, which is what a host page installing the package would
  write, and the suite checks it against both halves it is meant to prove
- `setDaylight(phase)` and `updateWater(dt, light)` on an environment and on an
  assembly, `tileOrigin`, `fieldBounds`, `tileSeed`, `SEAM_BLEND`, and a
  `boundsFromSize` that takes the middle of the square as well as its size

### Changed

- A field now carries where it sits in the world - `originX` and `originZ` - and
  every element places what it draws against that origin rather than against the
  middle of the world. A world nobody placed is the square in the middle, which
  is the field the simulator has always built, so nothing about the bundled
  worlds moves
- The document no longer says that two tiles laid side by side meet at a seam a
  host has to fly with enough fog to cover. They meet at matched heights and
  matched colours

## [1.10.0-alpha] - 2026-08-26

### Added

- **The mouse**, on the two menus a flight is started and paused from. The
  pointer moving onto an entry puts the cursor there and a click chooses the one
  it landed on, so `START FLIGHT` is one click from the page loading and a flight
  paused with a hand on the mouse is resumed with the same hand. It is the cursor
  the keys already moved rather than a second one beside it: a click chooses what
  the pointer is over whatever the keys had last walked to, and the keys carry on
  from wherever the pointer left off, so the two are never pointing at different
  entries. Both cards go on letting the mouse through to the flight behind them -
  only the menu drawn on each takes the pointer back, and a click beside the
  entries falls on the world rather than on the card over it
- `applyMenuPointer`, the pointer's half of the selection rules, written as a
  pure function beside `applyMenuKey` and tested the same way: an entry the
  pointer is over, whether it was clicked there, and the id of whatever that
  chose. An index naming no entry - the gap between two rows, or a row left over
  from a menu that has changed under it - moves nothing and chooses nothing
- `MenuList.followPointer`, which hands a drawn list to the mouse. A list nobody
  hands to it listens for nothing, which is how the settings and Game Modes
  panels stay worked by the keys alone, and a list that draws part of a menu
  reports an entry's place in the whole menu rather than its row on screen, so a
  filtered list clicks the entry the cursor would have walked to

### Changed

- Both menus now say what works them rather than which keys do: the start screen
  and the pause card read `W/S OR MOUSE TO SELECT` and `ENTER OR CLICK TO CHOOSE`

## [1.9.1-alpha] - 2026-08-25

### Fixed

- The first stage of **Runway Landing** now opens close enough that the strip
  is clearly visible ahead of the aircraft. The previous approach distance put
  the runway so far through the scene's exponential fog that it read as bare
  ground rather than a marked strip; the opening distance has been halved and
  the starting altitude brought down to match, so the threshold markings are
  prominent from the first frame and the approach angle is manageable

## [1.9.0-alpha] - 2026-08-25

### Added

- A **runway** element, which makes the world somewhere a flight can end as well
  as somewhere it happens. It is an element like any other - a length range, a
  width range, a heading range, the height band a strip may be built in, and the
  reach of the apron either side - but it is the one element that chooses where
  it goes rather than being scattered: sites are drawn from the world's own
  seeded stream, each measured across the whole footprint of the strip rather
  than under the middle of it, and the flattest wins, because what a runway needs
  is not a particular place but ground that does not move under it. A site
  outside the band is charged for the part of it that lies outside rather than
  thrown away, so a world whose ground never quite fits still gets the best
  ground it has instead of getting no runway at all. The pavement is levelled
  dead flat and the apron eases back into whatever was there, so a strip sits in
  the country rather than on a plinth, and it is painted with a stripe down each
  shoulder and a bar across each threshold so it can be picked out from the air
- **Landing**, as an outcome in its own right rather than as the absence of a
  crash. A strip does not raise the bar for how hard an arrival may be so much as
  give it somewhere to be something else: on one, an arrival soft enough and
  square enough - inside the sink rate, the bank, the pitch, and the heading a
  landing is flown at - is a landing, a firmer one still rolls out because
  prepared ground takes more than a hillside does, and only past the runway's own
  threshold is it a crash. Either direction down the strip counts, because a
  runway has two thresholds rather than a start and a finish. Only the frame the
  aircraft arrives on is judged: a rollout is not a second arrival, and judging
  every frame of one would turn a landing into a crash as the airspeed bled away
  underneath it. The outcome is one state the HUD and the game modes both read
- A **START STATE** setting choosing the condition a flight opens in, as two rows
  only one of which can be in force: **Start off flying**, the airborne start the
  simulator has always had, or **Runway takeoff**, stopped at a threshold with the
  nose level, the engine idling, and the strip running away in front. A takeoff
  takes nothing from the airborne fields but the camera, because an aircraft held
  on the ground has no airspeed, no altitude, and no climb of its own to set
- A **RUNWAY** box beside it, saying whether the generated world carries a
  landable strip at all. Unchecked, no runway is drawn and there is nowhere to
  land. A runway takeoff holds it on and greys it out for as long as that start
  is chosen, because a start that asked to roll out of a world with no strip in
  it is not a start anything could honour - and the moment the start is put back
  to flying, the box is back where the pilot left it
- A **Game Modes** panel, reached from the start screen and the pause menu the
  same way Controls and Settings are, listing free flight and every mode there
  is and marking the one being played
- The first two **game modes**, each four stages long and each getting harder at
  exactly the thing it is about. **Runway Landing** opens in the air over open
  country with one strip in it: the first stage puts the strip under the nose
  over flat ground, and each one after it opens further out, further off the line
  back to it, over a shorter strip, in higher country. **Flying through Loops**
  opens lined up on the first gate of a course laid across a shallow valley, and
  each stage lays more gates, tighter, closer together, on a course that bends
  more. A gate is tested against the step the aircraft flew rather than against
  where it ended up, because a hoop is thinner than the distance covered in a
  frame; only the gate the course is up to counts, because the objective is the
  course in order; and a crash puts the stage back to its beginning rather than
  ending the run
- Two thin worlds for the modes to be played over - open country with a strip in
  it, and a valley with the air over it left clear - kept out of the settings
  panel because a mode brings its own ground with it. A stage builds its preset
  with a seed of its own, mixed rather than added, because two seeds a few apart
  open the generator's shift register on much the same value and four stages laid
  from those would have been four goes at the same course
- `js/game-modes.js` and `js/rings.js`: the modes, the stages, the run state, the
  course geometry, and the gate test as one pure module with no DOM or Three.js
  dependency, and the hoops that course is drawn with as another. Unit tests
  cover the stage progression, the run, the course, the gate from both sides and
  across a step long enough to jump it, and every stage of every mode opening on
  a start the configuration can actually hold
- `runway` and `seed` as Matter API options, `runways` on both halves, `landed`
  in the telemetry, `onLanding` and `runwayImpactSpeed` on the Pilot API, and the
  touchdown rules, the strip geometry, and the whole of the game modes published
  from the entry point, so a host can land on its own strips and play the bundled
  modes against its own renderer

### Changed

- A flight start now carries where over the world it opens and whether it opens
  on the ground, so a start is a condition and a place rather than a condition
  over the middle of the world
- The world and the start are now worked out in one place from the run and the
  settings together, so a new world resets the flight, a new start waits for one,
  and nothing has to know which kind of choice was made
- An environment is generated without a runway unless one is asked for, and the
  same description can be built as different ground by asking for a seed, which
  is what lets one preset stand behind four stages of a mode

## [1.8.0-alpha] - 2026-08-24

### Added

- `js/config.js`, holding the condition a flight opens in as one object rather
  than as constants scattered through the flight code. Every field is declared
  twice over: once as the value it opens on, and once as what it is allowed to
  be - its range, the step it moves by, and the units it is read in - which is
  what lets a panel offer the start without knowing anything about flight, and
  a host offer it its own way
- A `START STATE` half of the settings panel, setting the airspeed, altitude,
  climb, heading, throttle, and camera a flight opens in, each remembered in
  `localStorage` for the next session. Edited before launch the aircraft is put
  straight into the new start, so the world behind the panel shows what was set;
  edited mid-flight it waits for the next reset, because a start is the next
  flight's condition rather than this one's
- An option can now be a number stepped along a range as well as a value
  stepped through a list. A range stops at its ends rather than wrapping round
  them, because the ends of a range mean something a list's do not: past the
  fastest a flight can open at is not the slowest
- A world with no outside. Flying at an edge no longer reaches it: the aircraft
  is carried round and comes back in over the opposite edge, at the same
  distance past it, at the same altitude, on the same heading, and at the same
  airspeed. Only the horizontal position moves, and the two axes are carried on
  their own, so a corner crossed diagonally comes back in at the opposite corner
- Photo mode on `F2`, which takes every overlay off the screen for the one frame
  the picture is taken in and downloads the view as a PNG named for the moment
  it was taken. The overlays were never in the picture - a rendered frame holds
  the world and nothing that sits over it on the page - but a photo mode whose
  screen still carried a HUD would be one that lied about the file it wrote. The
  frame is read back inside the same pass that drew it, because a browser clears
  a drawing buffer once its frame has been composited
- `docs/api.md`, writing out the whole API surface: every option and everything
  that comes back for both halves, the contracts, the configured start, the
  worlds and the elements, the edge rule, a worked host page for each half, and
  a stability guarantee saying what holds within a major API version and what -
  the tuning numbers, the rendered look, and anything not exported from the
  entry point - explicitly does not
- `js/world-edge.js` and `js/photo.js`, pure modules holding the crossing and
  photo mode's state and filenames with no DOM or Three.js dependency, with unit
  tests covering the crossing at every edge and corner, the state a held key
  leaves behind, and a frame that refuses to be read
- `wrap` and `onReset` as Pilot API options: the first turns the crossing off
  for a host whose own world continues past the bounds it declared, and the
  second reports a reset - by the menu, by the reset key, or by a crash - to a
  host that wants to hear about it
- `setStart()` on the Pilot API, changing what a reset resets to without
  resetting, and the configured start and the edge rule published from the entry
  point so a host can offer the same start state and match the same crossing

### Changed

- A reset now restores the whole configured start, the camera it opens in
  included, whether it came from the pause menu, the reset key, or a crash
- The settings panel's cursor scrolls the panel to keep itself in view, for a
  window too short to hold three lists of entries at once
- `js/flight-state.js` no longer declares the start, it resolves one: the
  `INITIAL_` constants are the configured defaults read through the conversions
  once, and a flight can be built from any other start the same way
- The minimap's red off-map reading is now only reachable through the Pilot API
  over a host's own world with the crossing turned off, because the bundled
  simulator can no longer be flown out of its world

## [1.7.0-alpha] - 2026-08-23

### Added

- A minimap in the top right corner, drawn north-up the way a chart is read:
  the world's +Z axis runs up the face, +X runs across it, and the marker turns
  under a fixed card rather than the card turning under the marker. It is
  refitted to whichever environment is being flown, so the marker means the
  same thing after a world is changed as it did before, and an aircraft flown
  out past the edge holds the edge it left through and turns red rather than
  being drawn somewhere it is not
- Engine and wind audio. The engine note and its loudness are read off the
  throttle lever, and the wind rises over it with airspeed - faster than the
  airspeed itself, so a standstill is silent and a dive is loud. `M` mutes and
  unmutes both, marked by an `AUDIO MUTED` line above the artificial horizon
  and remembered in `localStorage` for the next session. The sound is built on
  the key that starts the flight, because a browser will not run an audio
  context created before a key was pressed at the page, and it fades to silence
  rather than being torn down, so unmuting picks it back up where it was
- An `OPTIONS` half of the settings panel, holding control sensitivity, fog
  density, and the scales the instruments read on - knots or mph for airspeed,
  feet or metres for the altimeter and the climb rate with it. Each option is a
  value stepped through a list rather than a slider, so no combination of keys
  can land one between two settings, and every choice is remembered for the
  next session on its own: one setting this version cannot read does not cost
  the others their memory
- `O` as a key of the settings panel's own, opening it from the flight, the
  pause menu, or the start screen, and closing it again. The panel holds the
  simulation clock while it is up, so a setting is changed by looking at the
  world rather than by flying into it while looking
- A loading screen carrying the game's name, a progress bar, and a line naming
  the work in hand, which fades off on the strength of a frame the renderer has
  actually drawn rather than on a timer, replacing the static
  "Loading Flight Simulator..." line
- `js/minimap.js`, `js/audio.js`, and `js/loading.js`, pure modules holding the
  chart projection, the engine and wind mix, and the start-up progress with no
  DOM or Three.js dependency, with unit tests covering the projection and its
  edge behaviour, the mix at every throttle and airspeed, the mute and its
  stored choice, and progress that only ever moves forward
- `controlRates()` in `js/flight-model.js`, giving the pitch, roll, and yaw
  rates at a sensitivity setting, with the rates themselves lifted out of
  `js/aircraft.js` and named. A host embedding the Pilot API can set the same
  sensitivity through `flight.sensitivity`
- A second scale for every reading in `js/units.js`, as a conversion of the
  first rather than a second set of tuning numbers, so the flight model never
  learns which scale is on the dial and the two can never drift apart

### Changed

- A menu list can be given a filter and then draws only the entries it keeps
  while still answering to the cursor of the whole menu, which is what lets the
  settings panel split one set of entries across two headings without splitting
  the cursor that walks them
- An entry carrying its own text is drawn as that rather than as its label,
  which is how an option shows the setting it is on
- `Tab` clears the minimap along with the rest of the instruments, because they
  are one set of instruments rather than three overlays that happen to share a
  screen
- The fog is retuned in place rather than replaced when its density is changed,
  so nothing handed the old fog is left holding one the world has stopped using

## [1.6.0-alpha] - 2026-08-22

### Added

- A configured start state, replacing the standing start: every flight now
  opens at 80 knots and 1390 ft, climbing at 1260 ft/min on a heading of 000,
  with the throttle at 20% and the chase camera selected. The two values that
  have to be flown rather than declared are derived rather than guessed - the
  throttle setting is the one asking for exactly 80 knots, and the pitch is the
  angle that covers both the climb and the sink the wing loses at that airspeed
  - so the flight holds its opening condition instead of settling out of it.
  `R` and Reset Flight put the aircraft back into the same condition
- A start screen menu over the title, offering Start Flight, Controls, and
  Settings, worked with the same keys the pause menu uses. The Controls entry
  puts the control list on screen over the title, where nothing had shown it
  before the first flight
- A Settings entry on the pause menu, opening the same panel the start screen
  opens. The panel is the one overlay that clears the screen it was opened
  from, because the point of picking an environment is seeing it
- Ten environment elements - mountain, canyon, desert, grass, sand, water body,
  river, forest, town, and snow - each declaring the ranges it can be
  configured through and the algorithm that draws it. Nothing in the world is a
  placed asset: rivers and canyons wander on three waves whose lengths share no
  common multiple, forests are outlined by three lobes that share none either,
  dune crests are pushed off their axis by noise, and every colour is a
  light-to-dark gradient of one base hue so nothing shifts hue across the ground
  it covers
- Five assembled environments - Highlands, River Basin, Canyon Country, Dune
  Sea, and Lakeside - selectable from the settings panel, regenerated in place
  in a few tens of milliseconds, and remembered in `localStorage` for the next
  session. Each is a name, a seed, and a set of elements rather than any
  geometry, so the same preset lays out the same world every time it is flown
- A simulator API under `js/api/`, with `js/api/index.js` as the one module a
  host page imports. The **Pilot API** flies the aircraft against a
  caller-supplied scene, terrain sampler, aircraft asset, and keybinding map,
  and reports a fixed telemetry shape an external HUD can be written against.
  The **Matter API** hands over an assembled environment as one detachable
  group, with a height sampler, a contract any external aircraft can be checked
  against, caller-supplied meshes placed by the generator, and the world's fog
  and sky as a standalone effect
- `js/environment/elements.js` and `js/environment/presets.js`, pure modules
  holding the registry, the field, every generator, and the five worlds, with
  unit tests covering the ranges, the seeded layout, the carve profile, and what
  each generator does to the ground it is placed in
- `js/api/contract.js`, a pure module holding the option defaults, the aircraft
  contract, and the telemetry shape, which imports no renderer so a host can
  check its own options and its own aircraft with nothing loaded
- `js/settings.js` and `js/units.js`, pure modules holding the settings panel's
  choices and the conversions between world units and instrument readings in
  both directions, with unit tests covering the round trips, the stored choice,
  and a storage that refuses outright

### Changed

- The title screen is answered by its menu rather than by any key, so the
  screen the game opens on can be read and configured before anything flies
- The terrain is built from an assembled environment rather than a fixed noise
  pass followed by a mountain pass, and can be rebuilt in place when a different
  world is chosen
- The keybindings are a map rather than a switch, published as an interface a
  host can remap or replace with an input source of its own
- The aircraft accepts an external model flown from a declared control anchor,
  its own input state, and overrides for the start state and the flight model,
  so the game and the Pilot API fly the same class

### Removed

- The fixed height-to-colour ramp in `js/terrain-math.js`. Every band it drew -
  water, sand, grass, rock, and snow - is now an element with a configurable
  range of its own

## [1.5.0-alpha] - 2026-08-21

### Added

- A title screen the game opens on, carrying the name and a prompt to press
  any key. The simulation clock is held at zero behind it, so the aircraft
  waits on the prompt rather than gliding toward the terrain, and the key
  that answers it is swallowed rather than passed on to the controls. A
  modifier pressed on its own is not an answer, so a hand resting on `Shift`
  leaves the title up
- A pause menu over the frozen frame, offering Resume, Reset Flight, and
  Controls. The cursor moves on the same keys the aircraft pitches with,
  wraps round both ends, opens on Resume every time, and `Enter` or `Space`
  chooses the entry under it
- A controls-help toggle on `H` that collapses the on-screen control list
  down to a single hint line naming the key that brings it back, which the
  pause menu's Controls entry can also reopen
- A HUD visibility toggle on `Tab` that clears the instruments off the screen
  for clean flying, remembered in `localStorage` for the next session. A
  browser that refuses storage costs the choice its memory and nothing else
- An attitude indicator in the bottom right corner: an artificial horizon
  whose ball rolls against the bank and whose ladder slides against the
  pitch, with a labelled rung every 10 degrees out to 60 either side, bank
  marks at 10, 20, 30, 45, and 60 degrees around the rim, and the aircraft
  drawn across the middle of the face
- `js/title-screen.js`, `js/menu.js`, `js/controls-help.js`, and
  `js/hud-visibility.js`, pure modules holding the rules behind each of those
  overlays, with unit tests covering the latching toggles, the wrapping
  cursor, and a stored choice that outlives the session which made it
- `js/attitude.js`, holding the artificial horizon's angles and geometry with
  no DOM or Three.js dependency, with unit tests covering the pitch and bank
  it reads, the ladder it builds, and the face it draws them on
- `getAttitude()` on the aircraft, reporting where the nose and the wings
  point rather than the angles behind them, so the indicator shows what the
  aircraft is doing rather than what it was asked to do

### Changed

- Every overlay is now placed from the state that drives it in a single pass,
  and starts hidden in the stylesheet, so a page whose scripts never arrive
  shows an honest nothing rather than a HUD reading zero over an empty world
- The warnings stay quiet while the simulation is frozen by the title screen
  as well as by a pause: there is nothing to be done about either one while
  the world is holding still
- The on-screen control list gained its `Tab` and `H` rows

## [1.4.0-alpha] - 2026-08-20

### Added

- Crash detection: flying into terrain faster than 30 units/s wrecks the
  aircraft rather than clamping it silently to the ground height, killing the
  controls behind a `CRASHED` banner for two and a half seconds and then
  resetting the flight. A gentler arrival is still a landing, so an
  engine-out settle onto a hillside survives, and `R` skips the countdown
- `js/crash.js`, a pure module holding the impact threshold, the crash
  countdown, and the ground clearance the aircraft keeps, with unit tests
  covering what separates a landing from a crash and the single reset a
  countdown asks for
- Heading and vertical speed on the HUD: a three-digit compass bearing with
  the nearest of the eight compass points, counting clockwise from north, and
  a signed climb rate in feet per minute rounded to the nearest 10 so the
  readout settles instead of flickering
- A `LOW ALTITUDE` warning that blinks over the middle of the screen within
  200 ft of the terrain directly below the aircraft, measured against the
  ground rather than sea level, so a run up a valley warns while the same
  altitude out over water does not
- `js/camera-math.js`, a pure module holding the framerate-independent
  damping behind the chase camera's lag, with unit tests covering
  convergence, the frozen clock, and the snap distance
- A `How the Flight Model Works` README section covering the throttle lever,
  airspeed-driven lift, the stall penalty, and the crash threshold, and an
  `Instruments` section listing every HUD readout and warning

### Changed

- The chase camera now trails its offset behind the aircraft rather than
  riding it exactly, easing into position each frame so turns and pitch
  changes swing the view instead of snapping it. The point it looks at
  follows more tightly than the camera itself, so the aircraft leads the
  frame through a turn, and a jump too wide to have been flown - a reset, a
  crash recovery, or a return from another camera mode - cuts across rather
  than flying the whole way
- The crash and low altitude warnings give the middle of the screen up to
  the paused indicator, and a paused frame holds the crash countdown where
  it stands

## [1.3.0-alpha] - 2026-08-19

### Added

- `js/flight-model.js`, a pure module holding the arcade physics rules -
  throttle lever travel, speed convergence, lift, and the stall penalty -
  with unit tests
- `js/terrain-math.js`, a pure module holding the world's math - value
  noise, fractal Brownian motion, the plains/peaks height curve, the
  smoothstep mountain bump, and the height-to-colour ramp - with unit tests
  covering range, determinism, and falloff
- `npm run serve`, a zero-dependency static server for manual testing that
  serves the project root on port 8080, with the port overridable by
  argument or the `PORT` variable, and unit tests for its request path and
  content type rules

### Changed

- Throttle is now a setting rather than a speed: `Shift` and `Ctrl` move a
  0-100% lever over two seconds, airspeed converges toward the speed that
  lever asks for, and the HUD throttle readout reports the setting instead
  of the current speed
- Lift is now read off airspeed, replacing the constant gravity sink: below
  the stall speed the aircraft sinks up to twice as hard, easing off as
  speed builds, and at cruise speed lift cancels gravity so level flight
  holds altitude
- The page title is now "Pilot Matter" rather than "3D Flight Simulator",
  matching the favicon beside it in the browser tab
- `js/terrain.js` and `js/mountains.js` now import their shared math and
  colour ramp from `js/terrain-math.js` instead of each carrying a copy
- Starting flight state gained a closed throttle, so a reset returns the
  lever to 0% along with the 0-knot airspeed

## [1.2.0-alpha] - 2026-08-18

### Added

- Pause with the `P` key: the simulation clock latches at zero, a `PAUSED`
  indicator appears over the frozen frame, and pressing `P` again resumes
  without applying the time spent paused
- `js/pause.js`, a pure module holding the pause toggle rules (latch on
  keydown, ignore key release and auto-repeat) and the frozen simulation
  delta, with unit tests
- `js/flight-state.js`, a pure module defining the starting condition
  gameplay begins from and `R` resets back to, with unit tests asserting
  flight starts at an airspeed of 0 knots
- `P - Pause` row in the on-screen controls help and the README controls
  table, and a page description for link previews of the demo page

### Changed

- The aircraft constructor and `reset()` now read their starting position,
  rotation, and speed from `js/flight-state.js` instead of repeating literal
  values, so the 0-knot start has a single source of truth

## [1.1.0-alpha] - 2026-08-18

### Added

- Q/E yaw input so the aircraft responds to every control listed in the
  on-screen help
- C-key camera cycling through CHASE, COCKPIT, and ORBIT modes, with the
  active mode reported on the HUD camera readout
- Zero-dependency unit test harness using `node:test` (`npm test` or
  `node --test`) covering HUD unit conversions, keyboard input-to-state
  mapping, and the mountain count formula
- `package.json` manifest and this changelog

### Changed

- Keyboard input mapping extracted into the pure module `js/input-map.js`,
  and HUD unit conversions and the mountain count formula exposed as pure
  functions, so all three are testable in Node without a browser
- README controls table updated with the yaw (`Q`/`E`) and camera cycling
  (`C`) keys

## [1.0.0-alpha] - 2026-08-18

### Added

- Baseline release: arcade flight model with pitch, roll, coordinated
  banking turns, throttle, and gravity
- Procedural terrain from multi-octave fractal Brownian motion noise with
  height-based vertex coloring (water, sand, grass, rock, snow)
- Random mountain placement covering roughly 10% of the terrain surface
  using smoothstep radial bumps
- Atmospheric fog and sky lighting
- Chase camera and HUD readout of airspeed, altitude, throttle, and camera
  mode
- Zero build step: runs directly in the browser via ES modules and an
  import map
