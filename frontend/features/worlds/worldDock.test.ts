import { dockMessage, readDock } from "./worldDock";

test("the world's buttons cross as how they look, never what they do", () => {
    const onClick = jest.fn();
    const sent = JSON.parse(
        JSON.stringify(
            dockMessage([
                {
                    id: "emotes",
                    label: "Emotes",
                    icon: "emote",
                    expanded: false,
                    onClick,
                    buttonRef: { current: null },
                } as any,
                { id: "people", label: "Users list", badge: 3, active: true },
                { id: "voice", label: "Enable microphone", shortcut: "KeyM" },
            ])
        )
    );
    expect(readDock(sent)).toEqual([
        { id: "emotes", label: "Emotes", icon: "emote", expanded: false },
        { id: "people", label: "Users list", active: true, badge: 3 },
        { id: "voice", label: "Enable microphone", shortcut: "KeyM" },
    ]);
    expect(JSON.stringify(sent)).not.toMatch(/onClick|buttonRef/);
});

test("the page takes only what it can draw safely", () => {
    expect(
        readDock({
            actions: [
                { id: "ok", label: "Fine", icon: "https://elsewhere/x.svg" },
                { id: "ok", label: "Twice" },
                { id: "Bad Id", label: "No" },
                { id: "long", label: "x".repeat(500) },
                { id: "flags", label: "Flags", active: "yes", badge: {} },
                // a world cannot hand out keys the browser needs
                { id: "keys", label: "Keys", shortcut: "Escape" },
                { id: "tab", label: "Tab", shortcut: "KeyT KeyW" },
                null,
            ],
        })
    ).toEqual([
        { id: "ok", label: "Fine" },
        { id: "flags", label: "Flags" },
        { id: "keys", label: "Keys" },
        { id: "tab", label: "Tab" },
    ]);
    expect(readDock({ actions: "nope" })).toEqual([]);
    expect(readDock(null)).toEqual([]);
    expect(
        readDock({
            actions: Array.from({ length: 40 }, (_, i) => ({
                id: `a${i}`,
                label: "A",
            })),
        })
    ).toHaveLength(16);
});
