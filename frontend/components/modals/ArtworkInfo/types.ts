import { Asset } from "@uitypes/Asset";
import { Experience } from "@uitypes/experience";

export interface ArtworkInfoProps {
    toggle: (b?: boolean) => void;
    isShowing: boolean;
    isTransition?: boolean;
    artwork: Asset;
    exhibit?: Experience;
    mintable?: boolean;
    handleTeleport?: () => void;
    type?: "3d" | "full";
    canStartFetch?: boolean;
    isMobile?: boolean;
    isAnimateArtworkInfoBulle?: boolean;
    setIsAnimateArtworkInfoBulle?: React.Dispatch<
        React.SetStateAction<boolean>
    >;
}
