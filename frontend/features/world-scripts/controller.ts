/**
 * What the AI sidebar does: one request to the model, the new script tried
 * out of sight, the model shown what failed, what works swapped into the
 * running world and saved with the space. Also undo, restart, stop and the
 * world's style.
 *
 * This is the part that needs the account (the model and the save are the
 * signed-in editor's), so it lives where the session is: in the space's own
 * page, or in the page around a framed world. It reaches the world only
 * through a runtime (./runtime).
 */
import WorldScriptsApi from "@api/worldScripts/_api";
import type { WorldScriptRecord } from "./protocol";
import { WORLD_SCRIPT_LIMITS, byteLength } from "./protocol";
import type { SwapMode } from "./host";
import type { WorldScriptRuntime } from "./runtime";
import { cleanStyle, WorldStyle } from "./style";
import {
    getWorldScripts,
    say,
    setWorldScripts,
    updateEntry,
    type WorldScriptsController,
} from "./store";

/** How many times the model may fix a script that did not run. */
export const MAX_ATTEMPTS = 3;

export interface ControlledSpace {
    id: string;
    info?: { headline?: string };
    exhibitId?: string;
}

/** The calls to the server, so a test can stand in for them. */
export type ControllerApi = Pick<typeof WorldScriptsApi, "save"> & {
    generate(input: Record<string, unknown>): Promise<unknown>;
};

const firstLine = (text = "") => text.split("\n")[0].slice(0, 200);

function newId() {
    return Math.random().toString(36).slice(2, 10);
}

const liveApi: ControllerApi = {
    save: (input) => WorldScriptsApi.save(input),
    generate: (input) =>
        WorldScriptsApi.opts({ timeout: 70_000 }).generate(input as any),
};

