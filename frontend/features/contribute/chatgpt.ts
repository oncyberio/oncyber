import type { AiProvider, ChatMessage, ToolCall } from "./assistant";
import { ContributeSettings, writeContributeSettings } from "./store";

/**
 * Sign in with ChatGPT: the visitor signs in with their ChatGPT account and
 * the assistant runs on their ChatGPT plan, not on an API key.
 *
 * OpenAI gives client IDs to approved apps only. Until Oncyber has one
 * (NEXT_PUBLIC_CHATGPT_CLIENT_ID), the button stays off and the API key
 * route is the way in.
 */
export const CHATGPT_CLIENT_ID = process.env.NEXT_PUBLIC_CHATGPT_CLIENT_ID;

const AUTHORIZE = "https://auth.openai.com/api/accounts/authorize";
export const CHATGPT_RESOURCE = "https://api.openai.com/v1";
const SCOPES =
    "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
export const CALLBACK_PATH = "/contribute/chatgpt-callback";
export const CALLBACK_CHANNEL = "oncyber:chatgpt-callback";
/** Same-origin route that exchanges codes and refresh tokens. */
const TOKEN_ROUTE = "/api/contribute/chatgpt-token";

export type ChatGPTTokens = {
    accessToken: string;
    refreshToken?: string;
    /** Milliseconds since epoch. */
    expiresAt: number;
};

function base64url(bytes: Uint8Array) {
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function random(size = 32) {
    return base64url(crypto.getRandomValues(new Uint8Array(size)));
}

async function challengeFor(verifier: string) {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier)
    );
    return base64url(new Uint8Array(digest));
}

export function redirectUri(origin = window.location.origin) {
    return origin + CALLBACK_PATH;
}

async function exchange(body: Record<string, string>): Promise<ChatGPTTokens> {
    const response = await fetch(TOKEN_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.access_token)
        throw new Error(
            data?.error_description ||
                data?.error ||
                `ChatGPT sign-in failed (${response.status})`
        );
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    };
}

/**
 * Opens the ChatGPT sign-in in a popup (PKCE) and resolves with tokens once
 * the callback page hands the code back.
 */
export async function signInWithChatGPT(): Promise<ChatGPTTokens> {
    if (!CHATGPT_CLIENT_ID)
        throw new Error("Sign in with ChatGPT isn't set up on this site yet.");
    const verifier = random(48);
    const state = random();
    const params = new URLSearchParams({
        client_id: CHATGPT_CLIENT_ID,
        redirect_uri: redirectUri(),
        response_type: "code",
        scope: SCOPES,
        resource: CHATGPT_RESOURCE,
        state,
        nonce: random(),
        code_challenge: await challengeFor(verifier),
        code_challenge_method: "S256",
    });
    const popup = window.open(
        `${AUTHORIZE}?${params}`,
        "chatgpt-sign-in",
        "popup,width=480,height=720"
    );
    if (!popup) throw new Error("Allow pop-ups to sign in with ChatGPT.");

    // OpenAI's sign-in page may cut the popup off from this window, so the
    // callback answers on a same-origin channel rather than window.opener.
    const code = await new Promise<string>((resolve, reject) => {
        const channel = new BroadcastChannel(CALLBACK_CHANNEL);
        const timer = setTimeout(
            () => done(new Error("Sign-in timed out. Try again.")),
            5 * 60 * 1000
        );
        function done(error?: Error, value?: string) {
            clearTimeout(timer);
            channel.close();
            error ? reject(error) : resolve(value);
        }
        channel.onmessage = (event) => {
            const data = event.data;
            if (data?.state !== state) return;
            if (data.error)
                return done(new Error(data.error_description || data.error));
            done(undefined, data.code);
        };
    });

    return exchange({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri(),
    });
}

export function refreshChatGPT(refreshToken: string) {
    return exchange({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });
}

/** Turns the chat-style history into Responses API input items. */
export function toResponsesInput(messages: ChatMessage[]) {
    let instructions = "";
    const input: any[] = [];
    for (const message of messages) {
        if (message.role === "system") instructions += message.content || "";
        else if (message.role === "user")
            input.push({ role: "user", content: message.content || "" });
        else if (message.role === "assistant") {
            if (message.content)
                input.push({ role: "assistant", content: message.content });
            for (const call of message.tool_calls || [])
                input.push({
                    type: "function_call",
                    call_id: call.id,
                    name: call.function.name,
                    arguments: call.function.arguments,
                });
        } else if (message.role === "tool")
            input.push({
                type: "function_call_output",
                call_id: message.tool_call_id,
                output: message.content || "",
            });
    }
    return { instructions, input };
}

