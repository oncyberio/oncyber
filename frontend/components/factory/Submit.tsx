import { useState, useEffect } from "react";
import styled from "styled-components";
import { Button, Input, TextArea } from "../Form";
import createDrop from "../../utils/factory/createDrop";
import getNonce from "../../utils/factory/getNonce";
import DestinationService from "@api/destinations/_api";

import { ethers } from "ethers";
import config from "../../config";
import Confetti from "react-confetti";
import ConnectWallet from "@ui/components/ConnectWallet";
import InlineError from "@ui/components/InlineError";

function Submit({ destination }) {
    const [loading, setLoading] = useState(false);
    const { status, quantity, contractName, image, name, _id } = destination;

    const [tokenId, setTokenId] = useState();

    const [token, setToken] = useState();
    const [walletId, setWalletId] = useState();
    const [initialized, initModal] = useState(false);

    useEffect(() => {
        initModal(true);
    }, []);

    const setAuth = (t, u) => {
        setToken(t);
        setWalletId(u);
    };

    const getSignature = async () => {
        const nonce = await getNonce(contractName);

        const {
            status,
            ipfsHashMetadata,
            signature,
            startTime,
            endTime,
            startPrice,
            endPrice,
            stepDuration,
            amount,
            shareCyber,
            contractAddress,
        } = await (
            await fetch(nodeEnv.PUBLIC_API + "/api/factory/generateSignature", {
                method: "POST",
                body: JSON.stringify({
                    token,
                    payload: { nonce, ...destination },
                }),
            })
        ).json();

        return {
            status,
            ipfsHashMetadata,
            signature,
            startTime,
            endTime,
            startPrice,
            endPrice,
            stepDuration,
            amount,
            shareCyber,
            contractAddress,
        };
    };

    // What went wrong, shown under the mint button (docs/feedback.md).
    const [failure, setFailure] = useState<{
        message: string;
        retry?: () => void;
    }>(null);

    // Records the minted token on our servers, so it shows on the platform.
    const finalize = async (token_id, contractAddress) => {
        setFailure(null);
        try {
            console.log("WILL GO FETCH");
            await DestinationService.opts({ token }).finalizeDestination({
                id: _id,
                payload: {
                    token_id,
                    status: "active",
                    contract_address: contractAddress,
                },
            });
        } catch (e) {
            console.log(e);
            setFailure({
                message:
                    "Your destination was minted, but we couldn't save it. Try again, or contact the team if it keeps failing.",
                retry: () => finalize(token_id, contractAddress),
            });
        }
    };

    const submit = async () => {
        setFailure(null);

        if (!token) {
            return setFailure({
                message: "Connect your wallet before minting.",
            });
        }

        setLoading(true);
        try {
            // replace this with select so people can choose

            if (status == "verified") {
                const {
                    status,
                    ipfsHashMetadata,
                    signature,
                    startTime,
                    endTime,
                    startPrice,
                    endPrice,
                    stepDuration,
                    amount,
                    shareCyber,
                    contractAddress,
                } = await getSignature();

                if (status != "success") throw "e";

                var token_id;

                try {
                    const provider = new ethers.providers.Web3Provider(
                        window.ethereum
                    );
                    const minter = provider.getSigner();

                    token_id = await createDrop(
                        provider,
                        ipfsHashMetadata,
                        amount,
                        shareCyber,
                        signature,
                        contractName,
                        startTime,
                        endTime,
                        startPrice,
                        await minter.getAddress()
                    );

                    if (token_id) setTokenId(token_id);
                    else throw "No token_id";
                } catch (e) {
                    // Most often the wallet request was closed: nothing to say.
                    console.error(e);
                    return;
                }

                // set collection and token id so that people can directly have them tokenized on the platform
                await finalize(token_id, contractAddress);
            } else {
                setFailure({
                    message:
                        "Your destination hasn't been verified yet. We'll let you know when it is.",
                });
            }
        } catch (e) {
            console.error(e);
            setFailure({
                message: "Couldn't mint your destination.",
                retry: submit,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container>
            {initialized && (
                <ConnectWallet
                    open={!token}
                    toggle={console.log}
                    onlyEthereum={true}
                    callbackAfterAuth={setAuth}
                />
            )}
            {tokenId && (
                <Confetti run={tokenId} gravity={0.15} numberOfPieces={400} />
            )}

            <img
                src="/images/logo-black.png"
                style={{ width: 40, margin: "0 auto" }}
            />
            {tokenId ? (
                <div>
                    <h2> Asset minted!</h2>
                    <AssetPreview>
                        <img src={image} />
                        <div>
                            <h3>{name}</h3>
                            <p>{quantity} editions</p>
                        </div>
                    </AssetPreview>
                    <a
                        href={`https://etherscan.io/address/${config[contractName]?.mainnetAddress}`}
                    >
                        View on etherscan (might take a minute)
                    </a>
                </div>
            ) : (
                <div>
                    <h2> Your destination was vetted in!</h2>
                    <AssetPreview>
                        <img src={image} />
                        <div>
                            <h3>{name}</h3>
                            <p>{quantity} editions</p>
                        </div>
                    </AssetPreview>
                    <Button
                        disabled={status != "verified" || loading}
                        onClick={submit}
                    >
                        {loading ? "Loading…" : "Mint Destination"}
                    </Button>
                </div>
            )}
            <MintFailure
                surface="light"
                message={!loading && failure?.message}
                onRetry={failure?.retry}
            />
        </Container>
    );
}

const Container = styled.div`
    height: 100%;
    text-align: left;
    max-width: 450px;
    margin: 0 auto;
    padding: 16px;
    background: white;
    color: black;
    display: flex;
    flex-direction: column;
    justify-content: center;

    h2 {
        text-align: center;
    }

    & > div a {
        width: 100%;
        text-decoration: underline;
        text-align: center;
        justify-content: center;
        float: right;
    }

    h3 {
        text-align: center;
        font-weight: 600;
        margin: 0;
    }

    button {
        background: #000;
        color: white;

        &:hover {
            background: #1c1c1c;
        }
    }
`;

// Keeps the outline Retry clear of the black fill the page gives buttons.
const MintFailure = styled(InlineError)`
    margin-top: 8px;

    && button,
    && button:hover {
        background: transparent;
        color: var(--inline-error-ink);
    }
`;

const AssetPreview = styled.div`
    padding: 8px;
    margin: 16px 0;
    width: 100%;
    border: 1px solid lightgrey;

    img {
        width: 100%;
    }

    & > div {
        padding: 0 8px;
        h3 {
            text-align: left;
        }

        p {
            margin: 0;
            font-size: 14px;
            opacity: 0.8;
        }
    }
`;

export default Submit;
