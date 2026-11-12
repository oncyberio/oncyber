import { Fragment, useContext, useEffect, useState } from "react";
import { UserContext } from "@components/context/UserContext";
import { WorldProvider } from "@components/_3DExhibit-v2/context/WorldProvider";
import styled from "styled-components";
import ProviderButtons from "@components/modals/SignupProvider/ProviderButtons";
import { EditWorld } from "./EditWorld";
import { ExhibitProvider } from "./context/ExhibitContext";
import { ExhibitEditorProvider } from "./context/ExhibitEditorContext";
import { SpaceSwitchProvider } from "./context/SpaceSwitchContext";
import { useSnackbar } from "@components/Snackbar";
import { useRouter } from "next/router";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useDialogTheme } from "@components/Dialogs";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { useOnboarding } from "@features/onboarding/context/OnboardingContext";
import { getDefaultAnonExhibit } from "@utils/anon/index";
import { EMPTY_ROOM } from "@utils/emptyRoom";
import { ProviderButtonsWrapper } from "@components/modals/SignupProvider/ProviderButtonsWrapper";
import { getLocalAnonExhibit } from "@utils/anon";
import { removeQueryParam } from "@utils/urlUtils";

function Studio3D_Child(props) {
    const [exhibit, setExhibit] = useState(props?.exhibit);
    const [destination, _setDestination] = useState(
        props?.destination || EMPTY_ROOM
    );

    const router = useRouter();

    const { isAnonymous } = useContext(UserContext);

    const { nextStudioQuiz, nextStudioTuto } = useOnboarding();

    useEffect(() => {
        if (!exhibit && !isAnonymous) {
            const newExhibit = getDefaultAnonExhibit(
                router?.query?.templateId as string
            );
            setExhibit(newExhibit);
            // if (props?.exhibit?.info?.room === "@@empty") {
            //     //nextStudioQuiz("PickBuildMore");
            // } else {
            //     nextStudioTuto("AssetsContent");
            // }
        }
    }, [exhibit]);

   

    if (destination == null || exhibit == null) return null;

    return (
        <Fragment key={exhibit}>
            <ExhibitProvider destination={destination} exhibit={exhibit}>
                <ExhibitEditorProvider>
                    <SpaceSwitchProvider>
                        <EditWorld
                            {...props}
                            exhibit={exhibit}
                            destination={destination}
                        />
                    </SpaceSwitchProvider>
                </ExhibitEditorProvider>
            </ExhibitProvider>
        </Fragment>
    );
}

export default function Studio3D(props) {
    //
    useDialogTheme("dark");

    const { token, authenticated, user, dispatch, invite, isAnonymous } =
        useContext(UserContext);

    const router = useRouter();

    const [openSnackbar] = useSnackbar({
        position: "top-right",
    });

    const requiresSignup = !(authenticated && user?.id && token);

    const onConnect = useEventCallback(async () => {
        //
        await router.replace(router.asPath);
    }, []);

    useEffect(() => {
        //
        removeQueryParam(router, "templateId");

        amplitude_logAnalyticsEvent("visit_studio", {
            user_id: user?.id,
            exhibitId: props.exhibit?.id,
            destination: props.exhibit?.info?.room,
            ownerId: props.exhibit?.owner,
            collab: props.exhibit?.editors?.length > 1,
        });
    }, []);

    useEffect(() => {
        if (invite) {
            openSnackbar(
                invite.message,
                5000,
                null,
                invite.success ? "success" : "error"
            );
        }
    }, [invite]);

    return (
        <WorldProvider>
            <Content>
                {!isAnonymous && requiresSignup && (
                    <ConnectContainer>
                        <ConnectWrapper>
                            <ProviderButtonsWrapper onConnect={onConnect}>
                                <ProviderButtons />
                            </ProviderButtonsWrapper>
                        </ConnectWrapper>
                    </ConnectContainer>
                )}
                {(!requiresSignup || isAnonymous) && (
                    <Studio3D_Child key={props.exhibit?.id} {...props} />
                )}
            </Content>
        </WorldProvider>
    );
}

const Content = styled.div`
    position: relative;
    width: 100%;
    height: 100vh;
    margin: 0 auto;
    background: #000;

    .icon-invert {
        filter: invert(0.5);
    }

    & .y-scroll {
        overflow-x: hidden;

        // grid-auto-rows: 1fr;

        &::-webkit-scrollbar {
            width: 0 !important;
        }

        scrollbar-width: none;

        &::-webkit-scrollbar-thumb {
            border-radius: 8px;
            background: #999999;
        }
    }

    & .mobile {
        display: none;
    }

    @media (max-width: 600px) {
        & .mobile {
            display: flex;
        }

        & .desktop {
            display: none !important;
        }
    }
`;

const ConnectContainer = styled.div`
    width: 100%;
    min-height: 100vh;
    padding: 32px;

    display: flex;
    justify-content: center;
    align-items: center;
`;

const ConnectWrapper = styled.div`
    max-width: 340px;
    width: 100%;
`;
