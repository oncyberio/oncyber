import { failLobbyDestination, isLobbyDestinationPreparing } from "@utils/lobbyDestinationBridge";
import { trackExperienceNavigation } from "@utils/experienceNavigation";
import { finishWorldTravel } from "@utils/nativeWorldTravel";
import { finishSpaceEntrance } from "@utils/spaceEntrance";
import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/router";

import type { AppProps } from "next/app";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import { UserProvider } from "@components/context/UserContext";

import { ThemeProvider } from "@components/context/ThemeProvider";

import I18nProvider from "@components/context/I18nContext";

import SnackbarProvider from "@components/Snackbar";

import "@styles/globals.css";

import "@components/Snackbar/Snackbar.css";

import Headers from "@components/layouts/headers";
//
import ProgressBar from "@components/ProgressBar";

import { DialogProvider } from "@components/Dialogs";
import { SignInSheetHost } from "@ui/components/ConnectWallet/SignInSheetHost";

import useSyncRecommend from "@components/hooks/useSyncRecommend";

import OnboardingProvider from "@features/onboarding/context/OnboardingContext";

import { nodeEnv } from "@env";

import dynamic from "next/dynamic";

import Iframe from "@components/layouts/iframe";
import { isSupportedRuntime } from "@utils/runtimeKind";

const AIProvider = dynamic(() => import("@features/ai/context/AIContext"));

const EmailAuthHandler = dynamic(
    () => import("@components/modals/SignupProvider/EmailAuthHandler"),
    {
        ssr: false,
    }
);

const MyApp = ({ Component, pageProps }: AppProps) => {
    const router = useRouter();
    useEffect(() => trackExperienceNavigation(router), [router.events]);

    const world = useRef(null);

    const isGL = router.pathname === "/gl/[id]";

    useSyncRecommend(pageProps);
    // Preparation documents render the same empty shell on the server and
    // first client pass. Decide parent ownership before mounting a runtime.
    const lobbyAttempt = router.query.__lobbyAttempt;
    const lobbyRequest = typeof lobbyAttempt === "string" && /^[a-z0-9-]{20,80}$/i.test(lobbyAttempt);
    const [lobbyFrameChecked, setLobbyFrameChecked] = useState(false);
    useEffect(() => { setLobbyFrameChecked(true); }, []);
    const lobbyPreparation = lobbyFrameChecked && isLobbyDestinationPreparing();
    // Built-in worlds (pageProps.lobbyWorld) own the lobby bridge themselves.
    const lobbyUnsupported = lobbyPreparation && !pageProps.lobbyWorld && (
        !pageProps.experience ||
        (pageProps.experience && !isSupportedRuntime(pageProps.experience.runtime)) ||
        (pageProps.gatingError && pageProps.gatingError.type !== "success")
    );
    useEffect(() => {
        if (!lobbyUnsupported) return;
        if (pageProps.experience && !isSupportedRuntime(pageProps.experience.runtime)) {
            failLobbyDestination("This world opens in its own page.", "unsupported");
        } else if (pageProps.gatingError && pageProps.gatingError.type !== "success") {
            failLobbyDestination("Open this world to complete its access requirements.", "gated");
        } else {
            failLobbyDestination("This world is unavailable for lobby preparation.", "unavailable");
        }
    }, [lobbyUnsupported, pageProps]);

    useEffect(() => {
        // Error/profile/gated destinations must never remain behind the entrance.
        if (!pageProps.experience || !isSupportedRuntime(pageProps.experience.runtime) || (pageProps.gatingError && pageProps.gatingError.type !== "success")) {
            finishSpaceEntrance();
            finishWorldTravel();
        }
    }, [pageProps]);

    useEffect(() => {
        if (isGL) return;

        router.events.on("routeChangeStart", (route) => {
            if (route === "/mints") {
                document.cookie = "mints-page-source=navbar";
                amplitude_logAnalyticsEvent("view_mints_page", {
                    source: "navbar",
                });
            }
        });
        // analytics();
    }, []);

    useEffect(() => {
        function handleChange() {
            const doc = document.documentElement;
            doc.style.setProperty("--100-vh", `${window.innerHeight}px`);
        }

        handleChange();

        window.addEventListener("scroll", handleChange);
        window.addEventListener("resize", handleChange);
        window.addEventListener("orientationchange", handleChange);
        if (screen?.orientation) {
            screen.orientation.addEventListener("change", handleChange);
        }

        return () => {
            window.removeEventListener("scroll", handleChange);
            window.removeEventListener("resize", handleChange);
            window.removeEventListener("orientationchange", handleChange);
            if (screen?.orientation) {
                screen.orientation.removeEventListener("change", handleChange);
            }
        };
    }, []);

    if ((lobbyRequest && !lobbyFrameChecked) || lobbyUnsupported) return null;

    if (isGL)
        return (
            <>
                <Headers />
                <Component {...pageProps} />
            </>
        );

    return (
        <ThemeProvider>
            <I18nProvider>
                <SnackbarProvider>
                    <Headers />
                    <UserProvider {...pageProps}>
                        <OnboardingProvider>
                            <AIProvider>
                                <DialogProvider>
                                    {/* The one sign-in sheet: every page's
                                        sign-in prompt opens this copy. */}
                                    <SignInSheetHost>
                                        <Iframe />
                                        <EmailAuthHandler />
                                        {/* <ProgressBar /> */}
                                        <Component {...pageProps} />
                                    </SignInSheetHost>
                                </DialogProvider>
                            </AIProvider>
                        </OnboardingProvider>
                    </UserProvider>
                </SnackbarProvider>
            </I18nProvider>
        </ThemeProvider>
    );
};

export default MyApp;
