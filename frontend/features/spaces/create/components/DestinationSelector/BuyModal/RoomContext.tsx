import { Destination } from "@uitypes/destinations";
import { RoomParameters } from "@uitypes/roomParameters";
import React, { useContext } from "react";

const RoomContext = React.createContext<Destination>(null);

export const RoomProvider: React.FC<{ room: Destination }> = ({
    room,
    children,
}) => {
    return <RoomContext.Provider value={room}>{children}</RoomContext.Provider>;
};

export function useCurrentRoom() {
    return useContext(RoomContext);
}
