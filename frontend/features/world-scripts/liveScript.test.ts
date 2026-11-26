import { followSavedScript, type Landed } from "./liveScript";
import { scriptEvent } from "./livePickup";

jest.mock("@utils/liveSpace", () => ({ liveSpace: jest.fn() }));
jest.mock("@api/worldScripts/_api", () => ({}));

const NOW = 1_795_700_000_000;
const STYLE = {
    summary: "Painted.",
    palette: ["#112233", "#ffcc00"],
    look: "painted",
    strokes: 1,
    wobble: 0,
    outline: true,
};

function open(start = { source: "a();", savedAt: 10 }) {
    let feed: (event: unknown) => void = () => {};
    let saved: any = {
        ok: true,
        source: start.source,
        style: null,
        savedAt: start.savedAt,
    };
    const runs: [string, string][] = [];
    const landed: Landed[] = [];
    const outcome: { ok: boolean; fault?: string }[] = [];
    const runtime = {
        run: jest.fn(async (source: string, mode: string) => {
            runs.push([source, mode]);
            return (outcome.shift() || { ok: true }) as any;
        }),
        stop: jest.fn(),
        setStyle: jest.fn(),
    };
    const reads = jest.fn(async () => saved);
    const stop = followSavedScript(
        "space-1",
        { ...start, style: null },
        runtime,
        (now) => landed.push(now),
        {
            watch: (_id, onEvent) => {
                feed = onEvent;
                return () => (feed = () => {});
            },
            read: reads,
            now: () => NOW,
            pause: async () => {},
        }
    );
    const settle = async () => {
        for (let i = 0; i < 20; i++) await Promise.resolve();
    };
    return {
        runtime,
        runs,
        landed,
        reads,
        outcome,
        stop,
        settle,
        /** The space is saved, and says so. */
        async save(
            source: string,
            savedAt: number,
            landing: any = "add",
            style: any = null
        ) {
            saved = { ok: true, source, style, savedAt: source ? savedAt : 0 };
            feed(scriptEvent(savedAt, landing, NOW));
            await settle();
        },
        hear: (event: unknown) => feed(event),
    };
}

