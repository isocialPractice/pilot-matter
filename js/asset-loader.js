import * as THREE from 'three';
import { ASSET_COLOR, ASSET_HEIGHT, ASSET_TRIANGLE_LIMIT, glbJson, outsideAddress, selfContained } from './asset-fit.js';

/**
 * A loaded asset's bytes read into a model, in the page.
 *
 * Each format goes through the loader three is built with, fetched from the
 * same place three is, only when a file of that format is first read:
 *
 * - **glTF** - only when everything it uses is inside it: every buffer and
 *   image either part of the file or named as a `data:` address. One file was
 *   given, so nothing is fetched. Both formats are refused before they are
 *   parsed, by the file's own JSON - a `.gltf`'s is the file, a `.glb`'s its
 *   first chunk - and held to it while they are, by `embeddedOnly` below.
 * - **OBJ** and **STL** - geometry only, painted the colour the step chose.
 * - **SVG** - a plan: its shapes extruded up to the height the step asked for,
 *   flat-roofed. It is parsed as text and never put into the document, so a
 *   script inside it has nowhere to run.
 *
 * A model read is kept by the asset's id, and handed out as copies sharing its
 * geometry - turned up the way its step said, faced along `+z`, scaled to
 * metres, and stood on its base or anchored at its middle.
 */

const LOADERS = {
    // The glTF loader is the only one handed a manager, because it is the only
    // one that resolves an address: the other three are given the bytes and
    // parse what they were given.
    gltf: () => import('three/addons/loaders/GLTFLoader.js').then(module => new module.GLTFLoader(embeddedOnly())),
    obj: () => import('three/addons/loaders/OBJLoader.js').then(module => new module.OBJLoader()),
    stl: () => import('three/addons/loaders/STLLoader.js').then(module => new module.STLLoader()),
    svg: () => import('three/addons/loaders/SVGLoader.js').then(module => module.SVGLoader)
};

/** A model refused while it was read, with why. */
export class AssetRefused extends Error {}

/**
 * The addresses a model may be read from in the page: a `data:` address
 * written inside it, and a `blob:` the page itself made out of a chunk of it,
 * which is how three hands an embedded texture to an image loader. Anything
 * else is somewhere on the network. The scheme is matched either case, since
 * `DATA:` is as valid as `data:`.
 *
 * Wider than `insideFile` in `js/asset-fit.js` on purpose, and the two are not
 * interchangeable: this is what the *page* may ask for while it reads a model
 * it was handed, which includes a blob of the file's own bytes that the page
 * made a moment ago. What a *file* may name is the narrower rule, since a
 * `blob:` address can only be resolved by the page that minted it and so can
 * never be inside a file that names it.
 */
const EMBEDDED_ADDRESS = /^(?:data|blob):/i;

/** True for an address a model may be read from in the page. */
export function embeddedAddress(url) {
    return EMBEDDED_ADDRESS.test(String(url ?? ''));
}

/** An address as it is named in a refusal: enough of it to recognise, never the whole of a long one. */
function namedAddress(url) {
    const address = String(url ?? '');
    return address.length > 120 ? `${address.slice(0, 117)}...` : address;
}

/**
 * A loading manager that refuses every address but those two, so a model is
 * read from the file that was given and from nothing else.
 *
 * glTF names its buffers and images by `uri`, and three fetches each one it is
 * handed - with `path` empty, an absolute address as given. An environment file
 * carries its assets' bytes, so one crafted `.glb` in a shared world would call
 * home for every pilot who opened it, and the SHA-256 check says nothing about
 * that - it proves the bytes are the ones the file's author shipped.
 *
 * `selfContained` refuses both formats from their own JSON before either is
 * parsed. This is the backstop behind it: it holds whatever a later extension
 * adds a `uri` to without being taught the field's name, and it is what stops
 * the fetch rather than merely naming it. It throws `AssetRefused`, which three
 * turns into a rejected parse and `readModel` passes through with its reason
 * intact - for a buffer. For an image three catches the throw inside its own
 * texture loading, drops the texture and resolves the parse anyway, so a model
 * reaching here on an image would be drawn untextured with nothing said; the
 * check before the parse is what makes the refusal the pilot sees.
 */
function embeddedOnly() {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => {
        if (embeddedAddress(url)) return String(url);
        throw new AssetRefused(`the model points at another file, ${namedAddress(url)}; everything it uses has to be inside it`);
    });
    return manager;
}

/** The triangles a model is drawn with. */
export function countTriangles(object) {
    let count = 0;
    object.traverse(node => {
        const geometry = node.isMesh ? node.geometry : null;
        if (!geometry) return;
        count += (geometry.index ? geometry.index.count : geometry.attributes.position?.count ?? 0) / 3;
    });
    return Math.round(count);
}

function painted(object, color) {
    const material = new THREE.MeshLambertMaterial({ color });
    object.traverse(node => { if (node.isMesh) node.material = material; });
    return object;
}

/**
 * A file's bytes read as a model: `{ object, triangles, raw }`, `raw` its size
 * in its own units - for a plan, its extent across and along the page it was
 * drawn on. Refused with `AssetRefused` for a model that cannot be read, a
 * glTF pointing at other files, or one past the triangle limit.
 */
