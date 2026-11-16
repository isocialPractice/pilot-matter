import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    pickGround, canvasPickBounds, pickStep, pointerDevice,
    PICK_STEP_CELLS, PICK_SURFACE, PICK_CELL_LIMIT
} from '../js/build-picking.js';
import { createField, applyBase, sampleHeight, DEFAULT_SIZE } from '../js/environment/elements.js';

const source = name => readFileSync(fileURLToPath(new URL(`../js/${name}`, import.meta.url)), 'utf8');

/** A method of the page's one class, as its source, for pinning what it hands over. */
function methodBody(text, name) {
    const match = new RegExp(`^\\s+(?:async\\s+)?${name}\\((?:[^()]|\\([^()]*\\))*\\)\\s*\\{`, 'm').exec(text);
    assert.ok(match, `no method named ${name}`);
    let depth = 0;
    for (let i = match.index + match[0].length - 1; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}' && --depth === 0) return text.slice(match.index + match[0].length - 1, i + 1);
    }
    assert.fail(`${name} never closes`);
}

const flat = () => 0;

/** A round hill 400 high, 1000 across its foot, standing at the middle of the ground. */
const hill = (x, z) => Math.max(0, 400 * (1 - Math.hypot(x, z) / 500));

const near = (a, b, within = 0.05) => Math.abs(a - b) <= within;

test('a ray pointed down at flat ground meets it where a plane would', () => {
    const hit = pickGround({ x: 0, y: 1000, z: 1000 }, { x: 0, y: -1, z: -1 }, flat);
    assert.ok(near(hit.x, 0) && near(hit.y, 0) && near(hit.z, 0), JSON.stringify(hit));
});

/**
 * The reason a pick is a ray against the ground and not a plane: a click aimed
 * at the face of a hill has to land on the face, not on the flat ground behind
 * the hill where the same ray would cross sea level.
 */
test('a ray aimed at the face of a hill lands on the face, not on the plane behind it', () => {
    const origin = { x: 0, y: 1200, z: 2400 };
    const direction = { x: 0, y: -1200, z: -2400 };

    const hit = pickGround(origin, direction, hill, { step: 20 });
    assert.ok(hit, 'the ray should meet the hill');
    assert.ok(hit.y > 50, `it should land up on the hill, and it landed at height ${hit.y}`);
    assert.ok(hit.z > 0, 'on the face toward the camera');
    assert.ok(near(hit.y, hill(hit.x, hit.z), 1e-9), 'and on the ground, not above or under it');

    const plane = pickGround(origin, direction, flat);
    assert.ok(plane.z < hit.z, 'the plane would have put it further back, behind the face');
});

test('a hit sits on the ground to well inside a unit', () => {
    const field = createField({ size: 4000, segments: 40 });
    applyBase(field, { maxHeight: 480, scale: 3.5 });
    const heightAt = (x, z) => sampleHeight(field, x, z);

    for (const [x, z] of [[0, 0], [700, -900], [-1500, 1200]]) {
        const origin = { x: x + 600, y: 3000, z: z + 900 };
        const hit = pickGround(origin, { x: -600, y: -3000 + heightAt(x, z), z: -900 }, heightAt, { step: 50 });

        assert.ok(hit, `a ray at ${x},${z} should land`);
        assert.ok(near(hit.x, x, 0.5) && near(hit.z, z, 0.5), `aimed at ${x},${z} and landed at ${hit.x},${hit.z}`);
    }
});

test('a ray over the sky, or pointed level, meets nothing', () => {
    assert.equal(pickGround({ x: 0, y: 1000, z: 0 }, { x: 0, y: 1, z: -1 }, flat), null, 'pointing up');
    assert.equal(pickGround({ x: 0, y: 1000, z: 0 }, { x: 0, y: 0, z: -1 }, flat, { maxDistance: 5000 }), null,
        'level and never coming down within reach');
    assert.equal(pickGround({ x: 0, y: 1000, z: 0 }, { x: 0, y: 0, z: 0 }, flat), null, 'no direction at all');
});

test('a ray that comes down too far away to be drawn meets nothing', () => {
    assert.equal(pickGround({ x: 0, y: 1000, z: 0 }, { x: 0, y: -1, z: -100 }, flat, { maxDistance: 20000 }), null);
});

