import { Euler, Vector3 } from "three";
import { spawnCameraRotation } from "./spawnRotation";

// Where the spawn marker points, as Studio shows it (three's XYZ order).
const markerForward = ({ x, y, z }) =>
    new Vector3(0, 0, -1).applyEuler(new Euler(x, y, z, "XYZ"));
// Where the camera looks when it starts with this rotation.
const cameraForward = (e) =>
    new Vector3(0, 0, -1).applyEuler(new Euler(e.x, e.y, e.z, "YXZ"));

describe("spawnCameraRotation", () => {
    // Saved by Studio for Museum Of Memes, Millo's Loft and Party Room.
    it.each([
        { x: -3.1416, y: -3.3, z: -3.1416 },
        { x: 3.1416, y: -1.5455, z: 3.1416 },
        { x: 3.1414, y: 1.5384, z: -3.1414 },
    ])("starts a flipped spawn level, facing the marker: %o", (saved) => {
        const rotation = spawnCameraRotation(saved);
        expect(Math.abs(rotation.x)).toBeLessThan(0.01);
        expect(rotation.z).toBe(0);
        const want = markerForward(saved);
        const got = cameraForward(rotation);
        expect(got.distanceTo(want)).toBeLessThan(0.01);
    });

    it.each([
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 2.4, z: 0 },
        { x: -0.1736, y: 0, z: 0 },
        { x: -0.2, y: 1.1, z: 0 },
    ])("keeps every other rotation as saved: %o", (saved) => {
        const rotation = spawnCameraRotation(saved);
        expect([rotation.x, rotation.y, rotation.z]).toEqual([
            saved.x,
            saved.y,
            saved.z,
        ]);
    });

    it("reads a missing rotation as facing forward", () => {
        const rotation = spawnCameraRotation(undefined);
        expect([rotation.x, rotation.y, rotation.z]).toEqual([0, 0, 0]);
    });
});
