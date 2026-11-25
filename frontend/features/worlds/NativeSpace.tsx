/**
 * A native space drawn by the engine in this document: the page itself
 * where worlds are not framed, and the world host's side where they are.
 *
 * Kept apart from the page's route (pages/spaces/[id].tsx) so that the
 * site's page around a framed world never loads it: it draws no world, and
 * importing this file starts the engine's downloads.
 */
import {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import styled, { createGlobalStyle } from "styled-components";
import { UserContext } from "@components/context/UserContext";
import { GatingErrorProvider } from "@components/context/GatingErrorContext";
import SpaceSeo from "@components/seo/SpaceSeo";
import NotificationService from "@api/notifications/_api";
import { Experience } from "@uitypes/experience";
import { RoomParameters } from "@uitypes/roomParameters";
import { amplitude_logAnalyticsEvent, getCookie } from "@utils/analytics";
import type { GatingCheckResult } from "@utils/checkGatingRules";
import { preloadExhibitPortalData } from "@utils/csr";
import { cloudinary } from "@utils/urlUtils";
import { WORLD_SCRIPTS_ENABLED } from "@features/world-scripts/store";
// Gate boots the engine only after a WebGL preflight (renderer.js throws without
// a WebGL context); shows a graceful fallback otherwise.
import Exhibit3DDisplay from "@3/displyUI/Exhibit3DGate";
import { worldDocument } from "./worldDocument";

const Error = dynamic(() => import("@components/Error"));
// Sandboxed scripts on top of the world; off unless NEXT_PUBLIC_WORLD_SCRIPTS.
const WorldScriptLayer = dynamic(
    () => import("@features/world-scripts/WorldScriptLayer"),
    { ssr: false }
);

/** Worlds whose portal previews the page warms (the SSR did not, < 50). */
function shouldPreloadPortals(experience: Experience) {
    return (
        !!experience &&
        Object.keys(experience.portalExhibits || {}).length === 0 &&
        Object.keys(experience.portals || {}).length < 50
    );
}

export default function NativeSpace({
    experience: _experience,
    dest,
    gatingError,
    getExhibitPath,
}: {
    experience: Experience;
    dest: RoomParameters;
    gatingError?: GatingCheckResult;
    getExhibitPath: (exhibit: Experience, pathname: string) => string;
}) {
    const [experience, setExperience] = useState(_experience);
    const [destination, setDestination] = useState(dest);
    useEffect(() => {
        setExperience(_experience);
        setDestination(dest);
    }, [_experience, dest]);
    const router = useRouter();
    const [mode, setMode] = useState("solo");
    // console.log("Experience", experience);
    const [isActive, setActive] = useState("3D");
    const { user } = useContext(UserContext);

    // Portal previews (one batched read, then each destination and owner
    // once) wait until the world is showing, so they never compete with the
    // room download. The full exhibit loads when a portal opens.
    const initialExperience = useRef(experience);
    const portalPreload = useRef<AbortController>(null);
    useEffect(() => () => portalPreload.current?.abort("Unmounted"), []);
    const handleWorldRendered = useCallback(() => {
        const world = initialExperience.current;
        if (portalPreload.current || !shouldPreloadPortals(world)) return;
        portalPreload.current = new AbortController();
        preloadExhibitPortalData(world, portalPreload.current.signal);
    }, []);
    // In the site's frame, the page is told once the world has drawn.
    const handleWorldDrawn = useCallback(() => {
        worldDocument()?.drawn();
        handleWorldRendered();
    }, [handleWorldRendered]);

    useEffect(() => {
        if (shouldPreloadPortals(experience)) {
            if (
                user?.id?.toLowerCase?.() !==
                experience?.editors?.[0]?.toLowerCase?.()
            )
                NotificationService.sendVisitNotification({
                    exhibitId: experience.id,
                });
        }
    }, []);

    useEffect(() => {
        //
        (() => {
            if (gatingError || !dest || !experience) return;

            // NOTE: this used to check whether the gallery owner still owns
            // the destination NFT (fetchBalance) and block visitors with an
            // error page. Ownership matters at creation time, not when
            // visiting an already-built gallery — removed.

            let hasFog = destination?.fog?.enabled;
            let hasWater = destination?.enableWater;
            let hasReflector = destination?.enableReflector;
            let hasSky = destination?.enableSky;
            let hasIframe = false;
            let hasYoutube = false;

            Object.values(_experience.artworks).forEach((artwork) => {
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

            if (experience && dest) {
                amplitude_logAnalyticsEvent("open_exhibit_page", {
                    exhibitId: experience?.id,
                    name: experience?.info?.headline,
                    number_of_artworks: Object.keys(experience?.artworks || {})
                        .length,
                    ownerId: experience?.editors[0],
                    collab: experience?.editors?.length > 1,
                    destination: experience?.info?.room,
                    source: getCookie("source.SubNavigation") || "direct",
                    ...(Object.keys(experience?.portals || {}).length > 0
                        ? { contains_portals: "yes" }
                        : {}),
                    isTokenGated: !!experience?.gating,
                    hasFog,
                    hasWater,
                    hasReflector,
                    hasSky,
                    hasIframe,
                    hasYoutube,
                });
            }

            const missingUpload = Object.values(experience?.artworks || {})
                .filter((it) => cloudinary.artworkMissingUpload(it.data))
                .map((it) => it.data);

            if (missingUpload.length) {
                console.error(
                    "Warning. We detected some artworks haven't their media optimized",
                    missingUpload
                );
            }
        })();
    }, [_experience, dest]);
    // check if room still owned

    // const { authenticated, userData } = useContext(UserContext);

    // make sure to check currently signed in user is same as current experience, then let them edit
    // const metadata = (userData && props.id == userData.id ? userData : props);
    // const editing = (userData && props.id == userData.id ? true : false)

    const artworks = useMemo(() => {
        return Object.values(experience?.artworks || {});
    }, [experience]);

    const isHub = Object.keys(experience?.portals || {}).length > 3;

    // That's the same as `setActive`
    // const changeTab = (tab) => {
    //     setActive(tab);
    // };

    const changeExhibit = useCallback(
        (exhibit, destination) => {
            setExperience(exhibit);
            setDestination(destination);

            let pathname = router.pathname;
            let asPath;
            if (pathname.toLowerCase() === "/spaces/[id]") {
                asPath = `/spaces/${exhibit.id}`;
            } else if (getExhibitPath != null) {
                asPath = getExhibitPath(exhibit, pathname);
            }
        },
        [setExperience, setDestination, router]
    );

    if (!experience || !destination) {
        return <Error statusCode={404} />;
    }

    if (gatingError?.type === "other-error") {
        return <Error statusCode={500} />;
    }

    return (
        <div>
            <SpaceSeo
                experience={experience}
                destination={destination}
                // The space on show: after travelling through a portal
                // that is no longer the one the page loaded with.
                ownerName={
                    experience.ownerName ??
                    (experience.id === _experience?.id
                        ? _experience?.ownerName
                        : undefined)
                }
                gated={!!gatingError}
            />

            <Container>
                <GlobalStyle />
                <SceneContainer>
                    <GatingErrorProvider
                        gatingResult={gatingError}
                        exhibit={experience}
                    >
                        <Exhibit3DDisplay
                            // key={experience.id}
                            setMode={setMode}
                            isActive={isActive}
                            setActive={setActive}
                            mode={mode}
                            isSceneBackground
                            isDisplayMode={true}
                            isHub={isHub}
                            destination={destination}
                            isPointerLockControls={true}
                            artworks={artworks}
                            exhibit={experience || null}
                            changeExhibit={changeExhibit}
                            onWorldRendered={handleWorldDrawn}
                            enableEditor={true}
                        />
                        {WORLD_SCRIPTS_ENABLED && !gatingError && (
                            <WorldScriptLayer experience={experience} />
                        )}
                    </GatingErrorProvider>
                </SceneContainer>
            </Container>
        </div>
    );
}

const GlobalStyle = createGlobalStyle`
  body {
    overflow: hidden !important;
  }`;

const Container = styled.div`
    background: #fefefe;
`;

const SceneContainer = styled.div`
    width: 100%;
    height: var(--100-vh);
    height: 100dvh;
    position: fixed;
    inset: 0;
    overflow: hidden;
    touch-action: none;

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
`;
