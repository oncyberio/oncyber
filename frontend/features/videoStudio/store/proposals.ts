import {
    applyOperations,
    immutableCopy,
    VideoModelError,
    VideoRevisionConflict,
    type AgentProposalV1,
    type SetOption,
    type VideoOperation,
    type VideoProjectV1,
} from "../model";

export class VideoProposalConflict extends VideoModelError {
    constructor(message: string) {
        super("VIDEO_PROPOSAL_CONFLICT", message);
        this.name = "VideoProposalConflict";
    }
}

export function createAgentProposal(input: {
    readonly id: string;
    readonly project: VideoProjectV1;
    readonly title: string;
    readonly summary: string;
    readonly operations: readonly VideoOperation[];
}): AgentProposalV1 {
    if (!input.id || input.id.length > 128)
        throw new VideoModelError(
            "INVALID_PROPOSAL",
            "A proposal needs a bounded id."
        );
    if (!input.operations.length)
        throw new VideoModelError(
            "INVALID_PROPOSAL",
            "A proposal needs at least one operation."
        );
    if (input.operations.some((operation) => operation.source !== "agent"))
        throw new VideoModelError(
            "INVALID_PROPOSAL",
            "Every proposed operation must identify the agent as its source."
        );
    return immutableCopy({
        schemaVersion: 1,
        id: input.id,
        projectId: input.project.id,
        baseRevision: input.project.revision,
        title: input.title,
        summary: input.summary,
        operations: input.operations,
    });
}

export function previewAgentProposal(
    project: VideoProjectV1,
    proposal: AgentProposalV1,
    catalog?: readonly SetOption[]
): VideoProjectV1 {
    if (proposal.schemaVersion !== 1 || proposal.projectId !== project.id)
        throw new VideoProposalConflict(
            "The proposal belongs to a different video project."
        );
    if (proposal.baseRevision !== project.revision)
        throw new VideoRevisionConflict(
            proposal.baseRevision,
            project.revision
        );
    if (!proposal.operations.length)
        throw new VideoProposalConflict("The proposal has no operations.");
    return applyOperations(project, proposal.operations, {
        expectedRevision: proposal.baseRevision,
        catalog,
    });
}

export const applyAgentProposal = previewAgentProposal;
