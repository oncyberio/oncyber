import styled from "styled-components";
import { RoundButton } from "@components/DesignSystem/buttons";
import Modal from "@components/modals/Modal";
import { noop } from "lodash";

export function UploadSuccess({ slug, closeLabel, onClose }) {
    return (
        <Modal
            hasBackground
            isBackdrop={false}
            isShowing={true}
            toggle={noop}
            noShowClose={true}
            style={{
                width: "565px",
                borderRadius: "16px",
                margin: "0",
                padding: "0",
                maxWidth: "90%",
                maxHeight: "90%",
                overflowY: "auto",
                overflowX: "hidden",
                background: "transparent",
            }}
        >
            <Success>
                <div>
                    <div className="icon">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                    <h1>Success!</h1>
                    <p>
                        Once you’ve tested your space, you can submit it for
                        release.
                    </p>
                    <BtnGroup>
                        {closeLabel && onClose && (
                            <RoundButton className="close" onClick={onClose}>
                                {closeLabel}
                            </RoundButton>
                        )}
                        <RoundButton
                            onClick={() => {
                                window.open(`/destinations/${slug}`, "_blank");
                            }}
                        >
                            Visit Destination
                        </RoundButton>
                    </BtnGroup>
                </div>
            </Success>
        </Modal>
    );
}

const Success = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 340px;
    background: #1e1e1e;
    border-radius: 16px;
    font-style: normal;

    & > div {
        display: flex;
        flex-direction: column;
        align-items: center;

        & > div.icon {
            width: 60px;
            height: 60px;
            color: #fff;
            border-radius: 50px;
            margin-bottom: 15px;
            border: 1px solid #fff;
        }

        & > h1 {
            margin: 0px;
            font-size: 24px;
            color: #fff;
            font-weight: 400;
            line-height: 32px;
            text-align: center;

            @media (max-width: 800px) {
                font-size: 20px;
            }
        }

        & > p {
            margin: 0px;
            font-size: 16px;
            line-height: 26px;
            text-align: center;
            color: #c0c0c6;

            @media (max-width: 800px) {
                font-size: 14px;
            }
        }
    }
`;

const BtnGroup = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-top: 20px;

    & > .close {
        color: #fff;
        margin-right: 10px;
        background: transparent;
        border: 1px solid #a9a9a9;
    }
`;
