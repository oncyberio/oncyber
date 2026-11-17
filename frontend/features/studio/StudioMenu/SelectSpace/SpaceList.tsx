import { tx } from "@components/context/I18nContext";
import { UserContext } from "@components/context/UserContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { deleteExhibit, duplicateSpace, leaveSpace } from "@utils/saveToDb";

import ExhibitService from "@api/exhibit/_api";

import { useContext, useEffect, useState } from "react";
import styled from "styled-components";
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
import {
    LibrarySearch,
    LibraryTabs,
} from "@features/studio/EditWorldMenu/AddAsset/shared/Library";
import {
    studioAction,
    studioFocus,
    studioHeading,
    studioPanel,
} from "@features/studio/styles/primitives";

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
                    {collabSpaces?.length > 0 || activeTab === "collab" ? (
                        <LibraryTabs role="group" aria-label={tx("Worlds")}>
                            <button
                                type="button"
                                aria-pressed={activeTab === "owned"}
                                onClick={() => setActiveTab("owned")}
                            >
                                <span className="label">{tx("My Spaces")}</span>
                                <span className="count">
                                    {ownedSpaces?.length ?? 0}
                                </span>
                            </button>
                            <button
                                type="button"
                                aria-pressed={activeTab === "collab"}
                                onClick={() => setActiveTab("collab")}
                            >
                                <span className="label">
                                    {tx("Collaborations")}
                                </span>
                                <span className="count">
                                    {collabSpaces.length}
                                </span>
                            </button>
                        </LibraryTabs>
                    ) : (
                        <h2 className="heading">
                            {tx("My Spaces")}
                            <span className="count">
                                {ownedSpaces?.length ?? 0}
                            </span>
                        </h2>
                    )}

                    <LibrarySearch
                        value={search}
                        onChange={setSearch}
                        placeholder={tx("Search worlds")}
                    />

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
                                                        strokeWidth="2.4"
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
                        <CreateSpace
                            type="button"
                            onClick={() => onCreateSpace("", true)}
                        >
                            <Plus width="16" height="16" color="currentColor" />
                            {tx("Create new world")}
                        </CreateSpace>
                    )}
                </>
            )}
        </Container>
    );
}

const Container = styled.div`
    ${studioPanel}
    box-sizing: border-box;
    width: 360px;
    /* Grows with the list, up to a scrolling height. */
    max-height: min(560px, calc(100dvh - 96px));
    padding: var(--studio-panel-padding, 14px);
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;

    @media (max-width: 600px) {
        width: 100%;
        /* Stay above the asset bar so Create new world can be reached. */
        max-height: min(560px, calc(100dvh - 136px));
    }

    & > .heading {
        ${studioHeading}
        display: flex;
        align-items: baseline;
        gap: 8px;
        font-size: 16px;
        line-height: 22px;
    }

    .count {
        flex-shrink: 0;
        color: var(--studio-muted, #a1a1a8);
        font: 400 12px/20px var(--studio-mono, monospace);
    }

    ${LibraryTabs} > button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        > .label {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    & > .body {
        flex: 1;
        min-height: 0;
        margin: 0 calc(-1 * var(--studio-panel-padding, 14px));
        padding: 0 calc(var(--studio-panel-padding, 14px) - 6px);
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .empty,
    & > .message {
        margin: 0;
        padding: 16px 6px;
        color: var(--studio-muted, #a1a1a8);
        font: 400 13px/18px var(--studio-font, sans-serif);
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
    padding-right: 4px;
    border-radius: var(--studio-radius-control, 10px);
    transition: background-color 150ms ease;

    &:hover,
    &[data-current] {
        background: var(--studio-surface, #1c1c1f);
    }

    & > .open {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px;
        border: 0;
        border-radius: inherit;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        ${studioFocus}
    }

    .thumb {
        flex-shrink: 0;
        width: 56px !important;
        height: 40px !important;
        min-width: 56px;
        border-radius: var(--studio-radius-preview, 6px) !important;
        overflow: hidden;
    }

    .info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .name,
    .status {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .name {
        color: var(--studio-ink, #f2f2f3);
        font: 500 14px/20px var(--studio-font, sans-serif);
        > .sec {
            color: var(--studio-muted, #a1a1a8);
            font-weight: 400;
        }
    }

    .status {
        color: var(--studio-muted, #a1a1a8);
        font: 400 12px/16px var(--studio-font, sans-serif);
    }

    & > .actions {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .current {
        display: grid;
        place-items: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--studio-ink, #f2f2f3);
        color: var(--studio-bg, #141416);
    }

    @media (max-width: 600px) {
        & > .open {
            min-height: 52px;
        }
    }
`;

const CreateSpace = styled.button`
    ${studioAction}
    flex-shrink: 0;
    width: 100%;
    border: 1px solid var(--studio-line, #303035);
    background: var(--studio-surface, #1c1c1f);
`;
