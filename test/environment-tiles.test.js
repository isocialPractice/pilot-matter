import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createField, fieldX, fieldZ, fieldBounds, sampleHeight,
    applyBase, applyElement, createRandom,
    matchEdges, matchWater, seamBand, waterSurface,
    tileSeed, SEAM_BLEND, readColor, paint
} from '../js/environment/elements.js';
import { animateWater } from '../js/water.js';
import { updateNormals } from '../js/terrain-normals.js';
import { boundsFromSize, tileOrigin, resolveEnvironmentOptions } from '../js/api/contract.js';

const SIZE = 4000;
const SEGMENTS = 40;

/** One square of an assembly, shaped on the ground the whole assembly shares. */
function tile(x, z, base = {}) {
    const field = createField({
        size: SIZE, segments: SEGMENTS, originX: x * SIZE, originZ: z * SIZE
    });
    applyBase(field, { maxHeight: 480, scale: 3.5, ...base });
    return field;
}

/** The vertices down one side of a field, read as heights and colours. */
function edge(field, side) {
    const { stride } = field;
    const read = [];

    for (let line = 0; line < stride; line++) {
        const index = side === 'minX' ? line * stride
                    : side === 'maxX' ? line * stride + stride - 1
                    : side === 'minZ' ? line
                    : (stride - 1) * stride + line;
        read.push({ index, height: field.height[index], color: readColor(field, index) });
    }

    return read;
}

// --- A field with a place in the world ------------------------------------

test('a field laid in the middle of the world is the field it always was', () => {
    const field = createField({ size: 1000, segments: 10 });
    assert.equal(field.originX, 0);
    assert.equal(field.originZ, 0);
    assert.equal(fieldX(field, 0), -500);
    assert.equal(fieldZ(field, 0), -500);
});

test('a field laid somewhere else covers the square it was laid on', () => {
    const field = createField({ size: 1000, segments: 10, originX: 1000, originZ: -1000 });

    assert.equal(fieldX(field, 0), 500, 'the low corner is a square along');
    assert.equal(fieldZ(field, 0), -1500);
    assert.equal(fieldX(field, field.count - 1), 1500);
    assert.equal(fieldZ(field, field.count - 1), -500);

    assert.deepEqual(fieldBounds(field), { minX: 500, maxX: 1500, minZ: -1500, maxZ: -500 });
});

test('a tile answers for the ground it covers and for none of the rest', () => {
    const field = tile(1, 0);
    const inside = sampleHeight(field, SIZE, 0);

    assert.ok(inside > 0, 'the middle of the tile is ground it knows');
    assert.equal(sampleHeight(field, 0, 0), 0, 'the middle of the world is not its to answer for');
    assert.equal(sampleHeight(field, -SIZE, 0), 0);
});

test('the square a tile covers is the square the API says it covers', () => {
    const origin = tileOrigin({ x: 1, z: -1 }, SIZE);
    assert.deepEqual(origin, { x: SIZE, z: -SIZE });

    assert.deepEqual(boundsFromSize(SIZE, origin), {
        minX: SIZE / 2, maxX: SIZE * 1.5, minZ: -SIZE * 1.5, maxZ: -SIZE / 2
    });

    const middle = boundsFromSize(SIZE);
    assert.deepEqual(middle, { minX: -SIZE / 2, maxX: SIZE / 2, minZ: -SIZE / 2, maxZ: SIZE / 2 });
});

test('a world nobody placed is the square in the middle', () => {
    assert.deepEqual(resolveEnvironmentOptions().tile, { x: 0, z: 0 });
    assert.deepEqual(resolveEnvironmentOptions({ tile: { x: 2, z: -3 } }).tile, { x: 2, z: -3 });
    assert.deepEqual(resolveEnvironmentOptions({ tile: { x: 'east' } }).tile, { x: 0, z: 0 },
        'a place that is not a number is no place at all');
});

// --- The ground under an assembly -----------------------------------------

