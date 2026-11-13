import { resize } from "@utils/urlUtils";

export interface SpacePerson {
    name: string;
    /** Wallet address when known; resolved to a username by the API. */
    address: string;
    avatar: string;
    href: string;
}

export interface SpaceArtwork {
    id: string;
    title: string;
    artist: string;
    artistAddress?: string;
    imageUrl: string;
    /** Fallbacks tried in order when an image fails to load. */
    imageUrls: string[];
    collection: string;
}

/** The destination (room) a space is deployed in, shown inside the sidebar. */
export interface SpaceLocation {
    name: string;
    href: string;
    description?: string;
    /** Cover images, tried in order. */
    imageUrls?: string[];
    author?: SpacePerson;
}

export interface SpaceInfo {
    id: string;
    title: string;
    description: string;
    coverUrl: string;
    /** Fallbacks tried in order: old Firebase copies can be gone (403). */
    coverUrls: string[];
    href: string;
    deployer: SpacePerson;
    artists: (SpacePerson & { count: number })[];
    artworks: SpaceArtwork[];
    totalArtworks: number;
    visits: number;
    /** Destination (room template) slug; the guestbook falls back to it. */
    room: string;
    /** Where the space is deployed, resolved by the API. */
    location?: SpaceLocation;
    collaborators: SpacePerson[];
    staffPick?: boolean;
    staffPickCount?: number;
    canCurate?: boolean;
}

const MAX_ARTWORKS = 60;
const MAX_ARTISTS = 24;

