/**
 * Builds the site's API reference page out of `docs/api.md`.
 *
 * The reference used to be linked as the markdown file itself, which Pages
 * serves as `text/markdown` - a download rather than a page, and the most
 * linked destination on the site was the one destination that was not one. So
 * the markdown is rendered into `docs/api-reference.html` instead, and the file
 * stays where it is for a reader on GitHub and for the tests that hold it to
 * the code.
 *
 * The page is generated rather than written, so the reference cannot drift from
 * the document, and its shell - the head, the menu, the footer - is lifted off
 * `docs/api.html` rather than copied, so it cannot drift from the rest of the
 * site either. `test/site.test.js` renders it again and fails if what is
 * committed is not what the markdown now comes to.
 *
 * Run it with `npm run docs:api`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);

/** Where the reference sits, what it is called, and what it sits between. */
export const PAGE = {
    markdown: 'docs/api.md',
    template: 'docs/api.html',
    output:   'docs/api-reference.html',
    title:    'API reference',
    description: 'Every export of both halves, every option, and everything that comes back.',
    prev: { href: 'api.html',               label: 'Simulator API' },
    next: { href: 'project-structure.html', label: 'Project structure' }
};

const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

// --- Markdown ---------------------------------------------------------------

const escapeHtml = (text) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * A heading's anchor, slugged the way the document's own contents list expects
 * it: lower case, punctuation dropped, spaces closed up with hyphens.
 *
 * Two headings can slug the same - the document has an `Options` and a `What
 * comes back` under each half of the API - so this is the address a heading
 * wants rather than the one it gets. `anchors()` settles that.
 */
