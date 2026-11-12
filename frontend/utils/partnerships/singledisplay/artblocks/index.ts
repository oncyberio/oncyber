const links = ["art-blocks", "artblock-v1", "artblock-v2", "artblock-v3"];

const space_slugs = [
    "artblockstesting",
    "artblock-v1",
    "artblock-v2",
    "artblock-v3",
];

export const IS_ARTBLOCKS_CUSTOM_LINK = (custom_link) =>
    links.some((_link) => _link === custom_link);

export const IS_ARTBLOCKS_SPACE_SLUG = (slug) =>
    space_slugs.some((_slug) => _slug === slug);

export const MAX_ARTBLOCKS_WIDTH = 10;

export const MAX_ARTBLOCKS_HEIGHT = 12;

export const IS_ARTBLOCKS_SPECIAL_ROOM = (slug) =>
    IS_ARTBLOCKS_SPACE_SLUG(slug);

export interface ArtblockArtwork {
    platform: string;
    tokenID: string;
    series: string;
    animation_url: string;
    image: string;
    external_url: string;
    aspect_ratio: number;
    payout_address: string;
    interactive_nft: {
        version: string;
        code_uri: string;
    };
    license: string;
    name: string;
    artist: string;
    description: string;
    script_type: string;
    project_id: string;
    curation_status: string;
    generator_url: string;
    royaltyInfo: {
        artistAddress: string;
        additionalPayee: string;
        additionalPayeePercentage: string;
        royaltyFeeByID: string;
    };
    collection_name: string;
    website: string;
    features: {};
    traits: {
        trait_type: string;
        value: string;
    }[];
    token_hash: string;
    is_static: boolean;
}

const ARTBLOCKS_TOKEN_ADDRESS = "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270";

export const artblocksFormatter = async (request, contract, exhibit) => {
    const artblockArtwork = await request.json();

    if (!artblockArtwork.name) return null;

    // ArtBlocks' preview PNGs (both `media.artblocks.io/<tokenId>.png` and the
    // API's `image`/`media-proxy.artblocks.io` URL) return the image WITHOUT an
    // `access-control-allow-origin` header on the final response. The engine
    // loads previews with crossOrigin="anonymous" (a cors-mode fetch in
    // three/loader.js), so that fetch fails, there's no fallback URL, and the
    // whole artwork mesh fails to load — the piece renders blank. Route the
    // preview through our own same-origin /api/proxyv2 so the browser sees a
    // same-origin (CORS-clean) response it can upload as a WebGL texture.
    const proxied = (u: string) =>
        u ? `/api/proxyv2?url=${encodeURIComponent(u)}` : "";
    const rawPreview = artblockArtwork.tokenID
        ? `https://media.artblocks.io/${artblockArtwork.tokenID}.png`
        : artblockArtwork.image || "";
    const previewImage = proxied(rawPreview);
    // Lighter fallback served if the full-res preview fails to load — also
    // proxied so it stays CORS-clean. ArtBlocks exposes no jpeg variant;
    // `thumb/<id>.png` is the available smaller image.
    const previewFallback = artblockArtwork.tokenID
        ? proxied(`https://media.artblocks.io/thumb/${artblockArtwork.tokenID}.png`)
        : "";

    const newArtworks = {
        "0.70X4.86X-22.51X0.00X0.00X0.00": {
            rotation: {
                _z: -3.141592653589793,
                _x: -3.141592653589793,
                _y: 3.141592653589793,
            },
            data: {
                enableHTMLView: true,
                sell_orders: [],
                addedBy: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
                top_bid: {},
                incompatible: false,
                mime_type: "image/png",
                marketplace: null,
                image_original_preview_url: null,
                id: "0.70X4.86X-22.51X0.00X0.00X0.00",
                borderColor: "transparent-borderless",
                autoPlay: true,
                // Preview-first: show the static image, only run the heavy
                // generative HTML while the piece is looked at, and pause it when
                // it leaves the view (instead of running forever).
                foreverPlay: false,
                owner: {
                    config: "",
                    user: {
                        username: "artblocks",
                    },
                    profile_img_url: "",
                    address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
                },
                collection: {
                    external_url: `https://www.artblocks.io/project/${artblockArtwork.project_id}`,
                    image_url:
                        "https://lh3.googleusercontent.com/zkwdi-5NwIx5PZxR4biqwKqJ5ZfBzTYds69cqiwNb1Baz2yfRFiENpWVytaECLYVmCcl2ASgP5sDU8Q5CRzaXdabZ9tsvltALai8",
                    name: artblockArtwork.collection_name,
                },
                openSeaLink: `https://opensea.io/assets/0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270/${artblockArtwork.tokenID}`,
                contract: {
                    schema_name: "ERC721",
                    name: "Art Blocks",
                },
                placeholderId: 0,
                isCreatorButNotOwned: false,
                scale: 0.6,
                external_link: artblockArtwork.external_url,
                name: artblockArtwork.name,
                creator: {
                    profile_img_url:
                        "https://storage.googleapis.com/opensea-static/opensea-profile/17.png",
                    address: artblockArtwork.royaltyInfo.artistAddress,
                    config: "",
                    user: {
                        username: artblockArtwork.artist,
                    },
                },
                image_preview_url: previewImage,
                image_fallback_url: previewFallback,
                image_original_url: null,
                isOwned: true,
                contract_address: contract || ARTBLOCKS_TOKEN_ADDRESS,
                description: artblockArtwork.description,
                animation_url: artblockArtwork.animation_url || "",
                blockchain: "ethereum",
                token_id: artblockArtwork.tokenID,
                token_address: contract || ARTBLOCKS_TOKEN_ADDRESS,
                sharedBy: "",
                image_url: previewImage,
                needsRefetch: false,
                account_base_url: "https://opensea.io",
                animation_original_url: artblockArtwork.animation_url || "",
            },
            addedBy: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
            position: {
                y: 4.85722637,
                z: -22.50566,
                x: 0.7013883,
            },
            originalPosition: {
                y: 4.85722637,
                z: -22.50566,
                x: 0.7013883,
            },
        },
    };

    return {
        ...exhibit,
        artworks: newArtworks,
        info: {
            ...exhibit.info,
            headline: artblockArtwork.name,
            description: artblockArtwork.description,
        },
        owner:
            artblockArtwork?.royaltyInfo?.artistAddress ||
            "0xf442915be548e0dca85b14951a43266180f67ba8",
    };
};
