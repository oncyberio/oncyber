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
import IconImg from "@ui/components/IconImg";
import { ExhibitPicture } from "../components/ExhibitPicture";
import { getSpaceStatus } from "@features/studio/utils";
import { SpaceActions } from "./SpaceActions";
import Spinner from "@ui/components/Spinner";
import { useRouter } from "next/router";
import { Experience } from "@uitypes/experience";
import Plus from "@ui/icons/Plus";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";
import { Input } from "@components/forms/Input";

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

    return (
        <Container>
            {/* */}
            {isLoading && <p className="message">Loading...</p>}

            {error && <p className="message">Failed to load User spaces!</p>}

            {!isLoading && !error && (
                <>
                    <div className="header">
                        <div
                            className={
                                activeTab == "owned" ? "title active" : "title"
                            }
                            onClick={() => setActiveTab("owned")}
                        >
                            My Spaces
                            {ownedSpaces.length
                                ? ` (${ownedSpaces.length})`
                                : ""}
                        </div>

                        {collabSpaces.length > 0 && (
                            <>
                                <IconImg
                                    name="dot"
                                    style={{ filter: "invert(0.5)" }}
                                />
                                <div
                                    className={
                                        activeTab == "collab"
                                            ? "title active"
                                            : "title"
                                    }
                                    onClick={() => setActiveTab("collab")}
                                >
                                    Collaborations{" "}
                                    <span>({collabSpaces.length})</span>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="body y-scroll scrollbar-hidden">
                        <Input
                            background="black"
                            borderColor="#1d1d1d"
                            padding="20px"
                            color="white"
                            placeholder="Filter"
                            onChange={(e) => setSearch(e.target.value)}
                        />

                        {shownSpaces
                            .filter((exhibit) => {
                                if (!search) return true;
                                const headline =
                                    exhibit?.info?.headline || "Untitled";
                                return headline
                                    .toLowerCase()
                                    .includes(search.toLowerCase());
                            })
                            .map((_exhibit) => {
                                //
                                const {
                                    artworks,
                                    total_artworks,
                                    info,
                                    id,
                                    invited,
                                } = _exhibit;

                                const nbArtworks =
                                    total_artworks ||
                                    Object.keys(artworks || {}).length;

                                const status = getSpaceStatus(_exhibit);

                                const isSubmitting =
                                    submits[_exhibit.id] != null;

                                const failed = failures[_exhibit.id];

                                return (
                                    <SpaceRow key={_exhibit.id}>
                                        <SpaceItem>
                                            <ExhibitPicture
                                                exhibit={_exhibit}
                                                onClick={() =>
                                                    onChangeSpace(_exhibit)
                                                }
                                                style={{
                                                    width: 80,
                                                    height: 60,
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                }}
                                            />
                                            <div
                                                className="info"
                                                style={{ cursor: "pointer" }}
                                                onClick={() =>
                                                    onChangeSpace(_exhibit)
                                                }
                                            >
                                                <div className="title">
                                                    {info?.headline || (
                                                        <>
                                                            Untitled{" "}
                                                            <span className="sec">
                                                                (
                                                                {_exhibit.id.slice(
                                                                    0,
                                                                    3
                                                                ) + "..."}
                                                                )
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="status">
                                                    {status}
                                                    {" - "}
                                                    {nbArtworks} artworks
                                                </div>
                                            </div>
                                            <div className="actions">
                                                {exhibit.id === _exhibit.id && (
                                                    <IconImg
                                                        name="check-white-bg"
                                                        size={20}
                                                    />
                                                )}
                                                {!isSubmitting && (
                                                    <SpaceActions
                                                        type={activeTab}
                                                        blacklist={
                                                            _exhibit.id ===
                                                            exhibit.id
                                                                ? DeleteBlacklist
                                                                : []
                                                        }
                                                        handleAction={(
                                                            action
                                                        ) =>
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
                        <div className="footer">
                            <CreateSpace
                                onClick={(e) => {
                                    //nextStudioQuiz("PickBuildMore");
                                    onCreateSpace("", true);
                                }}
                            >
                                <div className="thumbnail">
                                    <Plus
                                        width="24"
                                        height="24"
                                        color="#328DFD"
                                    />
                                </div>
                                <div className="title">Create New World</div>
                            </CreateSpace>
                        </div>
                    )}
                </>
            )}
        </Container>
    );
}

const Container = styled.div`
    width: 400px;
    height: 600px;
    background: var(--panel-bg);
    border: var(--panel-border);
    box-shadow: var(--panel-shadow);
    border-radius: var(--radius-panel);
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 16px;

    @media (max-width: 600px) {
        width: 100%;
    }

    & > .header {
        flex: 0;
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        gap: 12px;
        cursor: pointer;

        & > .title {
            font-weight: 500;
            font-size: 16px;
            color: var(--panel-text-muted);

            &.active {
                font-weight: 400;
                color: var(--panel-text-primary);
            }
        }
    }

    & > .body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    & > .footer {
        flex: 0;
    }

    & > .message {
        color: var(--panel-text-primary);
    }
`;

const SpaceRow = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const SpaceItem = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;

    & > .info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        padding: 12px 0;

        & > .title {
            font-weight: 500;
            font-size: 16px;
            color: var(--panel-text-primary);
            width: 100%;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;

            & > .sec {
                font-weight: 400;
                font-size: 12px;
                color: var(--panel-text-secondary);
            }
        }

        & > .status {
            font-weight: 400;
            font-size: 12px;
            color: var(--panel-text-secondary);
        }

        transition: 0.2s;
        &:hover {
            opacity: 0.6;
        }
    }

    & > .actions {
        flex: 0;
        margin-left: auto;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
    }
`;

const CreateSpace = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    user-select: none;

    & > .thumbnail {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 60px;
        background: var(--studio-hover, #28282c);
        border: 1px solid #328dfd;
        border-radius: 4px;
    }

    & > .title {
        font-weight: 500;
        font-size: 16px;
        color: var(--panel-text-primary);
    }

    &:hover {
        //
    }
`;
