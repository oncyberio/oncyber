import { freezeValue } from "../model";
import { fingerprint, type CameraManifestV1 } from "./cameraManifest";

export const SEEDANCE_2_5_MODEL_ID = "seedance_2_5" as const;
export const LEGACY_VIDEO_MODEL_ID = "mock-reference-v1" as const;

export type VideoGenerationMode =
    | "t2v"
    | "omni_reference"
    | "video_edit"
    | "video_extension";
export type VideoAspectRatio =
    | "auto"
    | "21:9"
    | "16:9"
    | "4:3"
    | "1:1"
    | "3:4"
    | "9:16";
/** Pixel aliases remain available while the editor migrates to model-native labels. */
export type VideoResolution =
    | "480p"
    | "720p"
    | "1080p"
    | "1280x720"
    | "1920x1080";
export type VideoBitrateMode = "standard" | "high";
export type VideoMediaKind = "image" | "video" | "audio";
export type VideoMediaRole =
    | "source"
    | "first_frame"
    | "last_frame"
    | "subject"
    | "style"
    | "scene"
    | "motion"
    | "camera"
    | "audio";
export type VideoJobStatus =
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "cancelled";

export interface VideoMediaMetadata {
    readonly mimeType?: string;
    readonly width?: number;
    readonly height?: number;
    readonly durationSeconds?: number;
}

/** A prompt-addressable reference. `id` is suitable for an @mention in the prompt. */
export interface VideoMediaReference {
    readonly id: string;
    readonly uri: string;
    readonly kind: VideoMediaKind;
    readonly role: VideoMediaRole;
    readonly label?: string;
    readonly metadata?: VideoMediaMetadata;
}

export interface VideoProviderCapability {
    readonly providerId: string;
    readonly modelId: string;
    readonly title: string;
    readonly fps: readonly number[];
    readonly modes: readonly VideoGenerationMode[];
    readonly aspectRatios: readonly VideoAspectRatio[];
    readonly resolutions: readonly VideoResolution[];
    readonly bitrateModes: readonly VideoBitrateMode[];
    readonly minDurationSeconds: number;
    readonly maxDurationSeconds: number;
    readonly maxMediaReferences: number;
    readonly inputs: readonly (
        | "prompt"
        | "image-reference"
        | "video-reference"
        | "audio-reference"
        | "guide-video"
        | "first-frame"
        | "camera-manifest"
    )[];
    readonly supportsAudioGeneration: boolean;
    readonly supportsCancel: boolean;
}

export interface VideoGenerationRequest {
    readonly projectId: string;
    readonly projectRevision: number;
    readonly shotId: string;
    readonly modelId: string;
    readonly mode?: VideoGenerationMode;
    readonly durationSeconds?: number;
    readonly aspectRatio?: VideoAspectRatio;
    readonly resolution: VideoResolution;
    readonly generateAudio?: boolean;
    readonly bitrateMode?: VideoBitrateMode;
    readonly prompt: string;
    readonly mediaReferences?: readonly VideoMediaReference[];
    /** Optional rendered Three.js/clay guide. */
    readonly guideUri?: string;
    /** Optional deterministic camera data accompanying a Three.js guide. */
    readonly cameraManifest?: CameraManifestV1;
}

export interface VideoGenerationQuote {
    readonly id: string;
    readonly providerId: string;
    readonly modelId: string;
    readonly requestFingerprint: string;
    readonly mode: VideoGenerationMode;
    readonly durationSeconds: number;
    readonly aspectRatio: VideoAspectRatio;
    readonly resolution: VideoResolution;
    readonly generateAudio: boolean;
    readonly credits: number;
    readonly expiresAt: number;
}

export interface VideoGenerationJob {
    readonly id: string;
    readonly providerId: string;
    readonly modelId: string;
    readonly requestFingerprint: string;
    readonly idempotencyKey: string;
    readonly mode: VideoGenerationMode;
    readonly durationSeconds: number;
    readonly aspectRatio: VideoAspectRatio;
    readonly resolution: VideoResolution;
    readonly generateAudio: boolean;
    readonly bitrateMode: VideoBitrateMode;
    readonly status: VideoJobStatus;
    readonly progress: number;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly output?: {
        readonly uri: string;
        readonly mime: "video/mp4";
    };
    readonly error?: string;
}

