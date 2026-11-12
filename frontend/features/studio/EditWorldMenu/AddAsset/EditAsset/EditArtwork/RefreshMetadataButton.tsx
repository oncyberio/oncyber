import { useState } from "react";
import styled from "styled-components";

import Refresh from "@ui/icons/Refresh";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import IconImg from "@ui/components/IconImg";
import Spinner from "@ui/components/Spinner";

//
export function RefreshMetadataButton() {
    //
    const { handleRefreshArtwork } = useEditWorld();

    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefreshClick = useEventCallback(async () => {
        //
        if (isRefreshing) return;

        try {
            setIsRefreshing(true);

            await handleRefreshArtwork({});
        } finally {
            //
            setIsRefreshing(false);
        }
    }, []);

    return (
        <Box title="Refresh metadata" onClick={handleRefreshClick}>
            {isRefreshing ? (
                <Spinner width={16} />
            ) : (
                <IconImg className="refresh" name="refresh-cw" size={16} />
            )}
        </Box>
    );
}

const Box = styled.div`
    cursor: pointer;

    font-weight: 500;
    font-size: 15px;

    color: #5d5f65;

    & > .refresh {
        filter: invert(0.5);
    }
`;
