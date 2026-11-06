/**
 * Mode types - what a builder tool's section does, said as a verb, a kind and
 * a subject, and written the way the builder's plan writes it:
 *
 *     Insert asset<runway>              a runway or an airport, placed
 *     Insert asset<flight:plane>        the plane a world is flown in, chosen
 *     Insert config<flight:start-point> where a world's flight starts, set
 *     Insert asset<city>                a building, a road or a park, placed
 *     Load data<file>                   a saved world, opened
 *     Save data<file>                   the built world, written to a file
 *     Load data<asset>                  a model from the pilot's computer
 *
 * The kind is what the code dispatches on. An `asset` is placed - a click on
 * the canvas puts one down, previewed under the pointer, and it is kept as a
 * placement. A `config` is one value the world holds, at most one of it, so a
 * second click moves it rather than adding another. `data` is a file, and
 * nothing on the canvas: the work is started from the panel's answers.
 *
 * A mode type is declared on the section of a tool that does the work rather
 * than on the tool, because a tool may do two things - Insert Plane chooses a
 * plane in one section and sets where a flight starts in the other.
 *
 * Pure module with no DOM or Three.js dependency.
 */

/** What a section does to its subject. */
export const MODE_VERBS = Object.freeze(['insert', 'load', 'save']);

/** What the subject is: a thing placed, a value the world holds, or a file. */
export const MODE_KINDS = Object.freeze(['asset', 'config', 'data']);

/**
 * A subject: a word, or a word and the part of it - `runway`, `flight:plane`,
 * `flight:start-point` - in lower case with hyphens.
 */
const SUBJECT = /^[a-z][a-z-]*(?::[a-z][a-z-]*)?$/;

/** The whole of a mode type as it is written: `Insert asset<runway>`. */
const WRITTEN = /^([A-Z][a-z]+) ([a-z]+)<([^<>\s]+)>$/;

/** True for a verb, a kind and a subject that make a mode type. */
export function isModeType(type) {
    return type != null
        && MODE_VERBS.includes(type.verb)
        && MODE_KINDS.includes(type.kind)
        && typeof type.subject === 'string'
        && SUBJECT.test(type.subject);
}

/**
 * A mode type, declared: frozen, so a tool's declaration cannot be rewritten
 * by whoever reads it. Throws for one that is no mode type, because a
 * declaration that is wrong is wrong when the module loads, not when a pilot
 * first presses the tile.
 */
export function mode(verb, kind, subject) {
    const type = { verb, kind, subject };
    if (!isModeType(type)) throw new Error(`Not a mode type: ${verb} ${kind}<${subject}>`);
    return Object.freeze(type);
}

/** A mode type as it is written - `Insert asset<runway>` - or '' for one that is no mode type. */
export function modeType(type) {
    if (!isModeType(type)) return '';
    return `${type.verb.charAt(0).toUpperCase()}${type.verb.slice(1)} ${type.kind}<${type.subject}>`;
}

/**
 * A mode type read back from how it is written, or null for anything that is
 * not one - so `parseModeType(modeType(type))` is the type it was written
 * from. The pattern takes only a verb in a capital and lower case, and the
 * check takes only a known verb, kind and subject, so whatever is read back
 * is written again exactly as it was read.
 */
export function parseModeType(text) {
    const match = WRITTEN.exec(String(text ?? '').trim());
    if (!match) return null;
    const type = { verb: match[1].toLowerCase(), kind: match[2], subject: match[3] };
    return isModeType(type) ? type : null;
}

/** True for a mode type that is the verb, the kind and, where one is asked, the subject given. */
export function modeIs(type, verb, kind, subject = null) {
    return isModeType(type) && type.verb === verb && type.kind === kind && (subject == null || type.subject === subject);
}
