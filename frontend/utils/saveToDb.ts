import { User } from "@uitypes/user";
import { PROFANITY } from "@utils/chat/profanity";
import { UserContextState } from "@context/UserContext";
import { RoomParameters } from "@uitypes/roomParameters";
import { WalletConnection } from "@dapp/connect";
import {
    amplitude_logUserExhibits,
    amplitude_logAnalyticsEvent,
} from "./analytics";
import { nodeEnv } from "@env";
import { delay, eachKey, getJSON } from "./js";
import { formatExhibit } from "./metadata/formatExhibit";
import { KitBashData, Stylekit } from "@uitypes/experience";
import { EMPTY_ROOM } from "./emptyRoom";
import AccountsAPI from "@api/accounts/_api";
import DestinationService from "@api/destinations/_api";
import AssetService from "@api/asset/_api";
import { getDefaultEmptyRoomData } from "@3factory/space/roomdatacompat";
/*
    Utility functions to construct partial updates to send to the backend

    Problem: By sending the whole exhibit object we risk overwriting updates of concurrent users

    Solution: We construct special objects which instructs the backend to perform a path based update
              i.e. the data sent willbe merged with the actual state in the database

    To instruct the backend this is a partial update use `pathUpdate(update)` functions, example

        pathUpdate({
            artworks: {
                [asset_id]: {
                    addedBy: "me"
                    data: {

                        scale: 2
                    }
                }
            }
        })

    will generate the folowing updates

        ["artworks", asset_id, "addedBy"] : "me"
        ["artworks", asset_id, "data", "scale"] : 2

    Sometime when an object is newly inserted (added new artwork) we can add the whole object to the
    indicated path slot, in this case use the function SetField, example

        pathUpdate({
            artworks: {
                [asset_id]: SetField(newAsset)
            }
        })

    will generate the following updates

        ["artworks", asset_id] : newAsset

    instead of generating a path update for each field in newAsset

    Other times we want to delete field, we use DeleteField special value, for example to remove an artwork

        pathUpdate({
            artworks: {
                [asset_id]: DeleteField
            }
        })

*/

export const DeleteField = { FIRESTORE_DELETE_Field: true };

export const SetField = (value) => ({ FIRESTORE_SET_Field: true, value });

export function pathUpdate(update: object) {
    return {
        FIRESTORE_UPDATE_Field: true,
        update,
    };
}

export function addAsset(assetId: string, asset: object) {
    return {
        FIRESTORE_ADD_ASSET: true,
        assetId,
        asset,
    };
}

export function replaceAsset(assetId: string, asset: object) {
    return {
        FIRESTORE_REPLACE_ASSET: true,
        assetId,
        asset,
    };
}

export function updateAsset(assetId: string, update: object) {
    return {
        FIRESTORE_UPDATE_ASSET: true,
        assetId,
        update,
    };
}

export function deleteAsset(assetId: string) {
    return {
        FIRESTORE_DELETE_ASSET: true,
        assetId,
    };
}

export function updatePortal(portalId: string, update: object) {
    return {
        FIRESTORE_UPDATE_PORTAL: true,
        portalId,
        update,
    };
}

export function deletePortal(portalId: string) {
    return {
        FIRESTORE_DELETE_PORTAL: true,
        portalId,
    };
}

export function resetKitBash(data: Record<string, KitBashData>) {
    return {
        FIRESTORE_RESET_KITBASH: true,
        data,
    };
}

export function updateKitBash(id: string, update: object) {
    return {
        FIRESTORE_UPDATE_KITBASH: true,
        id,
        update,
    };
}

export function deleteKitBash(id: string) {
    return {
        FIRESTORE_DELETE_KITBASH: true,
        id,
    };
}

// export function portalUpdate(portalId: string, update: object) {
//     return {
//         FIRESTORE_UPDATE_Field: true,
//         update: {
//             portals: {
//                 [portalId]: update,
//             },
//         },
//     };
// }

function queryParams(params: object) {
    let urlParams = new URLSearchParams();
    for (let key in params) {
        let value = params[key];
        if (value != null) {
            urlParams.set(key, value);
        }
    }
    return urlParams.toString();
}

export const updateExhibitInfo = async (id, info, token) => {
    const payload = pathUpdate({ info });

    return await fetch(`/api/exhibit?id=${id}&type=UPDATE_EXHIBIT`, {
        method: "POST",
        body: JSON.stringify({
            token,
            payload,
        }),
        credentials: "include",
    }).then((data) => {
        return data;
    });
};

