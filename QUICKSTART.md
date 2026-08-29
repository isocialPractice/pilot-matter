# Quickstart

`Ctrl + click` to read this on the site: [Quickstart](https://isocialpractice.github.io/pilot-matter/docs/quickstart.html)

The shortest path from a clone to a climb. Everything here is covered at
length in the [documentation](https://isocialpractice.github.io/pilot-matter/docs/index.html);
this page is what you need to be flying in about a minute.

## If you only want to fly

There is nothing to install and nothing to clone.
[Open the simulator](https://isocialpractice.github.io/pilot-matter/index.html)
and it runs.

## Run it locally

You need a modern browser with ES module support. Node 18 or newer is needed
only for the bundled server and the tests, not for the simulator itself.

```bash
git clone https://github.com/isocialPractice/pilot-matter.git
cd pilot-matter
npm run serve
```

Then open `http://localhost:8080`. Any static file server works just as well;
the bundled one is there because it needs no install and no dependencies.

## The first minute

The game opens on its start screen with the clock held at zero. Choose
`START FLIGHT`, with `Enter` or a click, and the controls are yours.

| Step | Do | Because |
|------|----|---------|
| 1 | Hold `Shift` | The flight opens at 80 knots, which is the stall speed itself. Opening the throttle is the first thing to do |
| 2 | Ease the nose down with `S` | The aircraft opens in a climb. Trading a little of it back for airspeed is what buys the lift |
| 3 | Turn with `A` and `D` | Roll, and the nose follows through a coordinated turn |
| 4 | Watch `ALTITUDE` and the ground | A gentle arrival is a landing. Flying into a hillside wrecks the aircraft |
| 5 | Press `R` | Puts the aircraft back at its starting condition, whenever it has gone wrong |

## The keys worth knowing first

| Key | Action |
|-----|--------|
| `W` `S` `A` `D` | Pitch and roll, and the arrow keys do the same |
| `Shift` `Ctrl` | Open and close the throttle lever |
| `C` | Cycle the camera: chase, cockpit, orbit |
| `P` | Pause, and open the pause menu |
| `O` | Open the settings panel |
| `R` | Reset to the starting condition |
| `F2` | Take a picture and download it |

The [full control list](https://isocialpractice.github.io/pilot-matter/docs/controls/index.html)
has the rest, and the [cheatsheet](CHEATSHEET.md) has all of it on one page.

## Try a mode

Choose `GAME MODES` from the start screen or the pause menu and pick one. Both
are four stages long, and a crash puts the stage back to its beginning rather
than ending the run.

| Mode | Objective |
|------|-----------|
| `RUNWAY LANDING` | Put the aircraft down on the strip |
| `FLYING THROUGH LOOPS` | Fly the course of loops in order |

## Where to go next

- [Controls](https://isocialpractice.github.io/pilot-matter/docs/controls/index.html)
  for every key, and the menus behind them.
- [How the flight model works](https://isocialpractice.github.io/pilot-matter/docs/flight-model.html)
  for the four rules the whole thing rests on.
- [How the terrain works](https://isocialpractice.github.io/pilot-matter/docs/terrain.html)
  for the world, the elements, and why it has no edge.
- [Simulator API](https://isocialpractice.github.io/pilot-matter/docs/api.html)
  to fly the aircraft over your own world, or your own aircraft over this one.
