/**
 * Server side of world scripts: who may ask the model, the model call
 * itself (OpenRouter, with the deployment's own key), and the usage ledger
 * that a credits system will later draw from.
 *
 * Today the AI is in early access: an allowlist (WORLD_SCRIPTS_AI_ALLOWLIST)
 * plus a daily cap, because every call is paid from one key. A request is
 * counted before the model is called (`reserveAiRequest`, in a transaction,
 * so requests made at once cannot all slip under the cap) and stays counted
 * whether or not the call worked. `reserveAiRequest` and `recordAiUsage` are
 * the two places a credit balance will plug in: hold the price before the
 * call, charge the call's cost (which OpenRouter reports) after it.
 */
import { db, fire } from "@utils/firebaseAdmin";
import { ADMINS } from "@api/social/isMod";
import { getAccountDoc } from "@api/accounts/authenticate/utils/link";
import {
    WORLD_SCRIPT_BRIEF,
    readWorldScriptAnswer,
    WorldScriptAnswer,
} from "@features/world-scripts/brief";
import {
    cleanStyle,
    describeWorld,
    WorldContext,
} from "@features/world-scripts/style";
import { flagOn } from "@features/world-scripts/basics";

export const WORLD_SCRIPTS_FEATURE = "world-script";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";
const DEFAULT_DAILY_LIMIT = 40;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type Env = Record<string, string | undefined>;

/**
 * Read by its full name, as the browser's copy is (features/world-scripts/
 * store.ts): a value given at build time (next.config.js) is written into
 * the code where the name stands, and is not in the server's environment.
 */
export function worldScriptsEnabled(
    value: string | undefined = process.env.NEXT_PUBLIC_WORLD_SCRIPTS
) {
    return flagOn(value);
}

const list = (value = "") =>
    value
        .split(/[\s,]+/)
        .map((id) => id.trim().toLowerCase())
        .filter(Boolean);

/** Account ids and wallets an account is known by, lower case. */
export function accountNames(account: { id: string; data?(): any }) {
    const data = account.data?.() || {};
    return [
        account.id,
        data.walletId,
        ...(Array.isArray(data.linkedAccounts) ? data.linkedAccounts : []),
    ]
        .filter((id): id is string => typeof id === "string" && !!id)
        .map((id) => id.toLowerCase());
}

export function isAllowlisted(
    names: string[],
    allowlist = process.env.WORLD_SCRIPTS_AI_ALLOWLIST || ""
) {
    const allowed = list(allowlist);
    return allowed.includes("*") || names.some((id) => allowed.includes(id));
}

export interface AiAccess {
    allowed: boolean;
    /**
     * On the early-access list. The AI sidebar is offered to these accounts
     * only; `allowed` can still be false for one of them (today's limit,
     * no model set up).
     */
    earlyAccess: boolean;
    reason?: string;
    /** Requests left today; credits will replace this. */
    remaining?: number;
}

function dayKey(now = new Date()) {
    return now.toISOString().slice(0, 10).replace(/-/g, "");
}

function dailyLimit(env: Env = process.env) {
    const value = Number(env.WORLD_SCRIPTS_AI_DAILY_LIMIT);
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DAILY_LIMIT;
}

/** On the early-access list, under any of the names the account goes by. */
export async function hasEarlyAccess(userId: string) {
    const account = await getAccountDoc(userId).catch((): null => null);
    return isAllowlisted([
        userId.toLowerCase(),
        ...(account ? accountNames(account as any) : []),
    ]);
}

const TODAYS_LIMIT = "That's today's limit. Try again tomorrow.";

const dailyUsage = (userId: string) =>
    db.collection("aiUsageDaily").doc(`${userId}_${dayKey()}`);

/**
 * Whether this account may ask the model now, for showing it. The request
 * itself is let through by `reserveAiRequest`, which counts it.
 */
