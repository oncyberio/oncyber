import styled from "styled-components";
import RadioBox from "@ui/components/RadioBox";
import { useState } from "react";

import { ArtworkPlacement } from "../../../shared/ArtworkPlacement";
import { useSelectedPortal } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { Label } from "@features/studio/styles/Label";
import { ArtworkCoordinates } from "../../EditArtwork/ArtworkCoordinates";

type SaveState = "idle" | "Disconnecting" | "Changing-Shape";

export default function PortalController() {
    //
    const { handleDeleteSelection, selectedMesh } = useEditWorld();

    const portal = useSelectedPortal();

    const [saveState, setSaveState] = useState<SaveState>("idle");

    const spawn = portal.spawn;

    const handleDisconnectPortal = useEventCallback(async () => {
        //
        setSaveState("Disconnecting");

        await handleDeleteSelection({
            source: "edit-ui",
        });

        setSaveState("idle");
    }, []);

    return (
        <Container>
            {spawn && <ArtworkCoordinates />}

            {saveState === "Disconnecting" ? (
                <Label>Disconnecting portal</Label>
            ) : (
                <Command onClick={handleDisconnectPortal}>
                    <img src="/v2/icons/portal-disconnect.svg" />
                    Disconnect Portal
                </Command>
            )}
        </Container>
    );
}

export const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

export const Command = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    line-height: 24px;

    & > img {
        width: 18px;
        height: 18px;
        margin-right: 0.5rem;
        filter: invert(1);
    }
`;
