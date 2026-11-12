import { formatExhibit } from "@utils/metadata/formatExhibit";

import cloneDeep from "lodash/cloneDeep";

import shortid from "shortid";

import AccountsAPI from "@api/accounts/_api";

import { EMPTY_ROOM } from "@utils/emptyRoom";

import { getDefaultEmptyRoomData } from "@components/_3DExhibit-v2/three/factory/space/roomdatacompat";
import { FileInfo, FileUploadCache } from "./FileUploadCache";
import { noop } from "@utils/js";
import { uploadExhibitHeroImg, uploadFile } from "@utils/media/mediaUploader";
import { showError } from "@components/Dialogs";
import { Experience, PortalData } from "@uitypes/experience";
import { cloudinary } from "@utils/urlUtils";
import { getDefaultMimePreview } from "@features/studio/utils";

export function getDefaultAnonExhibit(roomId = "", isFuture = false) {
    //

    const exhibit: any = {
        id: shortid.generate(),
        info: {
            room: roomId || EMPTY_ROOM.slug,
        },
        owner: "anon",
        editors: ["anon"],
        artworks: {},
        portals: {},
        kitbash: {},
        mock: true,
    };

    if (!roomId || isFuture) {
        exhibit.hasKitbash = true;
        exhibit.kitbash = getDefaultEmptyRoomData();
    }

    return exhibit;
}

export function initAnonUser(roomId = "") {
    return {
        exhibit: getDefaultAnonExhibit(roomId),
        destination: EMPTY_ROOM,
        userId: "anon",
        user: {
            walletId: "anon",
            username: "anon",
        },
        isAnonymous: true,
        authenticated: true,
    };
}

function formatExhibitBeforeStoring(exhibit) {
    // @ts-ignore
    let { version, ...rest } = exhibit;

    // if hash is invalid delete everything...
    rest = formatExhibit(cloneDeep(rest));

    return JSON.stringify(rest);
}

const LIMITS = {
    assets: 350,
    portals: 3,
    uploads: 3,
    allUploads: 10,
};

type LimitsScope = {
    [Key in keyof typeof LIMITS]?: boolean;
};

export const HIT_ANON_LIMIT = "hit-anon-limit";

export function checkAnonExhibitLimits(scope: LimitsScope = {}) {
    //
    const sExhibit = getLocalAnonExhibit();

    let exhibit;

    if (sExhibit) {
        exhibit = JSON.parse(sExhibit);

        const nbArtworks = Object.keys(exhibit.artworks || {}).length;
        const nbKitbash = Object.keys(exhibit.kitbash || {}).length;
        const nbPortals = Object.keys(exhibit.portals || {}).length;

        const total = nbArtworks + nbKitbash + nbPortals;

        if (scope.assets && total >= LIMITS.assets) {
            //
            return { asset: true };
        }

        if (scope.portals && nbPortals >= LIMITS.portals) {
            //
            return { portal: true };
        }
    }

    return checkAnonUploadLilimits(exhibit, scope);
}

export function checkAnonUploadLilimits(exhibit, scope: LimitsScope = {}) {
    //
    const userUploads = getAnonUploads();

    if (!userUploads) return null;

    if (scope.uploads && userUploads.length >= LIMITS.uploads) {
        //
        return { uploads: true };
    }

    const uploadUrls = getAllUpoadUrls(exhibit, userUploads);

    if (scope.allUploads && uploadUrls.length > LIMITS.allUploads) {
        return { allUploads: true };
    }

    return null;
}

export async function reachedAnonLimits(scope: LimitsScope) {
    //
    if (checkAnonExhibitLimits(scope)) {
        //

        window.postMessage(
            {
                type: HIT_ANON_LIMIT,
            },
            window.location.origin
        );

        return true;
    }

    return false;
}

export async function startAnonExhibit(exhibit: Experience) {
    const previous = getLocalAnonExhibit();
    if (previous) {
        const checked = await AccountsAPI.verifyAnonHash({ data: previous });
        if (!checked.success)
            throw new Error(
                "Your existing draft could not be verified. Open Studio to recover it first."
            );
        localStorage.setItem(
            `exhibit-anon-backup:${JSON.parse(previous).id}`,
            previous
        );
    }
    const data = formatExhibitBeforeStoring(exhibit);
    // Verify storage is available before changing the draft's server signature.
    localStorage.setItem("exhibit-anon-next", data);
    try {
        const signed = await AccountsAPI.setAnonHash({ data });
        if (!signed.success)
            throw new Error("Could not start this draft. Please try again.");
        localStorage.setItem("exhibit-anon", data);
    } catch (error) {
        await AccountsAPI.setAnonHash({ data: previous });
        throw error;
    } finally {
        localStorage.removeItem("exhibit-anon-next");
    }
}

