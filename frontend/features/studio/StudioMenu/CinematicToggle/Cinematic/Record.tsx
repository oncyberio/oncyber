import React from "react";
import styled from "styled-components";
import { Container, Header, Footer } from "./shared/styles";
import ProgressBar from "@ui/components/ProgressBar";
import { NButton } from "@features/studio/components/StudioButton";
import { useCinematic } from "../../context/CinematicContext";

export default function Record() {
    const { videoFormat, previewRef, progress, cancel } = useCinematic();

    return (
        <Container hasBackground={true}>
            <Header className="header">
                <h1>Processing and rendering...</h1>
            </Header>
            <Processing>
                <canvas
                    width={videoFormat?.width}
                    height={videoFormat?.height}
                    style={{
                        borderRadius: 8,
                        background: "#000",
                    }}
                    ref={previewRef}
                />
                <Loading>
                    <span>{progress}% complete</span>
                    <div className="progress">
                        <ProgressBar
                            height="16px"
                            progress={progress}
                            background="#FFFFFF"
                            style={{
                                position: "relative",
                                borderRadius: "4px",
                            }}
                        />
                    </div>
                    <p>Note: this may take a minute</p>
                </Loading>
            </Processing>
            <Footer>
                <NButton
                    type="button"
                    size="medium"
                    onClick={cancel}
                    overrideTheme="dark"
                    className="cancel"
                >
                    <span>Cancel</span>
                </NButton>
                <NButton
                    size="medium"
                    type="button"
                    className="download"
                    overrideTheme="dark"
                    disabled={true}
                >
                    <span>Download video</span>
                </NButton>
            </Footer>
        </Container>
    );
}

export const Processing = styled.div`
    width: auto;
    height: 390px;
    display: flex;
    margin-top: 20px;
    position: relative;
    border-radius: 10px;
    align-items: center;
    margin-bottom: 20px;
    flex-direction: column;
    justify-content: center;

    @media (max-width: 830px) {
        height: calc(100vh - 540px);
    }

    @media (max-height: 920px) {
        margin-top: 0;
        margin-bottom: 0;
    }
`;

export const Loading = styled.div`
    display: flex;
    flex-direction: column;
    position: absolute;
    height: 45px;
    max-width: 380px;
    width: 80%;

    & > .progress {
        background: #070707;
        border-radius: 4px;
    }

    & > span {
        font-style: normal;
        font-weight: 400;
        font-size: 14px;
        line-height: 24px;
        text-align: center;
        color: var(--color);
    }

    & > p {
        font-style: normal;
        font-weight: 400;
        font-size: 12px;
        line-height: 20px;
        text-align: center;
        color: var(--color);
    }
`;
