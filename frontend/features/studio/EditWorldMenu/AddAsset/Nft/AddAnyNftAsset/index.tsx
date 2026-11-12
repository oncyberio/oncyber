import { NftEmptyState } from "../NftEmptyState";
import { PanelPlaceholder } from "../../shared/PanelContent";
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import IconImg from "@ui/components/IconImg";
import { TextInput } from "@features/studio/styles/Input";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useEditWorld } from "../../../context/WorldEditContext";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { AssetList } from "../AssetList";
import { FetchedAsset } from "@uitypes/Asset";
import { DRAG_MIMES } from "@components/_3DExhibit-v2/three/constants";
import { OpenSeaProviderDropdown } from "../OpenSeaProviderDropdown";
import {
    OS_COLLECTION_PREFIX,
    OBJKT_COLLECTION_PREFIX,
    parseQuery,
} from "./hooks/useInfiniteRemoteAssetsQuery";
import { Secondary } from "@features/studio/styles/Secondary";
import { NButton } from "@features/studio/components/StudioButton";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useAnyContentAssets } from "./hooks/useAnyContentAssets";

export function isCollection(url) {
    if (!url) return false;
    return (
        url.startsWith(OBJKT_COLLECTION_PREFIX) ||
        url.startsWith(OS_COLLECTION_PREFIX)
    );
}

function AssetNotFound({ query }) {
    return (
        <NftEmptyState title="Artwork unavailable">
            Check the {isCollection(query) ? "collection" : "NFT"} link.
        </NftEmptyState>
    );
}

function AddAsset({ query, chain }) {
    const { exhibit } = useCurrentExhibit();

    const world = useWorld();

    const [isScrolling, setScroll] = useState(false);

    const { handleAddNft, handleDragStart, handleAddNftBulk } = useEditWorld();

    const [selectedAssets, setSelectedAssets] = useState<Array<FetchedAsset>>(
        []
    );

    const containerRef = useRef(null);

    const assetsData = useAnyContentAssets(query, exhibit, chain);

    const state = assetsData?.assetsData?.state;

    const nextPagination = assetsData?.nextPagination;

    const isMultipleAssets = assetsData?.shownAssets?.length > 1;

    const handlePlaceArtwork = useEventCallback(
        (asset: FetchedAsset, e: React.MouseEvent) => {
            handleAddNft({
                asset,
                keepPlaceholder: e.shiftKey,
                source: "click",
                autoSelect: true,
                permissionless: true,
            });
        },
        []
    );

    const handleAssetDrag = useEventCallback(
        (asset: FetchedAsset, e: React.DragEvent, preload?: Promise<any>) => {
            //

            let previewUrl = asset.mime_type?.startsWith?.("model/")
                ? null
                : asset?.image_preview_url || asset?.image_url;

            handleDragStart(e as any, DRAG_MIMES.NFT, {
                previewUrl,
                // previewImg: imgRef.current,
                asset,
                preload,
                mime: DRAG_MIMES.NFT,
                permissionless: true,
            });
        },
        []
    );

    const handleBulkAdd = useEventCallback(() => {
        //
        const placeholders = world.current.getPlaceholders({ bulkAdd: true });

        const placeholderIds = placeholders.map((p) => p.userData.id);

        const assets = selectedAssets.slice(0, placeholders.length);

        handleAddNftBulk({
            assets,
            placeholderIds,
            keepPlaceholder: false,
            source: "click",
        });

        setSelectedAssets([]);

        //
    }, []);

    const handleLoadMore = useEventCallback((e: any) => {
        //

        setScroll(!!nextPagination);

        if (nextPagination) {
            assetsData.nextPage?.();
        }
    }, []);

    const freeSlots = world.current.getPlaceholders().length;

    return (
        <>
            {state === "InitialLoading" ? (
                <NftEmptyState title="Loading NFTs…" />
            ) : (
                <ArtworkPreview>
                    {assetsData?.shownAssets?.length ? (
                        <AssetListWrapper ref={containerRef}>
                            <AssetList
                                shownAssets={assetsData.shownAssets}
                                selectedAssets={selectedAssets}
                                setSelectedAssets={setSelectedAssets}
                                showImage={true}
                                handleAssetDrag={handleAssetDrag}
                                handleAssetClick={handlePlaceArtwork}
                                size={isMultipleAssets ? "small" : "large"}
                                handleLoadMore={handleLoadMore}
                                isLoadMore={nextPagination && isScrolling}
                            />

                            {selectedAssets.length > 0 && (
                                <div className="footer">
                                    <div
                                        className="select-info"
                                        title="Unselect all"
                                        onClick={() => {
                                            setSelectedAssets([]);
                                        }}
                                    >
                                        <IconImg
                                            name="check-white-bg"
                                            size={16}
                                        />
                                        <Secondary>
                                            {" "}
                                            {selectedAssets.length} selected (
                                            {freeSlots} free)
                                        </Secondary>
                                    </div>
                                    <NButton
                                        overrideTheme="dark"
                                        size="small"
                                        style={{ marginLeft: "auto" }}
                                        onClick={handleBulkAdd}
                                    >
                                        Place all
                                    </NButton>
                                </div>
                            )}
                        </AssetListWrapper>
                    ) : (
                        <AssetNotFound query={query} />
                    )}
                </ArtworkPreview>
            )}
        </>
    );
}

