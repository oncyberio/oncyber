/**
 * The values the games interface still writes in its own styles, by role,
 * taken from the design tokens (frontend/styles/tokens, docs/brand/tokens.md):
 * where a panel sits and how its text reads. No component here writes a
 * colour, a font stack or a duration in place.
 *
 * Everything a visitor can press, type in or follow, and the surfaces those
 * sit on, are the shared primitives in gameControls.tsx: the lobby's glass
 * and control material over the game, and the app's `ActionButton` in the
 * cards, dialogs and notices. This file is only what is left around them.
 */
import {
    actionTokens as action,
    baseTokens as base,
    lobbyTokens as lobby,
} from "@styles/tokens";

/** A CSS `font` value on the brand's sans, at a size from the type scale. */
const font = (
    weight: keyof typeof base.font.weight,
    size: keyof typeof base.font.size,
    lineHeight: number
) =>
    `${base.font.weight[weight]} ${base.font.size[size]}px/${lineHeight} ${action.type.family}`;

export const gameChrome = {
    color: {
        /** Behind a game, and behind what stands in for one. */
        frame: base.color.frame,
        ink: base.color.white,
        muted: base.color.muted,
        /** A solid panel on that backdrop: a card of the developer's page. */
        panel: lobby.glass.fallback,
        /** Hairlines between rows of a panel. */
        line: base.color.line.soft,
        lineStrong: base.color.line.strong,
        /** The empty part of a progress bar. */
        track: base.color.line.default,
        /** A developer's notice: something is paused, something failed. */
        warning: base.color.selectionEnd,
        error: base.color.accentCreate,
        good: base.color.selectionStart,
    },
    family: action.type.family,
    weight: base.font.weight,
    size: base.font.size,
    font: {
        /** Lines of text in a panel. */
        text: font("medium", "md", 1.35),
        /** A note under a control. */
        note: font("medium", "sm", 1.4),
        /** A title over a cover or a menu. */
        title: font("medium", "body", 1.3),
    },
    radius: {
        /** A bar of controls. */
        pill: action.radius.pill,
        /** A panel or a card over the game: the lobby's. */
        panel: lobby.panel.radius,
    },
    /** The lobby's blur behind a wash over the game. */
    blur: lobby.glass.blur,
    motion: {
        /** A cover or a panel coming and going. */
        fade: `${base.motion.standard}ms ${base.motion.ease}`,
        fadeMs: base.motion.standard,
        /** A bar following a value. */
        follow: `${base.motion.fast}ms linear`,
    },
} as const;
