import { Listings } from "@components/modals/ArtworkInfo/D/components/Listings";
import { useNftBuyContext } from "@components/context/NftBuyContext";

export function Offers() {
    const { buyOrders } = useNftBuyContext();

    return <Listings listings={buyOrders} />;
}
