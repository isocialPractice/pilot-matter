import test from 'node:test';
import assert from 'node:assert/strict';
import {
    footprintWeight, footprintBounds, footprintSampler, isFootprint, featherFor, footprintReach,
    FOOTPRINT_KINDS, FEATHER_CELLS, FEATHER_SHARE, DEFAULT_FEATHER
} from '../js/environment/footprints.js';
import { DEFAULT_SIZE, DEFAULT_SEGMENTS, createField } from '../js/environment/elements.js';
import { paintStamp, SOFT_EDGE } from '../js/build-tools.js';

/**
 * One of each kind, well clear of the canvas edges, so a weight read in the
 * middle of one is not also being read at the edge of another.
 *
 * Every kind is written with a hard edge - `feather: 0` - except where the
 * feather is what is being measured. A region's weight is its signed distance
 * put through the feather, so a hard edge is the geometry on its own, which is
 * what most of these are about.
 */
const DISC    = { kind: 'disc', x: 0, z: 0, radius: 1000, feather: 0 };
const RING    = {
    kind: 'ring',
    points: [[-1000, -1000], [1000, -1000], [1000, 1000], [-1000, 1000]],
    feather: 0
};
const STROKE  = {
    kind: 'stroke',
    points: [[-1000, 0], [1000, 0]],
    stamp: { width: 400, depth: 400, corner: 0 },
    feather: 0
};
const RECT    = { kind: 'rect', x: 0, z: 0, width: 2000, depth: 1000, angle: 0, corner: 0, feather: 0 };
const ELLIPSE = { kind: 'ellipse', x: 0, z: 0, radiusX: 2000, radiusZ: 500, angle: 0, feather: 0 };

const EVERY_KIND = [
    ['disc', DISC], ['ring', RING], ['stroke', STROKE], ['rect', RECT], ['ellipse', ELLIPSE]
];

test('the vocabulary is the seven kinds a pointer can draw', () => {
    assert.deepEqual([...FOOTPRINT_KINDS], ['disc', 'ring', 'stroke', 'rect', 'ellipse', 'polygon', 'path']);

    for (const [name, footprint] of EVERY_KIND) {
        assert.ok(FOOTPRINT_KINDS.includes(name), `${name} should be in the vocabulary`);
        assert.equal(footprint.kind, name, `the ${name} fixture should be one`);
    }
});

// The weight is what every drawing tool after this reads, so the two ends of it
// are what everything else is built on: a point in the middle of a region is
// covered by it, and a point well outside is not touched at all.
test('every kind weighs everything at its middle and nothing well outside it', () => {
    for (const [name, footprint] of EVERY_KIND) {
        assert.equal(footprintWeight(footprint, 0, 0), 1, `${name} should cover its own middle`);
        assert.equal(footprintWeight(footprint, 9000, 9000), 0,
            `${name} should not reach the far corner of the canvas`);
    }
});

test('a point outside a region weighs nothing even where its square would reach', () => {
    // The corner of the box round a disc is outside the disc, which is the
    // difference between a region and the square a caller skips tiles with.
    assert.equal(footprintWeight(DISC, 900, 900), 0, 'a disc is round and its bounds are not');
    // And the long way across an ellipse is inside it where the short way out.
    assert.equal(footprintWeight(ELLIPSE, 1800, 0), 1, 'inside along the long axis');
    assert.equal(footprintWeight(ELLIPSE, 0, 700), 0, 'outside across the short one');
});

test('a region turned about its centre is turned, rather than drawn square', () => {
    const upright = { ...RECT, angle: 0 };
    const turned  = { ...RECT, angle: Math.PI / 2 };

    // 2000 wide by 1000 deep: a point 800 out along x is inside the upright one
    // and outside the same rectangle stood on end.
    assert.equal(footprintWeight(upright, 800, 0), 1);
    assert.equal(footprintWeight(turned, 800, 0), 0);
    assert.equal(footprintWeight(turned, 0, 800), 1, 'and the depth is now across x');
});

