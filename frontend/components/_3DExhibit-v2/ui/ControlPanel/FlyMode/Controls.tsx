import { useCyberTranslation } from "@components/context/I18nContext";
import React from "react";
import styled from "styled-components";

export default function Controls({ showControl, toggleControl }) {
    const { t } = useCyberTranslation();

    return (
        <Container>
            {showControl && (
                <div className="control-wrapper">
                    <Hr />

                    <div className="list">
                        <span className="label">{t`MOVE_AROUND`}</span>
                        <span className="control">W, A, S, D</span>
                    </div>

                    <div className="list">
                        <span className="label">{t`LOOK_AROUND`}</span>
                        <span className="control">Mouse / Trackpad</span>
                    </div>

                    <div className="list">
                        <span className="label">{t`ASCEND_DESCEND`}</span>
                        <span className="control">Q / E</span>
                    </div>

                    <div className="list">
                        <span className="label">{t`ROTATE`}</span>
                        <span className="control">Z / C</span>
                    </div>

                    <div className="list">
                        <span className="label">{t`TAKE_A_SCREENSHOT`}</span>
                        <span className="control">B</span>
                    </div>

                    <div className="list">
                        <span className="label">{t`EXIT_FLY_MODE`}</span>
                        <span className="control">X</span>
                    </div>
                </div>
            )}

            <button
                className="controls-btn"
                onClick={() => toggleControl((prevState) => !prevState)}
            >
                {showControl ? t`HIDE_CONTROLS` : t`SHOW_CONTROLS`}
            </button>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    margin-top: 26px;
    flex-direction: column;
    width: 100%;

    & > .control-wrapper {
        position: relative;
        margin-bottom: 16px;

        & > .list {
            display: flex;
            align-items: center;
            justify-content: space-between;

            & > .label {
                font-weight: 400;
                font-size: 12px;
                line-height: 24px;

                color: #ffffff;
            }

            & > .control {
                font-weight: 500;
                font-size: 12px;
                line-height: 24px;

                text-align: right;
                letter-spacing: -0.01em;

                color: rgba(255, 255, 255, 0.6);
            }
        }
    }

    & > .controls-btn {
        background: transparent;
        outline: 0;
        border: 0;
        width: 100%;

        border-top: 1px solid rgba(255, 255, 255, 0.2);

        cursor: pointer;

        font-weight: 500;
        font-size: 12px;
        line-height: 24px;

        display: flex;
        align-items: center;
        text-align: center;
        justify-content: center;

        color: #ffffff;
    }
`;

const Hr = styled.div`
    width: 100%;
    height: 2px;

    margin-bottom: 16px;

    background: rgba(255, 255, 225, 0.2);
`;
