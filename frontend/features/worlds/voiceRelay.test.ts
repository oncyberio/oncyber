/** @jest-environment node */
import { deserialize, serialize } from "v8";
import { RelayedVoiceProvider } from "./relayedVoice";
import { hostWorldVoice, type WorldVoiceView } from "./worldVoiceHost";
import {
    RelayedAudioPlayer,
    voiceAudioPlayer,
} from "@components/_3DExhibit-v2/three/factory/artwork/controllers/players";

jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    USER_INTERACTED: Promise.resolve(),
}));

/** The page's voice in a room, as the tests drive it. */
function fakeEngine() {
    const engine = {
        state: "off" as "off" | "live" | "muted" | "connecting",
        options: null as any,
        heard: [] as string[],
        gated: [] as [string, boolean][],
        level: new Map<string, number>(),
        listen: jest.fn(async () => {}),
        close: jest.fn(),
        updateVolumes: jest.fn(),
        published: () => engine.heard,
        setGated: (id: string, gated: boolean) =>
            void engine.gated.push([id, gated]),
        levels: { levels: () => engine.level.entries() },
        // the microphone, as the visitor's press moves it
        toggle: jest.fn(() => {
            engine.state = engine.state === "live" ? "muted" : "live";
            engine.options.onChange(engine.state, "");
        }),
        // someone in the room turns a microphone on or off
        publish(id: string, on = true) {
            engine.heard = on
                ? [...engine.heard, id]
                : engine.heard.filter((other) => other !== id);
            engine.options.onPublished(id, on);
        },
        volumeOf: (id: string) => engine.options.volume(id),
    };
    return engine;
}

