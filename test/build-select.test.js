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
    placementReach, placementAt, objectBox, rayEntersBox, objectRayAt, clickTravel, travelledPast,
    PICK_WEIGHT, CLICK_TRAVEL, TOUCH_CLICK_TRAVEL
} from '../js/build-select.js';
import { standingObjects } from '../js/objects.js';
import { ERASE_TYPE } from '../js/environment/erase.js';

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

// --- An object picked by its own box ----------------------------------------
//
// A built element is a write into the ground and is picked by what reaches a
// point of it. An object is not: it stands over the ground, so a click on its
// upper floors has to be answered by the object rather than by whatever reaches
// the ground the click's ray carries on to.

/**
 * A tower `height` units tall and `width` across, standing at a point. A box
 * part sits with its base at its own `at` and rises by its height, so a tower
 * standing on the ground is one at the origin of its recipe's frame.
 */
function tower(at, width = 80, height = 200, heading = 0) {
    return {
        type: 'object',
        recipe: { parts: [{ shape: 'box', size: [width, height, width], at: [0, 0, 0], color: 0x888888 }] },
        config: { at, heading, scale: 1 }
    };
}

test('an object stands in a box from the ground under it to the top of its highest part', () => {
    const box = objectBox(tower([400, -600], 80, 200), () => 0);

    assert.equal(box.x, 400);
    assert.equal(box.z, -600);
    assert.equal(box.width, 80);
    assert.equal(box.depth, 80);
    assert.equal(box.bottom, 0);
    assert.equal(box.top, 200, 'the height of its highest part, over the ground it stands on');

    // On ground that stands somewhere, the box stands on it rather than at sea
    // level - and reaches down to the lowest ground under its footprint, which
    // is what the plinth fills.
    const slope = (x) => 100 + x / 100;
    const sloped = objectBox(tower([0, 0], 80, 200), (x) => slope(x));
    assert.equal(sloped.bottom, slope(-40), 'the lowest ground under the footprint');
    assert.equal(sloped.top, slope(40) + 200, 'and the top above the highest');

    assert.equal(objectBox(dropped([0, 0]), () => 0), null, 'a built element is no object');
    assert.equal(objectBox({ type: 'object', recipe: { parts: [] }, config: { at: [0, 0] } }, () => 0), null,
        'nor is an object with nothing in its recipe');
});