export const updateExhibitGating = async (id, gating, token) => {
    const payload = pathUpdate({ gating });

    return await fetch(`/api/exhibit?id=${id}&type=UPDATE_EXHIBIT`, {
        method: "POST",
        body: JSON.stringify({
            token,
            payload,
        }),
        credentials: "include",
    }).then((data) => {
        return data;
    });
};

export const updateExhibitParams = async (id, params, token) => {
    //
    params = eachKey(params, (v, key) => {
        //
        if (v == null) return DeleteField;

        return v;
    });

    const payload = pathUpdate({ params });

    return await fetch(`/api/exhibit?id=${id}&type=UPDATE_EXHIBIT`, {
        method: "POST",
        body: JSON.stringify({
            token,
            payload,
        }),
        credentials: "include",
    }).then((data) => {
        return data;
    });
};

export const disableExhibitGating = async (id, token) => {
    const payload = pathUpdate({ gating: DeleteField });

    return await fetch(`/api/exhibit?id=${id}&type=UPDATE_EXHIBIT`, {
        method: "POST",
        body: JSON.stringify({
            token,
            payload,
        }),
        credentials: "include",
    }).then((data) => {
        return data;
    });
};

export const getExhibit = async (id) => {
    try {
        if (id) {
            const response = await fetch(
                `/api/exhibit?id=${id}&type=FETCH_SINGLE_EXHIBIT`
            );
            const data = await response.json();

            if (data.exhibit) {
                return { ...data, exhibit: formatExhibit(data.exhibit) };
            }
            return data;
        } else return { error: true };
    } catch (e) {
        return { error: true };
    }
};

/**
 * The preview fields (owner, info, gating) of several exhibits in one GET,
 * which the CDN may cache. Rejects when the request fails, so a caller can
 * fall back to full reads.
 */
export const getExhibitPreviews = async (ids: string[]) => {
    const list = Array.from(new Set((ids || []).filter(Boolean))).sort();
    if (!list.length) return [];
    const response = await fetch(
        `/api/exhibit?type=GET_EXHIBITS_BY_IDS&ids=${list
            .map(encodeURIComponent)
            .join(",")}`
    );
    const data = await response.json();
    if (!data?.success) throw new Error("Failed to load portal previews");
    return (data.exhibits || [])
        .filter((exhibit) => exhibit?.id && exhibit.info)
        .map(formatExhibit);
};

/**
 * Public profiles (id, walletId, username, avatar, description) for many
 * wallets in one request, keyed by lower-case wallet id. Wallets without a
 * profile are absent. Throws when the request fails.
 */
export const getUserProfiles = async (
    walletIds: string[]
): Promise<Record<string, any>> => {
    const list = Array.from(
        new Set((walletIds || []).filter(Boolean).map((id) => id.toLowerCase()))
    );
    if (!list.length) return {};
    const response: any = await AccountsAPI.getUsers({
        type: "users",
        walletIds: list,
    });
    if (!response?.success) throw new Error("Failed to load profiles");
    const byWallet: Record<string, any> = {};
    for (const profile of Object.values(response.editors || {}) as any[]) {
        const id = (profile?.walletId || profile?.id || "").toLowerCase();
        if (id) byWallet[id] = profile;
    }
    return byWallet;
};

export const getExhibitByCustomLink = async (customLink) => {
    try {
        if (customLink) {
            const response = await fetch(
                `/api/exhibit?customLink=${customLink}&type=GET_EXHIBIT_BY_CUSTOM_LINK`
            );
            const data = await response.json();

            if (data.exhibit) {
                return { ...data, exhibit: formatExhibit(data.exhibit) };
            }
            return data;
        } else return { error: true };
    } catch (e) {
        return { error: true };
    }
};

export const addUserRaffle = async (raffleId: number) => {
    try {
        const response = await fetch(`/api/commerce/raffle?type=RUA`, {
            method: "POST",
            body: JSON.stringify({ raffleId }),
            credentials: "include",
        });
        const data = await response.json();
        return data;
    } catch (e) {
        return { error: true };
    }
};

export const uploadCinematic = async (cinematic, slug: string) => {
    try {
        const response = await fetch(`/api/cinematic/add?slug=${slug}`, {
            method: "POST",
            body: JSON.stringify({ cinematic }),
            credentials: "include",
        });
        const data = await response.json();
        return data;
    } catch (e) {
        return { error: true };
    }
};