// The feather is what keeps a dropped mountain from ending at a cliff of its
// own edge, so what it has to be is monotonic: every step outward covers less
// than the step before it, with no reversal anywhere across the band.
test('the weight falls across the feather and never climbs back', () => {
    const feathered = { ...DISC, feather: 200 };

    let last = Infinity;
    for (let at = 700; at <= 1100; at += 20) {
        const weight = footprintWeight(feathered, at, 0);
        assert.ok(weight <= last, `the weight should not climb again at ${at}`);
        assert.ok(weight >= 0 && weight <= 1, `the weight at ${at} should be a fraction`);
        last = weight;
    }

    assert.equal(footprintWeight(feathered, 700, 0), 1, 'a feather in is covered outright');
    assert.equal(footprintWeight(feathered, 1100, 0), 0, 'and the band ends at the radius');
    const half = footprintWeight(feathered, 900, 0);
    assert.ok(half > 0 && half < 1, 'with the middle of the band part covered');
});

/**
 * The band at an ellipse's edge is measured in the units of the axis it is
 * tightest on, which is what keeps a long thin one soft across its own width.
 *
 * The fixture is 2000 by 500, so a point 100 units inside the short edge is
 * halfway across a 200-unit band and part covered. Measured against the long
 * radius instead it would be four bands in and covered outright - and a stroke
 * of water drawn as a thin ellipse would have a hard edge down both its sides
 * while reading as feathered at its ends.
 */
test('an ellipse feathers across the axis it is tightest on', () => {
    const feathered = { ...ELLIPSE, feather: 200 };

    const across = footprintWeight(feathered, 0, 400);
    assert.ok(across > 0 && across < 1,
        `the short edge should carry a band, and it weighed ${across}`);
    assert.equal(footprintWeight(feathered, 0, 250), 1, 'with everything inside it covered');
});

test('a region with no feather has an edge rather than a band', () => {
    assert.equal(footprintWeight(DISC, 999, 0), 1);
    assert.equal(footprintWeight(DISC, 1001, 0), 0);
});

/**
 * The feather defaults to the field's own sampling rather than to a number, so
 * the softness of an edge is a property of how finely the world is drawn. A
 * region that ended inside one cell would end at a cliff whatever that cliff
 * was drawn at.
 */
test('the feather a region gets by default is measured off the sampling', () => {
    const field = createField();
    assert.equal(featherFor(field.step), field.step * FEATHER_CELLS);
    assert.equal(DEFAULT_FEATHER, featherFor(DEFAULT_SIZE / DEFAULT_SEGMENTS));
    assert.ok(DEFAULT_FEATHER > 0, 'and it is a band rather than an edge');

    const stated = { kind: 'disc', x: 0, z: 0, radius: 1000 };
    assert.ok(footprintWeight(stated, 1000 - DEFAULT_FEATHER / 2, 0) < 1,
        'a region that states no feather still has one');
});

test('a stroke is the swathe the stamp was swept along, not a stamp per sample', () => {
    // 400 wide, drawn from -1000 to 1000 along x: the middle of the way is
    // inside it, which a stroke drawn as stamps at the samples would not be.
    assert.equal(footprintWeight(STROKE, 0, 0), 1, 'the middle of the way is covered');
    assert.equal(footprintWeight(STROKE, 500, 150), 1, 'and so is the width either side of it');
    assert.equal(footprintWeight(STROKE, 500, 250), 0, 'past the half-width it is not');
    // The sweep reaches half a stamp past each end rather than stopping at the
    // sample, which is what a stamp swept whole means.
    assert.equal(footprintWeight(STROKE, 1150, 0), 1, 'the stamp reaches past the last sample');
    assert.equal(footprintWeight(STROKE, 1250, 0), 0, 'but only by half of itself');
});

/**
 * `STROKE` is drawn along x, which is one of the two directions a stamp turned
 * by the wrong sign still lands square in, so the swathe has to be read at an
 * angle to be read at all. Every direction rather than one: the error this
 * holds against grows with the angle and comes back to nothing at 90 degrees,
 * so a single diagonal would pin one sample of it.
 */