export interface VideoProvider {
    capabilities(): Promise<readonly VideoProviderCapability[]>;
    quote(request: VideoGenerationRequest): Promise<VideoGenerationQuote>;
    submit(
        request: VideoGenerationRequest,
        quote: VideoGenerationQuote,
        idempotencyKey: string
    ): Promise<VideoGenerationJob>;
    getJob(id: string): Promise<VideoGenerationJob>;
    cancel(id: string): Promise<VideoGenerationJob>;
}

const MODES: readonly VideoGenerationMode[] = [
    "t2v",
    "omni_reference",
    "video_edit",
    "video_extension",
];
const ASPECT_RATIOS: readonly VideoAspectRatio[] = [
    "auto",
    "21:9",
    "16:9",
    "4:3",
    "1:1",
    "3:4",
    "9:16",
];
const RESOLUTIONS: readonly VideoResolution[] = [
    "480p",
    "720p",
    "1080p",
    "1280x720",
    "1920x1080",
];
const BITRATE_MODES: readonly VideoBitrateMode[] = ["standard", "high"];
const MEDIA_KINDS: readonly VideoMediaKind[] = ["image", "video", "audio"];
const MEDIA_ROLES: readonly VideoMediaRole[] = [
    "source",
    "first_frame",
    "last_frame",
    "subject",
    "style",
    "scene",
    "motion",
    "camera",
    "audio",
];

const CAPABILITY: VideoProviderCapability = freezeValue({
    providerId: "video-lab-mock",
    modelId: SEEDANCE_2_5_MODEL_ID,
    title: "Seedance 2.5 (mock)",
    fps: [30],
    modes: MODES,
    aspectRatios: ASPECT_RATIOS,
    resolutions: RESOLUTIONS,
    bitrateModes: BITRATE_MODES,
    minDurationSeconds: 4,
    maxDurationSeconds: 30,
    maxMediaReferences: 50,
    inputs: [
        "prompt",
        "image-reference",
        "video-reference",
        "audio-reference",
        "guide-video",
        "first-frame",
        "camera-manifest",
    ],
    supportsAudioGeneration: true,
    supportsCancel: true,
});

interface NormalizedVideoGenerationRequest {
    readonly projectId: string;
    readonly projectRevision: number;
    readonly shotId: string;
    readonly modelId: typeof SEEDANCE_2_5_MODEL_ID;
    readonly mode: VideoGenerationMode;
    readonly durationSeconds: number;
    readonly aspectRatio: VideoAspectRatio;
    readonly resolution: VideoResolution;
    readonly generateAudio: boolean;
    readonly bitrateMode: VideoBitrateMode;
    readonly prompt: string;
    readonly mediaReferences: readonly VideoMediaReference[];
    readonly guideUri?: string;
    readonly cameraManifest?: CameraManifestV1;
}

type MutableJob = {
    -readonly [Key in keyof VideoGenerationJob]: VideoGenerationJob[Key];
};

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function assertPositiveInteger(value: number | undefined, field: string): void {
    if (value !== undefined && (!Number.isInteger(value) || value <= 0))
        throw new Error(`${field} must be a positive integer.`);
}

