import { getEthersProvider } from "@dapp/connect";
import { AuthServerSidePropsLite } from "@utils/authServerSideProps";
import mint, { getDropMintCounter } from "@utils/factory/mint";
import { RoundButton } from "@components/DesignSystem/buttons";
import { createNewSpace } from "@features/spaces/create/utils";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import ConnectWallet from "@ui/components/ConnectWallet";
import { useState, useEffect, useContext } from "react";
import { Destinations } from "@uitypes/destinations";
import State from "@ui/components/Modal/State";
import Navigation from "@components/nav/main";
import Modal from "@components/modals/Modal";
import Button from "@ui/components/Button";
import moment from "moment";
import { formatTime } from "@utils/format";
import {
    USER_LOGIN,
    UserContext,
    UPDATE_CURRENT_DESTINATION,
} from "@components/context/UserContext";
import styled from "styled-components";
import Error from "@components/Error";
import dynamic from "next/dynamic";
import { ethers } from "ethers";
import { getDestinationBySlug } from "@utils/firestore/destinations";
import { noop } from "lodash";
import config from "config";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import FactoryApi from "@api/factory/_api";
import { useSnackbar } from "@components/Snackbar";
import { SNACKBAR_DURATION } from "@components/_3DExhibit-v2/ui/AssetsMenu/constants";
import { checkUserWhitelisted } from "@utils/checkUserWhitelisted";
import { useCyberTranslation } from "@components/context/I18nContext";
import InlineError from "@ui/components/InlineError";
import { switchWalletNetwork, wrongNetworkMessage } from "@dapp/switchNetwork";

const chains = {
    "oncyber-ethereum-community": "ethereum",
    "factory-polygon": "matic",
};

// Gate boots the engine only after a WebGL preflight (renderer.js throws without
// a WebGL context); shows a graceful fallback otherwise.
const Exhibit3DDisplay = dynamic(() => import("@3/displyUI/Exhibit3DGate"), {
    ssr: false,
});

const defaultExhibit = (room) => ({
    info: {
        room: room.slug,
        heroImg: room.image,
        headline: room.name,
    },
    editors: ["0x76DB02500F7631d57BC2DcDCa9d4cf782b99E119"],
    owner: "",
});

export type MinterProps = {
    project: string;
    notfound: boolean;
    destination: Destinations;
};

