/**
 * Weather style - the single place the weather MCP server's render_weather
 * directives land.
 *
 * The server returns three knobs:
 *   - Render Background: day | night
 *   - Render Tone:       hot | medium | cold
 *   - Precipitation Use: sunny | cloudy | stormy
 *
 * Set them in WEATHER below and every other module picks the change up:
 * sky colour and lighting, terrain vertex colours, the weather effects layer,
 * and the HUD palette. See local-weather-style/STYLE.md for the full contract.
 */

// --- The knobs ---

export const WEATHER = {
    timeOfDay:     'night',    // day | night        <- Render Background
    temperature:   'hot',      // hot | medium | cold <- Render Tone
    precipitation: 'stormy',   // sunny | cloudy | stormy <- Precipitation Use
};

// --- Tone: a per-channel tint plus the HUD accent colours ---

const TONES = {
    hot: {
        tint:   [1.14, 0.93, 0.72],
        accent: '#ff8c42',
        text:   '#ffcf9b',
        glow:   'rgba(255, 140, 66, 0.45)',
    },
    medium: {
        tint:   [1.00, 1.00, 1.00],
        accent: '#4ade80',
        text:   '#d8f5e2',
        glow:   'rgba(74, 222, 128, 0.35)',
    },
    cold: {
        tint:   [0.80, 0.93, 1.18],
        accent: '#7dd3fc',
        text:   '#dbf0ff',
        glow:   'rgba(125, 211, 252, 0.40)',
    },
};

// --- Sky: background colour, fog density and light levels ---
// Keyed [timeOfDay][precipitation]. Tone tints these on top.

const SKIES = {
    day: {
        sunny:  { background: 0x87ceeb, fog: 0.00035, key: 1.30, ambient: 0.70 },
        cloudy: { background: 0x9fabb5, fog: 0.00060, key: 0.75, ambient: 0.62 },
        stormy: { background: 0x5c626c, fog: 0.00105, key: 0.42, ambient: 0.50 },
    },
    night: {
        sunny:  { background: 0x0d1430, fog: 0.00045, key: 0.50, ambient: 0.34 },
        cloudy: { background: 0x141a28, fog: 0.00062, key: 0.40, ambient: 0.30 },
        stormy: { background: 0x1b1520, fog: 0.00080, key: 0.30, ambient: 0.26 },
    },
};

// Key light is the sun by day and the moon by night. The direction doubles as
// where the sun or moon sprite is drawn, so the two always agree.
//
// The chase camera sits above the aircraft and looks down at it, so in level
// flight the view centre is roughly 18 degrees below the horizon and only the
// top 17 degrees of the frame is sky. The moon is therefore placed low, about
// 10 degrees up and 24 degrees off the nose, which is where it can actually be
// seen. Negative x puts it on the right of the frame, clear of the HUD. The
// midday sun stays high and simply sits out of frame.
const KEY_LIGHT_COLOR    = { day: 0xfff4e0, night: 0xa9c0ff };
const KEY_LIGHT_POSITION = { day: [600, 900, 400], night: [-285, 118, 639] };
const AMBIENT_COLOR      = { day: 0x8aaccf, night: 0x2e3c66 };

// --- Precipitation: what the effects layer draws ---

const PRECIPITATION = {
    sunny:  { clouds:  0, cloudOpacity: 0.00, rainDrops:    0, lightning: false, wetness: 0.00 },
    cloudy: { clouds: 60, cloudOpacity: 0.34, rainDrops:    0, lightning: false, wetness: 0.18 },
    stormy: { clouds: 95, cloudOpacity: 0.45, rainDrops: 5200, lightning: true,  wetness: 0.38 },
};

// --- Colour helpers ---

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function hexToRgb(hex) {
    return [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255];
}

function rgbToHex([r, g, b]) {
    return (Math.round(clamp01(r) * 255) << 16)
         | (Math.round(clamp01(g) * 255) << 8)
         |  Math.round(clamp01(b) * 255);
}

/**
 * Tint a colour by the active tone. `amount` lerps between the original
 * colour (0) and the fully tinted one (1), so lights can take a softer dose
 * than surfaces.
 */
