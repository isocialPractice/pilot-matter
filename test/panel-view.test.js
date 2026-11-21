import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PanelView, statusLines, statusToShow, statusSaid, rowKey, dockRows, fieldFigure } from '../js/panel-view.js';

const source = name => readFileSync(fileURLToPath(new URL(`../js/${name}`, import.meta.url)), 'utf8');

/** Dock content with one status line to a section, in the order they are drawn. */
const content = (...sections) => ({
    kind: 'files',
    heading: 'SAVE / LOAD',
    rows: [],
    sections: sections.map(([id, text, refused]) => ({
        id,
        heading: id.toUpperCase(),
        rows: [],
        ...(text === undefined ? {} : { status: text === null ? null : { text, refused: refused === true } })
    }))
});

// The two ids SAVE / LOAD's sections carry, as `js/build-panel.js` writes them.
const ENVIRONMENT = 'environment';
const ASSETS = 'assets';
const REFUSAL = 'could not load scene.glb: the model points at another file, scene.bin; everything it uses has to be inside it';
const NO_ASSETS = 'no assets loaded - LOAD ASSET reads a GLB, glTF, OBJ, STL or SVG';

test('every section\'s status line is read off the content, drawn or empty', () => {
    assert.deepEqual(statusLines(content([ENVIRONMENT, ''], [ASSETS, NO_ASSETS])), [
        { id: ENVIRONMENT, text: '', refused: false },
        { id: ASSETS, text: NO_ASSETS, refused: false }
    ]);
    assert.deepEqual(statusLines(content([ENVIRONMENT, REFUSAL, true])), [{ id: ENVIRONMENT, text: REFUSAL, refused: true }]);

    // A section with no status at all is not a section with an empty one: the
    // first never draws a line, and only sections that draw one are listed.
    assert.deepEqual(statusLines(content([ENVIRONMENT, undefined], [ASSETS, NO_ASSETS])), [{ id: ASSETS, text: NO_ASSETS, refused: false }]);
    // A section whose status is null draws its line and says nothing in it,
    // which is how SAVE / LOAD opens before the first save or load.
    assert.deepEqual(statusLines(content([ENVIRONMENT, null])), [{ id: ENVIRONMENT, text: '', refused: false }]);
    assert.deepEqual(statusLines({ sections: [] }), []);
    assert.deepEqual(statusLines(null), []);
});

test('the status line a draw scrolls to is the one whose words just changed, a refused one first', () => {
    const said = new Map();

    // A section's first line is the panel's resting state, not an answer. The
    // ASSETS section always says something, so a first draw that scrolled to
    // it would start the pilot below the NAME row it sits under.
    const opening = content([ENVIRONMENT, ''], [ASSETS, NO_ASSETS]);
    assert.equal(statusToShow(opening, said), null, 'nothing is news on a first draw');
    for (const line of statusLines(opening)) said.set(line.id, line.text);

    // The line the pilot is waiting for: a refusal written where an empty slot
    // was.
    const refused = content([ENVIRONMENT, REFUSAL, true], [ASSETS, NO_ASSETS]);
    assert.deepEqual(statusToShow(refused, said), { id: ENVIRONMENT, text: REFUSAL, refused: true });

    // The dock redraws every frame, so the same words again are not news - a
    // scroll on each would take back a view the pilot set by hand.
    for (const line of statusLines(refused)) said.set(line.id, line.text);
    assert.equal(statusToShow(refused, said), null, 'and not again while it stands');

    // A line gone empty has nothing in it to read.
    assert.equal(statusToShow(content([ENVIRONMENT, ''], [ASSETS, NO_ASSETS]), said), null);

    // Two changed at once: the refused one, wherever it sits among them.
    const both = new Map([[ENVIRONMENT, ''], [ASSETS, NO_ASSETS]]);
    assert.deepEqual(statusToShow(content([ENVIRONMENT, REFUSAL, true], [ASSETS, 'choose an asset to see what it is used as']), both),
        { id: ENVIRONMENT, text: REFUSAL, refused: true });
    assert.deepEqual(statusToShow(content([ENVIRONMENT, 'saved sample-valley.pilot-matter.json'], [ASSETS, REFUSAL, true]), both),
        { id: ASSETS, text: REFUSAL, refused: true }, 'the refused one even when it is drawn second');

    // Neither refused: the first that changed, in the order they are drawn.
    assert.deepEqual(statusToShow(content([ENVIRONMENT, 'saved sample-valley.pilot-matter.json'], [ASSETS, 'choose an asset to see what it is used as']), both),
        { id: ENVIRONMENT, text: 'saved sample-valley.pilot-matter.json', refused: false });
    assert.deepEqual(statusToShow(content([ENVIRONMENT, ''], [ASSETS, 'choose an asset to see what it is used as']), both),
        { id: ASSETS, text: 'choose an asset to see what it is used as', refused: false });

    assert.equal(statusToShow(null, said), null);
});

