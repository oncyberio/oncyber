import React, { useState, forwardRef, useContext, useEffect } from "react";
import { isEmail, noop } from "@utils/js";
import isEmpty from "lodash/isEmpty";
import UploadSplines from "./Splines";
import styled from "styled-components";
import Input from "@ui/components/Input";
import { Contracts, distriTypeItems } from "../../../shared/constants";
import Radio from "../Mint/components/Radio";
import { getSlug } from "@utils/destinations";
import CheckCircle from "ui/icons/CheckCircle";
import Textarea from "@ui/components/Textarea";
import { Destination, Destinations } from "@uitypes/destinations";
import VideoImage from "@ui/components/Upload/Video";
import UploadImage from "@ui/components/Upload/Image";
import ChevronDown from "@components/Icons/ChevronDown";
import { submitReviewDestination } from "@utils/saveToDb";
import { checkSlugExists } from "gl/fetchExhibitData";
import { UserContext } from "@components/context/UserContext";
import { RoundButton } from "@components/DesignSystem/buttons";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { Dropdown, Items } from "@components/DesignSystem/Dropdown";
import Modal from "@components/modals/Modal";
import { showConfirm, showError } from "@components/Dialogs";
import { dialogButtons } from "@components/Dialogs/styles";
import { baseTokens as base } from "@styles/tokens/base";

export interface Props {
    destination: Partial<Destination>;
    onSuccess: (destination: Destination) => unknown;
    onCancel: () => unknown;
}

