import { useContext, useEffect, useMemo, useState } from "react";
import styled, { css } from "styled-components";
import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import {
    Multiform,
    MultiformStep,
} from "@features/studio/components/Multiform";
import IconImg from "@ui/components/IconImg";
import { NButton } from "@features/studio/components/StudioButton";
import { useStudioMenu } from "../context/StudioContext";
import { Details } from "./Forms/Details";
import { Gating } from "./Forms/Gating";
import { SpawnPoint } from "./Forms/SpawnPoint";
import { useEventCallback } from "@components/hooks/useEventCallback";
import {
    ActionsProvider,
    useFormActions,
    useSaveFailure,
} from "./Forms/context/ActionsContext";

import { SpacePublished } from "./Forms/SpacePublished";
import { SpaceGatingProvider } from "./Forms/context/SpaceGatingContext";
import { Pfp } from "./Forms/Pfp";
import { EventScheduler } from "./Forms/Events";
import { Permissions } from "./Forms/Permissions";
import { Export } from "./Forms/Export";
import { canExportSpace } from "@features/studio/export/spaceExport";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import {
    SpaceCoverProvider,
    useSpaceCoverContext,
} from "./Forms/context/SpaceCoverContext";
import InlineError from "@ui/components/InlineError";
import { Label } from "@features/studio/styles/Label";
import { SMLabel } from "../components/SMLabel";
import { LabelledIcon } from "../components/LabeledIcon";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import AccountLink from "./Forms/AccountLink";
import { UserContext } from "@components/context/UserContext";
import Tooltip from "@ui/components/Tooltip";

const IconBtn = styled.div<{ active: boolean; isLight: boolean }>`
    width: 24px;
    height: 24px;
    background: transparent;
    flex-shrink: 0;

    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;

    & > .icon {
        filter: invert(1);
        opacity: ${(props) => (props.active ? 1 : 0.65)};
    }
`;

export function stepIcon(name: string) {
    return ({ active, isLight }) => {
        return (
            <IconBtn isLight={isLight} className="btn-icon" active={active}>
                <IconImg className="icon" name={name} size={16} />
            </IconBtn>
        );
    };
}

const steps: [MultiformStep, ...MultiformStep[]] = [
    {
        value: "details",
        title: "Details",
        description: "Fill a title to make it public in oncyber",
        icon: stepIcon("list"),
        form: <Details />,
    },
    {
        value: "gating",
        title: "Privacy & Access",
        description: "Set-up rules to organize exclusive events",
        icon: stepIcon("lock"),
        form: <Gating />,
    },
    {
        value: "spawn",
        title: "Spawn point",
        description: "Set starting point location",
        icon: stepIcon("spawn"),
        form: <SpawnPoint />,
    },
    {
        value: "pfp",
        title: "Visitor appearance",
        description: "Set default pfp for your visitors",
        icon: stepIcon("user-check"),
        form: <Pfp />,
    },
    {
        value: "events",
        title: "Events",
        description: "Upcoming Events",
        icon: stepIcon("events"),
        form: <EventScheduler />,
    },
    // {
    //     value: "account",
    //     title: "Account Settings",
    //     description: "Link to another account",
    //     icon: stepIcon("user"),
    //     form: <AccountLink />,
    // },
    {
        value: "Permissions",
        title: "Permissions",
        description: "Define how your visitors will experience your space",
        icon: stepIcon("permissions"),
        form: <Permissions />,
    },
];

// Only the signed-in owner can take a copy of the whole world.
const exportStep: MultiformStep = {
    value: "export",
    title: "Export",
    description: "Download this world as one file",
    icon: stepIcon("download"),
    form: <Export />,
};

type Current = "settings" | "publish";

const toggledStyle = { filter: "invert(1)" };
const emptyStyle = {};