test('a stroke follows the way the drag went, whatever direction that was', () => {
    const HALF = 1000, WIDTH = 400;

    for (let degrees = 0; degrees < 360; degrees += 15) {
        const angle = degrees * Math.PI / 180;
        const ux = Math.cos(angle), uz = Math.sin(angle);
        const drag = {
            kind: 'stroke', feather: 0,
            points: [[-HALF * ux, -HALF * uz], [HALF * ux, HALF * uz]],
            stamp: { width: WIDTH, depth: WIDTH, corner: 0 }
        };

        // Three quarters of the way along the drag, which is inside the swathe
        // whichever way it went.
        const alongX = 750 * ux, alongZ = 750 * uz;
        assert.equal(footprintWeight(drag, alongX, alongZ), 1,
            `a drag at ${degrees} degrees should cover its own way`);

        // And the same distance across it, which is well past the half-width.
        const acrossX = -750 * uz, acrossZ = 750 * ux;
        assert.equal(footprintWeight(drag, acrossX, acrossZ), 0,
            `a drag at ${degrees} degrees should not cover what is across it`);
    }
});

/**
 * A pointer is sampled every few pixels, so a drag is many short stretches. Laid
 * as boxes end to end, a point on the way is always near the end of two of them
 * and never more than half the stamp's depth inside either - and a stamp
 * shallower than its feather is wide comes to a stroke only part covered down
 * its middle. Measured from the way itself, the middle is the stamp's half-width
 * in, whatever the samples did.
 */
test('a stroke sampled every few pixels is whole down its middle, however shallow its stamp', () => {
    const drag = {
        kind: 'stroke',
        points: Array.from({ length: 40 }, (_, i) => [i * 37, Math.sin(i / 3) * 60]),
        stamp: { width: 547, depth: 182, corner: 46 }
    };
    // Away from its two ends, where the end itself is within a feather.
    for (const [x, z] of drag.points.slice(4, -4)) assert.equal(footprintWeight(drag, x, z), 1, `at ${x}`);
    for (let i = 4; i < 35; i++) {
        const [ax, az] = drag.points[i], [bx, bz] = drag.points[i + 1];
        assert.equal(footprintWeight(drag, (ax + bx) / 2, (az + bz) / 2), 1, 'and between the samples');
    }

    // 600 across the way it went, so its reach is 300 and its feather is held
    // to 150 - see `FEATHER_SHARE`. A half-depth of 100 is 50 short of that, so
    // the last 50 units of the stroke are feathered and the rest is whole.
    const shallow = { kind: 'stroke', points: [[-2000, 0], [2000, 0]], stamp: { width: 600, depth: 200, corner: 0 } };
    assert.ok(footprintWeight(shallow, 1990, 0) < 1,
        'a shallow stamp\'s end face is under a feather from the last sample, and feathers what is short of it too');
    assert.equal(footprintWeight(shallow, 1800, 0), 1, 'and only that');

    const long = { kind: 'stroke', points: [[-2000, 0], [2000, 0]], stamp: { width: 600, depth: 400, corner: 0 } };
    assert.equal(footprintWeight(long, 2000, 0), 1, 'a long stroke is whole out to its last sample, a feather short of its end');
    let last = Infinity;
    for (let x = 1500; x <= 2300; x += 10) {
        const weight = footprintWeight(long, x, 0);
        assert.ok(weight <= last, `and falls without climbing past it, at ${x}`);
        last = weight;
    }
});

test('a stroke that turns is joined round at the bend, and its ends are the stamp\'s', () => {
    const bend = { kind: 'stroke', points: [[0, 0], [1000, 0], [1000, 1000]], stamp: { width: 400, depth: 200, corner: 0 }, feather: 0 };
    assert.equal(footprintWeight(bend, 1100, -100), 1, 'inside the round of the bend');
    assert.equal(footprintWeight(bend, 1150, -150), 0, 'and not the square corner a notch or a box would leave');
    assert.equal(footprintWeight(bend, -50, 0), 1, 'half the stamp\'s depth past the first sample');
    assert.equal(footprintWeight(bend, -150, 0), 0, 'and no further, though half its width is further');
    assert.equal(footprintWeight(bend, 1000, 1090), 1);
    assert.equal(footprintWeight(bend, 1000, 1110), 0);

    const rounded = { ...bend, stamp: { width: 400, depth: 200, corner: 100 } };
    assert.equal(footprintWeight(rounded, 1190, 1090), 0, 'the stamp\'s corners rounded at the end');
    assert.equal(footprintWeight(bend, 1190, 1090), 1, 'which a square stamp keeps');
});

