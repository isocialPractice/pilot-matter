import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix, relative, resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'docs');

const read = (path) => readFileSync(join(ROOT, path), 'utf8');

/** Every HTML page under docs/, as a repository-relative posix path. */
function collectPages(directory = SITE) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return collectPages(path);
        if (!entry.name.endsWith('.html')) return [];
        return [relative(ROOT, path).split('\\').join('/')];
    });
}

const pages = collectPages().sort();
const sources = new Map(pages.map(page => [page, read(page)]));

const readme          = read('README.md');
const quickstartDoc   = read('QUICKSTART.md');
const cheatsheetDoc   = read('CHEATSHEET.md');
const designLanguage  = read('DESIGN_LANGUAGE.md');
const stylesheet      = read('docs/assets/site.css');

test('the site is the whole documentation rather than a landing page', () => {
    assert.ok(pages.length >= 20, `expected the README to split into pages, found ${pages.length}`);
    assert.ok(pages.includes('docs/index.html'), 'the site needs a home page');
    assert.ok(pages.includes('docs/quickstart.html'), 'QUICKSTART.md is a site page too');
    assert.ok(pages.includes('docs/cheatsheet.html'), 'CHEATSHEET.md is a site page too');
});

// A page that has lost its head is a page that renders unstyled, at the wrong
// width, under the wrong name - and every one of those is invisible until
// somebody opens that one page.
test('every page carries the head it needs to render', () => {
    for (const [page, source] of sources) {
        assert.match(source, /<!DOCTYPE html>/,                      `${page} has no doctype`);
        assert.match(source, /<html lang="en">/,                     `${page} does not declare its language`);
        assert.match(source, /<meta charset="utf-8">/,               `${page} has no charset`);
        assert.match(source, /<meta name="viewport"[^>]*width=device-width/, `${page} is not responsive`);
        assert.match(source, /<title>[^<]+<\/title>/,                `${page} has no title`);
        assert.match(source, /<meta name="description" content="[^"]+">/,    `${page} has no description`);
        assert.match(source, /<link rel="stylesheet" href="[^"]*assets\/site\.css">/, `${page} loads no stylesheet`);
        assert.match(source, /<script src="[^"]*assets\/site\.js"><\/script>/,        `${page} loads no script`);
        assert.match(source, /<link rel="icon" href="[^"]*favicon\.png">/,   `${page} has no icon`);
    }
});

test('every page opens on one heading and a way past the menu', () => {
    for (const [page, source] of sources) {
        const headings = source.match(/<h1[^>]*>/g) || [];
        assert.equal(headings.length, 1, `${page} should carry exactly one h1`);
        assert.match(source, /<a class="skip-link" href="#content">/, `${page} has no skip link`);
        assert.match(source, /<main class="page" id="content">/,     `${page} has nothing for it to skip to`);
    }
});

/**
 * The menu is written into every page rather than fetched, because a
 * documentation site that cannot be navigated without script is one that
 * cannot be navigated. The cost of that is twenty-one copies, so the copies
 * are checked: the relative prefix and the open group are the only two things
 * allowed to differ between them.
 */
