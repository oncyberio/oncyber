import { actionTokens } from "@styles/tokens/action";
import { lobbyTokens } from "@styles/tokens/lobby";
import { LOBBY_GUEST_PORTRAIT } from "./lobbyIdentity";
import {
    PAD_EM,
    PHOTO_INSET_EM,
    tagName as nameOnTag,
} from "@features/name-tags/layout";

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

// The name tag's own measures (features/name-tags), so the line can stand
// exactly where the tag was.
const TAG = lobbyTokens.nameTag;
const BASE_PX = 16;
/** A message never gets smaller than this, however far the speaker is. */
const MIN_FONT_PX = 14;
/** How far the outgoing line travels, in ems. */
const SLIDE_EM = 1.25;
/** The tag's font size on screen for `scale` CSS pixels per metre. */
const tagPx = (scale: number) =>
    Math.min(TAG.maxPx, Math.max(TAG.minPx, TAG.fontMetres * scale));

/**
 * What someone just said, shown in place of their name tag. The message
 * comes up from below and pushes the whole tag, picture and name, up and
 * out; when it leaves it is pushed back down as the tag returns. The message
 * stands alone, centred over the speaker.
 *
 * The name tag itself is drawn in the scene, so while someone is `speaking`
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
            bubble: HTMLDivElement;
            line: HTMLSpanElement;
            text: string;
            photo: string;
            nameText: string;
            /** Rim width last written, in pre-scale pixels. */
            rim: string;
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
        // The tag's chip: picture and name in the menu rows' glass.
        const row = document.createElement("div");
        Object.assign(row.style, {
            position: "absolute",
            left: "0",
            top: "0",
            display: "flex",
            alignItems: "center",
            gap: `${TAG.gapEm}em`,
            width: "max-content",
            boxSizing: "border-box",
            height: `${TAG.photoEm + 2 * PHOTO_INSET_EM}em`,
            padding: `0 ${PAD_EM}em`,
            borderRadius: "999px",
            background: TAG.fill,
            color: TAG.ink,
            font: `500 1em/1 ${actionTokens.type.family}`,
            textShadow: "none",
        });
        // The message hangs from the tag's baseline, centred on the speaker,
        // and grows upward when it wraps.
        const bubble = document.createElement("div");
        Object.assign(bubble.style, {
            position: "absolute",
            left: "0",
            top: "0",
            width: "max-content",
            maxWidth: "17em",
            textAlign: "center",
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
            width: `${TAG.photoEm}em`,
            height: `${TAG.photoEm}em`,
            background: TAG.photoFill,
            borderRadius: "50%",
            objectFit: "cover",
            flex: "none",
            display: "none",
        });
        // A dead photo gets the guest portrait once, like the tag; only a
        // failed portrait leaves the pill without a picture.
        image.onerror = () => {
            if (!image.src.endsWith(LOBBY_GUEST_PORTRAIT))
                image.src = LOBBY_GUEST_PORTRAIT;
            else image.style.display = "none";
        };
        const name = document.createElement("span");
        Object.assign(name.style, {
            display: "block",
            whiteSpace: "nowrap",
            maxWidth: `${TAG.maxNameEm}em`,
            overflow: "hidden",
            textOverflow: "ellipsis",
        });
        const line = document.createElement("span");
        Object.assign(line.style, {
            position: "relative",
            display: "block",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
        });
        row.append(image, name);
        bubble.append(backdrop, line);
        root.append(row, bubble);
        this.container.append(root);
        return {
            root,
            row,
            backdrop,
            image,
            name,
            bubble,
            line,
            text: "",
            photo: "",
            nameText: "\u0000",
            rim: "",
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
                entry.line.textContent =
                    line.text.length > 140
                        ? `${line.text.slice(0, 139)}…`
                        : line.text;
            }
            // The tag shows the guest portrait when there is no photo.
            const photo = head.photo || LOBBY_GUEST_PORTRAIT;
            const nameText = nameOnTag(head.name || "Guest");
            if (entry.photo !== photo || entry.nameText !== nameText) {
                entry.photo = photo;
                entry.nameText = nameText;
                entry.image.style.display = photo ? "block" : "none";
                if (photo) entry.image.src = photo;
                entry.name.textContent = nameText;
                entry.row.style.paddingLeft = photo
                    ? `${PHOTO_INSET_EM}em`
                    : `${PAD_EM}em`;
            }
            // Starts at the tag's own size, and grows to a readable one when
            // the speaker is far away.
            const match = tagPx(screen.scale);
            const size =
                match + (Math.max(match, MIN_FONT_PX) - match) * presence;
            const zoom = size / BASE_PX;
            // The rim stays 1.5 screen pixels however the pill scales.
            const rim = (1.5 / zoom).toFixed(2);
            if (entry.rim !== rim) {
                entry.rim = rim;
                entry.row.style.boxShadow = `inset 0 0 0 ${rim}px ${TAG.rim}, ${TAG.shadow}`;
            }
            // Sub-pixel positions: rounding made the line step a pixel at a
            // time against the smoothly moving avatar, which read as shaking.
            entry.root.style.transform = `translate3d(${screen.x.toFixed(
                2
            )}px, ${screen.y.toFixed(2)}px, 0) scale(${zoom.toFixed(4)})`;
            // The whole tag leaves upward as the message arrives from below.
            entry.row.style.opacity = (1 - presence).toFixed(3);
            entry.row.style.transform = `translate(-50%, calc(-50% - ${(
                SLIDE_EM * presence
            ).toFixed(3)}em))`;
            entry.bubble.style.opacity = presence.toFixed(3);
            entry.bubble.style.transform = `translate(-50%, calc(0.625em - 100% + ${(
                SLIDE_EM *
                (1 - presence)
            ).toFixed(3)}em))`;
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
