import { useMemo } from "react";
import { useRooms } from "@features/spaces/create/components/DestinationSelector/useRooms";
import { EMPTY_ROOM, GALAXY_ROOM } from "@utils/emptyRoom";

//
export function useUserKits() {
    //
    const {
        ownedRooms,
        rooms,
        loadingError,
        isCheckingBalances,
        isLoadingRooms,
        loadPromise,
        refetchRooms: revalidate,
    } = useRooms();

    const isLoading = isLoadingRooms;

    const error = loadingError;

    const kits = useMemo(() => {
        //

        if (rooms == null) return [];

        let res = rooms.filter((it) => {
            //
            return (
                it.params.isFuture &&
                (it.tag.includes("uploaded") ||
                    ownedRooms[it.slug] ||
                    it.tag.includes("free"))
            );
        });

        // Sort to show free first
        res = res.sort((roomA, roomB) => {
            const isRoomAFree = roomA.tag.includes("free");
            const isRoomBFree = roomB.tag.includes("free");
            if (isRoomAFree === isRoomBFree) return 0;
            if (isRoomAFree) return -1;
            return 1;
        });

        // res.push(GALAXY_ROOM);

        return res;

        //
    }, [rooms]);

    return {
        kits,
        isLoading,
        isCheckingBalances,
        error,
        loadPromise,
        revalidate,
    };
}
