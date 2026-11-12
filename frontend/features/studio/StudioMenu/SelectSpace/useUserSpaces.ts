import { UserContext } from "@components/context/UserContext";
import { fetchUserExhibits } from "@features/studio/utils";
import { Experience } from "@uitypes/experience";
import { getUserExhibits } from "@utils/saveToDb";
import { useContext, useMemo } from "react";
import useSWR from "swr";
import { SpaceTab } from "./utils";

const swrOptions = {
    revalidateOnFocus: false,
    refreshInterval: 0,
};

const timestamps = new WeakMap<any, number>();

export function useUserSpaces(activeTab: SpaceTab, currentSpaceId: string) {
    //
    const { token } = useContext(UserContext);

    const exhibitsQuery = useSWR<Experience[]>(
        `/user-exhibits/${token}`,
        () => fetchUserExhibits(token),
        swrOptions
    );

    const ownedSpaces = useMemo(() => {
        //
        if (!exhibitsQuery.data) return;

        return exhibitsQuery.data.filter((it) => {
            return !it.invited;
        });
        //
    }, [exhibitsQuery]);

    const collabSpaces = useMemo(() => {
        //
        if (!exhibitsQuery.data) return;

        return exhibitsQuery.data.filter((it) => {
            return it.invited;
        });

        //
    }, [exhibitsQuery]);

    const shownSpaces = useMemo(() => {
        //
        if (!exhibitsQuery.data) return;

        exhibitsQuery.data.forEach((e) => {
            //
            const t = e.createdAt ? new Date(e.createdAt).getTime() : 0;

            timestamps.set(e, t);
        });

        const currentSpaces =
            activeTab === "collab" ? collabSpaces : ownedSpaces;

        return currentSpaces.sort((a, b) => {
            //
            let v1 = timestamps.get(a);
            let v2 = timestamps.get(b);

            if (a.id === currentSpaceId) {
                v1 = Infinity;
            } else if (!a.info?.headline) {
                v1 /= 1_000;
            }

            if (b.id === currentSpaceId) {
                v2 = Infinity;
            } else if (!b.info?.headline) {
                v2 /= 1_000;
            }

            return v2 - v1;
        });
    }, [collabSpaces, ownedSpaces, activeTab, currentSpaceId]);

    return {
        ownedSpaces,
        collabSpaces,
        shownSpaces,
        isLoading: !exhibitsQuery.data,
        queryData: exhibitsQuery.data,
        error: exhibitsQuery.error,
        mutate: exhibitsQuery.mutate,
    };
}
