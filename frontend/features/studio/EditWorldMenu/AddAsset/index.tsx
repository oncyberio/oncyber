import {
    AssetDock as Container,
    AssetDockShell,
    AssetDockButton as CmdButton,
} from "./AddAssetLayout/AssetDock";
import React, { useEffect, useState, useRef, useContext } from "react";
import styled, { css } from "styled-components";

import { useEventCallback } from "@components/hooks/useEventCallback";
import {
    AddAssetOpts,
    assetDockOptions,
    AssetOption,
    AssetType,
    ComponentsOpt,
    KitbashOpt,
    NftOpt,
    UploadOpt,
} from "./shared/AssetTypes";
import { AddAvatars } from "./Avatars";
import { AddNft } from "./Nft";
import { AddUpload } from "./Upload";
import { AddPortal } from "./Portal";
import { AddYoutube } from "./Youtube";
import { AddText } from "./Text";
import { AddIframe } from "./Iframe";
import { AddAssetLayout } from "./AddAssetLayout";
import { AssetIcon } from "./shared/AssetIcon";
import {
    isEditableMesh,
    isOptEnabledForMesh,
} from "@features/studio/EditWorldMenu/utils";
import { useEditWorld } from "../context/WorldEditContext";
import { EditAsset } from "./EditAsset";
import {
    useCoordsChangeHandler,
    useSelectedMeshEvents,
} from "../hooks/worldHooks";
import { useHotkey } from "@components/hooks/useHotkey";
import { useUndoManager } from "../hooks/useUndoManager";
import { classes } from "@utils/js";
import useAIEditController from "@features/studio/components/AIEditController";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import TriggerZone from "./TriggerZone";
import GlobalStream from "./GlobalStream";
import { UserContext } from "@components/context/UserContext";
import { useAI } from "@features/ai/context/AIContext";
import dynamic from "next/dynamic";
import { EditContextMenu } from "../EditContextMenu";
import { WorldEditor } from "./WorldEditor";
import AssetsContent from "@features/onboarding/Studio/Tuto/AssetsContent";
import { WorldListView } from "./WorldEditor/WorldListView";
import { currentOpt } from "../context/editWorldReducer";
import { shouldDisplayNFTs } from "@features/studio/utils";
import { TYPES } from "@3factory/artwork/constants";
import { ArtworkData } from "@uitypes/experience";
import { useScreenSize } from "@components/hooks/useScreenSize";
import Tooltip from "@ui/components/Tooltip";
import { DELETE_KEY } from "@components/_3DExhibit-v2/three/constants";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";
import { useScriptEditorStore } from "./shared/ScriptEditor/ScriptEditorStore";

const ScriptEditor = dynamic(() => import("./shared/ScriptEditor"), {
    ssr: false,
});

const componentMap: Record<AssetType, (arg) => React.ReactNode> = {
    avatar: () => <AddAvatars />,
    component: () => <WorldEditor tab="Scene" />,
    kitbash: () => <WorldEditor tab="Kits" />,
    nft: () => <AddNft />,
    upload: () => <AddUpload />,
    portal: () => <AddPortal isElevator={false} />,
    youtube: () => <AddYoutube />,
    text: (onClose) => <AddText onClose={onClose} />,
    triggerZone: () => <TriggerZone />,
    globalStream: () => <GlobalStream />,
    iframe: () => <AddIframe />,
    // placedAssets: () => <PlacedAssets />,
};

