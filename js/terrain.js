import * as THREE from 'three';

// --- Noise functions ---

function hash(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
}

function smoothNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix,       fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix,   iy),   b = hash(ix+1, iy);
    const c = hash(ix,   iy+1), d = hash(ix+1, iy+1);
    return a + (b-a)*ux + (c-a)*uy + (a-b-c+d)*ux*uy;
}

function fbm(x, y, octaves = 7) {
    let v = 0, amp = 0.5, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
        v   += amp * smoothNoise(x * freq, y * freq);
        max += amp;
        amp  *= 0.5;
        freq *= 2.1;
    }
    return v / max;
}

// --- Terrain ---

export class Terrain {
    constructor(scene) {
        this.scene     = scene;
        this.size      = 16000;
        this.segments  = 200;
        this.maxHeight = 480;
        this.build();
    }

    build() {
        const { size, segments, maxHeight } = this;
        const geo = new THREE.PlaneGeometry(size, size, segments, segments);
        geo.rotateX(-Math.PI / 2);

        const pos    = geo.attributes.position;
        const colors = [];

        for (let i = 0; i < pos.count; i++) {
            const x  = pos.getX(i);
            const z  = pos.getZ(i);
            const nx = x / size * 3.5;
            const nz = z / size * 3.5;

            let h = fbm(nx, nz);

            // Flatten low areas into plains, exaggerate peaks
            if (h < 0.38) {
                h = h * 0.25;
            } else {
                h = 0.095 + Math.pow((h - 0.38) / 0.62, 1.4) * 0.9;
            }
            h = Math.min(h, 1.0) * maxHeight;
            pos.setY(i, h);

            // Vertex colour by height
            let r, g, b;
            if (h < 4) {
                r = 0.10; g = 0.25; b = 0.65;
            } else if (h < 12) {
                r = 0.75; g = 0.68; b = 0.48;
            } else if (h < 130) {
                const t = h / 130;
                r = 0.22 + t * 0.12; g = 0.42 + t * 0.10; b = 0.12;
            } else if (h < 300) {
                const t = (h - 130) / 170;
                r = 0.40 + t * 0.20; g = 0.35 + t * 0.10; b = 0.25 + t * 0.10;
            } else {
                const t = Math.min(1, (h - 300) / 100);
                r = 0.55 + t * 0.45; g = 0.55 + t * 0.45; b = 0.60 + t * 0.40;
            }
            colors.push(r, g, b);
        }

        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        this.mesh = new THREE.Mesh(
            geo,
            new THREE.MeshLambertMaterial({ vertexColors: true })
        );
        this.scene.add(this.mesh);

        // Cache heights for collision
        this.heightData = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) {
            this.heightData[i] = pos.getY(i);
        }
    }

    getTerrainHeightAt(x, z) {
        const half = this.size / 2;
        const seg  = this.segments;
        const nx   = (x + half) / this.size;
        const nz   = (z + half) / this.size;

        if (nx < 0 || nx > 1 || nz < 0 || nz > 1) return 0;

        const fx = nx * seg, fz = nz * seg;
        const ix = Math.floor(fx), iz = Math.floor(fz);
        const ux = fx - ix,       uz = fz - iz;

        const idx = (r, c) =>
            Math.min(r, seg) * (seg + 1) + Math.min(c, seg);

        const h00 = this.heightData[idx(iz,   ix)];
        const h10 = this.heightData[idx(iz,   ix+1)];
        const h01 = this.heightData[idx(iz+1, ix)];
        const h11 = this.heightData[idx(iz+1, ix+1)];

        return h00 + (h10-h00)*ux + (h01-h00)*uz + (h00-h10-h01+h11)*ux*uz;
    }
}