export const deleteCinematic = async (slug: string) => {
    try {
        const response = await fetch(`/api/cinematic/delete?slug=${slug}`, {
            method: "DELETE",
            credentials: "include",
        });
        const data = await response.json();
        return data;
    } catch (e) {
        return { error: true };
    }
};

export const updateCinematic = async (
    cinematic,
    slug?: string,
    id?: string
) => {
    try {
        const params = new URLSearchParams();
        if (slug) {
            params.append("slug", slug);
        }
        if (id) {
            params.append("id", id);
        }
        const response = await fetch(
            `/api/cinematic/update?${params.toString()}`,
            {
                method: "POST",
                body: JSON.stringify({ cinematic }),
                credentials: "include",
            }
        );
        const data = await response.json();
        return data;
    } catch (e) {
        console.error("err", e);
        return { error: true };
    }
};

export const getUserRaffle = async (raffleId: number) => {
    try {
        const response = await fetch(`/api/commerce/raffle?type=GURS`, {
            method: "POST",
            body: JSON.stringify({ raffleId }),
            credentials: "include",
        });
        const data = await response.json();
        return data;
    } catch (e) {
        return { error: true };
    }
};

export const getRaffleState = async () => {
    try {
        const response = await fetch(`/api/commerce/raffle?type=RS`, {
            method: "POST",
            credentials: "include",
        });
        const data = await response.json();
        return data;
    } catch (e) {
        return { error: true };
    }
};

export const createExhibit = async (userId, token, room, headline = "") => {
    //
    room = oldToNew[room] || room;

    try {
        const response = await fetch(`/api/exhibit?type=CREATE_EXHIBIT`, {
            method: "POST",
            body: JSON.stringify({ userId, token, room }),
            credentials: "include",
        });
        const data = await response.json();
        return data;
    } catch (e) {
        return { error: true };
    }
};

export async function uploadOverwrite(file, fileMetadata, assetId, exhibitId) {
    console.log(assetId, exhibitId);

    const response = await AssetService.uploadOverwriteAsset({
        exhibitId,
        assetId,
        file,
        fileMetadata,
    });

    return response;
}

const roomsCache: Record<string, RoomParameters> = {
    [EMPTY_ROOM.slug]: EMPTY_ROOM,
};

export const pathToSlug = {
    "/models/CyberRoom/BB2.gltf": "classic",
    "/models/Warehouse/abandoned-new.gltf": "warehouse",
    "/models/Warehouse/abandoned-new-2.gltf": "warehouse",
    "/models/whitecube/basic.gltf": "white-cube",
    "/models/Wolfgang2/embedded.gltf": "wolfgang-n2",
    "/models/Falcon/falcon.gltf": "falcon",
    "/models/WhiteZephyr/artgallery_GLTF.gltf": "genesis_matic",
    "/models/Genesis/artgallery_GLTF.gltf": "genesis",
    "/models/Apes/club.gltf": "apesbar",
    "/models/Gutter_club/Gutter_Club.gltf": "gutter",
    "/models/WolfgangTemple/temple_GLTF.gltf": "temple",
};

