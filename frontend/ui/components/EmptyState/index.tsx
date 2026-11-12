import React, { CSSProperties, ReactNode } from "react";
import styled from "styled-components";
import { ActionButton, ActionVariant } from "@styles/brand";
import { baseTokens as base, landingTokens as landing } from "@styles/tokens";
import {
    EmptyStateIcon,
    EmptyStateIconName,
    isEmptyStateIconName,
} from "./icons";

export type { EmptyStateIconName } from "./icons";

export interface EmptyStateAction {
    label: ReactNode;
    onClick: () => void;
    /**
     * Blue only to sign in or publish; white for the one obvious next step;
     * the outline otherwise (the default).
     */
    variant?: ActionVariant;
    /** A small glyph after the label, such as an arrow. */
    icon?: ReactNode;
    disabled?: boolean;
}

export interface EmptyStateProps {
    /** A glyph name from `./icons`, or your own small icon. */
    icon?: EmptyStateIconName | ReactNode;
    /** The one plain line: what is missing. "No activity yet." */
    title: ReactNode;
    /** An optional short second line: why, or what to do. */
    detail?: ReactNode;
    /** At most one action, and only when there is something to do. */
    action?: EmptyStateAction;
    /** `light` for the legacy light panels; everything else is dark. */
    surface?: "dark" | "light";
    /** `page` fills the area it is in; `inline` sits inside a panel. */
    size?: "page" | "inline";
    /** The title's element: a heading where the empty state is the page. */
    titleAs?: "h1" | "h2" | "h3" | "p";
    /** `alert` when the list is empty because loading it failed. */
    role?: "status" | "alert";
    className?: string;
    style?: CSSProperties;
    /** Rare: a control that belongs beside the action. Prefer one action. */
    children?: ReactNode;
}

/** The surface for a panel that follows the styled-components theme. */
export const surfaceOfTheme = (theme?: { type?: string }) =>
    theme?.type === "light" ? "light" : "dark";

/**
 * What a list or page shows when it has nothing in it: a small icon, one
 * plain line, an optional second line and at most one action. Never an
 * emoji. See docs/brand/README.md, "Empty states".
 */
export default function EmptyState({
    icon,
    title,
    detail,
    action,
    surface = "dark",
    size = "inline",
    titleAs = "p",
    role = "status",
    className,
    style,
    children,
}: EmptyStateProps) {
    const glyph = isEmptyStateIconName(icon) ? (
        <EmptyStateIcon name={icon} size={size === "page" ? 24 : 20} />
    ) : (
        icon
    );
    return (
        <Root
            role={role}
            data-surface={surface}
            data-size={size}
            className={className}
            style={style}
        >
            {glyph && <span className="empty-state-icon">{glyph}</span>}
            <Title as={titleAs} className="empty-state-title">
                {title}
            </Title>
            {detail && <p className="empty-state-detail">{detail}</p>}
            {(action || children) && (
                <div className="empty-state-actions">
                    {action && (
                        <ActionButton
                            $variant={action.variant || "outline"}
                            data-variant={action.variant || "outline"}
                            onClick={action.onClick}
                            disabled={action.disabled}
                        >
                            {action.label}
                            {action.icon}
                        </ActionButton>
                    )}
                    {children}
                </div>
            )}
        </Root>
    );
}

const Title = styled.p``;

const Root = styled.div`
    --empty-state-ink: ${base.color.ink};
    --empty-state-detail: #85857d;
    --empty-state-icon: #b5b5a5;
    box-sizing: border-box;
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-width: 0;
    padding: 24px 16px;
    color: var(--empty-state-ink);
    text-align: center;

    &[data-surface="light"] {
        --empty-state-ink: ${landing.color.paperInk};
        --empty-state-detail: ${landing.color.paperMuted};
        --empty-state-icon: ${landing.color.paperMuted};
    }

    .empty-state-icon {
        display: inline-flex;
        margin-bottom: 12px;
        color: var(--empty-state-icon);
    }
    .empty-state-title {
        margin: 0;
        color: inherit;
        font-family: inherit;
        font-size: ${base.font.size.body}px;
        font-weight: ${base.font.weight.regular};
        line-height: 1.4;
        overflow-wrap: anywhere;
    }
    .empty-state-detail {
        margin: 6px 0 0;
        color: var(--empty-state-detail);
        font-size: ${base.font.size.sm}px;
        line-height: 1.6;
        overflow-wrap: anywhere;
    }
    .empty-state-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
        margin-top: 16px;
    }

    /* The empty page: the My destinations and landing pattern. */
    &[data-size="page"] {
        padding: 40px 24px;
        .empty-state-icon {
            margin-bottom: 24px;
        }
        .empty-state-title {
            font-size: 18px;
            letter-spacing: -0.04em;
        }
        .empty-state-detail {
            margin-top: 10px;
            font-size: ${base.font.size.xs}px;
        }
        .empty-state-actions {
            margin-top: 24px;
        }
    }

    /*
     * White and outline are drawn for dark surfaces. A light panel keeps
     * the same shape with a black solid and a dark outline (brand guide,
     * "Action buttons").
     */
    &[data-surface="light"] [data-variant="white"] {
        color: ${landing.color.paper};
        background: ${landing.color.paperInk};
        border-color: ${landing.color.paperInk};
        &:hover:not(:disabled),
        &:active:not(:disabled) {
            color: ${landing.color.paper};
            background: ${base.color.black};
            border-color: ${base.color.black};
        }
    }
    &[data-surface="light"] [data-variant="outline"] {
        color: ${landing.color.paperInk};
        border-color: ${landing.color.paperMuted};
        &:hover:not(:disabled),
        &:active:not(:disabled) {
            color: ${landing.color.paperInk};
            background: transparent;
            border-color: ${landing.color.paperInk};
        }
    }
`;
