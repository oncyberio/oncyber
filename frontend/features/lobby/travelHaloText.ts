import type * as Three from "three";

/**
 * Loading progress for the departure halo. Travel draws no words in the scene
 * (the world's name and status stay in the DOM for screen readers only, see
 * `LobbyArrivalStatus`), so this module now holds only the progress band. It
 * keeps its file and export names so existing imports stay valid.
 *
 * `progress` is omitted once loading is moot.
 */
export interface TravelHaloLabel {
    progress?: number;
    /** @deprecated Never drawn. Accepted so earlier callers still type-check. */
    title?: string;
    /** @deprecated Never drawn. Accepted so earlier callers still type-check. */
    status?: string;
}

export interface TravelHaloTextFrame {
    /** 0..1 visibility shared with the halo. */
    opacity: number;
    /** Milliseconds since the halo appeared. */
    elapsedMs: number;
    /** Camera azimuth in the halo's local XY plane, radians. */
    cameraAngle: number;
    staticMotion: boolean;
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (n: number) => {
    const x = clamp(n);
    return x * x * (3 - 2 * x);
};

/** A progress band laid over the halo track, closing from the viewer toward the far side. */
function createProgressRing(THREE: typeof Three) {
    const segments = 192;
    const inner = 0.7845;
    const outer = 0.8005;
    const positions = new Float32Array((segments + 1) * 2 * 3);
    const colors = new Float32Array((segments + 1) * 2 * 4).fill(1);
    const indices: number[] = [];
    for (let segment = 0; segment <= segments; segment++) {
        // Zero sits nearest the viewer (-Y); both halves sweep to +Y.
        const angle = -Math.PI / 2 + (segment / segments) * Math.PI * 2;
        [inner, outer].forEach((radius, row) => {
            const vertex = segment * 2 + row;
            positions[vertex * 3] = Math.cos(angle) * radius;
            positions[vertex * 3 + 1] = Math.sin(angle) * radius;
        });
        if (segment < segments) {
            const a = segment * 2;
            indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const color = new THREE.BufferAttribute(colors, 4);
    geometry.setAttribute("color", color);
    geometry.setIndex(indices);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        vertexColors: true,
        fog: false,
        side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    let shown = -1;
    function set(progress: number) {
        if (Math.abs(progress - shown) < 0.0005) return;
        shown = progress;
        const feather = 0.025;
        for (let segment = 0; segment <= segments; segment++) {
            // Distance along either half, 0 at the viewer and 1 at the far side.
            const t = segment / segments;
            const along = Math.min(t, 1 - t) * 2;
            const alpha = smooth((progress - along) / feather + 0.5);
            colors[segment * 8 + 3] = alpha;
            colors[segment * 8 + 7] = alpha;
        }
        color.needsUpdate = true;
    }
    return {
        mesh,
        material,
        set,
        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
}

/** The loading progress band bound to the departure halo's floor ring. No text. */
export function createTravelHaloText(THREE: typeof Three) {
    const group = new THREE.Group();
    group.name = "lobby-travel-halo-text";
    // The band sits a hair above the halo so it never z-fights the floor glow.
    group.position.z = 0.002;
    const progress = createProgressRing(THREE);
    progress.mesh.name = "lobby-travel-halo-progress";
    group.add(progress.mesh);
    group.visible = false;
    let label: TravelHaloLabel | undefined;
    let shownProgress = 0;

    function setLabel(next: TravelHaloLabel | undefined) {
        if (!next) {
            label = undefined;
            return;
        }
        const firstShow = !label;
        label = next;
        // Count up from zero on a fresh departure; prepared spaces start full.
        if (firstShow) shownProgress = Number.isFinite(next.progress) ? 0 : 1;
    }

    function update(frame: TravelHaloTextFrame) {
        group.visible = !!label && frame.opacity > 0.001;
        if (!group.visible) return;
        const elapsed = Math.max(0, frame.elapsedMs);
        const fixed = frame.staticMotion;
        // The band's start stays nearest the camera and holds still.
        group.rotation.z = frame.cameraAngle + Math.PI / 2;
        const bandIn = fixed ? 1 : smooth((elapsed - 380) / 800);
        const target = clamp(label.progress ?? 1);
        // Coarse loader steps count up smoothly instead of jumping.
        shownProgress = fixed
            ? target
            : shownProgress + (target - shownProgress) * 0.06;
        if (Math.abs(target - shownProgress) < 0.002) shownProgress = target;
        progress.set(shownProgress * bandIn);
        progress.material.opacity = frame.opacity * 0.8;
    }

    return {
        group,
        setLabel,
        update,
        dispose() {
            progress.dispose();
        },
    };
}
