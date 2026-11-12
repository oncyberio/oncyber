import { useToggle } from "@components/hooks/useToggle";
import ShareIcon from "@components/Icons/ShareIcon";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { formatLocation, parseLocation } from "@utils/js";
import { CSSProperties, useState } from "react";
import { experienceControl } from "@features/content-host/experienceChrome";
import styled, { css } from "styled-components";
import { IconButton } from "@ui/components/IconButton.tsx";

import { useArtworkInfo } from "./ArtworkContext";
import { ShareDropdown, ShareType } from "./ShareDropdown";
import { useCyberTheme } from "@components/context/ThemeProvider";

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
    size,
    style = {},
    onlyDark = false,
    dropdownStyle = {},
    feedbackStyle = {},
    tokenLink,
    experience = false,
}: {
    size: string;
    style?: CSSProperties;
    onlyDark?: boolean;
    dropdownStyle?: CSSProperties;
    feedbackStyle?: CSSProperties;
    tokenLink?: string;
    experience?: boolean;
}) {
    const world = useWorld();
    const { isLightTheme } = useCyberTheme();
    const { asset } = useArtworkInfo();
    const [isDropdownShoing, toggleDropdown] = useToggle(false);
    const [feedback, setFeedback] = useState(null);

    const handleClick = () => {
        setFeedback(null);
        toggleDropdown();
    };

    const handleShareClick = async (type: ShareType) => {
        toggleDropdown();

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
        <Container style={style} onlyDark={onlyDark}>
            <ShareControl
                $experience={experience}
                type="button"
                aria-label="Share artwork"
                aria-expanded={isDropdownShoing}
                title="Share"
                size={size}
                onClick={handleClick}
                style={
                    onlyDark && !experience
                        ? {
                              background: "transparent",
                              borderWidth: "1.5px",
                              borderColor: "#C2C2C2",
                          }
                        : {}
                }
            >
                <ShareIcon size={20} {...(onlyDark && { color: "#fff" })} />
            </ShareControl>
            <ShareDropdown
                style={
                    experience
                        ? {
                              right: 0,
                              transform: "none",
                              maxWidth: "calc(100vw - 64px)",
                              ...dropdownStyle,
                          }
                        : dropdownStyle
                }
                borderColor="#292929"
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

const Container = styled.div<{ onlyDark: boolean }>`
    position: relative;

    ${({ onlyDark }) => {
        return (
            onlyDark &&
            css`
                svg,
                img {
                    filter: none;
                }
            `
        );
    }}
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
    background: ${({ theme }) =>
        theme.dropdown?.background || theme.background};
    box-shadow: 0px 4px 40px rgba(0, 0, 0, 0.16);
    font-size: 16px;
    font-weight: 500;
    pointer-events: none;
    outline: none;
`;

const ShareControl = styled(IconButton)<{ $experience: boolean }>`
    ${({ $experience }) =>
        $experience &&
        css`
            ${experienceControl};
            background: var(--oc-surface, #242424);
        `}
`;
