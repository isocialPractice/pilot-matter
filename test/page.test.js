import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TITLE_NAME, START_HINT } from '../js/title-screen.js';
import { HELP_HINT } from '../js/controls-help.js';
import { FACE_RADIUS } from '../js/attitude.js';
import {
    SETTINGS_TITLE, SETTINGS_HEADING, SETTINGS_START_HEADING, SETTINGS_OPTIONS_HEADING
} from '../js/settings.js';
import { PHOTO_KEY } from '../js/photo.js';
import { MINIMAP_SIZE } from '../js/minimap.js';
import { LOADING_STEPS, LOADING_FADE_MS } from '../js/loading.js';
import { MUTE_KEY } from '../js/audio.js';
import { SETTINGS_OPEN_KEYS } from '../js/settings.js';
import { SPEED_UNITS, ALTITUDE_UNITS } from '../js/units.js';

const indexHtml = readFileSync(
    fileURLToPath(new URL('../index.html', import.meta.url)),
    'utf8'
);
const manifest = JSON.parse(readFileSync(
    fileURLToPath(new URL('../package.json', import.meta.url)),
    'utf8'
));
const hudSource = readFileSync(
    fileURLToPath(new URL('../js/hud.js', import.meta.url)),
    'utf8'
);

// Every script under js/, folders included, so a module that reaches for an
// element from a subfolder is checked the same way the top-level ones are.
function collectScripts(directory, prefix = '') {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) return collectScripts(path, `${prefix}${entry.name}/`);
        if (!entry.name.endsWith('.js')) return [];
        return [{ name: `${prefix}${entry.name}`, source: readFileSync(path, 'utf8') }];
    });
}

const scriptDir = fileURLToPath(new URL('../js', import.meta.url));
const scripts = collectScripts(scriptDir);

// The browser tab shows the title next to the favicon, so the two should
// name the same thing rather than a leftover working title.
test('the page title is the name of the game', () => {
    const match = indexHtml.match(/<title>([^<]*)<\/title>/);
    assert.ok(match, 'index.html should have a title');
    assert.equal(match[1].trim(), 'Pilot Matter');
});

test('the title matches the name the manifest ships under', () => {
    assert.equal(manifest.name, 'pilot-matter');
});

test('the page still points at the favicon the title sits beside', () => {
    assert.ok(/rel="icon"/.test(indexHtml), 'index.html should link a favicon');
    assert.ok(indexHtml.includes('favicon.png'), 'the favicon link should resolve to favicon.png');
});

test('the page keeps a description for link previews', () => {
    const match = indexHtml.match(/<meta name="description" content="([^"]*)"/);
    assert.ok(match, 'index.html should carry a description');
    assert.ok(match[1].startsWith('Pilot Matter'), 'the description should lead with the game name');
});

// The HUD writes into elements it looks up by id, so a readout added to one
// file and not the other is a blank instrument at best and a crash at worst.
test('every element the HUD writes to exists on the page', () => {
    const ids = [...hudSource.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);
    assert.ok(ids.length > 0, 'the HUD should look up its elements by id');
    for (const id of ids) {
        assert.ok(indexHtml.includes(`id="${id}"`), `index.html is missing id="${id}"`);
    }
});

test('the instrument readout is labelled for every value the HUD reports', () => {
    for (const label of ['AIRSPEED', 'ALTITUDE', 'V/S', 'HEADING', 'THROTTLE', 'CAMERA']) {
        assert.ok(indexHtml.includes(`${label}:`), `the HUD should label ${label}`);
    }
    assert.ok(/ft\/min/.test(indexHtml), 'the vertical speed indicator should name its units');
    assert.ok(/&deg;|°/.test(indexHtml), 'the heading should be read in degrees');
});

test('the warning overlays start hidden and wait for the flight to trip them', () => {
    for (const id of ['low-altitude', 'crashed']) {
        const rule = indexHtml.match(new RegExp(`#${id}\\s*\\{([^}]*)\\}`));
        assert.ok(rule, `index.html should style #${id}`);
        assert.ok(/display:\s*none/.test(rule[1]), `#${id} should start hidden`);
    }
});

