import styled from "styled-components";

import { useContext } from "react";

import { AssetsContext } from "@context/AssetsContext";

import type { Portal } from "@components/_3DExhibit-v2/three/factory/portal/portal";

import { UserContext } from "@components/context/UserContext";

import { selectUserId } from "@utils/assets";

import Basic from "./Basic";

import Elevator from "./Elevator";
import { useSelectedPortal } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { useWalletContext } from "@features/studio/EditWorldMenu/context/WalletContext";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";

export function EditPortal() {
    //
    const portal = useSelectedPortal();

    const { exhibit } = useEditWorld();

    let { currentWalletId: currentWallet } = useWalletContext();

    currentWallet = selectUserId(currentWallet);

    const isStatic = exhibit.portals?.[portal.userData.id]?.static;

    if (isStatic) {
        return (
            <Container
                style={{
                    padding: 24,
                    fontWeight: "bold",
                }}
            >
                This portal can't be edited.
            </Container>
        );
    }

    return (
        <Content>
            <Basic />
        </Content>
    );
}

const Container = styled.div``;

const Content = styled.div`
    display: grid;
    grid-template-columns: 1fr;
    grid-row-gap: 16px;
`;
