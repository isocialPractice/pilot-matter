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
import { EDITOR_TITLE, EDITOR_HEADING, EDITOR_OPEN_KEYS } from '../js/element-editor.js';
import { SPEED_UNITS, ALTITUDE_UNITS } from '../js/units.js';
import { TOUCH_PADS, TOUCH_CELLS, TOUCH_LEFT, TOUCH_RIGHT } from '../js/touch-controls.js';

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

// The narrowest a phone in portrait actually gets, which is the width the
// overlays have to share rather than a comfortable one they were laid out at.
const NARROWEST_PHONE = 320;

// And the shortest it gets, which is the same phone with a browser's own bars
// taking their share of it: 320 x 568 under Safari leaves 460. Height is the
// scarcer of the two once the pads are out, because they take a fixed band off
// the bottom of whatever is left.
const SHORTEST_PHONE = 460;

// The shortest screen the stacked floated readouts still hold on. Below this
// the stack and the pad band are the same band, which is the height the
// stylesheet's own media query takes over at. It moved up when the pads were
// narrowed to fit a 320 pixel screen: a shorter cell is a shallower band, and
// a shallower band is sixteen more pixels of screen the stack can have.
const SHORTEST_STACKED = 541;

// And the shortest a phone gets held sideways, which is the same 568 x 320 the
// portrait figure comes from, turned over. Nothing stands between the top of
// the screen and the pads on one of these but the two instruments.
const SHORTEST_SIDEWAYS = 320;

// The smallest a control meant to be hit by a thumb should get. The pads were
// narrowed to fit the narrowest phone, and this is where that stops.
const SMALLEST_TAP = 44;

// Every menu drawn into the page: the two cards, the panels they open, and the
// three lists one panel is split across.
const MENU_LISTS = [
    'start-menu', 'pause-menu', 'game-modes-menu', 'element-editor-menu',
    'settings-menu', 'settings-start', 'settings-options'
];

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

/**
 * Every rule in the page's stylesheet, as the selectors it was written for and
 * the declarations it carries. Rules that style several things at once are read
 * the same as rules that style one, so grouping two overlays that are drawn the
 * same way does not hide either of them from a check that they are drawn that
 * way.
 */