/** Turns a completed response's output items into one chat message. */
export function fromResponsesOutput(output: any[]): ChatMessage {
    const text: string[] = [];
    const calls: ToolCall[] = [];
    for (const item of output || []) {
        if (item.type === "message")
            for (const part of item.content || [])
                if (part.type === "output_text") text.push(part.text);
        if (item.type === "function_call")
            calls.push({
                id: item.call_id,
                type: "function",
                function: {
                    name: item.name,
                    arguments: item.arguments || "{}",
                },
            });
    }
    return {
        role: "assistant",
        content: text.join("") || null,
        ...(calls.length ? { tool_calls: calls } : {}),
    };
}

/** Reads a server-sent event stream until the response completes. */
export async function readResponseStream(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let end: number;
        while ((end = buffer.indexOf("\n\n")) !== -1) {
            const chunk = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const data = chunk
                .split("\n")
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trim())
                .join("");
            if (!data || data === "[DONE]") continue;
            let event: any;
            try {
                event = JSON.parse(data);
            } catch {
                continue;
            }
            if (event.type === "response.completed")
                return fromResponsesOutput(event.response?.output);
            if (event.type === "response.failed" || event.type === "error")
                throw new Error(
                    event.response?.error?.message ||
                        event.error?.message ||
                        event.message ||
                        "ChatGPT couldn't finish."
                );
            if (event.type === "response.incomplete")
                throw new Error(
                    "ChatGPT stopped early. Your plan's limit for Oncyber may be used up."
                );
        }
        if (done) throw new Error("ChatGPT's answer was cut off.");
    }
}

const API = "https://api.openai.com/v1";

async function planError(response: Response) {
    const data = await response.json().catch(() => null);
    const code = data?.error?.code;
    if (code === "subscription_sharing_usage_limit_exceeded")
        return new Error(
            "You've used the share of your ChatGPT plan you gave Oncyber. Raise it in ChatGPT settings or wait for it to reset."
        );
    return new Error(
        data?.error?.message || `ChatGPT answered ${response.status}`
    );
}

/** The assistant on the visitor's ChatGPT plan (Responses API, streamed). */
export const chatgptProvider: AiProvider = {
    id: "chatgpt",
    label: "ChatGPT",
    async verify(token) {
        const response = await fetch(`${API}/models`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw await planError(response);
        const data = await response.json();
        const list: any[] = data.models || data.data || [];
        return list
            .filter((model) => !model.visibility || model.visibility === "list")
            .map((model) => model.slug || model.id)
            .filter(Boolean);
    },
    async complete({ key, model, messages, tools }, signal) {
        const { instructions, input } = toResponsesInput(messages);
        const response = await fetch(`${API}/responses`, {
            method: "POST",
            signal,
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                instructions,
                input,
                tools: tools.map((tool) => ({ type: "function", ...tool })),
                store: false,
                stream: true,
            }),
        });
        if (!response.ok) throw await planError(response);
        return readResponseStream(response.body);
    },
};

/** The key to use now: refreshes a ChatGPT token close to expiry. */
export async function currentAiKey(settings: ContributeSettings) {
    if (settings.aiProvider !== "chatgpt") return settings.aiKey;
    if (settings.aiExpiresAt && settings.aiExpiresAt - Date.now() > 5 * 60_000)
        return settings.aiKey;
    if (!settings.aiRefreshToken)
        throw new Error(
            "Your ChatGPT sign-in expired. Sign in again in settings."
        );
    try {
        const tokens = await refreshChatGPT(settings.aiRefreshToken);
        writeContributeSettings({
            aiKey: tokens.accessToken,
            aiRefreshToken: tokens.refreshToken || settings.aiRefreshToken,
            aiExpiresAt: tokens.expiresAt,
        });
        return tokens.accessToken;
    } catch {
        throw new Error(
            "Your ChatGPT sign-in expired. Sign in again in settings."
        );
    }
}
