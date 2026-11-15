import type { GameEntry } from "./catalog";
import { gameDevice, type GameDevice } from "./gameHealth";

/**
 * Whether a game is offered on the visitor's device. A game lists the
 * devices it supports in `devices` (docs/games/devices.md) and the check
 * holds it to them, so a game reaches phones only once it passes there.
 *
 * A phone or tablet needs `phone` (touch controls). A desktop needs
 * `desktop`. A headset is not something a game can declare yet, so it is
 * let through.
 */
export function gameOnDevice(
    game: Pick<GameEntry, "devices">,
    device: GameDevice = gameDevice()
): boolean {
    if (device === "phone" || device === "tablet")
        return game.devices.includes("phone");
    if (device === "desktop") return game.devices.includes("desktop");
    return true;
}

/** "Padel isn't on phones yet." */
export function deviceNotice(title: string, device: GameDevice): string {
    const where =
        device === "phone"
            ? "phones"
            : device === "tablet"
            ? "tablets"
            : "this device";
    return `${title} isn’t on ${where} yet.`;
}
