import React, { CSSProperties, useEffect, useState, useRef } from "react";
import styled, { css } from "styled-components";
import { NButton } from "@ui/components/NButton";
import { useMint } from "@components/_3DExhibit-v2/ui/ControlPanel/Mint/MintProvider";
import Input from "@ui/components/Input";

import { Title } from "../style/Title";
import { Vert, Horz } from "../style/Flex";
import { useArtworkInfo } from "../ArtworkContext";

import { LabelledImg } from "../components/LabelledImg";

import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";

interface ArtworkInfo_DataProps {
    themeDark?: boolean;
    style?: CSSProperties;
    assetInfoRef?: React.MutableRefObject<HTMLDivElement>;
}

export const ArtworkInfoMint_Data = ({ style = {} }: ArtworkInfo_DataProps) => {
    const { asset } = useArtworkInfo();

    const { handleMint, currentMint, mintProviders } = useMint();

    const containerRef = useRef<HTMLDivElement>(null);

    const price = mintProviders?.[currentMint?.id]?.metadata?.price;

    const description = mintProviders?.[currentMint?.id]?.metadata?.description;

    const fullName = mintProviders?.[currentMint?.id]?.metadata?.fullName;

    // const mintType = mintProviders?.[currentMint?.id]?.metadata?.mintType;

    // @ts-ignore
    const schedules = mintProviders?.[currentMint?.id]?.metadata?.schedules;

    const [quantity, setQuantity] = useState(1);

    const [isChecked, setIsChecked] = useState({
        sanctions: false,
        terms: false,
        privacy: false,
    });

    let raffleStatus = null;

    function handleChange(quantity) {
        quantity = Number(quantity);

        if (isNaN(quantity)) {
            return;
        }

        if (
            quantity >=
            currentMint.eligibleQuantity - currentMint.mintedQuantity
        ) {
            setQuantity(
                currentMint.eligibleQuantity - currentMint.mintedQuantity
            );
            return;
        }

        if (quantity < 1) {
            setQuantity(null);
            return;
        }

        setQuantity(quantity);
    }

    if (!currentMint) return null;

    if (currentMint?.supply === currentMint?.supplyLimit) {
        raffleStatus = (
            <div>
                {currentMint.name} has sold out. Thank you for your support!
            </div>
        );
    }

    if (
        currentMint?.state === "minted" &&
        currentMint.mintedQuantity >= currentMint.eligibleQuantity
    ) {
        raffleStatus = (
            <div>
                <p>
                    Thanks for supporting {currentMint.name}! You've minted the
                    max # of mints that you can with this wallet.
                </p>
            </div>
        );
    } else if (
        currentMint?.state == "whitelisted" ||
        currentMint?.state == "mint-fail" ||
        currentMint?.state === "minting" ||
        (currentMint.state === "minted" &&
            currentMint.mintedQuantity < currentMint.eligibleQuantity)
    ) {
        raffleStatus = (
            <div className="mint">
                <div>
                    <NButton
                        overrideTheme="dark"
                        size="medium"
                        className="cmd"
                        id="reset"
                        onClick={() => {
                            handleMint(quantity || 1);
                        }}
                        disabled={
                            !currentMint || currentMint?.state === "minting"
                        }
                    >
                        {currentMint?.state === "minting"
                            ? "Minting…"
                            : "Mint Now"}
                    </NButton>

                    {/* <p>{ error }</p> */}
                    {currentMint?.state === "mint-fail" ? (
                        <p>Mint failed, please retry!</p>
                    ) : null}
                </div>
                {currentMint.eligibleQuantity > 2 ? (
                    <QuantityWrapper>
                        <label>Quantity</label>
                        <Input
                            style={{ border: "none" }}
                            value={quantity}
                            onChange={(e) => handleChange(e.target.value)}
                            placeholder="quantity"
                        />
                    </QuantityWrapper>
                ) : null}
            </div>
        );
    } else if (currentMint.state === "mint-not-live") {
        raffleStatus = (
            <div>The {currentMint.name} mint will take place here.</div>
        );
    } else if (currentMint.state === "mint-live") {
        raffleStatus = (
            <div>The {currentMint.name} mint will take place here.</div>
        );
    } else if (currentMint.state === "not-whitelisted") {
        raffleStatus = (
            <div>
                You're not on the allow list for {currentMint.name} mint. Check
                your wallet and try again!
            </div>
        );
    }

    return (
        <Container
            isMobile={IS_MOBILE}
            className="artwork-data artwork-mint-data scrollbar light"
            style={style}
            ref={containerRef}
        >
            <AssetInfo
                style={!IS_MOBILE ? { padding: 8 } : {}}
                className="scrollbar dark"
            >
                <Title title={fullName}>{fullName}</Title>
                <div style={{ marginTop: 24 }}>
                    <LabelledImg
                        img={
                            mintProviders[currentMint.id]?.metadata?.creator
                                ?.image
                        }
                        verified={true}
                        description={
                            mintProviders[currentMint.id]?.metadata?.creator
                                ?.name
                        }
                        label={
                            mintProviders[currentMint.id]?.metadata?.creator
                                ?.name
                        }
                        url={
                            mintProviders[currentMint.id]?.metadata?.creator
                                ?.twitterUrl
                        }
                    />
                </div>

                <Description>
                    <div className="label">Description</div>
                    <p
                        style={{ marginBottom: 0, paddingBottom: 0 }}
                        className="text scrollbar dark"
                    >
                        {/* Marketplace metadata is untrusted: text only. */}
                        {description}
                    </p>
                </Description>

                <Price>
                    Price per token{" "}
                    {price === 0 ? <span>FREE</span> : <span>{price} Ξ</span>}
                </Price>

                {currentMint.mintedQuantity !== currentMint.eligibleQuantity ? (
                    <div>
                        <Quantity>
                            <span>Your minted quantity </span>
                            {currentMint.mintedQuantity}{" "}
                        </Quantity>
                        <Quantity>
                            <span>Your eligible quantity </span>
                            {currentMint.eligibleQuantity}
                        </Quantity>
                    </div>
                ) : null}

                {schedules?.length ? (
                    schedules.map((schedule, index) => {
                        const hasEnded =
                            schedule.formatted_endDate.type === "past" ||
                            (schedule.supplyLimit !== 0 &&
                                schedule.supply === schedule.supplyLimit);

                        return (
                            <MintStats key={index}>
                                <div className="title-wrapper">
                                    <h3>
                                        {hasEnded ? <span>ENDED</span> : null}{" "}
                                        {schedule.mintType}
                                    </h3>
                                    {schedule.mintType !== "Public Sale" ? (
                                        <p>
                                            {
                                                schedule.formatted_endDate
                                                    .formatted
                                            }
                                        </p>
                                    ) : null}
                                </div>
                                {schedule?.supplyLimit == 0 ? (
                                    <span>{schedule?.supply}</span>
                                ) : (
                                    <span>{schedule?.supply}</span>
                                )}
                                <p>Currently Minted</p>
                            </MintStats>
                        );
                    })
                ) : (
                    <MintStats>
                        <span>{currentMint?.supply || 0}</span>
                        {/* {currentMint?.supplyLimit == 0 ? (
                            null
                        ) : (
                            <span>
                                {currentMint?.supply} of{" "}
                                {currentMint?.supplyLimit}
                            </span>
                        )} */}
                        <p>Currently Minted</p>
                    </MintStats>
                )}
            </AssetInfo>

            <Action>{raffleStatus}</Action>
        </Container>
    );
};