function tinted(hex, tint, amount = 1) {
    const rgb = hexToRgb(hex);
    return rgbToHex(rgb.map((c, i) => c + (c * tint[i] - c) * amount));
}

// Pull a colour toward its own grey. Rain-soaked ground reads flatter.
function desaturate(rgb, amount) {
    const grey = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
    return rgb.map((c) => c + (grey - c) * amount);
}

// --- The resolved style every other module imports ---

function resolve(weather) {
    const tone   = TONES[weather.temperature]                  ?? TONES.medium;
    const sky    = SKIES[weather.timeOfDay]?.[weather.precipitation]
                   ?? SKIES.day.sunny;
    const precip = PRECIPITATION[weather.precipitation]        ?? PRECIPITATION.sunny;
    const night  = weather.timeOfDay === 'night';

    return {
        ...weather,
        night,
        tone,
        precip,
        sky: {
            background:   tinted(sky.background, tone.tint, 0.85),
            fogDensity:   sky.fog,
            keyColor:     tinted(KEY_LIGHT_COLOR[night ? 'night' : 'day'], tone.tint, 0.5),
            keyPosition:  KEY_LIGHT_POSITION[night ? 'night' : 'day'],
            keyIntensity: sky.key,
            ambientColor: tinted(AMBIENT_COLOR[night ? 'night' : 'day'], tone.tint, 0.5),
            ambient:      sky.ambient,
        },
        // Night lighting is dim enough to swallow the airframe. Rather than add
        // a colour of its own, each part self-illuminates in a fraction of its
        // own toned colour, so it stays readable without changing hue.
        airframe: { selfLight: night ? 0.55 : 0 },
        // The celestial body the directives ask for: sun by day, moon by night.
        celestial: night
            ? { asset: 'assets/weather/moon.svg', color: 0xdce2e1, size: 900 }
            : { asset: 'assets/weather/sun.svg',  color: 0xffe9a8, size: 800 },
    };
}

export const STYLE = resolve(WEATHER);

/**
 * Terrain vertex colour for a height, with the active tone and wetness
 * applied. Shared by terrain.js and mountains.js so the two never drift.
 */
export function heightToColor(h) {
    let rgb;
    if (h < 4) {
        rgb = [0.10, 0.25, 0.65];
    } else if (h < 12) {
        rgb = [0.75, 0.68, 0.48];
    } else if (h < 130) {
        const t = h / 130;
        rgb = [0.22 + t * 0.12, 0.42 + t * 0.10, 0.12];
    } else if (h < 300) {
        const t = (h - 130) / 170;
        rgb = [0.40 + t * 0.20, 0.35 + t * 0.10, 0.25 + t * 0.10];
    } else {
        const t = Math.min(1, (h - 300) / 100);
        rgb = [0.55 + t * 0.45, 0.55 + t * 0.45, 0.60 + t * 0.40];
    }

    const { tint } = STYLE.tone;
    rgb = rgb.map((c, i) => c * tint[i]);
    rgb = desaturate(rgb, STYLE.precip.wetness);
    return rgb.map(clamp01);
}

/**
 * Push the tone's palette into the page as CSS custom properties, so the HUD
 * chrome in index.html restyles from the same knobs as the 3D scene.
 */
export function applyHudTheme() {
    const root = document.documentElement.style;
    root.setProperty('--weather-accent', STYLE.tone.accent);
    root.setProperty('--weather-text',   STYLE.tone.text);
    root.setProperty('--weather-glow',   STYLE.tone.glow);
    root.setProperty('--weather-sky',    '#' + STYLE.sky.background.toString(16).padStart(6, '0'));
    root.setProperty('--weather-panel',  STYLE.night ? 'rgba(8, 6, 12, 0.62)' : 'rgba(0, 0, 0, 0.38)');
}

// A short label for the HUD readout, e.g. "HOT / STORMY / NIGHT".
export function weatherLabel() {
    return [WEATHER.temperature, WEATHER.precipitation, WEATHER.timeOfDay]
        .join(' / ')
        .toUpperCase();
}
