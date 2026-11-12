import React, { CSSProperties, ReactNode } from "react";
import styled from "styled-components";
import { outlineAction } from "@styles/brand";
import {
    actionTokens as action,
    baseTokens as base,
    landingTokens as landing,
} from "@styles/tokens";

export interface InlineErrorProps {
    /** What failed, as one short sentence. Nothing renders without it. */
    message?: ReactNode;
    /** Runs the failed action again. Leave out when retrying cannot help. */
    onRetry?: () => void;
    retryLabel?: string;
    /** `light` only for the legacy light panels; everything else is dark. */
    surface?: "dark" | "light";
    className?: string;
    style?: CSSProperties;
}

/**
 * A failure shown beside the control that caused it. See docs/feedback.md
 * for when to use this, a dialog or a toast.
 */
export default function InlineError({
    message,
    onRetry,
    retryLabel = "Retry",
    surface = "dark",
    className,
    style,
}: InlineErrorProps) {
    if (!message) return null;
    return (
        <Row
            role="alert"
            data-surface={surface}
            className={className}
            style={style}
        >
            <span className="inline-error-message">{message}</span>
            {onRetry && (
                <button type="button" onClick={onRetry}>
                    {retryLabel}
                </button>
            )}
        </Row>
    );
}

// The action is the shared outline button (`outlineAction`), kept compact
// so it fits inside the row.
const Row = styled.div`
    --inline-error-ink: ${base.color.ink};
    --inline-error-line: ${base.color.line.default};
    --inline-error-action-line: ${action.outline.border};
    --inline-error-action-hover: ${action.outline.hoverBorder};
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: ${landing.action.gap}px;
    min-width: 0;
    padding: 8px 8px 8px 12px;
    border: 1px solid var(--inline-error-line);
    border-radius: ${base.radius.control}px;
    color: var(--inline-error-ink);
    font-size: ${base.font.size.md}px;
    font-weight: ${base.font.weight.regular};
    line-height: 1.35;
    text-align: left;

    &[data-surface="light"] {
        --inline-error-ink: ${landing.color.paperInk};
        --inline-error-line: ${landing.color.paperMuted};
        --inline-error-action-line: ${landing.color.paperMuted};
        --inline-error-action-hover: ${landing.color.paperInk};
    }

    .inline-error-message {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
    }

    button {
        ${outlineAction}
        flex: none;
        box-sizing: border-box;
        min-height: 28px;
        margin: 0;
        padding: 0 12px;
        border: 1px solid var(--inline-error-action-line);
        border-radius: ${base.radius.inset}px;
        color: var(--inline-error-ink);
        font: ${action.type.font} var(--oc-font, ${action.type.family});
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        color: var(--inline-error-ink);
        border-color: var(--inline-error-action-hover);
    }
    &[data-surface="light"] button:hover:not(:disabled),
    &[data-surface="light"] button:active:not(:disabled) {
        background: #20201e0f;
    }
`;
