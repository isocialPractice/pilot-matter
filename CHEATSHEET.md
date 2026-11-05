# Cheatsheet

`Ctrl + click` to read this on the site: [Cheatsheet](https://isocialpractice.github.io/pilot-matter/docs/cheatsheet.html)

Everything on one page, for a reader who has already read the rest. No
teaching, no explanation: the keys, the options, the elements, and the calls.

## Keys

| Key | Action |
|-----|--------|
| `W` `↑` | Pitch up |
| `S` `↓` | Pitch down |
| `A` `←` | Roll left |
| `D` `→` | Roll right |
| `Q` / `E` | Yaw left / right |
| `Shift` / `Ctrl` | Throttle up / down |
| `Space` | Level off: vertical speed to zero, nose eased to level over 0.6s. Needs an engine |
| `C` | Cycle camera: chase, cockpit, orbit |
| `P` | Pause, and the pause menu |
| `O` | Settings panel, and close it |
| `L` | Interactive environment builder, and `Esc` to leave it |
| `M` | Mute the engine and wind |
| `H` | Collapse the control list |
| `Tab` | Show or hide the instruments |
| `R` | Reset to the start condition |
| `F2` | Photo: download the view as a PNG |
| `Esc` `Backspace` | Back out of a panel |
| `Enter` `Space` | Choose the menu entry under the cursor |

## Without a keyboard

Drawn on a machine that takes touches and has no pointer that can hover: a
phone or a tablet, never a laptop with a touchscreen. Menus were always worked
by pointer, so only the flight controls are added.

| Pad | Works | Cluster |
|-----|-------|---------|
| `PITCH +` / `PITCH -` | Nose up / down | Left |
| `ROLL L` / `ROLL R` | Wing down either way | Left |
| `THR +` / `THR -` | The throttle lever | Right |
| `YAW L` / `YAW R` | Nose left / right | Right |

Tilt is what those machines open in, and it takes the four attitude pads off
the glass. `FLY BY TILT` in the control settings overrules that either way, so a
tablet with a keyboard can ask for the device and a phone can ask to be left
alone. Whatever angle the device is held at when a flight starts is level for
it, and a reset levels it again. Seven degrees either side of level is nothing,
and `TILT DEADZONE` offers two positions either side of those seven. Refused, or on a device with no gyroscope, the pads stay and the
flight is flown from them: a sensor that reports no angles at all is no reading
rather than a device held level. The pads take the bottom corners, so the
attitude indicator moves to the top left of the screen, the readouts drop below
it and the chart it now shares that top with, and the control list comes off.

A pad is 44 pixels square, which is both the smallest a control under a thumb
should be and what lets two clusters and the padding either side of them fit
the 320 pixel screen a phone is narrowest at.

The pads take a fixed band off the bottom whatever the screen, so a short one
has less left between them and the instruments above. Below 541 pixels of
height - which is every phone held sideways - the readouts are drawn compact
and drop `THROTTLE` and `CAMERA`, the two you are not flying on - and on a
screen 640 pixels or narrower that starts at 657 instead, because a narrow one
has the objective card under the readouts as well as the pads under both.
Shorter again and they move into the band between the two clusters of pads,
with the `AUDIO MUTED` line going up beside the attitude indicator rather than
staying under it. The objective card, which is what carries the breakdown of a
landing, is lifted clear of the pads on any screen narrow enough for them to
cross it; on a screen short and wide enough for the readouts to be in that
middle band it is hung from the top of the same lane instead, because the band
is where the readouts now are. The two are placed against each other rather
than each against the pads, so neither is drawn over the other at any size a
phone comes in.

Bounded to the room the readouts leave, the card holds what it says in flight
and not a landing read off it, which is five lines more. So the readouts stand
down for as long as a breakdown is up and the card takes the column - on the
screens the two are in one column on. An aircraft stopped on a strip reads zero
knots, zero feet a minute and the strip's own elevation, which is everything
the breakdown says and nothing it does not, so of the two wanting that column
it is the stack that gives way. From 680 pixels of width, on a screen tall
enough to keep the readouts in their own corner, the card's left edge is past
their right edge and the two never meet, so there the stack stays up and the
card is bounded to the screen rather than to anything above it. A screen short
enough to have put the readouts in the middle lane is the exception at any
width, because the card is hung in that same lane and the two are back in one
column.

On the shortest screen a browser leaves, 320 by 460, there are 108 pixels
between the chart and the pads for both of them, so the stack keeps the
airspeed and the altitude and the card keeps its stage and its objective. What
the card has no room for comes off rather than being cut through: the bound is
written in the card's own rows, so every line on it is either read whole or not
drawn at all.

## Flight numbers

| Quantity | Value |
|----------|-------|
| HUD scale | 2 knots per world unit/s |
| Stall speed | 40 units/s (80 knots) |
| Cruise speed | 120 units/s |
| Full throttle | 200 units/s |
| Throttle sweep | 2 seconds, 0 to 100% |
| Terrain crash | Faster than 30 units/s down |
| Runway crash | Faster than 48 units/s down |
| Runway landing | Under 18 units/s, wings 11 deg, nose 15 deg, heading 25 deg |
| Landing aim | A fifth of the strip's length past the threshold |
| Landing reach | A third of its length either side of that is worth nothing |
| Landing rollout | Ends at 1 unit/s, or after 10 seconds |
| Ground clearance | 5 units |
| Crash countdown | 2.5 seconds, then reset |
| Low altitude warning | Within 200 ft of the ground below |
| Terrain tile | 16000 x 16000 units, 200 x 200 segments |
| Ground drawn to | 12000 units past the aircraft |
| fBm octaves | 7 |

## The start state

| Field | Range | Step | Default |
|-------|-------|------|---------|
| `START AIRSPEED` | 0 to 200 knots | 5 | 80 knots |
| `START ALTITUDE` | 0 to 8000 ft | 10 | 1390 ft |
| `START CLIMB` | -2000 to +3000 ft/min | 20 | +1260 ft/min |
| `START HEADING` | 000 to 355 deg | 5 | 000 |
| `START THROTTLE` | 0 to 100% | 5 | 20% |
| `START CAMERA` | chase, cockpit, orbit | - | `CHASE` |

Radio group: `START OFF FLYING` (default) or `RUNWAY TAKEOFF`. Checkbox:
`RUNWAY`, forced on and disabled under `RUNWAY TAKEOFF`. Pitch is derived,
never set.

Every row in the table above but `START CAMERA` can be typed into as well as
stepped: a digit starts the figure, `Enter` takes it, `Backspace` erases a
character, and `Esc`, the mouse, walking the cursor to another row, or
stepping the row with `A`/`D` gives up. The figure goes through the validator
the stepping goes through, so one between two steps is refused and the row says
what is allowed - `0 KTS TO 200 KTS BY 5`.
A character the figure has no room for is turned down and leaves what is typed
where it is. A row that steps through a list holds no figure to type, which is
why the view is the one left out.

## Options

| Option | Steps through |
|--------|---------------|
| `CONTROL SENSITIVITY` | 50% to 200% |
| `ORBIT SWEEP` | `6°/S` to `36°/S`, default `12°/S` |
| `FOG DENSITY` | `CLEAR` to `THICK` |
| `WEATHER` | `CLEAR`, `CLOUDY`, `STORMY` |
| `AIRSPEED IN` | `KNOTS`, `MPH` |
| `ALTITUDE IN` | `FEET`, `METERS` |

Everything above is stored in `localStorage` and reopens with the next session.

## Control settings

The `CONTROL SETTINGS` entry, on the start screen and in the pause menu. Stored
under a key of its own, so how a pilot flies outlives which world they flew.

| Row | Steps through | Opens on |
|-----|---------------|----------|
| `PITCH AXIS` | `DIRECTIONAL`, `INVERTED` | `DIRECTIONAL` |
| `ROLL AXIS` | `DIRECTIONAL`, `INVERTED` | `DIRECTIONAL` |
| `TILT READS AXES` | On, off | Off |
| `FLY BY TILT` | `WITH NO KEYS`, `ALWAYS`, `NEVER` | `WITH NO KEYS` |
| `TILT DEADZONE` | `FINE`, `NARROW`, `NORMAL`, `WIDE`, `VERY WIDE` | `NORMAL` |
| `FULL ROTATION` | On, off | Off |
| `PITCH UP`, `PITCH DOWN`, `THROTTLE UP`, `THROTTLE DOWN` | On, off - whether each hands the aircraft back after a level off | On |
| A key row per control, plus `RESET FLIGHT` and `LEVEL OFF` | Enter, then the key it should be on | The keys above |
| `RESTORE DEFAULT KEYS` | Puts every key back where it started | - |
| `LIST ON SCREEN` | On, off - the same answer `H` gives | On |
| `CONTROL REFERENCE` | Closes the panel and shows the list of every key | - |

`DIRECTIONAL` points the key where the aircraft goes; `INVERTED` points it where
a stick would. Each axis is set on its own, and both spellings of an input turn
over together. `TILT READS AXES` carries those two settings through to a device
flown by tilting it; off, the device is the aircraft. `FLY BY TILT` says which
machines are flown by tilt at all - `WITH NO KEYS` is the machine's own answer
and the two others overrule it, and what the row holds is what was asked for
rather than what the sensor granted. `TILT DEADZONE` is how far the device is
turned before it asks for anything. `FULL ROTATION` off clamps
the nose short of the vertical and the wings at half a turn; on, either angle
crosses the limit and comes round the other side, so a loop and a barrel roll
carry on.

A key row waits for a key once it is chosen. A key another row holds is refused
and the row says which row holds it; a key the game reads for itself is refused
the same way and the row says what the key already does, as `P IS PAUSE`; `Esc`
is the way out of the wait; `Delete` leaves `RESET FLIGHT` on no key at all,
which is the only row allowed to be on none. The map is stored under a key of
its own, and the reference list is written from it.

## Worlds

| Environment | Id | Is |
|-------------|-----|-----|
| `HIGHLANDS` | `highlands` | Peaks over fBm ground, snow above 300. The default |
| `RIVER BASIN` | `river-basin` | A river the width of the world, low forested country |
| `CANYON COUNTRY` | `canyon-country` | Branching canyons in a high plateau, no standing water |
| `DUNE SEA` | `dune-sea` | Dunes, outcrops, one desert river, palm groves |
| `LAKESIDE` | `lakeside` | A town on a lake, forested hills, snow peaks |

Five more are built for the modes and kept out of the panel: `OPEN COUNTRY`,
`LOOP VALLEY`, `BACK COUNTRY`, `CANYON REACH` and `SURVEY COUNTRY`.

## Elements

| Element | Configured through |
|---------|--------------------|
| Mountain | Count, height, radius, girth, a girth range, length, width, and a bulk mode over the two axes said outright |
| Canyon | Depth, width, steepness, branches, wander |
| Desert | Dune height, crest spacing, coverage, sand gradient |
| Grass | Green gradient, height band |
| Sand | Brown gradient, height band |
| Water body | Water line, blue gradient by depth, basin pull |
| River | Blue gradient, windiness, width, depth |
| Forest | Tree height, density, grove size, grove count, canopy, band |
| Town | Block size, block count, building height, extent, gradients |
| Snow | Snow line, coverage, slope limit, white gradient |
| Runway | Length, width, heading, height band, apron, gradients |

Pipeline order: landforms, ground cover, water, cuts and built things, snow,
runway last.

## Builder canvas

A canvas carries the tools that work down the left and its own control list in
the corner. `ACCEPT AND EXIT` and `Esc` are the one way out, back to whichever
menu opened the builder, and both ask first; `Backspace` leaves the picker but
not a canvas. Once a build has been kept, `L` opens straight onto it with no
picker; choosing another world in the settings lets go of it, and the picker is
back.

| Input | Does |
|-------|------|
| Drag, or one finger, in Select | Orbit the view about the middle of the screen |
| Middle drag in Select, or `Shift` and right drag | Pan, the ground following the pointer; with any other tool live the tool waits rather than changing, so a shape half drawn is still being drawn when the pan is let go |
| Wheel | Zoom toward the ground under the pointer, out no further than the whole canvas |
| `W`/`A`/`S`/`D` or the arrows | Move across the ground, the way the view faces |
| `Home` | Back to the view the canvas opened on |
| Click, or a finger, in Select | Pick the built placement under it, keep the one picked, or let go of it on bare ground |
| Click, or a finger, in Mountain | Drop a mountain there, or put the one in hand down there instead |
| Drag a gumball handle | Move, slide, raise or spread what is in hand, whatever tool is live |
| The chevrons atop the palette | Fold the tools away to a tab, and bring them back; kept for the next canvas |
| Drag, or a finger, in Lasso | Draw a selection with the chosen lasso tool - Free, Rectangle, Ellipse, Round Rect., Triangle, Star or Polygon - or, with one live, draw within it |
| `Shift` and drag in Lasso | Add the shape to the selection |
| `Alt` and drag in Lasso | Cut the shape out of the selection |
| Drag in Lasso, then `Shift` | Keep a box square or an ellipse round |
| Click in Lasso, with Polyline or a curved tool | Place a point; click the first one again, or double click, to close the shape |
| Drag, or a finger, in Grass, Sand, Water or Snow | Lay a stroke of it with the stamp on the panel, which follows the pointer |
| Click, or a finger, in Runway | Place the chosen runway, lined up with the view; with one in hand, put it down there instead |
| Drag, or a finger, in Free Paint | Paint a stroke in the panel's colour with the brush, which follows the pointer |
| Click in Free Paint, with the eye dropper armed | Take the colour of the ground there as the brush's |
| Drag, or a finger, in Erase | Take away the target under the stroke, from what was laid before it |
| `Alt` and drag in Erase | Put back what was erased |
| Right click on the selection | Open a popup carrying `DESELECT` |
| Drag, or a finger, in Extrude | Draw a shape into the region to lift, or within the selection |
| `Shift` and drag in Extrude | Add the shape to the region |
| `Alt` and drag in Extrude | Cut the shape out of the region |
| The blue arrow, with an extrusion lifted | Pull it up or down, previewed until let go |
| Click on an extrusion, at its surfaces | Point the panel at the top or the wall, outlined red; off it, at both again |
| `Shift` and a press on a spinner | A coarse step: ten points on a percentage, ten steps on anything else |
| `Shift` and a dot or a tick | Stretch a mountain's height and spread together |
| `Esc` | End a drag being made, shut the popup, put an armed eye dropper down, or ask `ACCEPT EDITS` with an edit in hand and `SAVE AND EXIT MODE` without |
| `Enter` | Answer the question asked, on the button under the cursor |
| `H` | Collapse the control list, and open it again |

Down the right is the dock: `SELECTION MODE`, the camera written out as
fields to read and type into, or the edit in hand with `ACCEPT` and `CANCEL`
under it. Only its fields scroll, and the wheel over it scrolls them. In
Select the camera stays on top: beneath it is the placement picked, under
`SELECTED` and its name, or with nothing picked each of the world's own
elements under `WORLD:`, folded until its heading is pressed. A value changed
there changes every one of that element across the world, and `YES` on
leaving keeps it.

The two questions open on `YES`; the arrows cross to `NO`, and `Esc` or a press
off the panel calls the question off. `YES` on `ACCEPT EDITS` keeps the edit and
stays, so keeping work never doubles as leaving; `YES` on `SAVE AND EXIT MODE`
keeps what was built as the world flown and leaves. Choosing another tool with
an edit in hand asks `ACCEPT EDITS` first.

In Select, the placement under the pointer is outlined in white and the one
picked, or dropped and in hand, in blue. A press that travels more than a few
pixels orbits and picks nothing. A pick changed on the dock asks `ACCEPT EDITS`
before it is let go; one left as it was asks nothing.

The lasso's panel is its tools in the art's rows, and `DESELECT` while
something is selected. The selection is a dashed white line on the ground that
stays across tool changes until `DESELECT` drops it. A mountain dropped inside
it is cut at its edge, and a click outside it drops nothing. A selection is not
an edit, so leaving with one asks only whether to save.

Triangle, Star and Polygon stand on the press and reach to the pointer, turned
the way it went. `NUMBER OF SIDES`, `NUMBER OF POINTS`, `STAR RATIO` and a
rounded box's `CORNER` reshape the selection the tool drew, where it stands.
Curved Polygon runs a smooth curve through the points clicked and round the
loop; Curved Polyline runs it through them and closes straight back to the
start. The key held at the press says how a shape meets the selection, and
holds to the end of the shape: `Shift` adds it, `Alt` cuts it out, and neither
keeps only the ground inside both. A shape that leaves no ground selected drops
the selection. `Shift` pressed once a drag is under way squares the box or
rounds the ellipse instead, so the one key does both.

Grass, Sand, Water and Snow are one tool, each with its own panel from the
moment it is chosen: `DENSITY`, the stamp - `BUILD HEIGHT`, `BUILD WIDTH` and
`CORNER RADIUS`, in screen pixels - and `COLOR LIGHT` and `COLOR DARK`. A drag
lays the stamp swept whole along the way it went, laid at the size it is on
the screen where it was pressed, and the strokes drawn before `ACCEPT` are one
batch: `DENSITY` and the colours change all of it at once, and the stamp only
the strokes still to come. At a density below 1 the stroke breaks into clumps
with ground between them - pools, for water. Grass and sand lie on all the
ground under a stroke, whatever its height, shaded light on its low ground and
dark on its high. Water is cut into the ground at its stroke's lowest bank, so
it lies level across the stroke and runs down with the ground along it - a
stream down a slope, a pond in a hollow - pale at its banks and dark in its
middle; the sea's level stays where it was. Snow settles on any ground the
stroke crosses, thin and shadowed at its edges and white down its middle, and
stays off faces too steep to hold it. The batch carries the gumball: the
centre moves it, the squares stretch it and the arc turns it. With a selection
live the batch is clipped to it, and a stroke that reaches none of it lays
nothing. The next batch starts where the panel was left.

Insert Runway's panel is its templates as cards: `BASIC RUNWAY`, and
`COMMERCIAL`, longer and wider with a dashed centreline. Choosing a card arms
the tool, and the template's outline follows the pointer over the ground; a
click places it lined up with the view to the nearest ten degrees, its strip
levelled to the ground it lands on. `HEADING`, `LENGTH` and `WIDTH` turn and
size it, as the gumball's arc and squares do, and its centre moves it; a click
with it in hand puts it down there instead, and another card turns it into that
template where it stands. A strip is kept wholly on the canvas. The two
airports join the cards once their aprons and buildings can be drawn. A flight
that starts on a runway starts on the last one placed.

Free Paint's panel is the artwork's three groups. `COLOR SELECTION` is eight
swatches, a strip of every hue in four bands - whole, then at 75, 50 and 25
percent on white - the eye dropper, and `HEX INPUT`, which reads out the colour
and takes one typed as `#RRGGBB` or `#RGB`. `BRUSH SELECTION` is `TIP`, round
or square, and `EDGE`, hard or soft, under `DEFAULT`, which is lit while the
brush is the one the tool starts with - hard, round and 25 pixels - and puts it
back. `BRUSH PROPERTIES` is `OPACITY` as a percentage, `SIZE` in pixels with a
slider, and `BLEND`. A drag is shown on the ground as the region it will cover,
in the paint's colour, and lays a colour and no height: at `TINT` the stroke
takes the colour's hue at the ground's own lightness, so a painted slope keeps
its light and shade and black or white is the ground's own grey, and at
`NORMAL` it lays the colour as it is. The strokes before `ACCEPT` are one
batch, as a cover's are: the colour, opacity and blend change all of it, and
the brush only the strokes still to come. The eye dropper, pressed, makes the
next click on the ground take the colour there; `Esc` puts it down.

Erase's panel is `TARGET` - `ALL`, or one element - `STRENGTH` as a percentage,
and the paint brush's `TIP`, `EDGE` and `SIZE`. A drag, shown in red as it is
drawn, takes away what was laid before it under the stroke - a preset's
mountain as readily as a stroke of grass laid a minute ago - leaving the ground
as it was without it rather than painting over it; at a strength below whole it
thins what it takes. `ALL` takes every element but a runway: a strip is taken
only when `RUNWAY` is the target, and then whole, wherever the stroke reaches
it. Water erased is dry ground, even under the sea's level. `Alt` held at the
press, drawn in green, puts back: as the first stroke of a batch it hands back
what the batches before it took, and within a batch it cuts the stroke out of
the batch, so an overshoot is put right before `ACCEPT`. Something laid after a
batch is not touched by it.

While something is selected, every tool's panel carries `DESELECT` beside its
own answers - Mountain's, before a drop, is its heading over `DESELECT` alone -
and a right click on the selection opens a small popup carrying it at the
pointer. A press anywhere off the popup, or `Esc`, shuts it and drops nothing.

Extrude's panel, `EXTRUDE SHAPE`, is its seven shapes - Rectangle, Circle,
Triangle, Polygon, Star, Polyline and Polycurve, drawn as the lasso's are - the
chosen shape's own fields, and one button that reads off the stage the
extrusion is at. Drawing, it is `EXTRUDE`, greyed until the region covers some
ground: shapes drawn are one region, filled red over the canvas and not yet
ground - `Shift` adds a shape, `Alt` cuts one out, and with a selection live
the selection is the region, drawn solid red, so `EXTRUDE` is ready on arrival
and a shape is drawn within it. `EXTRUDE` levels the region to its ground's
mean and raises it, flat on top and walled at its edge, with `HEIGHT` and
`FLATTEN` on the panel and the gumball's blue arrow pulling it up or down -
shown red on the overlay as it is pulled, and the ground drawn when it is let
go. `EDIT EXTRUSION` puts the gumball away for `TOP COLOR`, `WALL COLOR` and
`BLEND`: a click on the top or the wall points the panel at that surface's
colour and `BLEND`, outlined red - the top round its rim, the wall at its foot
and its head - and a click off the extrusion points it at all three again.
Each colour row carries the eye dropper, which fills that row. `APPLY` comes
back keeping what was changed, and `BACK` comes back with the surfaces as they
were. At `TINT`, the default, each surface takes its colour's hue at the
lightness of the ground it stands on, so a wall shades down a hillside the way
the hillside does, and the wall fades to the ground's own colour at its foot;
at `NORMAL` the two colours are laid as they are. Picking another shape keeps
the extrusion lifted, asking nothing, and draws the next with it.

A pan from inside any tool - `Shift` and the right button held - moves the view
and nothing else: the tool waits, the cursor grabs, the brush and a runway's
outline are put away, and letting go puts the tool back as it was, with a
shape half drawn still being drawn and nothing committed or asked about.

Insert Runway offers `BASIC AIRPORT` and `COMMERCIAL AIRPORT` too: a strip with
an apron painted in its grey beside it and buildings standing beyond the apron,
each kept at its distance from the paving as the strip is widened, and picked
as one by any part of it.

`Shift` with a press on a spinner is a coarse step - ten points on a row read
as a percentage, 100% to 110% to 120%, and ten steps on any other row - and
`Shift` with an arrow in the element editor is the same.

What is in hand carries the gumball, in the art's colours: red east, green
north, blue up. The white centre moves it over the ground, the red and green
arrows slide it along one axis, the blue arrow makes a mountain taller rather
than lifting it, the dot on each axis spreads it and the tick stands it taller
or lower. A handle moves nothing until it has been dragged further than a
click, and holds to the same bounds the dock's rows do.

## Element editor

The world being flown as the elements it was assembled from. Enter opens an
element onto its ranges; `A`/`D` step the range under the cursor. `L` opens the
builder, which carries these rows now: in Select with nothing picked, each
element is a `WORLD:` section on the dock.

| Row | Reads |
|-----|-------|
| Span | Two rows, `MIN` and `MAX`, neither able to cross the other |
| Scalar | One row, one number |
| Gradient | Two rows, `LIGHT` and `DARK`, as a percentage of the preset's colour |
| Gated | Three rows: a switch reading `OFF` or `ON`, then its `MIN` and `MAX` |

A gated range is a pair of bounds that only sometimes applies, for a footprint
an element otherwise works out for itself. The switch opens `OFF`, where the
element draws what it always drew, and moves in one press rather than by a
fiftieth. Its bounds stay listed either way, so a range can be set up before it
is turned on. The mountain's `LENGTH` and `WIDTH` are the two: off, a peak is
the round bump `RADIUS` and `GIRTH` arrive at; on, its footprint is the one it
was asked for.

One press moves a fiftieth of what the range allows, rounded to 1, 2, or 5
times a power of ten. A range can be typed into instead: a digit starts the
figure, `Enter` takes it and draws the ground again, and the figure is read in
the units the row reads in - `150` at a gradient end is `150%`. A figure outside
the declared bounds is refused and the row says what they are.
`RESTORE THE PRESET` puts every range back. Edits belong
to the world they were made on and are not stored between sessions. Not
available while a game mode is being played: a mode brings its own ground.

## Game modes

| Mode | Stages | Objective |
|------|--------|-----------|
| `RUNWAY LANDING` | 4 | Land on the strip. Harder: further out, off the line, shorter strip, higher country, less help |
| `FLYING THROUGH LOOPS` | 4 | Fly the gates in order. Harder: more gates, tighter, closer, bending more, laid further over |
| `DEAD STICK` | 4 | Glide to the strip, engine out. Harder: less height, further out, off the line, less help |
| `CARGO RUN` | 3 | Land at each strip in turn. Harder: strips further apart, less budget, a third stop |
| `SEARCH AND RESCUE` | 3 | Find the marker and set down beside it. Harder: further out, rougher ground, a tighter ring |
| `TRAFFIC PATTERN` | 4 | Fly the circuit and hold every leg. Harder: the pattern drawn in, the legs held closer |
| `CANYON RUN` | 4 | Fly the corridor cut by cut. Harder: the ceiling down, the cut narrower, more of them |
| `PHOTO SURVEY` | 3 | Photograph each landmark from inside its window. Harder: a longer list, a tighter window |

Gate colours: green is the one the course is waiting on, amber is still to
come, dim is behind you. A crash restarts the stage.

A circuit is five legs - `TAKEOFF`, `CLIMB OUT`, `DOWNWIND`, `BASE`, `FINAL` -
each marked on how near its heading and its height it was held, and finished by
the landing rather than by crossing the threshold. The landing closes `FINAL`
too, so the arrival reports the approach's mark and the circuit's together. A
mast stands at the three turns in open air; the other two are the ends of the
strip, which is drawn there already. A canyon run counts a cut
only when it is crossed inside the walls and under the beam; over the top is
not a way through, and there is no floor. A survey counts a shot only with the
aircraft inside the height, the range and the heading the brief asked for - the
range is drawn as two circles on the ground, the other two are written on the
card.

With no engine - a dead stick, or a cargo run out of budget - the nose sets
the airspeed instead of the lever: nose down buys speed with height, nose up
spends that speed for a slower descent, and a level glide reaches about twelve
times the height it spends. A cargo run writes what is left of its budget
where the time to beat goes, and only an open throttle spends it.

Gates are laid over from the second stage on, and closed up one way across as
they are - a round hoop is the same hoop at every angle, so a gate that has to
be flown at the angle it was laid at is wider along its span than it is tall.

| Stage | Gate height against its width | Laid over up to |
|-------|-------------------------------|-----------------|
| `THREE GATES` | Round | Upright |
| `FIVE GATES` | 0.80 | 0.40 rad |
| `SEVEN GATES` | 0.66 | 0.70 rad |
| `NINE GATES` | 0.55 | 1.00 rad |

Approach guidance is withdrawn the same way: an extended centreline of eight
marks running 3200 units back down the approach and a bar across the threshold
on stage one, the bar alone on stage two, and nothing from stage three on. Both
are laid off the threshold the stage opens you out from.

The whole course is drawn on the minimap the moment the stage is laid out, in
the same three colours. A gate past the edge of the square the chart covers is
held hollow at that edge. The other two modes with something to fly to are drawn
the same way: a route's strips in the order they are landed at, and a search's
marker on its own.

| Reading | Where | Says |
|---------|-------|------|
| `TIME` / `BEST` | Objective card | The stage clock, and your best for this stage of this mode |
| `↑ LOOP 3 · 045° · 4200 ft` | Objective card | The gate the course is waiting on, while it is more than 35 degrees off the nose |
| `LOOP 3 MISSED · COME ROUND` | Objective card | You crossed the gate's plane outside the hoop, going the way the course runs |
| `LANDING · 85` | Objective card | What a landing came to, shown once the aircraft has stopped |
| `DOWN THE STRIP` `OFF THE CENTRELINE` `SINK RATE` `OFF THE STRIP` | Objective card | The four readings behind that score, each marked against its own limit |

Best times are kept per stage per mode in `localStorage`. The clock runs from
the moment a stage is laid out to the moment its objective is met, and a stage
restarted is timed from nothing.

A mode can also be opened straight from the address, at any stage it has:

```text
http://localhost:8080/index.html?mode=cargo-run&stage=2
```

| Key | Takes | Missing means |
|-----|-------|---------------|
| `mode` | A mode id - `runway-landing`, `loop-course`, `dead-stick`, `cargo-run`, `search-rescue`, or `free-flight` | Nothing is opened, and the session starts in free flight |
| `stage` | The stage number the card shows, counted from 1 | The mode opens at its first stage, the way the panel opens it |

The stage is the one on the card - `STAGE 2 OF 3` is `stage=2`. A request that
cannot be met opens nothing and writes the reason to the console rather than
opening the nearest stage instead. This is for reaching a stage without flying
the stages before it, which is the only way an automated check can read a
mode's later stages.

## API

```javascript
import { createPilot, createEnvironment, createTiledEnvironment } from './js/api/index.js';

createPilot({ scene, camera, aircraft, anchor, terrain, keymap, flight })
    .update(dt)          // returns { airspeed, altitude, verticalSpeed, heading, throttle }

createEnvironment({ environment, runway })
    .group               // one detachable Object3D
    .applyDepth(scene)   // the sky and the fog, without the ground
    .attach(aircraft)    // throws with every gap in the contract
    .register(mesh, { x, z })
    .runways[0]
    .setEnvironment(id)
    .setDaylight(phase)  // 0 to 1
    .updateWater(dt, phase)

createTiledEnvironment({ environment, tiles, size })
    .sampleHeight(x, z)  // answered by whichever square the point is over
```

```javascript
import { validateAircraftContract, TELEMETRY_FIELDS, API_VERSION } from './js/api/contract.js';

validateAircraftContract(aircraft)   // every gap at once, or []
```

The whole surface is in [docs/api.md](docs/api.md).

## Commands

| Command | Does |
|---------|------|
| `npm run serve` | Static server on `http://localhost:8080` |
| `npm run serve -- 3000` | Another port, and `PORT` works too |
| `npm test` | The whole suite, no dependencies |
| `node --test` | The same thing without npm |
| `npm run docs:api` | Builds the site's API reference page from `docs/api.md` |
| `npm run assets:builder` | Copies the builder's art into `assets/builder/`, on the machine the art is drawn on |

## Photo names

`pilot-matter-YYYYMMDD-HHMMSS.png`, for example
`pilot-matter-20260824-050709.png`.
