import { studioAction } from "@features/studio/styles/primitives";
import IconImg from "@ui/components/IconImg";
import {
    KeyboardEventHandler,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import styled from "styled-components";
import { SearchInput } from "../shared/SearchInput";
import { PanelTypeIcon } from "../shared/PanelTypeIcon";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useEditWorld } from "../../context/WorldEditContext";
import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import { EditAsset } from "../EditAsset";
import { classes, sleep } from "@utils/js";
import {
    SpaceItemTypes,
    SpaceItemsFilter,
    useSpaceItems,
    SpaceItemsOptions,
    mapOpts,
    SpaceItemInfo,
} from "./useSpaceItems";
import { SelectableDropdownMenu } from "@features/studio/components/SelectableDropdownMenu";
import { EditableMesh, isComponent3D } from "../../utils";
import { eachKey } from "@utils/js";
import { useEditableMesh } from "../../hooks/worldHooks";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";
import { FloatBtn } from "../shared/FloatBtn";
import Tooltip from "@ui/components/Tooltip";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { IconButton } from "@ui/components/IconButton";
import { MultiSelect } from "../EditAsset/MultiSelect";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { useStudioMenu } from "@features/studio/StudioMenu/context/StudioContext";

//

const filterOptions = SpaceItemsOptions;

type SelectAction = "toggle" | "range" | "set" | "focus";

function getShownItems(
    items: SpaceItemInfo[],
    collapsedGroups: Record<string, boolean>,
    result: SpaceItemInfo[]
) {
    //
    items.forEach((it) => {
        //
        result.push(it);

        if (!it.children?.length || collapsedGroups[it.id]) return;

        getShownItems(it.children, collapsedGroups, result);
    });

    return result;
}

