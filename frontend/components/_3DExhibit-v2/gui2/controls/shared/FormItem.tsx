import React from "react";
import styled from "styled-components";

//
export function FormItem({
    layout = "inline",
    label,
    children,
    style = {},
}: {
    layout?: "inline" | "stacked";
    label?: string;
    styles?: Record<string, React.CSSProperties>;
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    //

    const labelStyle = (style as any)?.label ?? {};

    return (
        <Container className={layout} style={style}>
            {label && (
                <label className="label" style={labelStyle}>
                    {label}
                </label>
            )}
            <div className="controller">{children}</div>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    user-select: none;

    & > .label {
        font-weight: 500;
        font-size: 12px;
        line-height: 24px;
        color: #a7a7a7;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        text-transform: capitalize;
        user-select: none;
    }

    & > .controller {
        @media (max-width: 600px) {
            width: 100%;
        }
    }

    &.inline {
        flex-direction: row;
        align-items: center;
        flex-wrap: nowrap;
        gap: 6px;

        & > .label {
            flex: 0 0 100px;
        }

        & > .controller {
            flex: 1;
        }
    }

    &.stacked {
        flex-direction: column;
        gap: 4px;
        align-items: flex-start;
        margin-bottom: 8px;

        & > .label {
            width: 100%;
        }

        & > .controller {
            width: 100%;
        }
    }
`;