test('a sample that landed on the one before it leaves the stroke\'s ends the stamp\'s', () => {
    // A pointer let go of where it last moved to repeats its last sample, and
    // one pressed and held a moment repeats its first.
    const held = { kind: 'stroke', points: [[0, 0], [0, 0], [1000, 0], [1000, 0]], stamp: { width: 600, depth: 200, corner: 0 }, feather: 0 };
    assert.equal(footprintWeight(held, 1090, 0), 1);
    assert.equal(footprintWeight(held, 1200, 0), 0, 'half the stamp\'s depth past the end, not half its width');
    assert.equal(footprintWeight(held, -90, 0), 1);
    assert.equal(footprintWeight(held, -200, 0), 0, 'and the same at the start');
});

test('a stroke that never travelled is the one stamp it was pressed as', () => {
    const pressed = { ...STROKE, points: [[0, 0]] };

    assert.equal(footprintWeight(pressed, 0, 0), 1);
    assert.equal(footprintWeight(pressed, 150, 150), 1, 'the stamp is 400 by 400 about the press');
    assert.equal(footprintWeight(pressed, 250, 0), 0);
});

test('a round brush tip is the stamp with its corner at half its width', () => {
    const round = {
        kind: 'stroke', points: [[0, 0]], feather: 0,
        stamp: { width: 400, depth: 400, corner: 200 }
    };

    assert.equal(footprintWeight(round, 190, 0), 1, 'inside along an axis');
    assert.equal(footprintWeight(round, 190, 190), 0, 'and outside at the corner, which a square tip covers');
});

test('a ring is the outline it was drawn as, inside and out', () => {
    assert.equal(footprintWeight(RING, 0, 0), 1);
    assert.equal(footprintWeight(RING, 990, 990), 1, 'the corner of a square outline is inside it');
    assert.equal(footprintWeight(RING, 1010, 0), 0);

    // A shape with a bite out of it is the shape it was drawn as rather than
    // the box round it, which is the whole reason a lasso is a list of points.
    const bitten = {
        kind: 'ring', feather: 0,
        points: [[-1000, -1000], [1000, -1000], [1000, 1000], [0, 0], [-1000, 1000]]
    };
    assert.equal(footprintWeight(bitten, 0, -500), 1, 'inside the part that is still there');
    assert.equal(footprintWeight(bitten, 0, 800), 0, 'and outside the part cut away');
});

// A lasso sampled down to two points is a line rather than a region, and
// clipping every tool to a thread is worse than discarding the gesture.
test('an outline of fewer than three points is not a region at all', () => {
    for (const points of [[], [[0, 0]], [[0, 0], [100, 0]]]) {
        const thread = { kind: 'ring', points, feather: 0 };

        assert.equal(footprintWeight(thread, 0, 0), 0, `${points.length} points should cover nothing`);
        assert.equal(footprintBounds(thread), null, 'and have no square to skip a tile by');
        assert.equal(isFootprint(thread), false, 'and not read as a footprint');
    }
});

test('a region described with nothing to draw covers nothing rather than everything', () => {
    const empty = [
        { kind: 'disc', x: 0, z: 0, radius: 0 },
        { kind: 'rect', x: 0, z: 0, width: 0, depth: 500 },
        { kind: 'ellipse', x: 0, z: 0, radiusX: 500, radiusZ: 0 },
        { kind: 'stroke', points: [[0, 0]], stamp: { width: 0, depth: 400 } },
        { kind: 'polygon', x: 0, z: 0, radius: 500 },
        { kind: 'nonsense' },
        {},
        null,
        undefined
    ];

    for (const footprint of empty) {
        assert.equal(footprintWeight(footprint, 0, 0), 0,
            `${JSON.stringify(footprint)} should cover nothing`);
        assert.equal(isFootprint(footprint), false);
    }
});