/**
 * The guard the plan writes down: a point whose ray meets the ground off the
 * canvas is dropped rather than moved onto the canvas's edge, because it is not
 * a point anything was pointed at.
 */
test('ground met off the canvas is a miss, not a point moved onto its edge', () => {
    const bounds = canvasPickBounds(4000);
    const off = pickGround({ x: 0, y: 1000, z: 0 }, { x: 2500, y: -1000, z: 0 }, flat, { bounds });
    assert.equal(off, null);

    const on = pickGround({ x: 0, y: 1000, z: 0 }, { x: 1500, y: -1000, z: 0 }, flat, { bounds });
    assert.ok(on && near(on.x, 1500), 'and ground on it is a hit');
});

test('a camera inside the ground points at nothing', () => {
    assert.equal(pickGround({ x: 0, y: 100, z: 0 }, { x: 0, y: -1, z: 1 }, hill), null);
});

/**
 * The boundary the camera-inside-a-hill guard used to take with it: a ray aimed
 * at ground standing at `top` crosses the ceiling exactly on that ground, so
 * the clearance where the march begins is exactly 0 rather than above it. Read
 * as a camera inside a hill, that left the canvas's own highest flat ground
 * unpickable from every pitch - a plateau, or one extrusion standing alone on a
 * blank canvas, whose top is what `EDIT EXTRUSION` needs a click on.
 */
test('a ray aimed at the highest ground on the canvas meets it rather than missing', () => {
    // A 1200 unit square plateau 600 high, which is the whole of the highest
    // ground there is, with flat ground around it.
    const plateau = (x, z) => (Math.abs(x) <= 600 && Math.abs(z) <= 600 ? 600 : 0);

    for (const pitch of [85, 70, 55, 40, 30, 20]) {
        const away = Math.cos(pitch * Math.PI / 180) * 4000;
        const up = Math.sin(pitch * Math.PI / 180) * 4000;
        const origin = { x: 0, y: 600 + up, z: away };
        const hit = pickGround(origin, { x: 0, y: -up, z: -away }, plateau, { step: 40, top: 600 });

        assert.ok(hit, `aimed at the middle of the plateau from ${pitch} degrees and met nothing`);
        assert.ok(near(hit.y, 600, 1e-6), `it should land on the top, and it landed at ${hit?.y}`);
        assert.ok(near(hit.x, 0, 0.5) && near(hit.z, 0, 0.5), `on the point aimed at, and it landed at ${hit?.x},${hit?.z}`);
    }

    // And the entry point is still held to the canvas, as a hit found by
    // walking is: a plateau reaching past the bounds is not picked beyond them.
    const bounds = canvasPickBounds(800);
    assert.ok(pickGround({ x: 0, y: 2000, z: 300 }, { x: 0, y: -1, z: 0 }, plateau, { top: 600, bounds }),
        'straight down onto the plateau inside the canvas is a hit');
    assert.equal(pickGround({ x: 0, y: 2000, z: 500 }, { x: 0, y: -1, z: 0 }, plateau, { top: 600, bounds }), null,
        'and the same ground beyond the canvas is a miss, not a point moved onto its edge');
});

/**
 * The same boundary on a summit the ground is too coarse to give a flat top.
 *
 * The ground is sampled every 80 units, so a region 200 units across is raised
 * at one vertex and eased at its neighbours: a cone, whose sides fall away
 * faster than the ray comes down. The entry is the ray's only meeting with it,
 * and the ground read there comes back a few parts in 10^13 under the ceiling
 * rather than exactly on it, because the crossing is arithmetic - which is what
 * `PICK_SURFACE` absorbs. Compared at exactly zero, this walks past the summit
 * to the flat ground beyond, which is what it did in Chromium.
 */