function Minter({ destination, notfound }: MinterProps) {
    const { dispatch, user, token, authenticated, walletConnection } =
        useContext(UserContext);

    const { t } = useCyberTranslation();

    const {
        slug,
        path,
        name,
        price,
        paths,
        project,
        token_id,
        whitelist_url,
        thumbnail,
        description,
        contractName,
    } = destination || {};

    const contractConfig = config?.[contractName];

    const [openSnackbar] = useSnackbar({
        position: "top-right",
    });

    const [loading, setLoading] = useState({
        mint: false,
        personalizeSpace: false,
    });

    const [countdown, setCountdown] = useState({
        status: "active",
        label: "Time Left",
        time: "h:0 m:0 s:0",
    });

    const [quantity, setQuantity] = useState(1);

    const [isSuccess, setIsSuccess] = useState(false);

    const [isTimeBetween, setTimeBetween] = useState(false);

    const [hasClaimSpace, setHasClaimSpace] = useState(false);

    const [showAuthModal, setShowAuthModal] = useState(false);

    const [isWhitelisted, setIsWhitelisted] = useState(false);

    const [openClaimModal, setOpenClaimModal] = useState(false);

    const [drop, setDrop] = useState<{ minted: number; cap: number }>();

    // The wallet is still on another network after the switch was offered.
    // Said under the claim button, which offers the switch again.
    const [networkError, setNetworkError] = useState("");

    // Why the last claim failed, said under the claim button too. Retry is
    // offered only when claiming again unchanged can work.
    const [mintError, setMintError] = useState<{
        message: string;
        canRetry: boolean;
    }>(null);

    useEffect(() => {
        setNetworkError("");
        setMintError(null);
    }, [walletConnection]);

    useEffect(() => {
        handleWhiteListedUsers();
    }, [user, destination]);

    useEffect(() => {
        handleCounterdown();
    }, [destination]);

    useEffect(() => {
        handleCheckDrop().catch(console.error);
    }, [description, openClaimModal]);

    useEffect(() => {
        handleExistClaimSpace().catch(console.error);
    }, [destination, user, isSuccess]);

    useEffect(() => {
        // sendAnayticsEvent("visit_mint");
    }, []);

    useEffect(() => {
        const handleKeydown = (event) => {
            if (
                event?.keyCode === 32 ||
                event?.keyCode === 40 ||
                event?.keyCode === 38
            ) {
                event.preventDefault();
            }
        };
        window.addEventListener("keydown", handleKeydown);
        return () => window.removeEventListener("keydown", handleKeydown);
    });

    const handleExistClaimSpace = async () => {
        try {
            const provider =
                getEthersProvider(walletConnection) ||
                new ethers.providers.Web3Provider(window?.ethereum, "any");

            const chainID = (await provider?.getNetwork())?.chainId;

            const contractConfig = config?.[contractName];

            if (chainID !== contractConfig?.chainID) {
                openSnackbar(
                    `Please switch to a wallet that supports ${contractConfig?.network} network`,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return;
            }

            const accounts = await provider.listAccounts();

            const contract = new ethers.Contract(
                contractConfig.json.address,
                contractConfig.json.abi,
                provider
            );

            const nonce = await getDropMintCounter(
                accounts[0],
                contract,
                parseInt(token_id)
            );

            setHasClaimSpace(nonce !== 0);
        } catch (err) {
            console.error(err);
        }
    };

    const sendAnayticsEvent = (eventName: string, options = {}) => {
        const now = moment.utc();
        const endDate = moment(destination?.endTime * 1000);
        const startDate = moment(destination?.startTime * 1000);
        const isBetween = now.isBetween(startDate, endDate);

        amplitude_logAnalyticsEvent(eventName, {
            id: destination?._id,
            name: destination?.name,
            slug: destination?.slug,
            userId: user?.id,
            startTime: destination?.startTime,
            endTime: destination?.endTime,
            contractName: destination?.contractName,
            token_id: destination?.token_id,
            contract_address: destination?.contract_address,
            distributionType: destination?.distributionType,
            max_number_of_tokens: destination?.max_number_of_tokens,
            price: destination?.price,
            quantity: destination?.quantity,
            shareCyber: destination?.shareCyber,
            whitelisted: destination?.whitelist_url,
            active: isBetween,
            currently_minted: drop?.minted,
            ...options,
        });
    };

    const handleWhiteListedUsers = async () => {
        if (!destination) return;

        if (destination?.whitelist_url) {
            const isUserWhisteListed = await checkUserWhitelisted(
                destination.whitelist_url,
                user?.id
            );

            const allowedQuantity = parseInt(isUserWhisteListed?.amount || 0);

            setQuantity(allowedQuantity);

            setIsWhitelisted(!!isUserWhisteListed);
        } else {
            setIsWhitelisted(true);

            setQuantity(1);
        }
    };

    const handleCounterdown = () => {
        const now = moment.utc();
        const endDate = moment(destination?.endTime * 1000);
        const startDate = moment(destination?.startTime * 1000);
        const isBetween = now.isBetween(startDate, endDate);

        setTimeBetween(isBetween);

        if (now.isAfter(endDate)) {
            setCountdown({
                label: "",
                status: "expired",
                time: "Expired!",
            });
        } else if (now.isBefore(startDate)) {
            const startedIn = moment.duration(startDate.diff(now));
            setCountdown({
                status: "soon",
                time: formatTime(startedIn),
                label: "Remaining before mint begins",
            });
        } else {
            const timeLeft = moment.duration(endDate.diff(now));
            setCountdown({
                status: "active",
                time: formatTime(timeLeft),
                label: "Remaining before mint ends",
            });
        }

        setTimeout(handleCounterdown, 1000);
    };

    const handleCheckDrop = async () => {
        const provider = new ethers.providers.JsonRpcProvider(
            contractConfig.rpc
        );

        const contract = new ethers.Contract(
            contractConfig.json.address,
            contractConfig.json.abi,
            provider
        );

        const drop = await contract.getDrop(parseInt(token_id));

        sendAnayticsEvent("visit_mint", {
            currently_minted: drop?.minted?.toNumber?.() || 0,
        });

        setDrop({
            minted: drop?.minted?.toNumber?.() || 0,
            cap: drop?.amountCap?.toNumber?.() || 0,
        });
    };

    const handleMint = async () => {
        // Set to the network the wallet should be on when that is the failure.
        let wrongNetwork: string = null;
        try {
            setLoading({
                ...loading,
                mint: true,
            });

            setIsSuccess(false);

            setNetworkError("");

            setMintError(null);

            setOpenClaimModal(true);

            sendAnayticsEvent("space_mint_trigger");

            const provider =
                getEthersProvider(walletConnection) ||
                new ethers.providers.Web3Provider(window?.ethereum, "any");

            const contractConfig = config?.[contractName];

            // The same step buying takes: ask the wallet to switch network.
            // The check below still decides, so nothing changes when the
            // wallet cannot switch.
            await switchWalletNetwork(
                walletConnection?.["eth"] || window?.ethereum,
                contractConfig?.chainID
            );

            const chainID = (await provider?.getNetwork())?.chainId;

            if (chainID !== contractConfig?.chainID) {
                wrongNetwork = contractConfig?.network || "";
                throw `Please switch to a wallet that supports ${contractConfig?.network} network`;
            }

            if (drop?.cap - drop?.minted < quantity) {
                throw "CR";
            }

            if (!isTimeBetween) {
                throw "OOT";
            }

            const { sig } = await FactoryApi.claimSpace({ slug });

            const accounts = await provider.listAccounts();

            const tx = await mint(
                provider,
                sig,
                contractName,
                parseInt(token_id),
                quantity,
                price,
                accounts[0]
            );

            if (tx?.minted) {
                sendAnayticsEvent("space_mint_successul");

                setIsSuccess(true);
            } else {
                throw tx?.err;
            }
        } catch (err) {
            setOpenClaimModal(false);

            // Only an unexplained failure can go through on a second try.
            let error: string;
            let canRetry = false;

            if (err?.includes?.("WL")) {
                error = "This wallet can't claim this space.";
            } else if (err?.includes?.("CR")) {
                error =
                    "Every space has been claimed. You can still find one on the secondary market, such as OpenSea.";
            } else if (err?.includes?.("OOT")) {
                error = "Claiming hasn't started yet, or it has ended.";
            } else if (err?.includes?.("HN")) {
                error =
                    quantity === 1
                        ? "Each wallet can claim one space, and this one already has."
                        : "This wallet has already claimed.";
            } else {
                error = "Couldn't claim the space.";
                canRetry = true;
            }

            console.error(err);

            if (wrongNetwork != null) {
                // Beside the claim button, with the switch offered again.
                setNetworkError(
                    wrongNetworkMessage(wrongNetwork, "claim this space")
                );
            } else {
                setMintError({ message: error, canRetry });
            }

            sendAnayticsEvent("space_mint_failed", {
                reason: err?.message || err,
            });
        } finally {
            setLoading({
                ...loading,
                mint: false,
            });
        }
    };

    const handlePersonalizeSpace = async () => {
        const { params, slug, ...rest } = destination;

        if (loading?.mint) {
            return;
        }

        try {
            setLoading({
                ...loading,
                personalizeSpace: true,
            });

            dispatch({
                type: UPDATE_CURRENT_DESTINATION,
                payload: {
                    slug,
                    ...rest,
                    ...params,
                },
            });

            const exhibit = await createNewSpace(user?.id, token, slug);

            dispatch({
                type: USER_LOGIN,
                payload: {
                    authenticated: true,
                    loading: false,
                    isFirstLogin: true,
                    exhibit: exhibit,
                },
            });

            window.location.href = "/studio";

            return;
        } catch (e) {
            console.log("error", e);
            return { error: true, message: e };
        } finally {
            setLoading({
                ...loading,
                personalizeSpace: false,
            });
        }
    };

    if (
        notfound ||
        destination?.status !== "active" ||
        destination?.distributionType !== "create_claim_page"
    ) {
        return <Error statusCode={404} />;
    }

    return (
        <Container>
            <ConnectWallet
                noShowClose={false}
                onlyEthereum={true}
                open={showAuthModal}
                callbackAfterAuth={noop}
                skipRedirectToAccount={false}
                toggle={() => setShowAuthModal((prevState) => !prevState)}
            />
            <NavWrap>
                <Navigation
                    onLogin={noop}
                    onlyEthereum={true}
                    minWidth={"1520px"}
                    overrideTheme={"light"}
                />
            </NavWrap>
            <MintWrapper>
                {!IS_MOBILE && (
                    <SceneContainer>
                        <Exhibit3DDisplay
                            assets={[]}
                            artworks={[]}
                            mode={"solo"}
                            isDisplayMode={true}
                            isPointerLockControls={true}
                            style={{
                                maxHeight: "520px",
                            }}
                            styleCanvas={{
                                borderRadius: "25px !important",
                            }}
                            parentPage="mint"
                            exhibit={defaultExhibit({
                                slug,
                                name,
                                image: thumbnail,
                                path: paths?.high || path,
                            })}
                        />
                    </SceneContainer>
                )}
                <p style={{ textAlign: "center", opacity: 0.6 }}>
                    {" "}
                    This page allows you to claim the above space if you had 1
                    or more {project || ""} at the time of the snapshot. <br />{" "}
                    You will then be able to use it as your own at
                    oncyber.io/studio.
                </p>
                <Details>
                    <Description>
                        <h1>{name}</h1>
                        <p>{description || ""}</p>
                    </Description>
                    <MintAction>
                        {destination?.endTime && destination?.startTime && (
                            <MintStats>
                                <div className="countdown">
                                    <span>{countdown?.time}</span>
                                    <p>{countdown?.label}</p>
                                </div>
                            </MintStats>
                        )}

                        <MintStats style={{ marginTop: "10px" }}>
                            <div>
                                <span>{drop?.minted || 0}</span>
                                <p>
                                    Tokens minted out of a max of{" "}
                                    {drop?.cap || 0}
                                </p>
                            </div>
                        </MintStats>
                        {authenticated &&
                        walletConnection?.type &&
                        getEthersProvider(walletConnection) ? (
                            <Button
                                onClick={handleMint}
                                className="mint-login-btn"
                                disabled={
                                    !isTimeBetween ||
                                    !isWhitelisted ||
                                    hasClaimSpace ||
                                    countdown?.status === "expired" ||
                                    countdown?.status === "soon"
                                }
                                title={
                                    loading?.mint
                                        ? "Loading…"
                                        : countdown?.status === "expired"
                                        ? "Claim is over"
                                        : countdown?.status === "soon"
                                        ? "Claim hasn't begun"
                                        : !isWhitelisted
                                        ? "Not eligible to claim"
                                        : hasClaimSpace
                                        ? "You've already minted!"
                                        : "Claim Space"
                                }
                            />
                        ) : (
                            <Button
                                title={t`LOG_IN`}
                                className="mint-login-btn"
                                onClick={() => setShowAuthModal(true)}
                            />
                        )}
                        <InlineError
                            surface="light"
                            style={{ marginTop: 12 }}
                            message={networkError}
                            onRetry={loading?.mint ? undefined : handleMint}
                            retryLabel="Switch network"
                        />
                        <InlineError
                            surface="light"
                            style={{ marginTop: 12 }}
                            message={!loading?.mint && mintError?.message}
                            onRetry={
                                mintError?.canRetry ? handleMint : undefined
                            }
                        />
                        <View>
                            {slug === "theunderground" ? (
                                <Button
                                    title="View on Looksrare"
                                    onClick={() =>
                                        window.open(
                                            `https://looksrare.org/collections/${contractConfig.json.address}/${token_id}`,
                                            "_blank"
                                        )
                                    }
                                />
                            ) : (
                                <Button
                                    title="View on OpenSea"
                                    onClick={() =>
                                        window.open(
                                            `https://opensea.io/assets/${
                                                chains[
                                                    destination?.contractName
                                                ]
                                            }/${
                                                contractConfig.json.address
                                            }/${token_id}`,
                                            "_blank"
                                        )
                                    }
                                />
                            )}

                            <Button
                                title="View on EtherScan"
                                onClick={() =>
                                    window.open(
                                        `https://etherscan.io/token/${contractConfig.json.address}?a=${token_id}`,
                                        "_blank"
                                    )
                                }
                            />
                        </View>
                    </MintAction>
                </Details>
            </MintWrapper>
            <Modal
                hasBackground
                isBackdrop={false}
                isShowing={openClaimModal}
                toggle={console.log}
                overlayStyle={{
                    opacity: 0.5,
                    background: "#070707",
                }}
                size="wide"
                noShowClose={true}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    margin: "0",
                    padding: "0",
                    maxWidth: "90%",
                    maxHeight: "90%",
                    width: "530px",
                    overflow: "hidden",
                    borderRadius: "8px",
                }}
                setShow={!loading?.mint && setOpenClaimModal}
            >
                {loading?.mint ? (
                    <State
                        height="250px"
                        type="pending"
                        title="Pending…"
                        description="Your claim is pending. You'll be able to set up your space in just a moment."
                    />
                ) : !loading?.mint && isSuccess ? (
                    <State
                        height="250px"
                        type="success"
                        title="Success!"
                        description="You've successfully claimed your space!"
                    />
                ) : null}

                <Footer>
                    <RoundButton
                        disabled={!isSuccess}
                        isLight={true}
                        background="#070707"
                        onClick={handlePersonalizeSpace}
                    >
                        Set up space
                    </RoundButton>
                </Footer>
            </Modal>
        </Container>
    );
}

