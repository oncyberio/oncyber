import { useFeedContext } from "@components/context/FeedContext";
import { UserContext } from "@components/context/UserContext";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import { deviceOrientation } from "@components/_3DExhibit-v2/three/utils/platform";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { logEvent } from "@utils/saveToDb";
import { useRouter } from "next/router";
import { useContext, useEffect, useRef, useState } from "react";
import Events from "@3events";
import AlgoliaProvider from "@utils/algolia/AlgoliaProvider";

export default function useAnalytics({
    exhibit,
    hasBackPortal,
    settings,
    destination,
}) {
    const world = useWorld();

    const { token, user } = useContext(UserContext);

    const close_logEndExhibitRef = useRef(null);

    const back_logEndExhibitRef = useRef(null);

    const timeStart = useRef(null);

    const prevUrl = useRef(null);

    const [hasVisited, toggleVisited] = useState(false);

    const { mode, changeMode } = useMultiplayer();

    const router = useRouter();

    const logEndExhibit = (type: "close" | "back" = "close", exhibit) => {
        var timeEnd = Date.now() - timeStart.current;

        const performance = world.current.getPerformance();

        const payload: any = analyticsPayload(
            exhibit,
            performance,
            mode,
            destination
        );

        if (type === "back") {
            world.current.resetPerformance();
        }

        if (IS_MOBILE) {
            payload.screen_mode = deviceOrientation();
        }

        amplitude_logAnalyticsEvent("end_exhibit", payload);
    };

    const close_logEndExhibit = () => {
        logEndExhibit("close", exhibit);
    };

    const back_logEndExhibit = (newUrl) => {
        //! should call this

        console.log("amplitude", prevUrl.current, newUrl.split("?")[0]);

        if (prevUrl.current === newUrl.split("?")[0]) return;

        logEndExhibit("back", exhibit);

        // setTimeout(() => {
        // }, 100);
    };

    useEffect(() => {
        if (world.current && hasVisited) {
            world.current.setEventListener(Events.SEND_FPS, function () {
                const performance = world.current.getPerformance();

                amplitude_logAnalyticsEvent(
                    "fps_sample_20s",
                    analyticsPayload(exhibit, performance, mode, destination)
                );
            });

            return () => {
                world.current.setEventListener(Events.SEND_FPS, null);
            };
        }
    }, [exhibit, mode, world.current, hasVisited]);

    useEffect(() => {
        if (world.current && hasVisited) {
            // playExhibit(false, true, false, mode);
            handleEndExhibitAnalytics(true, mode);
            handleStartExhibitAnalytics(mode);
        }
    }, [router.query.slug, `spaces/${router.query.id}`, world.current]);

    useEffect(() => {
        return () => {
            if (close_logEndExhibitRef.current) {
                window.removeEventListener(
                    "beforeunload",
                    close_logEndExhibitRef.current
                );
            }

            if (back_logEndExhibitRef.current) {
                router.events.off(
                    "routeChangeComplete",
                    back_logEndExhibitRef.current
                );
            }
        };
    }, []);

    function handleStartExhibitAnalytics(mode) {
        const performance = world.current.getPerformance();

        amplitude_logAnalyticsEvent(
            "start_exhibit",
            analyticsPayload(exhibit, performance, mode, destination)
        );
    }

    function analyticsPayload(exhibit, performance, mode, destination) {
        let hasFog = destination?.fog?.enabled;
        let hasWater = destination?.enableWater;
        let hasReflector = destination?.enableReflector;
        let hasSky = destination?.enableSky;
        let hasIframe = false;
        let hasYoutube = false;

        const artworks = exhibit.artworks || [];

        Object.values(artworks).forEach((artwork) => {
            if (
                // @ts-ignore
                artwork.data.mime_type === "embed/html/website" ||
                // @ts-ignore
                artwork.data.mime_type === "embed/html"
            ) {
                hasIframe = true;
            }

            // @ts-ignore
            if (artwork.data.mime_type === "embed/youtube") {
                hasYoutube = true;
            }
        });

        return {
            exhibitId: exhibit?.id,
            user_id: user?.id,
            ownerId: exhibit?.owner,
            exhibitName: exhibit?.info?.headline,
            collab: exhibit?.editors?.length > 1,
            number_of_artworks: Object.keys(exhibit?.artworks || {}).length,
            destination: exhibit?.info?.room,
            screen_mode: deviceOrientation(),
            source: hasBackPortal ? "back-portal" : "portal",
            ...world.current.getPlayerData({
                isFirstPerson: true,
            }),
            ...(Object.keys(exhibit?.portals || {}).length > 0
                ? { contains_portals: "yes" }
                : {}),
            isTokenGated: !!exhibit?.gating,
            mode,
            cpu: performance?.performance?.cpu,
            currentFps: performance?.performance?.currentFps,
            deviceType: performance?.performance?.deviceType,
            gpu: performance?.performance?.gpu,
            maxFPS: performance?.performance?.maxFPS,
            monitorRefreshRate: performance?.performance?.monitorFreshRate,
            score: performance?.performance?.score,
            exhibitFPS: performance?.performance?.exhibitFPS,
            textures: performance?.render?.textures,
            triangles: performance?.render?.triangles,
            camera: settings.camera,
            avatar: settings.avatar,
            quality: settings.quality,
            hasFog,
            hasWater,
            hasReflector,
            hasSky,
            hasIframe,
            hasYoutube,
        };
    }

    function handleEndExhibitAnalytics(force, mode) {
        if (!hasVisited || force) {
            // remove old functions

            if (close_logEndExhibitRef.current) {
                window.removeEventListener(
                    "beforeunload",
                    close_logEndExhibitRef.current
                );
            }

            if (back_logEndExhibitRef.current) {
                router.events.off(
                    "routeChangeComplete",
                    back_logEndExhibitRef.current
                );
            }

            close_logEndExhibitRef.current = close_logEndExhibit;

            back_logEndExhibitRef.current = back_logEndExhibit;

            if (force) {
                back_logEndExhibit(
                    `/${router.query.slug || `spaces/${router.query.id}`}`
                );
            }

            window.addEventListener(
                "beforeunload",
                close_logEndExhibitRef.current
            );

            router.events.on(
                "routeChangeComplete",
                back_logEndExhibitRef.current
            );

            prevUrl.current = `/${
                router.query.slug || `spaces/${router.query.id}`
            }`;

            timeStart.current = Date.now();

            toggleVisited(true);

            // // get new functions

            // someone has to spend 15s in a space to be really counted
            setTimeout(() => {
                logEvent("click_start_show", {
                    exhibitId: exhibit?.id,
                    ownerId: exhibit?.editors?.[0],
                });
            }, 15000);
        }
    }

    return {
        handleStartExhibitAnalytics,
        handleEndExhibitAnalytics,
    };
}