export async function setAnonExhibit(exhibit) {
    //
    try {
        //
        checkAnonExhibitLimits();
        //
    } catch (err) {
        //
        console.error(err);

        showError(err.message);

        throw err;
    }

    const prevData = getLocalAnonExhibit();

    const isDataValid = await AccountsAPI.verifyAnonHash({ data: prevData });

    // if no exhibit returned then it means data has been changed by user manually
    if (!isDataValid.success) {
        //
        showError("Your data has changed.");

        await deleteAnonExhibit();

        throw new Error("Your draft could not be verified. Please reopen Studio.");
    }

    // we get the prev exhibit, in case there the data has been changed manually then we delete it

    const data = formatExhibitBeforeStoring(exhibit);

    localStorage.setItem("exhibit-anon-next", data);
    try {
        const signed = await AccountsAPI.setAnonHash({ data });
        if (!signed.success) {
            throw new Error("Could not save your draft. Please try again.");
        }
        localStorage.setItem("exhibit-anon", data);
        return signed;
    } catch (error) {
        await AccountsAPI.setAnonHash({ data: prevData });
        throw error;
    } finally {
        localStorage.removeItem("exhibit-anon-next");
    }
}

export async function getAnonExhibit(exhibit?: any) {
    try {
        if (typeof window === "undefined") throw new Error("Server side");

        const data = getLocalAnonExhibit();

        if (!data) {
            AccountsAPI.setAnonHash({
                data: "",
            });
        }

        if (data) {
            const isDataValid = await AccountsAPI.verifyAnonHash({ data });
            if (!isDataValid.success) {
                await deleteAnonExhibit();
                throw new Error("Invalid data.");
            }
        }

        const exhibit = JSON.parse(data);

        return formatExhibit(exhibit);
    } catch (err) {
        console.log("[ ERROR failed to parse exhibit from localstorage ]");

        return exhibit ? formatExhibit(exhibit) : null;
    }
}

export async function isAnonDataValid() {
    const data = getLocalAnonExhibit();

    const isDataValid = await AccountsAPI.verifyAnonHash({ data });

    return isDataValid.success;
}

export function getLocalAnonExhibit() {
    return localStorage.getItem("exhibit-anon") || "";
}

export async function deleteAnonExhibit() {
    //
    localStorage.removeItem("exhibit-anon");

    localStorage.removeItem("anon-uploads");

    FileUploadCache.getInstance().clear();

    await AccountsAPI.resetAnon({});

    AccountsAPI.setAnonHash({
        data: "",
    });
}

export function getAnonUploads() {
    //
    const uploads = localStorage.getItem("anon-uploads");

    if (uploads) {
        return JSON.parse(uploads);
    }

    return [];
}

export async function updateAnonUploads(fn: (updates: any) => any) {
    //
    const uploads = getAnonUploads();

    const newUploads = fn(uploads);

    localStorage.setItem("anon-uploads", JSON.stringify(newUploads));

    return newUploads;
}

export async function deleteAnonUploads({ hashes }) {
    //
    return updateAnonUploads((uploads) => {
        //
        return uploads.filter((it) => !hashes.includes(it.hash));
    });
}

export async function saveAnonUpload(opts) {
    //
    return updateAnonUploads((uploads) => {
        //
        const now = Date.now();

        const entry = {
            ...opts,
            createdAt: now,
            lastModified: now,
        };
        return [...uploads, entry];
    });
}

export async function updateAnonUpload(hash, data) {
    //
    return updateAnonUploads((uploads) => {
        //
        return uploads.map((it) => {
            //
            if (it.hash === hash) {
                return { ...it, ...data };
            }

            return it;
        });
    });
}

export async function checkAnonUploadExists(hash) {
    //
    const uploads = getAnonUploads();

    return uploads.find((it) => it.hash === hash);
}

export async function commitAnonExhibit(_exhibit: Experience, token: string) {
    //

    const { sExhibit, exhibit, uploads } = await uploadAndUpdateFileUrls(
        _exhibit,
        token
    );

    const response = await AccountsAPI.initAnon({
        // @ts-ignore
        sExhibit,
        exhibit,
        uploads,
    });

    if (response.success) {
        //
        deleteAnonExhibit();
    } else {
        //
        console.error(response.message);

        throw new Error(response.message);
    }
}

