import { MathUtils } from "three";
import type { SetOption, VideoArtwork, VideoShot } from "../model/types";
import type {
    Vec3,
    VideoEngineArtwork,
    VideoEngineShot,
    VideoSetDefinition,
    VideoSetNode,
} from "./createVideoEngine";

const SET_ATMOSPHERE: Record<string, VideoSetDefinition["palette"]> = {
    "white-cube": {
        sky: "#242524",
        fog: "#242524",
        light: "#fff8e8",
        lightIntensity: 4.3,
    },
    "cobalt-pavilion": {
        sky: "#071124",
        fog: "#071124",
        light: "#d9e3ff",
        lightIntensity: 5.2,
    },
    "sunset-monoliths": {
        sky: "#542e49",
        fog: "#542e49",
        light: "#ffd2a5",
        lightIntensity: 6.2,
    },
};

function radians(rotationDeg: readonly number[]): Vec3 {
    return rotationDeg.map((value) => MathUtils.degToRad(value)) as Vec3;
}

function nodeToEngine(node: SetOption["nodes"][number]): VideoSetNode {
    const size = [...node.size];
    if (node.primitive === "cylinder") {
        size.splice(
            0,
            size.length,
            node.size[0] / 2,
            node.size[0] / 2,
            node.size[1]
        );
    } else if (node.primitive === "sphere") {
        size.splice(0, size.length, node.size[0] / 2);
    }
    return {
        id: node.id,
        kind: node.primitive,
        size,
        position: [...node.transform.position] as Vec3,
        rotation: radians(node.transform.rotationDeg),
        color: node.material.color,
        roughness: node.material.roughness,
        metalness: node.material.metalness,
    };
}

export function setOptionToEngine(option: SetOption): VideoSetDefinition {
    return {
        id: option.id,
        palette: SET_ATMOSPHERE[option.id] || {
            sky: option.palette[1] || "#151515",
            fog: option.palette[1] || "#151515",
            light: option.palette[2] || "#fff5e2",
            lightIntensity: 5,
        },
        nodes: option.nodes.map(nodeToEngine),
    };
}

export function shotToEngine(shot: VideoShot): VideoEngineShot {
    return {
        id: shot.id,
        camera: {
            position: {
                points: shot.camera.position.points.map(
                    (point) => [...point] as Vec3
                ),
            },
            target: {
                points: shot.camera.target.points.map(
                    (point) => [...point] as Vec3
                ),
            },
            focalLengthMm: shot.camera.focalLengthMm,
            rollDeg: shot.camera.rollDeg,
        },
    };
}

export function artworkToEngine(artwork: VideoArtwork): VideoEngineArtwork {
    const imageUrl = /^(?:https?:|data:|blob:|\/)/.test(artwork.source.uri)
        ? artwork.source.uri
        : undefined;
    return {
        id: artwork.id,
        title: artwork.name,
        position: [...artwork.transform.position] as Vec3,
        rotation: radians(artwork.transform.rotationDeg),
        width: 2.1 * artwork.transform.scale[0],
        height: 2.65 * artwork.transform.scale[1],
        protection: artwork.protection,
        accent: artwork.source.kind === "nft" ? "#5b3cff" : "#cc5d38",
        imageUrl,
    };
}
