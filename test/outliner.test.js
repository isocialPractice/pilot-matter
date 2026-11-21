import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    cleanPlacementName, placementName, placementNamed, placementHidden, placementLocked,
    placementPickable, withPlacementField, PLACEMENT_NAME_LIMIT
} from '../js/outliner.js';
import {
    createBuildState, openBuildMode, beginCanvas, chooseBuildTool, dropDraft, acceptDraft,
    selectPlacement, pickedIndex, pickUpPlacement, committedPlacements, buildDraft,
    renamePlacement, hidePlacement, lockPlacement, writePlacementField, placementSelectable,
    buildHistoryDepth, undoBuild, layStroke, reviseDraft, requestLeave, answerConfirm,
    sessionWorld, BUILD_FROM_TITLE, CONFIRM_YES
} from '../js/build-mode.js';
import {
    dockContent, canvasElements, OUTLINER_SECTION, OUTLINER_HEADING, DOCK_OUTLINER, DOCK_SELECT
} from '../js/build-panel.js';
import { createBuildCamera, DEFAULT_FOV } from '../js/build-camera.js';
import { placementAt, placementReach, objectRayAt } from '../js/build-select.js';
import { resolveErasures } from '../js/environment/erase.js';
import { erasedObjects, placeObject } from '../js/objects.js';
import { prefabById, prefabsIn } from '../js/prefabs.js';
import { getEnvironment } from '../js/environment/presets.js';
import { readEnvironmentDocument, environmentDocument, environmentText } from '../js/environment-file.js';
import { SELECT_TOOL } from '../js/build-tools.js';

const SIZE = 16000;
const schema = JSON.parse(readFileSync(new URL('../schemas/environment.schema.json', import.meta.url), 'utf8'));

/** A building from the catalogue, to stand an object up with. */
const PREFAB = prefabsIn('residential')[0].id;

function onCanvas(environment = 'highlands') {
    const state = createBuildState();
    openBuildMode(state, BUILD_FROM_TITLE);
    beginCanvas(state, environment);
    return state;
}

/** A canvas with `count` mountains dropped and kept, each a little apart. */
function built(count = 2) {
    const state = onCanvas();
    chooseBuildTool(state, 'mountain');
    for (let at = 0; at < count; at++) {
        dropDraft(state, { x: at * 3000 - 3000, z: 0 }, { size: SIZE });
        acceptDraft(state);
    }
    chooseBuildTool(state, SELECT_TOOL);
    return state;
}

const outliner = (state, open = true) =>
    dockContent(state, { camera: createBuildCamera(SIZE), fov: DEFAULT_FOV, outliner: open })
        .sections.find(section => section.id === OUTLINER_SECTION);

// --- The three fields -------------------------------------------------------------------

test('a name is trimmed, collapsed and held to its length, and anything that is not one is no name', () => {
    assert.equal(cleanPlacementName('  North   Peak  '), 'North Peak');
    assert.equal(cleanPlacementName(''), '');
    assert.equal(cleanPlacementName('   '), '');
    assert.equal(cleanPlacementName(null), '');
    assert.equal(cleanPlacementName(7), '');
    assert.equal(cleanPlacementName('x'.repeat(PLACEMENT_NAME_LIMIT + 10)).length, PLACEMENT_NAME_LIMIT);
});

test('a placement shows its own name, or what it is called in its place', () => {
    assert.equal(placementName({ type: 'mountain', name: 'North Peak' }), 'North Peak');
    assert.equal(placementName({ type: 'mountain' }), '');
    assert.equal(placementNamed({ type: 'mountain' }, 'MOUNTAIN'), 'MOUNTAIN');
    assert.equal(placementNamed({ type: 'mountain', name: 'North Peak' }, 'MOUNTAIN'), 'North Peak');
});

