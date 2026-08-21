import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TITLE_NAME, START_PROMPT } from '../js/title-screen.js';
import { HELP_HINT } from '../js/controls-help.js';
import { FACE_RADIUS } from '../js/attitude.js';

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

const scriptDir = fileURLToPath(new URL('../js', import.meta.url));
const scripts = readdirSync(scriptDir)
    .filter(name => name.endsWith('.js'))
    .map(name => ({ name, source: readFileSync(`${scriptDir}/${name}`, 'utf8') }));

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
    for (const id of ['title-screen', 'paused', 'hud', 'attitude', 'controls-help', 'controls-help-hint']) {
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

test('the title screen names the game and says what to do about it', () => {
    assert.ok(indexHtml.includes(TITLE_NAME), 'the title screen should name the game');
    assert.ok(indexHtml.includes(START_PROMPT), 'the title screen should carry the start prompt');
});

test('the collapsed controls list leaves the hint that reopens it', () => {
    assert.ok(indexHtml.includes(HELP_HINT), `index.html should carry the hint "${HELP_HINT}"`);
});

test('the pause menu has a list to be drawn into', () => {
    assert.ok(/<ul id="pause-menu">\s*<\/ul>/.test(indexHtml),
        'the entries are drawn from js/menu.js, so the page should leave the list empty');
});

test('the attitude indicator is clipped to the face its marks are drawn on', () => {
    const clip = indexHtml.match(/<clipPath id="attitude-face">\s*<circle[^>]*r="(\d+)"/);
    assert.ok(clip, 'index.html should clip the instrument to a round face');
    assert.equal(Number(clip[1]), FACE_RADIUS, 'the drawn face and the face in js/attitude.js should be one size');
});
