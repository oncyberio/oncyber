import React from "react";
import styled from "styled-components";
import CheckCircle from "@ui/icons/CheckCircle";
import Spinner from "@ui/components/Spinner";
import { Footer } from "./shared/styles";
import { NButton } from "@features/studio/components/StudioButton";
import { useCinematic } from "../../context/CinematicContext";
import IconImg from "@ui/components/IconImg";
import { studioHeading } from "@features/studio/styles/primitives";

export default function Download() {
    const { loadingProgress, isRecordCompleted, cancel, download } =
        useCinematic();

    return (
        <Container>
            <Wrapper>
                <IconImg
                    name="check-circle"
                    size={48}
                    style={{ filter: "invert(0.5)", marginBottom: "1.5em" }}
                />
                <h2>Your video is ready!</h2>
                {!loadingProgress ? (
                    <p>You can download it on the button below</p>
                ) : loadingProgress === "uploading" ? (
                    <p
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Spinner isLightTheme={false} width={18} />
                        We're uploading your video, please don't close this
                        page.
                    </p>
                ) : loadingProgress === "saving" ? (
                    <p>Saving...</p>
                ) : null}
            </Wrapper>

            <Footer>
                <NButton
                    type="button"
                    size="small"
                    onClick={cancel}
                    overrideTheme="dark"
                    className="cancel"
                >
                    <span>Cancel</span>
                </NButton>
                <NButton
                    size="small"
                    type="button"
                    className="download"
                    overrideTheme="dark"
                    onClick={download}
                    disabled={!isRecordCompleted}
                >
                    <span>Download video</span>
                </NButton>
            </Footer>
        </Container>
    );
}

const Container = styled.div`
    width: 534px;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: flex-start;
    background: var(--bg-color);
    border-radius: 6px;
    max-height: 700px;
`;

const Wrapper = styled.div`
    width: 100%;
    height: auto;
    display: flex;
    position: relative;
    align-items: center;
    border-radius: 6px;
    flex-direction: column;
    padding: 40px 40px 20px 40px;
    justify-content: flex-start;
    background: var(--bg-color);

    & > .check-icon {
        margin: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
    }

    & > h2 {
        ${studioHeading}
        color: var(--color);
        text-align: center;
        margin-bottom: 10px;
    }

    & > p {
        color: var(--color-label);
        font-size: 13px;
        font-weight: 400;
        line-height: 20px;
        text-align: center;
        font-style: normal;
    }
`;