export async function uploadAndUpdateFileUrls(
    _exhibit: Experience,
    token: string
) {
    //
    let sExhibit = getLocalAnonExhibit();

    if (!sExhibit) {
        //
        await setAnonExhibit(_exhibit);

        sExhibit = getLocalAnonExhibit();
    }

    if (sExhibit == null) {
        //
        throw new Error("Could not find anon exhibit");
    }

    const exhibit = JSON.parse(sExhibit);

    const userUploads = getAnonUploads();

    const fileCache = FileUploadCache.getInstance();

    const uploadUrls = getAllUpoadUrls(exhibit, userUploads);

    const blobs = await fileCache.getBlobs(uploadUrls);

    const urlMap = {};

    const portals = Object.values(exhibit.portals || {}) as PortalData[];

    const jobs = [];

    portals.forEach((it) => {
        //
        const { cHeroImg, cHeroImg360 } = it;

        if (cHeroImg) {
            //
            const blob = blobs[cHeroImg];

            if (blob == null)
                throw new Error("Could not find blob for url: " + cHeroImg);

            it.cHeroImg = blob.file as string;

            delete blobs[cHeroImg];
        }

        if (cHeroImg360) {
            //
            const blob = blobs[cHeroImg360];

            if (blob == null)
                throw new Error("Could not find blob for url: " + cHeroImg360);

            it.cHeroImg360 = blob.file as string;

            delete blobs[cHeroImg360];
        }

        jobs.push(() => uploadPortalData(it, token));
    });

    Object.values(blobs).forEach(async (it) => {
        //
        jobs.push(async () => {
            //
            const { url, mimeType } = await uploadLocalFile(it, token);

            urlMap[it.url] = {
                ...it,
                url,
                mimeType,
            };
        });
    });

    await Promise.all(jobs.map((it) => it()));

    //
    userUploads.forEach((it) => {
        //
        const upload = urlMap[it.url];

        if (upload == null) {
            //
            throw new Error(`Could not find upload for url: ${it.url}`);
        }

        it.url = upload.url;
        it.mimeType = upload.mimeType;
    });

    fileCache.traverseUrls(exhibit, (url, obj, key, path) => {
        //
        const upload = urlMap[url];

        obj[key] = upload.url;

        // for upload assets
        if (obj.blockchain === "no-chain") {
            //
            obj.mime_type = upload.mimeType;
        }
    });

    Object.values(exhibit.artworks || {}).forEach((artwork: any) => {
        //
        if (artwork.data.source?.api === "oncyber") {
            //

            const mimeType = artwork.data.mime_type;

            let previewUrl = null;

            if (mimeType.startsWith("image/")) {
                //
                previewUrl = artwork.data.dcompressed_image_url;
            } else if (mimeType.startsWith("video/")) {
                //
                previewUrl = cloudinary.toExt(
                    artwork.data.dcompressed_animation_url,
                    "jpg"
                );
                //
            } else {
                //
                previewUrl = getDefaultMimePreview(mimeType);
            }

            artwork.data.image_preview_url = artwork.data.image_url =
                previewUrl;
        }
    });

    return {
        sExhibit,
        exhibit,
        uploads: userUploads,
    };
}

export async function uploadLocalFile(
    { id, file, mimeType }: FileInfo,
    token: string
) {
    //
    let cResp = await uploadFile({
        file,
        token,
        mimeType,
        id,
        onProgress: noop,
    });

    return {
        url: cResp.secure_url,
        mimeType: mimeType,
    };
}

export async function uploadPortalData(portal: PortalData, token: string) {
    //
    const portalId = portal.id;

    const exhibitId = portal.exhibitId;

    if (portal.cHeroImg || portal.cHeroImg360) {
        //
        let uploadResult = await uploadExhibitHeroImg(
            {
                exhibitId: portal.exhibitId,
                portalId: portal.isElevator
                    ? `${portalId}+${exhibitId}`
                    : portalId,
                heroImg: portal.cHeroImg,
                heroImg360: portal.cHeroImg360,
            },
            token
        );

        if (uploadResult.success === false) {
            //
            throw new Error("Failed to upload hero img " + uploadResult.error);
        }

        portal.cHeroImg = uploadResult.value.url;

        portal.cHeroImg360 = uploadResult.value.url360;
    }
}

function getAllUpoadUrls(exhibit, userUploads) {
    //
    const uploadUrls = exhibit
        ? FileUploadCache.getInstance().getUploadUrls(exhibit)
        : [];

    userUploads?.forEach((it) => {
        //
        if (!uploadUrls.includes(it.url)) {
            //
            uploadUrls.push(it.url);
        }
    });

    return uploadUrls;
}
