import { useEventCallback } from "@components/hooks/useEventCallback";
import Icon from "@components/Icon";
import IconImg from "@ui/components/IconImg";
import Spinner from "@ui/components/Spinner";
import { FetchedAsset } from "@uitypes/Asset";
import { current } from "immer";
import React, { useContext, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { libraryCard } from "../shared/Library";
import { AssetPreview } from "../shared/AssetPreview";
import { useWalletContext } from "../../context/WalletContext";
import { UserContext } from "@components/context/UserContext";
const IS_MOBILE =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;
const getNftId = (asset) => `${asset?.token_address}/${asset?.token_id}`;
import { noop } from "@utils/js";

let initSelectState = {
    startAsset: null,
    endAsset: null,
    isSelectEvent: false,
    shouldClear: false,
};

let initCoords = { sx: 0, sy: 0, ex: 0, ey: 0 } as const;

const MOUSE_DOWN_SELECT_DELAY = 1000;

function relativeCoords(event, parent: HTMLElement) {
    //
    let cBounds = parent.getBoundingClientRect();

    return {
        x: event.clientX - cBounds.left + parent.scrollLeft,
        y: event.clientY - cBounds.top + parent.scrollTop,
    };
}

export function AssetListView({
    addState = { nft: {} },
    placedAssets = {},
    preprocessNftAsset = async ({ asset, ..._rest }: any) => asset,
    shownAssets,
    selectedAssets,
    setSelectedAssets,
    handleAssetClick,
    handleAssetDrag,
    showImage,
    size = "small",
    handleLoadMore = noop,
    isLoadMore = false,
}) {
    //
    const { user } = useContext(UserContext);

    const observerTarget = useRef(null);

    const { currentWalletId } = useWalletContext();

    const containerRef = useRef<HTMLDivElement>();
    const selBox = useRef<HTMLDivElement>();

    const imagesRefs = useRef(new Map<string, HTMLElement>());

    const selectState = useRef(initSelectState);

    const selectTimeout = useRef(null);

    const coords = useRef({ sx: 0, sy: 0, ex: 0, ey: 0 });

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                //
                handleLoadMore();
            }
        });

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [observerTarget]);

    const updateSelection = useEventCallback(() => {
        //
        let cBounds = containerRef.current.getBoundingClientRect();

        let dragCoords = coords.current;

        let sx = Math.min(dragCoords.sx, dragCoords.ex);
        let ex = Math.max(dragCoords.sx, dragCoords.ex);
        let sy = Math.min(dragCoords.sy, dragCoords.ey);
        let ey = Math.max(dragCoords.sy, dragCoords.ey);

        selBox.current.style.left = `${sx}px`;
        selBox.current.style.top = `${sy}px`;
        selBox.current.style.width = `${ex - sx}px`;
        selBox.current.style.height = `${ey - sy}px`;

        const { startAsset, endAsset } = selectState.current;

        const minAsset = Math.min(startAsset, endAsset);
        const maxAsset = Math.max(startAsset, endAsset);

        const columns =
            getComputedStyle(containerRef.current)
                .gridTemplateColumns.split(" ")
                .filter(Boolean).length || 1;
        let minRow = Math.floor(minAsset / columns);
        let minCol = minAsset % columns;

        let maxRow = Math.floor(maxAsset / columns);
        let maxCol = maxAsset % columns;

        if (maxCol < minCol) {
            [maxCol, minCol] = [minCol, maxCol];
        }

        setSelectedAssets(
            shownAssets.filter((asset, idx) => {
                //
                let row = Math.floor(idx / columns);
                let col = idx % columns;

                return (
                    row >= minRow &&
                    row <= maxRow &&
                    col >= minCol &&
                    col <= maxCol
                );
            })
        );
    }, []);

    const resetSelectState = useEventCallback(() => {
        //
        clearTimeout(selectTimeout.current);
        selectState.current = initSelectState;
        coords.current = initCoords;
        selBox.current.style.visibility = "hidden";
        //
    }, []);

    const handlePointerDown = useEventCallback(
        (assetIdx: number, e: React.PointerEvent<HTMLElement>) => {
            if (IS_MOBILE) return;
            //
            if (selectState.current.isSelectEvent) {
                //
                selectState.current.shouldClear = true;
                //
            } else {
                //
                selectState.current = {
                    ...selectState.current,
                    startAsset: assetIdx,
                };

                selectTimeout.current = setTimeout(() => {
                    //

                    const { x, y } = relativeCoords(e, containerRef.current);

                    selectState.current.isSelectEvent = true;
                    selectState.current.endAsset = assetIdx;
                    coords.current = {
                        sx: x,
                        sy: y,
                        ex: x,
                        ey: y,
                    };
                    selBox.current.style.visibility = "visible";
                    // console.log("enter select mode");

                    updateSelection();
                    //
                }, MOUSE_DOWN_SELECT_DELAY);
            }
        },
        []
    );

    const handlePointerUp = useEventCallback(
        (assetIdx: number, e: React.PointerEvent<HTMLElement>) => {
            if (IS_MOBILE) return;

            //
            if (!selectState.current.isSelectEvent) {
                //
                resetSelectState();
                handleAssetClick(shownAssets[assetIdx], e);
            } else if (selectState.current.shouldClear) {
                //
                resetSelectState();
            }
        },
        []
    );

    const handlePointerMove = useEventCallback(
        (
            assetIdx: number,
            e: React.PointerEvent<HTMLElement> | React.WheelEvent<HTMLElement>
        ) => {
            //
            if (IS_MOBILE) return;

            // console.log("pointerMove", e, selectState.current.isSelectEvent);
            if (selectState.current.isSelectEvent) {
                //

                selectState.current.endAsset = assetIdx;

                const { x, y } = relativeCoords(e, containerRef.current);

                coords.current.ex = x;
                coords.current.ey = y;

                updateSelection();
            }
        },
        []
    );

    const handlePointerEnter = useEventCallback(
        (assetIdx: number, e: React.PointerEvent<HTMLElement>) => {
            //
            if (IS_MOBILE) return;

            const asset = shownAssets[assetIdx];

            // console.log("AddNft/preprocessNftAsset start");

            // Predictive Preloading of NFT data (refetch for minted, media info checking)
            // This allows faster loading of NFTs when they are added to the world
            preprocessNftAsset({
                asset,
                userId: user.id,
                walletId: currentWalletId,
            });
            // .then((asset) => {
            //     //
            //     console.log("AddNft/preprocessNftAsset end");
            // });
        },
        []
    );

    useEffect(() => {
        //
        function handleKeyPress(e: KeyboardEvent) {
            //

            if (
                !e.repeat &&
                e.key === "Escape" &&
                selectState.current.isSelectEvent
            ) {
                //
                resetSelectState();
                setSelectedAssets([]);
            }
        }

        window.addEventListener("keydown", handleKeyPress);

        return () => {
            //
            window.removeEventListener("keydown", handleKeyPress);
        };
    }, []);

    return (
        <Container className="y-scroll" size={size} ref={containerRef}>
            <div
                ref={selBox}
                className="sel-box"
                style={{ visibility: "hidden", zIndex: 1 }}
            />

            {shownAssets.map((asset, index) => {
                //

                const key = getNftId(asset);

                const name =
                    asset?.name ||
                    `${asset?.collection?.name} ${asset?.token_id}`;

                const isSelected = selectedAssets.find((it) => it === asset);

                const isSubmitting =
                    addState.nft[key]?.state?.type === "Submitting";

                const isPlaced = placedAssets[key];

                return (
                    <ArtworkWrapper
                        role="button"
                        tabIndex={isSubmitting ? -1 : 0}
                        aria-label={`Add ${name}`}
                        aria-disabled={isSubmitting}
                        aria-pressed={!!isSelected}
                        onKeyDown={(e) => {
                            if (
                                !isSubmitting &&
                                (e.key === "Enter" || e.key === " ")
                            ) {
                                e.preventDefault();
                                handleAssetClick(asset, e as any);
                            }
                        }}
                        size={size}
                        isSelected={isSelected}
                        isRound={asset?.blockchain === "xdai"}
                        ref={(el) => {
                            //
                            imagesRefs.current.set(key, el);
                        }}
                        onPointerDown={(e) => {
                            if (
                                isSubmitting ||
                                (e.pointerType === "mouse" && e.button !== 0)
                            ) {
                                return;
                            }
                            handlePointerDown(index, e);
                        }}
                        onPointerUp={(e) => {
                            if (
                                isSubmitting ||
                                (e.pointerType === "mouse" && e.button !== 0)
                            ) {
                                return;
                            }
                            handlePointerUp(index, e);
                        }}
                        onPointerMove={(e) => {
                            handlePointerMove(index, e);
                        }}
                        onPointerEnter={(e) => {
                            //
                            handlePointerEnter(index, e);
                        }}
                        onClick={(e) => {
                            if (IS_MOBILE && !isSubmitting) {
                                handleAssetClick(shownAssets[index], e);
                            }
                        }}
                        key={index}
                    >
                        <div
                            data-asset={key}
                            className="preview-img-wrapper"
                            draggable={true}
                            onDragStart={(e) => {
                                if (
                                    isSubmitting ||
                                    selectState.current.isSelectEvent
                                ) {
                                    e.preventDefault();
                                    return;
                                }

                                clearTimeout(selectTimeout.current);
                                handleAssetDrag(
                                    asset,
                                    e,
                                    preprocessNftAsset({
                                        asset,
                                        userId: user.id,
                                        walletId: currentWalletId,
                                    })
                                );
                            }}
                        >
                            {isSubmitting && (
                                <div className="loader">
                                    <Spinner />
                                </div>
                            )}
                            {showImage ? (
                                <AssetPreview
                                    key={key}
                                    asset={asset}
                                    name={name}
                                    index={index}
                                />
                            ) : (
                                <div className="mime-type">
                                    {asset.mime_type}
                                </div>
                            )}
                        </div>
                        <p className="title">{name} </p>

                        {isSelected ? (
                            <Notice placement="right">
                                <IconImg
                                    size={16}
                                    name="check"
                                    style={{ filter: "invert(1)" }}
                                />
                            </Notice>
                        ) : (
                            asset.incompatible && (
                                <Notice placement="left">
                                    Incompatible Format
                                </Notice>
                            )
                        )}
                        {isPlaced && (
                            <Notice placement="left">
                                <IconImg size={16} name="check-white-bg" />
                            </Notice>
                        )}
                    </ArtworkWrapper>
                );
            })}

            <div ref={observerTarget} />

            <div className="full-width">
                {isLoadMore && (
                    <div className="load-more">
                        <Spinner width={20} />
                    </div>
                )}
            </div>
        </Container>
    );
}