// The pairs below are named by the compass rather than by the sign. The
// world's +Z is north and the card counts clockwise from it, which puts east
// on -X, so the tile at the lower x is the eastern one and the join between
// them is its maxX edge. Nothing here reads the name - a join is a join
// whichever way it is called - but a reader taking the names at their word is
// the reader who lays an assembly out mirrored.

test('the ground a tile is shaped on runs on across the join', () => {
    const east = tile(0, 0);
    const west = tile(1, 0);

    const leaving  = edge(east, 'maxX');
    const arriving = edge(west, 'minX');

    for (let line = 0; line < leaving.length; line++) {
        assert.ok(Math.abs(leaving[line].height - arriving[line].height) < 1e-3,
            `the base ground steps at row ${line} of the join`);
    }
});

test('two tiles of one world are the same world without being the same ground', () => {
    const here  = tile(0, 0);
    const there = tile(1, 0);

    const same = here.height.every((height, i) => Math.abs(height - there.height[i]) < 1e-6);
    assert.equal(same, false, 'a tile laid a square along should not be the square it was laid beside');
});

test('a tile is laid out from its own place in the grid, every time it is laid', () => {
    assert.equal(tileSeed(100, 0, 0), tileSeed(100, 0, 0));
    assert.notEqual(tileSeed(100, 0, 0), tileSeed(100, 1, 0));
    assert.notEqual(tileSeed(100, 1, 0), tileSeed(100, 0, 1));
    assert.notEqual(tileSeed(100, 0, 0), tileSeed(200, 0, 0), 'a different world is different ground');
    assert.ok(Number.isFinite(tileSeed(100, -0.5, 0.5)), 'an assembly can be centred on a join');
});

// The middle tile is the world the description always was, so a world laid as
// one square of a grid and the same world laid on its own are the same ground.
test('the middle of an assembly is the world its description asked for', () => {
    assert.equal(tileSeed(100, 0, 0), 100);
    assert.equal(tileSeed(4242, 0, 0), 4242);
});

// A grid whose seeds repeat is a world that repeats. Taking one coordinate
// against the other used to give a place and its opposite the same seed, which
// folded a world in half about its middle.
test('no two places in a grid are laid out from the same seed', () => {
    const seen = new Map();

    for (let z = -12; z <= 12; z++) {
        for (let x = -12; x <= 12; x++) {
            const seed = tileSeed(1234, x, z);
            assert.ok(!seen.has(seed),
                `${x},${z} is the same ground as ${seen.get(seed)}`);
            seen.set(seed, `${x},${z}`);
        }
    }
});

test('a place and the place opposite it are different ground', () => {
    for (const [x, z] of [[1, 1], [1, -1], [2, -2], [3, -1], [4, -4]]) {
        assert.notEqual(tileSeed(1234, x, z), tileSeed(1234, -x, -z),
            `${x},${z} should not be the ground at ${-x},${-z}`);
    }
});

test('an element drawn on a tile is drawn on the tile it was given', () => {
    const field = tile(1, 0);
    const before = Float32Array.from(field.height);

    applyElement(field, { type: 'mountain', config: { count: 6 } }, createRandom(7));

    let moved = 0;
    for (let i = 0; i < field.count; i++) {
        if (Math.abs(field.height[i] - before[i]) > 1e-3) moved++;
    }

    assert.ok(moved > 0, 'the peaks should be somewhere on the tile they were asked for');
});

// --- The seams ------------------------------------------------------------

