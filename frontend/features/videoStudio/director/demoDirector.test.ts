import { DEMO_SET_OPTIONS, createDemoProject } from "../model";
import { createEditorStore } from "../store";
import { createSequenceProposal } from "./demoDirector";

const withoutRevision = <T extends { readonly revision: number }>(value: T) => {
    const { revision: _revision, ...rest } = value;
    return rest;
};

describe("director sequence proposals", () => {
    const selectedSet = DEMO_SET_OPTIONS[1];

    test("assigns the selected set to the opening shot", () => {
        const project = createDemoProject();
        const openingShotId = project.orderedShotIds[0];

        const proposal = createSequenceProposal(
            project,
            selectedSet,
            "A precise product reveal"
        );

        expect(proposal.operations[0]).toMatchObject({
            type: "shot.set.assign",
            source: "agent",
            shotId: openingShotId,
            setId: selectedSet.id,
        });
    });

    test("stages without mutating and applies the whole sequence atomically", () => {
        const store = createEditorStore(createDemoProject(), {
            storage: null,
        });
        const before = store.getSnapshot().project;
        const proposal = createSequenceProposal(
            before,
            selectedSet,
            "A precise product reveal"
        );

        const preview = store.stageProposal(proposal);

        expect(store.getSnapshot().project).toEqual(before);
        expect(store.getSnapshot().project.revision).toBe(before.revision);
        expect(preview.setId).toBe(selectedSet.id);
        expect(preview.shots[before.orderedShotIds[0]].setId).toBe(
            selectedSet.id
        );
        expect(preview.orderedShotIds).toEqual(["shot-1", "shot-2", "shot-3"]);

        const applied = store.applyProposal(proposal.id);

        expect(applied.revision).toBe(before.revision + 1);
        expect(applied.setId).toBe(selectedSet.id);
        expect(applied.orderedShotIds).toEqual(["shot-1", "shot-2", "shot-3"]);
        expect(
            applied.orderedShotIds.map((shotId) => applied.shots[shotId].setId)
        ).toEqual([selectedSet.id, selectedSet.id, selectedSet.id]);
        expect(store.getSnapshot().canUndo).toBe(true);

        const undone = store.undo();

        expect(withoutRevision(undone)).toEqual(withoutRevision(before));
        expect(undone.revision).toBe(applied.revision + 1);
        expect(store.getSnapshot().canUndo).toBe(false);
        expect(store.getSnapshot().canRedo).toBe(true);
    });
});