test('a summit narrower than the sampling is met at its peak rather than walked past', () => {
    // 400 high at the middle, back to 0 by 80 units out: a single raised vertex
    // interpolated, which is what a 200 unit extrusion comes to.
    const summit = (x, z) => Math.max(0, 400 * (1 - Math.hypot(x, z) / 80));

    for (const pitch of [85, 55, 30]) {
        const away = Math.cos(pitch * Math.PI / 180) * 3000;
        const up = Math.sin(pitch * Math.PI / 180) * 3000;
        const hit = pickGround({ x: 0, y: 400 + up, z: away }, { x: 0, y: -up, z: -away }, summit,
            { step: 40, top: 400 });

        assert.ok(hit, `aimed at the peak from ${pitch} degrees and met nothing`);
        assert.ok(near(hit.y, 400, 1e-6), `it should be the peak, and it was ${hit?.y} - the ground beyond it is 0`);
        assert.ok(Math.hypot(hit.x, hit.z) < 1e-6, `at the peak, and it landed ${Math.hypot(hit.x, hit.z)} away`);
    }

    // The tolerance is a rounding, not a reach: ground a unit under the ceiling
    // is still walked to rather than answered at the entry.
    const shoulder = pickGround({ x: 0, y: 3000, z: 0 }, { x: 0, y: -1, z: 0 }, () => 399, { step: 40, top: 400 });
    assert.ok(near(shoulder.y, 399), `the walk still happens a unit down, and it answered ${shoulder?.y}`);
    assert.ok(PICK_SURFACE > 0 && PICK_SURFACE < 1e-3, `a rounding, and it is ${PICK_SURFACE}`);
});

// The walk starts where the ray comes down through the highest ground, which
// is only a saving if it lands on the same point a walk from the camera does.
test('skipping the air above the highest ground lands on the same point', () => {
    const origin = { x: 300, y: 9000, z: 6000 };
    const direction = { x: -300, y: -9000, z: -6000 };

    const walked  = pickGround(origin, direction, hill, { step: 20, maxDistance: 40000 });
    const skipped = pickGround(origin, direction, hill, { step: 20, maxDistance: 40000, top: 400 });

    assert.ok(walked && skipped);
    assert.ok(near(walked.x, skipped.x, 1e-6) && near(walked.z, skipped.z, 1e-6));
    assert.equal(pickGround({ x: 0, y: 1000, z: 0 }, { x: 0, y: 0, z: -1 }, flat, { top: 400 }), null,
        'and a ray above the highest ground that never comes down misses outright');
});

test('the square a pick may land on is the canvas', () => {
    assert.deepEqual(canvasPickBounds(DEFAULT_SIZE),
        { minX: -DEFAULT_SIZE / 2, maxX: DEFAULT_SIZE / 2, minZ: -DEFAULT_SIZE / 2, maxZ: DEFAULT_SIZE / 2 });
    assert.equal(pickStep(80), 80 * PICK_STEP_CELLS, 'and the walk steps half a cell, so no rise is stepped over');
});

test('the pointer is read as the device coordinates a camera casts through', () => {
    const rect = { left: 10, top: 20, width: 800, height: 600 };
    assert.deepEqual(pointerDevice(410, 320, rect), { x: 0, y: 0 }, 'the middle of the canvas');
    assert.deepEqual(pointerDevice(10, 20, rect), { x: -1, y: 1 }, 'its top left');
    assert.deepEqual(pointerDevice(810, 620, rect), { x: 1, y: -1 }, 'its bottom right');
});

// --- Told the grid, the crossing is solved rather than searched for ---------
//
// A march cannot see a rise narrower than its own step. The ground is sampled
// on a grid and interpolated between its vertices, so a summit too small to
// raise more than one vertex is one vertex high and falls away within a cell -
// and the step is half a cell. Told the grid, each cell the ray crosses is
// asked for its own crossing, which is a quadratic with that vertex in it.

const CELL = 80;
const CANVAS = 16000;
const SUMMIT = 200;

/**
 * A canvas's field with the vertices named raised, as an extrusion too small to
 * reach more than those raises them: `{ heightAt, grid, reads }`, `reads`
 * counting what it was asked, so the cost of a pick can be measured rather
 * than argued about.
 */
function sampled(raised = [[0, 0]], height = SUMMIT) {
    const field = createField({ size: CANVAS, segments: CANVAS / CELL, originX: 0, originZ: 0 });
    const low = -CANVAS / 2;
    for (const [x, z] of raised) {
        const col = Math.round((x - low) / CELL);
        const row = Math.round((z - low) / CELL);
        field.height[row * field.stride + col] = height;
    }

    const counted = { reads: 0 };
    return {
        field,
        counted,
        heightAt: (x, z) => { counted.reads++; return sampleHeight(field, x, z); },
        grid: { cell: CELL, cellOrigin: { x: low, z: low } }
    };
}

