import { useRouter } from "next/router";
import React, { useState, useEffect } from "react";
import styled, { css } from "styled-components";

import { getUserByWalletId } from "../utils/saveToDb";

const Creator = ({
    creator,
    showImage = false,
    type = "",
    url = "",
    style = {},
    onClick = null,
}) => {
    const router = useRouter();
    const [profile, setProfile] = useState(creator);

    useEffect(() => {
        (async () => {
            if (creator?.id) {
                // we search getUserByWalletId when theres an @
                const d = await getUserByWalletId("@" + creator.id);

                if (d.success) {
                    setProfile(d.user);
                }
            }
        })();
    }, []);

    const handleClick = (e) =>
        e.preventDefault() ||
        (profile?.id
            ? window.open(`/@${profile?.id}`, "_blank")
            : window.open(url, "_blank"));

    return (
        <Container
            isCreator={type === "Creator"}
            style={style}
            key={profile?.id}
            onClick={onClick || handleClick}
        >
            {showImage && (
                <img
                    className="avatar"
                    style={
                        type === "Creator"
                            ? { width: 40, height: 40 }
                            : { width: 25, height: 25 }
                    }
                    src={
                        profile?.avatar ||
                        profile?.user?.profile_img_url ||
                        "/images/opensea-black.png"
                    }
                />
            )}

            {type === "Creator" ? (
                <div>
                    <h3 style={{ margin: 0 }}>{type}</h3>
                    <p>
                        {" "}
                        @
                        {profile?.username ||
                            (profile?.id && profile.id?.slice(0, 8)) ||
                            "Loading…"}
                    </p>
                </div>
            ) : null}

            {type !== "Creator" ? (
                <div>
                    <p>
                        {" "}
                        @
                        {profile?.username ||
                            (profile?.id && profile.id?.slice(0, 8)) ||
                            "Loading…"}
                    </p>
                    <span>
                        {type ||
                            (profile?.id && profile?.id?.slice(0, 8) + "...") ||
                            "Loading…"}
                    </span>
                </div>
            ) : null}
        </Container>
    );
};

const Container = styled.div<{ isCreator: boolean }>`
    cursor: pointer;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    // margin: 8px 16px 8px 0;
    padding: 8px 0px;
    // background: rgba(255, 255, 255, 0.09);
    border-radius: 4px;
    transition: 0.3s;

    ${(props) =>
        props.isCreator &&
        css`
            background: transparent;
        `}

    &:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    & > div {
        margin-left: 6px;
        display: flex;
        flex-direction: column;
        align-items: start;
        justify-content: space-between;
        background: transparent;

        p,
        span {
            font-size: 12px;
            margin: 0px 0;
        }

        p {
            font-size: 13px;
            max-height: 20px;
            max-width: 12ch;
            overflow: hidden;
            text-align: left;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        span {
            font-size: 11px;
            opacity: 0.8;
        }
    }

    img {
        width: 25px;
        height: 25px;
        border-radius: 25px;
        object-fit: cover;
    }

    @media (max-width: 600px) {
        img {
            width: 25px;
            height: 25px;
        }
    }

    @media (max-width: 800px) {
        padding: 8px 4px;

        & > div {
            display: flex;
            flex-direction: column;
            align-items: start;
            justify-content: space-between;

            p {
                font-size: 12px;
                max-height: 16px;
            }

            span {
                font-size: 11px;
            }
        }
    }
`;

export default Creator;
