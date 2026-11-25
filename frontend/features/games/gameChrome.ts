/**
 * What the page draws around and over a game, by role, taken from the
 * design tokens (frontend/styles/tokens, docs/brand/tokens.md). The game
 * page's controls, chat, credits, results card and gates read these instead
 * of writing a colour, a font stack or a duration in place.
 *
 * These are the lobby's values, because this is interface over a 3D scene:
 * the lobby's glass tint behind a bar of controls, its control fills, its
 * hairlines. The backdrop is the base set's frame colour, the same one the
 * loading cover uses. The page's own styles are still written inline, so
 * hover and focus states, and the shared action buttons
 * (`ActionButton`, `experienceControl`), are a redesign still to do; see
 * docs/games.md, "SDK and checks still owed".
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
        /** Text that is not the point of its panel. */
        secondary: base.color.secondary,
        muted: base.color.muted,
        /** A bar of controls floating over the game. */
        bar: lobby.glass.tint,
        /** A panel with lines to read: chat, the offer to follow a party. */
        panel: lobby.control.background,
        /** A card that covers play: a match's result. */
        card: lobby.control.notice,
        /** A dialog, and the wash over the game behind it. */
        dialog: lobby.glass.fallback,
        scrim: lobby.glass.tint,
        /** A small label over the game itself. */
        chip: lobby.control.chip,
        /** A button on any of those, at rest and raised. */
        control: base.color.line.default,
        controlRaised: lobby.control.pressed,
        /** A control that is on (the microphone), and a main action. */
        on: base.color.paper,
        onInk: base.color.paperInk,
        /** Hairlines between rows, and around a field. */
        line: base.color.line.soft,
        lineStrong: base.color.line.strong,
        /** The empty part of a progress bar. */
        track: base.color.line.default,
        /** A developer's notice: something is paused, something failed. */
        warning: base.color.selectionEnd,
        error: base.color.accentCreate,
    },
    shadow: lobby.glass.shadow,
    family: action.type.family,
    font: {
        /** A control's label, and a bar of them. */
        control: font("medium", "md", 1),
        /** Lines of text in a panel. */
        text: font("medium", "md", 1.35),
        /** A note under a control. */
        note: font("medium", "sm", 1.4),
        /** A title over a cover or a menu. */
        title: font("medium", "body", 1.3),
    },
    radius: { pill: action.radius.pill },
    motion: {
        /** A cover or a panel coming and going. */
        fade: `${base.motion.standard}ms ${base.motion.ease}`,
        fadeMs: base.motion.standard,
        /** A bar following a value. */
        follow: `${base.motion.fast}ms linear`,
    },
} as const;