/**
 * A ray coming down at `degrees` through a point, along +x - which is a camera
 * over a canvas looking at that point. Aimed at the summit's own surface rather
 * than at the ground plane, because that is what a pilot pointing at the top of
 * an extrusion aims at.
 */
function aimedAt(x, y = SUMMIT, z = 0, degrees = 55) {
    const fall = Math.tan(degrees * Math.PI / 180);
    const high = 4000;
    return {
        origin: { x: x - (high - y) / fall, y: high, z },
        direction: { x: 1 / fall, y: -1, z: 0 }
    };
}

const onSummit = hit => hit != null && Math.hypot(hit.x, hit.z) <= CELL;

test('a summit one vertex wide is reached from every aim on the face turned toward the camera', () => {
    const ground = sampled();

    // Measured on 11-16-26: the march answers the summit when aimed at its
    // exact point and the flat ground 140 units beyond for every aim within
    // 9.8 units of it, so EDIT EXTRUSION cannot be pointed at the top.
    let marchedMisses = 0;
    let solvedMisses = 0;
    const aims = [];
    for (let a = -CELL + 0.25; a < 0; a += 0.25) aims.push(a);

    for (const a of aims) {
        const ray = aimedAt(a);
        const marched = pickGround(ray.origin, ray.direction, ground.heightAt,
            { step: pickStep(CELL), maxDistance: 40000, top: SUMMIT });
        const solved = pickGround(ray.origin, ray.direction, ground.heightAt,
            { maxDistance: 40000, top: SUMMIT, ...ground.grid });

        if (!onSummit(marched)) marchedMisses++;
        if (!onSummit(solved)) solvedMisses++;
    }

    assert.equal(solvedMisses, 0, `the solved reading reached all ${aims.length} aims across the face`);
    assert.ok(marchedMisses >= 30,
        `the march missed ${marchedMisses} of them, which is the defect this fixed`);

    // And the one aim the march did manage: straight at the summit's own point,
    // which the ceiling answers before anything is walked at all.
    const onto = aimedAt(0);
    const hit = pickGround(onto.origin, onto.direction, ground.heightAt,
        { step: pickStep(CELL), maxDistance: 40000, top: SUMMIT });
    assert.ok(onSummit(hit), 'the ceiling boundary is settled and was never this');
    assert.ok(Math.abs(hit.y - SUMMIT) < 1e-6);
});

test('a ray aimed past a summit one vertex wide passes over it, and says so', () => {
    // Not a miss: the ground behind such a summit falls away at two and a half
    // units per unit while the ray comes down at one and a half, so a ray
    // aimed a quarter of a unit past the point really does go over the top.
    // Both readings agree about it, which is what makes the answer geometry
    // rather than sampling.
    const ground = sampled();

    for (const a of [0.25, 1, 4, 20]) {
        const ray = aimedAt(a);
        const solved = pickGround(ray.origin, ray.direction, ground.heightAt,
            { maxDistance: 40000, top: SUMMIT, ...ground.grid });
        const marched = pickGround(ray.origin, ray.direction, ground.heightAt,
            { step: pickStep(CELL), maxDistance: 40000, top: SUMMIT });

        assert.equal(onSummit(solved), false, `aimed ${a} past the point, the ray is over the summit`);
        assert.ok(Math.abs(solved.x - marched.x) < 1e-6, 'and both readings land in the same place');
        assert.ok(Math.abs(solved.y) < 1e-6, 'on the flat ground beyond it');
    }
});

test('a summit wide enough for the march is answered the same way by both readings', () => {
    // The backward reading: where a march already worked, the solve agrees with
    // it. A flat top one cell across, swept at a quarter of a unit.
    const ground = sampled([[0, 0], [CELL, 0], [0, CELL], [CELL, CELL]]);

    let compared = 0;
    for (let a = -CELL; a <= CELL * 2; a += 0.25) {
        const ray = aimedAt(a, SUMMIT, CELL / 2);
        const marched = pickGround(ray.origin, ray.direction, ground.heightAt,
            { step: pickStep(CELL), maxDistance: 40000, top: SUMMIT });
        const solved = pickGround(ray.origin, ray.direction, ground.heightAt,
            { maxDistance: 40000, top: SUMMIT, ...ground.grid });

        assert.ok(marched && solved, `aimed ${a}, both readings meet the ground`);
        assert.ok(Math.abs(solved.x - marched.x) < 0.5, `aimed ${a}: ${solved.x} against ${marched.x}`);
        assert.ok(Math.abs(solved.y - marched.y) < 1.5, `aimed ${a}: ${solved.y} against ${marched.y}`);
        compared++;
    }
    assert.ok(compared > 900, 'swept across the whole top and both its faces');
});