export function AddAsset() {
    //

    const containerRef = useRef<HTMLDivElement>();

    const [isShowMore, toggleShowMore] = useState(false);

    const { userData, isAnonymous } = useContext(UserContext);

    const {
        scope,
        destination,
        uiState,
        uiDispatch,
        selectedItems,
        handleDuplicate,
        handleDeleteSelection,
        handleDeleteItems,
        handleAddText,
        selectedMesh,
        baseAnalyticsEvent,
        transformMode,
        toggleTransformMode,
        clickRef,
        addTogglerRef,
    } = useEditWorld();

    const editableMesh = isEditableMesh(selectedMesh) ? selectedMesh : null;

    const isFutureMenu = true; // destination.isFuture;

    useSelectedMeshEvents(isFutureMenu);

    useCoordsChangeHandler();

    useUndoManager();

    const { isShowing } = useAI({});

    useAIEditController();

    let activeOpt: AssetOption = currentOpt(uiState);

    let isCollapsed = uiState.type !== "UNFOLDED";

    const setActiveOpt = useEventCallback((option: AssetOption) => {
        //
        if (option === activeOpt) return;

        if (option == null) {
            //
            uiDispatch({ type: "opt-off" });
        } else {
            //

            uiDispatch({ type: "opt-on", option });
        }
    }, []);

    const scriptEditorStore = useScriptEditorStore();

    const { onboarding } = useOnboarding();

    const { width } = useScreenSize();

    const isMobile = width <= 600;

    useEffect(() => {
        if (window.innerWidth <= 600 && !isShowMore) {
            toggleShowMore(true);
        }
    }, [isMobile, isShowMore]);

    useEffect(() => {
        if (destination?.isFuture && !onboarding?.studio) {
            const isAnon = !shouldDisplayNFTs(userData) || isAnonymous;
            setActiveOpt(
                orderedAssets.find((s) =>
                    isAnon ? s === UploadOpt : s === NftOpt
                )
            );
        }
    }, [onboarding?.studio, destination?.slug]);

    useHotkey((e: KeyboardEvent) => {
        //

        if (!e.repeat && (e.ctrlKey || e.metaKey) && e.key === "e") {
            //
            e.preventDefault();

            scriptEditorStore.toggle(true);
        }

        if (
            !e.repeat &&
            (e.ctrlKey || e.metaKey) &&
            (e.key === "d" || e.key === "D")
        ) {
            //
            e.preventDefault();

            if (
                editableMesh?.isArtwork ||
                editableMesh?.isKitBash ||
                editableMesh?.isPortal
            ) {
                handleDuplicate({
                    targetMeshes: [editableMesh],
                    source: "shortcut",
                    autoSelect: true,
                });
            }
        }

        if (e.repeat || e.metaKey || e.ctrlKey || e.shiftKey) return;

        e.preventDefault();

        const opt = AddAssetOpts.filter((opt) => !opt.hidden).find((it) => {
            // @ts-ignore
            return it.key === e.key?.toUpperCase();
        });

        if (opt && false) {
            //s
            handleOptClick(opt, e.shiftKey);

            // if (opt.value !== "placedAssets") {
            //     //
            //     amplitude_logAnalyticsEvent("trigger_add_asset", {
            //         ...baseAnalyticsEvent,
            //         source: "shortcut",
            //         type: opt.value,
            //     });
            // }
            //
        } else if (e.key === DELETE_KEY) {
            //
            if (selectedItems.length > 0) {
                //
                handleDeleteSelection({
                    source: "shortcut",
                });
            }
        } else if (e.key === "t" || e.key === "T") {
            //
            if (transformMode !== "snap") {
                //
                toggleTransformMode();
            }
        }
    });

    const isAddingText = useRef(false);

    const lastAddTextPayload = useRef<ArtworkData>(null);

    const isLastAddedEmptyText = (mesh) => {
        return (
            mesh != null &&
            mesh.mediaType === TYPES.CYBER_TEXT &&
            !mesh?.userData?.text &&
            mesh?.userData?.id === lastAddTextPayload.current?.data?.id
        );
    };

    const handleOptClick = async (opt: AssetOption, isShift: boolean) => {
        //

        if (activeOpt === opt) {
            //
            setActiveOpt(null);
            //
        } else {
            //
            if (opt.value === "text") {
                //
                if (isAddingText.current || isLastAddedEmptyText(selectedMesh))
                    return;

                //
                setActiveOpt(null);

                isAddingText.current = true;

                await handleAddText(
                    {
                        text: "",
                        keepPlaceholder: isShift,
                        autoSelect: true,
                    },
                    (res) => {
                        lastAddTextPayload.current = res;
                    }
                );

                isAddingText.current = false;
            } else {
                //
                setActiveOpt(opt);

                if (isLastAddedEmptyText(selectedMesh)) {
                    //
                    handleDeleteSelection();
                }
            }

            if (opt === KitbashOpt) {
                amplitude_logAnalyticsEvent("trigger_add_kit_asset", {
                    ...baseAnalyticsEvent,
                    source: "click",
                    type: opt.value,
                });
            } else if (opt === ComponentsOpt) {
                //
                amplitude_logAnalyticsEvent("trigger_world_components", {
                    ...baseAnalyticsEvent,
                    source: "click",
                    type: opt.value,
                });
            } else {
                amplitude_logAnalyticsEvent("trigger_add_asset", {
                    ...baseAnalyticsEvent,
                    source: "click",
                    type: opt.value,
                });
            }
        }
    };

    const handleCloseActiveOpt = useEventCallback(() => {
        //
        setActiveOpt(null);
    }, []);

    useEffect(() => {
        //
        const mesh = selectedMesh;

        if (isLastAddedEmptyText(mesh)) {
            //
            return () => {
                //
                if (isLastAddedEmptyText(mesh)) {
                    //
                    handleDeleteItems([mesh]);

                    lastAddTextPayload.current = null;
                }
            };
        }
    }, [selectedMesh]);

    let content = null;

    if (activeOpt) {
        //
        content = (
            <div className="details" ref={clickRef}>
                <AddAssetLayout
                    option={activeOpt}
                    onClose={handleCloseActiveOpt}
                >
                    {componentMap[activeOpt.value](handleCloseActiveOpt)}
                </AddAssetLayout>
            </div>
        );
    } else if (!isFutureMenu && editableMesh != null) {
        //
        content = (
            <div className="details">
                <EditAsset mesh={editableMesh} />
            </div>
        );
    } else if (uiState.type === "IDLE") {
        //
    } else if (uiState.type === "UNFOLDED") {
        // show title besides icons
    }

    const orderedAssets = assetDockOptions(isMobile, true);

    const contentOpts = orderedAssets
        .slice(0, isMobile || isShowMore ? orderedAssets.length : 5)
        .filter((it) => {
            //
            if (
                scope === "uploader" &&
                it !== KitbashOpt &&
                it !== ComponentsOpt
            )
                return false;

            if (it === KitbashOpt && !destination.isFuture) return false;

            return true;
        });

    return (
        //
        <Container
            ref={containerRef}
            isCollapsed={isCollapsed}
            activeOpt={activeOpt?.value}
            isEditableMesh={editableMesh !== null}
            isSelectedMesh={selectedMesh !== null}
        >
            {scriptEditorStore.state.isOpen && (
                <ScriptEditor onClose={() => scriptEditorStore.toggle(false)} />
            )}

            <EditContextMenu />

            {isFutureMenu && <WorldListView></WorldListView>}

            <div className="floatbar">
                <AssetsContent />

                <AssetDockShell>
                    {contentOpts.map((it) => {
                        //
                        const isDisabled =
                            !isOptEnabledForMesh(it.value, selectedMesh) ||
                            //(it.value === "upload" && isAnonymous) ||
                            (it.value === "nft" &&
                                (!shouldDisplayNFTs(userData) || isAnonymous));

                        const active = activeOpt === it;

                        const tooltipText =
                            it.value === "nft" && isAnonymous
                                ? "Connect wallet to add NFTs"
                                : it.description;

                        return (
                            <div
                                key={it.value}
                                style={{ position: "relative" }}
                            >
                                <Tooltip
                                    text={tooltipText}
                                    orientation="right"
                                    isToggled={active}
                                >
                                    <CmdButton
                                        className={classes({
                                            active: !!active,
                                        })}
                                        type="button"
                                        aria-label={tooltipText}
                                        aria-pressed={
                                            it.value === "text"
                                                ? undefined
                                                : active
                                        }
                                        data-tool={it.value}
                                        $active={active}
                                        disabled={isDisabled}
                                        ref={(el) =>
                                            addTogglerRef(it.value, el)
                                        }
                                        onClick={(e) => {
                                            //
                                            if (!isDisabled) {
                                                handleOptClick(it, e.shiftKey);
                                            }
                                        }}
                                    >
                                        <span className="icon-circle">
                                            {it.icon}
                                        </span>
                                        {isMobile && (
                                            <span className="desc">
                                                <span className="title scrollbar-hidden">
                                                    {it.title}
                                                </span>
                                            </span>
                                        )}
                                    </CmdButton>
                                </Tooltip>
                            </div>
                        );
                    })}

                    {scope !== "uploader" && (
                        <CmdButton
                            className="more"
                            id="show-more"
                            type="button"
                            aria-label={
                                isShowMore ? "Show fewer tools" : "More tools"
                            }
                            title={
                                isShowMore ? "Show fewer tools" : "More tools"
                            }
                            aria-expanded={isShowMore}
                            onClick={() => {
                                amplitude_logAnalyticsEvent(
                                    isShowMore
                                        ? "collapse_asset_types"
                                        : "expand_asset_types",
                                    baseAnalyticsEvent
                                );

                                toggleShowMore((prevState) => !prevState);
                            }}
                        >
                            <span className="icon-circle">
                                <AssetIcon
                                    name={isShowMore ? "less" : "more"}
                                />
                            </span>
                        </CmdButton>
                    )}
                </AssetDockShell>

                {content}
            </div>
        </Container>
    );
}
