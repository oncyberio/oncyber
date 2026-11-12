import { useState } from "react";
import { ArtworkInfoDesktop } from "../../D/Desktop";
import { ArtworkContext as NativeArtworkContext } from "../../D/ArtworkContext";
import { NftBuyContext } from "@components/context/NftBuyContext";
import { WorldContext } from "@components/_3DExhibit-v2/context/WorldProvider";

const image = "/landing-build/gallery-previews/white-cube-gpt.webp";
const asset = {
    name: "Study in light · sample artwork",
    mime_type: "image/webp",
    image_url: image,
    blockchain: "ethereum",
    source: { blockchain: "ethereum" },
    token_id: "12",
    contract_address: "0x1111111111111111111111111111111111111111",
    description:
        "A quiet study of light, space and the shapes between them. This is labelled sample content for checking the real artwork details interface at desktop and mobile sizes. No live NFT or transaction is connected to this preview.",
    curatorNotes:
        "Sample curator notes. The artwork remains the focus, with ownership and marketplace information kept close at hand.",
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

/** Development-only visual fixture. Sample metadata and inert transaction actions. */
export default function ArtworkDetailsPreview() {
    const [open, setOpen] = useState(true);
    const [notice, setNotice] = useState("");
    const previewAction = async () => {
        setNotice("Sample action only. No transaction was sent.");
    };
    const value = {
        type: "3d",
        asset,
        assetType: "Nft",
        artwork: asset,
        isShowing: true,
        sellOrders: [listing],
        buyOrders: [],
        assetHistory: { status: "loaded", data: [] },
        priceData: { status: "loaded", data: [] },
        refreshAssetLoading: false,
        submitting: false,
        marketplace: {},
        confirming: false,
        buyingSuccess: false,
        transactionHash: null,
        toggle: setOpen,
        setConfirming: () => {},
        setIsAnimateArtworkInfoBulle: () => {},
        buyArtwork: previewAction,
        makeOfferOnArtwork: previewAction,
        fetchPriceData: async () => {},
        isRedirect: false,
    } as any;
    return (
        <main
            style={{
                minHeight: "100vh",
                background:
                    "#101010 url(/landing-build/gallery-previews/wolfgang-n2-gpt.webp) center / cover",
                color: "#c2c2bd",
                padding: 16,
                fontFamily: "Arial, sans-serif",
                fontSize: 12,
            }}
        >
            <p style={{ margin: 0 }}>
                Artwork details preview · Sample data · No live transactions
            </p>
            <p role="status">{notice}</p>
            {!open && (
                <button onClick={() => setOpen(true)}>
                    Open sample artwork
                </button>
            )}
            <WorldContext.Provider
                value={
                    {
                        ref: { current: { getTeleportCoords: () => null } },
                    } as any
                }
            >
                <NftBuyContext.Provider value={value}>
                    <NativeArtworkContext.Provider value={value}>
                        {open && (
                            <ArtworkInfoDesktop type="3d" toggle={setOpen} />
                        )}
                    </NativeArtworkContext.Provider>
                </NftBuyContext.Provider>
            </WorldContext.Provider>
        </main>
    );
}