export function WorldListView() {
    //
    const {
        handleDeleteItems,
        selectedItems,
        setSelectedItems,
        uiDispatch,
        undo,
        redo,
        editorState,
        exhibit,
    } = useEditWorld();

    console.log("editorState", editorState);

    const [isUndoActive, setUndoActive] = useState(true);

    const selectedMesh = useEditableMesh();

    const [isCollapsed, setIsCollapsed] = useState(true);

    const [query, setQuery] = useState("");

    const [filter, setFilter] = useState<SpaceItemsFilter>(() =>
        mapOpts(() => true)
    );

    const { setShowToolbar } = useOnboarding();

    const { filteredGroups, filteredItems, hasType, total } = useSpaceItems(
        query,
        filter
    );

    const [collapsedGroups, setCollapsedGroups] = useState<
        Record<string, boolean>
    >({});

    const toggleCollapsedGroup = (id: string, b?: boolean) => {
        //
        setCollapsedGroups((prev) => ({
            ...prev,
            [id]: b ?? !prev[id],
        }));
    };

    const shownItems = useMemo(() => {
        //
        return getShownItems(filteredGroups, collapsedGroups, []);
    }, [filteredGroups, collapsedGroups]);

    const [selectedGroups, _setASelectedGroups] = useState<
        Record<string, boolean>
    >({});

    const setSelection = (items: SpaceItemInfo[], toggleCollapse = false) => {
        //
        let selGroups: Record<string, boolean> = {};

        let selItems = [];

        items.forEach((it) => {
            //
            if (it.item != null) {
                //
                selItems.push(it.item);
            } else {
                //
                selGroups[it.id] = true;
            }
        });

        _setASelectedGroups(selGroups);

        setSelectedItems(selItems);

        if (toggleCollapse) {
            //
            setCollapsedGroups((prev) => {
                //
                const next = { ...prev };

                items.forEach((it) => {
                    //
                    if (it.group == null) return;

                    next[it.group] = false;
                });

                return next;
            });
        }
    };

    const isSelected = (item: SpaceItemInfo) => {
        //
        if (item.item != null) {
            //
            return item.item.isSelected;
        }

        return selectedGroups[item.id];
    };

    const scenePanelRef = useRef<HTMLDivElement>(null);

    const world = useWorld();

    const kbSelectionState = useRef({
        startIndex: -1,
        endIndex: -1,
    });

    // window.$$kbs = kbSelectionState;

    const nextSelectedItem = useRef<string>();

    const onKeyDown = useEventCallback<KeyboardEventHandler>((event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setIsCollapsed(true);
            requestAnimationFrame(() =>
                containerRef.current
                    ?.querySelector<HTMLButtonElement>(
                        '[aria-label="World contents"]'
                    )
                    ?.focus()
            );
            return;
        }
        if (
            (event.target as HTMLElement).matches(
                "input, textarea, [contenteditable=true]"
            )
        )
            return;
        if (!shownItems.length) return;
        if (
            !event.repeat &&
            (event.key === "f" || event.key === "F") &&
            selectedMesh != null
        ) {
            world.current.focusOn({ component: selectedMesh });

            return;
        }

        //
        // on arrow down find next selectable item on shownItems
        // on arrow up find prev selectable item on shownItems
        let idx = shownItems.findLastIndex(isSelected);

        const maxIdx = shownItems.length - 1;

        let { startIndex, endIndex } = kbSelectionState.current;

        const activeItem = shownItems[endIndex];

        if (event.key === "ArrowDown") {
            //
            event.preventDefault();

            event.stopPropagation();

            if (event.shiftKey) {
                //
                endIndex = Math.min(endIndex + 1, maxIdx);
                //
            } else {
                //
                idx = Math.min(idx + 1, maxIdx);

                startIndex = idx;

                endIndex = idx;
            }

            nextSelectedItem.current = shownItems[endIndex].id;

            //
        } else if (event.key === "ArrowUp") {
            //
            event.preventDefault();

            event.stopPropagation();

            if (event.shiftKey) {
                //
                endIndex = Math.max(endIndex - 1, 0);
                //
            } else {
                //
                idx = Math.max(idx - 1, 0);

                startIndex = idx;

                endIndex = idx;
            }

            nextSelectedItem.current = shownItems[endIndex].id;
            //
        } else if (
            event.key === "ArrowRight" &&
            activeItem?.children?.length > 0
        ) {
            //
            event.preventDefault();

            event.stopPropagation();

            toggleCollapsedGroup(activeItem.id, false);

            return;
            //
        } else if (
            event.key === "ArrowLeft" &&
            activeItem?.children?.length > 0
        ) {
            //
            event.preventDefault();

            event.stopPropagation();

            toggleCollapsedGroup(activeItem.id, true);

            return;
        }

        kbSelectionState.current.startIndex = startIndex;

        kbSelectionState.current.endIndex = endIndex;

        const start = Math.min(startIndex, endIndex);

        const end = Math.max(startIndex, endIndex);

        const items = shownItems.slice(start, end + 1);

        setSelection(items, true);
    }, []);

    useEffect(() => {
        //
        if (nextSelectedItem.current == null) return;

        const dom = document.getElementById(nextSelectedItem.current);

        if (dom == null) return;

        // scroll to make it visible
        dom.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
        });

        nextSelectedItem.current = null;
        //
    }, [nextSelectedItem.current]);

    const containerRef = useRef<HTMLDivElement>(null);

    const ctxMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setShowToolbar(isCollapsed && selectedMesh === null);
    }, [selectedMesh, isCollapsed]);

    const handleSelect = async (item: SpaceItemInfo, action: SelectAction) => {
        //

        if (action === "focus") {
            //
            if (item.item == null) return;

            world.current.focusOn({ component: item.item });

            return;
        }

        const idx = shownItems.findIndex((it) => it === item);

        if (action === "set") {
            //
            setSelection([item]);

            kbSelectionState.current.startIndex = idx;

            kbSelectionState.current.endIndex = idx;

            //
        } else if (action === "toggle") {
            //
            let items;

            if (isSelected(item)) {
                //
                items = shownItems.filter(
                    (it) => item !== it && isSelected(it)
                );

                const idx = items.length
                    ? shownItems.findIndex(
                          (it) => it === items[items.length - 1]
                      )
                    : -1;

                kbSelectionState.current.startIndex = idx;

                kbSelectionState.current.endIndex = idx;
            } else {
                //
                items = shownItems.filter(
                    (it) => item === it || isSelected(it)
                );

                kbSelectionState.current.startIndex = idx;

                kbSelectionState.current.endIndex = idx;
            }

            setSelection(items);
            //
        } else if (action === "range") {
            //
            let lastSelectedIdx = kbSelectionState.current.startIndex;

            if (lastSelectedIdx === -1) {
                //
                lastSelectedIdx = shownItems.findIndex(isSelected);
            }

            if (lastSelectedIdx === -1) {
                //
                setSelection([item]);

                kbSelectionState.current.startIndex = idx;

                kbSelectionState.current.endIndex = idx;
            } else {
                //
                const start = Math.min(idx, lastSelectedIdx);

                const end = Math.max(idx, lastSelectedIdx);

                kbSelectionState.current.startIndex ??= lastSelectedIdx;

                kbSelectionState.current.endIndex = idx;

                setSelection(shownItems.slice(start, end + 1));
            }
        }
    };

    const handleDelete = async (component: EditableMesh) => {
        //
        return handleDeleteItems([component], { source: "ListView" });
    };

    const handleBack = () => setSelectedItems([]);

    useEffect(() => {
        if (!isCollapsed) scenePanelRef.current?.focus();
    }, [isCollapsed]);

    const handleDone = () => {
        setSelectedItems([]);
        uiDispatch({ type: "opt-off" });
    };

    const handleUndo = useEventCallback(() => {
        setUndoActive(true);
        undo();
    }, []);

    const handleRedo = useEventCallback(() => {
        setUndoActive(false);
        redo();
    }, []);

    let content = null;

    if (isCollapsed) {
        //
        content = (
            <Tooltip
                text="Manage Assets & Components"
                isToggled={!isCollapsed}
                orientation="left"
            >
                <FloatBtn
                    icon="layers"
                    onClick={() => {
                        amplitude_logAnalyticsEvent("open_asset_list", {
                            exhibitId: exhibit.id,
                            ownerId: exhibit.owner,
                            collab: exhibit.editors?.length > 1,
                            destination: exhibit.info?.room,
                            exhibitName: exhibit.info?.headline,
                            number_of_artworks: Object.keys(
                                exhibit.artworks || {}
                            ).length,
                        });

                        setIsCollapsed(false);
                    }}
                    badge={total}
                />
            </Tooltip>
        );
    } else {
        content = (
            <ScenePanel
                data-studio-surface
                role="region"
                aria-label="World contents"
                tabIndex={0}
                ref={(el) => {
                    // console.log("scenePanel ref", el);
                    scenePanelRef.current = el;
                }}
                onKeyDown={onKeyDown}
            >
                <div className="sp-header">
                    <IconImg
                        name="layers"
                        size={16}
                        style={{ filter: "invert(0.9)" }}
                    />
                    <span>World contents</span>
                    <CollapseButton
                        type="button"
                        aria-label="Collapse world contents"
                        onClick={() => {
                            amplitude_logAnalyticsEvent("collapse_asset_list", {
                                exhibitId: exhibit.id,
                                ownerId: exhibit.owner,
                                collab: exhibit.editors?.length > 1,
                                destination: exhibit.info?.room,
                                exhibitName: exhibit.info?.headline,
                                number_of_artworks: Object.keys(
                                    exhibit.artworks || {}
                                ).length,
                            });
                            setIsCollapsed(true);
                        }}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="m6 7 5 5-5 5m7-10 5 5-5 5" />
                        </svg>
                    </CollapseButton>
                </div>
                <div className="sp-seacrh">
                    <SearchInput
                        style={{ flex: "1" }}
                        placeholder={"Search components..."}
                        value={query}
                        onChange={(val) => {
                            //
                            setQuery(val);

                            setCollapsedGroups((prev) => {
                                //
                                return eachKey(prev, () => false);
                            });
                        }}
                    />
                    <SelectableDropdownMenu
                        caption={filterCaption}
                        items={
                            filterOptions.filter(
                                (it) => hasType[it.value]
                            ) as any
                        }
                        value={Object.keys(filter).filter((it) => filter[it])}
                        onChange={(type) => {
                            //
                            setFilter((prev) => ({
                                ...prev,
                                [type]: !prev[type],
                            }));
                        }}
                    />
                </div>
                <div className="sp-list scrollbar">
                    {filteredGroups.map((it) => {
                        //
                        if (!it.children?.length) return null;

                        return (
                            <RenderGroup
                                key={it.id}
                                group={it}
                                collapsedGroups={collapsedGroups}
                                toggleCollapsedGroup={toggleCollapsedGroup}
                                isSelected={isSelected}
                                handleSelect={handleSelect}
                            >
                                {it.children.map((it) => {
                                    //
                                    return (
                                        <RenderItem
                                            key={it.id}
                                            item={it}
                                            collapsedGroups={collapsedGroups}
                                            toggleCollapsedGroup={
                                                toggleCollapsedGroup
                                            }
                                            isSelected={isSelected}
                                            handleSelect={handleSelect}
                                            handleDelete={handleDelete}
                                        />
                                    );
                                })}
                            </RenderGroup>
                        );
                    })}
                </div>
            </ScenePanel>
        );
    }

    let details = null;

    if (selectedItems.length > 0) {
        //

        let ctxMenuContent = null;

        if (selectedMesh != null) {
            ctxMenuContent = (
                <>
                    <EditAsset mesh={selectedMesh} />

                    <div className="mobile-footer">
                        <div className="hr-mobile" />
                        <div className="controls">
                            <span onClick={handleBack}>Back</span>
                            <div className="center">
                                <IconButton
                                    name="undo-v2"
                                    size="small"
                                    className="undo-btn"
                                    onClick={handleUndo}
                                    style={{
                                        opacity: isUndoActive ? "1" : "0.5",
                                    }}
                                />
                                {editorState.undoIndex !==
                                    editorState.undoStack.length - 1 && (
                                    <IconButton
                                        name="redo"
                                        size="small"
                                        className="undo-btn"
                                        onClick={handleRedo}
                                        style={{
                                            opacity: !isUndoActive
                                                ? "1"
                                                : "0.5",
                                        }}
                                    />
                                )}
                            </div>
                            <span onClick={handleDone}>Done</span>
                        </div>
                    </div>
                </>
            );
        } else if (selectedItems.length > 1) {
            ctxMenuContent = <MultiSelect />;
        }

        details = (
            <CtxMenu
                ref={(el) => {
                    //
                    ctxMenuRef.current = el;
                }}
            >
                {ctxMenuContent}
            </CtxMenu>
        );
    }

    return (
        <Container
            ref={containerRef}
            className={classes({
                collapsed: isCollapsed,
                "has-details": !!details,
            })}
        >
            <WorldDock $collapsed={isCollapsed}>
                {["top", "bottom"].map((side) => (
                    <svg
                        key={side}
                        className={`wing wing-${side}`}
                        viewBox="0 0 18 18"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M18 0A18 18 0 0 1 0 18H18Z"
                            fill="currentColor"
                        />
                    </svg>
                ))}
                <div className="dock-content" key={String(isCollapsed)}>
                    {content}
                </div>
            </WorldDock>
            {details}
        </Container>
    );
}