function validateMediaReference(reference: VideoMediaReference): void {
    if (!isNonEmptyString(reference.id) || reference.id.length > 128)
        throw new Error("Each media reference requires a bounded id.");
    if (!isNonEmptyString(reference.uri))
        throw new Error(`Media reference ${reference.id} requires a URI.`);
    if (!MEDIA_KINDS.includes(reference.kind))
        throw new Error(`Media reference ${reference.id} has an invalid kind.`);
    if (!MEDIA_ROLES.includes(reference.role))
        throw new Error(`Media reference ${reference.id} has an invalid role.`);
    if (reference.kind === "audio" && reference.role !== "audio")
        throw new Error(
            `Audio reference ${reference.id} must use the audio role.`
        );
    if (reference.role === "audio" && reference.kind !== "audio")
        throw new Error("The audio role requires an audio reference.");
    if (reference.role === "source" && reference.kind !== "video")
        throw new Error("The source role requires a video reference.");
    if (
        ["motion", "camera"].includes(reference.role) &&
        reference.kind !== "video"
    )
        throw new Error(`${reference.role} references must be videos.`);
    if (
        ["first_frame", "last_frame"].includes(reference.role) &&
        reference.kind === "audio"
    )
        throw new Error(`${reference.role} references cannot be audio.`);
    if (reference.label !== undefined && !isNonEmptyString(reference.label))
        throw new Error(`Media reference ${reference.id} has an empty label.`);
    if (reference.metadata) {
        if (
            reference.metadata.mimeType !== undefined &&
            !isNonEmptyString(reference.metadata.mimeType)
        )
            throw new Error(
                `Media reference ${reference.id} has an empty MIME type.`
            );
        assertPositiveInteger(reference.metadata.width, "Media width");
        assertPositiveInteger(reference.metadata.height, "Media height");
        if (
            reference.metadata.durationSeconds !== undefined &&
            (!Number.isFinite(reference.metadata.durationSeconds) ||
                reference.metadata.durationSeconds <= 0)
        )
            throw new Error("Media duration must be positive.");
    }
}

function normalizeModelId(modelId: string): typeof SEEDANCE_2_5_MODEL_ID {
    if (modelId !== SEEDANCE_2_5_MODEL_ID && modelId !== LEGACY_VIDEO_MODEL_ID)
        throw new Error(`Unsupported model ${modelId}.`);
    return SEEDANCE_2_5_MODEL_ID;
}

function normalizeRequest(
    request: VideoGenerationRequest
): NormalizedVideoGenerationRequest {
    if (!isNonEmptyString(request.projectId))
        throw new Error("A project id is required.");
    if (
        !Number.isInteger(request.projectRevision) ||
        request.projectRevision < 0
    )
        throw new Error("A non-negative project revision is required.");
    if (!isNonEmptyString(request.shotId))
        throw new Error("A shot id is required.");
    const modelId = normalizeModelId(request.modelId);
    if (!RESOLUTIONS.includes(request.resolution))
        throw new Error(`Unsupported resolution ${request.resolution}.`);
    if (!isNonEmptyString(request.prompt) || request.prompt.length > 12_000)
        throw new Error("A bounded prompt is required.");
    if (request.guideUri !== undefined && !isNonEmptyString(request.guideUri))
        throw new Error("The guide URI cannot be empty.");

    const mediaReferences = request.mediaReferences ?? [];
    if (mediaReferences.length > CAPABILITY.maxMediaReferences)
        throw new Error("The request has too many media references.");
    const referenceIds = new Set<string>();
    for (const reference of mediaReferences) {
        validateMediaReference(reference);
        if (referenceIds.has(reference.id))
            throw new Error(`Duplicate media reference id ${reference.id}.`);
        referenceIds.add(reference.id);
    }

    const hasGuidance = Boolean(
        request.cameraManifest || request.guideUri || mediaReferences.length
    );
    const mode = request.mode ?? (hasGuidance ? "omni_reference" : "t2v");
    if (!MODES.includes(mode)) throw new Error(`Unsupported mode ${mode}.`);
    const aspectRatio = request.aspectRatio ?? "16:9";
    if (!ASPECT_RATIOS.includes(aspectRatio))
        throw new Error(`Unsupported aspect ratio ${aspectRatio}.`);
    const bitrateMode = request.bitrateMode ?? "standard";
    if (!BITRATE_MODES.includes(bitrateMode))
        throw new Error(`Unsupported bitrate mode ${bitrateMode}.`);

    let manifestDuration: number | undefined;
    const manifest = request.cameraManifest;
    if (manifest) {
        if (
            manifest.projectId !== request.projectId ||
            manifest.projectRevision !== request.projectRevision ||
            manifest.shotId !== request.shotId
        )
            throw new Error("The camera manifest does not match the request.");
        manifestDuration = manifest.durationTicks / manifest.timebase;
        if (
            manifest.fps !== 30 ||
            !Number.isFinite(manifestDuration) ||
            manifestDuration < CAPABILITY.minDurationSeconds ||
            manifestDuration > CAPABILITY.maxDurationSeconds
        )
            throw new Error("The request is outside the Seedance mock limits.");
        if (
            request.durationSeconds !== undefined &&
            request.durationSeconds !== manifestDuration
        )
            throw new Error(
                "The requested duration does not match the camera guide."
            );
    }

    const durationSeconds = manifestDuration ?? request.durationSeconds;
    if (
        durationSeconds === undefined ||
        !Number.isFinite(durationSeconds) ||
        durationSeconds < CAPABILITY.minDurationSeconds ||
        durationSeconds > CAPABILITY.maxDurationSeconds
    )
        throw new Error("Duration must be from 4 to 30 seconds.");
    if (manifestDuration === undefined && !Number.isInteger(durationSeconds))
        throw new Error(
            "Direct generation duration must be a whole number of seconds."
        );

    if (mode === "t2v" && hasGuidance)
        throw new Error(
            "Text-to-video requests cannot include media guidance."
        );
    if (mode === "omni_reference" && !hasGuidance)
        throw new Error("Omni-reference mode requires at least one reference.");
    if (["video_edit", "video_extension"].includes(mode)) {
        const source = mediaReferences.find(
            (reference) =>
                reference.kind === "video" && reference.role === "source"
        );
        if (!source)
            throw new Error(`${mode} mode requires a source video reference.`);
    }

    return freezeValue({
        projectId: request.projectId.trim(),
        projectRevision: request.projectRevision,
        shotId: request.shotId.trim(),
        modelId,
        mode,
        durationSeconds,
        aspectRatio,
        resolution: request.resolution,
        generateAudio: request.generateAudio ?? true,
        bitrateMode,
        prompt: request.prompt.trim(),
        mediaReferences: mediaReferences.map((reference) => ({ ...reference })),
        ...(request.guideUri ? { guideUri: request.guideUri.trim() } : {}),
        ...(manifest ? { cameraManifest: manifest } : {}),
    });
}

