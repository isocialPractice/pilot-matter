import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    PREFABS, PREFAB_CATEGORIES, RECIPE_PART_LIMIT, prefabsIn, recipeBounds, recipeGeometry, recipeSolid, readRecipe
} from '../js/prefabs.js';
import { placeObject, standingObjects, obstacleTop } from '../js/objects.js';

const meshSource = readFileSync(fileURLToPath(new URL('../js/object-mesh.js', import.meta.url)), 'utf8');

/** The counts Insert City was asked for, as the request gave them. Roads are the next run's, under INFRASTRUCTURE too. */
const ASKED = Object.freeze({
    skylines: [4, 6], factory: [2, 4], residential: [8, 10], commercial: [4, 6], infrastructure: [4, 6], parks: [6, 8]
});

test('every category holds as many as were asked for', () => {
    assert.deepEqual(Object.keys(ASKED), PREFAB_CATEGORIES.map(category => category.id));
    for (const [category, [low, high]] of Object.entries(ASKED)) {
        const count = prefabsIn(category).length;
        assert.ok(count >= low && count <= high, `${category}: ${count}, asked ${low} to ${high}`);
    }
    assert.equal(PREFABS.length, Object.keys(ASKED).reduce((sum, category) => sum + prefabsIn(category).length, 0), 'none outside a category');
});

test('the catalogue is the plan\'s, card for card', () => {
    const names = category => prefabsIn(category).map(prefab => prefab.label);
    assert.deepEqual(names('skylines'), ['GLASS CLUSTER', 'STEPPED TOWERS', 'SPIRE BLOCK', 'SLAB ROW', 'MIXED SKYLINE']);
    assert.deepEqual(names('factory'), ['SAWTOOTH MILL', 'STACK WORKS', 'TANK YARD']);
    assert.deepEqual(names('residential'), ['COTTAGE', 'BUNGALOW', 'TWO-STOREY HOUSE', 'TERRACE ROW', 'DUPLEX', 'TOWNHOUSES', 'LOW-RISE FLATS', 'APARTMENT BLOCK', 'HIGH-RISE FLATS']);
    assert.deepEqual(names('commercial'), ['CORNER SHOP', 'HIGH STREET ROW', 'OFFICE BLOCK', 'SHOPPING CENTRE', 'HOTEL']);
    assert.deepEqual(names('infrastructure'), ['POWER STATION', 'WATER TOWER', 'SUBSTATION', 'FIRE STATION', 'HOSPITAL']);
    assert.deepEqual(names('parks'), ['LAWN', 'WOODLAND', 'POND PARK', 'PLAYGROUND', 'SPORTS FIELD', 'PLAZA', 'FORMAL GARDEN']);
    assert.equal(new Set(PREFABS.map(prefab => prefab.label)).size, PREFABS.length, 'no name twice');
    for (const prefab of PREFABS) {
        assert.match(prefab.id, /^[a-z]+(-[a-z]+)*$/, `${prefab.id} is an id a file can carry`);
        assert.equal(prefab.label, prefab.label.toUpperCase());
    }
});

/** The places a recipe has something at least `tall` metres high standing, which is how many towers a skyline is. */
function towers(recipe, tall = 25) {
    const places = new Set();
    for (const part of recipe.parts) {
        const height = part.shape === 'box' || part.shape === 'wedge' ? part.size[1] : part.height;
        if (height >= tall) places.add(`${part.at[0]},${part.at[2]}`);
    }
    return places.size;
}

test('a skyline is a block of two to five towers, reaching up past every block of flats', () => {
    const flats = recipeBounds(prefabsIn('residential').find(prefab => prefab.id === 'high-rise-flats').recipe).top;
    for (const prefab of prefabsIn('skylines')) {
        const count = towers(prefab.recipe);
        assert.ok(count >= 2 && count <= 5, `${prefab.id} has ${count} towers`);
        assert.ok(recipeBounds(prefab.recipe).top > flats, `${prefab.id} reaches past the high-rise flats`);
    }
    assert.equal(towers(prefabsIn('residential')[0].recipe), 0, 'and a cottage is no tower');
});

test('every building is solid, and every park is flown over, laid on a lawn of its own over a plinth of its own colour', () => {
    for (const prefab of PREFABS) {
        if (prefab.category === 'parks') {
            assert.equal(recipeSolid(prefab.recipe), false, `${prefab.id} is not in the way`);
            assert.ok(Number.isInteger(prefab.recipe.plinth), `${prefab.id} names its plinth's colour`);
            const [ground] = prefab.recipe.parts;
            assert.equal(ground.shape, 'box');
            assert.deepEqual([ground.size[0], ground.size[2], ground.at[1]], [...prefab.footprint, 0], `${prefab.id} lies on ground the size of its card`);
            assert.ok(ground.size[1] <= 0.3, 'a hair thick');
        } else {
            assert.equal(recipeSolid(prefab.recipe), true, `${prefab.id} is solid`);
            assert.equal(prefab.recipe.plinth, undefined, `${prefab.id} stands on the usual plinth`);
        }
    }
});

test('every card is a size a city is built of, and cheap enough to draw by the hundred', () => {
    for (const prefab of PREFABS) {
        const [across, along] = prefab.footprint;
        assert.ok(across >= 8 && across <= 120 && along >= 8 && along <= 120, `${prefab.id} is ${across} by ${along}`);
        assert.ok(prefab.recipe.parts.length <= RECIPE_PART_LIMIT);
        assert.ok(recipeGeometry(prefab.recipe).count / 3 <= 3000, `${prefab.id} is ${recipeGeometry(prefab.recipe).count / 3} triangles`);
        assert.deepEqual(readRecipe(prefab.recipe).problems, [], prefab.id);
        assert.ok(prefab.recipe.parts.every(part => part.at[1] >= 0), `${prefab.id} has nothing below the ground it stands on`);
    }
});

test('a park\'s plinth is drawn in its colour, a building\'s in the usual one', () => {
    const park = placeObject('pond-park', [0, 0]);
    const house = placeObject('bungalow', [200, 0]);
    const [lawn, home] = standingObjects([park, house], { groundAt: x => x * 0.01 });
    assert.equal(lawn.plinth, park.recipe.plinth);
    assert.equal(home.plinth, null);
    assert.equal(obstacleTop([lawn, home], 0, 0), null, 'the park is flown over');
    assert.ok(obstacleTop([lawn, home], 200, 0) > 0, 'the bungalow is not');
    assert.match(meshSource, /mesh\.setColorAt\(i, colour\.setHex\(object\.plinth \?\? PLINTH_COLOR\)\);/);
    assert.match(meshSource, /if \(mesh\.instanceColor\) mesh\.instanceColor\.needsUpdate = true;/);
    assert.deepEqual(readRecipe({ ...park.recipe, plinth: 'green' }).problems, ['recipe: plinth is not a colour']);
});
