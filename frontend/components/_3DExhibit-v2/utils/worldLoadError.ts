import {
    WORLD_ERROR_COPY,
    WorldErrorDetails,
    WorldErrorKind,
} from "./constants";

/**
 * The step of a classic world load that was running when it failed
 * (`displyUI/Scene3D.tsx`). The step decides the kind when the error itself
 * says nothing more specific.
 */
export type WorldLoadStage =
    | "engine"
    | "starting"
    | "destination"
    | "cinematic"
    | "avatar"
    | "world-model"
    | "scene";

/** A failure tagged with the step it happened in; `cause` is what was thrown. */
export class WorldLoadStageError extends Error {
    constructor(readonly stage: WorldLoadStage, readonly cause: unknown) {
        super(readableMessage(cause));
        this.name = "WorldLoadStageError";
    }
}

/** Runs one step, tagging whatever it throws with that step. */
export async function atStage<T>(
    stage: WorldLoadStage,
    run: () => Promise<T>
): Promise<T> {
    try {
        return await run();
    } catch (error) {
        throw error instanceof WorldLoadStageError
            ? error
            : new WorldLoadStageError(stage, error);
    }
}

/**
 * What each engine error code (`ERROR_CODES` in three/constants.js, by name)
 * means for a visitor. A code that is not listed falls back to its step.
 */
export const WORLD_ERROR_CODE_KINDS: Record<string, WorldErrorKind> = {
    INVALID_MODEL: "world-model",
    INVALID_TRANSFORM: "world-model",
    INVALID_JSON_CINEMATIC: "load-failed",
    INVALID_VRM_COUNT_MESH: "avatar",
    INVALID_VRM_BONES: "avatar",
    INVALID_VRM_FILE: "avatar",
    VRM_GENERAL_ERROR: "avatar",
    VRM_MESHES_OVERCOUNT_ERROR: "avatar",
};

const STAGE_KINDS: Record<WorldLoadStage, WorldErrorKind> = {
    engine: "graphics",
    starting: "load-failed",
    destination: "destination-unavailable",
    cinematic: "load-failed",
    avatar: "avatar",
    "world-model": "world-model",
    scene: "load-failed",
};

export type WorldLoadContext = {
    /** The step running when it failed, if the error is not tagged. */
    stage?: WorldLoadStage;
    /** `navigator.onLine`; false means the visitor is offline. */
    online?: boolean;
    /** `ERROR_CODES` from three/constants.js: code names to numbers. */
    codes?: Record<string, number>;
};

function readableMessage(error: any): string {
    if (typeof error === "string") return error;
    if (typeof error?.message === "string") return error.message;
    if (typeof error?.value?.message === "string") return error.value.message;
    return "";
}

/**
 * The thrown value and what it wraps (`cause`), outermost first. Engine code
 * rethrows with a step-specific message and keeps the original as `cause`
 * (loader.js: "Failed to parse glft file of the room"), and the original
 * says more about what went wrong.
 */
function causeChain(error: any): any[] {
    const chain = [error];
    let link = error;
    while (chain.length < 4 && link?.cause != null && link.cause !== link) {
        link = link.cause;
        chain.push(link);
    }
    return chain;
}

/** The kind for one thrown value, by code and type before message text. */
export function worldErrorKind(
    thrown: unknown,
    context: WorldLoadContext = {}
): WorldErrorKind {
    let stage = context.stage;
    let error: any = thrown;
    if (error instanceof WorldLoadStageError) {
        stage = error.stage;
        error = error.cause;
    }
    const chain = causeChain(error);
    for (const link of chain) {
        if (link?.kind && link.kind in WORLD_ERROR_COPY) return link.kind;
        const codeName =
            link?.code !== undefined &&
            Object.keys(context.codes || {}).find(
                (name) => context.codes[name] === link.code
            );
        if (codeName && WORLD_ERROR_CODE_KINDS[codeName])
            return WORLD_ERROR_CODE_KINDS[codeName];
    }
    if (context.online === false) return "connection";
    for (const link of chain) {
        const name = typeof link?.name === "string" ? link.name : "";
        const message = readableMessage(link);
        // Browsers name these failures only in their message text.
        if (
            (name === "RangeError" &&
                /memory|allocation|array buffer/i.test(message)) ||
            /out[ _]of[ _]memory/i.test(message)
        )
            return "memory";
        if (
            name === "NetworkError" ||
            (name === "TypeError" &&
                /failed to fetch|networkerror|load failed|network request/i.test(
                    message
                ))
        )
            return "connection";
        if (/webgpu|webgl|device lost|context lost/i.test(message))
            return "graphics";
    }
    return (stage && STAGE_KINDS[stage]) || "load-failed";
}

/** Drops query strings and fragments, where tokens travel in URLs. */
const withoutQueries = (text: string) =>
    text.replace(/(\bhttps?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/gi, "$1");

/** The technical text behind "Show details", safe to copy and send. */
export function worldErrorDetails(
    thrown: unknown,
    context: WorldLoadContext & {
        address?: string;
        graphics?: string;
        now?: Date;
        browser?: string;
    } = {}
): WorldErrorDetails {
    let stage = context.stage;
    let error: any = thrown;
    if (error instanceof WorldLoadStageError) {
        stage = error.stage;
        error = error.cause;
    }
    const name =
        typeof error?.name === "string" && error.name
            ? error.name
            : typeof error === "string"
            ? "Message"
            : "Error";
    const code =
        error?.code === undefined || error?.code === null
            ? undefined
            : String(error.code).slice(0, 40);
    const location =
        typeof window === "undefined" ? undefined : window.location;
    return {
        name: name.slice(0, 80),
        message:
            withoutQueries(
                causeChain(error)
                    .map(readableMessage)
                    .filter(Boolean)
                    .join(" ← ")
            ).slice(0, 500) || "No message",
        ...(code ? { code } : {}),
        ...(stage ? { step: stage } : {}),
        address: withoutQueries(
            context.address ??
                (location ? location.origin + location.pathname : "")
        ),
        time: (context.now || new Date()).toISOString(),
        browser: (
            context.browser ??
            (typeof navigator === "undefined" ? "" : navigator.userAgent)
        ).slice(0, 300),
        ...(context.graphics ? { graphics: context.graphics } : {}),
    };
}

/** The details as plain lines, the way the copy button copies them. */
export function formatWorldErrorDetails(details: WorldErrorDetails) {
    return [
        ["Error", `${details.name}: ${details.message}`],
        ["Code", details.code],
        ["Step", details.step],
        ["World", details.address],
        ["Time", details.time],
        ["Browser", details.browser],
        ["Graphics", details.graphics],
    ]
        .filter(([, value]) => value)
        .map(([label, value]) => `${label}: ${value}`)
        .join("\n");
}

/** Title, sentence, kind and details for a failed load, in one call. */
export function describeWorldLoadError(
    thrown: unknown,
    context: Parameters<typeof worldErrorDetails>[1] = {}
) {
    const kind = worldErrorKind(thrown, context);
    return {
        kind,
        ...WORLD_ERROR_COPY[kind],
        details: worldErrorDetails(thrown, context),
    };
}
