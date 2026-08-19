import * as THREE from 'three';
import { fbm, shapeHeight, heightToColor } from './terrain-math.js';

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

            // Flatten low areas into plains, exaggerate peaks
            const h = shapeHeight(fbm(nx, nz), maxHeight);
            pos.setY(i, h);

            // Vertex colour by height
            const [r, g, b] = heightToColor(h);
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