export const oldToNew = {
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

export const newToOld = {};

Object.keys(oldToNew).forEach((key) => {
    newToOld[oldToNew[key]] = key;
});

export function getSlug(roomId) {
    return pathToSlug[roomId] || roomId;
}

export function getAlgoliaSlug(room) {
    const slug = getSlug(room);
    return newToOld[slug] || slug;
}

export const getDestination = async (
    roomId: string,
    prevDestination?: UserContextState["destination"],
    noCache?: boolean
): Promise<RoomParameters> => {
    //
    const slug = pathToSlug[roomId] || roomId;

    let slugV2 = oldToNew?.[slug] || slug;

    if (slugV2 === prevDestination?.path || slugV2 === prevDestination?.slug) {
        return prevDestination as RoomParameters;
    }

    let destination = roomsCache[slugV2];

    if (noCache || !destination) {
        try {
            const response = await fetch(
                `${nodeEnv.PUBLIC_API}/api/destinations/${slugV2}`
            ).then((resp) => resp.json());

            if (!response.success) {
                throw new Error("Destination not found");
            }

            destination = response.destination;
            roomsCache[slugV2] = destination;
        } catch (err) {
            console.error("Failed to fetch room paramaters for", slug, err);
            return null;
        }
    }

    return destination;
};

export const getCinematic = async (id, slug) => {
    try {
        const resp = await fetch(
            `${nodeEnv.PUBLIC_API}/api/cinematic?id=${id}&slug=${slug}`
        );
        // Awaited so a malformed body lands in the catch below.
        return await resp.json();
    } catch (err) {
        console.error("Failed to fetch cinematic", err);
        return { success: false, cinematic: {} };
    }
};

export const getSharedAssets = async (walletId, exhibitId) => {
    try {
        let data = await AssetService.getSharedAssets({
            walletId,
            exhibitId,
        });

        if (data.success) {
            // remove duplicate assets
            data.assets = data.assets.filter((value, index, array) => {
                const _id = value.token_address + value.token_id;

                return !data.assets
                    .slice(index + 1, array.length)
                    .find((_asset) => {
                        const id = _asset.token_address + _asset.token_id;
                        return _id === id;
                    });
            });
        }

        return data;
    } catch (err) {
        return { error: true };
    }
};

export const saveSharedAssets = async (
    sharedAssets,
    walletId,
    invitedWalletId,
    exhibitId,
    inviteId,
    token
) => {
    try {
        const data = await AssetService.saveSharedAssets({
            sharedAssets,
            walletId,
            invitedWalletId,
            exhibitId,
            inviteId,
        });

        return data;
    } catch (e) {
        return { error: true };
    }
};

export const getAssets = async (
    userId,
    offset,
    blockchain: WalletConnection["type"]
) => {
    //snowfro
    if (userId.toLowerCase() == "0xf3860788d1597cecf938424baabe976fac87dc26") {
        userId = "0xC896866E927e6F8a416Ba209976115E79fA0a66F";
    } else if (
        // vonmises1
        userId.toLowerCase() == "0x8dbbca57ea56290efa14d835bbfd34faf1d89753"
    ) {
        userId = "0x94Bfb1FA83A78de2856DC7c3273ca7E37522aD6C";
    } else if (
        // vonmises 2
        userId.toLowerCase() == "0x12cd871105b29760a61f56753d54a59381f5bcc6"
    ) {
        userId = "0x8C57E23CbF902ED01a7600fEf1B8d083efB24909";
    } else if (
        userId.toLowerCase() == "0x7556Cc553036E8E67ca77B72fCa81657988DE13E"
    ) {
        userId = "0xe7079eec020ddfc3f1c0abe1d946c55e6ed30eb3";
    } else if (
        // anthony AC
        userId.toLowerCase() == "0x88d3574660711e03196af8a96f268697590000fa"
    ) {
        userId = "0xf8be957f65e67fb0342992a51c30290d5758f880";
    } else if (
        // whale
        userId.toLowerCase() == "0x7556cc553036e8e67ca77b72fca81657988de13e"
    ) {
        userId = "0xe7079eec020ddfc3f1c0abe1d946c55e6ed30eb3";
    }
    try {
        const data = await AssetService.getAssets({
            account: userId,
            type: blockchain,
            offset,
        });
        return data;
    } catch (e) {
        console.log(e);
        return { error: true };
    }
};

export const getChainAssets = async (userId, blockchain) => {
    if (userId.toLowerCase() == "0xf3860788d1597cecf938424baabe976fac87dc26") {
        userId = "0xC896866E927e6F8a416Ba209976115E79fA0a66F";
    } else if (
        userId.toLowerCase() == "0x8dbbca57ea56290efa14d835bbfd34faf1d89753"
    ) {
        userId = "0x94Bfb1FA83A78de2856DC7c3273ca7E37522aD6C";
    }
    try {
        const data = await AssetService.getChainAssets({
            account: userId,
            type: blockchain,
        });

        return data;
    } catch (e) {
        console.log(e);
        return { error: true };
    }
};

export const getUser = async (id, blockchain?: string) => {
    try {
        // Always a fresh read, but shared with any lookup of the same wallet
        // already in flight (the world menus and portal owners ask at once).
        const response = await lookupWallet(id);

        return response;
    } catch (e) {
        return { error: true };
    }
};

export const getUserByUsername = async (username) => {
    try {
        const response = await AccountsAPI.getUsers({
            type: "username",
            username: username,
        });

        return response;
    } catch (e) {
        console.error(e);
        return { error: true };
    }
};

export const overwriteAsset = async (
    // file,
    fileMetadata,
    assetId,
    exhibitId,
    media
) => {
    try {
        const data = await fetch(`${nodeEnv.PUBLIC_API}/api/overwriteAsset`, {
            method: "POST",
            body: JSON.stringify({
                assetId,
                exhibitId,
                fileMetadata,
                // file,
                media,
            }),
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });

        return await data.json();
    } catch (e) {
        console.error(e);
        return { error: true };
    }
};

// Caches BOTH found and not-found results. Most NFT owners/creators have no
// oncyber profile, so without negative caching those lookups failed and got
// re-queried on every render/re-mount (e.g. 3D artwork-info bubbles re-mounting
// as the camera moves) — producing `users WHERE walletId == ? LIMIT 1` query
// storms from a single session. A thrown error (transient) is NOT cached.
const usersCache: Record<string, any> = {};
const usersInFlight: Record<string, Promise<any>> = {};

// One request per wallet at a time. A definitive result (found OR not-found)
// is kept for getUserByWalletId, so a profile-less wallet is queried at most
// once per session; a thrown error is not kept.
function lookupWallet(walletId: string): Promise<any> {
    let request = usersInFlight[walletId];
    if (!request) {
        request = usersInFlight[walletId] = AccountsAPI.getUsers({
            type: "walletId",
            walletId,
        }).then(
            (response) => {
                delete usersInFlight[walletId];
                if (response) usersCache[walletId] = response;
                return response;
            },
            (error) => {
                delete usersInFlight[walletId];
                throw error;
            }
        );
    }
    return request;
}

export const getUserByWalletId = async (
    walletId: string
): Promise<{ success: true; user: User } | { success: false; error: true }> => {
    try {
        let response = usersCache[walletId];
        if (!response) {
            response = await lookupWallet(walletId);
        }
        return response;
    } catch (e) {
        console.error(e);
        return { success: false, error: true };
    }
};

export const updateExhibit = async (
    id: string,
    payload: any,
    token: string,
    validateWallet?: string
) => {
    let params = queryParams({
        id,
        type: "UPDATE_EXHIBIT",
        validateWallet,
    });

    return await fetch(`/api/exhibit?${params}`, {
        method: "POST",
        body: JSON.stringify({
            token,
            payload,
        }),
        credentials: "include",
    });
};

export const updateStylekit = async (
    id: string,
    payload: any,
    token: string,
    validateWallet?: string
) => {
    let params = queryParams({
        id,
        type: "UPDATE_STYLEKIT",
        validateWallet,
    });

    return await fetch(`/api/stylekit?${params}`, {
        method: "POST",
        body: JSON.stringify({
            token,
            payload,
        }),
        credentials: "include",
    });
};

export const createStylekit = async (
    userId,
    token,
    stylekitId,
    room,
    kitbash,
    kitbashImgs
) => {
    //

    return fetch(`/api/stylekit?type=CREATE_STYLEKIT`, {
        method: "POST",
        body: JSON.stringify({
            userId,
            token,
            stylekitId,
            kitbash,
            kitbashImgs,
            room,
        }),
        credentials: "include",
    }).then((res) => res.json());
};

const emptyStylekit: Stylekit = {
    id: EMPTY_ROOM.slug,
    kitbash: getDefaultEmptyRoomData(),
    info: {
        room: EMPTY_ROOM.slug,
        curator: "0x0",
    },
    kitbashImgs: {},
    version: 1,
    owner: "0x0",
    editors: ["0x0"],
    createdAt: 0,
};

export const getStylekitByRoom = async (
    room: string
): Promise<Stylekit | null> => {
    //

    if (room == null || room === EMPTY_ROOM.slug) {
        //
        return emptyStylekit;
    }

    const params = queryParams({
        type: "GET_STYLEKIT_BY_ROOM",
        room,
    });

    const res = await fetch(`/api/stylekit?${params}`);

    if (res.status === 404) return null;

    const data = await res.json();

    if (data.success) return data.stylekit;

    throw new Error(data.error || "Error fetching stylekit");
};

export const getStylekitList = async () => {
    //
    await delay(500);

    return [
        {
            id: "macys_test6",
            name: "Macys Test 6",
            //image: "https://cyber.mypinata.cloud/ipfs/QmadBZYZo6weRfbpt3AgPxCDzsBfCpWHA8PertQj2tPut8?filename=kitb-preview-macys_test6-B004_Facade.jpg",
        },
        {
            id: "ye-test-cybercity-001",
            name: "Ye Test Cybercity 001",
            image: "https://cyber.mypinata.cloud/ipfs/QmcLRe2EKoNt9EBJYpQcfv42iT5nEXVjyDpKPkprTt6wYv?filename=kitb-preview-ye-test-cybercity-001-tower.jpg",
        },
    ];
};

export const deleteStylekit = async (token, stylekitId) => {
    //
    return fetch(`/api/stylekit?type=DELETE_STYLEKIT`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ stylekitId, token }),
    }).then((resp) => resp.json());
};