test('either box is read as set only when it is true, so nothing else in a placement turns one on', () => {
    for (const read of [placementHidden, placementLocked]) {
        const field = read === placementHidden ? 'hidden' : 'locked';
        assert.equal(read({ type: 'mountain', [field]: true }), true);
        assert.equal(read({ type: 'mountain', [field]: false }), false);
        assert.equal(read({ type: 'mountain', [field]: 1 }), false, 'a one is not a true');
        assert.equal(read({ type: 'mountain' }), false);
        assert.equal(read(null), false);
    }
});

test('a placement is pickable until it is hidden or locked', () => {
    assert.equal(placementPickable({ type: 'mountain' }), true);
    assert.equal(placementPickable({ type: 'mountain', hidden: true }), false);
    assert.equal(placementPickable({ type: 'mountain', locked: true }), false);
});

/**
 * A field turned off is written by leaving it out rather than by writing false,
 * so a placement nobody has touched and one turned back are the one
 * description - and a file carries only what was actually set.
 */
test('a field set to nothing is deleted rather than written false', () => {
    const plain = { type: 'mountain', config: {} };
    assert.deepEqual(withPlacementField(plain, 'hidden', true), { type: 'mountain', config: {}, hidden: true });
    assert.deepEqual(withPlacementField({ ...plain, hidden: true }, 'hidden', false), plain);
    assert.deepEqual(withPlacementField({ ...plain, locked: true }, 'locked', false), plain);
    assert.deepEqual(withPlacementField({ ...plain, name: 'North Peak' }, 'name', '   '), plain);
    assert.deepEqual(withPlacementField(plain, 'name', ' North  Peak '), { ...plain, name: 'North Peak' });
    assert.deepEqual(withPlacementField(plain, 'whatever', true), plain, 'and a field that is none of the three writes nothing');
});

test('a field is written as a copy, so the placement handed in is not touched', () => {
    const plain = { type: 'mountain', config: {} };
    const written = withPlacementField(plain, 'hidden', true);
    assert.notEqual(written, plain);
    assert.equal(placementHidden(plain), false);
});

// --- Writing them through the session ----------------------------------------------------

test('a placement is renamed, hidden and locked by its index, and each is a step of the history', () => {
    const state = built(1);

    assert.equal(renamePlacement(state, 0, 'North Peak'), true);
    assert.equal(hidePlacement(state, 0), true);
    assert.equal(lockPlacement(state, 0), true);

    const placement = committedPlacements(state)[0];
    assert.equal(placement.name, 'North Peak');
    assert.equal(placement.hidden, true);
    assert.equal(placement.locked, true);
    assert.equal(buildHistoryDepth(state).past, 4, 'the drop, then each of the three');

    assert.equal(undoBuild(state), true);
    assert.equal(placementLocked(committedPlacements(state)[0]), false, 'a lock is taken back like anything else');
    assert.equal(undoBuild(state), true);
    assert.equal(placementHidden(committedPlacements(state)[0]), false);
    assert.equal(undoBuild(state), true);
    assert.equal(placementName(committedPlacements(state)[0]), '', 'and so is a rename');
});

test('writing a field it already holds changes nothing and is no step', () => {
    const state = built(1);
    const before = buildHistoryDepth(state).past;
    assert.equal(hidePlacement(state, 0, false), false, 'it was not hidden');
    assert.equal(renamePlacement(state, 0, ''), false, 'and it had no name');
    assert.equal(buildHistoryDepth(state).past, before);
});

test('a write is refused off a canvas, under a question, with an edit in hand, and for no such placement', () => {
    assert.equal(renamePlacement(createBuildState(), 0, 'North Peak'), false);

    const state = built(1);
    for (const index of [-1, 1, 1.5, null, 'first']) {
        assert.equal(renamePlacement(state, index, 'North Peak'), false, `${index} names no placement`);
    }

    chooseBuildTool(state, 'mountain');
    dropDraft(state, { x: 5000, z: 5000 }, { size: SIZE });
    assert.equal(renamePlacement(state, 0, 'North Peak'), false, 'not with an edit in hand');
    acceptDraft(state);

    requestLeave(state);
    assert.equal(renamePlacement(state, 0, 'North Peak'), false, 'and not under a question');
    answerConfirm(state, CONFIRM_YES);
});