test('a hit solved on the grid sits on the ground, from every angle and either direction', () => {
    const ground = sampled([[0, 0], [CELL, CELL * 2], [-CELL * 3, CELL]], 300);
    const field = ground.field;

    for (const degrees of [15, 35, 55, 75, 89]) {
        for (const towards of [1, -1]) {
            for (const across of [0, 0.4, 1, -0.7]) {
                const fall = Math.tan(degrees * Math.PI / 180);
                const ray = {
                    origin: { x: -towards * 3000, y: 1200, z: -across * 1500 },
                    direction: { x: towards / fall, y: -1, z: across / fall }
                };
                const hit = pickGround(ray.origin, ray.direction, ground.heightAt,
                    { maxDistance: 40000, top: 300, ...ground.grid });
                if (hit == null) continue;

                assert.ok(Math.abs(hit.y - sampleHeight(field, hit.x, hit.z)) < 1e-6,
                    `${degrees} deg, ${towards}, ${across}: the hit is on the ground`);

                // And it is the *first* crossing: nothing before it is under
                // the ground.
                const length = Math.hypot(ray.direction.x, ray.direction.y, ray.direction.z);
                const reached = Math.hypot(hit.x - ray.origin.x, hit.y - ray.origin.y, hit.z - ray.origin.z);
                for (let t = 1; t < reached - 1; t += 7) {
                    const x = ray.origin.x + ray.direction.x / length * t;
                    const y = ray.origin.y + ray.direction.y / length * t;
                    const z = ray.origin.z + ray.direction.z / length * t;
                    assert.ok(y - sampleHeight(field, x, z) > -1e-6,
                        `${degrees} deg, ${towards}, ${across}: nothing crossed before ${reached}`);
                }
            }
        }
    }
});

test('a ray along a grid line, and one straight down, are each walked rather than stuck', () => {
    const ground = sampled([[0, 0]]);
    const grid = ground.grid;

    // Straight down onto the summit: no movement across the grid at all, so
    // the walk has one cell to solve and the whole ray to solve it over.
    const down = pickGround({ x: 0, y: 3000, z: 0 }, { x: 0, y: -1, z: 0 }, ground.heightAt,
        { maxDistance: 40000, top: SUMMIT, ...grid });
    assert.ok(down && Math.abs(down.y - SUMMIT) < 1e-6, 'it lands on the summit');

    // Straight down beside it, inside the same cell: the interpolated ground.
    const beside = pickGround({ x: 40, y: 3000, z: 0 }, { x: 0, y: -1, z: 0 }, ground.heightAt,
        { maxDistance: 40000, top: SUMMIT, ...grid });
    assert.ok(beside && Math.abs(beside.y - SUMMIT / 2) < 1e-6, `half way down the cell: ${beside?.y}`);

    // Along a grid line, which is the walk's other edge case: the ray never
    // reaches a line of one axis at all.
    const along = pickGround({ x: -4000, y: 400, z: 0 }, { x: 1, y: -1, z: 0 }, ground.heightAt,
        { maxDistance: 40000, top: SUMMIT, ...grid });
    assert.ok(along, 'it meets the ground');
    assert.ok(Math.abs(along.y - sampleHeight(ground.field, along.x, along.z)) < 1e-6);

    // And exactly through a vertex, diagonally, which reaches both axes' lines
    // at once.
    const corner = pickGround({ x: -4000, y: 4000, z: -4000 }, { x: 1, y: -1, z: 1 }, ground.heightAt,
        { maxDistance: 40000, top: SUMMIT, ...grid });
    assert.ok(corner, 'a ray through the corners meets the ground');
    assert.ok(Math.abs(corner.y - sampleHeight(ground.field, corner.x, corner.z)) < 1e-6);
});