export const updateRoomParameters = async (token, destinationId, params) => {
    try {
        const data = await DestinationService.opts({ token })
            .updateRoomParameters({ id: destinationId, params });
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export const updateExhibitArtworks = async (id, artworks, token) => {
    return await fetch(`/api/exhibit?id=${id}&type=UPDATE_EXHIBIT`, {
        method: "POST",
        body: JSON.stringify({
            token,
            payload: {
                artworks,
            },
        }),
        credentials: "include",
    });
};

export const updateExhibitPortals = async (id, portals, token) => {
    return await fetch(`/api/exhibit?id=${id}&type=UPDATE_EXHIBIT`, {
        method: "POST",
        body: JSON.stringify({
            token,
            payload: {
                portals,
            },
        }),
        credentials: "include",
    });
};

export const getUserExhibits = async (token) => {
    return fetch(`/api/exhibit?type=GET_USERS_EXHIBITS`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ token }),
    })
        .then((resp) => resp.json())
        .then((data) => {
            amplitude_logUserExhibits(data.exhibits);

            return data;
        });
};

export const getUserDestinations = async (token: string, userId: string) => {
    try {
        const data = await DestinationService.opts({ token })
            .getUserDestinations({});
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export const getUserDestination = async (
    token: string,
    userId: string,
    slug: string
) => {
    try {
        const data = await DestinationService.opts({ token })
            .getUserDestinationBySlug({ slug });
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export const preMintNCD = (token: string, payload: Record<string, any>) => {
    return fetch(`/api/factory/preMint/ncd`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ token, ...payload }),
    }).then((resp) => resp.json());
};

export const personalMint = (token: string, payload: Record<string, any>) => {
    return fetch(`/api/factory/personalMint`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ token, ...payload }),
    }).then((resp) => resp.json());
};

