import { TYPES } from "@3artwork/constants";

import styled from "styled-components";
import { useSyncState } from "@components/hooks/useSyncState";

import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { noop } from "lodash";
import { Toggle } from "../../../shared/Toggle";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useEventCallback } from "@components/hooks/useEventCallback";

export default function ArtworkCollider() {
    //
    const { handleChangeCollider } = useEditWorld();

    const artwork = useSelectedArtwork();

    const [isCollider, setIsCollider] = useSyncState(
        artwork.userData.isCollider || false
    );

    const handleSaveCollider = useEventCallback(
        async (isCollider, _selectedMesh = null) => {
            //
            setIsCollider(isCollider);

            handleChangeCollider({ isCollider });
        },
        []
    );

    return (
        <Container>
            <p className="component-label">Set collider</p>
            <Toggle value={isCollider} onChange={handleSaveCollider} />
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    & > p {
        white-space: nowrap;
        margin: 0;
        font-weight: 500;
        font-size: 14px;
        line-height: 24px;
        color: #777980;
    }
`;
