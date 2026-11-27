/**
 * Devices: what a game's declared input bindings mean on a phone and on a
 * gamepad. Pure functions, no DOM: `deviceControls.ts` turns them into
 * on-screen controls and gamepad polling, and `pnpm games:check` uses the
 * same functions to drive and judge them. See docs/games/devices.md.
 */

export const DEVICES = ["desktop", "phone", "gamepad"] as const;
export type Device = (typeof DEVICES)[number];

/** The part of a session the device layer writes to. `RuntimeSession` is one. */
export interface InputSink {
    phase?: string;
    /** True while the page has paused the game's input (keys.ts); devices send nothing then. */
    inputPaused?: boolean;
    action(action: string, value?: number): void;
    delta?(action: string, value: number): void;
    clearInput?(): void;
}
export interface DeviceBinding {
    keyboard?: string[];
    touch?: string;
    gamepad?: string | string[];
}
export type DeviceInput = Record<string, DeviceBinding>;

/**
 * A touch binding the runtime draws:
 * `stick-up|down|left|right` (0..1), `stick-x|y` (-1..1, up and right
 * positive), `button` or `button:Label`. Any other string names a control
 * the game's own UI page provides through the UI bridge.
 */
export type TouchControl =
    | { kind: "stick"; axis: "x" | "y"; sign: -1 | 0 | 1 }
    | { kind: "button"; label: string };

const STICK: Record<string, { axis: "x" | "y"; sign: -1 | 0 | 1 }> = {
    "stick-up": { axis: "y", sign: 1 },
    "stick-down": { axis: "y", sign: -1 },
    "stick-left": { axis: "x", sign: -1 },
    "stick-right": { axis: "x", sign: 1 },
    "stick-x": { axis: "x", sign: 0 },
    "stick-y": { axis: "y", sign: 0 },
};

export function parseTouch(binding: unknown, action = ""): TouchControl | null {
    if (typeof binding !== "string") return null;
    if (Object.hasOwn(STICK, binding))
        return { kind: "stick", ...STICK[binding] };
    if (binding === "button")
        return { kind: "button", label: labelFor(action) };
    if (binding.startsWith("button:")) {
        const label = binding.slice(7).trim().slice(0, 12);
        return { kind: "button", label: label || labelFor(action) };
    }
    return null;
}
const labelFor = (action: string) =>
    action ? action[0].toUpperCase() + action.slice(1, 12) : "";

/** The standard gamepad mapping. Stick axes read up and right as positive. */
export type GamepadSource =
    | { kind: "button"; index: number }
    | { kind: "axis"; index: number; sign: -1 | 0 | 1; invert: boolean };

const PAD_BUTTONS = [
    "button-a",
    "button-b",
    "button-x",
    "button-y",
    "left-bumper",
    "right-bumper",
    "left-trigger",
    "right-trigger",
    "button-select",
    "button-start",
    "left-stick-press",
    "right-stick-press",
    "dpad-up",
    "dpad-down",
    "dpad-left",
    "dpad-right",
];
const PAD_STICKS: Record<string, number> = { left: 0, right: 2 };

export function parseGamepad(binding: unknown): GamepadSource | null {
    if (typeof binding !== "string") return null;
    const button = PAD_BUTTONS.indexOf(binding);
    if (button >= 0) return { kind: "button", index: button };
    const match = /^(left|right)-stick-(up|down|left|right|x|y)$/.exec(binding);
    if (!match) return null;
    const vertical = ["up", "down", "y"].includes(match[2]);
    const sign =
        match[2] === "up" || match[2] === "right"
            ? 1
            : match[2] === "down" || match[2] === "left"
            ? -1
            : 0;
    // Gamepad axes report down as positive; actions read up as positive.
    return {
        kind: "axis",
        index: PAD_STICKS[match[1]] + (vertical ? 1 : 0),
        sign,
        invert: vertical,
    };
}
export const gamepadBindings = (binding: DeviceBinding | undefined): string[] =>
    binding?.gamepad === undefined
        ? []
        : Array.isArray(binding.gamepad)
        ? binding.gamepad
        : [binding.gamepad];