export const getDestinationById = async (destinationId: string) => {
    try {
        const response = await fetch(
            `${nodeEnv.PUBLIC_API}/api/_v2/destinations`,
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: "method",
                    method: "getDestinationById",
                    params: [{ id: destinationId }],
                }),
            }
        ).then((resp) => resp.json());

        if (response.type === "Error") {
            return { success: false, error: response.error };
        }

        return { success: true, data: response.value };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export const getDestinationBySlug = async (slug: string) => {
    try {
        const response = await fetch(
            `${nodeEnv.PUBLIC_API}/api/destinations/${slug}`
        ).then((resp) => resp.json());

        if (!response.success) {
            return { success: false, error: "Destination not found" };
        }

        return { success: true, data: response.destination };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export const updateDestination = async (
    destinationId: string,
    token: string,
    payload: any
) => {
    try {
        const data = await DestinationService.opts({ token })
            .updateDestinationById({ id: destinationId, payload });
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export const submitReviewDestination = async (
    destinationId: string,
    token: string,
    payload: any
) => {
    try {
        const data = await DestinationService.opts({ token })
            .submitReview({ id: destinationId, payload });
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export const cancelReview = async (destinationId: string, token: string) => {
    try {
        const data = await DestinationService.opts({ token })
            .cancelSubmit({ id: destinationId });
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export const deleteDestination = async (
    destinationId: string,
    token: string
) => {
    try {
        await DestinationService.opts({ token })
            .deleteDestination({ id: destinationId, slug: destinationId });
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export const uploadDestination = async ({
    token,
    path_low,
    path_mid,
    path_high,
    original_path,
}) => {
    try {
        const files = await DestinationService.opts({ token })
            .uploadDestinationFiles({
                path_low,
                path_mid,
                path_high,
                original_path,
            });
        return { status: "success", files };
    } catch (err) {
        return { status: "error", error: err.message };
    }
};

export const getDestinationByTokenId = async (
    tokenId: string,
    token: string
) => {
    try {
        const data = await DestinationService.getDestinationByTokenId({
            tokenId,
        });
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export const finalizeCreateDrop = async (
    id: string,
    token: string,
    payload: {
        token_id: string;
        contract_address: string;
    }
) => {
    try {
        const data = await DestinationService.opts({ token })
            .finalizeCreateDrop({ id, payload });
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export const uploadThumbnail = async (token, thumbnail) => {
    try {
        const result = await DestinationService.opts({ token })
            .uploadDestinationThumbnail({ thumbnail });
        return { status: "success", thumbnail: result.thumbnail };
    } catch (err) {
        return { status: "error", error: err.message };
    }
};

export const applyFactory = async (token, payload) => {
    try {
        const slug = payload.name?.replace(/ /g, "").toLowerCase();
        const destination = await DestinationService.opts({ token })
            .createDestination({
                payload: {
                    ...payload,
                    slug,
                    author: {
                        ...payload.author,
                        userId: payload.author?.id,
                    },
                },
            });
        return { status: "success", destination };
    } catch (err) {
        return { status: "error", error: err.message };
    }
};

export const updateFactory = async (token, id, payload) => {
    try {
        const slug = payload.name?.replace(/ /g, "").toLowerCase();
        const destination = await DestinationService.opts({ token })
            .updateDestinationById({
                id,
                payload: {
                    ...payload,
                    ...(slug && { slug }),
                    author: {
                        ...payload.author,
                        userId: payload.author?.id,
                    },
                },
            });
        return { status: "success", destination };
    } catch (err) {
        return { status: "error", error: err.message };
    }
};

export const updateUser = async (token, payload, userId = "") => {
    return fetch(`/api/user/update`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ payload }),
    })
        .then((resp) => resp.json())
        .then((data) => {
            const edited = Object.keys(payload);

            if (edited[0] !== "currentExhibitId") {
                amplitude_logAnalyticsEvent("save_profile_edits", {
                    edited: Object.keys(payload),
                    user_id: userId,
                });
            }

            return data;
        });
};

export const deleteExhibit = async (token, exhibitId) => {
    return fetch(`/api/exhibit?type=DELETE_EXHIBIT`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ exhibitId, token }),
    }).then((resp) => resp.json());
};

export function duplicateSpace(spaceId) {
    return fetch(`/api/space/duplicate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ spaceId }),
    }).then((resp) => resp.json());
}

export function leaveSpace(spaceId) {
    return fetch(`/api/space/leave`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ spaceId }),
    }).then((resp) => resp.json());
}

export const finalizeMint = async (id: string, token: string) => {
    try {
        const data = await DestinationService.opts({ token })
            .finalizeMint({ id });
        return { success: true, data };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

export const likeExhibit = async (exhibitId, token) => {
    // We increment the likes score in firebase
    // We add the exhibit to the user's local storage
    return fetch(`/api/exhibit?type=LIKE_EXHIBIT`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ exhibitId, token }),
    })
        .then((resp) => resp.json())
        .then((data) => {
            const likes = JSON.parse(localStorage.getItem("likes")) || [];

            likes.push(exhibitId);

            localStorage.setItem("likes", JSON.stringify(likes));

            return data;
        });
};

export const unlikeExhibit = async (exhibitId, token) => {
    // We decrement the likes score in firebase
    // We remove the exhibit in the user's local storage
    return fetch(`/api/exhibit?type=UNLIKE_EXHIBIT`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ exhibitId, token }),
    })
        .then((resp) => resp.json())
        .then((data) => {
            let likes = JSON.parse(localStorage.getItem("likes")) || [];

            likes = likes.filter((id) => {
                return exhibitId !== id;
            });

            localStorage.setItem("likes", JSON.stringify(likes));

            return data;
        });
};

export const didUserLikeExhibit = (exhibitId, token) => {
    return fetch(`/api/exhibit?type=HAS_LIKED`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ exhibitId, token }),
    }).then((resp) => resp.json());

    // // We check the local storage to see if the user liked
    // try {
    //     let hasLiked = false;
    //     let likes = JSON.parse(localStorage.getItem("likes")) || [];

    //     likes.forEach(id => {
    //         if (exhibitId === id) hasLiked = true;
    //     });

    //     return hasLiked;
    // } catch(err) {
    //     console.log('err diduserlike');
    // }
};

export const logEvent = (eventType, payload) => {
    return fetch(`/api/stats`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            eventType,
            payload,
        }),
    })
        .then((resp) => resp.json())
        .catch((e) => console.log(e));
};

export const getAnalytics = (token, exhibitId) => {
    return fetch(`/api/stats?type=FETCH_ANALYTICS`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
            token,
            exhibitId,
        }),
    })
        .then((resp) => resp.json())
        .catch((e) => console.log(e));
};

export const saveCustomLinkToDb = (token, userId, exhibitId, customLink) => {
    return fetch(`/api/customLink`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            customLink,
            userId,
            exhibitId,
            token,
        }),
        credentials: "include",
    }).then((resp) => resp.json());
};

export const generateInviteLink = (exhibitId) => {
    return fetch(`/api/invite/generate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            exhibitId,
        }),
        credentials: "include",
    }).then((resp) => resp.json());
};

export function inviteAccess(inviteId) {
    return fetch(
        `${nodeEnv.PUBLIC_API}/api/invite/access?inviteId=${inviteId}`
    ).then((resp) => resp.json());
}

export const getExhibitEditors = (exhibitId) => {
    return fetch(`/api/invite/editors?exhibitId=${exhibitId}`).then((resp) =>
        resp.json()
    );
};

export function getInviteLink(exhibitId) {
    return fetch(`/api/invite?exhibitId=${exhibitId}`).then((resp) =>
        resp.json()
    );
}

export function kickInvitedUser(editorId, exhibitId) {
    return fetch(`/api/invite/kick`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            exhibitId,
            editorId,
        }),
        credentials: "include",
    }).then((resp) => resp.json());
}

export const changePrivilege = ({
    editorId,
    exhibitId,
    privilege,
    owners = [],
}) => {
    return fetch(`/api/invite/privilege`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            exhibitId,
            editorId,
            privilege,
            owners,
        }),
        credentials: "include",
    }).then((resp) => resp.json());
};

