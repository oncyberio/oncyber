import styled from "styled-components";
import IconImg from "@ui/components/IconImg";

export interface TextMenuCaptionProps {
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
    showIcon?: boolean;
    onClick?: () => unknown;
}

export function TextMenuCaption({
    children,
    className = "",
    showIcon = true,
    style = {},
    onClick = null,
}: TextMenuCaptionProps) {
    //
    return (
        <Caption onClick={onClick}>
            <div className={`desc ${className}`} style={style}>
                {" "}
                {children}
            </div>
            {showIcon && (
                <IconImg className="expand" name="chevron-down" size={16} />
            )}
        </Caption>
    );
}

const Caption = styled.button.attrs({ type: "button" })`
    padding: 0;
    min-width: 0;
    min-height: 38px;
    border-radius: 8px;
    &:focus-visible {
        outline: 2px solid var(--studio-ink);
        outline-offset: 3px;
    }
    border: 0;
    background: transparent;
    text-align: left;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    cursor: pointer;

    & > .desc {
        font-weight: 400;
        font-family: var(--studio-font, sans-serif);
        font-size: 13px;
        line-height: 24px;
        color: var(--studio-ink, #f2f2f3);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 230px;

        & .secondary {
            color: #999999;
        }
    }

    & > .expand {
        filter: invert(1);
        opacity: 0.5;
    }
`;
