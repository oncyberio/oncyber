import {
    VideoRevisionConflict,
    constructProceduralSet,
    createDemoProject,
    createDemoShot,
    type VideoOperation,
} from "../model";
import {
    VideoProposalConflict,
    createAgentProposal,
    createEditorStore,
    type StorageLike,
} from "./index";

class MemoryStorage implements StorageLike {
    values = new Map<string, string>();
    getItem(key: string) {
        return this.values.get(key) ?? null;
    }
    setItem(key: string, value: string) {
        this.values.set(key, value);
    }
    removeItem(key: string) {
        this.values.delete(key);
    }
}

const rename = (id: string, title: string, source: "user" | "agent" = "user") =>
    ({ id, source, type: "project.rename", title } as const);

describe("video editor store", () => {
    test("provides stable snapshots, subscriptions, undo and redo", () => {
        const storage = new MemoryStorage();
        const store = createEditorStore(createDemoProject(), { storage });
        const initialSnapshot = store.getSnapshot();
        expect(store.getSnapshot()).toBe(initialSnapshot);
        const listener = jest.fn();
        const unsubscribe = store.subscribe(listener);

        // Methods are safe to pass directly to React callbacks without binding.
        const { dispatch } = store;
        dispatch(rename("rename-1", "Manual title"));
        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot().project.title).toBe("Manual title");
        expect(store.getSnapshot().project.revision).toBe(1);

        store.undo();
        expect(store.getSnapshot().project.title).toBe("Untitled video");
        expect(store.getSnapshot().project.revision).toBe(2);
        expect(store.getSnapshot().canRedo).toBe(true);

        store.redo();
        expect(store.getSnapshot().project.title).toBe("Manual title");
        expect(store.getSnapshot().project.revision).toBe(3);
        unsubscribe();
    });

    test("rejects stale revision dispatches", () => {
        const store = createEditorStore(createDemoProject(), { storage: null });
        store.dispatch(rename("rename-1", "First"));
        expect(() =>
            store.dispatch(rename("rename-2", "Stale"), {
                expectedRevision: 0,
            })
        ).toThrow(VideoRevisionConflict);
        expect(store.getSnapshot().project.title).toBe("First");
    });

    test("previews and applies a revision-checked agent proposal", () => {
        const store = createEditorStore(createDemoProject(), { storage: null });
        const proposal = createAgentProposal({
            id: "proposal-1",
            project: store.getSnapshot().project,
            title: "Try cobalt",
            summary: "Switch the set and refine the brief.",
            operations: [
                rename("agent-rename", "Cobalt film", "agent"),
                {
                    id: "agent-set",
                    source: "agent",
                    type: "set.select",
                    setId: "cobalt-pavilion",
                },
            ],
        });
        const preview = store.stageProposal(proposal);
        expect(preview.title).toBe("Cobalt film");
        expect(store.getSnapshot().project.title).toBe("Untitled video");
        expect(store.getSnapshot().proposal?.status).toBe("ready");

        store.applyProposal(proposal.id);
        expect(store.getSnapshot().project.title).toBe("Cobalt film");
        expect(store.getSnapshot().project.setId).toBe("cobalt-pavilion");
        expect(store.getSnapshot().project.revision).toBe(1);
        expect(store.getSnapshot().proposal).toBeNull();
    });

    test("a newer manual edit makes a proposal stale instead of overwriting it", () => {
        const store = createEditorStore(createDemoProject(), { storage: null });
        const proposal = createAgentProposal({
            id: "proposal-stale",
            project: store.getSnapshot().project,
            title: "Agent title",
            summary: "Rename the project.",
            operations: [rename("agent-rename", "Agent title", "agent")],
        });
        store.stageProposal(proposal);
        store.dispatch(rename("manual-rename", "My title"));
        expect(store.getSnapshot().proposal?.status).toBe("stale");
        expect(() => store.applyProposal(proposal.id)).toThrow();
        expect(store.getSnapshot().project.title).toBe("My title");
        store.rejectProposal(proposal.id);
        expect(store.getSnapshot().proposal).toBeNull();
    });

    test("restores the newest project and history from its local journal", () => {
        const storage = new MemoryStorage();
        const initial = createDemoProject({ id: "journal-demo" });
        const first = createEditorStore(initial, {
            storage,
            journalKey: "video-journal",
        });
        first.dispatch(rename("rename-1", "Recovered title"));

        const restored = createEditorStore(initial, {
            storage,
            journalKey: "video-journal",
        });
        expect(restored.getSnapshot().project.title).toBe("Recovered title");
        expect(restored.getSnapshot().canUndo).toBe(true);
        restored.undo();
        expect(restored.getSnapshot().project.title).toBe("Untitled video");
    });

    test("undoes a constructed set and appended shot as one batch", () => {
        const store = createEditorStore(createDemoProject(), { storage: null });
        const set = constructProceduralSet({
            id: "custom-runway",
            title: "Custom Runway",
            direction: "A warm pavilion with a reflective runway.",
            template: "pavilion",
            palette: ["#18213b", "#bc754b", "#f0dfbf"],
        });

        store.dispatchBatch(
            [
                {
                    id: "create-custom-runway",
                    source: "user",
                    type: "set.create",
                    set,
                },
                {
                    id: "append-custom-runway-shot",
                    source: "user",
                    type: "shot.add",
                    shot: createDemoShot("shot-2", set.id),
                    afterShotId: "shot-1",
                },
            ],
            { label: "Construct set and shot" }
        );

        expect(store.getSnapshot().project.revision).toBe(1);
        expect(store.getSnapshot().project.sets?.[set.id]).toEqual(set);
        expect(store.getSnapshot().project.orderedShotIds).toEqual([
            "shot-1",
            "shot-2",
        ]);

        store.undo();
        expect(store.getSnapshot().project.revision).toBe(2);
        expect(store.getSnapshot().project.sets?.[set.id]).toBeUndefined();
        expect(store.getSnapshot().project.orderedShotIds).toEqual(["shot-1"]);
        expect(store.getSnapshot().project.shots["shot-2"]).toBeUndefined();
        expect(store.getSnapshot().canUndo).toBe(false);
        expect(store.getSnapshot().canRedo).toBe(true);
    });
});
