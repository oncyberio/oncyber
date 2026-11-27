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
import { WORLD_SCRIPT_LIMITS, byteLength, firstLine } from "./basics";
import type { SwapMode } from "./host";
import type { Landing } from "./livePickup";
import type { WorldScriptRuntime } from "./runtime";
import { cleanStyle, WorldStyle } from "./style";
import {
    forgetLogs,
    getWorldScripts,
    rememberSaved,
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
export interface ControllerApi {
    save(input: Record<string, unknown>): Promise<unknown>;
    generate(input: Record<string, unknown>): Promise<unknown>;
}

/** A version to go back to: the script, and the style it ran in. */
interface Earlier {
    source: string;
    style: WorldStyle | null;
}

function newId() {
    return Math.random().toString(36).slice(2, 10);
}

const liveApi: ControllerApi = {
    save: (input) => WorldScriptsApi.save(input as any),
    generate: (input) =>
        WorldScriptsApi.opts({ timeout: 70_000 }).generate(input as any),
};

const failed = (error: unknown) => ({
    ok: false,
    error: (error as Error)?.message,
});

export function createController(
    space: ControlledSpace,
    runtime: WorldScriptRuntime,
    api: ControllerApi = liveApi
): WorldScriptsController {
    let history: Earlier[] = [];
    // The space went off show (another space, a reload of the frame). The
    // store belongs to the next one now: what is still under way here may
    // finish, but writes nothing and saves nothing.
    let disposed = false;

    /** The saved script's time, as this page knows it: what a save builds on. */
    const base = () => Number(getWorldScripts().script?.updatedAt) || 0;

    async function run(source: string, mode: SwapMode = "fresh") {
        const result = await runtime.run(source, mode);
        if (result.ok && !disposed) setWorldScripts({ source });
        return result.ok;
    }

    /** Saves the script, and with it a style that landed with it. */
    async function save(
        patch: Partial<WorldScriptRecord>,
        style?: WorldStyle,
        // How the other spaces that are open take it (./livePickup.ts): as
        // this one did. A step back is a rewind, as it is here.
        landing: Landing = "rewind"
    ) {
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
        // The world refuses a longer one before it gets here.
        if (byteLength(script.source) > WORLD_SCRIPT_LIMITS.maxSourceBytes)
            return false;
        const result: any = await api
            .save({
                experienceId: space.id,
                scripts: script.source ? [script] : [],
                // What this save builds on: refused if the space's script
                // was changed somewhere else since.
                base: base(),
                landing,
                ...(style ? { style } : {}),
            })
            .catch(failed);
        // Saved is saved, whatever is on show by now: the next visit to
        // this space starts from it.
        if (result?.ok) rememberSaved(space.id, result.scripts || [], style);
        if (disposed) return false;
        if (!result?.ok) {
            say(
                "error",
                result?.conflict
                    ? "This space's script was changed somewhere else, so yours wasn't saved over it. Reload to carry on from that one."
                    : `Couldn't save the script: ${
                          result?.error || "try again"
                      }`
            );
            return false;
        }
        setWorldScripts({ script: result.scripts?.[0] || null });
        return true;
    }

    /** Draws everything in the new style and keeps it with the space. */
    async function setStyle(style: WorldStyle) {
        setWorldScripts({ style });
        runtime.setStyle(style);
        const result: any = await api
            .save({ experienceId: space.id, style })
            .catch(failed);
        if (disposed) return;
        if (!result?.ok)
            say(
                "error",
                `Couldn't save the style: ${result?.error || "try again"}`
            );
        else rememberSaved(space.id, null, style);
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
        const previous = history[history.length - 1];
        if (!previous) {
            say("say", "There's no earlier version to go back to.");
            return;
        }
        if (!runtime.ready()) {
            say("error", "The world is still loading. Try again in a moment.");
            return;
        }
        const style = previous.style || undefined;
        const result = await runtime.run(previous.source, "fresh", style);
        if (disposed) return;
        if (!result.ok) {
            // Still there to go back to.
            say(
                "error",
                `Couldn't go back to the previous version: ${firstLine(
                    result.reason
                )}`
            );
            return;
        }
        history = history.slice(0, -1);
        setWorldScripts({
            source: previous.source,
            ...(style ? { style } : {}),
        });
        say("step", "Back to the previous version, from the start", "done");
        await save({ source: previous.source }, style);
    }

    // Nothing here should throw; if something does, a line that says so is
    // worth more than a step left spinning.
    function oops(error: unknown) {
        if (disposed) return;
        say(
            "error",
            `That didn't work: ${firstLine(
                (error as Error)?.message || "try again"
            )}`
        );
    }

    /**
     * One request from the sidebar. The model writes; the new version runs
     * out of sight; if it fails the model gets the error and tries again;
     * what works is swapped into the running world and saved.
     */
    async function ask(request: string) {
        const current = getWorldScripts();
        request = request.trim();
        if (!request || current.busy || disposed) return;
        say("you", request);
        // Said in a word, done without the model.
        const word = request.toLowerCase().replace(/[.!\s]+$/, "");
        if (word === "undo") return undo().catch(oops);
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
        forgetLogs();
        try {
            await write(request, current.source, current.style);
        } catch (error) {
            oops(error);
        } finally {
            if (!disposed) setWorldScripts({ busy: false });
        }
    }

    async function write(
        request: string,
        previous: string,
        styleBefore: WorldStyle | null
    ) {
        let failure: { source: string; reason: string } | undefined;
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
            if (disposed) return;
            const answer: any = await api
                .generate({
                    experienceId: space.id,
                    request,
                    currentSource: previous || undefined,
                    style: styleBefore || undefined,
                    world: {
                        title: space.info?.headline?.slice(0, 200),
                        place: space.exhibitId?.slice(0, 200),
                        ...colors,
                    },
                    failure,
                    artworks,
                    base: base(),
                })
                .catch(failed);
            if (disposed) return;
            if (!answer?.ok || typeof answer.source !== "string") {
                updateEntry(writing, { state: "failed" });
                say("error", answer?.error || "That didn't work. Try again.");
                return;
            }
            updateEntry(writing, {
                state: "done",
                text: `Wrote “${answer.name}” (${
                    answer.source.split("\n").length
                } lines)`,
            });
            // A style the model wrote comes with the script: the world is
            // drawn in it, and it is saved, only if the script lands.
            const style = cleanStyle(answer.style) || undefined;
            const mode: SwapMode =
                answer.change === "content" && previous ? "keep" : "fresh";
            const trying = say("step", "Trying it out of sight", "running");
            const result = await runtime.run(answer.source, mode, style);
            if (disposed) return;
            if (!result.ok && result.fault === "world") {
                // Not the script's doing: the model has nothing to fix.
                updateEntry(trying, {
                    state: "failed",
                    text: `It couldn't be tried: ${firstLine(result.reason)}`,
                });
                say(
                    "error",
                    "The world wasn't ready for it, so nothing changed. Try again in a moment."
                );
                return;
            }
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
            if (style)
                say(
                    "step",
                    styleBefore
                        ? "Changed the world's style"
                        : "Picked a style from this world",
                    "done"
                );
            if (previous)
                history = [
                    ...history,
                    { source: previous, style: styleBefore },
                ].slice(-10);
            setWorldScripts({
                source: answer.source,
                ...(style ? { style } : {}),
            });
            say("say", answer.say);
            await save(
                {
                    source: answer.source,
                    name: answer.name,
                    enabled: true,
                },
                style,
                mode === "keep" ? "add" : "rewind"
            );
            return;
        }
        say(
            "error",
            `That didn't run after ${MAX_ATTEMPTS} tries, so the world stayed as it was. Try asking in a different way.`
        );
    }

    return {
        ask,
        run,
        save,
        undo,
        setStyle,
        restart,
        stop,
        dispose() {
            disposed = true;
        },
    };
}
