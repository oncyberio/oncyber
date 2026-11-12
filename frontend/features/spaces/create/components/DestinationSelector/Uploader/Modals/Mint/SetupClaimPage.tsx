import { getEthersProvider } from "@dapp/connect";
import React, { useState, useContext, useEffect, ChangeEvent } from "react";
import { finalizeCreateDrop, updateDestination } from "@utils/saveToDb";
import createDrop, { getMinterNonce } from "@utils/factory/createDrop";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { RoundButton } from "@components/DesignSystem/buttons";
import SetupClaimReview from "./components/Review/SetupClaim";
import { BigNumber, ethers } from "ethers";
import { UserContext } from "@context/UserContext";
import State from "@ui/components/Modal/State";
import WhitelistUploader from "./components/WhitelistUploader";
import Duplicate from "@ui/icons/Duplicate";
import { Details, Footer } from "./shared/styles";
import FactoryApi from "@api/factory/_api";
import Input from "@ui/components/Input";
import Terms from "./components/Terms";
import styled from "styled-components";
import isEmpty from "lodash/isEmpty";
import { tz } from "moment-timezone";
import Check from "@ui/icons/Check";
import config from "@config/index";
import { nodeEnv } from "@env";
import moment from "moment";
import { showError } from "@components/Dialogs";
import { switchWalletNetwork } from "@dapp/switchNetwork";
import { uploadFile } from "@utils/factory/httpPinata";
import Radio from "./components/Radio";

const ClaimOptions = [
    {
        title: "Allow List",
        value: "allow_list",
    },
    {
        title: "Open Claim",
        value: "open_claim",
    },
];

