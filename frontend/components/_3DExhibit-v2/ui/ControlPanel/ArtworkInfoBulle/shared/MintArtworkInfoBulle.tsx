import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import Spinner from "@ui/components/Spinner";
import styled from "styled-components";
import { useMint } from "../../Mint/MintProvider";
import moment from "moment";

export default function MintArtworkInfoBulle({
    artwork,
    mobileOpenDetails = () => {},
    moreDetails = () => {},
}) {
    const { currentMint, mintProviders, toggleAuth } = useMint();

    const now = moment.utc();

    // console.log("currentMintcurrentMintcurrentMint", currentMint);

    // const timeLeftBeforeStartDate = moment.duration(startDateMint.diff(now));

    // const timeLeftBeforeEndDate = moment.duration(endDateMint.diff(now));

    const price = mintProviders?.[currentMint?.id]?.metadata?.price;

    const totalMinted =
        mintProviders?.[currentMint?.id]?.metadata?.totalMintedSupply;

    if (!currentMint?.name)
        return (
            <div style={{ display: "block" }}>
                You need to{" "}
                <span
                    style={{
                        cursor: "pointer",
                        textDecoration: "underline",
                        fontWeight: 500,
                    }}
                    onClick={toggleAuth}
                >
                    login
                </span>{" "}
                to see the mint info
            </div>
        );

    let content = null;

    if (currentMint.state === "whitelisted") {
        content = (
            <div style={{ display: "flex" }}>
                {IS_MOBILE ? (
                    <strong
                        style={{ marginRight: 5 }}
                        onClick={mobileOpenDetails}
                    >
                        Tap here
                    </strong>
                ) : (
                    <span className="btn-icon">E</span>
                )}
                <strong>to Mint</strong>
            </div>
        );
    }

    if (currentMint.state === "minted") {
        content = <strong>You have successfully minted</strong>;
    }

    if (currentMint.state === "minting") {
        content = <Spinner width={24} style={{ marginRight: 8 }} />;
    }

    const supplyDisplay =
        currentMint?.supplyLimit !== 0
            ? (totalMinted || currentMint?.supply || 0) +
              //   "/" +
              //   (currentMint?.supplyLimit || 0) +
              " Minted"
            : (totalMinted || currentMint?.supply || 0) + " Total Minted";

    return (
        <MintableContainer>
            <div style={{ width: "100%" }}>
                <h2>
                    {currentMint?.name} ({supplyDisplay})
                </h2>
                <p>
                    Contract Author -{" "}
                    {mintProviders[currentMint.id]?.metadata?.creator?.name}
                </p>
                <p>{price === 0 ? "FREE" : `${price} Ξ`}</p>
                <Wrapper>
                    {IS_MOBILE ? (
                        <strong
                            style={{ marginRight: 5 }}
                            onClick={mobileOpenDetails}
                        >
                            Tap here
                        </strong>
                    ) : (
                        <>
                            <span style={{ marginRight: 6 }}>Press </span>
                            <span className="btn-icon">E</span>
                        </>
                    )}
                    <strong>for details</strong>
                </Wrapper>
            </div>
        </MintableContainer>
    );
}

const MintableContainer = styled.div`
    color: #ffffff;
    width: 100%;
    .action-helper {
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        margin-top: 12px;
        padding-top: 12px;
        display: flex;
        // gap: 4px;
        align-items: center;
    }

    h2 {
        font-weight: 500;
        font-size: 15px;
        line-height: 24px;
        display: flex;
        align-items: center;
        margin: 0px;
    }

    p {
        font-weight: 400;
        font-size: 12px;
        line-height: 24px;
        color: #ffffff;
        opacity: 0.5;
        margin: 0px;

        & > span {
            text-decoration: underline;
        }
    }

    strong {
        font-weight: 500;
        font-size: 14px;
        line-height: 24px;
        color: #f5f5f5;
    }

    .btn-icon {
        background: #ffffff;
        border: 0.4px solid #ffffff;
        color: rgba(7, 7, 7, 0.6);
        text-align: center;
        margin-right: 4px;
        border-radius: 5px;
        font-weight: 600;
        display: inline-block;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
`;

const Wrapper = styled.div`
    display: flex;
    align-items: center;
    margin-top: 12px;
    font-size: 14px;
    line-height: 24px;

    .btn-icon {
        font-size: 12px;
    }
`;
