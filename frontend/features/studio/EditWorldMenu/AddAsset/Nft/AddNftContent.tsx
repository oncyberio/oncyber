import React, { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import { AssetList } from "./AssetList";

import { FetchedAsset } from "@uitypes/Asset";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { NButton } from "@features/studio/components/StudioButton";
import IconImg from "@ui/components/IconImg";
import { Secondary } from "@features/studio/styles/Secondary";
import { useEditWorld } from "../../context/WorldEditContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { DRAG_MIMES } from "@components/_3DExhibit-v2/three/constants";
import { UserContext } from "@components/context/UserContext";
import { shouldDisplayNFTs } from "@features/studio/utils";
import { WalletDropdown } from "../shared/WalletDropdown";
import { EthProviderDropdown } from "./EthProviderDropdown";
import { NftEmptyState } from "./NftEmptyState";
import { useWalletContext } from "../../context/WalletContext";
import { formatWalletAddress } from "@utils/format";
import { NftSourceButton } from "./NftSourceButton";

export interface ContentProps {
    query: string;
    togglerRef: (el: any) => void;
    onAddFromLink: () => void;
}

export function AddNftContent({
    query,
    togglerRef,
    onAddFromLink,
}: ContentProps) {
    //

    const {
        handleAddNft,
        handleAddNftBulk,
        handleDragStart,
        assetsData,
        setQuery,
        setStartLoadingAssets,
    } = useEditWorld();

    const { userData } = useContext(UserContext);

    const world = useWorld();
    const { currentWalletId } = useWalletContext();

    const [selectedAssets, setSelectedAssets] = useState<Array<FetchedAsset>>(
        []
    );

    const freeSlots = world.current.getPlaceholders().length;

    useEffect(() => {
        if (shouldDisplayNFTs(userData)) {
            setStartLoadingAssets(true);
        }
    }, []);

    const handleAssetClick = useEventCallback(
        (asset: FetchedAsset, e: React.MouseEvent) => {
            //

            handleAddNft({
                asset,
                keepPlaceholder: e.shiftKey,
                source: "click",
                autoSelect: true,
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

    const isLoading = assetsData?.assetsData?.state === "InitialLoading";
    const hasError =
        assetsData.assetsData?.state === "LoadinError" ||
        assetsData.assetsData?.data?.hasError;
    const shownAssets = assetsData.shownAssets;

    return (
        <Container>
            <div className="search">
                <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                >
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="m16 16 4 4" />
                </svg>
                <input
                    type="search"
                    aria-label="Search your NFTs"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search NFTs"
                />
            </div>
            <div className="source-controls">
                <WalletDropdown
                    addTogglerRef={togglerRef}
                    caption={({ toggled }) => (
                        <NftSourceButton
                            label="Wallet"
                            value={
                                currentWalletId
                                    ? formatWalletAddress(currentWalletId)
                                    : "Select wallet"
                            }
                            toggled={toggled}
                        />
                    )}
                />
                <EthProviderDropdown addTogglerRef={togglerRef} showLabel />
            </div>
            <AssetListWrapper>
                {isLoading ? (
                    <NftEmptyState title="Loading NFTs…" />
                ) : hasError ? (
                    <NftEmptyState title="Collection unavailable">
                        Try another wallet or network.
                    </NftEmptyState>
                ) : !shownAssets.length ? (
                    <NftEmptyState
                        title={query ? "No results" : "No NFTs in this wallet"}
                        action={
                            query
                                ? {
                                      label: "Clear search",
                                      onClick: () => setQuery(""),
                                  }
                                : {
                                      label: "Use a link",
                                      onClick: onAddFromLink,
                                  }
                        }
                    />
                ) : (
                    <AssetList
                        shownAssets={shownAssets}
                        selectedAssets={selectedAssets}
                        setSelectedAssets={setSelectedAssets}
                        showImage={true}
                        handleAssetClick={handleAssetClick}
                        handleAssetDrag={handleAssetDrag}
                    />
                )}
                {selectedAssets.length > 0 && (
                    <div className="footer">
                        <div
                            className="select-info"
                            title="Unselect all"
                            onClick={() => {
                                setSelectedAssets([]);
                            }}
                        >
                            <IconImg name="check-white-bg" size={16} />
                            <Secondary>
                                {" "}
                                {selectedAssets.length} selected ({freeSlots}{" "}
                                free)
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
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
    width: 100%;

    && > .search {
        position: relative;
        display: flex;
        align-items: center;
        svg {
            position: absolute;
            left: 12px;
            color: var(--nft-muted);
            pointer-events: none;
        }
        input {
            width: 100%;
            height: 36px;
            min-height: 36px;
            background: var(--studio-inset);
            border-color: var(--studio-line);
            font-size: 12px;
            padding-left: 35px;
        }
    }
    .source-controls {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 8px;
        padding-top: 8px;
    }
`;

const AssetListWrapper = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    padding: 10px 0;

    & > .footer {
        display: flex;
        align-items: center;
        border-top: 1px solid var(--nft-line);
        padding-top: 16px;
        & > .select-info {
            display: flex;
            align-items: center;
            gap: 0.5em;
            cursor: pointer;
        }
    }
`;
