import * as THREE from 'three';
import { recipeGeometry } from './prefabs.js';
import { holdGroundColor } from './ground-material.js';

/**
 * The objects one tile stands, as meshes: one `InstancedMesh` for every recipe
 * the tile carries, each object an instance of it, and one more for the
 * plinths under them. The recipe's triangles - laid out by `recipeGeometry` in
 * `js/prefabs.js` - are coloured at their corners and lit as the ground is, by
 * the same material with the same hold on its colour, so fog takes a building
 * as it takes the hill behind it.
 *
 * Returns a group to add to the scene, or null for a tile standing nothing.
 */
export function objectGroup(objects = []) {
    if (!objects?.length) return null;
    const group = new THREE.Group();
    group.name = 'objects';

    const byRecipe = new Map();
    for (const object of objects) {
        if (!byRecipe.has(object.key)) byRecipe.set(object.key, []);
        byRecipe.get(object.key).push(object);
    }

    const matrix = new THREE.Matrix4();
    const turn = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();

    for (const standing of byRecipe.values()) {
        const shape = recipeGeometry(standing[0].recipe);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(shape.positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(shape.normals, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(shape.colors, 3));
        geometry.computeBoundingSphere();

        const mesh = new THREE.InstancedMesh(geometry, objectMaterial(), standing.length);
        standing.forEach((object, i) => {
            turn.setFromAxisAngle(up, object.yaw);
            matrix.compose(position.set(object.x, object.stand, object.z), turn, scale.setScalar(object.scale));
            mesh.setMatrixAt(i, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
    }

    // A plinth under every object standing on ground that falls away under it:
    // its footprint, from the highest ground under it down past the lowest.
    const plinths = objects.filter(object => object.stand - object.base > 0.05);
    if (plinths.length > 0) {
        const block = new THREE.BoxGeometry(1, 1, 1);
        block.translate(0, -0.5, 0);
        const mesh = new THREE.InstancedMesh(block, holdGroundColor(new THREE.MeshLambertMaterial({ color: PLINTH_COLOR })), plinths.length);
        plinths.forEach((object, i) => {
            const { footprint } = object;
            turn.setFromAxisAngle(up, -footprint.angle);
            matrix.compose(
                position.set(footprint.x, object.stand, footprint.z), turn,
                scale.set(footprint.width, object.stand - object.base + PLINTH_DEPTH, footprint.depth)
            );
            mesh.setMatrixAt(i, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
    }

    return group;
}

/** The plinth's colour, and how far below the lowest ground under it it reaches, so no edge shows daylight. */
export const PLINTH_COLOR = 0x8f8c84;
export const PLINTH_DEPTH = 1;

/** The material a recipe is drawn in: its corners' colours, lit and fogged as the ground is. */
function objectMaterial() {
    return holdGroundColor(new THREE.MeshLambertMaterial({ vertexColors: true }));
}

/** Gives back everything a tile's objects held. */
export function disposeObjectGroup(group) {
    if (group == null) return;
    for (const mesh of group.children) {
        mesh.geometry?.dispose?.();
        mesh.material?.dispose?.();
        mesh.dispose?.();
    }
}
