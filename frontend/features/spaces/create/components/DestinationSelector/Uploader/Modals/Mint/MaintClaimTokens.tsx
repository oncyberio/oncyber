import { getEthersProvider } from "@dapp/connect";
import createDrop, { getMinterNonce, hasDrop } from "@utils/factory/createDrop";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import React, { useState, useContext, useEffect } from "react";
import { RoundButton } from "@components/DesignSystem/buttons";
import SelfMintReview from "./components/Review/SelfMint";
import { BigNumber, ethers } from "ethers";
import { UserContext } from "@context/UserContext";
import State from "@ui/components/Modal/State";
import { Details, Footer } from "./shared/styles";
import FactoryApi from "@api/factory/_api";
import Input from "@ui/components/Input";
import mint from "@utils/factory/mint";
import Terms from "./components/Terms";
import isEmpty from "lodash/isEmpty";
import config from "@config/index";
import {
    finalizeMint,
    updateDestination,
    finalizeCreateDrop,
} from "@utils/saveToDb";
import { showError } from "@components/Dialogs";
import { switchWalletNetwork } from "@dapp/switchNetwork";

const MaintClaimTokens = ({ destination, onSuccess, onCancel }) => {
    const {
        _id,
        slug,
        price,
        status,
        quantity,
        token_id,
        preMinted,
        contractName,
        max_number_of_tokens,
    } = destination || {};

    const { token, walletConnection, user } = useContext(UserContext);

    const [step, setStep] = useState("init");
    const [disable, setDisable] = useState(false);
    const [tokenId, setTokenId] = useState(token_id);
    const [shouldMint, setShouldMint] = useState(false);
    const [inProgress, setInProgress] = useState(false);
    const [estimateGas, setEstimateGas] = useState(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [gasPriceError, setGasPriceError] = useState(false);
    const [loadingEstGas, setLoadingEstGas] = useState(false);
    const [error, setError] = useState<Record<string, string>>({});

    const [form, setForm] = useState<{
        quantity: number;
    }>({
        quantity,
    });

    useEffect(() => {
        sendAnayticsEvent("Trigger Minting Process");
    }, []);

    useEffect(() => {
        if (!inProgress) return;

        const handleTabClose = (event) => {
            event.preventDefault();
            return (event.returnValue =
                "Please don't close your browser until the transaction is completed.");
        };

        window.addEventListener("beforeunload", handleTabClose);
        return () => {
            window.removeEventListener("beforeunload", handleTabClose);
        };
    }, [inProgress]);

    useEffect(() => {
        if (step === "review" && !estimateGas) {
            handleEstimateGas();
        }
    }, [step, estimateGas]);

    const sendAnayticsEvent = (eventName: string, options = {}) => {
        amplitude_logAnalyticsEvent(eventName, {
            id: destination?._id,
            type: "Self-claim (X tokens to own wallet)",
            name: destination?.name,
            slug: destination?.slug,
            userId: user?.id,
            ...options,
        });
    };

    useEffect(() => {
        if (
            destination?.contractName &&
            destination?.startTime &&
            destination?.endTime
        ) {
            setStep("review");
        }
    }, [destination]);

    useEffect(() => {
        if (tokenId && shouldMint && form?.quantity) handleCheckMint();
    }, [shouldMint, tokenId, form?.quantity, preMinted]);

    const handleEstimateGas = async () => {
        setEstimateGas(null);
        setLoadingEstGas(true);
        setGasPriceError(false);

        try {
            const provider = getEthersProvider(walletConnection);
            const accounts = await provider.listAccounts();

            if (status == "verified") {
                const contractConfig = config[contractName];
                const factoryContract = new ethers.Contract(
                    contractConfig.json.address,
                    contractConfig.json.abi,
                    provider.getSigner(accounts[0])
                );
                // calculate gas for createDrop
                const address = accounts[0];

                let estGasCreateDropPrice = 0;

                if (!token_id) {
                    const nonce = await getMinterNonce(
                        provider,
                        contractName,
                        address
                    );

                    const {
                        ipfsHashMetadata,
                        signature,
                        startTime,
                        endTime,
                        shareCyber,
                    } = await FactoryApi.generateSignature({
                        nonce,
                        destinationId: _id,
                    });

                    estGasCreateDropPrice = Number(
                        (
                            await factoryContract.estimateGas.createDrop(
                                ipfsHashMetadata,
                                parseInt(startTime),
                                parseInt(endTime),
                                BigNumber.from(0),
                                form?.quantity,
                                shareCyber,
                                signature
                            )
                        ).toString()
                    );
                }

                // calculate gas for Mint
                const { sig: signatureMint } = await FactoryApi.selfClaimTokens(
                    {
                        slug,
                        type: "estimateGas",
                    }
                );

                const estGasMintPrice = await factoryContract.estimateGas.mint(
                    0,
                    form?.quantity,
                    signatureMint
                );

                const gasPrice = await provider.getGasPrice();

                const gasFee =
                    Number(ethers.utils.formatEther(gasPrice)) *
                    (estGasCreateDropPrice +
                        Number(estGasMintPrice.toString()));

                setEstimateGas(gasFee);
            }
        } catch (err) {
            setEstimateGas(null);
            setGasPriceError(true);
            console.error(err);
        } finally {
            setLoadingEstGas(false);
        }
    };

    const handleCheckMint = async () => {
        try {
            const dropCreated = await hasDrop(
                getEthersProvider(walletConnection),
                parseInt(tokenId),
                contractName
            );
            if (dropCreated && !preMinted) {
                const preMint = await handleMint(tokenId);
                if (!preMint) {
                    throw "There was an error while minting your asset";
                }

                setLoading(false);
                setStep("success");
            }
        } catch (err) {
            showError(err);
        } finally {
            setShouldMint(false);
        }
    };

    const handleInputChange = (e) => {
        setError({
            ...error,
            [e.target?.name]: null,
        });
        setForm({
            ...form,
            [e.target?.name]: e.target?.value,
        });
    };

    const handleReview = async () => {
        setLoading(true);

        sendAnayticsEvent("Trigger Minting Process", {
            step: "review",
        });

        const error: Record<string, string> = {};

        try {
            if (!form?.quantity) {
                error["quantity"] = "Please set number of editions!";
            }

            if (!isEmpty(error)) {
                setError(error);
                return;
            }

            if (form.quantity > max_number_of_tokens) {
                showError(
                    `You've been approved to mint up to ${max_number_of_tokens}`
                );

                return;
            }

            const response = await updateDestination(_id, token, {
                quantity: form?.quantity,
            });

            if (!response?.success) {
                throw "err";
            }

            setStep("review");
        } catch (err) {
            console.error(err);
            showError("Something went wrong!, Please try again");
        } finally {
            setLoading(false);
        }
    };

    const handleMint = async (tokenId: string) => {
        setLoading(true);
        setInProgress(true);

        sendAnayticsEvent("Trigger Minting Process", {
            step: "mint",
        });

        try {
            const { sig } = await FactoryApi.selfClaimTokens({
                slug,
            });

            const provider = getEthersProvider(walletConnection);

            const accounts = await provider.listAccounts();

            const tx = await mint(
                provider,
                sig,
                contractName,
                parseInt(tokenId),
                form?.quantity,
                price,
                accounts[0]
            );

            if (tx?.minted) {
                const response = await finalizeMint(_id, token);

                if (!response?.success) {
                    throw "err finalize preMint";
                }

                setDisable(true);

                sendAnayticsEvent("Minting Process Successful", {
                    step: "mint",
                    ...form,
                });

                return true;
            } else {
                throw tx?.err;
            }
        } catch (err) {
            console.error(err);
            setLoading(false);
            setDisable(false);
            setInProgress(false);
            sendAnayticsEvent("Minting Process Failed", {
                step: "mint",
                reason:
                    err?.message ||
                    err ||
                    "There was an error while pre-minting your asset",
            });
            throw "There was an error while pre-minting your asset. Please refresh and try again";
        }
    };

    const handleCreateDrop = async () => {
        setLoading(true);
        setInProgress(true);

        sendAnayticsEvent("Trigger Minting Process", {
            step: "createDrop",
        });

        try {
            const provider = getEthersProvider(walletConnection);

            const accounts = await provider.listAccounts();

            if (status == "failed") {
                throw "Destination was minted but not saved on our servers, please contact someone from the team.";
            }

            if (status == "verified") {
                const nonce = await getMinterNonce(
                    provider,
                    contractName,
                    accounts[0]
                );

                const {
                    price,
                    amount,
                    endTime,
                    signature,
                    startTime,
                    shareCyber,
                    contractAddress,
                    ipfsHashMetadata,
                } = await FactoryApi.generateSignature({
                    nonce,
                    destinationId: _id,
                });

                let createDropTokenId;

                createDropTokenId = await createDrop(
                    provider,
                    ipfsHashMetadata,
                    amount,
                    shareCyber,
                    signature,
                    contractName,
                    parseInt(startTime),
                    parseInt(endTime),
                    BigNumber.from(price),
                    accounts[0]
                );

                if (!createDropTokenId) {
                    throw "There was an error while minting your asset. Please refresh and try again";
                }

                setTokenId(createDropTokenId);

                const response = await finalizeCreateDrop(_id, token, {
                    token_id: createDropTokenId,
                    contract_address: contractAddress,
                });

                if (!response?.success) {
                    sendAnayticsEvent("Finalize Create Drop Failed", {
                        step: "createDrop",
                        ...form,
                        token_id: createDropTokenId,
                        contract_address: contractAddress,
                    });
                    // update status to `failed`, need reviewed by team.
                    const response = await updateDestination(_id, token, {
                        status: "failed",
                    });
                    if (!response?.success) {
                        throw "Something went wrong, please contact someone from the team.";
                    }
                    // TODO: change message.
                    throw "Destination was minted but not saved on our servers, please contact someone from the team.";
                }

                sendAnayticsEvent("Minting Process Successful", {
                    step: "createDrop",
                    ...form,
                });
            } else {
                throw "Your asset has not been verified yet. We will notice you soon.";
            }
        } catch (err) {
            console.error(err);
            setLoading(false);
            setDisable(false);
            setInProgress(false);
            sendAnayticsEvent("Minting Process Failed", {
                step: "createDrop",
                reason:
                    err?.message ||
                    err ||
                    "There was an error while create drop",
            });
            throw err || "Something went wrong. Please refresh and try again";
        }
    };

    const handleSubmit = async () => {
        setShouldMint(false);
        setLoading(false);
        setDisable(true);

        try {
            const provider = getEthersProvider(walletConnection);

            const contractConfig = config?.[contractName];

            // The same step buying takes: ask the wallet to switch network.
            // The check below still decides when it cannot switch.
            await switchWalletNetwork(
                walletConnection?.["eth"],
                contractConfig?.chainID
            );

            const chainID = (await provider?.getNetwork())?.chainId;

            if (chainID !== contractConfig?.chainID) {
                throw `Please switch to a wallet that supports ${contractConfig?.network} network`;
            }

            if (!tokenId) {
                await handleCreateDrop();
            }

            setShouldMint(true);
        } catch (err) {
            console.error(err);
            setDisable(false);

            showError(err);
        }
    };

    return step !== "success" ? (
        loading && step === "review" ? (
            <State
                type="pending"
                title="Pending…"
                description="Please don't close your browser until the transaction is completed."
                footer={
                    <RoundButton disabled isLight={true} background="#070707">
                        Got it
                    </RoundButton>
                }
            />
        ) : (
            <>
                <Details>
                    <h1>
                        {step === "init"
                            ? "Claim space tokens to your wallet"
                            : "Review mint details"}
                    </h1>
                    <p>
                        {step === "init"
                            ? "You'll receive the tokens and can do with them as you please."
                            : "Review each detail and once comfortable, proceed to mint your tokens."}
                    </p>
                    {step === "init" ? (
                        <>
                            <div>
                                <label>Number of tokens to mint/claim</label>
                                <Input
                                    min={0}
                                    type={"number"}
                                    autoComplete="off"
                                    name="quantity"
                                    placeholder="2000000000"
                                    defaultValue={form?.quantity}
                                    overrideTheme="light"
                                    onChange={handleInputChange}
                                />
                                {error?.quantity && (
                                    <span className="error">
                                        {error.quantity}
                                    </span>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <SelfMintReview
                                name={destination?.name}
                                estimateGas={estimateGas}
                                contractName={contractName}
                                loadingEstGas={loadingEstGas}
                                gasPriceError={gasPriceError}
                                thumbnail={destination?.thumbnail}
                                max_number_of_tokens={
                                    destination?.max_number_of_tokens
                                }
                                quantity={form?.quantity}
                                description={destination?.description}
                                animationHash={destination?.animationHash}
                            />
                            <Terms />
                        </>
                    )}
                </Details>

                <Footer>
                    <RoundButton
                        isLight={true}
                        className="cancel"
                        onClick={() => {
                            if (step !== "init") {
                                setStep("init");
                            } else {
                                onCancel();
                            }
                        }}
                    >
                        {step === "init" ? "Cancel" : "Back"}
                    </RoundButton>
                    <RoundButton
                        isLight={true}
                        disabled={disable}
                        className="submit"
                        onClick={step === "init" ? handleReview : handleSubmit}
                    >
                        {loading
                            ? "Loading…"
                            : step === "review"
                            ? "Mint Tokens"
                            : "Review Details"}
                    </RoundButton>
                </Footer>
            </>
        )
    ) : (
        <State
            type="success"
            title="Success!"
            description={`You've claimed ${form?.quantity} tokens! Please use them responsibly.`}
            footer={
                <RoundButton
                    isLight={true}
                    background="#070707"
                    onClick={onSuccess}
                >
                    Got it
                </RoundButton>
            }
        />
    );
};

export default MaintClaimTokens;
