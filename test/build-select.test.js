/**
 * Select a built element - the placement under a point of the canvas, found
 * through its reach rather than off the scene, and a click told from an orbit
 * by how far it travelled.
 *
 * The session's half - what a click on a placement, on the one already picked
 * and on bare ground does to the pick - is in `build-mode.test.js` with the
 * rest of the session; this is what a click finds.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createField, fieldX, fieldZ, DEFAULT_SIZE
} from '../js/environment/elements.js';
import { applyFootprintedElement } from '../js/environment/footprinted.js';
import {
    placementReach, placementAt, clickTravel, travelledPast,
    PICK_WEIGHT, CLICK_TRAVEL, TOUCH_CLICK_TRAVEL
} from '../js/build-select.js';

const HALF = DEFAULT_SIZE / 2;

/** A mountain as the builder drops one: a point, a seed, and one peak of a known size. */
function dropped(at, seed = 7, config = {}) {
    return { type: 'mountain', config: { height: [800, 800], radius: [1200, 1200], count: 1, at, ...config }, seed };
}

/** A region of ground cover, as a footprinted placement. */
function disc(type, x, z, radius = 900) {
    return { type, config: {}, footprint: { kind: 'disc', x, z, radius } };
}

// --- A click, not an orbit -----------------------------------------------------

test('a press is a click until it travels further than a click may', () => {
    assert.equal(clickTravel('mouse'), CLICK_TRAVEL);
    assert.equal(clickTravel('pen'), CLICK_TRAVEL);
    assert.equal(clickTravel('touch'), TOUCH_CLICK_TRAVEL, 'a finger is given more room, a tap never being quite still');
    assert.ok(TOUCH_CLICK_TRAVEL > CLICK_TRAVEL);

    const from = { x: 100, y: 100 };
    assert.equal(travelledPast(from, { x: 103, y: 104 }, 'mouse'), false, 'five pixels is still a click');
    assert.equal(travelledPast(from, { x: 104, y: 104 }, 'mouse'), true, 'and further is an orbit');
    assert.equal(travelledPast(from, { x: 106, y: 108 }, 'touch'), false, 'ten for a finger');
    assert.equal(travelledPast(from, { x: 108, y: 108 }, 'touch'), true);
});

// --- The reach of a placed mountain -------------------------------------------

test('a dropped mountain reaches fully at its point and not at all beyond its slopes', () => {
    const mountain = dropped([400, -300]);
    const reach = placementReach(mountain, DEFAULT_SIZE);

    assert.equal(reach(400, -300), 1, 'full strength where it was dropped');
    assert.equal(reach(400 + 3000, -300), 0, 'and nothing well past its widest reach');
    assert.ok(reach(400 + 300, -300) > reach(400 + 600, -300), 'falling off down its slopes');
});

/**
 * The pin that keeps a pick honest: the reach is worked out again from the
 * placement rather than read off the ground, so it has to be the ground the
 * generator raised - every vertex of a flat field, raised by the placement
 * through the door the world draws it through, stands at the reach's share of
 * the peak.
 */
test('the reach a pick reads is the ground the mountain raised', () => {
    for (const mountain of [dropped([0, 0]), dropped([-2500, 1800], 991, { girthRange: { on: true } })]) {
        const field = createField({ size: DEFAULT_SIZE, segments: 120 });
        applyFootprintedElement(field, mountain);
        const reach = placementReach(mountain, DEFAULT_SIZE);

        let worst = 0;
        for (let i = 0; i < field.count; i++) {
            const share = field.height[i] / 800;
            worst = Math.max(worst, Math.abs(share - reach(fieldX(field, i), fieldZ(field, i))));
        }
        // The field holds its heights as 32-bit floats, so the two agree to that.
        assert.ok(worst < 1e-6, `the ground and the reach agree at every vertex, out by ${worst}`);
    }
});

test('a peak dropped by an edge is found across the seam where its slope carries on', () => {
    const mountain = dropped([HALF - 200, 0]);
    const reach = placementReach(mountain, DEFAULT_SIZE);

    assert.ok(reach(-HALF + 200, 0) >= PICK_WEIGHT, 'the far edge of the canvas is the near side of the seam');
    assert.equal(placementAt([mountain], -HALF + 200, 0, DEFAULT_SIZE), 0);
    assert.equal(placementReach(mountain, 0)(-HALF + 200, 0), 0, 'and a canvas with no width to repeat at reaches only itself');
});