function CollapseIcon({ isCollapsed, size = 16 }) {
    //
    const icon = isCollapsed ? "chevron-right" : "chevron-down";

    return (
        <IconImg name={icon} size={size} style={{ filter: "invert(0.7)" }} />
    );
}

function RenderGroup({
    group: it,
    isSelected,
    collapsedGroups,
    toggleCollapsedGroup,
    handleSelect,
    children,
}) {
    //

    const isCollapsed = collapsedGroups[it.id];

    return (
        <div className="sp-list-group">
            <div
                id={it.id}
                className={classes({
                    "sp-list-group-title": true,
                    "sp-selected": isSelected(it),
                })}
                onClick={(e) => {
                    //
                    toggleCollapsedGroup(it.id);

                    handleSelect(
                        it,
                        e.shiftKey
                            ? "range"
                            : e.metaKey || e.ctrlKey
                            ? "toggle"
                            : "set"
                    );
                }}
            >
                <CollapseIcon isCollapsed={isCollapsed} />
                <PanelTypeIcon className="sp-group-icon">
                    {it.icon}
                </PanelTypeIcon>
                <span>
                    {it.name} ({it.children.length})
                </span>
            </div>

            <div className="sp-list-group-items">
                {isCollapsed ? null : children}
            </div>
        </div>
    );
}