function SpaceSettings_Child() {
    //
    const actionsRef = useFormActions();

    const { isAnonymous, user } = useContext(UserContext);

    const { toggleAuth } = useStudioMenu();

    const { exhibit, baseAnalyticsEvent, userRole } = useCurrentExhibit();

    const canExport = canExportSpace({
        isAnonymous,
        userRole,
        userId: user?.id,
        owner: exhibit.owner,
    });

    const visibleSteps = useMemo<typeof steps>(
        () => (canExport ? [...steps, exportStep] : steps),
        [canExport]
    );

    const { updateCover } = useSpaceCoverContext();

    const [current, setCurrent] = useState<Current>("settings");

    const [saveFailure, setSaveFailure] = useSaveFailure();

    // A missing title or preview is reported until the visitor adds it.
    useEffect(() => {
        setSaveFailure(null);
    }, [
        exhibit?.info?.headline,
        exhibit?.info?.heroImg,
        exhibit?.info?.cHeroImg,
    ]);

    const handleSave = () => {
        //
        setCurrent("publish");
    };

    const handleCancel = useEventCallback((toggle) => {
        //
        if (actionsRef.current?.onCancel) {
            actionsRef.current.onCancel(toggle);
        } else {
            toggle(false);
        }
    }, []);

    const handleOnSave = useEventCallback(async (setAutoClose) => {
        // Saving again replaces the old message.
        setSaveFailure(null);

        if (actionsRef.current?.onSave) {
            actionsRef.current.onSave(setAutoClose);
        } else {
            // What is missing is said beside Save; the visitor adds it in
            // Details, so there is no Retry (docs/feedback.md).
            if (!exhibit?.info?.headline) {
                setSaveFailure({
                    message: "Give your world a title before you publish.",
                });
                return;
            }

            if (!exhibit?.info?.heroImg && !exhibit?.info?.cHeroImg) {
                setSaveFailure({
                    message: "Add a preview image before you publish.",
                });
                return;
            }

            handleSave();
        }
    }, []);

    const handleOpen = useEventCallback(() => {
        //
        setCurrent("settings");

        setSaveFailure(null);

        updateCover();

        amplitude_logAnalyticsEvent("open_settings", baseAnalyticsEvent);
        //
    }, []);

    const caption = ({ toggled }) => (
        <Caption isAnonymous={isAnonymous}>
            <Tooltip
                text="Customize World Settings"
                isToggled={toggled}
                orientation="bottom"
            >
                <LabelledIcon toggled={toggled} name="settings" />
            </Tooltip>
        </Caption>
    );

    return (
        <CustomDropdown
            caption={caption}
            placement="free"
            // Above every other studio panel and modal while it is open.
            zIndex="var(--zIndex_studio-settings)"
            onOpen={handleOpen}
            toggleAuth={isAnonymous && toggleAuth}
        >
            {({ toggle, setAutoClose }) => {
                //

                if (current === "publish") {
                    //
                    return (
                        <SpacePublished
                            exhibit={exhibit}
                            onGoBack={() => setCurrent("settings")}
                        />
                    );
                }

                const actions = (
                    <Actions>
                        <NButton
                            size="small"
                            overrideTheme="dark"
                            outline
                            style={{ height: 38 }}
                            onClick={() => {
                                handleCancel(toggle);
                            }}
                        >
                            Cancel
                        </NButton>
                        <NButton
                            size="small"
                            style={{ height: 38 }}
                            onClick={() => handleOnSave(setAutoClose)}
                        >
                            Save
                        </NButton>
                        <InlineError
                            className="save-failure"
                            message={saveFailure?.message}
                            onRetry={saveFailure?.retry}
                        />
                    </Actions>
                );

                return (
                    <Container>
                        <Multiform
                            className="space-settings"
                            title="World settings"
                            steps={visibleSteps}
                            actions={actions}
                        />
                    </Container>
                );
            }}
        </CustomDropdown>
    );
}

export function SpaceSettings() {
    //
    return (
        <SpaceGatingProvider>
            <ActionsProvider>
                <SpaceCoverProvider>
                    <SpaceSettings_Child />
                </SpaceCoverProvider>
            </ActionsProvider>
        </SpaceGatingProvider>
    );
}

const Container = styled.div`
    --color: #c0c0c6;

    position: fixed;
    left: 50vw;
    top: calc(10vh - 8px);
    transform: translate(-50%, 0);

    @media (max-width: 600px) {
        width: 100%;
        height: 100%;
        z-index: 100005;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        transform: translate(0, 0);
    }

    & > .space-settings {
        width: min(800px, calc(100vw - 32px));
        height: min(650px, calc(90dvh - 24px));

        @media (max-width: 600px) {
            width: calc(100%);
            height: 100%;
            left: 0;
            right: 0;
            margin: auto;
        }
    }
`;

const Actions = styled.div`
    position: relative;
    display: flex;
    flex-direction: row;
    gap: 12px;
    align-items: center;
    justify-content: center;

    /* Under the buttons, over the top of the form, so the header keeps its
       height and the message is right beside Save. */
    & > .save-failure {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        z-index: 1;
        width: min(340px, calc(100vw - 48px));
        background: var(--studio-panel, #181818);
    }
`;

const Caption = styled.div<{ isAnonymous: boolean }>`
    position: relative;

    .settings-tuto {
        top: 60px;
        left: -30px;
        width: 336px;

        @media (max-width: 600px) {
            width: 320px;

            ${(props) =>
                props.isAnonymous
                    ? css`
                          left: -44px;
                      `
                    : css`
                          left: -150px;
                      `}
        }

        .arrow-indicator {
            &.top {
                left: 40px !important;
                right: initial !important;

                @media (max-width: 600px) {
                    ${(props) =>
                        props.isAnonymous
                            ? css`
                                  left: 55px !important;
                              `
                            : css`
                                  left: 160px !important;
                              `}
                }
            }
        }
    }
`;
