import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    TILE_REACH, TILE_KEEP,
    tileIndexAt, tileKey, tileCenter, tileBounds, tilesInReach,
    tileWorthKeeping, sameTile, isHomeTile, tilesTouching
} from '../js/world-tiles.js';
import {
    DEFAULT_SIZE, tileSeed, createField, fieldX, fieldZ
} from '../js/environment/elements.js';

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

/**
 * The grid's whole promise is that the ground runs further than the camera can
 * see, and for a while that rested on a comment: `TILE_REACH` was 12000 here
 * and the far plane was 12000 in `js/main.js`, with nothing failing if either
 * were changed on its own. The camera is built from the reach now, and this is
 * what fails if a number is ever put back in its place.
 *
 * `js/main.js` loads a renderer and a document, so it is read rather than
 * imported - the same way `test/docs.test.js` reads the entry point.
 */
test('the camera is drawn no further than the ground is laid', () => {
    const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

    const camera = main.match(/new THREE\.PerspectiveCamera\(([^)]*)\)/);
    assert.ok(camera, 'js/main.js should still be building a camera');

    const far = camera[1].split(',')[3]?.trim();
    assert.match(far ?? '', /TILE_REACH/,
        `the far plane reads ${far}, which is a number to be matched rather than the reach itself`);

    // Drawn shorter than the ground is laid is fine; drawn further is the void
    // edge back in frame, so the expression is worked out rather than matched.
    const drawn = Function('TILE_REACH', `return (${far});`)(TILE_REACH);
    assert.ok(Number.isFinite(drawn) && drawn <= TILE_REACH,
        `the camera is drawn to ${drawn} and the ground only to ${TILE_REACH}`);
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

// --- The tiles one tile has to be settled against -------------------------

/**
 * Where a tile puts every vertex on its outside, as the keys `matchEdges`
 * groups them by.
 *
 * This is the thing the neighbour list is actually for, so it is what the tests
 * below measure it against: a tile is settled against another because the two
 * put a vertex in the same place, and asking the field arithmetic where those
 * places are is a different question from asking the grid arithmetic which
 * tiles are adjacent. A list that agreed with itself about adjacency and
 * disagreed with the field about shared vertices would leave a join open.
 */
function boundaryPlaces(index, segments = 8) {
    const field = createField({
        size: SIZE, segments,
        originX: index.x * SIZE, originZ: index.z * SIZE
    });

    const places = new Set();
    for (let i = 0; i < field.count; i++) {
        const col = i % field.stride;
        const row = Math.floor(i / field.stride);
        if (col === 0 || col === field.stride - 1 || row === 0 || row === field.stride - 1) {
            places.add(`${Math.round(fieldX(field, i) * 1000) / 1000},`
                     + `${Math.round(fieldZ(field, i) * 1000) / 1000}`);
        }
    }

    return places;
}

/** How many vertices two tiles put in the same place. */
function sharedWith(here, there) {
    const mine = boundaryPlaces(here);
    let shared = 0;
    for (const place of boundaryPlaces(there)) if (mine.has(place)) shared++;
    return shared;
}

test('a tile is settled against eight tiles, which is every one it can touch', () => {
    for (const index of [{ x: 0, z: 0 }, { x: 3, z: -2 }, { x: -7, z: 11 }]) {
        const touching = tilesTouching(index);

        assert.equal(touching.length, 8, `${tileKey(index)} should name eight neighbours`);
        assert.equal(new Set(touching.map(tileKey)).size, 8, 'and name none of them twice');
        assert.ok(!touching.some(place => sameTile(place, index)),
            'a tile is not its own neighbour');
    }
});

// The whole point of the list, and the one assertion that would catch a
// neighbour quietly dropped out of it.
test('every tile named shares vertices with the tile it was named for', () => {
    const index = { x: 2, z: -1 };

    for (const place of tilesTouching(index)) {
        assert.ok(sharedWith(index, place) > 0,
            `${tileKey(place)} is named a neighbour of ${tileKey(index)} but shares no vertex with it`);
    }
});

// And the other direction, which is the one a diagonal would be lost in: the
// four tiles across a corner share exactly one vertex each, so a list built out
// of the four sides alone passes the test above and still leaves four corners of
// the tile unmatched.
test('no tile left off the list shares a vertex with it, and the corners are on it', () => {
    const index = { x: 2, z: -1 };
    const named = new Set(tilesTouching(index).map(tileKey));

    for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
            const place = { x: index.x + dx, z: index.z + dz };
            if (sameTile(place, index)) continue;

            const shared = sharedWith(index, place);
            assert.equal(shared > 0, named.has(tileKey(place)),
                `${tileKey(place)} shares ${shared} vertices and is `
              + `${named.has(tileKey(place)) ? '' : 'not '}named`);
        }
    }

    for (const corner of [{ x: 1, z: -2 }, { x: 3, z: -2 }, { x: 1, z: 0 }, { x: 3, z: 0 }]) {
        assert.ok(named.has(tileKey(corner)), `the corner ${tileKey(corner)} has to be settled against`);
        assert.equal(sharedWith(index, corner), 1, 'a corner is one vertex, which still has to close');
    }
});

test('the sides are settled before the corners, so a longer join is never the one dropped', () => {
    const index = { x: 0, z: 0 };
    const touching = tilesTouching(index);

    const sides = touching.slice(0, 4).map(place => sharedWith(index, place));
    const corners = touching.slice(4).map(place => sharedWith(index, place));

    assert.ok(sides.every(count => count > 1), 'the first four share a whole edge');
    assert.ok(corners.every(count => count === 1), 'and the last four share one vertex');
});

test('a tile with no place in the grid has no neighbours rather than eight wrong ones', () => {
    assert.deepEqual(tilesTouching(null), []);
    assert.deepEqual(tilesTouching(undefined), []);
});
