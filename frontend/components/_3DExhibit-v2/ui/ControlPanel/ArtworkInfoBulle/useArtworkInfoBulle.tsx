import { UserContext } from "@components/context/UserContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { ADMIN_SYNC_MEDIA_TIME } from "@components/_3DExhibit-v2/three/factory/multiplayer/constants";
import AlgoliaProvider from "@utils/algolia/AlgoliaProvider";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { logEvent } from "@utils/saveToDb";
import { useContext, useEffect } from "react";
import { getMime } from "@utils/formatAssets";

import { useProfile } from "@components/hooks/useProfile";
type AssetType = "Nft" | "Youtube" | "Website" | "Unknown" | "Text" | "Upload";

export default function useArtworkInfoBulle({
    artwork,
    exhibit,
    toggleArtworkInfo,
}) {
    const { user } = useContext(UserContext);

    const world = useWorld();

    const creatorProfile = useProfile({ id: artwork?.creator?.address });

    const creator =
        creatorProfile?.username ||
        (artwork?.creator?.address &&
            (artwork?.creator?.user?.username ||
                artwork?.creator?.username ||
                artwork?.creator?.address?.slice(0, 10) + "..."));

    const owner =
        artwork?.owner?.user?.username ||
        artwork?.owner?.address?.slice(0, 9) + "...";

    const ownerImg =
        artwork?.owner?.user?.profile_img_url || "/images/opensea-black.png";

    const assetType: AssetType =
        artwork?.source?.api === "oncyber" &&
        artwork?.source?.blockchain === "none"
            ? "Upload"
            : artwork.contract_address && artwork.token_id
            ? "Nft"
            : artwork.mime_type === "embed/youtube"
            ? "Youtube"
            : artwork.mime_type?.includes?.("embed/html")
            ? "Website"
            : artwork.mime_type === "cyber/text"
            ? "Text"
            : "Unknown";

    const assetMimeType = getMime(artwork);

    const assetIcon =
        assetType == "Nft"
            ? "https://cyber.mypinata.cloud/ipfs/QmWfnRJ5LnFBLyWGTff7guA9PWSZVCZZ7PHvDxsF7q5fYV?filename=NFT_drgesd.png" //nft
            : assetMimeType?.split("/")[0] == "image"
            ? "https://cyber.mypinata.cloud/ipfs/QmeNSRu7rG9e1ZiKEjUXM78oJVfhhTTC887fPzHnkzwrQe?filename=PNG_1_vvdzj8.png" //png
            : assetMimeType?.split("/")[0] == "video"
            ? "https://cyber.mypinata.cloud/ipfs/QmecjJWLnnFVC25dAd8Z9sKJX9rApTVD7Y92MvN67HNn6X?filename=videomp4_w5acp8.svg" //video
            : assetMimeType?.split("/")[0] == "model"
            ? "https://cyber.mypinata.cloud/ipfs/QmYu49iEEj6scSxyQCgWgxQUjMGveSBCJGtjtRCyFUSU8W?filename=3d.png" //3d
            : assetMimeType == "embed/youtube"
            ? "https://cyber.mypinata.cloud/ipfs/QmYS8amVLgTivAjMfibxvppA5DWPabR7Ri3k6uPoxuNh8i?filename=PNG_xmfudk.png" //ytb
            : assetMimeType == "embed/html/website"
            ? "https://cyber.mypinata.cloud/ipfs/QmeAkfmZAPrwGFC83GsphMXxjKzZnjbLupVjVWCVo25rqD?filename=WEB_m3sa5z.png" //web
            : "https://cyber.mypinata.cloud/ipfs/QmSyDc8efJJZ7sxfCNrTBSossnn9nUpyPt4Ei9ZxqiZ236?filename=FILE_lypcxo.png"; //file

    const sendAnayticsEvent = () => {
        amplitude_logAnalyticsEvent("view_artwork", {
            user_id: user?.id,
            placeholderId: artwork?.id,
            id:
                artwork?.mime_type === "embed/html/website"
                    ? artwork?.token_id
                    : artwork?.contract_address + "/" + artwork?.token_id,
            name: artwork?.name,
            collection: artwork.collection?.name,
            artistId: artwork?.creator?.address,
            ownerId: artwork?.owner?.address,
            exhibitId: exhibit?.id,
            asset_type: artwork?.mime_type,
            destination: exhibit?.info?.room,
            source: "live_exhibit",
            ...world.current.getPlayerData({
                isFirstPerson: true,
            }),
        });

        logEvent("details_artwork", {
            placeholderId: artwork?.id,
            token_id: artwork?.token_id,
            artistId: exhibit?.editors?.[0],
            ownerId: exhibit?.editors?.[0],
            exhibitId: exhibit?.id,
        });
    };

    const moreDetails = async () => {
        //
        const art = world.current
            .getArtworks()
            .find((a) => a.userData.id === artwork?.id);

        if (!art) return;

        if (art.infoAction) {
            //
            const cont = await Promise.resolve(art.infoAction()).catch((e) => {
                //
                console.error(e);

                return false;
            });

            if (!cont) return;
        }

        //Checking if the artwork is not a minted nft but an uploaded artwork
        if (assetType === "Nft") {
            toggleArtworkInfo(true);
        } else if (assetType === "Youtube") {
            // const videoId = artwork.animation_url;
            // window.open(`https://www.youtube.com/watch?v=${videoId}`);
        }
    };

    const nonNft = assetType === "Nft" ? null : artwork;

    useEffect(() => {
        if (nonNft) {
            const tid = setTimeout(() => {
                sendAnayticsEvent();
            }, 3000);

            return () => {
                clearTimeout(tid);
            };
        }
    }, [nonNft]);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            //
            if (artwork == null) return;

            if (
                e.target instanceof HTMLElement &&
                (e.target.nodeName === "INPUT" ||
                    e.target.nodeName === "TEXTAREA")
            )
                return;

            if (!e.repeat && (e.key === "e" || e.key === "E")) {
                sendAnayticsEvent();
                moreDetails();
            }

            // console.log("use aib", e);

            if (!e.repeat && e.shiftKey && (e.key === "t" || e.key === "T")) {
                world.current.handleCommand({
                    type: ADMIN_SYNC_MEDIA_TIME,
                    payload: {
                        assetId: artwork.id,
                    },
                });
            }
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [artwork]);

    return {
        assetType,
        assetIcon,
        creator,
        owner,
        moreDetails,
    };
}
