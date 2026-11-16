/**
 * Ground picking - which point of the canvas is under the pointer.
 *
 * Every tool that places, draws or picks something asks one question of the
 * pointer: where on the ground it is pointing. The camera over a canvas is
 * tilted and the ground is not flat, so the answer is where the ray from the
 * camera through the pointer first meets the ground - not where it crosses a
 * plane at sea level, which would put a click aimed at the face of a hill on
 * the flat ground behind it.
 *
 * The ray is read against the heights the ground is drawn from rather than cast
 * against the mesh drawn from them. The two are the same surface to within a
 * cell's bend, and reading the heights is what lets this be a pure module like
 * the rest of the builder's arithmetic: no DOM and no Three.js, so where a pick
 * lands can be unit tested in Node against ground made up for it.
 *
 * There are two ways of reading it, and which one runs turns on whether the
 * caller says what grid the ground is sampled on.
 *
 * **Told the grid, the crossing is solved rather than searched for.** The ray
 * is walked cell by cell, and inside one cell the ground is a bilinear patch
 * of its four corners - so the ray's clearance over it is exactly a quadratic
 * in the distance along the ray, whose first root in the cell is the crossing.
 * Four heights a cell and a quadratic, with nothing stepped over, because
 * nothing is stepped.
 *
 * **Told nothing, the ray is marched** in steps of `step` and the step that
 * crossed is halved down. That is the older reading, kept for a caller whose
 * ground is not a grid at all - a test's made-up hill, a host's own sampler -
 * and it is why `step` is still an option. It cannot see a summit narrower than
 * its own step: measured on 11-16-26 against one vertex of the 80 unit grid
 * raised 200 units, with the ray coming down at 55 degrees onto the summit, the
 * march reached it from 1 of 185 aims across it and answered the flat ground
 * 140 units beyond for the other 184. Stepping by a share of the ray's own
 * descent instead reached the same 1, because the stretch where the ground
 * stands above the ray is under three units wide and no step small enough to
 * see it is affordable on every pointer move. The grid is what makes it
 * findable: that summit is a corner of the cell it stands in, so the cell's own
 * quadratic has the root in it.
 */

/** How many times a crossing is halved once it has been bracketed. */
export const PICK_REFINEMENTS = 24;

/** The share of a cell the march moves at a time, for the reading that marches. */
export const PICK_STEP_CELLS = 0.5;

/**
 * How many cells the walk may cross before it gives up, so a ray that is very
 * nearly along a grid line cannot walk for ever. Four times the cells across a
 * canvas: the longest honest walk is its diagonal, and this leaves room over.
 */
export const PICK_CELL_LIMIT = 1600;

/**
 * How near zero the leading coefficient of a cell's quadratic has to be for it
 * to be read as a straight line instead.
 *
 * The coefficient is the cell's bilinear twist times the ray's two horizontal
 * rates, so it is zero for any ray running along a grid line and for any cell
 * whose four corners lie in a plane - which is most of them, most of the time.
 */
const FLAT_ENOUGH = 1e-12;

/**
 * How near the ground a ray has to begin to be counted as starting on it, in
 * world units.
 *
 * A micron, which is nothing at a scale where the ground is sampled every 80
 * metres, and far wider than the rounding it is there to absorb: the point
 * where a ray crosses the ceiling is worked out by arithmetic, so the ground
 * read there comes back a few parts in 10^13 off the ceiling rather than
 * exactly on it. Compared at exactly zero, the ceiling test holds for a
 * plateau - whose top is flat, so a hair off the aimed point reads the same
 * height - and misses the summit of anything narrower than the sampling,
 * whose interpolated ground falls away from its one high vertex immediately.
 */
export const PICK_SURFACE = 1e-6;

