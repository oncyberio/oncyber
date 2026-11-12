import * as THREE from "three";
import {
    buildRadialCellSchedule,
    type RadialRevealStep,
    type WorldRevealDirection,
} from "./worldRadialReveal";
import { createWorldCubeReveal } from "./worldCubeReveal";
import { WORLD_TILE_MAX_DELAY, WORLD_TILE_SPAN } from "./worldTileMotion";

const anchor = { x: 0, y: 0, z: 0 };
const cell = (key: string, x: number, y: number, z: number) => ({
    key,
    center: { x, y, z },
});
const keyed = <T extends { key: string }>(steps: T[]) =>
    new Map(steps.map((step) => [step.key, step]));

describe("outward world-space reveal audit", () => {
    test("empty and singleton schedules keep the feet as their fixed origin", () => {
        expect(buildRadialCellSchedule([], anchor)).toEqual([]);
        expect(
            buildRadialCellSchedule([cell("feet", 0, 0, 0)], anchor)[0]
        ).toMatchObject({ fraction: 0, distance: 0 });
        expect(
            buildRadialCellSchedule([cell("far", 0, 0, 20)], anchor, {
                radius: 10,
            })[0]
        ).toMatchObject({ fraction: 1, distance: 20 });
    });

    test("near geometry precedes distant geometry in every direction including overhead", () => {
        const cells = [cell("feet", 0, 0, 0)];
        const axes = {
            east: [1, 0, 0],
            west: [-1, 0, 0],
            north: [0, 0, -1],
            south: [0, 0, 1],
            above: [0, 1, 0],
            below: [0, -1, 0],
        };
        for (const [name, [x, y, z]] of Object.entries(axes)) {
            cells.push(
                cell(`${name}-near`, x, y, z),
                cell(`${name}-far`, x * 8, y * 8, z * 8)
            );
        }
        const steps = keyed(
            buildRadialCellSchedule(cells, anchor, { radius: 10 })
        );
        for (const name of Object.keys(axes)) {
            expect(steps.get(`${name}-near`).distance).toBe(1);
            expect(steps.get(`${name}-far`).distance).toBe(8);
            expect(steps.get(`${name}-near`).fraction).toBeLessThan(0.14);
            expect(steps.get(`${name}-far`).fraction).toBeGreaterThan(0.76);
        }
        expect(steps.get("feet").fraction).toBe(0);
    });

    test("inward departure reverses the same connected wave in every direction and keeps feet last", () => {
        const cells = [cell("feet", 0, 0, 0)];
        for (const [axis, [x, y, z]] of Object.entries({
            east: [1, 0, 0],
            west: [-1, 0, 0],
            north: [0, 0, -1],
            south: [0, 0, 1],
            above: [0, 1, 0],
            below: [0, -1, 0],
        })) {
            for (const distance of [1, 3, 6, 10])
                cells.push(
                    cell(
                        `${axis}-${distance}`,
                        x * distance,
                        y * distance,
                        z * distance
                    )
                );
        }
        const outward = keyed(
            buildRadialCellSchedule(cells, anchor, {
                radius: 10,
                fullRange: true,
            })
        );
        const inward = keyed(
            buildRadialCellSchedule(cells, anchor, {
                radius: 10,
                fullRange: true,
                direction: "inward",
            })
        );
        expect(inward.get("feet").fraction).toBe(1);
        for (const step of inward.values()) {
            expect(step.fraction).toBe(1 - outward.get(step.key).fraction);
            expect(step.seed).toBe(outward.get(step.key).seed);
            if (step.distance === 10) expect(step.fraction).toBe(0);
        }
        for (const axis of ["east", "west", "north", "south", "above", "below"])
            for (const [near, far] of [
                [1, 3],
                [3, 6],
                [6, 10],
            ])
                expect(inward.get(`${axis}-${far}`).fraction).toBeLessThan(
                    inward.get(`${axis}-${near}`).fraction
                );
        expect(
            buildRadialCellSchedule([...cells].reverse(), anchor, {
                radius: 10,
                fullRange: true,
                direction: "inward",
            })
        ).toEqual([...inward.values()]);
    });

    test("the anchor is the player’s feet and distance includes all three world axes", () => {
        const feet = { x: 15, y: -3, z: 7 };
        const steps = keyed(
            buildRadialCellSchedule(
                [
                    cell("feet", feet.x, feet.y, feet.z),
                    cell("diagonal", feet.x + 3, feet.y + 4, feet.z + 12),
                ],
                feet,
                { radius: 20 }
            )
        );
        expect(steps.get("feet").distance).toBe(0);
        expect(steps.get("diagonal").distance).toBe(13);
        expect(
            Math.abs(steps.get("diagonal").fraction - 13 / 20)
        ).toBeLessThanOrEqual(0.030001);
    });

    test("explicit wave radius isolates visible timing from distant outliers", () => {
        const cells = [
            cell("near", 1, 0, 0),
            cell("middle", 5, 0, 0),
            cell("edge", 10, 0, 0),
        ];
        const before = buildRadialCellSchedule(cells, anchor, { radius: 10 });
        const after = keyed(
            buildRadialCellSchedule(
                [...cells, cell("outlier", 1e6, 1e6, 1e6)],
                anchor,
                { radius: 10 }
            )
        );
        for (const step of before) expect(after.get(step.key)).toEqual(step);
        expect(after.get("outlier").fraction).toBe(1);
        expect(after.get("edge").fraction).toBe(1);
    });

    test("default extent is bounded so far architecture cannot swallow the nearby wave", () => {
        const dense = Array.from({ length: 100 }, (_, i) =>
            cell(`near-${i}`, 1 + (i % 9), 0, 0)
        );
        const steps = keyed(
            buildRadialCellSchedule([...dense, cell("far", 1e6, 0, 0)], anchor)
        );
        expect(steps.get("far").fraction).toBe(1);
        expect(steps.get("near-0").fraction).toBeGreaterThan(0.04);
        expect(steps.get("near-8").fraction).toBeGreaterThan(0.45);
        const sparse = keyed(
            buildRadialCellSchedule(
                [
                    cell("near", 9, 0, 0),
                    ...Array.from({ length: 20 }, (_, i) =>
                        cell(`far-${i}`, 1e6 + i, 0, 0)
                    ),
                ],
                anchor
            )
        );
        expect(sparse.get("near").fraction).toBeGreaterThan(0.46);
    });

    test("small spatial jitter is deterministic under permutations without mutating inputs", () => {
        const cells = Array.from({ length: 24 }, (_, i) =>
            cell(
                `ring-${i}`,
                5 * Math.cos((i * Math.PI) / 12),
                0,
                5 * Math.sin((i * Math.PI) / 12)
            )
        );
        const snapshot = JSON.stringify(cells);
        cells.forEach((point) => {
            Object.freeze(point.center);
            Object.freeze(point);
        });
        const expected = buildRadialCellSchedule(cells, anchor, { radius: 10 });
        expect(
            buildRadialCellSchedule([...cells].reverse(), anchor, {
                radius: 10,
            })
        ).toEqual(expected);
        expect(
            buildRadialCellSchedule(
                [...cells.slice(7), ...cells.slice(0, 7)],
                anchor,
                { radius: 10 }
            )
        ).toEqual(expected);
        expect(
            new Set(expected.map((step) => step.fraction)).size
        ).toBeGreaterThan(12);
        for (const step of expected)
            expect(Math.abs(step.fraction - 0.5)).toBeLessThanOrEqual(0.030001);
        expect(JSON.stringify(cells)).toBe(snapshot);
    });

    test("12k scattered cells have finite bounded timing and stable keys", () => {
        const cells = Array.from({ length: 12000 }, (_, i) =>
            cell(`${i}`, (i % 100) - 50, Math.floor(i / 100) - 60, i % 47)
        );
        const started = performance.now();
        const steps = buildRadialCellSchedule(cells, anchor);
        expect(steps).toHaveLength(12000);
        expect(new Set(steps.map((step) => step.key)).size).toBe(12000);
        expect(
            steps.every(
                (step) =>
                    Number.isFinite(step.fraction) &&
                    step.fraction >= 0 &&
                    step.fraction <= 1
            )
        ).toBe(true);
        console.info("world-radial-reveal-audit", {
            cells: steps.length,
            buildMs: Math.round(performance.now() - started),
        });
    });
});

