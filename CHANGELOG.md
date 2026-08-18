# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