test('a section that leaves the screen is on its first line again when it comes back', () => {
    // A line can change while its section is off the screen, and a panel
    // opening on one it has never drawn is still opening on its resting
    // state. LOAD ASSET is the route: the step is a panel of its own, and the
    // SAVE / LOAD it hands back has an ASSETS line that has changed.
    const step = { kind: 'asset', heading: 'LOADED ASSET', rows: [], sections: [{ id: 'model', heading: 'MODEL', rows: [] }] };
    const CHOOSE = 'choose an asset to see what it is used as';

    let said = new Map();
    const draw = (drawn) => {
        const show = statusToShow(drawn, said);
        said = statusSaid(drawn);
        return show;
    };

    assert.equal(draw(content([ENVIRONMENT, ''], [ASSETS, NO_ASSETS])), null, 'the panel opens');
    assert.equal(draw(content([ENVIRONMENT, ''], [ASSETS, NO_ASSETS])), null, 'and redraws');
    assert.equal(draw(step), null, 'LOAD ASSET, and the step has no line of its own');
    assert.equal(draw(content([ENVIRONMENT, ''], [ASSETS, CHOOSE])), null,
        'back on SAVE / LOAD with one asset: the ASSETS line is where the panel now opens, not an answer');
    assert.deepEqual(draw(content([ENVIRONMENT, ''], [ASSETS, 'a-1234: used as CITY - 12 x 8 x 10 m'])),
        { id: ASSETS, text: 'a-1234: used as CITY - 12 x 8 x 10 m', refused: false },
        'and a card pressed on the panel that is open is news');

    // What a draw records: this draw's lines, and only those.
    assert.deepEqual(statusSaid(content([ENVIRONMENT, REFUSAL, true], [ASSETS, NO_ASSETS])),
        new Map([[ENVIRONMENT, REFUSAL], [ASSETS, NO_ASSETS]]));
    assert.deepEqual(statusSaid(content([ENVIRONMENT, undefined], [ASSETS, NO_ASSETS])), new Map([[ASSETS, NO_ASSETS]]),
        'a section drawing no line at all says nothing');
    assert.deepEqual(statusSaid(step), new Map());
    assert.deepEqual(statusSaid(null), new Map());
});