const SetupClaimPage = ({ destination, onSuccess, onCancel }) => {
    const { _id, status, contractName } = destination || {};

    const { token, walletConnection, user } = useContext(UserContext);

    const [step, setStep] = useState("init");
    const [copied, setCopied] = useState(false);
    const [endTime, setEndTime] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [startDate, setStartDate] = useState(null);
    const [startTime, setStartTime] = useState(null);
    const [inProgress, setInProgress] = useState(false);
    const [estimateGas, setEstimateGas] = useState(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [gasPriceError, setGasPriceError] = useState(false);
    const [loadingEstGas, setLoadingEstGas] = useState(false);
    // This for whitelist
    const [maxNumberOfTokens, setMaxNumberOfTokens] = useState(
        destination?.max_number_of_tokens || 0
    );
    const [disable, setDisable] = useState(false);
    const [claimType, setClaimType] = useState("allow_list");
    const [error, setError] = useState<Record<string, any>>({});
    const [quantity, setQuantity] = useState(destination?.quantity || 0);
    const [endDateTime, setEndDateTime] = useState(destination?.endTime);
    const [whitelist, setWhitelist] = useState(destination?.whitelist_url);
    const [startDateTime, setStartDateTime] = useState(destination?.startTime);

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
        if (step === "review" && !estimateGas)
            getGasEstimate().catch(console.log);
    }, [step, estimateGas]);

    useEffect(() => {
        setClaimType(destination?.whitelist_url ? "allow_list" : "open_claim");

        if (destination?.startTime) {
            const parseStartTime = moment.unix(
                parseInt(destination?.startTime)
            );

            if (parseStartTime.isValid()) {
                const getDate = parseStartTime.format("YYYY-MM-DD");

                if (getDate) setStartDate(getDate);

                const getTime = moment(parseStartTime).format("HH:mm");

                if (getTime) setStartTime(getTime);
            }
        }

        if (destination?.endTime) {
            const parseEndTime = moment.unix(parseInt(destination?.endTime));

            if (parseEndTime.isValid()) {
                const getDate = parseEndTime.format("YYYY-MM-DD");

                if (getDate) setEndDate(getDate);

                const getTime = moment(parseEndTime).format("HH:mm");

                if (getTime) setEndTime(getTime);
            }
        }

        if (
            //destination?.whitelist_url &&
            destination?.contractName &&
            destination?.startTime &&
            destination?.endTime
        ) {
            setStep("review");
        }
    }, [destination]);

    const sendAnayticsEvent = (eventName: string, options = {}) => {
        amplitude_logAnalyticsEvent(eventName, {
            id: destination?._id,
            type: "Set up free claim based on allow list",
            name: destination?.name,
            slug: destination?.slug,
            userId: user?.id,
            ...options,
        });
    };

    const getGasEstimate = async () => {
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
                const nonce = await getMinterNonce(
                    provider,
                    contractName,
                    address
                );

                const { ipfsHashMetadata, signature, shareCyber, amount } =
                    await FactoryApi.generateSignature({
                        nonce,
                        destinationId: _id,
                    });

                const esGasCreateDropPrice =
                    await factoryContract.estimateGas.createDrop(
                        ipfsHashMetadata,
                        parseInt(startDateTime),
                        parseInt(endDateTime),
                        BigNumber.from(0),
                        amount,
                        shareCyber,
                        signature
                    );

                const gasPrice = await provider.getGasPrice();

                const gasFee =
                    Number(ethers.utils.formatEther(gasPrice)) *
                    Number(esGasCreateDropPrice.toString());

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

    const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { value, name } = e.target;
        if (!name) return;
        setError((prevState) => ({
            ...prevState,
            [name]: null,
        }));
        if (!value) return;

        if (name === "startDate") {
            setStartDate(value);
        } else {
            setEndDate(value);
        }
    };

    const handleTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
        setError((prevState) => ({
            ...prevState,
            end: null,
        }));
        const { value, name } = e.target;
        if (!name) return;
        setError((prevState) => ({
            ...prevState,
            [name]: null,
        }));
        if (!value) return;
        if (name === "startTime") {
            setStartTime(value);
        } else {
            setEndTime(value);
        }
    };

    const handleUploadWhitelist = async (
        id: string,
        file: Blob,
        maxTokens: number
    ) => {
        setError((prevState) => ({
            ...prevState,
            whitelist: null,
        }));

        const pinata = await uploadFile(file);

        const ipfsHash = pinata?.IpfsHash;

        if (!ipfsHash) throw new Error("Failed to upload file");

        const url = `https://cyber.mypinata.cloud/ipfs/${ipfsHash}`;

        if (!url) {
            throw "Failed to upload list of wallet addresses";
        }

        setMaxNumberOfTokens(maxTokens);
        setWhitelist(url);
    };

    const Review = async () => {
        setLoading(true);

        try {
            sendAnayticsEvent("Trigger Minting Process", {
                step: "review",
            });

            let error = {};

            if (!startDate) {
                error["startDate"] = "Please set claim start date";
            }

            if (!startTime) {
                error["startTime"] = "Please set claim start time";
            }

            if (!endDate) {
                error["endDate"] = "Please set claim end date";
            }

            if (!endTime) {
                error["endTime"] = "Please set claim end time";
            }

            const startDateTime = moment(startDate + " " + startTime);
            const endDateTime = moment(endDate + " " + endTime);

            if (!startDateTime.isValid()) {
                throw "Invalid claim start date & time";
            }

            if (!endDateTime.isValid()) {
                throw "Invalid claim end date & time";
            }

            if (moment().isAfter(startDateTime)) {
                throw "The claim start date cannot be set to a date that has already passed. Please choose a future date";
            }

            if (endDateTime <= startDateTime) {
                error["endTime"] =
                    "Please ensure that the end date of the claim is later than the start date";
            }

            if (!whitelist && claimType === "allow_list") {
                error["whitelist"] = "Please upload whitelist wallet addresses";
            }

            if (!isEmpty(error)) {
                setError((prevState) => ({
                    ...prevState,
                    ...error,
                }));
                return;
            }

            // parse date to unix
            const startDateTimeUnix = startDateTime.unix().toString();
            const endDateTimeUnix = endDateTime.unix().toString();

            setStartDateTime(startDateTimeUnix);
            setEndDateTime(endDateTimeUnix);

            let _quantity;

            if (claimType === "open_claim") {
                _quantity = quantity;
            } else {
                _quantity = maxNumberOfTokens;
            }

            const response = await updateDestination(_id, token, {
                endTime: endDateTimeUnix,
                quantity: _quantity,
                startTime: startDateTimeUnix,
                max_number_of_tokens: _quantity,
                whitelist_url: claimType === "allow_list" ? whitelist : null,
            });

            if (!response?.success) {
                throw "There was an error. Please refresh and try again";
            } else {
                setStep("review");
            }
        } catch (err) {
            console.error(err);

            showError(err);

            sendAnayticsEvent("Minting Review Failed", {
                reason:
                    err?.message || err || "There was an error while review",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleMint = async () => {
        setLoading(true);
        setInProgress(true);

        sendAnayticsEvent("Trigger Minting Process", {
            step: "createDrop",
        });

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
                throw new Error(
                    `Please switch to a wallet that supports ${contractConfig?.network} network`
                );
            }

            const accounts = await provider.listAccounts();

            if (status == "failed") {
                // TODO: change message.
                throw new Error(
                    "Destination was minted but not saved on our servers, please contact someone from the team."
                );
            }

            if (status == "verified") {
                const nonce = await getMinterNonce(
                    provider,
                    contractName,
                    accounts[0]
                );

                const {
                    ipfsHashMetadata,
                    signature,
                    startTime,
                    endTime,
                    price,
                    shareCyber,
                    contractAddress,
                } = await FactoryApi.generateSignature({
                    nonce,
                    destinationId: _id,
                });

                let createDropTokenId;

                createDropTokenId = await createDrop(
                    provider,
                    ipfsHashMetadata,
                    claimType === "allow_list" ? maxNumberOfTokens : quantity,
                    shareCyber,
                    signature,
                    contractName,
                    parseInt(startTime),
                    parseInt(endTime),
                    BigNumber.from(price),
                    accounts[0]
                );

                if (!createDropTokenId) {
                    throw new Error(
                        "There was an error while minting your asset. Please refresh and try again"
                    );
                }

                const response = await finalizeCreateDrop(_id, token, {
                    token_id: createDropTokenId,
                    contract_address: contractAddress,
                });

                if (!response?.success) {
                    sendAnayticsEvent("Finalize Create Drop Failed", {
                        step: "createDrop",
                        token_id: createDropTokenId,
                        contract_address: contractAddress,
                    });
                    // update status to `failed`, need reviewed by team.
                    const response = await updateDestination(_id, token, {
                        status: "failed",
                    });

                    if (!response?.success) {
                        throw new Error(
                            "Something went wrong, please contact someone from the team."
                        );
                    }
                    // TODO: change message.
                    throw new Error(
                        "Destination was minted but not saved on our servers, please contact someone from the team."
                    );
                } else {
                    sendAnayticsEvent("Minting Process Successful", {
                        step: "createDrop",
                    });
                    setStep("success");
                }
            } else {
                throw new Error(
                    "Your asset has not been verified yet. We will notice you soon."
                );
            }
        } catch (err) {
            showError(err?.message || "There was an error while create drop");

            sendAnayticsEvent("Minting Process Failed", {
                step: "createDrop",
                reason: err?.message || "There was an error while create drop",
            });
            console.error(err);
        } finally {
            setLoading(false);
            setInProgress(false);
        }
    };

    const localtz = tz.guess();

    const timezone = moment().tz(localtz).format("z");

    return (
        <Container>
            {step !== "success" ? (
                loading && step === "review" ? (
                    <State
                        type="pending"
                        title="Pending…"
                        description="Please don't close your browser until the transaction is completed."
                        footer={
                            <RoundButton
                                disabled
                                isLight={true}
                                background="#070707"
                            >
                                Got it
                            </RoundButton>
                        }
                    />
                ) : (
                    <>
                        <Details>
                            <h1>
                                {step === "init"
                                    ? "Claim Page Set Up"
                                    : "Claim Page Set Up: Final Review"}
                            </h1>
                            <p>
                                {step === "init" ? (
                                    <>
                                        Review and create the landing page for
                                        your claim. The claim will only be
                                        active for the date/time range you set.
                                        If you have any questions, join our{" "}
                                        <a
                                            href="https://discord.com/invite/XdR3NAtkJm"
                                            target={"_blank"}
                                        >
                                            discord
                                        </a>
                                    </>
                                ) : (
                                    "Review each detail and once comfortable, proceed to create your claim page."
                                )}
                            </p>
                            {step === "init" ? (
                                <>
                                    <div>
                                        <label>
                                            Choose claim start date & time (
                                            {timezone})
                                        </label>
                                        <DateGroup>
                                            <Input
                                                min={0}
                                                type={"date"}
                                                name="startDate"
                                                autoComplete="off"
                                                overrideTheme="light"
                                                defaultValue={startDate}
                                                onChange={handleDateChange}
                                                style={{ marginRight: "16px" }}
                                            />
                                            <Input
                                                min={0}
                                                type={"time"}
                                                name="startTime"
                                                autoComplete="off"
                                                overrideTheme="light"
                                                defaultValue={startTime}
                                                onChange={handleTimeChange}
                                            />
                                        </DateGroup>
                                        {(error?.startDate ||
                                            error?.startTime) && (
                                            <span className="error">
                                                {error?.startDate ||
                                                    error?.startTime}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <label>
                                            Choose claim end date & time (
                                            {timezone})
                                        </label>
                                        <DateGroup>
                                            <Input
                                                min={0}
                                                type={"date"}
                                                name="endDate"
                                                autoComplete="off"
                                                overrideTheme="light"
                                                defaultValue={endDate}
                                                onChange={handleDateChange}
                                                style={{ marginRight: "16px" }}
                                            />
                                            <Input
                                                min={0}
                                                name="endTime"
                                                type={"time"}
                                                autoComplete="off"
                                                overrideTheme="light"
                                                defaultValue={endTime}
                                                onChange={handleTimeChange}
                                            />
                                        </DateGroup>
                                        {(error?.endDate || error?.endTime) && (
                                            <span className="error">
                                                {error?.endDate ||
                                                    error?.endTime}
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <label>
                                            Set up an allow list or allow anyone
                                            to claim:
                                        </label>
                                        <RadioGroup>
                                            {ClaimOptions.map((item, index) => (
                                                <Radio
                                                    key={index}
                                                    item={item}
                                                    selected={
                                                        claimType ===
                                                        item?.value
                                                    }
                                                    onClick={() =>
                                                        setClaimType(item.value)
                                                    }
                                                />
                                            ))}
                                        </RadioGroup>
                                    </div>

                                    {claimType === "allow_list" ? (
                                        <div>
                                            <label>
                                                List of Wallet addresses that
                                                will be able to claim
                                            </label>
                                            <span>
                                                Download sample{" "}
                                                <a
                                                    href="https://docs.google.com/spreadsheets/d/1Qu0Hnyc1CXrdvR1pqSdk6dqfU-PhQTMvbRij5mfXDUc/edit#gid=1680255761"
                                                    target={"_blank"}
                                                    download
                                                >
                                                    CSV
                                                </a>
                                            </span>
                                            <WhitelistUploader
                                                url={whitelist}
                                                onRemove={() =>
                                                    setWhitelist(null)
                                                }
                                                onUpload={handleUploadWhitelist}
                                                onError={(msg) => {
                                                    setError((prevState) => ({
                                                        ...prevState,
                                                        whitelist: msg,
                                                    }));
                                                }}
                                            />
                                            {error?.whitelist && (
                                                <span className="error">
                                                    {error.whitelist}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <label>
                                                Max # of tokens possible to be
                                                minted
                                            </label>
                                            <Input
                                                min={0}
                                                type={"number"}
                                                overrideTheme="light"
                                                placeholder="e.g. 1"
                                                name="quantity"
                                                onKeyDown={(e) => {
                                                    if (
                                                        e.code === "ArrowUp" ||
                                                        e.code === "ArrowDown"
                                                    ) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                                onWheel={(e) => {
                                                    (
                                                        e.target as HTMLInputElement
                                                    ).blur();
                                                }}
                                                onChange={(e) =>
                                                    setQuantity(e.target.value)
                                                }
                                                defaultValue={
                                                    destination?.quantity
                                                }
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <SetupClaimReview
                                        claimType={claimType}
                                        whitelist={whitelist}
                                        endTime={endDateTime}
                                        name={destination?.name}
                                        startTime={startDateTime}
                                        estimateGas={estimateGas}
                                        contractName={contractName}
                                        loadingEstGas={loadingEstGas}
                                        gasPriceError={gasPriceError}
                                        quantity={destination?.quantity}
                                        thumbnail={destination?.thumbnail}
                                        maxNumberOfTokens={
                                            claimType === "allow_list"
                                                ? maxNumberOfTokens
                                                : quantity
                                        }
                                        description={destination?.description}
                                        animationHash={
                                            destination?.animationHash
                                        }
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
                                className="submit"
                                disabled={disable || loading}
                                onClick={step === "init" ? Review : handleMint}
                            >
                                {loading
                                    ? "Loading…"
                                    : step === "review"
                                    ? "Initiate Transaction"
                                    : "Review Details"}
                            </RoundButton>
                        </Footer>
                    </>
                )
            ) : (
                <State
                    type="success"
                    title="Success!"
                    description="View your claim page and share with your community!"
                    footer={
                        <RoundButton
                            isLight={true}
                            background="#070707"
                            onClick={() => {
                                onSuccess();
                            }}
                        >
                            Got it
                        </RoundButton>
                    }
                >
                    <Claim>
                        <label>Your claim page</label>
                        <Input
                            icon={true}
                            iconPosition="right"
                            autoComplete="off"
                            overrideTheme="light"
                            style={{ marginTop: "5px" }}
                            defaultValue={`${nodeEnv.PUBLIC_API}/mints/${destination?.slug}`}
                        >
                            {!copied ? (
                                <Duplicate
                                    style={{ marginTop: "5px" }}
                                    strokeColor={"#18191C"}
                                    onClick={() => {
                                        navigator.clipboard.writeText(
                                            `${nodeEnv.PUBLIC_API}/mints/${destination?.slug}`
                                        );
                                        setCopied(true);
                                        setTimeout(() => {
                                            setCopied(false);
                                        }, 2000);
                                    }}
                                />
                            ) : (
                                <Check
                                    strokeColor="#48C9B0"
                                    style={{ marginTop: "2px" }}
                                />
                            )}
                        </Input>
                    </Claim>
                </State>
            )}
        </Container>
    );
};

const Container = styled.div``;

const DateGroup = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const Claim = styled.div`
    width: 100%;
    margin-top: 32px;
    margin-bottom: 10px;

    & > label {
        font-weight: 500;
        font-size: 14px;
        line-height: 24px;
        color: #3d3f46;
    }

    input {
        font-size: 14px;
        line-height: 24px;
        color: #c0c0c6;
    }
`;

const RadioGroup = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
`;

export default SetupClaimPage;