describe("a world that is open follows its space's saved script", () => {
    test("a save is added to the running game: no rewind, no reload", async () => {
        const world = open();
        await world.save("b();", 20);
        expect(world.runs).toEqual([["b();", "keep"]]);
        expect(world.landed).toEqual([
            { source: "b();", style: null, savedAt: 20, as: "kept" },
        ]);
    });

    test("the saver can ask for the round to start again", async () => {
        const world = open();
        await world.save("b();", 20, "rewind");
        expect(world.runs).toEqual([["b();", "fresh"]]);
        expect(world.landed[0].as).toBe("fresh");
    });

    test("other events, and the notice of the save it started from, are not even read for", async () => {
        const world = open();
        // What the feed hands a newcomer: the notice of the save on show.
        world.hear(scriptEvent(10, "rewind", NOW));
        world.hear({ type: "EDITOR_ACTION", timestamp: NOW + 5000 });
        world.hear({ ...scriptEvent(20, "add", NOW), isServerEvent: false });
        await world.settle();
        expect(world.reads).not.toHaveBeenCalled();
        expect(world.runs).toEqual([]);
    });

    test("the editor's own world, already running what was saved, does nothing", async () => {
        const world = open();
        await world.save("a();", 20, "rewind");
        expect(world.reads).toHaveBeenCalledTimes(1);
        expect(world.runs).toEqual([]);
        expect(world.landed).toEqual([]);
        // And is not asked again for that save.
        world.hear(scriptEvent(20, "add", NOW));
        await world.settle();
        expect(world.reads).toHaveBeenCalledTimes(1);
    });

    test("a notice that lies about when cannot stop real saves being followed", async () => {
        const world = open();
        // Anyone who can write to the feed could say "saved far in the
        // future". It costs one read and changes nothing.
        world.hear(scriptEvent(NOW * 2, "rewind", NOW));
        await world.settle();
        expect(world.runs).toEqual([]);
        await world.save("b();", 20);
        expect(world.runs).toEqual([["b();", "keep"]]);
        expect(world.landed).toHaveLength(1);
    });

    test("a first script starts, and a script taken away stops", async () => {
        const world = open({ source: "", savedAt: 0 });
        await world.save("b();", 20);
        expect(world.runs).toEqual([["b();", "fresh"]]);
        await world.save("", 30);
        expect(world.runtime.stop).toHaveBeenCalledTimes(1);
        expect(world.landed.map((now) => now.as)).toEqual(["fresh", "stopped"]);
    });

    test("a new style alone redraws without restarting anything", async () => {
        const world = open();
        await world.save("a();", 20, "add", STYLE);
        expect(world.runs).toEqual([]);
        expect(world.runtime.setStyle).toHaveBeenCalledWith(STYLE);
        expect(world.landed[0]).toMatchObject({ as: "restyled", style: STYLE });
    });

    test("a script that cannot take the old game over starts a new round instead", async () => {
        const world = open();
        world.outcome.push({ ok: false, fault: "script" }, { ok: true });
        await world.save("b();", 20);
        expect(world.runs).toEqual([
            ["b();", "keep"],
            ["b();", "fresh"],
        ]);
        expect(world.landed[0].as).toBe("fresh");
    });

    test("a script that does not run leaves the old one, and the next save is still followed", async () => {
        const world = open();
        world.outcome.push(
            { ok: false, fault: "script" },
            { ok: false, fault: "script" }
        );
        await world.save("broken(", 20);
        expect(world.landed).toEqual([]);
        await world.save("c();", 30);
        expect(world.runs.at(-1)).toEqual(["c();", "keep"]);
        expect(world.landed).toHaveLength(1);
    });

    test("saves that come faster than they land end on the newest", async () => {
        const world = open();
        let release: (value: any) => void = () => {};
        world.reads.mockImplementationOnce(
            () => new Promise((resolve) => (release = resolve))
        );
        world.hear(scriptEvent(20, "add", NOW));
        world.hear(scriptEvent(30, "add", NOW));
        world.hear(scriptEvent(40, "rewind", NOW));
        world.reads.mockImplementation(async () => ({
            ok: true,
            source: "d();",
            style: null,
            savedAt: 40,
        }));
        release({ ok: true, source: "d();", style: null, savedAt: 40 });
        await world.settle();
        // Read once for the first notice, which already brought the newest
        // save. One of the saves on the way asked for a rewind, so it is
        // one; the notices that waited find nothing left to do.
        expect(world.runs).toEqual([["d();", "fresh"]]);
        expect(world.landed).toHaveLength(1);
    });

    test("a rewind heard after its save already landed as an addition still rewinds", async () => {
        const world = open();
        // The read is ahead of the feed: it brings save 30 on notice 20.
        world.reads.mockImplementation(async () => ({
            ok: true,
            source: "e();",
            style: null,
            savedAt: 30,
        }));
        world.hear(scriptEvent(20, "add", NOW));
        await world.settle();
        expect(world.runs).toEqual([["e();", "keep"]]);
        world.hear(scriptEvent(30, "rewind", NOW));
        await world.settle();
        expect(world.runs).toEqual([
            ["e();", "keep"],
            ["e();", "fresh"],
        ]);
        // Once: the same notice again changes nothing.
        world.hear(scriptEvent(30, "rewind", NOW));
        await world.settle();
        expect(world.runs).toHaveLength(2);
    });

    test("what an editor's sidebar already started is not started again by its own save", async () => {
        let feed: (event: unknown) => void = () => {};
        const runtime = {
            run: jest.fn(),
            stop: jest.fn(),
            setStyle: jest.fn(),
        };
        // The world loaded with a(); the sidebar has since started b().
        followSavedScript(
            "space-1",
            { source: "a();", style: null, savedAt: 10 },
            runtime as any,
            () => {},
            {
                watch: (_id, onEvent) => ((feed = onEvent), () => {}),
                read: async () => ({
                    ok: true,
                    source: "b();",
                    style: null,
                    savedAt: 20,
                }),
                now: () => NOW,
                pause: async () => {},
            },
            () => "b();"
        );
        feed(scriptEvent(20, "rewind", NOW));
        for (let i = 0; i < 20; i++) await Promise.resolve();
        expect(runtime.run).not.toHaveBeenCalled();
    });

    test("stops listening when the space goes off show", async () => {
        const world = open();
        world.stop();
        await world.save("b();", 20);
        expect(world.runs).toEqual([]);
    });
});