type Step = RadialRevealStep & { delay: number; span: number };
type Range = { cellKey: string; start: number; count: number; source: string };
function fixture(
    mode: "reveal" | "dissolve" = "reveal",
    direction?: WorldRevealDirection
) {
    const scene = new THREE.Scene();
    const background = new THREE.Color(0x445566);
    const fog = new THREE.Fog(0x445566, 10, 100);
    scene.background = background;
    scene.fog = fog;
    const material = new THREE.MeshStandardMaterial();
    const patches = [
        { name: "near-floor", position: [0.1, 0.1, 0.1] },
        { name: "east", position: [8.1, 0.1, 0.1] },
        { name: "west", position: [-8.1, 0.1, 0.1] },
        { name: "north", position: [0.1, 0.1, -8.1] },
        { name: "south", position: [0.1, 0.1, 8.1] },
        { name: "overhead", position: [0.1, 8.1, 0.1] },
    ].map(({ name, position }) => {
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.2, 0.2),
            material
        );
        mesh.name = name;
        mesh.position.set(position[0], position[1], position[2]);
        mesh.rotation.x = -Math.PI / 2;
        scene.add(mesh);
        return mesh;
    });
    const player = new THREE.Group();
    player.name = "retained-avatar";
    player.userData.worldRevealExclude = true;
    const avatarMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 1.8, 0.5),
        material
    );
    player.add(avatarMesh);
    scene.add(player);
    const unsupported = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.ShaderMaterial()
    );
    unsupported.name = "custom-shader";
    unsupported.position.set(2, 0, 2);
    const distant = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    distant.name = "distant";
    distant.position.set(100, 0, 0);
    const hidden = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    hidden.visible = false;
    scene.add(unsupported, distant, hidden);
    const children = scene.children.slice();
    const effect = createWorldCubeReveal(THREE, [scene], {
        scene,
        anchor,
        cellSize: 0.5,
        radius: 12,
        mode,
        direction,
    });
    const container = scene.getObjectByName("native-world-cube-reveal");
    const batch = container.children.find((object) =>
        object.name.startsWith("world-batch:")
    ) as THREE.Mesh;
    const ranges = batch.geometry.userData.worldRevealRanges as Range[];
    const positions = batch.geometry.getAttribute(
        "position"
    ) as THREE.BufferAttribute;
    const schedule = () => container.userData.worldRevealSchedule as Step[];
    const area = (source: string) => {
        let total = 0;
        for (const range of ranges.filter((range) => range.source === source))
            for (
                let i = range.start;
                i + 2 < range.start + range.count;
                i += 3
            ) {
                const a = new THREE.Vector3().fromBufferAttribute(positions, i);
                const b = new THREE.Vector3()
                    .fromBufferAttribute(positions, i + 1)
                    .sub(a);
                const c = new THREE.Vector3()
                    .fromBufferAttribute(positions, i + 2)
                    .sub(a);
                total += b.cross(c).length() / 2;
            }
        return total;
    };
    return {
        scene,
        background,
        fog,
        children,
        patches,
        source: patches[0],
        player,
        avatarMesh,
        unsupported,
        distant,
        hidden,
        effect,
        container,
        batch,
        ranges,
        positions,
        schedule,
        area,
    };
}

