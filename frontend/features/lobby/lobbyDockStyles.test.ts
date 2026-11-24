/** @jest-environment node */
import fs from "fs";
import path from "path";

const read = (file: string) =>
    fs.readFileSync(path.join(__dirname, "..", "..", file), "utf8");
const flat = (text: string) => text.replace(/\s+/g, " ");

// An open panel stands on the dock, exactly where the hover labels appear.
// Hiding only the open button's own label left the others coming up
// underneath the panel.
test("no dock label shows while a panel is open, in the lobby or in a space", () => {
    expect(flat(read("features/lobby/lobbyDockStyles.ts"))).toContain(
        '.dock-bar:has([aria-expanded="true"]) .dock-item > span, .dock-item:has([aria-expanded="true"]) > span { animation: none; opacity: 0; visibility: hidden; }'
    );
    expect(flat(read("features/content-host/ExperienceShell.tsx"))).toContain(
        '.experience-dock:has([aria-expanded="true"]) .experience-tooltip { animation: none; opacity: 0; visibility: hidden; }'
    );
    // A space's utility panels are not tied to an expanded dock button.
    expect(
        flat(read("features/content-host/NativeExperienceChrome.tsx"))
    ).toContain(
        "&:has([data-native-utility-panel]) .experience-tooltip { animation: none; opacity: 0; visibility: hidden; }"
    );
});

test("every lobby dock button that opens a panel says so", () => {
    const lobby = read("features/lobby/Lobby.tsx");
    for (const state of [
        "avatarOpen",
        "emotesOpen",
        "flashOpen",
        "peopleOpen",
        "exploreOpen",
    ])
        expect(lobby).toContain(`aria-expanded={${state}}`);
});
