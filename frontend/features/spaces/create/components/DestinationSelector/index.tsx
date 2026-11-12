import HomeFooter from "@components/footer/home";
import CircularButton from "@ui/components/CircularButton";
import IconImg from "@ui/components/IconImg";
import { Destination } from "@uitypes/destinations";
import { Experience } from "@uitypes/experience";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { noop } from "@utils/js";
import { useRef } from "react";
import styled from "styled-components";
import { RoomBuyNowPrvider } from "./BuyNowContext";
import { DestinationList } from "./DestinationList";
import { UploaderProvider } from "./Uploader/UploaderProvider";
import { RoomsProvider } from "./useRooms";

export interface DestinationSelectorProps {
    style?: React.CSSProperties;
    className?: string;
    context: "uploader" | "marketplace" | "studio";
    rooms?: Destination[];
    title: React.ReactNode;
    description: React.ReactNode;
    isModal: boolean;
    handleClose?: () => unknown;
    onCreateEmptyStudioSpace?: (kit?: string) => unknown;
    onCreateSpace?: (exhibit: Experience) => unknown;
}

export default function DestinationSelector({
    context,
    rooms = [],
    title,
    description,
    isModal,
    style = {},
    className = "",
    handleClose = noop,
    onCreateSpace = noop,
    onCreateEmptyStudioSpace,
}: DestinationSelectorProps) {
    //
    const scrollRef = useRef<HTMLDivElement>();

    function onEvent(type, data) {
        const { room, ...rest } = data;

        amplitude_logAnalyticsEvent(type, {
            ...room,
            ...rest,
        });
    }

    return (
        <RoomsProvider
            context={context}
            onCreateSpace={onCreateSpace}
            rooms={rooms}
            onCreateEmptyStudioSpace={onCreateEmptyStudioSpace}
        >
            <RoomBuyNowPrvider onEvent={onEvent}>
                <UploaderProvider>
                    <Container
                        className={className}
                        style={style}
                        isModal={isModal}
                        ref={scrollRef}
                    >
                        {/* <button className="close-btn">
                <IconImg name="x-circle" size={40} />
            </button> */}
                        {isModal && (
                            <CircularButton
                                style={{ marginTop: "30px" }}
                                onClick={handleClose}
                            >
                                <IconImg name="x" style={{ opacity: 0.65 }} />
                            </CircularButton>
                        )}
                        <Header>
                            <h1 className="title">{title}</h1>
                            <p className="desc">{description}</p>
                        </Header>

                        <DestinationList scrollRef={scrollRef} />

                        <HomeFooter />
                    </Container>
                </UploaderProvider>
            </RoomBuyNowPrvider>
        </RoomsProvider>
    );
}

const Container = styled.div<{ isModal: boolean }>`
    ${(props) =>
        props.isModal
            ? `
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
    `
            : ""}

    width: 100%;
    height: 100%;
    overflow-y: auto;
    background-color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
`;

const Header = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 24px 12px;
    margin-top: 80px;

    .title {
        text-align: center;
        font-family: "Aeonik";
        font-style: normal;
        font-weight: 600;
        font-size: 64px;
        line-height: 80%;
        letter-spacing: -0.04em;
        text-transform: uppercase;
        color: #000000;

        margin: 0;
        margin-bottom: 14px;
    }

    .art {
        font-family: "PP Editorial New", "Times New Roman", Times, serif;
        font-size: 55px;
        font-weight: 400;
        // line-height: 54px;
        letter-spacing: -2px;
    }

    .desc {
        font-family: "Aeonik";
        font-style: normal;
        font-weight: 500;
        font-size: 14px;
        line-height: 100%;
        text-align: center;
        text-transform: uppercase;
        color: #070707;
        max-width: 438px;

        margin-top: 0;
    }

    @media (max-width: 800px) {
        .title {
            font-size: 40px;
        }

        .art {
            font-size: 34px;
        }

        .desc {
            font-size: 12px;
        }
    }
`;
