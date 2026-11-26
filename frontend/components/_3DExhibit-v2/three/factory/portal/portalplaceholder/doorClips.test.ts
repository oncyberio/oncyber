import { findDoorClips } from "./doorClips";

const clips = (...names: string[]) => names.map((name) => ({ name }));
const names = (list: { name: string }[]) => list.map((clip) => clip.name);

describe("findDoorClips", () => {
    it("matches a three digit placeholder with four digit clips", () => {
        // The Starry Night: Portal_Preview_073, Portal_Open_0073
        const found = findDoorClips(
            clips(
                "Portal_Close_0074",
                "Portal_Open_0074",
                "Portal_Close_0073",
                "Portal_Open_0073",
                "Portal_Close_0072",
                "Portal_Open_0072"
            ),
            "073"
        );

        expect(names(found.open)).toEqual(["Portal_Open_0073"]);
        expect(names(found.close)).toEqual(["Portal_Close_0073"]);
    });

    it("matches whichever side carries the extra zeros", () => {
        const all = clips("Portal_Open_73", "Portal_Close_73");

        expect(names(findDoorClips(all, "0073").open)).toEqual([
            "Portal_Open_73",
        ]);
        expect(names(findDoorClips(all, "73").close)).toEqual([
            "Portal_Close_73",
        ]);
    });

    it("does not give a door the clips of a longer number", () => {
        const all = clips(
            "Portal_Open_173",
            "Portal_Close_173",
            "Portal_Open_0173",
            "Portal_Close_0173",
            "Portal_Open_730",
            "Portal_Close_730",
            "Portal_Open_0730",
            "Portal_Close_0730",
            "Portal_Open_7",
            "Portal_Close_7",
            "Portal_Open_3",
            "Portal_Close_3"
        );

        expect(findDoorClips(all, "73")).toEqual({ open: [], close: [] });
        expect(findDoorClips(all, "073")).toEqual({ open: [], close: [] });
    });

    it("gives the first doors their own clips, not those of the tens", () => {
        // The Starry Night again: doors 1 to 9 have three digit clips that
        // sit after the four digit ones, which the text of "Portal_Open_005"
        // is also the start of.
        const all = clips(
            "Portal_Close_0059",
            "Portal_Open_0059",
            "Portal_Close_0050",
            "Portal_Open_0050",
            "Portal_Close_005",
            "Portal_Open_005"
        );
        const found = findDoorClips(all, "005");

        expect(names(found.open)).toEqual(["Portal_Open_005"]);
        expect(names(found.close)).toEqual(["Portal_Close_005"]);
        expect(names(findDoorClips(all, "059").open)).toEqual([
            "Portal_Open_0059",
        ]);
    });

    it("keeps open and close apart", () => {
        const found = findDoorClips(
            clips("Portal_Close_012", "Portal_Open_012"),
            "012"
        );

        expect(names(found.open)).toEqual(["Portal_Open_012"]);
        expect(names(found.close)).toEqual(["Portal_Close_012"]);
    });

    it("puts the clip padded like the placeholder first", () => {
        const found = findDoorClips(
            clips("Portal_Open_0012", "Portal_Open_012", "Portal_Open_12"),
            "012"
        );

        expect(names(found.open)).toEqual([
            "Portal_Open_012",
            "Portal_Open_0012",
            "Portal_Open_12",
        ]);
    });

    it("still accepts text around the clip name, in any case", () => {
        const found = findDoorClips(
            clips(
                "Armature|Portal_Open_004",
                "Portal_Close_004.001",
                "portal_open_4",
                "Portal_Open_004b",
                "Portal_Open_0041"
            ),
            "004"
        );

        expect(names(found.open)).toEqual([
            "Armature|Portal_Open_004",
            "Portal_Open_004b",
            "portal_open_4",
        ]);
        expect(names(found.close)).toEqual(["Portal_Close_004.001"]);
    });

    it("treats all zeros as door zero", () => {
        const all = clips("Portal_Open_000", "Portal_Open_0", "Portal_Open_10");

        expect(names(findDoorClips(all, "00").open)).toEqual([
            "Portal_Open_000",
            "Portal_Open_0",
        ]);
    });

    it("finds nothing for a placeholder without a number", () => {
        const all = clips("Portal_Open_001", "Portal_Close_001");

        expect(findDoorClips(all, undefined)).toEqual({ open: [], close: [] });
        expect(findDoorClips(all, "")).toEqual({ open: [], close: [] });
        expect(findDoorClips(undefined, "001")).toEqual({
            open: [],
            close: [],
        });
    });
});
