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
    createField, fieldX, fieldZ, sampleHeight, DEFAULT_SIZE, DEFAULT_SEGMENTS
} from '../js/environment/elements.js';
import { applyFootprintedElement } from '../js/environment/footprinted.js';
import {
    placementReach, placementAt, objectBox, rayEntersBox, objectRayAt,
    rayNearsFootprint, rayDistance, clickTravel, travelledPast,
    PICK_WEIGHT, CLICK_TRAVEL, TOUCH_CLICK_TRAVEL
} from '../js/build-select.js';
import { standingObjects, objectFootprint, STAND_SAMPLES } from '../js/objects.js';
import { pickGround } from '../js/build-picking.js';
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

// --- What the box pass reads, and how far it reaches -------------------------
//
// Building a box reads the ground `STAND_SAMPLES` by `STAND_SAMPLES` times
// through `footprintGround`, so the box pass is the expensive half of a pick -
// and a pick runs on every pointer move while Select is live. Two things hold
// it: the ray's own path refuses a footprint it cannot reach before any ground
// is read, and the ground the ray met bounds how far along it a box may be
// taken.

test('a footprint the ray cannot reach is refused, and nothing it could is', () => {
    const near = objectFootprint(tower([0, 0], 80, 200));
    const from = { x: -1000, y: 100, z: 0 };
    const along = { x: 1, y: 0, z: 0 };

    assert.equal(rayNearsFootprint(from, along, near), true, 'straight at it');
    assert.equal(rayNearsFootprint(from, along, objectFootprint(tower([0, 400], 80, 200))), false, 'well off to the side');
    assert.equal(rayNearsFootprint(from, along, objectFootprint(tower([-4000, 0], 80, 200))), false, 'behind where the ray begins');
    assert.equal(rayNearsFootprint(from, along, null), false, 'and nothing is nowhere near anything');

    // The half-diagonal and not the half-width: a square turned 45 degrees
    // reaches its own corner, which is further out than its face.
    const reach = Math.hypot(80, 80) / 2;
    assert.equal(rayNearsFootprint(from, along, objectFootprint(tower([0, reach - 1], 80, 200))), true);
    assert.equal(rayNearsFootprint(from, along, objectFootprint(tower([0, reach + 1], 80, 200))), false);

    // A ray going straight down has a point for its horizontal path, so only a
    // footprint round that point can be entered.
    const down = { x: 0, y: -1, z: 0 };
    assert.equal(rayNearsFootprint({ x: 0, y: 900, z: 0 }, down, near), true);
    assert.equal(rayNearsFootprint({ x: 300, y: 900, z: 0 }, down, near), false);

    // And the limit is in the direction's own lengths: a direction twice as
    // long covers twice the ground per length of it.
    assert.equal(rayNearsFootprint(from, along, near, 900), false, 'the ray stops short of it');
    assert.equal(rayNearsFootprint(from, along, near, 1100), true, 'and reaches it');
    assert.equal(rayNearsFootprint(from, { x: 2, y: 0, z: 0 }, near, 550), true,
        'half as many lengths of a direction twice as long');
});

test('the path refuses only boxes the slab test would refuse anyway', () => {
    // The cull may let a footprint through that the box then misses; it may
    // never refuse one the box would have answered. Swept over a grid of
    // footprints and a fan of rays, every box the slab test enters inside the
    // limit is one the path let through.
    const rays = [];
    for (const pitch of [0, 12, 35, 55, 89, 90]) {
        for (const yaw of [0, 37, 90, 153, 211, 300]) {
            const fall = Math.sin(pitch * Math.PI / 180), flat = Math.cos(pitch * Math.PI / 180);
            rays.push({
                origin: { x: -900, y: 420, z: 260 },
                direction: { x: flat * Math.cos(yaw * Math.PI / 180), y: -fall, z: flat * Math.sin(yaw * Math.PI / 180) }
            });
        }
    }

    let entered = 0;
    for (const { origin, direction } of rays) {
        for (let x = -1600; x <= 1600; x += 160) {
            for (let z = -1600; z <= 1600; z += 160) {
                for (const heading of [0, 30, 45]) {
                    const placement = tower([x, z], 240, 300, heading);
                    const footprint = objectFootprint(placement);
                    const distance = rayEntersBox(origin, direction, objectBox(placement, () => 0));
                    for (const within of [Infinity, 2000, 800]) {
                        if (distance == null || !(distance <= within)) continue;
                        entered++;
                        assert.equal(rayNearsFootprint(origin, direction, footprint, within), true,
                            `a box entered ${distance} along, within ${within}, was refused at (${x}, ${z}) turned ${heading}`);
                    }
                }
            }
        }
    }

    assert.ok(entered > 200, `the sweep has to actually enter some boxes, and entered ${entered}`);
});

