import { useContext } from "react";
import { WorldContext } from "../context/WorldProvider";

export function useWorld() {
    //
    const { ref } = useContext(WorldContext);

    return ref;
}