// A placement with no footprint is exactly what a placement is today, so the
// absence of one is never a region that covers nothing - the caller does not
// ask at all. What is held here is that asking anyway is the safe answer.
test('no footprint is no region, which is what the generators keep working on', () => {
    assert.equal(footprintWeight(undefined, 0, 0), 0);
    assert.equal(footprintBounds(undefined), null);
});

test('the square round a region contains it, feather included', () => {
    for (const [name, footprint] of EVERY_KIND) {
        const edge = 240;
        const bounds = footprintBounds({ ...footprint, feather: edge });
        assert.ok(bounds, `${name} should report a square`);

        // Every point the region covers is inside the square, walked as a grid
        // over everything either of them could reach.
        for (let x = -3000; x <= 3000; x += 100) {
            for (let z = -3000; z <= 3000; z += 100) {
                if (footprintWeight({ ...footprint, feather: edge }, x, z) <= 0) continue;

                assert.ok(x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ,
                    `${name} covers ${x},${z}, which its square does not contain`);
            }
        }
    }
});

test('the square grows by the feather rather than ending at the region', () => {
    const hard = footprintBounds({ ...DISC, feather: 0 });
    const soft = footprintBounds({ ...DISC, feather: 300 });

    assert.deepEqual(hard, { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 });
    assert.deepEqual(soft, { minX: -1300, maxX: 1300, minZ: -1300, maxZ: 1300 });
});

// A stamp can be swept any way along a stroke and a rectangle can be turned to
// any angle, so the square round either is its own diagonal: a square taken
// from the width alone would cut the corner off a region drawn at 45 degrees.
test('a square round something that turns is wide enough for every angle it can take', () => {
    const across = footprintBounds({ ...RECT, angle: Math.PI / 4, feather: 0 });
    const reach  = Math.hypot(2000, 1000) / 2;

    assert.ok(across.maxX >= reach - 1, 'the square should hold the rectangle on its corner');

    const diagonal = {
        kind: 'stroke', feather: 0, points: [[0, 0], [1000, 1000]],
        stamp: { width: 400, depth: 1000, corner: 0 }
    };
    const bounds = footprintBounds(diagonal);
    for (const point of [[0, 0], [1000, 1000], [-300, -300], [1300, 1300]]) {
        if (footprintWeight(diagonal, point[0], point[1]) <= 0) continue;
        assert.ok(point[0] >= bounds.minX && point[0] <= bounds.maxX,
            `the square should contain ${point}`);
        assert.ok(point[1] >= bounds.minZ && point[1] <= bounds.maxZ,
            `the square should contain ${point}`);
    }
});

/**
 * A footprint is data on a placement, and a placement has to survive both the
 * copy `recordWorld` takes of an ask and the comparison `sameWorld` makes
 * between two of them. So anything a region is described with has to be
 * JSON-shaped, which is the one property that is not about arithmetic at all.
 */
test('a region is JSON-shaped, so a placement carrying one still is', () => {
    for (const [name, footprint] of EVERY_KIND) {
        const copied = structuredClone(footprint);
        assert.deepEqual(copied, footprint, `${name} should survive being cloned`);
        assert.equal(JSON.stringify(copied), JSON.stringify(footprint),
            `${name} should compare the way sameWorld compares one`);
        assert.equal(footprintWeight(copied, 0, 0), footprintWeight(footprint, 0, 0),
            `${name} should weigh the same after the round trip`);
    }
});

/**
 * The coordinates are the canvas's rather than the world's, which is what makes
 * a built tile a pattern: each tile subtracts its own origin before asking, so
 * the same region lands in the same place on every tile.
 *
 * There is nothing in the module to hold to that - it takes two numbers - so
 * what is held is the consequence: a region 2000 units from the middle of the
 * canvas is 2000 units from the middle of every tile, whichever world
 * coordinate that comes to.
 */
test('a region is read in the canvas frame, so every tile puts it in the same place', () => {
    const region = { kind: 'disc', x: 2000, z: 0, radius: 500, feather: 0 };

    for (const origin of [0, DEFAULT_SIZE, -DEFAULT_SIZE * 3]) {
        const field = createField({ originX: origin, originZ: origin });
        const worldX = field.originX + 2000;
        const worldZ = field.originZ;

        assert.equal(footprintWeight(region, worldX - field.originX, worldZ - field.originZ), 1,
            `the region should land 2000 east of the middle of the tile at ${origin}`);
    }
});

