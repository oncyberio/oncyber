import { gamepadMap, readGamepad, stickValues, touchLayout, type DeviceInput, type InputSink, type PadState } from "./devices.ts";

/**
 * The browser half of devices: an on-screen stick and buttons on touch
 * screens, and gamepad polling, both built from the manifest's `input`
 * bindings. `bindBrowserInput` calls this, so a game on the runtime gets
 * them without device code of its own. See docs/games/devices.md.
 *
 * The controls are plain elements a game may restyle or hide from CSS
 * (`.oncyber-controls`, `[data-oncyber-stick]`, `[data-oncyber-action="jump"]`); every rule
 * here has zero specificity.
 */

/** Full stick deflection, in CSS pixels from where the touch began. */
const STICK_REACH = 46;

const STYLE = `
:where(.oncyber-controls){position:fixed;inset:0;z-index:2147483000;pointer-events:none;
  font:700 15px/1 system-ui,sans-serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
:where(.oncyber-controls *){box-sizing:border-box;touch-action:none;-webkit-tap-highlight-color:transparent}
:where(.oncyber-controls [data-oncyber-stick]){position:absolute;pointer-events:auto;width:148px;height:148px;
  left:max(16px,env(safe-area-inset-left));bottom:max(20px,env(safe-area-inset-bottom));display:grid;place-items:center}
:where(.oncyber-controls [data-oncyber-stick-base]){width:120px;height:120px;border-radius:50%;display:grid;place-items:center;
  border:3px solid rgba(255,255,255,.7);background:rgba(20,22,30,.3)}
:where(.oncyber-controls [data-oncyber-stick-knob]){width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.92);
  box-shadow:0 2px 8px rgba(0,0,0,.35);will-change:transform}
:where(.oncyber-controls [data-oncyber-buttons]){position:absolute;right:max(16px,env(safe-area-inset-right));
  bottom:max(20px,env(safe-area-inset-bottom));display:flex;flex-flow:row-reverse wrap-reverse;align-items:flex-end;
  justify-content:flex-start;gap:10px;max-width:min(240px,calc(100vw - 196px))}
:where(.oncyber-controls [data-oncyber-action]){pointer-events:auto;appearance:none;margin:0;padding:0;width:64px;height:64px;
  border-radius:50%;border:3px solid rgba(255,255,255,.7);background:rgba(20,22,30,.45);color:#fff;font:inherit;
  font-size:14px;overflow:hidden}
:where(.oncyber-controls [data-oncyber-action]:first-child){width:84px;height:84px;font-size:17px}
:where(.oncyber-controls [data-oncyber-action][data-oncyber-down]){background:rgba(255,255,255,.85);color:#14161e;transform:scale(.94)}
`;

export interface DeviceControls {
    dispose(): void;
    /** Builds the touch controls now, without waiting for a first touch. */
    showTouch(): void;
}

