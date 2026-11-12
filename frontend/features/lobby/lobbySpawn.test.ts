import { randomLobbySpawn, LOBBY_SPAWN_CENTER } from "./lobbySpawn";
import { travelDestinationTitle } from "./sceneTypes";

test("spawns land in a ring around the arrival centre, not on one point", () => {
    const spots = Array.from({ length: 50 }, () => randomLobbySpawn());
    for (const spot of spots) {
        const distance = Math.hypot(
            spot.x - LOBBY_SPAWN_CENTER.x,
            spot.z - LOBBY_SPAWN_CENTER.z
        );
        expect(distance).toBeGreaterThanOrEqual(0.8);
        expect(distance).toBeLessThanOrEqual(2.6 + 1e-9);
        expect(Math.abs(spot.rotation)).toBeLessThanOrEqual(0.35);
        expect(spot.y).toBe(0);
    }
    expect(
        new Set(spots.map((spot) => spot.x.toFixed(3))).size
    ).toBeGreaterThan(40);
});

test("travel title names the creator when it reads as a name", () => {
    expect(
        travelDestinationTitle({
            id: "1",
            href: "/twin",
            title: "twin flames",
            creator: "Justin Aversano",
        })
    ).toBe("to Justin Aversano’s twin flames");
    expect(
        travelDestinationTitle({
            id: "1",
            href: "/x",
            title: "Loft",
            creator: "Charles",
        })
    ).toBe("to Charles’ Loft");
    expect(
        travelDestinationTitle({
            id: "1",
            href: "/x",
            title: "Loft",
            creator: "0x1234abcd5678",
        })
    ).toBe("to Loft");
    expect(travelDestinationTitle(null)).toBe("to your destination");
});
