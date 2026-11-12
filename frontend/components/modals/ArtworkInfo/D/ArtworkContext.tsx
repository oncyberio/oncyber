import React, { useContext, useMemo } from "react";

import { UserContext } from "@context/UserContext";

import { ArtworkInfoProps } from "../types";
import {
    NftBuyPrvider,
    useNftBuyContext,
} from "@components/context/NftBuyContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { logEvent } from "@utils/saveToDb";

interface ArtworkContextState extends ArtworkInfoProps {}

export const ArtworkContext = React.createContext<ArtworkContextState>(null);

export const ArtworkInfoProvider: React.FC<ArtworkInfoProps> = ({
    children,
    ...props
}) => {
    return (
        <NftBuyPrvider nft={props.artwork}>
            <ArtworkContext.Provider value={props}>
                {children}
            </ArtworkContext.Provider>
        </NftBuyPrvider>
    );
};

export function useArtworkInfo() {
    //
    const { user } = useContext(UserContext);

    const buyProps = useNftBuyContext();

    const artworkProps = useContext(ArtworkContext);

    const props = useMemo(() => {
        //
        const asset = buyProps.asset;
        const { exhibit, artwork } = artworkProps;

        if (
            artwork?.collection &&
            typeof artwork?.collection?.name !== "string"
        ) {
            artwork.collection.name = artwork?.token_id || "Unknown";
        }

        const isRedirect =
            asset?.contract_address ==
            "0xc5f9b9845a7b04bdbc66d3f52128c4634054b23c";

        const isExternal = (url) => {
            // return name of the platform
            return url &&
                (url.includes("foundation") ||
                    url.includes("rarible") ||
                    url.includes("bitski") ||
                    url.includes("superrare") ||
                    url.includes("hic") ||
                    url.includes("niftygateway"))
                ? url.split("://")[1].split(".")[0]
                : false;
        };

        const toExternallink = () => {
            amplitude_logAnalyticsEvent("click_opensea_redirect", {
                exhibitId: exhibit?.id,
                token_id: asset?.token_id,
                user_id: user?.id,
                contract_address: asset?.contract_address,
            });

            logEvent("click_opensea", {
                exhibitId: exhibit?.id,
                ownerId: exhibit?.editors[0],
                userId: exhibit?.editors[0],
                artworkTokenId: asset?.token_id,
                artworkContractAddress: asset?.contract_address,
            });

            let link = asset?.openSeaLink;

            if (isExternal(asset?.external_link)) {
                link = asset?.external_link;

                if (artwork?.addedBy?.split?.("@")[0] == "daviddrebin")
                    link = `https://niftygateway.com/collections/daviddrebin`;
                else if (link.includes("niftygateway"))
                    link = `https://niftygateway.com/itemdetail/secondary/${asset?.contract_address}/${asset?.token_id}`;
            }

            window.open(
                link?.replace?.("hicetnunc.xyz", "hicetnunc.art"),
                "_blank"
            );
        };

        return {
            ...artworkProps,
            ...buyProps,
            isRedirect,
            isExternal,
            toExternallink,
        };
    }, [buyProps, artworkProps]);

    return props;
}
