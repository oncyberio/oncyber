interface Metadata {
    lobbyGroupCohort?: string;
    spaceId: string;
    exhibitId: string;
}

interface JoinParams {
    lobbyGroupCohort?: string;
    label: string;
    username: string;
    avatar: string;
    userId: string;
    token: string;
    currentSpace: string;
    position: { x: number; y: number; z: number };
    rotationY: number;
    VRM: string;
    /** World access proof for a password-gated world (identity/worldAccess.ts). */
    accessProof?: string;
}