test('matching settles what two tiles have at the vertices they share', () => {
    const east = tile(0, 0);
    const west = tile(1, 0);

    // Something drawn over each edge, so the two have a real disagreement to
    // settle rather than the base ground they already agree on.
    applyElement(east, { type: 'mountain', config: { count: 8 } }, createRandom(3));
    applyElement(west, { type: 'mountain', config: { count: 8 } }, createRandom(11));

    const before = edge(east, 'maxX').map(vertex => vertex.height);
    const settled = matchEdges([east, west]);

    assert.equal(settled, east.stride, 'every vertex down the join should be settled');

    const leaving  = edge(east, 'maxX');
    const arriving = edge(west, 'minX');

    for (let line = 0; line < leaving.length; line++) {
        assert.ok(Math.abs(leaving[line].height - arriving[line].height) < 1e-3,
            `the heights still step at row ${line}`);

        for (let c = 0; c < 3; c++) {
            assert.ok(Math.abs(leaving[line].color[c] - arriving[line].color[c]) < 1e-3,
                `the colours still change at row ${line}`);
        }
    }

    const moved = leaving.some((vertex, line) => Math.abs(vertex.height - before[line]) > 1e-6);
    assert.equal(moved, true, 'settling a disagreement should move something');
});

test('a join is eased back into the ground rather than left as a step', () => {
    const east = tile(0, 0);
    const west = tile(1, 0);
    applyElement(east, { type: 'mountain', config: { count: 8 } }, createRandom(3));
    applyElement(west, { type: 'mountain', config: { count: 8 } }, createRandom(11));

    const before = Float32Array.from(east.height);

    // The row the two disagree most about, which is the row that has the most
    // to say about how the disagreement is eased away.
    const gap = (line) => Math.abs(
        east.height[line * east.stride + east.stride - 1] - west.height[line * west.stride]
    );

    // Kept clear of the ends of the join, where a vertex is near two sides at
    // once and takes what is being eased in from both of them.
    let row = SEAM_BLEND;
    for (let line = SEAM_BLEND; line < east.stride - SEAM_BLEND; line++) {
        if (gap(line) > gap(row)) row = line;
    }
    assert.ok(gap(row) > 1, 'the two should have something to disagree about');

    matchEdges([east, west]);

    const at = (depth) => row * east.stride + (east.stride - 1 - depth);

    const seam = Math.abs(east.height[at(0)] - before[at(0)]);
    const inner = Math.abs(east.height[at(1)] - before[at(1)]);

    assert.ok(seam > 0, 'the vertex on the join should move');
    assert.ok(inner < seam, 'and the one behind it should move less');
    assert.equal(east.height[at(SEAM_BLEND)], before[at(SEAM_BLEND)],
        'past the blend the ground is left exactly as the elements drew it');
});

test('the corner four tiles meet at closes as cleanly as the edges do', () => {
    const tiles = [tile(0, 0), tile(1, 0), tile(0, 1), tile(1, 1)];
    for (const [i, field] of tiles.entries()) {
        applyElement(field, { type: 'mountain', config: { count: 8 } }, createRandom(i + 5));
    }

    const settled = matchEdges(tiles);
    assert.ok(settled > 0);

    const stride = tiles[0].stride;

    // The one place all four squares reach: the high corner of the low tile,
    // and the corresponding corner of each of the other three.
    const meeting = [
        tiles[0].height[(stride - 1) * stride + stride - 1],
        tiles[1].height[(stride - 1) * stride],
        tiles[2].height[stride - 1],
        tiles[3].height[0]
    ];

    for (const height of meeting) {
        assert.ok(Math.abs(height - meeting[0]) < 1e-3,
            'all four tiles should hold one height where they all meet');
    }
});

test('settling a join that is already settled changes nothing', () => {
    const east = tile(0, 0);
    const west = tile(1, 0);
    applyElement(east, { type: 'mountain', config: { count: 8 } }, createRandom(3));

    matchEdges([east, west]);
    const settled = Float32Array.from(east.height);

    matchEdges([east, west]);
    for (let i = 0; i < east.count; i++) {
        assert.ok(Math.abs(east.height[i] - settled[i]) < 1e-4, 'a second pass should be a no-op');
    }
});

test('tiles that do not touch have nothing to settle', () => {
    const here = tile(0, 0);
    const away = tile(4, 4);

    assert.equal(matchEdges([here, away]), 0);
    assert.equal(matchEdges([here]), 0, 'one tile is not an assembly');
    assert.equal(matchEdges([]), 0);
});

