import styled from "styled-components";
import Modal from "@components/modals/Modal";
import State from "@ui/components/Modal/State";
import { RoundButton } from "@components/DesignSystem/buttons";
import CheckCircle from "ui/icons/CheckCircle";
import { noop } from "lodash";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useRouter } from "next/router";
import { useState } from "react";

export default function SceneUpdating({ onClose, step }) {
    //
    const router = useRouter();

    const [isRedirecting, setRedirecting] = useState(false);

    const handleOk = useEventCallback(() => {
        //
        setRedirecting(true);

        setTimeout(() => {
            router.push("/destinations");
        });
    }, []);

    return (
        <Modal
            hasBackground
            isBackdrop={false}
            isShowing={true}
            setShow={noop}
            toggle={onClose}
            noShowClose={true}
            overlayStyle={{
                opacity: 0.5,
            }}
            style={{
                margin: "0",
                padding: "0",
                width: "565px",
                maxWidth: "90%",
                overflow: "hidden",
                borderRadius: "16px",
                background: "#1e1e1e",
            }}
        >
            <Container>
                {step === "success" ? (
                    <Success>
                        <div>
                            <CheckCircle color=" #fff" />
                            <h1>Success!</h1>
                            <p>The destination's physics have been updated.</p>
                        </div>
                    </Success>
                ) : (
                    <State height="220px" type="pending" title="Pending…" className="pending" description="Updating the physics. This may take a few minutes." />
                )}
                <Footer>
                    <RoundButton isLight={true} className="close" onClick={onClose} background="#1e1e1e" disabled={step !== "success"}>
                        Got it
                    </RoundButton>
                </Footer>
            </Container>
        </Modal>
    );
}

const Container = styled.div`
    position: relative;

    & > .pending {
        background: #1e1e1e;

        h1 {
            color: #fff;
        }

        p {
            color: #c0c0c6;
        }
    }
`;

const Success = styled.div`
    display: flex;
    font-style: normal;
    border-radius: 16px;
    align-items: center;
    flex-direction: column;
    padding: 45px 0px 0px 0px;
    justify-content: flex-start;

    @media (max-width: 800px) {
        font-size: 22px;
    }

    & > div {
        display: flex;
        padding: 0px 50px 34px 50px;
        align-items: center;
        flex-direction: column;

        & > h1 {
            margin: 0px;
            font-size: 24px;
            color: #fff;
            font-weight: 500;
            line-height: 45px;
            text-align: center;

            @media (max-width: 800px) {
                font-size: 22px;
            }
        }

        & > p {
            margin: 0px;
            font-size: 16px;
            color: #c0c0c6;
            line-height: 26px;
            text-align: center;

            @media (max-width: 800px) {
                font-size: 14px;
                line-height: auto;
            }
        }
    }
`;

const Footer = styled.div`
    width: 100%;
    height: 84px;
    display: flex;
    padding: 0px 32px;
    align-items: center;
    justify-content: flex-end;
    border-top: 1px solid #292929;

    & > .close {
        color: #fff;
        margin-right: 10px;
        background: transparent;
        border: 1px solid #a9a9a9;
    }
`;
