# Pilot Matter ![favicon](favicon.png)

`Ctrl + click` to [play](https://isocialpractice.github.io/pilot-matter/index.html)

A browser-based 3D flight simulator built with [Three.js](https://threejs.org/). Fly over five procedurally generated worlds - highlands, a river basin, canyon country, a dune sea, and a lakeside town - each assembled out of elements that are drawn by algorithm rather than placed as assets, all rendered in real time with no build step required.

![screenshot placeholder](banner.png)

## Features

- **Arcade flight model** — pitch, roll, and bank through coordinated turns, with a throttle lever the airspeed chases
- **Airspeed-driven lift** — hold cruise speed and level flight holds altitude; let the speed decay and the wing stalls and drops
- **A flight already in the air, or held on the ground** - every flight opens at 80 knots, 1390 ft, climbing at 1260 ft/min on a heading of 000, or stopped at a runway threshold with the engine idling, whichever the start state is set to
- **Crash detection** - settle onto a hillside gently and you fly on; fly into it and the aircraft is wrecked, the controls go dead, and the flight resets itself
- **Runway landings** - put the aircraft down on the strip softly enough and square enough and it is a landing rather than an arrival, reported as a state the instruments and the game modes both read
- **Two game modes** - Runway Landing and Flying through Loops, each four stages long and each getting harder at exactly the thing it is about
- **Procedural terrain** — multi-octave fractal Brownian motion (fBm) noise generates the ground every world is drawn on
- **The world as data** - eleven environment elements (mountain, canyon, desert, grass, sand, water, river, forest, town, snow, runway), each declaring the ranges it can be configured through and the algorithm that draws it, so nothing in the world is a placed asset
- **Five assembled environments** - Highlands, River Basin, Canyon Country, Dune Sea, and Lakeside, picked from the settings panel and regenerated on the spot
- **Element vertex colouring** - every band the ground is painted in is a light-to-dark gradient of one base hue, rendered through vertex colours with no textures
- **Atmospheric fog** — exponential fog fades the world to sky blue in the distance, hiding the far ground and giving the illusion of an infinite world
- **Three camera modes** — chase, cockpit, and orbit views, cycled with the `C` key
- **Trailing chase camera** - the chase view lags behind the aircraft instead of riding a fixed offset, so turns and pitch changes swing the frame around
- **HUD** — live readout of airspeed, altitude, climb rate, compass heading, throttle (%), and camera mode, on whichever scale the settings panel is set to
- **Attitude indicator** - an artificial horizon with a pitch ladder and bank marks, reading the aircraft's own nose and wings rather than the controls behind them
- **A world with no outside** - fly at an edge and the world is carried round: the aircraft comes back in over the opposite edge at the same altitude and heading, so the fog-hidden edge can be flown at and never reached
- **Minimap** - a north-up chart of the world in the corner, with the aircraft's position and heading marked, crossing one edge and reappearing at the other the way the aircraft does
- **Photo mode** - `F2` clears every overlay off the screen for one frame and downloads the view as a PNG named for the moment it was taken
- **Engine and wind audio** - an engine note that rises with the throttle and a wind that rises faster than the airspeed behind it, muted with `M` and remembered for the next session
- **Low altitude warning** - a blinking caution over the terrain below, measured against the ground rather than sea level
- **Start screen menu** - the game opens on its name over a menu offering Start Flight, Game Modes, Controls, and Settings, with the flight held on the ramp until one is chosen
- **Pause menu** - `P` freezes the simulation behind a menu offering Resume, Reset Flight, Game Modes, Controls, and Settings
- **A mouse on both of them** - the start screen and the pause menu are worked with the pointer as well as the keys: the cursor follows the mouse across the entries and a click chooses the one under it, on one cursor the keyboard goes on moving
- **Game Modes panel** - opened from either menu, listing free flight and every mode there is, and marking the one being played
- **Settings panel** - opened with `O` or from either menu, setting the environment, the condition a flight opens in, control sensitivity, fog density, and the units the instruments read in, all remembered for the next session
- **An editable start** - the condition a flight opens in, the strip in the world, airspeed, altitude, climb, heading, throttle, and camera are fields a pilot sets rather than constants in the flight code, applied at once before launch and at the next reset after it
- **A screen you can clear** - `H` collapses the control list to a single hint line and `Tab` clears the instruments off entirely for clean flying, remembered for the next session
- **A simulator API** - the Pilot API flies the aircraft against a host's own scene, terrain, and model; the Matter API hands a host the world as one detachable group anything can fly over
- **Zero build step** — runs directly in the browser via ES modules and an import map

## Getting Started

### Prerequisites

A modern browser with ES module support (Chrome, Firefox, Edge, Safari). No Node.js, no bundler, no install needed — Three.js is loaded from a CDN.

### Running locally

Because ES modules require a server context, open the project with any static file server. The bundled one needs no install and no dependencies:

```bash
npm run serve           # http://localhost:8080
npm run serve -- 3000   # or pick another port (the PORT variable works too)
```

Any other static server works just as well:

```bash
# Python
python -m http.server 8080

# Node (npx, no install)
npx serve .

# VS Code
# Install the "Live Server" extension and click "Go Live"
```

Then open `http://localhost:8080` in your browser.

## Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Pitch up (nose up) |
| `S` / `↓` | Pitch down (nose down) |
| `A` / `←` | Roll left |
| `D` / `→` | Roll right |
| `Q` | Yaw left |
| `E` | Yaw right |
| `Shift` | Throttle up (hold to open the lever) |
| `Ctrl` | Throttle down (hold to close it) |
| `C` | Cycle camera (chase, cockpit, orbit) |
| `P` | Pause / resume, and open the pause menu |
| `O` | Open the settings panel, and close it again |
| `M` | Mute or unmute the engine and wind |
| `H` | Collapse the control list to a hint line, and open it again |
| `Tab` | Show or hide the instruments |
| `R` | Reset aircraft to starting position |
| `F2` | Take a picture: clears the screen for one frame and downloads the view as a PNG |

In any menu, `W`/`S` or `↑`/`↓` move between entries and `Enter` or `Space` chooses one. On the start screen and in the pause menu the mouse works as well: moving the pointer onto an entry puts the cursor there, and clicking one chooses it. In the settings panel, `A`/`D` or `←`/`→` step the option under the cursor through its settings. `Esc` backs out of the panel.

**Tip:** Flight begins in the air and already climbing, at 80 knots and 1390 ft with the throttle set at 20%, which is exactly the setting that holds 80 knots. That airspeed is the stall speed itself, so the wing is carrying with nothing in hand: opening the throttle is still the first thing to do. `Shift` and `Ctrl` move a lever rather than the speed itself, so the HUD throttle reads the setting you asked for while airspeed catches up to it over the next second or two. Once the needle reaches cruise speed the wing carries the aircraft and level flight holds altitude; climb with the nose, and watch the airspeed while you do, because pulling up too hard bleeds the speed the lift depends on. Keep an eye on the terrain too: a gentle arrival is a landing, but flying into a hillside wrecks the aircraft. The rules behind all of it are written out in [How the Flight Model Works](#how-the-flight-model-works).

### Loading

The page opens on a loading screen carrying the game's name, a bar, and a line naming the work in hand - building the scene, generating the world, rolling out the aircraft, calibrating the instruments, and drawing the first frame. The screen fades off on the strength of a frame the renderer has actually drawn rather than on a timer, so it is gone exactly when there is a world behind it and not a moment before.

Start-up runs in one pass with no chance for the browser to paint between the steps, so the bar is not seen creeping from one to the next: it is a width the stylesheet animates toward, and the progress behind it is real whether or not every step of it gets a frame of its own.

### Starting a flight

The game opens on its start screen, with the clock held at zero: the aircraft waits on the menu rather than climbing away behind it. The menu is flown the same way the pause menu is, and every key it sees is swallowed by the screen, so working it never also moves a control surface.

| Entry | Does |
|-------|------|
| `START FLIGHT` | Releases the clock and hands the controls over |
| `GAME MODES` | Opens the list of modes, and free flight |
| `CONTROLS` | Puts the control list on screen, over the title, before anything is flying, and takes it back off when chosen again |
| `SETTINGS` | Opens the settings panel |

The mouse works the screen too. The pointer moving onto an entry puts the cursor there and a click chooses it, so `START FLIGHT` is one click from the page loading. It is the same cursor the keys move rather than a second one beside it: a click chooses the entry it landed on whatever the keys had walked to, and the keys carry on from wherever the pointer left off. The screen is otherwise transparent to the mouse - only the menu on it takes the pointer, and the world behind it goes on being a world rather than a button.

This is the opening screen rather than a menu to come back to: once the flight has started, the way back to Game Modes, Controls, and Settings is the pause menu.

### Pausing

`P` latches the simulation clock at zero: the flight model, gravity, and the orbit camera all stop, the last frame stays on screen, and a menu opens over it. Pressing `P` again resumes from exactly where the flight left off, with the time spent paused discarded rather than applied in one jump.

The menu is flown the way the aircraft is. `W`/`S` or `↑`/`↓` move between the entries, wrapping round both ends, and `Enter` or `Space` chooses the one under the cursor. The mouse works it the same way the start screen is worked - the pointer moves the cursor and a click chooses - so a flight paused with a hand on the mouse is resumed with the same hand:

| Entry | Does |
|-------|------|
| `RESUME` | Unpauses and flies on |
| `RESET FLIGHT` | Puts the aircraft back at its starting condition and unpauses |
| `GAME MODES` | Opens the same list the start screen opens |
| `CONTROLS` | Opens the control list back up, for a screen it has been collapsed on |
| `SETTINGS` | Opens the same panel the start screen opens |

The cursor starts on `RESUME` every time the menu opens, so resuming is always one key press away from a paused flight. The pause card, like the title screen, lets the mouse through everywhere but its menu, so a click beside the entries falls on the frozen world rather than on the card over it.

### Settings

The settings panel opens on `O`, and from either menu, and holds the same choices whichever way it was opened. It is the one overlay that clears the screen it was opened from, because the point of picking an environment is seeing the environment, and it holds the simulation clock while it is up, so a setting is changed by looking at the world rather than by flying into it while looking.

The panel is in three parts. Under `ENVIRONMENT` is the world being flown: every entry is one of the five [assembled environments](#environments), the one currently in force is marked, and choosing another regenerates the ground and puts the aircraft back at its starting condition, because a new world under an aircraft mid-flight is a mountain that was not there a moment ago.

Under `START STATE` is the condition a flight opens in, which is the same condition `RESET FLIGHT` and `R` put it back into.

The first two rows are the condition itself, and only one of them can be in force. Choosing one clears the other, and the one currently set is marked the same way the world being flown is:

| Row | Opens the flight |
|-----|------------------|
| `START OFF FLYING` | Already up, in the climb the rest of the fields describe. The default |
| `RUNWAY TAKEOFF` | Stopped at a runway threshold, nose level, engine idling, on the strip's own bearing |

Under them is `RUNWAY`, a box that says whether the generated world carries a landable strip at all. Unchecked, no runway is drawn and the world has nowhere to land. `RUNWAY TAKEOFF` holds the box on for as long as it is chosen and greys it out, because a start that asked to roll out of a world with no strip in it is not a start anything could honour. Uncheck it, choose `RUNWAY TAKEOFF`, and it comes back on; go back to `START OFF FLYING` and it is off again, exactly as it was left.

The rest are read the way a pilot reads them and stepped along a range of their own:

| Field | Steps through | Opens on |
|-------|---------------|----------|
| `START AIRSPEED` | 0 to 200 knots, by 5 | 80 knots |
| `START ALTITUDE` | 0 to 8000 ft, by 10 | 1390 ft |
| `START CLIMB` | -2000 to +3000 ft/min, by 20 | +1260 ft/min |
| `START HEADING` | 000 to 355 degrees, by 5 | 000 |
| `START THROTTLE` | 0 to 100%, by 5 | 20% |
| `START CAMERA` | `CHASE`, `COCKPIT`, `ORBIT` | `CHASE` |

A range stops at its ends rather than wrapping round them, because the ends of a range mean something a list's do not: past the fastest a flight can open at is not the slowest.

A runway takeoff takes none of those six but the camera: an aircraft held on the ground has no airspeed, no altitude, and no climb of its own to set. They are still there to be edited, and they are what the flight opens in the moment `START OFF FLYING` is chosen again.

Edited from the start screen, a new start takes effect at once - the aircraft is put straight into it, so the world behind the panel shows what was set. Edited mid-flight it waits, because a start is the next flight's condition rather than this one's: carry on flying, and the next reset opens in it.

The throttle is a lever the airspeed converges on rather than the airspeed itself, so a start whose throttle asks for a different speed than it was given is flown exactly as written and then settles toward the lever over the next second or two. The pitch is not a field at all: it is worked out from the climb and the airspeed, as the attitude that holds that climb at that speed, so a start opens in the climb it was set to rather than settling out of it.

Under `OPTIONS` are the settings that hold whichever world is flown. Each is a value stepped through a list rather than a slider, so no combination of keys can land one between two settings:

| Option | Steps through | Changes |
|--------|---------------|---------|
| `CONTROL SENSITIVITY` | 50% to 200% | How far pitch, roll, and yaw move per key press. All three scale together, so the aircraft stays the same aircraft |
| `FOG DENSITY` | `CLEAR` to `THICK` | How far into the distance the world is visible. `CLEAR` is the thinnest offered rather than none at all, because the fog is what hides the world repeating |
| `AIRSPEED IN` | `KNOTS`, `MPH` | The scale the airspeed readout is on |
| `ALTITUDE IN` | `FEET`, `METERS` | The scale the altimeter and the climb rate are on |

`W`/`S` moves the cursor over all three parts as though they were one list, scrolling the panel to keep the cursor in view on a window too short to hold it. `A`/`D` steps the option under the cursor, and `Enter` steps it forward as well, because an option has no single thing to choose.

Every choice is stored in `localStorage`, so the world, the start, and the options a session ends on are the ones the next session opens on. A setting from a version that had one this one does not reads as the default on its own, without costing the others their memory, and a browser that refuses storage costs the choices their memory and nothing else.

`O`, `Esc`, or `Backspace` closes the panel, as does its own `BACK` entry.

### Game modes

`GAME MODES`, on the start screen and in the pause menu, opens a list of the flights that are played rather than flown. Choosing one lays out its world and opens its first stage; choosing `FREE FLIGHT` puts the world and the settings you chose back. The one being played is marked, the panel closes behind whatever is chosen, and `Esc` or `BACK` leaves without changing anything.

A mode brings its own world with it, so the `ENVIRONMENT` setting is not consulted while one is being played. The worlds the modes are flown over are deliberately thin - what a mode asks the pilot to read is the objective, not the scenery around it.

Every mode is four stages long, and every stage gets harder at exactly the thing its mode is about. A stage that is flown out is held on screen for a beat and then the next one is laid out; a crash puts the stage back to its beginning rather than ending the run. The card along the bottom of the screen says what is being played, what it wants, and how far through it you are.

| Mode | Objective | Gets harder at |
|------|-----------|----------------|
| `RUNWAY LANDING` | Put the aircraft down on the strip | Finding the runway, and reading the ground around it well enough to get down on it |
| `FLYING THROUGH LOOPS` | Fly the course of loops in order | Holding a line through several gates rather than flying at one at a time |

`RUNWAY LANDING` opens in the air over open country with one strip cut into it. The first stage puts the strip under the nose over flat ground; each one after it opens further out, further off the line back to it, over a shorter strip, in higher country - until the last opens with the runway behind your shoulder in ground you have to read to reach it. A landing counts when it is soft enough and square enough to be one, which is the same rule the rest of the game uses.

`FLYING THROUGH LOOPS` opens lined up on the first gate of a course laid across a shallow valley. The gate the course is waiting on is lit green, the ones still to come are amber, and the ones behind you are dim. Only the gate the course is up to counts: the objective is the course in order, so flying back through one already behind you, or skipping ahead to one further on, is not progress. Each stage lays more gates, tighter, closer together, on a course that bends more.

### Sound

The engine runs behind the flight, its note and its loudness read off the throttle lever, and the wind rises over it with airspeed - faster than the airspeed itself, so a standstill is silent and a dive is loud. Nothing is heard until the flight is started, because a browser will not let a page make a sound before a key has been pressed at it, and nothing is heard while the simulation is frozen by the pause menu, the start screen, or the settings panel: an engine running behind a paused frame would be a frame that was not paused.

`M` mutes and unmutes both, marked by an `AUDIO MUTED` line above the artificial horizon, and the choice is stored for the next session. Muting fades the levels to silence rather than tearing the sound down, so unmuting picks it back up where it was.

### Clearing the screen

Two keys take the overlays off the view. `H` collapses the control list in the bottom left corner down to a single `H - CONTROLS` line, and pressing it again brings the list back - as does the pause menu's `CONTROLS` entry, for a list whose key has been forgotten. `Tab` clears the instruments off entirely, the artificial horizon included, for a clean view out of the window; that choice is stored, so a flight that ends with the instruments off starts the next one the same way. A browser that refuses storage costs the choice its memory and nothing else.

The warnings are not part of what those keys hide. `LOW ALTITUDE`, `CRASHED`, and `LANDED` still appear over a cleared screen, because they are what a pilot needs to be told about whatever the view is set to.

### Photo mode

`F2` takes a picture of the world and downloads it as a PNG, named for the game and the moment it was taken - `pilot-matter-20260824-050709.png` - so a folder of them is in the order they were flown.

Every overlay comes off for the one frame the picture is taken in: the instruments, the artificial horizon, the minimap, the menus, the warnings, and the settings panel if it was open, whether or not they were showing a moment before. They were never in the picture to begin with - a rendered frame holds the world and nothing that sits over it on the page - but a photo mode whose screen still carried a HUD would be one that quietly lied about the file it wrote. The screen comes back on the next frame.

The key works from the flight, from a paused flight, from the settings panel, and from the start screen, because a picture is of the world whatever happens to be over it. The frame is read back inside the same pass that drew it, since a browser clears a drawing buffer once its frame has been composited; a picture the browser then refuses to download costs the pilot the picture and nothing else.

### Instruments

The HUD in the top left corner reads:

| Readout | Shows |
|---------|-------|
| `AIRSPEED` | Current speed, in knots or mph |
| `ALTITUDE` | Height above sea level, in feet or metres |
| `V/S` | Climb or descent rate per minute on the same scale as the altimeter, signed, rounded to the nearest 10 |
| `HEADING` | Compass bearing in degrees with the nearest of the eight compass points, counting clockwise from north |
| `THROTTLE` | The lever setting as a percentage, not the speed it has reached |
| `CAMERA` | The active camera mode |

The scales the first three are read on are set from the [settings panel](#settings). They are conversions of the same reading rather than a second set of tuning numbers, so the flight model never learns which scale is on the dial and the two can never drift apart.

The minimap in the top right corner is a north-up chart of the world: `+Z` is north and runs up the face, `+X` is east and runs across it, and the marker turns under a fixed card rather than the card turning under the marker. It is fitted to whichever environment is being flown, so the marker means the same thing after a world is changed as it did before. Fly at an edge and the marker crosses it and reappears at the opposite one, because [that is what the aircraft does](#the-edge-of-the-world); the red off-map reading it still carries is for a host flying the [Pilot API](#simulator-api) over a world of its own with the crossing turned off.

The attitude indicator in the bottom right corner is the artificial horizon. The ball rolls against the bank so its horizon stays where the real one is, and the ladder slides against the pitch, carrying a labelled rung every 10 degrees with a tick between them, out to 60 degrees either side. The marks around the rim read the bank angle at the index on top of the face, at 10, 20, 30, 45, and 60 degrees either side of level, and the amber wings across the middle are the aircraft itself.

It reads the direction the nose and the wings are actually pointing rather than the pitch and roll angles behind them, so the ladder shows what the aircraft is doing rather than what it was asked to do.

`Tab` clears the instruments, the minimap and the artificial horizon with them, because they are one set of instruments rather than three overlays that happen to share a screen.

Three banners share the middle of the screen, and only one of them can be true at a time. `LOW ALTITUDE` blinks whenever the aircraft is within 200 ft of the terrain directly below it, which is measured against the ground rather than sea level, so a run up a valley warns while the same altitude out over water does not. `CRASHED` appears when the ground has been hit hard enough to wreck the aircraft, and stays up until the flight resets itself. `LANDED` appears when the aircraft is down on a strip after an arrival that was a landing, and stays up until it leaves the ground again - both of them replace the low altitude warning, because once the ground has been arrived on there is nothing left to warn about. All three stay quiet while the simulation is frozen, whether by the pause menu or by a start screen whose menu has not been answered yet: there is nothing to be done about any of them while the world is holding still.

The objective card along the bottom of the screen belongs to a flight being played rather than one being flown, so a free flight never carries it. It names the mode, what the mode wants, and the stage and the gate the run is up to.

## Project Structure

```
pilot-matter/
├── index.html          # Entry point - overlay markup, import map, styles
├── js/
│   ├── main.js         # Scene setup, render loop, keys, and overlay state
│   ├── aircraft.js     # 3D model, and the frame loop the flight model drives
│   ├── flight-model.js # Pure throttle, speed convergence, lift and stall math
│   ├── config.js       # Pure simulator start state, and the fields it is set through
│   ├── flight-state.js # Pure configured start in the units the model flies in
│   ├── units.js        # Pure conversions between world units and readings
│   ├── crash.js        # Pure ground rules: impact, landing, and the crash countdown
│   ├── game-modes.js   # Pure modes, stages, run state, course, and the gate test
│   ├── rings.js        # A loop course as the hoops it is drawn with
│   ├── world-edge.js   # Pure crossing that carries the world round at its bounds
│   ├── input-map.js    # Pure keybinding map and keyboard-to-input-state mapping
│   ├── pause.js        # Pure pause toggle and frozen simulation clock
│   ├── title-screen.js # Pure start rules and the held pre-flight clock
│   ├── menu.js         # Pure keyboard and pointer menu, and the list any menu is drawn into
│   ├── settings.js     # Pure settings panel state, its options, and their storage
│   ├── loading.js      # Pure start-up progress, and the screen it is drawn on
│   ├── audio.js        # Pure engine and wind mix, and the graph it is played through
│   ├── controls-help.js# Pure collapse toggle for the on-screen control list
│   ├── hud-visibility.js # Pure instrument toggle and its stored choice
│   ├── photo.js        # Pure photo mode state and filename, and the download
│   ├── terrain-math.js # Pure noise, fBm, height curve, and mountain bump math
│   ├── terrain.js      # An assembled environment as scene geometry
│   ├── mountains.js    # Pure mountain density formula (~10% coverage)
│   ├── environment/
│   │   ├── elements.js # Pure element registry, the field, and every generator
│   │   └── presets.js  # Pure assembled environments, and the builder
│   ├── api/
│   │   ├── index.js    # The public entry point, re-exporting both halves
│   │   ├── contract.js # Pure option defaults, contract checks, and telemetry
│   │   ├── pilot.js    # Pilot API: the aircraft, without the world
│   │   └── matter.js   # Matter API: the world, without the aircraft
│   ├── camera-math.js  # Pure camera modes and framerate-independent damping
│   ├── camera.js       # Chase, cockpit, and orbit cameras
│   ├── sky.js          # Lighting, atmospheric fog, and the standalone depth
│   ├── attitude.js     # Pure artificial horizon geometry, and its SVG face
│   ├── minimap.js      # Pure world-to-chart projection, and its SVG face
│   └── hud.js          # On-screen instrument display and warnings
├── docs/
│   └── api.md          # The whole API surface, and its stability guarantee
├── tools/
│   └── serve.mjs       # Zero-dependency static server behind `npm run serve`
└── test/               # Zero-dependency node:test unit tests
```

## Testing

Unit tests cover the pure logic (unit conversions in both directions and on
both scales, heading and climb rate readouts, the low altitude warning, the
artificial horizon's angles and ladder, the minimap's projection and its
behaviour at the world's edge, the keybinding map, control rates at every
sensitivity, the configured start state and the attitude that holds its climb,
a start edited to any other condition and the attitude that holds that one,
throttle and lift math, the engine and wind mix and its mute, the crash
threshold and countdown, the touchdown rules that tell a landing from a crash,
the geometry of a runway and the search that sites one, the takeoff a flight is
held at, the crossing that carries the world round at its edges,
photo mode's state and the names it writes, camera damping, pause toggling, the
start screen's rules, start-up progress, menu selection by key and by pointer
and the one cursor they share, the settings panel with
its options, its start state fields, its radio group and its held box, and their
stored choices, the game modes with their stages, their runs, their courses, and
the gate test, terrain noise and
the mountain formula, the element registry and every generator it holds, the
assembled environments, the API's option defaults and contract checks, the
API document against the surface it describes, page metadata, and the static
server's path and content type rules) and run on Node 18+ with no dependencies
to install:

```bash
npm test        # or: node --test
```

## How the Flight Model Works

The physics is arcade, not aerodynamic: there is no angle of attack, no drag polar, and no engine model. Four rules carry the whole thing, and all four live in `js/flight-model.js` and `js/crash.js` as plain functions with no Three.js dependency, so they can be unit tested in Node.

Speeds below are given in world units per second, with the HUD reading in knots at two knots per unit.

### The throttle is a setting, not a shove

`Shift` and `Ctrl` move a lever between 0 and 100%, at a rate that takes two seconds to sweep the whole travel. The lever picks a target speed - 100% asks for 200 units/s, 50% asks for 100 - and airspeed then converges on that target rather than jumping to it. The engine pulls harder than drag pushes back, so speed builds faster than it bleeds off.

This is why the HUD throttle reads the setting you asked for while the airspeed needle is still catching up, and why a closed throttle is a request for a dead stop rather than a request to coast.

### Lift is read off airspeed

Lift rises with the square of airspeed and is capped at the weight of the aircraft, so:

- **At or above cruise speed (120 units/s)** lift cancels gravity exactly, and level flight holds altitude. Extra speed never lifts on its own, so a fast pass stays level instead of ballooning; climbing is done with the nose.
- **Below cruise speed** lift only covers part of the weight, and the aircraft sinks by the difference.
- **At a standstill** there is no lift at all and the full weight pulls down.

Climbing is therefore a trade rather than a free gain: pulling the nose up spends airspeed, and spending too much of it costs the lift the climb depends on.

### Below the stall speed the wing gives up

Under 40 units/s the wing is stalled and the sink rate is multiplied on top of the lost lift, easing in from no penalty at the stall speed up to double at a dead stop. The penalty eases rather than snapping on, so a stall is a mush and a sag rather than a switch being thrown.

Every flight starts at exactly 40 units/s, which is 80 knots and the stall speed itself: the wing is carrying, but there is nothing in hand. Opening the throttle is still the first thing to do.

### The start is a condition, not a set of numbers

The start is data rather than a set of literals scattered through the flight code. It lives in `js/config.js` as one object, written the way a pilot reads it - 80 knots, 1390 ft, +1260 ft/min, heading 000, 20% throttle, chase camera - and converted into world units by the same factors the instruments read back through, so the HUD shows those numbers on the first frame rather than something near them.

The same file declares what each of those fields is allowed to be: its range, the step it moves by, and the units it is read in. That is what lets the [settings panel](#settings) offer the start without knowing anything about flight, and what a host embedding the [Pilot API](#simulator-api) reads to offer it its own way.

Two of the values are held to the flight model rather than declared at it. The throttle setting is the one that asks for exactly 80 knots, so airspeed is not converging on anything when the flight begins. The pitch is not configured at all: it is the angle that turns enough of 80 knots into height to cover both the 1260 ft/min climb and the sink the wing is losing at that airspeed, worked out from whatever climb and airspeed the start was set to. The result is a flight that holds its opening condition until the pilot changes it, rather than settling out of it over the first second.

`R`, and the pause menu's `RESET FLIGHT`, put the aircraft back into that same condition, the camera it opens in included.

### The ground is not a floor

Arriving at the terrain is only a crash if it is arrived at hard. Coming down slower than 30 units/s is survived: the aircraft keeps its 5 units of ground clearance and flies on, which means an engine-out settle onto a hillside is not fatal, because the worst the flight model can sink without the nose pointing down is the 24 units/s of a dead-stop stall.

Coming down faster than that - which takes a dive, since it can only be reached by pointing the nose at the ground and adding speed to it - wrecks the aircraft. The controls go dead, the throttle and airspeed drop to zero, the wreck stays where it hit for two and a half seconds behind a `CRASHED` banner, and then the flight resets to its starting condition. Pressing `R` skips the wait. Pausing holds the countdown rather than letting it run out behind the paused frame.

### A runway changes what an arrival means

A strip does not raise the bar for how hard an arrival may be so much as give it somewhere to be something else. On a runway, an arrival is one of three things:

| Arriving | Is |
|----------|-----|
| Slower than 18 units/s, wings within 11 degrees of level, nose within 15 degrees of the horizon, heading within 25 degrees of the strip | A **landing** |
| Firmer than that, but slower than 48 units/s | A rollout - the aircraft is down and flying on, and nothing is counted |
| Faster than 48 units/s | A **crash**, the same as anywhere else |

Prepared ground takes an arrival a hillside would not, which is why the crash threshold on a strip is 48 rather than 30. The gap between 18 and 48 is what makes a landing something to fly well rather than something that happens to anyone who reaches the runway.

Landing either way down the strip counts: a runway has two thresholds rather than a start and a finish, and the heading is measured to whichever end is nearer. All four limits are read off the aircraft's own nose and wings rather than off the controls behind them, so what is judged is how the aircraft was actually being held.

Only the frame the aircraft arrives on is judged. Everything after it is a rollout, and a rollout is not a second arrival - judging every frame of one would turn a landing into a crash as the airspeed, and with it the lift holding the aircraft up, bled away underneath it. `LANDED` stays on screen until the aircraft leaves the ground again.

## How the Terrain Works

The ground is a `16000 x 16000` unit `PlaneGeometry` (200 x 200 segments) whose vertices are displaced vertically by a **fractal Brownian motion** function - seven octaves of smooth value noise layered together. Low-frequency octaves define broad valleys and mountain ranges; high-frequency octaves add fine surface detail. A remapping curve flattens values below a threshold into wide plains and water, then exaggerates values above the threshold into steep peaks.

The noise, the remapping curve, and the mountain falloff live in `js/terrain-math.js` as plain functions with no Three.js dependency, so the world's shape can be unit tested in Node.

Everything drawn over that base ground is an **environment element**.

### Elements

An element is not a model, a texture, or a placed asset. It is a registry entry in `js/environment/elements.js` carrying two things: the ranges it can be configured through, and the algorithm that draws it into a height and colour field. Adding a landform to the world means adding an entry, not another bespoke terrain pass, and reconfiguring one means changing a number rather than commissioning new art.

| Element | Configured through |
|---------|--------------------|
| **Mountain** | Peak count, a height range, a radius range, and a girth that stretches a peak along an axis of its own |
| **Canyon** | A depth range, a width range, a steepness, a branch count, and how far the cut wanders |
| **Desert** | A dune height range, the spacing between crests, how much of the world the dune sea covers, and a sand gradient |
| **Grass** | A green gradient, and the height band it covers |
| **Sand** | A brown gradient, and the height band it covers |
| **Water body** | A water line, a blue gradient read by depth, and how far the basin is pulled up to a flat surface |
| **River** | A blue gradient, a windiness, a width range, and a depth range |
| **Forest** | A tree height range, a density, a grove size range, a grove count, a canopy gradient, and the height band trees will grow in |
| **Town** | A block size, how many blocks are built on, a building height range, the extent of the site, and building and street gradients |
| **Snow** | A snow line, a coverage, the steepest ground snow will hold on to, and a white gradient |
| **Runway** | A length range, a width range, a heading range, the height band a strip may be built in, how far the graded apron reaches, and pavement and paint gradients |

Three rules hold across all of them:

- **Every colour is a gradient of one base hue.** An element declares a `light` and a `dark` end of the same colour and blends between them, so nothing shifts hue dramatically across the ground it covers.
- **Nothing is symmetrical.** Rivers and canyons wander on three waves whose lengths share no common multiple, forests are outlined by three lobes at frequencies that share none either, and dune crests are pushed off their axis by noise. There is no repeating pattern to spot from the air.
- **The order is the pipeline's, not the preset's.** A preset lists the elements it wants and the builder applies them in a fixed order: landforms shaped first, then ground cover laid over them, then water filling what is left below its line, then the cuts and the built things, then snow, and the runway cut last of all over whatever else claimed the ground, because a strip is the one thing in the world that is kept clear. An element never has to know what a preset put beside it.

Mountain density, when a preset does not name a count, is still the formula it has always been:

```
count = (terrainArea x 0.10) / (pi x avgRadius^2)  ~  14 to 15 mountains
```

The runway is the one element that chooses where it goes rather than being scattered. Sixty-odd sites are drawn from the world's own seeded stream, each measured at twenty-seven points across the whole footprint of the strip rather than under the middle of it, and the flattest one wins - because what a runway needs is not a particular place but ground that does not move under it. A site outside the height band a strip may be built in is charged for the part of it that lies outside rather than thrown away, so a world with no ground inside the band gets the best ground it has instead of getting no runway at all. The pavement is then levelled dead flat to the site's own height and the apron either side eases back into whatever was there, so a strip sits in the country rather than on a plinth.

A world is generated without a strip unless one is asked for. In the game that is the `RUNWAY` box in the [settings panel](#settings); through the [Matter API](#simulator-api) it is the `runway` option.

### Environments

An assembled environment is a name, a seed, the base ground it is drawn on, and the elements placed over it. It carries no geometry: the world is generated from that description every time it is flown, which is why switching one from the settings panel takes a few tens of milliseconds and no download.

| Environment | Is |
|-------------|-----|
| `HIGHLANDS` | fBm ground under scattered peaks, with snow above 300. The world the simulator has always generated, and the one a fresh install opens on |
| `RIVER BASIN` | A meandering river the width of the world, through low forested country |
| `CANYON COUNTRY` | A branching canyon system cut into a high plateau. The only one of the five with no standing water in it |
| `DUNE SEA` | Wind-blown dunes and rock outcrops, cut by one desert river with palm groves along it |
| `LAKESIDE` | A town on the shore of a wide lake, under forested hills and snow-capped peaks |

The seed is what makes a world reproducible: the same preset lays out the same peaks, the same river, and the same streets every time, so a place worth flying back to is still there.

Two more environments are built for the [game modes](#game-modes) rather than to be chosen between, and are kept out of the settings panel because a mode brings its own ground with it: `OPEN COUNTRY`, low rolling ground under a wide sky with one strip cut into it, and `LOOP VALLEY`, a shallow valley with the air over it left clear. Both are deliberately thin - four elements and three - because what a mode asks the pilot to read is the objective, not the scenery around it. A stage builds its preset with a seed of its own, so four stages of one mode are four worlds rather than the same one four times.

### The edge of the world

The ground is a square, and past it there is nothing to sample: an aircraft flown far enough would find itself over a flat nothing that the fog had been promising was more world. Rather than fence the pilot in, the world is carried round. Crossing an edge puts the aircraft back in over the opposite one, at the same distance past it, at the same altitude, on the same heading, and at the same airspeed. The edge can be flown at, and flown over, and never reached.

Only the horizontal position moves, because the altitude, the attitude, and the heading are the flight, and a flight that changed when the map ran out would be a fence with extra steps. The two axes are carried on their own, so a corner crossed diagonally comes back in at the opposite corner rather than at whichever of its two edges was crossed first. Sitting exactly on a boundary is still inside the world: a position that has only reached the edge has not crossed it.

The world does not repeat seamlessly - the ground at one edge has nothing to do with the ground at the other, so the crossing is a cut rather than a join, and the chase camera cuts with it rather than flying the width of the world to catch up. It is a long way to fly: the square is 16000 units across and cruise speed is 120 units per second, so the nearest edge is more than a minute away from the middle. What the crossing replaces is the older behaviour, where the minimap marker held the edge and turned red because there was genuinely nothing left to fly over.

The [Pilot API](#simulator-api) does the same for a host's own terrain, from the bounds that terrain declares, and a host whose world continues past what it declared turns it off with `wrap: false`.

## Simulator API

The simulator is two halves that can be used without each other, and `js/api/index.js` is the one module a host page imports to get either.

The **Pilot API** is the aircraft: the flight model, the controls, and the telemetry, flown against a scene, a terrain, and an aircraft model the host supplies.

```javascript
import { createPilot } from './js/api/index.js';

const pilot = createPilot({
    scene,                                  // your scene
    camera,                                 // optional, placed behind the aircraft
    aircraft: myModel,                      // any Object3D, or a loader result
    anchor: { x: 0, y: 0, z: 0 },           // the point in it the flight model moves
    terrain: {                              // your world, or none for flat ground
        sampleHeight: (x, z) => myHeightAt(x, z),
        bounds: { minX: -5000, maxX: 5000, minZ: -5000, maxZ: 5000 }
    },
    keymap: { yawLeft: ['KeyZ'] },          // remap what you like, keep the rest
    flight: { sensitivity: 1.5 }            // how hard the controls bite, 0.1 to 4
});

function frame(dt) {
    const { airspeed, altitude, verticalSpeed, heading, throttle } = pilot.update(dt);
    myHud.render({ airspeed, altitude, verticalSpeed, heading, throttle });
}
```

The **Matter API** is the world: an assembled environment as one detachable group, a height sampler for whatever is flying over it, and a contract any aircraft can satisfy, including one driven by a control API that has never heard of this one.

```javascript
import { createEnvironment } from './js/api/index.js';

const world = createEnvironment({ environment: 'lakeside', runway: true });

scene.add(world.group);
world.applyDepth(scene);                    // the sky and the fog, without the ground
world.register(myWindsock, { x: 400, z: -900 });  // set down on the ground, not over it

const flown = world.attach(myAircraft);     // throws with every gap in the contract
myFlightModel.setGroundHeight(flown.groundHeight());

world.runways[0];                           // the strip it cut, for something to land on
world.setEnvironment('dune-sea');           // regenerated in place, registered assets settled
```

Everything under `js/api/contract.js` is pure and imports no renderer, so a host can check its own options, its own aircraft, or the shape of its telemetry with nothing loaded:

```javascript
import { validateAircraftContract, TELEMETRY_FIELDS } from './js/api/contract.js';

const problems = validateAircraftContract(myAircraft);   // every gap at once, or []
```

The rules the bundled game is played by are published too, and they are pure as well: the touchdown rules that tell a landing from a crash, the strips they are read against, and the modes, stages, courses, and gate test in `js/game-modes.js`. A host can play them against its own renderer, or read them as a worked example of a game built on the two halves.

The whole surface is written out in [docs/api.md](docs/api.md): every option and everything that comes back for both halves, the contracts, the configured start, the runways and the landing rules, the game modes, the worlds and the elements, what the stability guarantee does and does not cover, and a worked host page for each half.

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| [Three.js](https://threejs.org/) | 0.160.0 | 3D rendering |

No frameworks, no bundler, no dependencies beyond Three.js.

## License

MIT