/**
 * The draft is a copy taken when the placement was picked, so a field written
 * on the committed placement alone would be written back over by the accept.
 */
test('renaming the placement in hand writes the draft too, so the accept does not undo it', () => {
    const state = built(1);
    selectPlacement(state, 0);
    assert.equal(pickedIndex(state), 0);

    assert.equal(renamePlacement(state, 0, 'North Peak'), true);
    assert.equal(placementName(buildDraft(state)), 'North Peak', 'the draft carries it as well');

    acceptDraft(state);
    assert.equal(placementName(committedPlacements(state)[0]), 'North Peak');
});

test('hiding or locking the placement in hand lets go of it, since neither is one to leave a gumball on', () => {
    for (const turn of [hidePlacement, lockPlacement]) {
        const state = built(1);
        selectPlacement(state, 0);
        assert.equal(turn(state, 0), true);
        assert.equal(pickedIndex(state), null);
        assert.equal(buildDraft(state), null);
    }
});

// --- What a hidden or a locked placement is out of ----------------------------------------

test('a hidden placement is off the canvas and still in the world a flight and a file are drawn from', () => {
    const state = built(2);
    const whole = canvasElements(getEnvironment('highlands'), state);
    hidePlacement(state, 0);

    const drawn = canvasElements(getEnvironment('highlands'), state);
    assert.equal(drawn.length, whole.length - 1, 'one of the two is left out of what the canvas is drawn from');
    assert.deepEqual(drawn, whole.filter(placement => placement.config?.at?.[0] !== -3000),
        'and it is the hidden one, the rest of the canvas exactly as it was');
    assert.equal(sessionWorld(state).placements.length, 2, 'and both are in the world that is kept');
    assert.equal(placementHidden(sessionWorld(state).placements[0]), true, 'the hiding kept with it');
});

test('a hidden or a locked placement reaches nothing, so a click on the canvas cannot find it', () => {
    const state = built(1);
    const at = committedPlacements(state)[0].config.at;
    assert.equal(placementAt(committedPlacements(state), at[0], at[1], SIZE), 0, 'it is found while it is plain');

    for (const field of ['hidden', 'locked']) {
        const marked = [{ ...committedPlacements(state)[0], [field]: true }];
        assert.equal(placementReach(marked[0], SIZE)(at[0], at[1]), 0, field);
        assert.equal(placementAt(marked, at[0], at[1], SIZE), null, `${field}: and nothing is picked there`);
    }
});

test('a hidden or a locked object is not there for a ray to hit either', () => {
    const object = placeObject(PREFAB, [0, 0]);
    const down = [{ x: 0, y: 500, z: 0 }, { x: 0, y: -1, z: 0 }];
    assert.equal(objectRayAt([object], ...down), 0, 'the ray meets it while it is plain');

    for (const field of ['hidden', 'locked']) {
        assert.equal(objectRayAt([{ ...object, [field]: true }], ...down), null, field);
    }
});

test('a row does not select a hidden or a locked placement, and that is the whole of what the lock refuses', () => {
    const state = built(1);
    assert.equal(placementSelectable(state, 0), true);

    hidePlacement(state, 0);
    assert.equal(placementSelectable(state, 0), false);
    assert.equal(selectPlacement(state, 0), null, 'the row picks nothing up');
    assert.equal(pickUpPlacement(state, 0), false);
    assert.equal(pickedIndex(state), null);

    // And the row is still where it is shown again.
    assert.equal(hidePlacement(state, 0, false), true);
    assert.equal(selectPlacement(state, 0)?.picked, 0);
});

/**
 * An erase batch is a region cut when the ground is composited rather than
 * when the stroke was laid, so a lock is read live: it lifts the cut a batch
 * was making, and unlocking puts it back. That is what makes a lock reversible.
 */
