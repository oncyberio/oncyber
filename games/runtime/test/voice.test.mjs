import assert from "node:assert/strict";
import test from "node:test";
import {
    connectVoice,
    readTalking,
    voiceMessage,
    VOICE_INTERVAL_MS,
    VOICE_PLAYERS_MAX,
} from "../src/voice.ts";

function fakePort() {
    const port = {
        posted: [],
        handlers: new Set(),
        post: (message) => port.posted.push(message),
        listen: (handler) => {
            port.handlers.add(handler);
            return () => port.handlers.delete(handler);
        },
        deliver: (data) => port.handlers.forEach((handler) => handler(data)),
    };
    return port;
}

test("voice poses become one bounded message for the page", () => {
    const message = voiceMessage("ace", { x: 1.234567, y: 2, z: 3, h: 0.5 }, [
        { id: "a", x: 1, y: 0, z: 0 },
        { id: "", x: 1, y: 0, z: 0 },
        { id: "b", x: NaN, y: 0, z: 0 },
    ]);
    assert.deepEqual(message, {
        type: "ace:voice",
        listener: { x: 1.23, y: 2, z: 3, h: 0.5 },
        players: [{ id: "a", x: 1, y: 0, z: 0 }],
    });
    assert.equal(voiceMessage("ace", { x: 0, y: 0 }, []), null);
    const many = Array.from({ length: 200 }, (_, i) => ({
        id: `p${i}`,
        x: i,
        y: 0,
        z: 0,
    }));
    assert.equal(
        voiceMessage("ace", { x: 0, y: 0, z: 0 }, many).players.length,
        VOICE_PLAYERS_MAX
    );
});

test("poses are sent at most ten times a second", () => {
    const port = fakePort();
    let time = 0;
    const voice = connectVoice("ace", { port, now: () => time });
    assert.equal(voice.setPoses({ x: 0, y: 1, z: 0 }), true);
    assert.equal(voice.setPoses({ x: 1, y: 1, z: 0 }), false);
    time += VOICE_INTERVAL_MS;
    assert.equal(
        voice.setPoses({ x: 2, y: 1, z: 0 }, [{ id: "a", x: 0, y: 0, z: 5 }]),
        true
    );
    assert.equal(port.posted.length, 2);
    assert.deepEqual(port.posted[1].players, [{ id: "a", x: 0, y: 0, z: 5 }]);
    // A malformed listener sends nothing and does not use up the interval.
    time += VOICE_INTERVAL_MS;
    assert.equal(voice.setPoses({ x: Infinity, y: 0, z: 0 }), false);
    assert.equal(voice.setPoses({ x: 0, y: 0, z: 0 }), true);
});

test("the game hears who is talking, and only from its own page messages", () => {
    const port = fakePort();
    const voice = connectVoice("ace", { port, now: () => 0 });
    const heard = [];
    const stop = voice.onTalking((ids, self) => heard.push([ids, self]));
    port.deliver({ type: "garden:talking", ids: ["x"] });
    port.deliver({ type: "ace:talking", ids: "x" });
    port.deliver({ type: "ace:talking", ids: ["a", 7, "me"], self: true });
    assert.deepEqual(heard, [[["a", "me"], true]]);
    assert.equal(voice.isTalking("a"), true);
    assert.equal(voice.isTalking("b"), false);
    assert.equal(voice.selfTalking, true);
    port.deliver({ type: "ace:talking", ids: [] });
    assert.deepEqual(voice.talking, []);
    assert.equal(voice.selfTalking, false);
    stop();
    port.deliver({ type: "ace:talking", ids: ["a"] });
    assert.equal(heard.length, 2);
    voice.dispose();
    assert.equal(port.handlers.size, 0);
    assert.equal(voice.setPoses({ x: 0, y: 0, z: 0 }), false);
    assert.equal(readTalking("ace", null), null);
});