export async function checkAiAccess(userId: string): Promise<AiAccess> {
    if (!(await hasEarlyAccess(userId)))
        return {
            allowed: false,
            earlyAccess: false,
            reason: "AI scripts are in early access for now.",
        };
    if (!process.env.OPENROUTER_API_KEY)
        return {
            allowed: false,
            earlyAccess: true,
            reason: "No AI model is set up here.",
        };
    const usage = await dailyUsage(userId)
        .get()
        .catch(() => null);
    const used = usage?.exists ? Number(usage.data()?.requests) || 0 : 0;
    const remaining = dailyLimit() - used;
    if (remaining <= 0)
        return {
            allowed: false,
            earlyAccess: true,
            reason: TODAYS_LIMIT,
            remaining: 0,
        };
    return { allowed: true, earlyAccess: true, remaining };
}

/**
 * Counts one request against today's limit, before the model is called.
 * Read and written in one transaction: of several requests made at once,
 * only as many as are left get through. A request stays counted when the
 * call fails or times out, since the provider may have charged for it.
 */
export async function reserveAiRequest(
    userId: string,
    limit: number = dailyLimit()
): Promise<{ allowed: boolean; remaining: number; reason?: string }> {
    const ref = dailyUsage(userId);
    return db.runTransaction(async (transaction) => {
        const usage = await transaction.get(ref);
        const used = usage.exists ? Number(usage.data()?.requests) || 0 : 0;
        if (used >= limit)
            return { allowed: false, remaining: 0, reason: TODAYS_LIMIT };
        transaction.set(
            ref,
            { userId, day: dayKey(), requests: used + 1 },
            { merge: true }
        );
        return { allowed: true, remaining: limit - used - 1 };
    });
}

