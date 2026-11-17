import { tx } from "@components/context/I18nContext";
import { UserContext } from "@components/context/UserContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { deleteExhibit, duplicateSpace, leaveSpace } from "@utils/saveToDb";

import ExhibitService from "@api/exhibit/_api";

import { useContext, useEffect, useState } from "react";
import styled from "styled-components";
import { brandVariables } from "@styles/brand";
import { useStudioMenu } from "../context/StudioContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { showConfirm } from "@components/Dialogs";
import InlineError from "@ui/components/InlineError";
import { delay, removeKey } from "@utils/js";
import { SpaceAction, SpaceTab } from "./utils";
import { useUserSpaces } from "./useUserSpaces";
import { ExhibitPicture } from "../components/ExhibitPicture";
import { getSpaceStatus } from "@features/studio/utils";
import { SpaceActions } from "./SpaceActions";
import Spinner from "@ui/components/Spinner";
import { useRouter } from "next/router";
import { Experience } from "@uitypes/experience";
import Plus from "@ui/icons/Plus";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";

const DeleteBlacklist: SpaceAction[] = ["delete"];

const FAILURE_MESSAGES: Partial<Record<SpaceAction, string>> = {
    delete: "Couldn't delete this world.",
    duplicate: "Couldn't duplicate this world.",
    leave: "Couldn't leave this world.",
};

