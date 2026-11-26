/**
 * Keeps a world on the script its space has saved, while it is open
 * (./livePickup.ts has the rules). Listens to the space's feed for the
 * notice a save sends, reads the saved script, and lands it in the running
 * world. The page is not reloaded and the visitor is not moved, unless
 * whoever saved asked for the round to start again.
 */
import { liveSpace } from "@utils/liveSpace";
import WorldScriptsApi from "@api/worldScripts/_api";
import { cleanStyle, type WorldStyle } from "./style";
import { pickup, readScriptEvent, type Landing } from "./livePickup";
import type { WorldScriptRuntime } from "./runtime";

export interface LiveScriptDeps {
    /** The space's feed: the newest event, and each one after it. */
    watch(spaceId: string, onEvent: (event: unknown) => void): () => void;
    /** The script the space runs now (`worldScripts.current`). */
    read(spaceId: string): Promise<any>;
    now(): number;
    /** A breath between two reads, so a busy feed cannot ask without end. */
    pause(): Promise<void>;
}

/** At most this often is the saved script read, however many notices come. */
const READ_GAP_MS = 1500;

const live: LiveScriptDeps = {
    watch: (spaceId, onEvent) => liveSpace().watchEvents(spaceId, onEvent),
    read: (spaceId) =>
        (WorldScriptsApi as any).current({ experienceId: spaceId }),
    now: () => Date.now(),
    pause: () => new Promise((resolve) => setTimeout(resolve, READ_GAP_MS)),
};

export interface Landed {
    source: string;
    style: WorldStyle | null;
    savedAt: number;
    /** How it landed: "kept" the game, started "fresh", or "stopped". */
    as: "kept" | "fresh" | "stopped" | "restyled";
}

/**
 * Follows the space's saved script from what the world started with.
 * `onLanded` hears of each save that landed, for whoever shows the script
 * (the store, the sidebar). Returns what stops it.
 *
 * `current` is the source running right now, when others run scripts here
 * too: an editor's sidebar has usually started what it then saves, and
 * that save must not start it a second time.
 */
export function followSavedScript(
    spaceId: string,
    started: { source: string; style: WorldStyle | null; savedAt: number },
    runtime: Pick<WorldScriptRuntime, "run" | "stop" | "setStyle">,
    onLanded: (landed: Landed) => void = () => {},
    deps: LiveScriptDeps = live,
    current?: () => string
) {
    let source = started.source;
    let savedAt = started.savedAt;
    let style = JSON.stringify(started.style || null);
    let stopped = false;
    // One read at a time. Notices that come meanwhile are one more read,
    // which brings the newest save whatever came between.
    let busy = false;
    let again = false;
    /** A notice since the last landing asked for the round to start again. */
    let rewind = false;
    /** How the script now running landed, for a rewind that is heard late. */
    let landedAs: Landed["as"] | null = null;

    async function land() {
        const answer = await deps.read(spaceId).catch((): null => null);
        // Not read: what was asked for still stands for the next try.
        if (stopped || !answer?.ok) return;
        // Asked for by any notice up to now: the read brought the newest
        // save, which may be several saves on.
        const asked = rewind;
        rewind = false;
        const read = typeof answer.source === "string" ? answer.source : "";
        const next = cleanStyle(answer.style);
        const restyled = !!next && JSON.stringify(next) !== style;
        const at = Number(answer.savedAt) || 0;
        const plan = pickup(
            current ? current() : source,
            { source: read, restyled },
            asked ? "rewind" : "add"
        );
        if (plan.do === "nothing") {
            savedAt = at;
            return;
        }
        const landed = (as: Landed["as"]) => {
            source = read;
            savedAt = at;
            landedAs = as;
            if (next) style = JSON.stringify(next);
            onLanded({ source: read, style: next, savedAt: at, as });
        };
        if (plan.do === "stop") {
            runtime.stop();
            return landed("stopped");
        }
        if (plan.do === "restyle") {
            if (next) runtime.setStyle(next);
            return landed("restyled");
        }
        let mode = plan.mode;
        let result = await runtime.run(read, mode, next || undefined);
        // A script that cannot take the old game's state over may still
        // start a new one: better a new round than the old script.
        if (!result.ok && mode === "keep" && result.fault !== "world") {
            mode = "fresh";
            result = await runtime.run(read, mode, next || undefined);
        }
        if (stopped || !result.ok) return;
        landed(mode === "keep" ? "kept" : "fresh");
    }

    async function follow() {
        if (busy) {
            again = true;
            return;
        }
        busy = true;
        try {
            do {
                again = false;
                await land();
                if (again && !stopped) await deps.pause();
            } while (again && !stopped);
        } finally {
            busy = false;
        }
    }

    const unwatch = deps.watch(spaceId, (event) => {
        const notice = readScriptEvent(event, deps.now());
        if (!notice || stopped) return;
        // The save a notice is for is the one this world already has: the
        // feed hands a newcomer its newest event, and a read can be ahead
        // of the feed. Nothing to read; but if it landed as an addition
        // and this asks for a rewind, rewind.
        if (notice.savedAt === savedAt) {
            if (notice.landing === "rewind" && landedAs === "kept") {
                landedAs = "fresh";
                void runtime.run(source, "fresh");
            }
            return;
        }
        if (notice.landing === "rewind") rewind = true;
        void follow();
    });

    return () => {
        stopped = true;
        unwatch();
    };
}
