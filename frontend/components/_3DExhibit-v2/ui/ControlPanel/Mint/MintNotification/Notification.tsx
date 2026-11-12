import styled, { css } from "styled-components";

import Spinner from "@ui/components/Spinner";

import { useMint } from "../MintProvider";

const getNotifications = ({
    name,
    supplyLimit,
    supply,
    id,
    mintedQuantity,
    eligibleQuantity,
}: {
    name: string;
    supplyLimit: number;
    supply: number;
    id: number;
    mintedQuantity: number;
    eligibleQuantity: number;
}) => {
    return {
        "mint-ended": {
            Hero: null,
            Subtext: (
                <div className="info">
                    <RoundDiv type="warning" />
                    <div>
                        <p className="hero">
                            Mint for {name} has already ended.
                        </p>
                    </div>
                </div>
            ),
        },
        "mint-not-live": {
            Hero: <div></div>,
            Subtext: (
                <div className="info">
                    <RoundDiv type="warning" />
                    <div>
                        <p className="hero">
                            {name} mint will take place here.
                        </p>
                    </div>
                </div>
            ),
        },
        "mint-live": {
            Hero: null,
            Subtext: (
                <div className="info">
                    <RoundDiv type="steady" />

                    <div>
                        <p className="hero">
                            {name} mint will take place here.
                        </p>
                    </div>
                </div>
            ),
        },
        whitelisted: {
            Hero: null,
            Subtext: (
                <div className="info">
                    <PulseIcon color="white" speed={1} />
                    <div>
                        <p className="hero">{name} mint is now active. </p>
                        <p className="subtext">
                            Approach the mint station and press "E" for mint
                            details.
                        </p>
                    </div>
                </div>
            ),
        },
        "not-whitelisted": {
            Hero: null,
            Subtext: (
                <div className="info">
                    <PulseIcon color="green" speed={1} />

                    <div>
                        <p className="hero">
                            You're not on the allow list for {name} mint.
                        </p>
                        <p className="subtext">
                            Check your wallet and try again!
                        </p>
                    </div>
                </div>
            ),
        },
        "sold-out": {
            Hero: null,
            Subtext: (
                <div className="info">
                    <RoundDiv type="success" />
                    <div>
                        <p className="hero">
                            {name} has sold out. Thank you for your support!
                        </p>
                    </div>
                </div>
            ),
        },
        minting: {
            Hero: null,
            Subtext: (
                <div className="info">
                    <Spinner width={24} style={{ marginRight: 10 }} />
                    <div>
                        <p className="hero">Minting in Progress…</p>
                        <p className="subtext">
                            {name} is being minted. Please Stay Zen and don't
                            close this page.
                        </p>
                    </div>
                </div>
            ),
        },
        minted: {
            Hero: null,
            Subtext: (
                <div className="info">
                    <PulseIcon color="green" speed={1} />
                    <div>
                        <p className="hero">Thanks for supporting {name}!</p>
                        {mintedQuantity >= eligibleQuantity ? (
                            <p className="subtext">
                                You've minted the max # of mints that you can
                                with this wallet.
                            </p>
                        ) : (
                            <p className="subtext">
                                You can mint more by approaching the mint
                                station and press "E" for mint details.
                            </p>
                        )}
                    </div>
                </div>
            ),
        },
        "mint-fail": {
            Hero: null,
            Subtext: (
                <div className="info">
                    <RoundDiv type="warning" />
                    <div>
                        <p className="hero">Failed to mint {name}!</p>
                        <p className="subtext">Please retry after some time!</p>
                    </div>
                </div>
            ),
        },
    };
};

export function Notification({ mintId, mint, style = {} }) {
    const { isNotificationShowing } = useMint();

    if (!isNotificationShowing || !mint?.state) {
        return null;
    }

    const notif = getNotifications({
        name: mint?.name,
        supply: mint?.supply,
        supplyLimit: mint?.supplyLimit,
        id: Number(mintId),
        mintedQuantity: mint?.mintedQuantity,
        eligibleQuantity: mint?.eligibleQuantity,
    })[mint.state];

    return (
        <Container style={style}>
            <div className="hero">{notif.Hero}</div>
            <div className="subtext">{notif.Subtext}</div>
        </Container>
    );
}

