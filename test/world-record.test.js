import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recordWorld, sameWorld } from '../js/world-record.js';

/** An ask of the shape `Terrain.setEnvironment` builds one, with overrides. */
const ask = (over = {}) => ({
    id: 'highlands',
    seed: 1337,
    runway: false,
    base: null,
    elements: null,
    ...over
});

// --- What counts as the same world ----------------------------------------

test('the world already on screen is asked for again without rebuilding it', () => {
    assert.equal(sameWorld(recordWorld(ask()), ask()), true);
});

test('nothing has been built yet, so anything asked for is a different world', () => {
    assert.equal(sameWorld(null, ask()), false);
});

test('the same description seeded differently is a different world', () => {
    assert.equal(sameWorld(recordWorld(ask()), ask({ seed: 1338 })), false);
});

test('a different preset is a different world', () => {
    assert.equal(sameWorld(recordWorld(ask()), ask({ id: 'desert' })), false);
});

test('the same world with a strip in it is a different world', () => {
    assert.equal(sameWorld(recordWorld(ask()), ask({ runway: true })), false);
});

test('a strip laid to a different configuration is a different world', () => {
    const built = recordWorld(ask({ runway: { length: 2000 } }));
    assert.equal(sameWorld(built, ask({ runway: { length: 2000 } })), true);
    assert.equal(sameWorld(built, ask({ runway: { length: 2600 } })), false);
});

test('an element moved is a different world', () => {
    const built = recordWorld(ask({ elements: [{ type: 'forest', range: [0.2, 0.6] }] }));
    assert.equal(sameWorld(built, ask({ elements: [{ type: 'forest', range: [0.2, 0.9] }] })), false);
});

// --- The record is a copy, so a caller can go on editing its own ask -------
//
// This is the half of the redraw fix that lives outside the element editor. The
// editor hands over one description and then edits it in place as the sliders
// move, so a record that held on to that description would be compared against
// itself: a world never seen to change, and ground never drawn again.

test('a description edited by its caller reads as a changed world', () => {
    const elements = [{ type: 'forest', range: [0.2, 0.6] }];
    const built    = recordWorld(ask({ elements }));

    elements[0].range[1] = 0.9;

    assert.equal(sameWorld(built, ask({ elements })), false);
});

test('an element added by its caller reads as a changed world', () => {
    const elements = [{ type: 'forest', range: [0.2, 0.6] }];
    const built    = recordWorld(ask({ elements }));

    elements.push({ type: 'river', range: [0, 0.3] });

    assert.equal(sameWorld(built, ask({ elements })), false);
});

// Every field of an ask is copied, not only the placements. `base` and `runway`
// are handed in as objects too, and a record holding either as a reference is
// the same self-comparison one field along.

test('a base edited by its caller reads as a changed world', () => {
    const base  = { maxHeight: 480, scale: 3.5 };
    const built = recordWorld(ask({ base }));

    base.maxHeight = 900;

    assert.equal(sameWorld(built, ask({ base })), false);
});

test('a strip configuration edited by its caller reads as a changed world', () => {
    const runway = { length: 2000, width: 120 };
    const built  = recordWorld(ask({ runway }));

    runway.length = 2600;

    assert.equal(sameWorld(built, ask({ runway })), false);
});

test('the record shares nothing with the ask it was taken from', () => {
    const asked = ask({ base: { maxHeight: 480 }, runway: { length: 2000 }, elements: [{ type: 'forest' }] });
    const built = recordWorld(asked);

    assert.deepEqual(built, asked);
    for (const field of ['base', 'runway', 'elements']) {
        assert.notEqual(built[field], asked[field], `built.${field} should be a copy, not the ask's own`);
    }
});

test('nothing to record is nothing kept', () => {
    assert.equal(recordWorld(null), null);
});

// --- The terrain reaches for it ------------------------------------------
//
// Everything above proves the record behaves. What it cannot prove is that
// `js/terrain.js` still uses it: that file imports `three`, so nothing here can
// load it, and the copy could be backed out to `this.built = asked` without a
// single test above noticing. So the call site is read from the source the way
// `test/world-tiles.test.js` reads the camera out of `js/main.js`.

const terrainSource = readFileSync(new URL('../js/terrain.js', import.meta.url), 'utf8');

test('the terrain takes its record from here rather than keeping its own copy', () => {
    assert.match(
        terrainSource,
        /import\s*\{[^}]*\brecordWorld\b[^}]*\}\s*from\s*'\.\/world-record\.js'/,
        'js/terrain.js should import recordWorld from js/world-record.js'
    );

    const kept = [...terrainSource.matchAll(/this\.built\s*=\s*([^;]+);/g)].map(m => m[1].trim());
    assert.ok(kept.length > 0, 'js/terrain.js should still be recording the world it built');

    // Nothing but the empty record a fresh terrain opens with, and the record
    // this module takes. An ask assigned straight across is the defect the
    // copy exists to prevent, and it would read as a world never seen to
    // change.
    for (const value of kept) {
        assert.match(
            value,
            /^(null|recordWorld\()/,
            `this.built = ${value} should be recordWorld(...) rather than the ask itself`
        );
    }
});

test('the terrain compares against that record rather than reimplementing it', () => {
    assert.match(
        terrainSource,
        /import\s*\{[^}]*\bsameWorld\b[^}]*\}\s*from\s*'\.\/world-record\.js'/,
        'js/terrain.js should import sameWorld from js/world-record.js'
    );
    assert.doesNotMatch(
        terrainSource,
        /function\s+sameWorld\s*\(/,
        'js/terrain.js should not carry a second copy of sameWorld'
    );
    assert.match(
        terrainSource,
        /sameWorld\(this\.built,\s*asked\)/,
        'setEnvironment should still be asking whether the world already on screen is the one wanted'
    );
});
