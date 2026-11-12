import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/constants";
import { getUser } from "@utils/saveToDb";
import React, { useEffect, useState } from "react";
import styled from "styled-components";

const formatter = Intl.NumberFormat("en", { notation: "compact" });

function Avatar({ userId }) {
    const [avatar, setAvatar] = useState("");

    useEffect(() => {
        async function getUserInof() {
            const data = await getUser(userId);
            if (data.success) {
                setAvatar(data?.avatar);
            }
        }
        getUserInof();
    }, [userId]);

    return (
        <img
            src={avatar || "/images/opensea-black.png"}
            onError={(event: any) => {
                event.target.src = DEFAULT_PLAYER_AVATAR_PICTURE;
                event.onerror = null;
            }}
        />
    );
}

const MAX_AVATAR = 3;

export default function SubscribedUsers({ users = [], count = users.length }) {
    return (
        <Container>
            <div className="avatars">
                {users.slice(0, MAX_AVATAR).map((item) => (
                    <Avatar key={item.userId} userId={item?.userId} />
                ))}
            </div>
            <span className="count">+{formatter.format(count)}</span>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    align-items: center;
    max-width: 124px;
    height: 40px;
    padding: 8px;
    gap: 4px;
    border-radius: 900px;
    border: 1px solid #e0e0e0;
    justify-content: flex-start;

    & > .avatars {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;

        & > img {
            width: 24px;
            height: 24px;
            border-radius: 9999px;

            &:nth-child(2) {
                margin-left: -5px;
                z-index: 2;
            }

            &:nth-child(3) {
                margin-left: -5px;
                z-index: 3;
            }
        }
    }

    & > span.count {
        width: 100%;
        color: #5c5c5c;
        font-family: Aeonik;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: 24px;
    }
`;