describe("actual outward tile rendering and dissolve", () => {
    test("reveal assembles the feet first while all distant directions and overhead remain black", () => {
        const f = fixture();
        expect(f.area("near-floor")).toBe(0);
        f.effect.setProgress(0.35);
        expect(f.area("near-floor")).toBeGreaterThan(0.039);
        for (const name of ["east", "west", "north", "south", "overhead"])
            expect(f.area(name)).toBe(0);
        f.effect.setProgress(0.95);
        for (const name of ["east", "west", "north", "south", "overhead"])
            expect(f.area(name)).toBeGreaterThan(0.039);
        expect(f.avatarMesh.visible).toBe(true);
        expect(f.player.visible).toBe(true);
        expect(
            f.ranges.some((range) => range.source === "retained-avatar")
        ).toBe(false);
        f.effect.dispose();
    });

    test("radial timing keeps overlapping turns and ignores camera orientation or framing", () => {
        const f = fixture();
        const schedule = f.schedule().map((step) => ({ ...step }));
        f.effect.setProgress(0.35);
        const positions = Array.from(f.positions.array);
        const camera = new THREE.PerspectiveCamera(12, 0.2);
        camera.position.set(-80, 500, 100);
        camera.lookAt(1000, -500, 0);
        f.scene.add(camera);
        f.scene.updateMatrixWorld(true);
        f.effect.setProgress(0.36);
        f.effect.setProgress(0.35);
        expect(f.schedule()).toEqual(schedule);
        expect(Array.from(f.positions.array)).toEqual(positions);
        for (const step of schedule) {
            expect(step.span).toBe(WORLD_TILE_SPAN);
            expect(step.delay).toBeCloseTo(
                step.fraction * WORLD_TILE_MAX_DELAY,
                12
            );
        }
        expect(WORLD_TILE_SPAN).toBeGreaterThan(0.2);
        f.effect.dispose();
    });

    test("recentering the feet reuses geometry and resamples the current reveal", () => {
        const f = fixture();
        f.effect.setProgress(0.35);
        const geometry = f.batch.geometry;
        const children = f.container.children.slice();
        expect(f.area("east")).toBe(0);
        f.effect.setRevealAnchor({ x: 8.1, y: 0, z: 0.1 });
        expect(f.area("east")).toBeGreaterThan(0.039);
        expect(f.area("near-floor")).toBe(0);
        expect(f.batch.geometry).toBe(geometry);
        expect(f.container.children).toEqual(children);
        f.effect.dispose();
    });

    test("dissolve starts intact, removes nearby geometry first and holds black until disposal", () => {
        const f = fixture("dissolve");
        expect(f.source.visible).toBe(true);
        expect(f.unsupported.visible).toBe(true);
        expect(f.distant.visible).toBe(true);
        expect(f.scene.background).toBe(f.background);
        expect(f.scene.fog).toBe(f.fog);
        f.effect.setProgress(0.35);
        expect(f.area("near-floor")).toBe(0);
        for (const name of ["east", "west", "north", "south", "overhead"])
            expect(f.area(name)).toBeGreaterThan(0.039);
        f.effect.setProgress(1);
        for (const mesh of [...f.patches, f.unsupported, f.distant])
            expect(mesh.visible).toBe(false);
        expect(f.scene.background).toEqual(new THREE.Color(0));
        expect(f.scene.fog).toBeNull();
        expect(f.container.visible).toBe(false);
        expect(f.player.visible).toBe(true);
        expect(f.avatarMesh.visible).toBe(true);
        expect(f.hidden.visible).toBe(false);
        f.effect.setProgress(1);
        expect(f.source.visible).toBe(false);
        f.effect.dispose();
        expect(f.scene.children).toEqual(f.children);
        expect(f.source.visible).toBe(true);
        expect(f.unsupported.visible).toBe(true);
        expect(f.distant.visible).toBe(true);
        expect(f.hidden.visible).toBe(false);
        expect(f.scene.background).toBe(f.background);
        expect(f.scene.fog).toBe(f.fog);
    });

    test("return departure removes the outer world before the ground around the player and restores safely", () => {
        const f = fixture("dissolve", "inward");
        expect(f.source.visible).toBe(true);
        expect(f.container.visible).toBe(false);
        f.effect.setProgress(0.62);
        for (const name of ["east", "west", "north", "south", "overhead"])
            expect(f.area(name)).toBe(0);
        expect(f.area("near-floor")).toBeGreaterThan(0.039);
        expect(f.player.visible).toBe(true);
        const before = Array.from(f.positions.array);
        f.effect.setProgress(0.9);
        f.effect.setProgress(0.62);
        expect(Array.from(f.positions.array)).toEqual(before);
        f.effect.setRevealAnchor({ x: 8.1, y: 0, z: 0.1 });
        expect(f.area("east")).toBeGreaterThan(0.039);
        expect(f.area("near-floor")).toBe(0);
        f.effect.setProgress(1);
        expect(f.container.visible).toBe(false);
        expect(f.scene.background).toEqual(new THREE.Color(0));
        expect(f.player.visible).toBe(true);
        expect(f.avatarMesh.visible).toBe(true);
        f.effect.dispose();
        for (const mesh of f.patches) expect(mesh.visible).toBe(true);
        expect(f.scene.background).toBe(f.background);
        expect(f.scene.fog).toBe(f.fog);
    });

    test("completion preserves exact source attributes and hides temporary dark reverse faces", () => {
        const f = fixture();
        const original = Object.fromEntries(
            Object.entries(f.source.geometry.attributes).map(([name, attr]) => [
                name,
                Array.from(attr.array),
            ])
        );
        const geometry = f.source.geometry,
            material = f.source.material;
        const sourceDispose = jest.spyOn(geometry, "dispose");
        f.effect.setProgress(1);
        const final = Array.from(f.positions.array);
        const normals = Array.from(
            f.batch.geometry.getAttribute("normal").array
        );
        const uv = Array.from(f.batch.geometry.getAttribute("uv").array);
        const matrix = f.source.matrixWorld.clone();
        expect(f.effect.stats.batches).toBe(1);
        expect(f.effect.stats.drawCalls).toBe(3);
        expect(f.effect.stats.backDrawCalls).toBe(1);
        expect(f.container.visible).toBe(false);
        const back = f.container.getObjectByName(
            "world-tile-back"
        ) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
        expect(back.material.side).toBe(THREE.BackSide);
        expect(back.material.map.name).toBe("world-tile-dark-back-gradient");
        expect(back.geometry.getAttribute("position")).toBe(f.positions);
        for (const progress of [0.1, 0.45, 0.9, 1, 0.6, 1]) {
            f.effect.setProgress(progress);
            expect(
                Array.from(f.batch.geometry.getAttribute("uv").array)
            ).toEqual(uv);
            for (const [name, expected] of Object.entries(original))
                expect(
                    Array.from(f.source.geometry.getAttribute(name).array)
                ).toEqual(expected);
        }
        expect(Array.from(f.positions.array)).toEqual(final);
        expect(
            Array.from(f.batch.geometry.getAttribute("normal").array)
        ).toEqual(normals);
        expect(f.source.visible).toBe(true);
        expect(f.source.matrixWorld.equals(matrix)).toBe(true);
        f.effect.dispose();
        expect(f.source.geometry).toBe(geometry);
        expect(f.source.material).toBe(material);
        expect(sourceDispose).not.toHaveBeenCalled();
        expect(f.container.userData.worldRevealSchedule).toBeUndefined();
    });

    test.each(["reveal", "dissolve"] as const)(
        "%s cancellation restores the scene and disposes temporary resources once",
        (mode) => {
            const f = fixture(mode);
            const temporary = new Set<THREE.BufferGeometry>();
            f.container.traverse((object) => {
                if ((object as THREE.Mesh).isMesh)
                    temporary.add((object as THREE.Mesh).geometry);
            });
            const disposed = [...temporary].map((geometry) =>
                jest.spyOn(geometry, "dispose")
            );
            const sourceDisposed = jest.spyOn(f.source.geometry, "dispose");
            const materialDisposed = jest.spyOn(f.source.material, "dispose");
            const avatarDisposed = jest.spyOn(f.avatarMesh.geometry, "dispose");
            f.effect.setProgress(0.37);
            f.effect.dispose();
            f.effect.dispose();
            f.effect.setRevealAnchor({ x: 2, y: 0, z: 2 });
            f.effect.setProgress(0.8);
            expect(f.scene.children).toEqual(f.children);
            for (const mesh of [
                ...f.patches,
                f.unsupported,
                f.distant,
                f.avatarMesh,
            ])
                expect(mesh.visible).toBe(true);
            expect(f.hidden.visible).toBe(false);
            expect(f.scene.background).toBe(f.background);
            expect(f.scene.fog).toBe(f.fog);
            disposed.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
            expect(sourceDisposed).not.toHaveBeenCalled();
            expect(materialDisposed).not.toHaveBeenCalled();
            expect(avatarDisposed).not.toHaveBeenCalled();
        }
    );
});
