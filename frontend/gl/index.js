// @ts-check

import Events from "@3events";

import World from "@3gl/api";

import { APP_STATES } from "@3constants";

import { fetchExhibitData } from "./fetchExhibitData";

import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@3constants";

// import { fetchExhibitData } from "@utils/ssr";

async function getSpaceData(spaceId) {
    const key = "/" + spaceId;

    const cache = await caches.open("fast-data");

    let response = await cache.match(key);

    if (response == null) {
        let data = await fetchExhibitData(spaceId, "slug");

        if (!data?.experience || !data.dest) {
            throw new Error(
                "Couldn't fetch exhibit data.\nMake sure the next api server is running"
            );
        }

        response = new Response(JSON.stringify(data), {
            headers: {
                "content-type": "application/json",
            },
        });

        cache.put(key, response.clone());
    }

    return response.json();
}

export async function load3DSpace({ spaceId }) {
    try {
        const rd = "radomusername" + Math.random();

        const user = {
            username: rd,
            user: { id: rd },
            token: "",
            avatar: DEFAULT_PLAYER_AVATAR_PICTURE,
        };

        const userData = {
            username: user?.user.id || user?.username || "",

            avatar: user?.avatar,

            walletId: user?.user.id || "",

            VRM: "https://cyber.mypinata.cloud/ipfs/QmdBvFQ8QBdGyYSif7vuwZdeVmghhJehVGKbZKLRQRfyds?filename=summer_unlit_fixed_scaled2_kltkfa.glb",
        };

        const MultiplayerService = {
            roomService: null, // room currently has both voice and room service
        };

        MultiplayerService.roomService = (await import("@utils/arena")).default;

        MultiplayerService.onCommand = function () {};

        if (window.location.search.includes("multiplayer=true")) {
            await MultiplayerService.roomService.joinMatch("cyber", {
                label: spaceId,
                username: user.username,
                avatar: user.avatar,
                userId: user.user.id,
                token: "",
                currentSpace: spaceId,
                position: { x: 0, y: 0, z: 0 },
                rotationY: 0,
                VRM: userData.VRM,
            });
        }

        document.body.innerHTML = `
            <h1>Loading&hellip;</h1>
        `;
        let { experience: exhibit, dest: destination } = await getSpaceData(
            spaceId
        );

        let world = await World.getInstance({});

        // TODO: Replace this with button play click
        window.addEventListener(
            "click",
            () => {
                world.setUserInteracted();
            },
            { once: true }
        );

        let sceneContainer = document.createElement("div");

        sceneContainer.style.position = "absolute";
        sceneContainer.style.left = "0";
        sceneContainer.style.top = "0";
        sceneContainer.style.right = "0";
        sceneContainer.style.bottom = "0";

        sceneContainer.appendChild(world.canvas);

        document.body.textContent = "";
        document.body.appendChild(sceneContainer);

        window.addEventListener("resize", () => {
            world.resize({
                w: sceneContainer.clientWidth,
                h: sceneContainer.clientHeight,
            });
        });

        world.resize({
            w: sceneContainer.clientWidth,
            h: sceneContainer.clientHeight,
        });

        const options = await world.setOptions({
            editMode: false,
            uploaderMode: false,
            mode: "solo",
            user: {
                userData: {},
                id: "guest",
                token: "",
            },
        });

        await world.play();

        world.setCurrentUser({
            userData,
            id: user?.user.id,
            token: "",
        });

        await world.loadState(APP_STATES.INTRO);

        await world.setState(APP_STATES.INTRO);

        let mainPlayer = await world.loadMainPlayer({
            userData: {
                ...userData,
                ...options,
                username: userData?.username || "guest",

                avatar: userData?.avatar || DEFAULT_PLAYER_AVATAR_PICTURE,

                VRM: userData?.VRM || "",

                walletId: userData?.walletId || "",
            },
            roomParameters: destination,
            exhibit,
        });

        let space = await world.loadSpace({
            roomParameters: destination,
            exhibit,
        });

        console.log("loaded space", {
            roomParameters: destination,
            exhibit,
        });

        console.log("loaded main player", mainPlayer);

        let backOpts = {};

        await world.setState(APP_STATES.SPACE, {
            userData: userData,
            user: {
                id: user?.user.id,
            },
            roomParameters: destination,
            exhibit,
            space,
            mainPlayer,
            ...backOpts,
        });

        if (window.location.search.includes("multiplayer=true")) {
            world.setMultiplayer({
                mode: "multiplayer",
                roomParameters: destination,
                userData: userData,
                exhibit,
                user: {
                    id: user?.user.id,
                },
                editMode: false,
                MultiplayerService,
            });
        }

        world.canvas.addEventListener("click", (ev) => {
            if (document.pointerLockElement) {
                document.exitPointerLock();
            } else {
                world.canvas.requestPointerLock();
            }
        });

        world.setEventListener(Events.PORTAL_TELEPORT_REQUEST, (opts) => {
            world.setState(APP_STATES.TELEPORT, opts);
        });

        world.setThirdPerson({ enabled: true });

        // window.world = world;

        // await world.setState(APP_STATES.EXPOSITION, { next: true } );

        // await world.setState(APP_STATES.SPACE, {});
    } catch (err) {
        console.error(err);
        setError(err.message);
    }
}

const spaceId = location.pathname.slice(1);

if (spaceId) {
    console.log("spaceId", spaceId);
    load3DSpace({ spaceId });
} else {
    setError("No space id was specified");
}

function setError(error) {
    document.body.innerHTML = `
        <h1 style="color: red">${error}</h1>
    `;
}