test('a locked placement takes no cut, however many erase batches reach it', () => {
    const mountain = { type: 'mountain', config: { at: [0, 0] }, seed: 1 };
    const batch = { type: 'erase', config: { target: 'all', strength: 1 }, footprint: { kind: 'disc', x: 0, z: 0, radius: 2000 } };

    const cut = resolveErasures([mountain, batch]);
    assert.equal(cut.length, 1, 'the batch itself is taken out of the list');
    assert.equal(cut[0].cut.length, 1, 'and the mountain carries what it took');

    const locked = resolveErasures([{ ...mountain, locked: true }, batch]);
    assert.equal(locked.length, 1);
    assert.equal('cut' in locked[0], false, 'the lock lifted it');
    assert.equal(locked[0].locked, true, 'and the placement is otherwise exactly as it was');
});

test('a locked object is not taken by an erase batch either', () => {
    const object = placeObject(PREFAB, [0, 0]);
    const batch = { type: 'erase', config: { target: 'all', strength: 1 }, footprint: { kind: 'disc', x: 0, z: 0, radius: 2000 } };

    assert.deepEqual([...erasedObjects([object, batch], SIZE)], [0]);
    assert.deepEqual([...erasedObjects([{ ...object, locked: true }, batch], SIZE)], []);
});

test('hiding a placement does not stop an erase reaching it, which is the lock\'s job and not hiding\'s', () => {
    const mountain = { type: 'mountain', config: { at: [0, 0] }, seed: 1, hidden: true };
    const batch = { type: 'erase', config: { target: 'all', strength: 1 }, footprint: { kind: 'disc', x: 0, z: 0, radius: 2000 } };
    assert.equal(resolveErasures([mountain, batch])[0].cut.length, 1);
});

// --- The dock's section --------------------------------------------------------------------

test('the outliner is a folding section of Select\'s panel, carrying its count while it is shut', () => {
    const state = built(3);
    const shut = outliner(state, false);

    assert.equal(shut.kind, DOCK_OUTLINER);
    assert.equal(shut.folds, true);
    assert.equal(shut.open, false);
    assert.equal(shut.heading, `${OUTLINER_HEADING} (3)`);
    assert.deepEqual(shut.entries, [], 'folded, it lists nothing');
    assert.deepEqual(shut.rows, [], 'and it has no rows of values at all');
});

test('opened it lists every placement in the order it was drawn', () => {
    const state = built(3);
    renamePlacement(state, 1, 'North Peak');
    const open = outliner(state);

    assert.deepEqual(open.entries.map(entry => entry.index), [0, 1, 2]);
    assert.deepEqual(open.entries.map(entry => entry.label), ['MOUNTAIN 1', 'MOUNTAIN 2', 'MOUNTAIN 3'],
        'each read by its type, numbered because three of them are listed');
    assert.deepEqual(open.entries.map(entry => entry.name), ['', 'North Peak', '']);
    assert.ok(open.entries.every(entry => entry.limit === PLACEMENT_NAME_LIMIT));
});

/**
 * A row never named shows its type alone, so without this two mountains are
 * two rows reading MOUNTAIN with nothing on either to tell them apart, and the
 * only way to find out which is which is pressing each row in turn.
 */
test('a type listed more than once is numbered as it is listed, and one listed alone is not', () => {
    const one = built(1);
    assert.deepEqual(outliner(one).entries.map(entry => entry.label), ['MOUNTAIN'],
        'a number says nothing where there is nothing to tell apart');

    const mixed = built(2);
    mixed.placements.push(placeObject(PREFAB, [0, 0]));
    assert.deepEqual(outliner(mixed).entries.map(entry => entry.label),
        ['MOUNTAIN 1', 'MOUNTAIN 2', prefabById(PREFAB).label],
        'each type counted on its own, the one standing alone left as it was');

    // The number is a placeholder and nothing else: naming a row leaves the
    // rest numbered as they were, and nothing is written into the placement.
    renamePlacement(mixed, 0, 'North Peak');
    assert.deepEqual(outliner(mixed).entries.map(entry => entry.label),
        ['MOUNTAIN 1', 'MOUNTAIN 2', prefabById(PREFAB).label]);
    assert.deepEqual(outliner(mixed).entries.map(entry => entry.name), ['North Peak', '', '']);
    assert.equal(committedPlacements(mixed)[1].name, undefined, 'the second mountain was never written to');
});

