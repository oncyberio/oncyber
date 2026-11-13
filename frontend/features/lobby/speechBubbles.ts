import { lobbyTokens } from "@styles/tokens/lobby";

/** How long a line stays over its speaker, including the transitions. */
export const SPEECH_SHOW_MS = 6000;
/** The name tag gives way to the line (and returns) over this long. */
const HANDOFF_MS = 340;
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
    // Ease in and out, so the push starts and lands gently.
    return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
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

type Point = {
    x: number;
    y: number;
    z: number;
    /** The speaker's name and picture, as their name tag shows them. */
    name?: string;
    photo?: string;
};
type Projector = (point: Point) => {
    x: number;
    y: number;
    visible: boolean;
    /** CSS pixels per world metre at the point. */
    scale: number;
};

// The name tag's own measures (webgpu/nameTags.ts), so the line can stand
// exactly where the tag was: text height in metres, then sizes in ems of it.
const TAG_FONT_METRES = 0.081;
const PHOTO_EM = 1.9;
const GAP_EM = 0.37;
const BASE_PX = 16;
/** A message never gets smaller than this, however far the speaker is. */
const MIN_FONT_PX = 14;
/** How far the outgoing line travels, in ems. */
const SLIDE_EM = 1.25;
const tagName = (name: string, photo: boolean) => {
    if (name.startsWith("Anon-")) name = "Anon";
    return photo && name.length > 18 ? `${name.slice(0, 18)}...` : name;
};

/**
 * What someone just said, shown inside their name tag. The picture stays
 * put; the message comes up from below and pushes the name up and out, and
 * when it leaves it is pushed back down as the name returns.
 *
 * The name tag itself is drawn on the GPU, so while someone is `speaking`
 * the scene hides it and this draws a DOM twin in the same place and size.
 * Text in the DOM wraps and stays crisp; the scene only moves each element
 * with a transform once per frame.
 */
export class SpeechBubbles {
    private readonly elements = new Map<
        string,
        {
            root: HTMLDivElement;
            row: HTMLDivElement;
            backdrop: HTMLDivElement;
            image: HTMLImageElement;
            name: HTMLSpanElement;
            line: HTMLSpanElement;
            text: string;
            photo: string;
            nameText: string;
            /** Half the name's width plus the picture, in base pixels. */
            lead: number;
        }
    >();

    constructor(private readonly container: HTMLElement) {}

    /** True while a line stands in for this person's name tag. */
    speaking(id: string) {
        return this.elements.has(id);
    }

    private create() {
        const root = document.createElement("div");
        root.setAttribute("aria-hidden", "true");
        Object.assign(root.style, {
            position: "absolute",
            left: "0",
            top: "0",
            width: "0",
            height: "0",
            font: `700 ${BASE_PX}px/1.25 'SpaceGrotesk', Arial, sans-serif`,
            color: lobbyTokens.speech.ink,
            textShadow: lobbyTokens.speech.textShadow,
            pointerEvents: "none",
            transformOrigin: "0 0",
        });
        const row = document.createElement("div");
        Object.assign(row.style, {
            position: "absolute",
            left: "0",
            top: "0",
            display: "flex",
            alignItems: "center",
            gap: `${GAP_EM}em`,
            height: "1.25em",
            width: "max-content",
        });
        const backdrop = document.createElement("div");
        Object.assign(backdrop.style, {
            position: "absolute",
            inset: "-0.9em -1.6em",
            background: lobbyTokens.speech.backdrop,
        });
        const image = document.createElement("img");
        image.alt = "";
        image.decoding = "async";
        Object.assign(image.style, {
            position: "relative",
            width: `${PHOTO_EM}em`,
            height: `${PHOTO_EM}em`,
            borderRadius: "50%",
            objectFit: "cover",
            flex: "none",
            display: "none",
        });
        image.onerror = () => (image.style.display = "none");
        const words = document.createElement("div");
        Object.assign(words.style, {
            position: "relative",
            height: "1.25em",
        });
        const name = document.createElement("span");
        Object.assign(name.style, {
            display: "block",
            whiteSpace: "nowrap",
        });
        const line = document.createElement("span");
        Object.assign(line.style, {
            position: "absolute",
            left: "0",
            bottom: "0",
            width: "max-content",
            maxWidth: "17em",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
        });
        words.append(name, line);
        row.append(backdrop, image, words);
        root.append(row);
        this.container.append(root);
        return {
            root,
            row,
            backdrop,
            image,
            name,
            line,
            text: "",
            photo: "",
            nameText: "\u0000",
            lead: 0,
        };
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
                entry = this.create();
                this.elements.set(id, entry);
            }
            if (entry.text !== line.text) {
                entry.text = line.text;
                // The colon marks it as something said, not a name.
                entry.line.textContent = `: ${
                    line.text.length > 140
                        ? `${line.text.slice(0, 139)}…`
                        : line.text
                }`;
            }
            const photo = head.photo || "";
            const nameText = tagName(head.name || "Guest", !!photo);
            if (entry.photo !== photo || entry.nameText !== nameText) {
                entry.photo = photo;
                entry.nameText = nameText;
                entry.image.style.display = photo ? "block" : "none";
                if (photo) entry.image.src = photo;
                entry.name.textContent = nameText;
                // The tag centres the name and hangs the picture off its
                // left; one layout read per speaker, not per frame.
                entry.lead =
                    entry.name.offsetWidth / 2 +
                    (photo ? (PHOTO_EM + GAP_EM) * BASE_PX : 0);
            }
            // Starts at the tag's own size, and grows to a readable one when
            // the speaker is far away.
            const match = TAG_FONT_METRES * screen.scale;
            const size =
                match + (Math.max(match, MIN_FONT_PX) - match) * presence;
            const zoom = size / BASE_PX;
            // Sub-pixel positions: rounding made the line step a pixel at a
            // time against the smoothly moving avatar, which read as shaking.
            entry.root.style.transform = `translate3d(${screen.x.toFixed(
                2
            )}px, ${screen.y.toFixed(2)}px, 0) scale(${zoom.toFixed(4)})`;
            entry.row.style.transform = `translate(${(-entry.lead).toFixed(
                2
            )}px, -50%)`;
            entry.backdrop.style.opacity = presence.toFixed(3);
            entry.name.style.opacity = (1 - presence).toFixed(3);
            entry.name.style.transform = `translateY(${(
                -SLIDE_EM * presence
            ).toFixed(3)}em)`;
            entry.line.style.opacity = presence.toFixed(3);
            entry.line.style.transform = `translateY(${(
                SLIDE_EM *
                (1 - presence)
            ).toFixed(3)}em)`;
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
