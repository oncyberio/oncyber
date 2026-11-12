import { Experience } from "@uitypes/experience";

export type GatingData = Experience["gating"];

export type GatingType = keyof GatingData;

export interface GatingUIProps {
    initState: GatingData;
    onClose?: () => void;
}

export type CurrentForm =
    | "GatingSettings"
    | "GatingRoomCapacity"
    | "GatingWhitelist"
    | "GatingDate"
    | "GatingNfts"
    | "GatingPassword";