function resolutionFactor(resolution: VideoResolution): number {
    // Mirrors the current Higgsfield Seedance 2.5 per-second estimator for
    // model-native labels. Pixel aliases retain the legacy demo pricing.
    if (resolution === "480p") return 2.5;
    if (resolution === "720p") return 6.5;
    if (resolution === "1080p") return 9;
    if (resolution === "1920x1080") return 2;
    return 1;
}

export class MockVideoProvider implements VideoProvider {
    private readonly quotes = new Map<string, VideoGenerationQuote>();
    private readonly jobs = new Map<string, MutableJob>();
    private readonly idempotency = new Map<
        string,
        { readonly requestFingerprint: string; readonly jobId: string }
    >();

    constructor(
        private readonly now: () => number = Date.now,
        private readonly quoteTtlMs = 5 * 60 * 1000
    ) {}

    async capabilities(): Promise<readonly VideoProviderCapability[]> {
        return [CAPABILITY];
    }

    private validate(request: VideoGenerationRequest): {
        readonly normalized: NormalizedVideoGenerationRequest;
        readonly requestFingerprint: string;
    } {
        const normalized = normalizeRequest(request);
        return {
            normalized,
            requestFingerprint: fingerprint(normalized),
        };
    }

    async quote(
        request: VideoGenerationRequest
    ): Promise<VideoGenerationQuote> {
        const { normalized, requestFingerprint } = this.validate(request);
        const quote = freezeValue({
            id: `quote-${requestFingerprint}-${this.now()}`,
            providerId: CAPABILITY.providerId,
            modelId: normalized.modelId,
            requestFingerprint,
            mode: normalized.mode,
            durationSeconds: normalized.durationSeconds,
            aspectRatio: normalized.aspectRatio,
            resolution: normalized.resolution,
            generateAudio: normalized.generateAudio,
            credits: Math.max(
                1,
                Math.ceil(
                    normalized.durationSeconds *
                        resolutionFactor(normalized.resolution)
                )
            ),
            expiresAt: this.now() + this.quoteTtlMs,
        });
        this.quotes.set(quote.id, quote);
        return quote;
    }

