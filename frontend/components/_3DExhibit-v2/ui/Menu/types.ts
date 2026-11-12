import { WorldState } from "@components/_3DExhibit-v2/utils/constants";
import { Experience } from "@uitypes/experience";
import { RoomParameters } from "@uitypes/roomParameters";

export interface SceneMenuProps {
    controlsType: "vr" | "desktop" | "mobile" | "unknown";
    destination: RoomParameters;
    worldState: WorldState;
    isSceneBackground: boolean;
    exhibit: Experience;
    // isHub: boolean;
    hasBackPortal: boolean;
    isHub: boolean;
    isDisablePlay: boolean;
    isPlaying: boolean;
    play: () => void;
    enterVR: () => void;
    openBackPortal: () => void;
    isActive: boolean;
    setActive: () => void;
    isMobile: boolean;
    handleToggleMode: (mode: "multiplayer" | "solo") => Promise<boolean>;
    parentPage?: string;
    settings: any;
    joystickContainerRef: React.MutableRefObject<any>;
    isSceneLoaded: boolean;
    isExtaMenuVisible: boolean;
    isCSSInteracting: boolean;
    isInteractionVisible: boolean;
    isChatDisplayed: boolean;
    joystickMovingRef: React.MutableRefObject<any>;
    isInfoSectionVisible: boolean;
    showArtworkInfo: boolean;
    artwork: any;
    toggleInfoSection: React.Dispatch<React.SetStateAction<boolean>>;
}
