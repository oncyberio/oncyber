import type { RuntimeSession } from "./index.ts";

/**
 * In-frame half of the device profiles of `pnpm games:check`. The check
 * opens the game with `?check=phone` or `?check=gamepad`; the host passes
 * `deviceAct(session)` to `runCheck`, and each scenario action is then
 * pressed by the check script on the real control (a touch on the on-screen
 * stick or button, a button of a stand-in gamepad) instead of being handed
 * to the session. The step passes once the session has seen the input
 * arrive. See scripts/games/devices.mjs and docs/games/devices.md.
 */
export type CheckProfile = "desktop" | "phone" | "gamepad";
export const DEVICE_INPUT = "oncyber:check-input";
export const DEVICE_INPUT_DONE = "oncyber:check-input-done";

/** The profile a `?check[=profile]` page was opened for; null without `?check`. */
export function checkProfile(
    search: string = location.search
): CheckProfile | null {
    const params = new URLSearchParams(search);
    if (!params.has("check")) return null;
    const value = params.get("check");
    return value === "phone" || value === "gamepad" ? value : "desktop";
}

const arrived = (seen: number | undefined, wanted: number) =>
    wanted === 0
        ? (seen ?? 0) === 0
        : seen !== undefined && Math.abs(seen - wanted) <= 0.1;

/**
 * The `act` option for `runCheck`, or undefined on the desktop profile
 * (where the scenario sets actions directly).
 */
export function deviceAct(
    session: Pick<RuntimeSession, "action">,
    profile: CheckProfile | null = checkProfile(),
    options: {
        post?(message: object): void;
        listen?(handler: (data: any) => void): () => void;
        wait?(): Promise<void>;
        timeoutMs?: number;
    } = {}
): ((action: string, value: number) => Promise<void>) | undefined {
    if (profile !== "phone" && profile !== "gamepad") return undefined;
    const post =
        options.post ?? ((message) => window.parent.postMessage(message, "*"));
    const listen =
        options.listen ??
        ((handler) => {
            const receive = (event: MessageEvent) => {
                if (event.source === window.parent) handler(event.data);
            };
            window.addEventListener("message", receive);
            return () => window.removeEventListener("message", receive);
        });
    const wait =
        options.wait ??
        (() => new Promise<void>((resolve) => setTimeout(resolve, 16)));
    // What actually reached the session, whichever device sent it.
    const seen: Record<string, number> = Object.create(null);
    const original = session.action.bind(session);
    session.action = (action: string, value = 1) => {
        original(action, value);
        seen[action] = value;
    };
    let next = 0;
    return async (action, value) => {
        const id = ++next;
        const error = await new Promise<string | null>((resolve) => {
            const timer = setTimeout(() => {
                stop();
                resolve("DEVICE_DRIVER_TIMEOUT");
            }, options.timeoutMs ?? 15000);
            const stop = listen((data) => {
                if (data?.type !== DEVICE_INPUT_DONE || data.id !== id) return;
                clearTimeout(timer);
                stop();
                resolve(
                    typeof data.error === "string" && data.error
                        ? data.error
                        : null
                );
            });
            post({ type: DEVICE_INPUT, id, profile, action, value });
        });
        if (error) throw new Error(error);
        for (let i = 0; i < 60 && !arrived(seen[action], value); i++)
            await wait();
        if (!arrived(seen[action], value))
            throw new Error(`DEVICE_INPUT_LOST:${action}`);
    };
}
