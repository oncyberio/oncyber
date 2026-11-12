import { StudioToolbarFrame as Container } from "./components/StudioToolbarFrame";
import { useContext, useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import { getSpaceStatus } from "../utils";
import { Menu } from "./Menu";
import { CinematicToggle } from "./CinematicToggle";
import { Collab } from "./Collab";
import { ExhibitPicture } from "./components/ExhibitPicture";
import { SMLabel } from "./components/SMLabel";
import { useStudioMenu } from "./context/StudioContext";
import { Play } from "./Play";
import { SelectSpace } from "./SelectSpace";
import { SpaceSettings } from "./SpaceSettings";
import { SpaceStats } from "./SpaceStats";
import Portal from "@components/Snackbar/Portal";
import dynamic from "next/dynamic";
import { UserContext } from "@components/context/UserContext";
import { useRouter } from "next/router";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { Experience } from "@uitypes/experience";
import { updateUser } from "@utils/saveToDb";
import { showError } from "@components/Dialogs";
import { useWorldState } from "@components/_3DExhibit-v2/hooks/useWorldState";
import { SpaceLink } from "./SpaceLink";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import AnonSave from "./AnonSave";
import ConnectWallet from "@ui/components/ConnectWallet";
import { createEmptySpace } from "@features/spaces/create/utils";
import PreviewTuto from "@features/onboarding/Studio/Tuto/Preview";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";
import { RoomsProvider } from "@features/spaces/create/components/DestinationSelector/useRooms";
import { commitAnonExhibit, getLocalAnonExhibit } from "@utils/anon";
import { LabelledIcon } from "./components/LabeledIcon";
import { useAI } from "@features/ai/context/AIContext";
import Tooltip from "@ui/components/Tooltip";
import StudioQuiz from "@features/onboarding/Studio/Quiz";
import { PlayToggle } from "./DisplayToggle";

const DestinationSelector = dynamic(
    () => import("@features/spaces/create/components/DestinationSelector"),
    { ssr: false }
);

const floatClampPad = {
    top: 6,
    bottom: 6,
    left: 6,
    right: 6,
};

export function StudioToolbar() {
    //
    const { user, token, isAnonymous } = useContext(UserContext);

    const { onboarding, nextStudioTuto } = useOnboarding();

    const ai = useAI({});

    const worldState = useWorldState();

    const router = useRouter();

    const containerRef = useRef<HTMLDivElement>();

    const {
        exhibit,
        destination,
        toggleAuth,
        isAuthShowing,
        isAnonLimit,
        baseAnalyticsEvent,
        changeExhibit,
    } = useStudioMenu();

    const [isCreateModalShowing, toggleCreateModal] = useState(null);

    const [skipCommitAnonExhibit, setSkipCommitAnonExhibit] = useState(false);

    const spaceStatus = getSpaceStatus(exhibit);

    useEffect(() => {
        if (!exhibit && !isAnonymous) {
            if (exhibit?.info?.room === "@@empty") {
                //nextStudioQuiz("PickBuildMore");
                toggleCreateModal("template");
            } else {
                nextStudioTuto("AssetsContent");
            }
        }
    }, [exhibit]);

    useEffect(() => {
        if (isAnonymous && !getLocalAnonExhibit()) {
            if (exhibit?.info?.room === "@@empty") {
                //nextStudioQuiz("PickBuildMore");
                toggleCreateModal("template");
            } else {
                nextStudioTuto("AssetsContent");
            }
        }
    }, []);

    const handleChangeSpace = useEventCallback(
        async (next: Experience, isCreate = false) => {
            //

            if (exhibit.id === next.id) return;

            const event = isCreate
                ? "click-create-space"
                : "click_switch_gallery";

            amplitude_logAnalyticsEvent(event, {
                user_id: user?.id,
                component: "ExhibitSelectorMenu",
                from_exhibit: exhibit.id,
                to_exhibit: next.id,
                isAnonymous: isAnonymous,
                ...baseAnalyticsEvent,
            });

            if (router.pathname === "/studio") {
                //
                try {
                    if (!isAnonymous) {
                        const result = await updateUser(
                            token,
                            {
                                currentExhibitId: next.id,
                            },
                            user.id
                        );

                        if (!result.success) {
                            //
                            throw new Error(result.message);
                        }
                    }

                    await changeExhibit(next, isAnonymous);

                    toggleCreateModal(null);

                    if (isCreate) {
                        //
                        nextStudioTuto("AssetsContent");
                    }

                    //
                } catch (err) {
                    //
                    console.error(err);

                    // Reached from the world list, the create dialog and
                    // templates, so there is no one control to sit beside.
                    showError("Couldn't open that world. Try again.");
                }
            } else {
                //
                let slug = next.info.customLink || `s@${next.id}`;

                router.push({
                    pathname: slug,
                });
            }
        },
        []
    );

    const onCreateEmptyStudioSpace = useEventCallback(async (kit?: string) => {
        const next = await createEmptySpace(user.id, token, kit);
        changeExhibit(next, isAnonymous);
    }, []);

    const handleCreateSpace = useEventCallback(
        async (isEmpty, isFuture = false) => {
            //
            if (isEmpty) {
                //
                await onCreateEmptyStudioSpace();
                return;
            }

            toggleCreateModal(isFuture ? "world-builder" : "template");
            //
        },
        []
    );

    return (
        <RoomsProvider
            context={"studio"}
            onCreateSpace={(next) => handleChangeSpace(next)}
        >
            {isCreateModalShowing !== null && (
                <Portal>
                    <DestinationSelector
                        style={{ zIndex: 30000 }}
                        context={isCreateModalShowing}
                        isModal={true}
                        handleClose={() => {
                            toggleCreateModal(null);
                        }}
                        onCreateEmptyStudioSpace={onCreateEmptyStudioSpace}
                        onCreateSpace={(next) => handleChangeSpace(next, true)}
                        title={
                            isCreateModalShowing === "world-builder" ? (
                                <>
                                    Build From{" "}
                                    <span className="art">Scratch</span>
                                </>
                            ) : (
                                <>
                                    Browse{" "}
                                    <span className="art">Templates</span>
                                </>
                            )
                        }
                        description={
                            <>
                                {isCreateModalShowing === "world-builder"
                                    ? "Choose from an array of kits to build your World from scratch"
                                    : "Choose a ready made template and customize your World"}
                            </>
                        }
                    />
                </Portal>
            )}

            {isAuthShowing ? (
                <ConnectWallet
                    toggle={toggleAuth}
                    onlyEthereum={false}
                    open={isAuthShowing}
                    header={isAnonLimit ? "Login to add more content!" : null}
                    style={{ zIndex: 10000000 }}
                    callbackAfterAuth={async (
                        token,
                        account,
                        connection,
                        { userData }
                    ) => {
                        //
                        try {
                            //

                            if (!skipCommitAnonExhibit) {
                                await commitAnonExhibit(exhibit, token);
                            }

                            location.reload();

                            return {
                                reload: true,
                            };
                        } catch (err) {
                            //
                            console.error(err);

                            // The sign-in window has closed; nothing else
                            // on the page is about this.
                            await showError(
                                "Couldn't save the world you made before signing in."
                            );
                        }
                    }}
                    skipRedirectToAccount={false}
                />
            ) : null}

            <Container
                isAnonymous={isAnonymous}
                ref={containerRef}
                className={worldState.mode}
            >
                <StudioQuiz
                    handleCreateSpace={handleCreateSpace}
                    setSkipCommitAnonExhibit={setSkipCommitAnonExhibit}
                />

                <div className="horz left">
                    <Menu onCreateSpace={handleCreateSpace} />

                    <div className="settings-mobile">
                        <SpaceSettings />
                    </div>
                </div>

                <div className="horz center">
                    {exhibit ? (
                        <>
                            <div className="mode display cinematic">
                                <SpaceLink />
                            </div>

                            <div className="horz mode edit exhibit-wrapper">
                                <ExhibitPicture
                                    exhibit={exhibit}
                                    destination={destination}
                                    className="exhibit-picture"
                                />
                                <div className="vert">
                                    <div className="horz">
                                        <SMLabel
                                            className="desktop"
                                            style={{
                                                whiteSpace: "nowrap",
                                                paddingRight: "0.4em",
                                                opacity: 0.6,
                                            }}
                                        >
                                            {isAnonymous
                                                ? "Draft"
                                                : spaceStatus}{" "}
                                            /
                                        </SMLabel>

                                        <SelectSpace
                                            onChangeSpace={handleChangeSpace}
                                            onCreateSpace={handleCreateSpace}
                                            className="select-space"
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>

                <div className="horz right">
                    <div className="icon-group desktop horz mode edit">
                        <SpaceSettings />

                        <SpaceStats />

                        <CinematicToggle />

                        {/* {ai?.isWhitelisted && (
                            <Tooltip text="Magic Composer" orientation="bottom">
                                <LabelledIcon
                                    name="multi-star"
                                    toggled={ai.isShowing}
                                    onClick={() => ai.toggle()}
                                />
                            </Tooltip>
                        )} */}
                    </div>

                    {!isAnonymous ? (
                        <div className="mode edit">
                            <Collab className="collab" />
                        </div>
                    ) : null}
                    {/* <Share /> */}

                    <div className="horz mode edit">
                        <Tooltip
                            text={
                                isAnonymous
                                    ? "Sign in to save and share"
                                    : "Preview your World Live"
                            }
                            orientation="bottom"
                        >
                            {!isAnonymous ? <Play /> : <AnonSave />}
                        </Tooltip>
                        <PreviewTuto />
                    </div>

                    {!isAnonymous ? (
                        <>
                            <div className="horz mode cinematic">
                                <CinematicToggle />
                            </div>
                            <div className="horz mode display">
                                <PlayToggle />
                            </div>
                        </>
                    ) : null}
                </div>
            </Container>
        </RoomsProvider>
    );
}
