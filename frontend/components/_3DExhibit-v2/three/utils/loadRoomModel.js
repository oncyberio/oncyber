// @ts-check
import { IS_ABORT_ERROR } from "./abort";

/**
 * Loads the selected room file, and when it cannot be read (an empty or
 * broken gateway answer), the room's other files in order. Room variants share
 * their geometry, so any of them can stand in. The first error is the one
 * reported when every file fails.
 *
 * @template T
 * @param {(url: string) => Promise<T>} load
 * @param {{ url: string }} selected
 * @param {Array<{ url: string }>} fallbacks
 * @returns {Promise<{ result: T, source: any }>}
 */
export async function loadRoomModel(load, selected, fallbacks = []) {
    let firstError;
    for (const source of [selected, ...fallbacks]) {
        try {
            return { result: await load(source.url), source };
        } catch (error) {
            if (IS_ABORT_ERROR(error)) throw error;
            firstError ??= error;
            console.warn(
                "[Room] could not load a room file, trying another",
                error
            );
        }
    }
    throw firstError;
}