function styleRules(css) {
    // Comments come off first: a rule written under one would otherwise read as
    // a rule whose selector is the note above it.
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    return [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(rule => ({
        selectors: rule[1].split(',').map(selector => selector.trim()),
        body: rule[2]
    }));
}

/** The declarations of the first rule an id is a selector of. */
function styleRule(css, id) {
    return styleRules(css).find(rule => rule.selectors.includes(`#${id}`))?.body ?? null;
}

/** True when some rule written for a selector carries a declaration. */
function styled(css, selector, declaration) {
    return styleRules(css).some(rule => rule.selectors.includes(selector) && declaration.test(rule.body));
}

test('the warning overlays start hidden and wait for the flight to trip them', () => {
    for (const id of ['low-altitude', 'crashed', 'landed']) {
        const rule = styleRule(indexHtml, id);
        assert.ok(rule, `index.html should style #${id}`);
        assert.ok(/display:\s*none/.test(rule), `#${id} should start hidden`);
    }
});

// Every overlay is placed by the code that knows whether it belongs on
// screen. Starting hidden means a page whose scripts never arrive shows an
// honest nothing rather than a HUD reading zero over an empty world.
test('the overlays the simulator places start hidden and wait to be placed', () => {
    for (const id of ['title-screen', 'paused', 'settings', 'game-modes', 'element-editor',
        'game-mode', 'game-mode-report', 'hud', 'attitude', 'minimap', 'audio-muted',
        'controls-help', 'controls-help-hint', 'touch-controls']) {
        const rule = styleRule(indexHtml, id);
        assert.ok(rule, `index.html should style #${id}`);
        assert.ok(/display:\s*none/.test(rule), `#${id} should start hidden`);
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
    const rule = styleRule(indexHtml, 'loading');
    assert.ok(rule, 'index.html should style #loading');

    const transition = rule.match(/transition:\s*opacity\s+(\d+)ms/);
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
    for (const code of EDITOR_OPEN_KEYS) {
        assert.ok(list[1].includes(`${code.replace('Key', '')} -`), 'and the one that opens the element editor');
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

// Both cards lie over the flight without taking the mouse from it, so a menu on
// one has to claim the pointer back or every click would land on the world.
test('the two menus the mouse works take the pointer their cards let through', () => {
    for (const id of ['title-screen', 'paused']) {
        assert.ok(/pointer-events:\s*none/.test(styleRule(indexHtml, id) ?? ''),
            `#${id} should go on letting the mouse through to the flight behind it`);
    }

    for (const id of ['start-menu', 'pause-menu']) {
        assert.ok(styled(indexHtml, `#${id}`, /pointer-events:\s*auto/),
            `#${id} should take the pointer back off the card it is drawn on`);
        assert.ok(styled(indexHtml, `#${id} li`, /cursor:\s*pointer/),
            `and the entries of #${id} should read as something to click`);
    }
});

// A menu that answers to the mouse and says only which keys work it is a menu
// nobody reaches for the mouse on.
test('both menus worked with the mouse say so under their entries', () => {
    assert.ok(START_HINT.includes('MOUSE') && START_HINT.includes('CLICK'),
        'the start screen hint should name the mouse and what a click does');

    const card = indexHtml.match(/<div id="paused">([\s\S]*?)<\/div>/);
    assert.ok(card, 'index.html should carry the pause card');
    assert.ok(/MOUSE/.test(card[1]), 'the pause card should name the mouse too');
    assert.ok(/CLICK/.test(card[1]), 'and say that a click chooses');
});

// The panels opened from those two menus are menus as well, and a menu the
// pointer does nothing on is a menu that reads as broken next to one it does.
test('every menu on screen reads as something the pointer works', () => {
    for (const id of MENU_LISTS) {
        assert.ok(styled(indexHtml, `#${id} li`, /cursor:\s*pointer/),
            `the entries of #${id} should read as something to click`);
    }
});

test('every menu is read down its left edge rather than about its middle', () => {
    for (const id of MENU_LISTS) {
        assert.ok(styled(indexHtml, `#${id} li`, /text-align:\s*left/),
            `the entries of #${id} should line up under each other`);
    }
});

// The list is what the Controls entry puts on screen, so it is also the way
// back off it for a pilot working the menus with the mouse.
test('the control list takes the pointer rather than passing it to the flight', () => {
    const rule = styleRule(indexHtml, 'controls-help') ?? '';
    assert.ok(!/pointer-events:\s*none/.test(rule),
        '#controls-help should take the click that collapses it');
    assert.ok(/cursor:\s*pointer/.test(rule),
        'and should read as something to click');
});

// The panel is long enough to scroll, so its headings have to be readable as
// the divisions they are rather than as another row of the list.
test('the settings headings are set apart from the entries under them', () => {
    const heading = styleRules(indexHtml)
        .find(rule => rule.selectors.includes('#settings h3'))?.body ?? '';

    assert.ok(/text-decoration:\s*underline/.test(heading), '#settings h3 should be underlined');
    assert.ok(/text-underline-offset/.test(heading), 'and hold the rule off the text');
    assert.ok(/text-align:\s*left/.test(heading), 'and sit over the left edge of the list it heads');

    const size = heading.match(/font-size:\s*(\d+(?:\.\d+)?)(pt|px)/);
    assert.ok(size, '#settings h3 should set a size of its own');
    const points = size[2] === 'pt' ? Number(size[1]) : Number(size[1]) * 0.75;
    assert.ok(points >= 18, `a heading at ${size[1]}${size[2]} does not read as one`);
});

// Both sets of keys move the cursor, so a card naming only one of them tells a
// pilot who reached for the arrows that the arrows do not work.
test('every card that carries a menu names the arrow keys as well as W/S', () => {
    assert.ok(/↑\/↓/.test(START_HINT), 'the start screen hint should name the arrow keys');

    for (const id of ['paused', 'settings', 'game-modes']) {
        const card = indexHtml.match(new RegExp(`<div id="${id}">([\\s\\S]*?)</div>`));
        assert.ok(card, `index.html should carry the ${id} card`);
        assert.ok(/W\/S/.test(card[1]) && /↑\/↓/.test(card[1]),
            `the ${id} card should name both ways the cursor is moved`);
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

// --- The element editor's panel -------------------------------------------

test('the element editor is titled and says what it is listing', () => {
    assert.ok(indexHtml.includes(EDITOR_TITLE), 'the panel should carry its title');
    assert.ok(indexHtml.includes(EDITOR_HEADING), 'and say what the list under it is');
});

test('the panel says how it is worked, including the keys that step a range', () => {
    const panel = indexHtml.slice(indexHtml.indexOf('id="element-editor"'));
    const hint = panel.slice(0, panel.indexOf('</div>'));

    assert.ok(/A\/D/.test(hint), 'the keys that step a range should be named');
    assert.ok(/ESC/.test(hint), 'and the way out of the panel');
});

// A range sits under the element it belongs to, or the list reads as one run
// of rows rather than as elements with their ranges.
test('a range row is drawn in under the element it belongs to', () => {
    assert.ok(styled(indexHtml, '#element-editor-menu li[data-kind="range"]', /padding-left/),
        'a range should be indented under its element');
});

// --- The card the objective is written onto -------------------------------

test('the objective card carries the clock and the pointer the run writes to', () => {
    for (const id of ['game-mode-clock', 'game-mode-pointer']) {
        assert.ok(indexHtml.includes(`id="${id}"`), `index.html is missing id="${id}"`);
    }
});

// A gate the pilot can see is not pointed at, so the line has to be able to be
// off - which means starting off, before the run has said anything.
test('the gate pointer starts off and waits for a gate to point at', () => {
    assert.ok(/display:\s*none/.test(styleRule(indexHtml, 'game-mode-pointer') ?? ''),
        '#game-mode-pointer should start hidden');
});

// --- The course on the chart ----------------------------------------------

test('the chart carries the course the minimap draws into', () => {
    for (const id of ['minimap-course', 'minimap-course-line']) {
        assert.ok(indexHtml.includes(`id="${id}"`), `index.html is missing id="${id}"`);
    }
});

// The aircraft is what the chart is for, so a gate is never drawn over it.
test('the course is drawn under the marker rather than over it', () => {
    assert.ok(indexHtml.indexOf('id="minimap-course"') < indexHtml.indexOf('id="minimap-aircraft"'),
        'the course group should come before the marker in the chart');
});

/**
 * The chart and the world both draw the gate the course is waiting on, and a
 * pilot reading one against the other should not find them disagreeing. The
 * hoops are meshes and their module imports Three.js, so the colours it draws
 * them in are read off its source rather than by loading it.
 */
test('a gate on the chart is the colour the hoop it stands for is', () => {
    const rings = readFileSync(fileURLToPath(new URL('../js/rings.js', import.meta.url)), 'utf8');
    const hex = (name) => rings.match(new RegExp(`${name}\\s*=\\s*0x([0-9a-fA-F]{6})`))?.[1];

    const readings = [
        ['.minimap-gate',       'RING_COLOR'],
        ['.minimap-gate.next',  'RING_NEXT_COLOR'],
        ['.minimap-gate.flown', 'RING_DONE_COLOR']
    ];

    for (const [selector, name] of readings) {
        const color = hex(name);
        assert.ok(color, `js/rings.js should name ${name}`);
        assert.ok(styled(indexHtml, selector, new RegExp(`fill:\\s*#${color}`, 'i')),
            `${selector} should be drawn in ${name}`);
    }
});

/**
 * The approach marks are boxes turned about the vertical until they lie across
 * the strip, and which way to turn them is a compass question: the renderer
 * turns a model by `headingToYaw`, and a bearing in plain radians is the mirror
 * of that. Written out by hand it puts the threshold bar and the whole lead-in
 * on the wrong diagonal of every strip that is not laid north to south.
 *
 * The module imports Three.js, so this is read off its source the way the ring
 * colours above are.
 */
test('the approach marks are turned the way the aircraft is turned', () => {
    const guidance = readFileSync(fileURLToPath(new URL('../js/guidance.js', import.meta.url)), 'utf8');

    assert.match(guidance, /import\s*\{[^}]*headingToYaw[^}]*\}\s*from\s*'\.\/units\.js'/,
        'js/guidance.js should take the conversion from js/units.js');
    assert.match(guidance, /const\s+facing\s*=\s*headingToYaw\(/,
        'and turn its marks by it rather than by the bearing in radians');
    assert.ok(!/plan\.heading\s*\*\s*Math\.PI\s*\/\s*180/.test(guidance),
        'a bearing converted by hand here is the compass frame written out a second time');
});

/**
 * The pads take a fixed band off the bottom of the screen and paint over
 * everything in it at z-index 130. The floated readouts were dropped to 180
 * to clear the two instruments above them and nothing said where they had to
 * stop, so on every screen a phone gives held sideways they ran into that
 * band and the last of them ran off the bottom edge entirely.
 *
 * The height is declared now, which is what lets it be checked at all: the
 * content's own height is nowhere in the stylesheet.
 */
test('the floated readouts stop before the band the pads take', () => {
    const band = padBandDepth(indexHtml);
    assert.ok(Number.isFinite(band), 'the depth of the pad band should be readable off the page');

    const top   = pixels(indexHtml, '#hud.floated', 'top');
    const bound = pixels(indexHtml, '#hud.floated', 'max-height');
    const clips = declarations(indexHtml, '#hud.floated').get('overflow');

    assert.ok(Number.isFinite(bound),
        'the floated readouts need a declared height, or nothing can say where they end');
    assert.equal(clips, 'hidden', 'and it has to bind, or it is a number rather than a bound');

    assert.ok(top + bound <= SHORTEST_STACKED - band,
        `the stacked readouts run to ${top + bound}px and the pads start at `
      + `${SHORTEST_STACKED - band}px on the shortest screen they are drawn at`);
});

/**
 * Below that height the stack cannot fit however it is written, so the page
 * takes over with a media query. The breakpoint and the bound above have to
 * be the same number seen from either side: a gap between them is a run of
 * screen heights where neither arrangement holds.
 */
test('the short-screen readouts take over exactly where the stacked ones stop', () => {
    const short = media(indexHtml, '(max-height: 540px)');
    assert.ok(short, 'index.html should carry the short-screen rules for the readouts');

    const breakpoint = Number(indexHtml.match(/@media \(max-height: (\d+)px\)/)?.[1]);
    assert.equal(breakpoint, SHORTEST_STACKED - 1,
        'the query should start one pixel below the shortest screen the stack holds on');

    // Compact, and clear of the pads on the shortest screen a phone gives -
    // which is the one the stacked block cannot be made to fit.
    const band  = padBandDepth(indexHtml);
    const top   = pixels(indexHtml, '#hud.floated', 'top');
    const bound = pixels(short, '#hud.floated', 'max-height');

    assert.ok(Number.isFinite(bound), 'the compact readouts need a declared height too');
    assert.ok(bound < pixels(indexHtml, '#hud.floated', 'max-height'),
        'and a smaller one, or the query has changed nothing');
    assert.ok(top + bound <= SHORTEST_PHONE - band,
        `the compact readouts run to ${top + bound}px and the pads start at `
      + `${SHORTEST_PHONE - band}px on the shortest phone`);

    assert.equal(declarations(short, '#hud.floated .hud-secondary').get('display'), 'none',
        'the two readouts that are not flown on are what the compact block drops');
});

/**
 * Shorter again and the readouts leave the left column for the band between
 * the two pad clusters, which is the one part of a short screen nothing else
 * has claimed. Both ends of that band belong to a cluster, so the block has
 * to start past one and stop before the other.
 */
test('the readouts moved to the bottom band stay between the two pad clusters', () => {
    const sideways = media(indexHtml, '(max-height: 540px) and (min-width: 500px)');
    assert.ok(sideways, 'index.html should say where the readouts go on a phone held sideways');

    const reach = clusterReach(indexHtml);
    assert.ok(Number.isFinite(reach), 'how far a cluster reaches in should be readable off the page');

    for (const edge of ['left', 'right']) {
        const inset = pixels(sideways, '#hud.floated', edge);
        assert.ok(Number.isFinite(inset), `the block should declare its ${edge} edge`);
        assert.ok(inset >= reach,
            `the readouts start ${inset}px from the ${edge} and that cluster reaches ${reach}px in`);
    }

    assert.equal(declarations(sideways, '#hud.floated').get('top'), 'auto',
        'and come off the top edge they were hung from, or they are in two places at once');
});

/**
 * The objective card is centred and the pads are not, so it cleared them for
 * as long as it only carried an instruction: its rows are narrow enough to
 * pass between the clusters. The landing breakdown is wider and lower, and
 * the pads paint over it, so the reading of a landing was read off from
 * behind a thumb at each end.
 */
test('the floated card is lifted clear of the band the pads take', () => {
    const narrow = media(indexHtml, '(max-width: 640px)');
    assert.ok(narrow, 'index.html should say where the card goes on a screen the pads cross');

    const band = padBandDepth(indexHtml);
    const lift = pixels(narrow, '#game-mode.floated', 'bottom');

    assert.ok(Number.isFinite(lift), 'the lifted card should be placed in pixels');
    assert.ok(lift >= band, `the card sits ${lift}px up and the pads reach ${band}px up`);

    // Lifted that far it needs the height above the band rather than the
    // corner it used to have, and the shortest screen does not have it. The
    // bound is what keeps the top line on the screen.
    const bound = declarations(narrow, '#game-mode.floated').get('max-height');
    assert.equal(bound, `calc(100vh - ${lift + 20}px)`,
        'the card should be bounded to the room above the band, so it clips rather than overflows');
    assert.equal(declarations(narrow, '#game-mode.floated').get('overflow'), 'hidden');

    // And it lands over the readouts wherever it lands, so it has to be read
    // as one card rather than as two overlays through each other.
    const alpha = (rule) => Number(declarations(indexHtml, rule).get('background')
        ?.match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1]);

    assert.ok(alpha('#game-mode.floated') > alpha('#game-mode'),
        `the floated card reads at ${alpha('#game-mode.floated')} over the readouts `
      + `and the placed one at ${alpha('#game-mode')}`);
});

// The card is lifted by the same flag that floats the overlays the pads took
// the corner from, because it is the same condition: the pads are out.
test('the card is floated by the run that floats the rest of them', () => {
    const main = readFileSync(fileURLToPath(new URL('../js/main.js', import.meta.url)), 'utf8');
    const floated = [...main.matchAll(/overlays\.(\w+)\.classList\.toggle\('floated', pads\)/g)]
        .map(match => match[1]);

    assert.ok(floated.includes('objective'),
        'js/main.js should float the objective card with the pads, as it does the others');
    for (const overlay of ['attitude', 'muted', 'hud']) {
        assert.ok(floated.includes(overlay), `and go on floating ${overlay}`);
    }
});

// --- The controls for a machine with no keys -------------------------------

test('each cluster of pads has an empty box to be drawn into', () => {
    for (const side of [TOUCH_LEFT, TOUCH_RIGHT]) {
        const id = `touch-cluster-${side}`;
        assert.ok(new RegExp(`<div id="${id}"[^>]*class="touch-cluster"[^>]*></div>`).test(indexHtml),
            `the pads are drawn from js/touch-controls.js, so the page should leave #${id} empty`);
    }
});

test('every cell a pad can sit in has somewhere in the cross to sit', () => {
    for (const cell of TOUCH_CELLS) {
        assert.ok(styled(indexHtml, `.touch-${cell}`, /grid-area/),
            `a pad in the ${cell} cell would otherwise stack on the one before it`);
    }
    assert.ok(TOUCH_PADS.every(pad => TOUCH_CELLS.includes(pad.cell)));
});

// A thumb holding a control down is a thumb dragging the page under it, unless
// the pad says otherwise. The browser's own gestures are every one of them
// something other than flying.
test('a pad takes the pointer and none of the browser gestures under it', () => {
    assert.ok(styled(indexHtml, '.touch-pad', /pointer-events:\s*auto/),
        'the card lets the flight take the pointer, so the pads have to catch it');
    assert.ok(styled(indexHtml, '.touch-pad', /touch-action:\s*none/),
        'or a control held down scrolls the page instead of flying the aircraft');
    assert.ok(styled(indexHtml, '.touch-pad', /user-select:\s*none/),
        'and a long press selects the label rather than working the control');
});

test('the two overlays the pads take the corner from have somewhere else to be', () => {
    for (const id of ['attitude', 'audio-muted']) {
        assert.ok(styleRules(indexHtml).some(rule => rule.selectors.includes(`#${id}.floated`)),
            `js/main.js lifts #${id} clear of the pads, so the page should say where to`);
    }
});

/**
 * `#touch-controls` is a flex row with the two crosses pushed to opposite
 * ends, so a screen too narrow for both has nothing left to distribute: it
 * packs from the left instead and the right-hand cross is drawn off the end
 * of the screen. At 48 pixel cells the pair wanted 344 and the narrowest
 * phone gives 320, so eight pixels of YAW R were outside the viewport - on
 * the one width the rest of this stylesheet reasons about.
 */
test('both clusters of pads are drawn inside the narrowest phone', () => {
    const reach = clusterReach(indexHtml);
    assert.ok(Number.isFinite(reach), 'how far a cluster reaches in should be readable off the page');

    assert.ok(reach * 2 < NARROWEST_PHONE,
        `the two clusters and the padding either side want ${reach * 2}px `
      + `and the narrowest phone gives ${NARROWEST_PHONE}px`);
});

// Fitting is not the only thing a pad has to do. A cell shrunk until the
// arithmetic comes out is a control a thumb misses, so the fit above has a
// floor under it rather than room to go on giving.
test('a pad is no smaller than a thumb can be asked to hit', () => {
    const cell = (axis) => Number(declarations(indexHtml, '.touch-cluster')
        .get(`grid-template-${axis}`)?.match(/repeat\(\d+,\s*(\d+)px\)/)?.[1]);

    for (const axis of ['columns', 'rows']) {
        assert.ok(cell(axis) >= SMALLEST_TAP,
            `a pad is ${cell(axis)}px across its ${axis} and ${SMALLEST_TAP}px is the floor`);
    }
    assert.equal(cell('columns'), cell('rows'), 'and square, the way a cross of them reads');
});

/**
 * The muted notice was placed once, 140 pixels down the left edge, and that
 * is the band the pads take on a screen held sideways: it ran into PITCH +
 * on an 852x330 screen and was painted over at z-index 130 against its 100.
 *
 * The readouts leave the left edge for the bottom band on a screen that
 * short, which frees the whole of the top between the two instruments - so
 * the notice goes up beside the ladder rather than staying under it.
 */
test('the muted notice leaves the pad band on a phone held sideways', () => {
    const sideways = media(indexHtml, '(max-height: 540px) and (min-width: 500px)');
    assert.ok(sideways, 'index.html should say where the notice goes on a phone held sideways');

    const notice = {
        top:  pixels(sideways, '#audio-muted.floated', 'top'),
        left: pixels(sideways, '#audio-muted.floated', 'left')
    };
    assert.ok(Object.values(notice).every(Number.isFinite),
        'the notice should be placed in pixels on the screen with least room for it');

    const ladder = {
        top:    pixels(indexHtml, '#attitude.floated', 'top'),
        left:   pixels(indexHtml, '#attitude.floated', 'left'),
        width:  pixels(indexHtml, '#attitude.floated', 'width'),
        height: pixels(indexHtml, '#attitude.floated', 'height')
    };
    const chart = {
        right: pixels(indexHtml, '#minimap', 'right'),
        width: pixels(indexHtml, '#minimap', 'width')
    };

    assert.equal(notice.top, ladder.top,
        'hung from the same edge as the ladder, the notice is as far off the pads as it is');
    assert.ok(notice.left >= ladder.left + ladder.width,
        `the notice starts at ${notice.left}px and the ladder ends at ${ladder.left + ladder.width}px`);

    // And the ladder itself clears the pads on the shortest screen a phone
    // gives sideways, which is what makes the line above a placement rather
    // than the same collision moved up the screen.
    const band = padBandDepth(indexHtml);
    assert.ok(ladder.top + ladder.height <= SHORTEST_SIDEWAYS - band,
        `the ladder ends at ${ladder.top + ladder.height}px and the pads start at `
      + `${SHORTEST_SIDEWAYS - band}px on the shortest screen a phone gives sideways`);

    // The far corner belongs to the chart, and a notice run under that is the
    // same fault moved across the screen. How wide the notice draws is the
    // browser's to decide, so what is checked is where it starts - against
    // the narrowest screen this arrangement is written for, which the query
    // names itself.
    const narrowest = Number(indexHtml.match(/\(max-height: \d+px\) and \(min-width: (\d+)px\)/)?.[1]);
    assert.ok(Number.isFinite(narrowest), 'the query should say how wide a screen it is written for');
    assert.ok(notice.left < narrowest - chart.right - chart.width,
        `the notice starts at ${notice.left}px and the chart at `
      + `${narrowest - chart.right - chart.width}px on the narrowest screen both are drawn on`);
});

/**
 * The LANDED notice and the landing breakdown are on screen for the same
 * moment, and the notice is centred over the middle of it at a higher layer
 * than the card. That is what makes this a rule about when the notice is
 * shown rather than about where the card sits: lifting the card clear of the
 * pads carried it under the notice instead, and nothing a stylesheet can say
 * about a centred banner and a lifted card keeps the two apart at every size
 * a phone comes in.
 */
test('the landing notice is drawn over the card the breakdown is written on', () => {
    const layer = (selector) => Number(declarations(indexHtml, selector).get('z-index'));

    assert.ok(layer('#landed') > layer('#game-mode'),
        `the notice draws at ${layer('#landed')} and the card at ${layer('#game-mode')}`);
    assert.equal(declarations(indexHtml, '#landed').get('top'), '50%',
        'and it is centred on the screen rather than placed clear of anything');
    assert.ok(hudSource.includes('showsLandedNotice'),
        'so js/hud.js is what keeps them off each other, by never showing both at once');
});

/** The declarations of a rule written for a selector, property by property. */
function declarations(css, selector) {
    const rule = styleRules(css).find(entry => entry.selectors.includes(selector));
    return new Map((rule?.body ?? '').split(';')
        .map(part => part.split(':').map(piece => piece.trim()))
        .filter(pair => pair.length === 2 && pair[0] && pair[1]));
}

/** A pixel length declared for a selector, as a number. */
function pixels(css, selector, property) {
    const value = declarations(css, selector).get(property);
    return value?.endsWith('px') ? Number(value.slice(0, -2)) : null;
}

/**
 * The body of an `@media` block, as its own stylesheet, so the rules written
 * for one screen can be read apart from the rules written for every screen.
 * Both are `#hud.floated`, and reading them together would answer a question
 * about a short phone with the declaration meant for a tall one.
 *
 * Matched on the condition text with the spacing normalized, and read by
 * counting braces rather than by a pattern, because the block holds rules and
 * a rule holds braces.
 */
function media(css, condition) {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const want = condition.replace(/\s+/g, ' ').trim();

    for (const match of stripped.matchAll(/@media([^{]*)\{/g)) {
        if (match[1].replace(/\s+/g, ' ').trim() !== want) continue;

        let depth = 1;
        let at = match.index + match[0].length;
        const from = at;
        while (at < stripped.length && depth > 0) {
            if (stripped[at] === '{') depth++;
            if (stripped[at] === '}') depth--;
            at++;
        }
        return stripped.slice(from, at - 1);
    }

    return null;
}

/**
 * How deep a band the pads take off the bottom of the screen, read off the
 * page rather than written down here: three rows of cells, the gaps between
 * them, and the inset the whole cross is held off the edge by. Every overlay
 * that has to clear the pads is measured against this, so a pad grown a row
 * taller moves all of them at once instead of leaving them behind.
 */
function padBandDepth(css) {
    const rows = declarations(css, '.touch-cluster').get('grid-template-rows');
    const gap  = pixels(css, '.touch-cluster', 'gap');
    const inset = declarations(css, '#touch-controls').get('padding')?.split(/\s+/).pop();

    const cells = rows?.match(/repeat\((\d+),\s*(\d+)px\)/);
    if (!cells || gap === null || !inset?.endsWith('px')) return null;

    const count = Number(cells[1]);
    return count * Number(cells[2]) + (count - 1) * gap + Number(inset.slice(0, -2));
}

/** How far in from each edge a cluster of pads reaches. */
function clusterReach(css) {
    const columns = declarations(css, '.touch-cluster').get('grid-template-columns');
    const gap     = pixels(css, '.touch-cluster', 'gap');
    const inset   = declarations(css, '#touch-controls').get('padding')?.split(/\s+/)[1];

    const cells = columns?.match(/repeat\((\d+),\s*(\d+)px\)/);
    if (!cells || gap === null || !inset?.endsWith('px')) return null;

    const count = Number(cells[1]);
    return count * Number(cells[2]) + (count - 1) * gap + Number(inset.slice(0, -2));
}

/**
 * The top of a phone holds three things at once when the pads are out: the
 * ladder the corner sent up there, the chart that was already in the other
 * corner, and the readouts down the left. Floated over the readouts, the ladder
 * covered the right-hand end of the airspeed, the altitude, the vertical speed
 * and the heading - four of the things a pilot is flying on - so the three of
 * them are given the screen between them rather than the same part of it.
 */
test('the floated ladder is clear of the readouts and the chart it shares a screen with', () => {
    const ladder = {
        top:    pixels(indexHtml, '#attitude.floated', 'top'),
        left:   pixels(indexHtml, '#attitude.floated', 'left'),
        height: pixels(indexHtml, '#attitude.floated', 'height'),
        width:  pixels(indexHtml, '#attitude.floated', 'width')
    };
    const chart = {
        top:    pixels(indexHtml, '#minimap', 'top'),
        right:  pixels(indexHtml, '#minimap', 'right'),
        height: pixels(indexHtml, '#minimap', 'height'),
        width:  pixels(indexHtml, '#minimap', 'width')
    };
    const readouts = pixels(indexHtml, '#hud.floated', 'top');

    assert.ok(Object.values(ladder).every(Number.isFinite), 'the floated ladder should be placed in pixels');
    assert.ok(Object.values(chart).every(Number.isFinite), 'and so should the chart it joins up there');
    assert.ok(Number.isFinite(readouts),
        'the readouts need somewhere to go, or the ladder is drawn over them');

    // Pinned to opposite edges, the two instruments meet only on a screen
    // narrower than they are together - which is narrower than a phone comes.
    const together = ladder.left + ladder.width + chart.width + chart.right;
    assert.ok(together < NARROWEST_PHONE,
        `the ladder and the chart want ${together}px and a phone gives ${NARROWEST_PHONE}px`);
    assert.ok(pixels(indexHtml, '#attitude.floated', 'right') === null
        && !styled(indexHtml, '#attitude.floated', /transform/),
        'the ladder is pinned to its edge rather than centred over whatever is behind it');

    // And the readouts start below the lower edge of both, rather than beside
    // one of them at a width nobody chose.
    for (const [name, box] of [['ladder', ladder], ['chart', chart]]) {
        assert.ok(readouts >= box.top + box.height,
            `the readouts start at ${readouts}px and the ${name} ends at ${box.top + box.height}px`);
    }
});

// The notice goes in the band the readouts left between themselves and the
// ladder, on the same left edge as both. Centred, it ran over the readouts on a
// 320 pixel screen, which is the width they were dropped down the page for.
test('the muted notice is floated into the band the two left it', () => {
    const notice   = pixels(indexHtml, '#audio-muted.floated', 'top');
    const readouts = pixels(indexHtml, '#hud.floated', 'top');
    const ladder   = pixels(indexHtml, '#attitude.floated', 'top')
                   + pixels(indexHtml, '#attitude.floated', 'height');

    assert.ok(Number.isFinite(notice), 'the notice should be placed in pixels');
    assert.ok(notice >= ladder, `the notice starts at ${notice}px and the ladder ends at ${ladder}px`);
    assert.ok(notice < readouts, `and the readouts start at ${readouts}px, below it`);
    assert.equal(pixels(indexHtml, '#audio-muted.floated', 'left'),
        pixels(indexHtml, '#attitude.floated', 'left'),
        'on the left edge the ladder and the readouts share, clear of the chart on the right');
});