// Every overlay is placed by the code that knows whether it belongs on
// screen. Starting hidden means a page whose scripts never arrive shows an
// honest nothing rather than a HUD reading zero over an empty world.
test('the overlays the simulator places start hidden and wait to be placed', () => {
    for (const id of ['title-screen', 'paused', 'settings', 'hud', 'attitude', 'minimap',
        'audio-muted', 'controls-help', 'controls-help-hint']) {
        const rule = indexHtml.match(new RegExp(`#${id}\\s*\\{([^}]*)\\}`));
        assert.ok(rule, `index.html should style #${id}`);
        assert.ok(/display:\s*none/.test(rule[1]), `#${id} should start hidden`);
    }
});

// Every script looks its elements up by id, so an element renamed in one file
// and not the other is a dead overlay at best and a crash at worst.
test('every element the scripts reach for exists on the page', () => {
    for (const { name, source } of scripts) {
        const ids = [
            ...source.matchAll(/getElementById\('([^']+)'\)/g),
            ...source.matchAll(/querySelector\('#([^']+)'\)/g)
        ].map(match => match[1]);

        for (const id of ids) {
            assert.ok(indexHtml.includes(`id="${id}"`), `index.html is missing id="${id}", asked for by js/${name}`);
        }
    }
});

test('the title screen names the game and says how to work the menu on it', () => {
    assert.ok(indexHtml.includes(TITLE_NAME), 'the title screen should name the game');
    assert.ok(indexHtml.includes(START_HINT), 'the title screen should say how its menu is worked');
});

test('the settings panel is titled and says what it is setting', () => {
    assert.ok(indexHtml.includes(SETTINGS_TITLE), 'the panel should carry its title');
    for (const heading of [SETTINGS_HEADING, SETTINGS_START_HEADING, SETTINGS_OPTIONS_HEADING]) {
        assert.ok(indexHtml.includes(heading), `the panel should name what its ${heading} list changes`);
    }
});

test('every menu the panel splits its entries across has a list to be drawn into', () => {
    for (const id of ['settings-menu', 'settings-start', 'settings-options']) {
        assert.ok(new RegExp(`<ul id="${id}">\\s*</ul>`).test(indexHtml),
            `the entries are drawn from js/menu.js, so the page should leave #${id} empty`);
    }
});

// The instruments are read on whichever scale the panel is set to, so the
// units beside the numbers have to be something the HUD can rewrite.
test('every readout with a scale has the scale in an element of its own', () => {
    for (const id of ['hud-speed-unit', 'hud-altitude-unit', 'hud-vertical-speed-unit']) {
        assert.ok(indexHtml.includes(`id="${id}"`), `index.html is missing id="${id}"`);
    }

    const labels = [
        ...Object.values(SPEED_UNITS).map(scale => scale.label),
        ...Object.values(ALTITUDE_UNITS).map(scale => scale.label)
    ];
    assert.ok(labels.some(label => indexHtml.includes(`>${label}</span>`)),
        'the page should open on a scale the instruments know');
});

// The map is drawn in the units its projection works in, so a face drawn at a
// different scale would put the marker somewhere the aircraft is not.
test('the minimap face is drawn at the size the projection places points in', () => {
    const face = indexHtml.match(/<rect class="minimap-face"[^>]*width="(\d+)"[^>]*height="(\d+)"/);
    assert.ok(face, 'index.html should draw the face the marker moves over');
    assert.equal(Number(face[1]), MINIMAP_SIZE, 'the drawn face and js/minimap.js should be one size');
    assert.equal(Number(face[2]), MINIMAP_SIZE);
});

test('the loading screen has a bar to fill and a label to write into', () => {
    for (const id of ['loading', 'loading-bar', 'loading-label']) {
        assert.ok(indexHtml.includes(`id="${id}"`), `index.html is missing id="${id}"`);
    }
    assert.ok(indexHtml.includes(LOADING_STEPS[0].label),
        'the screen should open on the first thing the start-up does');
});