export function SpaceList({ onCreateSpace, onChangeSpace }) {
    //

    const { user, token } = useContext(UserContext);

    const { nextStudioQuiz } = useOnboarding();

    const { exhibit, baseAnalyticsEvent } = useStudioMenu();

    const [activeTab, setActiveTab] = useState<SpaceTab>("owned");

    const [submits, setSubmits] = useState<Record<string, SpaceAction>>({});

    // The action that last failed on each world, shown under that world
    // with a Retry that runs it again without asking twice
    // (docs/feedback.md).
    const [failures, setFailures] = useState<Record<string, SpaceAction>>({});

    const setFailure = (id: string, action: SpaceAction | null) => {
        setFailures((s) =>
            action ? { ...s, [id]: action } : removeKey(id, s)
        );
    };

    const [search, setSearch] = useState("");

    const {
        ownedSpaces,
        collabSpaces,
        shownSpaces,
        queryData,
        isLoading,
        error,
        mutate,
    } = useUserSpaces(activeTab, exhibit?.id);

    useEffect(() => {
        amplitude_logAnalyticsEvent("open_space_list", baseAnalyticsEvent);
    }, []);

    // `confirmed` skips the question when the visitor already answered it
    // and is retrying.
    const handleAction = useEventCallback(
        (action: SpaceAction, id: string, confirmed = false) => {
            //
            if (action === "delete") {
                //
                handleDeleteSpace(id, confirmed);
            }
            //
            else if (action === "duplicate") {
                //
                handleDuplicateSpace(id, confirmed);
            }
            //
            else if (action === "leave") {
                //
                handleLeaveSpace(id, confirmed);
            }
        },
        []
    );

    const handleDeleteSpace = useEventCallback(async (id, confirmed) => {
        const ok =
            confirmed ||
            (await showConfirm("Are you sure you want to delete?"));

        if (!ok) return;

        setFailure(id, null);

        try {
            //
            setSubmits((s) => {
                return {
                    ...s,
                    [id]: "delete",
                };
            });

            const data = await deleteExhibit(token, id);

            if (!data.success) throw new Error(data.error || data.message);

            let newData = queryData.filter((exhibit) => {
                return exhibit.id !== id;
            });

            mutate(newData);

            amplitude_logAnalyticsEvent("click_delete_show", {
                ...baseAnalyticsEvent,
                user_id: user?.id,
                component: "ExhibitSelectorMenu",
            });
        } catch (err) {
            //
            console.error(err);

            setFailure(id, "delete");
        } finally {
            //
            setSubmits((s) => removeKey(id, s));
        }
    }, []);

    const handleLeaveSpace = useEventCallback(
        async (spaceId: string, confirmed: boolean) => {
            //
            const ok =
                confirmed ||
                (await showConfirm(
                    "Are you sure you want to leave (all your added and shared assets will be removed)?"
                ));

            if (!ok) return;

            setFailure(spaceId, null);

            try {
                setSubmits((s) => {
                    return {
                        ...s,
                        [spaceId]: "leave",
                    };
                });

                const data = await leaveSpace(spaceId);

                if (data.success) {
                    amplitude_logAnalyticsEvent("leave_space", {
                        ...baseAnalyticsEvent,
                        component: "ExhibitSelectorMenu",
                    });

                    const newData = queryData.filter((exhibit) => {
                        return exhibit.id !== spaceId;
                    });

                    mutate(newData);

                    if (spaceId === exhibit.id) {
                        onChangeSpace(newData[0]);
                    }
                } else {
                    setFailure(spaceId, "leave");
                }
            } catch (err) {
                //
                console.error(err);

                setFailure(spaceId, "leave");
            } finally {
                //
                setSubmits((s) => removeKey(spaceId, s));
            }
        },
        []
    );

    const handleDuplicateSpace = useEventCallback(
        async (spaceId: string, confirmed: boolean) => {
            //
            const ok =
                confirmed ||
                (await showConfirm("Are you sure you want to duplicate?"));

            if (!ok) return;

            setFailure(spaceId, null);

            try {
                setSubmits((s) => {
                    return {
                        ...s,
                        [spaceId]: "duplicate",
                    };
                });

                const data = await ExhibitService.duplicate({ spaceId });

                if (data.success === false) {
                    //
                    setFailure(spaceId, "duplicate");

                    return;
                }
                // Add new here

                amplitude_logAnalyticsEvent("duplicate_space", {
                    ...baseAnalyticsEvent,
                    component: "ExhibitSelectorMenu",
                });

                mutate(queryData.concat(data.value));

                //  await handleExhibitChange(data.spaceId, data.exhibit);
            } catch (err) {
                //
                console.error(err);

                setFailure(spaceId, "duplicate");
            } finally {
                //
                setSubmits((s) => removeKey(spaceId, s));
            }
        },
        []
    );

    const query = search.trim().toLowerCase();
    const visibleSpaces = (shownSpaces || []).filter(
        (space) =>
            !query ||
            (space?.info?.headline || tx("Untitled"))
                .toLowerCase()
                .includes(query)
    );

    return (
        <Container>
            {isLoading && <p className="message">{tx("Loading…")}</p>}

            {error && (
                <p className="message">{tx("Couldn't load your worlds.")}</p>
            )}

            {!isLoading && !error && (
                <>
                    <div className="menu-head">
                        {collabSpaces?.length > 0 || activeTab === "collab" ? (
                            <div
                                className="tabs"
                                role="group"
                                aria-label={tx("Worlds")}
                            >
                                <button
                                    type="button"
                                    aria-pressed={activeTab === "owned"}
                                    onClick={() => setActiveTab("owned")}
                                >
                                    {tx("My Spaces")}
                                    <span className="count">
                                        {ownedSpaces?.length ?? 0}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={activeTab === "collab"}
                                    onClick={() => setActiveTab("collab")}
                                >
                                    {tx("Collaborations")}
                                    <span className="count">
                                        {collabSpaces?.length ?? 0}
                                    </span>
                                </button>
                            </div>
                        ) : (
                            <h2 className="menu-label">
                                {tx("My Spaces")}
                                <span className="count">
                                    {ownedSpaces?.length ?? 0}
                                </span>
                            </h2>
                        )}
                    </div>

                    <label className="search">
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                        </svg>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={tx("Search worlds")}
                            aria-label={tx("Search worlds")}
                            spellCheck={false}
                        />
                    </label>

                    <div className="body scrollbar-hidden">
                        {visibleSpaces.length === 0 && (
                            <p className="empty">
                                {query
                                    ? tx("No world matches that name.")
                                    : tx("No worlds here yet.")}
                            </p>
                        )}
                        {visibleSpaces.map((_exhibit) => {
                            const { artworks, total_artworks, info } = _exhibit;

                            const nbArtworks =
                                total_artworks ||
                                Object.keys(artworks || {}).length;

                            const status = getSpaceStatus(_exhibit);

                            const isSubmitting = submits[_exhibit.id] != null;

                            const failed = failures[_exhibit.id];

                            const isCurrent = exhibit.id === _exhibit.id;

                            const name = info?.headline || tx("Untitled");

                            return (
                                <SpaceRow key={_exhibit.id}>
                                    <SpaceItem
                                        data-current={isCurrent || undefined}
                                    >
                                        <button
                                            type="button"
                                            className="open"
                                            title={name}
                                            aria-current={
                                                isCurrent ? "true" : undefined
                                            }
                                            onClick={() =>
                                                onChangeSpace(_exhibit)
                                            }
                                        >
                                            <ExhibitPicture
                                                exhibit={_exhibit}
                                                className="thumb"
                                            />
                                            <span className="info">
                                                <span className="name">
                                                    {name}
                                                    {!info?.headline && (
                                                        <span className="sec">
                                                            {" "}
                                                            ·{" "}
                                                            {_exhibit.id.slice(
                                                                0,
                                                                4
                                                            )}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="status">
                                                    {tx(status)} ·{" "}
                                                    {tx(
                                                        nbArtworks === 1
                                                            ? "{count} artwork"
                                                            : "{count} artworks",
                                                        { count: nbArtworks }
                                                    )}
                                                </span>
                                            </span>
                                        </button>
                                        <div className="actions">
                                            {isCurrent && (
                                                <span
                                                    className="current"
                                                    aria-label={tx("Open now")}
                                                >
                                                    <svg
                                                        width="14"
                                                        height="14"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        aria-hidden="true"
                                                    >
                                                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                                                    </svg>
                                                </span>
                                            )}
                                            {!isSubmitting && (
                                                <SpaceActions
                                                    type={activeTab}
                                                    blacklist={
                                                        isCurrent
                                                            ? DeleteBlacklist
                                                            : []
                                                    }
                                                    handleAction={(action) =>
                                                        handleAction(
                                                            action,
                                                            _exhibit.id
                                                        )
                                                    }
                                                />
                                            )}
                                            {isSubmitting && (
                                                <Spinner width={20} />
                                            )}
                                        </div>
                                    </SpaceItem>
                                    <InlineError
                                        message={
                                            !isSubmitting &&
                                            failed &&
                                            FAILURE_MESSAGES[failed]
                                        }
                                        onRetry={() =>
                                            handleAction(
                                                failed,
                                                _exhibit.id,
                                                true
                                            )
                                        }
                                    />
                                </SpaceRow>
                            );
                        })}
                    </div>
                    {activeTab === "owned" && (
                        <div className="menu-foot">
                            <CreateSpace
                                type="button"
                                onClick={() => onCreateSpace("", true)}
                            >
                                <Plus
                                    width="14"
                                    height="14"
                                    color="currentColor"
                                />
                                {tx("Create new world")}
                            </CreateSpace>
                        </div>
                    )}
                </>
            )}
        </Container>
    );
}

/* Follows the brand guide's menus, as the language menu does: a panel with
   24px corners, a section label, 40px rows with 8px corners, a subtle
   hover and a check on the current choice. */
const Container = styled.div`
    ${brandVariables}
    box-sizing: border-box;
    width: 340px;
    /* Grows with the list, up to a scrolling height. */
    max-height: min(560px, calc(100dvh - 96px));
    padding: 8px;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--oc-line);
    border-radius: var(--oc-radius-card, 24px);
    background: var(--oc-panel);
    box-shadow: 0 16px 40px #0006, 0 2px 8px #0003;
    color: var(--oc-secondary);
    font: 14px/1.2 var(--oc-font);
    overflow: hidden;
    animation: space-menu-in 0.14s ease-out;

    @media (max-width: 600px) {
        width: 100%;
        border-radius: 20px;
        /* Stay above the asset bar so Create new world can be reached. */
        max-height: min(560px, calc(100dvh - 144px));
    }

    @keyframes space-menu-in {
        from {
            opacity: 0;
            transform: translateY(-4px);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        animation: none;
    }

    .menu-head {
        display: flex;
        align-items: center;
        padding: 8px 12px 6px;
    }

    .menu-label,
    .tabs > button {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        margin: 0;
        color: var(--oc-muted);
        font: 500 13px/1.2 var(--oc-font);
    }

    .menu-label {
        color: var(--oc-ink);
    }

    .tabs {
        display: flex;
        gap: 16px;
        > button {
            padding: 4px 0;
            border: 0;
            background: none;
            cursor: pointer;
            transition: color 0.15s ease;
            &:hover,
            &[aria-pressed="true"] {
                color: var(--oc-ink);
            }
            &:focus-visible {
                outline: 2px solid var(--accent);
                outline-offset: 2px;
                border-radius: 4px;
            }
        }
    }

    .count {
        color: var(--oc-muted);
    }

    .search {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
        height: 40px;
        margin: 4px 4px 6px;
        padding: 0 12px;
        border: 1px solid var(--oc-line);
        border-radius: 12px;
        color: var(--oc-muted);
        transition: border-color 0.15s ease;
        &:focus-within {
            border-color: var(--oc-line-strong);
            color: var(--oc-secondary);
        }
        > svg {
            flex-shrink: 0;
        }
        > input {
            flex: 1;
            min-width: 0;
            height: 100%;
            padding: 0;
            border: 0;
            outline: 0;
            background: none;
            color: var(--oc-ink);
            font: 14px/1.2 var(--oc-font);
            &::placeholder {
                color: var(--oc-muted);
            }
        }
    }

    & > .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .empty,
    & > .message {
        margin: 0;
        padding: 12px;
        color: var(--oc-muted);
        font: 14px/1.4 var(--oc-font);
    }

    .menu-foot {
        flex-shrink: 0;
        margin: 6px -8px -8px;
        padding: 6px 8px 8px;
        border-top: 1px solid var(--oc-line);
    }
`;

const SpaceRow = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const SpaceItem = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    padding-right: 8px;
    border-radius: 8px;
    transition: background-color 0.15s ease;

    &:hover,
    &:focus-within {
        background: var(--oc-hover);
    }

    & > .open {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 52px;
        padding: 6px 4px 6px 6px;
        border: 0;
        border-radius: inherit;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        outline: none;
    }

    .thumb {
        flex-shrink: 0;
        width: 48px !important;
        height: 36px !important;
        min-width: 48px;
        border-radius: 6px !important;
        overflow: hidden;
    }

    .info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .name,
    .status {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .name {
        color: var(--oc-secondary);
        font: 14px/1.2 var(--oc-font);
        transition: color 0.15s ease;
        > .sec {
            color: var(--oc-muted);
        }
    }

    &:hover .name,
    &:focus-within .name,
    &[data-current] .name {
        color: var(--oc-ink);
    }

    .status {
        color: var(--oc-muted);
        font: 12px/1.2 var(--oc-font);
    }

    & > .actions {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .current {
        display: grid;
        place-items: center;
        width: 20px;
        height: 20px;
        color: var(--oc-ink);
    }

    /* The row menu shows on hover or focus; touch screens always show it. */
    & > .actions > :not(.current) {
        opacity: 0;
        transition: opacity 0.15s ease;
    }
    &:hover > .actions > *,
    &:focus-within > .actions > * {
        opacity: 1;
    }
    @media (hover: none) {
        & > .actions > * {
            opacity: 1;
        }
    }
`;

const CreateSpace = styled.button`
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 40px;
    padding: 8px 12px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--oc-secondary);
    font: 14px/1.2 var(--oc-font);
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
    &:hover,
    &:focus-visible {
        background: var(--oc-hover);
        color: var(--oc-ink);
        outline: none;
    }
`;