test('a ray over the ground meets nothing, and one under it says so', () => {
    const ground = sampled();
    const grid = ground.grid;

    assert.equal(pickGround({ x: 0, y: 3000, z: 0 }, { x: 1, y: 0, z: 0 }, ground.heightAt,
        { maxDistance: 40000, top: SUMMIT, ...grid }), null, 'level above the ceiling');
    assert.equal(pickGround({ x: 0, y: 3000, z: 0 }, { x: 0, y: 1, z: 0 }, ground.heightAt,
        { maxDistance: 40000, top: SUMMIT, ...grid }), null, 'climbing away from it');
    assert.equal(pickGround({ x: 0, y: SUMMIT / 2, z: 0 }, { x: 0, y: -1, z: 0 }, ground.heightAt,
        { maxDistance: 40000, top: SUMMIT, ...grid }), null, 'starting inside the summit');

    // And a ray whose reach runs out before the ground does. The crossing has
    // to be refused even when it lies inside the cell the reach runs out in,
    // which is where a stretch solved to the cell's own edge rather than to the
    // reach would answer it: this ray meets flat ground about 14 units along
    // itself, a seventh of the way across the cell it starts in.
    const flatGround = sampled([]);
    const reaches = (maxDistance) => pickGround({ x: 10, y: 10, z: 10 }, { x: 1, y: -1, z: 0 }, flatGround.heightAt,
        { maxDistance, top: Infinity, ...flatGround.grid });

    assert.ok(reaches(40), 'given the reach, it meets the ground');
    assert.ok(Math.abs(reaches(40).y) < 1e-6, 'at sea level');
    assert.equal(reaches(5), null, 'and short of it, nothing - as far as anything is drawn, and no further');

    assert.equal(pickGround({ x: -4000, y: 400, z: 0 }, { x: 1, y: -1, z: 0 }, ground.heightAt,
        { maxDistance: 10, top: SUMMIT, ...grid }), null, 'as with a reach that runs out cells short of it');
});

test('a hit off the ground a pick may land on is a miss, whichever reading found it', () => {
    const ground = sampled();
    const bounds = canvasPickBounds(CANVAS / 4);

    const ray = aimedAt(-20);
    const inside = pickGround(ray.origin, ray.direction, ground.heightAt,
        { maxDistance: 40000, top: SUMMIT, bounds, ...ground.grid });
    assert.ok(onSummit(inside), 'the summit is well inside the square');

    const away = { origin: { x: -12000, y: 400, z: 0 }, direction: { x: 1, y: -1, z: 0 } };
    assert.equal(pickGround(away.origin, away.direction, ground.heightAt,
        { maxDistance: 40000, top: SUMMIT, bounds, ...ground.grid }), null,
        'and ground outside it is not a point a tool may be handed');
});

test('solving the grid costs less than marching it, which is what lets it run on every pointer move', () => {
    const ground = sampled([[0, 0]]);

    const sweep = options => {
        const before = ground.counted.reads;
        let worst = 0;
        for (let a = -CELL; a <= CELL; a += 0.5) {
            const was = ground.counted.reads;
            const ray = aimedAt(a);
            pickGround(ray.origin, ray.direction, ground.heightAt, { maxDistance: 40000, top: SUMMIT, ...options });
            worst = Math.max(worst, ground.counted.reads - was);
        }
        return { cost: ground.counted.reads - before, worst };
    };

    const marched = sweep({ step: pickStep(CELL) });
    const solved = sweep(ground.grid);

    assert.ok(solved.cost < marched.cost,
        `solved reads the ground ${solved.cost} times against the march's ${marched.cost}`);
    assert.ok(solved.worst <= marched.worst,
        `and its dearest ray reads ${solved.worst} against ${marched.worst}`);
    assert.ok(solved.worst < 40, 'with a dearest ray a pointer move can afford');
});

test('a walk that cannot end is bounded, so a pick always answers', () => {
    assert.ok(PICK_CELL_LIMIT > CANVAS / CELL * 2,
        'the limit leaves room for the longest honest walk, which is the canvas diagonal');

    // A ray climbing away from flat ground, nearly level and nearly along a
    // grid line, with as far to go as anything could ask for. It meets nothing
    // at all, so the only thing that ends the walk is the limit: twelve and a
    // half million cells lie between its origin and `maxDistance`, and the
    // cost is what this holds rather than the answer. Measured on 11.16.2026,
    // it reads the ground 6,401 times with the limit in force and 50,000,001
    // times without it.
    const ground = sampled([]);
    const before = ground.counted.reads;
    const hit = pickGround({ x: -CANVAS / 2, y: 200, z: 0.0000001 }, { x: 1, y: 1e-9, z: 1e-12 }, ground.heightAt,
        { maxDistance: 1e9, top: Infinity, ...ground.grid });
    const reads = ground.counted.reads - before;

    assert.equal(hit, null, 'it answered rather than running on');
    assert.ok(reads <= 4 * PICK_CELL_LIMIT + 64,
        `it read the ground ${reads} times, which is past what ${PICK_CELL_LIMIT} cells can account for`);
});

