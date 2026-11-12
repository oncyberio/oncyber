import { updateAvatar } from "@utils/saveToDb";
import { cloudinary } from "@utils/urlUtils";
import {
    DEFAULT_PLAYER_AVATAR_PICTURE,
    UPDATE_AVATAR,
} from "../three/factory/player/constants";

function isManagedPinataUrl(value: string) {
    try {
        const url = new URL(value);
        return (
            url.protocol === "https:" &&
            url.hostname === "cyber.mypinata.cloud" &&
            url.pathname.startsWith("/ipfs/")
        );
    } catch {
        return false;
    }
}

function validImage(url) {
    return new Promise((resolve) => {
        const img = new Image();

        img.src = url;
        img.onload = () => resolve(url);
        img.onerror = () => resolve(DEFAULT_PLAYER_AVATAR_PICTURE);
    });
}

export async function formatAvatar(userData, dispatch, exhibit = null) {
    //

    let avatarImg =
        userData?.avatar ||
        exhibit?.params?.pfp?.avatar ||
        DEFAULT_PLAYER_AVATAR_PICTURE;

    if (cloudinary.isBrokenCloudinaryUrl(avatarImg)) {
        avatarImg = DEFAULT_PLAYER_AVATAR_PICTURE;
    }

    const isCloudinary = cloudinary.isCloudinaryUrl(avatarImg);

    // Migration returns our Pinata gateway URL. Re-uploading that URL on each
    // visit would download, pin, and rewrite the same profile picture again.
    if (userData?.avatar && !isCloudinary && !isManagedPinataUrl(avatarImg)) {
        // Preserve migration for profile images hosted elsewhere.
        const contract =
            userData?.avatarContractAddress ||
            userData?.walletId?.toLowerCase();

        const tokenId = userData?.avatarTokenId || String(Date.now());

        try {
            // we save in cloudaniry
            const response = await updateAvatar(
                userData?.avatar,
                contract,
                tokenId
            );

            if (response.success) {
                avatarImg = await validImage(response.url);
            } else {
                avatarImg = DEFAULT_PLAYER_AVATAR_PICTURE;
            }
        } catch (error) {
            console.error(error);
            avatarImg = DEFAULT_PLAYER_AVATAR_PICTURE;
        }
    }

    if (isCloudinary) {
        //
        var split = avatarImg.split("/");

        let i = 0;

        var paramsIndex = -1;

        while (i < split.length) {
            if (split[i] == "upload") {
                paramsIndex = i + 1;
            }

            i++;
        }

        if (paramsIndex != -1) {
            split[paramsIndex] = "c_limit,fl_keep_dar,h_256,w_256,c_fit,c_fill";
        }

        avatarImg = split.join("/");

        avatarImg = avatarImg.replace(".svg", ".jpg");
        avatarImg = avatarImg.replace(".png", ".jpg");
        avatarImg = avatarImg.replace(".gif", ".jpg");
        avatarImg = avatarImg.replace(".webp", ".jpg");
        avatarImg = avatarImg.replace(/\.[^/.]+$/, ".jpg");
    }

    const isPinata = isManagedPinataUrl(avatarImg);

    if (isPinata) {
        //
        const url = new URL(avatarImg);
        const searchParams = new URLSearchParams(url.search);
        const imgWidthParam = "img-width";
        if (!searchParams.has(imgWidthParam)) {
            url.search = `?${imgWidthParam}=256&` + searchParams.toString();
        }
        avatarImg = url.toString();
    }

    // Final safety net: whatever path produced the url, make sure it
    // actually loads — dead hosts otherwise crash/blank the avatar atlas
    // and the username label downstream
    avatarImg = await validImage(avatarImg);

    dispatch({
        type: UPDATE_AVATAR,
        payload: avatarImg,
    });

    console.log("avatara image", avatarImg);
    return avatarImg;
}
