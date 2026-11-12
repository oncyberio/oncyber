import React from "react";
import styled from "styled-components";
import InlineError from "@ui/components/InlineError";
import { baseTokens as base } from "@styles/tokens";

/**
 * Shown by `UserProvider` when the session for the current page could not be
 * loaded. The pages that wait for it render nothing until it is ready, so
 * without this the visitor is left with a blank page and no way forward.
 *
 * It floats at the top of the window and takes clicks only on itself, so a
 * page that did render keeps working underneath it.
 */
export default function SessionLoadError({ onRetry }: { onRetry: () => void }) {
    return (
        <Notice>
            <InlineError
                message="Couldn’t open this world."
                onRetry={onRetry}
            />
        </Notice>
    );
}

// Its own dark panel: the page behind it may be blank and of any colour.
const Notice = styled.div`
    position: fixed;
    top: 16px;
    left: 50%;
    z-index: 1000;
    box-sizing: border-box;
    width: max-content;
    max-width: calc(100vw - 32px);
    transform: translateX(-50%);
    border-radius: ${base.radius.control}px;
    background: ${base.color.paperInk};
    font-family: ${base.font.sans};
`;
