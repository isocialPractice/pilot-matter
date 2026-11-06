import * as THREE from 'three';
import { recipeGeometry } from './prefabs.js';
import { drapedGeometry } from './objects.js';
import { hasAssetModel, assetModel } from './asset-loader.js';
import { holdGroundColor } from './ground-material.js';

/**
 * The objects one tile stands, as meshes: one `InstancedMesh` for every recipe
 * the tile carries, each object an instance of it, and one more for the
 * plinths under them. The recipe's triangles - laid out by `recipeGeometry` in
 * `js/prefabs.js` - are coloured at their corners and lit as the ground is, by
 * the same material with the same hold on its colour, so fog takes a building
 * as it takes the hill behind it.
 *
 * A road is laid over the ground rather than stood on it, so it cannot be one
 * instance of many: every road a tile carries is laid over its ground into one
 * mesh of its own, pulled toward the camera by a polygon offset so it never
 * flickers against the ground it follows. `groundAt(x, z)` is the tile's
 * ground.
 *
 * Returns a group to add to the scene, or null for a tile standing nothing.
 */
export function objectGroup(objects = [], { groundAt = () => 0 } = {}) {
    if (!objects?.length) return null;
    const group = new THREE.Group();
    group.name = 'objects';

    const matrix = new THREE.Matrix4();
    const turn = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();

    // A building the pilot loaded is a copy of its model, sharing what the
    // model is drawn with, once the model is read - and a box of its size,
    // instanced with the rest, until then.
    const byRecipe = new Map();
    for (const object of objects) {
        if (object.drape) continue;
        if (object.recipe?.asset && hasAssetModel(object.recipe.asset)) {
            const model = assetModel(object.recipe.asset, 'base');
            model.position.set(object.x, object.stand, object.z);
            model.rotation.y = object.yaw;
            model.scale.setScalar(object.scale);
            group.add(model);
            continue;
        }
        if (!byRecipe.has(object.key)) byRecipe.set(object.key, []);
        byRecipe.get(object.key).push(object);
    }

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
    const plinths = objects.filter(object => !object.drape && object.stand - object.base > 0.05);
    if (plinths.length > 0) {
        const block = new THREE.BoxGeometry(1, 1, 1);
        block.translate(0, -0.5, 0);
        // Each plinth in its recipe's own colour - a park's is grass, so it
        // reads as a terrace - or the usual concrete.
        const mesh = new THREE.InstancedMesh(block, holdGroundColor(new THREE.MeshLambertMaterial({ color: 0xffffff })), plinths.length);
        const colour = new THREE.Color();
        plinths.forEach((object, i) => {
            mesh.setColorAt(i, colour.setHex(object.plinth ?? PLINTH_COLOR));
            const { footprint } = object;
            turn.setFromAxisAngle(up, -footprint.angle);
            matrix.compose(
                position.set(footprint.x, object.stand, footprint.z), turn,
                scale.set(footprint.width, object.stand - object.base + PLINTH_DEPTH, footprint.depth)
            );
            mesh.setMatrixAt(i, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
    }

    const draped = drapedGeometry(objects, groundAt);
    if (draped.count > 0) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(draped.positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(draped.normals, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(draped.colors, 3));
        geometry.computeBoundingSphere();
        const material = objectMaterial();
        material.polygonOffset = true;
        material.polygonOffsetFactor = -2;
        material.polygonOffsetUnits = -2;
        group.add(new THREE.Mesh(geometry, material));
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
        // A loaded model's copy shares what it is drawn with; it is not this
        // tile's to give back.
        if (mesh.userData?.asset) continue;
        mesh.geometry?.dispose?.();
        mesh.material?.dispose?.();
        mesh.dispose?.();
    }
}