const Container = styled.div<{ size: string }>`
    position: relative;
    display: grid;
    grid-template-columns: repeat(
        ${(props) => (props.size === "large" ? 1 : 4)},
        minmax(0, 1fr)
    );
    align-content: start;
    gap: var(--studio-grid-gap);

    @media (max-width: 600px) {
        height: 100%;
        grid-template-columns: repeat(
            ${(props) => (props.size === "large" ? 1 : 4)},
            minmax(0, 1fr)
        );
    }

    & > .sel-box {
        position: absolute;
        top: 0;
        left: 0;
        border: 1px solid var(--studio-muted);
        background: var(--studio-hover);
        opacity: 0.5;
        pointer-events: none;
    }

    .full-width {
        grid-column: 1 / -1;
    }

    .load-more {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        height: ${(props) => (props.size === "large" ? "112px" : "74px")};
    }

    .preview-img,
    .preview-vid {
        width: 100%;
        position: absolute;
        height: 100%;
        object-fit: cover;
        background: var(--studio-inset);
    }
`;

const Notice = styled.span<{ placement: "left" | "right" }>`
    position: absolute;
    top: 6px;
    ${(props) => (props.placement === "left" ? "left: 6px;" : "right: 8px;")}
`;

const ArtworkWrapper = styled.div<{
    isSelected: boolean;
    isRound: boolean;
    size: string;
}>`
    position: relative;
    display: flex;
    flex-direction: column;
    ${libraryCard}
    gap: var(--studio-grid-gap);
    border-color: ${(p) =>
        p.isSelected ? "var(--studio-muted)" : "var(--studio-line)"};

    &:hover {
        opacity: 1;
        .title {
            color: var(--nft-ink, #eeeeef);
        }
        .preview-img-wrapper {
            border-color: var(--studio-muted);
        }
    }

    & > .preview-img-wrapper {
        position: relative;
        width: 100%;
        aspect-ratio: ${(props) => (props.size === "large" ? "8 / 7" : "1")};
        border-radius: ${(props) =>
            props.isRound ? "50%" : "var(--studio-radius-preview)"};
        background: var(--studio-inset);

        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;

        border: 1px solid var(--studio-line);
        transition: border-color 150ms ease;

        & > .loader {
            position: absolute;
            z-index: 1;
        }

        & > .mime-type {
            width: 100%;
            height: 100%;
            object-fit: cover;
            background: var(--studio-inset);
            display: flex;
            align-items: center;
            justify-content: center;
        }
    }

    & > .title {
        margin: 0;
        font-weight: 400;
        font-size: 11px;
        line-height: 15px;
        padding: 1px 2px 3px;
        color: var(--studio-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;

        @media (max-width: 600px) {
            max-width: 100%;
        }
    }
`;
