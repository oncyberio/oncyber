import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";

test.each(["x", "y", "z"])(
    "a thin %s-facing wall turns around its actual surface rather than the empty grid volume",
    (axis) => {
        const scene = new THREE.Scene();
        const geometry = new THREE.PlaneGeometry(0.4, 0.4);
        if (axis === "x") geometry.rotateY(Math.PI / 2);
        if (axis === "y") geometry.rotateX(Math.PI / 2);
        geometry.translate(0.25, 0.25, 0.25);
        const source = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
        scene.add(source);
        const effect = createWorldCubeReveal(THREE, [source], {
            scene,
            anchor: { x: 0, y: 0, z: 0 },
            cellSize: 2,
        });
        expect(effect.stats.cells).toBe(1);
        const container = scene.getObjectByName("native-world-cube-reveal");
        const batch = container.children.find((c) =>
            c.name.startsWith("world-batch:")
        ) as THREE.Mesh;
        const schedule = container.userData.worldRevealSchedule[0];
        const position = batch.geometry.getAttribute(
            "position"
        ) as THREE.BufferAttribute;
        const center = () =>
            new THREE.Box3()
                .setFromBufferAttribute(position)
                .getCenter(new THREE.Vector3());
        effect.setProgress(1);
        const settled = Array.from(position.array);
        const origin = center();
        effect.setProgress(schedule.delay + schedule.span * 0.18);
        expect(center().distanceTo(origin)).toBeLessThan(0.09);
        const normal = new THREE.Vector3().fromBufferAttribute(
            batch.geometry.getAttribute("normal"),
            0
        );
        expect(Math.abs(normal[axis])).toBeLessThan(0.001);
        effect.setProgress(1);
        expect(Array.from(position.array)).toEqual(settled);
        effect.dispose();
        expect(source.visible).toBe(true);
        expect(scene.children).toEqual([source]);
    }
);
