import {
    applyOperations,
    immutableCopy,
    parseVideoProject,
    projectWithRevision,
    VideoRevisionConflict,
    type AgentProposalV1,
    type SetOption,
    type VideoOperation,
    type VideoProjectV1,
} from "../model";
import {
    browserLocalStorage,
    readVideoJournal,
    removeVideoJournal,
    writeVideoJournal,
    type EditorHistoryEntry,
    type StorageLike,
    type VideoJournalV1,
} from "./journal";
import {
    applyAgentProposal,
    previewAgentProposal,
    VideoProposalConflict,
} from "./proposals";

export interface EditorProposalState {
    readonly proposal: AgentProposalV1;
    readonly status: "ready" | "stale";
    readonly previewProject?: VideoProjectV1;
}

export interface VideoEditorSnapshot {
    readonly project: VideoProjectV1;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly proposal: EditorProposalState | null;
    readonly journalError: string | null;
}

export interface CreateEditorStoreOptions {
    readonly storage?: StorageLike | null;
    readonly journalKey?: string;
    readonly restoreJournal?: boolean;
    readonly catalog?: readonly SetOption[];
    readonly maxHistory?: number;
}

export interface DispatchOptions {
    readonly expectedRevision?: number;
    readonly label?: string;
}

export interface VideoEditorStore {
    getSnapshot(): VideoEditorSnapshot;
    getServerSnapshot(): VideoEditorSnapshot;
    subscribe(listener: () => void): () => void;
    dispatch(
        operation: VideoOperation,
        options?: DispatchOptions
    ): VideoProjectV1;
    dispatchBatch(
        operations: readonly VideoOperation[],
        options?: DispatchOptions
    ): VideoProjectV1;
    undo(expectedRevision?: number): VideoProjectV1;
    redo(expectedRevision?: number): VideoProjectV1;
    stageProposal(proposal: AgentProposalV1): VideoProjectV1;
    applyProposal(
        proposalId: string,
        expectedRevision?: number
    ): VideoProjectV1;
    rejectProposal(proposalId: string): void;
    clearJournal(): void;
}

function historyCopy(entry: EditorHistoryEntry): EditorHistoryEntry {
    return immutableCopy(entry);
}

export function createEditorStore(
    initial: VideoProjectV1,
    options: CreateEditorStoreOptions = {}
): VideoEditorStore {
    const validatedInitial = parseVideoProject(initial);
    const storage =
        options.storage === undefined ? browserLocalStorage() : options.storage;
    const journalKey =
        options.journalKey ?? `oncyber-video:${validatedInitial.id}`;
    const saved =
        options.restoreJournal === false
            ? null
            : readVideoJournal(storage, journalKey);
    const useSaved =
        saved?.project.id === validatedInitial.id &&
        saved.project.revision >= validatedInitial.revision;
    let project = useSaved ? saved.project : validatedInitial;
    let undoStack = useSaved
        ? saved.undo.map(historyCopy)
        : ([] as EditorHistoryEntry[]);
    let redoStack = useSaved
        ? saved.redo.map(historyCopy)
        : ([] as EditorHistoryEntry[]);
    let proposal: AgentProposalV1 | null = null;
    let journalError: string | null = null;
    const listeners = new Set<() => void>();
    const maxHistory = Math.max(1, Math.min(options.maxHistory ?? 80, 200));
    let snapshot: VideoEditorSnapshot;

    function proposalState(): EditorProposalState | null {
        if (!proposal) return null;
        try {
            return immutableCopy({
                proposal,
                status: "ready" as const,
                previewProject: previewAgentProposal(
                    project,
                    proposal,
                    options.catalog
                ),
            });
        } catch {
            return immutableCopy({ proposal, status: "stale" as const });
        }
    }

    function rebuildSnapshot() {
        snapshot = immutableCopy({
            project,
            canUndo: undoStack.length > 0,
            canRedo: redoStack.length > 0,
            proposal: proposalState(),
            journalError,
        });
    }

    function notify() {
        rebuildSnapshot();
        listeners.forEach((listener) => listener());
    }

    function persist() {
        const journal: VideoJournalV1 = {
            schemaVersion: 1,
            project,
            undo: undoStack,
            redo: redoStack,
        };
        journalError = writeVideoJournal(storage, journalKey, journal);
    }

    function commit(
        next: VideoProjectV1,
        label: string,
        operationIds: readonly string[]
    ) {
        undoStack.push(
            immutableCopy({ before: project, after: next, label, operationIds })
        );
        if (undoStack.length > maxHistory)
            undoStack = undoStack.slice(-maxHistory);
        redoStack = [];
        project = next;
        persist();
        notify();
        return project;
    }

    function expectRevision(expected = project.revision) {
        if (expected !== project.revision) {
            throw new VideoRevisionConflict(expected, project.revision);
        }
    }

    function dispatchBatch(
        operations: readonly VideoOperation[],
        dispatchOptions: DispatchOptions = {}
    ) {
        const expected = dispatchOptions.expectedRevision ?? project.revision;
        const next = applyOperations(project, operations, {
            expectedRevision: expected,
            catalog: options.catalog,
        });
        return commit(
            next,
            dispatchOptions.label ??
                (operations.length === 1
                    ? operations[0].type
                    : `${operations.length} changes`),
            operations.map((operation) => operation.id)
        );
    }

    rebuildSnapshot();
    return {
        getSnapshot: () => snapshot,
        getServerSnapshot: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispatch(operation, dispatchOptions = {}) {
            return dispatchBatch([operation], dispatchOptions);
        },
        dispatchBatch,
        undo(expectedRevision = project.revision) {
            expectRevision(expectedRevision);
            const entry = undoStack.pop();
            if (!entry)
                throw new VideoProposalConflict("There is nothing to undo.");
            redoStack.push(entry);
            project = projectWithRevision(entry.before, project.revision + 1);
            persist();
            notify();
            return project;
        },
        redo(expectedRevision = project.revision) {
            expectRevision(expectedRevision);
            const entry = redoStack.pop();
            if (!entry)
                throw new VideoProposalConflict("There is nothing to redo.");
            undoStack.push(entry);
            project = projectWithRevision(entry.after, project.revision + 1);
            persist();
            notify();
            return project;
        },
        stageProposal(nextProposal) {
            const preview = previewAgentProposal(
                project,
                nextProposal,
                options.catalog
            );
            proposal = immutableCopy(nextProposal);
            notify();
            return preview;
        },
        applyProposal(proposalId, expectedRevision = project.revision) {
            expectRevision(expectedRevision);
            if (!proposal || proposal.id !== proposalId)
                throw new VideoProposalConflict(
                    `Proposal ${proposalId} is not staged.`
                );
            const applying = proposal;
            const next = applyAgentProposal(project, applying, options.catalog);
            proposal = null;
            return commit(
                next,
                applying.title,
                applying.operations.map((operation) => operation.id)
            );
        },
        rejectProposal(proposalId) {
            if (!proposal || proposal.id !== proposalId)
                throw new VideoProposalConflict(
                    `Proposal ${proposalId} is not staged.`
                );
            proposal = null;
            notify();
        },
        clearJournal() {
            journalError = removeVideoJournal(storage, journalKey);
            notify();
        },
    };
}

export const selectEditorProject = (snapshot: VideoEditorSnapshot) =>
    snapshot.project;
export const selectProposalPreview = (snapshot: VideoEditorSnapshot) =>
    snapshot.proposal?.previewProject;