export function bindDeviceControls(sink: InputSink, input: DeviceInput, options: { root?: HTMLElement; deadZone?: number } = {}): DeviceControls {
    const layout = touchLayout(input);
    const pads = gamepadMap(input);
    const active = () => sink.phase === undefined || sink.phase === "entered";
    // What each device last sent, so a still gamepad never overrides the keyboard.
    const sent = { touch: {} as Record<string, number>, gamepad: {} as Record<string, number> };
    const log: Record<string, { device: string; value: number; count: number }> = Object.create(null);
    const send = (device: "touch" | "gamepad", values: Record<string, number>) => {
        for (const [action, value] of Object.entries(values)) {
            if ((sent[device][action] ?? 0) === value) continue;
            if (!active()) { if (value !== 0) continue; }
            sent[device][action] = value;
            try { sink.action(action, value); } catch { continue; }
            log[action] = { device, value, count: (log[action]?.count ?? 0) + 1 };
        }
    };
    const release = (device: "touch" | "gamepad") =>
        send(device, Object.fromEntries(Object.keys(sent[device]).map(action => [action, 0])));

    // ---------------------------------------------------------------- touch
    let container: HTMLElement | undefined, style: HTMLStyleElement | undefined;
    const cleanups: Array<() => void> = [];
    const on = (target: EventTarget, type: string, handler: (event: any) => void, opts?: AddEventListenerOptions) => {
        target.addEventListener(type, handler, opts);
        cleanups.push(() => target.removeEventListener(type, handler, opts));
    };
    const showTouch = () => {
        if (container || (!layout.stick.length && !layout.buttons.length)) return;
        style = document.createElement("style");
        style.textContent = STYLE;
        // First in <head>, so any rule of the game's wins.
        document.head.prepend(style);
        container = document.createElement("div");
        container.className = "oncyber-controls";
        container.setAttribute("data-oncyber-controls", "");
        // No compatibility mouse events, text selection or long-press menu.
        on(container, "touchstart", event => event.preventDefault(), { passive: false });
        on(container, "contextmenu", event => event.preventDefault());

        if (layout.stick.length) {
            const zone = document.createElement("div"), base = document.createElement("div"), knob = document.createElement("div");
            zone.setAttribute("data-oncyber-stick", layout.stick.map(part => part.action).join(" "));
            base.setAttribute("data-oncyber-stick-base", ""); knob.setAttribute("data-oncyber-stick-knob", "");
            base.append(knob); zone.append(base); container.append(zone);
            let pointer: number | null = null, originX = 0, originY = 0;
            const move = (event: PointerEvent) => {
                let dx = event.clientX - originX, dy = event.clientY - originY;
                const length = Math.hypot(dx, dy);
                if (length > STICK_REACH) { dx *= STICK_REACH / length; dy *= STICK_REACH / length; }
                knob.style.transform = `translate(${dx}px,${dy}px)`;
                send("touch", stickValues(layout.stick, dx / STICK_REACH, -dy / STICK_REACH));
            };
            const end = (event: PointerEvent) => {
                if (event.pointerId !== pointer) return;
                pointer = null; knob.style.transform = ""; zone.removeAttribute("data-oncyber-down");
                send("touch", stickValues(layout.stick, 0, 0));
            };
            on(zone, "pointerdown", (event: PointerEvent) => {
                if (pointer !== null) return;
                pointer = event.pointerId;
                // The stick starts from the middle of its base, so a press
                // off-centre already leans that way.
                const box = base.getBoundingClientRect();
                originX = box.left + box.width / 2; originY = box.top + box.height / 2;
                zone.setAttribute("data-oncyber-down", "");
                try { zone.setPointerCapture(event.pointerId); } catch { /* already gone */ }
                move(event);
            });
            on(zone, "pointermove", (event: PointerEvent) => { if (event.pointerId === pointer) move(event); });
            for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) on(zone, type, end);
        }
        if (layout.buttons.length) {
            const group = document.createElement("div");
            group.setAttribute("data-oncyber-buttons", "");
            for (const { action, label } of layout.buttons) {
                const button = document.createElement("button");
                button.type = "button"; button.tabIndex = -1;
                button.setAttribute("data-oncyber-action", action);
                button.setAttribute("aria-label", label);
                button.textContent = label;
                const held = new Set<number>();
                on(button, "pointerdown", (event: PointerEvent) => {
                    held.add(event.pointerId); button.setAttribute("data-oncyber-down", "");
                    try { button.setPointerCapture(event.pointerId); } catch { /* already gone */ }
                    send("touch", { [action]: 1 });
                });
                const up = (event: PointerEvent) => {
                    if (!held.delete(event.pointerId) || held.size) return;
                    button.removeAttribute("data-oncyber-down");
                    send("touch", { [action]: 0 });
                };
                for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) on(button, type, up);
                group.append(button);
            }
            container.append(group);
        }
        (options.root ?? document.body).append(container);
    };
    // Touch screens get the controls at once; anything else on its first touch.
    if (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) showTouch();
    const firstTouch = (event: PointerEvent) => { if (event.pointerType === "touch") showTouch(); };
    window.addEventListener("pointerdown", firstTouch, { capture: true, passive: true });

    // -------------------------------------------------------------- gamepad
    let frame = 0, alive = true, padsAllowed = pads.length > 0 && typeof navigator !== "undefined" && "getGamepads" in navigator;
    const poll = () => {
        if (!alive || !padsAllowed) return;
        frame = requestAnimationFrame(poll);
        let list: ReadonlyArray<PadState | null>;
        // A frame without the gamepad permission throws; stop asking.
        try { list = navigator.getGamepads() as any; } catch { padsAllowed = false; return; }
        const merged: Record<string, number> = {};
        for (const pad of list) {
            if (!pad || (pad as any).connected === false) continue;
            for (const [action, value] of Object.entries(readGamepad(pads, pad, options.deadZone)))
                if (Math.abs(value) > Math.abs(merged[action] ?? 0) || !(action in merged)) merged[action] = value;
        }
        // No pad connected: let go of anything a pad was holding.
        if (Object.keys(merged).length) send("gamepad", merged); else release("gamepad");
    };
    if (padsAllowed) frame = requestAnimationFrame(poll);

    const blur = () => { sent.touch = {}; sent.gamepad = {}; };
    window.addEventListener("blur", blur);
    // For the check and for debugging: what the devices last sent.
    const debug = { log, layout, pads: pads.map(pad => pad.action), reach: STICK_REACH, showTouch };
    (window as any).__oncyberDevices = debug;
    return {
        showTouch,
        dispose() {
            alive = false; cancelAnimationFrame(frame);
            window.removeEventListener("pointerdown", firstTouch, { capture: true });
            window.removeEventListener("blur", blur);
            for (const cleanup of cleanups.splice(0)) cleanup();
            container?.remove(); style?.remove(); container = style = undefined;
            if ((window as any).__oncyberDevices === debug) delete (window as any).__oncyberDevices;
        },
    };
}
