import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PHOTO_KEY,
    PHOTO_NAME,
    isPhotoKey,
    createPhotoState,
    photoPending,
    requestPhoto,
    completePhoto,
    applyPhotoKey,
    photoFilename,
    savePhoto
} from '../js/photo.js';

// Enough of a canvas and a page for a picture to be saved, with no browser to
// save it in. The link records what it was handed, and whether it was clicked.
function fakePage({ data = 'data:image/png;base64,AAAA' } = {}) {
    const links = [];
    const canvas = { toDataURL: () => data };
    const body = { children: [], appendChild(node) { this.children.push(node); } };

    const doc = {
        body,
        createElement() {
            const link = {
                href: '', download: '', clicked: 0, removed: false,
                click() { this.clicked++; },
                remove() { this.removed = true; }
            };
            links.push(link);
            return link;
        }
    };

    return { canvas, doc, links };
}

test('the key that takes a picture is its own, and not one anything else answers to', () => {
    assert.equal(isPhotoKey(PHOTO_KEY), true);
    for (const code of ['KeyP', 'KeyO', 'KeyM', 'Tab', 'KeyR', 'KeyH', 'F1']) {
        assert.equal(isPhotoKey(code), false, `${code} already belongs to something else`);
    }
});

test('a session opens with no picture asked for and none taken', () => {
    const state = createPhotoState();
    assert.equal(photoPending(state), false);
    assert.equal(state.taken, 0);
});

test('asking for a picture leaves one pending, and asking again changes nothing', () => {
    const state = createPhotoState();
    assert.equal(requestPhoto(state), true);
    assert.equal(photoPending(state), true);
    assert.equal(requestPhoto(state), false, 'a second ask is the same picture');
    assert.equal(photoPending(state), true);
});

test('taking the picture clears the request and counts the shot', () => {
    const state = createPhotoState();
    requestPhoto(state);
    assert.equal(completePhoto(state), 1);
    assert.equal(photoPending(state), false);

    requestPhoto(state);
    assert.equal(completePhoto(state), 2);
});

test('the key asks for one picture, and a held key is still one picture', () => {
    const state = createPhotoState();
    assert.equal(applyPhotoKey(state, PHOTO_KEY, true), true);
    assert.equal(applyPhotoKey(state, PHOTO_KEY, true, true), false, 'auto-repeat is the same press');

    completePhoto(state);
    assert.equal(applyPhotoKey(state, PHOTO_KEY, false), false, 'and a release is not a press');
    assert.equal(applyPhotoKey(state, 'KeyP', true), false, 'nor is another key');
    assert.equal(photoPending(state), false);
});

test('a picture is named after the game and the moment it was taken', () => {
    const stamp = new Date(2026, 7, 24, 5, 7, 9);
    assert.equal(photoFilename(stamp), `${PHOTO_NAME}-20260824-050709.png`);
});

// The name is sortable, which is the whole point of writing the date that way
// round: a folder of them is in the order they were taken.
test('pictures taken in order are named in order', () => {
    const names = [
        new Date(2026, 0, 1, 0, 0, 0),
        new Date(2026, 7, 24, 5, 7, 9),
        new Date(2026, 11, 31, 23, 59, 59)
    ].map(stamp => photoFilename(stamp));

    assert.deepEqual(names, [...names].sort());
});

test('a name can be taken from a plain moment as readily as from a date', () => {
    const stamp = new Date(2026, 7, 24, 5, 7, 9);
    assert.equal(photoFilename(stamp.getTime()), photoFilename(stamp));
});

test('saving a picture hands the browser the frame, under the name asked for', () => {
    const { canvas, doc, links } = fakePage();

    assert.equal(savePhoto(canvas, 'a-picture.png', doc), true);
    assert.equal(links.length, 1);
    assert.equal(links[0].href, 'data:image/png;base64,AAAA');
    assert.equal(links[0].download, 'a-picture.png');
    assert.equal(links[0].clicked, 1, 'the page clicks the link for the pilot');
    assert.equal(links[0].removed, true, 'and takes it back off the page after');
});

test('a frame that refuses to be read costs the picture and nothing else', () => {
    const { doc } = fakePage();
    const canvas = { toDataURL() { throw new Error('the canvas is tainted'); } };

    assert.equal(savePhoto(canvas, 'a-picture.png', doc), false);
    assert.equal(doc.body.children.length, 0, 'and leaves nothing behind on the page');
});

test('a page with nowhere to put a link costs the picture and nothing else', () => {
    assert.equal(savePhoto({ toDataURL: () => 'data:,' }, 'a-picture.png', null), false);
});