const Container = styled.div<{
    isMobile: boolean;
}>`
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow-y: hidden;

    ${({ isMobile }) => {
        return (
            isMobile &&
            css`
                overflow-y: auto;
                height: calc(var(--100-vh) * 0.5);
            `
        );
    }}

    @media (min-width: 800px) {
        padding: 17px 32px;
    }

    .truncated {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .label {
        font-size: 12px;
        color: #7a7a7a;
    }
`;

const AssetInfo = styled(Vert)`
    flex: 1;
    padding: 0 16px;
    overflow-y: auto;
    overflow-x: hidden;
    margin-bottom: 0px;

    ::-webkit-scrollbar {
        width: 5px;
        background-color: transparent;
    }

    ::-webkit-scrollbar-thumb {
        border-radius: 8px;
        background-color: transparent;
    }

    @media (min-width: 1368px) {
        padding: 0;
    }
`;

const Description = styled.div`
    margin: 24px 0 0 0;
    flex: 0;

    & > .label {
        font-weight: 400;
        font-size: 12px;
        color: #7a7a7a;
    }

    a {
        color: #ffffff;
        font-size: 16px;
        text-decoration: underline;
    }

    & > .text {
        max-height: 16vh;
        overflow-y: scroll;

        font-size: 14px;
        color: #ffffff;
        font-weight: 400;
        margin-top: 0.5em;
        line-height: 24px;
        padding-right: 20px;
        padding-bottom: 10px;

        @media (min-width: 1368px) {
            // max-height: 130px;
            overflow-y: scroll;
            display: -webkit-box !important;
            white-space: normal;

            ::-webkit-scrollbar {
                width: 5px;
                background-color: transparent;
            }

            ::-webkit-scrollbar-thumb {
                border-radius: 8px;
                background-color: #333333;
            }
        }
    }
`;