// --- The wrap ----------------------------------------------------------------

const HALF = DEFAULT_SIZE / 2;

/**
 * A region drawn over one edge of the canvas carries on across the opposite
 * edge, because the canvas is the tile the world repeats: what reaches past
 * the east edge of one tile is the ground at the west edge of the next.
 */
test('a region over one edge of the canvas carries on across the opposite one', () => {
    const over = { kind: 'disc', x: HALF, z: 0, radius: 1000, feather: 300 };

    for (const inward of [0, 200, 500, 800, 990]) {
        const east = footprintWeight(over, HALF - inward, 0, DEFAULT_SIZE);
        const west = footprintWeight(over, -HALF + inward, 0, DEFAULT_SIZE);

        assert.ok(east > 0, `${inward} in from the east edge should be inside the disc`);
        assert.ok(Math.abs(east - west) < 1e-12,
            `${inward} in from either edge should weigh the same, and it was ${east} against ${west}`);
    }
});

/**
 * The seam itself: the east edge of one tile and the west edge of the next are
 * the same ground, so a region has to weigh the same at both - and only the
 * wrap makes it, which is what this pins.
 */
test('the two edges of a seam weigh the same, and only because of the wrap', () => {
    const over = { kind: 'stroke', points: [[HALF - 600, -900], [HALF + 600, 900]],
        stamp: { width: 500, depth: 300, corner: 100 }, feather: 200 };

    let reached = 0;
    for (let z = -HALF; z <= HALF; z += 80) {
        const leaving  = footprintWeight(over, HALF, z, DEFAULT_SIZE);
        const arriving = footprintWeight(over, -HALF, z, DEFAULT_SIZE);
        assert.ok(Math.abs(leaving - arriving) < 1e-12, `the seam steps at z ${z}: ${leaving} against ${arriving}`);
        if (leaving > 0) reached++;
    }
    assert.ok(reached > 0, 'the stroke should cross the seam somewhere along it');

    const unwrapped = footprintWeight(over, -HALF, 0);
    const wrapped   = footprintWeight(over, -HALF, 0, DEFAULT_SIZE);
    assert.equal(unwrapped, 0, 'with the wrap off, the far side of the seam is bare');
    assert.ok(wrapped > 0, 'and with it on, the stroke carries across');
});

test('the wrap leaves a region in the middle of the canvas exactly as it was', () => {
    for (const [name, footprint] of EVERY_KIND) {
        for (let x = -3000; x <= 3000; x += 250) {
            for (let z = -3000; z <= 3000; z += 250) {
                assert.equal(footprintWeight(footprint, x, z, DEFAULT_SIZE), footprintWeight(footprint, x, z),
                    `${name} at ${x},${z} should weigh what it always did`);
            }
        }
    }
});

// A union never takes away: a point weighs at least what the region alone gave
// it, and never more than all of it, however the repeats overlap.
test('the repeats are a union, never weaker than the region and never more than whole', () => {
    const wide = { kind: 'rect', x: HALF - 2000, z: HALF - 1000, width: 9000, depth: 7000, angle: 0.3, corner: 400 };

    for (let x = -HALF; x <= HALF; x += 400) {
        for (let z = -HALF; z <= HALF; z += 400) {
            const alone   = footprintWeight(wide, x, z);
            const wrapped = footprintWeight(wide, x, z, DEFAULT_SIZE);
            assert.ok(wrapped >= alone, `${x},${z} lost weight to the wrap`);
            assert.ok(wrapped <= 1, `${x},${z} weighs more than all of itself`);
        }
    }
});

