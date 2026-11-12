import styled, {
    ThemeProvider as StyledThemeProvider,
    withTheme,
} from "styled-components";
import { dark } from "@components/modals/ArtworkInfo/C/theme/dark";
import { darkDialogColors } from "@components/Dialogs/styles";
import { baseTokens as base, landingTokens as landing } from "@styles/tokens";
import { NftBuyPrvider } from "@components/context/NftBuyContext";
import { useOnClickOutside } from "@components/hooks/useClickOutside";
import IconImg from "@ui/components/IconImg";
import { FetchedAsset } from "@uitypes/Asset";
import { RoomParameters } from "@uitypes/roomParameters";
import { useEffect, useMemo, useRef } from "react";
import { DestinationInfo } from "./DestinationInfo";
import { DestinationPreview } from "./DestinationPreview";
import { RoomProvider } from "./RoomContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import dynamic from "next/dynamic";
import { Destination } from "@uitypes/destinations";
import { assetFromRoom } from "@dapp/cyberRooms";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { flattenObject } from "@utils/js";

export interface BuyModalProps {
    room: Destination;
    onClose: () => void;
}

const BuyModal_: React.FC<BuyModalProps & { theme: any }> = ({
    theme,
    room,
    onClose,
}) => {
    //
    // const { clickRef } = useOnClickOutside({
    //     handler: (e) => {
    //         // onClose();
    //     },
    // });

    const clickRef = useRef(null);

    const handleContainerClick = (e) => {
        if (e.target === clickRef.current) {
            onClose();
        }
    };

    useEffect(() => {
        amplitude_logAnalyticsEvent("marketplace_view_more", {
            source: "BuyModal",
            ...room.author,
            blockchain: room.blockchain,
            capacity: room.capacity,
            contractName: room.contractName,
            contract_address: room.contract_address,
            endTime: room.endTime,
            image: room.image,
            name: room.name,
            price: room.price,
            quantity: room.quantity,
            shareCyber: room.shareCyber,
            slug: room.slug,
            startTime: room.startTime,
            status: room.status,
            token_id: room.token_id,
        });

        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = "unset";
        };
    }, []);

    const asset = useMemo(() => {
        return assetFromRoom(room);
    }, [room]);

    const onEvent = useEventCallback((event, data) => {
        const { asset, ...rest } = data;

        amplitude_logAnalyticsEvent(event, {
            ...flattenObject(asset),
            ...rest,
            source: "view_more_marketplace",
        });
    }, []);

    return (
        <StyledThemeProvider
            // Dark on every page, like the shared dialog: the artwork parts
            // inside (activity, offers, price history) follow this theme.
            theme={{
                ...theme,
                ...dark,
                type: "dark",
                color: base.color.ink,
                background: landing.color.panel,
            }}
        >
            <RoomProvider room={room}>
                <NftBuyPrvider nft={asset} onEvent={onEvent}>
                    <Container
                        ref={clickRef}
                        onClick={handleContainerClick}
                        onTouchStart={handleContainerClick}
                    >
                        <Dialog>
                            <div className="header">
                                <h2 className="title">Buy {room.name}</h2>
                                <button className="close-btn" onClick={onClose}>
                                    <IconImg
                                        className="icon"
                                        mode="light"
                                        name="x"
                                    />
                                </button>
                            </div>
                            <div className="body">
                                <div className="left">
                                    <DestinationPreview />
                                </div>
                                <div className="right">
                                    <DestinationInfo />
                                </div>
                            </div>
                        </Dialog>
                    </Container>
                </NftBuyPrvider>
            </RoomProvider>
        </StyledThemeProvider>
    );
};

export const BuyModal = withTheme(BuyModal_);

const Container = styled.div`
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    box-sizing: border-box;
    z-index: 110;
`;

const Dialog = styled.div`
    ${darkDialogColors}
    display: flex;
    flex-direction: column;
    background-color: var(--bg-color);
    color: var(--title-color);
    opacity: 1;
    box-shadow: 0em -8.5em 3.5em rgb(63 63 63 / 30%);
    border-radius: 6px;
    margin-top: auto;
    /* margin-bottom: auto; */

    & > .header {
        display: flex;
        flex-direction: row;
        border-bottom: 1px solid var(--border-color);
        padding: 18px;
    }

    & > .body {
        display: flex;
        flex-direction: row;
        gap: 24px;
        padding: 24px;

        & > .left {
            flex: 0.65;
        }

        & > .right {
            flex: 0.35;
            min-width: 450px;
        }
    }

    @media (max-width: 1200px) {
        & > .body {
            flex-direction: column;
            overflow-y: auto;

            & > .left {
                flex: 1;
            }

            & > .right {
                flex: 1;
            }
        }
    }

    & > .header {
        & > .title {
            font-weight: 400;
            font-size: 16px;
            line-height: 26px;
            margin: 0;
            margin-left: 8px;
        }

        & > .close-btn {
            margin-left: auto;
            border: none;
            background: none;
            cursor: pointer;
            border-radius: ${base.radius.inset}px;
        }

        & > .close-btn:focus-visible {
            outline: ${base.focus.width}px solid ${base.color.accent};
            outline-offset: ${base.focus.offset}px;
        }
    }
`;
