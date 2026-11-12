import type * as Three from "three";

type Point = [number, number, number];
type Surface = { position: number[] };
type FlashFrameOptions = { maxSize?: number };

export type FlashFrameLayout = {
    width: number;
    height: number;
    openingWidth: number;
    openingHeight: number;
    artworkWidth: number;
    artworkHeight: number;
    aspectRatio: number;
    border: number;
};

const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

/** Extreme panoramas retain their complete image inside a portable frame. */
export function flashFrameLayout(
    aspectRatio = 1,
    maxSize = 1.05
): FlashFrameLayout {
    const size = Number.isFinite(maxSize) ? clamp(maxSize, 0.2, 3) : 1.05;
    const aspect =
        Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
    const openingAspect = clamp(aspect, 0.55, 1.8);
    const longSide = size * 0.73;
    const openingWidth =
        openingAspect >= 1 ? longSide : longSide * openingAspect;
    const openingHeight =
        openingAspect >= 1 ? longSide / openingAspect : longSide;
    const border = size * 0.135;
    const availableWidth = openingWidth * 0.994;
    const availableHeight = openingHeight * 0.994;
    const artworkWidth = Math.min(availableWidth, availableHeight * aspect);
    return {
        width: openingWidth + border * 2,
        height: openingHeight + border * 2,
        openingWidth,
        openingHeight,
        artworkWidth,
        artworkHeight: artworkWidth / aspect,
        aspectRatio: aspect,
        border,
    };
}

function imageAspect(texture?: Three.Texture | null) {
    const image = texture?.image as {
        naturalWidth?: number;
        naturalHeight?: number;
        videoWidth?: number;
        videoHeight?: number;
        width?: number;
        height?: number;
    };
    const width = image?.naturalWidth || image?.videoWidth || image?.width;
    const height = image?.naturalHeight || image?.videoHeight || image?.height;
    return width > 0 && height > 0 ? width / height : 1;
}

/** Borrowed artwork textures remain the caller's property. Geometry is centered
 * in XY, faces +Z, and has a solid back. The outer group belongs to the scene;
 * presentation changes only its inner visual, never the caller's transform. */
