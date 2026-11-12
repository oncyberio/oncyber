import { type Blockchain } from "@dapp/connect";
import { Asset } from "@uitypes/Asset";
import { Experience } from "@uitypes/experience";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { isAutographUser } from "@utils/autographAssets";
import { getAddrType } from "@utils/getAddrType";
import { updateUser, createExhibit, getUserExhibits } from "@utils/saveToDb";
import { cloudinary, resize } from "@utils/urlUtils";

export async function createNewSpace(
    userId: string,
    token: string,
    room: string
) {
    const data = await createExhibit(userId, token, room);

    if (!data.success) {
        throw new Error(data.message || "Failed to create exhibit");
    }

    const result = await updateUser(
        token,
        {
            currentExhibitId: data.exhibit?.id,
            walletId: userId?.toLowerCase(),
        },
        userId
    );

    if (!result.success) {
        throw new Error(result.message || "Failed to update user data");
    }

    return data.exhibit;
}

export async function fetchUserExhibits(token: string) {
    //

    const data = await getUserExhibits(token);

    if (!data?.exhibits) {
        //
        throw new Error(
            "Failed to get user exhibits " + data.error || data.message
        );
    }

    return data.exhibits as Experience[];
}

export async function validateWalletChange(
    walletId: string,
    type: "own" | "delegated",
    isTrustedDelegation?: boolean
) {
    //
    if (type === "delegated") {
        //
        return {
            walletId,
            isAutograph: false,
        };
    }

    const addrType = getAddrType(walletId);

    let isAutograph = false;

    if (addrType !== "counterparty" && !isTrustedDelegation) {
        //
        let [data, _isAutograph] = await Promise.all([
            fetch(
                `/api/user/validate?userId=${walletId.toLowerCase()}&validate=true`,
                {
                    credentials: "include",
                }
            ).then((response) => response.json()),
            // { success: true, userId: value },
            addrType === "ethereum" ? isAutographUser(walletId) : false,
        ]);

        if (!data?.success) {
            //
            throw new Error(
                "Failed to switch wallets. Login with that wallet again."
            );
        }

        walletId = data.userId;
        isAutograph = _isAutograph;
    }

    return {
        walletId,
        isAutograph,
    };
}

export function getSpaceStatus(exhibit: Experience) {
    //
    return exhibit.info?.headline &&
        (exhibit.info?.cHeroImg || exhibit.info?.heroImg)
        ? "Public"
        : "Private";
}

export function getAssetName(artwork: Asset) {
    //
    if (artwork.mime_type === "cyber/text") return "Text asset";

    if (artwork.mime_type === "cyber/globalstream") return artwork.url;

    if (artwork.mime_type === "cyber/triggerzone") return artwork.type;

    return (
        artwork.name ||
        (artwork.collection?.name
            ? `${artwork.collection.name} #${artwork?.token_id}`
            : "")
    );
}

export function getAssetPreview(artwork: Asset): {
    previewUrl: string;
    url: string;
    isVideo: boolean;
} {
    //

    //debugger

    let res = { url: null, previewUrl: null, isVideo: false };

    if (artwork.mime_type === "cyber/text") {
        //
        res.url = res.previewUrl = "/images/text-preview.svg";
        //
    } else if (artwork.mime_type && artwork.mime_type?.includes("video")) {
        res.url =
            artwork.dcompressed_animation_url ||
            artwork.compressed_animation_url ||
            artwork.animation_url;

        if (res.url) {
            res.url = cloudinary.res(res.url, 100);
            res.isVideo = true;
        }

        res.previewUrl = artwork.image_preview_url || artwork.image_url;

        return res;
        //
    } else {
        res.url =
            artwork.dcompressed_image_url ||
            artwork.image_preview_url ||
            artwork.image_url;

        if (res.url) {
            res.url = resize(res.url, 100);
        }

        res.previewUrl = res.url;
    }

    if (!res.previewUrl) {
        //
        res.previewUrl = getDefaultMimePreview(artwork.mime_type);
    }

    return res;
}