const Container = styled.div`
    position: relative;
    width: 100%;
    min-height: 100vh;
    background: #ffffff;
    color: #070707;
`;

const NavWrap = styled.div`
    display: flex;
    justify-content: space-around;
    align-items: center;
    width: 100%;
    z-index: 10000;
    background: ${({ theme }) => "#fff"};

    & > div {
        display: block !important;
    }
`;

const MintWrapper = styled.div`
    max-width: 1260px;
    padding: 48px 32px;
    margin: 0px auto;
    min-height: 100%;
    border-radius: 25px;
`;

const SceneContainer = styled.div`
    top: 0;
    left: 0;
    z-index: 1;
    width: 100%;
    height: 520px;
    background: #fff;
    position: relative;
    border-radius: 25px !important;

    @media (max-width: 830px) {
        display: none;
    }

    #d-menu {
        height: 100%;
        border-radius: 25px;
    }

    #b_main_menu {
        border-radius: 25px;
        margin-left: 30px;
    }

    #exhibit {
        border-radius: 25px;
        background-color: transparent !important;
    }

    .panel-container {
        display: none !important;
    }

    .see-all-tips {
        display: none !important;
    }

    canvas {
        height: 100% !important;
        border-radius: 25px;
    }

    video {
        display: none;
    }
`;