test('a pick reads the ground for what the ray could reach, not for the length of the list', () => {
    // The defect this holds: `objectRayAt` built every object's box before
    // testing any of them against the ray, and a box is 25 reads of the
    // terrain. Measured in Chromium, a canvas with 300 objects on it cost
    // 7,500 reads a pointer move and swept at 20 fps, against the 60 the same
    // scene holds with no pick running.
    const reached = tower([0, 0], 80, 200);
    const from = { x: -2000, y: 100, z: 0 };
    const along = { x: 1, y: 0, z: 0 };

    const counted = (placements, within = Infinity) => {
        let reads = 0;
        const index = objectRayAt(placements, from, along, {
            groundAt: () => { reads++; return 0; }, size: DEFAULT_SIZE, within
        });
        return { index, reads };
    };

    const one = counted([reached]);
    assert.equal(one.index, 0, 'the ray reaches it');
    assert.equal(one.reads, STAND_SAMPLES * STAND_SAMPLES, 'one box, read at the sampling a footprint stands by');

    // The same ray, and 300 more objects in a crowd nowhere near its path. The
    // answer is the same and so is the reading: the crowd costs arithmetic.
    const crowd = [];
    for (let i = 0; i < 300; i++) crowd.push(tower([-4000 + (i % 20) * 300, 1600 + Math.floor(i / 20) * 300], 80, 200));
    const many = counted([...crowd, reached]);
    assert.equal(many.index, crowd.length, 'the one on the ray is still what is picked');
    assert.equal(many.reads, one.reads, `300 objects beside the ray are refused unread, not read in ${many.reads}`);

    // A box past where the ray stops is refused unread too, so the limit pays
    // for itself in the pass it was added to.
    const far = counted([tower([4000, 0], 80, 200)], 2000);
    assert.equal(far.index, null);
    assert.equal(far.reads, 0, 'a box beyond the ground is never measured');
});

test('a box entered past the limit is not answered, and the limit refuses boxes rather than the pass', () => {
    const near = tower([-400, 0], 200, 300);
    const far  = tower([400, 0], 200, 300);
    const from = { x: -2000, y: 150, z: 0 };
    const along = { x: 1, y: 0, z: 0 };

    // Where each is entered, so what follows is about the limit rather than
    // about this test's arithmetic.
    assert.equal(rayEntersBox(from, along, objectBox(near, () => 0)), 1500);
    assert.equal(rayEntersBox(from, along, objectBox(far, () => 0)), 2300);

    assert.equal(objectRayAt([far], from, along, { size: DEFAULT_SIZE, within: 2299 }), null,
        'a box entered beyond where the ground was met is behind it');
    assert.equal(objectRayAt([far], from, along, { size: DEFAULT_SIZE, within: 2300 }), 0,
        'and one entered exactly there is in front of it');
    assert.equal(objectRayAt([far], from, along, { size: DEFAULT_SIZE, within: 2301 }), 0);

    // The nearer inside the limit and the further outside it: a limit refuses
    // boxes rather than the whole pass.
    assert.equal(objectRayAt([near, far], from, along, { size: DEFAULT_SIZE, within: 2000 }), 0);

    // `Infinity` is what a ray meeting no ground hands over, and answers what
    // no limit at all answers.
    for (const list of [[near, far], [far, near], [far], []]) {
        assert.equal(objectRayAt(list, from, along, { size: DEFAULT_SIZE, within: Infinity }),
            objectRayAt(list, from, along, { size: DEFAULT_SIZE }));
    }
});

test('a point of a ray is read back as how far along it stands, in the lengths of its own direction', () => {
    const from = { x: 100, y: 800, z: -200 };
    const along = { x: 3, y: -4, z: 0 };
    const at = t => ({ x: from.x + along.x * t, y: from.y + along.y * t, z: from.z + along.z * t });

    assert.equal(rayDistance(from, along, at(0)), 0, 'the origin is nowhere along it');
    assert.equal(rayDistance(from, along, at(17)), 17);
    assert.equal(rayDistance(from, along, at(-3)), -3, 'and a point behind it is behind it');

    // The distance is in the direction's lengths, which is what makes it
    // comparable with `rayEntersBox`.
    const unit = { x: 3 / 5, y: -4 / 5, z: 0 };
    assert.equal(rayDistance(from, unit, at(17)), 17 * 5, '17 lengths of a 5-long direction is 85 unit lengths');

    assert.equal(rayDistance(from, { x: 0, y: 0, z: 0 }, at(1)), Infinity,
        'a direction of nothing is nowhere along anything, and as a limit refuses no box');
});

