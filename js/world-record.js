/**
 * The world a terrain has built, as the record it keeps of it.
 *
 * Asking for a world the terrain is already drawing costs nothing: the ask is
 * compared against the record and the ground is left alone. That is what keeps
 * the settings panel from regenerating the country every time a control near it
 * is touched. It only works while the record is a thing of its own, though -
 * hold on to the caller's object and the comparison is between the ask and
 * itself, which is a world that can never be seen to change and ground that is
 * never drawn again.
 *
 * So the record is a copy, and this module is the taking of that copy and the
 * comparison it exists for, and nothing else. Pure, with no DOM or Three.js
 * dependency, so both can be unit tested in Node - which the mesh they used to
 * live beside cannot be.
 */

/**
 * The record to keep of an ask, which is a copy of it rather than the ask
 * itself. The whole of it is copied, not only the placements: a caller that
 * goes on editing the description it handed over - which is exactly what the
 * element editor does - would otherwise be editing the record too, and the
 * comparison below would be running the changed description against itself.
 *
 * Every field of an ask is JSON-shaped data, so one clone covers all of them
 * and no field is left as a reference for a later one to be caught out by.
 */
export function recordWorld(asked) {
    return asked == null ? null : structuredClone(asked);
}

/** Whether two asks would generate the same ground, down to the strip on it. */
export function sameWorld(built, asked) {
    return built != null
        && built.id === asked.id
        && built.seed === asked.seed
        && JSON.stringify(built.runway) === JSON.stringify(asked.runway)
        && JSON.stringify(built.base) === JSON.stringify(asked.base)
        && JSON.stringify(built.elements) === JSON.stringify(asked.elements);
}
