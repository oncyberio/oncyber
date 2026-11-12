import { UserContext } from "@components/context/UserContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import Icon from "@components/Icon";
import Spinner from "@components/Spinner";
import { canBuyRoom, getRoomExternalLink } from "@dapp/cyberRooms";
import ConnectWallet from "@ui/components/ConnectWallet";
import { NButton } from "@ui/components/NButton";
import { Destination } from "@uitypes/destinations";
import { RoomParameters } from "@uitypes/roomParameters";
import { getStatus } from "@utils/destinations";
import { destinationCover } from "@utils/destinationCover";
import { rooms } from "@utils/rooms";
import { noop } from "lodash";
import { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import { useRoomBuyNowContext } from "./BuyNowContext";
import { RoomSection } from "./shared/constants";
import { ActionMenu } from "./Uploader/Actions";
import { useUploader } from "./Uploader/UploaderProvider";
import { useAuthorName } from "./useAuthorName";
import { useRooms } from "./useRooms";
import { IS_MOBILE } from "@3constants";
import { useRouter } from "next/router";
import { createEmptySpace } from "../../utils";
import { useStudioMenu } from "@features/studio/StudioMenu/context/StudioContext";
export interface DestinationBoxProps {
    section: RoomSection;
    room: Destination;
    isFuture?: boolean;
}

const secondaryStyle = {
    background: "rgba(0,0,0,0.3)",
    border: "1px solid white",
    color: "white",
    marginLeft: 4,
};

export function DestinationCell({
    room,
    section,
    isFuture,
}: DestinationBoxProps) {
    //
    const router = useRouter();

    const { name, author, nonFungible, blockchain } = room;

    const capacity = room.capacity ?? room.params.capacity ?? 0;

    const editions =
        room.quantity ?? room.editions ?? room.params.editions ?? null;

    const { user, token, isAnonymous } = useContext(UserContext);

    const {
        setRoomsState,
        updateRoom,
        roomFloorPrices,
        ownedRooms,
        onRoomBuy,
        handleCreateSpace,
        roomsState,
        onCreateEmptyStudioSpace,
    } = useRooms();

    const { buyRoom } = useRoomBuyNowContext();

    const { submitForReview, mint } = useUploader();

    const [isBusy, setBusy] = useState(false);
    const [isVideoLoading, setIsVideoLoading] = useState(true);
    const [isHover, setIsHover] = useState(false);

    const [isHandlingCreate, setHandlingCreate] = useState(false);
    const [showConnect, setShowConnect] = useState(false);

    const authorName = useAuthorName(author);

    const handleSubmitReview = useEventCallback(async () => {
        submitForReview(room, (dest) => {
            updateRoom(dest ?? room.slug);
        });
    }, []);

    const handleMint = useEventCallback(async () => {
        mint(room, (dest) => {
            updateRoom(room.slug);
        });
    }, []);

    const handleBuyRoom = useEventCallback(async () => {
        const success = await buyRoom(room, price);

        if (success) {
            onRoomBuy(room.slug);
        }
    }, []);

    const handleViewMore = useEventCallback(async () => {
        // View More goes to the room's marketplace listing (OpenSea on
        // ethereum/polygon). The in-app purchase stays on the Buy Now
        // button; the buy modal is only a fallback when there's no listing
        // link to open.
        if (externalLink) {
            window.open(externalLink);
        } else if (canBuyRoom(room)) {
            //
            setRoomsState((state) => {
                return {
                    ...state,
                    buyingRoom: room.slug,
                };
            });

            const pathname = window.location.pathname;
            const params = new URLSearchParams(window.location.search);

            params.set("buy", room.slug);

            const asUrl = `${pathname}?${params}`;

            router.push(
                {
                    pathname: router.pathname,
                    query: {
                        buy: room.slug,
                    },
                },
                asUrl,
                { shallow: true }
            );
        }
    }, []);

    const handleCreateSpaceClick = useEventCallback(async () => {
        if (user?.id) {
            if (isFuture) {
                //
                onCreateEmptyStudioSpace(room?.slug);
            } else {
                handleCreateSpace(room);
            }
        } else {
            setShowConnect(true);
        }
    }, []);

    useEffect(() => {
        if (isHandlingCreate && user?.id) {
            setHandlingCreate(false);
            handleCreateSpace(room);
        }
    }, [isHandlingCreate, user?.id]);

    const externalLink = getRoomExternalLink(room);
    let price =
        roomFloorPrices[room.blockchain]?.[room.contractName]?.[
            room.token_id
        ] ?? null;

    const isOwned = section != "uploaded" && ownedRooms[room.slug];

    const isFree = section == "owned" && !isOwned;

    const src =
        destinationCover(room) ||
        "https://cyber.mypinata.cloud/ipfs/QmV4RGoKdKa49WmnZYp9psrtkJ24e1SRsQFEBhWfg1Vb8o?filename=thumbnail_yvbk53_auozqa_e3jxwt_lokvto.png";

    const canBuy = canBuyRoom(room);

    let cta;

    /**
     * CTA:
     *
     * owned section    :   Create
     *
     * buy section      :   Buy | View more
     *
     * upload section       Create | [uploader action]
     *
     */

    if (isBusy) {
        cta = (
            <div className="loading overlay">
                <div>Creating Space</div>
                <Spinner className="spinner" />
            </div>
        );
    } else {
        let actions = [];
        //

        if (section != "purchase") {
            //

            actions.push(
                <NButton
                    className={
                        roomsState.roomCreatingSpace != null ? "disabled" : ""
                    }
                    disabled={roomsState.roomCreatingSpace != null}
                    overrideTheme="dark"
                    onClick={handleCreateSpaceClick}
                >
                    {isFuture ? "Apply kit" : "Create Space"}
                </NButton>
            );

            if (section === "uploaded") {
                if (room.status === "tested" && !isFuture) {
                    actions.push(
                        <NButton
                            style={secondaryStyle}
                            overrideTheme="dark"
                            onClick={handleSubmitReview}
                        >
                            Submit for Review
                        </NButton>
                    );
                } else if (room.status === "verified") {
                    actions.push(
                        <NButton
                            style={secondaryStyle}
                            overrideTheme="dark"
                            onClick={handleMint}
                        >
                            Mint now!
                        </NButton>
                    );
                }
            }
        } else {
            if (canBuy && price != null && !isOwned) {
                actions.push(
                    <NButton overrideTheme="dark" onClick={handleBuyRoom}>
                        Buy Now
                    </NButton>
                );
            } else if (isOwned) {
                actions.push(
                    <NButton
                        className={
                            roomsState.roomCreatingSpace != null
                                ? "disabled"
                                : ""
                        }
                        disabled={roomsState.roomCreatingSpace != null}
                        overrideTheme="dark"
                        onClick={handleCreateSpaceClick}
                    >
                        Create Space
                    </NButton>
                );
            }

            if (externalLink || canBuy) {
                actions.push(
                    <NButton
                        style={secondaryStyle}
                        overrideTheme="dark"
                        onClick={handleViewMore}
                    >
                        View More
                    </NButton>
                );
            }
        }

        cta = <div className="cta overlay">{actions}</div>;
    }

    return (
        <>
            {showConnect && (
                <ConnectWallet
                    open={true}
                    toggle={() => {
                        setShowConnect(false);
                    }}
                    callbackAfterAuth={() => {
                        setHandlingCreate(true);
                    }}
                />
            )}
            <Container>
                <div
                    onMouseEnter={() => setIsHover(true)}
                    onMouseLeave={() => setIsHover(false)}
                    className="img-wrapper"
                >
                    <div className="bg-wrapper" style={{ width: "100%" }}>
                        <img src={src} height="220" />
                        <div
                            style={
                                isVideoLoading
                                    ? { opacity: "0" }
                                    : { opacity: "1" }
                            }
                        >
                            {(room?.animation_url || room?.animationHash) &&
                                isHover &&
                                !IS_MOBILE && (
                                    <video
                                        src={
                                            room?.animation_url ||
                                            `https://cyber.mypinata.cloud/ipfs/${room?.animationHash}`
                                        }
                                        preload={"auto"}
                                        onCanPlay={() => {
                                            setIsVideoLoading(false);
                                        }}
                                        loop
                                        autoPlay
                                        muted
                                    ></video>
                                )}
                        </div>
                    </div>

                    {!isFuture && (
                        <>
                            {isFree && (
                                <div className="badge free">
                                    <Dot /> Free
                                </div>
                            )}
                            {section === "uploaded" && (
                                <div className="review">
                                    <span className={room.status} />
                                    {getStatus(room.status)}
                                </div>
                            )}
                        </>
                    )}

                    {cta}
                </div>
                <Bottom>
                    <div
                        className="info"
                        style={{
                            width:
                                section === "uploaded"
                                    ? "calc(100% - 40px)"
                                    : "100%",
                        }}
                    >
                        <div className="title">
                            <label>{name}</label>
                            <div className="price">
                                {blockchain && (
                                    <img
                                        src={`/v2/icons/${blockchain}.svg`}
                                        title={blockchain}
                                    />
                                )}
                                {price && <span>{price}</span>}
                            </div>
                        </div>
                        <div className="desc">
                            <span className="author">By: {authorName}</span>
                            {capacity > 0 ? (
                                <>
                                    <span className="sep">•</span>
                                    <span>{capacity} Frames</span>
                                </>
                            ) : null}
                            {nonFungible && (
                                <>
                                    {" "}
                                    <span className="sep">•</span>
                                    <span>1 / {editions || "∞"}</span>
                                </>
                            )}
                        </div>
                    </div>
                    {section === "uploaded" && (
                        <div className="action-menu">
                            <ActionMenu
                                destination={room}
                                blacklist={["create_space"]}
                            />
                        </div>
                    )}
                </Bottom>
            </Container>
        </>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    user-select: none;

    & > .img-wrapper {
        position: relative;
        height: 220px;
        width: 100%;
        border-radius: 8px;
        object-fit: cover;
        overflow: hidden;
        background: linear-gradient(
            180deg,
            #070707 0%,
            rgba(7, 7, 7, 0.05) 91.18%
        );

        & > .badge {
            position: absolute;
            right: 5px;
            top: 5px;
            display: flex;
            gap: 4px;
            align-items: center;

            & > img {
                width: 14px;
                height: 14px;
            }
        }

        & > .badge.owned {
            height: 26px;
            display: flex;
            justify-content: center;
            align-items: center;
            background: rgba(7, 7, 7, 0.6);
            backdrop-filter: blur(40px);
            border-radius: 999999px;
            // text-transform: uppercase;
            color: #fff;
            font-weight: 400;
            font-size: 11px;
            padding: 0 12px;
        }

        & > .badge.free {
            width: 62px;
            height: 26px;
            display: flex;
            justify-content: center;
            align-items: center;
            background: rgba(7, 7, 7, 0.6);
            backdrop-filter: blur(40px);
            border-radius: 999999px;
            // text-transform: uppercase;
            color: #fff;
            font-weight: 400;
            font-size: 11px;
        }

        & > .review {
            position: absolute;
            right: 6px;
            top: 6px;
            padding: 8px 16px;
            height: 26px;

            padding-bottom: 10px;
            display: flex;
            justify-content: center;
            align-content: center;
            align-items: baseline;
            flex-direction: row;
            background: rgba(7, 7, 7, 0.6);
            backdrop-filter: blur(40px);
            border-radius: 100px;
            font-weight: 400;
            font-size: 12px;
            line-height: 100%;
            color: #ffffff;

            & > span {
                width: 8px;
                height: 8px;
                border-radius: 999px;
                margin-right: 5px;

                &.submitted {
                    background: #ff9a3d;
                }

                &.tested {
                    background: #fd7310;
                }

                &.active {
                    background: #00e3bd;
                }

                &.verified {
                    background: #ffffff;
                }

                &.rejected,
                &.failed {
                    background: #ff0000;
                }
            }
        }

        & > .overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }

        & > .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: rgba(0, 0, 0, 0.3);
            color: white;
            font-size: 24px;

            & .spinner {
                transform: scale(50%);
            }
        }

        & > .cta {
            display: none;

            top: 0;
            left: 0;
            width: 100%;
            height: 100%;

            & .icon {
                width: 24px;
                height: 24px;
            }

            & .disabled {
                cursor: not-allowed;
            }
        }

        & > .bg-wrapper > div > video {
            position: absolute;
            left: 50%;
            top: 50%;
            object-fit: cover;
            width: 100%;
            height: 220px;
            transform: translate(-50%, -50%);
        }

        &:hover > .bg-wrapper > div > video {
        }

        & > .bg-wrapper > img {
            position: absolute;
            inset: 0px;
            box-sizing: border-box;
            padding: 0px;
            border: none;
            margin: auto;
            display: block;
            width: 0px;
            height: 0px;
            min-width: 100%;
            max-width: 100%;
            min-height: 100%;
            max-height: 100%;
            object-fit: cover;
        }
    }

    & > .img-wrapper:hover > .cta {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    & .sep {
        margin: 0 6px;
        color: #e0e0e0;
        padding-top: 4px;
    }
`;

const Bottom = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;

    & .info {
        width: 100%;

        & > .title {
            display: flex;
            flex-direction: row;
            margin-top: 12px;
            font-style: normal;
            font-weight: 500;
            font-size: 16px;

            & > label {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            & > .price {
                margin-left: auto;
                font-size: 14px;
                display: flex;
                gap: 2px;
                align-items: center;

                & > img {
                    width: 14px;
                    height: 14px;
                }
            }
        }

        & > .desc {
            display: flex;
            flex-direction: row;
            align-items: center;
            margin-top: 6px;
            font-style: normal;
            font-weight: 400;
            font-size: 14px;
            color: #757575;

            & > .author {
                max-width: 120px;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
        }
    }

    & .action-menu {
        margin-left: auto;
    }
`;

export const Free = styled.div`
    width: 62px;
    height: 28px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #070707;
    border-radius: 999999px;
    text-transform: uppercase;
    color: #fff;
    font-weight: 500;
    font-size: 12px;
`;

export const Dot = styled.span`
    width: 8px;
    height: 8px;
    background: #00e3bd;
    border-radius: 50%;
`;