    async submit(
        request: VideoGenerationRequest,
        suppliedQuote: VideoGenerationQuote,
        idempotencyKey: string
    ): Promise<VideoGenerationJob> {
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(idempotencyKey))
            throw new Error("A valid idempotency key is required.");
        const { normalized, requestFingerprint } = this.validate(request);
        const existing = this.idempotency.get(idempotencyKey);
        if (existing) {
            if (existing.requestFingerprint !== requestFingerprint)
                throw new Error(
                    "The idempotency key belongs to another request."
                );
            return this.getJob(existing.jobId);
        }
        const quote = this.quotes.get(suppliedQuote.id);
        if (
            !quote ||
            quote.requestFingerprint !== requestFingerprint ||
            quote.providerId !== suppliedQuote.providerId ||
            quote.modelId !== suppliedQuote.modelId ||
            quote.requestFingerprint !== suppliedQuote.requestFingerprint ||
            quote.mode !== suppliedQuote.mode ||
            quote.durationSeconds !== suppliedQuote.durationSeconds ||
            quote.aspectRatio !== suppliedQuote.aspectRatio ||
            quote.resolution !== suppliedQuote.resolution ||
            quote.generateAudio !== suppliedQuote.generateAudio ||
            quote.credits !== suppliedQuote.credits ||
            quote.expiresAt !== suppliedQuote.expiresAt
        )
            throw new Error("The quote does not match this request.");
        if (quote.expiresAt <= this.now())
            throw new Error("The quote expired.");
        const timestamp = this.now();
        const id = `job-${fingerprint({ idempotencyKey, requestFingerprint })}`;
        const job: MutableJob = {
            id,
            providerId: CAPABILITY.providerId,
            modelId: normalized.modelId,
            requestFingerprint,
            idempotencyKey,
            mode: normalized.mode,
            durationSeconds: normalized.durationSeconds,
            aspectRatio: normalized.aspectRatio,
            resolution: normalized.resolution,
            generateAudio: normalized.generateAudio,
            bitrateMode: normalized.bitrateMode,
            status: "queued",
            progress: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        this.jobs.set(id, job);
        this.idempotency.set(idempotencyKey, { requestFingerprint, jobId: id });
        return freezeValue({ ...job });
    }

    async getJob(id: string): Promise<VideoGenerationJob> {
        const job = this.jobs.get(id);
        if (!job) throw new Error(`Job ${id} was not found.`);
        return freezeValue({ ...job });
    }

    async cancel(id: string): Promise<VideoGenerationJob> {
        const job = this.jobs.get(id);
        if (!job) throw new Error(`Job ${id} was not found.`);
        if (["succeeded", "failed", "cancelled"].includes(job.status))
            return freezeValue({ ...job });
        job.status = "cancelled";
        job.updatedAt = this.now();
        return freezeValue({ ...job });
    }

    /** Deterministic test/demo control; production adapters advance from webhooks. */
    async advanceJob(
        id: string,
        progress: number,
        failure?: string
    ): Promise<VideoGenerationJob> {
        const job = this.jobs.get(id);
        if (!job) throw new Error(`Job ${id} was not found.`);
        if (["succeeded", "failed", "cancelled"].includes(job.status))
            return freezeValue({ ...job });
        job.updatedAt = this.now();
        if (failure) {
            job.status = "failed";
            job.progress = Math.max(0, Math.min(1, progress));
            job.error = failure;
        } else if (progress >= 1) {
            job.status = "succeeded";
            job.progress = 1;
            job.output = {
                uri: `mock://video/${job.id}.mp4`,
                mime: "video/mp4",
            };
        } else {
            job.status = "running";
            job.progress = Math.max(0, progress);
        }
        return freezeValue({ ...job });
    }
}
