/**
 * Vertex normals for a mesh, recomputed over part of it rather than over all of
 * it.
 *
 * Three.js computes normals across a whole geometry, which is the right thing
 * for a mesh that was just built and the wrong thing for one where a join moved
 * a strip: a tile of the world is 201 by 201 vertices, and a tile settled
 * against a new neighbour has had three vertices in from one edge moved and
 * every other one left exactly as the generator drew it. Lighting the whole
 * plane again spends the cost of generating a tile to redraw a band of it.
 *
 * Pure module with no DOM or Three.js dependency - it writes into the arrays a
 * renderer is already drawing from rather than into a geometry - so the whole of
 * it can be unit tested in Node.
 */

/**
 * Recomputes the vertex normals around the vertices `moved` marks, leaving the
 * rest of the mesh lit exactly as it was.
 *
 * A vertex's normal is the sum of the normals of the faces meeting at it, so
 * the normals that change are not only the ones that moved: every vertex
 * sharing a face with a moved vertex changes too, and the rim of the band is
 * as wrong as the middle of it if that is missed. Those vertices are rebuilt
 * from nothing, over every face meeting each of them rather than only over the
 * faces that moved, which is what makes the result the same as a pass over the
 * whole mesh rather than an approximation of one.
 *
 * `positions` and `normals` are three numbers a vertex and `index` three
 * entries a face, the way a renderer holds them. `moved` is a flag per vertex.
 * Returns how many vertices were rebuilt, which is zero when nothing moved.
 */
export function updateNormals({ positions, normals, index, moved } = {}) {
    if (!positions || !normals || !index || !moved) return 0;

    const count = Math.floor(positions.length / 3);
    const rebuild = new Uint8Array(count);
    let rebuilt = 0;

    // Which vertices the move reaches: every vertex of every face with a moved
    // vertex in it.
    for (let f = 0; f + 2 < index.length; f += 3) {
        const a = index[f], b = index[f + 1], c = index[f + 2];
        if (!moved[a] && !moved[b] && !moved[c]) continue;
        rebuild[a] = 1;
        rebuild[b] = 1;
        rebuild[c] = 1;
    }

    for (let v = 0; v < count; v++) {
        if (!rebuild[v]) continue;
        normals[v * 3]     = 0;
        normals[v * 3 + 1] = 0;
        normals[v * 3 + 2] = 0;
        rebuilt++;
    }

    if (rebuilt === 0) return 0;

    // Every face meeting a vertex being rebuilt, accumulated into the vertices
    // of it that are being rebuilt and into none of the others - which is how a
    // face shared with ground that did not move is read for one end of itself
    // and left out of the other.
    for (let f = 0; f + 2 < index.length; f += 3) {
        const a = index[f], b = index[f + 1], c = index[f + 2];
        if (!rebuild[a] && !rebuild[b] && !rebuild[c]) continue;

        // The face normal as Three.js takes it, so a rebuilt band is lit by the
        // same arithmetic as the plane around it: the cross product of the two
        // edges leaving the second vertex of the face.
        const cbx = positions[c * 3]     - positions[b * 3];
        const cby = positions[c * 3 + 1] - positions[b * 3 + 1];
        const cbz = positions[c * 3 + 2] - positions[b * 3 + 2];
        const abx = positions[a * 3]     - positions[b * 3];
        const aby = positions[a * 3 + 1] - positions[b * 3 + 1];
        const abz = positions[a * 3 + 2] - positions[b * 3 + 2];

        const nx = cby * abz - cbz * aby;
        const ny = cbz * abx - cbx * abz;
        const nz = cbx * aby - cby * abx;

        if (rebuild[a]) {
            normals[a * 3]     += nx;
            normals[a * 3 + 1] += ny;
            normals[a * 3 + 2] += nz;
        }
        if (rebuild[b]) {
            normals[b * 3]     += nx;
            normals[b * 3 + 1] += ny;
            normals[b * 3 + 2] += nz;
        }
        if (rebuild[c]) {
            normals[c * 3]     += nx;
            normals[c * 3 + 1] += ny;
            normals[c * 3 + 2] += nz;
        }
    }

    for (let v = 0; v < count; v++) {
        if (!rebuild[v]) continue;

        const x = normals[v * 3], y = normals[v * 3 + 1], z = normals[v * 3 + 2];
        const length = Math.sqrt(x * x + y * y + z * z);
        if (length === 0) continue;

        normals[v * 3]     = x / length;
        normals[v * 3 + 1] = y / length;
        normals[v * 3 + 2] = z / length;
    }

    return rebuilt;
}