export function createFlashFrame(
    THREE: typeof Three,
    { maxSize = 1.05 }: FlashFrameOptions = {}
) {
    const group = new THREE.Group();
    group.name = "lobby-flash-frame";
    const visual = new THREE.Group();
    visual.name = "flash-frame-visual";
    group.add(visual);
    const materials = [
        new THREE.MeshStandardMaterial({
            name: "flash-antique-gold",
            color: 0xb8832e,
            metalness: 0.65,
            roughness: 0.42,
            flatShading: true,
        }),
        new THREE.MeshStandardMaterial({
            name: "flash-gold-highlights",
            color: 0xe8bc64,
            metalness: 0.62,
            roughness: 0.32,
            flatShading: true,
        }),
        new THREE.MeshStandardMaterial({
            name: "flash-aged-gold",
            color: 0x65401c,
            metalness: 0.5,
            roughness: 0.48,
            flatShading: true,
        }),
        new THREE.MeshStandardMaterial({
            name: "flash-dark-backing",
            color: 0x211b14,
            metalness: 0.05,
            roughness: 0.92,
            flatShading: true,
        }),
    ];
    const batches = materials.map((material) => {
        const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
        mesh.name = material.name;
        mesh.castShadow = mesh.receiveShadow = true;
        visual.add(mesh);
        return mesh;
    });
    const artworkMaterial = new THREE.MeshBasicMaterial({
        name: "flash-artwork",
        color: 0xffffff,
        transparent: true,
        toneMapped: false,
        side: THREE.FrontSide,
    });
    const artwork = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        artworkMaterial
    );
    artwork.name = "flash-artwork";
    artwork.visible = false;
    visual.add(artwork);
    // A brief gold ring bursts outward as the frame pops in (and out).
    const burstMaterial = new THREE.MeshBasicMaterial({
        name: "flash-burst",
        color: 0xffd889,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
    });
    const burst = new THREE.Mesh(
        new THREE.RingGeometry(0.47, 0.5, 48),
        burstMaterial
    );
    burst.name = "flash-burst";
    burst.visible = false;
    burst.renderOrder = 2;
    group.add(burst);
    let disposed = false;
    let layout = flashFrameLayout(1, maxSize);
    let triangleCount = 0;

    function build(next: FlashFrameLayout) {
        const surfaces: Surface[] = materials.map(() => ({ position: [] }));
        const triangle = (material: number, a: Point, b: Point, c: Point) => {
            surfaces[material].position.push(...a, ...b, ...c);
        };
        const quad = (
            material: number,
            a: Point,
            b: Point,
            c: Point,
            d: Point
        ) => {
            triangle(material, a, b, c);
            triangle(material, a, c, d);
        };
        const { width, height, border: band } = next;
        const unit = Math.max(width, height);
        const rectangle = (inset: number, z: number, chamfer: number) => {
            const x = width / 2 - inset;
            const y = height / 2 - inset;
            const c = Math.min(chamfer, x * 0.4, y * 0.4);
            return [
                [-x + c, -y, z],
                [x - c, -y, z],
                [x, -y + c, z],
                [x, y - c, z],
                [x - c, y, z],
                [-x + c, y, z],
                [-x, y - c, z],
                [-x, -y + c, z],
            ] as Point[];
        };
        // Each break is a real beveled ridge or recessed channel, not a decal.
        const profile = [
            [0, -0.036, 2],
            [0, 0.003, 0],
            [0.025, 0.018, 1],
            [0.07, 0.026, 1],
            [0.11, 0.016, 0],
            [0.145, 0.009, 2],
            [0.19, 0.014, 0],
            [0.25, 0.025, 1],
            [0.32, 0.019, 0],
            [0.39, 0.007, 2],
            [0.48, 0.005, 2],
            [0.56, 0.013, 0],
            [0.64, 0.031, 1],
            [0.71, 0.033, 1],
            [0.78, 0.022, 0],
            [0.84, 0.006, 2],
            [0.9, 0.008, 1],
            [0.96, 0.002, 1],
            [1, -0.012, 2],
        ];
        const rings = profile.map(([inset, z]) =>
            rectangle(inset * band, z * unit, inset === 1 ? 0 : band * 0.045)
        );
        for (let row = 1; row < rings.length; row++) {
            for (let side = 0; side < 8; side++) {
                const following = (side + 1) % 8;
                quad(
                    profile[row][2],
                    rings[row - 1][side],
                    rings[row - 1][following],
                    rings[row][following],
                    rings[row][side]
                );
            }
        }

        function leaf(
            x: number,
            y: number,
            angle: number,
            length: number,
            breadth: number,
            z: number,
            material = 0
        ) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const transform = (u: number, v: number, depth: number): Point => [
                x + u * cos - v * sin,
                y + u * sin + v * cos,
                depth,
            ];
            const outline = [
                [0, 0],
                [0.22, -0.34],
                [0.56, -0.5],
                [0.85, -0.26],
                [1, 0],
                [0.75, 0.32],
                [0.4, 0.5],
                [0.12, 0.24],
            ].map(([u, v]) => transform(u * length, v * breadth, z));
            const ridge = transform(length * 0.48, 0, z + breadth * 0.3);
            for (let i = 0; i < outline.length; i++) {
                const a = outline[i];
                const b = outline[(i + 1) % outline.length];
                // Broad triangular faces read as carved, faceted acanthus.
                triangle(i < 4 ? 1 : material, a, b, ridge);
                quad(
                    material,
                    b,
                    a,
                    [a[0], a[1], z - unit * 0.004],
                    [b[0], b[1], z - unit * 0.004]
                );
            }
        }

        function tube(points: Point[], radius: number, material = 0) {
            const sides = 5;
            const loops = points.map((point, i) => {
                const before = points[Math.max(0, i - 1)];
                const after = points[Math.min(points.length - 1, i + 1)];
                const dx = after[0] - before[0];
                const dy = after[1] - before[1];
                const length = Math.hypot(dx, dy) || 1;
                return Array.from({ length: sides }, (_, side): Point => {
                    const theta = (side / sides) * Math.PI * 2;
                    return [
                        point[0] - (dy / length) * Math.cos(theta) * radius,
                        point[1] + (dx / length) * Math.cos(theta) * radius,
                        point[2] + Math.sin(theta) * radius,
                    ];
                });
            });
            for (let i = 1; i < loops.length; i++) {
                for (let side = 0; side < sides; side++) {
                    const next = (side + 1) % sides;
                    quad(
                        material,
                        loops[i - 1][side],
                        loops[i - 1][next],
                        loops[i][next],
                        loops[i][side]
                    );
                }
            }
        }

        function scroll(
            x: number,
            y: number,
            angle: number,
            mirror: number,
            radius: number,
            z: number
        ) {
            const points = Array.from({ length: 14 }, (_, i): Point => {
                const t = i / 13;
                const theta = t * Math.PI * 2.1 - Math.PI * 0.8;
                const r = radius * (1 - t * 0.78);
                const u = Math.cos(theta) * r;
                const v = Math.sin(theta) * r * mirror;
                return [
                    x + u * Math.cos(angle) - v * Math.sin(angle),
                    y + u * Math.sin(angle) + v * Math.cos(angle),
                    z + t * unit * 0.004,
                ];
            });
            tube(points, band * 0.038);
        }

        for (const sx of [-1, 1]) {
            for (const sy of [-1, 1]) {
                const cx = sx * (width / 2 - band * 0.53);
                const cy = sy * (height / 2 - band * 0.53);
                const diagonal = Math.atan2(sy, sx);
                const baseX = cx - sx * band * 0.18;
                const baseY = cy - sy * band * 0.18;
                for (const turn of [-0.52, 0, 0.52])
                    leaf(
                        baseX,
                        baseY,
                        diagonal + turn,
                        band * (turn === 0 ? 0.88 : 0.66),
                        band * (turn === 0 ? 0.42 : 0.31),
                        unit * (turn === 0 ? 0.039 : 0.03)
                    );
                for (let i = 0; i < 3; i++) {
                    const distance = band * (0.4 + i * 0.35);
                    leaf(
                        cx - sx * distance,
                        cy - sy * band * 0.02,
                        Math.atan2(sy * 0.25, -sx),
                        band * 0.48,
                        band * 0.24,
                        unit * 0.029
                    );
                    leaf(
                        cx - sx * band * 0.02,
                        cy - sy * distance,
                        Math.atan2(-sy, sx * 0.25),
                        band * 0.48,
                        band * 0.24,
                        unit * 0.029
                    );
                }
                scroll(
                    cx - sx * band * 0.27,
                    cy - sy * band * 0.27,
                    diagonal,
                    sx * sy,
                    band * 0.3,
                    unit * 0.036
                );
            }
        }

        // Four matching cartouches echo the reference frame's mid-side crests.
        for (const [cx, cy, angle] of [
            [0, height / 2 - band * 0.53, Math.PI / 2],
            [0, -height / 2 + band * 0.53, -Math.PI / 2],
            [width / 2 - band * 0.53, 0, 0],
            [-width / 2 + band * 0.53, 0, Math.PI],
        ]) {
            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            for (const turn of [-0.7, -0.35, 0, 0.35, 0.7])
                leaf(
                    cx - nx * band * 0.25,
                    cy - ny * band * 0.25,
                    angle + turn,
                    band * (turn === 0 ? 0.78 : 0.66),
                    band * 0.28,
                    unit * (turn === 0 ? 0.041 : 0.032)
                );
            for (const sign of [-1, 1])
                scroll(
                    cx - ny * band * 0.63 * sign,
                    cy + nx * band * 0.63 * sign,
                    angle,
                    sign,
                    band * 0.24,
                    unit * 0.029
                );
        }

        function bead(x: number, y: number) {
            const r = band * 0.023;
            const z = unit * 0.011;
            const points: Point[] = [
                [x - r, y, z],
                [x, y - r, z],
                [x + r, y, z],
                [x, y + r, z],
            ];
            for (let i = 0; i < 4; i++) {
                triangle(1, points[i], points[(i + 1) % 4], [x, y, z + r]);
                triangle(0, points[(i + 1) % 4], points[i], [x, y, z - r]);
            }
        }
        const beadX = width / 2 - band * 0.925;
        const beadY = height / 2 - band * 0.925;
        for (const sign of [-1, 1]) {
            for (const horizontal of [true, false]) {
                const extent = horizontal ? beadX : beadY;
                const count = Math.min(
                    26,
                    Math.floor((extent * 2) / (band * 0.22))
                );
                for (let i = 1; i < count; i++) {
                    const coordinate = -extent + (extent * 2 * i) / count;
                    bead(
                        horizontal ? coordinate : beadX * sign,
                        horizontal ? beadY * sign : coordinate
                    );
                }
            }
        }

        const back = rectangle(0, -unit * 0.036, band * 0.045);
        for (let i = 0; i < 8; i++)
            triangle(3, [0, 0, -unit * 0.036], back[(i + 1) % 8], back[i]);
        const x = next.openingWidth / 2;
        const y = next.openingHeight / 2;
        const z = -unit * 0.013;
        quad(3, [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]);

        triangleCount = 2;
        for (let i = 0; i < batches.length; i++) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(surfaces[i].position, 3)
            );
            geometry.computeVertexNormals();
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();
            triangleCount += surfaces[i].position.length / 9;
            batches[i].geometry.dispose();
            batches[i].geometry = geometry;
        }
        artwork.position.z = -unit * 0.0115;
        artwork.scale.set(next.artworkWidth, next.artworkHeight, 1);
        layout = next;
    }

    build(layout);
    return {
        group,
        setArtwork(texture: Three.Texture | null, aspectRatio?: number) {
            if (disposed) return;
            const next = flashFrameLayout(
                aspectRatio ?? imageAspect(texture),
                maxSize
            );
            if (
                next.openingWidth !== layout.openingWidth ||
                next.openingHeight !== layout.openingHeight
            )
                build(next);
            else {
                artwork.scale.set(next.artworkWidth, next.artworkHeight, 1);
                layout = next;
            }
            if (artworkMaterial.map !== texture) {
                artworkMaterial.map = texture;
                artworkMaterial.needsUpdate = true;
            }
            artwork.visible = !!texture;
        },
        /** 0 hidden … 1 settled. The frame pops from a point with an
         * overshoot and a quarter spin, as if it appeared by magic. */
        setPresentation(progress: number) {
            if (disposed) return;
            const p = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
            const settle = 1 - (1 - p) ** 3;
            // easeOutBack: passes ~12% past full size, then settles.
            const back = 1 + 2.4 * (p - 1) ** 3 + 1.4 * (p - 1) ** 2;
            const opacity = clamp(p / 0.3, 0, 1);
            visual.visible = p > 0;
            visual.scale.setScalar(p === 1 ? 1 : Math.max(0.001, back));
            visual.rotation.set(0, (1 - settle) * -1.3, (1 - settle) * 0.22);
            for (const material of [...materials, artworkMaterial]) {
                material.opacity = opacity;
                material.transparent =
                    material === artworkMaterial || opacity < 1;
                material.depthWrite = opacity === 1;
            }
            const ring = Math.sin(Math.PI * clamp(p / 0.85, 0, 1));
            burst.visible = ring > 0.01;
            burstMaterial.opacity = ring * 0.85;
            const size = Math.max(layout.width, layout.height);
            burst.scale.setScalar(size * (0.35 + p * 1.25));
        },
        get layout(): Readonly<FlashFrameLayout> {
            return { ...layout };
        },
        get stats() {
            return {
                triangles: triangleCount,
                meshes: batches.length + 1,
                drawCalls:
                    batches.length +
                    Number(artwork.visible) +
                    Number(burst.visible),
            };
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            group.removeFromParent();
            for (const mesh of [...batches, artwork, burst])
                mesh.geometry.dispose();
            artworkMaterial.map = null;
            for (const material of [
                ...materials,
                artworkMaterial,
                burstMaterial,
            ])
                material.dispose();
            visual.clear();
            group.clear();
        },
    };
}
