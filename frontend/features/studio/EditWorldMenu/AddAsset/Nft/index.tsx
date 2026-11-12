//

import { useState, useEffect } from "react";
import styled from "styled-components";
import { LibraryTabs } from "../shared/Library";

import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";

import { AddNftContent } from "./AddNftContent";
import { AddAnyNftContent } from "./AddAnyNftAsset";
import { useAssetsContext } from "@features/studio/EditWorldMenu/context/AssetsContext";
import { useWalletContext } from "@features/studio/EditWorldMenu/context/WalletContext";
import { fetchAssetById } from "@utils/fetchAssets";
import { formatAsset } from "@utils/formatAssets";
import { NftOpt } from "../shared/AssetTypes";
import { classes } from "@utils/js";
import { useEventCallback } from "@components/hooks/useEventCallback";

const NftsTabs = [
    {
        title: "Wallet",
        value: "owned",
    },
    // {
    //     title: "Minted",
    //     value: "created",
    // },
    {
        title: "Link",
        value: "any",
    },
];

export function AddNft() {
    //
    const { exhibit } = useEditWorld();

    const [activeTab, setActiveTab] = useState("owned");

    const { handleAddNft, handleDragStart, query, setQuery, addTogglerRef } =
        useEditWorld();

    const { currentWalletId, currentWalletType } = useWalletContext();

    const {
        currentUserAssets,
        assetsByStatus,
        currentUserStatus,
        currentRepo,
        setAssetsState,
    } = useAssetsContext();

    if (process.env.NODE_ENV === "development") {
        useEffect(() => {
            async function addAsset(e: KeyboardEvent) {
                // console.log("key event", e);
                if (!e.repeat && e.shiftKey && e.key.toLowerCase() === "t") {
                    let input = prompt("Enter NFT address/token-id");

                    if (input == null) return;

                    const [address, tokenId] = input.split("/");

                    if (address && tokenId) {
                        try {
                            const result = await fetchAssetById(
                                currentWalletId,
                                address,
                                tokenId
                            );

                            if (result.success) {
                                const asset = formatAsset(result.asset);
                                handleAddNft({ asset, keepPlaceholder: true });
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
            }

            window.addEventListener("keydown", addAsset);

            return () => {
                window.removeEventListener("keydown", addAsset);
            };
        }, []);
    }

    const togglerRef = (el) => addTogglerRef(NftOpt.value, el);

    const handleOwnership = useEventCallback((value) => {
        setActiveTab(value);

        setAssetsState({ currentUserStatus: value });
    }, []);

    let loadingContent = null;

    return (
        <Container>
            {loadingContent}

            <LibraryTabs role="group" aria-label="NFT source">
                {NftsTabs.map(({ title, value }) => (
                    <button
                        type="button"
                        aria-pressed={activeTab === value}
                        className={classes({
                            "tab-item": true,
                            active: activeTab === value,
                        })}
                        key={value}
                        onClick={() => handleOwnership(value)}
                    >
                        {title}
                    </button>
                ))}
            </LibraryTabs>

            <div className="previews">
                {activeTab === "any" ? (
                    <AddAnyNftContent togglerRef={togglerRef} />
                ) : (
                    <AddNftContent
                        query={query}
                        togglerRef={togglerRef}
                        onAddFromLink={() => handleOwnership("any")}
                    />
                )}
            </div>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    min-height: 100%;

    & > .previews {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding-top: 12px;
    }
`;
