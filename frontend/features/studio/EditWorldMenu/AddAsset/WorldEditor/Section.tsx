import IconImg from "@ui/components/IconImg";
import { classes } from "@utils/js";
import React, { useState } from "react";
import styled from "styled-components";

export function Section({
    title,
    children,
    className = "",
    style = {},
    collapsible = true,
}: {
    title: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
    collapsible?: boolean;
}) {
    //
    const [collapsed, setCollapsed] = useState(false);

    return (
        <Container className={className} style={style}>
            <div
                className="section-title"
                onClick={() => {
                    if (!collapsible) return;

                    setCollapsed(!collapsed);
                }}
            >
                {collapsible && (
                    <>
                        <IconImg
                            name="chevron-down"
                            size={14}
                            className={classes({ icon: true, hide: collapsed })}
                        />
                        <IconImg
                            name="chevron-right"
                            size={14}
                            className={classes({
                                icon: true,
                                hide: !collapsed,
                            })}
                        />
                    </>
                )}
                <label className="label">{title}</label>
            </div>
            {collapsed ? null : children}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 12px;

    & > .section-title {
        display: flex;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
        color: #ffffff;
        opacity: 0.5;
        cursor: pointer;

        & > .hide {
            display: none;
        }

        & > .icon {
            filter: invert(1);
            cursor: pointer;
        }

        & > .label {
            cursor: pointer;
        }
    }
`;
