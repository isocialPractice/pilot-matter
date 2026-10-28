import test from 'node:test';
import assert from 'node:assert/strict';
import { updateNormals } from '../js/terrain-normals.js';

const SEGMENTS = 10;
const BAND = 3;

/**
 * A plane grid laid out the way `PlaneGeometry` lays one, as the arrays a
 * renderer holds: three numbers a vertex, three index entries a face, and the
 * vertices in the row-by-row order the field is written in.
 */
function plane(segments = SEGMENTS, height = () => 0) {
    const stride = segments + 1;
    const count  = stride * stride;

    const positions = new Float32Array(count * 3);
    const index     = new Uint32Array(segments * segments * 6);

    for (let row = 0; row < stride; row++) {
        for (let col = 0; col < stride; col++) {
            const at = (row * stride + col) * 3;
            positions[at]     = col * 10;
            positions[at + 1] = height(col, row);
            positions[at + 2] = row * 10;
        }
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

    return { stride, count, positions, index };
}

/**
 * Normals over the whole mesh, worked out the way Three.js works them out: the
 * sum of the normals of the faces meeting each vertex, normalized. This is what
 * the partial pass has to agree with, vertex for vertex, or the band is lit
 * differently from the plane around it and the join is visible as a line of
 * shading rather than as a step.
 */
function wholeMesh({ positions, index }) {
    const normals = new Float32Array(positions.length);

    for (let f = 0; f < index.length; f += 3) {
        const a = index[f], b = index[f + 1], c = index[f + 2];

        const cbx = positions[c * 3]     - positions[b * 3];
        const cby = positions[c * 3 + 1] - positions[b * 3 + 1];
        const cbz = positions[c * 3 + 2] - positions[b * 3 + 2];
        const abx = positions[a * 3]     - positions[b * 3];
        const aby = positions[a * 3 + 1] - positions[b * 3 + 1];
        const abz = positions[a * 3 + 2] - positions[b * 3 + 2];

        const nx = cby * abz - cbz * aby;
        const ny = cbz * abx - cbx * abz;
        const nz = cbx * aby - cby * abx;

        for (const v of [a, b, c]) {
            normals[v * 3]     += nx;
            normals[v * 3 + 1] += ny;
            normals[v * 3 + 2] += nz;
        }
    }

    for (let v = 0; v < normals.length / 3; v++) {
        const x = normals[v * 3], y = normals[v * 3 + 1], z = normals[v * 3 + 2];
        const length = Math.sqrt(x * x + y * y + z * z);
        if (length === 0) continue;

        normals[v * 3]     = x / length;
        normals[v * 3 + 1] = y / length;
        normals[v * 3 + 2] = z / length;
    }

    return normals;
}

/** Every vertex sharing a face with a marked one, which is every normal that changes. */
function reached({ index, count }, moved) {
    const found = new Uint8Array(count);

    for (let f = 0; f < index.length; f += 3) {
        const face = [index[f], index[f + 1], index[f + 2]];
        if (!face.some(v => moved[v])) continue;
        for (const v of face) found[v] = 1;
    }

    return found;
}

/** The vertices down one side of a grid, out to a depth of it. */
function band(mesh, depth) {
    const moved = new Uint8Array(mesh.count);

    for (let row = 0; row < mesh.stride; row++) {
        for (let col = 0; col < depth; col++) moved[row * mesh.stride + col] = 1;
    }

    return moved;
}

function readVertex(normals, v) {
    return [normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]];
}

// --- Lighting a strip rather than a plane ---------------------------------

test('a mesh nothing moved is a mesh nothing is lit again', () => {
    const mesh    = plane(SEGMENTS, (col, row) => col * 3 + row * 2);
    const normals = wholeMesh(mesh);
    const before  = normals.slice();

    const rebuilt = updateNormals({
        positions: mesh.positions,
        normals,
        index: mesh.index,
        moved: new Uint8Array(mesh.count)
    });

    assert.equal(rebuilt, 0, 'nothing moved, so nothing needed working out again');
    assert.deepEqual(normals, before, 'and nothing was written');
});

test('a pass with nothing to write into reports nothing done rather than throwing', () => {
    assert.equal(updateNormals(), 0);
    assert.equal(updateNormals({ positions: new Float32Array(9) }), 0);
});

