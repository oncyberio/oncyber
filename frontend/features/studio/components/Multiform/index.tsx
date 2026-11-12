import { studioFocus, studioHeading } from "@features/studio/styles/primitives";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import React, { useState } from "react";
import styled from "styled-components";

export interface MultiformStepProps {
    active: boolean;
    isLight: boolean;
}

export interface MultiformStep {
    value: string;
    title: string;
    description: string;
    icon: (opts: MultiformStepProps) => React.ReactNode;
    form: React.ReactNode;
}

export interface MultiformProps {
    title: React.ReactNode;
    steps: [MultiformStep, ...MultiformStep[]];
    actions: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    isLight?: boolean;
    defaultStep?: string;
}

export function Multiform({
    title,
    steps,
    actions,
    className = "",
    style = {},
    isLight = false,
    defaultStep,
}: MultiformProps) {
    //
    const [current, setCurrent] = useState(defaultStep || steps[0].value);

    const currentStep = steps.find((it) => it.value === current);

    const handleStepClick = useEventCallback((step: string) => {
        //
        if (current === step) return;

        setCurrent(step);

        amplitude_logAnalyticsEvent("open_settings_tab", {
            tab: step,
        });
    }, []);

    return (
        <Container
            data-studio-surface
            isLight={isLight}
            className={className}
            style={style}
        >
            <div className="header">
                <div className="title">{title}</div>
                <div className="actions">{actions}</div>
            </div>
            <div className="sep-horz" />
            <div className="body">
                <div className="steps">
                    {steps.map(({ value, icon, title, description }) => {
                        //
                        const active = current === value;

                        return (
                            <button
                                type="button"
                                aria-pressed={active}
                                key={value}
                                className={`step ${active ? "active" : ""}`}
                                onClick={() => handleStepClick(value)}
                            >
                                {icon({ active, isLight })}
                                <div className="step-desc">
                                    <div className="title">{title}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="sep-vert" />
                <div className="main">
                    <div className="content y-scroll scrollbar-hidden">
                        {currentStep.form}
                    </div>
                </div>
            </div>
        </Container>
    );
}

const Container = styled.div<{
    isLight: boolean;
}>`
    --border-color: var(--studio-line, #303035);
    --multiform-background: var(--panel-bg);
    --multiform-active-form-button: var(--studio-hover, #28282c);
    --multiform-title-color: var(--panel-text-primary);
    --multiform-description-color: var(--panel-text-secondary);
    --multiform-text-color: var(--panel-text-primary);
    --multiform-steps-background: var(--studio-inset);

    ${({ isLight }) =>
        isLight &&
        `
        --border-color: #e5e5e5;
        --multiform-background: #ffffff;
        --multiform-active-form-button: #FFFFFF;
        --multiform-title-color: #292929;
        --multiform-description-color: #7a7a7a;
        --multiform-text-color: #000000;
        --multiform-steps-background: #F5F5F5;
    `}

    display: flex;
    flex-direction: column;
    background: var(--multiform-background);
    border: var(--panel-border);
    box-shadow: var(--panel-shadow);
    border-radius: var(--radius-panel);
    overflow: hidden;
    color: var(--multiform-text-color);

    & > .header {
        flex: 0;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color);

        & > .title {
            ${studioHeading}
            font-size: 16px;
            line-height: 22px;
            flex: 1;
        }

        & > .actions {
            flex: 0;
            margin-left: auto;
        }
    }

    & > .body {
        flex: 1;
        display: flex;
        flex-direction: row;

        & > .steps {
            flex: 0 0 188px;
            display: flex;
            flex-direction: column;
            padding: 12px;
            gap: 4px;
            border-right: 1px solid var(--border-color);
            background: var(--multiform-steps-background);

            & > .step {
                ${studioFocus}
                padding: 8px;
                min-height: 44px;
                border: 0;
                border-radius: var(--studio-radius-control);
                background: transparent;
                text-align: left;
                color: inherit;
                &:hover {
                    background: var(--multiform-active-form-button);
                }
                display: flex;
                flex-direction: row;
                gap: 8px;
                align-items: center;
                cursor: pointer;

                &.active {
                    width: 100%;
                    background: var(--multiform-active-form-button);
                }

                & > .step-desc {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;

                    & > .title {
                        font-weight: 400;
                        font-family: var(--studio-font, sans-serif);
                        font-size: 13px;
                        line-height: 17px;
                        color: var(--multiform-title-color);
                        white-space: normal;
                    }

                    & > .desc {
                        font-weight: 400;
                        font-size: 12px;
                        line-height: 130%;
                        color: var(--multiform-description-color);
                        white-space: normal;
                    }
                }
            }
        }

        & > .main {
            min-width: 0;
            flex: 1;
            padding: 20px;
            display: flex;
            flex-direction: column;

            & > .content {
                min-height: 0;
                flex: 1 1 0;
            }
        }
    }

    @media (max-width: 600px) {
        width: 90vw;

        .body {
            .main {
                width: 100%;
            }

            flex-direction: column;

            .steps {
                flex: 0 0 auto;
                min-height: 60px;
                overflow-x: auto;
                overflow-y: hidden;
                flex-direction: row;
                border-bottom: 1px solid var(--multiform-steps-background);

                & > .step {
                    flex: 0 0 auto;
                    width: auto;

                    .btn-icon {
                        min-width: 40px !important;
                        min-height: 40px !important;
                    }

                    .step-desc {
                        .desc {
                            display: none;
                        }
                    }
                }
            }
        }
    }
`;

const Header = styled.div``;