test('a colour laid over a join is settled the same way a height is', () => {
    const east = tile(0, 0);
    const west = tile(1, 0);

    const line = 3;
    paint(east, line * east.stride + east.stride - 1, [1, 0, 0]);
    paint(west, line * west.stride, [0, 0, 1]);

    matchEdges([east, west]);

    const [er, eg, eb] = readColor(east, line * east.stride + east.stride - 1);
    const [wr, wg, wb] = readColor(west, line * west.stride);

    assert.ok(Math.abs(er - wr) < 1e-3 && Math.abs(eg - wg) < 1e-3 && Math.abs(eb - wb) < 1e-3);
    assert.ok(Math.abs(er - 0.5) < 1e-3, 'the settled colour is what the two of them had');
    assert.ok(Math.abs(eb - 0.5) < 1e-3);
});

// --- The band a join moved ------------------------------------------------

/**
 * A settling pass records the vertices it moved, because the tile has to be
 * drawn again afterwards and the renderer would otherwise have to light all 201
 * by 201 vertices of it to find the three the join moved.
 */
test('a tile nothing was settled against carries no band', () => {
    const here = tile(0, 0);
    const away = tile(4, 4);

    assert.equal(here.seam, null);
    assert.equal(seamBand(here), null, 'and so has no band to read');

    matchEdges([here, away]);
    assert.equal(seamBand(here), null, 'and a pass that settled nothing records nothing');
});

test('the band covers every vertex the join moved', () => {
    const here = tile(0, 0);
    const east = tile(1, 0);

    // Peaks over each edge, so the two have a real disagreement to settle
    // rather than the base ground they already agree on.
    applyElement(here, { type: 'mountain', config: { count: 8 } }, createRandom(3));
    applyElement(east, { type: 'mountain', config: { count: 8 } }, createRandom(11));

    const height = here.height.slice();
    const color  = here.color.slice();
    matchEdges([here, east]);

    const moved = seamBand(here);
    assert.ok(moved, 'a settled tile has a band');

    let changed = 0;
    for (let i = 0; i < here.count; i++) {
        const shifted = here.height[i] !== height[i]
            || here.color[i * 3] !== color[i * 3]
            || here.color[i * 3 + 1] !== color[i * 3 + 1]
            || here.color[i * 3 + 2] !== color[i * 3 + 2];

        if (!shifted) continue;
        changed++;
        assert.equal(moved[i], 1, `vertex ${i} moved and the band does not cover it`);
    }

    assert.ok(changed > 0, 'the join should have moved something, or this proves nothing');
});

test('a tile settled on two sides carries the band of both', () => {
    const here  = tile(0, 0);
    const east  = tile(1, 0);
    const south = tile(0, 1);

    matchEdges([here, east, south]);

    const moved = seamBand(here);
    const last  = here.stride - 1;

    assert.equal(moved[last], 1, 'the corner of the eastern join');
    assert.equal(moved[last * here.stride], 1, 'the corner of the southern one');
    assert.equal(moved[0], 0, 'and nothing on the two sides nothing was laid against');

    assert.equal(seamBand(east)[0], 1, 'read the other way round from the neighbour');
    assert.equal(seamBand(south)[0], 1);
});

test('the band is the strip beside the join rather than the whole tile', () => {
    const here = tile(0, 0);
    const east = tile(1, 0);

    matchEdges([here, east]);
    const moved = seamBand(here);

    let marked = 0;
    for (let i = 0; i < here.count; i++) {
        const depth = here.stride - 1 - i % here.stride;
        if (moved[i]) marked++;
        assert.equal(moved[i], depth < SEAM_BLEND ? 1 : 0,
            `vertex ${i} is ${depth} in from the join`);
    }

    assert.equal(marked, SEAM_BLEND * here.stride);
    assert.ok(marked < here.count / 10, 'which is a strip of the tile rather than most of it');
});