export function createController(
    space: ControlledSpace,
    runtime: WorldScriptRuntime,
    api: ControllerApi = liveApi
): WorldScriptsController {
    let history: string[] = [];

    async function run(source: string, mode: SwapMode = "fresh") {
        const result = await runtime.run(source, mode);
        if (result.ok) setWorldScripts({ source });
        return result.ok;
    }

    async function save(patch: Partial<WorldScriptRecord>) {
        const current = getWorldScripts();
        const script: WorldScriptRecord = {
            id: current.script?.id || newId(),
            name: current.script?.name || "World script",
            enabled: true,
            source: current.source,
            ...(current.script || {}),
            ...patch,
        };
        delete (script as any).updatedAt;
        if (byteLength(script.source) > WORLD_SCRIPT_LIMITS.maxSourceBytes)
            return false;
        const result: any = await api
            .save({
                experienceId: space.id,
                scripts: script.source ? [script] : [],
            })
            .catch((error) => ({ ok: false, error: error.message }));
        if (!result?.ok) {
            say(
                "error",
                `Couldn't save the script: ${result?.error || "try again"}`
            );
            return false;
        }
        setWorldScripts({ script: result.scripts[0] || null });
        return true;
    }

    /** Draws everything in the new style and keeps it with the space. */
    async function setStyle(style: WorldStyle) {
        setWorldScripts({ style });
        runtime.setStyle(style);
        const result: any = await api
            .save({ experienceId: space.id, style: style as any })
            .catch((error) => ({ ok: false, error: error.message }));
        if (!result?.ok)
            say(
                "error",
                `Couldn't save the style: ${result?.error || "try again"}`
            );
    }

    function restart() {
        const { source } = getWorldScripts();
        if (!runtime.ready() || !source) {
            say("say", "There's no script to start yet.");
            return;
        }
        runtime.restart(source);
        say("step", "Started again from the beginning", "done");
    }

    // Stops it for this visit; the saved script is untouched.
    function stop() {
        runtime.stop();
        say("step", "Stopped the script", "done");
    }

    async function undo() {
        const previous = history.pop();
        if (!previous || !runtime.ready()) {
            say("say", "There's no earlier version to go back to.");
            return;
        }
        if (await run(previous, "fresh")) {
            say("step", "Back to the previous version, from the start", "done");
            await save({ source: previous });
        }
    }

    /**
     * One request from the sidebar. The model writes; the new version runs
     * out of sight; if it fails the model gets the error and tries again;
     * what works is swapped into the running world and saved.
     */
    async function ask(request: string) {
        const current = getWorldScripts();
        request = request.trim();
        if (!request || current.busy) return;
        say("you", request);
        // Said in a word, done without the model.
        const word = request.toLowerCase().replace(/[.!\s]+$/, "");
        if (word === "undo") return undo();
        if (word === "restart" || word === "start") return restart();
        if (word === "stop") return stop();
        const refuse = !current.canEdit
            ? "Only this space's admins can change its scripts."
            : !current.canAsk
            ? current.askReason || "AI scripts are in early access for now."
            : !runtime.ready()
            ? "The world is still loading. Try again in a moment."
            : "";
        if (refuse) {
            say("error", refuse);
            return;
        }
        setWorldScripts({ busy: true });
        const previous = current.source;
        let failure: { source: string; reason: string } | undefined;
        try {
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                const writing = say(
                    "step",
                    attempt > 1
                        ? `Fixing it (try ${attempt} of ${MAX_ATTEMPTS})`
                        : previous
                        ? "Writing the change"
                        : "Writing the script",
                    "running"
                );
                const { artworks, ...colors } = await runtime.context();
                const answer: any = await api
                    .generate({
                        experienceId: space.id,
                        request,
                        currentSource: previous || undefined,
                        style: (getWorldScripts().style as any) || undefined,
                        world: {
                            title: space.info?.headline?.slice(0, 200),
                            place: space.exhibitId?.slice(0, 200),
                            ...colors,
                        },
                        failure,
                        artworks,
                    })
                    .catch((error) => ({ ok: false, error: error.message }));
                if (!answer?.ok) {
                    updateEntry(writing, { state: "failed" });
                    say(
                        "error",
                        answer?.error || "That didn't work. Try again."
                    );
                    return;
                }
                updateEntry(writing, {
                    state: "done",
                    text: `Wrote “${answer.name}” (${
                        answer.source.split("\n").length
                    } lines)`,
                });
                if (answer.remaining != null)
                    setWorldScripts({ remaining: answer.remaining });
                const style = cleanStyle(answer.style);
                if (style) {
                    say(
                        "step",
                        getWorldScripts().style
                            ? "Changed the world's style"
                            : "Picked a style from this world",
                        "done"
                    );
                    await setStyle(style);
                }
                const mode: SwapMode =
                    answer.change === "content" && previous ? "keep" : "fresh";
                const trying = say("step", "Trying it out of sight", "running");
                const result = await runtime.run(answer.source, mode);
                if (!result.ok) {
                    updateEntry(trying, {
                        state: "failed",
                        text: `It didn't run: ${firstLine(result.reason)}`,
                    });
                    failure = {
                        source: answer.source,
                        reason: String(result.reason || "").slice(0, 4000),
                    };
                    continue;
                }
                updateEntry(trying, {
                    state: "done",
                    text: !previous
                        ? "Started it in the world"
                        : mode === "keep"
                        ? "Swapped it in. The game kept going"
                        : "Swapped it in and rewound to the start",
                });
                if (previous) history = [...history, previous].slice(-10);
                setWorldScripts({ source: answer.source });
                say("say", answer.say);
                await save({
                    source: answer.source,
                    name: answer.name,
                    prompt: request,
                    enabled: true,
                });
                return;
            }
            say(
                "error",
                `That didn't run after ${MAX_ATTEMPTS} tries, so the world stayed as it was. Try asking in a different way.`
            );
        } finally {
            setWorldScripts({ busy: false });
        }
    }

    return { ask, run, save, undo, setStyle, restart, stop };
}
