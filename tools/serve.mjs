/**
 * Static file server for manual testing - `npm run serve`.
 *
 * ES modules and the import map only work over HTTP, so opening index.html
 * from the filesystem does not run the simulator. This serves the project
 * root over localhost using nothing but the Node standard library, keeping
 * the project free of install-time dependencies.
 *
 * The request-path and content-type rules are exported as pure functions so
 * they can be unit tested in Node without opening a socket.
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_PORT = 8080;
export const DEFAULT_HOST = 'localhost';
export const DEFAULT_DOCUMENT = 'index.html';
export const FALLBACK_CONTENT_TYPE = 'application/octet-stream';

// Enough types to serve the simulator: markup, modules, styles, and the
// image assets. Anything else falls back to a binary download.
export const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.mjs':  'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map':  'application/json; charset=utf-8',
    '.md':   'text/markdown; charset=utf-8',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.ico':  'image/x-icon'
};

/**
 * Content type for a path, chosen by extension and matched case
 * insensitively. Unknown extensions fall back to a binary type rather than
 * guessing, so a browser never executes a file as script by accident.
 */
export function contentTypeFor(pathname) {
    const dot = String(pathname).lastIndexOf('.');
    if (dot < 0) return FALLBACK_CONTENT_TYPE;
    const ext = String(pathname).slice(dot).toLowerCase();
    return CONTENT_TYPES[ext] || FALLBACK_CONTENT_TYPE;
}

/**
 * Turns a request URL into a path relative to the served root, or null when
 * the request is not servable.
 *
 * Directory requests resolve to the default document, `.` segments collapse,
 * and anything that would climb above the root - `..` segments, a Windows
 * backslash separator, an encoded null byte - is rejected rather than
 * clamped, so a malformed request cannot read outside the project folder.
 */
export function resolveRequestPath(requestUrl) {
    const withoutQuery = String(requestUrl ?? '').split('?')[0].split('#')[0];
    if (!withoutQuery.startsWith('/')) return null;

    let decoded;
    try {
        decoded = decodeURIComponent(withoutQuery);
    } catch {
        return null;  // malformed percent-encoding
    }
    if (decoded.includes('\0')) return null;

    const parts = [];
    for (const part of decoded.split('/')) {
        if (part === '' || part === '.') continue;
        if (part === '..' || part.includes('\\')) return null;
        parts.push(part);
    }

    if (parts.length === 0) return DEFAULT_DOCUMENT;
    if (decoded.endsWith('/')) parts.push(DEFAULT_DOCUMENT);
    return parts.join('/');
}

/**
 * Handles one request: resolve, read, respond. Directories are served
 * through their default document; everything unresolvable is a 404 so the
 * server never reports why a path was refused.
 */
async function respond(req, res, root) {
    const relative = resolveRequestPath(req.url);
    if (relative === null) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('400 Bad Request\n');
        return;
    }

    let filePath = join(root, relative);
    try {
        let info = await stat(filePath);
        if (info.isDirectory()) {
            filePath = join(filePath, DEFAULT_DOCUMENT);
            info = await stat(filePath);
        }
        if (!info.isFile()) throw new Error('not a file');

        res.writeHead(200, {
            'Content-Type': contentTypeFor(filePath),
            'Content-Length': info.size,
            // The point of this server is manual testing, so an edit must
            // show up on the next reload rather than out of a cache.
            'Cache-Control': 'no-store'
        });
        createReadStream(filePath).pipe(res);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found\n');
    }
}

/**
 * Starts the server and resolves with it once it is listening.
 */
export function startServer({ root, port = DEFAULT_PORT, host = DEFAULT_HOST } = {}) {
    const served = root || fileURLToPath(new URL('..', import.meta.url));
    const server = createServer((req, res) => {
        respond(req, res, served).catch(() => {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('500 Internal Server Error\n');
        });
    });

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve(server));
    });
}

// Only listen when run as a command, so importing this module in a test
// does not open a port.
const runAsCommand = process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href;

if (runAsCommand) {
    const port = Number(process.env.PORT || process.argv[2] || DEFAULT_PORT);
    startServer({ port })
        .then(() => console.log(`Pilot Matter: serving on http://${DEFAULT_HOST}:${port}`))
        .catch((err) => {
            console.error(`Pilot Matter: could not serve on port ${port} - ${err.message}`);
            process.exitCode = 1;
        });
}
