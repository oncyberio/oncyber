// @ts-check
import { nodeEnv } from "@env";
import { formatExhibit } from "@utils/metadata/formatExhibit";
import DestinationService from "@api/destinations/_api";

export function getExhibitSlug(exhibit) {
    return exhibit?.info?.customLink || `s@${exhibit.id}`;
}

const API_PATH = nodeEnv.PUBLIC_API; //"http://localhost:3000";

export async function fetchExhibitData(id, type, query = {}) {
    let exhibit;
    let destination;

    if (id.startsWith("s@")) {
        id = id.slice(2);
        type = "id";
    }

    try {
        const url =
            type === "id"
                ? `${API_PATH}/api/exhibit?id=${id}&type=FETCH_SINGLE_EXHIBIT`
                : `${API_PATH}/api/exhibit?customLink=${id}&type=GET_EXHIBIT_BY_CUSTOM_LINK`;
        //console.log("/[slug] fetching exhibit", url);
        const response = await getJSON(url);

        if (response.success) {
            //console.log("/[slug] fetched exhibit", response);
            exhibit = formatExhibit(response.exhibit);
            exhibit = response.exhibit;
            exhibit.portalExhibits = {};
            exhibit.portalsDestinations = {};
            exhibit.portalsOwners = {};

            const portals = exhibit.portals
                ? Object.values(exhibit.portals)
                : null;

            if (portals?.length) {
                const exhibitIds = portals.map((p) => p.exhibitId);
                let [response, ownerResp] = await Promise.all([
                    postJSON(
                        `${API_PATH}/api/exhibit?type=GET_EXHIBITS_BY_IDS`,
                        { exhibitIds }
                    ),
                    getUserByWalletId(exhibit.owner),
                ]);

                if (ownerResp.success) {
                    exhibit.ownerData = ownerResp.user;
                }
                if (response.success) {
                    // Preload portal exhibits
                    const exhibits = response.exhibits;

                    exhibits.forEach((e) => {
                        e = formatExhibit(e);
                        exhibit.portalExhibits[e.id] = e;
                        exhibit.portalsOwners[e.owner.toLowerCase()] = null;
                        exhibit.portalsDestinations[e.info.room] = null;
                    });

                    // Preload portal destinations & exhibit owners
                    // TODO: Replace this with the "/destinations/all/slugs" once deployed on server
                    const noop = () => {};
                    await Promise.all([
                        Promise.all(
                            Object.keys(exhibit.portalsDestinations).map(
                                (room) =>
                                    getDestination(room)
                                        .then((dest) => {
                                            exhibit.portalsDestinations[room] =
                                                dest;
                                        })
                                        .catch(noop)
                            )
                        ),
                        getDestination(exhibit.info.room)
                            .then((d) => {
                                destination = d;
                            })
                            .catch(noop),
                        postJSON(`${API_PATH}/api/users`, {
                            walletIds: Object.keys(exhibit.portalsOwners),
                        })
                            .then((usersREsp) => {
                                if (usersREsp.success) {
                                    const users = usersREsp.users;
                                    for (let walletId in exhibit.portalsOwners) {
                                        // @ts-ignore
                                        exhibit.portalsOwners[walletId] =
                                            users.find(
                                                (it) =>
                                                    it.id.toLowerCase() ===
                                                    walletId.toLowerCase()
                                            ) || {
                                                walletId:
                                                    walletId.toLowerCase(),
                                            };
                                    }
                                }
                            })
                            .catch(noop),
                    ]);
                }
            }

            if (destination == null) {
                // console.log("/[slug] fetching destination", exhibit?.info.room);
                destination = await getDestination(exhibit?.info.room);
            }
        }
    } catch (e) {
        console.error("Failed to fetch exhibit page data", e.message);
        return {
            dest: null,
            experience: null,
        };
    }

    return {
        dest: destination || null,
        experience: exhibit || null,
    };
}

const usersCache = {};

export const getUserByWalletId = async (walletId) => {
    try {
        let response = usersCache[walletId];
        if (!response) {
            response = await fetch(
                `${API_PATH}/api/user/me?walletId=${walletId}`
            ).then((resp) => resp.json());

            if (response.success) {
                usersCache[walletId] = response;
            }
        }
        return response;
    } catch (e) {
        console.error(e);
        return { success: false, error: true };
    }
};

const roomsCache = {};

const pathToSlug = {
    "/models/CyberRoom/BB2.gltf": "classic",
    "/models/Warehouse/abandoned-new.gltf": "warehouse",
    "/models/Warehouse/abandoned-new-2.gltf": "warehouse-2",
    "/models/whitecube/basic.gltf": "white-cube",
    "/models/Wolfgang2/embedded.gltf": "wolfgang-n2",
    "/models/Falcon/falcon.gltf": "falcon",
    "/models/WhiteZephyr/artgallery_GLTF.gltf": "genesis_matic",
    "/models/Genesis/artgallery_GLTF.gltf": "genesis",
    "/models/Apes/club.gltf": "apesbar",
    "/models/Gutter_club/Gutter_Club.gltf": "gutter",
    "/models/WolfgangTemple/temple_GLTF.gltf": "temple",
};

const oldToNew = {
    temple: "temple_v2",
    classic: "classic_v2",
    warehouse: "warehouse_v2",
    "white-cube": "white-cube_v2",
    "wolfgang-n2": "wolfgang-n2_v2",
    falcon: "falcon_v2",
    genesis: "genesis_v2",
    apesbar: "apesbar_v2",
    gutter: "gutter_v2",
    void: "void_v2",
    mindds: "mindds_v2",
    altitude: "altitude_v2",
    sunshine: "sunshine_v2",
    ackbar: "ackbar_v2",
};

export const getDestination = async (roomId, prevDestination = {}) => {
    //
    if (roomId === prevDestination?.path || roomId === prevDestination?.slug) {
        return prevDestination;
    }

    // Some old exhibits have info.room pointing to a path
    let slug = pathToSlug[roomId] || roomId;

    let dest = roomsCache[slug];

    if (!dest) {
        // get rescaled room params if any
        let slugV2 = oldToNew?.[slug] || slug;

        let response = await fetch(
            `${nodeEnv.PUBLIC_API}/api/destinations/${slugV2}`
        ).then((resp) => resp.json());

        if (response.success) {
            dest = roomsCache[slug] = response.destination;
        } else {
            console.error("Failed to fetch room paramaters for", slug);
        }
    }

    return dest;
};

async function postJSON(url, body) {
    try {
        return fetch(url, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        }).then((resp) => resp.json());
    } catch (err) {
        return { success: false, message: err.message };
    }
}

async function getJSON(url) {
    try {
        return fetch(url).then((resp) => resp.json());
    } catch (err) {
        return { success: false, message: err.message };
    }
}

export async function checkSlugExists(slug) {
    try {
        const result = await DestinationService.checkSlugExists({ slug });
        return result?.exists ?? false;
    } catch (err) {
        return false;
    }
}
