export default function generateStaticPortals(exhibit) {
    if (
        exhibit.info.room !== "elevator-prototype" &&
        exhibit.info.room !== "ep_com" &&
        exhibit.info.room !== "ep_burn_15"
    )
        return exhibit.portals;

    const cHeroImg =
        "https://cyber.mypinata.cloud/ipfs/QmWeFxEfsEjUwyCGR9YYyybwVkjAUQNf6x3t1eTvd6fnxu?filename=Portal_Preview_008%2BUDX0AUIP0UBrFAKHMRP5.jpg";

    const cHeroImg360 =
        "https://cyber.mypinata.cloud/ipfs/QmNpGDtC9pEJSKFPPK1R8qbuBsJb4GYi84d92MyTBNuYEp?filename=Portal_Preview_008%2BUDX0AUIP0UBrFAKHMRP5.jpg";

    const addedBy = "0xc17f374a2a1d23e88b2911706279596dcc749efe";

    const level = (id, level, name, coords) => {
        return {
            cHeroImg,
            cHeroImg360,
            exhibitId: exhibit.id,
            id,
            level,
            name,
            coords,
        };
    };

    const portal = (id, coords) => {
        return {
            addedBy,
            cHeroImg,
            cHeroImg360,
            exhibitId: exhibit.id,
            id,
            isElevator: true,
            static: true,
            coords,
            levels: [
                level(
                    "Portal_Preview_007",
                    5,
                    "Space Lounge",
                    "-0.19x26.56x-32.22x-0.00"
                ),
                level(
                    "Portal_Preview_006",
                    4,
                    "Observation Circle",
                    "0.03x10.60x-31.95x-0.02"
                ),
                level(
                    "Portal_Preview_008",
                    3,
                    "Bridge: Main Entrance",
                    "0.05x2.77x-14.52x3.13"
                ),
                level(
                    "Portal_Preview_005",
                    2,
                    "Veranda Prime",
                    "0.01x-5.37x-32.16x-0.00"
                ),
                level(
                    "Portal_Preview_004",
                    1,
                    "Hydroponic Garden",
                    "0.13x-21.33x-31.70x0.02"
                ),
            ],
        };
    };

    const portals = {
        ...exhibit.portals,
        Portal_Preview_004: portal(
            "Portal_Preview_004",
            "0.13x-21.33x-31.70x0.02"
        ), // Floor 1: Hydroponyc garden
        Portal_Preview_005: portal(
            "Portal_Preview_005",
            "0.01x-5.37x-32.16x-0.00"
        ), // Floor 2: Veranda prime
        Portal_Preview_006: portal(
            "Portal_Preview_006",
            "0.03x10.60x-31.95x-0.02"
        ), // Floor 3: Observation circle
        Portal_Preview_007: portal(
            "Portal_Preview_007",
            "-0.19x26.56x-32.22x-0.00"
        ), // Floor 4: Space lounge
        Portal_Preview_008: portal(
            "Portal_Preview_008",
            "0.05x2.77x-14.52x3.13"
        ), // Bridge: Main enterance
    };

    return portals;
}
