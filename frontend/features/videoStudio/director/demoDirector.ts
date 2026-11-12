import {
    createDemoShot,
    type SetOption,
    type VideoOperation,
    type VideoProjectV1,
    type VideoShot,
} from "../model";
import { createAgentProposal } from "../store";

const id = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;

function shotVariant(
    shotId: string,
    setId: string,
    name: string,
    prompt: string,
    position: VideoShot["camera"]["position"]["points"],
    target: VideoShot["camera"]["target"]["points"],
    focalLengthMm: number,
    seconds: number
): VideoShot {
    const base = createDemoShot(shotId, setId);
    return {
        ...base,
        name,
        prompt,
        durationTicks: seconds * 30_000,
        camera: {
            ...base.camera,
            position: { ...base.camera.position, points: position },
            target: { ...base.camera.target, points: target },
            focalLengthMm,
        },
    };
}

export function createSequenceProposal(
    project: VideoProjectV1,
    set: SetOption,
    brief: string
) {
    const operations: VideoOperation[] = [];
    const opening = project.shots[project.orderedShotIds[0]];
    operations.push({
        type: "shot.set.assign",
        id: id("set"),
        source: "agent",
        shotId: opening.id,
        setId: set.id,
    });
    operations.push({
        type: "shot.rename",
        id: id("rename"),
        source: "agent",
        shotId: opening.id,
        name: "01 · Establish",
    });
    operations.push({
        type: "shot.prompt.set",
        id: id("prompt"),
        source: "agent",
        shotId: opening.id,
        prompt: `${
            brief || "Architectural film"
        }. A controlled establishing move through ${set.title}.`,
    });

    if (!project.shots["shot-2"]) {
        operations.push({
            type: "shot.add",
            id: id("shot"),
            source: "agent",
            afterShotId: opening.id,
            shot: shotVariant(
                "shot-2",
                set.id,
                "02 · Orbit",
                `Orbit the hero artwork while preserving the geometry of ${set.title}.`,
                [
                    [5.8, 2.5, 1.8],
                    [3.5, 2.2, -2.8],
                    [-1, 2.1, -4.8],
                    [-4.7, 2.4, -1.2],
                ],
                [
                    [0, 1.7, -0.6],
                    [0, 1.65, -0.8],
                    [-0.2, 1.6, -1],
                    [-0.4, 1.55, -1.1],
                ],
                48,
                4
            ),
        });
    }
    if (!project.shots["shot-3"]) {
        operations.push({
            type: "shot.add",
            id: id("shot"),
            source: "agent",
            afterShotId: "shot-2",
            shot: shotVariant(
                "shot-3",
                set.id,
                "03 · Detail",
                "A patient final push-in. Keep the artwork source exact and the environment cinematic.",
                [
                    [-1.2, 2, 5.6],
                    [-0.8, 1.9, 3.2],
                    [-0.45, 1.8, 1.1],
                    [-0.25, 1.75, -0.3],
                ],
                [
                    [0, 1.65, -2.4],
                    [0, 1.65, -2.5],
                    [0, 1.65, -2.55],
                    [0, 1.65, -2.6],
                ],
                65,
                3
            ),
        });
    }
    return createAgentProposal({
        id: id("proposal"),
        project,
        title: "Build a three-shot sequence",
        summary:
            "Establish the set, orbit the hero artwork, then finish on a controlled detail shot. Your manual edits remain separate and undoable.",
        operations,
    });
}

export function createRefineProposal(
    project: VideoProjectV1,
    instruction: string
) {
    const shot = project.shots[project.activeShotId];
    const compact = instruction.trim().slice(0, 240);
    const current = shot.camera.position.points;
    const eased = current.map((point, index) => {
        if (index === 0 || index === current.length - 1) return point;
        const amount = index / (current.length - 1);
        return [
            point[0] * (1 - amount * 0.08),
            point[1] + Math.sin(amount * Math.PI) * 0.22,
            point[2],
        ] as const;
    });
    return createAgentProposal({
        id: id("proposal"),
        project,
        title: "Refine selected shot",
        summary: compact || "Smooth the move while preserving manual content.",
        operations: [
            {
                type: "camera.spline.replace",
                id: id("camera"),
                source: "agent",
                shotId: shot.id,
                spline: "position",
                points: eased,
            },
            {
                type: "shot.prompt.set",
                id: id("prompt"),
                source: "agent",
                shotId: shot.id,
                prompt: compact
                    ? `${shot.prompt} Direction: ${compact}`
                    : shot.prompt,
            },
        ],
    });
}