const Details = styled.div`
    display: flex;
    max-width: 1100px;
    flex-direction: row;
    align-items: flex-start;
    margin: 64px auto 0px auto;
    justify-content: space-between;

    @media (max-width: 830px) {
        width: 100%;
        flex-direction: column-reverse;
    }
`;

const Description = styled.div`
    display: flex;
    max-width: 500px;
    padding-top: 30px;
    padding-left: 20px;
    align-items: flex-start;
    flex-direction: column;

    @media (max-width: 830px) {
        min-width: 100%;
        padding-left: 0px;
    }

    & > span {
        font-weight: 600;
        font-size: 11px;
        color: #7a7a7a;
        line-height: 20px;
    }

    & > h1 {
        margin: 0;
        font-size: 48px;
        font-weight: 600;
        line-height: 40px;
        color: #070707;

        @media (max-width: 830px) {
            font-size: 32px;
            word-wrap: break-word;
        }
    }

    & > p {
        font-size: 16px;
        font-weight: 400;
        padding-top: 20px;
        line-height: 28px;
        color: #3d3d3d;
    }
`;

const MintAction = styled.div`
    width: 520px;
    height: 400px;
    padding-top: 30px;
    padding-left: 96px;
    border-left: 1px solid #e0e0e0;

    @media (max-width: 830px) {
        width: 100%;
        margin-bottom: 60px;
        padding-left: 0px;
        border-left: none;
    }

    & > .mint-login-btn {
        width: 100%;
        height: 56px;
        font-weight: 600;
        font-size: 17px;
        text-align: center;
        color: #ffffff;
        margin-top: 14px;
        background: #070707;
        border-radius: 200px;

        &:disabled {
            cursor: not-allowed;
        }

        @media (max-width: 830px) {
            width: 100%;
            height: 46px;
            font-size: 15px;
        }
    }
`;