// --- An object behind the ground -------------------------------------------
//
// A cliff and a tower, built on a real field through the real compositor, with
// the view orbited down to 12 degrees over the ground - `MIN_PITCH` in
// js/build-camera.js is 10, so this is a view a pilot can hold. The three calls
// each sweep makes are the three `pickPlacementAt` makes, in its order.

/** A flat field with an `EDIT EXTRUSION` block raised on it, as the builder raises one. */
function cliffField() {
    const field = createField({ size: DEFAULT_SIZE, segments: DEFAULT_SEGMENTS });
    applyFootprintedElement(field, {
        type: 'extrude',
        config: { height: 400, flatten: 1 },
        footprint: { kind: 'rect', x: -600, z: 0, width: 800, depth: 2400, angle: 0, corner: 0 }
    });
    return field;
}

/** Where a ray meets a field's ground, read as the canvas's own grid, as the page reads it. */
function groundAlong(field, origin, direction) {
    return pickGround(origin, direction, (x, z) => sampleHeight(field, x, z), {
        step: field.step,
        cell: field.step,
        cellOrigin: { x: -field.size / 2, z: -field.size / 2 }
    });
}

test('an object the ground hides is not picked through it', () => {
    const field = cliffField();
    const ground = (x, z) => sampleHeight(field, x, z);
    const placements = [tower([100, 0], 200, 200)];

    // The block is where it was asked for and the tower stands on the flat
    // ground past it, so what follows is about the pick and not about the scene.
    assert.ok(ground(-600, 0) > 399, 'the block stands 400 units up');
    assert.equal(ground(100, 0), 0, 'and the tower is on the flat ground beyond it');

    const fall = Math.sin(12 * Math.PI / 180), flat = Math.cos(12 * Math.PI / 180);
    const direction = { x: flat, y: -fall, z: 0 };

    let hidden = 0;
    for (let i = 0; i < 39; i++) {
        const origin = { x: -7000, y: 1270 + i * 12, z: 0 };
        const point = groundAlong(field, origin, direction);
        // Only the aims whose ground is the block's own face: an aim that
        // carries over the top of it has nothing hiding the tower.
        if (point == null || point.x > -100) continue;

        // The defect: asked over the whole ray, the box pass answers a tower
        // the block is standing in front of.
        if (objectRayAt(placements, origin, direction, { groundAt: ground, size: DEFAULT_SIZE }) == null) continue;
        hidden++;

        const within = rayDistance(origin, direction, point);
        assert.equal(objectRayAt(placements, origin, direction, { groundAt: ground, size: DEFAULT_SIZE, within }), null,
            `aimed from y ${origin.y} the ground is met at x ${Math.round(point.x)} and the tower is behind it`);
    }

    assert.ok(hidden >= 8, `the sweep has to find the defect to hold the fix, and found it ${hidden} times`);
});

test('a tower in plain view is still picked, bound by the ground behind it', () => {
    const field = cliffField();
    const ground = (x, z) => sampleHeight(field, x, z);
    const placements = [tower([100, 0], 200, 200)];

    // From the east, where nothing stands between the camera and the tower,
    // down the same 12 degrees.
    const fall = Math.sin(12 * Math.PI / 180), flat = Math.cos(12 * Math.PI / 180);
    const direction = { x: -flat, y: -fall, z: 0 };

    let picked = 0;
    for (let i = 0; i < 39; i++) {
        const origin = { x: 7000, y: 1460 + i * 8, z: 0 };
        if (objectRayAt(placements, origin, direction, { groundAt: ground, size: DEFAULT_SIZE }) == null) continue;
        picked++;

        const point = groundAlong(field, origin, direction);
        const within = point ? rayDistance(origin, direction, point) : Infinity;
        assert.equal(objectRayAt(placements, origin, direction, { groundAt: ground, size: DEFAULT_SIZE, within }), 0,
            `aimed from y ${origin.y} the tower is in plain view and is what is picked`);
    }

    assert.ok(picked >= 8, `the sweep has to cross the tower to hold anything, and crossed it ${picked} times`);
});
