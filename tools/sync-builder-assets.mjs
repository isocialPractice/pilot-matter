/**
 * Copies the builder's art into `assets/builder/`, which is the only place the
 * page and the code take art from.
 *
 * The art is drawn and kept in the designer's own source folder, reached from
 * this checkout through a local link that resolves on the machine it was made
 * on and nowhere else - not on the site, and not in CI. So what ships is a copy,
 * tracked in the repository, and this is the one step that makes the copy.
 *
 * Four rules it keeps:
 *
 * - **An explicit list.** What is shipped, from where, under which name - so a
 *   stray shortcut, a layered source or a walkthrough recording can never ride
 *   along, and the renames live in one place. Three of the source files carry
 *   typos, and every file is renamed for the tool or the canvas it belongs to,
 *   so the markup finds a file by what it is for.
 * - **It copies and never prunes.** A file in `assets/builder/` that is not on
 *   the list is left where it is: not everything there has to come from the
 *   source folder.
 * - **It refuses when the source does not resolve.** The link can still be
 *   there with nothing behind it - the drive it points into offline - and a
 *   copy that carried on would write nothing and say it had succeeded.
 * - **Nothing in the suite runs it.** CI has no source to copy from. The suite
 *   checks the copies, which is all a visitor to the site ever gets.
 *
 * Run it with `npm run assets:builder` on the machine the art is drawn on, then
 * commit what changed under `assets/builder/`.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The designer's source folder, as this checkout reaches it. Read relatively, never by its absolute path. */
const SOURCE = join(ROOT, '.support', 'interactive-element-editor');

/** Where the copies go, and where everything that ships reads them from. */
export const TARGET = 'assets/builder';

/**
 * What is shipped, under the name it is shipped as, from where in the source
 * folder. The tool marks are named for the tool ids the palette already uses,
 * the thumbnails for the canvas ids the picker already uses.
 *
 * The thumbnails are the PNGs rather than the SVG wrappers around them: a
 * wrapper links its picture by a path back into the source folder, which a
 * copy cannot follow, and bakes its label in as text the page cannot style.
 *
 * The gumball's exports are not here. The gumball is laid out from the camera
 * every frame - an arrow pointing at the camera is short - which a drawing in
 * one fixed perspective cannot do, so `js/gumball.js` draws it from the ids the
 * art names, and the art is the reference for how it should look.
 */
export const BUILDER_ASSETS = Object.freeze({
    // The twelve tool marks.
    'select.svg':   'assets/select-built-area.svg',
    'lasso.svg':    'assets/selct-area-to-build.svg',
    'mountain.svg': 'assets/select-build-mountains.svg',
    'grass.svg':    'assets/select-build-grass.svg',
    'sand.svg':     'assets/select-build-sand.svg',
    'water.svg':    'assets/select-build-water.svg',
    'snow.svg':     'assets/select-build-snow.svg',
    'runway.svg':   'assets/select-insert-runway.svg',
    'paint.svg':    'assets/select-free-paint-tool.svg',
    'erase.svg':    'assets/select-erase-free-paints.svg',
    'extrude.svg':  'assets/select-draw-and-extrude-rectangle-tool.svg',
    'accept.svg':   'assets/complete-build-mode.svg',

    // The palette folded away: the chevrons that bring it back.
    'palette-folded.svg': 'assets/ToolPanel-Hidden.svg',

    // The lasso's sub-palette, whole: each tile's icon is cut from it by a
    // view of its own box, so its ten single-tool exports - the same panel
    // with one tile lit - are not shipped.
    'lasso-tools.svg': 'assets/laso-mode-propertyPanelElements.svg',

    // Extrude's panel, whole, which its seven shapes' icons are cut from the
    // same way.
    'extrude-tools.svg': 'assets/draw-extrude-shape-propertyPanelElements.svg',

    // One thumbnail a canvas, for the picker's cards.
    'thumb-highlands.png':      'support/thumbnail-highlands.png',
    'thumb-river-basin.png':    'support/thumbnail-riverBasin.png',
    'thumb-canyon-country.png': 'support/thumbnail-CanyonCountry.png',
    'thumb-dune-sea.png':       'support/thumbnail-dunSea.png',
    'thumb-lakeside.png':       'support/thumbnail-lakeside.png',
    'thumb-blank-canvas.png':   'support/thumbnail-blank.png'
});

/** True when the source folder is there and has something in it - not just a link to nothing. */
function sourceResolves() {
    try {
        return existsSync(SOURCE) && statSync(SOURCE).isDirectory() && readdirSync(SOURCE).length > 0;
    } catch {
        return false;
    }
}

function main() {
    if (!sourceResolves()) {
        console.error('The builder\'s source art cannot be reached from this checkout, so nothing was copied.');
        console.error('It resolves only on the machine the art is drawn on; check that its drive is online.');
        process.exitCode = 1;
        return;
    }

    const missing = Object.entries(BUILDER_ASSETS).filter(([, from]) => !existsSync(join(SOURCE, from)));
    if (missing.length > 0) {
        for (const [name, from] of missing) console.error(`Not in the source folder: ${from} (for ${name})`);
        console.error('Nothing was copied.');
        process.exitCode = 1;
        return;
    }

    mkdirSync(join(ROOT, TARGET), { recursive: true });
    for (const [name, from] of Object.entries(BUILDER_ASSETS)) {
        copyFileSync(join(SOURCE, from), join(ROOT, TARGET, name));
        console.log(`${TARGET}/${name}`);
    }
    console.log(`Copied ${Object.keys(BUILDER_ASSETS).length} files. Commit what changed under ${TARGET}/.`);
}

// Run as a command, and only then: a test may read the list without copying anything.
const runAsCommand = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runAsCommand) main();