export const didUserFavorited = (exhibitId, token) => {
    return fetch(`/api/exhibit?type=HAS_FAVORITED`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ exhibitId, token }),
        credentials: "include",
    }).then((resp) => resp.json());
};

export const toggleFavorite = (exhibitId, token) => {
    return fetch(`/api/exhibit?type=TOGGLE_FAVORITE`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ exhibitId, token }),
        credentials: "include",
    }).then((resp) => resp.json());
};

export const getEditorsProfile = (editorIds, loadNumOfSpaces = false) => {
    return fetch(`/api/user/getEditorsProfile`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ editorIds, loadNumOfSpaces }),
    }).then((resp) => resp.json());
};

export const getPublicUserExhibits = async (userId) => {
    return fetch(
        `${nodeEnv.PUBLIC_API}/api/exhibit?type=GET_PUBLIC_USER_EXHIBITS`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId }),
        }
    ).then((resp) => resp.json());
};

export async function updateAvatar(
    avatarUrl,
    avatarContractAddress,
    avatarTokenId
) {
    const response = await fetch(
        `/api/user/avatar?avatarContractAddress=${avatarContractAddress}&avatarTokenId=${avatarTokenId}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                avatarUrl,
            }),
        }
    );

    if (!response.ok) {
        throw new Error("Couldn't fetch the file");
    }

    const result = await response.json();

    return result;
}

export async function addComment(ids, comment) {
    const result = await fetch(
        `${nodeEnv.PUBLIC_API}/api/guestbook/add?${
            ids.id ? `id=${ids.id}` : `destinationId=${ids.destinationId}`
        }`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(comment),
            credentials: "include",
        }
    ).then((resp) => resp.json());

    return result;
}

export async function removeComment(ids, commentId) {
    const result = await fetch(
        `${nodeEnv.PUBLIC_API}/api/guestbook/remove?${
            ids.id ? `id=${ids.id}` : `destinationId=${ids.destinationId}`
        }`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ commentId }),
            credentials: "include",
        }
    ).then((resp) => resp.json());

    return result;
}

export async function handleUploadVideoPreview({
    file,
    exhibitId,
    token,
    mode,
}) {
    const result = await AssetService.opts({ token }).uploadVideoPreview({
        exhibitId,
        file,
        mode,
    });

    return result;
}

// Chat's word filter ships with the app; nothing is fetched.
export function getProfanity(_opts?: { abortController?: AbortController }) {
    return Promise.resolve([...PROFANITY]);
}
