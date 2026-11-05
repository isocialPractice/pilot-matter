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
import { EDITOR_TITLE, EDITOR_HEADING } from '../js/element-editor.js';
import { BUILDER_OPEN_KEYS, BUILDER_LABEL } from '../js/build-mode.js';
import { START_MENU_ENTRIES, PAUSE_MENU_ENTRIES } from '../js/menu.js';
import { PICKER_TITLE, PICKER_HEADING, pickerCards } from '../js/build-picker.js';
import {
    CONTROL_SETTINGS_TITLE, CONTROL_AXES_HEADING, CONTROL_TILT_HEADING,
    CONTROL_ATTITUDE_HEADING, CONTROL_LEVEL_OFF_HEADING, CONTROL_KEYS_HEADING,
    CONTROL_REFERENCE_HEADING, CONTROL_REFERENCE_LABEL,
    AXIS_GROUP, TILT_GROUP, ATTITUDE_GROUP, LEVEL_OFF_GROUP, BINDING_GROUP,
    REFERENCE_GROUP, controlSettingsEntries
} from '../js/control-settings.js';
import { SPEED_UNITS, ALTITUDE_UNITS } from '../js/units.js';
import { TOUCH_PADS, TOUCH_CELLS, TOUCH_LEFT, TOUCH_RIGHT } from '../js/touch-controls.js';
import {
    GAME_MODES, GATE_ARROWS, missNotice, runStatus, runObjective,
    createRunState, startRun, currentStage, stageProgress, recordGate,
    recordLanding, advanceStage, searchBriefing,
    nextStrip, LOOP_OBJECTIVE, CARGO_OBJECTIVE, SEARCH_OBJECTIVE,
    PATTERN_OBJECTIVE, CORRIDOR_OBJECTIVE, SURVEY_OBJECTIVE,
    stagePattern, stageLandmarks, stageReaches, stageSections,
    recordPatternLeg, recordSection, recordPhoto,
    runBrief, faultNotice, shotNotice, legNotice, circuitNotice
} from '../js/game-modes.js';
import { completeLeg, createPatternState, patternScore, FINAL_LEG } from '../js/pattern.js';
import { missedBy } from '../js/corridor.js';
import { shotFault, shotFor } from '../js/survey.js';
import { bearingToDirection } from '../js/units.js';
import { runwayDirection } from '../js/environment/elements.js';
import { formatStageClock, formatRunPointer } from '../js/hud.js';
import { stageReport } from '../js/best-times.js';

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

// The screens the card and the readouts are driven against each other at: the
// tall phone that never showed the collision, the four that lost readouts
// behind the card, the one held sideways that lost the edge of the chart to
// it, and the two wider arrangements that were written and then measured by
// nothing - the band between 641 and 679 where the card keeps its corner and
// takes the stack's bound, and the screen past it where the card has gone by
// the stack altogether. Held here as sizes rather than as a list of what each
// one covered, because what is checked is the arrangement rather than the
// day's measurements of it.
const MEASURED_SCREENS = [
    { width: 393, height: 852 },
    { width: 320, height: 568 },
    { width: 393, height: 578 },
    { width: 320, height: 460 },
    { width: 852, height: 330 },
    { width: 568, height: 320 },
    { width: 660, height: 720 },
    { width: 1024, height: 768 }
];

// The width the card's left edge passes the readouts' right edge at, read off
// the top of the band the page keeps the two bounded against each other in.
// Above it they are side by side rather than one over the other, so a bound
// measured down the screen says nothing about whether they meet.
const CARD_CLEARS_STACK = Number(
    indexHtml.match(/\(min-width: 641px\) and \(max-width: (\d+)px\)/)?.[1]
);

// What the card carries, in the order it is written down the card, and the
// property each row's height is declared in. The card clips from the bottom,
// so a row that cannot be drawn whole has to be taken off rather than left to
// the clip: the card's bottom padding is not space the row under it respects,
// so a bound landing on a row boundary still slices the row after it.
const CARD_STATES = [
    {
        reading: 'in ordinary flight',
        selectors: ['#game-mode', '#game-mode.floated'],
        rows: [
            { height: '--card-name',      shown: ['#game-mode-name', '#game-mode.floated #game-mode-name'] },
            { height: '--card-objective', shown: ['#game-mode-objective'] },
            { height: '--card-status',    shown: ['#game-mode.floated #game-mode-status'] },
            { height: '--card-clock',     shown: ['#game-mode.floated #game-mode-clock'] },
            { height: '--card-pointer',   shown: [
                '#game-mode.pointing #game-mode-pointer',
                '#game-mode.floated.pointing #game-mode-pointer'
            ] }
        ]
    },
    {
        reading: 'with a landing read off it',
        selectors: ['#game-mode', '#game-mode.floated', '#game-mode.floated.reporting'],
        rows: [
            { height: '--card-name',      shown: ['#game-mode-name', '#game-mode.floated #game-mode-name'] },
            { height: '--card-objective', shown: ['#game-mode-objective'] },
            { height: '--card-status',    shown: [
                '#game-mode.floated #game-mode-status',
                '#game-mode.floated.reporting #game-mode-status'
            ] },
            { height: '--card-clock',     shown: [
                '#game-mode.floated #game-mode-clock',
                '#game-mode.floated.reporting #game-mode-clock'
            ] },
            { height: '--card-score',     shown: ['#game-mode-report .landing-score'] },
            ...Array.from({ length: 4 }, () => ({ height: '--card-part', shown: [
                '#game-mode-report div + div',
                '#game-mode.floated.reporting #game-mode-report div + div'
            ] }))
        ]
    }
];

// The longest line each row of the card may be asked to write, in characters.
//
// The `--card-*` heights are what a browser laid those rows out at, and a row
// asked for a longer line than the one it was measured with can wrap further
// than the height declared for it - which puts the bound back part way down a
// row, by the door a new game mode walks through.
//
// A stylesheet cannot measure text and neither can this suite. What a suite
// can do is count characters, which is the half of the question a monospaced
// card makes answerable. The figures come from `.tmp/ui-ux/t4-rowheights.log`
// and what can be derived from it at the card's 260 pixel minimum, where a row
// has 218 pixels to be written in:
//
//   name       20   `FLYING THROUGH LOOPS`, measured wrapping to two lines
//   objective  32   22 characters wrapped to two lines, and two lines of the
//                   widest type consistent with that measurement hold 32
//   status     44   measured wrapping to two lines
//   clock      29   measured on one line at 27, and two characters longer once
//                   a stage passes ten minutes, which is why the narrow card
//                   declares the clock wrapped as well
//   pointer    30   measured wrapping to two lines
/**
 * What the pointer row names on a mode, at the widest that name gets. The row
 * is one row for every mode, so the longest thing any of them can put in it is
 * what the row has to hold.
 */
function pointerLabel(mode, state, total) {
    if (mode.objective === LOOP_OBJECTIVE)   return `LOOP ${Math.max(1, total)}`;
    if (mode.objective === CARGO_OBJECTIVE)  return `LEG ${Math.max(1, total)}`;
    if (mode.objective === SEARCH_OBJECTIVE) return searchBriefing(state)?.label ?? '';
    if (mode.objective === PATTERN_OBJECTIVE)  return `LEG ${Math.max(1, total)}`;
    if (mode.objective === CORRIDOR_OBJECTIVE) return `CUT ${Math.max(1, total)}`;
    if (mode.objective === SURVEY_OBJECTIVE)   return `SHOT ${Math.max(1, total)}`;
    return '';
}

/**
 * A strip to lay a circuit off, in the shape the generator hands one over. The
 * circuit's own dimensions are the stage's, so the strip only has to be a
 * strip - but it has to be a whole one, because the thresholds are read off
 * `alongX` and `alongZ` rather than off the bearing.
 */
function strip(stage) {
    const heading = 90;
    return {
        x: 0, z: 0, heading, ...runwayDirection(heading),
        length: stage.runway.length[1], width: stage.runway.width[1], elevation: 60
    };
}

/**
 * Everything a mode's own rules read the world off, for whichever mode this
 * is. The lines the card writes for a circuit and a survey are read off the
 * circuit and the list, so a check of those lines has to lay both.
 */
function worldFor(state) {
    const stage = currentStage(state);
    return {
        circuit: stage?.pattern ? stagePattern(state, strip(stage)) : [],
        landmarks: stageLandmarks(state)
    };
}

/**
 * The same shot taken wrong, one way for each thing `shotFault` can say about
 * one. Every fault is a line the card has to hold, and the one that is longest
 * is not obvious from reading them - so they are all generated rather than the
 * worst of them guessed at.
 */
function outsideWindow(landmark) {
    const inside = insideWindow(landmark);
    const { heightFeet, range, heading } = landmark.window;
    const back = bearingToDirection((heading + 180) % 360);

    const at = (over) => ({ shot: shotFor(landmark, { ...inside, ...over }) });
    const out = (distance) => ({
        x: landmark.x + back.x * distance,
        z: landmark.z + back.z * distance
    });

    return [
        at(out(range[1] * 2)),            // too far out
        at(out(Math.max(range[0] / 4, 1))), // too close in
        at({ altitudeFeet: heightFeet[1] * 2 }), // too high
        at({ altitudeFeet: 0 }),          // too low
        at({ headingDegrees: (heading + 180) % 360 }) // the wrong side of it
    ];
}

/** A shot taken from the middle of a landmark's own window, which counts. */
function insideWindow(landmark) {
    const { heightFeet, range, heading } = landmark.window;
    const back = bearingToDirection((heading + 180) % 360);
    const out  = (range[0] + range[1]) / 2;

    return {
        x: landmark.x + back.x * out,
        z: landmark.z + back.z * out,
        altitudeFeet: (heightFeet[0] + heightFeet[1]) / 2,
        headingDegrees: heading
    };
}

/** Counts one step of a stage off, by whatever a stage of this mode counts. */
function countOff(mode, state, step) {
    if (mode.objective === LOOP_OBJECTIVE)  return recordGate(state, step);
    // A route counts a landing at the strip it is up to, so the landing is
    // reported with that strip under it rather than with nothing.
    if (mode.objective === CARGO_OBJECTIVE) return recordLanding(state, { index: nextStrip(state) });
    if (mode.objective === SEARCH_OBJECTIVE) return true;
    if (mode.objective === CORRIDOR_OBJECTIVE) return recordSection(state, step);
    if (mode.objective === SURVEY_OBJECTIVE) {
        const landmarks = stageLandmarks(state);
        return recordPhoto(state, landmarks, insideWindow(landmarks[step]));
    }
    // A circuit turns onto each leg in order and lands off the last one, which
    // is the one leg a turn cannot close.
    if (mode.objective === PATTERN_OBJECTIVE) {
        return step < FINAL_LEG ? recordPatternLeg(state, step) : recordLanding(state);
    }
    return recordLanding(state);
}

const CARD_LINE_CEILINGS = {
    name: 20, objective: 32, status: 44, clock: 29, pointer: 30
};

/**
 * The six groups the control settings panel is split across, each with the
 * heading over it and the list its rows are drawn into, in the order the panel
 * draws them.
 *
 * One table rather than two arrays beside each other, because the three facts
 * about a group travel together: a group added to the panel wants a heading, a
 * list, and a place in the order, and the tests below are what say so.
 */
const CONTROL_GROUPS = [
    { group: AXIS_GROUP,      heading: CONTROL_AXES_HEADING,      list: 'control-settings-axes' },
    { group: TILT_GROUP,      heading: CONTROL_TILT_HEADING,      list: 'control-settings-tilt' },
    { group: ATTITUDE_GROUP,  heading: CONTROL_ATTITUDE_HEADING,  list: 'control-settings-attitude' },
    { group: LEVEL_OFF_GROUP, heading: CONTROL_LEVEL_OFF_HEADING, list: 'control-settings-level-off' },
    { group: BINDING_GROUP,   heading: CONTROL_KEYS_HEADING,      list: 'control-settings-keys' },
    { group: REFERENCE_GROUP, heading: CONTROL_REFERENCE_HEADING, list: 'control-settings-reference' }
];

// The six lists the control settings panel is split across, which are held to
// the same rules the settings panel's three are.
const CONTROL_LISTS = CONTROL_GROUPS.map(entry => entry.list);

// Every menu drawn into the page: the two cards, the panels they open, and the
// lists the two biggest panels are split across.
const MENU_LISTS = [
    'start-menu', 'pause-menu', 'game-modes-menu', 'element-editor-menu',
    'build-picker-cards', 'build-picker-actions',
    'settings-menu', 'settings-start', 'settings-options',
    ...CONTROL_LISTS
];

// The heading over each of those lists, in the order the panel draws them.
const CONTROL_HEADINGS = CONTROL_GROUPS.map(entry => entry.heading);

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
 * Every rule in the page's stylesheet, as the selectors it was written for, the
 * declarations it carries, where in the sheet it sits, and whether an at-rule
 * is wrapped around it. Rules that style several things at once are read the
 * same as rules that style one, so grouping two overlays that are drawn the
 * same way does not hide either of them from a check that they are drawn that
 * way. The position is what lets a reader ask which of two matching rules wins
 * rather than only whether one of them exists, and the nesting is what stops a
 * rule written for one screen being read as a rule written for every screen.
 */