function RenderItem({
    indent = 0,
    item: it,
    collapsedGroups,
    toggleCollapsedGroup,
    isSelected,
    handleSelect,
    handleDelete,
}: {
    indent?: number;
    item: SpaceItemInfo;
    collapsedGroups: Record<string, boolean>;
    toggleCollapsedGroup?: (id: string) => void;
    isSelected: (it: SpaceItemInfo) => boolean;
    handleSelect: (it: SpaceItemInfo, action: SelectAction) => void;
    handleDelete: (it: EditableMesh) => void;
}) {
    //
    let children = it.children;

    let isGroup = children?.length > 0;

    let name = it.name + (isGroup ? " (" + it.children.length + ")" : "");

    const isCollapsed = isGroup && collapsedGroups[it.id];

    let selected = isSelected(it);

    let allSelected = isGroup && children.every(isSelected);

    const itemContent = (
        <div
            id={it.id}
            className={classes({
                "sp-item": true,
                "sp-selected": selected,
                "sp-all-selected": allSelected,
                "sp-group": isGroup,
            })}
            style={{ paddingLeft: 32 + indent * 12 }}
            onClick={(e) => {
                //
                e.stopPropagation();

                if (isGroup) {
                    //
                    toggleCollapsedGroup(it.id);
                }
                //
                handleSelect(
                    it,
                    e.shiftKey
                        ? "range"
                        : e.metaKey || e.ctrlKey
                        ? "toggle"
                        : "set"
                );
            }}
            onDoubleClick={(e) => {
                //
                e.stopPropagation();

                if (isGroup) return;

                handleSelect(it, "focus");
            }}
        >
            <div className="sp-item-img">
                <img src={it.image} width={20} height={20} />
            </div>
            <span className="sp-item-name">{name}</span>
            {it.hint && <span className="sp-item-hint">{it.hint}</span>}

            <div className="sp-item-actions">
                {!isGroup && !it.isRequired && (
                    <IconImg
                        className="sp-icon"
                        name="trash"
                        size={12}
                        onClick={(e) => {
                            //

                            e.stopPropagation();

                            if (it.isRequired) return;

                            handleDelete(it.item);
                        }}
                    />
                )}
                {isGroup && (
                    <CollapseIcon isCollapsed={isCollapsed} size={12} />
                )}
            </div>
        </div>
    );

    if (isGroup) {
        //
        return (
            <>
                {itemContent}
                {isCollapsed
                    ? null
                    : children.map((it) => {
                          //
                          return (
                              <RenderItem
                                  key={it.id}
                                  indent={indent + 1}
                                  item={it}
                                  collapsedGroups={collapsedGroups}
                                  toggleCollapsedGroup={toggleCollapsedGroup}
                                  isSelected={isSelected}
                                  handleSelect={handleSelect}
                                  handleDelete={handleDelete}
                              />
                          );
                      })}
            </>
        );
    } else {
        //
        return itemContent;
    }
}

