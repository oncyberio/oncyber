import React from "react";
import styled from "styled-components";
import Icon from "../landing-carousel/components/Icon";
import { experienceControl } from "@features/content-host/experienceChrome";
import ConnectionStatus from "@ui/components/ConnectionStatus";

type Props = {
    title: string;
    presence: string;
    onBack: () => void;
    backLabel?: string;
    /** Makes the title a button (opens the lobby info sidebar). */
    onTitleClick?: () => void;
    titleExpanded?: boolean;
};

/** Native place navigation, shared by the lobby and game visit shells. */
export default function LobbyPlace({
    title,
    presence,
    onBack,
    backLabel = "Back to lobby",
    onTitleClick,
    titleExpanded,
}: Props) {
    return (
        <Place className="lobby-place">
            <button
                className="back-button"
                onClick={onBack}
                aria-label={backLabel}
            >
                <Icon name="back" size={17} />
            </button>
            <span>
                {onTitleClick ? (
                    <button
                        type="button"
                        className="place-title"
                        aria-haspopup="dialog"
                        aria-expanded={!!titleExpanded}
                        aria-label={`${title}, info`}
                        onClick={onTitleClick}
                    >
                        {title}
                        <svg
                            className="place-info"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4M12 8h.01" />
                        </svg>
                    </button>
                ) : (
                    title
                )}
                {/* Shared with spaces and embedded worlds: same line, same words. */}
                <ConnectionStatus label={presence} />
            </span>
        </Place>
    );
}

const Place = styled.div`
    & {
        position: absolute;
        z-index: 5;
        left: 24px;
        top: 24px;
        display: flex;
        align-items: center;
        gap: 12px;
        color: #e8e9ec;
        pointer-events: auto;
    }
    .back-button {
        ${experienceControl}
    }
    .back-button:hover {
        background: #22252de6;
    }
    .back-button:focus-visible {
        outline: 2px solid #e8e9ec;
        outline-offset: 3px;
    }
    .place-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: -2px -6px;
        padding: 2px 6px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .place-title:hover {
        background: #ffffff14;
    }
    .place-info {
        flex: 0 0 auto;
        opacity: 0.6;
        transition: opacity 0.15s;
    }
    .place-title:hover .place-info,
    .place-title:focus-visible .place-info {
        opacity: 1;
    }
    .place-title:focus-visible {
        outline: 2px solid #e8e9ec;
        outline-offset: 1px;
    }
    @media (max-width: 550px) {
        left: 16px;
        top: 24px;
        gap: 9px;
        > span {
            font-size: 12px;
        }
        .back-button {
            width: 40px;
            height: 40px;
        }
    }
`;