test('a seeded placement is read from its own stream, whatever else is on the canvas', () => {
    const mountain = dropped([0, 0], 4242, { radius: [600, 2200] });
    const alone  = placementReach(mountain, DEFAULT_SIZE);
    const listed = [dropped([3000, 3000], 1), dropped([-3000, 0], 2), mountain];

    for (const x of [300, 700, 1100, 1500, 1900]) {
        const index = placementAt(listed, x, 0, DEFAULT_SIZE);
        const reach = alone(x, 0);
        assert.equal(index, reach >= PICK_WEIGHT ? 2 : null, `at ${x} it is found exactly where it reaches`);
    }
});

test('a footprint reaches where it was drawn', () => {
    const grass = disc('grass', 1000, -1000);
    const reach = placementReach(grass, DEFAULT_SIZE);
    assert.equal(reach(1000, -1000), 1);
    assert.equal(reach(4000, -1000), 0);
    assert.equal(placementAt([grass], 1000, -1000, DEFAULT_SIZE), 0);
});

test('a mountain dropped inside a footprint reaches only where both do', () => {
    const both = { ...dropped([0, 0]), footprint: { kind: 'disc', x: 600, z: 0, radius: 300 } };
    const reach = placementReach(both, DEFAULT_SIZE);
    assert.equal(reach(-600, 0), 0, 'its slope outside the region is ground it never raised');
    assert.ok(reach(600, 0) > 0);
});

test('a placement that is nowhere on the canvas in particular is never picked', () => {
    const scattered = { type: 'mountain', config: { count: 5 } };
    const unknown   = { type: 'volcano', config: { at: [0, 0] }, seed: 3 };
    assert.equal(placementReach(scattered, DEFAULT_SIZE)(0, 0), 0, 'a whole-world scatter has no one place');
    assert.equal(placementReach(unknown, DEFAULT_SIZE)(0, 0), 0, 'and an element the registry does not hold has no reach');
    assert.equal(placementAt([scattered, unknown, null], 0, 0, DEFAULT_SIZE), null);
});

// --- The one on top --------------------------------------------------------------

test('bare ground picks nothing, and nor does the faint last stretch of a slope', () => {
    const mountain = dropped([0, 0]);
    assert.equal(placementAt([], 0, 0, DEFAULT_SIZE), null);
    assert.equal(placementAt([mountain], 5000, 5000, DEFAULT_SIZE), null);

    // Walk out from the peak to the first point a click no longer finds.
    const reach = placementReach(mountain, DEFAULT_SIZE);
    let edge = 0;
    while (reach(edge, 0) > 0) edge += 1;
    assert.equal(placementAt([mountain], edge - 2, 0, DEFAULT_SIZE) == null, reach(edge - 2, 0) < PICK_WEIGHT,
        'the slope a fiftieth of the peak high reads as bare and picks as bare');
});

test('where two mountains overlap, each is picked near its own top', () => {
    const big   = dropped([0, 0], 11, { radius: [2400, 2400] });
    const small = dropped([1200, 0], 12, { radius: [500, 500] });

    assert.equal(placementAt([big, small], 1200, 0, DEFAULT_SIZE), 1, 'the small peak where it stands out of the slope');
    assert.equal(placementAt([small, big], 1200, 0, DEFAULT_SIZE), 0, 'whichever order they were committed in');
    assert.equal(placementAt([big, small], -400, 0, DEFAULT_SIZE), 0, 'and the large one everywhere else');
});

test('a tie goes to the one drawn on top: later in the element order, then later committed', () => {
    const snow  = disc('snow', 0, 0, 2000);
    const grass = disc('grass', 0, 0, 2000);
    assert.equal(placementAt([snow, grass], 0, 0, DEFAULT_SIZE), 0, 'snow settles over grass, wherever it is listed');
    assert.equal(placementAt([grass, snow], 0, 0, DEFAULT_SIZE), 1);

    const first = disc('grass', 0, 0, 2000);
    const again = disc('grass', 100, 0, 2000);
    assert.equal(placementAt([first, again], 0, 0, DEFAULT_SIZE), 1, 'between two of a kind, the later is drawn over the first');
});
