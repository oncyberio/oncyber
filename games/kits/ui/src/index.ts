// Behaviour for the kit's elements. No dependencies, no framework: each
// helper takes an element the game already has. The CSS works without any
// of this; these add the keyboard and state handling the brand guide asks
// for (arrow keys in a choice, Escape and focus return in a dialog).

export const KIT_PREFIX = "oui";

/** Where an arrow, Home or End key moves in a row of `count` options. */
export function nextIndex(count: number, index: number, key: string): number {
    if (count <= 0) return -1;
    const at = Math.max(0, Math.min(count - 1, index));
    switch (key) {
        case "ArrowRight":
        case "ArrowDown":
            return (at + 1) % count;
        case "ArrowLeft":
        case "ArrowUp":
            return (at - 1 + count) % count;
        case "Home":
            return 0;
        case "End":
            return count - 1;
        default:
            return at;
    }
}

type Options = { onChange?: (value: string) => void };

/**
 * A segmented choice: `<div class="oui-segmented">` with one
 * `<button data-value>` per option. Click or arrow keys choose; the chosen
 * button has `aria-pressed="true"` and is the group's one tab stop.
 */
export function segmented(group: HTMLElement, options: Options = {}) {
    const buttons = () => [
        ...group.querySelectorAll<HTMLElement>(":scope > button"),
    ];
    const valueOf = (button: HTMLElement) =>
        button.dataset.value ?? button.textContent ?? "";
    const render = (value: string) => {
        const all = buttons();
        const chosen = all.find((b) => valueOf(b) === value) ?? null;
        for (const button of all) {
            button.setAttribute("aria-pressed", String(button === chosen));
            button.tabIndex = button === (chosen ?? all[0]) ? 0 : -1;
        }
        return chosen;
    };
    const choose = (button: HTMLElement | undefined, focus: boolean) => {
        if (!button) return;
        const changed = button.getAttribute("aria-pressed") !== "true";
        render(valueOf(button));
        if (focus) button.focus();
        if (changed) options.onChange?.(valueOf(button));
    };
    const onClick = (event: Event) => {
        const button = (event.target as HTMLElement).closest<HTMLElement>(
            "button"
        );
        if (button && button.parentElement === group) choose(button, false);
    };
    const onKey = (event: KeyboardEvent) => {
        const all = buttons();
        const at = all.findIndex(
            (b) => b.getAttribute("aria-pressed") === "true"
        );
        const to = nextIndex(all.length, at, event.key);
        if (to === at || !/^(Arrow|Home|End)/.test(event.key)) return;
        event.preventDefault();
        choose(all[to], true);
    };
    group.setAttribute("role", group.getAttribute("role") ?? "group");
    group.addEventListener("click", onClick);
    group.addEventListener("keydown", onKey);
    const current = buttons().find(
        (b) => b.getAttribute("aria-pressed") === "true"
    );
    render(current ? valueOf(current) : "");
    return {
        get value() {
            const chosen = buttons().find(
                (b) => b.getAttribute("aria-pressed") === "true"
            );
            return chosen ? valueOf(chosen) : null;
        },
        /** Set the choice from code; does not call `onChange`. */
        set(value: string) {
            render(value);
        },
        destroy() {
            group.removeEventListener("click", onClick);
            group.removeEventListener("keydown", onKey);
        },
    };
}

/** A switch: `<button class="oui-toggle" role="switch">`. */
export function toggle(button: HTMLElement, onChange?: (on: boolean) => void) {
    const isOn = () => button.getAttribute("aria-checked") === "true";
    const set = (on: boolean) =>
        button.setAttribute("aria-checked", String(on));
    const onClick = () => {
        set(!isOn());
        onChange?.(isOn());
    };
    button.setAttribute("role", "switch");
    set(isOn());
    button.addEventListener("click", onClick);
    return {
        get on() {
            return isOn();
        },
        set,
        destroy: () => button.removeEventListener("click", onClick),
    };
}

/**
 * Open a `<dialog class="oui-dialog">` as a modal. The browser handles
 * Escape, the focus trap and returning focus. A `<button value="...">`
 * inside closes it; resolves with that value, or "" on Escape. (A game's
 * frame may not submit forms, so `<form method="dialog">` does nothing
 * there; plain buttons with a value do.)
 */
export function openDialog(dialog: HTMLDialogElement): Promise<string> {
    return new Promise((done) => {
        const onClick = (event: Event) => {
            const button = (
                event.target as HTMLElement
            ).closest<HTMLButtonElement>("button[value]");
            if (button && !button.disabled) dialog.close(button.value);
        };
        dialog.returnValue = "";
        dialog.addEventListener("click", onClick);
        dialog.addEventListener(
            "close",
            () => {
                dialog.removeEventListener("click", onClick);
                done(dialog.returnValue);
            },
            { once: true }
        );
        if (!dialog.open) dialog.showModal();
    });
}

let toastRegion: HTMLElement | null = null;

/**
 * Show a short notice for `ms` (default 3 s). Toasts share one polite live
 * region, so a screen reader hears them without losing focus.
 */
export function toast(
    message: string,
    {
        ms = 3000,
        root = document.body,
    }: { ms?: number; root?: HTMLElement } = {}
) {
    if (!toastRegion || !toastRegion.isConnected) {
        toastRegion = document.createElement("div");
        toastRegion.className = "oui-toasts";
        toastRegion.setAttribute("role", "status");
        toastRegion.setAttribute("aria-live", "polite");
        root.append(toastRegion);
    }
    const item = document.createElement("div");
    item.className = "oui-toast";
    item.textContent = message;
    toastRegion.append(item);
    const timer = setTimeout(() => item.remove(), ms);
    return () => {
        clearTimeout(timer);
        item.remove();
    };
}
