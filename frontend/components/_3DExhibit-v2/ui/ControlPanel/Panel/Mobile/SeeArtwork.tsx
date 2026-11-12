import { formatUser } from "@components/modals/ArtworkInfo/D/utils";
import React, { useState } from "react";
import styled, { css } from "styled-components";
import { usePanel } from "../../context/PanelProvider";
import { getMime } from "@utils/formatAssets";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { motion } from "framer-motion";
import { focusArtwork } from "../../ArtworkInfoBulle/focusArtwork";

export default function SeeArtwork({ artwork, assetType }) {
    const { setIsMobileArtworkInfoOpened } = usePanel();

    const world = useWorld();

    const title =
        artwork?.name ||
        `${artwork?.collection?.name} #${artwork?.token_id}` ||
        `${artwork?.contract_address}`;

    const author = formatUser(artwork?.creator);

    const art = world.current
        .getArtworks()
        .find((a) => a.userData.id === artwork?.id);

    const shouldShowAction = art?.infoAction || assetType === "Nft";

    const [isOpening, setIsOpening] = useState(false);

    const toggleArtwork = async () => {
        if (isOpening) return;

        if (art?.infoAction) {
            //
            const cont = await Promise.resolve(art.infoAction()).catch((e) => {
                //
                console.error(e);

                return false;
            });

            if (!cont) return;
        }

        if (assetType !== "Nft") return;

        // Move to the artwork first, then open its details on top of it.
        setIsOpening(true);
        await focusArtwork(world.current, art);
        setIsOpening(false);
        setIsMobileArtworkInfoOpened(true);
    };

    const assetMimeType = getMime(artwork);

    const assetIcon =
        assetType == "Nft"
            ? "/icons/NFT.svg" //nft
            : assetMimeType.split("/")[0] == "image"
            ? "https://cyber.mypinata.cloud/ipfs/QmeNSRu7rG9e1ZiKEjUXM78oJVfhhTTC887fPzHnkzwrQe?filename=PNG_1_vvdzj8.png" //png
            : assetMimeType.split("/")[0] == "video"
            ? "https://cyber.mypinata.cloud/ipfs/QmecjJWLnnFVC25dAd8Z9sKJX9rApTVD7Y92MvN67HNn6X?filename=videomp4_w5acp8.svg" //video
            : assetMimeType.split("/")[0] == "model"
            ? "https://cyber.mypinata.cloud/ipfs/QmYu49iEEj6scSxyQCgWgxQUjMGveSBCJGtjtRCyFUSU8W?filename=3d.png" //3d
            : assetMimeType == "embed/youtube"
            ? "https://cyber.mypinata.cloud/ipfs/QmYS8amVLgTivAjMfibxvppA5DWPabR7Ri3k6uPoxuNh8i?filename=PNG_xmfudk.png" //ytb
            : assetMimeType == "embed/html/website"
            ? "https://cyber.mypinata.cloud/ipfs/QmeAkfmZAPrwGFC83GsphMXxjKzZnjbLupVjVWCVo25rqD?filename=WEB_m3sa5z.png" //web
            : "https://cyber.mypinata.cloud/ipfs/QmSyDc8efJJZ7sxfCNrTBSossnn9nUpyPt4Ei9ZxqiZ236?filename=FILE_lypcxo.png"; //file

    const createdBy = author.username ?? author.id;

    return (
        <Container>
            <motion.div
                key={"see-artwork"}
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={toggleArtwork}
                className="see-artwork-container"
                role={shouldShowAction ? "button" : undefined}
                aria-label={
                    shouldShowAction ? `Artwork details: ${title}` : undefined
                }
            >
                <span className="title ellipsis">{title}</span>
                {createdBy && (
                    <span className="author ellipsis">{createdBy}</span>
                )}
            </motion.div>
        </Container>
    );
}

const Container = styled.div`
    .see-artwork-container {
        top: 20px;
        left: 50%;
        position: fixed;
        padding: 8px 24px;
        border-radius: 900px;
        transform: translateX(-50%);
        background: rgba(7, 7, 7, 0.8);
        backdrop-filter: blur(22.2973px);
        display: flex;
        flex-direction: column;
        max-width: calc(100% - 200px);

        .ellipsis {
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        & > span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-left: 8px;
            margin-right: 8px;
        }

        & > span.title {
            font-weight: 500;
            font-size: 13px;
            color: #ffffff;
            margin: 0px;
            padding: 0px;
        }

        & > span.author {
            font-weight: 400;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.5);
            margin: 0px;
            padding: 0px;
        }
    }
`;