test('the view scrolls a changed status into its fields\' window, its first line at the top', () => {
    const view = source('panel-view.js');

    // Read before the lines are written, since writing one is what takes it
    // out of `said` and so out of being news.
    assert.match(view, /const show = statusToShow\(content, this\.said\);/);
    assert.match(view, /this\.said = statusSaid\(content\);/, 'and what it said recorded off the same content');
    assert.ok(view.indexOf('const show = statusToShow(content, this.said);') < view.indexOf('this.said = statusSaid(content);'),
        'the reading comes before the writing');
    assert.match(view, /if \(show\) this\.showStatus\(show\.id\);/);
    assert.doesNotMatch(view, /this\.said\.set\(/, 'a line is never recorded on its own, which would keep a section that has gone');
    assert.doesNotMatch(view, /build\(content\) \{[\s\S]*?this\.said = new Map\(\)/,
        'and a rebuild of the same panel does not forget what it says, so the same words redrawn are not news again');

    // The panel taken off the screen says nothing, so the one that comes back
    // is on its first line however long it was gone.
    assert.match(view, /this\.content = null;\n\s*\/\/[\s\S]*?\n\s*this\.said = new Map\(\);/);

    // The dock leaves its fields where the pilot left them, so a line below
    // the fold is one they never see change. Its first line goes to the top of
    // the window rather than to the nearest edge: a refusal is four lines of
    // which one fits, and its foot reads as a sentence with its start missing.
    assert.match(view, /showStatus\(id\) \{\n\s*const line = this\.drawn\.get\(`status:\$\{id\}`\)\?\.status;/);
    assert.match(view, /if \(box\.top >= view\.top - 1 && box\.bottom <= view\.bottom \+ 1\) return;/,
        'a line already read is left alone');
    assert.match(view, /this\.fields\.scrollTop \+= box\.top - view\.top;/);
    assert.doesNotMatch(view, /scrollIntoView/, 'and not by the browser\'s own, which puts a long line\'s foot on the fold');
});

test('what the scroll does with a line, run against the boxes the page measured', () => {
    // The pins above hold the lines; this runs them. `showStatus` reads
    // `this.drawn` and `this.fields` and touches no global, so the method
    // itself goes against a stub with no DOM behind it - which is what holds
    // its two early returns, neither of them a line any pin can name.
    const boxOf = ({ top, bottom }) => ({ top, bottom, height: bottom - top });
    const stub = (line, fields, scrollTop = 0) => ({
        drawn: new Map(line === null ? [] : [[`status:${ENVIRONMENT}`, { status: { getBoundingClientRect: () => boxOf(line) } }]]),
        fields: fields === null ? null : { getBoundingClientRect: () => boxOf(fields), scrollTop }
    });
    const scrolled = (view) => {
        PanelView.prototype.showStatus.call(view, ENVIRONMENT);
        return view.fields?.scrollTop;
    };

    // The window a four line refusal is read in on a short phone: 62 px of
    // 210, with the fields left where the pilot left them.
    const WINDOW = { top: 470, bottom: 532 };

    assert.equal(scrolled(stub({ top: 480, bottom: 500 }, WINDOW, 40)), 40, 'a line already in the window is left where it is');

    // The measured case: the refusal drawn below the fold comes up by exactly
    // the step that puts its own top at the window's.
    assert.equal(scrolled(stub({ top: 541, bottom: 598 }, WINDOW)), 71, 'a line below the fold comes to the top of the window');
    assert.equal(scrolled(stub({ top: 541, bottom: 640 }, WINDOW)), 71,
        'a line taller than the window lands first line first, not foot on the fold');
    assert.equal(scrolled(stub({ top: 400, bottom: 457 }, WINDOW, 120)), 50, 'and one above it comes down, by a negative step');

    // A line drawn with nothing in it measures zero high and sits wherever
    // the last row left it, so it is outside the window as often as not.
    // Scrolling to it takes the pilot off what they were reading to read
    // nothing.
    assert.equal(scrolled(stub({ top: 600, bottom: 600 }, WINDOW, 30)), 30, 'a line with no height is left alone');

    // Both of the method's early returns, which are what a redraw hits rather
    // than a scroll: `update` runs on every frame the dock is open, and a
    // section whose line was never drawn would reach a box on `undefined`.
    assert.equal(scrolled(stub(null, WINDOW, 30)), 30, 'a section with no line drawn is left alone rather than throwing');
    assert.equal(scrolled(stub({ top: 541, bottom: 598 }, null)), undefined, 'and a view with no fields has nothing to scroll');
});

test('a row is found by its range, its part and the section it is in', () => {
    assert.equal(rowKey({ name: 'height', row: { part: 'min' } }), 'height:min');
    assert.equal(rowKey({ name: 'height', row: { part: 'min' }, section: 'world' }), 'world/height:min');
    assert.deepEqual(dockRows({ rows: [{ name: 'a', row: { part: 'value' } }], sections: [{ rows: [{ name: 'b', row: { part: 'value' } }] }] })
        .map(entry => entry.name), ['a', 'b'], 'the first part\'s rows, then each section\'s');
    assert.deepEqual(dockRows(null), []);
    assert.equal(fieldFigure({ range: { step: 1 } }, 12.4), 12);
});

// --- The bar and the outliner, run against a stub ---------------------------------------

/**
 * A tiny element, enough for the methods below and no more. The real ones are
 * drawn by the browser; what is held here is which parts a row is made of,
 * what each is told, and that `update` writes the same row `build` drew -
 * none of which a pin on the source can prove.
 */
function element(tag) {
    const classes = new Set();
    return {
        tag,
        dataset: {},
        children: [],
        attributes: new Map(),
        style: {},
        classes,
        get className() { return [...classes].join(' '); },
        set className(value) {
            classes.clear();
            for (const name of String(value).split(/\s+/).filter(Boolean)) classes.add(name);
        },
        classList: { toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); } },
        setAttribute(name, value) { this.attributes.set(name, String(value)); },
        getAttribute(name) { return this.attributes.get(name) ?? null; },
        removeAttribute(name) { this.attributes.delete(name); },
        append(...kids) { this.children.push(...kids); },
        replaceChildren(...kids) { this.children = [...kids]; },
        querySelectorAll() { return []; },
        // Enough of a selector for the two this view asks for, each an
        // attribute test on a child: `[data-outliner-box="hidden"]` and
        // `.dock-bar-answer[data-bar="undo"]`.
        querySelector(selector) {
            const found = selector.match(/\[data-([\w-]+)="([^"]*)"\]/);
            if (!found) return null;
            const name = found[1].replace(/-([a-z])/g, (whole, letter) => letter.toUpperCase());
            return this.children.find(kid => kid.dataset?.[name] === found[2]) ?? null;
        }
    };
}

/** `document` while a body runs, put back afterwards however the body ends. */
function withDocument(shim, body) {
    const had = Object.prototype.hasOwnProperty.call(globalThis, 'document');
    const before = globalThis.document;
    globalThis.document = shim;
    try { return body(); }
    finally {
        if (had) globalThis.document = before;
        else delete globalThis.document;
    }
}

const ENTRY = Object.freeze({
    index: 1, label: 'MOUNTAIN 2', name: '', hidden: false, locked: true, live: false, selectable: false, limit: 40
});

/**
 * A view with the four places the panel draws into and nothing behind them.
 * Built on the prototype rather than as a plain object, because `build` calls
 * the view's own `drawShapes` and `drawRow` - so this runs the real methods
 * against stub elements rather than standing in for them.
 */
function stubView() {
    return Object.assign(Object.create(PanelView.prototype), {
        heading: element('h3'), fields: element('div'), answers: element('div'), bar: element('div'),
        drawn: new Map(), said: new Map()
    });
}

test('an outliner row is drawn as the four parts the stylesheet lays out, filed under its index', () => {
    const view = stubView();
    withDocument({ createElement: element, activeElement: null }, () =>
        PanelView.prototype.drawOutlinerRow.call(view, ENTRY));

    assert.equal(view.fields.children.length, 1, 'one row appended');
    const [line] = view.fields.children;
    assert.equal(line.className, 'dock-outliner-row');
    assert.equal(line.dataset.outliner, '1');

    const [pick, name, hidden, locked] = line.children;
    assert.deepEqual(line.children.map(kid => kid.className), [
        'dock-outliner-pick',
        'dock-outliner-name',
        'dock-outliner-box dock-outliner-hidden',
        'dock-outliner-box dock-outliner-locked'
    ], 'the press, the field, then the two boxes, in the order the grid lays out');

    assert.equal(pick.dataset.outlinerPick, '1');
    assert.equal(pick.title, 'Select MOUNTAIN 2');
    assert.equal(pick.getAttribute('aria-label'), 'Select MOUNTAIN 2', 'named by what the row reads as');

    assert.equal(name.dataset.outlinerName, '1');
    assert.equal(name.maxLength, 40);
    assert.equal(name.getAttribute('aria-label'), 'MOUNTAIN 2 name');
    assert.equal(name.title, 'MOUNTAIN 2', 'what the field reads as, for a name too long to fit in it');

    assert.equal(hidden.dataset.outlinerBox, 'hidden');
    assert.equal(hidden.getAttribute('aria-pressed'), 'false');
    assert.equal(locked.dataset.outlinerBox, 'locked');
    assert.equal(locked.getAttribute('aria-pressed'), 'true', 'which is what the stylesheet lights it by');
    assert.equal(locked.title, 'Lock MOUNTAIN 2');

    // The key `update` finds the row by again. Spelt differently in the two
    // methods, every row would go stale the moment anything changed.
    assert.deepEqual([...view.drawn.keys()], ['outliner:1']);
    assert.deepEqual(view.drawn.get('outliner:1'), { line, pick, name });
});

test('the bar is drawn with a switch marked as one, and each answer saying what it is for', () => {
    const view = stubView();
    const bar = [
        { id: 'undo', label: 'UNDO', title: 'Nothing to undo', disabled: true, pressed: null },
        { id: 'snap-grid', label: 'GRID', title: 'Snap what is moved to the grid', disabled: false, pressed: false }
    ];
    withDocument({ createElement: element, activeElement: null }, () =>
        PanelView.prototype.build.call(view, { heading: 'SELECT', rows: [], bar }));

    const [step, snap] = view.bar.children;
    assert.equal(step.className, 'dock-bar-answer', 'a step is not marked as a switch');
    assert.equal(snap.className, 'dock-bar-answer dock-bar-switch', 'and a switch is, whether or not it is on');
    assert.equal(step.title, 'Nothing to undo');
    assert.equal(step.getAttribute('aria-label'), 'UNDO: Nothing to undo', 'so a reader hears the reason as well');
    assert.equal(snap.getAttribute('aria-pressed'), 'false');
    assert.equal(step.getAttribute('aria-pressed'), null, 'a step has no state to read');
});

test('a draw writes the bar and the rows it drew, leaving the field being typed into alone', () => {
    const view = stubView();
    const content = (step, entry) => ({
        heading: 'SELECT',
        rows: [],
        bar: [{ id: 'undo', label: 'UNDO', ...step }],
        sections: [{ id: 'outliner', heading: 'OUTLINER (2)', rows: [], entries: [entry] }]
    });

    const opened = content({ title: 'Nothing to undo', disabled: true, pressed: null }, ENTRY);
    withDocument({ createElement: element, activeElement: null }, () => PanelView.prototype.build.call(view, opened));

    const row = view.drawn.get('outliner:1');
    const answer = view.bar.children[0];

    // The step goes live and its reason changes, with nothing about the panel
    // changing shape - which is the case the titles are written on every draw
    // for.
    const live = content(
        { title: 'Undo the last change to the world', disabled: false, pressed: null },
        { ...ENTRY, name: 'The long north ridge above the valley', live: true, selectable: true, hidden: true }
    );
    withDocument({ createElement: element, activeElement: null }, () => PanelView.prototype.update.call(view, live));

    assert.equal(answer.disabled, false);
    assert.equal(answer.title, 'Undo the last change to the world');
    assert.equal(answer.getAttribute('aria-label'), 'UNDO: Undo the last change to the world');

    assert.equal(row.name.value, 'The long north ridge above the valley');
    assert.equal(row.name.placeholder, 'MOUNTAIN 2');
    assert.equal(row.name.title, 'The long north ridge above the valley', 'the whole name, for a field 203 pixels wide');
    assert.equal(row.pick.getAttribute('aria-pressed'), 'true');
    assert.equal(row.pick.disabled, false);
    assert.ok(row.line.classes.has('hidden-placement'), 'a hidden placement reads as one');
    assert.equal(row.line.querySelector('[data-outliner-box="locked"]').getAttribute('aria-pressed'), 'true');

    // The field being typed into is left exactly as the pilot has it, title
    // and all, which is the rule every other field in the dock is written by.
    const typing = content(
        { title: 'Nothing to undo', disabled: true, pressed: null },
        { ...ENTRY, name: 'Something else entirely' }
    );
    withDocument({ createElement: element, activeElement: row.name }, () => PanelView.prototype.update.call(view, typing));
    assert.equal(row.name.value, 'The long north ridge above the valley');
    assert.equal(row.name.title, 'The long north ridge above the valley');
    assert.equal(answer.title, 'Nothing to undo', 'while the bar is written as it always is');
});
