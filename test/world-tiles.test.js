import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TILE_REACH, TILE_KEEP,
    tileIndexAt, tileKey, tileCenter, tileBounds, tilesInReach,
    tileWorthKeeping, sameTile, isHomeTile
} from '../js/world-tiles.js';
import { DEFAULT_SIZE, tileSeed } from '../js/environment/elements.js';

const SIZE = DEFAULT_SIZE;
const HALF = SIZE / 2;

/** The ground a set of tiles covers on one axis, which is one unbroken block. */
function coverage(tiles, axis) {
    const low  = Math.min(...tiles.map(tile => tile[axis]));
    const high = Math.max(...tiles.map(tile => tile[axis]));
    return { low: low * SIZE - HALF, high: high * SIZE + HALF };
}

// --- Where a place is on the grid -----------------------------------------

test('the middle of the world is the tile a flight opens over', () => {
    assert.deepEqual(tileIndexAt(0, 0, SIZE), { x: 0, z: 0 });
    assert.ok(isHomeTile(tileIndexAt(0, 0, SIZE)));
    assert.ok(isHomeTile(tileIndexAt(HALF - 1, -HALF + 1, SIZE)),
        'anywhere inside the middle square is still the middle tile');
});

test('past the edge of a tile is the next tile along rather than the end of the world', () => {
    assert.deepEqual(tileIndexAt(HALF + 1, 0, SIZE), { x: 1, z: 0 });
    assert.deepEqual(tileIndexAt(-HALF - 1, 0, SIZE), { x: -1, z: 0 });
    assert.deepEqual(tileIndexAt(0, -HALF - 1, SIZE), { x: 0, z: -1 });
    assert.deepEqual(tileIndexAt(SIZE * 4 + 10, SIZE * -3, SIZE), { x: 4, z: -3 });
});

test('a tile is centred on its place in the grid and covers a square either side of it', () => {
    assert.deepEqual(tileCenter({ x: 2, z: -1 }, SIZE), { x: SIZE * 2, z: -SIZE });
    assert.deepEqual(tileBounds({ x: 0, z: 0 }, SIZE), {
        minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF
    }, 'the middle tile is the square the world has always been');

    const next = tileBounds({ x: 1, z: 0 }, SIZE);
    assert.equal(next.minX, HALF, 'a tile begins where the one before it ended');
});

test('a place in the grid is named the same way by everything that names it', () => {
    assert.equal(tileKey({ x: -2, z: 3 }), tileKey(tileIndexAt(-2 * SIZE, 3 * SIZE, SIZE)));
    assert.notEqual(tileKey({ x: 1, z: 0 }), tileKey({ x: 0, z: 1 }));
    assert.ok(sameTile({ x: 1, z: 2 }, { x: 1, z: 2 }));
    assert.ok(!sameTile({ x: 1, z: 2 }, { x: 2, z: 1 }));
    assert.ok(!sameTile(null, { x: 0, z: 0 }), 'nowhere is not the same place as anywhere');
});

// --- What has to be drawn -------------------------------------------------

test('the ground drawn always includes the tile the aircraft is over', () => {
    for (const [x, z] of [[0, 0], [7000, -7000], [HALF + 5, HALF + 5], [-53210, 91234]]) {
        const here = tileIndexAt(x, z, SIZE);
        assert.ok(tilesInReach(x, z, SIZE).some(tile => sameTile(tile, here)),
            `the tile at ${x},${z} should be among the tiles drawn for it`);
    }
});

// The whole point of the grid: wherever the aircraft is, there is more ground
// past it than the camera can see, so the end of the world is never in frame.
test('the ground drawn runs at least the full reach past the aircraft on every side', () => {
    for (let x = -SIZE; x <= SIZE; x += 613) {
        for (let z = -SIZE; z <= SIZE; z += 977) {
            const tiles = tilesInReach(x, z, SIZE);
            const across = coverage(tiles, 'x');
            const along  = coverage(tiles, 'z');

            assert.ok(across.low <= x - TILE_REACH && across.high >= x + TILE_REACH,
                `the ground at ${x},${z} stops short east or west of the aircraft`);
            assert.ok(along.low <= z - TILE_REACH && along.high >= z + TILE_REACH,
                `the ground at ${x},${z} stops short north or south of the aircraft`);
        }
    }
});

