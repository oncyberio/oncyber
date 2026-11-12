import { UserContext } from "@components/context/UserContext";
import React, { useContext } from "react";
import styled from "styled-components";
import { usePanel } from "../../context/PanelProvider";
import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/constants";
import Avatar from "@ui/components/Avatar";
import { useEventCallback } from "@components/hooks/useEventCallback";

export default function Profile() {
    const { user, userData } = useContext(UserContext);
    const { exhibit, setCurrentTab } = usePanel();

    const toggle = useEventCallback((tab) => {
        setCurrentTab((state) => (state === tab ? "" : tab));
    }, []);

    return (
        <Container onClick={() => toggle("profile")}>
            <Avatar
                style={{
                    border: "none",
                    cursor: "pointer",
                    width: "40px",
                    height: "40px",
                    background: "transparent",
                }}
                size="medium"
                title={userData?.username || user.id}
                src={
                    userData?.avatar ||
                    exhibit?.params?.pfp?.avatar ||
                    DEFAULT_PLAYER_AVATAR_PICTURE
                }
            />
        </Container>
    );
}

const Container = styled.div`
    position: fixed;
    right: 17px;
    top: 24px;

    img {
        width: 40px;
        height: 40px;
        max-width: 40px;
        max-height: 40px;
        border-radius: 9999px;
    }

    @media (orientation: landscape) {
        left: 70px;
        top: 15px;
    }
`;
