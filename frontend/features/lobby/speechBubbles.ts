import { lobbyTokens } from "@styles/tokens/lobby";

/** How long a line stays over its speaker, including the transitions. */
export const SPEECH_SHOW_MS = 6000;
/** The name tag hands over to the line (and back) over this long. */
const HANDOFF_MS = 320;
const MAX_BUBBLES = 24;

export interface SpeechLine {
    text: string;
    /** Date.now() when it was said. */
    at: number;
}

/**
 * 0 to 1 for a line `age` ms old: eases in as it appears, out as it leaves,
 * and 0 once it has expired. Drives the line and the name tag's lift together.
 */
export function speechPresence(age: number) {
    if (age < 0 || age >= SPEECH_SHOW_MS) return 0;
    const t = Math.min(
        1,
        age / HANDOFF_MS,
        (SPEECH_SHOW_MS - age) / HANDOFF_MS
    );
    return 1 - (1 - t) ** 3;
}

/** The newest public line per speaker that is still on screen. */
export function activeSpeech(
    messages: readonly {
        sessionId: string;
        text: string;
        sentAt: number;
        recipientId?: string;
    }[],
    now = Date.now()
): Record<string, SpeechLine> {
    const result: Record<string, SpeechLine> = {};
    for (const message of messages) {
        if (message.recipientId) continue;
        if (now - message.sentAt >= SPEECH_SHOW_MS) continue;
        const current = result[message.sessionId];
        if (!current || current.at <= message.sentAt)
            result[message.sessionId] = {
                text: message.text,
                at: message.sentAt,
            };
    }
    return result;
}

type Point = { x: number; y: number; z: number };
type Projector = (point: Point) => { x: number; y: number; visible: boolean };

/**
 * DOM lines over speakers' heads. Text in the DOM wraps and stays crisp; the
 * scene only moves each element with a transform once per frame.
 *
 * A line opens where the speaker's name tag sits and pushes the tag up to
 * ride on top of it; when the line goes, the tag settles back down. `liftOf`
 * tells the scene how far up (in CSS pixels) to draw each tag.
 */
export class SpeechBubbles {
    private readonly elements = new Map<
        string,
        { root: HTMLDivElement; text: string; height: number; lift: number }
    >();

    constructor(private readonly container: HTMLElement) {}

    /** Pixels the speaker's name tag should rise this frame. */
    liftOf(id: string) {
        return this.elements.get(id)?.lift ?? 0;
    }

    update(
        lines: Record<string, SpeechLine> | undefined,
        headOf: (id: string) => Point | undefined,
        project: Projector,
        now = Date.now()
    ) {
        const seen = new Set<string>();
        let shown = 0;
        for (const [id, line] of Object.entries(lines || {})) {
            if (shown >= MAX_BUBBLES) break;
            const presence = speechPresence(now - line.at);
            const head = presence > 0 ? headOf(id) : undefined;
            const screen = head && project(head);
            if (!screen?.visible) continue;
            seen.add(id);
            shown++;
            let entry = this.elements.get(id);
            if (!entry) {
                const root = document.createElement("div");
                root.setAttribute("aria-hidden", "true");
                Object.assign(root.style, {
                    position: "absolute",
                    left: "0",
                    top: "0",
                    maxWidth: "260px",
                    padding: "6px 18px 4px",
                    font: "500 15px/1.3 var(--font-sans, system-ui, sans-serif)",
                    color: lobbyTokens.speech.ink,
                    textAlign: "center",
                    textShadow: lobbyTokens.speech.textShadow,
                    background: lobbyTokens.speech.backdrop,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    pointerEvents: "none",
                    transformOrigin: "50% 100%",
                    willChange: "transform, opacity",
                });
                this.container.append(root);
                entry = { root, text: "", height: 0, lift: 0 };
                this.elements.set(id, entry);
            }
            if (entry.text !== line.text) {
                entry.text = line.text;
                entry.root.textContent =
                    line.text.length > 140
                        ? `${line.text.slice(0, 139)}…`
                        : line.text;
                // One layout read per new line, not per frame.
                entry.height = entry.root.offsetHeight;
            }
            entry.lift = entry.height * presence;
            entry.root.style.opacity = String(presence);
            // Bottom-centre sits where the name tag was; the line grows up
            // out of it while the tag rises.
            entry.root.style.transform = `translate(${Math.round(
                screen.x
            )}px, ${Math.round(
                screen.y + (1 - presence) * 10
            )}px) translate(-50%, -100%) scale(${(
                0.86 +
                0.14 * presence
            ).toFixed(3)})`;
        }
        for (const [id, entry] of this.elements)
            if (!seen.has(id)) {
                entry.root.remove();
                this.elements.delete(id);
            }
    }

    dispose() {
        for (const entry of this.elements.values()) entry.root.remove();
        this.elements.clear();
    }
}
