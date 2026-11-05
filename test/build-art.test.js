/**
 * Builder art in the repository - the marks, the folded palette and the
 * thumbnails the builder ships, copied into `assets/builder/` and read from
 * nowhere else.
 *
 * The art is drawn in the designer's own source folder, which this checkout
 * reaches through a local link that resolves on one machine. Through that link
 * every file is present on this disk, so a check that only asked the disk would
 * pass here and fail in CI, where the site is built - the failure these exist
 * to catch. So "in the repository" is asked of git: tracked, not merely there.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { BUILD_TOOLS, BUILDER_ART, toolMark, toolName, isBuildTool } from '../js/build-tools.js';
import { cardThumbnail } from '../js/build-picker.js';
import { BUILDER_ENVIRONMENTS } from '../js/environment/presets.js';
import { PALETTE_FOLD_MARK, BUILDER_SETTINGS_MARK } from '../js/build-palette.js';
import { BUILDER_ASSETS, BUILDER_DRAWN, TARGET } from '../tools/sync-builder-assets.mjs';
import { LASSO_ART } from '../js/lasso.js';
import { EXTRUDE_ART } from '../js/extrude.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(ROOT, path), 'utf8');

/** Every file git tracks under the builder's art folder. */
const tracked = new Set(
    execFileSync('git', ['ls-files', '--', BUILDER_ART], { cwd: ROOT, encoding: 'utf8' })
        .split('\n').map(line => line.trim()).filter(Boolean)
);

/** Every script the page runs, under `js/`. */
function scripts(dir = 'js') {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(entry => {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return scripts(path);
        return entry.name.endsWith('.js') ? [path] : [];
    });
}

// --- In the repository -----------------------------------------------------------

test('the art is read from one tracked folder beside the scripts', () => {
    assert.equal(BUILDER_ART, 'assets/builder');
    assert.equal(TARGET, BUILDER_ART, 'which is where the copy step writes');
    assert.ok(tracked.size > 0, 'and git tracks what is in it');
});

test('every tool has its mark in the repository, named for the tool', () => {
    for (const tool of BUILD_TOOLS) {
        assert.equal(toolMark(tool.id), `assets/builder/${tool.id}.svg`);
        assert.ok(tracked.has(toolMark(tool.id)), `${tool.id}: tracked, so a tool joining the palette brings no art with it`);
    }
    assert.equal(toolMark('hammer'), null);
    assert.equal(isBuildTool('hammer'), false);
});

test('every canvas has its thumbnail in the repository, named for the canvas', () => {
    for (const environment of BUILDER_ENVIRONMENTS) {
        assert.equal(cardThumbnail(environment.id), `assets/builder/thumb-${environment.id}.png`);
        assert.ok(tracked.has(cardThumbnail(environment.id)), `${environment.id}: tracked`);
    }
    assert.equal(cardThumbnail('nowhere'), null);
    assert.ok(tracked.has(PALETTE_FOLD_MARK), 'and the folded palette\'s tab is too');
});

/**
 * The check that catches a renamed export before a card draws empty: every
 * file the page names, and every file the code names, is one git tracks.
 */
test('every file the page names under the art folder is tracked', () => {
    const named = new Set(read('index.html').match(/assets\/builder\/[\w.-]+/g) ?? []);
    assert.ok(named.size >= BUILDER_ENVIRONMENTS.length, 'the picker\'s thumbnails are named in the page');
    for (const path of named) assert.ok(tracked.has(path), `${path} is named by index.html and not tracked`);
});

test('the copy step\'s list and the repository agree', () => {
    const targets = Object.keys(BUILDER_ASSETS).map(name => `${TARGET}/${name}`);
    for (const path of targets) assert.ok(tracked.has(path), `${path} is on the list and not tracked`);
    for (const tool of BUILD_TOOLS) assert.ok(targets.includes(toolMark(tool.id)), `${tool.id}'s mark is on the list`);
    for (const environment of BUILDER_ENVIRONMENTS) {
        assert.ok(targets.includes(cardThumbnail(environment.id)), `${environment.id}'s thumbnail is on the list`);
    }
    assert.ok(targets.includes(PALETTE_FOLD_MARK));
    assert.ok(targets.includes(LASSO_ART), 'and the panel the lasso cuts its tools\' icons from');
    assert.ok(tracked.has(LASSO_ART));
    assert.ok(targets.includes(EXTRUDE_ART), 'and the one Extrude cuts its shapes\' icons from');
    assert.ok(tracked.has(EXTRUDE_ART));
    // And the other way: nothing is shipped from the folder that a copy would
    // not bring up to date, but for the marks drawn here because the art has
    // none - which the copy leaves where they are.
    const drawn = BUILDER_DRAWN.map(name => `${TARGET}/${name}`);
    for (const path of tracked) {
        if (path.startsWith(`${TARGET}/`)) {
            assert.ok(targets.includes(path) || drawn.includes(path), `${path} is tracked and neither copied nor drawn here`);
        }
    }
    assert.equal(new Set(Object.values(BUILDER_ASSETS)).size, targets.length, 'and no source is copied twice');
});

test('a mark drawn here rather than copied is tracked, named by the code, and never on the copy\'s list', () => {
    assert.deepEqual(BUILDER_DRAWN, ['builder-settings.svg']);
    for (const name of BUILDER_DRAWN) {
        assert.ok(tracked.has(`${TARGET}/${name}`), `${name} is tracked`);
        assert.ok(!(name in BUILDER_ASSETS), `${name} is not on the list a sync would copy over it`);
    }
    assert.equal(BUILDER_SETTINGS_MARK, `${TARGET}/builder-settings.svg`, 'the gear is the one drawn here');
    assert.match(read(BUILDER_SETTINGS_MARK), /viewBox="0 0 31\.13 31\.13"/, 'on the square the tool marks are drawn on');
});

// --- Nothing behind it ---------------------------------------------------------------

/**
 * The source folder resolves through the local link on one machine, so a page
 * or a script that named it would work here and be a broken image on the
 * site. Nothing that ships may.
 */
test('nothing that ships names the source folder the art is copied from', () => {
    const behind = /\.support\b|support\/thumbnail/;
    assert.doesNotMatch(read('index.html'), behind, 'index.html');
    for (const path of scripts()) assert.doesNotMatch(read(path), behind, path);
    for (const path of tracked) {
        if (path.endsWith('.svg')) assert.doesNotMatch(read(path), behind, path);
    }
});

test('a shipped drawing links nothing outside itself', () => {
    for (const path of tracked) {
        if (!path.endsWith('.svg')) continue;
        const source = read(path);
        assert.match(source, /^<\?xml[^>]*\?>\s*<svg[^>]*viewBox="[^"]+"/, `${path} is a drawing with a viewBox`);
        for (const [, link] of source.matchAll(/(?:xlink:)?href="([^"]*)"/g)) {
            assert.ok(link.startsWith('#'), `${path} links ${link}, which a copy cannot follow`);
        }
        for (const [, link] of source.matchAll(/url\(([^)]*)\)/g)) {
            assert.ok(link.replace(/['"]/g, '').startsWith('#'), `${path} reaches ${link}`);
        }
    }
});

test('every tool mark is drawn on the art\'s own square tile', () => {
    for (const tool of BUILD_TOOLS) {
        assert.match(read(toolMark(tool.id)), /viewBox="0 0 31\.13 31\.13"/, tool.id);
    }
});

test('a tool is named in a sentence\'s case', () => {
    assert.equal(toolName('select'), 'Select');
    assert.equal(toolName('accept'), 'Accept and exit');
    assert.equal(toolName('hammer'), '');
});
