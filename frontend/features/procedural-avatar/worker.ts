import { CHARACTERS } from "./characters";
import { generateAvatar, transferables } from "./generate";

/**
 * Builds an avatar off the main thread. Ask with `{ id, detail }`; the
 * answer is `{ data }`, its buffers transferred, or `{ error }`.
 */
const scope = self as unknown as {
    onmessage: (event: MessageEvent<{ id: string; detail?: number }>) => void;
    postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = (event) => {
    try {
        const spec = CHARACTERS[event.data.id];
        if (!spec)
            throw new Error(`Unknown procedural avatar "${event.data.id}"`);
        const data = generateAvatar(spec, { detail: event.data.detail });
        scope.postMessage({ data }, transferables(data));
    } catch (error) {
        scope.postMessage({
            error: String((error as Error)?.message || error),
        });
    }
};