const MintStats = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;

    & > div {
        width: 100%;
        display: flex;
        flex-direction: column;

        &.countdown {
            width: auto;
        }

        & > span {
            font-size: 32px;
            font-weight: 600;
            color: #070707;
            line-height: 100%;
        }

        & > p {
            font-size: 14px;
            font-style: normal;
            font-weight: 400;
            line-height: 14px;
            color: #3d3d3d;
        }
    }
`;

const View = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;

    @media (max-width: 830px) {
        width: 100%;
        flex-direction: column;
    }

    & > button {
        width: 48%;
        height: 40px;
        font-size: 14px;
        margin-top: 22px;
        font-weight: 500;
        color: #070707;
        line-height: 24px;
        text-align: center;
        border-radius: 200px;
        border: 1px solid #c2c2c3;

        @media (max-width: 830px) {
            width: 100%;
            font-size: 12px;
            margin-top: 10px;
        }
    }
`;

const Footer = styled.div`
    width: 100%;
    height: 80px;
    display: flex;
    padding: 20px 32px;
    background-color: #fff;
    justify-content: flex-end;
    border-top: 1px solid #dfdfe4;

    button {
        &:disabled {
            background-color: #e0e0e0;
        }
    }
`;

export default Minter;

export const getServerSideProps = AuthServerSidePropsLite(async ({ params }) => {
    const { slug } = params;

    const destination = await getDestinationBySlug(slug);

    if (destination) {
        return {
            destination,
        };
    }
    return {
        notfound: true,
    };
});
