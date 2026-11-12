import * as THREE from "three";
import { createTravelHaloText } from "./travelHaloText";

// Runs without a DOM on purpose: nothing here may need a canvas or a font.
const settled = {
    opacity: 1,
    elapsedMs: 5000,
    cameraAngle: 0,
    staticMotion: false,
};
function band(halo: ReturnType<typeof createTravelHaloText>) {
    const mesh = halo.group.getObjectByName(
        "lobby-travel-halo-progress"
    ) as THREE.Mesh;
    const color = mesh.geometry.getAttribute("color");
    // Vertex pairs run once round the ring; 0 is nearest the viewer, 96 the far side.
    return (segment: number) => color.array[segment * 8 + 3];
}

describe("travel halo", () => {
    it("draws no words: only the progress band, with no text texture", () => {
        const halo = createTravelHaloText(THREE);
        halo.setLabel({
            progress: 0.4,
            title: "Vault",
            status: "Opening your world…",
        });
        halo.update(settled);
        const drawn: THREE.Object3D[] = [];
        halo.group.traverse((object) => drawn.push(object));
        expect(drawn.map((object) => object.name)).toEqual([
            "lobby-travel-halo-text",
            "lobby-travel-halo-progress",
        ]);
        const material = (drawn[1] as THREE.Mesh)
            .material as THREE.MeshBasicMaterial;
        expect(material.map).toBeNull();
        expect(typeof document).toBe("undefined");
        halo.dispose();
    });

    it("stays hidden until there is a journey to show and the halo is lit", () => {
        const halo = createTravelHaloText(THREE);
        halo.update(settled);
        expect(halo.group.visible).toBe(false);
        halo.setLabel({ progress: 0.2 });
        halo.update({ ...settled, opacity: 0 });
        expect(halo.group.visible).toBe(false);
        halo.update(settled);
        expect(halo.group.visible).toBe(true);
        halo.setLabel(undefined);
        halo.update(settled);
        expect(halo.group.visible).toBe(false);
        halo.dispose();
    });

    it("counts up from the viewer toward the far side as loading is reported", () => {
        const halo = createTravelHaloText(THREE);
        const alpha = band(halo);
        halo.setLabel({ progress: 0.5 });
        halo.update(settled);
        expect(alpha(0)).toBe(1);
        expect(alpha(24)).toBe(0);
        for (let frame = 0; frame < 400; frame++) halo.update(settled);
        expect(alpha(24)).toBe(1);
        expect(alpha(72)).toBe(0);
        expect(alpha(96)).toBe(0);
        // The band faces the camera and keeps the halo's fade.
        halo.update({ ...settled, opacity: 0.5, cameraAngle: 1 });
        expect(halo.group.rotation.z).toBeCloseTo(1 + Math.PI / 2);
        const mesh = halo.group.children[0] as THREE.Mesh;
        expect((mesh.material as THREE.Material).opacity).toBeCloseTo(0.4);
        halo.dispose();
    });

    it("a prepared world starts full, and reduced motion shows progress at once", () => {
        const prepared = createTravelHaloText(THREE);
        prepared.setLabel({});
        prepared.update(settled);
        expect(band(prepared)(90)).toBe(1);
        prepared.dispose();
        const still = createTravelHaloText(THREE);
        still.setLabel({ progress: 0.5 });
        still.update({ ...settled, elapsedMs: 0, staticMotion: true });
        expect(band(still)(24)).toBe(1);
        expect(band(still)(72)).toBe(0);
        still.dispose();
    });
});
