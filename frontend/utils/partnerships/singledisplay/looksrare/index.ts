const links = ["looksrare"];

const slugs = ["theunderworld"];

export const MAX_LOOKSRARE_WIDTH = 1;

export const MAX_LOOKSRARE_HEIGHT = 1;

export const IS_LOOKSRARE_CUSTOM_LINK = (slug) =>
    links.some((_slug) => _slug === slug);

export const IS_LOOKSRARE_SPACE_SLUG = (slug) =>
    slugs.some((_slug) => _slug === slug);

export async function looksrareFormatter(request, contarct, exhibit) {
    const response = await request.json();

    if (!response.success) return null;

    const artwork = response.data;

    const addedBy = "0xf02cb30a8963e6fe8cc7650a6169e603357650ad";

    const token_id = artwork.tokenId;

    const contract_address = artwork.collectionAddress;

    const external_link = artwork.collection.websiteLink || "";

    const mime_type = "video/mp4";

    const image_url = artwork.imageURI || "";

    const image_preview_url = artwork.imageURI || "";

    const collection = {
        image_url: "",
        name: artwork.collection.name,
        external_url: null,
    };

    const animation_url = "";

    const animation_original_url = "";

    const owner = null;

    const name = artwork.name;

    const openSeaLink = null;

    const creator = {
        address: artwork.collection.owner,
        config: "",
        user: { username: artwork.collection.name },
        profile_img_url: "",
    };

    const contract = {
        schema_name: artwork.collection.type,
    };

    const newArtworks = {
        "0.01X-203.32X4.98X-3.14X0.00X-3.14": {
            addedBy,
            rotation: { _y: 0, _z: -3.141592653589793, _x: -3.141592653589793 },
            data: {
                sell_orders: [],
                token_id,
                external_link,
                envmap: "",
                image_original_preview_url: null,
                // mime_type,
                placeholderId: "0",
                owner: {
                    address: artwork.collection.owner,
                },
                customData: null,
                contract_address,
                image_original_url: null,
                sharedBy: "",
                addedBy,
                image_url,
                original_mime_type: null,
                image_preview_url,
                top_bid: {},
                collection,
                files: [],
                isOwned: true,
                animation_url,
                incompatible: false,
                token_address: "0x495f947276749ce646f68ac8c248420045cb7b5e",
                animation_original_url,
                description: "",
                isCreatorButNotOwned: false,
                name,
                buy_orders: [],
                openSeaLink,
                id: "0.01X-203.32X4.98X-3.14X0.00X-3.14",
                needsRefetch: false,
                contract,
                creator,
                marketplace: null,
                blockchain: "ethereum",
                scale: 5,
            },
            version: 1,
            position: {
                x: 0.013499975204467773,
                y: -203.32223510742188,
                z: 4.978810787200928,
            },
            originalPosition: { x: 0.01, y: -203.32, z: 4.98 },
            originalRotation: { _x: -3.14, _y: 0, _z: -3.14 },
            audioType: "lookat",
        },
    };

    return {
        ...exhibit,
        artworks: newArtworks,
        info: {
            ...exhibit.info,
            headline: name,
        },
        owner: "0x0a95705d53ca79b67af6d381591ce01b9c3caaf3",
    };
}