test('a row says whether it is the one picked, whether either box is on, and whether it can be picked', () => {
    const state = built(3);
    selectPlacement(state, 0);
    hidePlacement(state, 1);
    lockPlacement(state, 2);

    const entries = outliner(state).entries;
    assert.deepEqual(entries.map(entry => entry.live), [true, false, false]);
    assert.deepEqual(entries.map(entry => entry.hidden), [false, true, false]);
    assert.deepEqual(entries.map(entry => entry.locked), [false, false, true]);
    assert.deepEqual(entries.map(entry => entry.selectable), [true, false, false]);
});

test('the outliner is there with a placement picked as well, above what is picked', () => {
    const state = built(2);
    selectPlacement(state, 0);
    const shown = dockContent(state, { camera: createBuildCamera(SIZE), fov: DEFAULT_FOV, outliner: true });

    assert.equal(shown.kind, DOCK_SELECT);
    assert.equal(shown.sections[0].id, OUTLINER_SECTION);
    assert.equal(shown.sections[1].id, 'pick');
});

test('an object is named for the building it stands for rather than for its type', () => {
    const state = onCanvas();
    state.placements.push(placeObject(PREFAB, [0, 0]));
    assert.equal(outliner(state).entries[0].label, prefabById(PREFAB).label);
});

// --- The file and the schema ----------------------------------------------------------------

test('the three fields are written into a file and read back from one', () => {
    const state = built(2);
    renamePlacement(state, 0, 'North Peak');
    hidePlacement(state, 0);
    lockPlacement(state, 1);

    const document = environmentDocument(sessionWorld(state), { name: 'Sample Valley' });
    assert.equal(document.placements[0].name, 'North Peak');
    assert.equal(document.placements[0].hidden, true);
    assert.equal(document.placements[1].locked, true);
    assert.equal('hidden' in document.placements[1], false, 'and nothing is written for a box left off');

    const read = readEnvironmentDocument(environmentText(document));
    assert.equal(read.ok, true, read.problems[0]);
    assert.deepEqual(read.world.placements, document.placements, 'every field back as it went');
});

test('a file naming a placement badly is refused, and told which placement and which field', () => {
    const state = built(1);
    const broken = [
        [placement => { placement.name = 7; }, /^placements\[0\]: name is not text/],
        [placement => { placement.name = 'x'.repeat(PLACEMENT_NAME_LIMIT + 1); }, new RegExp(`^placements\\[0\\]: name is longer than ${PLACEMENT_NAME_LIMIT} characters`)],
        [placement => { placement.hidden = false; }, /^placements\[0\]: hidden is true or is left out/],
        [placement => { placement.locked = 'yes'; }, /^placements\[0\]: locked is true or is left out/]
    ];

    for (const [breakIt, expected] of broken) {
        const document = environmentDocument(sessionWorld(state), { name: 'Sample Valley' });
        breakIt(document.placements[0]);
        const read = readEnvironmentDocument(environmentText(document));
        assert.equal(read.ok, false, `${expected} should have been refused`);
        assert.match(read.problems[0], expected);
    }
});

test('a name that is nothing but space is read as no name rather than refusing the file', () => {
    const state = built(1);
    const document = environmentDocument(sessionWorld(state), { name: 'Sample Valley' });
    document.placements[0].name = '   ';
    const read = readEnvironmentDocument(environmentText(document));

    assert.equal(read.ok, true, read.problems[0]);
    assert.equal('name' in read.world.placements[0], false);
});

test('the schema names the three fields and the same name length as the module', () => {
    const placement = schema.$defs.placement.properties;
    assert.equal(placement.name.type, 'string');
    assert.equal(placement.name.maxLength, PLACEMENT_NAME_LIMIT);
    assert.equal(placement.name.minLength, 1, 'an empty name is written by leaving the field out');
    assert.equal(placement.hidden.const, true);
    assert.equal(placement.locked.const, true);
});