/**
 * Where a ray first meets the ground, or null where it does not.
 *
 * `origin` and `direction` are `{ x, y, z }`; the direction need not be of unit
 * length. `heightAt(x, z)` answers how high the ground stands anywhere.
 *
 * The ray is walked in steps of `step` from its origin until it is at or under
 * the ground, and the step that crossed is then halved down to the crossing.
 * `top` is the highest the ground stands: the stretch of ray above it can meet
 * nothing, so the walk starts where the ray comes down through it, and a ray
 * level with it or climbing away from it misses outright. A ray aimed at
 * ground that stands at `top` - within `PICK_SURFACE` - meets it at that
 * crossing itself, with no walk to make. `maxDistance` is as far as anything
 * is drawn.
 *
 * `bounds`, `{ minX, maxX, minZ, maxZ }`, is the ground that may be picked. A
 * ray that meets the ground outside it misses rather than being moved onto its
 * edge: a point that was not pointed at is not one a tool may be handed.
 *
 * `cell` is how far apart the ground is sampled, and `cellOrigin` a point the
 * grid has a vertex at - `{ x, z }`, the low corner of the field. Given both,
 * the crossing is solved cell by cell and `step` is not read; given neither,
 * the ray is marched in steps of `step`. See the head of this file for why the
 * two readings are not the same answer.
 */
export function pickGround(origin, direction, heightAt, {
    step = 40, maxDistance = 40000, top = Infinity, bounds = null, cell = 0, cellOrigin = null
} = {}) {
    const length = Math.hypot(direction?.x ?? 0, direction?.y ?? 0, direction?.z ?? 0);
    if (!(length > 0) || !(step > 0) || typeof heightAt !== 'function') return null;

    const dx = direction.x / length, dy = direction.y / length, dz = direction.z / length;
    const at = t => ({ x: origin.x + dx * t, y: origin.y + dy * t, z: origin.z + dz * t });
    const clearance = t => {
        const point = at(t);
        return point.y - heightAt(point.x, point.z);
    };

    let from = 0;
    let entryHeight = origin.y;
    if (Number.isFinite(top) && origin.y > top) {
        if (dy >= 0) return null;
        from = (origin.y - top) / -dy;
        // The crossing stands at the ceiling by construction, so the ceiling
        // is what its clearance is measured from: `origin.y + dy * from` is
        // the same height to within a rounding, and this boundary is decided
        // at exactly zero.
        entryHeight = top;
    }

    const entry = at(from);
    const above = entryHeight - heightAt(entry.x, entry.z);

    // A ray that starts under the ground has nothing to say about what it
    // points at - it is a camera inside a hill.
    if (above < -PICK_SURFACE) return null;

    // A ray that starts *on* the ground has arrived at it, and the march has
    // nowhere to go: the ceiling is the highest the ground stands, so the only
    // ground at that height is the point the ray came down onto. Reading that
    // as a camera inside a hill is what left the canvas's own highest ground
    // unpickable - a plateau, a mesa, or the one extrusion standing on a blank
    // canvas - by every tool that asks what is under the pointer.
    //
    // It is also the only chance a summit narrower than the sampling gets. The
    // march steps half a cell, and the sides of such a summit fall away faster
    // than the ray comes down, so a ray aimed at its one high vertex is above
    // the ground at every step after the entry and would walk past it to the
    // flat ground beyond.
    if (above <= PICK_SURFACE) {
        const hit = { x: entry.x, y: heightAt(entry.x, entry.z), z: entry.z };
        return within(hit, bounds) ? hit : null;
    }

    // Told the grid, the crossing is solved cell by cell; told nothing, the ray
    // is marched. The one thing both answer with is a distance along the ray.
    const crossing = Number(cell) > 0
        ? crossOnGrid(origin, { x: dx, y: dy, z: dz }, heightAt, {
            from, maxDistance, cell: Number(cell),
            gridX: Number(cellOrigin?.x) || 0,
            gridZ: Number(cellOrigin?.z) || 0
        })
        : crossByMarching(clearance, { from, step, maxDistance });

    if (crossing == null) return null;

    const hit = at(crossing);
    hit.y = heightAt(hit.x, hit.z);
    return within(hit, bounds) ? hit : null;
}

/**
 * The crossing found by walking the ray in steps of `step` and halving the step
 * that crossed, or null where it never crosses. `clearance(t)` is how far the
 * ray is above the ground at a distance along it.
 */
