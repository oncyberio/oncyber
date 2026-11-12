/**
 * Which open window answers the Escape key.
 *
 * The rule: Escape closes the top-most open window, one window per press, by
 * the same path as that window's own close control. A window that offers no
 * way to close (it is forced open, or work that cannot be undone is running)
 * ignores Escape on purpose, and no window beneath it closes instead.
 *
 * `Modal` and `AnimatedModal` register here. The decisions are pure
 * (`closesOnEscape`, `resolveEscape`) so they are tested as tables; the stack
 * and its one document listener are at the bottom of the file.
 */

/** What a window tells the stack about itself. */
export interface StackedWindow {
    /** True when the node is inside the window. */
    contains: (node: Node | null) => boolean;
    /** False while Escape must not close the window. */
    canClose: () => boolean;
    /** The window's own close path: what its close control calls. */
    close: () => void;
    /**
     * True while something that is not on this stack is open above the
     * window and closes itself. For modals that is a shared dialog from
     * `components/Dialogs`.
     */
    isCovered?: () => boolean;
}

/** The ways a window can be closed, as its props declare them. */
export interface CloseControls {
    /** The window must stay open (for example a forced sign-in). */
    forceOpen?: boolean;
    /** A close callback exists at all. */
    hasClosePath: boolean;
    /** The window draws its own close button. */
    hasCloseButton: boolean;
    /** The window has a visible backdrop that closes it when clicked. */
    hasBackdropClose: boolean;
    /** Labelled windows already closed on Escape before the stack existed. */
    labelled: boolean;
    /**
     * The window's explicit answer. `false` while something irreversible is
     * running; `true` for a window whose only close control is in its content.
     */
    closeOnEscape?: boolean;
}

/**
 * Escape does what the window's own close control does, so a window with no
 * close control stays closed to Escape.
 */
export function closesOnEscape({
    forceOpen,
    hasClosePath,
    hasCloseButton,
    hasBackdropClose,
    labelled,
    closeOnEscape,
}: CloseControls): boolean {
    if (forceOpen || !hasClosePath) return false;
    if (closeOnEscape != null) return closeOnEscape;
    return hasCloseButton || hasBackdropClose || labelled;
}

/**
 * - `pass`: not the stack's key press; the event is left untouched.
 * - `defer`: pressed inside the top window; its content answers first and
 *   the window finishes in the bubble phase.
 * - `hold`: the top window keeps the key from everything beneath it, but
 *   stays open.
 * - `close`: the top window closes and nothing else sees the key.
 */
export type EscapeAction = "pass" | "defer" | "hold" | "close";

export interface EscapePress {
    key: string;
    /** An input method is composing text; Escape belongs to it. */
    composing: boolean;
    /** The key is held down. One press closes one window. */
    repeat: boolean;
    /** At least one window is open. */
    hasWindow: boolean;
    /** Something outside the stack is open above the top window. */
    covered: boolean;
    /** Pressed inside an open menu or combobox, which closes itself. */
    inPopup: boolean;
    /**
     * Where the key was pressed relative to the top window, and which
     * listener is asking: the document (capture) or the window (bubble).
     */
    origin: "outside" | "inside-capture" | "inside-bubble";
    /** Something inside the window already answered (`preventDefault`). */
    handledInside: boolean;
    /** The top window may be closed by Escape right now. */
    canClose: boolean;
}

export function resolveEscape(press: EscapePress): EscapeAction {
    if (press.key !== "Escape" || press.composing) return "pass";
    if (!press.hasWindow || press.covered || press.inPopup) return "pass";
    // Ignored on purpose. Passing rather than holding keeps a wallet prompt
    // or any other overlay drawn above the window able to close itself.
    if (!press.canClose) return "pass";
    if (press.origin === "inside-capture") return "defer";
    if (press.handledInside || press.repeat) return "hold";
    return "close";
}

/** An open menu, or the expanded control that owns a menu or a listbox. */
const POPUP =
    '[role="menu"], [role="combobox"][aria-expanded="true"], [aria-haspopup]:not([aria-haspopup="false"])[aria-expanded="true"]';

/** A key event as the DOM or React hands it over. */
type KeyPress = {
    key: string;
    target: EventTarget | null;
    preventDefault: () => void;
    stopPropagation: () => void;
    nativeEvent?: KeyboardEvent;
};

const stack: StackedWindow[] = [];

const topWindow = () => stack[stack.length - 1];

/**
 * True while a stacked window is open. A panel that handles Escape itself
 * and sits beneath these windows checks this and leaves the key to them.
 */
export const hasOpenWindow = () => stack.length > 0;

function answer(
    event: KeyPress,
    origin: EscapePress["origin"],
    win: StackedWindow | undefined
) {
    const native = (event.nativeEvent || event) as KeyboardEvent;
    const target = event.target;
    const action = resolveEscape({
        key: event.key,
        composing: native.isComposing || native.keyCode === 229,
        repeat: native.repeat,
        hasWindow: win != null,
        covered: !!win?.isCovered?.(),
        inPopup: target instanceof Element && target.closest(POPUP) != null,
        origin,
        handledInside: origin === "inside-bubble" && native.defaultPrevented,
        canClose: !!win?.canClose(),
    });
    if (action === "pass" || action === "defer") return;
    event.stopPropagation();
    if (action !== "close") return;
    event.preventDefault();
    win.close();
}

function onDocumentKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    const top = topWindow();
    const inside = !!top?.contains(event.target as Node);
    answer(event, inside ? "inside-capture" : "outside", top);
}

/**
 * Puts a window on top of the stack. Call the returned function when the
 * window closes.
 */
export function openWindow(win: StackedWindow): () => void {
    if (stack.length === 0) {
        document.addEventListener("keydown", onDocumentKeyDown, true);
    }
    stack.push(win);
    return () => {
        const index = stack.lastIndexOf(win);
        if (index !== -1) stack.splice(index, 1);
        if (stack.length === 0) {
            document.removeEventListener("keydown", onDocumentKeyDown, true);
        }
    };
}

/**
 * The window's own `onKeyDown`. It runs after the controls inside the window,
 * so an input or menu that answers Escape itself is not overridden, and
 * before anything outside it.
 */
export function escapeInsideWindow(win: StackedWindow, event: KeyPress) {
    if (event.key !== "Escape" || topWindow() !== win) return;
    answer(event, "inside-bubble", win);
}
