/**
 * Every game ships a bot: `games/<id>/bot.json`, a scenario that plays the
 * game through the input the game declared in `game.json`, the way a
 * visitor's keyboard would. `pnpm games:check` runs it in the browser,
 * records it, and reads the game's facts between steps. Rule and check:
 * docs/games/good-game.md.
 *
 * No imports: the check script loads this file directly.
 */

type Json = null | string | number | boolean | Json[] | { [key: string]: Json };

/** Facts every game reports from `inspect()` so one bot runner fits all. */
export interface StandardFacts {
    /**
     * Where the visitor is: "title" (direct visits only), "arrival" (walking
     * the world), "menu" (choosing), "match" (playing) or "results".
     */
    screen: "title" | "arrival" | "menu" | "match" | "results";
    /** The visitor's avatar on the ground, in metres: [x, z]. */
    position: [number, number];
    /** While arriving: see ArrivalFacts in arrival.ts. */
    arrival?: Json;
}
export const SCREENS = [
    "title",
    "arrival",
    "menu",
    "match",
    "results",
] as const;

/** One bot step. Exactly one of the keys below. */
export type BotStep =
    // Tap or hold a declared action. `key` picks one of the action's
    // keyboard bindings when the first is not the one to press.
    | { press: string; key?: string }
    | { hold: string; ms: number; key?: string }
    | { wait: number } // milliseconds
    | { expect: Record<string, Json> } // inspect() keys must equal these now
    | { until: Record<string, Json>; timeoutMs?: number } // wait for them
    | { repeat: BotStep[]; until: Record<string, Json>; timeoutMs?: number };

export interface Bot {
    version: 1;
    /** Query string for the run, for example a short match: "games=1". */
    query?: string;
    /** From standing up to choosing to start: walk, then start the game. */
    arrival: BotStep[];
    /** One match to its result (or, in a world with no match, its core loop). */
    play: BotStep[];
    /** From the result back to the arrival. Empty in a world with no match. */
    leave: BotStep[];
}

/** `game.json` `format`: a game with matches, or a world you only walk. */
export type GameFormat = "match" | "world";

export interface ManifestInput {
    [action: string]: { keyboard?: string[] };
}

/** Keys the page keeps for itself (docs/games/keys-focus.md): never a bot's. */
export const PAGE_KEYS = ["Escape", "Enter", "NumpadEnter", "KeyM"] as const;

/**
 * The keyboard code a step presses for an action: the first one bound, or
 * `key` when it is one of the action's bindings. Null when the action has
 * no keyboard binding, `key` is not one of them, or it is a key the page
 * reserves.
 */
export function botKey(
    input: ManifestInput | undefined,
    action: string,
    key?: string
): string | null {
    const binding =
        input && Object.hasOwn(input, action) ? input[action] : null;
    const keys = (binding?.keyboard ?? []).filter(
        (code) => typeof code === "string" && code
    );
    const code = key === undefined ? keys[0] : keys.find((k) => k === key);
    return code && !(PAGE_KEYS as readonly string[]).includes(code)
        ? code
        : null;
}

/** The input a game declared: `runtime.input` on the lifecycle, else `input`. */
export function declaredInput(manifest: {
    input?: ManifestInput;
    runtime?: { input?: ManifestInput };
}): ManifestInput {
    return manifest?.runtime?.input ?? manifest?.input ?? {};
}