/** One square of an assembly with peaks on it, which is ground a join has to close. */
function peaked(x, z) {
    const field = tile(x, z);
    applyElement(field,
        { type: 'mountain', config: { count: 8, height: [160, 420], radius: [500, 1100] } },
        createRandom(tileSeed(7, x, z)));
    return field;
}

/**
 * A plane grid over a field, as the arrays a renderer holds it in: three
 * numbers a vertex, three index entries a face, in the row-by-row order
 * `PlaneGeometry` lays a plane out in and the field is written in.
 */
function planeOver(field) {
    const { stride, step, count } = field;
    const segments  = stride - 1;
    const positions = new Float32Array(count * 3);
    const index     = new Uint32Array(segments * segments * 6);

    for (let v = 0; v < count; v++) {
        positions[v * 3]     = (v % stride) * step;
        positions[v * 3 + 1] = field.height[v];
        positions[v * 3 + 2] = Math.floor(v / stride) * step;
    }

    let write = 0;
    for (let row = 0; row < segments; row++) {
        for (let col = 0; col < segments; col++) {
            const a = row * stride + col;
            const b = (row + 1) * stride + col;
            const c = (row + 1) * stride + col + 1;
            const d = row * stride + col + 1;

            index[write++] = a; index[write++] = b; index[write++] = d;
            index[write++] = b; index[write++] = c; index[write++] = d;
        }
    }

    return { positions, index };
}

/**
 * The band a real join records is wide enough to light the tile as a pass over
 * the whole of it would have.
 *
 * `test/terrain-normals.test.js` pins the other half of this - that
 * `updateNormals` over a band agrees with Three.js's own arithmetic over the
 * whole mesh - against a band the test writes itself. What is pinned here is
 * the join's end of it: that the strip `applySeams` actually marks is the strip
 * the lighting needs, so the two halves cannot drift apart while each goes on
 * agreeing with its own idea of a band.
 *
 * The comparison is against the same pass with every vertex marked, which is a
 * whole-mesh pass by construction, so a band too narrow by even its rim reads
 * as a difference.
 */
test('the band a join records lights the tile as a whole pass would', () => {
    // Peaked rather than plain: the base is noise read off the world and runs
    // on across a join already, so two tiles shaped on nothing else agree there
    // and the join moves no ground at all. What a join actually closes is what
    // an element drew up to one tile's edge, so that is what this is laid on.
    const here = peaked(0, 0);
    const east = peaked(1, 0);

    // Lit once as the generator drew it, which is what `buildMesh` leaves on a
    // tile before anything is laid beside it.
    const mesh = planeOver(here);
    const lit  = new Float32Array(here.count * 3);
    updateNormals({ ...mesh, normals: lit, moved: new Uint8Array(here.count).fill(1) });

    const before = here.height.slice();
    assert.ok(matchEdges([here, east]) > 0, 'the join should have been settled');

    let shifted = 0;
    for (let v = 0; v < here.count; v++) if (Math.abs(here.height[v] - before[v]) > 1e-3) shifted++;
    assert.ok(shifted > 0, 'and should have moved some ground, or there is nothing to light again');

    const moved = seamBand(here);
    assert.ok(moved, 'and recorded which vertices it moved');

    // The ground is written again whole and the band alone is lit again, which
    // is the order `redrawTile` does it in.
    const settled = planeOver(here);
    const strip   = lit.slice();
    assert.ok(updateNormals({ ...settled, normals: strip, moved }) > 0, 'the band should have been lit');

    const whole = new Float32Array(here.count * 3);
    updateNormals({ ...settled, normals: whole, moved: new Uint8Array(here.count).fill(1) });

    let differing = 0;
    for (let i = 0; i < whole.length; i++) {
        if (Math.abs(strip[i] - whole[i]) > 1e-6) differing++;
    }
    assert.equal(differing, 0, 'the strip is lit as the whole plane would have lit it');

    // And the comparison has teeth: a band one vertex narrower leaves the rim
    // of it lit for ground that has since moved.
    const narrow = lit.slice();
    const short  = Uint8Array.from(moved);
    for (let v = 0; v < here.count; v++) {
        if (here.stride - 1 - v % here.stride === SEAM_BLEND - 1) short[v] = 0;
    }
    updateNormals({ ...settled, normals: narrow, moved: short });

    let missed = 0;
    for (let i = 0; i < whole.length; i++) {
        if (Math.abs(narrow[i] - whole[i]) > 1e-6) missed++;
    }
    assert.ok(missed > 0, 'or a band too narrow would read as lit correctly too');
});

