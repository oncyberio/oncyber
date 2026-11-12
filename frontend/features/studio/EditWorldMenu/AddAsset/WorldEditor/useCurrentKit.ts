import { useStylekit } from "@components/hooks/useStylekit";
import { useEditWorld } from "../../context/WorldEditContext";
import { EMPTY_ROOM } from "@utils/emptyRoom";

export function useCurrentKit() {
    //
    const { exhibit } = useEditWorld();

    const kit =
        exhibit.info.room !== EMPTY_ROOM.slug ? exhibit.info.room : null;

    const stylekitData = useStylekit(kit);

    return stylekitData.data;
}
