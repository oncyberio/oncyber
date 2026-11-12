import styled, { css } from "styled-components";

import { TYPES } from "@3factory/artwork/constants";

import { Asset } from "@uitypes/Asset";

import { ACTION_MESSAGES } from "@features/studio/utils/constants";

import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";

import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";

import { ArtworkInfo } from "../../shared/ArtworkInfo";
import { SwitchMimeType } from "./SwitchMimeType";
import { ArtworkSize } from "./ArtworkSize";
import { ArtworkCoordinates } from "./ArtworkCoordinates";
import { ArtworkFrameColor } from "./ArtworkFrameColor";
import { CuratorNotes } from "./CuratorNotes";
import { EnvmapEditor } from "./EnvmapEditor";
import { ModelAnimations } from "./ModelAnimations";
import { isNft } from "@features/studio/EditWorldMenu/utils";
import { HTMLArtworkToggle } from "./HTMLArtworkToggle";
import { WebsiteDimensions } from "./WebsiteDimensions";
import { Toggle360 } from "./Toggle360";
import { AssetMetadata } from "./ArtworkMetadata";
import { QuickEdit } from "./QuickEdit";
import ArtworkCollider from "./ArtworkCollider";
import { useMemo, useState } from "react";
import { classes } from "@utils/js";
import { RoundButton } from "@components/DesignSystem/buttons";
import { useScreenSize } from "@components/hooks/useScreenSize";

function Desktop({ items }) {
    return items.map(({ component, key, nosep }) => {
        return (
            <div
                key={key}
                className={classes({
                    section: true,
                    nosep: nosep,
                })}
            >
                {component}
            </div>
        );
    });
}

function Mobile({ items }) {
    const [activeIndex, setActiveIndex] = useState(0);

    const Component = items[activeIndex]?.component ?? null;

    return (
        <MobileContainer>
            {Component}

            <MobileWrapper className="scrollbar-hidden">
                {items.map(({ title }, index) => (
                    <RoundButton
                        className={classes({
                            "mobile-btn": true,
                            active: index === activeIndex,
                        })}
                        onClick={() => setActiveIndex(index)}
                    >
                        {title}
                    </RoundButton>
                ))}
            </MobileWrapper>
        </MobileContainer>
    );
}

const embedTypes = [TYPES.HTML_EMBED, TYPES.YOUTUBE_EMBED];