export interface TouchLayout {
    stick: Array<{ action: string; axis: "x" | "y"; sign: -1 | 0 | 1 }>;
    buttons: Array<{ action: string; label: string }>;
    /** Actions whose touch binding is the game's own UI page's business. */
    custom: string[];
}
/** The on-screen controls a manifest's `input` asks for, in declared order. */
export function touchLayout(input: DeviceInput): TouchLayout {
    const layout: TouchLayout = { stick: [], buttons: [], custom: [] };
    for (const [action, binding] of Object.entries(input ?? {})) {
        if (binding?.touch === undefined) continue;
        const control = parseTouch(binding.touch, action);
        if (!control) layout.custom.push(action);
        else if (control.kind === "stick")
            layout.stick.push({
                action,
                axis: control.axis,
                sign: control.sign,
            });
        else layout.buttons.push({ action, label: control.label });
    }
    return layout;
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const directed = (value: number, sign: -1 | 0 | 1) =>
    round(sign === 0 ? value : Math.max(0, value * sign));

/** Stick deflection (x right, y up, each -1..1) as action values. */
export function stickValues(
    stick: TouchLayout["stick"],
    x: number,
    y: number
): Record<string, number> {
    const length = Math.hypot(x, y);
    if (length > 1) {
        x /= length;
        y /= length;
    }
    const values: Record<string, number> = {};
    for (const part of stick)
        values[part.action] = directed(part.axis === "x" ? x : y, part.sign);
    return values;
}

export interface PadState {
    buttons: ReadonlyArray<{ pressed: boolean; value?: number } | undefined>;
    axes: ReadonlyArray<number>;
}
export type GamepadMap = Array<{ action: string; sources: GamepadSource[] }>;

export function gamepadMap(input: DeviceInput): GamepadMap {
    const map: GamepadMap = [];
    for (const [action, binding] of Object.entries(input ?? {})) {
        const sources = gamepadBindings(binding)
            .map(parseGamepad)
            .filter((s): s is GamepadSource => s !== null);
        if (sources.length) map.push({ action, sources });
    }
    return map;
}

/**
 * Action values from one pad. With several bindings, the strongest wins.
 * Sticks have a radial dead zone and rescale so that full tilt is 1.
 */
export function readGamepad(
    map: GamepadMap,
    pad: PadState,
    deadZone = 0.2
): Record<string, number> {
    const sticks = [0, 2].map((first) => {
        const x = pad.axes[first] ?? 0,
            y = pad.axes[first + 1] ?? 0,
            length = Math.hypot(x, y);
        if (!(length > deadZone)) return [0, 0];
        const scale =
            Math.min(1, (length - deadZone) / (1 - deadZone)) / length;
        return [x * scale, y * scale];
    });
    const values: Record<string, number> = {};
    for (const { action, sources } of map) {
        let value = 0;
        for (const source of sources) {
            let next: number;
            if (source.kind === "button") {
                const button = pad.buttons[source.index];
                next = button?.pressed ? 1 : 0;
            } else {
                const raw = sticks[source.index >> 1][source.index & 1];
                next = directed(source.invert ? -raw : raw, source.sign);
            }
            if (Math.abs(next) > Math.abs(value)) value = next;
        }
        values[action] = value;
    }
    return values;
}

export interface DeviceFinding {
    code: string;
    message: string;
}

/**
 * What a game.json says about devices, and what is missing. Findings are
 * labels: only a failed run on a claimed device blocks a release.
 */
export function describeDevices(
    gameJson: { devices?: unknown; runtime?: { input?: DeviceInput } },
    scenarioActions: string[] = []
) {
    const findings: DeviceFinding[] = [];
    const declared: Device[] = [];
    if (gameJson.devices === undefined)
        findings.push({
            code: "DEVICES_UNDECLARED",
            message:
                'game.json has no "devices"; add the ones the game supports: desktop, phone, gamepad',
        });
    else if (!Array.isArray(gameJson.devices) || !gameJson.devices.length)
        findings.push({
            code: "DEVICES_INVALID",
            message: '"devices" must be a list such as ["desktop", "phone"]',
        });
    else
        for (const device of gameJson.devices) {
            if (!(DEVICES as readonly unknown[]).includes(device))
                findings.push({
                    code: "DEVICES_INVALID",
                    message: `unknown device ${JSON.stringify(
                        device
                    )}; use desktop, phone or gamepad`,
                });
            else if (!declared.includes(device as Device))
                declared.push(device as Device);
        }
    const input = gameJson.runtime?.input ?? {};
    const layout = touchLayout(input);
    const pad = gamepadMap(input);
    for (const [action, binding] of Object.entries(input))
        for (const name of gamepadBindings(binding))
            if (!parseGamepad(name))
                findings.push({
                    code: "GAMEPAD_BINDING_UNKNOWN",
                    message: `${action}: gamepad binding "${name}" is not a standard control`,
                });
    const touchable = new Set([
        ...layout.stick.map((s) => s.action),
        ...layout.buttons.map((b) => b.action),
    ]);
    const padded = new Set(pad.map((p) => p.action));
    const used = scenarioActions.filter((action) =>
        Object.hasOwn(input, action)
    );
    const missing = (have: Set<string>) => [
        ...new Set(used.filter((action) => !have.has(action))),
    ];
    if (declared.includes("phone") && missing(touchable).length)
        findings.push({
            code: "PHONE_ACTIONS_UNREACHABLE",
            message: `the scenario uses ${missing(touchable).join(
                ", "
            )} with no stick or button binding`,
        });
    if (declared.includes("gamepad") && missing(padded).length)
        findings.push({
            code: "GAMEPAD_ACTIONS_UNREACHABLE",
            message: `the scenario uses ${missing(padded).join(
                ", "
            )} with no gamepad binding`,
        });
    if (layout.custom.length)
        findings.push({
            code: "TOUCH_CUSTOM",
            message: `${
                layout.custom.length
            } action(s) name touch controls the runtime does not draw (${layout.custom
                .slice(0, 6)
                .join(", ")}${
                layout.custom.length > 6 ? ", ..." : ""
            }); the game's UI page must provide them`,
        });
    return {
        declared,
        findings,
        touch: layout,
        gamepad: pad.map((p) => p.action),
    };
}

/** Source lines that read touch or gamepad events themselves. */
export const DEVICE_CODE =
    /\b(?:touchstart|touchmove|touchend|touchcancel|ontouch(?:start|move|end)|getGamepads|gamepadconnected|gamepaddisconnected)\b|\bpointerType\b|\bnew\s+Touch(?:Event)?\b/;
export function scanDeviceCode(
    files: Array<{ path: string; text: string }>
): DeviceFinding[] {
    const findings: DeviceFinding[] = [];
    for (const file of files) {
        const lines = file.text.split("\n");
        const hits = lines.flatMap((line, index) =>
            DEVICE_CODE.test(line) ? [index + 1] : []
        );
        if (hits.length)
            findings.push({
                code: "DEVICE_CODE",
                message: `${file.path}:${
                    hits[0]
                } reads touch or gamepad input directly (${hits.length} line${
                    hits.length > 1 ? "s" : ""
                }); declare a binding in game.json instead`,
            });
    }
    return findings;
}
