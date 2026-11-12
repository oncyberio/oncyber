import { useState } from "react";
import styled from "styled-components";
import { Experience } from "@uitypes/experience";
import CheckCircle from "@ui/icons/CheckCircle";
import { NButton } from "@features/studio/components/StudioButton";
import { Form, FormLabel } from "./styles/Form";
import { Copy } from "./shared/Copy";
import { Footer } from "./styles/Footer";
import { LinkStatus, LinkStatusProps } from "./shared/LinkStatus";
import { Header, HeaderInfo } from "./styles/Header";
import { Input } from "./shared/Input";

export interface SpacePublishedProps {
    exhibit: Experience;
    onGoBack: () => void;
}

export function SpacePublished({ exhibit, onGoBack }: SpacePublishedProps) {
    //
    const [linkStatus, setLinkStatus] =
        useState<LinkStatusProps["status"]>("copy");

    const link = `https://oncyber.io/${
        exhibit?.info?.customLink || `spaces/${exhibit.id}`
    }`;

    const onCopyLink = () => {
        setLinkStatus("success");

        setTimeout(() => {
            setLinkStatus("copy");
        }, 2000);
    };

    return (
        <Publish>
            <div className="info">
                <CheckCircle className="check" color="white" />
                <br />
                <Header style={{ textAlign: "center" }}>
                    Published Successfully
                </Header>
                <HeaderInfo>
                    Your space will now be visible to oncyber explorers, you can
                    also share it with the world!
                </HeaderInfo>
                <Form style={{ marginTop: "32px" }}>
                    <FormLabel>Public Link</FormLabel>
                    <Input
                        disabled
                        icon={true}
                        iconPosition="right"
                        width="100%"
                        height="40px"
                        fontSize="13px"
                        borderRadius="6px"
                        placeholder={link}
                        value={link}
                    >
                        <LinkStatus
                            status={linkStatus}
                            link={link}
                            onCopy={onCopyLink}
                        />
                    </Input>
                </Form>
                {/* <Form overrideTheme={overrideTheme}>
                            <label>Or share to</label>
                            <NButton
                                size="small"
                                className="social"
                                overrideTheme={overrideTheme}
                            >
                                <Twitter />
                                <span>Twitter</span>
                            </NButton>
                        </Form> */}
            </div>
            <Footer className="footer">
                <NButton
                    size="medium"
                    className="cancel"
                    overrideTheme={"light"}
                    onClick={onGoBack}
                >
                    <span>Go back</span>
                </NButton>
                <NButton
                    size="medium"
                    // className="destination"
                    onClick={() => window.open(link, "_blank")}
                    overrideTheme={"light"}
                >
                    Explore Now
                </NButton>
            </Footer>
        </Publish>
    );
}

const Publish = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 32px;

    position: fixed;
    left: 50vw;
    top: 50vh;
    transform: translate(-50%, -50%);

    background: #1e1e1e;
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15),
        0px 12px 28px rgba(0, 0, 0, 0.11);
    border-radius: 8px;
    color: #ffffff;

    & input:disabled {
        background: #27282c !important;
    }

    & > div.info {
        padding: 0 24px;

        .check {
            margin: auto;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .social {
            margin-top: 6px;
            font-weight: 500;
            font-size: 14px;
            width: 100px;
            height: 36px;
            padding: 15px;
            color: #070707;
            border-radius: 17px;
            line-height: 24px;
            background: #ffffff;
            border: 1px solid #dfdfe4;
        }
    }

    & > .footer {
        margin: 0;
        padding: 0;
        border: none;
        position: relative;
    }
`;
