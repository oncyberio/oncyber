/** @jest-environment node */
import { PerspectiveCamera, Vector3 } from "three";

jest.mock("./facade", () => ({
    currentCamera: jest.fn(),
    mainPlayer: jest.fn(),
}));

import { currentCamera, mainPlayer } from "./facade";
import { readView } from "./view";

const camera = currentCamera as jest.Mock;
const player = mainPlayer as jest.Mock;
const rounded = (list: number[]) =>
    list.map((n) => Math.round(n * 100) / 100 + 0);

describe("where the visitor stands and looks", () => {
    test("the player's feet, the way they face on the ground, and the camera", () => {
        const eye = new PerspectiveCamera();
        eye.position.set(0, 2, 5);
        eye.lookAt(5, 0, 5);
        eye.updateMatrixWorld();
        camera.mockReturnValue(eye);
        player.mockReturnValue({ position: new Vector3(1, 0, 5) });
        const view = readView();
        expect(view.player.position).toEqual([1, 0, 5]);
        // Looking down and along +x: flat, it is +x.
        expect(rounded(view.player.forward)).toEqual([1, 0, 0]);
        expect(view.player.yaw).toBeCloseTo(Math.PI / 2);
        expect(view.camera.position).toEqual([0, 2, 5]);
        expect(view.camera.forward[1]).toBeLessThan(0);
    });

    test("with no player yet the camera stands in; with no camera, a default", () => {
        const eye = new PerspectiveCamera();
        eye.position.set(3, 1, 0);
        eye.updateMatrixWorld();
        camera.mockReturnValue(eye);
        player.mockReturnValue(null);
        expect(readView().player.position).toEqual([3, 1, 0]);
        camera.mockReturnValue(null);
        const view = readView();
        expect(view.camera.position).toEqual([0, 0, 0]);
        expect(view.camera.forward).toEqual([0, 0, -1]);
    });
});
