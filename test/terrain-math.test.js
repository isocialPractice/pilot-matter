import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PLAINS_THRESHOLD,
    hash,
    smoothNoise,
    fbm,
    smoothstep,
    shapeHeight,
    mountainBump
} from '../js/terrain-math.js';

test('hash is deterministic and stays inside the unit range', () => {
    assert.equal(hash(3, 7), hash(3, 7));
    assert.notEqual(hash(3, 7), hash(7, 3));
    for (let x = -5; x <= 5; x++) {
        for (let y = -5; y <= 5; y++) {
            const v = hash(x, y);
            assert.ok(v >= 0 && v < 1, `hash(${x}, ${y}) = ${v} is outside [0, 1)`);
        }
    }
});

test('smoothNoise returns the lattice hash exactly on integer coordinates', () => {
    assert.equal(smoothNoise(2, 5), hash(2, 5));
    assert.equal(smoothNoise(-3, 0), hash(-3, 0));
});

test('smoothNoise interpolates between the surrounding lattice points', () => {
    const corners = [hash(0, 0), hash(1, 0), hash(0, 1), hash(1, 1)];
    const low = Math.min(...corners), high = Math.max(...corners);
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        const v = smoothNoise(t, t);
        assert.ok(v >= low && v <= high, `smoothNoise(${t}, ${t}) = ${v} left the cell range`);
    }
});

test('fbm is deterministic and normalised back into the unit range', () => {
    assert.equal(fbm(1.5, -2.25), fbm(1.5, -2.25));
    for (let i = 0; i < 40; i++) {
        const v = fbm(i * 0.37, i * -0.19);
        assert.ok(v >= 0 && v < 1, `fbm sample ${i} = ${v} is outside [0, 1)`);
    }
});

test('a single fbm octave is just the noise it layers', () => {
    assert.equal(fbm(0.4, 0.8, 1), smoothNoise(0.4, 0.8));
});

test('fbm with no octaves is flat ground rather than a divide by zero', () => {
    assert.equal(fbm(0.4, 0.8, 0), 0);
});

test('smoothstep is flat at both ends and clamps beyond them', () => {
    assert.equal(smoothstep(0), 0);
    assert.equal(smoothstep(1), 1);
    assert.equal(smoothstep(0.5), 0.5);
    assert.equal(smoothstep(-4), 0);
    assert.equal(smoothstep(9), 1);
});

test('smoothstep rises monotonically across the middle', () => {
    let previous = smoothstep(0);
    for (let t = 0.05; t <= 1; t += 0.05) {
        const current = smoothstep(t);
        assert.ok(current > previous, `smoothstep dipped at t = ${t}`);
        previous = current;
    }
});

test('shapeHeight compresses low noise into plains', () => {
    const maxHeight = 480;
    // Just under the threshold stays near the ground, just over it jumps
    // onto the peak curve
    const plains = shapeHeight(PLAINS_THRESHOLD - 0.01, maxHeight);
    const foothill = shapeHeight(PLAINS_THRESHOLD + 0.01, maxHeight);
    assert.ok(plains < 0.1 * maxHeight, `plains height ${plains} is not low ground`);
    assert.ok(foothill > plains, 'crossing the threshold should raise the terrain');
});

test('shapeHeight never exceeds the terrain maximum and never goes negative', () => {
    const maxHeight = 480;
    for (let n = 0; n <= 1.0001; n += 0.02) {
        const h = shapeHeight(n, maxHeight);
        assert.ok(h >= 0 && h <= maxHeight, `shapeHeight(${n}) = ${h} is out of bounds`);
    }
    // The peak curve tops out just under the ceiling, so the tallest terrain
    // vertex sits a little below maxHeight and mountains have room above it
    assert.ok(shapeHeight(1, maxHeight) > 0.99 * maxHeight,
        'the highest noise should still reach near the ceiling');
    assert.equal(shapeHeight(0, maxHeight), 0);
});

test('shapeHeight rises with the noise it is given', () => {
    const maxHeight = 480;
    let previous = shapeHeight(0, maxHeight);
    for (let n = 0.05; n <= 1; n += 0.05) {
        const current = shapeHeight(n, maxHeight);
        assert.ok(current >= previous, `terrain height dipped at noise ${n}`);
        previous = current;
    }
});

test('mountainBump is full height at the centre and nothing at the rim', () => {
    assert.equal(mountainBump(0, 500, 300), 300);
    assert.equal(mountainBump(500, 500, 300), 0);
    assert.equal(mountainBump(900, 500, 300), 0);
});

test('mountainBump falls off smoothly from centre to rim', () => {
    let previous = mountainBump(0, 500, 300);
    for (let d = 25; d <= 500; d += 25) {
        const current = mountainBump(d, 500, 300);
        assert.ok(current < previous, `bump did not fall off at distance ${d}`);
        assert.ok(current >= 0, `bump went negative at distance ${d}`);
        previous = current;
    }
});

test('mountainBump ignores a degenerate radius instead of dividing by zero', () => {
    assert.equal(mountainBump(0, 0, 300), 0);
    assert.equal(mountainBump(10, -5, 300), 0);
});