/** A world and the page around it, with the frame between them. */
function frame() {
    const cross = (data: object) =>
        deserialize(new Uint8Array(serialize(data)));
    const toWorld = new Set<(kind: string, data: any) => void>();
    const engine = fakeEngine();
    const views: WorldVoiceView[] = [];
    let clock = 0;
    const host = hostWorldVoice({
        create: (options) => {
            engine.options = options;
            return engine as any;
        },
        post: (kind, data = {}) => {
            const copy = cross(data);
            [...toWorld].forEach((handler) => handler(kind, copy));
        },
        onChange: (view) => void views.push(view),
        now: () => clock,
    });
    const world = new RelayedVoiceProvider({
        send: (kind, data = {}) => host.receive(kind, cross(data)),
        listen: (handler) => {
            toWorld.add(handler);
            return () => void toWorld.delete(handler);
        },
    });
    return {
        host,
        world,
        engine,
        view: () => views.at(-1),
        advance(ms: number) {
            clock += ms;
            jest.advanceTimersByTime(ms);
        },
    };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("voice relayed through the page", () => {
    test("the page listens at once; the microphone waits for the world's rules and the page's button", async () => {
        const f = frame();
        expect(f.engine.listen).toHaveBeenCalled();
        // nobody may speak yet: the press is the world's to answer
        expect(f.host.press()).toBe(false);
        expect(f.engine.toggle).not.toHaveBeenCalled();

        await f.world.join({ isPublisher: true });
        expect(f.world.isVoiceEnabled()).toBe(true);
        expect(f.view().allowed).toBe(true);
        // allowed, and still off until the visitor presses the page's button
        expect(f.engine.toggle).not.toHaveBeenCalled();
        expect(f.world.isMuted()).toBe(true);

        expect(f.host.press()).toBe(true);
        expect(f.engine.state).toBe("live");
        expect(f.world.isMuted()).toBe(false);
        expect(f.view()).toMatchObject({ state: "live", allowed: true });
    });

    test("a world can mute its visitor and cannot unmute them", async () => {
        const f = frame();
        await f.world.join({ isPublisher: true });
        f.host.press();
        await f.world.setMuted(true);
        expect(f.engine.state).toBe("muted");
        expect(f.world.isMuted()).toBe(true);

        await f.world.setMuted(false);
        await f.world.enableVoice();
        expect(f.engine.state).toBe("muted");
    });

    test("a visitor a moderator has not let speak asks through the world, and is cut off when the leave is withdrawn", async () => {
        const f = frame();
        await f.world.join({ isPublisher: false });
        expect(f.view().allowed).toBe(false);
        expect(f.host.press()).toBe(false);

        await f.world.enableVoice(); // the moderator said yes
        expect(f.host.press()).toBe(true);
        expect(f.engine.state).toBe("live");

        await f.world.disableVoice(); // and then no
        expect(f.engine.state).toBe("muted");
        expect(f.view().allowed).toBe(false);
        expect(f.host.press()).toBe(false);
    });

    test("the world hears who has a microphone on, and plays them at the volume its own rules give", async () => {
        const f = frame();
        f.engine.publish("early"); // before the world's voice had joined
        await f.world.join({ isPublisher: true });
        const published: string[] = [];
        f.world.on("USER_PUBLISHED", (uid) => void published.push(uid));
        f.world.on("USER_UNPUBLISHED", (uid) => void published.push(`-${uid}`));
        expect(Object.keys(f.world.micStreams)).toEqual(["early"]);

        f.engine.publish("bob");
        expect(published).toEqual(["bob"]);
        // silent until the world says how loud
        expect(f.engine.volumeOf("bob")).toBe(0);

        const player = voiceAudioPlayer(f.world.micStreams.bob);
        expect(player).toBeInstanceOf(RelayedAudioPlayer);
        player.setVolume(0.6);
        expect(f.engine.volumeOf("bob")).toBe(0); // not playing yet
        player.play();
        expect(f.engine.volumeOf("bob")).toBeCloseTo(0.6);
        player.setVolume(0.605); // too small a step to say
        player.setVolume(0.3);
        expect(f.engine.volumeOf("bob")).toBeCloseTo(0.3);
        player.pause();
        expect(f.engine.volumeOf("bob")).toBe(0);
        expect(f.engine.updateVolumes).toHaveBeenCalled();

        f.engine.publish("bob", false);
        expect(published).toEqual(["bob", "-bob"]);
        expect(f.world.micStreams.bob).toBeUndefined();
    });

    test("how far this visitor's voice carries is the world's to say", async () => {
        const f = frame();
        await f.world.join({ isPublisher: true });
        f.world.setMicGated("far", true);
        f.world.setMicGated("far", true);
        f.world.setMicGated("far", false);
        expect(f.engine.gated).toEqual([
            ["far", true],
            ["far", false],
        ]);
    });

    test("the world is told who is talking", async () => {
        const f = frame();
        await f.world.join({ isPublisher: true });
        const seen: any[] = [];
        f.world.on("VOLUME_INDICATOR", (info) => void seen.push(info));
        f.engine.level.set("bob", 0.8);
        f.engine.level.set("quiet", 0.1);
        f.advance(200);
        expect(seen.at(-1)).toMatchObject({
            channel: "mic",
            volumes: {
                bob: { level: 0.8, isActive: true, inactiveTime: 0 },
                quiet: { level: 0.1, isActive: false, inactiveTime: Infinity },
            },
        });
        f.engine.level.set("bob", 0);
        f.advance(2000);
        expect(seen.at(-1).volumes.bob).toMatchObject({
            isActive: false,
            inactiveTime: 2000,
        });
    });

    test("leaving voice mutes the microphone; leaving the room ends the page's voice", async () => {
        const f = frame();
        await f.world.join({ isPublisher: true });
        f.host.press();
        void f.world.leave();
        expect(f.engine.state).toBe("muted");
        expect(f.view().allowed).toBe(false);
        f.host.dispose();
        expect(f.engine.close).toHaveBeenCalled();
    });

    test("a world cannot share a screen from inside the frame", async () => {
        const f = frame();
        expect(await f.world.setPlaying()).toBe(false);
        expect(f.world.isPlaying()).toBe(false);
        expect(f.world.loopbackStreams).toEqual({});
    });
});

test("a voice the engine holds itself still plays through its own player", () => {
    const AudioFake = class {
        srcObject: unknown = null;
        volume = 1;
    };
    (globalThis as any).Audio = AudioFake;
    const stream = { getTracks: () => [] };
    expect(voiceAudioPlayer(stream)).not.toBeInstanceOf(RelayedAudioPlayer);
    delete (globalThis as any).Audio;
});