function crossByMarching(clearance, { from, step, maxDistance }) {
    let before = from;
    for (let t = from + step; t <= maxDistance + step; t += step) {
        const reach = Math.min(t, maxDistance);
        if (clearance(reach) <= 0) return refine(clearance, before, reach);
        if (reach === maxDistance) return null;
        before = reach;
    }
    return null;
}

/**
 * The crossing on ground sampled every `cell` units, solved rather than
 * searched for: the first distance along the ray at which it meets the ground,
 * or null where it never does.
 *
 * The ray's horizontal path is walked cell by cell - the ordinary grid walk,
 * taking whichever of the next two grid lines it reaches first - and each cell
 * is asked for its own crossing over the stretch of ray that is inside it.
 *
 * Inside one cell the ground is the bilinear patch of its four corners, and the
 * ray is a straight line, so the ray's clearance over the ground is a quadratic
 * in the distance along it. Its first root inside the cell's stretch is the
 * crossing, and a cell with no root in that stretch has no crossing in it - not
 * "none that was sampled", none. That is the whole of what this reading buys
 * over marching: a summit standing in one cell is a corner of that cell, so its
 * height is in the quadratic whether or not anything was stepped onto it.
 *
 * `direction` is of unit length, and `gridX`, `gridZ` name a point the grid has
 * a vertex at.
 */
function crossOnGrid(origin, direction, heightAt, { from, maxDistance, cell, gridX, gridZ }) {
    const ox = origin.x, oy = origin.y, oz = origin.z;
    const ux = direction.x / cell, uz = direction.z / cell;

    // Where the walk starts, in grid units from the vertex the grid is named by.
    const startX = (ox + direction.x * from - gridX) / cell;
    const startZ = (oz + direction.z * from - gridZ) / cell;

    let ix = Math.floor(startX);
    let iz = Math.floor(startZ);

    const stepX = ux > 0 ? 1 : ux < 0 ? -1 : 0;
    const stepZ = uz > 0 ? 1 : uz < 0 ? -1 : 0;

    // Where the ray reaches the next grid line of each axis, and how far apart
    // those crossings are. A ray with no movement along an axis never reaches
    // one, and stays in the band it started in.
    let nextX = stepX === 0 ? Infinity : from + ((stepX > 0 ? ix + 1 : ix) - startX) / ux;
    let nextZ = stepZ === 0 ? Infinity : from + ((stepZ > 0 ? iz + 1 : iz) - startZ) / uz;
    const spanX = stepX === 0 ? Infinity : Math.abs(1 / ux);
    const spanZ = stepZ === 0 ? Infinity : Math.abs(1 / uz);

    let t0 = from;
    for (let crossed = 0; crossed < PICK_CELL_LIMIT; crossed++) {
        // How far along the ray this cell's stretch reaches: the nearer of the
        // next two grid lines, or as far as anything is drawn. A ray standing
        // on a grid line has a stretch of no length here, and `firstRoot`
        // answers nothing for one rather than this having to test for it.
        const t1 = Math.min(nextX, nextZ, maxDistance);

        const cx = gridX + ix * cell;
        const cz = gridZ + iz * cell;
        const h00 = heightAt(cx, cz);
        const h10 = heightAt(cx + cell, cz);
        const h01 = heightAt(cx, cz + cell);
        const h11 = heightAt(cx + cell, cz + cell);

        // The patch, as the height at the corner plus what each axis and the
        // twist between them add - the same four terms `sampleHeight`
        // interpolates with.
        const b = h10 - h00, c = h01 - h00, d = h00 - h10 - h01 + h11;
        const u0 = (ox + direction.x * t0 - cx) / cell;
        const v0 = (oz + direction.z * t0 - cz) / cell;

        // The ground along the ray, measured from where the walk stands:
        // ground(s) = ground0 + rate * s + twist * s * s.
        const ground0 = h00 + b * u0 + c * v0 + d * u0 * v0;
        const rate = b * ux + c * uz + d * (u0 * uz + ux * v0);
        const twist = d * ux * uz;

        // And the ray's clearance over it, which is that subtracted from a
        // straight line: -twist s² + (dy - rate) s + (y0 - ground0).
        const s = firstRoot(-twist, direction.y - rate, oy + direction.y * t0 - ground0, t1 - t0);
        if (s != null) return t0 + s;

        if (t1 >= maxDistance) return null;

        // On to the next cell, across whichever grid line was reached first -
        // both at once for a ray that reached a corner, which is why the two
        // are read before either is moved on.
        const acrossX = nextX <= nextZ;
        const acrossZ = nextZ <= nextX;
        t0 = Math.min(nextX, nextZ);
        if (acrossX) { ix += stepX; nextX += spanX; }
        if (acrossZ) { iz += stepZ; nextZ += spanZ; }
    }

    return null;
}

