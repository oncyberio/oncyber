import {
    DEMO_SET_OPTIONS,
    VIDEO_TICKS_PER_FRAME,
    applyOperation,
    applyOperations,
    createDemoProject,
    createDemoShot,
    constructProceduralSet,
    identityTransform,
    searchSetCatalog,
    selectActiveShot,
    selectArtworksForShot,
    selectCurrentSet,
    type VideoArtwork,
} from "./index";

describe("VideoProject v1", () => {
    test("exposes three searchable procedural set options", () => {
        expect(DEMO_SET_OPTIONS).toHaveLength(3);
        expect(DEMO_SET_OPTIONS.every((set) => set.nodes.length >= 5)).toBe(
            true
        );
        expect(searchSetCatalog("quiet gallery").map((set) => set.id)).toEqual([
            "white-cube",
        ]);
        expect(
            searchSetCatalog("orbit", ["exterior"]).map((set) => set.id)
        ).toEqual(["sunset-monoliths"]);
    });

    test("creates an immutable, UI-friendly project", () => {
        const project = createDemoProject({ id: "film-1", title: "Launch" });
        expect(project.schemaVersion).toBe(1);
        expect(project.fps).toBe(30);
        expect(project.orderedShotIds).toEqual(["shot-1"]);
        expect(selectActiveShot(project).camera.position.points[0]).toEqual([
            7, 2.8, 8,
        ]);
        expect(selectCurrentSet(project)?.title).toBe("White Cube");
        expect(Object.isFrozen(project)).toBe(true);
        expect(
            Object.isFrozen(project.shots["shot-1"].camera.position.points)
        ).toBe(true);
    });

    test("applies operations without mutating their input", () => {
        const before = createDemoProject();
        const after = applyOperation(before, {
            id: "move-1",
            source: "user",
            type: "camera.point.move",
            shotId: "shot-1",
            spline: "position",
            index: 0,
            point: [9, 4, 8],
        });
        expect(before.revision).toBe(0);
        expect(before.shots["shot-1"].camera.position.points[0]).toEqual([
            7, 2.8, 8,
        ]);
        expect(after.revision).toBe(1);
        expect(after.shots["shot-1"].camera.position.points[0]).toEqual([
            9, 4, 8,
        ]);
    });

    test("commits an operation batch as one revision", () => {
        const before = createDemoProject();
        const after = applyOperations(before, [
            {
                id: "rename-1",
                source: "agent",
                type: "project.rename",
                title: "Cobalt launch",
            },
            {
                id: "set-1",
                source: "agent",
                type: "set.select",
                setId: "cobalt-pavilion",
            },
        ]);
        expect(after.revision).toBe(1);
        expect(after.title).toBe("Cobalt launch");
        expect(after.setId).toBe("cobalt-pavilion");
    });

    test("constructs a project-local set and appends its shot in one revision", () => {
        const before = createDemoProject();
        const set = constructProceduralSet({
            id: "custom-night-gallery",
            title: "Night Gallery",
            direction: "A dark gallery with a warm central runway.",
            template: "gallery",
            palette: ["#12151c", "#e6a15c", "#e9e4d8"],
        });
        const newShot = createDemoShot("shot-2", set.id);
        const after = applyOperations(before, [
            {
                id: "create-night-gallery",
                source: "user",
                type: "set.create",
                set,
            },
            {
                id: "append-night-gallery-shot",
                source: "user",
                type: "shot.add",
                shot: newShot,
                afterShotId: "shot-1",
            },
        ]);

        expect(after.revision).toBe(1);
        expect(after.sets?.[set.id]).toEqual(set);
        expect(after.orderedShotIds).toEqual(["shot-1", "shot-2"]);
        expect(after.shots["shot-2"].setId).toBe(set.id);
        expect(after.activeShotId).toBe("shot-2");
    });

    test("materializes a legacy shot set before a new set changes the default", () => {
        const current = createDemoProject();
        const { setId: _legacySetId, ...legacyShot } = current.shots["shot-1"];
        const legacyProject = {
            ...current,
            shots: { "shot-1": legacyShot },
        };
        const set = constructProceduralSet({
            id: "custom-sculpture-field",
            title: "Sculpture Field",
            direction: "A sparse outdoor field for a long orbit.",
            template: "landscape",
            palette: ["#b8573e", "#30384d", "#f2cf99"],
        });
        const after = applyOperation(legacyProject, {
            id: "create-sculpture-field",
            source: "user",
            type: "set.create",
            set,
        });

        expect(after.setId).toBe(set.id);
        expect(after.shots["shot-1"].setId).toBe("white-cube");
    });

    test("scopes artworks to the active shot set", () => {
        const artwork = (id: string, setId: string): VideoArtwork => ({
            id,
            name: id,
            setId,
            source: { kind: "image", uri: `https://assets.example/${id}.png` },
            transform: identityTransform(),
            protection: "exact",
            visible: true,
        });
        const project = applyOperations(createDemoProject(), [
            {
                id: "add-white-art",
                source: "user",
                type: "artwork.add",
                artwork: artwork("white-art", "white-cube"),
            },
            {
                id: "add-cobalt-art",
                source: "user",
                type: "artwork.add",
                artwork: artwork("cobalt-art", "cobalt-pavilion"),
            },
            {
                id: "add-cobalt-shot",
                source: "user",
                type: "shot.add",
                shot: createDemoShot("shot-2", "cobalt-pavilion"),
            },
        ]);

        expect(selectArtworksForShot(project).map(({ id }) => id)).toEqual([
            "cobalt-art",
        ]);
        expect(
            selectArtworksForShot(project, "shot-1").map(({ id }) => id)
        ).toEqual(["white-art"]);
    });

    test("validates frame-aligned duration and exact artwork", () => {
        const project = createDemoProject();
        expect(() =>
            applyOperation(project, {
                id: "bad-duration",
                source: "user",
                type: "shot.duration.set",
                shotId: "shot-1",
                durationTicks: VIDEO_TICKS_PER_FRAME + 1,
            })
        ).toThrow(/shots do not match/);

        const artwork: VideoArtwork = {
            id: "art-1",
            name: "Collection piece",
            source: {
                kind: "nft",
                uri: "https://assets.example/token.png",
                nft: {
                    chain: "ethereum",
                    contract: "0xabc",
                    tokenId: "42",
                },
            },
            transform: {
                ...identityTransform(),
                position: [0, 1.6, -6.8],
            },
            protection: "exact",
            visible: true,
        };
        const after = applyOperation(project, {
            id: "add-art",
            source: "user",
            type: "artwork.add",
            artwork,
        });
        expect(after.artworks["art-1"].protection).toBe("exact");
    });
});
