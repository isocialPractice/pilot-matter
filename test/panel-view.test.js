import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { statusLines, statusToShow, statusSaid, rowKey, dockRows, fieldFigure } from '../js/panel-view.js';

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

test('a row is found by its range, its part and the section it is in', () => {
    assert.equal(rowKey({ name: 'height', row: { part: 'min' } }), 'height:min');
    assert.equal(rowKey({ name: 'height', row: { part: 'min' }, section: 'world' }), 'world/height:min');
    assert.deepEqual(dockRows({ rows: [{ name: 'a', row: { part: 'value' } }], sections: [{ rows: [{ name: 'b', row: { part: 'value' } }] }] })
        .map(entry => entry.name), ['a', 'b'], 'the first part\'s rows, then each section\'s');
    assert.deepEqual(dockRows(null), []);
    assert.equal(fieldFigure({ range: { step: 1 } }, 12.4), 12);
});
