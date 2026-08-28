import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createField, fieldX, fieldZ, fieldBounds, sampleHeight,
    applyBase, applyElement, createRandom,
    matchEdges, tileSeed, SEAM_BLEND, readColor, paint
} from '../js/environment/elements.js';
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

test('the ground a tile is shaped on runs on across the join', () => {
    const west = tile(0, 0);
    const east = tile(1, 0);

    const leaving  = edge(west, 'maxX');
    const arriving = edge(east, 'minX');

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
    const west = tile(0, 0);
    const east = tile(1, 0);

    // Something drawn over each edge, so the two have a real disagreement to
    // settle rather than the base ground they already agree on.
    applyElement(west, { type: 'mountain', config: { count: 8 } }, createRandom(3));
    applyElement(east, { type: 'mountain', config: { count: 8 } }, createRandom(11));

    const before = edge(west, 'maxX').map(vertex => vertex.height);
    const settled = matchEdges([west, east]);

    assert.equal(settled, west.stride, 'every vertex down the join should be settled');

    const leaving  = edge(west, 'maxX');
    const arriving = edge(east, 'minX');

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
    const west = tile(0, 0);
    const east = tile(1, 0);
    applyElement(west, { type: 'mountain', config: { count: 8 } }, createRandom(3));
    applyElement(east, { type: 'mountain', config: { count: 8 } }, createRandom(11));

    const before = Float32Array.from(west.height);

    // The row the two disagree most about, which is the row that has the most
    // to say about how the disagreement is eased away.
    const gap = (line) => Math.abs(
        west.height[line * west.stride + west.stride - 1] - east.height[line * east.stride]
    );

    // Kept clear of the ends of the join, where a vertex is near two sides at
    // once and takes what is being eased in from both of them.
    let row = SEAM_BLEND;
    for (let line = SEAM_BLEND; line < west.stride - SEAM_BLEND; line++) {
        if (gap(line) > gap(row)) row = line;
    }
    assert.ok(gap(row) > 1, 'the two should have something to disagree about');

    matchEdges([west, east]);

    const at = (depth) => row * west.stride + (west.stride - 1 - depth);

    const seam = Math.abs(west.height[at(0)] - before[at(0)]);
    const inner = Math.abs(west.height[at(1)] - before[at(1)]);

    assert.ok(seam > 0, 'the vertex on the join should move');
    assert.ok(inner < seam, 'and the one behind it should move less');
    assert.equal(west.height[at(SEAM_BLEND)], before[at(SEAM_BLEND)],
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
    const west = tile(0, 0);
    const east = tile(1, 0);
    applyElement(west, { type: 'mountain', config: { count: 8 } }, createRandom(3));

    matchEdges([west, east]);
    const settled = Float32Array.from(west.height);

    matchEdges([west, east]);
    for (let i = 0; i < west.count; i++) {
        assert.ok(Math.abs(west.height[i] - settled[i]) < 1e-4, 'a second pass should be a no-op');
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
    const west = tile(0, 0);
    const east = tile(1, 0);

    const line = 3;
    paint(west, line * west.stride + west.stride - 1, [1, 0, 0]);
    paint(east, line * east.stride, [0, 0, 1]);

    matchEdges([west, east]);

    const [wr, wg, wb] = readColor(west, line * west.stride + west.stride - 1);
    const [er, eg, eb] = readColor(east, line * east.stride);

    assert.ok(Math.abs(wr - er) < 1e-3 && Math.abs(wg - eg) < 1e-3 && Math.abs(wb - eb) < 1e-3);
    assert.ok(Math.abs(wr - 0.5) < 1e-3, 'the settled colour is what the two of them had');
    assert.ok(Math.abs(wb - 0.5) < 1e-3);
});