// --- The water across a join ----------------------------------------------

/** One square of an assembly, flooded to a level the whole assembly shares. */
function flooded(x, z, level = 200) {
    const field = tile(x, z);
    applyElement(field, { type: 'water', config: { level } }, createRandom(tileSeed(1, x, z)));
    return field;
}

/** Where a vertex stands, as the key the settling passes agree on a place by. */
function place(x, z) {
    return `${Math.round(x * 1000) / 1000}|${Math.round(z * 1000) / 1000}`;
}

/**
 * The water two tiles share, as the vertices both of them put at one place. The
 * ground settles exactly, so what is read here is only ever the water on it.
 */
function sharedWater(here, there) {
    const first  = waterSurface(here);
    const second = waterSurface(there);

    const standing = new Map();
    for (const i of first.edge) standing.set(place(first.x[i], first.z[i]), i);

    const pairs = [];
    for (const j of second.edge) {
        const at = standing.get(place(second.x[j], second.z[j]));
        if (at === undefined) continue;
        pairs.push({ here: at, there: j });
    }

    return { first, second, pairs };
}

/** What `animateWater` writes for one vertex of a surface: its height and its colour. */
function drawn(surface, at, time) {
    const positions = new Float32Array(surface.vertices[surface.count - 1] * 3 + 3);
    const colors    = new Float32Array(positions.length);

    animateWater(surface, time, { positions, colors });

    const to = surface.vertices[at] * 3;
    return { height: positions[to + 1], color: [colors[to], colors[to + 1], colors[to + 2]] };
}

test('a surface records which of its vertices are on the outside of the field', () => {
    const field   = flooded(0, 0);
    const surface = waterSurface(field);

    assert.ok(surface.edge.length > 0, 'a flooded tile reaches its own edges');
    assert.ok(surface.edge.length < surface.count, 'and holds water away from them too');

    const last = field.stride - 1;
    for (let i = 0; i < surface.count; i++) {
        const index = surface.vertices[i];
        const col   = index % field.stride;
        const row   = Math.floor(index / field.stride);
        const outer = col === 0 || col === last || row === 0 || row === last;

        assert.equal(surface.edge.includes(i), outer,
            `vertex ${index} is ${outer ? 'on' : 'off'} a side of the field`);
    }
});

/**
 * The defect this is written against. The ground either side of a join meets
 * exactly and the water on it did not: `openness` counts a water vertex's four
 * neighbours and reads the one off the field as water, so the neighbour that is
 * *on* the field is a different vertex on each side of the line - and
 * `animateWater` scales both the swell and the glint by what it works out.
 */
test('two settled tiles agree about the water they share', () => {
    const here = flooded(0, 0);
    const east = flooded(1, 0);

    assert.ok(matchEdges([here, east]) > 0, 'the ground should have settled first');

    const { first, second, pairs } = sharedWater(here, east);
    assert.ok(pairs.length > 10, 'the two should share a run of water, or this proves nothing');

    assert.ok(matchWater([first, second]) > 0, 'and the water should have something to settle');

    const time = 7.25;
    for (const pair of pairs) {
        const left  = drawn(first, pair.here, time);
        const right = drawn(second, pair.there, time);

        assert.ok(Math.abs(left.height - right.height) < 1e-5,
            `the same water is drawn at ${left.height} on one tile and ${right.height} on the other`);
        for (let c = 0; c < 3; c++) {
            assert.ok(Math.abs(left.color[c] - right.color[c]) < 1e-5,
                `and in ${left.color} against ${right.color}`);
        }
    }
});

