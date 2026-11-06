/**
 * The ground's colour, held to what a colour can be at the pixel it is drawn
 * on.
 *
 * The ground is one mesh a tile, coloured a vertex at a time, and every colour
 * the generators write lies between 0 and 1. What the shader reads is not that
 * colour but one interpolated at the pixel, and with antialiasing on, a pixel
 * the edge of a triangle crosses is shaded once, at its middle - which can lie
 * outside the triangle. There the colour is carried on past the triangle's
 * corners rather than between them. Seen from far off, the ground is nearly
 * edge-on and most of its triangles are slivers a pixel or two across, so most
 * of its pixels are shaded that way.
 *
 * A colour carried past its corners can come out below 0 in a channel that
 * stands near 0 at every vertex - a saturated paint, pure cyan or blue. Lit,
 * that is a negative channel, and the step that encodes the frame for the
 * screen raises it to a fractional power: in the shader the browser hands the
 * GPU on Windows, that is not a number, and the channel is written as 0 after
 * the fog has been mixed in. So the paint is drawn in its own saturated
 * colour on ground the fog has otherwise taken entirely, however far off it
 * is. Holding the interpolated colour to 0 and 1 before it is lit keeps every
 * channel a number, and the fog reaches it as it reaches the rest.
 *
 * The change is made to the material's shader source as three compiles it, so
 * it is a string edit on the chunk that applies the vertex colour, kept here
 * with no Three.js import so that it can be tested in Node.
 */

/** The chunk of three's fragment shader that multiplies the vertex colour in. */
export const GROUND_COLOR_CHUNK = '#include <color_fragment>';

/**
 * That chunk with the interpolated colour held to 0 and 1, under the same two
 * guards three's own is written under, so a material drawn without vertex
 * colours compiles as it did.
 */
export const HELD_GROUND_COLOR = [
    '#if defined( USE_COLOR_ALPHA )',
    '\tdiffuseColor *= clamp( vColor, 0.0, 1.0 );',
    '#elif defined( USE_COLOR )',
    '\tdiffuseColor.rgb *= clamp( vColor, 0.0, 1.0 );',
    '#endif'
].join('\n');

/** The key three caches the edited program under, apart from an unedited one. */
export const GROUND_COLOR_KEY = 'ground-color-held';

/**
 * A fragment shader with its vertex colour held to 0 and 1. A shader without
 * the chunk is given back as it was, since there is nothing in it to hold.
 */
export function holdGroundColorSource(fragmentShader) {
    const source = String(fragmentShader ?? '');
    return source.includes(GROUND_COLOR_CHUNK) ? source.replace(GROUND_COLOR_CHUNK, HELD_GROUND_COLOR) : source;
}

/**
 * Sets a ground material to compile with its vertex colour held, and hands it
 * back, so a mesh is built as `new Mesh(geometry, holdGroundColor(material))`.
 */
export function holdGroundColor(material) {
    material.onBeforeCompile = (shader) => {
        shader.fragmentShader = holdGroundColorSource(shader.fragmentShader);
    };
    material.customProgramCacheKey = () => GROUND_COLOR_KEY;
    return material;
}
