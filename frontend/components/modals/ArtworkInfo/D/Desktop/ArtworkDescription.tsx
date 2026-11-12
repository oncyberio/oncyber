import { ArtworkSummary } from "../../ArtworkSummary";
import { useArtworkInfo } from "../ArtworkContext";

export function ArtworkDescription() {
    const { asset } = useArtworkInfo();
    return <ArtworkSummary asset={asset} />;
}
