# Local Weather Style

How to restyle this application from the weather MCP server's `render_weather`
directives. Read this first on every call, then change only what the directives
ask for.

## Application architecture

A zero-build browser app. `index.html` loads Three.js from a CDN through an
import map and starts one ES module, `js/main.js`. There is no bundler, no
package manager and no test suite - editing a file and reloading the page is
the whole build.

| File | Role |
| --- | --- |
| `index.html` | Page shell, HUD markup, and all CSS for the HUD chrome |
| `js/main.js` | `FlightSimulator` - builds the scene, owns the animation loop |
| `js/weather-style.js` | **The style contract. Every weather knob lives here.** |
| `js/sky.js` | Background colour, fog, key light, ambient light, lightning flash |
| `js/weather.js` | Effects layer - cloud deck, rain, sun or moon, storm timing |
| `js/terrain.js` | Procedural fBm heightfield with vertex colours |
| `js/mountains.js` | Adds radial mountain bumps on top of the terrain |
| `js/aircraft.js` | Flight model, airframe geometry and materials |
| `js/camera.js` | Chase camera |
| `js/hud.js` | Writes live values into the HUD spans |
| `assets/weather/` | SVG assets copied from the weather server |

Rendering is a single `THREE.Scene` with `MeshLambertMaterial` terrain coloured
purely by per-vertex colours, one `DirectionalLight` as the key, one
`AmbientLight` as fill, and `FogExp2` to fade the world out at distance. No
textures, no post-processing, no shadow maps.

## The style contract

`js/weather-style.js` is the single place the directives land. Everything else
imports from it and must stay free of hard-coded weather colours.

```js
export const WEATHER = {
    timeOfDay:     'night',    // day | night             <- Render Background
    temperature:   'hot',      // hot | medium | cold     <- Render Tone
    precipitation: 'stormy',   // sunny | cloudy | stormy <- Precipitation Use
};
```

Three lookup tables turn those knobs into a resolved style:

- `TONES` - a per-channel RGB tint plus the HUD accent, text and glow colours.
  The tint is multiplied into terrain vertex colours, the airframe, the cloud
  deck, the rain and the lights, which is what makes one knob repaint the whole
  scene.
- `SKIES` - background colour, fog density, key intensity and ambient intensity,
  keyed `[timeOfDay][precipitation]`. Tone tints the result.
- `PRECIPITATION` - cloud count and opacity, rain drop count, whether lightning
  runs, and a `wetness` value that desaturates the ground.

Two further constants sit alongside them:

- `KEY_LIGHT_POSITION` - the key light direction, which doubles as where the sun
  or moon sprite is drawn so the two always agree. **This is the one value with
  a hard constraint.** The chase camera sits above the aircraft and looks down
  at it, so in level flight the view centre is about 18 degrees below the
  horizon and only the top 17 degrees of the frame is sky. A celestial body
  above roughly 15 degrees of elevation is never on screen. Negative `x` puts it
  on the right of the frame, clear of the HUD.
- `airframe.selfLight` - how much of its own toned colour each airframe part
  emits. Night lighting is dim enough to swallow the aircraft entirely, and
  self-illuminating in its own colour keeps it readable without shifting its
  hue the way a fixed emissive colour does.

Cloud and rain geometry - deck height, sprite sizes, drop count spacing, wind -
lives in the constants at the top of `js/weather.js`, not in the style module.
Those are layout, not palette.

It exports:

| Export | Used by |
| --- | --- |
| `STYLE` | The resolved style object, read by every other module |
| `heightToColor(h)` | `terrain.js` and `mountains.js` - shared so they cannot drift |
| `applyHudTheme()` | `main.js` - writes `--weather-*` CSS custom properties |
| `weatherLabel()` | `hud.js` - the `WEATHER` readout line |

## Current styling, before any weather is applied

The stock look is a clear blue day: sky and fog `#87ceeb` at density `0.00035`,
a warm white key light at intensity `1.3`, a cool ambient fill at `0.7`, and
terrain banded by height from deep blue water through sand, grass, rock and
snow. The HUD is monospace green on translucent black panels. That baseline
lives in the `medium` / `day` / `sunny` cells of the tables, so setting those
three knobs restores it exactly.

## How to apply the directives next time

1. **Edit `WEATHER` in `js/weather-style.js`.** Map the directives straight
   across: `Render Background` to `timeOfDay`, `Render Tone` to `temperature`,
   `Precipitation Use` to `precipitation`. For most calls this is the only edit
   needed - the tables already cover every combination.
2. **Copy any newly required asset** from the weather server's `assets/` folder
   into `assets/weather/`. The server's asset rules for a game-like app are:
   - `cloud.svg` when precipitation is `cloudy` or `stormy`
   - `snow.svg` when the tone is `cold`, otherwise `rain.svg`
   - `sun.svg` by day, `moon.svg` by night
3. **Add `width` and `height` attributes** to the root `<svg>` of each copied
   asset, matching its `viewBox` aspect ratio. The source files carry only a
   `viewBox`, and a browser renders those at a default 300x150 when used as a
   texture, which distorts them. Everything else in the file is copied verbatim.
4. **Only edit a table if a combination looks wrong on screen.** Tune the cell,
   not the module that reads it.
5. **Reload the page.** There is no build step.

### What each knob is expected to change

| Knob | Visible effect |
| --- | --- |
| `timeOfDay` | Sky and fog colour, key light colour, direction and intensity, ambient level, airframe self-illumination, and whether the sun or the moon sprite is drawn |
| `temperature` | RGB tint across terrain, airframe, clouds, rain and lights, plus the HUD accent, text and glow |
| `precipitation` | Fog density, cloud count and opacity, rain drop count, ground desaturation, and whether lightning runs |

## Rules for future changes

- Never hard-code a weather colour outside `js/weather-style.js`. If a module
  needs one, add it to the resolved `STYLE` object and import it.
- Terrain and mountain colours must both come from `heightToColor`. They share
  one function so a raised vertex always matches the ground it rose out of.
- HUD colours come from the `--weather-*` custom properties, never from literal
  values in `index.html` beyond the `:root` fallbacks.
- The effects layer follows the camera. Rain and the celestial sprite are
  repositioned onto the camera every frame and the cloud deck wraps around it,
  so the aircraft can never fly out of the weather.
- Keep `js/weather.js` fail-soft. A missing SVG falls back to a generated blob
  and logs a warning rather than breaking the scene.
- Clamp the frame delta and wrap positions modularly. A hidden tab or a stalled
  machine hands the loop a delta of several seconds, and a single-step wrap
  cannot pull a sprite back from that far outside its box - the whole weather
  layer disappears in one frame and never returns.
- Keep rain off the lens. A drop seeded clear of the camera still drifts into it
  under wind shear, so the clearance check belongs in the per-frame update, not
  only in the seeding.
- Fog density sets the useful working distance. At the stormy night value the
  world fades out by roughly 1500 units, so anything meant to be seen - the
  cloud deck especially - has to sit inside that or it is invisible no matter
  how opaque it is.
