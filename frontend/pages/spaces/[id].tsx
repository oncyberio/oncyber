import Head from "next/head";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useContext,
} from "react";
import styled from "styled-components";
import { UserContext } from "@components/context/UserContext";

const Error = dynamic(() => import("../../components/Error"));
import { createGlobalStyle } from "styled-components";

import { useRouter } from "next/router";
import { AuthServerSidePropsLite } from "../../utils/authServerSideProps";
import { rooms } from "../../utils/rooms";
import { amplitude_logAnalyticsEvent, getCookie } from "../../utils/analytics";

import { fetchExhibitData } from "../../utils/ssr";
import { checkGating, GatingCheckResult } from "../../utils/checkGatingRules";

import dynamic from "next/dynamic";
import { cloudinary } from "@utils/urlUtils";
import { Experience } from "@uitypes/experience";
import { RoomParameters } from "@uitypes/roomParameters";
import { GatingErrorProvider } from "@components/context/GatingErrorContext";
import { preloadExhibitPortalData } from "@utils/csr";
import { getJSON } from "@utils/js";
import NotificationService from "@api/notifications/_api";
import { isEmbeddedRuntime } from "@features/content-host/runtime";
import { isSupportedRuntime } from "@utils/runtimeKind";

// Gate boots the engine only after a WebGL preflight (renderer.js throws without
// a WebGL context); shows a graceful fallback otherwise.
import Exhibit3DDisplay from "@3/displyUI/Exhibit3DGate";

const EmbeddedExperience = dynamic(() => import("@features/content-host/EmbeddedExperience"), { ssr: false });

export default function Exhibit(props: {
    experience: Experience;
    dest: RoomParameters;
    gatingError?: GatingCheckResult;
    getExhibitPath: (exhibit: Experience, pathname: string) => string;
}) {
    const { isAnonInitialized } = useContext(UserContext);
    if (!isAnonInitialized) return null;
    if (props.experience && !isSupportedRuntime(props.experience.runtime)) {
        return <Error statusCode={404} />;
    }
    if (isEmbeddedRuntime(props.experience?.runtime)) {
        return <EmbeddedExperience key={props.experience.id} experience={props.experience} />;
    }
    return <NativeExhibit key={props.experience?.id} {...props} />;
}

/** Worlds whose portal previews the page warms (the SSR did not, < 50). */
function shouldPreloadPortals(experience: Experience) {
    return (
        !!experience &&
        Object.keys(experience.portalExhibits || {}).length === 0 &&
        Object.keys(experience.portals || {}).length < 50
    );
}

function NativeExhibit({
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

    // lower res version for twitter etc.
    if (
        experience?.info?.cHeroImg &&
        !experience.info.cHeroImg.includes("/upload/c_scale,w_700/")
    ) {
        var splitted = experience.info.cHeroImg.split("/upload/");
        experience.info.cHeroImg =
            splitted[0] + "/upload/c_scale,w_700/" + splitted[1];
    }

    if (!experience || !destination) {
        return <Error statusCode={404} />;
    }

    if (gatingError?.type === "other-error") {
        return <Error statusCode={500} />;
    }

    const creatorName =
        _experience?.ownerName || experience?.owner?.slice?.(0, 5);
    const baseSEODescription = experience?.info?.description
        ? experience?.info?.description + "\n\n"
        : `Immerse yourself in ${creatorName}'s ${
              experience?.info?.headline || experience?.info?.room
          }.`;
    const SEOCompletionList = Object.entries(experience?.artworks)
        ?.map((x) => {
            let artworkData = x[1]?.data;
            return (
                artworkData?.creator?.user?.username ||
                artworkData?.contract?.name ||
                artworkData?.name ||
                null
            );
        })
        .filter((x) => x);
    const SEOCompletion = SEOCompletionList.filter(
        (element, index) => SEOCompletionList.indexOf(element) === index
    ).join(", ");
    const formatedCompletion =
        SEOCompletionList?.length > 0
            ? "\nFeaturing NFTs from " +
              (SEOCompletion?.length > 130
                  ? SEOCompletion.slice(0, 130 - baseSEODescription.length)
                        .split(",")
                        .slice(0, -1)
                        .join(",")
                  : SEOCompletion) +
              " and many more"
            : "";
    const finalDescriptionSEO =
        baseSEODescription.length < 160
            ? baseSEODescription + formatedCompletion
            : baseSEODescription
                  .slice(0, 160)
                  .split(" ")
                  .slice(0, -1)
                  .join(" ");

    return (
        <div>
            <Head>
                <title>
                    {experience?.info?.headline ||
                        `${creatorName}'s Untitled ${experience?.info?.room} - oncyber`}
                </title>
                <meta
                    key="description"
                    name="description"
                    content={finalDescriptionSEO}
                />
                <meta
                    key="keywords"
                    name="keywords"
                    content={SEOCompletion}
                ></meta>
                <meta
                    key="ogTitle"
                    property="og:title"
                    content={experience?.info?.headline}
                />
                <meta
                    key="ogDescription"
                    property="og:description"
                    content={experience.info.description || finalDescriptionSEO}
                />
                <meta
                    key="ogImage"
                    property="og:image"
                    content={
                        experience?.info?.heroImg ||
                        experience?.info?.cHeroImg ||
                        destination?.image ||
                        "https://oncyber.io/images/thumbnail.png"
                    }
                />

                <meta
                    key="twitterTitle"
                    name="twitter:title"
                    content={
                        experience?.info?.headline ||
                        `${creatorName}'s Untitled ${experience?.info?.room} - oncyber`
                    }
                />
                <meta
                    key="twitterImage"
                    name="twitter:image"
                    content={
                        experience?.info?.heroImg ||
                        experience?.info?.cHeroImg ||
                        destination?.image ||
                        "https://oncyber.io/images/thumbnail.png"
                    }
                />
                <meta
                    key="twitterCard"
                    name="twitter:card"
                    content="summary_large_image"
                />
                <meta
                    key="twitterDescription"
                    name="twitter:description"
                    content={experience.info.description || finalDescriptionSEO}
                />
            </Head>

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
                            onWorldRendered={handleWorldRendered}
                            enableEditor={true}
                        />
                    </GatingErrorProvider>
                </SceneContainer>
            </Container>
        </div>
    );
}

export const getServerSideProps = AuthServerSidePropsLite(
    async ({ query, res }, user, token) => {
        let data = await fetchExhibitData(query.id, "id");
        let gatingError = null;

        if (data?.experience?.info?.customLink) {
            return { redirect: {
                destination: "/" + data.experience.info.customLink,
                permanent: true,
            } };
        }

        if (data.experience) {
            // solo mode should be cheked server side for safety
            let result = await checkGating(data.experience, user, 0);

            gatingError = result.type === "success" ? null : result;
        }

        if (!data.dest) {
            // In the case where it's null then destination doesn't exist/is deleted
            data.dest =
                (data.experience && rooms[data.experience?.info.room]) || null;
        }

        return {
            ...data,
            gatingError,
        };
    }
);

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