const Container = styled.div`
    backdrop-filter: blur(9.21875px);
    background: rgba(7, 7, 7, 0.6);
    border-top-left-radius: 100px;
    border-bottom-left-radius: 100px;
    display: flex;
    align-items: center;
    padding: 12px 20px;
    color: #ffffff;
    min-width: 400px;

    background: linear-gradient(
        201.23deg,
        rgba(22, 23, 26, 0.552) 4.03%,
        rgba(23, 24, 26, 0.24) 94%
    );
    backdrop-filter: blur(15px);

    @media (max-width: 780px) {
        width: 100%;
        z-index: 1000000;
        border-radius: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    p {
        margin: 0;
    }

    .hero {
        color: rgb(255, 255, 255);
        font-weight: 500;
        font-size: 13px;

        & > div {
            display: flex;
            align-items: center;
        }

        p {
            max-width: 9em;
        }
    }

    .subtext {
        font-weight: 400;
        line-height: 15px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 12px;
        // margin-left: 8px;

        p {
            max-width: 28em;
        }
    }

    .info {
        display: flex;
        align-items: center;
        margin-right: 12px;

        // circle {
        //     stroke: #ff8a00 !important;
        // }

        .subtext {
            max-width: 30em;
        }
    }

    .spinner {
        animation: rotate 0.8s linear infinite;
    }

    @keyframes rotate {
        100% {
            transform: rotate(360deg);
        }
    }
`;

const RoundDiv = styled.div<{
    type: "warning" | "danger" | "success" | "steady";
}>`
    background: ${({ type }) =>
        type === "success"
            ? "#05FF00"
            : type === "warning"
            ? "#FF8A00"
            : type === "danger"
            ? "#FF0000"
            : type === "steady"
            ? "#404040"
            : "#FF0000"};

    min-width: 15px;
    min-height: 15px;
    height: 15px;
    width: 15px;
    margin-right: 10px;
    border-radius: 50%;
`;

export const PulseIcon = styled.div<{
    speed: number;
    color: "white" | "green" | "orange";
}>`
    --pulse-white-color: rgba(255, 255, 255, 1);
    --pulse-green-color: rgba(51, 217, 178, 1);
    --pulse-orange-color: rgba(255, 138, 0, 1);
    --pulse-white-shadow-color: rgba(255, 255, 255, 0.7);
    --pulse-green-shadow-color: rgba(51, 217, 178, 0.7);
    --pulse-orange-shadow-color: rgba(255, 138, 0, 0.7);

    ${({ speed }) => {
        return css`
            --pulse-speed: ${speed}s;
        `;
    }}

    ${({ color }) => {
        if (color === "white") {
            return css`
                --pulse-color: var(--pulse-white-color);
                --pulse-shadow-color: var(--pulse-white-color);
            `;
        } else if (color === "green") {
            return css`
                --pulse-color: var(--pulse-green-color);
                --pulse-shadow-color: var(--pulse-green-color);
            `;
        } else if (color === "orange") {
            return css`
                --pulse-color: var(--pulse-orange-color);
                --pulse-shadow-color: var(--pulse-orange-color);
            `;
        }
    }}

    background: black;
    border-radius: 50%;
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 1);
    margin: 0px 10px 0px 0px;
    height: 15px;
    width: 15px;
    transform: scale(1);

    background: var(--pulse-color);
    box-shadow: 0 0 0 0 var(--pulse-color);
    animation: pulse-green var(--pulse-speed) infinite;

    @keyframes pulse-green {
        0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 var(--pulse-shadow-color);
        }

        70% {
            transform: scale(1);
            box-shadow: 0 0 0 10px rgba(51, 217, 178, 0);
        }

        100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(51, 217, 178, 0);
        }
    }
`;
