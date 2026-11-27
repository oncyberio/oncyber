/** @jest-environment node */
import {
    Box3,
    BoxGeometry,
    Group,
    Matrix4,
    Mesh,
    Object3D,
    PlaneGeometry,
    Vector3,
} from "three";

jest.mock("./facade", () => ({ worldModel: jest.fn(() => null) }));

import { worldModel } from "./facade";
import { createOpenings, cutModel, withoutTriangles } from "./openings";

const triangles = (mesh: Mesh) => {
    const geometry = mesh.geometry;
    return (
        (geometry.getIndex()?.count ??
            geometry.getAttribute("position").count) / 3
    );
};

/** A wall of 8 by 2 panels (32 triangles) standing at the origin. */
function wall() {
    const model = new Group();
    const mesh = new Mesh(new PlaneGeometry(8, 2, 8, 2));
    model.add(mesh);
    model.updateMatrixWorld(true);
    return { model, mesh };
}

const holes = () => {
    const calls: string[] = [];
    return {
        calls,
        open: (id: string) => (calls.push(`open ${id}`), true),
        close: (id: string) => void calls.push(`close ${id}`),
        stale: () => false,
        dispose() {},
    } as any;
};

describe("a geometry without what is in the hole", () => {
    test("the triangles asked for are dropped, the rest kept", () => {
        const { mesh } = wall();
        const open = withoutTriangles(
            mesh.geometry,
            new Matrix4(),
            (a, b, c) => (a.x + b.x + c.x) / 3 < 0
        );
        expect(open.getIndex().count / 3).toBe(16);
        // And the geometry it was made from is as it was.
        expect(triangles(mesh)).toBe(32);
    });

    test("nothing dropped is no new geometry", () => {
        const { mesh } = wall();
        expect(
            withoutTriangles(mesh.geometry, new Matrix4(), () => false)
        ).toBeNull();
    });
});

describe("a hole in the world's model", () => {
    const around = (half: Vector3) =>
        new Box3(half.clone().negate(), half.clone());

    test("what has its middle in the box is not drawn, and is put back exactly", () => {
        const { model, mesh } = wall();
        const whole = mesh.geometry;
        const half = new Vector3(1, 1, 1);
        const undo = cutModel(model, around(half), new Matrix4(), half);
        // Two panels wide and two high: eight triangles gone.
        expect(triangles(mesh)).toBe(24);
        undo();
        expect(mesh.geometry).toBe(whole);
    });

    test("what is hidden or out of reach is left alone", () => {
        const { model, mesh } = wall();
        const far = new Mesh(new BoxGeometry(1, 1, 1));
        far.position.set(50, 0, 0);
        model.add(far);
        mesh.visible = false;
        const half = new Vector3(1, 1, 1);
        cutModel(model, around(half), new Matrix4(), half);
        expect(triangles(mesh)).toBe(32);
        expect(triangles(far)).toBe(12);
    });
});

describe("the openings scripts hold", () => {
    test("an opening is cut where its holder stands, and closed when it lets go", () => {
        const { model, mesh } = wall();
        (worldModel as jest.Mock).mockReturnValue(model);
        const walked = holes();
        const openings = createOpenings(walked);
        const holder = new Object3D();
        holder.position.set(-3, 0, 0);
        holder.updateMatrixWorld(true);
        openings.set("door", holder, [2, 2, 2]);
        expect(triangles(mesh)).toBe(24);
        expect(walked.calls).toEqual(["open door"]);
        openings.set("door", holder, null);
        expect(triangles(mesh)).toBe(32);
    });

    test("with no world yet it waits, and is cut once there is one", () => {
        (worldModel as jest.Mock).mockReturnValue(null);
        const openings = createOpenings(holes());
        const holder = new Object3D();
        openings.set("door", holder, [2, 2, 2]);
        const { model, mesh } = wall();
        (worldModel as jest.Mock).mockReturnValue(model);
        openings.sync();
        expect(triangles(mesh)).toBe(24);
        // Nothing new: nothing is cut twice.
        openings.sync();
        expect(triangles(mesh)).toBe(24);
        openings.dispose();
        expect(triangles(mesh)).toBe(32);
    });
});
