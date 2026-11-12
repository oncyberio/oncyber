import { useNftBuyContext } from "@components/context/NftBuyContext";
import { PriceHistory as PriceHistory_ } from "@components/modals/ArtworkInfo/C/components/PriceHistory";

export function PriceHistory() {
    //
    const { priceData } = useNftBuyContext();

    return <PriceHistory_ priceData={priceData} />;
}
