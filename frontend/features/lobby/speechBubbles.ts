import { lobbyTokens } from "@styles/tokens/lobby";

/** How long a line stays over its speaker, including the transitions. */
export const SPEECH_SHOW_MS = 6000;
/** The name tag gives way to the line (and returns) over this long. */
const HANDOFF_MS = 220;
const MAX_BUBBLES = 24;

export interface SpeechLine {
    text: string;
    /** Date.now() when it was said. */
    at: number;
}

/**
 * 0 to 1 for a line `age` ms old: eases in as it appears, out as it leaves,
 * and 0 once it has expired.
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

type Point = { x: number; y: number; z: number; photo?: string };
type Projector = (point: Point) => { x: number; y: number; visible: boolean };

/**
 * What someone just said, shown in place of their name tag: their picture,
 * a colon, then the message, so it reads as speech and not as a name. The
 * scene hides the name tag while `speaking(id)` and shows it again after.
 *
 * Text in the DOM wraps and stays crisp; the scene only moves each element
 * with a transform once per frame.
 */
export class SpeechBubbles {
    private readonly elements = new Map<
        string,
        {
            root: HTMLDivElement;
            image: HTMLImageElement;
            label: HTMLSpanElement;
            text: string;
            photo: string;
        }
    >();

    constructor(private readonly container: HTMLElement) {}

    /** True while a line stands in for this person's name tag. */
    speaking(id: string) {
        return this.elements.has(id);
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
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "7px",
                    width: "max-content",
                    maxWidth: "280px",
                    padding: "6px 18px",
                    font: "700 15px/1.3 'SpaceGrotesk', var(--font-sans, system-ui, sans-serif)",
                    color: lobbyTokens.speech.ink,
                    textShadow: lobbyTokens.speech.textShadow,
                    background: lobbyTokens.speech.backdrop,
                    pointerEvents: "none",
                    transformOrigin: "50% 100%",
                    willChange: "transform, opacity",
                });
                const image = document.createElement("img");
                image.alt = "";
                image.decoding = "async";
                Object.assign(image.style, {
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    flex: "none",
                    display: "none",
                    boxShadow: lobbyTokens.speech.photoShadow,
                });
                image.onerror = () => (image.style.display = "none");
                const label = document.createElement("span");
                Object.assign(label.style, {
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    minWidth: "0",
                });
                root.append(image, label);
                this.container.append(root);
                entry = { root, image, label, text: "", photo: "" };
                this.elements.set(id, entry);
            }
            if (entry.text !== line.text) {
                entry.text = line.text;
                // The colon marks it as something said, not a name.
                entry.label.textContent = `: ${
                    line.text.length > 140
                        ? `${line.text.slice(0, 139)}…`
                        : line.text
                }`;
            }
            const photo = head.photo || "";
            if (entry.photo !== photo) {
                entry.photo = photo;
                entry.image.style.display = photo ? "block" : "none";
                if (photo) entry.image.src = photo;
            }
            // Starts part-visible: it takes over from the tag with no gap.
            entry.root.style.opacity = (0.3 + 0.7 * presence).toFixed(3);
            // Sub-pixel positions: rounding made the line step a pixel at a
            // time against the smoothly moving avatar, which read as shaking.
            entry.root.style.transform = `translate3d(${screen.x.toFixed(
                2
            )}px, ${screen.y.toFixed(2)}px, 0) translate(-50%, -100%) scale(${(
                0.8 +
                0.2 * presence
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
