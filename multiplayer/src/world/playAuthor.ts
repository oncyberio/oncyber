/**
 * Asks a language model to change a play zone from a player's typed request:
 * the game (a recipe), the move players make when they hit (an action), or
 * both. The model's answer is data in those two formats and nothing else.
 * It goes through readPlayRecipe and readPlayAction, which clamp every
 * number, so whatever it writes can only make a game inside the zone's
 * limits and move a body.
 *
 * The model is whatever chat-completions address the server was started
 * with (PLAY_AUTHOR_URL, PLAY_AUTHOR_MODEL, PLAY_AUTHOR_KEY). Without those
 * there is no model and requests are refused.
 */
import { PlayAction, readPlayAction } from "../../protocol/play-action";
import { PLAY_BRIEF } from "../../protocol/play-brief";
import { PlayRecipe, readPlayRecipe } from "../../protocol/play-zone";

export const PLAY_REQUEST_LIMIT = 300;
const SAY_LIMIT = 160;

export interface PlayAuthorConfig {
    url: string;
    model: string;
    key: string;
    /** Gives up after this long. A model picking limb positions can take half a minute. */
    timeoutMs?: number;
    fetch?: typeof fetch;
}
export interface PlayAnswer {
    /** One short line for the players about what changed. */
    say: string;
    recipe: PlayRecipe | null;
    action: PlayAction | null;
    servedBy: string | null;
}

export function playAuthorFromEnv(env: Record<string, string | undefined> = process.env): PlayAuthorConfig | null {
    const { PLAY_AUTHOR_URL: url, PLAY_AUTHOR_MODEL: model, PLAY_AUTHOR_KEY: key } = env;
    return url && model && key ? { url, model, key } : null;
}

/** A typed request with control characters removed, cut to length. Empty when there is nothing to ask. */
export function readPlayRequest(value: unknown) {
    return typeof value === "string"
        ? value
              .replace(/[\u0000-\u001f\u007f]/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, PLAY_REQUEST_LIMIT)
        : "";
}

const line = (value: unknown) =>
    typeof value === "string"
        ? value
              .replace(/[\u0000-\u001f\u007f]/g, " ")
              .trim()
              .slice(0, SAY_LIMIT)
        : "";

export async function askPlay(request: string, current: PlayRecipe | null, config: PlayAuthorConfig): Promise<PlayAnswer> {
    const text = readPlayRequest(request);
    if (!text) throw new Error("Nothing was asked.");
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), config.timeoutMs ?? 60000);
    let body: any;
    try {
        const response = await (config.fetch || fetch)(config.url, {
            method: "POST",
            headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
            signal: stop.signal,
            body: JSON.stringify({
                model: config.model,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: PLAY_BRIEF },
                    // The request is quoted as data: it asks for a game, it does not give the model orders about anything else.
                    { role: "user", content: `${current ? `The recipe in play:\n${JSON.stringify(current)}` : "There is no game in play yet."}\n\nThe player's request, in their words:\n"""${text}"""` },
                ],
            }),
        });
        body = await response.json().catch((): any => null);
        if (!response.ok || !body?.choices?.length) throw new Error(`The model did not answer (${response.status}).`);
    } catch (error) {
        throw new Error(stop.signal.aborted ? "The model took too long." : (error as Error).message);
    } finally {
        clearTimeout(timer);
    }
    const content = String(body.choices[0].message?.content || "");
    let raw: any;
    try {
        // Some models wrap JSON in a fence however they are asked.
        raw = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
    } catch {
        throw new Error("The model did not answer in the format asked.");
    }
    const recipe = readPlayRecipe(raw?.recipe),
        action = readPlayAction(raw?.action);
    return { say: line(raw?.say) || (recipe || action ? "Done." : "Nothing to change."), recipe, action, servedBy: typeof body.model === "string" ? body.model.slice(0, 80) : null };
}
