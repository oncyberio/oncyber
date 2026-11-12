import { useState } from "react";
import styled from "styled-components";
import { experienceControl } from "@features/content-host/experienceChrome";

import { useToggle } from "@components/hooks/useToggle";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import IconImg from "@ui/components/IconImg";
import { formatLocation, parseLocation } from "@utils/js";

import { ShareDropdown, ShareType } from "./ShareDropdown";
import { useArtworkInfo } from "../../ArtworkContext";

const HOST = "https://oncyber.io";

function shareTwitter(link: string) {
    const params = new URLSearchParams();

    params.set("text", link);

    window.open(`https://twitter.com/intent/tweet?${params}`, "_blank");
}

function shareFacebook(link: string) {
    const params = new URLSearchParams();

    params.set("u", link);

    window.open(
        `https://www.facebook.com/sharer/sharer.php?${params}`,
        "_blank"
    );
}

export function ShareButton({
    style = {},
    className = "",
    dropdownStyle = {},
    feedbackStyle = {},
    tokenLink = null,
}) {
    const world = useWorld();
    const { asset } = useArtworkInfo();
    const [isDropdownShoing, toggleDropdown] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const handleClick = () => {
        setFeedback(null);
        toggleDropdown(!isDropdownShoing);
    };

    const handleShareClick = async (type: ShareType) => {
        toggleDropdown(false);

        const coords = world.current.getTeleportCoords({
            artwork: asset,
        });

        if (coords) {
            let params = new URLSearchParams();
            parseLocation;
            params.set(
                "coords",
                formatLocation(coords.position, coords.rotation.y)
            );
            const url = `${HOST}${window.location.pathname}?${params}`;

            if (type === ShareType.Twitter) {
                shareTwitter(url);
            } else if (type === ShareType.Facebook) {
                shareFacebook(url);
            } else if (type === ShareType.Looks) {
                if (tokenLink) {
                    window.open(
                        `https://looksrare.org/collections/${tokenLink}`,
                        "_blank"
                    );
                    return;
                }

                window.open(
                    `https://looksrare.org/collections/${asset.contract_address}/${asset.token_id}`,
                    "_blank"
                );
            } else if (type === ShareType.Opensea) {
                if (tokenLink) {
                    window.open(
                        `https://opensea.io/assets/ethereum/${tokenLink}`,
                        "_blank"
                    );
                    return;
                }

                window.open(asset.openSeaLink, "_blank");
            } else if (type === ShareType.Link) {
                try {
                    await navigator.clipboard.writeText(url);
                    setFeedback("Link copied!");
                } catch (err) {
                    console.error(err);
                    setFeedback("Failed to copy link");
                } finally {
                    setTimeout(() => {
                        setFeedback(null);
                    }, 1000);
                }
            } else if (type === ShareType.Embed) {
                try {
                    const embedCode = `<iframe width=100% height=100% src="http://oncyber.io/lotfi0?coords=-0.37x2.88x-13.27x1.68"></iframe>`;

                    await navigator.clipboard.writeText(embedCode);
                    setFeedback("embed code copied!");
                } catch (err) {
                    setFeedback("Failed to copy emned code");
                } finally {
                    setTimeout(() => {
                        setFeedback(null);
                    }, 1000);
                }
            }
        }
    };

    return (
        <Container className={className} style={style}>
            <ShareControl
                type="button"
                aria-label="Share artwork"
                title="Share artwork"
                aria-expanded={isDropdownShoing}
                onClick={handleClick}
            >
                <IconImg
                    style={{ marginRight: 2 }}
                    className="img"
                    name="share-2"
                    size={18}
                />
            </ShareControl>
            <ShareDropdown
                style={{
                    right: 0,
                    transform: "none",
                    maxWidth: "calc(100vw - 64px)",
                    ...dropdownStyle,
                }}
                borderColor="#5a5a5a"
                isShowing={isDropdownShoing}
                onClick={handleShareClick}
            />
            {feedback && (
                <Feedback role="status" style={feedbackStyle}>
                    {feedback}
                </Feedback>
            )}
        </Container>
    );
}

const Container = styled.div`
    position: relative;
`;

const Feedback = styled.div`
    padding: 5px 8px;
    position: absolute;
    width: max-content;
    left: 50%;
    top: 120%;
    transform: translateX(-50%);
    text-align: center;
    border-radius: 8px;
    box-shadow: 0px 4px 40px rgba(0, 0, 0, 0.16);
    font-size: 16px;
    font-weight: 500;
    pointer-events: none;
    outline: none;
    z-index: 1000001;
`;

const ShareControl = styled.button`
    ${experienceControl};
    background: var(--oc-surface, #242424);
    .img {
        filter: invert(1);
    }
`;