function text(value: unknown, max = 300) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function image(value: unknown, width: number) {
    let url = text(value, 2000);
    if (url.startsWith("ipfs://"))
        url = `https://cyber.mypinata.cloud/ipfs/${url.slice(7)}`;
    if (!/^https?:\/\//i.test(url) && !/^\/(?!\/)/.test(url)) return "";
    return resize(url, width);
}

function images(values: unknown[], width: number) {
    return Array.from(
        new Set(values.map((value) => image(value, width)).filter(Boolean))
    );
}

export function shortAddress(address: string) {
    return /^0x[0-9a-f]{40}$/i.test(address)
        ? `${address.slice(0, 6)}…${address.slice(-4)}`
        : address;
}

/** Pure projection of a destination doc into the sidebar's Location view. */
export function buildSpaceLocation(
    destination: any,
    room: string
): SpaceLocation | undefined {
    if (!destination || typeof destination !== "object") return undefined;
    const slug = text(destination.slug, 200) || room;
    const author = destination.author || {};
    const address = text(author.id, 120);
    const username = text(author.username, 80);
    const authorName =
        username ||
        text(author.name, 80) ||
        (address ? shortAddress(address) : "");
    return {
        name: text(destination.name, 200) || slug,
        href: `/destinations/${encodeURIComponent(slug)}`,
        description: text(destination.description, 2000),
        imageUrls: images([destination.thumbnail, destination.image], 640),
        author: authorName
            ? {
                  name: authorName,
                  address,
                  avatar: "",
                  href: username ? `/${encodeURIComponent(username)}` : "",
              }
            : undefined,
    };
}

/** Pure projection of a full exhibit doc into what the sidebar shows. */
export function buildSpaceInfo(exhibit: any): SpaceInfo {
    const info = exhibit?.info || {};
    const owner = text(exhibit?.owner, 120);
    const customLink = text(info.customLink, 200).replace(/^\/+/, "");
    const artworks: SpaceArtwork[] = [];
    const artists = new Map<string, SpacePerson & { count: number }>();
    const entries = Object.entries(exhibit?.artworks || {});
    let total = 0;
    for (const [key, artwork] of entries) {
        const data: any = (artwork as any)?.data || {};
        // Text blocks, empty frames and 3D scenery models aren't artworks.
        if (data.text != null || data.mime_type === "text") continue;
        if (
            /^model\//.test(text(data.mime_type, 80)) ||
            /\.(glb|gltf|vrm|fbx|obj)$/i.test(text(data.name, 160))
        )
            continue;
        const imageUrls = images(
            [
                data.image_preview_url,
                data.compressed_image_url,
                data.image_url,
                data.image_original_url,
            ],
            256
        );
        const imageUrl = imageUrls[0] || "";
        const creator = data.creator || {};
        const address = text(creator.address, 120);
        const artistName =
            text(creator.user?.username || creator.username, 80) ||
            (address ? shortAddress(address) : "");
        const title = text(data.name, 160);
        if (!title && !imageUrl) continue;
        if (artistName) {
            const id = (address || artistName).toLowerCase();
            const known = artists.get(id);
            if (known) known.count += 1;
            else
                artists.set(id, {
                    name: artistName,
                    address,
                    avatar: image(
                        creator.profile_img_url ||
                            creator.user?.profile_img_url,
                        96
                    ),
                    href: "",
                    count: 1,
                });
        }
        total += 1;
        if (artworks.length < MAX_ARTWORKS)
            artworks.push({
                id: text(data.id, 200) || key,
                title: title || "Untitled",
                artist: artistName,
                artistAddress: address,
                imageUrl,
                imageUrls,
                collection: text(data.collection?.name, 120),
            });
    }
    const covers = images([info.cHeroImg, info.fHeroImg, info.heroImg], 640);
    return {
        id: text(exhibit?.id, 200),
        title: text(info.headline, 200) || "Untitled space",
        description: text(info.description, 2000),
        coverUrl: covers[0] || "",
        coverUrls: covers,
        href: customLink
            ? `/${encodeURIComponent(customLink)}`
            : `/spaces/${encodeURIComponent(text(exhibit?.id, 200))}`,
        deployer: {
            name:
                text(exhibit?.ownerName, 80) ||
                text(info.curator, 80) ||
                shortAddress(owner),
            address: owner,
            avatar: "",
            href: "",
        },
        artists: [...artists.values()]
            .sort((a, b) => b.count - a.count)
            .slice(0, MAX_ARTISTS),
        artworks,
        totalArtworks: total,
        visits: Number(exhibit?.number_of_visits) || 0,
        room: text(info.room, 200),
        collaborators: (Array.isArray(exhibit?.editors) ? exhibit.editors : [])
            .map((editor: unknown) => text(editor, 120))
            .filter(
                (editor: string, index: number, list: string[]) =>
                    editor &&
                    editor.toLowerCase() !== owner.toLowerCase() &&
                    list.indexOf(editor) === index
            )
            .slice(0, 12)
            .map((address: string) => ({
                name: shortAddress(address),
                address,
                avatar: "",
                href: "",
            })),
    };
}

export interface ProfileNft {
    id: string;
    title: string;
    collection: string;
    /** Small CDN thumbnails first (≈256px), full-size sources only as a fallback. */
    imageUrls: string[];
    href: string;
}

/** OpenSea v2 nft → a light card. Never ships the original media. */
export function profileNft(nft: any): ProfileNft | null {
    if (!nft || typeof nft !== "object") return null;
    const contract = text(nft.contract, 80);
    const token = text(nft.identifier, 100);
    const sources = [nft.display_image_url, nft.image_url]
        .map((value) => text(value, 2000))
        .filter((url) => /^https:\/\//i.test(url));
    // Resizable CDN copies (seadn, pinata, cloudinary) come back ~256px wide;
    // anything else could be a full-resolution original, so it goes last.
    const small = sources
        .map((url) => resize(url, 256))
        .filter((url, index) => url !== sources[index]);
    const imageUrls = Array.from(new Set([...small, ...sources]));
    if (!imageUrls.length && !nft.name) return null;
    return {
        id: `${contract}/${token}`,
        title:
            text(nft.name, 160) ||
            (token ? `#${token.slice(0, 12)}` : "Untitled"),
        collection: text(nft.collection, 120),
        imageUrls,
        href:
            text(nft.opensea_url, 400) ||
            (contract && token
                ? `https://opensea.io/assets/ethereum/${contract}/${token}`
                : ""),
    };
}