test('a sampler answers what the weight answers, wrapped or not', () => {
    for (const [name, footprint] of EVERY_KIND) {
        const plain   = footprintSampler(footprint);
        const wrapped = footprintSampler({ ...footprint, x: (footprint.x ?? 0) + HALF - 300 }, DEFAULT_SIZE);

        for (let x = -HALF; x <= HALF; x += 500) {
            for (let z = -HALF; z <= HALF; z += 500) {
                assert.equal(plain(x, z), footprintWeight(footprint, x, z), `${name} unwrapped at ${x},${z}`);
                assert.equal(wrapped(x, z),
                    footprintWeight({ ...footprint, x: (footprint.x ?? 0) + HALF - 300 }, x, z, DEFAULT_SIZE),
                    `${name} wrapped at ${x},${z}`);
            }
        }
    }
});

test('a region nobody can read covers nothing, wrapped or not', () => {
    for (const nothing of [null, { kind: 'disc', radius: 0 }, { kind: 'cloud' }]) {
        assert.equal(footprintWeight(nothing, 0, 0, DEFAULT_SIZE), 0);
        assert.equal(footprintSampler(nothing, DEFAULT_SIZE)(HALF, HALF), 0);
    }
});

/**
 * The figure a soft brush's edge comes to, written down rather than left as
 * whatever two constants multiply to.
 *
 * `SOFT_EDGE` used to be 0.5 and `paintStamp` asked for half the stamp's
 * width - which is also the stroke's own reach, so the hold took half of it
 * back and every value from 0.5 up came to the same quarter. The constant is
 * now read off `FEATHER_SHARE`, so the feather asked for is the feather used,
 * and these are the three sizes the halved edge was measured at.
 */
test('a soft brush eases across a quarter of its width, which is the widest band the hold allows', () => {
    const band = (edge, pixels) => {
        const stamp = paintStamp({ edge, size: pixels }, 1);
        const stroke = {
            kind: 'stroke', points: [[-2000, 0], [2000, 0]],
            stamp: { width: stamp.width, depth: stamp.depth, corner: stamp.corner }, feather: stamp.feather
        };
        // Read through the real path: how far in from the stroke's own reach
        // the weight is still short of whole, down the middle of its length.
        const reach = footprintReach(stroke);
        let inside = 0;
        while (inside <= reach && footprintWeight(stroke, 0, reach - inside) < 1) inside += reach / 20000;
        return { asked: stamp.feather, used: inside, reach };
    };

    assert.equal(SOFT_EDGE, FEATHER_SHARE / 2, 'a quarter, read off the hold rather than written beside it');

    for (const [pixels, feather] of [[25, 6.25], [100, 25], [400, 100]]) {
        const soft = band('soft', pixels);
        assert.equal(soft.asked, feather, `${pixels} px asks for ${feather}`);
        assert.ok(Math.abs(soft.used - feather) < feather / 100, `${pixels} px eases across ${soft.used}, not ${feather}`);
        assert.equal(soft.asked, soft.reach * FEATHER_SHARE, `${pixels} px asks for exactly what the hold allows`);
    }

    // The weight profile that follows: whole across the inner half, and half
    // way down the feather at three quarters of the way out.
    const wide = paintStamp({ edge: 'soft', size: 400 }, 1);
    const stroke = { kind: 'stroke', points: [[-2000, 0], [2000, 0]], stamp: { width: wide.width, depth: wide.depth, corner: wide.corner }, feather: wide.feather };
    assert.equal(footprintWeight(stroke, 0, 100), 1, 'whole half way out');
    assert.ok(footprintWeight(stroke, 0, 150) < 1 && footprintWeight(stroke, 0, 150) > 0, 'and fading three quarters out');

    // A hard edge asks for the sampling's two cells and is held the same way,
    // so the axis says nothing until the stamp is wider than eight cells.
    const cell = DEFAULT_SIZE / DEFAULT_SEGMENTS;
    assert.equal(DEFAULT_FEATHER, cell * FEATHER_CELLS);
    const crossover = DEFAULT_FEATHER / FEATHER_SHARE / FEATHER_SHARE;
    assert.equal(crossover, 640, 'eight of the ground\'s cells');
    assert.ok(band('hard', crossover).used - band('soft', crossover).used < 1e-6, 'the same edge at the crossover');
    assert.ok(band('soft', crossover * 2).used > band('hard', crossover * 2).used + 1, 'and a softer one past it');
});