export function AddAnyNftContent({ togglerRef }) {
    const [link, setLink] = useState("");
    const [query, setQuery] = useState("");
    const [isOpenSeaCol, setIsOpenSeaCol] = useState(false);
    const [openSeaColChain, setOpenSeaColChain] = useState("ethereum");

    const handleKeyPress = useEventCallback((event) => {
        if (event.key === "Enter") {
            const nextLink = link.trim();

            if (!parseQuery(nextLink, openSeaColChain)) return;

            setQuery(nextLink);
        }
    }, []);

    const handleChange = useEventCallback((event) => {
        const newInputValue = event.target.value as string;
        const normalizedInputValue = newInputValue.trim();
        const parsedQuery = parseQuery(normalizedInputValue, openSeaColChain);

        setIsOpenSeaCol(normalizedInputValue.startsWith(OS_COLLECTION_PREFIX));

        if (normalizedInputValue === "") {
            setQuery("");
            setOpenSeaColChain("ethereum");
        } else if (parsedQuery) {
            setQuery(normalizedInputValue);
        } else {
            setQuery("");
        }

        setLink(newInputValue);
    }, []);

    const handleChainSelect = useEventCallback((val) => {
        //

        setOpenSeaColChain(val);

        if (!query && link) {
            setQuery(link.trim());
        }
    }, []);

    return (
        <Container>
            <div className="search">
                <IconImg
                    name="link"
                    size={12}
                    className="link-icon"
                    style={{ filter: "invert(1)" }}
                />

                <SearchContainer>
                    <TextInput
                        id="nft-link"
                        aria-label="NFT or collection URL"
                        aria-describedby="nft-link-sources"
                        value={link}
                        placeholder="Paste an NFT or collection link"
                        style={{ width: "100%" }}
                        onKeyDown={handleKeyPress}
                        onChange={handleChange}
                    />

                    {isOpenSeaCol && (
                        <OpenSeaProviderDropdown
                            value={openSeaColChain}
                            addTogglerRef={togglerRef}
                            onChange={handleChainSelect}
                        />
                    )}
                </SearchContainer>
            </div>

            <SupportedLinks id="nft-link-sources">
                OpenSea · Objkt · Xchain
            </SupportedLinks>
            {query ? (
                <AddAsset query={query} chain={openSeaColChain} />
            ) : (
                <PanelPlaceholder
                    icon="nft"
                    title="Artwork preview appears here"
                />
            )}
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
    display: flex;
    flex: 1;
    flex-direction: column;

    gap: 12px;

    & > .search {
        width: 100%;
        display: flex;
        align-items: center;
        background: var(--studio-inset);
        border: 1px solid var(--nft-line);
        border-radius: var(--studio-radius-control);
        &:focus-within {
            border-color: var(--studio-muted);
        }

        .link-icon {
            margin-left: 12px;
            opacity: 0.65;
        }
        && input {
            border: 0;
            border-radius: var(--studio-radius-control);
            background: transparent;
            height: 40px;
        }
    }
`;

const ArtworkPreview = styled.div`
    width: 100%;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
`;

const SupportedLinks = styled.p`
    margin: 8px 0 20px;
    font: 12px/20px var(--studio-font);
    color: var(--nft-muted);
`;

const AssetListWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;

    @media (max-width: 600px) {
        padding-bottom: 25px;
    }

    & > .footer {
        display: flex;
        flex-direction: row;
        border-top: 1px solid var(--nft-line);
        padding-top: 16px;

        & > .select-info {
            display: flex;
            direction: row;
            align-items: center;
            gap: 0.5em;
            cursor: pointer;
        }
    }
`;

const SearchContainer = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
`;