test('the crossing solved on the grid is the crossing, measured against a walk fine enough to trust', () => {
    // The assertions above hold that a hit sits on the ground, and every hit
    // does: the height is read again at the point found. What they cannot hold
    // is whether it is the *right* point. So the solved crossing is measured
    // against the same ray marched at a twentieth of a unit, which is finer
    // than any feature of this ground, over the cases a cell's own arithmetic
    // turns on: a ray crossing both axes, over corners that do not lie in a
    // plane.
    const ground = sampled([[0, 0], [CELL, CELL], [-CELL, CELL * 2]], 260);

    let compared = 0;
    for (const [towards, across] of [[1, 1], [1, 0.4], [-1, 1], [1, -1], [-1, -0.6], [1, 2.3]]) {
        for (const degrees of [25, 45, 65]) {
            const fall = Math.tan(degrees * Math.PI / 180);
            const from = { x: -towards * 900, y: 700, z: -across * 900 };
            const direction = { x: towards / fall, y: -1, z: across / fall };
            const options = { maxDistance: 8000, top: 260 };

            const solved = pickGround(from, direction, ground.heightAt, { ...options, ...ground.grid });
            const fine = pickGround(from, direction, ground.heightAt, { ...options, step: 0.05 });

            assert.ok(solved && fine, `${degrees} deg, ${towards}/${across}: both readings meet the ground`);
            assert.ok(Math.hypot(solved.x - fine.x, solved.y - fine.y, solved.z - fine.z) < 0.1,
                `${degrees} deg, ${towards}/${across}: solved (${solved.x.toFixed(2)}, ${solved.y.toFixed(2)}, ${solved.z.toFixed(2)})`
                + ` against marched (${fine.x.toFixed(2)}, ${fine.y.toFixed(2)}, ${fine.z.toFixed(2)})`);
            compared++;
        }
    }
    assert.equal(compared, 18, 'every direction and angle was measured');

    // And the same against the one vertex the summit case is about, where the
    // fine march does find the crossing because its step is smaller than the
    // stretch the coarse one steps over.
    const narrow = sampled([[0, 0]]);
    for (const a of [-40, -20, -8, -2, -0.5]) {
        const ray = aimedAt(a);
        const solved = pickGround(ray.origin, ray.direction, narrow.heightAt,
            { maxDistance: 40000, top: SUMMIT, ...narrow.grid });
        const fine = pickGround(ray.origin, ray.direction, narrow.heightAt,
            { maxDistance: 40000, top: SUMMIT, step: 0.05 });

        assert.ok(solved && fine, `aimed ${a}: both readings meet the ground`);
        assert.ok(Math.hypot(solved.x - fine.x, solved.y - fine.y, solved.z - fine.z) < 0.2,
            `aimed ${a}: solved y ${solved.y.toFixed(2)} against marched y ${fine.y.toFixed(2)}`);
        assert.ok(onSummit(solved), `aimed ${a}: and it is the summit`);
    }
});

test('the canvas hands the pick its own grid, so a canvas pick is the solved reading', () => {
    const main = source('main.js');

    assert.match(methodBody(main, 'readCanvasGround'), /cell: field\?\.step \?\? 0,/,
        'the grid the ground is sampled on');
    assert.match(methodBody(main, 'readCanvasGround'),
        /cellOrigin: \{ x: \(field\?\.originX \?\? 0\) - half, z: \(field\?\.originZ \?\? 0\) - half \}/,
        'with a vertex at the low corner of the square the field covers');
    assert.match(methodBody(main, 'pickGroundAlong'), /cell: this\.canvasGround\.cell,\s*cellOrigin: this\.canvasGround\.cellOrigin/);
});