const Price = styled.p`
    margin: 12px 0;
    margin-bottom: 18px;
    color: #b3b3b3;
    font-size: 14px;

    span {
        font-weight: 500;
        font-size: 18px;
        color: #ffffff;
    }
`;

const MintStats = styled.div`
    display: flex;
    margin-top: 10px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    margin-top: 18px;

    .title-wrapper {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;

        h3 {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        span {
            background: #ff613d;
            padding: 5px 8px;
            border-radius: 9px;
            font-size: 10px;
            font-weight: 500;
        }

        p {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 0;
            font-size: 14px;
            color: #c5c5c5;
        }
    }

    & > span {
        line-height: 10px;
        color: #ffffff;
        font-size: 16px;
        font-weight: 500;
    }

    & > p {
        font-weight: 500;
        font-size: 12px;
        color: #7a7a7a;
        line-height: 10px;
    }
`;

const Action = styled(Horz)`
    width: 100%;
    margin-top: 30px;
    padding-top: 10px;
    padding: 12px;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid #5c5c5c;

    @media (max-width: 830px) {
        margin-top: 10px;
        margin-bottom: 10px;
    }

    & .mint {
        height: 100%;
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;

        @media (max-width: 830px) {
            margin-top: 5px;
        }

        & > p {
            font-size: 14px;
            color: #7a7a7a;
            font-weight: 400;
            line-height: 24px;
            margin-right: 24px;

            @media (max-width: 830px) {
                margin-right: 14px;
                font-size: 12px;
            }
        }

        & > button {
            width: 160px;
            height: 56px;
            display: flex;
            color: #070707;
            font-size: 16px;
            font-weight: 500;
            line-height: 100%;
            align-items: center;
            border-radius: 200px;
            background: #ffffff;
            justify-content: center;

            :disabled {
                cursor: not-allowed;
                background: #ffffff;
            }

            @media (max-width: 830px) {
                width: 105px;
                height: 40px;
                font-size: 14px;
            }
        }
    }

    & .label {
        margin-bottom: 0.5em;

        @media (max-width: 830px) {
            font-size: 12px;
        }
    }
`;

const PriceWrapper = styled.div`
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: flex-start;
    height: 50px;

    @media (max-width: 830px) {
        height: 40px;
    }

    & > span {
        font-weight: 500;
        font-size: 24px;
        line-height: 32px;
        color: #ffffff;

        @media (max-width: 830px) {
            font-size: 18px;
            line-height: 26px;
        }
    }

    & > p {
        margin: 0px;
        padding: 0px;
        font-size: 12px;
        font-weight: 400;
        color: #7a7a7a;
        margin-left: 8px;
        line-height: 24px;

        @media (max-width: 830px) {
            line-height: 24px;
        }
    }
`;

const TermsWrapper = styled.div`
    .label {
        padding: 12px 0;
    }

    .text {
        font-size: 14px;
        color: #ffffff;
    }

    a {
        color: #6f9bfd;
        text-decoration: underline;
    }
`;

const CheckboxWrapper = styled.div`
    margin-bottom: 8px;
    font-size: 14px;

    input {
        margin-right: 8px;
    }
`;

const QuantityWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;

    input {
        width: 90px;
    }

    label {
        color: #b3b3b3;
        font-size: 14px;
    }
`;

const Quantity = styled.p`
    font-size: 18px;

    span {
        font-weight: 500;
        font-size: 14px;
        color: #b3b3b3;
    }
`;