export function getAssetPreviewImg(artwork: Asset): string {
    //
    return (
        artwork.dcompressed_image_url ||
        artwork.image_preview_url ||
        artwork.image_url ||
        getDefaultMimePreview(artwork.mime_type)
    );
}

export function getDefaultMimePreview(mime: string) {
    //
    if (mime === "cyber/text") {
        //
        return "/images/text-preview.svg";
        //
    }
    if (mime?.startsWith("image/")) {
        return "https://cyber.mypinata.cloud/ipfs/QmRMDB3BLksFgLoiM1mWsvPiP1y3HTTFa9aGzVgL9MP9Fd?filename=imageIcon_qc8a90.png";
    }

    if (mime?.startsWith("video/")) {
        return "https://cyber.mypinata.cloud/ipfs/QmXTXCGaXGBxivCpdDNZQEx1qeCaTx1JmtbSUEhgCFJFCD?filename=videoIcon_pnizox.png";
    }

    if (mime?.startsWith("audio/") || mime === "cyber/globalstream") {
        return "https://cyber.mypinata.cloud/ipfs/QmXhPNXeotnpwcCzhpBA2u92Y5m6y6Wit6fnGtyTgJd9Vj?filename=PNG_9_di03ka.png";
    }

    if (mime?.startsWith("model/") || mime === "cyber/triggerzone") {
        //
        return "https://cyber.mypinata.cloud/ipfs/QmXb5QwKsPYTgJLqjUiPFhdJuVez6SJJzcDeEHM54gBEkE?filename=objectIcon_zzteca.png";
    } else {
        //
        return "https://cyber.mypinata.cloud/ipfs/QmRMDB3BLksFgLoiM1mWsvPiP1y3HTTFa9aGzVgL9MP9Fd?filename=imageIcon_qc8a90.png";
    }
}

export function analyticsEditSpaceInfo(exhibit, user, edited) {
    //
    amplitude_logAnalyticsEvent("edit_space_info", {
        exhibitId: exhibit.id,
        destination: exhibit?.info?.room,
        ownerId: exhibit.owner,
        collab: exhibit?.editors?.length > 1,
        edited,
    });
}

export function shouldDisplayNFTs(userData) {
    if (!userData) return false;

    return (
        userData.type !== "web2" ||
        (userData.linkedAccounts || []).some((a) => a.type === "web3")
    );
}

export function getDefaultWallet(userData) {
    if (!userData) return null;

    if (userData?.type !== "web2") return userData.id;

    return  (userData.linkedAccounts || []).find((a) => a.type === "web3")?.id || userData.id;
}

export function isEthAddressOrEthAddressLinked(userData) {
    if (!userData) return false;

    if (getAddrType(userData?.id) === "ethereum") {
        return true;
    }

    return  (userData.linkedAccounts || []).some(
        (a) =>
            a.type === "web3" && getAddrType(a.originalWalletId) === "ethereum"
    );
}

export function getLinkedWallets(userData, blockchain: Blockchain | "" = "") {
    if (!userData) return [];

    return (userData.linkedAccounts || [])
        .filter((account) => {
            return (
                account.type === "web3" &&
                (getAddrType(account.originalWalletId) === blockchain || !blockchain)
            );
        })
        .map((account) => account.originalWalletId)
        .concat(userData.type !== "web2" && (getAddrType(userData.id) === blockchain || !blockchain) ? [userData.id] : []);
}

export function getLinkedWalletsUserProxyObject(userData) {
    if (!userData) return {};

    return (userData?.linkedAccounts || []).reduce((acc, account) => {
        if (account.type === "web3" && getAddrType(account.originalWalletId) === "ethereum") {
            acc[account.originalWalletId] = {
                walletId: account.originalWalletId,
                type: "ethereum",
            };
        }

        return acc;
    }, (userData.type === "web3" && getAddrType(userData.walletId) === "ethereum") ?{
        [userData.id]: {
            walletId: userData.id,
            type: "web2",
        }
    } : {});
}