const SubmitForReview = forwardRef<HTMLDivElement, Props>(
    ({ destination, onSuccess, onCancel }, ref) => {
        //

        const [form, setForm] = useState<{
            name: string;
            email: string;
            spline?: string;
            quantity?: number;
            thumbnail?: string;
            contractName: string;
            description?: string;
            animationHash?: string;
            distributionType: string;
            animation_url?: string;
        }>({
            name: destination?.name,
            spline: destination?.spline,
            quantity: destination?.quantity,
            email: destination?.author?.email,
            thumbnail: destination?.thumbnail,
            description: destination?.description,
            animationHash: destination?.animationHash,
            distributionType: destination?.distributionType,
            contractName:
                destination?.contractName || "oncyber-ethereum-community",
        });

        const [loading, setLoading] = useState(false);
        const [submittedDestination, setSubmittedDest] = useState(null);
        const [loadingSpline, setLoadingSpline] = useState(false);
        const [error, setError] = useState<Record<string, string>>({});
        const [toggleDistriType, setToggleDistriType] = useState(false);

        const isEdit = destination.status === "submitted";

        const { token, user } = useContext(UserContext);

        useEffect(() => {
            sendAnayticsEvent("Trigger Submit for Review");
        }, []);

        const sendAnayticsEvent = (eventName: string, options = {}) => {
            amplitude_logAnalyticsEvent(eventName, {
                id: destination?._id,
                name: destination?.name,
                slug: destination?.slug,
                userId: user?.id,
                ...options,
            });
        };

        const handleSubmit = async () => {
            const error: Record<string, string> = {};

            if (!isEmail(form?.email)) {
                error["email"] = "Please set a valide email address!";
            }

            if (!form?.description) {
                error["description"] = "Please set description!";
            }

            if (!form.distributionType) {
                error["distributionType"] = "Please set distribution type!";
            }

            if (!form.contractName) {
                error["contract"] = "Please set contract for minting!";
            }

            if (
                form?.distributionType === "self_claim_tokens" ||
                form?.distributionType === "create_claim_page"
            ) {
                if (!form?.quantity) {
                    error["quantity"] = "Please set max number of tokens!";
                }
            }

            if (!form?.animationHash) {
                error["animationHash"] = "Please set animation/video!";
            }

            if (!isEmpty(error)) {
                setError(error);
                return;
            }

            let shouldContinue = true;

            if (!isEdit) {
                shouldContinue = await showConfirm(
                    "We'll use the name, description, image, and video as metadata for your mint. Are you sure you want to submit?"
                );
            }

            if (!shouldContinue) {
                return;
            }

            setLoading(true);

            let slug = destination?.slug;

            if (destination?.name !== form?.name) {
                const slugExists = await checkSlugExists(
                    form.name.replace(/ /g, "").toLowerCase()
                );

                if (slugExists) {
                    setForm({
                        ...form,
                        name: "This destination name already exists",
                    });

                    return;
                }

                slug = getSlug(form.name);
            }

            try {
                const response = await submitReviewDestination(
                    destination?._id,
                    token,
                    {
                        ...form,
                        ...(form?.distributionType && {
                            distributionType: form.distributionType,
                        }),
                        ...(form?.animation_url && {
                            animation_url: form.animation_url,
                        }),
                        ...(destination?.slug !== slug && {
                            slug,
                        }),
                    }
                );

                if (!response?.success) {
                    throw new Error(
                        response?.error || response?.message || "Unknown error"
                    );
                }

                sendAnayticsEvent(
                    `Submit for Review Successful ${isEdit ? "(edit)" : ""}`,
                    {
                        ...form,
                        isEdit,
                    }
                );

                setSubmittedDest(response.data || destination.slug);
            } catch (err) {
                console.error(err);
                showError("Failed to submit review, Please try later");
                sendAnayticsEvent("Submit for Review Failed", {
                    reason:
                        err?.message ||
                        err ||
                        "Failed to submit review, Please try later",
                });
            } finally {
                setLoading(false);
            }
        };

        const handleInputChange = (e) => {
            setError((prevState) => ({
                ...prevState,
                [e.target?.name]: null,
            }));

            setForm((prevState) => ({
                ...prevState,
                [e.target?.name]:
                    e.target?.type === "number"
                        ? parseInt(e.target?.value)
                        : e.target?.value,
            }));
        };

        const isSubmitted = submittedDestination != null;

        return (
            <Modal
                size="wide"
                hasBackground
                isBackdrop={false}
                noShowClose={true}
                overlayStyle={{
                    opacity: 0.5,
                    background: "#070707",
                }}
                style={{
                    margin: "0",
                    padding: "0",
                    width: "565px",
                    maxWidth: "90%",
                    maxHeight: "90%",
                    overflowY: "auto",
                    overflowX: "hidden",
                }}
                toggle={noop}
                overrideTheme="dark"
                // The shared dark dialog surface (see Dialogs/styles).
                className="dialog-window"
                isShowing={true}
            >
                <Container ref={ref} className="scrollbar">
                    {!isSubmitted ? (
                        <>
                            <Details>
                                <h1>
                                    {isEdit
                                        ? "Update destination details"
                                        : "Mint your space"}
                                </h1>
                                <p>
                                    We'll review your space to make sure it
                                    meets{" "}
                                    <a
                                        href="https://docs.oncyber.io/custom-spaces/requirements-to-mint"
                                        target={"_blank"}
                                    >
                                        requirements
                                    </a>
                                </p>

                                <div>
                                    <label>Contact Email</label>
                                    <span className="subcopy">
                                        Receive updates on minting eligibility
                                    </span>
                                    <Input
                                        name="email"
                                        type={"email"}
                                        autoComplete="off"
                                        overrideTheme="dark"
                                        color="var(--title-color)"
                                        defaultValue={form?.email}
                                        onChange={handleInputChange}
                                        placeholder="e.g. rtfkt@nike.com"
                                    />
                                    {error?.email && (
                                        <span className="error">
                                            {error.email}
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <label>Distribution Type</label>
                                    <span className="subcopy">
                                        Select your distribution plan
                                    </span>
                                    <Dropdown
                                        background="var(--field-bg-color)"
                                        borderColor="var(--field-border-color)"
                                        color="var(--title-color)"
                                        height={40}
                                        margin="0"
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setToggleDistriType(
                                                    (prevState) => !prevState
                                                )
                                            }
                                        >
                                            <div>
                                                <span
                                                    style={
                                                        !form?.distributionType
                                                            ? {
                                                                  color: "var(--content-color)",
                                                              }
                                                            : {}
                                                    }
                                                >
                                                    {!form?.distributionType
                                                        ? "Select…"
                                                        : distriTypeItems?.filter(
                                                              (item) =>
                                                                  item?.key ==
                                                                  form?.distributionType
                                                          )[0]?.name}
                                                </span>
                                            </div>
                                            <span>
                                                <ChevronDown
                                                    size={20}
                                                    color="#777980"
                                                />
                                            </span>
                                        </button>

                                        <Items
                                            top="1.838rem"
                                            color="var(--title-color)"
                                            background="var(--bg-color)"
                                            isHidden={!toggleDistriType}
                                            isEmpty={
                                                distriTypeItems?.length === 0
                                            }
                                        >
                                            {distriTypeItems?.map(
                                                ({ name, key }, index) => (
                                                    <li
                                                        key={index}
                                                        onClick={() => {
                                                            setError({
                                                                ...error,
                                                                quantity: null,
                                                                distributionType:
                                                                    null,
                                                            });

                                                            setForm(
                                                                (
                                                                    prevState
                                                                ) => ({
                                                                    ...prevState,
                                                                    distributionType:
                                                                        key,
                                                                })
                                                            );

                                                            setToggleDistriType(
                                                                (prev) => !prev
                                                            );
                                                        }}
                                                    >
                                                        <span>{name}</span>
                                                    </li>
                                                )
                                            )}
                                        </Items>
                                    </Dropdown>
                                    {error?.distributionType && (
                                        <span className="error">
                                            {error.distributionType}
                                        </span>
                                    )}
                                </div>

                                {(form?.distributionType ===
                                    "create_claim_page" ||
                                    form?.distributionType ===
                                        "self_claim_tokens") && (
                                    <div>
                                        <label>
                                            {form?.distributionType ===
                                            "create_claim_page"
                                                ? "Max # of tokens possible to be minted"
                                                : "# of tokens to be minted"}
                                        </label>
                                        <Input
                                            min={0}
                                            type={"number"}
                                            overrideTheme="dark"
                                            color="var(--title-color)"
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
                                            onChange={handleInputChange}
                                            defaultValue={form?.quantity}
                                        />
                                        {error?.quantity && (
                                            <span className="error">
                                                {error.quantity}
                                            </span>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label>Destination Name</label>
                                    <Input
                                        name="name"
                                        type={"text"}
                                        autoComplete="off"
                                        overrideTheme="dark"
                                        color="var(--title-color)"
                                        defaultValue={form?.name}
                                        onChange={handleInputChange}
                                        placeholder="Destination Name"
                                    />
                                    {error?.name && (
                                        <span className="error">
                                            {error.name}
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <label>Destination Description</label>
                                    <Textarea
                                        name="description"
                                        overrideTheme="dark"
                                        onChange={handleInputChange}
                                        defaultValue={form?.description}
                                        placeholder="Write a brief description"
                                    />
                                    {error?.description && (
                                        <span className="error">
                                            {error.description}
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <label>Select Contract for minting</label>
                                    <RadioGroup>
                                        {Contracts.filter(
                                            (item) =>
                                                item?.value ===
                                                    "oncyber-ethereum-community" ||
                                                item?.value ===
                                                    "factory-polygon"
                                        ).map((item, index) => (
                                            <Radio
                                                key={index}
                                                item={item}
                                                selected={
                                                    form?.contractName ===
                                                    item?.value
                                                }
                                                onClick={() =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        contractName:
                                                            item?.value,
                                                    }))
                                                }
                                            />
                                        ))}
                                    </RadioGroup>
                                    {error?.contract && (
                                        <span className="error">
                                            {error.contract}
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <UploaderContainer>
                                        <div className="description">
                                            <label>Cover Image</label>
                                            <p>Upload .jpeg or .png images</p>
                                            <UploadImage
                                                overrideTheme="dark"
                                                onUpload={(thumbnail) =>
                                                    setForm({
                                                        ...form,
                                                        thumbnail,
                                                    })
                                                }
                                                accept=".png, .jpg, .jpeg"
                                                style={{ width: "240px" }}
                                                src={destination?.thumbnail}
                                            />
                                        </div>
                                        <div className="description">
                                            <label>Animation / Video</label>
                                            <p>Upload .mp4 videos</p>
                                            <VideoImage
                                                cloudinary={true}
                                                overrideTheme="dark"
                                                onUpload={(
                                                    animationHash,
                                                    animationUrl
                                                ) => {
                                                    setError((prev) => ({
                                                        ...prev,
                                                        animationHash: null,
                                                        animation_url: null,
                                                    }));

                                                    setForm((prevForm) => ({
                                                        ...prevForm,
                                                        animationHash,
                                                        animation_url:
                                                            animationUrl,
                                                    }));
                                                }}
                                                accept=".mp4"
                                                style={{ width: "240px" }}
                                                src={destination?.animationHash}
                                            />
                                        </div>
                                    </UploaderContainer>
                                    {error?.animationHash && (
                                        <span className="error">
                                            {error.animationHash}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <label>Cinematic Splines (optional)</label>
                                    <span className="subcopy">
                                        Join our{" "}
                                        <a
                                            href="https://discord.gg/XdR3NAtkJm"
                                            target={"_blank"}
                                        >
                                            discord
                                        </a>{" "}
                                        for help
                                    </span>
                                    <UploadSplines
                                        slug={destination?.slug}
                                        onUpload={() => {
                                            setLoadingSpline(false);
                                        }}
                                        onError={(err) => {
                                            setError({
                                                ...error,
                                                spline: err,
                                            });
                                            setLoadingSpline(false);
                                        }}
                                        onStart={() => setLoadingSpline(true)}
                                    />
                                    {error?.spline && (
                                        <span className="error">
                                            {error.spline}
                                        </span>
                                    )}
                                </div>
                            </Details>

                            <Footer>
                                <RoundButton
                                    className="btn cancel"
                                    disabled={loading || loadingSpline}
                                    onClick={() => {
                                        if (!loading && !loadingSpline) {
                                            onCancel();
                                        }
                                    }}
                                >
                                    Cancel
                                </RoundButton>
                                <RoundButton
                                    className="btn primary submit"
                                    onClick={handleSubmit}
                                    disabled={loading || loadingSpline}
                                >
                                    {loading
                                        ? "Loading…"
                                        : isSubmitted
                                        ? "Submitted"
                                        : "Submit for Review"}
                                </RoundButton>
                            </Footer>
                        </>
                    ) : (
                        <Success>
                            <div>
                                <CheckCircle color={base.color.ink} />
                                <h1>Success!</h1>
                                {isEdit ? (
                                    <p>
                                        Your destination details has been
                                        successfully updated!
                                    </p>
                                ) : (
                                    <p>
                                        Thanks for your submission! Our team
                                        will review your space and be in touch.
                                    </p>
                                )}
                            </div>
                            <footer>
                                <RoundButton
                                    className="btn primary"
                                    onClick={() => {
                                        onSuccess(submittedDestination);
                                    }}
                                >
                                    Got it
                                </RoundButton>
                            </footer>
                        </Success>
                    )}
                </Container>
            </Modal>
        );
    }
);

// The surface (panel, border, corners, shadow and the colour variables)
// comes from the "dialog-window" class on the modal.
const Container = styled.div`
    width: 100%;
    height: auto;
    overflow-y: auto;
    padding: 10px 0px 0px 0px;

    /* The contract choice (Mint/components/Radio) on the dark surface. */
    --radio-ink: var(--title-color);
    --radio-fill: transparent;
    --radio-line: var(--field-border-color);
    --radio-selected: var(--btn-color);
`;

const Details = styled.div`
    padding: 15px 32px 0px 32px;
    overflow-y: auto;

    & > h1 {
        font-weight: 500;
        font-size: 25px;
        color: var(--title-color);
        line-height: 40%;

        @media (max-width: 800px) {
            font-size: 22px;
        }
    }

    & > p {
        font-weight: 400;
        font-size: 13px;
        color: var(--content-color);
        line-height: 1.5;

        @media (max-width: 800px) {
            font-size: 11px;
        }

        & > a {
            color: var(--title-color);
            text-decoration: underline;
        }
    }

    & > div {
        display: flex;
        flex-direction: column;
        margin-bottom: 20px;

        input[type="number"] {
            -moz-appearance: textfield;
        }

        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }

        span.subcopy {
            font-size: 11px;
            padding-bottom: 8px;
            color: var(--content-color);

            & > a {
                color: var(--title-color);
                text-decoration: underline;
            }

            @media (max-width: 800px) {
                font-size: 10px;
            }
        }

        & > label {
            font-size: 14px;
            font-weight: 500;
            color: var(--title-color);
            margin-bottom: 8px;

            &:has(+ .subcopy) {
                margin-bottom: 0px;
            }

            @media (max-width: 800px) {
                font-size: 12px;
            }
        }

        & > .error {
            font-size: 12px;
            color: var(--danger-color);
            padding-top: 8px;

            @media (max-width: 800px) {
                font-size: 10px;
            }
        }
    }
`;

const UploaderContainer = styled.div`
    display: flex;
    margin-top: 10px;
    align-items: center;
    justify-content: space-between;

    @media (max-width: 800px) {
        flex-wrap: wrap;
    }

    & > .description {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        flex-direction: column;

        @media (max-width: 609px) {
            &:not(:first-child) {
                margin-top: 20px;
            }
        }

        label {
            font-size: 14px;
            font-weight: 500;
            color: var(--title-color);

            @media (max-width: 800px) {
                font-size: 12px;
            }
        }

        p {
            margin: 0px;
            font-size: 12px;
            font-weight: 400;
            color: var(--content-color);
            padding-bottom: 8px;

            @media (max-width: 800px) {
                font-size: 10px;
            }
        }
    }
`;

const Footer = styled.footer`
    display: flex;
    padding: 25px;
    margin-top: 10px;
    justify-content: flex-end;
    border-top: 1px solid var(--border-color);

    /* Cancel is the outline, Submit the white confirming action. */
    ${dialogButtons}

    & > button {
        margin-left: 16px;
    }
`;

const RadioGroup = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
`;

const Success = styled.div`
    display: flex;
    font-style: normal;
    border-radius: 16px;
    align-items: center;
    flex-direction: column;
    padding: 45px 0px 0px 0px;
    justify-content: flex-start;

    & > div {
        display: flex;
        padding: 0px 50px 34px 50px;
        align-items: center;
        flex-direction: column;

        & > h1 {
            margin: 0px;
            font-size: 24px;
            color: var(--title-color);
            font-weight: 500;
            line-height: 45px;
            text-align: center;

            @media (max-width: 800px) {
                font-size: 20px;
            }
        }

        & > p {
            margin: 0px;
            font-size: 16px;
            color: var(--content-color);
            line-height: 26px;
            text-align: center;

            @media (max-width: 800px) {
                font-size: 14px;
                line-height: auto;
            }
        }
    }

    & > footer {
        width: 100%;
        height: 84px;
        display: flex;
        padding: 0px 32px;
        align-items: center;
        justify-content: flex-end;
        border-top: 1px solid var(--border-color);
        ${dialogButtons}
    }
`;

export default SubmitForReview;