test('the settled openness is what the tiles had between them', () => {
    const here = flooded(0, 0);
    const east = flooded(1, 0);

    matchEdges([here, east]);
    const { first, second, pairs } = sharedWater(here, east);

    const had = pairs.map(pair => (first.open[pair.here] + second.open[pair.there]) / 2);
    matchWater([first, second]);

    pairs.forEach((pair, at) => {
        assert.ok(Math.abs(first.open[pair.here] - had[at]) < 1e-6);
        assert.ok(Math.abs(second.open[pair.there] - had[at]) < 1e-6);
    });
});

test('settling water that is already settled changes nothing', () => {
    const here = flooded(0, 0);
    const east = flooded(1, 0);

    matchEdges([here, east]);
    const { first, second } = sharedWater(here, east);

    const settled = matchWater([first, second]);
    const after   = [first.open.slice(), second.open.slice()];

    assert.equal(matchWater([first, second]), settled, 'the same places are still shared');
    assert.deepEqual(first.open, after[0]);
    assert.deepEqual(second.open, after[1]);
});

test('water only one tile calls water is left where the bank put it', () => {
    const here = flooded(0, 0);
    const away = flooded(4, 4);

    const first  = waterSurface(here);
    const before = first.open.slice();

    assert.equal(matchWater([first, waterSurface(away)]), 0, 'tiles that do not touch share nothing');
    assert.deepEqual(first.open, before, 'so nothing was averaged against dry ground');

    assert.equal(matchWater([first]), 0, 'one surface is not an assembly');
    assert.equal(matchWater([]), 0);
    assert.equal(matchWater([first, null]), 0, 'and a dry neighbour settles nothing');
});

test('the corner four tiles meet at settles its water against all four', () => {
    const tiles = [flooded(0, 0), flooded(1, 0), flooded(0, 1), flooded(1, 1)];
    matchEdges(tiles);

    const surfaces = tiles.map(field => waterSurface(field));
    assert.ok(matchWater(surfaces) > 0);

    const standing = new Map();
    for (const surface of surfaces) {
        for (const i of surface.edge) {
            const at = place(surface.x[i], surface.z[i]);
            if (!standing.has(at)) standing.set(at, []);
            standing.get(at).push(surface.open[i]);
        }
    }

    let corners = 0;
    for (const held of standing.values()) {
        if (held.length < 2) continue;
        if (held.length === 4) corners++;
        for (const open of held) {
            assert.ok(Math.abs(open - held[0]) < 1e-6, 'every tile at a place agrees about it');
        }
    }

    assert.ok(corners > 0, 'the middle of a four-tile block is a place all four reach');
});

/**
 * A world is not settled once: it is laid a tile at a time, and a tile already
 * laid has its surface read off its field again whenever a join moves its
 * ground. That read puts back the openness that tile alone works out - at every
 * join the tile is on, not only at the join with the tile just laid - so a
 * laying pass has to settle the water of every tile the redraw reached and of
 * every tile those meet.
 *
 * `Terrain.addTile` is the renderer's half of that and needs a browser; the
 * order it runs in is the half that matters here, and that order is pure. Laid
 * nearest-first over a three by three, no place two tiles both call water
 * should be left with the two of them disagreeing about it.
 */