test('the strip comes out exactly as a pass over the whole mesh would have lit it', () => {
    const mesh    = plane(SEGMENTS, (col, row) => Math.sin(col * 0.7) * 40 + row * 3);
    const normals = wholeMesh(mesh);

    // The join: a band SEAM_BLEND deep down one side, eased so the correction
    // wears off the way `applySeams` wears one off.
    const moved = band(mesh, BAND);
    for (let v = 0; v < mesh.count; v++) {
        if (!moved[v]) continue;
        const col = v % mesh.stride;
        mesh.positions[v * 3 + 1] += (BAND - col) * 5;
    }

    const whole  = wholeMesh(mesh);
    const strip  = normals.slice();
    const rebuilt = updateNormals({
        positions: mesh.positions,
        normals: strip,
        index: mesh.index,
        moved
    });

    assert.ok(rebuilt > 0, 'the band should have been lit again');

    for (let v = 0; v < mesh.count; v++) {
        const lit = readVertex(strip, v);
        const all = readVertex(whole, v);
        for (let c = 0; c < 3; c++) {
            assert.ok(Math.abs(lit[c] - all[c]) < 1e-6,
                `vertex ${v} is lit as ${lit} where the whole mesh makes it ${all}`);
        }
    }
});

test('the vertices lit again are the band and the ground sharing a face with it', () => {
    const mesh    = plane(SEGMENTS, (col, row) => col * 4 - row * 6);
    const normals = wholeMesh(mesh);

    const moved = band(mesh, BAND);
    for (let v = 0; v < mesh.count; v++) if (moved[v]) mesh.positions[v * 3 + 1] += 25;

    const expected = reached(mesh, moved);
    let wanted = 0;
    for (const flag of expected) if (flag) wanted++;

    const before  = normals.slice();
    const rebuilt = updateNormals({
        positions: mesh.positions, normals, index: mesh.index, moved
    });

    assert.equal(rebuilt, wanted,
        'every vertex of every face the move touched, and no vertex beyond them');

    // The rim is the half of this that is easy to miss: a vertex one step past
    // the band did not move and is still lit differently, because a face
    // meeting it did.
    const rim = mesh.stride + BAND;
    assert.notDeepEqual(readVertex(normals, rim), readVertex(before, rim),
        'the first vertex past the band shares a face with it, so its normal moved too');

    for (let v = 0; v < mesh.count; v++) {
        if (expected[v]) continue;
        assert.deepEqual(readVertex(normals, v), readVertex(before, v),
            `vertex ${v} shares no face with the join and should be lit as it was`);
    }
});

test('one vertex moved lights the faces meeting it and nothing else', () => {
    const mesh    = plane(SEGMENTS, (col, row) => col + row);
    const normals = wholeMesh(mesh);
    const before  = normals.slice();

    const middle = Math.floor(mesh.stride / 2) * mesh.stride + Math.floor(mesh.stride / 2);
    const moved  = new Uint8Array(mesh.count);
    moved[middle] = 1;
    mesh.positions[middle * 3 + 1] += 60;

    const expected = reached(mesh, moved);
    const whole    = wholeMesh(mesh);
    const rebuilt  = updateNormals({
        positions: mesh.positions, normals, index: mesh.index, moved
    });

    let wanted = 0;
    for (const flag of expected) if (flag) wanted++;
    assert.equal(rebuilt, wanted);

    for (let v = 0; v < mesh.count; v++) {
        const lit = readVertex(normals, v);
        if (expected[v]) {
            const all = readVertex(whole, v);
            for (let c = 0; c < 3; c++) assert.ok(Math.abs(lit[c] - all[c]) < 1e-6);
        } else {
            assert.deepEqual(lit, readVertex(before, v));
        }
    }
});

test('a mesh lit flat is lit flat again, however much of it moved', () => {
    const mesh    = plane(SEGMENTS);
    const normals = wholeMesh(mesh);

    updateNormals({
        positions: mesh.positions, normals, index: mesh.index, moved: band(mesh, BAND)
    });

    for (let v = 0; v < mesh.count; v++) {
        const [x, y, z] = readVertex(normals, v);
        assert.ok(Math.abs(x) < 1e-6 && Math.abs(z) < 1e-6, 'flat ground faces straight up');
        assert.ok(Math.abs(Math.abs(y) - 1) < 1e-6, 'and does so at unit length');
    }
});