test('a ray meets a box where it enters it, and misses one it goes past', () => {
    const box = objectBox(tower([0, 0], 80, 200), () => 0);

    // Straight down the middle from above: it enters at the top.
    assert.equal(rayEntersBox({ x: 0, y: 1000, z: 0 }, { x: 0, y: -1, z: 0 }, box), 800,
        'at the roof, 800 units down from 1000');

    // And from the side: at the near face.
    assert.equal(rayEntersBox({ x: -1000, y: 100, z: 0 }, { x: 1, y: 0, z: 0 }, box), 960, 'at the near wall');

    assert.equal(rayEntersBox({ x: 0, y: 1000, z: 0 }, { x: 0, y: 1, z: 0 }, box), null, 'a ray climbing away misses');
    assert.equal(rayEntersBox({ x: 500, y: 1000, z: 0 }, { x: 0, y: -1, z: 0 }, box), null, 'as does one coming down beside it');
    assert.equal(rayEntersBox({ x: 0, y: 300, z: 0 }, { x: 1, y: 0, z: 0 }, box), null, 'and one passing over the roof');
    assert.equal(rayEntersBox({ x: 0, y: 100, z: 0 }, { x: 0, y: -1, z: 0 }, box), 0,
        'a ray starting inside is inside: the camera is in the building');
    assert.equal(rayEntersBox({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, box), 0,
        'a direction of nothing, from inside, is still inside');
    assert.equal(rayEntersBox({ x: 500, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, box), null, 'and from outside it reaches nothing');
    assert.equal(rayEntersBox({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, null), null, 'nothing has no box to enter');

    // The direction need not be of unit length: the distance comes back in its
    // own lengths, which is all a nearest-first comparison needs.
    assert.equal(rayEntersBox({ x: 0, y: 1000, z: 0 }, { x: 0, y: -2, z: 0 }, box), 400,
        'half as many lengths of a direction twice as long');
});

test('a box turned to its heading is entered on its own faces, not on the axes', () => {
    // A tower turned 45 degrees. A ray down a point near the corner of the
    // square box is inside it; the same point is outside the box turned under
    // it, because a corner swept round is nearer the middle.
    const turned = objectBox(tower([0, 0], 80, 200, 45), () => 0);
    const square = objectBox(tower([0, 0], 80, 200, 0), () => 0);

    assert.equal(turned.angle, 45 * Math.PI / 180);
    assert.equal(square.angle, 0);

    const corner = { x: 38, y: 1000, z: 38 };
    assert.equal(rayEntersBox(corner, { x: 0, y: -1, z: 0 }, square), 800, 'inside the square box, near its corner');
    assert.equal(rayEntersBox(corner, { x: 0, y: -1, z: 0 }, turned), null, 'and outside the same box turned under it');
});

test('a click on a tall object picks it, not the ground its ray carries on to', () => {
    // The defect this fixed, as the item measured it: a 200 unit tower standing
    // on flat ground, and a ray coming down at 55 degrees. The ray crosses the
    // tower well above the ground and carries on to ground far beyond it.
    const standing = tower([0, 0], 80, 200);

    const fall = Math.tan(55 * Math.PI / 180);
    const aimed = { x: -300, y: 200 + 300 * fall, z: 0 };
    const direction = { x: 1, y: -fall, z: 0 };

    // Where the ray meets the flat ground, which is where a pick by ground
    // point would have asked its question: well past the tower.
    const beyond = aimed.x + aimed.y / fall;
    assert.ok(beyond > 100, `the ground point lands ${Math.round(beyond)} units past the tower`);

    const ground = disc('grass', beyond, 0, 300);
    const placements = [ground, standing];

    // The ray's own geometry next, so what follows is a test of the pick rather
    // than of this test's arithmetic: it crosses the tower's box well up its
    // side.
    const met = rayEntersBox(aimed, direction, objectBox(standing, () => 0));
    assert.ok(met != null, 'the ray does cross the tower');
    assert.ok(aimed.y + direction.y * met > 100, 'well up its side rather than at its foot');

    assert.equal(objectRayAt(placements, aimed, direction, { size: DEFAULT_SIZE }), 1, 'the tower is what is picked');
    assert.equal(placementAt(placements, beyond, 0, DEFAULT_SIZE), 0,
        'where the ground pick answered the patch of grass the ray carried on to');
});

test('where a ray crosses two objects it picks the one in front', () => {
    const near = tower([-400, 0], 200, 300);
    const far  = tower([400, 0], 200, 300);

    // Level, from the left: it enters the near one first, whichever order they
    // were committed in.
    const from = { x: -2000, y: 150, z: 0 };
    assert.equal(objectRayAt([near, far], from, { x: 1, y: 0, z: 0 }, { size: DEFAULT_SIZE }), 0);
    assert.equal(objectRayAt([far, near], from, { x: 1, y: 0, z: 0 }, { size: DEFAULT_SIZE }), 1);

    // And from the right, the other one.
    assert.equal(objectRayAt([near, far], { x: 2000, y: 150, z: 0 }, { x: -1, y: 0, z: 0 }, { size: DEFAULT_SIZE }), 1);

    assert.equal(objectRayAt([near, far], { x: 0, y: 1000, z: 0 }, { x: 0, y: -1, z: 0 }, { size: DEFAULT_SIZE }), null,
        'and a ray down the gap between them meets neither');
});

test('only an object is picked this way, and never one a later batch erased', () => {
    const standing = tower([0, 0], 80, 200);
    const from = { x: 0, y: 1000, z: 0 };
    const down = { x: 0, y: -1, z: 0 };

    assert.equal(objectRayAt([dropped([0, 0]), standing], from, down, { size: DEFAULT_SIZE }), 1,
        'a mountain is no box to be hit: it is ground that stands higher');
    assert.equal(objectRayAt([dropped([0, 0])], from, down, { size: DEFAULT_SIZE }), null);
    assert.equal(objectRayAt([], from, down, { size: DEFAULT_SIZE }), null);
    assert.equal(objectRayAt(null, from, down, { size: DEFAULT_SIZE }), null);

    // An object a later batch took is not drawn, so it is not there to pick -
    // the same reading `standingObjects` makes of the list.
    const erased = [standing, {
        type: ERASE_TYPE,
        config: {},
        footprint: { kind: 'disc', x: 0, z: 0, radius: 400 }
    }];
    assert.equal(objectRayAt(erased, from, down, { size: DEFAULT_SIZE }), null);
    assert.equal(objectRayAt([standing], from, down, { size: DEFAULT_SIZE }), 0, 'and is picked again without the batch');
});

test('the box a click is tested against is where the building was drawn', () => {
    // One reading of the ground under a footprint, so the box and the building
    // cannot disagree about where the building is. On a slope they would
    // otherwise differ by the fall across the footprint.
    const slope = (x, z) => 200 + x / 20 + z / 40;
    const standing = tower([600, -300], 240, 180, 25);

    const [drawn] = standingObjects([standing], { groundAt: slope, size: DEFAULT_SIZE });
    const box = objectBox(standing, slope);

    assert.equal(box.top, drawn.top, 'the roof a click meets is the roof that was drawn');
    assert.equal(box.bottom, drawn.base, 'and the foot of it is the foot of the plinth');
    assert.equal(box.x, drawn.footprint.x);
    assert.equal(box.z, drawn.footprint.z);
    assert.equal(box.angle, drawn.footprint.angle);
});
