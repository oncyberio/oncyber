import { nodeEnv } from "@env";
import Check from "@ui/icons/Check";
import styled from "styled-components";
import { getSlug } from "@utils/destinations";
import DuplicateIcon from "@components/Icons/DuplicateIcon";
import { checkSlugExists } from "gl/fetchExhibitData";
import { RoundButton } from "@components/DesignSystem/buttons";
import { useState, ChangeEvent } from "react";
import { amplitude_logAnalyticsEvent, getCookie } from "@utils/analytics";
import Modal from "@components/modals/Modal";
import { showError } from "@components/Dialogs";
import { Destination } from "@uitypes/destinations";

export interface RoomMetadata {
    name: string;
    slug: string;
}

export interface FactoryMetadataProps {
    destination: Destination;
    onSubmit: (metadata: RoomMetadata) => unknown;
    onCancel: () => unknown;
}

export default function EditMetadata({ destination, onSubmit, onCancel }: FactoryMetadataProps) {
    //

    const [name, setName] = useState(destination.name);
    const [slug, setSlug] = useState(destination.slug);
    const [copied, setCopied] = useState(false);

    const handleSubmit = async () => {
        //
        try {
            if (!name) {
                throw new Error("Please set name!");
            }

            if (name?.trim() === "new") {
                throw new Error("Invalid name. Please choose another slug");
            }

            const sameSlug = destination.slug === slug;

            if (!sameSlug && (await checkSlugExists(name.replace(/ /g, "").toLowerCase()))) {
                throw new Error("This destination name already exists");
            }

            onSubmit({ name, slug });

            //
        } catch (err) {
            const error = err.message;

            amplitude_logAnalyticsEvent("space_submit_error", {
                sessionId: getCookie("uploader"),
                message: error,
            });

            showError(error);
        }
    };

    return (
        <Modal
            hasBackground
            isBackdrop={false}
            isShowing={true}
            toggle={console.log}
            noShowClose={true}
            style={{
                width: "565px",
                margin: "0",
                padding: "0",
                border: "none",
                maxWidth: "90%",
                maxHeight: "90%",
                overflowY: "auto",
                overflowX: "hidden",
                borderRadius: "16px",
                background: "#1e1e1e",
            }}
        >
            <Container>
                <SubmitDestination>
                    <Details>
                        <h1>Upload for Testing</h1>
                        <p>
                            You'll later have an option to submit your space for official release. View our{" "}
                            <a href="https://docs.oncyber.io/spaces/" target={"_blank"}>
                                docs
                            </a>{" "}
                            for more info.
                        </p>
                        <div>
                            <label>Destination Name</label>
                            <Input
                                placeholder="The title of your destination"
                                type={"text"}
                                defaultValue={name}
                                name="name"
                                autoComplete="off"
                                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                    setName(e.target.value);
                                    setSlug(getSlug(e.target.value));
                                }}
                            />
                        </div>
                        <div>
                            <label>Destination Link</label>
                            <div className="input-icon">
                                {!copied ? (
                                    <DuplicateIcon
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${nodeEnv.PUBLIC_API}/destinations/${slug}`);
                                            setCopied(true);
                                            setTimeout(() => {
                                                setCopied(false);
                                            }, 2000);
                                        }}
                                    />
                                ) : (
                                    <Check strokeColor="#48C9B0" style={{ marginTop: "2px" }} />
                                )}

                                <Input autoComplete="off" type={"url"} disabled placeholder={`${nodeEnv.PUBLIC_API}/destinations/${slug || ""}`} defaultValue={slug ? `${nodeEnv.PUBLIC_API}/destinations/${slug}` : ""} />
                            </div>
                        </div>
                    </Details>

                    <Footer>
                        <RoundButton className="cancel" onClick={onCancel}>
                            Cancel
                        </RoundButton>
                        <RoundButton className="submit" onClick={handleSubmit}>
                            Upload
                        </RoundButton>
                    </Footer>
                </SubmitDestination>
            </Container>
        </Modal>
    );
}

const Container = styled.div`
    --bg-color: #1e1e1e;
    --color: #ffffff;
    --input-bg: #27282c;
    --color-sec: #c0c0c6;
    --color-label: #777980;
    --border-color: #3d3f46;
    --content-color: #7a7a7a;
`;

const SubmitDestination = styled.div`
    width: 100%;
    height: auto;
    border-radius: 16px;
    padding: 10px 0px 0px 0px;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
`;

const Details = styled.div`
    padding: 28px 32px 0px 32px;

    & > h1 {
        font-weight: 500;
        font-size: 22px;
        line-height: 10px;
        color: var(--color);

        @media (max-width: 800px) {
            font-size: 20px;
        }
    }

    & > p {
        font-size: 14px;
        font-weight: 400;
        color: var(--color-sec);
        line-height: 1.5;

        @media (max-width: 800px) {
            font-size: 12px;
        }

        & > a {
            color: var(--color);
            text-decoration: underline;
        }
    }

    & > div {
        display: flex;
        flex-direction: column;
        margin-bottom: 10px;

        & > label {
            font-size: 14px;
            line-height: 28px;
            font-weight: 400;
            color: var(--color-label);

            @media (max-width: 800px) {
                font-size: 12px;
            }
        }

        & > textarea {
            background: #fff;
            border: 1px solid #e0e0e0;
            box-sizing: border-box;
            border-radius: 6px;
            height: 64px;
            color: #292929;
            padding: 10px 10px;
            outline: none;

            @media (max-width: 800px) {
                font-size: 12px;
            }

            &:focus {
                border: 1px solid #292929;
            }
        }

        div.input-icon {
            width: 100%;
            position: relative;

            & > svg {
                color: #8a94a6;
                width: 20px;
                height: 20px;
                position: absolute;
                right: 6px;
                top: 10px;
                cursor: pointer;
            }
        }
    }
`;

const Footer = styled.footer`
    margin-top: 30px;
    display: flex;
    justify-content: flex-end;
    padding: 25px;
    border-top: 1.5px solid var(--border-color);

    & > button {
        margin-left: 16px;

        @media (max-width: 800px) {
            font-size: 12px;
        }

        &.cancel {
            color: var(--color);
            background: transparent;
            border: 1px solid #a9a9a9;
        }
    }
`;

const Input = styled.input`
    width: 100%;
    background: var(--input-bg);
    border: none;
    box-sizing: border-box;
    border-radius: 6px;
    height: 40px;
    outline: none;
    box-sizing: border-box;
    color: var(--color-sec);
    padding: 2px 10px;

    @media (max-width: 800px) {
        font-size: 12px;
    }
`;
