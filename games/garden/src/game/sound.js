// Sound requests from the game. Audio itself lives with the host (Web Audio
// in the browser, the native audio service elsewhere); the game only queues
// named cues and sends them through the runtime's "audio" capability.

export function createSound() {
    return { queue: [] };
}

export function play(sound, name, opts = {}) {
    if (!sound || sound.queue.length > 24) return;
    const cue = { n: name };
    for (const k of ["pitch", "adult", "sad", "gain", "go", "super"])
        if (opts[k] !== undefined) cue[k] = opts[k];
    sound.queue.push(cue);
}