function menuOf(source) {
    const match = source.match(/<nav class="sidebar"[\s\S]*?<\/nav>/);
    assert.ok(match, 'a page with no menu in it');
    return match[0]
        .replace(/href="\.\.\//g, 'href="')
        .replace(/<details class="nav-group" open>/g, '<details class="nav-group">');
}

test('every page carries the same menu', () => {
    const [first, ...rest] = pages;
    const expected = menuOf(sources.get(first));

    for (const page of rest) {
        assert.equal(menuOf(sources.get(page)), expected,
            `the menu in ${page} has drifted from the one in ${first}`);
    }
});

test('the menu is fixed, and its groups collapse', () => {
    const menu = menuOf(sources.get('docs/index.html'));
    assert.match(menu, /<details class="nav-group">/, 'many pages want collapsible groups');
    assert.match(stylesheet, /\.sidebar\s*\{[^}]*position:\s*fixed/, 'the menu should stay reachable while reading');
});

test('the group a page sits in is open when that page is being read', () => {
    for (const page of pages) {
        if (!page.startsWith('docs/controls/')) continue;
        assert.match(sources.get(page), /<details class="nav-group" open>/,
            `${page} sits in a group the menu leaves collapsed`);
    }
});

/** Every href and src on a page, minus the ones that leave the site. */
function localTargets(source) {
    return [...source.matchAll(/(?:href|src)="([^"]+)"/g)]
        .map(match => match[1])
        .filter(target => !/^(?:https?:|mailto:|#)/.test(target));
}

test('every link on every page reaches a file that exists', () => {
    for (const [page, source] of sources) {
        const from = dirname(join(ROOT, page));

        for (const target of localTargets(source)) {
            const path = resolve(from, target.split('#')[0]);
            assert.ok(existsSync(path),
                `${page} links ${target}, which is not there`);
        }
    }
});

test('every anchor a page links to is an id that page has', () => {
    for (const [page, source] of sources) {
        const from = dirname(join(ROOT, page));

        for (const target of [...localTargets(source), ...sameePageAnchors(source)]) {
            const [file, fragment] = target.split('#');
            if (!fragment) continue;

            const path = file === '' ? join(ROOT, page) : resolve(from, file);
            if (!path.endsWith('.html')) continue;

            const target_source = path === join(ROOT, page)
                ? source
                : readFileSync(path, 'utf8');

            assert.ok(target_source.includes(`id="${fragment}"`),
                `${page} links #${fragment} in ${file || 'itself'}, which has no such id`);
        }
    }
});

function sameePageAnchors(source) {
    return [...source.matchAll(/href="(#[^"]+)"/g)]
        .map(match => match[1])
        .filter(anchor => anchor !== '#content');
}

// The project site is served from /pilot-matter/ rather than from /, so an
// absolute path is a link that works locally and breaks the moment it is
// deployed. Relative is the only form that works in both places.
test('nothing on the site is linked by an absolute path', () => {
    for (const [page, source] of sources) {
        for (const target of localTargets(source)) {
            assert.ok(!target.startsWith('/'),
                `${page} links ${target} absolutely, which breaks on a project site`);
        }
    }
});

test('the site is styled by the design language rather than by taste', () => {
    const declared = new Set(
        (designLanguage.match(/#[0-9A-Fa-f]{6}/g) || []).map(hex => hex.toUpperCase())
    );

    const used = new Set();
    for (const source of [stylesheet, ...sources.values()]) {
        for (const hex of source.match(/#[0-9A-Fa-f]{6}\b/g) || []) used.add(hex.toUpperCase());
    }

    for (const hex of used) {
        assert.ok(declared.has(hex),
            `${hex} is used on the site but is not in DESIGN_LANGUAGE.md`);
    }
});

test('the design language states a contrast ratio for the pairs it assigns', () => {
    assert.match(designLanguage, /^## Contrast$/m, 'the ratios should have a section of their own');

    // Only the rows of the table, which are the pairs the site actually
    // renders. The prose around it names two pairs precisely because they
    // are the ones nothing draws, and their ratios are supposed to be low.
    const measured = designLanguage
        .split('\n')
        .filter(line => line.startsWith('|'))
        .flatMap(line => line.match(/\d+\.\d+:1/g) || []);

    assert.ok(measured.length >= 20, 'every pair the site renders should be measured');

    for (const ratio of measured) {
        assert.ok(parseFloat(ratio) >= 4.5,
            `${ratio} is below the floor for body text, so nothing should be using it`);
    }
});

test('the two colours that cannot carry text are named as colours that do not', () => {
    // Both are in the mark and both are on the site, as fills. A future
    // change that reaches for either as a text colour has this to read first.
    for (const hex of ['#87CEEB', '#90C090']) {
        assert.ok(designLanguage.includes(hex), `${hex} should be in the palette`);
    }

    assert.match(designLanguage, /1\.74:1/, 'sky on white, which is why it is never text on white');
    assert.match(designLanguage, /2\.07:1/, 'sage on white, for the same reason');
});

test('the site supports both light and dark', () => {
    assert.match(stylesheet, /\[data-theme="dark"\]/, 'a dark theme the toggle can ask for');
    assert.match(stylesheet, /prefers-color-scheme: dark/, 'and the one the reader\'s system asks for');
});

test('motion is dropped for a reader who has asked for it to be', () => {
    assert.match(stylesheet, /prefers-reduced-motion: reduce/);
});

test('QUICKSTART.md and its page say the same things', () => {
    const page = sources.get('docs/quickstart.html');

    for (const essential of ['npm run serve', 'localhost:8080', 'START FLIGHT', 'RUNWAY LANDING']) {
        assert.ok(quickstartDoc.includes(essential), `QUICKSTART.md should carry ${essential}`);
        assert.ok(page.includes(essential),          `the quickstart page should carry ${essential}`);
    }
});

test('CHEATSHEET.md and its page say the same things', () => {
    const page = sources.get('docs/cheatsheet.html');

    for (const essential of [
        'createTiledEnvironment', 'validateAircraftContract',
        'START AIRSPEED', 'CANYON COUNTRY', '40 units/s'
    ]) {
        assert.ok(cheatsheetDoc.includes(essential), `CHEATSHEET.md should carry ${essential}`);
        assert.ok(page.includes(essential),          `the cheatsheet page should carry ${essential}`);
    }
});

// The README is the front door rather than the manual, and the check that
// sends the manual to a site reads exactly these two measures.
test('the README is short enough to be read rather than skimmed past', () => {
    assert.ok(readme.split('\n').length <= 300, 'the README should be under 300 lines');
    assert.ok(readme.length <= 30000,           'the README should be under 30000 characters');
});

test('the README points at the site, and at the pages it moved its sections to', () => {
    assert.ok(readme.includes('https://isocialpractice.github.io/pilot-matter/docs/index.html'),
        'the README should link the documentation site');

    for (const heading of ['Features', 'Getting Started', 'Controls', 'Simulator API', 'Testing']) {
        const linked = new RegExp(`^## \\[${heading}\\]\\(https://[^)]+\\)$`, 'm');
        assert.match(readme, linked, `the README's ${heading} heading should link its page`);
    }
});

test('the README keeps what is imperative to it', () => {
    assert.ok(readme.includes('npm run serve'), 'how to run it');
    assert.ok(readme.includes('npm test'),      'how to test it');
    assert.match(readme, /\| `W` \/ `↑` \| Pitch up/, 'and the controls');
});

test('the site is served whole, with nothing dropped for beginning with an underscore', () => {
    assert.ok(existsSync(join(ROOT, '.nojekyll')),
        'a site not built by Jekyll needs a .nojekyll at the published root');
});

test('the deploy workflow has every piece a Pages deploy needs', () => {
    const workflow = read('.github/workflows/workflow.yml');

    assert.match(workflow, /^on:$/m,                          'a trigger');
    assert.match(workflow, /branches: \[main\]/,              'limited to the default branch');
    assert.match(workflow, /workflow_dispatch:/,              'and one that can be run by hand');
    assert.match(workflow, /contents: read/,                  'permission to read the repository');
    assert.match(workflow, /pages: write/,                    'permission to publish');
    assert.match(workflow, /id-token: write/,                 'permission to prove who is publishing');
    assert.match(workflow, /^concurrency:$/m,                 'a group, so deploys cannot race');
    assert.match(workflow, /actions\/configure-pages/,        'the Pages environment');
    assert.match(workflow, /actions\/upload-pages-artifact/,  'the artifact');
    assert.match(workflow, /actions\/deploy-pages/,           'and the deploy');
    assert.match(workflow, /name: github-pages/,              'bound to the Pages environment');
});