test('the ground is drawn nearest first, so a budget spends itself where it matters', () => {
    const x = HALF - 100, z = 200;
    const tiles = tilesInReach(x, z, SIZE);

    const distances = tiles.map(tile => {
        const middle = tileCenter(tile, SIZE);
        return (middle.x - x) ** 2 + (middle.z - z) ** 2;
    });

    assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
    assert.ok(sameTile(tiles[0], tileIndexAt(x, z, SIZE)),
        'the nearest tile is the one being flown over');
});

// A reach inside a tile and a half can never ask for more than three tiles on
// an axis, which is what bounds how much world can be on screen at once.
test('no position asks for more than nine tiles at a time', () => {
    let most = 0;
    for (let x = -SIZE * 2; x <= SIZE * 2; x += 401) {
        for (let z = -SIZE * 2; z <= SIZE * 2; z += 809) {
            most = Math.max(most, tilesInReach(x, z, SIZE).length);
        }
    }
    assert.ok(most <= 9, `a position asked for ${most} tiles at once`);
    assert.ok(TILE_REACH < SIZE * 1.5, 'the reach has to stay inside a tile and a half for that to hold');
});

test('the same place always asks for the same ground', () => {
    const first  = tilesInReach(1234, -5678, SIZE).map(tileKey);
    const second = tilesInReach(1234, -5678, SIZE).map(tileKey);
    assert.deepEqual(first, second);
});

test('a world with no size to it is one tile rather than a division by zero', () => {
    assert.deepEqual(tilesInReach(0, 0, 0), [{ x: 0, z: 0 }]);
    assert.deepEqual(tilesInReach(10, 10, NaN), [{ x: 0, z: 0 }]);
    assert.deepEqual(tileIndexAt(NaN, 10, SIZE), { x: 0, z: 0 });
});

// --- What is kept, and what is let go -------------------------------------

test('every tile being drawn is a tile worth keeping', () => {
    for (const [x, z] of [[0, 0], [4000, 4000], [-SIZE, SIZE], [23456, -19876]]) {
        for (const tile of tilesInReach(x, z, SIZE)) {
            assert.ok(tileWorthKeeping(tile, x, z, SIZE),
                `${tileKey(tile)} is drawn at ${x},${z} and would be released the same frame`);
        }
    }
});

// Without this, an aircraft weaving over the line a tile is dropped at would
// generate that tile again every time it crossed back.
test('a tile just out of reach is held rather than dropped and drawn again', () => {
    const behind = { x: -1, z: 0 };
    const justOut = tileBounds(behind, SIZE).maxX + TILE_REACH + TILE_KEEP / 2;

    assert.ok(!tilesInReach(justOut, 0, SIZE).some(tile => sameTile(tile, behind)),
        'the tile should be out of reach for this to be testing anything');
    assert.ok(tileWorthKeeping(behind, justOut, 0, SIZE), 'and should still be held');
});

test('ground a whole reach and more behind is let go', () => {
    const behind = { x: 0, z: 0 };
    const gone = tileBounds(behind, SIZE).maxX + TILE_REACH + TILE_KEEP + 1;
    assert.ok(!tileWorthKeeping(behind, gone, 0, SIZE));
});

test('what is kept is never wider than what can be asked for', () => {
    for (let x = -SIZE; x <= SIZE; x += 503) {
        const kept = [];
        for (let ix = -3; ix <= 3; ix++) {
            if (tileWorthKeeping({ x: ix, z: 0 }, x, 0, SIZE)) kept.push(ix);
        }
        assert.ok(kept.length <= 3, `${kept.length} tiles held across the axis at ${x}`);
    }
});

// --- The world the grid is seeded from ------------------------------------

// The middle tile has to be exactly the world the environment always described,
// or every course, every runway, and every stored seed would move under it.
test('the middle tile is the world the environment describes, unchanged', () => {
    for (const seed of [1, 7, 4242, 90210]) {
        assert.equal(tileSeed(seed, 0, 0), seed);
    }
});

test('the tiles around it are the same world without being the same ground', () => {
    const seeds = new Set();
    for (const tile of tilesInReach(0, 0, SIZE)) {
        seeds.add(tileSeed(1234, tile.x, tile.z));
    }
    assert.equal(seeds.size, tilesInReach(0, 0, SIZE).length,
        'two tiles drawn at once should not be the same ground twice');
});

test('the tile at a place is that ground every time it is laid', () => {
    assert.equal(tileSeed(99, 3, -2), tileSeed(99, 3, -2));
    assert.notEqual(tileSeed(99, 3, -2), tileSeed(99, -2, 3));
});
