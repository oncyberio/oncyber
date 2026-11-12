export const VIDEO_PROJECT_VERSION = 1 as const;
export const VIDEO_FPS = 30 as const;
export const VIDEO_TIMEBASE = 30_000 as const;
export const VIDEO_TICKS_PER_FRAME = VIDEO_TIMEBASE / VIDEO_FPS;

export type Vec3 = readonly [number, number, number];

export interface Transform3D {
    readonly position: Vec3;
    readonly rotationDeg: Vec3;
    readonly scale: Vec3;
}

export type PrimitiveKind = "box" | "plane" | "cylinder" | "sphere";

export interface ProceduralSetNode {
    readonly id: string;
    readonly name: string;
    readonly primitive: PrimitiveKind;
    readonly transform: Transform3D;
    readonly size: Vec3;
    readonly material: {
        readonly color: string;
        readonly roughness: number;
        readonly metalness: number;
    };
}

/** A renderer-neutral catalog card. Its nodes can be realized by a Three.js adapter. */
export interface SetOption {
    readonly id: string;
    readonly title: string;
    readonly subtitle: string;
    readonly tags: readonly string[];
    readonly palette: readonly string[];
    readonly nodes: readonly ProceduralSetNode[];
}

export interface CameraSpline {
    readonly interpolation: "catmull-rom-chordal";
    readonly points: readonly Vec3[];
}

export interface ShotCamera {
    readonly position: CameraSpline;
    readonly target: CameraSpline;
    readonly focalLengthMm: number;
    readonly rollDeg: number;
}

export interface VideoShot {
    readonly id: string;
    readonly name: string;
    /** Falls back to the legacy project set when reading older journals. */
    readonly setId?: string;
    /** Integer project ticks. VIDEO_TIMEBASE ticks equal one second. */
    readonly durationTicks: number;
    readonly camera: ShotCamera;
    readonly prompt: string;
}

export interface ArtworkSource {
    readonly kind: "image" | "nft";
    readonly uri: string;
    readonly nft?: {
        readonly chain: string;
        readonly contract: string;
        readonly tokenId: string;
    };
}

export interface VideoArtwork {
    readonly id: string;
    readonly name: string;
    /** Art belongs to one set, while legacy art falls back to project.setId. */
    readonly setId?: string;
    readonly source: ArtworkSource;
    readonly transform: Transform3D;
    readonly protection: "generative" | "identity" | "exact";
    readonly visible: boolean;
}

export interface VideoProjectV1 {
    readonly schemaVersion: typeof VIDEO_PROJECT_VERSION;
    readonly id: string;
    readonly revision: number;
    readonly title: string;
    readonly fps: typeof VIDEO_FPS;
    readonly timebase: typeof VIDEO_TIMEBASE;
    /** Legacy/default set for older shots and newly imported content. */
    readonly setId: string;
    /** Project-local procedural sets created in Video Studio. */
    readonly sets?: Readonly<Record<string, SetOption>>;
    readonly orderedShotIds: readonly string[];
    readonly shots: Readonly<Record<string, VideoShot>>;
    readonly activeShotId: string;
    readonly artworks: Readonly<Record<string, VideoArtwork>>;
}

export type OperationSource = "user" | "agent" | "system";

interface OperationMeta {
    readonly id: string;
    readonly source: OperationSource;
}

export type VideoOperation =
    | (OperationMeta & {
          readonly type: "project.rename";
          readonly title: string;
      })
    | (OperationMeta & {
          readonly type: "set.select";
          readonly setId: string;
      })
    | (OperationMeta & {
          readonly type: "set.create";
          readonly set: SetOption;
      })
    | (OperationMeta & {
          readonly type: "shot.set.assign";
          readonly shotId: string;
          readonly setId: string;
      })
    | (OperationMeta & {
          readonly type: "shot.add";
          readonly shot: VideoShot;
          readonly afterShotId?: string;
      })
    | (OperationMeta & {
          readonly type: "shot.remove";
          readonly shotId: string;
      })
    | (OperationMeta & {
          readonly type: "shot.activate";
          readonly shotId: string;
      })
    | (OperationMeta & {
          readonly type: "shot.rename";
          readonly shotId: string;
          readonly name: string;
      })
    | (OperationMeta & {
          readonly type: "shot.prompt.set";
          readonly shotId: string;
          readonly prompt: string;
      })
    | (OperationMeta & {
          readonly type: "shot.duration.set";
          readonly shotId: string;
          readonly durationTicks: number;
      })
    | (OperationMeta & {
          readonly type: "camera.point.insert";
          readonly shotId: string;
          readonly spline: "position" | "target";
          readonly index: number;
          readonly point: Vec3;
      })
    | (OperationMeta & {
          readonly type: "camera.point.move";
          readonly shotId: string;
          readonly spline: "position" | "target";
          readonly index: number;
          readonly point: Vec3;
      })
    | (OperationMeta & {
          readonly type: "camera.point.remove";
          readonly shotId: string;
          readonly spline: "position" | "target";
          readonly index: number;
      })
    | (OperationMeta & {
          readonly type: "camera.spline.replace";
          readonly shotId: string;
          readonly spline: "position" | "target";
          readonly points: readonly Vec3[];
      })
    | (OperationMeta & {
          readonly type: "camera.lens.set";
          readonly shotId: string;
          readonly focalLengthMm: number;
          readonly rollDeg?: number;
      })
    | (OperationMeta & {
          readonly type: "artwork.add";
          readonly artwork: VideoArtwork;
      })
    | (OperationMeta & {
          readonly type: "artwork.transform.set";
          readonly artworkId: string;
          readonly transform: Transform3D;
      })
    | (OperationMeta & {
          readonly type: "artwork.protection.set";
          readonly artworkId: string;
          readonly protection: VideoArtwork["protection"];
      })
    | (OperationMeta & {
          readonly type: "artwork.visibility.set";
          readonly artworkId: string;
          readonly visible: boolean;
      })
    | (OperationMeta & {
          readonly type: "artwork.remove";
          readonly artworkId: string;
      });

export interface AgentProposalV1 {
    readonly schemaVersion: 1;
    readonly id: string;
    readonly projectId: string;
    readonly baseRevision: number;
    readonly title: string;
    readonly summary: string;
    readonly operations: readonly VideoOperation[];
}