const Container = styled.div`
    --edit-asset-top: 0;
    --right-panel-width: min(340px, calc(100vw - 12px));

    position: fixed;
    top: 102px;
    right: 6px;
    max-height: calc(100dvh - 124px);
    z-index: 1100;

    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
    &.collapsed {
        gap: 22px;
    }
    pointer-events: none;

    .tooltiptext {
        @media (max-width: 600px) {
            display: none;
        }
    }

    @media (max-width: 600px) {
        top: 98px;
        max-height: calc(100dvh - 180px);
        width: calc(100% - 12px);
        left: 0;
        right: 0;
        margin: auto;
    }

    user-select: none;
`;

const WorldDock = styled.div<{ $collapsed: boolean }>`
    position: relative;
    flex-shrink: 0;
    max-width: calc(100vw - 12px);
    width: ${(p) =>
        p.$collapsed
            ? "calc(var(--asset-tool-size, 45.9px) + 16px)"
            : "var(--right-panel-width)"};
    background: var(--studio-bg, #141416);
    color: var(--studio-bg, #141416);
    pointer-events: auto;
    transition: width 280ms cubic-bezier(0.22, 1, 0.36, 1);

    > .wing {
        display: ${(p) => (p.$collapsed ? "block" : "none")};
        position: absolute;
        right: 0;
        width: 18px;
        height: 18px;
        pointer-events: none;
    }
    > .wing-top {
        bottom: calc(100% - 1px);
    }
    > .wing-bottom {
        top: calc(100% - 1px);
        transform: scaleY(-1);
    }
    border-radius: ${(p) =>
        p.$collapsed ? "20px 0 0 20px" : "var(--studio-radius-panel, 16px)"};
    > .dock-content > [role="region"] {
        border-radius: var(--studio-radius-panel, 16px);
        border: 1px solid var(--studio-line, #303035);
        background: var(--studio-panel, #181818);
        box-shadow: var(--panel-shadow);
    }
    > .dock-content {
        padding: ${(p) => (p.$collapsed ? "8px" : "0")};
        animation: world-contents-in 220ms ease both;
    }
    button[aria-label="World contents"] {
        width: var(--asset-tool-size, 45.9px);
        height: var(--asset-tool-size, 45.9px);
        border-radius: var(--asset-tool-radius, 12px);
    }
    @keyframes world-contents-in {
        from {
            opacity: 0;
            transform: translateX(8px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    @media (max-width: 600px) {
        max-width: calc(100vw - 12px);
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
        > .dock-content {
            animation: none;
        }
    }
`;