/** The model a request is sent to. */
export function aiModel(env: Env = process.env) {
    return env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

export interface AiUsage {
    userId: string;
    experienceId: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    /** What the provider charged, in US dollars, when it says. */
    costUsd: number | null;
    ok: boolean;
}

/**
 * One ledger row per model call, and its cost on the day's total. The
 * request itself was counted before the call (`reserveAiRequest`).
 */
export async function recordAiUsage(usage: AiUsage) {
    const batch = db.batch();
    batch.set(db.collection("aiUsage").doc(), {
        ...usage,
        feature: WORLD_SCRIPTS_FEATURE,
        createdAt: Date.now(),
    });
    batch.set(
        dailyUsage(usage.userId),
        {
            userId: usage.userId,
            day: dayKey(),
            costUsd: fire.FieldValue.increment(usage.costUsd || 0),
        },
        { merge: true }
    );
    await batch.commit().catch((error) => console.error("aiUsage", error));
}

export interface ScriptRequest {
    request: string;
    currentSource?: string;
    artworks?: Array<{ id: string; name: string }>;
    /** The world's creative direction, when it has one. */
    style?: unknown;
    /** What the world is, for writing its first style. */
    world?: WorldContext;
    /** The last attempt at this request, when it did not run. */
    failure?: { source: string; reason: string };
}

export interface ScriptReply {
    answer: WorldScriptAnswer;
    usage: Omit<AiUsage, "userId" | "experienceId" | "ok">;
}

export async function askForScript(
    input: ScriptRequest,
    fetcher: typeof fetch = fetch,
    env: Env = process.env
): Promise<ScriptReply> {
    const model = aiModel(env);
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 55_000);
    const hadScript = !!input.currentSource?.trim();
    const artworks = (input.artworks || [])
        .slice(0, 60)
        .map((artwork) => `${artwork.id}: ${artwork.name}`)
        .join("\n");
    const style = cleanStyle(input.style);
    const world = describeWorld({
        ...input.world,
        artworks: (input.artworks || []).map((artwork) => artwork.name),
    });
    const context = [
        style
            ? `This world's style (follow it):\n${JSON.stringify(style)}`
            : `This world has no style yet. Only if this request makes things people see (objects, characters, effects), return "style" with your answer; otherwise leave it out.${
                  world ? `\nWhat is known about the world:\n${world}` : ""
              }`,
        hadScript
            ? `The script running now:\n\`\`\`js\n${input.currentSource}\n\`\`\``
            : "There is no script yet.",
        artworks ? `Artworks in this space (id: name):\n${artworks}` : "",
        // Quoted as data: it asks for a script, it gives no other orders.
        `The creator's request, in their words:\n"""${input.request}"""`,
        input.failure
            ? `Your last attempt at this request did not run, so the world kept the script above. Fix it and answer again with the whole script.\nThe attempt:\n\`\`\`js\n${
                  input.failure.source
              }\n\`\`\`\nWhat went wrong:\n${input.failure.reason.slice(
                  0,
                  1500
              )}`
            : "",
    ]
        .filter(Boolean)
        .join("\n\n");
    let body: any;
    try {
        const response = await fetcher(OPENROUTER_URL, {
            method: "POST",
            signal: stop.signal,
            headers: {
                Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "X-Title": "Oncyber world scripts",
            },
            body: JSON.stringify({
                model,
                temperature: 0.4,
                max_tokens: 12000,
                response_format: { type: "json_object" },
                usage: { include: true },
                messages: [
                    { role: "system", content: WORLD_SCRIPT_BRIEF },
                    { role: "user", content: context },
                ],
            }),
        });
        body = await response.json().catch((): any => null);
        if (!response.ok || !body?.choices?.length)
            throw new Error(
                `The model did not answer (${response.status}${
                    body?.error?.message
                        ? `: ${String(body.error.message).slice(0, 120)}`
                        : ""
                }).`
            );
    } catch (error) {
        throw new Error(
            stop.signal.aborted
                ? "The model took too long."
                : (error as Error).message
        );
    } finally {
        clearTimeout(timer);
    }
    const usage = {
        model: typeof body.model === "string" ? body.model.slice(0, 80) : model,
        promptTokens: Number(body.usage?.prompt_tokens) || 0,
        completionTokens: Number(body.usage?.completion_tokens) || 0,
        costUsd: Number.isFinite(Number(body.usage?.cost))
            ? Number(body.usage.cost)
            : null,
    };
    const answer = readWorldScriptAnswer(
        String(body.choices[0].message?.content || ""),
        hadScript
    );
    if (!answer) {
        const error: any = new Error("The model did not answer with a script.");
        error.usage = usage;
        throw error;
    }
    return { answer, usage };
}

/**
 * The space, if this account is one of its admins: its owner, an editor,
 * or a site admin (the same people `social.isMod` lets moderate it).
 */
export async function editableSpace(experienceId: string, userId: string) {
    const document = await db.collection("exhibits").doc(experienceId).get();
    if (!document.exists) return null;
    const experience = document.data();
    if (experience.deleted === true) return null;
    if (!isSpaceAdmin(experience, userId)) return null;
    return { ref: document.ref, experience };
}

/** Whether this account is the space's owner, an editor or a site admin. */
export function isSpaceAdmin(
    experience: { owner?: unknown; editors?: unknown },
    userId: string
) {
    const id = userId.toLowerCase();
    const editors = [
        experience.owner,
        ...(Array.isArray(experience.editors) ? experience.editors : []),
    ];
    return (
        ADMINS.includes(id) ||
        editors.some(
            (editor) =>
                typeof editor === "string" && editor.toLowerCase() === id
        )
    );
}

/**
 * When a space's script was last saved (0 for none): what a save says it
 * builds on, so one editor does not write over another's change unseen.
 */
export function scriptsSavedAt(experience: { worldScripts?: unknown }) {
    const scripts = Array.isArray(experience.worldScripts)
        ? experience.worldScripts
        : [];
    return Math.max(
        0,
        ...scripts.map((script) => Number(script?.updatedAt) || 0)
    );
}

export const SCRIPT_CHANGED_ELSEWHERE =
    "This space's script was changed somewhere else. Reload to carry on from that one.";