function styleRules(css) {
    // Comments come off first: a rule written under one would otherwise read as
    // a rule whose selector is the note above it.
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    let read = 0;
    let depth = 0;

    return [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((rule, order) => {
        // A rule's own braces balance, so the braces left over between one rule
        // and the next are the at-rules opening and closing around them.
        // Counting those as they go by says which rules sit inside a condition.
        for (const character of stripped.slice(read, rule.index)) {
            if (character === '{') depth += 1;
            else if (character === '}') depth -= 1;
        }
        read = rule.index + rule[0].length;

        return {
            selectors: rule[1].split(',').map(selector => selector.trim()),
            body: rule[2],
            order,
            nested: depth > 0
        };
    });
}

/** The declarations of the first rule an id is a selector of. */
function styleRule(css, id) {
    return styleRules(css).find(rule => rule.selectors.includes(`#${id}`))?.body ?? null;
}

/** True when some rule written for a selector carries a declaration. */
function styled(css, selector, declaration) {
    return styleRules(css).some(rule => rule.selectors.includes(selector) && declaration.test(rule.body));
}

/**
 * A selector's specificity, as the count of ids, of classes, and of element
 * names it carries - the three numbers the cascade weighs in that order. An
 * attribute test and a pseudo-class weigh as classes do, and a pseudo-element
 * as an element does, which is enough for a stylesheet written by hand.
 */
function specificity(selector) {
    const ids = (selector.match(/#[\w-]+/g) ?? []).length;
    const classes = (selector.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? []).length;
    const elements = (selector.replace(/[#.][\w-]+|\[[^\]]*\]|::?[\w-]+/g, ' ')
        .match(/[a-zA-Z][\w-]*/g) ?? []).length;
    return [ids, classes, elements];
}

/** Below zero when the first selector loses, above when it wins, zero on a tie. */
function compareSpecificity(a, b) {
    return (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
}

/**
 * What a rule body is left declaring for one property: the value of its last
 * declaration of that property, and whether that declaration was marked
 * important. A body naming a property twice is left with the second, the way
 * the cascade leaves it. Null when the body does not name the property at all.
 */
function declaredValue(body, property) {
    const declarations = [...body.matchAll(
        new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'gi'))];
    if (!declarations.length) return null;

    const value = declarations.pop()[1].trim();
    return {
        value: value.replace(/\s*!\s*important$/i, '').trim(),
        important: /!\s*important$/i.test(value)
    };
}

/**
 * The value an element carrying a set of classes is left with for one property:
 * of the rules matching it that declare the property, the important one if any
 * rule marked it so, and otherwise the last written among those of the highest
 * specificity, which is the order the cascade settles them in. Null when no
 * rule declares it.
 *
 * Which rule wins is a different question from whether a rule exists, and the
 * defect 1.19.1-alpha fixed was a rule that existed and lost - `.minimap-mark
 * .next` carried the green the whole time a held mark drew amber. A reading of
 * a colour belongs here rather than in `styled`, which answers the weaker
 * question and answered it happily throughout that bug.
 */
function cascaded(css, classes, property) {
    const wanted = new Set(classes);
    const matching = [];

    for (const rule of styleRules(css)) {
        for (const selector of rule.selectors) {
            // Only the rightmost compound says what a rule is written to style;
            // everything left of it is the context it wants that thing in. A
            // subject naming a class the set does not carry is a rule about some
            // other element, and none of this element's business.
            const subject = selector.split(/\s*[>+~]\s*|\s+/).pop();
            const parts = (subject.match(/\.[\w-]+/g) ?? []).map(part => part.slice(1));
            if (!parts.length || !parts.every(part => wanted.has(part))) continue;

            // Past that, a rule reaching this element through anything but its
            // own classes - an ancestor, an id, an element name - cannot be
            // settled from a set of classes alone, so say so rather than answer
            // around it. Skipping one quietly would hide exactly the kind of
            // rule this helper exists to weigh.
            assert.equal(selector.replace(/\.[\w-]+/g, '').trim(), '',
                `cascaded() cannot weigh "${selector}" against a class set alone: `
                + `it reaches .${classes.join('.')} through more than its classes`);

            matching.push({ rule, selector });
        }
    }

    const declared = matching
        .map(candidate => ({ ...candidate, declared: declaredValue(candidate.rule.body, property) }))
        .filter(candidate => candidate.declared);

    // A rule inside an at-rule is applied only while its condition holds, and a
    // set of classes does not say whether it holds. One that declares the
    // property asked for is refused for the reason an ancestor selector is,
    // rather than weighed as though it were written for every screen.
    for (const candidate of declared) {
        assert.equal(candidate.rule.nested, false,
            `cascaded() cannot weigh "${candidate.selector}" against a class set alone: `
            + 'it is written inside an at-rule, which decides whether it applies at all');
    }

    // An important declaration outranks every ordinary one whatever selector
    // carries it, so importance is weighed before specificity, and specificity
    // before the order the sheet was written in.
    const winner = declared
        .sort((a, b) => (Number(a.declared.important) - Number(b.declared.important))
            || compareSpecificity(specificity(a.selector), specificity(b.selector))
            || a.rule.order - b.rule.order)
        .pop();

    return winner ? winner.declared.value : null;
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
    for (const id of ['title-screen', 'paused', 'settings', 'control-settings', 'game-modes', 'element-editor',
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
    for (const id of ['settings-menu', 'settings-start', 'settings-options', ...CONTROL_LISTS]) {
        assert.ok(new RegExp(`<ul id="${id}">\\s*</ul>`).test(indexHtml),
            `the entries are drawn from js/menu.js, so the page should leave #${id} empty`);
    }
});

// The entry that opens this panel used to show the reference list instead, so the
// panel has to be on the page for the rename to have led anywhere.
test('the control settings panel is titled and says what it is setting', () => {
    assert.ok(indexHtml.includes(CONTROL_SETTINGS_TITLE), 'the panel should carry its title');
    for (const heading of CONTROL_HEADINGS) {
        assert.ok(new RegExp(`<h3>${heading}</h3>`).test(indexHtml),
            `the panel should name what its ${heading} list changes`);
    }
});

/**
 * The cursor walks the whole panel as one list and the lists it is drawn into
 * are filtered by group, so the order the headings come down the page has to be
 * the order the entries come in. A heading drawn out of that order is a cursor
 * that jumps up the page and back down again on one press of W.
 *
 * Checked against the entries rather than against a second copy of the order,
 * because the entries are the thing the cursor actually walks.
 */
test('the panel draws its headings in the order the cursor walks the groups', () => {
    const panel = indexHtml.slice(
        indexHtml.indexOf('id="control-settings"'),
        indexHtml.indexOf('id="game-modes"')
    );
    assert.ok(panel.length > 0, 'index.html should carry the control settings panel');

    const drawn = [...panel.matchAll(/<h3>([^<]+)<\/h3>\s*<ul id="([^"]+)"><\/ul>/g)]
        .map(([, heading, list]) => ({ heading, list }));

    assert.deepEqual(drawn, CONTROL_GROUPS.map(({ heading, list }) => ({ heading, list })),
        'every heading should be followed by the list its rows go into, in the drawn order');

    // And that order is the order the entries themselves come in.
    const walked = [];
    for (const entry of controlSettingsEntries()) {
        if (walked[walked.length - 1] !== entry.group) walked.push(entry.group);
    }

    assert.deepEqual(walked, CONTROL_GROUPS.map(entry => entry.group),
        'the cursor walks the groups in this order, so the headings should be drawn in it');
});

/**
 * Every group the panel's rows declare has a list of its own to be drawn into,
 * and the last list takes what is left over.
 *
 * This is the one with teeth. `controlReferenceMenu` in js/main.js is a
 * catch-all - it draws every entry whose group is not one of the five named
 * before it - so a group added to js/control-settings.js and not to that list
 * is not a group that goes missing. It is a group drawn under REFERENCE,
 * beneath the way out of the panel, with nothing anywhere saying so.
 *
 * js/main.js imports Three.js and cannot be imported here, so the filters are
 * read off its source the way the key handlers below are.
 */
test('every group the panel declares is drawn under a heading of its own', () => {
    const declared = [...new Set(controlSettingsEntries().map(entry => entry.group))];
    assert.deepEqual(declared.sort(), CONTROL_GROUPS.map(entry => entry.group).sort(),
        'a group the rows declare and the panel has no heading for is a group drawn '
      + 'under somebody else\'s');

    // The name each group constant is written under, so a filter naming the
    // constant can be read against the group it stands for.
    const named = {
        AXIS_GROUP, TILT_GROUP, ATTITUDE_GROUP, LEVEL_OFF_GROUP, BINDING_GROUP, REFERENCE_GROUP
    };

    const reference = CONTROL_GROUPS[CONTROL_GROUPS.length - 1];
    for (const { group, list } of CONTROL_GROUPS) {
        if (group === reference.group) continue;

        const built = new RegExp(
            `getElementById\\('${list}'\\)[\\s\\S]{0,120}?entry\\.group === (\\w+)`);
        const match = mainSource.match(built);
        assert.ok(match, `js/main.js should draw #${list} from the entries of one group`);
        assert.equal(named[match[1]], group,
            `#${list} is drawn from ${match[1]}, which is not the group its heading names`);
    }

    // And the catch-all at the end excludes every one of the others, so what is
    // left over is the reference group and nothing else.
    const catchAll = mainSource.match(new RegExp(
        `getElementById\\('${reference.list}'\\)[\\s\\S]{0,240}?!\\[([\\s\\S]*?)\\]\\s*\\.includes\\(entry\\.group\\)`));
    assert.ok(catchAll, `js/main.js should draw #${reference.list} from what the others leave`);

    const excluded = catchAll[1].split(',').map(name => name.trim()).filter(Boolean);
    assert.deepEqual(
        excluded.map(name => named[name]).sort(),
        CONTROL_GROUPS.filter(entry => entry.group !== reference.group)
            .map(entry => entry.group).sort(),
        `#${reference.list} takes everything the five before it do not, so a group missing `
      + 'from that list is a group drawn under REFERENCE with the suite still green');
});

// The panel says how it is worked, the way the settings panel does: a row that is
// stepped rather than chosen is not something a pilot guesses at.
test('the control settings panel says which keys step a row and which close it', () => {
    const panel = indexHtml.slice(
        indexHtml.indexOf('id="control-settings"'),
        indexHtml.indexOf('id="game-modes"')
    );
    assert.ok(panel.length > 0, 'index.html should carry the control settings panel');

    const hint = panel.match(/<small>([\s\S]*?)<\/small>/);
    assert.ok(hint, 'the panel should say how it is worked');
    for (const word of ['SELECT', 'ADJUST', 'CHOOSE', 'CLOSE']) {
        assert.ok(hint[1].includes(word), `the hint should say which keys ${word.toLowerCase()}`);
    }
});

/**
 * The reference list is a row of the panel now, so the row and the list it opens
 * should be named the same thing. They were two names for one thing for exactly
 * as long as the entry was called Controls.
 */
test('the reference list is headed with the name of the row that opens it', () => {
    const list = indexHtml.match(/<div id="controls-help-list">\s*<h3>([^<]*)<\/h3>/);
    assert.ok(list, 'the control list should be headed');
    assert.equal(list[1].trim(), CONTROL_REFERENCE_LABEL);
});

/**
 * The body of a `<div>` carrying an id, read to the `</div>` that balances its
 * own open rather than to the first one after it.
 *
 * A non-greedy capture is the obvious way to ask for this and it is only right
 * while the element holds no nested `<div>`: the first row group or footnote
 * wrapper written inside one cuts the span off at that group's close, and every
 * check reading the span goes quietly blind to everything past it. Counting the
 * opens and closes as they go by puts the end of the span where the element
 * ends, whatever is nested in it.
 *
 * Returns `{ body, fault }`, with exactly one of the two set. Three conditions
 * a reader can hit are three answers, and one `null` for all of them makes a
 * caller's `assert.ok` say the same sentence about each:
 *
 * - `fault` is `null` and `body` is the span - `''` for an element written
 *   empty. An element holding nothing is there and empty rather than absent,
 *   and `''` is falsy, so those two were one answer for as long as the span
 *   alone was the return.
 * - `fault` is `'missing'` when the page carries no `<div id="...">` at all.
 * - `fault` is `'unbalanced'` when the `<div>` tags cannot be counted through.
 *   Both directions reach it. An open the page never closes leaves the count
 *   above zero at the end. A stray close is the harder one: from inside the
 *   element it is indistinguishable from the element's own close, and it only
 *   gives itself away further down the page as a close with nothing open ahead
 *   of it - which is why the count runs over the whole document rather than
 *   from the element's own open. A document that does not balance anywhere
 *   therefore reports unbalanced everywhere, and that is the honest answer: a
 *   depth count that is one out is measuring some other span and cannot say
 *   which.
 */
function elementBody(html, id) {
    const open  = `<div id="${id}">`;
    const start = html.indexOf(open);
    if (start === -1) return { body: null, fault: 'missing' };

    let depth  = 0;
    let inside = null;
    let body   = null;

    // Only `<div` and `</div` move the depth, so a nested element of any other
    // name - a list, a span, the `<br>` the rows are broken on - is read as part
    // of the body, which is what it is.
    for (const tag of html.matchAll(/<(\/?)div\b/g)) {
        const closing = Boolean(tag[1]);

        // A close with nothing open ahead of it. Every depth past this point is
        // one out, so whatever span was measured before it is a guess rather
        // than a reading, and saying so beats handing back the short one.
        if (closing && depth === 0) return { body: null, fault: 'unbalanced' };

        depth += closing ? -1 : 1;

        // The element's own close is the one that takes the depth back to what
        // it was before its open, wherever on the page that open sits.
        if (tag.index === start) inside = depth;
        else if (body === null && inside !== null && depth === inside - 1) {
            body = html.slice(start + open.length, tag.index);
        }
    }

    return depth === 0 && body !== null
        ? { body, fault: null }
        : { body: null, fault: 'unbalanced' };
}

/**
 * The two checks below read the whole body of the control list, and what they
 * are worth rests on the span reaching the list's own close. Today's markup
 * cannot show that: the list carries no nested element, so a span that stopped
 * at the first `</div>` would stop in the right place anyway, which is how a
 * guard written to read the whole list read one row of it for a version and
 * then everything-before-the-first-nested-close for another. So the reach is
 * stated against markup that does nest rather than left to the page to
 * demonstrate by accident.
 *
 * The three answers the reader can give are held here too. Nothing exercised
 * either unbalanced direction while a short span, an unreadable one and an
 * absent element were all `null`, and the docstring promising to report
 * unbalanced tags described only the direction that runs off the end of the
 * page - the other handed back a truncated span and said nothing.
 */
test('a list body is read past a nested close rather than up to the first one', () => {
    const nested = [
        '<div id="controls-help-list">',
        '    <h3>CONTROL REFERENCE</h3>',
        '    <div class="group">W/S or arrows - Pitch<br></div>',
        '    X - Show Controls<br>',
        '</div>',
        '<div id="controls-help-hint">H - CONTROL REFERENCE</div>'
    ].join('\n');

    const { body, fault } = elementBody(nested, 'controls-help-list');
    assert.equal(fault, null, 'the reader should find the list');
    assert.match(body, /X - Show Controls/,
        'the span should reach the rows written after a nested group rather than stop at its close');
    assert.doesNotMatch(body, /controls-help-hint/,
        'and should stop at the list\'s own close rather than run on into the hint beside it');

    assert.deepEqual(elementBody(nested, 'controls-help-nothing'), { body: null, fault: 'missing' },
        'and should say so rather than guess when the page carries no such element');

    // One close too many, which is the direction the reader used to answer with
    // a short span: the stray reads as the list's own close, the two rows below
    // it fall outside the span, and a guard over that span cannot see the row
    // that would fail it.
    const overClosed = [
        '<div id="controls-help-list">',
        '    <h3>CONTROL REFERENCE</h3>',
        '    W/S or arrows - Pitch<br></div>',
        '    X - Show Controls<br>',
        '    F2 - Photo',
        '</div>',
        '<div id="controls-help-hint">H - CONTROL REFERENCE</div>'
    ].join('\n');
    assert.deepEqual(elementBody(overClosed, 'controls-help-list'), { body: null, fault: 'unbalanced' },
        'a list carrying a stray close cannot be read rather than being short');

    const unclosed = [
        '<div id="controls-help-list">',
        '    <h3>CONTROL REFERENCE</h3>',
        '    W/S or arrows - Pitch<br>',
        '    X - Show Controls<br>'
    ].join('\n');
    assert.deepEqual(elementBody(unclosed, 'controls-help-list'), { body: null, fault: 'unbalanced' },
        'and neither can one the page never closes');

    assert.deepEqual(elementBody('<div id="controls-help-list"></div>', 'controls-help-list'),
        { body: '', fault: null },
        'while a list written empty is there and empty rather than missing');
});

/**
 * The rows of a list body, as text: the heading off, the tags off, one line per
 * row.
 *
 * The heading is the list's own name and the correct one, held where it is by
 * the test above, so it comes off before the body is read for a second one. The
 * tags come off because an attribute is not a row. A wrapper named after the
 * panel it sits in - `<div class="controls-row">` is the likely one - reads as
 * the list naming itself again to anything scanning markup, and gets quoted
 * back at the reader as a row, while the same span with its tags stripped
 * carries no second name at all. Tags become line breaks rather than nothing,
 * so the `<br>` the rows are broken on keeps them apart and a failure can quote
 * the one row that is wrong instead of the whole list run together.
 */
function listRows(body) {
    return body.replace(/<h3>[\s\S]*?<\/h3>/, '').replace(/<[^>]*>/g, '\n');
}

/**
 * The span a failure quotes a name out of: the whole row the name was found in,
 * built from the name itself rather than written out beside it.
 *
 * Deriving the capture takes the whole of `name` rather than its `source` alone,
 * because the two parts of a pattern that an edit reaches are the text and the
 * flags. The flags come from `name.flags`, so tightening a name to `/Controls?/`
 * on the view that a row always capitalises it tightens the quote with it;
 * spelled `'i'` here instead, the guard would pass a row reading
 * `X - show controls` while the capture went on matching that same row, and the
 * two would disagree about which rows exist. The text goes inside `(?:...)`, so
 * widening a name to an alternation cannot reach past it: interpolated bare,
 * `/controls?|key list/i` builds `[^\r\n]*controls?|key list[^\r\n]*`, whose
 * second branch starts at the name, and a row `H - Hide Key List` is quoted as
 * the bare fragment `Key List` rather than as the row it was found in - which is
 * the one thing the capture exists to do that the name does not already do.
 */
function nameRow(name) {
    return new RegExp(`[^\\r\\n]*(?:${name.source})[^\\r\\n]*`, name.flags);
}

/**
 * The name a list may not carry a second time, and the span a failure quotes it
 * out of.
 *
 * The guard reports the whole row the name was found in rather than the bare
 * word, so there is a capture as well as a name - and the capture is built from
 * the name rather than written out beside it. The two were written out twice for
 * a while, each spelling the name between a pair of `[^\r\n]` runs: one copy the
 * quote the guard makes, the other the quote a test checks it against. That is a
 * pair which can only drift apart silently, since changing what the guard quotes
 * with left the test green against the pattern the guard had stopped using.
 */
const SECOND_NAME = /controls?/i;
const SECOND_NAME_ROW = nameRow(SECOND_NAME);

/**
 * The derivation above is correct and, measured against today's name, unable to
 * fail: `/controls?/i` is a bare sequence carrying the single flag a hand-written
 * `'i'` happens to spell correctly, so writing the capture out beside the name
 * again - either half of it - passed all 1247 tests, which was the suite as it
 * stood before the pair below was added. That pair is what catches it now: the
 * literal `'i'` fails the tightened name, the unparenthesised interpolation
 * fails the widened one, and each fails alone. What the derivation is worth
 * shows only against a name somebody has edited, which is the case it exists for,
 * so the two edits it has to survive are stated here under names of their own
 * rather than left until one of them is made on the real one.
 *
 * Deriving from the name is what the capture is for, so these read it through
 * `nameRow()` rather than through `SECOND_NAME_ROW`. Asserting against the
 * built constant could only restate the pattern a second time, which is the
 * drift the derivation was introduced to end.
 */
test('the row a failure quotes is derived from the whole of the name it scans for', () => {
    const tightened = /Controls?/;
    assert.doesNotMatch('X - show controls', tightened,
        'a name tightened to require the capital reads no second name in an uncapitalised row');
    assert.doesNotMatch('X - show controls', nameRow(tightened),
        'and its quote agrees, rather than matching a row the guard beside it passed');

    const widened = /controls?|key list/i;
    assert.match(widened.source, /\|/, 'a name widened to an alternation holds one');
    const secondBranch = 'H - Hide Key List'.match(nameRow(widened));
    assert.ok(secondBranch,
        'whose quote carries the flags the name was widened under, rather than dropping them and reading past the capitals');
    assert.match(secondBranch[0], /^H - Hide Key List$/,
        'and a row found by its second branch is still quoted whole rather than as the bare name');
});

/**
 * The heading above is only half of it. The row that collapses the list sits
 * inside the list, and it read `H - Hide Controls` for as long as the heading
 * read `CONTROLS` - so renaming the heading and the hint left the list calling
 * itself by the old name in its own body, which is the exact reading those
 * renames were made to stop. The row says what the key does instead, and this
 * holds it there: the list may not carry a second name for itself anywhere in
 * it.
 */
test('the row that collapses the list names the action rather than the list', () => {
    const { body: list, fault } = elementBody(indexHtml, 'controls-help-list');
    assert.equal(fault, null,
        `index.html should carry a control list the reader can read - it reported "${fault}"`);

    const row = list.match(/(?:^|>|\s)H - ([^<\r\n]*)/m);
    assert.ok(row, 'the list should name the H key');

    const action = row[1].trim();
    assert.match(action, /^Collapse\b/i,
        `the H row "${action}" should say the list collapses, as README.md and CHEATSHEET.md do`);

    const rows   = listRows(list);
    const second = rows.match(SECOND_NAME_ROW);
    assert.doesNotMatch(rows, SECOND_NAME,
        `the row "${second ? second[0].trim() : ''}" should not name the list a second time`);
});

/**
 * The guard above scans the list for a second name, and what it is worth rests
 * on scanning the rows rather than the markup they are written in. Today's page
 * cannot show the difference: its rows are bare text between `<br>`s, so there
 * is no attribute in the span to misread, and the one wrapper nested anywhere
 * in the suite - the `<div class="group">` in the test above - happens to carry
 * no `control`. So the bound is written here rather than left to the wrapper
 * names the page happens to use.
 *
 * It takes one span holding both to state, and splitting it across two was what
 * left half of it unable to fail. A wrapper on its own says only that a class is
 * not read as a row. A named row on its own carries no tag at all once the tags
 * are off, so asking whether a failure quoted the row "rather than a tag" has
 * nothing else it could have quoted, and the answer is yes however the stripping
 * behaves. The span that carries a wrapper and a genuine `X - Show Controls` row
 * together is the only arrangement in which quoting the class is possible, which
 * is what makes it the case worth writing.
 */
test('a list is scanned for a second name by its rows rather than by its markup', () => {
    const wrapped = listRows([
        '<h3>CONTROL REFERENCE</h3>',
        '<div class="controls-row">W/S or arrows - Pitch<br></div>',
        'H - Collapse List<br>'
    ].join('\n'));
    assert.doesNotMatch(wrapped, SECOND_NAME,
        'a wrapper named after the panel it sits in is a class rather than a second name');
    assert.match(wrapped, /W\/S or arrows - Pitch/, 'and the row written inside it is still read');

    const both = listRows([
        '<h3>CONTROL REFERENCE</h3>',
        '<div class="controls-row">W/S or arrows - Pitch<br></div>',
        'X - Show Controls<br>',
        'H - Collapse List<br>'
    ].join('\n'));
    assert.match(both, SECOND_NAME,
        'while a row that does name the list a second time is caught beside that same wrapper');
    const quoted = both.match(SECOND_NAME_ROW);
    assert.ok(quoted,
        'whose quote carries the flags the name was written with, rather than dropping them and missing the capitals');
    assert.match(quoted[0], /X - Show Controls/,
        'and that row is what a failure quotes, rather than the class it is written inside');
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
    const { body: list, fault } = elementBody(indexHtml, 'controls-help-list');
    assert.equal(fault, null,
        `index.html should carry a control list the reader can read - it reported "${fault}"`);

    for (const key of ['C', 'Tab', 'H', 'P', 'R']) {
        assert.ok(new RegExp(`(^|>|\\s)${key} -`, 'm').test(list), `the list should name the ${key} key`);
    }
    assert.ok(list.includes(`${MUTE_KEY.replace('Key', '')} -`), 'including the one that mutes the sound');
    for (const code of SETTINGS_OPEN_KEYS) {
        assert.ok(list.includes(`${code.replace('Key', '')} -`), 'and the one that opens the settings');
    }
    for (const code of BUILDER_OPEN_KEYS) {
        assert.ok(list.includes(`${code.replace('Key', '')} -`),
            'and the one that opens the interactive environment builder');
    }
    assert.ok(list.includes(`${PHOTO_KEY} -`), 'and the one that takes a picture');
});

// Every list under the panel's headings is styled the same way, so a heading
// added to the markup and not to the stylesheet is a list drawn as bullets.
test('every list the panel is split across is styled as a menu rather than a list', () => {
    for (const id of ['settings-menu', 'settings-start', 'settings-options', ...CONTROL_LISTS]) {
        assert.ok(new RegExp(`#${id}[,\\s]`).test(indexHtml), `index.html should style #${id}`);
        assert.ok(new RegExp(`#${id} li[,\\s]`).test(indexHtml), `and the entries drawn into #${id}`);
        assert.ok(new RegExp(`#${id} li\\.selected[,\\s]`).test(indexHtml),
            `and the cursor when it is over #${id}`);
    }
});

/**
 * A panel added to the markup and not to the stylesheet is a card with no card
 * around it: the rows draw as bullets over the world and the title has no box.
 */
test('the control settings panel is styled as a card like the panels beside it', () => {
    const rule = styleRule(indexHtml, 'control-settings');
    assert.ok(rule, 'index.html should style #control-settings');
    assert.ok(/display:\s*none/.test(rule), 'and it should start hidden');
    assert.ok(/position:\s*fixed/.test(rule), 'and lie over the flight rather than in the page');
    assert.ok(/overflow-y:\s*auto/.test(rule),
        'and scroll rather than running off the bottom of a short window');

    for (const selector of ['#control-settings h2', '#control-settings h3', '#control-settings small']) {
        assert.ok(new RegExp(`${selector}[,\\s]`).test(indexHtml), `index.html should style ${selector}`);
    }
});

// Every row says what it changes under it, the way the settings panel's rows do.
test('the note under a control settings row is drawn', () => {
    for (const id of CONTROL_LISTS) {
        assert.ok(new RegExp(`#${id} li\\[data-note\\]::after[,\\s]`).test(indexHtml),
            `index.html should draw the note under a row of #${id}`);
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

// The CONTROL REFERENCE row of the control settings panel is what puts the list
// on screen, and H is what collapses it over a flight, so a click has to be the
// way off it for a pilot working the menus with the mouse.
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

/**
 * And is raised off a mark on the card, the way the landing breakdown is. The
 * pointer is the last row written on a card that clips from the bottom, so it
 * is the first row the clip reaches - and a display written inline by the run
 * is one no rule can reach, which leaves the row to be sliced through its own
 * glyphs on a screen with no room to draw it whole.
 */
test('the gate pointer is raised off a mark the page can take the row off by', () => {
    assert.ok(/classList\.toggle\('pointing', Boolean\(text\)\)/.test(hudSource),
        "js/hud.js should mark the card while a gate is being pointed at");
    assert.ok(!/modePointerElement\.style\.display/.test(hudSource),
        'and leave the row itself to the page, rather than writing a display onto it');

    assert.equal(declarations(indexHtml, '#game-mode.pointing #game-mode-pointer').get('display'),
        'block', 'and the page should draw the row off that mark');
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
test('a mark on the chart is the colour the hoop it stands for is', () => {
    const rings = readFileSync(fileURLToPath(new URL('../js/rings.js', import.meta.url)), 'utf8');
    const hex = (name) => rings.match(new RegExp(`${name}\\s*=\\s*0x([0-9a-fA-F]{6})`))?.[1];

    const readings = [
        [['minimap-mark'],          'RING_COLOR'],
        [['minimap-mark', 'next'],  'RING_NEXT_COLOR'],
        [['minimap-mark', 'flown'], 'RING_DONE_COLOR']
    ];

    for (const [classes, name] of readings) {
        const color = hex(name);
        assert.ok(color, `js/rings.js should name ${name}`);
        assert.equal(cascaded(indexHtml, classes, 'fill')?.toLowerCase(), `#${color.toLowerCase()}`,
            `a mark carrying .${classes.join('.')} should resolve its fill to ${name}`);
    }
});

// The weight a held mark's outline is drawn at, which is the page's own number
// rather than a figure this file invents: `.minimap-mark.off-map` declares it.
const HELD_MARK_STROKE = 0.9;

/**
 * A mark past the edge of the square is hollowed out, so the fill the reading
 * above is carried by is gone and the stroke has to carry it instead. That is
 * the ordinary reading for a route, whose strips are commonly all held at once:
 * flattened, the leg being flown and the leg still ahead draw identically, and
 * the chart gives a bearing with no leg attached to it.
 */
test('a mark held at the edge of the chart keeps the colour of the hoop it stands for', () => {
    const rings = readFileSync(fileURLToPath(new URL('../js/rings.js', import.meta.url)), 'utf8');
    const hex = (name) => rings.match(new RegExp(`${name}\\s*=\\s*0x([0-9a-fA-F]{6})`))?.[1];

    const readings = [
        [['minimap-mark', 'off-map'],          'RING_COLOR'],
        [['minimap-mark', 'next', 'off-map'],  'RING_NEXT_COLOR'],
        [['minimap-mark', 'flown', 'off-map'], 'RING_DONE_COLOR']
    ];

    // Pinning the held weight to a number of its own would still pass with the
    // unheld weight raised to meet it, and a held mark that draws at the weight
    // of an unheld one is the reading gone whatever either number says. So the
    // pair is read together, and the number below is the one the loop then
    // holds the three readings to.
    const unheld = Number(cascaded(indexHtml, ['minimap-mark'], 'stroke-width'));
    assert.ok(Number.isFinite(unheld), 'an unheld mark should declare a stroke-width to widen over');
    assert.ok(HELD_MARK_STROKE > unheld,
        `a held mark should be drawn wider than the ${unheld} an unheld one carries, `
        + 'rather than at the same weight with no fill to tell them apart');

    for (const [classes, name] of readings) {
        const color = hex(name);
        assert.ok(color, `js/rings.js should name ${name}`);
        assert.equal(cascaded(indexHtml, classes, 'stroke')?.toLowerCase(), `#${color.toLowerCase()}`,
            `a held mark carrying .${classes.join('.')} should resolve its stroke to ${name}, `
            + 'the reading the fill carries inside the square');

        // The hollow has to survive the reading being restored, and it is the
        // reverse of the same cascade question: `.minimap-mark.off-map` ties
        // with `.minimap-mark.next` on specificity and wins only by being
        // written below it.
        assert.equal(cascaded(indexHtml, classes, 'fill'), 'none',
            `a held mark carrying .${classes.join('.')} should stay hollow, `
            + 'which is what says it is past the edge');

        // A hollow mark is drawn by its outline alone, so the outline is what
        // has to be seen: the held rules widen it over the one an unheld mark
        // carries, and the reading is three declarations rather than the two
        // above.
        assert.equal(cascaded(indexHtml, classes, 'stroke-width'), String(HELD_MARK_STROKE),
            `a held mark carrying .${classes.join('.')} should resolve its stroke-width `
            + `to ${HELD_MARK_STROKE}, the weight a mark drawn without a fill needs`);
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

/** The effects layer, read off its source: it imports Three.js like the rest. */
const weatherSource = readFileSync(
    fileURLToPath(new URL('../js/weather.js', import.meta.url)), 'utf8'
);

/**
 * The same source with the prose taken out of it, for the claims that are
 * about what a module does not do.
 *
 * A module that explains what it deliberately left behind names the thing it
 * left behind, so a bare search of the file finds the word in the paragraph
 * saying it is gone and reports it as present. The code is where the claim
 * lives; the comment is where it is argued.
 */
const code = (source) => source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/**
 * The three things the weather layer was lifted onto rather than lifted with,
 * each of them a place the branch it came from had an answer this world has a
 * better one for. All three are the same shape of mistake if they come back:
 * the layer goes on working and draws a sky that disagrees with the one the
 * rest of the world is lit by.
 *
 * Read off the source because the module imports Three.js and cannot be
 * constructed in Node, the way the ring colours and the approach marks above
 * are.
 */
test('the weather is drawn in the hour this world runs rather than in a switch', () => {
    assert.match(weatherSource, /import\s*\{[^}]*celestialAt[^}]*\}\s*from\s*'\.\/weather-math\.js'/,
        'js/weather.js should place the sky body by the arc the light walks');
    assert.match(weatherSource, /celestialAt\(/, 'and actually call it');

    const drawn = code(weatherSource);

    assert.ok(!/KEY_LIGHT_POSITION|keyPosition/.test(drawn),
        'a fixed light position here is the day-or-night switch back again');
    assert.ok(!/STYLE\b|weather-style/.test(drawn),
        'and nothing of the resolved style module on the branch travels');
    assert.ok(!/tone|tint/i.test(drawn),
        'the tone tint is dropped entirely: the colour here is the colour of the hour');
});

/**
 * The condition is a setting rather than a constant, which is the whole reason
 * the branch's surface was judged unfinished: it was `export const WEATHER`
 * hand-edited in the module and resolved once at import, with no setter and
 * nothing a panel could reach.
 */
test('the weather condition is asked for rather than written into the module', () => {
    assert.match(weatherSource, /setPrecipitation\s*\(/,
        'js/weather.js should take the condition from a caller');
    assert.ok(!/^export const WEATHER\b/m.test(weatherSource),
        'and hold none of its own');

    const main = scripts.find(entry => entry.name === 'main.js').source;
    assert.match(main, /setPrecipitation\(currentOption\([^)]*WEATHER_OPTION\)\)/,
        'and js/main.js should hand it whatever the settings panel is on');
});

/**
 * The layer brings no assets with it. The branch loaded three svgs through a
 * `TextureLoader` with a fallback blob for when one was missing - which is a
 * loader, a fallback and three files to deploy, for three shapes a canvas can
 * draw. Everything else in this world is generated rather than placed, and a
 * weather layer that shipped files would be the one exception.
 */
test('the weather textures are drawn rather than loaded', () => {
    assert.match(weatherSource, /createElement\('canvas'\)/,
        'js/weather.js should draw its textures');
    assert.ok(!/TextureLoader|\.svg|\.png/.test(weatherSource),
        'and load nothing, so there is no asset to fail to load');
});

/**
 * Half the deck is drawn mirrored, and a sprite's scale is not where that can
 * be said. The sprite shader reads a sprite's size out of its own model matrix
 * as `length(vec3(modelMatrix[0].xyz))`, so a negative width arrives positive
 * and the flip is spent on nothing: `sprite.scale.set(cloud.width *
 * cloud.facing, ...)` drew 95 copies of one unmirrored shape, which is the
 * outcome `createCloudDeck`'s own comment says the flip exists to prevent.
 *
 * `test/weather-math.test.js` pins the deck data and cannot see this - a
 * `facing` of `-1` is there in the arrangement either way - so the claim is
 * read off the renderer, and whether the sky then stops reading as one repeated
 * shape is settled on a screenshot rather than here.
 */
test('the cloud deck is mirrored by the texture it is drawn from, not by its scale', () => {
    const [built] = weatherSource.match(/\n {4}addClouds\(\) \{[^]*?\n {4}\}/) ?? [];
    assert.ok(built, 'js/weather.js should declare the deck builder as a method');

    assert.ok(!/scale\.set\([^)]*facing/.test(built),
        'a sprite mirrored by its scale is a sprite not mirrored at all');
    assert.match(built, /cloudTexture\(mirrored\)|cloudTexture\(true\)/,
        'so one of the deck materials should carry a mirrored texture');
    assert.match(built, /new THREE\.Sprite\(this\.cloudMaterials\[[^\]]*cloud\.facing/,
        'and the facing should pick which material a cloud is drawn with');

    // Bounded to the function and then to the branch, for the same reason the
    // spans above are. Read over the whole module this was satisfied by a
    // `ctx.scale(-1, 1)` anywhere in it: the flip could be lifted out of
    // `cloudTexture` into `streakTexture`, which leaves every cloud drawn
    // unmirrored - the bug this test exists for - with the suite green.
    const [drawn] = weatherSource.match(/\nfunction cloudTexture\([^]*?\n\}/) ?? [];
    assert.ok(drawn, 'js/weather.js should declare the cloud texture as a function of its own');
    assert.match(drawn, /if \(mirrored\) \{[^}]*ctx\.scale\(-1, 1\)/,
        'and draw the mirror on the canvas under that flag, which is where it survives');

    // Two materials are two places every per-frame write has to reach. Each
    // writer wrote to the one material there was, and either left behind is
    // half a deck at the wrong density or lit by the wrong hour.
    //
    // The method name is anchored to a declaration rather than matched loose,
    // because `update` calls both of these: a span opened on the call site runs
    // to the end of `update` and holds neither body.
    //
    // And the write is read as the collection rather than as the name: a bare
    // `/this\.cloudMaterials/` is satisfied by `this.cloudMaterials[0]`, which
    // is the one-material bug back again under the plural name.
    for (const [method, what] of [['setPrecipitation', 'the condition'], ['updateClouds', 'the hour']]) {
        const [body] = weatherSource.match(new RegExp(`\\n {4}${method}\\([^]*?\\n {4}\\}`)) ?? [];
        assert.ok(body, `js/weather.js should declare ${method} as a method`);
        assert.match(body, /this\.cloudMaterials(?!\s*\[)/,
            `${what} should be written to every material rather than to one of them`);
    }
});

/**
 * The doc block above `anchor` in `source`, taken as the last one to open
 * before it. Comments are the one part of a module nothing else here reads,
 * which is how the deck's own note on cost came to carry a figure nothing
 * measures.
 */
function docAbove(source, anchor) {
    const at = source.indexOf(anchor);
    assert.ok(at > 0, `${anchor} should be in the source being read`);

    const blocks = source.slice(0, at).match(/\/\*\*[^]*?\*\//g) ?? [];
    return blocks.at(-1) ?? '';
}

/**
 * The second cloud material was costed at "one more draw call for the deck",
 * which is not a figure this renderer supports. A sprite is pushed into the
 * render list as an object of its own and drawn with its own call, so the deck
 * costs a call for every cloud in frame whether the sprites share one material
 * or two: read off `renderer.info.render` on the running page, a 95-cloud storm
 * held whole in frame drew 95 calls over one material and 95 over two. What the
 * second one costs is material changes - the deck is transparent and so sorted
 * back to front, and with `facing` drawn at random the two interleave, which
 * came out at 43 changes over the 94 steps of one sorted deck.
 *
 * Both directions of that matter to a reader sizing a third texture: the call
 * count is already the cloud count and will not grow, and the bindings do.
 */
test('the second cloud material is costed as the bindings it is, not as a draw call', () => {
    const doc = docAbove(weatherSource, '\n    addClouds() {');

    assert.match(doc, /cost/, 'the deck builder should say what its second material costs');
    assert.ok(!/draw call for the deck/.test(doc),
        'and not count it as a draw call, which every sprite already is on its own');
    assert.match(doc, /binding|material change/,
        'but as the material changes a sorted, interleaved deck costs');
    assert.match(doc, /call of its own|its own call|a call for every cloud|a call a cloud/,
        'and say what a call belongs to, which is a sprite rather than a deck');
});

/**
 * Built to the worst weather and drawn down to the weather in force. The other
 * way round - building for the condition it was handed - means throwing the
 * sprites away and building 5200 more on the frame a pilot asks for a storm,
 * which is a stall in mid-flight to save a few hundred kilobytes.
 */
test('the weather is built once and drawn down to the condition in force', () => {
    // Every claim here is bounded to the method it is about, the way the spans
    // in `test/input-map.test.js` are: a method body read past its own closing
    // brace is the whole module tested against a claim about one function.
    //
    // Two of them were not, and each passed on text that was not the code it
    // named. `/PRECIPITATION_MOST/` over the whole source matched the import
    // and the constructor, so `addRain` could size the instanced mesh with a
    // literal 5200 - the one regression this test's own comment names - and
    // stay green. `/this\.rain\.count\s*=/` matched the `this.rain.count === 0`
    // guard in `updateRain`, so the assignment it was written for could be
    // deleted and stay green with it. A pattern that matches a comparison when
    // it means an assignment, or a name when it means a figure, is a pattern
    // bounded to the module rather than to the statement.
    const [opens] = weatherSource.match(/constructor\(scene[^]*?\n {4}\}/) ?? [];
    assert.ok(opens, 'js/weather.js should build the layer in its constructor');
    assert.match(opens, /createCloudDeck\(PRECIPITATION_MOST\.clouds\)/,
        'js/weather.js should size the deck to the worst weather there is');
    assert.match(opens, /createDrops\(PRECIPITATION_MOST\.rainDrops\)/,
        'and the rain box with it');

    const [built] = weatherSource.match(/\n {4}addRain\(\) \{[^]*?\n {4}\}/) ?? [];
    assert.ok(built, 'js/weather.js should declare the rain builder as a method');
    assert.match(built, /const count\s*=\s*PRECIPITATION_MOST\.rainDrops\s*;/,
        'and draw as many instances as the worst weather asks for');
    assert.match(built, /new THREE\.InstancedMesh\([^)]*,\s*count\)/,
        'which is the figure the mesh is built with rather than one of its own');

    const [set] = weatherSource.match(/setPrecipitation\(id[^]*?\n {4}\}/) ?? [];
    assert.ok(set, 'js/weather.js should declare the condition setter as a method');
    assert.match(set, /this\.rain\.count\s*=\s*Math\.min\(\s*precip\.rainDrops\s*,/,
        'and draw the rain down to the count the condition asks for');
    assert.ok(!/new THREE\./.test(set),
        'changing the condition mid-flight should build nothing');
});

/**
 * A strike is weather rather than an hour. `applyDaylight` hands back the
 * light in force and the water glints by what it hands back, so a flash folded
 * into it would have a lake sparkling off lightning at midnight.
 */
test('a lightning flash lights the sky without becoming the hour', () => {
    const sky = readFileSync(fileURLToPath(new URL('../js/sky.js', import.meta.url)), 'utf8');

    assert.match(sky, /import\s*\{[^}]*flashedSky[^}]*\}\s*from\s*'\.\/weather-math\.js'/,
        'js/sky.js should take the flash arithmetic from the pure module');
    assert.match(sky, /flashedSky\(light\.sky,\s*flash\)/, 'and wash the sky with it');
    assert.match(sky, /flashedAmbient\(light\.ambient\.intensity,\s*flash\)/,
        'and the fill light with it');

    assert.ok(!/light\.daylight\s*[*+]|flashedDaylight/.test(sky),
        'but never the daylight, which is what the water reads');
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

    // Lifted that far it lands in the column the readouts were dropped into,
    // so what it is bounded against is the underside of that stack rather
    // than the top of the screen. Bounded to the screen it cleared the pads
    // and covered three of the four values a pilot flies on instead.
    const stack = pixels(indexHtml, '#hud.floated', 'top')
                + pixels(indexHtml, '#hud.floated', 'max-height');
    const bound = declarations(narrow, '#game-mode.floated').get('max-height');
    const under = Number(bound?.match(/^calc\(100vh - (\d+)px\)$/)?.[1]);

    assert.ok(Number.isFinite(under),
        'the card should be bounded to the room it has, so it clips rather than overflows');
    assert.ok(under >= lift + stack,
        `the card is bounded to ${under}px off the screen and the band and the stacked `
      + `readouts above it come to ${lift + stack}px`);
    assert.equal(declarations(narrow, '#game-mode.floated').get('overflow'), 'hidden');

    // And it lands over the readouts wherever it lands, so it has to be read
    // as one card rather than as two overlays through each other.
    const alpha = (rule) => Number(declarations(indexHtml, rule).get('background')
        ?.match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1]);

    assert.ok(alpha('#game-mode.floated') > alpha('#game-mode'),
        `the floated card reads at ${alpha('#game-mode.floated')} over the readouts `
      + `and the placed one at ${alpha('#game-mode')}`);
});

/**
 * The lift and the drop were each placed well and neither was placed against
 * the other. The card is opaque and draws at 120 against the readouts' 100,
 * so where the two meet it is the card that is read and the readouts that are
 * lost - which is why the card's own lines were correct while three of the
 * four values a pilot flies on were behind it.
 *
 * Every other check in this file measures one overlay against the pads. This
 * one measures the two of them against each other, at the sizes they were
 * actually driven at, which is the check neither release made.
 */
test('the card and the readouts are never given the same band of the screen', () => {
    assert.ok(Number.isFinite(CARD_CLEARS_STACK),
        'the page should say what width the card passes the stack at');

    for (const screen of MEASURED_SCREENS) {
        const size = `${screen.width}x${screen.height}`;
        const card = verticalBand(indexHtml, ['#game-mode', '#game-mode.floated'], screen);
        const readouts = verticalBand(indexHtml, ['#hud', '#hud.floated'], screen);

        assert.ok(card, `the card should be placed and bounded in pixels at ${size}`);
        assert.ok(readouts, `and so should the readouts it shares the screen with at ${size}`);

        // Past the width the card's left edge passes their right edge at, the
        // two are beside each other rather than one over the other, and a
        // band measured down the screen says nothing about whether they meet.
        const apart = screen.width > CARD_CLEARS_STACK && !sharesTheLane(indexHtml, screen);

        assert.ok(card.to <= readouts.from || readouts.to <= card.from || apart,
            `at ${size} the card takes ${card.from}px to ${card.to}px and the readouts `
          + `${readouts.from}px to ${readouts.to}px`);
    }
});

/**
 * On a screen too short for the stack the readouts go in the band between the
 * pad clusters, and the card was centred on that same band. So on a phone held
 * sideways - which js/tilt-controls.js calls the ordinary way this is flown -
 * it is the card that leaves, for the lane the readouts have just left: hung
 * from the top of it, narrowed to it, and stopping where the band begins.
 */
test('the card takes the lane the readouts left on a phone held sideways', () => {
    const sideways = media(indexHtml, '(max-height: 540px) and (min-width: 500px)');
    assert.ok(sideways, 'index.html should say where the card goes on a phone held sideways');

    const lane = pixels(sideways, '#hud.floated', 'left');
    const width = declarations(sideways, '#game-mode.floated').get('max-width');
    const gap = Number(width?.match(/^calc\(100vw - (\d+)px\)$/)?.[1]);

    assert.equal(declarations(sideways, '#game-mode.floated').get('bottom'), 'auto',
        'the card comes off the bottom middle, which is the band the readouts were given');
    assert.ok(Number.isFinite(pixels(sideways, '#game-mode.floated', 'top')),
        'and is hung from the top edge instead, in pixels');

    assert.ok(Number.isFinite(gap), 'the card should be narrowed to the lane it is hung in');
    assert.equal(gap, lane * 2,
        `the card is held ${gap / 2}px off each edge and the readouts ${lane}px`);
    assert.equal(declarations(sideways, '#game-mode.floated').get('min-width'), '0',
        'the 260 it asks for is wider than that lane on a 568 pixel screen, so it gives it up');

    // The lane is what keeps the card off the two instruments, whatever the
    // screen is: the ladder is inside one end of it and the chart the other.
    const ladder = pixels(indexHtml, '#attitude.floated', 'left')
                 + pixels(indexHtml, '#attitude.floated', 'width');
    const chart  = pixels(indexHtml, '#minimap', 'right') + pixels(indexHtml, '#minimap', 'width');

    assert.ok(lane >= ladder, `the lane starts at ${lane}px and the ladder ends at ${ladder}px`);
    assert.ok(lane >= chart, `and the chart reaches ${chart}px in from the other edge`);

    // And the notice is above it rather than behind it. The card is centred,
    // so on every width below 804 its left edge is inside the notice.
    const notice = pixels(sideways, '#audio-muted.floated', 'top');
    assert.ok(pixels(sideways, '#game-mode.floated', 'top') > notice,
        `the card is hung at ${pixels(sideways, '#game-mode.floated', 'top')}px and the `
      + `notice at ${notice}px`);
});

/**
 * Bounded to the room the readouts are not using, the card holds what it says
 * in flight and not a landing read off it, which is five lines more. So for
 * the moment the breakdown is up the readouts stand down and the card has the
 * column - the same trade the LANDED notice already makes, and the same
 * reason: an aircraft stopped on the strip reads zero knots and the strip's
 * own elevation, so of the two it is the stack with nothing to say.
 */
test('the readouts stand down for the landing the card is reading off', () => {
    assert.ok(/classList\.toggle\('reporting', breakdown\)/.test(hudSource),
        'js/hud.js should mark the card while a landing is being read off it');
    assert.ok(/showsLandedNotice\(landed, breakdown\)/.test(hudSource),
        'off the one reading the notice steps aside for, rather than a second one of its own');

    const stoodDown = styleRules(indexHtml).find(rule =>
        rule.selectors.some(selector => /#game-mode\.floated\.reporting\s*~\s*#hud\.floated/.test(selector)));
    assert.ok(stoodDown, 'and the page should stand the readouts down for that mark');
    assert.equal(new Map((stoodDown.body ?? '').split(';')
        .map(part => part.split(':').map(piece => piece.trim()))).get('visibility'), 'hidden',
        'by visibility rather than display, which the run writes inline and a rule cannot reach');

    // And the card is given the column it just freed, or standing the stack
    // down has cost the readouts something and bought the breakdown nothing.
    for (const screen of MEASURED_SCREENS.filter(screen => standsDown(indexHtml, screen))) {
        const flying = verticalBand(indexHtml, ['#game-mode', '#game-mode.floated'], screen);
        const reading = verticalBand(indexHtml,
            ['#game-mode', '#game-mode.floated', '#game-mode.floated.reporting'], screen);

        assert.ok(reading && reading.to - reading.from > flying.to - flying.from,
            `at ${screen.width}x${screen.height} the card is bounded to `
          + `${reading ? reading.to - reading.from : null}px reading a landing off and `
          + `${flying.to - flying.from}px flying`);
    }
});

/**
 * The trade is only worth making where there is something to trade for. Written
 * outside every media query, the rule fired wherever the pads were out - and on
 * a tablet flown from the glass at 1024x768 the card sits at x 382..642 against
 * readouts at x 20..228, so the two never meet. The whole stack, AIRSPEED
 * through CAMERA, went invisible for the length of a breakdown and came back
 * with nothing gained, on every screen the card had already passed it on.
 *
 * So the stand-down is scoped to the screens the card is bounded against the
 * stack on, which is what it is paying for, and the two have to be the same
 * screens rather than nearly the same ones.
 */
test('the readouts only stand down where the card is bounded against them', () => {
    for (const screen of MEASURED_SCREENS) {
        const size = `${screen.width}x${screen.height}`;
        const meets = cardMeetsReadouts(indexHtml, screen);

        assert.equal(standsDown(indexHtml, screen), meets,
            meets
                ? `at ${size} the card takes the readouts' band and they do not stand down`
                : `at ${size} the readouts stand down and the card was never over them`);
    }
});

/**
 * Whatever else it does, the card stops somewhere on every screen it is drawn
 * on. An overlay with no declared height is one nothing on the page can be
 * placed against - the content's own height is nowhere in the stylesheet - so
 * an unbounded card reads as clear of everything by being unmeasurable, which
 * is how a tablet ended up with the one arrangement no check could see.
 */
test('the card is bounded on every screen the pads are out on', () => {
    for (const screen of MEASURED_SCREENS) {
        const size = `${screen.width}x${screen.height}`;
        const box = resolved(indexHtml, ['#game-mode', '#game-mode.floated'], screen);

        assert.ok(length(box.get('max-height'), screen, box) !== null,
            `the card should declare where it stops at ${size}`);
        assert.equal(box.get('overflow'), 'hidden',
            `and bind it at ${size}, or it is a number rather than a bound`);
    }
});

/**
 * The card clips from the bottom, and the bound it clips at was a count taken
 * off the screen while its rows are whatever height the type comes to. The two
 * do not line up: on 320x460 the clip landed seven pixels into
 * `FINAL  ·  STAGE 1 OF 4` and cut the bottom five off it square, which reads
 * as a rendering fault rather than as a card that stops. The other screens
 * were clean by luck rather than by rule, which is the other half of it.
 *
 * So every row the card carries is either drawn whole or taken off, and what
 * makes that true is the bound being at least the rows left on the card rather
 * than a number that happens to fall between two of them. Tightening the count
 * would not have done it on its own: the card's bottom padding is not space
 * the row under it respects, so a bound landing on a row boundary still slices
 * the row after it.
 */
test('the card stops between its rows rather than part way down one', () => {
    const edges = declarations(indexHtml, '#game-mode').get('--card-edges');
    assert.ok(edges?.endsWith('px'), 'the card should declare what its own border and padding come to');

    for (const screen of MEASURED_SCREENS) {
        for (const state of CARD_STATES) {
            const size = `${screen.width}x${screen.height}`;
            const box = resolved(indexHtml, state.selectors, screen);
            const bound = length(box.get('max-height'), screen, box);

            assert.ok(bound !== null, `the card should be bounded at ${size} ${state.reading}`);

            const drawn = state.rows.filter(row =>
                resolved(indexHtml, row.shown, screen).get('display') !== 'none');
            const rows = drawn.reduce((total, row) => total + Number(box.get(row.height).slice(0, -2)),
                Number(edges.slice(0, -2)));

            assert.ok(bound >= rows,
                `at ${size} ${state.reading} the card is bounded to ${bound}px and the `
              + `${drawn.length} rows it still carries come to ${rows}px`);
        }
    }
});

/**
 * And the rows are written inside what they were measured at.
 *
 * The bound above is only as good as the claim that a declared row height is
 * the height that row draws at, and that claim was made against the lines the
 * card was carrying on the day it was measured. A mode with a longer name, or
 * an objective that runs a few characters further, wraps a row past the height
 * declared for it - and the clip lands part way down a row again, with nothing
 * in the stylesheet or the check above able to see it.
 *
 * So the lengths are held here, and every line the card can be asked for is
 * counted against them: the modes and their stages as declared, each gate of
 * each course, the notice a missed gate puts up, the report a finished stage
 * puts up, the clock, and the pointer at the widest reading each can write.
 */
test("the card's rows are written inside the lines they were measured at", () => {
    const lines = { name: [], objective: [], status: [], clock: [], pointer: [] };

    // The clock at the widest a stage can write it - a stage past ten minutes,
    // which is two characters wider than one under it - and the empty shape a
    // stage nobody has flown out leaves. Then the same clock on a route, which
    // writes the budget where the time to beat goes.
    lines.clock.push(formatStageClock(5999.9, 5999.9), formatStageClock(0, null),
                     formatStageClock(5999.9, null, 1), formatStageClock(5999.9, null, 0));
    lines.objective.push(stageReport({ time: 599.9, best: true }),
                         stageReport({ time: 599.9, best: false }));

    for (const mode of GAME_MODES) {
        lines.name.push(mode.label);
        lines.objective.push(mode.goal);

        const state = createRunState();
        startRun(state, mode.id);
        lines.objective.push(runObjective(state));

        // Walk the whole run: every stage, and inside each of them every step
        // the stage counts off, because the stage number and the step number
        // are both written into the status line and both grow as the run goes
        // on. A course counts gates and a route counts legs; the rest count one
        // thing once.
        for (let stage = 0; stage < mode.stages.length; stage++) {
            const { total } = stageProgress(state);

            for (let step = 0; step <= total; step++) {
                lines.status.push(`${currentStage(state).label}  ·  ${runStatus(state)}`);
                lines.objective.push(missNotice(state));

                // The lines the newer modes write into that same row. A
                // circuit and a survey write a brief there that changes with
                // every leg and every landmark, and all three write a notice
                // when something has just gone wrong - so each is collected at
                // every step rather than once per mode.
                const world = worldFor(state);
                lines.objective.push(runBrief(state, world));
                lines.objective.push(faultNotice(state, missedBy({ inside: false, under: false, within: false })));

                const landmark = world.landmarks[step];
                if (landmark) {
                    for (const bad of outsideWindow(landmark)) {
                        lines.objective.push(shotNotice(landmark, shotFault(bad.shot, landmark)));
                    }
                }

                const leg = world.circuit[step];
                if (leg) {
                    const pattern = createPatternState();
                    const flown = completeLeg(pattern, leg, stageReaches(state));
                    lines.objective.push(legNotice(flown));

                    // And the line that ends a circuit, which is the one notice
                    // written for two readings and so the one most likely to run
                    // past the row. An unflown leg reads as a perfect hundred,
                    // which is the widest either number gets.
                    lines.objective.push(circuitNotice(flown, patternScore(pattern)));
                }

                lines.pointer.push(formatRunPointer({
                    // The arrow a mode's pointer carries, which a briefing does
                    // not: it is a bearing the pilot was given rather than a
                    // needle, and measuring it with a glyph it never writes
                    // would be measuring a row nothing puts on the screen.
                    arrow: mode.objective === SEARCH_OBJECTIVE
                        ? '' : GATE_ARROWS[GATE_ARROWS.length - 1],
                    label: pointerLabel(mode, state, total),
                    index: Math.max(0, total - 1),
                    bearing: 359,
                    distance: 10000
                }));
                if (step < total) countOff(mode, state, step);
            }

            recordLanding(state);
            advanceStage(state);
        }

        // And the line a finished run leaves on the card.
        lines.status.push(runStatus(state));
    }

    for (const [row, ceiling] of Object.entries(CARD_LINE_CEILINGS)) {
        const longest = lines[row].reduce((worst, line) => line.length > worst.length ? line : worst, '');
        assert.ok(longest.length <= ceiling,
            `the card's ${row} row was measured at ${ceiling} characters and is asked for `
          + `${longest.length}: \`${longest}\``);
    }
});

/**
 * And the card is as wide as the row heights were measured at, wherever a
 * bound is written out of them.
 *
 * The two checks above rest on one thing neither of them states: that a row
 * has 218 pixels to be written in, which is the card at its 260 pixel minimum.
 * Both the `--card-*` heights and the line ceilings were measured there. Give
 * a row less room than that and it wraps further than the height declared for
 * it, and a bound summed from those heights lands part way down a row again -
 * with the checks above still passing, because neither of them looks at how
 * wide the card is.
 *
 * The card is not always 260. `@media (max-height: 540px) and (min-width:
 * 500px)` hangs it in the lane between the pad clusters instead, drops
 * `min-width` to 0 and caps it at `calc(100vw - 344px)`: 156 pixels at 500
 * across, 224 at 568. That is well under what the rows were measured at, and
 * the reason nothing is sliced there is that the same rule bounds the card by
 * the room it has - `calc(100vh - 218px)` - rather than by adding its rows up.
 * The two arrangements are safe for opposite reasons, and what keeps them safe
 * is that they never mix.
 *
 * So: a bound summed from rows may only be used where the card is still at
 * least as wide as those rows were measured at. A lane rule given a row-summed
 * bound, or a row-summed screen that stopped asking for 260, fails here rather
 * than in a browser.
 */
test('the card is as wide as its rows were measured at wherever a bound is summed from them', () => {
    // The width the `--card-*` heights and the line ceilings above were both
    // read at, which is the card's own minimum.
    const MEASURED_AT = 260;

    // A bound written as a sum of the card's own rows, rather than as a count
    // of pixels or as the room left on the screen. The three forms are what
    // `length` already tells apart; this asks which of them was used.
    const summedFromRows = value =>
        /^calc\(\s*var\(--card-[\w-]+\)(\s*\+\s*var\(--card-[\w-]+\))*\s*\)$/
            .test((value ?? '').replace(/\s+/g, ' '));

    // The screens the two arrangements meet across: the ones every other check
    // measures, and enough of the lane band to cover where the cap binds
    // hardest. 500x400 is the narrowest the lane rule reaches, where the card
    // comes to 156 and a row has 114 pixels rather than 218.
    const screens = [
        ...MEASURED_SCREENS,
        { width: 500, height: 400 },
        { width: 540, height: 400 },
        { width: 600, height: 380 },
        { width: 660, height: 500 },
        { width: 480, height: 400 },
        { width: 640, height: 545 }
    ];

    for (const screen of screens) {
        for (const state of CARD_STATES) {
            const size = `${screen.width}x${screen.height}`;
            const box = resolved(indexHtml, state.selectors, screen);
            if (!summedFromRows(box.get('max-height'))) continue;

            const floor = box.get('min-width');
            assert.ok(floor?.endsWith('px'),
                `at ${size} ${state.reading} the card is bounded by adding its rows up, so it `
              + `should declare a width to hold them in - it declares \`${floor}\``);

            assert.ok(Number(floor.slice(0, -2)) >= MEASURED_AT,
                `at ${size} ${state.reading} the card is bounded by adding its rows up, and `
              + `those rows were measured on a card ${MEASURED_AT}px wide - but the card is `
              + `held to ${floor} here, so a row has less room than it was measured with and `
              + `wraps past the height the bound is summed from`);
        }
    }
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

// --- Typing a number into a panel row --------------------------------------

/**
 * Three of the keys a figure answers are keys the panels already mean something
 * by: Enter chooses a row, Escape closes the panel, and Backspace closes it too.
 * So a row being typed into has to read the press before the panel does, or the
 * first Enter at a figure closes nothing and sets nothing.
 *
 * js/main.js imports Three.js, so the order is read off its source the way the
 * rest of what it does with a panel is.
 */
const mainSource = readFileSync(fileURLToPath(new URL('../js/main.js', import.meta.url)), 'utf8');
const panelViewSource = readFileSync(fileURLToPath(new URL('../js/panel-view.js', import.meta.url)), 'utf8');

const TYPING_HANDLERS = [
    ['onSettingsKey', 'typedSettingRow(this.settings)', 'applyTypedSettingKey', 'beginTypedSetting'],
    ['onEditorKey',   'typedEditorRow(this.editor)',    'applyTypedEditorKey',  'beginTypedEditorValue']
];

test('a row being typed into reads a key before the panel it is on does', () => {
    for (const [handler, showing, apply, begin] of TYPING_HANDLERS) {
        const body = mainSource.match(new RegExp(`${handler}\\(e\\)\\s*\\{[\\s\\S]*?\\n    \\}`));
        assert.ok(body, `js/main.js should read keys in ${handler}`);

        const typing = body[0].indexOf(showing);
        const close  = body[0].search(/is(?:Settings|Editor)CloseKey\(e\.code\)/);
        const menu   = body[0].indexOf('isMenuKey(e.code)');

        assert.ok(typing >= 0, `${handler} should ask whether a row is being typed into`);
        assert.ok(body[0].includes(`${apply}(`), 'and hand the press to the figure');
        assert.ok(close > typing,
            `${handler} reads the key that closes the panel at ${close} and the figure at `
          + `${typing} - a figure being written has first claim on Escape`);
        assert.ok(menu > typing,
            `${handler} reads the menu keys at ${menu} and the figure at ${typing} - `
          + 'a figure being written has first claim on Enter');

        // And a digit starts one, read after the way out so the panel can always
        // be left, and before the stepping keys, which no digit is one of.
        const start = body[0].indexOf(`${begin}(`);
        assert.ok(start > close, `${handler} should leave the way out of the panel reachable`);
        assert.ok(start < menu, `${handler} should start a figure before it walks the cursor`);
    }
});

/**
 * A key the figure has no use for comes back null and falls through to the
 * panel, so the cursor can still walk off a row mid-figure. A handler that
 * returned on the ask rather than on the answer would swallow every key.
 */
test('a key the figure has no use for falls through to the panel', () => {
    for (const [handler, showing] of TYPING_HANDLERS) {
        const body = mainSource.match(new RegExp(`${handler}\\(e\\)\\s*\\{[\\s\\S]*?\\n    \\}`));
        const guard = body[0].slice(body[0].indexOf(showing));

        assert.match(guard.slice(0, 400), /if \(typed\) \{/,
            `${handler} should return only where the figure answered the press`);
    }
});

/**
 * A figure is typed with a keyboard, so reaching for the mouse is giving up on
 * one: the row goes back to the value it had rather than being left reading a
 * caret nothing is being typed into any more.
 */
test('reaching for the mouse gives up on a figure half typed', () => {
    for (const [handler, cancel] of [
        ['onSettingsPointer', 'cancelTypedSetting(this.settings)'],
        ['onEditorPointer',   'cancelTypedEditorValue(this.editor)']
    ]) {
        const body = mainSource.match(new RegExp(`${handler}\\(index, choose, step = 1\\)\\s*\\{[\\s\\S]*?\\n    \\}`));
        assert.ok(body, `js/main.js should read the pointer in ${handler}`);
        assert.ok(body[0].includes(cancel), `${handler} should give up on a figure being typed`);
        assert.ok(body[0].indexOf(cancel) < body[0].indexOf('applyMenuPointer('),
            'before the click moves the cursor off the row the figure was on');
    }
});

/**
 * And the editor's rows have to be handed to the menu they are drawn from, which
 * the settings panel's do not: `syncSettingsEntries` writes over the rows the
 * panel already had, while `syncEditorEntries` builds a new set - the editor
 * being the one panel whose rows come and go.
 *
 * A pointer that only crossed onto a row chooses nothing, so neither
 * `chooseEditorRow` nor anything else below it redraws. Without this the row the
 * figure was on goes on reading its caret for a figure already given up on, and
 * the next `Enter` steps the row instead of taking a figure.
 */
test('and hands the editor the rows that giving up on one rebuilt', () => {
    const body = mainSource.match(/onEditorPointer\(index, choose, step = 1\)\s*\{[\s\S]*?\n    \}/);
    assert.ok(body, 'js/main.js should read the pointer in onEditorPointer');

    const cancel = body[0].indexOf('cancelTypedEditorValue(this.editor)');
    const handed = body[0].indexOf('setMenuEntries(this.editorState, this.editor.entries)');

    assert.ok(handed > cancel,
        'onEditorPointer should hand the rebuilt rows to the menu the list is drawn from');
    assert.ok(handed < body[0].indexOf('syncOverlays('),
        'before the list is drawn again from them');
});

/**
 * A press the figure has already refused is not a press that starts a new one.
 *
 * `js/typed-value.js` refuses a minus part way along a figure and a character
 * past the ceiling, and refusing leaves the text as it was - so the press comes
 * back null and falls through to the rest of the handler. Both handlers then
 * asked only whether the key starts a figure and whether the row holds one,
 * which is true of a minus at an altitude row whether or not a figure is
 * already in hand: the three digits typed went, with nothing on the row to say
 * they had, and the next press carried on from the stray character.
 */
test('a press the figure turned down does not start a fresh figure', () => {
    for (const [handler, showing, , begin] of TYPING_HANDLERS) {
        const body = mainSource.match(new RegExp(`${handler}\\(e\\)\\s*\\{[\\s\\S]*?\\n    \\}`));
        const start = body[0].indexOf(`${begin}(`);
        assert.ok(start > -1, `${handler} should start a figure at a digit`);

        // The condition the start sits in, back to the `if` that opens it.
        const guard = body[0].slice(body[0].lastIndexOf('if (', start), start);
        assert.ok(guard.includes(`${showing} == null`),
            `${handler} should start a figure only where none is in hand`);
    }
});

/**
 * Walking off a row is giving up on a figure, and so is stepping the value
 * under it. The highlight says where the pilot is and the reading says what is
 * stored, so a figure left live through either takes every digit after it and
 * is finally measured against a value the row never showed.
 *
 * Both are keys the panel works with, so the giving up is read off
 * `isMenuControlKey` rather than off the keys that walk the cursor alone - and
 * both assertions below are anchored on that branch rather than on the top of
 * the handler. An unanchored `indexOf` returns whichever giving up comes first,
 * so a cancel left anywhere above the branch would read as this one and the
 * test would pass on a handler that still steps a live figure.
 *
 * Anchoring is one of four readings. A cancel found from the branch is a
 * cancel somewhere *below* the branch, which a cancel on the line after it
 * satisfies as readily as one inside it - so the two are also read as a single
 * statement, per `GOVERNED` below. Both of those read where the cancel sits,
 * and neither reads which keys the branch answers - so the condition itself is
 * read for that, at both ends of the token: in front of it, per `opens` below,
 * and behind it, per `rest` and `COMPARED`. One end alone leaves the inversion
 * writable at the other, which is how `=== false` passed a suite that `!` had
 * already been closed against.
 *
 * The fall-through that lets the cursor walk off at all is not the defect and
 * stays - see *a key the figure has no use for falls through to the panel*. The
 * key still reaches the panel; it is the figure that does not survive it.
 */
const PANEL_KEY_WRITES = [
    ['onSettingsKey', 'cancelTypedSetting(this.settings)',
        ['adjustSetting(', 'applyMenuKey(', 'chooseSettingsEntry(']],
    ['onEditorKey',   'cancelTypedEditorValue(this.editor)',
        ['adjustEditorRange(', 'applyMenuKey(', 'chooseEditorRow(']]
];

const CONTROL_KEY = 'isMenuControlKey(e.code)';

/**
 * Whether a call the branch is supposed to govern is governed by it, read off
 * the text lying between the two. Nothing but a condition and an opening may
 * separate them: `) `, ` && ` and `) {` all leave the branch and the call as
 * one guarded statement, while a `;` or a `}` in there has closed the branch
 * before the call is reached, leaving two statements in a row.
 *
 * Position alone cannot tell those apart, and the difference is the whole
 * behaviour. A handler reading `if (isMenuControlKey(e.code)) { }` above an
 * unguarded `cancelTypedSetting(this.settings);` gives up on the figure for
 * every key rather than for the keys the panel works with, so a press the
 * panel does nothing with silently throws away what the pilot typed - and it
 * passed every test in this file.
 */
const GOVERNED = /[;}]/;

/** The text between the branch at `from` and the call already found at `at`. */
function between(body, from, at) {
    return body.slice(from + CONTROL_KEY.length, at);
}

/**
 * Which keys the branch answers, read off the text between the `if` that opens
 * it and the token itself. Blank is the sense that is wanted: the giving up
 * happens for the keys the panel works with.
 *
 * Every other reading here starts at or after `CONTROL_KEY` and so cannot see
 * the character in front of it. A `!` there is therefore invisible to all of
 * them, and inverting either branch left the whole suite green - the giving up
 * then answers only the keys the panel does nothing with, so a step key reaches
 * a live figure again *and* a press the panel ignores throws the figure away.
 * That is the `1.0.0-alpha.1.28.0` defect back and worse than it was.
 *
 * Blank rather than empty, and the opening matched rather than searched for as
 * the four characters `if (`: both are the same mistake, which is reading a
 * house style as the behaviour. `if (  isMenuControlKey(e.code))` answers the
 * same keys with two spaces in it, and a fixed `lastIndexOf('if (', at)` misses
 * `if(` entirely and anchors on some earlier `if (` in the handler, so the span
 * it then quotes is most of a statement the branch has nothing to do with.
 *
 * Reach is the second half and `GOVERNED` above is still what reads it: a
 * branch with the right sense and the wrong reach gives up on a figure outside
 * itself, which no reading of the condition can catch. Sense written behind the
 * token is the third, and `rest` below reads that.
 */
function opens(body, at) {
    let from = -1;
    for (const open of body.slice(0, at).matchAll(/if\s*\(/g)) from = open.index + open[0].length;
    return from < 0 ? null : body.slice(from, at);
}

/**
 * The rest of the condition, from the end of the token to the `)` that closes
 * the `if` - `''` for `onSettingsKey`, ` && cancelTypedEditorValue(this.editor)`
 * for `onEditorKey`. Found by balancing parentheses from inside the opening one,
 * since the token carries a pair of its own and the first `)` after it is that
 * pair's rather than the condition's.
 */
function rest(body, at) {
    let depth = 1;
    for (let i = at + CONTROL_KEY.length; i < body.length; i++) {
        if (body[i] === '(') depth++;
        else if (body[i] === ')' && --depth === 0) return body.slice(at + CONTROL_KEY.length, i);
    }
    return null;
}

/**
 * Anything comparing the token's result, which is the sense written behind it
 * rather than in front. `opens` above reads only the span ahead of the token,
 * so `if (isMenuControlKey(e.code) === false)` is invisible to it - the span is
 * blank and the branch is inverted anyway. `GOVERNED` cannot see it either: it
 * reads the text between the token and the call it governs, and ` === false) `
 * holds neither a `;` nor a `}`, so the call still reads as guarded.
 *
 * Both `=== false` builds left all 1397 tests passing, which is the
 * `1.0.0-alpha.1.28.0` defect reached by a different spelling than the `!` it
 * was closed against. Nothing comparing the call belongs in a condition that is
 * asking whether the panel works with the key at all.
 *
 * Anchored at the start of the span, because a comparison *of the call* is
 * written against its closing parenthesis and can be written nowhere else - one
 * held off by a parenthesis of its own, `if ((isMenuControlKey(e.code)) === false)`,
 * leaves `(` in front of the token and `opens` above rejects it there. Read
 * unanchored instead and this is a reading of any comparison anywhere in the
 * condition, which the rest of a condition is entitled to hold:
 * `if (isMenuControlKey(e.code) && this.settings.typing?.id != null)` guards the
 * giving up on a figure already in hand, which `cancelTypedSetting` checks for
 * itself, so the keys answered are the same ones - and unanchored it failed as
 * *onSettingsKey asks ... and so compares what the panel works with*, naming a
 * defect that is not there. That is the fault `sense` read untrimmed had at the
 * other end of the token, and an assertion is worth no more than its message.
 */
const COMPARED = /^\s*(?:[=!<>]=|[<>])/;

test('and walking the cursor off one gives up on it the same way', () => {
    for (const [handler, cancel, writes] of PANEL_KEY_WRITES) {
        const body = mainSource.match(new RegExp(`${handler}\\(e\\)\\s*\\{[\\s\\S]*?\\n    \\}`));
        assert.ok(body, `js/main.js should read keys in ${handler}`);

        const works = body[0].indexOf(CONTROL_KEY);
        assert.ok(works > -1,
            `${handler} should ask whether the key is one the panel works with at all`);

        // And asks it that way round. Every other reading starts at the token,
        // so this is the only one that sees a `!` in front of it - see `opens`.
        const sense = opens(body[0], works);
        assert.ok(sense != null, `${handler} should ask that in an \`if\``);
        assert.strictEqual(sense.trim(), '',
            `${handler} opens the branch \`if (${sense}${CONTROL_KEY}\` and so gives up on a `
          + 'figure for the keys the panel does nothing with - the giving up has to answer '
          + 'the keys it works with, or a step key moves the value out from under a live '
          + 'figure and a press the panel ignores throws that figure away');

        // And asks it that way round at the other end too, where the same
        // inversion is spelled as a comparison neither reading above can see.
        const behind = rest(body[0], works);
        assert.ok(behind != null, `${handler} should close the condition it opens`);
        assert.doesNotMatch(behind, COMPARED,
            `${handler} asks \`${CONTROL_KEY}${behind}\` and so compares what the panel works `
          + 'with rather than acting on it - the giving up has to answer the keys it works '
          + 'with however the condition is spelled, or a step key moves the value out from '
          + 'under a live figure and a press the panel ignores throws that figure away');

        const given = body[0].indexOf(cancel, works);
        assert.ok(given > works,
            `${handler} should give up on a figure where the panel takes a key, not below it`);

        // And inside that branch rather than merely under it, which is a
        // reading no index can give - see GOVERNED above.
        const guarded = between(body[0], works, given);
        assert.doesNotMatch(guarded, GOVERNED,
            `${handler} closes the branch at \`${guarded.trim()}\` and only then gives up on `
          + 'a figure - the two have to be one guarded statement, or every key the panel '
          + 'works with becomes every key at all and a press the panel ignores throws away '
          + 'the figure in hand');

        // A step and a figure cannot both be live, so the giving up comes above
        // everything in the handler that writes a value: the keys that step the
        // row, the ones that walk the cursor, and the choice either ends in.
        for (const write of writes) {
            const at = body[0].indexOf(write);
            assert.ok(at > -1, `${handler} should reach ${write}`);
            assert.ok(given < at,
                `${handler} gives up on a figure at ${given} and writes a value at ${at}, in `
              + `${write} - a figure and the value under it cannot both be live`);
        }
    }
});

/**
 * And the editor hands the rebuilt rows over here too, for the reason
 * `onEditorPointer` does: `syncEditorEntries` builds a new set rather than
 * writing over the old, so the menu the list is drawn from is left holding the
 * rows from before unless it is handed the new ones.
 *
 * Both lookups are anchored on the branch, and both are read as governed by it,
 * for the reasons the test above is - and the branch is read for its sense
 * first, since an anchor on an inverted condition anchors on the wrong keys.
 */
test('and hands the editor the rows that walking off one rebuilt', () => {
    const body = mainSource.match(/onEditorKey\(e\)\s*\{[\s\S]*?\n    \}/);
    assert.ok(body, 'js/main.js should read keys in onEditorKey');

    const works  = body[0].indexOf(CONTROL_KEY);
    assert.ok(works > -1, 'onEditorKey should ask whether the key is one the panel works with');

    const sense = opens(body[0], works);
    assert.ok(sense != null, 'onEditorKey should ask that in an `if`');
    assert.strictEqual(sense.trim(), '',
        `onEditorKey opens the branch \`if (${sense}${CONTROL_KEY}\` and so rebuilds the rows `
      + 'for the keys the panel does nothing with and leaves them for the keys it works '
      + 'with - the branch has to answer the keys the panel works with');

    const behind = rest(body[0], works);
    assert.ok(behind != null, 'onEditorKey should close the condition it opens');
    assert.doesNotMatch(behind, COMPARED,
        `onEditorKey asks \`${CONTROL_KEY}${behind}\` and so compares what the panel works `
      + 'with rather than acting on it - the rows are then rebuilt for the keys the panel '
      + 'does nothing with, however the condition is spelled');

    const cancel = body[0].indexOf('cancelTypedEditorValue(this.editor)', works);
    const handed = body[0].indexOf('setMenuEntries(this.editorState, this.editor.entries)', works);

    assert.ok(cancel > works && handed > cancel,
        'onEditorKey should hand the rebuilt rows to the menu the list is drawn from');
    for (const [at, name] of [[cancel, 'give up on a figure'], [handed, 'hand the rows over']]) {
        const guarded = between(body[0], works, at);
        assert.doesNotMatch(guarded, GOVERNED,
            `onEditorKey closes the branch at \`${guarded.trim()}\` and only then goes on to `
          + `${name} - the branch and what it governs have to be one statement, or the `
          + 'editor gives up on a figure for keys the panel does nothing with');
    }
    for (const reads of ['adjustEditorRange(', 'applyMenuKey(']) {
        const at = body[0].indexOf(reads);
        assert.ok(at > -1, `onEditorKey should reach ${reads}`);
        assert.ok(handed < at, `before ${reads} reads them`);
    }
});

// Both panels tell a pilot the rows can be typed into, in the line that already
// tells them what the keys do.
test('both panels say a number can be typed at a row', () => {
    for (const panel of ['settings', 'element-editor']) {
        const hint = indexHtml.match(new RegExp(`<div id="${panel}">[\\s\\S]*?<small>([^<]*)</small>`));
        assert.ok(hint, `index.html should carry a hint line under the ${panel} panel`);
        assert.match(hint[1], /TYPE A NUMBER/,
            `the ${panel} panel reads "${hint[1]}" and says nothing about typing one`);
    }
});

// --- The walls a canyon run is flown between -------------------------------

/**
 * The corridor is drawn by `js/walls.js`, which imports Three.js and so cannot
 * be constructed here. Nothing in `test/` has ever reached it: the beam across
 * each cut was got wrong once, and the only things that have ever caught it are
 * a pair of eyes on a screenshot and a browser reading the quaternion back off
 * the live scene - both checks that happen only when somebody runs them.
 *
 * So the two things worth pinning are read off the source, the way the ring
 * colours and the approach marks above are.
 */
const wallsSource = readFileSync(fileURLToPath(new URL('../js/walls.js', import.meta.url)), 'utf8');

/**
 * One named function's body, cut at the brace that closes it.
 *
 * Every assertion below reads a span of this slice rather than of the whole
 * file, for the reason the spans in test/input-map.test.js are bounded with
 * `[^}]*?`: a span free to reach the end of the file passes the day the text it
 * looks for is written a second time below the function it was anchored on.
 * That bound is not usable here, because both of these functions open a brace
 * of their own before the line being looked for - `buildBeam` builds a material
 * from an object literal two lines above the turn - so a span stopped at the
 * first `}` never reaches the assertion at all. Counting the braces gets the
 * same guarantee from a body that has some in it.
 */
function functionBody(source, name) {
    const opened = source.search(new RegExp(`function ${name}\\(`));
    if (opened < 0) return null;

    const from = source.indexOf('{', opened);
    if (from < 0) return null;

    let depth = 0;
    for (let at = from; at < source.length; at += 1) {
        if (source[at] === '{') depth += 1;
        if (source[at] === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(from, at + 1);
        }
    }

    return null;
}

/**
 * A cylinder is built standing up its own Y and the beam wants that axis lying
 * along the span of the cut. The turn is said as the two directions it is
 * between, because the pair of Euler angles that would say it the short way
 * does not compose in the order Three.js applies them here - the module's own
 * comment says so in as many words, and that is the fault it is describing.
 */
test('the beam is turned from one direction to the other rather than by Euler angles', () => {
    const beam = functionBody(wallsSource, 'buildBeam');
    assert.ok(beam, 'js/walls.js should draw the beam across a cut in a function of its own');

    assert.match(beam, /quaternion\.setFromUnitVectors\(/,
        'and turn it by the two directions the turn is between');
    assert.match(beam, /new THREE\.Vector3\(0, 1, 0\)/,
        'from the Y a cylinder is built standing up, which is the axis being turned');
    assert.match(beam, /new THREE\.Vector3\(acrossX, 0, acrossZ\)\.normalize\(\)/,
        'to the span of the cut, normalized because setFromUnitVectors takes unit vectors');
    assert.ok(!/rotation\.(set\b|[xyz]\s*=)/.test(beam),
        'a pair of Euler angles here is the turn said the short way and said wrong, '
      + 'in a way only a screenshot would show');
});

/**
 * The posts stand either side of the cut, and which way either side is has to
 * be the same span `corridorCrossing` in js/corridor.js measures its offset
 * along. This is the one with teeth: a corridor that flipped its offset
 * convention would draw its walls on the wrong axis with the suite still green,
 * because nothing that runs here touches the drawing.
 */
test('a cut is drawn across the span the rule measures it along', () => {
    const cut = functionBody(wallsSource, 'buildCut');
    assert.ok(cut, 'js/walls.js should build one cut in a function of its own');

    assert.match(cut, /const acrossX\s*=\s*section\.dirZ;/,
        'and take the span across it from the way the run goes, square to it');
    assert.match(cut, /const acrossZ\s*=\s*-section\.dirX;/,
        'in the same handedness corridorCrossing measures the offset in, '
      + 'or the walls stand on one axis while the rule tests another');
    assert.match(cut, /acrossX \* section\.halfWidth \* side/,
        'with the two posts set out along that span rather than along the run');
    assert.match(cut, /acrossZ \* section\.halfWidth \* side/,
        'on both of its components, or one post is placed off the span the other is on');

    // Read the rule's own span back out of js/corridor.js, so the pair is held
    // together rather than each held to the same convention written out twice.
    const corridorSource = readFileSync(
        fileURLToPath(new URL('../js/corridor.js', import.meta.url)), 'utf8');
    assert.match(corridorSource,
        /\(at\.x - section\.x\) \* section\.dirZ - \(at\.z - section\.z\) \* section\.dirX/,
        'js/corridor.js should measure the offset along (dirZ, -dirX), the span the posts stand on');
});

// --- The joins between the tiles the world is laid on ----------------------

/**
 * `js/terrain.js` imports Three.js and so cannot be constructed here either,
 * which is the same reason the walls above are read as text. What it does that
 * is worth pinning is an ordering and a completeness, both of which are
 * invisible from outside: a tile settled after its mesh was built draws the
 * unsettled ground and never corrects it, and a tile settled against four
 * neighbours rather than eight leaves the corners of its own ground open.
 *
 * `matchEdges` itself is pure and is tested properly in
 * test/environment-tiles.test.js; the neighbour list is pure and is tested
 * properly in test/world-tiles.test.js. This section pins the one piece between
 * them that a renderer is required to hold.
 */
const terrainSource = readFileSync(fileURLToPath(new URL('../js/terrain.js', import.meta.url)), 'utf8');

/**
 * One class method's body, cut at the brace that closes it.
 *
 * The same brace count `functionBody` above uses, and for the same reason - a
 * method has braces of its own inside it, so a span bounded with `[^}]*?` stops
 * before the line being looked for. What differs is only how the declaration is
 * recognised: a method is a name and its arguments at the head of a line rather
 * than a `function` keyword.
 */
function methodBody(source, name) {
    const opened = source.search(new RegExp(`^\\s+${name}\\([^)]*\\)\\s*\\{`, 'm'));
    if (opened < 0) return null;

    const from = source.indexOf('{', opened);
    if (from < 0) return null;

    let depth = 0;
    for (let at = from; at < source.length; at += 1) {
        if (source[at] === '{') depth += 1;
        if (source[at] === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(from, at + 1);
        }
    }

    return null;
}

/**
 * The reassembly this pins: `matchEdges` used to be reached from the Matter API
 * alone, so a host assembling its own world got settled joins and the simulator
 * did not. The base ground hid it, because it is noise read at world
 * coordinates and runs on across a join whatever tile draws it - what did not
 * run on was anything an element added, which is placed from a per-tile seed.
 */
test('a tile is settled against its neighbours before it is drawn, not after', () => {
    const added = methodBody(terrainSource, 'addTile');
    assert.ok(added, 'js/terrain.js should lay one tile in a method of its own');

    const settled = added.search(/this\.joinTile\(/);
    const drawn   = added.search(/buildMesh\(/);

    assert.ok(settled >= 0, 'and settle the field it generated against the tiles already beside it');
    assert.ok(drawn >= 0, 'and build the mesh it adds to the scene');
    assert.ok(settled < drawn,
        'the join has to come first: a mesh built from unsettled ground is the join on screen, '
      + 'and nothing draws that tile again');

    assert.match(added, /redrawTile\(/,
        'and the neighbours whose own ground the join moved have to be drawn again');
});

test('every neighbour is handed over in one pass rather than one at a time', () => {
    const join = methodBody(terrainSource, 'joinTile');
    assert.ok(join, 'js/terrain.js should settle a field in a method of its own');

    assert.match(join, /tilesTouching\(index\)/,
        'against every tile that can share a vertex with it, which is eight rather than four');
    assert.match(join, /matchEdges\(\[field, \.\.\.touching\.map\(tile => tile\.field\)\]\)/,
        'in a single call carrying all of them, because a vertex four tiles reach has to be '
      + 'settled against all four at once or it closes against neither');

    assert.equal(join.match(/matchEdges\(/g).length, 1,
        'one call, or a corner is settled twice against two tiles and agrees with neither');
});

/**
 * The water is recorded off the finished field - resting heights, colours, and
 * which vertices lie under the level - so a surface recorded before a join is
 * resting on ground that has since moved. This is the half of a redraw that is
 * easy to leave out, because the land looks right without it.
 */
test('a tile drawn again records its water again, over the ground that moved', () => {
    const redraw = functionBody(terrainSource, 'redrawTile');
    assert.ok(redraw, 'js/terrain.js should draw a settled tile again in a function of its own');

    assert.match(redraw, /tile\.water\s*=\s*waterSurface\(field\)/,
        'the surface is read off the field as it now stands rather than kept');
    assert.match(redraw, /tile\.watered\s*=\s*false/,
        'and the tile is marked unwatered, or a paused world leaves the old surface '
      + 'over the new ground');
    assert.match(redraw, /relightSeam\(mesh\.geometry, field\)/,
        'and the normals are worked out again, or the moved ground is lit as the ground it was');
});

/**
 * And worked out over the strip that moved. `computeVertexNormals` walks all 201
 * by 201 vertices of a tile, which measured 26.7ms of one `addTile`'s 61ms
 * across eight neighbours - most of what writing into the geometry rather than
 * rebuilding it was there to save, spent lighting ground that did not move.
 */
test('the ground a join moved is lit over the strip it moved, not over the whole tile', () => {
    const relight = functionBody(terrainSource, 'relightSeam');
    assert.ok(relight, 'js/terrain.js should light a settled tile in a function of its own');

    assert.match(relight, /seamBand\(field\)/,
        'the strip is the band the join eased its correction into, which the field records');
    assert.match(relight, /updateNormals\(/,
        'and that band is the only part of the mesh worked out again');
    assert.match(relight, /computeVertexNormals\(\)/,
        'with the whole plane left as the answer for a tile carrying no band');
});

/**
 * And the water over the tiles that redraw just touched. `redrawTile` reads a
 * surface off its field again, which puts back the openness that one tile alone
 * works out - at every join the tile is on, not only the join with the tile just
 * laid. So the settling that follows has to reach wider than the tiles the join
 * moved, or a neighbour redrawn here is left unsettled against the tiles further
 * out, whose joins were settled on a frame that is over.
 *
 * Measured in a browser on 10.28.2026 across `lakeside` and `river-basin`: with
 * this, every vertex two tiles both call water agrees to 0; with each surface put
 * back to what one tile alone makes of it, the two disagree by up to 0.29 of the
 * shoreline fade, which `animateWater` scales both the swell and the glint by.
 */
test('the water is settled after the ground, over every tile the join rebuilt', () => {
    const added = methodBody(terrainSource, 'addTile');
    assert.ok(added, 'js/terrain.js should lay one tile in a method of its own');

    const redrawn = added.search(/redrawTile\(/);
    const watered = added.search(/matchWater\(/);

    assert.ok(watered >= 0, 'the water either side of a join has to be settled too');
    assert.ok(redrawn < watered,
        'and after the neighbours are drawn again, or the redraw puts back the openness '
      + 'one tile alone works out and the settling is undone by the frame that did it');

    assert.match(added, /this\.waterAssembly\(\[tile, \.\.\.settled\]\)/,
        'over the assembly a join can have unsettled rather than over the two tiles either side');
    assert.match(added, /matchWater\(assembly\.map\(/,
        'which is the surface of each of them');

    const assembly = methodBody(terrainSource, 'waterAssembly');
    assert.ok(assembly, 'js/terrain.js should work that assembly out in a method of its own');

    assert.match(assembly, /tilesTouching\(tile\.index\)/,
        'which is every tile touching one handed over, because a neighbour redrawn here '
      + 'also meets the tiles further out');
});

/**
 * And every tile that settling reached is written again. The assembly is wider
 * than the redraws by design, so `matchWater` moves the openness of tiles
 * `redrawTile` never touched - and those are still marked watered. `updateWater`
 * returns early on a watered tile when `dt` is 0, which is every frame behind
 * the title screen, a pause, the settings panel or the editor, and the ground is
 * still laid a tile a frame on all of them.
 *
 * Simulated over a three-by-three block of flooded tiles: 12 settlings move the
 * openness of a tile already marked watered, and the water as drawn on a paused
 * frame is left disagreeing across its joins by up to 0.125 of the shoreline
 * fade - the defect `matchWater` is there to close, still on screen until the
 * flight runs again. Marking the assembly unwatered takes it to 0.
 */
test('a tile the water settling reached is drawn again, paused or flying', () => {
    const added = methodBody(terrainSource, 'addTile');
    assert.ok(added, 'js/terrain.js should lay one tile in a method of its own');

    assert.match(added, /for \(const each of assembly\) each\.watered = false/,
        'every tile in the assembly comes off watered, or a paused world keeps drawing '
      + 'the openness each of them worked out alone');

    const settling = added.search(/matchWater\(/);
    const unwatered = added.search(/each\.watered = false/);
    assert.ok(settling < unwatered,
        'and it comes off after the settling rather than before it');
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
 * Every `@media` block in the page, in the order the cascade reads them. The
 * blocks are what a question about one screen has to be answered out of: two
 * of them place `#hud.floated` and three of them place `#game-mode.floated`,
 * and the last one to speak is the one that holds.
 */
function mediaBlocks(css) {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const blocks = [];

    for (const match of stripped.matchAll(/@media([^{]*)\{/g)) {
        let depth = 1;
        let at = match.index + match[0].length;
        const from = at;
        while (at < stripped.length && depth > 0) {
            if (stripped[at] === '{') depth++;
            if (stripped[at] === '}') depth--;
            at++;
        }
        blocks.push({
            condition: match[1].replace(/\s+/g, ' ').trim(),
            body: stripped.slice(from, at - 1)
        });
    }

    return blocks;
}

/**
 * True when a block's condition holds on a screen of a given size. A feature
 * this does not know how to answer - the reduced-motion one, say - reads as
 * not holding, so a block about something other than size is left out rather
 * than guessed at.
 */
function blockApplies(condition, screen) {
    const features = [...condition.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)/g)];
    if (!features.length || condition.split(' and ').length !== features.length) return false;

    return features.every(([, bound, axis, value]) => {
        const size = axis === 'width' ? screen.width : screen.height;
        return bound === 'min' ? size >= Number(value) : size <= Number(value);
    });
}

/**
 * What a stack of selectors resolves to on a screen of a given size. Each is
 * read across the whole page in source order - the rules written for every
 * screen, then every media block that matches - and the later selector wins
 * the properties both declare, which is the order they are passed in.
 */
function resolved(css, selectors, screen) {
    const out = new Map();

    for (const selector of selectors) {
        for (const source of sheets(css, screen)) {
            for (const [property, value] of declarations(source, selector)) out.set(property, value);
        }
    }

    return out;
}

/**
 * Every stylesheet a screen of a given size reads, in cascade order: the rules
 * written for every screen, then the body of each media block whose condition
 * holds.
 *
 * The block bodies were cut out of the page with its comments already off, so
 * what they are taken back out of has to have its comments off too. Most of
 * the blocks carry one, and a body with its comment removed is not a string
 * the raw page contains - left in, every rule in those blocks reads as a rule
 * written for every screen, whatever the size asked about.
 */
function sheets(css, screen) {
    const blocks = mediaBlocks(css);
    const plain = blocks.reduce(
        (rest, block) => rest.replace(block.body, ''),
        css.replace(/\/\*[\s\S]*?\*\//g, '')
    );

    return [plain, ...blocks
        .filter(block => blockApplies(block.condition, screen))
        .map(block => block.body)];
}

/**
 * A declared length as a number: a plain count of pixels, a count taken off
 * the screen, or - where an overlay declares its own rows - those rows added
 * up. The last is what keeps a bound and the content under it in step: a bound
 * written in rows moves when a type size does, and a bound written in pixels
 * counted off the screen falls wherever the arithmetic leaves it.
 */
function length(value, screen, declared = null) {
    if (value?.endsWith('px')) return Number(value.slice(0, -2));

    const viewport = value?.match(/^calc\(100(vh|vw) - (\d+)px\)$/);
    if (viewport) return (viewport[1] === 'vh' ? screen.height : screen.width) - Number(viewport[2]);

    const rows = value?.replace(/\s+/g, ' ')
        .match(/^calc\( ?(var\(--[\w-]+\)(?: \+ var\(--[\w-]+\))*) ?\)$/);
    if (!rows || !declared) return null;

    let total = 0;
    for (const [, name] of rows[1].matchAll(/var\((--[\w-]+)\)/g)) {
        const height = declared.get(name);
        if (!height?.endsWith('px')) return null;
        total += Number(height.slice(0, -2));
    }

    return total;
}

/**
 * The band of the screen an overlay takes, top edge and bottom edge, read off
 * where it is hung and how far it is allowed to run. The content's own height
 * is nowhere in the stylesheet, which is what makes an overlay checkable at
 * all: a declared bound is a promise about where it stops, and an overlay
 * without one could be any height and cannot be measured against anything.
 */
function verticalBand(css, selectors, screen) {
    const box = resolved(css, selectors, screen);
    const bound = length(box.get('max-height'), screen, box);
    if (bound === null) return null;

    const top = length(box.get('top'), screen, box);
    if (top !== null) return { from: top, to: top + bound };

    const bottom = length(box.get('bottom'), screen, box);
    if (bottom === null) return null;
    return { from: screen.height - bottom - bound, to: screen.height - bottom };
}

/**
 * Whether the readouts are stood down for the breakdown on a screen of a given
 * size. The rule is one declaration, but which screens it is written inside is
 * the whole of what it is worth: out in the open it fired wherever the pads
 * were, including the screens the card had already passed the stack on.
 */
function standsDown(css, screen) {
    return sheets(css, screen).some(source => styleRules(source).some(rule =>
        rule.selectors.some(selector =>
            /#game-mode\.floated\.reporting\s*~\s*#hud\.floated/.test(selector))
        && /visibility:\s*hidden/.test(rule.body ?? '')));
}

/**
 * Whether the card is hung in the same lane the readouts are. On a screen too
 * short for the stack the readouts take the band between the two pad clusters
 * and the card is narrowed to that same lane, which is the one arrangement
 * where width settles nothing: the two are in one column however wide the
 * screen gets.
 */
function sharesTheLane(css, screen) {
    const lane = length(resolved(css, ['#hud', '#hud.floated'], screen).get('left'), screen);
    const card = resolved(css, ['#game-mode', '#game-mode.floated'], screen);
    const width = length(card.get('max-width'), screen, card);

    return lane !== null && width !== null && screen.width - lane * 2 === width;
}

/**
 * Whether the card and the readouts are given the same part of the screen, and
 * so whether there is anything for the stand-down to trade for. They meet when
 * their bands overlap down the screen and the screen is too narrow to have put
 * them side by side - or when both are in the lane, where width settles
 * nothing.
 */
function cardMeetsReadouts(css, screen) {
    const card = verticalBand(css,
        ['#game-mode', '#game-mode.floated', '#game-mode.floated.reporting'], screen);
    const readouts = verticalBand(css, ['#hud', '#hud.floated'], screen);
    if (!card || !readouts) return false;
    if (card.to <= readouts.from || readouts.to <= card.from) return false;

    return screen.width <= CARD_CLEARS_STACK || sharesTheLane(css, screen);
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

// --- The interactive environment builder ----------------------------------

/**
 * A panel added to the markup and not to the stylesheet is a card with no card
 * around it: the rows draw as bullets over the world and the title has no box.
 */
test('the builder picker is styled as a card like the panels beside it', () => {
    const rule = styleRule(indexHtml, 'build-picker');
    assert.ok(rule, 'index.html should style #build-picker');
    assert.ok(/display:\s*none/.test(rule), 'and it should start hidden');
    assert.ok(/position:\s*fixed/.test(rule), 'and lie over the world rather than in the page');
    assert.ok(/overflow-y:\s*auto/.test(rule),
        'and scroll rather than running off the bottom of a short window');

    for (const selector of ['#build-picker h2', '#build-picker h3', '#build-picker small']) {
        assert.ok(new RegExp(`${selector}[,\\s]`).test(indexHtml), `index.html should style ${selector}`);
    }
});

test('the picker is headed with the name of the entry that opens it', () => {
    assert.ok(indexHtml.includes(`<h2>${PICKER_TITLE}</h2>`),
        `index.html should head the picker ${PICKER_TITLE}`);
    assert.ok(indexHtml.includes(`<h3>${PICKER_HEADING}</h3>`),
        `and say what the cards under it are`);
    assert.equal(PICKER_TITLE, BUILDER_LABEL,
        'which is the one name, on the entry and on the screen it opens');
});

// The six canvases are read off the environment registry, so a preset added
// later is a card without an edit to the page.
test('the picker leaves its two lists empty for the registry to fill', () => {
    for (const id of ['build-picker-cards', 'build-picker-actions']) {
        assert.ok(new RegExp(`<ul id="${id}">\\s*</ul>`).test(indexHtml),
            `the entries are drawn from js/build-picker.js, so the page should leave #${id} empty`);
    }

    for (const card of pickerCards()) {
        assert.ok(!indexHtml.includes(card.label),
            `index.html names the ${card.label} canvas, which the registry publishes`);
    }
});

// Two columns, which is how the walkthrough lays the six out, and a card is
// taller than a row because it carries a line about the ground it starts from.
test('the canvases are drawn as cards in two columns rather than as a list', () => {
    assert.ok(styled(indexHtml, '#build-picker-cards', /display:\s*grid/),
        'the cards should be laid out as a grid');
    assert.ok(styled(indexHtml, '#build-picker-cards', /grid-template-columns:\s*repeat\(2/),
        'in two columns');
    assert.ok(styled(indexHtml, '#build-picker-cards li', /min-height/),
        'and a card should have a height to carry its label and its line');
    assert.ok(/#build-picker-cards li\[data-note\]::after[,\s]/.test(indexHtml),
        'index.html should draw the line under a card');
});

/**
 * The builder's entry is 31 characters, nearly twice the next longest label
 * either card carries, and at the spacing the rows are set at it is wider than
 * a 320-pixel screen.
 *
 * A browserless suite cannot measure text, so what it can hold is that the two
 * cards close up at a width where the longest label would not otherwise fit -
 * which is the check the card-height work recommended for exactly this case.
 */
test('the two menu cards close up where the longest label would not fit', () => {
    const longest = [...START_MENU_ENTRIES, ...PAUSE_MENU_ENTRIES]
        .reduce((worst, entry) => Math.max(worst, entry.label.length), 0);

    assert.equal(longest, BUILDER_LABEL.length,
        'the builder should be the longest label either menu carries');

    const narrow = indexHtml.match(/@media \(max-width: 480px\) \{[\s\S]*?\n        \}/);
    assert.ok(narrow, 'index.html should carry a narrow-screen rule for the two cards');
    assert.ok(/#pause-menu li,\s*\n\s*#start-menu li \{/.test(narrow[0]),
        'and it should be the two cards the long label is drawn on');
    assert.ok(/letter-spacing:\s*1px/.test(narrow[0]), 'closing the space between the letters');
    assert.ok(/font-size:\s*12px/.test(narrow[0]), 'and setting the row smaller');
});

test('the control list names the builder as what L opens', () => {
    const { body: list } = elementBody(indexHtml, 'controls-help-list');
    assert.match(list, /L - Interactive Environment Builder/,
        'the list should say what L opens now');
    assert.ok(!/L - Element Editor/.test(list), 'and not what it used to open');
});

/**
 * The entry and the key read one predicate, so the menu and the keyboard cannot
 * come to disagree about when the builder is reachable.
 *
 * js/main.js imports Three.js and cannot be imported here, so this is read off
 * its source the way every other wiring check in this file is.
 */
test('the menu entry and the key both ask whether the builder is ready', () => {
    const predicate = mainSource.match(/builderReady\(\)\s*\{([\s\S]*?)\n    \}/);
    assert.ok(predicate, 'js/main.js should define builderReady()');
    assert.match(predicate[1], /!isRunning\(this\.run\)/,
        'a game mode brings its own ground, so there is nothing to be building while one runs');

    const keyed = mainSource.match(/isBuilderOpenKey\(e\.code\)[^\n]*/g) ?? [];
    assert.equal(keyed.length, 2, 'the key is read on the title screen and over a flight');
    for (const read of keyed) {
        assert.match(read, /this\.builderReady\(\)/, `${read.trim()} should read the one predicate`);
    }

    assert.match(mainSource, /const ready = this\.builderReady\(\);/,
        'and the menus read it once rather than working it out a second way');
    assert.match(mainSource, /setMenuEntries\(this\.pauseMenuState, pauseMenuEntries\(ready\)\)/,
        'building its entries from that same answer');
});

/**
 * And both screens are held to it, from the one place.
 *
 * A game mode can be chosen from the title screen's own panel before anything
 * has flown, and the run is live from that moment, so the title screen's entry
 * goes dead at the same instant the pause menu's does. It is synced beside the
 * pause menu rather than from a second place of its own, because two readings
 * of one predicate are two things that can drift apart - which is the whole
 * reason `builderReady()` exists.
 */
test('the title screen drops the builder entry on the same predicate the pause menu does', () => {
    const body = mainSource.match(/syncBuilderEntry\(\)\s*\{[\s\S]*?\n    \}/);
    assert.ok(body, 'js/main.js should define syncBuilderEntry()');

    assert.match(body[0], /setMenuEntries\(this\.startMenuState, startMenuEntries\(ready\)\)/,
        'the start menu should be built from the same answer');
    assert.match(body[0], /this\.startMenu\.rebuild\(this\.startMenuState\)/,
        'and its card drawn again, because a row carries its place in the menu');
    assert.match(body[0], /setMenuEntries\(this\.pauseMenuState, pauseMenuEntries\(ready\)\)/,
        'beside the pause menu rather than instead of it');

    assert.match(body[0], /if \(ready === this\.builderEntryReady\) return;/,
        'and only a change should rebuild either card');

    const syncs = mainSource.match(/this\.syncBuilderEntry\(\);/g) ?? [];
    assert.equal(syncs.length, 1, 'read from the one place the overlays are synced in');

    const built = mainSource.match(/startMenuEntries\(/g) ?? [];
    assert.equal(built.length, 1, 'and the start menu built from it in one place and no other');
});

test('both menus open the builder through the one function the key opens it with', () => {
    const opens = mainSource.match(/case BUILDER_ENTRY_ID:[\s\S]*?break;/g) ?? [];
    assert.equal(opens.length, 2, 'the start menu and the pause menu should both carry the entry');

    for (const open of opens) {
        assert.match(open, /this\.openBuilder\(BUILD_FROM_(TITLE|PAUSE)\)/,
            'and each should say where it was chosen from');
    }

    const body = mainSource.match(/openBuilder\(from = BUILD_FROM_TITLE\)\s*\{[\s\S]*?\n    \}/);
    assert.ok(body, 'js/main.js should define openBuilder(from)');
    assert.match(body[0], /openBuildMode\(this\.builder, from, builtWorld\(this\.editor\)\)/,
        'carrying what opened it into the session, and the built world it goes back to');
    assert.match(body[0], /if \(buildModeDrawing\(this\.builder\)\) this\.showCanvas\(this\.builder\.environment\);/,
        'drawing that world\'s canvas straight away when there is one, with no picker in front of it');
});

/**
 * A canvas is the world being built rather than flown, so the flight stands
 * down for as long as one is open.
 *
 * Both halves matter and neither is visible from the other. Laying ground
 * around the aircraft would put the grid back out under a session that is
 * deliberately drawing one tile; letting the chase camera place the view would
 * leave it standing behind an aircraft nobody is flying.
 */
test('a canvas stands the flight down rather than being drawn behind it', () => {
    const frame = mainSource.match(/animate\(\)\s*\{[\s\S]*?\n    \}/);
    assert.ok(frame, 'js/main.js should define animate()');

    assert.match(frame[0], /const canvas = buildModeDrawing\(this\.builder\);/,
        'the frame should know whether a canvas is open');
    assert.match(frame[0], /if \(!canvas\) this\.flyOver\(/,
        'and not lay the grid out around the aircraft while one is');
    assert.match(frame[0], /if \(canvas\) this\.trackCanvasCamera\(elapsed\);\s*\n\s*else this\.camera2\.update\(dt\);/,
        'and hold the camera over the canvas rather than behind the aircraft, moved by the real clock');
    assert.match(frame[0], /buildModeShowing\(this\.builder\)/,
        'and freeze the clock for the whole session, picker included');
});

test('opening a canvas draws one tile of it, with no strip and the camera held over it', () => {
    const start = methodBody(mainSource, 'startCanvas');
    assert.ok(start, 'js/main.js should define startCanvas()');
    assert.match(start, /beginCanvas\(this\.builder, environmentId, keptPlacements\(this\.editor, environmentId\),\s*canvasWorld\(this\.editor, environmentId\)\)/,
        'which opens with what an earlier session kept on it already committed, over the rows of the world as they were kept');
    assert.match(start, /this\.showCanvas\(environmentId\);/,
        'and draws it the way a builder reopening onto its built world does');

    const show = methodBody(mainSource, 'showCanvas');
    assert.ok(show, 'js/main.js should define showCanvas()');
    assert.match(show, /this\.terrain\.setCanvas\(true\)/, 'one tile rather than nine');
    assert.match(show,
        /setEnvironment\(environmentId, \{\s*runway: false,\s*elements: canvasElements\(getEnvironment\(environmentId\), this\.builder\)\s*\}\)/,
        'on the canvas the picker chose, with nothing prepared to arrive on and drawn from what is on it');
    assert.match(show, /this\.holdCanvasView\(\)/, 'and the camera held over it');

    const leaving = mainSource.match(/leaveBuilder\(changed = false\)\s*\{[\s\S]*?\n    \}/);
    assert.ok(leaving, 'js/main.js should define leaveBuilder()');
    assert.match(leaving[0], /this\.terrain\.setCanvas\(false\)/, 'and leaving puts the grid back');
    assert.match(leaving[0], /this\.releaseCanvasView\(\)/, 'with the flight camera and its fog');
});

/**
 * And the flight under the canvas comes back with its own ground.
 *
 * What the flight keeps is held by `startsAfresh` in `test/flight-state.test.js`,
 * over a stand-in aircraft, because the rule is a pure reading. What cannot be
 * held there is the wiring: a `refreshWorld` that was never told the world is
 * being restored would read a rebuild the way the settings panel's rebuild is
 * read, and put the aircraft back at the start of a flight nothing had ended.
 * The sequence itself needs a renderer to lay ground in, so this is read off
 * the source the way every other wiring check in this file is.
 */
test('leaving a canvas restores the flight world rather than choosing a new one', () => {
    assert.match(mainSource, /refreshWorld\(\{ restored = false \} = \{\}\) \{/,
        'refreshWorld should take whether the world is being laid again or changed');
    assert.match(mainSource, /if \(startsAfresh\(\{\s*\n\s*rebuilt,\s*\n\s*startChanged: changed,/,
        'and read what that meant for the aircraft through the one pure rule');
    assert.match(mainSource, /\n\s*restored\s*\n\s*\}\)\) this\.aircraft\.reset\(\);/,
        'with the restore among what it reads');

    const leaving = mainSource.match(/leaveBuilder\(changed = false\)\s*\{[\s\S]*?\n    \}/);
    assert.match(leaving[0], /this\.refreshWorld\(\{ restored: !titleShowing\(this\.titleState\) && !changed \}\)/,
        'leaving a canvas should say the flight world is being restored - unless a kept world changed it');
    assert.ok(!/this\.refreshWorld\(\);/.test(leaving[0]),
        'and never ask for the plain refresh, which reads a restore as a world that changed');
});

// --- The canvas's way out, palette and control list --------------------------

/**
 * A started canvas once answered nothing but two keys it never named. What a
 * canvas carries now is the chrome that says how to work it and how to leave
 * it: a palette and a control list, each hidden until a canvas is open.
 */
test('a canvas carries a palette and a control list, styled and hidden until one opens', () => {
    for (const id of ['build-palette', 'build-help']) {
        const rule = styleRule(indexHtml, id);
        assert.ok(rule, `index.html should style #${id}`);
        assert.match(rule, /display:\s*none/, `#${id} should start hidden`);
        assert.match(rule, /position:\s*fixed/, 'and lie over the canvas rather than in the page');
    }

    const tile = styleRule(indexHtml, 'build-palette button[data-tool]') ?? '';
    for (const side of ['width', 'height']) {
        const size = Number(tile.match(new RegExp(`(?:^|[^-])${side}:\\s*(\\d+)px`))?.[1]);
        assert.ok(size >= 44, `a tile should be ${side === 'width' ? 'wide' : 'tall'} enough for a fingertip, the only way out a touch screen has: ${size}`);
    }
    assert.ok(styled(indexHtml, '#build-palette button[data-tool="accept"]', /grid-column:\s*2;/),
        'and the way out should sit at the foot of the right-hand column, where the art puts its tick');
    assert.ok(styled(indexHtml, '#build-palette button[aria-pressed="true"]', /box-shadow:\s*0 0 0 4px #90c090/),
        'with the live tool ringed in the art\'s green');
});

test('the palette is drawn from the tools that work rather than written into the page', () => {
    assert.match(indexHtml, /<nav id="build-palette" aria-label="Builder tools"><\/nav>/,
        'index.html should leave the palette empty for the registry to fill');

    const drawn = methodBody(mainSource, 'drawPalette');
    assert.ok(drawn, 'js/main.js should define drawPalette()');
    assert.match(drawn, /for \(const tool of paletteTools\(\)\)/, 'one tile per tool that works');
    assert.match(drawn, /document\.createElement\('button'\)/,
        'each a button, which focus and a screen reader can find as well as a pointer');
    assert.match(drawn, /tile\.type = 'button'/);
});

/**
 * Three ways out - the accept tile, Escape on a canvas and the picker's BACK -
 * reach one call, so they cannot come to ask different questions once the
 * confirms are asked from it.
 */
test('the tile, the key and the picker leave through the one way out', () => {
    const asked = methodBody(mainSource, 'requestLeaveBuilder');
    assert.ok(asked, 'js/main.js should define requestLeaveBuilder()');
    assert.match(asked, /requestLeave\(this\.builder\)/, 'asking the session');
    assert.match(asked, /if \(asked\?\.leave\) this\.leaveBuilder\(\);/, 'and leaving only on its answer');

    assert.match(methodBody(mainSource, 'onPaletteClick'),
        /if \(id === ACCEPT_TOOL\) this\.requestLeaveBuilder\(\);/, 'the accept tile asks');
    assert.match(methodBody(mainSource, 'onBuilderKey'),
        /if \(leavesBuilder\(this\.builder, e\.code\)\) \{\s*this\.requestLeaveBuilder\(\);/,
        'Escape asks, by the keys the screen it is on is left by');
    assert.match(methodBody(mainSource, 'choosePickerRow'),
        /PICKER_LEFT\) \{\s*this\.requestLeaveBuilder\(\);/, 'and the picker\'s BACK asks');

    assert.ok(!/isBuilderCloseKey/.test(mainSource),
        'and no handler reads one list of close keys for both screens');
});

test('the palette and the control list are shown for a canvas and for nothing else', () => {
    const sync = methodBody(mainSource, 'syncOverlays');
    assert.match(sync, /const canvas\s*=\s*builder && buildModeDrawing\(this\.builder\);/,
        'the overlays should know whether a canvas is open, not only whether the builder is');
    assert.match(sync, /this\.overlays\.palette\.style\.display\s*=\s*canvas \? 'grid' : 'none';/);
    assert.match(sync, /this\.overlays\.buildHelp\.style\.display\s*=\s*canvas \? 'block' : 'none';/);
});

test('H works the canvas\'s list before the way out reads the key', () => {
    const keyed = methodBody(mainSource, 'onBuilderKey');
    const help  = keyed.indexOf('applyHelpKey(this.buildHelpState');
    const leave = keyed.indexOf('leavesBuilder(this.builder');

    assert.ok(help >= 0, 'the builder should read H for its own list');
    assert.ok(help < leave, 'ahead of the way out');
    assert.match(keyed, /buildModeDrawing\(this\.builder\) && applyHelpKey/,
        'and only on a canvas, where the list is');
});

// --- The pointer and the camera on a canvas ----------------------------------

/**
 * The pointer reaches the canvas through one set of listeners on the renderer's
 * own element. A wheel listener left passive cannot stop the page zooming under
 * it, so how it is registered is the half of the claim source text can hold.
 */
test('the renderer\'s canvas listens for the pointer, with the wheel kept from the page', () => {
    const wired = methodBody(mainSource, 'setupBuilderPointer');
    assert.ok(wired, 'js/main.js should define setupBuilderPointer()');
    assert.match(wired, /const surface = this\.renderer\.domElement;/, 'on the renderer\'s own canvas');

    for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'contextmenu']) {
        assert.ok(wired.includes(`addEventListener('${name}'`), `listening for ${name}`);
    }
    assert.match(wired, /addEventListener\('wheel',\s*\(e\) => this\.onCanvasWheel\(e\), \{ passive: false \}\)/,
        'and for the wheel non-passively, so it can keep the page from zooming');
    assert.match(wired, /addEventListener\('contextmenu', \(e\) => \{\s*if \(!buildModeDrawing\(this\.builder\)\) return;\s*e\.preventDefault\(\);\s*this\.onCanvasMenu\(e\);/,
        'the right button\'s menu kept off only while a canvas is open, and a right click read as the builder\'s');

    const setups = mainSource.match(/this\.setupBuilderPointer\(\);/g) ?? [];
    assert.equal(setups.length, 1, 'attached once, for as long as the page is open');
});

/**
 * The listeners are there for the whole page, so the flight is left alone by
 * every one of them returning unless a canvas is open - by construction rather
 * than by each remembering to be careful.
 */
test('every pointer handler on the canvas stands down unless a canvas is open', () => {
    for (const name of ['onCanvasPress', 'onCanvasDrag', 'onCanvasWheel']) {
        const body = methodBody(mainSource, name);
        assert.ok(body, `js/main.js should define ${name}()`);
        assert.match(body, /if \(!buildModeDrawing\(this\.builder\)/, `${name} should return off a canvas`);
    }

    const press = methodBody(mainSource, 'onCanvasPress');
    assert.match(press, /const tool\s*= buildModeTool\(this\.builder\);\s*const gesture = cameraGesture\(e, tool\);/,
        'a press is the camera\'s only when the press and the live tool make a gesture');
    assert.match(press, /if \(!gesture\) \{\s*(\/\/[^\n]*\n\s*)*if \(e\.button === 0 && !\(e\.shiftKey && dropsAtClick\(tool\)\) && drawAgain\(this\.builder\)\) this\.draftKept\(\);\s*if \(e\.button === 0 && !e\.shiftKey && dropsAtClick\(tool\)\) this\.dropAt\(e\);\s*else if \(e\.button === 0 && \(tool === LASSO_PALETTE_TOOL \|\| extrudeDrawing\(this\.builder\)\)\) this\.lassoPress\(e\);\s*else if \(e\.button === 0 && eyeDropperArmed\(this\.builder\)\) this\.dropperAt\(e\);\s*else if \(e\.button === 0 && extrudeStage\(this\.builder\) === EXTRUDE_SURFACES\) this\.surfacePress\(e\);\s*else if \(e\.button === 0 && isStrokeTool\(tool\)\) this\.strokePress\(e\);\s*else if \(e\.button === 0 && insertsTemplate\(tool\)\) this\.insertAt\(e\);\s*return;\s*\}/,
        'and a plain press of the main button is a tool\'s that drops at a click, the lasso\'s, the eye dropper\'s, an extrusion\'s surface\'s, a stroke tool\'s or Insert Runway\'s');
    assert.match(press, /setPointerCapture\(e\.pointerId\)/,
        'and is captured, so a drag over the palette stays the drag it began as');

    assert.match(methodBody(mainSource, 'onCanvasWheel'), /e\.preventDefault\(\);/,
        'and the wheel is kept from the page');
});

test('a finger on a canvas is a gesture and not a scroll, and only on a canvas', () => {
    assert.match(methodBody(mainSource, 'syncOverlays'),
        /this\.renderer\.domElement\.style\.touchAction = canvas \? 'none' : '';/);
});

// Escape steps out of the innermost thing first, so a drag being made ends
// where it is rather than the builder being left from under it.
test('Escape ends a drag before it asks to leave', () => {
    const keyed = methodBody(mainSource, 'onBuilderKey');
    const ends  = keyed.indexOf('if ((this.canvasDrag || this.gumballDrag || this.lassoDrawing || this.strokeDrawing) && isCanvasLeaveKey(e.code))');
    const leave = keyed.indexOf('leavesBuilder(this.builder');

    assert.ok(ends >= 0, 'the builder should end a drag on the leave key');
    assert.ok(ends < leave, 'ahead of the way out');
    assert.match(keyed.slice(ends),
        /^if \(\(this\.canvasDrag \|\| this\.gumballDrag \|\| this\.lassoDrawing \|\| this\.strokeDrawing\) && isCanvasLeaveKey\(e\.code\)\) \{\s*this\.endCanvasDrag\(\);\s*this\.endGumballDrag\(\);\s*this\.cancelLasso\(\);\s*this\.cancelStroke\(\);\s*return;/,
        'the view\'s drag, a handle\'s, a shape half drawn and a stroke half laid alike');
});

test('a held key moves the view by the frame, and leaving lets go of it', () => {
    const keyed = methodBody(mainSource, 'onBuilderKey');
    assert.match(keyed, /if \(isBuildMoveKey\(e\.code\)\) \{\s*e\.preventDefault\(\);\s*this\.buildKeys\.add\(e\.code\);/,
        'a move key is held rather than acted on');

    const frame = methodBody(mainSource, 'trackCanvasCamera');
    assert.match(frame, /moveBuildCamera\(this\.buildCamera, moveIntent\(this\.buildKeys\), elapsed\)/,
        'and the frame moves the view on the real clock');
    assert.match(frame, /this\.placeCanvasCamera\(\);/, 'then stands the camera where the state says');
    assert.match(methodBody(mainSource, 'placeCanvasCamera'),
        /clearOfGround\(position, this\.terrain\.getTerrainHeightAt\(position\.x, position\.z\)\)/,
        'with the camera kept above the ground under it');

    assert.match(mainSource, /window\.addEventListener\('keyup', \(e\) => \{\s*this\.buildKeys\.delete\(e\.code\);/);
    assert.match(mainSource, /window\.addEventListener\('blur', \(\) => this\.buildKeys\.clear\(\)\);/);

    const leaving = methodBody(mainSource, 'leaveBuilder');
    assert.match(leaving, /this\.endCanvasDrag\(\);\s*this\.buildKeys\.clear\(\);/,
        'and a drag or a held key does not outlive the canvas it was moving');
});

test('a canvas opens on a camera seeded from the hold', () => {
    assert.match(methodBody(mainSource, 'showCanvas'),
        /this\.buildCamera = createBuildCamera\(this\.terrain\.size\);/);
});

// --- Ground picking ----------------------------------------------------------

/**
 * A pick is cast from the camera as the state now stands rather than as the
 * last frame drew it - several wheel notches land between frames - and it is
 * read against the canvas's own ground and square, so a ray that meets ground
 * off the canvas is a miss rather than a point moved onto its edge.
 */
test('a pick is cast from the camera as it stands, against the canvas alone', () => {
    const pick = methodBody(mainSource, 'pickCanvasPoint');
    assert.ok(pick, 'js/main.js should define pickCanvasPoint()');

    const placed = pick.indexOf('this.placeCanvasCamera();');
    const cast   = pick.indexOf('this.pointerRay.setFromCamera(');
    assert.ok(placed >= 0 && cast > placed, 'the camera is stood where the state says before the ray is cast');
    assert.match(pick, /if \(!buildModeDrawing\(this\.builder\)/, 'and nothing is picked off a canvas');
    assert.match(pick, /bounds: this\.canvasGround\.bounds/, 'and only the canvas may be picked');
    assert.match(pick, /pickGround\(origin, direction, \(x, z\) => this\.terrain\.getTerrainHeightAt\(x, z\)/,
        'against the ground the canvas is drawn from');

    assert.match(methodBody(mainSource, 'showCanvas'), /this\.canvasGround = this\.readCanvasGround\(\);/,
        'the ground a pick reads is worked out when the canvas opens');
    assert.match(methodBody(mainSource, 'placeCanvasCamera'), /this\.camera\.updateMatrixWorld\(\);/,
        'and a camera stood between frames is one a ray can be cast from');
});

test('the wheel zooms toward the ground under the pointer', () => {
    const wheel = methodBody(mainSource, 'onCanvasWheel');
    assert.match(wheel, /const point = this\.pickCanvasPoint\(e\.clientX, e\.clientY\);/);
    assert.match(wheel, /const travel = wheelPixels\(e\.deltaY, e\.deltaMode\) \* \(this\.buildCameraSpeed \?\? 1\);\s*this\.buildCamera = zoomBuildCameraToward\(this\.buildCamera, travel, point\);/,
        'scaled by the builder\'s camera speed');
});

// A range gated shut is held on the element editor the way a locked box is on
// the settings panel: listed and dimmed rather than drawn as a live row.
test('a held row on the element editor is drawn dimmed', () => {
    assert.ok(styled(indexHtml, '#element-editor-menu li.locked', /opacity:\s*0\.6/),
        'index.html should dim a locked row on the element editor');
});

// --- The dock ----------------------------------------------------------------

/**
 * The fields scroll and nothing else does: the heading and the answers sit
 * outside the part that scrolls, so a long panel can never push the accept and
 * the cancel below the fold.
 */
test('the dock scrolls its fields between a pinned heading and pinned answers', () => {
    const dock = indexHtml.match(/<aside id="build-dock"[^>]*>([\s\S]*?)<\/aside>/);
    assert.ok(dock, 'index.html should carry the dock');
    assert.match(dock[1], /^\s*<h3 data-dock="heading"><\/h3>\s*<div id="build-dock-fields" data-dock="fields"><\/div>\s*<div id="build-dock-actions" data-dock="actions"><\/div>\s*$/,
        'heading, then the fields, then the answers - the answers outside the fields');

    assert.ok(styled(indexHtml, '#build-dock-fields', /overflow-y:\s*auto/), 'the fields scroll');
    assert.ok(styled(indexHtml, '#build-dock-fields', /overscroll-behavior:\s*contain/),
        'and keep the wheel to themselves at either end');
    assert.ok(styled(indexHtml, '#build-dock-fields', /min-height:\s*0/), 'shrinking to the room the dock has');
    assert.ok(styled(indexHtml, '#build-dock h3', /flex:\s*none/), 'the heading does not');
    assert.ok(styled(indexHtml, '#build-dock-actions', /flex:\s*none/), 'and neither do the answers');
    assert.ok(styled(indexHtml, '#build-dock', /max-height:\s*calc\(100vh - 40px\)/), 'inside the window');
});

test('the dock is drawn by the one panel view and read back every canvas frame', () => {
    assert.match(mainSource, /this\.dockView = new PanelView\(this\.overlays\.dock, \{/);
    assert.match(methodBody(mainSource, 'trackCanvasCamera'), /this\.syncDock\(\);/,
        'so Select\'s panel reads back what a gesture just did');
    assert.match(methodBody(mainSource, 'syncOverlays'), /this\.syncDock\(canvas\);/,
        'and comes off with the canvas');

    const sync = methodBody(mainSource, 'syncDock');
    assert.match(sync, /dockContent\(this\.builder, \{/, 'what it shows is the pure module\'s to say');
});

/**
 * A figure typed into the dock is the field's: the builder's keys and the
 * aircraft's are kept off it, ahead of every other reading of a key.
 */
test('a key typed into a dock field reaches nothing but the field', () => {
    const wired = methodBody(mainSource, 'setupKeys');
    const guard = wired.indexOf('if (this.editingDockField(e)) {');
    const first = wired.indexOf('if (e.ctrlKey || e.altKey || e.metaKey) return;');
    assert.ok(guard >= 0 && guard < first, 'the field is asked about before anything else reads the key');
    assert.match(wired.slice(guard), /^if \(this\.editingDockField\(e\)\) \{\s*if \(e\.code === 'Escape'\) e\.target\.blur\(\);\s*e\.stopPropagation\(\);\s*return;/);
});

test('an edit in hand redraws the canvas from what it holds, and is settled from the dock', () => {
    assert.match(methodBody(mainSource, 'redrawCanvas'),
        /this\.terrain\.setEnvironment\(id, \{ runway: false, elements: canvasElements\(getEnvironment\(id\), this\.builder\) \}\)/);

    const apply = methodBody(mainSource, 'applyDockValue');
    assert.match(apply, /else if \(kind === DOCK_DRAFT \|\| kind === DOCK_RUNWAY\) \{\s*reviseDraft\(this\.builder, \{ config: holder\.config \}\);\s*this\.redrawCanvas\(\);/,
        'a value moved on an edit is the ground moving under it');

    const settle = methodBody(mainSource, 'onDockAction');
    assert.match(settle, /if \(id === DOCK_ACCEPT\.id\) acceptDraft\(this\.builder\);/);
    assert.match(settle, /else if \(id === DOCK_CANCEL\.id\) cancelDraft\(this\.builder\);/);
    assert.match(settle, /this\.redrawCanvas\(\);/);
});

test('a canvas\'s field of view is put back as the flight had it', () => {
    assert.match(methodBody(mainSource, 'holdCanvasView'), /this\.flightFov = this\.camera\.fov;/);
    assert.match(methodBody(mainSource, 'releaseCanvasView'), /this\.camera\.fov = this\.flightFov \?\? DEFAULT_FOV;/);
});

test('on a narrow screen the dock runs across the foot and the list moves clear of it', () => {
    const narrow = indexHtml.match(/@media \(max-width: 640px\) \{\s*#build-dock \{([^}]*)\}\s*#build-help \{([^}]*)\}/);
    assert.ok(narrow, 'index.html should lay the dock out for a narrow screen');
    assert.match(narrow[1], /bottom:\s*10px/, 'across the foot');
    assert.match(narrow[1], /max-height:\s*40vh/, 'leaving most of the canvas to be seen');
    assert.match(narrow[2], /top:\s*20px/, 'and the list moved up into the corner the dock left');
});

// --- The two confirms, and a mountain dropped at a click -----------------------------

test('the page carries one confirm panel, a dialog with a heading and a menu of two buttons', () => {
    assert.match(indexHtml,
        /<div id="build-confirm">\s*<div id="build-confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="build-confirm-heading" tabindex="-1">\s*<h3 id="build-confirm-heading"><\/h3>\s*<ul id="build-confirm-menu"><\/ul>\s*<\/div>\s*<\/div>/,
        'the heading and the buttons are written by the script, from the session');

    const layer = indexHtml.match(/#build-confirm \{([^}]*)\}/);
    assert.ok(layer, 'index.html should style the layer the panel stands on');
    assert.match(layer[1], /inset:\s*0/, 'across the whole screen, so the palette, the dock and the canvas wait');
    assert.match(indexHtml, /#build-confirm-menu li\[data-entry="yes"\] \{[^}]*background:\s*#90c090/, 'a green YES');
    assert.match(indexHtml, /#build-confirm-menu li\[data-entry="no"\] \{[^}]*background:\s*#8b7355/, 'and a tan NO');
});

test('the confirm is drawn over a canvas only while it is asking, headed for its question', () => {
    const sync = methodBody(mainSource, 'syncOverlays');
    assert.match(sync, /const asking = canvas \? buildConfirm\(this\.builder\) : null;/);
    assert.match(sync, /this\.overlays\.confirm\.style\.display = asking \? 'flex' : 'none';/);
    assert.match(sync, /this\.overlays\.confirmHeading\.textContent = asking \? CONFIRM_HEADINGS\[asking\] : '';/);
    assert.match(sync, /this\.confirmMenu\.render\(this\.confirmState\);/);
});

test('the accept tile is named for the question it will ask, and Escape asks the same one', () => {
    const sync = methodBody(mainSource, 'syncOverlays');
    assert.match(sync, /const name = acceptToolName\(this\.builder\);\s*tile\.title = `\$\{name\} \(Esc\)`;\s*tile\.setAttribute\('aria-label', name\);/);
});

test('an open confirm takes every key before anything on the canvas reads one', () => {
    const keys = methodBody(mainSource, 'onBuilderKey');
    const confirm = keys.indexOf('confirmOpen(this.builder)');
    assert.ok(confirm >= 0, 'onBuilderKey should ask whether a confirm is open');
    for (const later of ['applyHelpKey', 'isBuildMoveKey', 'isReframeKey', 'leavesBuilder']) {
        assert.ok(keys.indexOf(later) > confirm, `${later} is read only once no confirm is asking`);
    }
    assert.match(keys, /if \(buildModeDrawing\(this\.builder\) && confirmOpen\(this\.builder\)\) \{\s*this\.onConfirmKey\(e\);\s*return;\s*\}/);

    const answer = methodBody(mainSource, 'onConfirmKey');
    assert.match(answer, /if \(isCanvasLeaveKey\(e\.code\)\) \{\s*e\.preventDefault\(\);\s*this\.answerBuildConfirm\(CONFIRM_STAY\);/,
        'Escape calls the question off');
    assert.match(answer, /const chosen = applyMenuKey\(this\.confirmState, e\.code, true, e\.repeat\);\s*if \(chosen\) this\.answerBuildConfirm\(chosen\);/,
        'and Enter answers the button under the cursor');
});

test('a confirm opens on YES with the focus, and a press off it calls it off', () => {
    const opened = methodBody(mainSource, 'confirmOpened');
    assert.match(opened, /resetSelection\(this\.confirmState\);/);
    assert.match(opened, /this\.endCanvasDrag\(\);\s*this\.endGumballDrag\(\);\s*this\.cancelLasso\(\);\s*this\.cancelStroke\(\);\s*this\.buildKeys\.clear\(\);/, 'with nothing still moving the view, a handle, a shape or a stroke, behind it');
    assert.match(opened, /this\.overlays\.confirmPanel\.focus\(\{ preventScroll: true \}\);/,
        'so Enter answers it rather than pressing the tile last clicked');

    assert.match(mainSource,
        /this\.overlays\.confirm\.addEventListener\('click', \(e\) => \{\s*if \(e\.target === this\.overlays\.confirm\) this\.answerBuildConfirm\(CONFIRM_STAY\);/);
    assert.match(methodBody(mainSource, 'requestLeaveBuilder'), /else if \(asked\?\.confirm\) this\.confirmOpened\(\);/);
    assert.match(methodBody(mainSource, 'onPaletteClick'),
        /else if \(!chooseBuildTool\(this\.builder, id\) && confirmOpen\(this\.builder\)\) this\.confirmOpened\(\);/,
        'and a tool change that asks opens it the same way');
});

test('an answer leaves, keeping the built world on YES, or settles the edit and redraws', () => {
    const answer = methodBody(mainSource, 'answerBuildConfirm');
    assert.match(answer, /const answered = answerConfirm\(this\.builder, answer\);/);
    assert.match(answer,
        /if \(answered\.leave\) \{\s*const changed = answered\.keep && this\.saveBuiltWorld\(answered\.environment, answered\.placements, answered\.world\);\s*this\.leaveBuilder\(changed\);/);
    assert.match(answer, /else if \(answered\.settled\) \{\s*this\.draftHolder = null;\s*this\.redrawCanvas\(\);/);

    const save = methodBody(mainSource, 'saveBuiltWorld');
    assert.match(save, /chooseSetting\(this\.settings, environment\);/, 'the canvas\'s environment becomes the one flown');
    assert.match(save, /keepBuiltWorld\(this\.editor, environment, runwayWanted\(startSettings\(this\.settings\)\), placements,\s*currentEnvironment\(this\.settings\), world\);/,
        'with what was built held where an edited world already lives, under the world the settings now hold, over the world\'s own rows as the canvas left them');
    assert.ok(save.indexOf('chooseSetting(') < save.indexOf('keepBuiltWorld('),
        'which is read after the canvas\'s world is chosen there');
    assert.match(save, /return this\.flightWorldKey\(\) !== before;/, 'and says whether the flight\'s world changed');
});

test('a click with a tool that drops picks the ground and drops there', () => {
    const drop = methodBody(mainSource, 'dropAt');
    assert.match(drop, /const point = this\.pickCanvasPoint\(e\.clientX, e\.clientY\);\s*if \(!point \|\| !dropDraft\(this\.builder, point, \{ size: this\.terrain\.size \}\)\) return;/,
        'with the canvas\'s width, which a selection it is clipped to repeats at');
    assert.match(drop, /this\.redrawCanvas\(\);\s*this\.syncOverlays\(\);/, 'and the ground is drawn with it');
    assert.match(methodBody(mainSource, 'syncOverlays'),
        /this\.renderer\.domElement\.style\.cursor = canvas \? this\.canvasCursor\(\) : '';/,
        'over ground marked as somewhere to click');
    assert.match(methodBody(mainSource, 'canvasCursor'),
        /const tool = buildModeTool\(this\.builder\);\s*if \(eyeDropperArmed\(this\.builder\)\) return 'cell';\s*if \(dropsAtClick\(tool\) \|\| tool === LASSO_PALETTE_TOOL \|\| isStrokeTool\(tool\) \|\| insertsTemplate\(tool\) \|\| extrudeDrawing\(this\.builder\)\) return 'crosshair';/,
        'which is a crosshair for a tool that drops, and for the lasso and the stroke tools, which draw on it - and a cell while the eye dropper is armed');
});

// --- Picking a built element, and the outline over it ---------------------------

/**
 * Select's left drag orbits, so a click is a press that orbits nowhere. The
 * press is held as one that may yet be a click, the view does not turn until
 * it travels past one, and a release before then picks - so an orbit never
 * ends by picking whatever the pointer stopped over, and a click never nudges
 * the view.
 */
test('a Select press that does not travel is a click, and picks; one that travels orbits', () => {
    const press = methodBody(mainSource, 'onCanvasPress');
    assert.match(press, /picks: tool === SELECT_TOOL && e\.button === 0 && !e\.shiftKey,/,
        'a plain main-button press with Select live may yet be a click');
    assert.match(press, /start: \{ x: e\.clientX, y: e\.clientY \},/, 'measured from where it began');
    assert.match(press, /travelled: false/);

    const drag = methodBody(mainSource, 'onCanvasDrag');
    assert.match(drag,
        /if \(drag\.picks && !drag\.travelled\) \{\s*if \(!travelledPast\(drag\.start, \{ x: e\.clientX, y: e\.clientY \}, drag\.type\)\) return;\s*drag\.travelled = true;\s*\}/,
        'the view does not turn until the press has travelled past a click');
    assert.ok(drag.indexOf('this.canvasPointer = ') < drag.indexOf('const drag = this.canvasDrag;'),
        'and every move over the canvas is where the hover is read from, drag or not');

    const release = methodBody(mainSource, 'onCanvasRelease');
    assert.match(release, /const click = e\.type === 'pointerup' && drag\.picks && !drag\.travelled;/,
        'only a press let go of, not one cancelled or taken away, is a click');
    assert.ok(release.indexOf('this.endCanvasDrag();') < release.indexOf('if (click) this.pickAt(e.clientX, e.clientY);'),
        'and it picks once the drag is over');
});

test('a click picks the committed placement under it through its reach, not off the scene', () => {
    const pick = methodBody(mainSource, 'pickAt');
    assert.match(pick, /const point = this\.pickCanvasPoint\(clientX, clientY\);/);
    assert.match(pick,
        /placementAt\(pickablePlacements\(this\.builder\), point\.x, point\.z, this\.terrain\.size\) : null;/,
        'the placement whose reach the ground point is in, or bare ground');
    assert.match(pick, /const answer = selectPlacement\(this\.builder, index\);/);
    assert.match(pick, /if \(answer\?\.confirm\) this\.confirmOpened\(\);/, 'a changed pick asks before it is let go');
});

test('the hover follows the pointer every frame, with Select, and never for a finger or under a question', () => {
    assert.match(methodBody(mainSource, 'trackCanvasCamera'), /this\.trackHover\(\);/,
        'read every frame, since the view moving under a still pointer moves the ground under it');

    const hover = methodBody(mainSource, 'trackHover');
    assert.match(hover, /pointer\.type !== 'touch'/, 'a finger has no hover');
    assert.match(hover, /buildModeTool\(this\.builder\) === SELECT_TOOL/, 'Select is what a click picks with');
    assert.match(hover, /!confirmOpen\(this\.builder\)/, 'a question holds the canvas still');
    assert.match(hover, /!dragging/, 'and an orbit is not a hover');
    assert.match(hover, /placementAt\(pickablePlacements\(this\.builder\), point\.x, point\.z, this\.terrain\.size\)/,
        'found the way a click finds it, so what is outlined is what a click takes');

    assert.match(mainSource, /surface\.addEventListener\('pointerleave', +\(\) => \{ this\.canvasPointer = null; \}\);/,
        'and a pointer gone off the canvas hovers over nothing');
    const leaving = methodBody(mainSource, 'leaveBuilder');
    assert.match(leaving, /this\.canvasPointer = null;\s*this\.hovered = null;/, 'nor does a hover outlive the canvas');
});

test('the outlines are drawn over each frame, the hover lightly and the edit in hand firmly', () => {
    const frame = methodBody(mainSource, 'animate');
    assert.ok(frame.indexOf('this.renderer.render(this.scene, this.camera);') < frame.indexOf('this.drawBuildOverlay();'),
        'after the frame is drawn, through the camera it was drawn from');

    const draw = methodBody(mainSource, 'drawBuildOverlay');
    assert.match(draw, /if \(!buildModeDrawing\(this\.builder\) \|\| photoPending\(this\.photoState\)\)/,
        'nothing off a canvas, and nothing over a picture');
    assert.match(draw, /this\.hovered !== picked/, 'the placement picked is outlined as picked, not as hovered');
    assert.match(draw, /const chosen  = buildDraft\(this\.builder\);/, 'the edit in hand, picked or dropped');
    assert.match(draw, /strokeOutline\(ctx, this\.screenOutline\(hovered, width, height\), HOVER_OUTLINE\)/);
    assert.match(draw, /strokeOutline\(ctx, this\.screenOutline\(chosen, width, height\), CHOSEN_OUTLINE\)/);

    const traced = methodBody(mainSource, 'outlineOf');
    assert.match(traced, /segments = placementOutline\(placement, size\);/,
        'traced round the placement\'s reach');
    assert.match(traced, /this\.outlines\.get\(key\)/, 'once, rather than once a frame');

    assert.match(methodBody(mainSource, 'screenOutline'), /this\.terrain\.getTerrainHeightAt\(x, z\)/,
        'stood on the ground under it, so it lies over the terrain');
});

test('the overlay is a layer over the ground that takes no presses', () => {
    assert.match(indexHtml, /<canvas id="build-overlay" aria-hidden="true"><\/canvas>/);
    const rule = indexHtml.match(/#build-overlay \{[^}]*\}/)?.[0] ?? '';
    assert.match(rule, /pointer-events: none;/, 'a click on an outline is a click on the ground under it');
    assert.match(rule, /z-index: 110;/, 'over the ground and under the palette, the dock and the list');

    const palette = indexHtml.match(/#build-palette \{[^}]*\}/)?.[0] ?? '';
    assert.ok(Number(palette.match(/z-index: (\d+)/)?.[1]) > 110);
    assert.match(methodBody(mainSource, 'syncOverlays'), /this\.overlays\.buildOverlay\.style\.display = canvas \? 'block' : 'none';/);
});

test('Select marks a placement it would pick, and a dropping tool its ground', () => {
    const cursor = methodBody(mainSource, 'canvasCursor');
    assert.match(cursor, /return this\.hovered != null \? 'pointer' : '';/);
});

// --- Back to the built world -------------------------------------------------------

test('the builder reopens on the canvas it drew, through the one drawing a START uses', () => {
    const show = methodBody(mainSource, 'showCanvas');
    assert.ok(show, 'js/main.js should define showCanvas()');
    assert.match(methodBody(mainSource, 'startCanvas'), /this\.showCanvas\(environmentId\);/);
    assert.match(methodBody(mainSource, 'openBuilder'), /this\.showCanvas\(this\.builder\.environment\);/);
});

/**
 * Blank Canvas is a world the builder offers and the settings do not, so the
 * flight cannot read a build kept on it off the settings: it would fly the
 * build over the ground the settings hold instead.
 */
test('a free flight is drawn on the world a build was kept on', () => {
    assert.match(methodBody(mainSource, 'buildWorld'),
        /environment: flownEnvironment\(this\.editor, currentEnvironment\(this\.settings\)\),/);
    assert.match(methodBody(mainSource, 'flightWorldKey'),
        /environment: flownEnvironment\(this\.editor, currentEnvironment\(this\.settings\)\),/,
        'and the world a kept build is compared against is the same one');
});

/**
 * A pick changed on the dock - or stepped back to what it was - turns what the
 * accept tile and Escape will ask, so the palette is drawn with the dock. Found
 * in Chromium: drawing the dock alone left the tile saying Save and exit over a
 * changed mountain until something else redrew it.
 */
test('a value changed on the edit in hand redraws the palette, so the accept tile says what it will ask', () => {
    const apply = methodBody(mainSource, 'applyDockValue');
    assert.match(apply,
        /reviseDraft\(this\.builder, \{ config: holder\.config \}\);\s*this\.redrawCanvas\(\);[\s\S]*?this\.syncOverlays\(\);\s*return;/);
});

// --- The gumball, and Select showing what is selected ------------------------------

/**
 * A press on a handle is the edit in hand's, whichever tool is live, so it is
 * asked before the press can become an orbit, a pick or a drop - with Mountain
 * live, a press on the gumball must drag the handle rather than put the
 * mountain down under it.
 */
test('a press on a gumball handle drags it before anything else can take the press', () => {
    const press = methodBody(mainSource, 'onCanvasPress');
    const hit = press.indexOf('gumballHit(this.gumball, e.clientX, e.clientY)');
    assert.ok(hit >= 0 && hit < press.indexOf('cameraGesture(e, tool)'), 'before the camera');
    assert.ok(hit < press.indexOf('this.dropAt(e)'), 'and before a drop');
    assert.match(press,
        /const handle = e\.button === 0 \? gumballHit\(this\.gumball, e\.clientX, e\.clientY\) : null;\s*if \(handle != null\) \{\s*e\.preventDefault\(\);\s*const pressed = pressHandle\(handle, e\);\s*if \(pressed\) this\.beginGumballDrag\(e, pressed\);\s*return;\s*\}/,
        'any main-button press on a handle is the gumball\'s, and one refused - ctrl on the centre - does nothing');

    const begin = methodBody(mainSource, 'beginGumballDrag');
    assert.match(begin, /grab: structuredClone\(draft\),/, 'from the edit as it stood at the press');
    assert.match(begin, /setPointerCapture\(e\.pointerId\)/);
});

test('a handle dragged writes the drag as a whole, through the holder the dock steps', () => {
    assert.match(methodBody(mainSource, 'onCanvasDrag'),
        /if \(this\.gumballDrag && e\.pointerId === this\.gumballDrag\.pointer\) \{\s*this\.dragGumball\(e\);\s*return;/);

    const drag = methodBody(mainSource, 'dragGumball');
    assert.match(drag, /dragHandle\(drag\.grab, drag\.handle, \{/, 'worked out from the grab');
    assert.match(drag, /along: alongAxis\(drag\.layout, drag\.handle, drag\.start, now\)/);
    assert.match(drag, /turn: sweepAround\(drag\.layout\.centre, drag\.start, now\)/);

    const write = methodBody(mainSource, 'writeGumball');
    assert.match(write, /holder\.config\[name\] = structuredClone\(value\)/, 'a declared range into the holder');
    assert.match(write, /reviseDraft\(this\.builder, \{\s*config: \{ \.\.\.\(holder\?\.config \?\? \{\}\), \.\.\.written \},/,
        'and from it into the edit, the dock\'s own door');
    assert.match(write, /this\.groundStale = true;\s*this\.syncOverlays\(\);/, 'the dock\'s figures following at once');
});

test('the ground under a drag catches up at a pace, and once more when it ends', () => {
    assert.match(mainSource, /const GROUND_REDRAW_MS = \d+;/);
    assert.match(methodBody(mainSource, 'trackCanvasCamera'),
        /if \(this\.groundStale && !this\.gumballDrag\?\.preview && performance\.now\(\) - this\.groundDrawnAt >= GROUND_REDRAW_MS\) this\.redrawCanvas\(\);/,
        'save under an extrusion being pulled up, which is previewed and drawn on release');
    assert.match(methodBody(mainSource, 'redrawCanvas'), /this\.groundStale = false;\s*this\.groundDrawnAt = performance\.now\(\);/);

    assert.match(methodBody(mainSource, 'onCanvasRelease'),
        /if \(this\.gumballDrag && e\.pointerId === this\.gumballDrag\.pointer\) \{\s*this\.endGumballDrag\(\);\s*return;/);
    assert.match(methodBody(mainSource, 'endGumballDrag'), /if \(redraw && this\.groundStale\) this\.redrawCanvas\(\);/);
    assert.match(methodBody(mainSource, 'leaveBuilder'), /this\.endGumballDrag\(false\);/,
        'and leaving drops a drag without drawing a canvas that is going');
});

test('the gumball is drawn on the edit in hand, lying in the scene, with only its bound handles', () => {
    const draw = methodBody(mainSource, 'drawBuildOverlay');
    assert.match(draw, /this\.gumball = held \? this\.gumballFor\(chosen, width, height\) : null;/,
        'on whatever is in hand, picked or dropped');
    assert.match(draw, /const held = chosen && \(!extruding \|\| buildDraft\(this\.builder\) == null \|\| stage === EXTRUDE_EXTRUDING \|\| this\.builder\.draft\?\.replaces != null\);/,
        'and on Extrude\'s draft only while it is being pulled up');
    assert.match(draw, /strokeGumball\(ctx, this\.gumball, this\.gumballDrag\?\.handle \?\? this\.gumballHover\)/);

    const laid = methodBody(mainSource, 'gumballFor');
    assert.match(laid, /const handles = boundHandles\(placement\);/);
    assert.match(laid, /for \(const \[name, direction\] of Object\.entries\(GUMBALL_AXES\)\)/, 'its axes projected from the camera');
    assert.match(laid, /return gumballLayout\(middle, axes, handles\);/);
});

test('a handle under the pointer is lit and comes before what is on the ground under it', () => {
    const hover = methodBody(mainSource, 'trackHover');
    assert.match(hover, /const handle = looking \? gumballHit\(this\.gumball, pointer\.x, pointer\.y\) : null;/);
    assert.match(hover, /if \(looking && handle == null && buildModeTool/, 'a placement is looked for only off the gumball');

    const cursor = methodBody(mainSource, 'canvasCursor');
    assert.match(cursor, /if \(this\.gumballDrag != null \|\| cameraHeld\(this\.builder\)\) return 'grabbing';\s*if \(this\.gumballHover != null\) return 'grab';/,
        'grabbing while a handle is dragged, or the view is panned from inside a tool');
});

test('Select\'s panel draws each section\'s rows against its own holder, and folds the world\'s elements', () => {
    assert.match(methodBody(mainSource, 'syncDock'), /open: \[\.\.\.this\.worldOpen\]/);

    const holder = methodBody(mainSource, 'dockHolder');
    assert.match(holder, /if \(!entry\.section\) return shown\.holder;/);
    assert.match(holder, /shown\.sections\?\.find\(section => section\.id === entry\.section\)\?\.holder/);
    assert.match(methodBody(mainSource, 'onDockStep'), /const holder = this\.dockHolder\(entry\);/);

    const apply = methodBody(mainSource, 'applyDockValue');
    assert.match(apply, /if \(kind === DOCK_WORLD\) \{\s*this\.redrawCanvas\(\);/, 'an element of the world stepped is the ground drawn again');

    assert.match(methodBody(mainSource, 'onDockFold'), /this\.worldOpen\.(add|delete)\(section\.index\)/);
    assert.match(methodBody(mainSource, 'showCanvas'), /this\.worldOpen\.clear\(\);/, 'every canvas opens with them folded');
});

test('the dock draws a heading for each section, and a folding one is a button that says which way it is', () => {
    assert.match(panelViewSource, /const heading = document\.createElement\(section\.folds \? 'button' : 'h4'\);/);
    assert.match(panelViewSource, /heading\.setAttribute\('aria-expanded', String\(Boolean\(section\.open\)\)\);/);
    assert.match(panelViewSource, /if \(button\.dataset\.section\) \{\s*this\.handlers\.onFold\?\.\(button\.dataset\.section\);/);
    assert.match(mainSource, /onFold: +\(id\) => this\.onDockFold\(id\)/);

    const rule = indexHtml.match(/button\.dock-section \{[^}]*\}/)?.[0] ?? '';
    assert.match(rule, /min-height: 30px;/, 'tall enough for a fingertip');
});

/**
 * Found in Chromium: a press on the centre that wobbled three pixels moved the
 * picked mountain, which made the pick a changed one, so the next click on
 * bare ground asked ACCEPT EDITS about an edit nobody meant. A handle keeps to
 * the rule a click keeps to.
 */
test('a handle writes nothing until its press has travelled further than a click may', () => {
    const drag = methodBody(mainSource, 'dragGumball');
    assert.match(drag, /if \(!drag\.travelled\) \{\s*if \(!travelledPast\(drag\.start, now, drag\.type\)\) return;\s*drag\.travelled = true;\s*\}/);
    assert.ok(drag.indexOf('travelledPast(') < drag.indexOf('dragHandle('), 'before anything is worked out');
    assert.match(methodBody(mainSource, 'beginGumballDrag'), /type: e\.pointerType,\s*travelled: false/);
});

// --- The art on the palette and the picker ------------------------------------------

/**
 * Every Illustrator export carries the same ids and class names, so the marks
 * are referenced as images rather than written into the page: an image is its
 * own document, and nothing in it collides with anything outside it.
 */
test('each tile carries its tool\'s mark as an image, and its name where a pointer and a reader find it', () => {
    const drawn = methodBody(mainSource, 'drawPalette');
    assert.match(drawn, /tile\.append\(markImage\(toolMark\(tool\.id\)\)\);/);
    assert.match(drawn, /tile\.setAttribute\('aria-label', toolName\(tool\.id\)\);/);
    assert.match(drawn, /tile\.title = `\$\{toolName\(tool\.id\)\} - \$\{tool\.hint\}`;/);
    assert.doesNotMatch(drawn, /tile\.textContent/, 'the name moved off the face of the tile onto its title and label');

    const image = mainSource.match(/function markImage\(src\) \{[\s\S]*?\n\}/)?.[0] ?? '';
    assert.match(image, /document\.createElement\('img'\)/, 'an image, never the drawing written into the page');
    assert.match(image, /image\.alt = '';/, 'and silent, the button around it being named');
});

test('the palette is headed by the chevrons that fold it away, which are no tool', () => {
    const drawn = methodBody(mainSource, 'drawPalette');
    assert.ok(drawn.indexOf("fold.dataset.palette = 'fold';") < drawn.indexOf('for (const tool of paletteTools())'), 'first, across the head');
    assert.match(drawn, /fold\.append\(markImage\(PALETTE_FOLD_MARK\)\);/);
    assert.match(drawn, /this\.onPaletteFold\(\);/);
    assert.match(methodBody(mainSource, 'onPaletteFold'), /togglePalette\(this\.paletteState\);\s*this\.syncOverlays\(\);/);

    const sync = methodBody(mainSource, 'syncOverlays');
    assert.match(sync, /this\.overlays\.palette\.classList\.toggle\('folded', folded\);/);
    assert.match(sync, /if \(tile\.dataset\.palette === 'fold'\) \{[\s\S]*?tile\.setAttribute\('aria-expanded', String\(!folded\)\);\s*continue;\s*\}/,
        'saying which way it goes, and never lit as a live tool');
    assert.match(mainSource, /this\.paletteState += createPaletteState\(defaultStorage\(\)\);/, 'and the choice kept for the next canvas');
});

test('folded, the palette is its tab and nothing else, and the art turned in heads it open', () => {
    assert.ok(styled(indexHtml, '#build-palette.folded button[data-tool]', /display:\s*none;/), 'the tools go');
    assert.ok(styled(indexHtml, '#build-palette.folded', /background:\s*none;/), 'and the column with them');
    assert.ok(styled(indexHtml, '#build-palette .palette-fold img', /transform:\s*scaleX\(-1\);/), 'open, the chevrons point in');
    assert.ok(styled(indexHtml, '#build-palette.folded .palette-fold img', /transform:\s*none;/), 'folded, out');
});

test('every canvas\'s card is headed by its picture, and the card under the cursor keeps it in its band', async () => {
    const { cardThumbnail } = await import('../js/build-picker.js');
    const { BUILDER_ENVIRONMENTS } = await import('../js/environment/presets.js');
    for (const environment of BUILDER_ENVIRONMENTS) {
        assert.ok(styled(indexHtml, `#build-picker-cards li[data-entry="${environment.id}"]`,
            new RegExp(`background-image:\\s*url\\('${cardThumbnail(environment.id).replace(/[.]/g, '\\.')}'\\)`)),
            `${environment.id}'s card names its thumbnail`);
    }

    const rules = styleRules(indexHtml);
    const cursor = rules.findIndex(rule => rule.selectors.includes('#build-picker-cards li.selected'));
    const band = rules.findIndex(rule => rule.selectors.includes('#build-picker-cards li[data-entry]'));
    assert.ok(cursor >= 0 && band > cursor, 'the band is written after the cursor\'s rule, which sets the background whole');
    assert.deepEqual(specificity('#build-picker-cards li[data-entry]'), specificity('#build-picker-cards li.selected'),
        'and weighs what it weighs, so it is the later that wins');
    assert.match(rules[band].body, /background-size:\s*calc\(100% - 12px\) 64px;/);
});

/**
 * Found on a phone in Chromium: the palette grew when its tiles became marks,
 * and the control list, pinned a fixed distance down the screen under it, came
 * to lie over the tick - the way out a finger has. On a narrow screen the list
 * sits beside the palette instead, past its right edge however tall it grows.
 */
test('on a narrow screen the control list lies beside the palette, clear of every tile', () => {
    const px = (body, name) => Number(body.match(new RegExp(`(?:^|[\\s;])${name}:\\s*(-?\\d+)px`))?.[1]);
    const palette = styleRule(indexHtml, 'build-palette');
    const tile = styleRule(indexHtml, 'build-palette button[data-tool]');
    const columns = Number(palette.match(/grid-template-columns:\s*repeat\((\d+),/)?.[1]);
    const padding = Number(palette.match(/padding:\s*\S+ (\d+)px/)?.[1]);
    const border = Number(palette.match(/border:\s*(\d+)px/)?.[1]);
    const right = px(palette, 'left') + columns * px(tile, 'width') + (columns - 1) * px(palette, 'gap') + 2 * padding + 2 * border;
    assert.ok(Number.isFinite(right) && right > 100, `the palette's right edge reads as ${right}`);

    const narrow = styleRules(indexHtml).filter(rule => rule.nested && rule.selectors.includes('#build-help'));
    const beside = narrow.find(rule => /top:\s*20px/.test(rule.body));
    assert.ok(beside, 'the narrow screen\'s rule puts the list up at the top, beside the palette');
    assert.ok(px(beside.body, 'left') > right, `starting past the palette's right edge at ${right}: ${px(beside.body, 'left')}`);
    assert.match(beside.body, /overflow-y:\s*auto;/, 'and scrolling rather than running down into the dock');
});

// --- The lasso, the selection and the clip -------------------------------------------

test('a drag with the lasso draws a shape, and only letting go of it makes the selection', () => {
    const press = methodBody(mainSource, 'lassoPress');
    assert.match(press, /const ground = this\.pickCanvasPoint\(e\.clientX, e\.clientY\);/);
    assert.match(press, /if \(ground == null\) return;\s*this\.renderer\.domElement\.setPointerCapture\(e\.pointerId\);/,
        'a drag begun over the sky begins nothing, and one begun on the ground keeps the pointer');

    const drag = methodBody(mainSource, 'dragLasso');
    assert.match(drag, /if \(Math\.hypot\(screen\.x - drawing\.last\.x, screen\.y - drawing\.last\.y\) < LASSO_SAMPLE_PIXELS\) return;/,
        'a free shape gathers a point every few pixels it travels');
    assert.match(drag, /drawing\.points = \[drawing\.points\[0\], ground\];/, 'a box spans from the press to the pointer');

    const release = methodBody(mainSource, 'onCanvasRelease');
    assert.match(release, /if \(e\.type === 'pointerup' && drawn\.travelled\) this\.finishLasso\(drawn\);/,
        'cancelled or taken away, a drag makes no selection - and nor does one that never travelled past a click');

    // Found in Chromium: with the camera far off, a three-pixel slip spans
    // more ground than the least region measures, so a box was selected by
    // it. A drag keeps the rule every press keeps, in screen pixels.
    assert.match(drag, /if \(!drawing\.travelled\) \{\s*if \(!travelledPast\(drawing\.start, screen, drawing\.type\)\) return;\s*drawing\.travelled = true;\s*\}/,
        'a drag gathers nothing until it has travelled further than a click may');
    assert.ok(drag.indexOf('travelledPast(') < drag.indexOf('this.pickCanvasPoint('), 'before the ground is even read');

    const finish = methodBody(mainSource, 'finishLasso');
    assert.match(finish, /const footprint = shapeFootprint\(shape, points, this\.shapeValues\(mode\), \{ square \}\);\s*if \(footprint && mode === LASSO_PALETTE_TOOL\) drawIntoSelection\(this\.builder, footprint, op, \{ tool, size: this\.terrain\.size \}\);/,
        'drawn into the selection by the op its press latched');
    assert.match(finish, /else if \(footprint && isExtrudeTool\(mode\)\) drawExtrudeShape\(this\.builder, footprint, op, \{ size: this\.terrain\.size \}\);/,
        'or with Extrude, into the region it will lift');
});

test('a click-per-vertex tool places a point a click, and closes on the first or the last again', () => {
    const press = methodBody(mainSource, 'lassoPress');
    assert.match(press, /const shape = clickVertex\(drawing, ground, screen\);\s*if \(shape\.closed\) \{\s*this\.cancelLasso\(\);\s*this\.lassoClosed = [^;]+;\s*this\.finishLasso\(\{ mode, tool: tool\.id, shape: tool\.shape, points: shape\.points, op: drawing\?\.op \?\? op, square: false \}\);/);
    assert.match(press, /const drawing = this\.lassoDrawing\?\.tool === tool\.id \? this\.lassoDrawing : null;/,
        'a shape half drawn with another tool is not carried on with this one');
});

test('a shape half drawn is let go by Escape, a tool change, a question and leaving', () => {
    assert.match(methodBody(mainSource, 'onBuilderKey'), /this\.cancelLasso\(\);\s*this\.cancelStroke\(\);\s*return;/);
    assert.match(methodBody(mainSource, 'onPaletteClick'), /if \(buildModeTool\(this\.builder\) !== this\.lassoDrawing\?\.mode\) this\.cancelLasso\(\);/,
        'a shape half drawn with the lasso or with Extrude, by a tool other than the one it was begun with');
    assert.match(methodBody(mainSource, 'confirmOpened'), /this\.cancelLasso\(\);/);
    assert.match(methodBody(mainSource, 'leaveBuilder'), /this\.cancelLasso\(\);/);
    assert.match(methodBody(mainSource, 'onDockShape'), /if \(!chooseLassoTool\(this\.builder, id\)\) return;\s*this\.cancelLasso\(\);/);
});

test('the selection is drawn dashed on the ground whatever tool is live, and the shape being drawn solid', () => {
    const draw = methodBody(mainSource, 'drawBuildOverlay');
    assert.match(draw, /const edge = contoured\(selection\)\s*\? this\.screenRuns\(this\.selectionEdges\(selection\), width, height\)\s*: this\.screenRegion\(footprintLoop\(selection\), true, width, height\);\s*strokePaths\(ctx, edge, extruding \? EXTRUDE_REGION : SELECTION_OUTLINE\);/,
        'a shape\'s own outline, or a combined selection\'s traced edge - solid red in Extrude, where it is what is lifted');
    assert.match(draw, /if \(drawing\) strokePaths\(ctx, this\.screenRegion\(drawing\.points, drawing\.closed, width, height\), DRAWING_OUTLINE\);/);
    assert.ok(draw.indexOf('SELECTION_OUTLINE') < draw.indexOf('HOVER_OUTLINE'), 'under the outlines and the gumball');

    const region = methodBody(mainSource, 'screenRegion');
    assert.match(region, /canvasPieces\(subdividePath\(points, PATH_STEP, closed\), this\.terrain\.size\)/,
        'stood on the ground every few metres, and carried across the seams');
    assert.match(region, /return this\.screenRuns\(/);
    assert.match(methodBody(mainSource, 'screenRuns'), /this\.terrain\.getTerrainHeightAt\(x, z\)/);
});

test('the lasso\'s panel picks its tool, keeps its fields, and drops the selection', () => {
    assert.match(mainSource, /onShape: +\(id\) => this\.onDockShape\(id\)/);
    assert.match(methodBody(mainSource, 'applyDockValue'), /if \(kind === DOCK_LASSO\) \{\s*setLassoValues\(this\.builder, holder\.config\);/);
    assert.match(methodBody(mainSource, 'onDockAction'), /if \(id === DOCK_DESELECT\.id\) \{\s*if \(deselect\(this\.builder\)\) this\.syncOverlays\(\);\s*return;/);
    assert.match(panelViewSource, /if \(button\.dataset\.shape\) \{\s*this\.handlers\.onShape\?\.\(button\.dataset\.shape\);/);
    assert.match(panelViewSource, /mark\.src = tool\.art;\s*mark\.alt = '';/, 'each tile its icon cut from the art, its name beside it');
});

test('a press with the lasso draws, never orbits, and the cursor says so', () => {
    const press = methodBody(mainSource, 'onCanvasPress');
    assert.match(press, /else if \(e\.button === 0 && \(tool === LASSO_PALETTE_TOOL \|\| extrudeDrawing\(this\.builder\)\)\) this\.lassoPress\(e\);/,
        'shift and alt included, which are how a shape meets the selection');
    assert.match(methodBody(mainSource, 'canvasCursor'), /tool === LASSO_PALETTE_TOOL \|\| isStrokeTool\(tool\) \|\| insertsTemplate\(tool\) \|\| extrudeDrawing\(this\.builder\)\) return 'crosshair';/);
});

test('the lasso\'s tiles and its deselect are drawn as the artwork draws them', () => {
    assert.ok(styled(indexHtml, '.dock-action[data-action="deselect"]', /background:\s*#87ceeb;/), 'a pale blue pill');
    assert.ok(styled(indexHtml, '.dock-shape', /background:\s*#061d43;/), 'tiles on the art\'s navy');
    assert.ok(styled(indexHtml, '.dock-shape[aria-pressed="true"]', /box-shadow:\s*0 0 0 3px #90c090;/), 'the chosen one ringed in its green');
    assert.ok(styled(indexHtml, '.dock-shape img', /object-fit:\s*contain;/), 'each icon kept to its own box');
});

/**
 * Found in Chromium: the double click that closes a click-per-vertex shape is
 * two presses, and the second, landing after the shape was closed, began the
 * next one. It is swallowed as the rest of the same double click.
 */
test('the second press of the double click that closed a shape starts nothing', () => {
    const press = methodBody(mainSource, 'lassoPress');
    assert.ok(press.indexOf('const closed = this.lassoClosed;') < press.indexOf('clickVertex('), 'asked before a point is placed');
    assert.match(press, /closed && performance\.now\(\) - closed\.time < DOUBLE_CLICK_MS\s*&& Math\.hypot\(screen\.x - closed\.x, screen\.y - closed\.y\) <= CLOSE_PIXELS\) return;/);
    assert.match(press, /this\.lassoClosed = \{ \.\.\.screen, time: performance\.now\(\) \};/, 'remembered as the shape closes');
    assert.match(mainSource, /const DOUBLE_CLICK_MS = \d+;/);
});

// --- Shapes against a selection ----------------------------------------------------

test('how a shape meets the selection is read once, at its press, and a shape of clicks keeps its first', () => {
    const press = methodBody(mainSource, 'lassoPress');
    assert.match(press, /const op = lassoOp\(e, selectionLive\(this\.builder\)\);/);
    assert.ok(press.indexOf('const op = lassoOp(') < press.indexOf('tool.gesture === LASSO_CLICKS'), 'before either gesture is begun');
    assert.match(press, /op, shiftUp: !e\.shiftKey, square: false/, 'a drag carries it, and whether shift was down at the press');
    assert.match(press, /op: drawing\?\.op \?\? op/, 'a shape of clicks keeps the op its first click latched');
});

test('shift pressed again in a drag keeps the shape square, and the shape is drawn as it will come out', () => {
    assert.match(methodBody(mainSource, 'dragLasso'), /Object\.assign\(drawing, squareInDrag\(drawing, e\.shiftKey\)\);/);
    assert.match(methodBody(mainSource, 'lassoDrawingPath'), /shapeFootprint\(drawing\.shape, drawing\.points, this\.shapeValues\(drawing\.mode\), \{ square: drawing\.square \}\)/);
    assert.match(methodBody(mainSource, 'lassoDrawingPath'), /if \(tool\?\.kind === 'path' && points\.length >= 3\) \{\s*return \{ points: flattenPath\(\{ kind: 'path', points, closed: false \}\), closed: false \};/,
        'a curve drawn as the curve it will be, left open until it is closed');
});

test('a combined selection is traced once and kept, not traced every frame', () => {
    const edges = methodBody(mainSource, 'selectionEdges');
    assert.match(edges, /if \(this\.selectionTrace\?\.key !== key\) this\.selectionTrace = \{ key, runs: regionEdges\(selection, this\.terrain\.size\) \};/);
    assert.match(edges, /const key = `\$\{this\.terrain\.size\}:\$\{JSON\.stringify\(selection\)\}`;/);
});

test('alt is the builder\'s on a canvas, pressed and let go, so the window\'s menu never takes the focus from it', () => {
    assert.match(mainSource, /const CANVAS_SWALLOWED_KEYS = \['AltLeft', 'AltRight'\];/);
    const key = methodBody(mainSource, 'onBuilderKey');
    assert.match(key, /^\{\s*\/\/[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*if \(buildModeDrawing\(this\.builder\) && CANVAS_SWALLOWED_KEYS\.includes\(e\.code\)\) \{\s*e\.preventDefault\(\);\s*return;/,
        'ahead of everything else the builder reads');
    assert.match(mainSource, /this\.buildKeys\.delete\(e\.code\);\s*if \(buildModeDrawing\(this\.builder\) && CANVAS_SWALLOWED_KEYS\.includes\(e\.code\)\) e\.preventDefault\(\);/,
        'and on the way back up, where some browsers act on it');
});

// --- The cover tool ----------------------------------------------------------------

test('a cover stroke begins at the ground under the press, owns the pointer, and reads the scale there', () => {
    const press = methodBody(mainSource, 'strokePress');
    assert.match(press, /const ground = this\.pickCanvasPoint\(e\.clientX, e\.clientY\);\s*if \(ground == null\) return;/,
        'a press over the sky begins nothing');
    assert.match(press, /surface\.setPointerCapture\(e\.pointerId\);/, 'so a stroke over the palette stays the stroke');
    assert.match(press, /scale: unitsPerPixel\(distance, this\.camera\.fov, surface\.clientHeight\)/,
        'what a pixel spans where it was pressed, which the stamp is laid at');
});

test('a stroke gathers the ground every few pixels, each sample stood on the ground as it is taken', () => {
    assert.match(mainSource, /const STROKE_SAMPLE_PIXELS = 6;/);
    const drag = methodBody(mainSource, 'dragStroke');
    assert.match(drag, /if \(Math\.hypot\(screen\.x - drawing\.last\.x, screen\.y - drawing\.last\.y\) < STROKE_SAMPLE_PIXELS\) return;/);
    assert.match(drag, /const ground = this\.pickCanvasPoint\(screen\.x, screen\.y\);\s*if \(ground == null\) return;\s*drawing\.points\.push\(\[ground\.x, ground\.z\]\);/);
    assert.match(methodBody(mainSource, 'onCanvasDrag'),
        /if \(this\.strokeDrawing && e\.pointerId === this\.strokeDrawing\.pointer\) \{\s*this\.dragStroke\(e\);\s*return;/);
});

test('a stroke let go of is laid with the brush at the press\'s scale; cancelled or taken away, it is not', () => {
    assert.match(methodBody(mainSource, 'onCanvasRelease'),
        /if \(this\.strokeDrawing && e\.pointerId === this\.strokeDrawing\.pointer\) \{[^}]*const drawn = this\.strokeDrawing;\s*this\.cancelStroke\(\);\s*if \(e\.type === 'pointerup'\) this\.finishStroke\(drawn\);/);
    const finish = methodBody(mainSource, 'finishStroke');
    assert.match(finish, /if \(drawn\.tool !== buildModeTool\(this\.builder\)\) return;/, 'a stroke of a tool no longer live lays nothing');
    assert.match(finish, /const stamp = strokeStamp\(buildTool\(drawn\.tool\), strokeValues\(this\.builder\), drawn\.scale\);/,
        'the stamp of the tool that drew it, the cover tool\'s or the paint brush\'s');
    assert.match(finish, /if \(!layStroke\(this\.builder, drawn\.points, stamp, \{ size: this\.terrain\.size, alt: drawn\.alt \}\)\) return;\s*this\.redrawCanvas\(\);/,
        'and the ground drawn again only for a stroke that was laid');
});

test('a stroke half laid is let go by Escape, a question, a tool change and leaving', () => {
    assert.match(methodBody(mainSource, 'onPaletteClick'), /if \(buildModeTool\(this\.builder\) !== this\.strokeDrawing\?\.tool\) this\.cancelStroke\(\);/);
    assert.match(methodBody(mainSource, 'leaveBuilder'), /this\.cancelStroke\(\);/);
    assert.match(methodBody(mainSource, 'cancelStroke'), /if \(surface\.hasPointerCapture\?\.\(drawing\.pointer\)\) surface\.releasePointerCapture\(drawing\.pointer\);/);
});

test('the cover tool\'s panel has a holder of its own, kept while the tool is live', () => {
    assert.match(methodBody(mainSource, 'syncDock'),
        /holder: isStrokeTool\(buildModeTool\(this\.builder\)\) \? this\.currentStrokeHolder\(\) : this\.currentDraftHolder\(\),/);
    const holder = methodBody(mainSource, 'currentStrokeHolder');
    assert.match(holder, /if \(this\.strokeHolder\?\.tool !== tool\) this\.strokeHolder = \{ tool, \.\.\.strokeHolderFor\(this\.builder, tool\) \};/);
    assert.match(methodBody(mainSource, 'showCanvas'), /this\.strokeHolder = null;/, 'and made again for a new canvas');
});

test('a row of the cover tool\'s panel is kept, and the ground drawn again only when the batch in hand changed', () => {
    const apply = methodBody(mainSource, 'applyDockValue');
    assert.match(apply, /if \(kind === DOCK_COVER \|\| kind === DOCK_PAINT \|\| kind === DOCK_ERASE\) \{\s*if \(setStrokeValues\(this\.builder, holder\.config\)\) \{\s*this\.redrawCanvas\(\);\s*this\.syncOverlays\(\);\s*return;\s*\}\s*this\.syncDock\(\);\s*return;\s*\}/);
});

test('a handle that moved only the footprint writes the footprint alone', () => {
    const write = methodBody(mainSource, 'writeGumball');
    assert.match(write, /if \(Object\.keys\(changes\.config \?\? \{\}\)\.length === 0\) \{\s*if \(footprint\) reviseDraft\(this\.builder, \{ footprint \}\);/);
    assert.ok(write.indexOf('Object.keys(changes.config') < write.indexOf('this.currentDraftHolder()'),
        'before the holder could fill the configuration in');
});

test('a stroke is drawn as it goes, as the region it will cover, and the stamp follows a pointer that can hover', () => {
    const draw = methodBody(mainSource, 'drawBuildOverlay');
    assert.match(draw, /const brush = isStrokeTool\(live\) \? strokeValues\(this\.builder\) : null;/);
    assert.match(draw, /const stamp = strokeStamp\(buildTool\(live\), brush, this\.strokeDrawing\.scale\);/,
        'the stamp the stroke will be laid with, in world units at the press\'s scale');
    assert.match(draw, /strokeRibbon\(\{ points: this\.strokeDrawing\.points, stamp \}\)\s*\.flatMap\(loop => this\.screenRegion\(loop, true, width, height\)\);/,
        'worked out on the ground and stood on it, so it is as wide on the screen as the stroke laid will be');
    assert.match(draw, /fillRegion\(ctx, runs, this\.strokeTrailColour\(live, brush, this\.strokeDrawing\)\);/);
    const colour = methodBody(mainSource, 'strokeTrailColour');
    assert.match(colour, /if \(isPaintTool\(tool\)\) return paintTrailColour\(brush\.color, brush\.opacity\);/);
    assert.match(colour, /if \(isEraseTool\(tool\)\) return drawing\.alt \? ERASE_TRAIL\.restore : ERASE_TRAIL\.colour;/,
        'an erase stroke in red, and one that puts back in green');
    assert.match(colour, /return COVER_TRAIL\.colour;/);
    assert.match(draw, /pointer\.type !== 'touch' && !confirmOpen\(this\.builder\) && !eyeDropperArmed\(this\.builder\)\s*&& !cameraHeld\(this\.builder\) && deselectPopup\(this\.builder\) == null && this\.gumballHover == null && this\.gumballDrag == null/,
        'not for a finger, under a question, with the eye dropper armed, the view being panned or the popup open, or over a handle');
    assert.match(draw, /stampOutline\(pointer\.x, pointer\.y, brush\.buildWidth, brush\.buildHeight, brush\.cornerRadius\)/);
    assert.match(draw, /stampOutline\(pointer\.x, pointer\.y, brush\.size, brush\.size, brush\.tip === 'square' \? 0 : brush\.size \/ 2\)/,
        'and the paint brush as its size and its tip');
});

// --- Free Paint --------------------------------------------------------------------

test('Free Paint\'s panel writes the batch in hand as the cover tool\'s does, and DEFAULT puts the brush back', () => {
    const shape = methodBody(mainSource, 'onDockShape');
    assert.match(shape, /if \(this\.dockShown\?\.kind === DOCK_PAINT\) \{\s*if \(id !== DOCK_DEFAULT_BRUSH\.id \|\| !resetBrush\(this\.builder\)\) return;\s*this\.strokeHolder = null;\s*this\.syncOverlays\(\);\s*return;\s*\}/,
        'the holder made again from the brush put back');
});

test('a colour chosen on the dock is written through the row\'s holder and carried as a stepped value is', () => {
    assert.match(mainSource, /onColor: {2}\(entry, rgb\) => this\.onDockColor\(entry, rgb\),/);
    assert.match(mainSource, /onDropper: entry => this\.onDockDropper\(entry\)/, 'the row the dropper was pressed on handed on');
    const color = methodBody(mainSource, 'onDockColor');
    assert.match(color, /const holder = this\.dockHolder\(entry\);\s*if \(!holder\) return;\s*writeRowValue\(holder, entry\.name, entry\.row, rgb\);\s*this\.applyDockValue\(entry\);/);
    assert.match(methodBody(mainSource, 'onDockDropper'), /toggleEyeDropper\(this\.builder, entry\?\.name\);/,
        'so a surface\'s dropper fills the colour of the row it is on');
});

test('a click with the eye dropper armed takes the ground\'s colour, and Escape puts it down first', () => {
    const dropper = methodBody(mainSource, 'dropperAt');
    assert.match(dropper, /const rgb = point \? this\.terrain\.getGroundColorAt\(point\.x, point\.z\) : null;\s*if \(rgb == null\) return;/,
        'over the sky nothing is taken and it stays armed');
    assert.match(dropper, /if \(!takeEyeDropperColor\(this\.builder, rgb\)\) return;\s*this\.strokeHolder = null;\s*this\.draftHolder = null;\s*if \(pending\) this\.redrawCanvas\(\);/,
        'the panel made again with the colour - the brush\'s, or the extrusion\'s - and what is in hand drawn again in it');
    assert.match(methodBody(mainSource, 'onBuilderKey'),
        /if \(isCanvasLeaveKey\(e\.code\) && dropEyeDropper\(this\.builder\)\) \{/);
    const key = methodBody(mainSource, 'onBuilderKey');
    assert.ok(key.indexOf('dropEyeDropper') < key.indexOf('leavesBuilder(this.builder, e.code)'), 'before leaving is asked about');
});

test('a slider is not blurred under the pointer dragging it', () => {
    assert.match(methodBody(mainSource, 'onDockType'), /if \(field\.type !== 'range'\) field\.blur\(\);/);
});

test('a colour row is drawn as its swatches, the picker\'s bands, the eye dropper and a hex field', () => {
    const draw = methodBody(panelViewSource, 'drawColorRow');
    assert.match(draw, /for \(const swatch of COLOR_SWATCHES\) \{/);
    assert.match(draw, /button\.style\.background = hexColor\(swatch\.rgb\);/);
    assert.match(draw, /for \(const shade of PICKER_SHADES\) \{[^}]*band\.style\.background = pickerBandStyle\(shade\);/);
    assert.match(draw, /dropper\.dataset\.dropper = 'on';/);
    assert.match(draw, /hex\.type = 'text';[^]*hex\.maxLength = 7;/);
    assert.match(methodBody(panelViewSource, 'drawRow'), /if \(entry\.row\.color\) \{\s*this\.drawColorRow\(entry\);\s*return;\s*\}/,
        'a colour row is never drawn as a figure between two steps');
});

test('a colour row lights the swatch it is, and offers the eye dropper only where it can be armed', () => {
    const update = methodBody(panelViewSource, 'updateColorRow');
    assert.match(update, /button\.setAttribute\('aria-pressed', String\(sameColor\(swatch\?\.rgb, entry\.value\)\)\);/);
    assert.match(update, /drawn\.dropper\.hidden = content\.dropping === undefined;/,
        'not on a paint batch picked with Select, where nothing can arm it');
    assert.match(update, /drawn\.dropper\.setAttribute\('aria-pressed', String\(content\.dropping === true \|\| content\.dropping === entry\.name\)\);/,
        'pressed on Free Paint\'s row, or on the one surface\'s row it is armed for');
    assert.match(update, /if \(document\.activeElement !== drawn\.reading\) \{\s*drawn\.reading\.value = entry\.valueLabel;/,
        'and the hex field is left alone while it is typed into');
});

test('a press on the picker is the colour at the point along its band, and a swatch is its own', () => {
    const click = methodBody(panelViewSource, 'onClick');
    assert.match(click, /const along = box\.width > 0 \? \(event\.clientX - box\.left\) \/ box\.width : 0;\s*this\.handlers\.onColor\?\.\(entry, pickerColor\(along, Number\(button\.dataset\.shade\)\)\);/);
    assert.match(click, /if \(swatch\) this\.handlers\.onColor\?\.\(entry, \[\.\.\.swatch\.rgb\]\);/);
    assert.match(click, /if \(button\.dataset\.dropper\) \{\s*this\.handlers\.onDropper\?\.\(entry\);/);
    assert.match(click, /const entry = this\.entryFor\(colorLine\.dataset\.row\);\s*if \(!entry\?\.live\) return;/, 'a locked row chooses nothing');
});

test('a hex figure that is no colour is refused and kept, and one that is is taken', () => {
    const change = methodBody(panelViewSource, 'onChange');
    assert.match(change, /if \(field\.type === 'range'\) return;/, 'a slider is the input event\'s, not the change\'s');
    assert.match(change, /const rgb = parseHex\(field\.value\);\s*if \(rgb == null\) \{\s*field\.setCustomValidity\(rangeNotice\(entry\.row\)\);\s*field\.reportValidity\(\);\s*return;\s*\}/);
    assert.match(change, /field\.setCustomValidity\(''\);\s*field\.blur\(\);\s*this\.handlers\.onColor\?\.\(entry, rgb\);/);
});

test('a row whose range asks for a slider has one across its whole range, moving its value as it moves', () => {
    const draw = methodBody(panelViewSource, 'drawRow');
    assert.match(draw, /if \(entry\.row\.range\?\.slider === true && typed\(entry\.row\)\) \{/);
    assert.match(draw, /slider\.min = String\(entry\.row\.range\.low\);\s*slider\.max = String\(entry\.row\.range\.high\);/);
    assert.match(panelViewSource, /root\.addEventListener\('input', \(event\) => this\.onSlide\(event\)\);/);
    assert.match(methodBody(panelViewSource, 'onSlide'), /if \(entry\?\.live\) this\.handlers\.onType\?\.\(entry, Number\(slider\.value\), slider\);/);
    assert.match(methodBody(panelViewSource, 'update'), /if \(document\.activeElement !== drawn\.slider\) drawn\.slider\.value = String\(entry\.value\);/);
});

test('a section may carry tiles of its own, drawn under its heading and lit as the dock\'s are', () => {
    const build = methodBody(panelViewSource, 'build');
    assert.match(build, /this\.fields\.append\(heading\);\s*this\.drawShapes\(section\.shapes\);/);
    assert.match(methodBody(panelViewSource, 'update'),
        /const shapes = \[\.\.\.\(content\.shapes \?\? \[\]\), \.\.\.\(content\.sections \?\? \[\]\)\.flatMap\(section => section\.shapes \?\? \[\]\)\];/);
    assert.match(panelViewSource, /\.\.\.\(section\.shapes \?\? \[\]\)\.flatMap\(row => row\.tools\.map\(tool => `shape:\$\{tool\.id\}`\)\),/,
        'and a tile added or taken away rebuilds the dock');
});

test('the colour row is styled as the art lays it out, and a tap tints none of its colours', () => {
    for (const selector of ['.dock-color', '.dock-swatches', '.dock-swatch', '.dock-picker-band', '.dock-dropper', '.dock-hex', '.dock-slider']) {
        assert.ok(indexHtml.includes(`${selector} {`), `${selector} is styled`);
    }
    assert.match(indexHtml, /\.dock-swatches \{[^}]*grid-template-columns: repeat\(4, 1fr\);/, 'two rows of four');
    assert.match(indexHtml, /\.dock-swatch \{[^}]*-webkit-tap-highlight-color: transparent;/);
    assert.match(indexHtml, /\.dock-picker-band \{[^}]*-webkit-tap-highlight-color: transparent;/);
    assert.match(indexHtml, /\.dock-row\.locked,\s*\.dock-color\.locked \{/);
});

// --- Erase, and Deselect from anywhere ----------------------------------------------

test('an erase stroke reads alt once at the press and is laid with it', () => {
    assert.match(methodBody(mainSource, 'strokePress'), /alt: e\.altKey === true,/);
    assert.match(methodBody(mainSource, 'finishStroke'), /layStroke\(this\.builder, drawn\.points, stamp, \{ size: this\.terrain\.size, alt: drawn\.alt \}\)/);
});

test('a right click on the selection opens the popup, and a right drag that panned does not', () => {
    const press = methodBody(mainSource, 'onCanvasPress');
    assert.match(press, /this\.rightPress = e\.button === 2 \? \{ x: e\.clientX, y: e\.clientY, type: e\.pointerType \} : null;/);
    const menu = methodBody(mainSource, 'onCanvasMenu');
    assert.match(menu, /if \(press == null \|\| e\.shiftKey \|\| travelledPast\(press, \{ x: e\.clientX, y: e\.clientY \}, press\.type\)\) return;/,
        'a pan, with shift or by travelling, opens nothing');
    assert.match(menu, /if \(this\.strokeDrawing \|\| this\.lassoDrawing \|\| this\.gumballDrag \|\| this\.canvasDrag\) return;/);
    assert.match(menu, /const inside = point != null && footprintWeight\(selection, point\.x, point\.z, this\.terrain\.size\) > 0;/,
        'on the selected ground, measured on the canvas it repeats across');
    assert.match(menu, /if \(openDeselectPopup\(this\.builder, \{ x: e\.clientX, y: e\.clientY \}, inside\)\) this\.syncOverlays\(\);/);
});

test('the popup is shut by a press anywhere off it, the canvas\'s press going no further, and by Escape first', () => {
    const press = methodBody(mainSource, 'onCanvasPress');
    assert.match(press, /if \(closeDeselectPopup\(this\.builder\)\) \{\s*e\.preventDefault\(\);\s*this\.syncOverlays\(\);\s*return;\s*\}/);
    assert.ok(press.indexOf('closeDeselectPopup') < press.indexOf('gumballHit'), 'before a handle or the ground is pressed');
    const wired = methodBody(mainSource, 'setupBuilderPointer');
    assert.match(wired, /this\.overlays\.popup\.addEventListener\('click', \(e\) => this\.onPopupPress\(e\)\);/);
    assert.match(wired, /document\.addEventListener\('pointerdown', \(e\) => \{\s*if \(e\.target === surface \|\| this\.overlays\.popup\.contains\(e\.target\)\) return;\s*if \(closeDeselectPopup\(this\.builder\)\) this\.syncOverlays\(\);\s*\}, true\);/);
    const key = methodBody(mainSource, 'onBuilderKey');
    assert.match(key, /if \(isCanvasLeaveKey\(e\.code\) && closeDeselectPopup\(this\.builder\)\) \{\s*this\.syncOverlays\(\);\s*return;\s*\}/);
    assert.ok(key.indexOf('closeDeselectPopup') < key.indexOf('dropEyeDropper'), 'the innermost thing first');
});

test('the popup\'s DESELECT is the panel\'s, and it is drawn at the click, kept on the screen', () => {
    const popup = methodBody(mainSource, 'onPopupPress');
    assert.match(popup, /if \(!e\.target\.closest\('\[data-popup="deselect"\]'\)\) return;/);
    assert.match(popup, /if \(!deselect\(this\.builder\)\) closeDeselectPopup\(this\.builder\);/);
    const sync = methodBody(mainSource, 'syncPopup');
    assert.match(sync, /const at = \(canvas \?\? buildModeDrawing\(this\.builder\)\) \? deselectPopup\(this\.builder\) : null;\s*popup\.style\.display = at \? 'block' : 'none';/);
    assert.match(sync, /popup\.style\.left = `\$\{Math\.max\(Math\.min\(at\.x, window\.innerWidth - width - 4\), 4\)\}px`;/);
    assert.match(methodBody(mainSource, 'syncOverlays'), /this\.syncPopup\(canvas\);/);
    assert.match(indexHtml, /<div id="build-popup" role="menu" aria-label="Selection">\s*<button type="button" role="menuitem" data-popup="deselect">DESELECT<\/button>/);
    assert.match(indexHtml, /#build-popup \{[^}]*position: fixed;[^}]*z-index: 300;/, 'over the canvas and the dock, under a confirm');
});

// --- Extrude ------------------------------------------------------------------------

test('the lasso and Extrude draw their shapes through one gesture, differing only in what is done with the region', () => {
    const live = methodBody(mainSource, 'liveShapeTool');
    assert.match(live, /if \(tool === LASSO_PALETTE_TOOL\) return lassoTool\(buildLassoTool\(this\.builder\)\);/);
    assert.match(live, /if \(extrudeDrawing\(this\.builder\)\) return extrudeTool\(buildExtrudeTool\(this\.builder\)\);/,
        'Extrude only while it is drawing: once lifted, the pointer draws nothing');
    assert.match(methodBody(mainSource, 'shapeValues'), /return isExtrudeTool\(mode\) \? extrudeValues\(this\.builder\) : lassoValues\(this\.builder\);/);
    const press = methodBody(mainSource, 'lassoPress');
    assert.match(press, /const tool = this\.liveShapeTool\(\);/);
    assert.match(press, /gesture: LASSO_DRAG, mode, tool: tool\.id, shape: tool\.shape,/, 'the drawing carries the mode it was begun in and the shape it draws');
    assert.match(methodBody(mainSource, 'dragLasso'), /if \(shapeOf\(drawing\.shape\)\?\.kind === 'ring'\) \{/);
});

test('Extrude\'s panel picks a shape, writes its rows by stage, and its one button moves the stage on', () => {
    const shape = methodBody(mainSource, 'onDockShape');
    assert.match(shape, /if \(this\.dockShown\?\.kind === DOCK_EXTRUDE\) \{\s*\/\/[^\n]*\n[^\n]*\n\s*const lifted = extrudeStage\(this\.builder\) !== EXTRUDE_DRAWING;\s*if \(!chooseExtrudeTool\(this\.builder, id\)\) return;\s*this\.cancelLasso\(\);\s*this\.draftHolder = null;\s*if \(lifted\) this\.redrawCanvas\(\);/,
        'a shape picked with an extrusion lifted keeps it, and the ground is drawn with it kept');
    const apply = methodBody(mainSource, 'applyDockValue');
    assert.match(apply, /if \(kind === DOCK_EXTRUDE\) \{\s*if \(shown\.stage === EXTRUDE_DRAWING\) \{\s*setExtrudeValues\(this\.builder, holder\.config\);\s*this\.syncDock\(\);\s*return;\s*\}\s*reviseDraft\(this\.builder, \{ config: holder\.config \}\);\s*this\.redrawCanvas\(\);/);
    const action = methodBody(mainSource, 'onDockAction');
    assert.match(action, /if \(id === EXTRUDE_STAGE_ACTION\) \{\s*const was = extrudeStage\(this\.builder\);\s*if \(pressExtrudeStage\(this\.builder, \{ size: this\.terrain\.size \}\) == null\) return;\s*this\.draftHolder = null;\s*this\.cancelLasso\(\);\s*if \(was === EXTRUDE_DRAWING\) this\.redrawCanvas\(\);/,
        'EXTRUDE draws the ground with the region lifted');
    assert.match(methodBody(mainSource, 'syncDock'), /size: this\.terrain\.size,/, 'the dock reads whether the region covers ground on the canvas');
});

test('Extrude\'s region is drawn red over the canvas, and its gumball is out only while it is being pulled up', () => {
    const draw = methodBody(mainSource, 'drawBuildOverlay');
    assert.match(draw, /const pending = extruding && stage === EXTRUDE_DRAWING && buildDraft\(this\.builder\) != null;/);
    assert.match(draw, /if \(selection && !\(extruding && buildDraft\(this\.builder\) != null\)\) \{/, 'a selection drawn into a region is the region, not drawn twice');
    assert.match(draw, /const runs = this\.screenRuns\(this\.selectionEdges\(extrudeRegion\(this\.builder\)\), width, height\);\s*fillRegion\(ctx, runs, EXTRUDE_FILL\);\s*strokePaths\(ctx, runs, EXTRUDE_PENDING\);/,
        'filled, under a red dashed edge');
    assert.match(draw, /if \(chosen && !pending\) strokeOutline\(ctx, this\.screenOutline\(chosen, width, height\), CHOSEN_OUTLINE\);/);
    assert.match(draw, /if \(this\.gumballDrag\?\.preview\) this\.drawPrism\(ctx, chosen, width, height\);/);
});

test('an extrusion pulled up is previewed on the overlay and the ground drawn once, on release', () => {
    const begin = methodBody(mainSource, 'beginGumballDrag');
    assert.match(begin, /const preview = draft\.type === 'extrude' && handleBinding\(pressed\.handle, draft\)\?\.mode === 'lift';/);
    assert.match(begin, /top: preview \? this\.liftedTop\(draft\) : null,\s*lifted: Number\(draft\.config\?\.height\) \|\| 0,/);
    const prism = methodBody(mainSource, 'drawPrism');
    assert.match(prism, /const top = drag\.top \+ \(Number\(placement\.config\?\.height\) \|\| 0\) - drag\.lifted;/,
        'the top the region stood at when the drag began, moved by however far the height has moved since');
    assert.match(prism, /const base = projectOutline\(segments, \(x, z\) => this\.terrain\.getTerrainHeightAt\(x, z\), project\);\s*const raised = projectOutline\(segments, \(\) => top, project\);/);
    assert.match(methodBody(mainSource, 'liftedTop'), /if \(weigh\(x, z\) < 1\) continue;/, 'the mean of the ground it wholly covers');
    assert.match(methodBody(mainSource, 'endGumballDrag'), /if \(redraw && this\.groundStale\) this\.redrawCanvas\(\);/);
});

test('an answer\'s label and whether it can be pressed are written without the panel being built again', () => {
    const update = methodBody(panelViewSource, 'update');
    assert.match(update, /if \(answer\.textContent !== action\.label\) answer\.textContent = action\.label;\s*answer\.disabled = action\.disabled === true;/);
    assert.ok(styled(indexHtml, '.dock-action[data-action="extrude-stage"]', /flex:\s*1 1 100%;/), 'the button across the whole of the answers');
    assert.ok(styled(indexHtml, '.dock-action:disabled', /opacity:\s*0\.45;/), 'greyed while it cannot be pressed');
    assert.match(indexHtml, /#build-dock-actions \{[^}]*flex-wrap: wrap;/);
});

test('a placed template comes off every tile but the middle one, as a strip does', () => {
    assert.match(terrainSource, /return home \? elements : elements\.filter\(placement => placement\.type !== 'runway' && !isGroup\(placement\)\);/);
});

// --- Insert Runway -----------------------------------------------------------------

test('a click with Insert Runway places the chosen template lined up with the view, and the ground is drawn with it', () => {
    const insert = methodBody(mainSource, 'insertAt');
    assert.match(insert, /const point = this\.pickCanvasPoint\(e\.clientX, e\.clientY\);/);
    assert.match(insert, /insertTemplate\(this\.builder, point, arrivalHeading\(viewBearing\(this\.buildCamera\)\), \{ size: this\.terrain\.size \}\)/);
    assert.match(insert, /this\.redrawCanvas\(\);\s*this\.syncOverlays\(\);/);
});

test('the template armed is outlined where a click would put it, for a pointer that can hover, and writes nothing', () => {
    const preview = methodBody(mainSource, 'insertPreview');
    assert.match(preview, /if \(id == null \|\| pointer == null \|\| pointer\.type === 'touch'\) return null;/);
    assert.match(preview, /placed\.config\.at = keepStripOnCanvas\(placed\.config\.at, groupReach\(placed\), size\);/, 'held on the canvas as a click would hold it');
    assert.match(preview, /return \[\.\.\.groupStrips\(placed, size\), \.\.\.groupLots\(placed, size\)\]\.map\(strip => footprintLoop\(strip\)\);/,
        'an airport\'s apron and buildings as well as its strip');
    assert.doesNotMatch(preview, /redrawCanvas|insertTemplate|startDraft/);
    const draw = methodBody(mainSource, 'drawBuildOverlay');
    assert.match(draw, /if \(insertsTemplate\(buildModeTool\(this\.builder\)\) && !confirmOpen\(this\.builder\) && !cameraHeld\(this\.builder\)\s*&& this\.gumballHover == null && this\.gumballDrag == null\) \{\s*for \(const loop of this\.insertPreview\(\) \?\? \[\]\) \{/,
        'and not while the view is panned from inside the tool');
});

test('a card pressed on Insert Runway\'s panel arms it, and turns the template in hand into it', () => {
    const shape = methodBody(mainSource, 'onDockShape');
    assert.match(shape, /if \(this\.dockShown\?\.kind === DOCK_RUNWAY\) \{\s*if \(!chooseRunwayTemplate\(this\.builder, id\)\) return;\s*if \(draftPending\(this\.builder\)\) this\.redrawCanvas\(\);/);
    assert.ok(shape.indexOf('DOCK_RUNWAY') < shape.indexOf('chooseLassoTool'), 'before the lasso\'s tools are asked');
});

test('the control list stops short of the palette and scrolls, however tall the palette grows', () => {
    assert.match(methodBody(mainSource, 'syncOverlays'),
        /const bottom = this\.overlays\.palette\.getBoundingClientRect\(\)\.bottom;\s*document\.documentElement\.style\.setProperty\('--build-palette-bottom', `\$\{Math\.ceil\(bottom\)\}px`\);/);
    // The desktop rule: the first one written for the list, ahead of any screen's own.
    const css = indexHtml.slice(indexHtml.indexOf('#build-help {'), indexHtml.indexOf('}', indexHtml.indexOf('#build-help {')));
    assert.match(css, /max-height: calc\(100vh - var\(--build-palette-bottom, 0px\) - 34px\);/);
    assert.match(css, /overflow-y: auto;/);
});

test('a click on an extrusion at its surfaces points the panel at the one under it, and outlines it', () => {
    const press = methodBody(mainSource, 'surfacePress');
    assert.ok(press, 'js/main.js should define surfacePress()');
    assert.match(press, /const footprint = buildDraft\(this\.builder\)\?\.footprint;\s*if \(footprint == null\) return;/);
    assert.match(press, /const weight = point \? footprintWeight\(footprint, point\.x, point\.z, this\.terrain\.size\) : 0;\s*if \(!chooseExtrudeSurface\(this\.builder, surfaceAt\(weight\)\)\) return;\s*this\.draftHolder = null;\s*this\.syncOverlays\(\);/,
        'read off the footprint\'s weight there, as the element paints it, and the panel made again for it');

    const draw = methodBody(mainSource, 'drawBuildOverlay');
    assert.match(draw, /const surface = extruding \? extrudeSurface\(this\.builder\) : null;\s*if \(surface && chosen\?\.footprint\) \{\s*strokePaths\(ctx, this\.screenRuns\(this\.surfaceRuns\(chosen\.footprint, surface\), width, height\), EXTRUDE_REGION\);/,
        'edged in Extrude\'s red');
    assert.match(methodBody(mainSource, 'surfaceRuns'), /if \(this\.surfaceTrace\?\.key !== key\) this\.surfaceTrace = \{ key, runs: surfaceEdges\(footprint, surface, this\.terrain\.size\) \};/,
        'traced once for its footprint and kept, not on every frame');
});

test('BACK from the surfaces draws the ground again as it stood', () => {
    const action = methodBody(mainSource, 'onDockAction');
    assert.match(action, /if \(id === EXTRUDE_BACK\.id\) \{\s*if \(!backFromSurfaces\(this\.builder\)\) return;\s*this\.draftHolder = null;\s*this\.redrawCanvas\(\);/);
    assert.ok(action.indexOf('EXTRUDE_BACK.id') < action.indexOf('acceptDraft'), 'before ACCEPT and CANCEL are read');
});

test('a pan from inside a tool holds the camera, and letting it go puts the tool back', () => {
    const press = methodBody(mainSource, 'onCanvasPress');
    assert.match(press, /travelled: false\s*\};\s*\/\/[^\n]*\n(\s*\/\/[^\n]*\n)*\s*if \(holdCamera\(this\.builder\)\) this\.renderer\.domElement\.style\.cursor = this\.canvasCursor\(\);/,
        'held as the drag begins');
    const begun = press.slice(press.indexOf('const gesture'));
    assert.doesNotMatch(begun.slice(begun.indexOf('e.preventDefault();')), /cancelLasso|cancelStroke|acceptDraft|cancelDraft|chooseBuildTool|finishLasso/,
        'a pan neither settles the draft nor drops a shape half drawn');

    assert.match(methodBody(mainSource, 'endCanvasDrag'), /if \(releaseCamera\(this\.builder\) != null\) surface\.style\.cursor = this\.canvasCursor\(\);/);
    assert.match(methodBody(mainSource, 'lassoDrawingPath'), /if \(drawing\.gesture === LASSO_CLICKS && this\.canvasPointer && !cameraHeld\(this\.builder\)\) \{/,
        'a shape drawn a click at a time waits, not reaching out to a pointer that is panning');
});

// --- The builder's settings ------------------------------------------------------------

test('the builder\'s settings are a card on a layer of its own, its headings in the order the cursor walks', () => {
    const layer = indexHtml.slice(indexHtml.indexOf('<div id="builder-settings">'), indexHtml.indexOf('<div id="build-confirm">'));
    assert.ok(layer.includes('<div id="builder-settings-card" role="dialog" aria-modal="true" aria-labelledby="builder-settings-title">'));
    assert.match(layer, /<h2 id="builder-settings-title">BUILDER SETTINGS<\/h2>/);
    const drawn = [...layer.matchAll(/<h3>([^<]+)<\/h3>\s*<ul id="([^"]+)"><\/ul>/g)].map(([, heading, list]) => [heading, list]);
    assert.deepEqual(drawn, [['AUTO ACCEPT', 'builder-settings-auto'], ['VIEW', 'builder-settings-view']]);
    assert.match(layer, /<ul id="builder-settings-view"><\/ul>\s*<ul id="builder-settings-end"><\/ul>/, 'the reset and the way out under no heading, last');

    // Modal over a canvas: a layer over the palette and the dock, under the confirms.
    const css = indexHtml.slice(indexHtml.indexOf('#builder-settings {'), indexHtml.indexOf('}', indexHtml.indexOf('#builder-settings {')));
    assert.match(css, /position: fixed;\s*inset: 0;/);
    assert.match(css, /z-index: 345;/);
    assert.match(indexHtml, /#build-confirm \{[^}]*z-index: 350;/);
    assert.match(indexHtml, /#build-palette \{[^}]*z-index: 120;/);

    // And the game's settings carry the row that opens it, under a heading of its own after the options.
    const settings = indexHtml.slice(indexHtml.indexOf('<div id="settings">'), indexHtml.indexOf('<div id="control-settings">'));
    assert.match(settings, /<h3>OPTIONS<\/h3>\s*<ul id="settings-options"><\/ul>\s*<h3>BUILDER<\/h3>\s*<ul id="settings-builder"><\/ul>/);
});

test('the builder\'s settings menus are drawn into their lists and redrawn with every other menu', () => {
    assert.match(mainSource, /new MenuList\(document\.getElementById\('builder-settings-auto'\), this\.builderSettingsMenuState,\s*entry => entry\.group === AUTO_ACCEPT_GROUP\)/);
    assert.match(mainSource, /new MenuList\(document\.getElementById\('builder-settings-view'\), this\.builderSettingsMenuState,\s*entry => entry\.group === VIEW_GROUP\)/);
    assert.match(mainSource, /entry\.group !== START_GROUP && entry\.group !== BUILDER_GROUP/, 'the settings card\'s options leave the builder\'s row to its own list');
    const sync = methodBody(mainSource, 'syncOverlays');
    assert.match(sync, /this\.settingsBuilder\.render\(this\.settingsState\);/);
    assert.match(sync, /for \(const menu of this\.builderSettingsMenus\) menu\.render\(this\.builderSettingsMenuState\);/);
    assert.match(sync, /const prefs\s*= !photo && builderSettingsShowing\(this\.builderSettings\);/, 'drawn over whichever screen opened it, the canvas included');
    assert.match(sync, /const panel\s*= modes \|\| settings \|\| controls \|\| editor \|\| picker \|\| prefs;/);
    assert.match(sync, /this\.overlays\.builderSettings\.style\.display = prefs \? 'flex' : 'none';/);
});

test('the gear on the palette\'s band and O inside the builder open the builder\'s settings', () => {
    const palette = methodBody(mainSource, 'drawPalette');
    assert.match(palette, /gear\.dataset\.palette = 'settings';/);
    assert.match(palette, /gear\.append\(markImage\(BUILDER_SETTINGS_MARK\)\);/);
    assert.match(palette, /gear\.setAttribute\('aria-label', BUILDER_SETTINGS_NAME\);/);
    assert.match(palette, /if \(this\.openBuilderSettingsPanel\(BUILDER_SETTINGS_FROM_BUILDER\)\) this\.syncOverlays\(\);/);
    const appended = palette.indexOf('palette.append(gear);');
    assert.ok(appended > 0, 'the gear is put on the palette');
    assert.ok(appended < palette.indexOf('for (const tool of paletteTools())'), 'on the band, not among the tiles');
    assert.match(indexHtml, /#build-palette\.folded \.palette-gear \{\s*display: none;/, 'a folded palette is the tab alone');

    const keys = methodBody(mainSource, 'onBuilderKey');
    assert.match(keys, /if \(isBuilderSettingsOpenKey\(e\.code\) && !e\.repeat\) \{\s*e\.preventDefault\(\);\s*this\.openBuilderSettingsPanel\(BUILDER_SETTINGS_FROM_BUILDER\);/);
    assert.ok(keys.indexOf('onConfirmKey') < keys.indexOf('isBuilderSettingsOpenKey'), 'not under a question');
    assert.ok(keys.indexOf('isBuilderSettingsOpenKey') < keys.indexOf('leavesBuilder'), 'and before the way out is asked about');

    // Read ahead of the builder, which is what makes the screen modal over it.
    for (const name of ['onKeyDown', 'onStartKey']) {
        const body = methodBody(mainSource, name);
        assert.ok(body.indexOf('builderSettingsShowing(this.builderSettings)') > 0, `${name} reads the builder's settings`);
        assert.ok(body.indexOf('builderSettingsShowing(this.builderSettings)') < body.indexOf('buildModeShowing(this.builder)'), `${name} reads them ahead of the builder`);
    }
    assert.match(methodBody(mainSource, 'menuShowing'), /\|\| builderSettingsShowing\(this\.builderSettings\)/);
});

test('opened over a canvas the screen suspends the tool and keeps the draft; closed, it goes back to whatever opened it', () => {
    const open = methodBody(mainSource, 'openBuilderSettingsPanel');
    assert.match(open, /if \(buildModeDrawing\(this\.builder\)\) \{\s*if \(!suspendForSettings\(this\.builder\)\) return false;/);
    assert.match(open, /this\.endCanvasDrag\(\);\s*this\.endGumballDrag\(\);\s*this\.cancelStroke\(\);\s*if \(this\.lassoDrawing\?\.gesture === LASSO_DRAG\) this\.cancelLasso\(\);\s*this\.buildKeys\.clear\(\);/,
        'whatever is being dragged ends and a held key is let go, and a shape drawn a click at a time is kept');
    assert.doesNotMatch(open, /acceptDraft|cancelDraft|chooseBuildTool|requestLeave/, 'opening it never settles the draft');
    assert.match(open, /\} else \{\s*closeSettings\(this\.settings\);\s*\}/, 'from the game\'s settings, in their place');
    assert.match(open, /openBuilderSettings\(this\.builderSettings, from\);\s*resetSelection\(this\.builderSettingsMenuState\);/);

    const close = methodBody(mainSource, 'closeBuilderSettingsPanel');
    assert.match(close, /const from = closeBuilderSettings\(this\.builderSettings\);/);
    assert.match(close, /if \(from === BUILDER_SETTINGS_FROM_SETTINGS\) \{\s*this\.openSettingsPanel\(\);/);
    assert.match(close, /if \(at >= 0\) this\.settingsState\.index = at;/, 'back on the row that opened them');
    assert.match(close, /\} else if \(from === BUILDER_SETTINGS_FROM_BUILDER\) \{\s*resumeFromSettings\(this\.builder\);/);

    const keys = methodBody(mainSource, 'onBuilderSettingsKey');
    assert.match(keys, /if \(isBuilderSettingsCloseKey\(e\.code\) \|\| \(isBuilderSettingsOpenKey\(e\.code\) && !e\.repeat\)\) \{/, 'O closes them again, as Escape and Backspace do');
    assert.match(methodBody(mainSource, 'chooseBuilderSettingsEntry'), /if \(id === BUILDER_SETTINGS_BACK_ID\) \{\s*this\.closeBuilderSettingsPanel\(\);/, 'BACK goes back the same way');
    assert.match(methodBody(mainSource, 'chooseSettingsEntry'), /if \(applied === BUILDER_SETTINGS_ID\) \{\s*this\.openBuilderSettingsPanel\(BUILDER_SETTINGS_FROM_SETTINGS\);/);
});

test('what the builder\'s settings say reaches the session and the camera, from the next event on', () => {
    const apply = methodBody(mainSource, 'applyBuilderSettings');
    assert.match(apply, /setAutoAccept\(this\.builder, builderAutoAccept\(this\.builderSettings\)\);/);
    assert.match(apply, /this\.buildCameraSpeed = builderCameraSpeed\(this\.builderSettings\);/);
    assert.match(mainSource, /this\.applyControlSettings\(\);\s*this\.applyBuilderSettings\(\);/, 'in force from the first frame');
    assert.match(methodBody(mainSource, 'onBuilderSettingsKey'), /if \(adjusted\) this\.applyBuilderSettings\(\);/);
    assert.match(methodBody(mainSource, 'chooseBuilderSettingsEntry'), /if \(chooseBuilderSetting\(this\.builderSettings, id, step\)\) this\.applyBuilderSettings\(\);/);

    const drag = methodBody(mainSource, 'onCanvasDrag');
    assert.match(drag, /const speed = this\.buildCameraSpeed \?\? 1;/);
    assert.match(drag, /orbitBuildCamera\(this\.buildCamera, dx \* speed, dy \* speed\)/);
    assert.match(drag, /panBuildCamera\(this\.buildCamera, dx \* speed, dy \* speed, \{/);
});

test('a draft kept by auto accept lets the panel\'s holders go and draws the ground again', () => {
    assert.match(methodBody(mainSource, 'draftKept'), /this\.draftHolder = null;\s*this\.strokeHolder = null;\s*this\.redrawCanvas\(\);/);
    const palette = methodBody(mainSource, 'onPaletteClick');
    assert.match(palette, /const pending = editPending\(this\.builder\);/);
    assert.match(palette, /else if \(pending && !draftPending\(this\.builder\)\) this\.draftKept\(\);/, 'a tool change that kept it');
    const leave = methodBody(mainSource, 'requestLeaveBuilder');
    assert.match(leave, /const pending = editPending\(this\.builder\);\s*const asked = requestLeave\(this\.builder\);\s*if \(pending && !draftPending\(this\.builder\)\) this\.draftKept\(\);/,
        'and a way out that kept it before asking whether to save');
});
