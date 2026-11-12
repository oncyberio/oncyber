import { useEffect, useMemo, useState } from "react";
import type { AssetOption } from "@features/studio/EditWorldMenu/AddAsset/shared/AssetTypes";
import {
    LibraryCard,
    LibraryGrid,
    LibrarySearch,
    LibraryTabs,
} from "@features/studio/EditWorldMenu/AddAsset/shared/Library";
import {
    PanelEmptyState,
    PanelNote,
    PanelSectionHeading,
} from "@features/studio/EditWorldMenu/AddAsset/shared/PanelContent";
import type { SetOption, VideoArtwork } from "../model";
import styles from "../VideoStudioShell.module.css";

export interface VideoLibraryAsset {
    readonly id: string;
    readonly name: string;
    readonly thumbnail: string;
    readonly kind: "image" | "nft";
    readonly protection: VideoArtwork["protection"];
}

interface Props {
    option: AssetOption;
    artworks: readonly VideoArtwork[];
    sets: readonly SetOption[];
    selectedArtworkId: string | null;
    selectedSetId: string;
    onAddAsset: (asset: VideoLibraryAsset) => void;
    onSelectArtwork: (id: string) => void;
    onPreviewSet: (set: SetOption) => void;
    onUseSet: (set: SetOption) => void;
}

const ASSETS: readonly VideoLibraryAsset[] = [
    {
        id: "chromatic-field",
        name: "Chromatic Field",
        thumbnail: "/images/art1.png",
        kind: "nft",
        protection: "exact",
    },
    {
        id: "soft-machine",
        name: "Soft Machine",
        thumbnail: "/images/sample3.png",
        kind: "nft",
        protection: "exact",
    },
    {
        id: "signal-bloom",
        name: "Signal Bloom",
        thumbnail: "/images/showcase-art.png",
        kind: "nft",
        protection: "exact",
    },
    {
        id: "spectrum-study",
        name: "Spectrum Study",
        thumbnail: "/images/color_wheel.png",
        kind: "image",
        protection: "identity",
    },
    {
        id: "gradient-memory",
        name: "Gradient Memory",
        thumbnail: "/images/gradient.png",
        kind: "image",
        protection: "identity",
    },
    {
        id: "hero-plate",
        name: "Hero Plate",
        thumbnail: "/images/hero.jpg",
        kind: "image",
        protection: "generative",
    },
    {
        id: "portrait-cutout",
        name: "Portrait Cutout",
        thumbnail: "/studio-assets/avatar-cutout.png",
        kind: "image",
        protection: "identity",
    },
    {
        id: "title-card",
        name: "Title Card",
        thumbnail: "/studio-assets/text-notepad-v2.png",
        kind: "image",
        protection: "exact",
    },
    {
        id: "video-reference",
        name: "Video Reference",
        thumbnail: "/studio-assets/youtube-logo.svg",
        kind: "image",
        protection: "identity",
    },
    {
        id: "web-reference",
        name: "Web Reference",
        thumbnail: "/components/media-placeholder.png",
        kind: "image",
        protection: "generative",
    },
];

const OPTION_ASSET_IDS: Partial<
    Record<AssetOption["value"], readonly string[]>
> = {
    nft: ["chromatic-field", "soft-machine", "signal-bloom"],
    upload: ["spectrum-study", "gradient-memory", "hero-plate"],
    avatar: ["portrait-cutout"],
    text: ["title-card"],
    youtube: ["video-reference"],
    iframe: ["web-reference"],
};

const SET_IMAGES: Record<string, string> = {
    "white-cube": "/images/warehouse.png",
    "cobalt-pavilion": "/landing-build/cyber-warehouse.jpg",
    "sunset-monoliths": "/landing-build/jungle-temple.jpg",
};

function imageForArtwork(artwork: VideoArtwork): string {
    if (artwork.source.uri.startsWith("/")) return artwork.source.uri;
    return (
        ASSETS.find((asset) => artwork.source.uri.endsWith(asset.id))
            ?.thumbnail || "/images/image_placeholder.png"
    );
}

