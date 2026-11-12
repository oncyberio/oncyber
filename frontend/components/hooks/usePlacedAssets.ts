import { useMemo } from "react";
import { Experience } from "@uitypes/experience";

//
export function usePlacedAssets(exhibit: Experience) {
    //
    return useMemo(() => {
        //
        return Object.values(exhibit.artworks || {}).reduce((acc, current) => {
            //
            const key = `${current.data.token_address || ""}/${
                current.data.token_id
            }`;

            acc[key] = true;

            return acc;
            //
        }, {});
        //
    }, [exhibit.artworks]);
}