const FilterBtn = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--studio-surface);
    width: 32px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
`;

const filterCaption = (
    <FilterBtn>
        <IconImg name="filter-2" size={16} style={{ filter: "invert(0.7)" }} />
    </FilterBtn>
);

const ScenePanel = styled.div`
    --higtlight-color: var(--studio-hover, #28282c);

    position: relative;
    background: var(--studio-bg, #141416);
    border: 0;
    color: #fff;
    box-shadow: 0px 2px 15px rgba(0, 0, 0, 0.5);
    border-radius: var(--studio-radius-panel);
    width: 100%;
    height: 340px;
    max-height: calc(100dvh - 180px);
    .has-details & {
        height: min(252px, 30dvh);
        min-height: 150px;
    }
    min-height: 180px;
    padding: 12px 0;
    box-shadow: none;
    border-radius: 0;

    pointer-events: all;

    display: flex;
    flex-direction: column;
    gap: 8px;

    @media (max-width: 600px) {
        width: 100%;
    }

    & > .sp-header {
        font: 500 16px/22px var(--studio-font, sans-serif);
        letter-spacing: 0;
        display: flex;
        align-items: center;
        gap: 8px;

        padding: 0 16px;
    }

    & > .sp-seacrh {
        display: flex;
        align-items: center;
        gap: 8px;

        padding: 0 16px;
    }

    & > .sp-list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        gap: 8px;

        display: flex;
        flex-direction: column;

        & .sp-list-group {
            display: flex;
            flex-direction: column;
            gap: 4px;

            & > .sp-list-group-title {
                display: flex;
                align-items: center;
                gap: 8px;

                padding: 0 16px;
                font-weight: 500;
                font-size: 12px;
                line-height: 24px;
                color: #fff;
                text-transform: capitalize;

                > .sp-group-icon {
                    width: 20px;
                    height: 20px;
                    transform: none;
                }

                cursor: pointer;

                border: 1px solid transparent;

                &:hover {
                    border: 1px solid var(--higtlight-color);
                }
            }

            & .sp-list-group-items {
                & > .sp-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;

                    padding: 6px 16px 6px 32px;

                    font-weight: 400;
                    font-size: 11px;
                    line-height: 100%;
                    color: #a7a7a7;

                    border: 1px solid transparent;

                    cursor: pointer;

                    & > .sp-item-hint {
                        color: #fff;
                    }

                    & > .sp-item-img {
                        width: 20px;
                        height: 20px;
                        border-radius: 4px;
                        overflow: hidden;

                        & > img {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                        }
                    }

                    & > .sp-item-name {
                        flex: 1;
                        display: flex;
                        align-items: center;
                        gap: 2px;
                    }

                    & > .sp-item-actions {
                        margin-left: auto;
                        display: flex;
                        align-items: center;
                        gap: 4px;

                        & > .sp-icon {
                            filter: invert(0.5);
                            visibility: hidden;

                            &:hover {
                                filter: invert(1);
                                visibility: visible;
                            }
                        }
                    }

                    &:hover:not(.sp-selected) {
                        color: #fff;
                        border: 1px solid var(--higtlight-color);
                    }
                }
            }
        }

        & .sp-selected.sp-item {
            color: #fff;
            border: 1px solid var(--higtlight-color) !important;
            background: var(--higtlight-color) !important;
        }

        & .sp-selected.sp-item.sp-group,
        & .sp-selected.sp-list-group-title {
            border: 1px solid var(--higtlight-color) !important;
            background: none !important;

            &.sp-all-selected {
                background: var(--higtlight-color) !important;
            }
        }
    }

    & > .sp-grab {
        position: absolute;
        bottom: 0;
        padding-bottom: 4px;
        padding-right: 4px;
        width: 100%;
        display: flex;
        justify-content: flex-end;
        cursor: s-resize;
    }
`;

const CtxMenu = styled.div`
    pointer-events: all;
    min-height: 0;
    width: var(--right-panel-width);
    max-width: calc(100vw - 12px);
    display: flex;
    flex-direction: column;
    user-select: none;
    > [data-studio-surface] {
        width: 100% !important;
        min-height: 0;
        max-height: calc(100dvh - 211px) !important;
        > .header {
            flex-shrink: 0;
        }
        > .body {
            overflow-y: auto;
            overscroll-behavior: contain;
            min-height: 0;
        }
    }
    ${Container}:not(.collapsed) & > [data-studio-surface] {
        max-height: calc(100dvh - 146px - min(252px, 30dvh)) !important;
    }
    > .mobile-footer {
        display: none;
    }
    @media (max-width: 600px) {
        > [data-studio-surface] {
            max-height: calc(100dvh - 266px) !important;
        }
        ${Container}:not(.collapsed) & > [data-studio-surface] {
            max-height: calc(100dvh - 202px - min(252px, 30dvh)) !important;
        }
    }
`;

const CollapseButton = styled.button`
    ${studioAction}
    width: 32px;
    height: 32px;
    min-height: 32px;
    padding: 0;
    margin-left: auto;
    color: var(--studio-muted);
`;
