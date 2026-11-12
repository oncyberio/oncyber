import Users from "@ui/icons/Users";

import { noop } from "@utils/js";

import { getEditorsProfile } from "@utils/saveToDb";

import { forwardRef, useEffect, useState } from "react";

import styled from "styled-components";

import Avatar, { SIZES } from ".";

import { CircularButton } from "../CircularButton";

import AccountsAPI from "@api/accounts/_api";

interface AvatarsProps {
    avatars: Array<string>;
    size: "large" | "medium" | "small" | "smallplus";
    overflowAt?: number;
    className?: string;
    addCta?: boolean;
    onClick?: () => void;
    ref: any;
}

const AvatarMulti = forwardRef(({ avatars, size, overflowAt, className = "", addCta = false, onClick = noop }: AvatarsProps, ref) => {
    const width = SIZES[size] - 2;

    const [editors, setEditors] = useState({});

    useEffect(() => {
        // This should be sent to the backend which then will return the list of editors
        (async () => {
            const data = await AccountsAPI.getUsers({
                type: "users",
                walletIds: avatars,
            });

            if (data.success) {
                setEditors(data.editors);
            }
        })();
    }, [avatars]);

    if (avatars.length < 1) return null;

    return (
        <Container ref={ref} size={size} className={className}>
            {avatars.slice(0, overflowAt).map((walletId, index) => {
                const { username, avatar, banner, currentExhibitId } = editors[walletId] || {};

                return <Avatar key={index} style={index === 0 ? {} : { marginLeft: `-${SIZES[size] / 2.4}px` }} src={avatar || "/images/opensea-black.png"} title={username} size={size} onerror={(e) => e.target.setAttribute("src", "/images/opensea-black.png")} />;
            })}
            {overflowAt > 0 && avatars.length > overflowAt ? (
                <Wrapper
                    style={{
                        marginLeft: `-${SIZES[size] / 2.4}px`,
                        width: width,
                        height: width,
                    }}
                    size={size}
                >
                    +{avatars.length - overflowAt}
                </Wrapper>
            ) : null}
        </Container>
    );
});

AvatarMulti.defaultProps = {
    avatars: [],
    size: "medium",
    overflowAt: 2,
};

const Container = styled.div<Partial<AvatarsProps>>`
    display: flex;
    cursor: pointer;
    align-items: center;
`;

const Wrapper = styled.div<Partial<AvatarsProps>>`
    background: #f5f5f5;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
    border-radius: 50%;
    overflow: hidden;
    font-size: 12px;
    color: #cccccc;

    cursor: pointer;

    //styleName: Text lg/Medium;
    font-weight: 400;
    line-height: 26px;
    letter-spacing: 0em;
    text-align: center;
    border: 1px solid #fff;

    ${({ size }) => {
        if (size === "large") {
            return `
                font-size: 16px;

            `;
        }

        if (size === "medium") {
            return `
            font-size: 14px;

            `;
        }

        if (size === "small") {
            return `
            font-size: 11px;

            `;
        }
    }}
`;

export default AvatarMulti;