export async function readModel(format, bytes, { color = ASSET_COLOR, height = ASSET_HEIGHT, scale = 1 } = {}) {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const text = () => new TextDecoder().decode(bytes);
    let object;
    let raw = null;

    try {
        if (format === 'glb' || format === 'gltf') {
            const loader = await LOADERS.gltf();
            let source = buffer;
            if (format === 'gltf') {
                source = text();
                if (!selfContained(JSON.parse(source))) throw new AssetRefused('the glTF points at other files; save it with its buffers and images inside it, as a .glb or as `data:` addresses');
            } else {
                // A GLB carries the same JSON in its first chunk, so the same
                // check is read off that chunk. Unparseable bytes are left to
                // the loader, which says what is wrong with them better.
                const json = glbJson(bytes);
                const outside = json == null ? null : outsideAddress(json);
                if (outside != null) throw new AssetRefused(`the model points at another file, ${namedAddress(outside)}; everything it uses has to be inside it`);
            }
            object = (await loader.parseAsync(source, '')).scene;
        } else if (format === 'obj') {
            object = painted((await LOADERS.obj()).parse(text()), color);
        } else if (format === 'stl') {
            const geometry = (await LOADERS.stl()).parse(buffer);
            object = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }));
        } else if (format === 'svg') {
            const SVGLoader = await LOADERS.svg();
            const data = new SVGLoader().parse(text());
            const shapes = data.paths.flatMap(path => SVGLoader.createShapes(path));
            if (shapes.length === 0) throw new AssetRefused('the SVG has no shapes to build from');
            // Extruded up by the height asked for, in the plan's own units so
            // that scaled to metres it comes to that height; the page's y runs
            // down, so it is turned over onto the ground the right way round.
            const geometry = new THREE.ExtrudeGeometry(shapes, { depth: height / (scale > 0 ? scale : 1), bevelEnabled: false });
            geometry.rotateX(-Math.PI / 2);
            object = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }));
            const box = new THREE.Box3().setFromObject(object);
            raw = { x: box.max.x - box.min.x, y: box.max.z - box.min.z, z: 0 };
        } else {
            throw new AssetRefused(`no model is read from a .${format}`);
        }
    } catch (error) {
        if (error instanceof AssetRefused) throw error;
        throw new AssetRefused(`the file could not be read as ${format.toUpperCase()}: ${error?.message ?? error}`);
    }

    const triangles = countTriangles(object);
    if (triangles === 0) throw new AssetRefused('the model has nothing in it to draw');
    if (triangles > ASSET_TRIANGLE_LIMIT) {
        throw new AssetRefused(`the model has ${triangles.toLocaleString('en-GB')} triangles; the most is ${ASSET_TRIANGLE_LIMIT.toLocaleString('en-GB')}`);
    }
    if (raw == null) {
        const box = new THREE.Box3().setFromObject(object);
        raw = { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z };
    }
    return { object, triangles, raw };
}

/** The turn about the upright that brings a model's nose round to `+z`. */
const FACING_TURN = Object.freeze({ '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2, '-x': Math.PI / 2 });

/**
 * A copy of a model taken as its step said: turned up, faced along `+z`,
 * scaled to metres, and - `anchor: 'base'` - stood with the middle of its
 * footprint on its point and its lowest on the ground, or - `'centre'` -
 * held at the middle of its bounds, which is how an aircraft is flown.
 */
export function placedModel(object, { up = 'y', facing = '+z', scale = 1, anchor = 'base' } = {}) {
    const upright = new THREE.Group();
    upright.add(object.clone(true));
    if (up === 'z') upright.rotation.x = -Math.PI / 2;
    const faced = new THREE.Group();
    faced.add(upright);
    faced.rotation.y = FACING_TURN[facing] ?? 0;
    const sized = new THREE.Group();
    sized.add(faced);
    sized.scale.setScalar(scale > 0 ? scale : 1);
    sized.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(sized);
    const root = new THREE.Group();
    root.add(sized);
    sized.position.set(
        -(box.min.x + box.max.x) / 2,
        anchor === 'centre' ? -(box.min.y + box.max.y) / 2 : -box.min.y,
        -(box.min.z + box.max.z) / 2
    );
    root.userData.asset = true;
    return root;
}

/** The models read so far, by asset id: `{ object, asset }`, the asset the step it was read with left it. */
const MODELS = new Map();

/** Reads an asset's model and keeps it by its id, so placing it again costs nothing. Resolves to the model read, or rejects with why not. */
export async function registerAsset(asset) {
    const read = await readModel(asset.format, asset.bytes, { color: asset.color, height: asset.height, scale: asset.scale });
    MODELS.set(asset.id, { object: read.object, asset });
    return read;
}

/** Keeps a model already read under an asset's id. */
export function keepModel(asset, object) {
    MODELS.set(asset.id, { object, asset });
}

/** Lets an asset's model go. */
export function forgetModel(id) {
    MODELS.delete(id);
}

/** True once an asset's model has been read. */
export function hasAssetModel(id) {
    return MODELS.has(id);
}

/** A copy of an asset's model taken as its step said, or null before it is read. */
export function assetModel(id, anchor = 'base') {
    const kept = MODELS.get(id);
    if (!kept) return null;
    return placedModel(kept.object, { up: kept.asset.up, facing: kept.asset.facing, scale: kept.asset.scale, anchor });
}
