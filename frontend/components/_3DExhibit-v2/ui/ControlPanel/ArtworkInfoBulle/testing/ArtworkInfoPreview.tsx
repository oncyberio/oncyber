import { useState } from "react";
import { useRouter } from "next/router";
import { ArtworkInfoDesktop } from "@components/modals/ArtworkInfo/D/Desktop";
import { ArtworkContext } from "@components/modals/ArtworkInfo/D/ArtworkContext";
import { NftBuyContext } from "@components/context/NftBuyContext";
import { WorldContext } from "@components/_3DExhibit-v2/context/WorldProvider";
import BasicArtworkInfoBulle from "../Basic";
import HelperArtworkInfoBulle from "../Helper";

const background = "/landing-build/gallery-previews/wolfgang-n2-gpt.webp";
const image = "/landing-build/gallery-previews/white-cube-gpt.webp";

const artwork = {
    id: "preview-artwork",
    name: "Study in light · sample artwork",
    mime_type: "image/webp",
    image_url: image,
    blockchain: "ethereum",
    source: { blockchain: "ethereum", api: "opensea" },
    token_id: "12",
    contract_address: "0x1111111111111111111111111111111111111111",
    description:
        "A quiet study of light, space and the shapes between them. This is labelled sample content for checking the artwork information interface. No live NFT or transaction is connected to this preview.",
    owner: {
        address: "0x2222222222222222222222222222222222222222",
        user: { username: "Sample collector" },
    },
    creator: {
        address: "0x3333333333333333333333333333333333333333",
        user: { username: "Sample artist" },
    },
    collection: { name: "Sample collection", image_url: image },
};

const listing = {
    currentPrice: 0.32,
    paymentToken: { symbol: "ETH", usdPrice: 2200 },
    source: { name: "Oncyber preview", icon: "/logo/32.png" },
    marketplace: { name: "Oncyber preview" },
    maker: { address: "Sample collector" },
};

const day = 24 * 3600 * 1000;
const account = (address: string, username: string) => ({
    address,
    user: { username },
});
const history = [
    {
        type: "Sale",
        date: new Date(Date.now() - 2 * day),
        from: account("0x3333333333333333333333333333333333333333", "Sample artist"),
        to: account("0x2222222222222222222222222222222222222222", "Sample collector"),
        price: 0.28,
        paymentToken: { symbol: "ETH" },
    },
    {
        type: "Transfer",
        date: new Date(Date.now() - 40 * day),
        from: account("0x4444444444444444444444444444444444444444", "Earlier owner"),
        to: account("0x3333333333333333333333333333333333333333", "Sample artist"),
    },
    {
        type: "Mint",
        date: new Date(Date.now() - 90 * day),
        to: account("0x3333333333333333333333333333333333333333", "Sample artist"),
    },
];

/**
 * Development-only visual fixture for the in-space artwork UI: the bulle shown
 * while looking at an artwork and the details overlay opened with E. Sample
 * metadata, inert actions. `?view=bulle|details&bulle=basic|helper`.
 */
export default function ArtworkInfoPreview() {
    const { query } = useRouter();
    const view = query.view === "bulle" ? "bulle" : "details";
    const [open, setOpen] = useState(true);
    const noop = async () => {};
    const info = {
        type: "3d",
        asset: artwork,
        artwork,
        assetType: "Nft",
        isShowing: true,
        sellOrders: [listing],
        buyOrders: [],
        assetHistory: { status: "loaded", data: history },
        priceData: { status: "loaded", data: [] },
        refreshAssetLoading: false,
        marketplace: {},
        toggle: setOpen,
        fetchPriceData: noop,
    } as any;
    // useNftOrderInfo() derives listing/offer state from this context.
    const order = {
        ...info,
        sellOrders: query.listing === "0" ? [] : [listing],
        buyArtwork: noop,
        makeOfferOnArtwork: noop,
    } as any;
    const world = {
        ref: {
            current: {
                getTeleportCoords: () => null,
                getPlayerData: () => ({}),
                getArtworks: () => [],
            },
        },
    } as any;
    return (
        <main
            style={{
                position: "fixed",
                inset: 0,
                background: `#101010 url(${background}) center / cover`,
            }}
        >
            <WorldContext.Provider value={world}>
                <NftBuyContext.Provider value={order}>
                    <ArtworkContext.Provider value={info}>
                        {view === "details" && open && (
                            <ArtworkInfoDesktop toggle={setOpen} />
                        )}
                        {view === "bulle" && (
                            <div
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    bottom: 40,
                                    transform: "translateX(-50%)",
                                }}
                            >
                                {query.bulle === "helper" ? (
                                    <HelperArtworkInfoBulle
                                        artwork={artwork}
                                        exhibit={{}}
                                        toggleArtworkInfo={() => {}}
                                        isPlaying
                                        showArtworkInfo={false}
                                        selectedMode={null}
                                    />
                                ) : (
                                    <BasicArtworkInfoBulle
                                        artwork={artwork}
                                        exhibit={{}}
                                        toggleArtworkInfo={() => {}}
                                        isPlaying
                                        showArtworkInfo={false}
                                    />
                                )}
                            </div>
                        )}
                    </ArtworkContext.Provider>
                </NftBuyContext.Provider>
            </WorldContext.Provider>
        </main>
    );
}
