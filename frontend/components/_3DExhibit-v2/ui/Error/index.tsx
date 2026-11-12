import React, { useEffect, useId, useRef, useState } from "react";
import { RoundButton } from "@components/DesignSystem/buttons";
import Duplicate from "@ui/icons/Duplicate";
import { baseTokens as base } from "@styles/tokens/base";
import {
    DIALOG_COLOR_SCHEMES,
    DialogFooter,
    DialogMain,
    dialogSurface,
} from "@components/Dialogs/styles";
import InAppLink from "@components/InAppLink";
import styled from "styled-components";
import {
    DESTINATION_UNAVAILABLE_ERROR,
    WORLD_ERROR_COPY,
    WorldErrorDetails,
    WorldErrorKind,
} from "../../utils/constants";
import { formatWorldErrorDetails } from "../../utils/worldLoadError";

type Props = {
    worldState: {
        error?: string;
        kind?: WorldErrorKind;
        title?: string;
        details?: WorldErrorDetails;
    };
    /** Kept for existing callers; the screen is the same in both modes. */
    editMode?: boolean;
};

/** What a visitor sees when a space fails to load. It reads nothing from the
 * dashboard, so it renders the same for visitors and owners. */
export default function SpaceError({ worldState }: Props) {
    const copy = WORLD_ERROR_COPY[worldState?.kind] as
        | { title: string; message: string }
        | undefined;
    const { title, message } =
        worldState?.kind === "destination-unavailable"
            ? DESTINATION_UNAVAILABLE_ERROR
            : {
                  title:
                      worldState?.title ||
                      copy?.title ||
                      DESTINATION_UNAVAILABLE_ERROR.title,
                  message:
                      worldState?.error || copy?.message || "Please try again.",
              };

    return (
        <ErrorScreen role="alert">
            <Panel style={DIALOG_COLOR_SCHEMES.dark as React.CSSProperties}>
                <DialogMain>
                    <h1 className="title">{title}</h1>
                    <p className="content">{message}</p>
                </DialogMain>
                <DialogFooter>
                    <InAppLink href="/" legacyBehavior>
                        <RoundButton as="a" className="btn secondary">
                            Back to exploring
                        </RoundButton>
                    </InAppLink>
                    <RoundButton
                        className="btn primary"
                        onClick={() => window.location.reload()}
                    >
                        Try again
                    </RoundButton>
                </DialogFooter>
                {worldState?.details ? (
                    <ErrorDetails
                        text={formatWorldErrorDetails(worldState.details)}
                    />
                ) : null}
            </Panel>
        </ErrorScreen>
    );
}

const COPIED_MS = 2000;

/** The technical text, collapsed until asked for, with a copy button. */
function ErrorDetails({ text }: { text: string }) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState("");
    const textRef = useRef<HTMLPreElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>();
    const id = useId();
    useEffect(() => () => clearTimeout(timer.current), []);

    const say = (words: string) => {
        clearTimeout(timer.current);
        setStatus(words);
        timer.current = setTimeout(() => setStatus(""), COPIED_MS);
    };
    // Without a clipboard the text is selected, ready for the visitor to copy.
    const select = () => {
        const selection = window.getSelection?.();
        if (!textRef.current || !selection) return;
        const range = document.createRange();
        range.selectNodeContents(textRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
        say("Selected, ready to copy");
    };
    const copy = async () => {
        try {
            if (!navigator.clipboard?.writeText)
                throw new Error("No clipboard");
            await navigator.clipboard.writeText(text);
            say("Copied");
        } catch {
            select();
        }
    };

    return (
        <Details>
            <button
                type="button"
                className="toggle"
                aria-expanded={open}
                aria-controls={id}
                onClick={() => setOpen((value) => !value)}
            >
                {open ? "Hide details" : "Show details"}
            </button>
            {open ? (
                <div className="body" id={id}>
                    <pre ref={textRef}>{text}</pre>
                    <div className="actions">
                        <span role="status" aria-live="polite">
                            {status}
                        </span>
                        <button
                            type="button"
                            className="copy"
                            aria-label="Copy details"
                            title="Copy details"
                            onClick={copy}
                        >
                            <Duplicate
                                aria-hidden="true"
                                width="16"
                                height="16"
                                strokeColor="currentColor"
                            />
                        </button>
                    </div>
                </div>
            ) : null}
        </Details>
    );
}

const Details = styled.div`
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    font-family: ${base.font.sans};
    font-size: ${base.font.size.sm}px;
    color: var(--content-color);

    & button {
        font: inherit;
        color: inherit;
        background: none;
        border: 0;
        cursor: pointer;
    }
    & button:focus-visible {
        outline: ${base.focus.width}px solid var(--title-color);
        outline-offset: ${base.focus.offset}px;
    }
    & .toggle {
        padding: 4px 8px;
        text-decoration: underline;
        text-underline-offset: 3px;
    }
    & .toggle:hover {
        color: var(--title-color);
    }
    & .body {
        width: 100%;
        border: 1px solid var(--border-color);
        border-radius: ${base.radius.inset}px;
        background: var(--field-bg-color);
    }
    & pre {
        margin: 0;
        padding: 12px;
        max-height: 160px;
        overflow: auto;
        font-family: ${base.font.mono};
        font-size: ${base.font.size.xs}px;
        line-height: 1.5;
        text-align: left;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        user-select: text;
    }
    & .actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        padding: 4px;
        border-top: 1px solid var(--border-color);
    }
    & .copy {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: ${base.radius.inset}px;
        transition: background ${base.motion.fast}ms ${base.motion.ease};
    }
    & .copy:hover {
        background: var(--btn-secondary-hover-bg);
        color: var(--title-color);
    }
`;

const ErrorScreen = styled.div`
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: #000;
`;

const Panel = styled.div`
    width: 400px;
    max-width: 100%;
    max-height: 100%;
    overflow: auto;
    padding: 24px;
    ${dialogSurface}

    & .content {
        overflow-wrap: anywhere;
    }

    ${DialogFooter} {
        flex-wrap: wrap;
    }

    & .btn {
        white-space: nowrap;
        text-decoration: none;
    }
`;
