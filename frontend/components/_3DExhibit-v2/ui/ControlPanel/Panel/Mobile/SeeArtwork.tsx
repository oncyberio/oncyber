import { formatUser } from "@components/modals/ArtworkInfo/D/utils";
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { motion } from "framer-motion";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
import { promptGlass } from "@ui/components/PromptGlass";
import IconImg from "@ui/components/IconImg";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { usePanel } from "../../context/PanelProvider";
import {
    focusArtwork,
    releaseArtworkFocus,
} from "../../ArtworkInfoBulle/focusArtwork";

/**
 * The small-screen artwork bubble: title and creator of the artwork in
 * view, sitting under the world header. For NFTs it is a button; tapping
 * it walks the camera to the artwork and then opens the full details.
 */
export default function SeeArtwork({ artwork, assetType }) {
    const { setIsMobileArtworkInfoOpened } = usePanel();

    const world = useWorld();

    const title =
        artwork?.name ||
        (artwork?.collection?.name
            ? `${artwork.collection.name} #${artwork.token_id}`
            : artwork?.contract_address) ||
        "Artwork";

    const author = formatUser(artwork?.creator);
    const createdBy = author.username ?? author.id;

    const art = world.current
        ?.getArtworks?.()
        .find((a) => a.userData.id === artwork?.id);

    const hasDetails = !!art?.infoAction || assetType === "Nft";

    const [isOpening, setIsOpening] = useState(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const openDetails = async () => {
        if (isOpening || !hasDetails) return;

        if (art?.infoAction) {
            const cont = await Promise.resolve(art.infoAction()).catch((e) => {
                console.error(e);
                return false;
            });
            if (!cont) return;
        }

        if (assetType !== "Nft") return;

        // Walk up to the artwork first, then open its details on top of it.
        setIsOpening(true);
        await focusArtwork(world.current, art);
        if (!mounted.current) {
            // Looked away during the move: nothing opens, give the camera back.
            releaseArtworkFocus(world.current);
            return;
        }
        setIsOpening(false);
        setIsMobileArtworkInfoOpened(true);
    };

    const content = (
        <>
            <span className="text">
                <span className="title">{title}</span>
                {createdBy && <span className="author">{createdBy}</span>}
            </span>
            {hasDetails && (
                <span className="cta" aria-hidden="true">
                    <IconImg name="chevron-right" size={14} mode="light" />
                </span>
            )}
        </>
    );

    return (
        <Bubble
            key="see-artwork"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: base.motion.enter / 1000 }}
            data-artwork-bubble
            onPointerDown={(e) => e.stopPropagation()}
        >
            {hasDetails ? (
                <button
                    type="button"
                    className="surface"
                    aria-label={`${title}: open artwork details`}
                    aria-busy={isOpening || undefined}
                    disabled={isOpening}
                    onClick={openDetails}
                >
                    {content}
                </button>
            ) : (
                <div className="surface" role="status">
                    {content}
                </div>
            )}
        </Bubble>
    );
}

/** Header row is 44px tall at a 22px inset (ExperienceShell); sit under it. */
const HEADER_ROW = 44;
const HEADER_INSET = 22;

const Bubble = styled(motion.div)`
    /* A full-width row that centres the surface: framer-motion owns this
       element's transform for the enter/exit slide, so no translateX here. */
    position: fixed;
    left: max(16px, env(safe-area-inset-left));
    right: max(16px, env(safe-area-inset-right));
    top: calc(
        max(${HEADER_INSET}px, env(safe-area-inset-top)) + ${HEADER_ROW}px +
            ${lobby.panel.gap}px
    );
    display: flex;
    justify-content: center;
    /* Above the world chrome (10010) so the header never covers it. */
    z-index: 10011;
    pointer-events: none;
    font-family: ${base.font.sans};

    .surface {
        ${promptGlass}
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: ${lobby.control.touchSize}px;
        max-width: 100%;
        margin: 0;
        padding: 6px 14px;
        pointer-events: auto;
        border: 0;
        border-radius: ${base.radius.control}px;
        text-align: left;
        box-sizing: border-box;
    }

    button.surface {
        cursor: pointer;
        padding-right: 10px;
        transition: background ${base.motion.standard}ms ease,
            transform ${base.motion.fast}ms ${base.motion.ease};
        &:active {
            transform: scale(0.98);
        }
        &:focus-visible {
            outline: ${base.focus.width}px solid ${lobby.color.controlInk};
            outline-offset: ${base.focus.offset}px;
        }
        &:disabled {
            cursor: progress;
            opacity: 0.7;
        }
    }

    .text {
        display: flex;
        flex-direction: column;
        min-width: 0;
        line-height: 16px;
    }

    .title,
    .author {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .title {
        font-size: ${base.font.size.md}px;
        font-weight: ${base.font.weight.medium};
        color: ${lobby.color.ink};
    }

    .author {
        font-size: ${base.font.size.xs}px;
        font-weight: ${base.font.weight.regular};
        color: ${lobby.color.meta};
    }

    .cta {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        border-radius: ${base.radius.inset}px;
        background: ${base.color.line.subtle};
        box-shadow: inset 0 0 0 1px ${base.color.line.soft};
    }

    @media (prefers-reduced-motion: reduce) {
        button.surface {
            transition: none;
        }
    }
`;
