import { UserContext } from "@components/context/UserContext";
import { Experience } from "@uitypes/experience";
import { useContext, useMemo } from "react";

export function useExhibitOwners(exhibit: Experience) {
    //
    const { exhibits } = useContext(UserContext);

    const allOwners = useMemo(() => {
        //
        const exhibitMeta = exhibits?.find?.(
            (_exhibit) => exhibit?.id === _exhibit?.id
        );

        const otherOwners =
            exhibitMeta?.otherOwners?.concat?.(exhibitMeta.owner) || [];

        const allOwners = otherOwners.concat(exhibit.editors);

        return allOwners.filter((c, index) => {
            return allOwners.indexOf(c) === index;
        });
    }, [exhibits, exhibit.id, exhibit.editors]);

    return allOwners;
}