export function EditArtwork() {
    //
    const { artworkMessages } = useEditWorld();

    const mesh = useSelectedArtwork();

    const asset = mesh.userData as Asset;

    const message = artworkMessages?.[asset.id];

    const componentMap = useMemo(() => {
        const isModel = mesh.mediaType === TYPES.MODEL;

        const isUpload =
            mesh.userData?.source?.blockchain === "none" &&
            mesh.userData?.source?.api === "oncyber";

        const hasAnimations =
            isModel &&
            ((mesh as any).isAvatarModel ||
                (mesh as any).animations?.length > 0);

        const showCuratorNotes =
            isNft(mesh.userData as any) &&
            mesh.mediaType != TYPES.MODEL &&
            mesh.mediaType != TYPES.GLOBAL_STREAM &&
            mesh.mediaType != TYPES.TRIGGER_ZONE;

        const show360 =
            mesh.mediaType === "PANORAMA" ||
            mesh.userData.token_address ===
                "0x250ff17091c3c8beddc32c6ce66f2e896c07acb7" ||
            (mesh.mediaType === "IMAGE" && mesh.userData?.is360);

        const showHTMLToggle =
            mesh.mediaType === TYPES.HTML &&
            mesh.userData?.name &&
            !mesh.userData?.name.includes("Squiggle") &&
            !mesh.userData?.name.includes("Transitions");

        const showSwitchMime = mesh.userData.files?.length > 0;

        return [
            {
                key: "quick-edit",
                title: "Quick Edits",
                visible:
                    mesh.mediaType != TYPES.GLOBAL_STREAM &&
                    mesh.mediaType != TYPES.TRIGGER_ZONE,
                component: <QuickEdit />,
            },
            {
                key: "art-metadata",
                title: "Title",
                visible: isUpload,
                nosep: true,
                component: <AssetMetadata />,
            },
            {
                key: "art-collider",
                title: "Collisions",
                visible: isModel,
                component: <ArtworkCollider />,
            },
            {
                key: "switch-mime",
                title: "Change asset type",
                visible: showSwitchMime,
                component: <SwitchMimeType />,
            },
            {
                key: "website-dims",
                title: "Dimensions",
                visible: mesh.mediaType === TYPES.HTML_EMBED,
                component: <WebsiteDimensions />,
            },
            {
                key: "toggle-360",
                title: "Toggle 360",
                visible: show360,
                component: <Toggle360 />,
            },
            {
                key: "art-anims",
                title: "3D Animations",
                visible: hasAnimations,
                component: <ModelAnimations />,
            },
            {
                key: "art-size",
                title: "Size",
                visible:
                    mesh.mediaType !== TYPES.TRIGGER_ZONE &&
                    mesh.mediaType != TYPES.GLOBAL_STREAM,
                component: <ArtworkSize />,
            },
            {
                key: "art-envmap",
                title: "Reflection",
                visible: isModel,
                component: <EnvmapEditor />,
            },
            {
                key: "art-coords",
                title: "Placement",
                visible: true,
                component: (
                    <ArtworkCoordinates
                        isYOnly={mesh.mediaType === TYPES.TRIGGER_ZONE}
                    />
                ),
            },
            {
                key: "art-colors",
                title: "Frame",
                visible:
                    !isModel &&
                    mesh.mediaType != TYPES.GLOBAL_STREAM &&
                    mesh.mediaType != TYPES.TRIGGER_ZONE,
                component: <ArtworkFrameColor />,
            },
            {
                key: "html-toggle",
                title: "Animation",
                visible: showHTMLToggle,
                component: <HTMLArtworkToggle />,
            },
            {
                key: "art-notes",
                title: "Curator Notes",
                visible: showCuratorNotes,
                component: <CuratorNotes />,
            },
        ];
    }, [mesh]);

    const items = componentMap.filter((item) => item.visible);

    const { width } = useScreenSize();

    const isMobile = width <= 600;

    return (
        <Container>
            {/* {!message?.isError &&
                message?.message == ACTION_MESSAGES.GIF_CONVERTING && (
                    <ArtworkMsg key="art-msg" isError={message.isError}>
                        <div>
                            <img src="../images/loading.svg" />{" "}
                            {message?.message}
                        </div>
                    </ArtworkMsg>
                )} */}

            <div key="art-info" className="section">
                <ArtworkInfo asset={mesh.userData as any} />
            </div>

            {isMobile ? <Mobile items={items} /> : <Desktop items={items} />}

            {/* <ArtworkScript /> */}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;

    @media (max-width: 600px) {
        .component-label {
            display: none;
        }
    }

    & > .section {
        border-top: 1px solid var(--separator-color);
        padding: 16px 0;
    }

    & > .section:first-child {
        border-top: none;
        padding-top: 0;
    }

    & > .section:last-child {
        padding-bottom: 0;
    }
`;

const MobileContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-top: 15px;

    .quick-edit-toolbar {
        width: 100%;

        & > button.tool-btn {
            width: 100%;
        }
    }
`;

const MobileWrapper = styled.div`
    width: 100%;
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: flex-start;
    max-width: 100%;
    overflow: auto;

    .mobile-btn {
        background: transparent;
        border: none;
        color: #a7a7a7;
        font-size: 14px;
        font-style: normal;
        font-weight: 400;
        line-height: 24px;
        height: 32px;
        white-space: nowrap;

        &.active {
            color: #fff;
            opacity: 1;
            padding: 5px 16px;
            border-radius: 900px;
            background: rgba(0, 0, 0, 0.5);
        }
    }
`;

const ArtworkMsg = styled.p<{
    isError: boolean;
}>`
    font-size: 12px;
    margin: 0 0;
    grid-column: 1 / span 2;

    div {
        display: flex;
        align-items: center;

        img {
            width: 20px;
            margin-right: 8px;
        }
    }

    ${(props) =>
        props.isError
            ? css`
                  color: red;
              `
            : null};
`;