// The fade is the stylesheet's to run and the removal is the script's to time,
// so a transition either side of what js/loading.js waits for would either cut
// the fade off or leave the screen lying over the world after it.
test('the fade the screen is taken off by is the one the script waits out', () => {
    const rule = indexHtml.match(/#loading\s*\{([^}]*)\}/);
    assert.ok(rule, 'index.html should style #loading');

    const transition = rule[1].match(/transition:\s*opacity\s+(\d+)ms/);
    assert.ok(transition, '#loading should fade rather than disappear');
    assert.equal(Number(transition[1]), LOADING_FADE_MS,
        'the fade in index.html and the wait in js/loading.js should be one duration');
});

// A key with nothing on screen naming it is a key nobody presses.
test('the control list names the keys the flight is worked with', () => {
    const list = indexHtml.match(/<div id="controls-help-list">([\s\S]*?)<\/div>/);
    assert.ok(list, 'index.html should carry the control list');

    for (const key of ['C', 'Tab', 'H', 'P', 'R']) {
        assert.ok(new RegExp(`(^|>|\\s)${key} -`, 'm').test(list[1]), `the list should name the ${key} key`);
    }
    assert.ok(list[1].includes(`${MUTE_KEY.replace('Key', '')} -`), 'including the one that mutes the sound');
    for (const code of SETTINGS_OPEN_KEYS) {
        assert.ok(list[1].includes(`${code.replace('Key', '')} -`), 'and the one that opens the settings');
    }
    assert.ok(list[1].includes(`${PHOTO_KEY} -`), 'and the one that takes a picture');
});

// Every list under the panel's headings is styled the same way, so a heading
// added to the markup and not to the stylesheet is a list drawn as bullets.
test('every list the panel is split across is styled as a menu rather than a list', () => {
    for (const id of ['settings-menu', 'settings-start', 'settings-options']) {
        assert.ok(new RegExp(`#${id}[,\\s]`).test(indexHtml), `index.html should style #${id}`);
        assert.ok(new RegExp(`#${id} li[,\\s]`).test(indexHtml), `and the entries drawn into #${id}`);
        assert.ok(new RegExp(`#${id} li\\.selected[,\\s]`).test(indexHtml),
            `and the cursor when it is over #${id}`);
    }
});

test('the collapsed controls list leaves the hint that reopens it', () => {
    assert.ok(indexHtml.includes(HELP_HINT), `index.html should carry the hint "${HELP_HINT}"`);
});

test('every menu has a list to be drawn into, and nothing drawn in it yet', () => {
    for (const id of ['start-menu', 'pause-menu', 'settings-menu']) {
        assert.ok(new RegExp(`<ul id="${id}">\\s*</ul>`).test(indexHtml),
            `the entries are drawn from js/menu.js, so the page should leave #${id} empty`);
    }
});

// The browser resolves every import itself, and the modules that pull in
// Three.js are never loaded here, so a path typed wrong in one of those is a
// blank page rather than a failing test. Checking the paths themselves catches
// it without a renderer.
test('every module a script imports is a module that is there', () => {
    for (const { name, source } of scripts) {
        const folder = name.includes('/') ? `${scriptDir}/${name.slice(0, name.lastIndexOf('/'))}` : scriptDir;

        for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
            const target = new URL(match[1], `file:///${folder.replace(/\\/g, '/')}/`);
            assert.ok(existsSync(fileURLToPath(target)),
                `js/${name} imports "${match[1]}", which does not exist`);
        }
    }
});

test('every bare import is one the page maps to a module', () => {
    const mapped = Object.keys(JSON.parse(
        indexHtml.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]
    ).imports);

    for (const { name, source } of scripts) {
        for (const match of source.matchAll(/from\s+'([^'.][^']*)'/g)) {
            const specifier = match[1];
            assert.ok(mapped.some(prefix => specifier === prefix || specifier.startsWith(prefix)),
                `js/${name} imports "${specifier}", which the import map does not resolve`);
        }
    }
});

test('every path the manifest publishes is a module that is there', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const paths = [manifest.main, ...Object.values(manifest.exports ?? {})];

    assert.ok(paths.length > 1, 'the manifest should publish the API entry point');
    for (const path of paths) {
        assert.ok(existsSync(`${root}/${path}`), `the manifest publishes ${path}, which does not exist`);
    }
});

test('the attitude indicator is clipped to the face its marks are drawn on', () => {
    const clip = indexHtml.match(/<clipPath id="attitude-face">\s*<circle[^>]*r="(\d+)"/);
    assert.ok(clip, 'index.html should clip the instrument to a round face');
    assert.equal(Number(clip[1]), FACE_RADIUS, 'the drawn face and the face in js/attitude.js should be one size');
});
