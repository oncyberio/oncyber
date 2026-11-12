import { nodeEnv } from "@env";
import { FetchedAsset } from "@uitypes/Asset";
import { supportedMimes } from "./mimeUtils";
import { rtfkt3dModels } from "@utils/partnerships/rtfkt/constants";
import { isURL } from "./js";
import { formatAssetUrls } from "./artworks";
// all mime types supported

function getUrlExtension(url: string) {
    return url.split(/[#?]/)[0].split(".").pop().trim();
}

export const getMime = (asset) => {
    if (asset?.mime_type) {
        return asset.mime_type;
    }

    if (!asset?.animation_url && asset?.image_url) {
        let extension = getUrlExtension(asset.image_url);

        if (extension === "jpg") {
            return "image/jpg";
        }
        if (extension === "jpeg") {
            return "image/jpeg";
        } else if (extension === "png") {
            return "image/png";
        } else if (extension === "svg") {
            return "image/svg";
        } else if (extension === "gif") {
            return "image/gif";
        } else if (extension === "bmp" || extension === "bin") {
            return "image/bmp";
        } else if (extension === "mp4") {
            asset.animation_url = asset.image_url;
            return "video/mp4";
        } else if (extension === "html") {
            return "text/html";
        } else {
            return null;
        }
    } else if (asset?.animation_url) {
        let extension = getUrlExtension(asset.animation_url);

        if (extension === "png") {
            asset.image_url = asset.animation_url;
            asset.animation_url = null;
            return "image/png";
        } else if (extension === "jpg") {
            asset.image_url = asset.animation_url;
            asset.animation_url = null;
            return "image/jpg";
        } else if (extension === "jpeg") {
            return "image/jpeg";
        } else if (extension === "svg") {
            return "image/svg";
        } else if (extension === "glb") {
            return "model/gltf-binary";
        } else if (extension === "gltf") {
            return "model/gltf+json";
        } else if (extension === "fbx") {
            return "model/fbx";
        } else if (extension === "obj") {
            return "model/obj";
        } else if (extension === "mov") {
            return "video/quicktime";
        } else if (extension === "mp4") {
            return "video/mp4";
        } else if (extension === "avi") {
            return "video/avi";
        } else if (extension === "gif") {
            return "image/gif";
        } else if (extension === "mp3") {
            return "audio/mpeg";
        } else if (extension === "wav") {
            return "audio/wav";
        } else if (extension === "html") {
            return "text/html";
        }
    } else if (asset?.animation_original_url) {
        let extension = getUrlExtension(asset.animation_original_url);

        if (extension === "png") {
            asset.image_url = asset?.animation_original_url;
            asset.image_original_url = asset?.animation_original_url;
            asset.animation_original_url = null;

            return "image/png";
        }
    }
    return null;
};

const remapAsset = (asset) => {
    let contractAddress =
        asset.asset_contract?.address &&
        asset.asset_contract?.address?.toLowerCase?.();

    if (
        !contractAddress &&
        asset?.contract &&
        typeof asset.contract === "string"
    ) {
        contractAddress = asset.contract;
    }

    if (
        rtfkt3dModels?.[contractAddress] &&
        rtfkt3dModels?.[contractAddress]?.[asset?.name]
    ) {
        asset.animation_url = rtfkt3dModels?.[contractAddress]?.[asset?.name];
        asset.mimeType = "model/gltf-binary";
        return { supported: true, incompatible: false };
    } else if (
        asset.animation_url &&
        asset.mime_type &&
        !supportedMimes.includes(asset.mime_type)
    ) {
        return { supported: false, incompatible: false };
    } else if (
        asset.animation_url &&
        asset.animation_url.includes("artblocks")
    ) {
        asset.image_original_url = false;
        asset.mimeType = "text/html";
        return { supported: true, incompatible: false };
    } else if (
        asset.animation_url &&
        asset.animation_url.includes("api.mooncat")
    ) {
        asset.animation_original_url = false;
        asset.animation_url = false;
        return { supported: false, incompatible: false };
    } else if (
        contractAddress == "0x7bd29408f11d2bfc23c34f18275bbf23bb716bc7"
    ) {
        asset.animation_url =
            asset.image_original_url.replace("jpg", "glb");
        asset.mimeType = "model/gltf-binary";
        return { supported: true, incompatible: false };
    } else if (
        asset.animation_url &&
        asset.animation_url.includes("kenesis.art/generator")
    ) {
        asset.animation_url =
             asset.animation_url;
        asset.mimeType = "text/html";
        return { supported: true, incompatible: false };
    } else if (
        asset.animation_url &&
        asset.animation_url.includes("chainrings.art/generator")
    ) {
        asset.animation_url =
           asset.animation_url;
        asset.mimeType = "text/html";
        return { supported: true, incompatible: false };
    } else if (
        asset.external_link &&
        asset.external_link.includes("arpeggi.io")
    ) {
        asset.animation_url = `https://www.arpeggi.io/mp3player/${asset.token_id}`;
        asset.animation_original_url = `https://www.arpeggi.io/mp3player/${asset.token_id}`;

        asset.mimeType = "audio/mpeg";
        return { supported: true, incompatible: false };
    } else if (
        asset.image_original_url &&
        asset.image_original_url.includes("api.emblemvault.io")
    ) {
        asset.image_original_url = asset.image_url;
        return { supported: true, incompatible: false };
    } else if (
        asset.animation_url &&
        asset.animation_url.includes("quadrums.art/api")
    ) {
        asset.animation_url =
             asset.animation_url;
        asset.mimeType = "text/html";
    } else if (
        asset.animation_url &&
        asset.animation_url.includes("ethblock.art/canvas/blockart")
    ) {
        asset.animation_url =
             asset.animation_url;
        asset.mimeType = "text/html";
    } else if (
        // cryptopochi
        asset.animation_original_url &&
        asset.animation_original_url.includes("pochi.club")
    ) {
        asset.animation_original_url = null;
        asset.animation_url = null;

        asset.image_original_url = asset.image_url;

        asset.mimeType = "image/gif";
    } else if (
        // bonzai nft
        contractAddress == "0xec9c519d49856fd2f8133a0741b4dbe002ce211b"
    ) {
        asset.animation_url = asset?.description
            ?.split?.("[3D Model (.glb)]")[1]
            ?.split?.("\n")[0]
            ?.replace?.("(", "")
            .replace?.(")", "")
            .replace("ipfs.io", "mau5trap.mypinata.cloud");
        asset.mimeType = "model/gltf-binary";
    } else if (
        // deadheads nft
        contractAddress == "0xee4446483fb92b6d21488fd4937053a09a53b7b6"
    ) {
        asset.animation_url = null;
        asset.mimeType = "image/jpeg";
    } else if (
        // deadmau5 nft
        contractAddress == "0x89d2e41408eacbbcc5eebeffaaa27fd2a01ff88b"
    ) {
        asset.animation_url = asset?.description
            ?.split?.("[3D .GLTF File]")[1]
            ?.split?.("\n")[0]
            ?.replace?.("(", "")
            .replace?.(")", "");
        asset.mimeType = "model/gltf-binary";
    } else if (
        contractAddress == "0x7ea3cca10668b8346aec0bf1844a49e995527c8b" || // cyberkongz on eth
        contractAddress === "0x05df72d911e52ab122f7d9955728bc96a718782c" // cyberkongz on polygon
    ) {
        asset.animation_url = `https://cyberkongz.fra1.cdn.digitaloceanspaces.com/public/${asset.token_id}/${asset.token_id}.glb`;
        asset.mimeType = "model/gltf-binary";
    } else if (
        asset.animation_original_url &&
        asset.animation_original_url.includes("api.heaven.computer")
    ) {
        asset.animation_url = asset.image_url;
        asset.mimeType = "video/mp4";
        return { supported: true, incompatible: false };
    } else if (
        contractAddress == "0x62cdaf466511888792c8c413239baa70f57f1654"
    ) {
        asset.animation_original_url = null;
        asset.mimeType = "image/png";
    } else if (
        // rtfkt box
        contractAddress == "0x86825dfca7a6224cfbd2da48e85df2fc3aa7c4b1" &&
        asset?.token_id == 1
    ) {
        asset.animation_url = `https://cyber.mypinata.cloud/ipfs/QmVRXZ5PjhkGAQ61xJdLdZVCS2UXWgdYP6QdaVTnyYLjWt?filename=mnlth.glb`;
        asset.mimeType = "model/gltf-binary";
    } else if (
        // gooniez
        contractAddress == "0x18cd9fda7d584401d04e30bf73fb0013efe65bb0"
    ) {
        asset.animation_url = null;
        asset.mimeType = "image/jpeg";
    } else if (
        // hape
        contractAddress == "0x4db1f25d3d98600140dfc18deb7515be5bd293af"
    ) {
        asset.animation_url = null;
        asset.animation_original_url = null;
        asset.mimeType = "image/jpeg";
    } else if (
        contractAddress == "0x2d820afb710681580a55ca8077b57fba6dd9fd72"
    ) {
        asset.animation_url = `http://api.artifex.art/get-3d-model/${asset?.token_id}.glb`;
        asset.mimeType = "model/gltf-binary";
    } else if (
        contractAddress == "0xe39fb076bd6be0bbf400db0dfad28104fdc5ff46"
    ) {
        asset.animation_url = `https://pacaviewer.fra1.cdn.digitaloceanspaces.com/metadata/${asset?.token_id}`;
        asset.mimeType = "model/gltf-binary";
    } else if (
        contractAddress == "0x9a4b320418544b4da92c38d2a6e2de09d5b0287a"
    ) {
        asset.animation_url = `https://api.babby.xyz/file/${asset?.token_id}`;
        asset.mimeType = "model/gltf-binary";
    } else if (
        contractAddress == "0x43764f5b8973f62a6f10914516131c1489e3190d" &&
        asset?.token_id == 2
    ) {
        asset.animation_url = `https://cyber.mypinata.cloud/ipfs/QmYVMrLRxHoErEM1n1DRXTRZVibFRz4WJQGiNLkNz3fV37?filename=rtfktmurakami_evishe.glb`;
        asset.mimeType = "model/gltf-binary";
        asset.envmap = "studio";
    } else if (
        contractAddress == "0xc9677cd8e9652f1b1aadd3429769b0ef8d7a0425"
    ) {
        asset.animation_url = null;
        asset.mimeType = "image/jpg";
    } else if (
        contractAddress == "0xf61f24c2d93bf2de187546b14425bf631f28d6dc"
    ) {
        // prxt
        asset.animation_url = null;
        asset.mimeType = "image/png";
    } else if (
        contractAddress == "0x564b644eafca9ae7df35558546ee2d850df2f334"
    ) {
        // prxt
        asset.animation_original_url = asset.animation_original_url.replace(
            ".html",
            ".glb"
        );
        asset.animation_url = asset.animation_original_url;
        asset.mimeType = "model/gltf-binary";
    } else if (
        contractAddress == "0x8fb139c11db50f881020dd48ecce11b628981a13"
    ) {
        // prxt 2
        asset.animation_original_url = asset.animation_original_url.replace(
            ".html",
            ".glb"
        );
        asset.animation_url = asset.animation_original_url;
        asset.mimeType = "model/gltf-binary";
    } else if (
        contractAddress == "0x2bd58a19c7e4abf17638c5ee6fa96ee5eb53aed9"
    ) {
        // manny
        asset.animation_url = `https://d2tm2f4d5v0kas.cloudfront.net/glb/${asset?.token_id}.glb`;
        asset.mimeType = "model/gltf-binary";
    }
    // desconstruct3D number 2
    // else if (
    //     contractAddress == "0x8fb139c11db50f881020dd48ecce11b628981a13"
    // ) {
    //     asset.animation_original_url = asset.animation_original_url.replace(
    //         ".html",
    //         ".glb"
    //     );
    //     asset.animation_url = asset.animation_original_url;
    //     asset.mimeType = "model/gltf-binary";
    // }
    else if (
        // nicolassdnl
        contractAddress == "0xc5f9b9845a7b04bdbc66d3f52128c4634054b23c"
    ) {
        const url = asset.description.slice(
            asset.description.lastIndexOf("https://"),
            asset.description.length
        );

        asset.files = [
            {
                type: "video/mp4",
                url:
                    asset.dcompressed_animation_url ||
                    asset.compressed_animation_url ||
                    asset.animation_url ||
                    asset.animation_original_url ||
                    asset.original_animation_url,
            },
            { type: "model/gltf+json", url: url },
        ];
    } else if (
        // rtfkt worker bot id 5
        contractAddress == "0x253ef258563e146f685e60219da56a6b75178e19" &&
        asset.token_id == 5
        // contractAddress == "0xa642375cc15249a81da9c435fb4edd8a9343ce7f" && asset.token_id == 6
    ) {
        asset.animation_url =
            "https://cyber.mypinata.cloud/ipfs/QmXZdADPt3G3K1z9K5sAzZ8BE5LgJtmLEJeBZGazLB81UU?filename=WorkerBot_Posed_10_24_1_eyoaob.glb";
        asset.mimeType = "model/gltf-binary";
        asset.envmap = "studio";
    } else if (
        // rtfkt luggage ids 1-5
        contractAddress == "0x253ef258563e146f685e60219da56a6b75178e19" &&
        asset.token_id < 5
        // contractAddress == "0xa642375cc15249a81da9c435fb4edd8a9343ce7f" && asset.token_id == 6
    ) {
        asset.animation_url =
            "https://cyber.mypinata.cloud/ipfs/QmVx9QsxPxGkKDewrjG3NF6DRukcWkENfoNQ4v58MnhNKW?filename=RimowaLuggage_dkp8c4.glb";
        asset.mimeType = "model/gltf-binary";
        asset.envmap = "studio";
    } else if (
        // souls galaxy
        contractAddress == "0x477f516db22683e65df58c2cba4f5d5859d48424"
    ) {
        asset.animation_url = asset.image_original_url;
        asset.mimeType = "image/gif";
    } else if (
        // rtfkt bots
        contractAddress == "0xe75836a73fc0bcb7e63f70c9173eb86b4bf0d282"
    ) {
        if (asset?.traits?.length > 0) {
            const artefactTrait = asset.traits.find(
                (trait) => trait.trait_type == "ARTEFACT"
            );
            const idTrait = asset.traits.find(
                (trait) => trait.trait_type == "ID"
            );

            if (artefactTrait?.value == "WorkerBot") {
                if (idTrait?.value == "Exploration".toLocaleUpperCase()) {
                    asset.animation_url =
                        "https://cyber.mypinata.cloud/ipfs/QmRWQMVMDjnVhfxEwaLqzE1uS5rWWVEu6nE83R1doWeB5j?filename=Workerbot_Exploration_nn7omi.glb";
                } else if (idTrait?.value == "Confidence".toLocaleUpperCase()) {
                    asset.animation_url =
                        "https://cyber.mypinata.cloud/ipfs/QmNYjngY3ch4YasmBhGQw22idQw6d2EjySomkVAbsqPLZJ?filename=Workerbot_Confidence_n9hg0h.glb";
                } else if (idTrait?.value == "Vision".toLocaleUpperCase()) {
                    asset.animation_url =
                        "https://cyber.mypinata.cloud/ipfs/QmW56FGZuyxm7Lb8Y4ZfvbKXuqTRBV9fbGmxT1qKb1nN7D?filename=Workerbot_Vision_tfkrsu.glb";
                } else if (idTrait?.value == "Mimic".toLocaleUpperCase()) {
                    asset.animation_url =
                        "https://cyber.mypinata.cloud/ipfs/QmRWQMVMDjnVhfxEwaLqzE1uS5rWWVEu6nE83R1doWeB5j?filename=Workerbot_Exploration_nn7omi.glb";
                }
                asset.mimeType = "model/gltf-binary";
            }
        }
    }

    if (asset.mime_type && !supportedMimes.includes(asset.mime_type)) {
        return { supported: false, incompatible: true };
    }
    return { supported: true, incompatible: false };
};

export function isSameAsset(a1: FetchedAsset, a2: FetchedAsset): boolean {
    return (
        a1.blockchain === a2.blockchain &&
        a1.contract_address === a2.contract_address &&
        a1.token_id === a2.token_id
    );
}

// Hacks
// @legato NFPs got pre-revealed but creators left animation_original_url field to pre-revealed video
// TODO: can we safely assume this in call cases
const preReveal = [
    "0x92133e21fff525b16d1edcf78be82297d25d1154",
    "0xd2f668a8461d6761115daf8aeb3cdf5f40c532c6",
    "0xbc3ab50747b5746b511db37352dddbcdd21bf433",
];

export const formatAsset = (asset): FetchedAsset => {


    if(asset && asset.display_animation_url && !asset.animation_url) {
        asset.animation_url = asset.display_animation_url;
         asset.animation_original_url = asset.display_animation_url
    }

    if (asset && !asset.mime_type) asset.mime_type = getMime(asset);

    if (!asset?.token_id && asset?.identifier)
        asset.token_id = asset.identifier;

    const { supported, incompatible } = remapAsset(asset);

    if (!supported) {
        asset.animation_url = "";
        asset.animation_original_url = "";
        asset.incompatible = incompatible;
    }

    if (preReveal.includes(asset?.asset_contract?.address)) {
        if (
            asset.animation_original_url &&
            !asset?.animation_url &&
            asset?.image_url
        ) {
            asset.animation_original_url = null;
        }
    }

    formatAssetUrls(asset);

    const shape = asset?.blockchain === "xdai" ? "circle" : "square";

    let collection_name = null;

    if (asset.collection?.name) {
        collection_name = asset.collection.name;
    } else if (typeof asset.collection === "string") {
        collection_name = asset.collection;
    }

    const payload = {
        image_preview_url: asset.image_preview_url || asset.image_url || null,
        image_original_preview_url:
            asset.image_preview_url || asset.image_url || null,
        image_url: asset.image_url || null,
        image_original_url: asset.image_url || null,
        sell_orders: asset.sell_orders || [],
        buy_orders: asset.buy_orders || [],
        top_bid: asset.top_bid || {},
        animation_url: asset.animation_url || null,
        animation_original_url: asset.animation_url || null,
        name: asset.name || "",
        description: asset.description || "",
        external_link: asset.external_link || "",
        openSeaLink: asset?.permalink || "",
        token_address: asset?.contract || asset?.token_address || "",
        contract_address: asset?.contract || asset?.contract_address || "",
        contract: {
            name: asset?.asset_contract?.name || "",
            schema_name: asset?.asset_contract?.schema_name || "",
        },
        asset_contract: {
            address: asset?.contract || asset?.contract_address || "",
        },
        token_id: asset.identifier || asset.token_id,
        owner: asset.owner || {},
        creator: asset.creator || {},
        blockchain: asset?.blockchain || "ethereum",
        marketplace: asset?.marketplace || null,
        token_metadata: isURL(asset?.token_metadata)
            ? asset?.token_metadata
            : "",
        account_base_url:
            asset.account_base_url || "https://opensea.io",
        collection: {
            name: collection_name,
            image_url:
                asset.collection?.image_url ||
                asset.collection?.imageUrl ||
                null,
            external_url: asset.collection?.external_url || null,
        },
        // dimensions: dimensions || [],
        // videoDimensions: videoDimensions || [],
        isOwned: true,
        original_mime_type: asset.mimeType || null,
        mime_type: asset.mimeType || null,
        incompatible: asset.incompatible || false,
        isCreatorButNotOwned: false,
        needsRefetch: !!asset.needsRefetch,
        customData: asset.customData || null,
        files: asset?.files || [],
        envmap: asset?.envmap || "",
        shape: shape,
    };

    return payload;
};

export const formatAssets = (
    rawAssets,
    setLoadingSteps,
    isFetchMinted = false,
    owner,
    chain = null
) => {

    const assets: ReturnType<typeof formatAsset>[] = [];

    const ownedAssets = {};

    if (isFetchMinted) {
        rawAssets.map((asset) => {
            ownedAssets[asset.token_id] = asset;
        });
    }

    rawAssets &&
        rawAssets.map(async (asset, index) => {
            if (setLoadingSteps) {
                setLoadingSteps(index + 1);
            }

            var payload = formatAsset(asset);

            // We check if it's in the owned assets. If it's the case then the user is the owner and creator of this asset.
            if (payload?.blockchain != "tezos" && isFetchMinted) {
                payload.isCreatorButNotOwned = !!ownedAssets?.[asset.token_id];
                if (!payload.isCreatorButNotOwned) {
                    payload.isOwned = false;
                }
            }

            // if no owner (in the case of matic assets always, enforce owner)
            if (owner && !payload?.owner?.address) {
                payload.owner = {
                    address: owner.walletId,
                    profile_img_url: owner.avatar || "/images/avatar.png",
                    user: {
                        username: owner.username,
                    },
                };
            }

            if (chain) {
                payload.blockchain = chain;
            }

            assets.push(payload);
        });

    return { assets };
};