export interface BotFinding {
    code: string;
    message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

function stepFindings(
    step: unknown,
    input: ManifestInput,
    where: string,
    out: BotFinding[],
    depth = 0
) {
    if (!isRecord(step))
        return void out.push({
            code: "BOT_INVALID",
            message: `${where}: a step must be an object`,
        });
    const action =
        "press" in step ? step.press : "hold" in step ? step.hold : undefined;
    if (action !== undefined) {
        const key = "key" in step ? step.key : undefined;
        if (
            typeof action !== "string" ||
            (key !== undefined && typeof key !== "string") ||
            !botKey(input, action, key as string | undefined)
        )
            out.push({
                code: "BOT_UNDECLARED_INPUT",
                message: `${where}: "${String(action)}"${
                    key === undefined ? "" : ` with key "${String(key)}"`
                } is not an action with that keyboard binding in game.json (the page keeps ${PAGE_KEYS.join(
                    ", "
                )})`,
            });
        if (
            "hold" in step &&
            !(typeof step.ms === "number" && step.ms > 0 && step.ms <= 30_000)
        )
            out.push({
                code: "BOT_INVALID",
                message: `${where}: hold needs ms between 1 and 30000`,
            });
    } else if ("wait" in step) {
        if (
            !(
                typeof step.wait === "number" &&
                step.wait >= 0 &&
                step.wait <= 30_000
            )
        )
            out.push({
                code: "BOT_INVALID",
                message: `${where}: wait is milliseconds, at most 30000`,
            });
    } else if ("repeat" in step) {
        if (
            !Array.isArray(step.repeat) ||
            !step.repeat.length ||
            !isRecord(step.until) ||
            depth > 0
        )
            out.push({
                code: "BOT_INVALID",
                message: `${where}: repeat needs steps and an until, and can't nest`,
            });
        else
            step.repeat.forEach((inner, i) =>
                stepFindings(
                    inner,
                    input,
                    `${where}.repeat[${i}]`,
                    out,
                    depth + 1
                )
            );
    } else if ("expect" in step || "until" in step) {
        if (!isRecord("expect" in step ? step.expect : step.until))
            out.push({
                code: "BOT_INVALID",
                message: `${where}: expect and until take an object of inspect() keys`,
            });
    } else
        out.push({
            code: "BOT_INVALID",
            message: `${where}: unknown step ${JSON.stringify(step).slice(
                0,
                80
            )}`,
        });
}

const acts = (steps: unknown[]): boolean =>
    steps.some(
        (step) =>
            isRecord(step) &&
            ("press" in step ||
                "hold" in step ||
                (Array.isArray(step.repeat) && acts(step.repeat)))
    );
const proves = (steps: unknown[]): boolean =>
    steps.some(
        (step) =>
            isRecord(step) &&
            ("expect" in step || "until" in step || "repeat" in step)
    );

/** Everything wrong with a bot file, before a browser opens. */
export function botFindings(
    bot: unknown,
    input: ManifestInput,
    format: GameFormat = "match"
): BotFinding[] {
    if (!isRecord(bot) || bot.version !== 1)
        return [{ code: "BOT_INVALID", message: "bot.json needs version 1" }];
    const out: BotFinding[] = [];
    if (
        bot.query !== undefined &&
        (typeof bot.query !== "string" || !/^[\w\-.~=&%]*$/.test(bot.query))
    )
        out.push({
            code: "BOT_INVALID",
            message: "query is a plain query string without ? or #",
        });
    for (const part of ["arrival", "play", "leave"] as const) {
        const steps = bot[part];
        if (!Array.isArray(steps)) {
            out.push({
                code: "BOT_INVALID",
                message: `${part} must be a list of steps`,
            });
            continue;
        }
        steps.forEach((step, i) =>
            stepFindings(step, input, `${part}[${i}]`, out)
        );
    }
    if (out.length) return out;
    // A bot that presses nothing proves nothing.
    if (!acts(bot.arrival as unknown[]))
        out.push({
            code: "BOT_IDLE",
            message: "arrival presses nothing: walk, then choose to start",
        });
    if (!acts(bot.play as unknown[]))
        out.push({
            code: "BOT_IDLE",
            message:
                "play presses nothing: the bot must play through declared input",
        });
    if (format === "world" && !proves(bot.play as unknown[]))
        out.push({
            code: "BOT_IDLE",
            message:
                "play asserts nothing: add an expect or until on an inspect() key",
        });
    if (format === "match" && !acts(bot.leave as unknown[]))
        out.push({
            code: "BOT_IDLE",
            message:
                "leave presses nothing: go from the result back to the arrival",
        });
    return out;
}

/** Do the facts carry every expected key with an equal value? */
export function factsMatch(
    facts: unknown,
    expected: Record<string, Json>
): boolean {
    if (!isRecord(facts)) return false;
    return Object.entries(expected).every(
        ([key, value]) => JSON.stringify(facts[key]) === JSON.stringify(value)
    );
}

/** The keys that differ, for a message an agent can act on. */
export function factsDiff(
    facts: unknown,
    expected: Record<string, Json>
): string {
    const have = isRecord(facts) ? facts : {};
    return Object.entries(expected)
        .filter(
            ([key, value]) =>
                JSON.stringify(have[key]) !== JSON.stringify(value)
        )
        .map(
            ([key, value]) =>
                `${key} is ${JSON.stringify(
                    have[key]
                )}, expected ${JSON.stringify(value)}`
        )
        .join("; ");
}

export const INSPECT_GLOBAL = "__oncyberGame";

/**
 * Let checks read the game's facts. Call once, in the game's host, with a
 * function that returns the lifecycle's `inspect()` with the three
 * standard facts in it (`screen`, `position`, `arrival`). The frame is
 * sandboxed, so only tools that drive the browser can reach it; the page
 * cannot. It joins the reports the loading and pausing helpers keep on the
 * same object (`loading`, `pausing`).
 */
export function exposeInspect(inspect: () => Record<string, Json>): void {
    // The same read-only reports object the loading and pausing helpers
    // register on (loading.ts): add to it, never replace it.
    const scope = globalThis as Record<string, unknown>;
    const reports = (scope[INSPECT_GLOBAL] ??= {}) as Record<
        string,
        () => unknown
    >;
    reports.inspect = () => JSON.parse(JSON.stringify(inspect()));
}
