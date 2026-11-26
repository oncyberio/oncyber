// The real placeholder factory over a stubbed scene: which door, and which of
// the model's clips, each portal placeholder ends up with.

jest.mock("three", () => ({
    Mesh: class Mesh {
        name: string;
        constructor(name: string) {
            this.name = name;
        }
    },
}));
jest.mock(
    "@3constants",
    () => ({
        // as in three/constants.js, which pulls in the whole engine
        RE_PORTAL_PREVIEW: /^((\d+)portal_preview$|portal_preview_(\d+))$/i,
    }),
    { virtual: true }
);
jest.mock("../previewmesh", () => ({
    PortalPreviewMesh: {
        createFromPlaceholder: (mesh: { name: string }) => ({
            from: mesh.name,
        }),
    },
}));

import { Mesh } from "three";
import PortalPlaceholderFactory from "./index";

const clip = (name: string) => ({ name });

function room(previews: string[], doors: string[], clipNames: string[]) {
    const meshes = previews.map((name) => new (Mesh as any)(name));
    const portalNode = {
        name: "portal",
        parent: { remove: jest.fn() },
        traverse: (visit: (mesh: unknown) => void) => meshes.forEach(visit),
    };
    return {
        gltf: {
            scene: {
                getObjectByName: (name: string) =>
                    name === "portal" ? portalNode : undefined,
            },
            animations: clipNames.map(clip),
        } as any,
        portalMeshes: Object.fromEntries(
            doors.map((name) => [name, { name }])
        ),
    };
}

const clipNames = (list: { name: string }[]) => list.map((it) => it.name);

describe("PortalPlaceholderFactory", () => {
    it("finds a door's clips when they are padded differently", () => {
        // The Starry Night: three digit previews and doors, four digit clips
        const { gltf, portalMeshes } = room(
            ["Portal_Preview_073", "Portal_Preview_074"],
            ["Portal_Door_073", "Portal_Door_074"],
            [
                "Portal_Close_0074",
                "Portal_Open_0074",
                "Portal_Close_0073",
                "Portal_Open_0073",
                "Windmill",
            ]
        );

        const [door73, door74] = PortalPlaceholderFactory.get(
            gltf,
            portalMeshes
        );

        expect(door73.portalId).toBe("Portal_Preview_073");
        expect(door73.meshes.portalDoor).toBe(portalMeshes.Portal_Door_073);
        expect(clipNames(door73.animations.open)).toEqual(["Portal_Open_0073"]);
        expect(clipNames(door73.animations.close)).toEqual([
            "Portal_Close_0073",
        ]);
        expect(clipNames(door74.animations.open)).toEqual(["Portal_Open_0074"]);
        expect(clipNames(door74.animations.close)).toEqual([
            "Portal_Close_0074",
        ]);

        // door clips are the portals' to play, not the room's
        expect(clipNames(gltf.animations)).toEqual(["Windmill"]);
    });

    it("does not give door 73 the clips of door 173", () => {
        const { gltf, portalMeshes } = room(
            ["Portal_Preview_73", "Portal_Preview_173"],
            ["Portal_Door_73", "Portal_Door_173"],
            ["Portal_Open_173", "Portal_Close_173"]
        );

        const [door73, door173] = PortalPlaceholderFactory.get(
            gltf,
            portalMeshes
        );

        expect(door73.animations).toEqual({ open: [], close: [] });
        expect(clipNames(door173.animations.open)).toEqual(["Portal_Open_173"]);
        expect(clipNames(door173.animations.close)).toEqual([
            "Portal_Close_173",
        ]);
    });

    it("gives door 5 its own clips when doors 50 to 59 come first", () => {
        const { gltf, portalMeshes } = room(
            ["Portal_Preview_005"],
            ["Portal_Door_005"],
            [
                "Portal_Close_0059",
                "Portal_Open_0059",
                "Portal_Close_005",
                "Portal_Open_005",
            ]
        );

        const [door5] = PortalPlaceholderFactory.get(gltf, portalMeshes);

        expect(clipNames(door5.animations.open)).toEqual(["Portal_Open_005"]);
        expect(clipNames(door5.animations.close)).toEqual(["Portal_Close_005"]);
    });
});