export function slug(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

/**
 * Hands out heading anchors, unique within one page. An id is only an address
 * if it names one place: the document has four headings that slug to two
 * anchors, and left as they were, `#options` opened the Pilot API's options
 * whichever of the two a reader meant, while the Matter API's had no address at
 * all. Repeats take a counted suffix, which is what GitHub does to the same
 * document, so an anchor copied from there reaches the same section here.
 */
export function anchors() {
    const seen = new Map();

    return (text) => {
        const wanted = slug(text);
        const taken = seen.get(wanted) ?? 0;

        seen.set(wanted, taken + 1);
        return taken ? `${wanted}-${taken}` : wanted;
    };
}

/** Code spans, bold, and links, over text that has already been escaped. */
function inline(text) {
    return escapeHtml(text)
        .split(/(`[^`]+`)/)
        .map(part => part.startsWith('`') && part.endsWith('`') && part.length > 2
            ? `<code>${part.slice(1, -1)}</code>`
            : part
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'))
        .join('');
}

const cellsOf = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());

const isTableRule = (line = '') => /^\|[\s:|-]+\|$/.test(line.trim());

/** The line kinds that close a paragraph by opening something of their own. */
const opensBlock = (line) => line.startsWith('```') || line.startsWith('|')
    || line.startsWith('- ') || /^#{1,6}\s/.test(line);

function renderTable(rows) {
    const head = cellsOf(rows[0]).map(cell => `<th>${inline(cell)}</th>`).join('');
    const body = rows.slice(2).map(row =>
        `        <tr>${cellsOf(row).map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`);

    return [
        '<div class="table-wrap">',
        '<table>',
        `    <thead><tr>${head}</tr></thead>`,
        '    <tbody>',
        ...body,
        '    </tbody>',
        '</table>',
        '</div>'
    ].join('\n');
}

/**
 * The document as the site's own markup. Only what `docs/api.md` is written in
 * is understood - headings, paragraphs, bullets, fenced code, and pipe tables -
 * because a converter that handles everything is a dependency, and this one is
 * held to the document by a test. A line none of those describes is written out
 * as the text it is, so a table with a mistyped rule row is something to read on
 * the page and correct, rather than something to find in a build that stopped
 * saying anything.
 *
 * The level 1 heading is dropped: it becomes the page's own `h1`, and a page
 * carrying two would be a page with no one subject.
 */
export function markdownToHtml(markdown) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const anchor = anchors();
    const blocks = [];

    for (let at = 0; at < lines.length; at++) {
        const line = lines[at];

        if (!line.trim()) continue;

        if (line.startsWith('```')) {
            const code = [];
            while (++at < lines.length && !lines[at].startsWith('```')) code.push(lines[at]);
            blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
            continue;
        }

        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
            const level = heading[1].length;
            if (level > 1) {
                blocks.push(`<h${level} id="${anchor(heading[2])}">${inline(heading[2])}</h${level}>`);
            }
            continue;
        }

        if (line.startsWith('|') && isTableRule(lines[at + 1])) {
            const rows = [];
            while (at < lines.length && lines[at].startsWith('|')) rows.push(lines[at++]);
            at--;
            blocks.push(renderTable(rows));
            continue;
        }

        if (line.startsWith('- ')) {
            const items = [];
            while (at < lines.length && lines[at].trim()) {
                if (lines[at].startsWith('- ')) items.push(lines[at].slice(2).trim());
                else items[items.length - 1] += ` ${lines[at].trim()}`;
                at++;
            }
            blocks.push(`<ul>\n${items.map(item => `    <li>${inline(item)}</li>`).join('\n')}\n</ul>`);
            continue;
        }

        // Whatever is left is a paragraph, and it takes the line it was entered
        // on whatever that line looks like. The guard closes a paragraph at the
        // block after it, and it is only allowed to do that from the second
        // line on. A `|` line with no rule under it matches no branch above and
        // arrives here, and a guard read before the first line was taken would
        // close the paragraph empty, put `at` back where it started, and read
        // that same line for as long as there was memory to hold the empty
        // paragraphs it produced - a hang rather than a failure, and `npm test`
        // is what CI runs.
        const paragraph = [lines[at++].trim()];

        while (at < lines.length && lines[at].trim() && !opensBlock(lines[at])) {
            paragraph.push(lines[at++].trim());
        }

        at--;
        blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
    }

    return blocks.join('\n\n');
}

// --- The page ---------------------------------------------------------------

/**
 * The reference as a whole page: the document's markup dropped into the shell
 * `docs/api.html` is already wearing, with its own title, breadcrumb, and place
 * in the prev/next chain.
 */
export function renderApiReference(markdown = read(PAGE.markdown), template = read(PAGE.template)) {
    const opens = template.indexOf('<main class="page" id="content">');
    const ridge = template.indexOf('        <svg class="ridge"');
    if (opens < 0 || ridge < 0) throw new Error(`${PAGE.template} is not shaped like a site page`);

    const shell = template.slice(0, opens)
        .replace(/[ \t]+$/, '')
        .replace(/<title>[^<]*<\/title>/, `<title>${PAGE.title} - Pilot Matter</title>`)
        .replace(/<meta name="description" content="[^"]*">/,
                 `<meta name="description" content="${PAGE.description}">`);

    return [
        shell,
        '    <main class="page" id="content">',
        '        <article class="content">',
        `            <p class="breadcrumb"><a href="index.html">Documentation</a> / ${PAGE.title}</p>`,
        `            <h1>${PAGE.title}</h1>`,
        '',
        markdownToHtml(markdown),
        '',
        '            <nav class="page-nav" aria-label="Nearby pages">',
        `                <a href="${PAGE.prev.href}" rel="prev">&#8592; ${PAGE.prev.label}</a>`,
        `                <a href="${PAGE.next.href}" rel="next">${PAGE.next.label} &#8594;</a>`,
        '            </nav>',
        '        </article>',
        template.slice(ridge)
    ].join('\n');
}

const runAsCommand = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (runAsCommand) {
    const output = fileURLToPath(new URL(PAGE.output, ROOT));
    writeFileSync(output, renderApiReference(), 'utf8');
    console.log(`Pilot Matter: wrote ${PAGE.output} from ${PAGE.markdown}`);
}