/**
 * The first root of `a s² + b s + c` in `[0, span]`, or null where it has none
 * there - which is the first distance into a cell at which the ray's clearance
 * over the ground reaches zero.
 *
 * A clearance that is already zero or under at the start of the stretch answers
 * 0: the walk has arrived at the ground. That is a rounding away from the last
 * cell's own answer rather than a case of its own, since a cell is only reached
 * with the ray above the ground.
 */
function firstRoot(a, b, c, span) {
    if (!(span > 0)) return null;
    if (c <= 0) return 0;

    if (Math.abs(a) < FLAT_ENOUGH) {
        if (!(b < 0)) return null;
        const s = -c / b;
        return s >= 0 && s <= span ? s : null;
    }

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    // One of the two roots, never the other, and it is the same expression
    // either way round. A cell is only ever reached with the clearance above
    // zero where its stretch begins, which puts 0 outside an upward parabola's
    // pair of roots and between a downward one's. So the crossing is the nearer
    // root of an upward parabola and the further root of a downward one - and
    // both of those are `(-b - root) / 2a`, because dividing by a negative `a`
    // turns the smaller numerator into the larger value. Scanning both roots in
    // order was the first way this was written, and a mutation run on
    // 11.16.2026 found it: 3,840 rays swept diagonally over a raised vertex,
    // every direction and sign, answered identically with the order reversed,
    // because the root that reversal reaches first is always behind the start.
    const s = (-b - Math.sqrt(discriminant)) / (2 * a);
    return s >= 0 && s <= span ? s : null;
}

/**
 * The crossing between two distances along a ray, one above the ground and one
 * at or under it, found by halving the stretch between them.
 */
function refine(clearance, above, under) {
    let high = above, low = under;
    for (let i = 0; i < PICK_REFINEMENTS; i++) {
        const middle = (high + low) / 2;
        if (clearance(middle) > 0) high = middle;
        else low = middle;
    }
    return (high + low) / 2;
}

function within(point, bounds) {
    if (bounds == null) return true;
    return point.x >= bounds.minX && point.x <= bounds.maxX
        && point.z >= bounds.minZ && point.z <= bounds.maxZ;
}

/**
 * The square a canvas covers, which is the ground a pick may land on. A canvas
 * is the home tile, so its own frame and the world's are the same square.
 */
export function canvasPickBounds(size = 0) {
    const half = Math.max(Number(size) || 0, 0) / 2;
    return { minX: -half, maxX: half, minZ: -half, maxZ: half };
}

/** The march step for ground sampled every `cellSize` units. */
export function pickStep(cellSize = 0) {
    const cell = Number(cellSize) > 0 ? Number(cellSize) : 80;
    return cell * PICK_STEP_CELLS;
}

/**
 * Where the pointer is, as the -1 to 1 device coordinates a camera casts a ray
 * through: x across from the left edge, y up from the bottom edge.
 */
export function pointerDevice(clientX, clientY, rect) {
    const width = Math.max(rect?.width ?? 0, 1);
    const height = Math.max(rect?.height ?? 0, 1);
    return {
        x: ((clientX - (rect?.left ?? 0)) / width) * 2 - 1,
        y: 1 - ((clientY - (rect?.top ?? 0)) / height) * 2
    };
}