test('a block laid a tile at a time leaves no join unsettled', () => {
    const laid = new Map();
    const at = (x, z) => `${x},${z}`;

    const touching = (x, z) => {
        const found = [];
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dz === 0) continue;
                const near = laid.get(at(x + dx, z + dz));
                if (near) found.push(near);
            }
        }
        return found;
    };

    // Nearest the middle first, which is the order the ground is drawn in.
    const places = [];
    for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) places.push({ x, z });
    places.sort((a, b) => (a.x ** 2 + a.z ** 2) - (b.x ** 2 + b.z ** 2));

    for (const place of places) {
        const field = flooded(place.x, place.z);
        const near  = touching(place.x, place.z);
        const settled = near.length > 0 && matchEdges([field, ...near.map(t => t.field)]) > 0 ? near : [];

        const tile = { place, field, water: waterSurface(field) };
        laid.set(at(place.x, place.z), tile);

        // `redrawTile`: the ground moved, so the surface is read off it again -
        // and the openness one tile alone works out comes back with it.
        for (const neighbour of settled) neighbour.water = waterSurface(neighbour.field);
        if (settled.length === 0) continue;

        // `Terrain.waterAssembly`: the tiles this join rebuilt, and every tile
        // touching one of them.
        const assembly = new Set([tile, ...settled]);
        for (const one of [tile, ...settled]) {
            for (const other of touching(one.place.x, one.place.z)) assembly.add(other);
        }

        matchWater([...assembly].map(one => one.water));
    }

    const read = tiles => {
        const standing = new Map();
        for (const [open, surface] of tiles) {
            for (const i of surface.edge) {
                const key = place(surface.x[i], surface.z[i]);
                if (!standing.has(key)) standing.set(key, []);
                standing.get(key).push(open(surface, i));
            }
        }

        let shared = 0, worst = 0;
        for (const held of standing.values()) {
            if (held.length < 2) continue;
            shared++;
            worst = Math.max(worst, Math.max(...held) - Math.min(...held));
        }
        return { shared, worst };
    };

    const open = (surface, i) => surface.open[i];
    const drawnTiles = [...laid.values()].map(one => [open, one.water]);
    const asDrawn = read(drawnTiles);

    assert.ok(asDrawn.shared > 0, 'the block should share water across its joins, or this proves nothing');
    assert.ok(asDrawn.worst < 1e-6,
        `a join was left with the two tiles ${asDrawn.worst} apart on how open their water is`);

    // And the reading has teeth: what one tile alone makes of the same places
    // is what the laying pass had to settle.
    const alone = read([...laid.values()].map(one => [open, waterSurface(one.field)]));
    assert.equal(alone.shared, asDrawn.shared, 'the same places are shared either way');
    assert.ok(alone.worst > 1e-6,
        'one tile alone should disagree with its neighbour, or the settling is settling nothing');

    // Agreeing is half of it. The value they agree on has to be the one the
    // nine surfaces make of the place between them, and a laying pass settles
    // a place more than once: a tile laid later moves a neighbour's ground, the
    // neighbour's surface is read off it again, and the join is settled a
    // second time. Settling from what an earlier pass already settled weights
    // whichever tile was laid first, so the shoreline would read differently
    // depending on which way the aircraft flew into it.
    const whole = [...laid.values()].map(one => waterSurface(one.field));
    assert.ok(matchWater(whole) > 0, 'the nine fresh surfaces share water too');

    const standingAt = surfaces => {
        const found = new Map();
        for (const surface of surfaces) {
            for (const i of surface.edge) {
                const key = place(surface.x[i], surface.z[i]);
                if (!found.has(key)) found.set(key, []);
                found.get(key).push(surface.open[i]);
            }
        }
        return found;
    };

    const laidAt  = standingAt([...laid.values()].map(one => one.water));
    const wholeAt = standingAt(whole);

    let drift  = 0;
    let agreed = 0;
    for (const [key, held] of wholeAt) {
        if (held.length < 2) continue;
        agreed++;
        drift = Math.max(drift, Math.abs(laidAt.get(key)[0] - held[0]));
    }

    assert.equal(agreed, asDrawn.shared, 'over the same shared places either way');
    assert.ok(drift < 1e-6,
        `a place the block laid settled ${drift} away from what its nine surfaces make of it`);
});
