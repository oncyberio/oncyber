import React, { forwardRef } from "react";
import styled from "styled-components";
import { dialogCopy } from "@components/Dialogs/styles";
import { baseTokens as base } from "@styles/tokens/base";

export interface StepProps {
    description: string;
    status: string;
}

const Step = ({ description, status }: StepProps) => {
    return (
        <Container>
            {status === "success" ? (
                <>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="success"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                    <h6 className="success">{description}</h6>
                </>
            ) : status === "progress" ? (
                <>
                    <div className="spinner">
                        <div />
                        <div />
                        <div />
                        <div />
                    </div>
                    <h6 className="progress">{description}</h6>
                </>
            ) : status === "todo" ? (
                <>
                    <div className="circle"></div>
                    <h6 className="todo">{description}</h6>
                </>
            ) : status === "error" ? (
                <>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="error"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <h6 className="error">{description}</h6>
                </>
            ) : (
                <></>
            )}
        </Container>
    );
};

// Colours come from the dialog window the steps sit in (see Dialogs/styles).
const Container = styled.div`
    display: flex;
    justify-content: flex-start;
    align-items: center;

    h6 {
        ${dialogCopy}
        text-align: left;

        &.success,
        &.progress {
            color: var(--content-color, ${base.color.secondary});
        }

        &.error {
            color: var(--danger-color);
        }

        &.todo {
            color: ${base.color.muted};
        }
    }

    svg {
        flex-shrink: 0;
        width: 25px;
        height: 25px;
        padding: 4px;
        margin-right: 12px;
        border-radius: 999px;

        &.success,
        &.progress {
            color: #ffffff;
            background: #1abc9c;
            border: 1px solid #1abc9c;
        }

        &.error {
            color: #ffffff;
            background: #c0392b;
            border: 1px solid #c0392b;
        }
    }

    div.circle {
        flex-shrink: 0;
        width: 25px;
        height: 25px;
        border: 2px solid ${base.color.line.hover};
        border-radius: 999px;
        margin-right: 12px;
    }

    div.spinner {
        flex-shrink: 0;
        display: inline-block;
        position: relative;
        width: 25px;
        height: 25px;
        margin-right: 12px;

        @keyframes animation {
            0% {
                transform: rotate(0deg);
            }
            100% {
                transform: rotate(360deg);
            }
        }

        div {
            box-sizing: border-box;
            display: block;
            position: absolute;
            width: 25px;
            height: 25px;
            border: 2px solid #00e3bd;
            border-radius: 50%;
            animation: animation 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
            border-color: #00e3bd transparent transparent transparent;
        }

        div:nth-child(1) {
            animation-delay: -0.45s;
        }
        div:nth-child(2) {
            animation-delay: -0.3s;
        }
        div:nth-child(3) {
            animation-delay: -0.15s;
        }
    }
`;

export default Step;