function includesQuery(value: string, query: string) {
    return value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

export function VideoAssetLibrary({
    option,
    artworks,
    sets,
    selectedArtworkId,
    selectedSetId,
    onAddAsset,
    onSelectArtwork,
    onPreviewSet,
    onUseSet,
}: Props) {
    const [tab, setTab] = useState<"library" | "scene">("library");
    const [query, setQuery] = useState("");

    useEffect(() => {
        setTab("library");
        setQuery("");
    }, [option.value]);

    const catalog = useMemo(() => {
        const ids = OPTION_ASSET_IDS[option.value] || [];
        return ASSETS.filter(
            (asset) =>
                ids.includes(asset.id) && includesQuery(asset.name, query)
        );
    }, [option.value, query]);
    const placed = useMemo(
        () => artworks.filter((artwork) => includesQuery(artwork.name, query)),
        [artworks, query]
    );
    const filteredSets = useMemo(
        () =>
            sets.filter(
                (set) =>
                    includesQuery(set.title, query) ||
                    set.tags.some((tag) => includesQuery(tag, query))
            ),
        [query, sets]
    );
    const isSetCatalog = option.value === "component";
    const isNonVisual = ["portal", "triggerZone", "globalStream"].includes(
        option.value
    );

    return (
        <div className={styles.assetLibrary}>
            <LibraryTabs role="tablist" aria-label="Asset view">
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "library"}
                    aria-pressed={tab === "library"}
                    onClick={() => setTab("library")}
                >
                    Library
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "scene"}
                    aria-pressed={tab === "scene"}
                    onClick={() => setTab("scene")}
                >
                    In scene ({artworks.length})
                </button>
            </LibraryTabs>

            <LibrarySearch
                value={query}
                onChange={setQuery}
                placeholder={isSetCatalog ? "Search sets" : "Search assets"}
            />

            {tab === "scene" ? (
                placed.length ? (
                    <>
                        <PanelSectionHeading>
                            <h3>
                                Placed assets <span>{placed.length}</span>
                            </h3>
                        </PanelSectionHeading>
                        <LibraryGrid $columns={3}>
                            {placed.map((artwork) => (
                                <LibraryCard
                                    key={artwork.id}
                                    name={artwork.name}
                                    image={imageForArtwork(artwork)}
                                    selected={selectedArtworkId === artwork.id}
                                    onClick={() => onSelectArtwork(artwork.id)}
                                />
                            ))}
                        </LibraryGrid>
                    </>
                ) : (
                    <PanelEmptyState title="No matching assets in this scene">
                        Choose Library to add artwork, uploads, or reference
                        plates.
                    </PanelEmptyState>
                )
            ) : isSetCatalog ? (
                <>
                    <PanelNote>
                        Choose a lightweight Three.js set. Hover or focus to
                        preview; click to use it for the sequence.
                    </PanelNote>
                    <LibraryGrid $columns={3}>
                        {filteredSets.map((set) => (
                            <LibraryCard
                                key={set.id}
                                name={set.title}
                                image={
                                    SET_IMAGES[set.id] ||
                                    "/images/warehouse.png"
                                }
                                selected={selectedSetId === set.id}
                                onPointerEnter={() => onPreviewSet(set)}
                                onFocus={() => onPreviewSet(set)}
                                onClick={() => onUseSet(set)}
                            />
                        ))}
                    </LibraryGrid>
                </>
            ) : isNonVisual ? (
                <PanelEmptyState title="This source is not a visual plate">
                    Keep portals, interactions, and global audio in the world
                    editor; the shot guide only exports visible scene layers.
                </PanelEmptyState>
            ) : catalog.length ? (
                <>
                    <PanelNote>
                        Click an item to place it in the scene. Its AI fidelity
                        mode remains editable in the Inspector.
                    </PanelNote>
                    <LibraryGrid $columns={3}>
                        {catalog.map((asset) => (
                            <LibraryCard
                                key={asset.id}
                                name={asset.name}
                                image={asset.thumbnail}
                                onClick={() => onAddAsset(asset)}
                            />
                        ))}
                    </LibraryGrid>
                </>
            ) : (
                <PanelEmptyState title="No matching assets">
                    Try a shorter search or another source.
                </PanelEmptyState>
            )}
        </div>
    );
}
